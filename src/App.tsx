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

import Login         from './pages/Login';
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

function mergeById<T extends { id: string }>(...groups: T[][]): T[] {
  return Array.from(new Map(groups.flat().map(item => [item.id, item])).values());
}

function LoadingState({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      minHeight: '100%',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--background)',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48,
          height: 48,
          border: '4px solid var(--mint)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }}/>
        <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600 }}>{label}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

function buildRoleNotifications(params: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors: ApiDoctor[];
  apiError: string | null;
  todayISO: string;
  nowTime: string;
}): Omit<NotificationItem, 'read'>[] {
  const { user, pacientes, agendamentos, laudos, doctors, apiError, todayISO, nowTime } = params;
  const formatDate = (iso: string) => iso.split('-').reverse().join('/');
  const getPaciente = (id: string) => pacientes.find(p => p.id === id);
  const getDoctorName = (id?: string) => doctors.find(d => d.id === id)?.full_name || user.full_name;
  const futureAppointments = agendamentos
    .filter(a => a.data > todayISO || (a.data === todayISO && a.hora >= nowTime))
    .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));

  if (user.role === 'medico') {
    return futureAppointments
      .filter(a => a.data === todayISO && (!user.doctor_id || a.medicoId === user.doctor_id))
      .slice(0, 6)
      .map(a => ({
        id: `medico-${a.id}`,
        title: 'Paciente de hoje',
        message: `${getPaciente(a.pacienteId)?.nome || 'Paciente'} as ${a.hora}.`,
      }));
  }

  if (user.role === 'paciente') {
    const ownPatientId = user.patient_id ?? pacientes.find(p => p.email?.toLowerCase() === user.email.toLowerCase())?.id;
    const consultas = futureAppointments
      .filter(a => !ownPatientId || a.pacienteId === ownPatientId)
      .slice(0, 4)
      .map(a => ({
        id: `paciente-consulta-${a.id}`,
        title: a.data === todayISO ? 'Consulta hoje' : 'Consulta proxima',
        message: `${formatDate(a.data)} as ${a.hora} com ${getDoctorName(a.medicoId)}.`,
      }));
    const exames = laudos
      .filter(l => !ownPatientId || l.pacienteId === ownPatientId)
      .slice(0, 3)
      .map(l => ({
        id: `paciente-laudo-${l.id}`,
        title: l.status === 'liberado' ? 'Exame/laudo disponivel' : 'Exame em processamento',
        message: `${l.exame || 'Laudo'} - ${formatDate(l.data || todayISO)}.`,
      }));
    return [...consultas, ...exames];
  }

  if (user.role === 'secretaria') {
    const todaysAppointments = agendamentos
      .filter(a => a.data === todayISO)
      .sort((a, b) => a.hora.localeCompare(b.hora));
    const reminders = todaysAppointments.slice(0, 5).map(a => ({
      id: `secretaria-lembrete-${a.id}`,
      title: 'Lembrete de consulta',
      message: `${getPaciente(a.pacienteId)?.nome || 'Paciente'} as ${a.hora}. Confirmar contato.`,
    }));
    const confirmed = todaysAppointments
      .filter(a => a.status === 'confirmado')
      .slice(0, 4)
      .map(a => ({
        id: `secretaria-confirmada-${a.id}`,
        title: 'Consulta confirmada',
        message: `${getPaciente(a.pacienteId)?.nome || 'Paciente'} confirmado com ${getDoctorName(a.medicoId)}.`,
      }));
    return [...reminders, ...confirmed];
  }

  const errors = apiError ? [{ id: `gestao-error-${apiError}`, title: 'Erro operacional', message: apiError }] : [];
  const appointmentsToday = agendamentos.filter(a => a.data === todayISO).length;
  const pendingReports = laudos.filter(l => l.status === 'rascunho').length;
  const cancelledToday = agendamentos.filter(a => a.data === todayISO && a.status === 'cancelado').length;
  return [
    ...errors,
    { id: `gestao-agenda-${todayISO}-${appointmentsToday}`, title: 'Analise da agenda', message: `${appointmentsToday} consulta(s) previstas hoje.` },
    { id: `gestao-laudos-${pendingReports}`, title: 'Analise de laudos', message: `${pendingReports} laudo(s) em rascunho aguardando fluxo.` },
    { id: `gestao-cancelamentos-${todayISO}-${cancelledToday}`, title: 'Indicador operacional', message: `${cancelledToday} cancelamento(s) registrados hoje.` },
  ];
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
  const [page, setPage]                             = useState<PageType>('dashboard');

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
            .catch(err => { capture('pacientes criados pelo usuario', err); return [] as ApiPatient[]; }),
          doctorId
            ? patientsApi
                .list({ created_by: doctorId, limit: 500 })
                .catch(err => { capture('pacientes criados pelo medico', err); return [] as ApiPatient[]; })
            : Promise.resolve([] as ApiPatient[]),
        ]);

        // Busca pacientes vinculados aos agendamentos e laudos
        const patientIds = Array.from(new Set([
          ...apiAgendamentos.map(a => a.patient_id),
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
        setAgendamentos(apiAgendamentos.map(apiAppointmentToAgendamento));
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
        setAgendamentos(apiAgendamentos.map(apiAppointmentToAgendamento));
        setLaudos([]);
        setDoctors(apiDoctors);

      } else if (user.role === 'paciente') {
        const ownPatients = user.patient_id
          ? await patientsApi.listByIds([user.patient_id]).catch(err => { capture('paciente', err); return [] as ApiPatient[]; })
          : await patientsApi.list({ email: user.email, limit: 1 }).catch(err => { capture('paciente', err); return [] as ApiPatient[]; });
        const patientId = user.patient_id ?? ownPatients[0]?.id;
        const [apiAgendamentos, apiLaudos, apiDoctors] = patientId ? await Promise.all([
          appointmentsApi.list({ patient_id: patientId }).catch(err => { capture('agendamentos', err); return [] as ApiAppointment[]; }),
          reportsApi.list({ patient_id: patientId }).catch(err => { capture('laudos', err); return [] as ApiReport[]; }),
          doctorsApi.list({ active: true }).catch(err => { capture('mÃ©dicos', err); return [] as ApiDoctor[]; }),
        ]) : [[] as ApiAppointment[], [] as ApiReport[], [] as ApiDoctor[]];
        setPacientes(ownPatients.map(apiPatientToPaciente));
        setAgendamentos(apiAgendamentos.map(apiAppointmentToAgendamento));
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
      const msg =
        rawMsg.includes('403') || rawMsg.toLowerCase().includes('forbidden')
          ? 'A API permite excluir pacientes apenas para admin/gestao. Verifique o perfil do usuario logado.'
          : rawMsg;
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
    await appointmentsApi.delete(id);
    await refresh();
  }, [refresh]);

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

  if (!user) return <Login />;

  const allowedPages = ROLE_PAGES[user.role];
  const currentPage  = allowedPages.includes(page) ? page : allowedPages[0];
  const notificationSeed = (() => {
    const today = new Date();
    const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const nowTime = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;
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
    <div style={{ display: 'flex', width: '100%', height: '100dvh', maxHeight: '100dvh', overflow: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={handleNavigate}/>

      <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
        <Topbar currentPage={currentPage} notifications={notifications} onMarkNotificationRead={markNotificationRead} onClearNotifications={clearNotifications}/>

        <main style={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden', display: 'flex', position: 'relative', minHeight: 0 }}>
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
              onNavigate={setPage}
              onNovoAgendamento={() => { setOpenAgendaModal(true); setPage('agenda'); }}
              onNovoPaciente={() => { setOpenPacienteModal(true); setPage('pacientes'); }}
            />
          )}
          {currentPage === 'pacientes' && allowedPages.includes('pacientes') && (
            <Pacientes
              pacientes={pacientes} onAdd={addPaciente} onUpdate={updatePaciente}
              onDelete={deletePaciente}
              initialOpen={openPacienteModal} readOnly={user.role === 'secretaria'}
            />
          )}
          {currentPage === 'agenda' && allowedPages.includes('agenda') && (
            <Agenda
              agendamentos={agendamentos} pacientes={pacientes} doctors={doctors}
              onAdd={addAgendamento} onUpdate={updateAgendamento}
              onDelete={deleteAgendamento} initialOpen={openAgendaModal}
            />
          )}
          {currentPage === 'laudos' && allowedPages.includes('laudos') && (
            <Laudos laudos={laudos} pacientes={pacientes}
              onAdd={addLaudo} onUpdate={updateLaudo} onDelete={deleteLaudo}/>
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
