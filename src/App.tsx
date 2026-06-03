import { Suspense, lazy, useState, useCallback, useEffect, useRef } from 'react';
import type { Paciente, Agendamento, Laudo, PageType, QueueAdvanceOffer } from './types';
import {
  ROLE_PAGES,
  agendamentoToApiAppointment,
  apiAppointmentToAgendamento,
  apiPatientToPaciente,
  apiReportToLaudo,
  laudoToApiReport,
  pacienteToApiPatient,
} from './types';
import { useAuth } from './contexts/AuthContext';
import { appointmentsApi, doctorsApi, patientsApi, reportsApi } from './lib/api';
import { smsApi } from './lib/api';
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from './lib/api';
import { queueAiApi } from './lib/aiApi';
import LoadingState from './app/LoadingState';
import { buildRoleNotifications } from './app/notifications';
import type { NotificationItem } from './app/notifications';
import { dateToISO, timeToHHMM } from './shared/utils/date';
import { mergeById } from './shared/utils/collection';
import { toUserFacingErrorMessage } from './shared/utils/errors';
import { normalizePhoneBRForSms } from './shared/utils/validation';
import { buildAdvanceOfferMessage, buildQueueCandidates, sortQueueCandidates } from './shared/utils/advanceQueue';

import Login         from './pages/Login';
import CadastroPaciente from './pages/CadastroPaciente';
import Sidebar       from './components/Sidebar';
import Topbar        from './components/Topbar';
import PatientChatbot from './components/PatientChatbot';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Pacientes = lazy(() => import('./pages/Pacientes'));
const Agenda = lazy(() => import('./pages/Agenda'));
const FilaPrioridade = lazy(() => import('./pages/FilaPrioridade'));
const Registro = lazy(() => import('./pages/Registro'));
const Laudos = lazy(() => import('./pages/Laudos'));
const Configuracoes = lazy(() => import('./pages/Configuracoes'));
const Comunicacao = lazy(() => import('./pages/Comunicacao'));
const Mensagens = lazy(() => import('./pages/Mensagens'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Usuarios = lazy(() => import('./pages/Usuarios'));
const Metricas = lazy(() => import('./pages/Metricas'));
const AssistenteIA = lazy(() => import('./pages/AssistenteIA'));

const onlyActiveAppointments = (appointments: ApiAppointment[]) =>
  appointments.filter(appointment => appointment.status !== 'cancelled');

function isElapsedAgendamento(appointment: Agendamento) {
  if (appointment.status === 'cancelado') return false;
  const todayISO = dateToISO(new Date());
  const nowTime = timeToHHMM(new Date());
  return appointment.data < todayISO || (appointment.data === todayISO && appointment.hora <= nowTime);
}

function withElapsedStatus(appointment: Agendamento): Agendamento {
  return isElapsedAgendamento(appointment) ? { ...appointment, status: 'realizado' } : appointment;
}

const toVisibleAgendamentos = (appointments: ApiAppointment[]) =>
  onlyActiveAppointments(appointments).map(apiAppointmentToAgendamento).map(withElapsedStatus);

const ADVANCE_OFFERS_KEY = 'mc_advance_queue_offers';

function readAdvanceOffers(): QueueAdvanceOffer[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADVANCE_OFFERS_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is QueueAdvanceOffer => Boolean(item && typeof item === 'object' && 'id' in item)) : [];
  } catch {
    return [];
  }
}

function appendAdvanceOffer(offer: QueueAdvanceOffer) {
  const offers = readAdvanceOffers();
  localStorage.setItem(ADVANCE_OFFERS_KEY, JSON.stringify([...offers, offer]));
  window.dispatchEvent(new Event('mc-advance-offers-updated'));
}

function hasOpenAdvanceOffer(slotId: string) {
  return readAdvanceOffers().some(offer =>
    offer.slotId === slotId &&
    ['pending', 'sent', 'accepted'].includes(offer.status)
  );
}

function isPermissionError(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return message.includes('row-level security') || message.includes('403') || message.includes('forbidden');
}

function isMissingPatientAppointmentRpc(err: unknown) {
  const message = err instanceof Error ? err.message.toLowerCase() : '';
  return (
    message.includes('create_my_appointment') &&
    (message.includes('schema cache') || message.includes('404') || message.includes('could not find the function'))
  );
}

function formatDateBR(dateISO: string) {
  return dateISO.split('-').reverse().join('/');
}

export default function App() {
  const { user, loading } = useAuth();

  const [pacientes,    setPacientes]    = useState<Paciente[]>([]);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [laudos,       setLaudos]       = useState<Laudo[]>([]);
  const [doctors,      setDoctors]      = useState<ApiDoctor[]>([]);
  const [apiLoading,   setApiLoading]   = useState(false);
  const [apiError,     setApiError]     = useState<string | null>(null);
  const [dataLoaded,   setDataLoaded]   = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('mc_read_notifications') || '[]') as string[];
    } catch {
      return [];
    }
  });

  const [openAgendaModal,    setOpenAgendaModal]    = useState(false);
  const [openPacienteModal,  setOpenPacienteModal]  = useState(false);
  const [agendaPatientId,    setAgendaPatientId]    = useState<string | null>(null);
  const [page, setPage]                             = useState<PageType>('dashboard');
  const [authView, setAuthView]                     = useState<'login' | 'cadastro-paciente'>('login');
  const createdPatientsRef = useRef<ApiPatient[]>([]);
  const previousUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const nextUserId = user?.id ?? null;
    if (previousUserIdRef.current === nextUserId) return;

    previousUserIdRef.current = nextUserId;
    setPage('dashboard');
    setOpenAgendaModal(false);
    setOpenPacienteModal(false);
    setAgendaPatientId(null);
    setApiError(null);

    if (!nextUserId) {
      setAuthView('login');
    }
  }, [user?.id]);

  // ─── Carrega dados da API ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user) {
      createdPatientsRef.current = [];
      setPacientes([]);
      setAgendamentos([]);
      setLaudos([]);
      setDoctors([]);
      setApiError(null);
      setDataLoaded(false);
      return;
    }
    setApiLoading(true);
    setApiError(null);
    const withCreatedPatients = (apiPatients: ApiPatient[]) => mergeById(apiPatients, createdPatientsRef.current);

    const errors: string[] = [];
    const capture = (label: string, err: unknown) => {
      void err;
      errors.push(`Não foi possível carregar ${label}.`);
    };

    try {
      // ── Perfil Médico ──
      if (user.role === 'medico') {
        const doctorId = user.doctor_id;
        const creatorIds = [user.id, doctorId].filter(Boolean) as string[];

        // Busca agendamentos do médico:
        // Se tiver doctor_id → filtra por ele
        // Se não tiver → busca todos (RLS do Supabase deve limitar ao usuário)
        const [apiAgendamentos, apiLaudos, apiPacientesGerais, pacientesCriadosPorUsuario, pacientesCriadosPorDoctor, apiDoctors] = await Promise.all([
          appointmentsApi
            .list(doctorId ? { doctor_id: doctorId } : {})
            .catch(err => { capture('agendamentos', err); return [] as ApiAppointment[]; }),
          reportsApi
            .listByCreators(creatorIds)
            .catch(err => { capture('laudos', err); return [] as ApiReport[]; }),
          patientsApi
            .list({ limit: 500 })
            .catch(err => { capture('pacientes', err); return [] as ApiPatient[]; }),
          patientsApi
            .list({ created_by: user.id, limit: 500 })
            .catch(err => { capture('pacientes criados pelo usuário', err); return [] as ApiPatient[]; }),
          doctorId
            ? patientsApi
                .list({ created_by: doctorId, limit: 500 })
                .catch(err => { capture('pacientes criados pelo médico', err); return [] as ApiPatient[]; })
            : Promise.resolve([] as ApiPatient[]),
          doctorsApi
            .list()
            .catch(err => { capture('médicos', err); return [] as ApiDoctor[]; }),
        ]);

        const apiAgendamentosAtivos = onlyActiveAppointments(apiAgendamentos);

        // Busca pacientes vinculados aos agendamentos e laudos
        const patientIds = Array.from(new Set([
          ...apiAgendamentosAtivos.map(a => a.patient_id),
          ...apiLaudos.map(l => l.patient_id),
        ].filter(Boolean)));

        let pacientesVinculados: ApiPatient[] = [];
        if (patientIds.length > 0) {
          pacientesVinculados = await patientsApi
            .listByIds(patientIds)
            .catch(err => { capture('pacientes vinculados', err); return []; });
        } else {
          // Sem agendamentos/laudos → tenta listar todos (pode ser médico novo)
          pacientesVinculados = await patientsApi
            .list({ limit: 500 })
            .catch(err => { capture('pacientes', err); return []; });
        }

        const apiPacientes = mergeById(
          apiPacientesGerais,
          pacientesVinculados,
          pacientesCriadosPorUsuario,
          pacientesCriadosPorDoctor
        );

        setPacientes(withCreatedPatients(apiPacientes).map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos(apiLaudos.map(apiReportToLaudo));
        setDoctors(apiDoctors);

      // ── Perfil Secretaria ──
      } else if (user.role === 'secretaria') {
        const [apiPacientes, apiAgendamentos, apiDoctors] = await Promise.all([
          patientsApi.list({ limit: 500 }).catch(err => { capture('pacientes', err); return []; }),
          appointmentsApi.list({}).catch(err => { capture('agendamentos', err); return []; }),
          doctorsApi.list({ active: true }).catch(err => { capture('médicos', err); return []; }),
        ]);
        setPacientes(withCreatedPatients(apiPacientes).map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos([]);
        setDoctors(apiDoctors);

      } else if (user.role === 'paciente') {
        const ownPatientsById = user.patient_id
          ? await patientsApi.listByIds([user.patient_id]).catch(err => { capture('paciente', err); return [] as ApiPatient[]; })
          : [];
        const ownPatientsByEmail = await patientsApi
          .list({ email: user.email.toLowerCase().trim(), limit: 5 })
          .catch(err => { capture('paciente por e-mail', err); return [] as ApiPatient[]; });
        const ownPatients = mergeById(ownPatientsById, ownPatientsByEmail);
        const patientIds = Array.from(new Set([
          ...ownPatients.map(patient => patient.id),
          user.patient_id,
          user.id,
        ].filter((id): id is string => Boolean(id))));
        const [apiAgendamentos, apiLaudos, apiDoctors] = patientIds.length > 0 ? await Promise.all([
          Promise.all(patientIds.map(patientId =>
            appointmentsApi.listForPatient(patientId).catch(err => { capture(`agendamentos ${patientId}`, err); return [] as ApiAppointment[]; })
          )).then(groups => mergeById(...groups)),
          Promise.all([
            reportsApi.listReleasedForCurrentPatient().catch(() => [] as ApiReport[]),
            Promise.all(patientIds.map(patientId =>
              reportsApi.listForPatient(patientId).catch(err => { capture(`laudos ${patientId}`, err); return [] as ApiReport[]; })
            )).then(groups => mergeById(...groups)),
          ]).then(groups => mergeById(...groups)),
          doctorsApi.listForScheduling().catch(err => { capture('médicos para agendamento', err); return [] as ApiDoctor[]; }),
        ]) : [[] as ApiAppointment[], [] as ApiReport[], [] as ApiDoctor[]];
        setPacientes(ownPatients.map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos(apiLaudos.map(apiReportToLaudo).filter(laudo => laudo.status === 'liberado'));
        setDoctors(apiDoctors);

      // ── Perfil Gestão / Admin ──
      } else {
        const [apiPacientes, apiAgendamentos, apiLaudos, apiDoctors] = await Promise.all([
          patientsApi.list({ limit: 500 }).catch(err => { capture('pacientes', err); return []; }),
          appointmentsApi.list({}).catch(err => { capture('agendamentos', err); return []; }),
          reportsApi.list({}).catch(err => { capture('laudos', err); return []; }),
          doctorsApi.list({ active: true }).catch(err => { capture('médicos', err); return []; }),
        ]);
        setPacientes(withCreatedPatients(apiPacientes).map(apiPatientToPaciente));
        setAgendamentos(apiAgendamentos.map(apiAppointmentToAgendamento).map(withElapsedStatus));
        setLaudos(apiLaudos.map(apiReportToLaudo));
        setDoctors(apiDoctors);
      }

      if (errors.length) {
        setApiError(Array.from(new Set(errors)).join(' '));
      }

    } catch (err) {
      const msg = toUserFacingErrorMessage(err, 'Não foi possível carregar os dados. Atualize a tela e tente novamente.');
      setApiError(msg);
      setPacientes([]);
      setAgendamentos([]);
      setLaudos([]);
      setDoctors([]);
    } finally {
      setApiLoading(false);
      setDataLoaded(true);
    }
  }, [user]);

  // Recarrega quando usuário muda e mantém as telas sincronizadas com a API.
  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => { void refresh(); }, 30000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  // ─── CRUD Pacientes ───────────────────────────────────────────────────────
  const addPaciente = useCallback(async (p: Omit<Paciente, 'id'>) => {
    try {
      const created = await patientsApi.create({
        ...pacienteToApiPatient(p),
        created_by: user?.id,
      });
      createdPatientsRef.current = mergeById(createdPatientsRef.current, [created]);
      await refresh();
    } catch (err) {
      const msg = toUserFacingErrorMessage(err, 'Não foi possível cadastrar o paciente. Confira os dados e tente novamente.');
      setApiError(msg);
      throw new Error(msg);
    }
  }, [refresh, user?.id]);

  const updatePaciente = useCallback(async (p: Paciente) => {
    await patientsApi.update(p.id, pacienteToApiPatient(p));
    await refresh();
  }, [refresh]);

  const deletePaciente = useCallback(async (id: string) => {
    try {
      await patientsApi.delete(id);
      await refresh();
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Erro ao excluir paciente.';
      const lowerMsg = rawMsg.toLowerCase();
      if (rawMsg.includes('403') || lowerMsg.includes('forbidden')) {
        const msg = 'Seu perfil não tem permissão para excluir este paciente.';
        setApiError(msg);
        throw new Error(msg);
      }
      if (lowerMsg.includes('nao excluiu nenhum paciente')) {
        const msg = 'Este paciente não pôde ser excluído com o perfil atual.';
        setApiError(msg);
        throw new Error(msg);
      }
      if (lowerMsg.includes('foreign key') || lowerMsg.includes('violates') || lowerMsg.includes('referenced')) {
        const msg = 'Não foi possível excluir este paciente porque ele possui registros vinculados.';
        setApiError(msg);
        throw new Error(msg);
      }
      const msg = toUserFacingErrorMessage(err, 'Não foi possível excluir o paciente. Tente novamente em instantes.');
      setApiError(msg);
      throw new Error(msg);
    }
  }, [refresh]);

  // ─── CRUD Agendamentos ────────────────────────────────────────────────────
  const addAgendamento = useCallback(async (a: Omit<Agendamento, 'id'>) => {
    if (!user) return;
    // Para médico: usa doctor_id do perfil se não informado
    const medicoId = a.medicoId || (user.role === 'medico' ? user.doctor_id : undefined);
    const pacienteId = user.role === 'paciente' ? a.pacienteId || user.patient_id || pacientes[0]?.id || user.id : a.pacienteId;
    if (!medicoId) {
      setApiError('Selecione um médico para criar o agendamento.');
      return;
    }
    if (!pacienteId) {
      setApiError('Seu perfil de paciente não está vinculado a um cadastro de paciente.');
      return;
    }

    const paciente = pacientes.find(item => item.id === pacienteId);
    const medico = doctors.find(item => item.id === medicoId);
    const payload = agendamentoToApiAppointment({ ...a, pacienteId, medicoId }, user.id);
    try {
      if (user.role === 'paciente') {
        try {
          await appointmentsApi.createForCurrentPatient({
            p_doctor_id: payload.doctor_id,
            p_scheduled_at: payload.scheduled_at,
            p_duration_minutes: payload.duration_minutes,
            p_notes: payload.notes,
          });
        } catch (rpcErr) {
          if (!isMissingPatientAppointmentRpc(rpcErr)) throw rpcErr;
          await appointmentsApi.create(payload);
        }
      } else {
        await appointmentsApi.create(payload);
      }
    } catch (err) {
      if (user.role !== 'paciente') throw err;
      if (isPermissionError(err) || isMissingPatientAppointmentRpc(err)) {
        throw new Error('O agendamento pelo paciente ainda não está disponível. Fale com a secretaria para concluir a solicitação.');
      }
      throw err;
    }

    // Envio de SMS sem bloquear o fluxo de agendamento.
    const smsPhone = normalizePhoneBRForSms(paciente?.telefone ?? '');
    if (paciente && smsPhone && medico) {
      const smsMessage = [
        `Ola ${paciente.nome}.`,
        '',
        `Sua consulta foi agendada com Dr. ${medico.full_name}.`,
        '',
        `Especialidade: ${medico.specialty || 'Nao informada'}`,
        `Data: ${formatDateBR(a.data)}`,
        `Horario: ${a.hora}`,
        '',
        'Equipe MediConnect.',
      ].join('\n');

      try {
        await smsApi.send({
          patient_id: paciente.id,
          phone_number: smsPhone,
          message: smsMessage,
        });
      } catch (smsErr) {
        const smsMessageError = smsErr instanceof Error ? smsErr.message : 'Erro ao enviar SMS.';
        const canSendSmsByRole = user.role === 'secretaria' || user.role === 'gestao';
        if (canSendSmsByRole) {
          setApiError(`Consulta criada, mas o SMS nao foi enviado: ${smsMessageError}`);
        }
      }
    }

    await refresh();
  }, [doctors, pacientes, refresh, user]);

  const updateAgendamento = useCallback(async (a: Agendamento) => {
    if (!user) return;
    const current = agendamentos.find(item => item.id === a.id);
    if (current && isElapsedAgendamento(current)) {
      throw new Error('Consultas com horário já passado ficam como atendidas e não podem ser alteradas.');
    }
    const medicoId = a.medicoId || (user.role === 'medico' ? user.doctor_id : undefined);
    if (!medicoId) {
      setApiError('Selecione um médico para atualizar o agendamento.');
      return;
    }
    if (user.role === 'paciente') {
      try {
        await appointmentsApi.acceptAdvanceOfferForCurrentPatient({
          p_appointment_id: a.id,
          p_doctor_id: medicoId,
          p_scheduled_at: `${a.data}T${a.hora}:00Z`,
        });
        await refresh();
        return;
      } catch (rpcErr) {
        const message = rpcErr instanceof Error ? rpcErr.message.toLowerCase() : '';
        if (message.includes('accept_my_advance_offer') || message.includes('schema cache') || message.includes('404') || message.includes('could not find the function')) {
          throw new Error('Não foi possível aceitar a antecipação agora. Fale com a secretaria para confirmar a vaga.');
        }
        throw rpcErr;
      }
    }
    await appointmentsApi.update(
      a.id,
      agendamentoToApiAppointment({ ...a, medicoId }, user.id)
    );
    await refresh();
  }, [agendamentos, refresh, user]);

  const sendAdvanceOfferForCancelledAppointment = useCallback(async (cancelled: Agendamento) => {
    if (!cancelled.medicoId) return;
    const doctor = doctors.find(item => item.id === cancelled.medicoId);
    if (!doctor?.specialty) return;

    const slotId = `cancelled:${cancelled.id}`;
    if (hasOpenAdvanceOffer(slotId)) return;

    const candidates = buildQueueCandidates({
      slotDoctorId: doctor.id,
      slotSpecialty: doctor.specialty,
      slotDate: cancelled.data,
      slotTime: cancelled.hora,
      patients: pacientes,
      appointments: agendamentos,
      doctors,
    });

    let orderedCandidates = sortQueueCandidates(candidates);
    try {
      const suggestion = await queueAiApi.suggestOrder({
        specialty: doctor.specialty,
        slotDate: cancelled.data,
        slotTime: cancelled.hora,
        candidates,
      });
      const byPatientId = new Map(candidates.map(candidate => [candidate.patientId, candidate]));
      const fromSuggestion = suggestion.orderedPatientIds
        .map(id => byPatientId.get(id))
        .filter((candidate): candidate is typeof candidates[number] => Boolean(candidate));
      if (fromSuggestion.length > 0) {
        const suggestedIds = new Set(fromSuggestion.map(candidate => candidate.patientId));
        orderedCandidates = [
          ...fromSuggestion,
          ...orderedCandidates.filter(candidate => !suggestedIds.has(candidate.patientId)),
        ];
      }
    } catch {
      orderedCandidates = sortQueueCandidates(candidates);
    }

    const candidate = orderedCandidates.find(item => {
      const patient = pacientes.find(paciente => paciente.id === item.patientId);
      return Boolean(patient && normalizePhoneBRForSms(patient.telefone));
    });
    if (!candidate) return;

    const patient = pacientes.find(item => item.id === candidate.patientId);
    const phone = normalizePhoneBRForSms(patient?.telefone ?? '');
    if (!patient || !phone) return;

    const baseOffer = {
      id: `${slotId}:${candidate.patientId}:${candidate.appointmentId}:auto:${Date.now()}`,
      slotId,
      candidatePatientId: candidate.patientId,
      appointmentId: candidate.appointmentId,
      slotDoctorId: doctor.id,
      slotDate: cancelled.data,
      slotTime: cancelled.hora,
      slotSpecialty: doctor.specialty,
      sentAt: new Date().toISOString(),
    } satisfies Omit<QueueAdvanceOffer, 'status'>;

    try {
      const response = await smsApi.send({
        patient_id: patient.id,
        phone_number: phone,
        message: buildAdvanceOfferMessage({
          patientName: candidate.patientName,
          specialty: doctor.specialty,
          date: cancelled.data,
          time: cancelled.hora,
        }),
      });
      if (response.success === false) throw new Error(response.message || 'O envio do SMS não foi confirmado.');
      appendAdvanceOffer({ ...baseOffer, status: 'sent', smsSid: response.sid });
    } catch (err) {
      appendAdvanceOffer({
        ...baseOffer,
        status: 'failed',
        error: toUserFacingErrorMessage(err, 'Falha ao enviar SMS.'),
      });
      setApiError('Consulta cancelada, mas não foi possível enviar a oferta automática por SMS.');
    }
  }, [agendamentos, doctors, pacientes]);

  const deleteAgendamento = useCallback(async (id: string) => {
    try {
      const current = agendamentos.find(item => item.id === id);
      if (current && isElapsedAgendamento(current)) {
        throw new Error('Consultas com horário já passado ficam como atendidas e não podem ser canceladas ou excluídas.');
      }
      await appointmentsApi.cancel(id);
      if (current) {
        await sendAdvanceOfferForCancelledAppointment(current);
      }
      await refresh();
    } catch (err) {
      const msg = toUserFacingErrorMessage(err, 'Não foi possível alterar este agendamento. Tente novamente em instantes.');
      setApiError(msg);
      throw new Error(msg);
    }
  }, [agendamentos, refresh, sendAdvanceOfferForCancelledAppointment]);

  // ─── CRUD Laudos ──────────────────────────────────────────────────────────
  const addLaudo = useCallback(async (l: Omit<Laudo, 'id'>) => {
    if (!user) return;
    await reportsApi.create(laudoToApiReport(l, user.id));
    await refresh();
  }, [refresh, user]);

  const updateLaudo = useCallback(async (l: Laudo) => {
    if (!user) return;
    await reportsApi.update(l.id, laudoToApiReport(l, user.id));
    await refresh();
  }, [refresh, user]);

  const deleteLaudo = useCallback(async (id: string) => {
    await reportsApi.delete(id);
    await refresh();
  }, [refresh]);

  // ─── Navegação ────────────────────────────────────────────────────────────
  const handleNavigate = (p: PageType) => {
    if (!user) return;
    if (ROLE_PAGES[user.role].includes(p)) {
      setPage(p);
      setOpenAgendaModal(false);
      setOpenPacienteModal(false);
      setAgendaPatientId(null);
    }
  };

  const handleSchedulePatient = (pacienteId: string) => {
    if (!user || !ROLE_PAGES[user.role].includes('agenda')) return;
    setAgendaPatientId(pacienteId);
    setOpenAgendaModal(true);
    setOpenPacienteModal(false);
    setPage('agenda');
  };

  // ─── Loading de autenticação ──────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100dvh', background: 'var(--background)' }}>
        <LoadingState />
      </div>
    );
  }

  if (!user) {
    return authView === 'cadastro-paciente' ? (
      <CadastroPaciente
        onBackToLogin={() => setAuthView('login')}
      />
    ) : (
      <Login onCreateAccount={() => setAuthView('cadastro-paciente')} />
    );
  }

  const allowedPages = ROLE_PAGES[user.role];
  const isPageAllowed = allowedPages.includes(page) && (page !== 'fila-prioridade' || user.role === 'gestao');
  const currentPage  = isPageAllowed ? page : allowedPages[0];
  const notificationSeed = (() => {
    const today = new Date();
    const todayISO = dateToISO(today);
    const nowTime = timeToHHMM(today);
    return buildRoleNotifications({ user, pacientes, agendamentos, laudos, doctors, apiError, todayISO, nowTime });
    /*
    const soon = agendamentos
      .filter(a => a.data >= todayISO)
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`))
      .slice(0, 4)
      .map(a => {
        const paciente = pacientes.find(p => p.id === a.pacienteId);
        return {
          id: `appt-${a.id}`,
          title: a.data === todayISO ? 'Consulta hoje' : 'Consulta próxima',
          message: `${paciente?.nome || 'Paciente'} às ${a.hora} em ${a.data.split('-').reverse().join('/')}`,
        };
      });
    const drafts = laudos
      .filter(l => l.status === 'rascunho')
      .slice(0, 3)
      .map(l => {
        const paciente = pacientes.find(p => p.id === l.pacienteId);
        return {
          id: `report-${l.id}`,
          title: 'Laudo em rascunho',
          message: `${paciente?.nome || 'Paciente'} aguarda revisão.`,
        };
      });
    const errors = apiError ? [{ id: `error-${apiError}`, title: 'Erro operacional', message: apiError }] : [];
    return [...errors, ...soon, ...drafts];
    */
  })();
  const notifications: NotificationItem[] = notificationSeed.map(item => ({ ...item, read: readNotificationIds.includes(item.id) }));
  const markNotificationRead = (id: string) => {
    setReadNotificationIds(prev => {
      const next = Array.from(new Set([...prev, id]));
      localStorage.setItem('mc_read_notifications', JSON.stringify(next));
      return next;
    });
  };
  const clearNotifications = () => {
    const next = notificationSeed.map(n => n.id);
    localStorage.setItem('mc_read_notifications', JSON.stringify(next));
    setReadNotificationIds(next);
  };

  return (
    <div className="mc-app-shell" style={{ display: 'flex', width: '100%', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', background: 'var(--background)' }}>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate}/>

      <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <Topbar currentPage={currentPage} notifications={notifications} onMarkNotificationRead={markNotificationRead} onClearNotifications={clearNotifications}/>

        <main className="mc-app-main" style={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden', display: 'flex', position: 'relative', minHeight: 0, background: 'var(--background)' }}>
          {!dataLoaded && apiLoading ? (
            <LoadingState label="Carregando dados do perfil..." />
          ) : (
            <>

          {/* Banner de erro/carregamento */}
          {(apiLoading || apiError) && (
            <div style={{
              position: 'absolute', top: 12, right: 16, zIndex: 30,
              padding: '9px 14px', borderRadius: 10,
              background: apiError ? '#fef2f2' : '#fff',
              border: `1px solid ${apiError ? 'var(--red-100)' : 'var(--gray-200)'}`,
              color: apiError ? 'var(--red-600)' : 'var(--gray-600)',
              fontSize: 12, fontWeight: 600,
              boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              display: 'flex', alignItems: 'center', gap: 8, maxWidth: 480,
            }}>
              {apiError ? `⚠️ ${apiError}` : '⏳ Carregando dados...'}
              {apiError && (
                <button onClick={() => { setApiError(null); void refresh(); }}
                  style={{ marginLeft: 4, padding: '2px 8px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  Tentar novamente
                </button>
              )}
            </div>
          )}

          <Suspense fallback={<LoadingState label="Carregando tela..." />}>
          {currentPage === 'dashboard' && (
            <Dashboard
              pacientes={pacientes} agendamentos={agendamentos} laudos={laudos} doctors={doctors}
              onNavigate={handleNavigate}
              onNovoAgendamento={() => { setAgendaPatientId(null); setOpenAgendaModal(true); setPage('agenda'); }}
              onNovoPaciente={() => { setOpenPacienteModal(true); setPage('pacientes'); }}
              onUpdateAgendamento={updateAgendamento}
            />
          )}
          {currentPage === 'pacientes' && allowedPages.includes('pacientes') && (
            <Pacientes
              pacientes={pacientes} onAdd={addPaciente} onUpdate={updatePaciente}
              onDelete={deletePaciente}
              agendamentos={agendamentos} laudos={laudos} doctors={doctors}
              onSchedule={handleSchedulePatient}
              initialOpen={openPacienteModal} readOnly={user.role === 'secretaria'} allowDelete={user.role === 'gestao'}
            />
          )}
          {currentPage === 'agenda' && allowedPages.includes('agenda') && (
            <Agenda
              agendamentos={agendamentos} pacientes={pacientes} doctors={doctors}
              onAdd={addAgendamento} onUpdate={updateAgendamento}
              onDelete={deleteAgendamento} initialOpen={openAgendaModal} initialPatientId={agendaPatientId}
            />
          )}
          {currentPage === 'fila-prioridade' && user.role === 'gestao' && allowedPages.includes('fila-prioridade') && (
            <FilaPrioridade
              pacientes={pacientes}
              agendamentos={agendamentos}
              doctors={doctors}
              onUpdateAppointment={updateAgendamento}
            />
          )}
          {currentPage === 'registro' && user.role === 'paciente' && allowedPages.includes('registro') && (
            <Registro pacientes={pacientes} agendamentos={agendamentos} laudos={laudos} doctors={doctors} />
          )}
          {currentPage === 'laudos' && allowedPages.includes('laudos') && (
            <Laudos laudos={laudos} pacientes={pacientes}
              onAdd={addLaudo} onUpdate={updateLaudo} onDelete={deleteLaudo} readOnly={user.role === 'paciente'}/>
          )}
          {currentPage === 'comunicacao' && allowedPages.includes('comunicacao') && (
            <Comunicacao pacientes={pacientes} agendamentos={agendamentos}/>
          )}
          {currentPage === 'mensagens' && allowedPages.includes('mensagens') && (
            <Mensagens pacientes={pacientes}/>
          )}
          {currentPage === 'relatorios' && allowedPages.includes('relatorios') && (
            <Relatorios pacientes={pacientes} agendamentos={agendamentos} laudos={laudos}/>
          )}
          {currentPage === 'usuarios' && allowedPages.includes('usuarios') && <Usuarios/>}
          {currentPage === 'metricas' && allowedPages.includes('metricas') && (
            <Metricas pacientes={pacientes} agendamentos={agendamentos} laudos={laudos}/>
          )}
          {currentPage === 'ia' && allowedPages.includes('ia') && <AssistenteIA/>}
          {currentPage === 'configuracoes' && allowedPages.includes('configuracoes') && <Configuracoes/>}
          </Suspense>
            </>
          )}
        </main>
      </div>
      {user.role === 'paciente' && (
        <PatientChatbot
          onNavigate={handleNavigate}
          onOpenSecretaryChat={() => {
            setPage('mensagens');
            setOpenAgendaModal(false);
            setOpenPacienteModal(false);
            setAgendaPatientId(null);
          }}
        />
      )}
    </div>
  );
}
