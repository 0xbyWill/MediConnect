import type { ApiDoctor } from '../lib/api';
import type { Agendamento, AuthUser, Laudo, Paciente } from '../types';
import { formatDateBR } from '../shared/utils/date';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  read: boolean;
}

export function buildRoleNotifications(params: {
  user: AuthUser;
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors: ApiDoctor[];
  apiError: string | null;
  todayISO: string;
  nowTime: string;
}): Omit<NotificationItem, 'read'>[] {
  const { user, pacientes, agendamentos, laudos, doctors, apiError, todayISO, nowTime } = params;
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
        title: a.data === todayISO ? 'Consulta hoje' : 'Consulta próxima',
        message: `${formatDateBR(a.data)} as ${a.hora} com ${getDoctorName(a.medicoId)}.`,
      }));
    const exames = laudos
      .filter(l => !ownPatientId || l.pacienteId === ownPatientId)
      .slice(0, 3)
      .map(l => ({
        id: `paciente-laudo-${l.id}`,
        title: l.status === 'liberado' ? 'Exame/laudo disponível' : 'Exame em processamento',
        message: `${l.exame || 'Laudo'} - ${formatDateBR(l.data || todayISO)}.`,
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
    { id: `gestao-agenda-${todayISO}-${appointmentsToday}`, title: 'Análise da agenda', message: `${appointmentsToday} consulta(s) previstas hoje.` },
    { id: `gestao-laudos-${pendingReports}`, title: 'Análise de laudos', message: `${pendingReports} laudo(s) em rascunho aguardando fluxo.` },
    { id: `gestao-cancelamentos-${todayISO}-${cancelledToday}`, title: 'Indicador operacional', message: `${cancelledToday} cancelamento(s) registrados hoje.` },
  ];
}
