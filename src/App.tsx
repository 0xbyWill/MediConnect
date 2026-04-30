import { useState, useCallback, useEffect } from 'react';
import type { Paciente, Agendamento, Laudo, PageType } from './types';
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
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from './lib/api';
import LoadingState from './app/LoadingState';
import { buildRoleNotifications } from './app/notifications';
import type { NotificationItem } from './app/notifications';
import { dateToISO, timeToHHMM } from './shared/utils/date';
import { mergeById } from './shared/utils/collection';

import Login         from './pages/Login';
import CadastroPaciente from './pages/CadastroPaciente';
import Sidebar       from './components/Sidebar';
import Topbar        from './components/Topbar';
import Dashboard     from './pages/Dashboard';
import Pacientes     from './pages/Pacientes';
import Agenda        from './pages/Agenda';
import Laudos        from './pages/Laudos';
import Configuracoes from './pages/Configuracoes';
import Comunicacao   from './pages/Comunicacao';
import Relatorios    from './pages/Relatorios';
import Usuarios      from './pages/Usuarios';
import Metricas      from './pages/Metricas';

const onlyActiveAppointments = (appointments: ApiAppointment[]) =>
  appointments.filter(appointment => appointment.status !== 'cancelled');

const toVisibleAgendamentos = (appointments: ApiAppointment[]) =>
  onlyActiveAppointments(appointments).map(apiAppointmentToAgendamento);

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
  const [page, setPage]                             = useState<PageType>('dashboard');
  const [authView, setAuthView]                     = useState<'login' | 'cadastro-paciente'>('login');

  // ─── Carrega dados da API ─────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!user) {
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

    const errors: string[] = [];
    const capture = (label: string, err: unknown) => {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      errors.push(`${label}: ${msg}`);
    };

    try {
      // ── Perfil Médico ──
      if (user.role === 'medico') {
        const doctorId = user.doctor_id;
        const creatorIds = [user.id, doctorId].filter(Boolean) as string[];

        // Busca agendamentos do médico:
        // Se tiver doctor_id → filtra por ele
        // Se não tiver → busca todos (RLS do Supabase deve limitar ao usuário)
        const [apiAgendamentos, apiLaudos, pacientesCriadosPorUsuario, pacientesCriadosPorDoctor] = await Promise.all([
          appointmentsApi
            .list(doctorId ? { doctor_id: doctorId } : {})
            .catch(err => { capture('agendamentos', err); return [] as ApiAppointment[]; }),
          reportsApi
            .listByCreators(creatorIds)
            .catch(err => { capture('laudos', err); return [] as ApiReport[]; }),
          patientsApi
            .list({ created_by: user.id, limit: 500 })
            .catch(err => { capture('pacientes criados pelo usuário', err); return [] as ApiPatient[]; }),
          doctorId
            ? patientsApi
                .list({ created_by: doctorId, limit: 500 })
                .catch(err => { capture('pacientes criados pelo médico', err); return [] as ApiPatient[]; })
            : Promise.resolve([] as ApiPatient[]),
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
          pacientesVinculados,
          pacientesCriadosPorUsuario,
          pacientesCriadosPorDoctor
        );

        setPacientes(apiPacientes.map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos(apiLaudos.map(apiReportToLaudo));
        setDoctors([]);

      // ── Perfil Secretaria ──
      } else if (user.role === 'secretaria') {
        const [apiPacientes, apiAgendamentos, apiDoctors] = await Promise.all([
          patientsApi.list({ limit: 500 }).catch(err => { capture('pacientes', err); return []; }),
          appointmentsApi.list({}).catch(err => { capture('agendamentos', err); return []; }),
          doctorsApi.list({ active: true }).catch(err => { capture('médicos', err); return []; }),
        ]);
        setPacientes(apiPacientes.map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos([]);
        setDoctors(apiDoctors);

      } else if (user.role === 'paciente') {
        const ownPatients = user.patient_id
          ? await patientsApi.listByIds([user.patient_id]).catch(err => { capture('paciente', err); return [] as ApiPatient[]; })
          : await patientsApi.list({ email: user.email, limit: 1 }).catch(err => { capture('paciente', err); return [] as ApiPatient[]; });
        const patientId = user.patient_id ?? ownPatients[0]?.id;
        const [apiAgendamentos, apiLaudos, apiDoctors] = patientId ? await Promise.all([
          appointmentsApi.listForPatient(patientId).catch(err => { capture('agendamentos', err); return [] as ApiAppointment[]; }),
          reportsApi.listForPatient(patientId).catch(err => { capture('laudos', err); return [] as ApiReport[]; }),
          doctorsApi.list({ active: true }).catch(err => { capture('médicos', err); return [] as ApiDoctor[]; }),
        ]) : [[] as ApiAppointment[], [] as ApiReport[], [] as ApiDoctor[]];
        setPacientes(ownPatients.map(apiPatientToPaciente));
        setAgendamentos(toVisibleAgendamentos(apiAgendamentos));
        setLaudos(apiLaudos.map(apiReportToLaudo));
        setDoctors(apiDoctors);

      // ── Perfil Gestão / Admin ──
      } else {
        const [apiPacientes, apiAgendamentos, apiLaudos, apiDoctors] = await Promise.all([
          patientsApi.list({ limit: 500 }).catch(err => { capture('pacientes', err); return []; }),
          appointmentsApi.list({}).catch(err => { capture('agendamentos', err); return []; }),
          reportsApi.list({}).catch(err => { capture('laudos', err); return []; }),
          doctorsApi.list({ active: true }).catch(err => { capture('médicos', err); return []; }),
        ]);
        setPacientes(apiPacientes.map(apiPatientToPaciente));
        setAgendamentos(apiAgendamentos.map(apiAppointmentToAgendamento));
        setLaudos(apiLaudos.map(apiReportToLaudo));
        setDoctors(apiDoctors);
      }

      if (errors.length) {
        setApiError(errors.join(' | '));
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao carregar dados da API.';
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
      await patientsApi.create({
        ...pacienteToApiPatient(p),
        created_by: user?.id,
      });
      await refresh();
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Erro ao cadastrar paciente.';
      const msg =
        rawMsg.includes('row-level security') || rawMsg.includes('Permissões insuficientes')
          ? 'O perfil médico ainda não tem permissão no Supabase para cadastrar pacientes. Ajuste a policy/Edge Function de patients para liberar INSERT para médicos.'
          : rawMsg;
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
        const msg = 'A API nao permitiu excluir este paciente para o perfil logado.';
        setApiError(msg);
        throw new Error(msg);
      }
      if (lowerMsg.includes('nao excluiu nenhum paciente')) {
        const msg = 'A API nao excluiu o paciente. Pela documentacao, esta acao exige perfil admin/gestao.';
        setApiError(msg);
        throw new Error(msg);
      }
      if (lowerMsg.includes('foreign key') || lowerMsg.includes('violates') || lowerMsg.includes('referenced')) {
        const msg = 'Nao foi possivel excluir este paciente porque ele possui registros vinculados na API.';
        setApiError(msg);
        throw new Error(msg);
      }
      const msg = rawMsg;
      setApiError(msg);
      throw new Error(msg);
    }
  }, [refresh]);

  // ─── CRUD Agendamentos ────────────────────────────────────────────────────
  const addAgendamento = useCallback(async (a: Omit<Agendamento, 'id'>) => {
    if (!user) return;
    // Para médico: usa doctor_id do perfil se não informado
    const medicoId = a.medicoId || (user.role === 'medico' ? user.doctor_id : undefined);
    if (!medicoId) {
      setApiError('Selecione um médico para criar o agendamento.');
      return;
    }
    await appointmentsApi.create(
      agendamentoToApiAppointment({ ...a, medicoId }, user.id)
    );
    await refresh();
  }, [refresh, user]);

  const updateAgendamento = useCallback(async (a: Agendamento) => {
    if (!user) return;
    const medicoId = a.medicoId || (user.role === 'medico' ? user.doctor_id : undefined);
    if (!medicoId) {
      setApiError('Selecione um médico para atualizar o agendamento.');
      return;
    }
    await appointmentsApi.update(
      a.id,
      agendamentoToApiAppointment({ ...a, medicoId }, user.id)
    );
    await refresh();
  }, [refresh, user]);

  const deleteAgendamento = useCallback(async (id: string) => {
    try {
      if (user?.role === 'secretaria') {
        await appointmentsApi.cancel(id);
      } else {
        await appointmentsApi.delete(id);
      }
      await refresh();
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : 'Erro ao excluir agendamento.';
      const lowerMsg = rawMsg.toLowerCase();
      const msg =
        rawMsg.includes('403') || lowerMsg.includes('forbidden')
          ? 'A API nao permitiu excluir este agendamento para o perfil logado.'
          : rawMsg;
      setApiError(msg);
      throw new Error(msg);
    }
  }, [refresh, user?.role]);

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
    }
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
  const currentPage  = allowedPages.includes(page) ? page : allowedPages[0];
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
    <div style={{ display: 'flex', width: '100%', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden', background: 'linear-gradient(135deg, var(--background) 0%, #eef8ef 100%)' }}>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate}/>

      <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <Topbar currentPage={currentPage} notifications={notifications} onMarkNotificationRead={markNotificationRead} onClearNotifications={clearNotifications}/>

        <main style={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden', display: 'flex', position: 'relative', minHeight: 0, background: 'var(--background)' }}>
          {!dataLoaded && apiLoading ? (
            <LoadingState label="Carregando dados do perfil..." />
          ) : (
            <>

          {/* Banner de erro/loading da API */}
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
                  Retry
                </button>
              )}
            </div>
          )}

          {currentPage === 'dashboard' && (
            <Dashboard
              pacientes={pacientes} agendamentos={agendamentos} laudos={laudos} doctors={doctors}
              onNavigate={handleNavigate}
              onNovoAgendamento={() => { setOpenAgendaModal(true); setPage('agenda'); }}
              onNovoPaciente={() => { setOpenPacienteModal(true); setPage('pacientes'); }}
            />
          )}
          {currentPage === 'pacientes' && allowedPages.includes('pacientes') && (
            <Pacientes
              pacientes={pacientes} onAdd={addPaciente} onUpdate={updatePaciente}
              onDelete={deletePaciente}
              initialOpen={openPacienteModal} readOnly={user.role === 'secretaria'} allowDelete={user.role === 'gestao'}
            />
          )}
          {currentPage === 'agenda' && allowedPages.includes('agenda') && (
            <Agenda
              agendamentos={agendamentos} pacientes={pacientes} doctors={doctors}
              onAdd={addAgendamento} onUpdate={updateAgendamento}
              onDelete={deleteAgendamento} initialOpen={openAgendaModal} readOnly={user.role === 'paciente'}
            />
          )}
          {currentPage === 'laudos' && allowedPages.includes('laudos') && (
            <Laudos laudos={laudos} pacientes={pacientes}
              onAdd={addLaudo} onUpdate={updateLaudo} onDelete={deleteLaudo} readOnly={user.role === 'paciente'}/>
          )}
          {currentPage === 'comunicacao' && allowedPages.includes('comunicacao') && (
            <Comunicacao pacientes={pacientes}/>
          )}
          {currentPage === 'relatorios' && allowedPages.includes('relatorios') && (
            <Relatorios pacientes={pacientes} agendamentos={agendamentos} laudos={laudos}/>
          )}
          {currentPage === 'usuarios' && allowedPages.includes('usuarios') && <Usuarios/>}
          {currentPage === 'metricas' && allowedPages.includes('metricas') && (
            <Metricas pacientes={pacientes} agendamentos={agendamentos} laudos={laudos}/>
          )}
          {currentPage === 'configuracoes' && allowedPages.includes('configuracoes') && <Configuracoes/>}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
