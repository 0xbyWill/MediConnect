import type { ApiAppointment, ApiDoctor, ApiManagedUser, ApiPatient, ApiReport } from '../../lib/api';
import { apiPatientToPaciente } from '../../types';
import type { ManagerSearchAssistantAction, ManagerSearchAssistantSource } from '../../types';
import { buildPriorityMetricsSummary } from './patientPriorityMetrics';

export const GESTOR_ASSISTANT_ACCESS_LEVEL = 'gestor_full';

export interface ManagerAssistantDataSet {
  appointments?: ApiAppointment[];
  doctors?: ApiDoctor[];
  patients?: ApiPatient[];
  reports?: ApiReport[];
  users?: ApiManagedUser[];
}

export interface ManagerAssistantBuiltContext {
  source: ManagerSearchAssistantSource;
  dataSummary: string;
  warnings: string[];
  context: Record<string, unknown>;
}

/** Campos removidos mesmo no acesso completo do gestor (segredos). */
const ALWAYS_BLOCKED_KEYS = new Set(['password', 'token', 'secret']);

const PROMPT_INJECTION_PATTERNS = [
  /ignore (todas as )?regras/i,
  /ignorar (todas as )?regras/i,
  /revele (o )?prompt/i,
  /mostrar (o )?prompt/i,
  /expor (token|senha|chave|secret)/i,
];

export function detectUnsafeRequest(prompt: string): { blocked: boolean; message?: string } {
  const normalized = prompt.trim();
  if (!normalized) return { blocked: false };

  if (PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(normalized))) {
    return {
      blocked: true,
      message: 'Pedido bloqueado por tentar alterar regras de segurança do assistente.',
    };
  }
  return { blocked: false };
}

export function formatAssistantPeriod(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 'Período não informado';
  if (startDate === endDate) return startDate.split('-').reverse().join('/');
  return `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;
}

function maskSecretPatterns(text: string, max = 2400): string {
  return text
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\b/g, '[token]')
    .replace(/\b(sk|pk|rk|xoxb|ghp|github_pat)_[A-Za-z0-9_=-]{16,}\b/gi, '[chave]')
    .slice(0, max);
}

function htmlToPlainText(html?: string): string | undefined {
  if (!html?.trim()) return undefined;
  return maskSecretPatterns(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
    900,
  );
}

export function sanitizeGestorAssistantContext(data: unknown, depth = 0): unknown {
  if (depth > 8) return '[profundidade maxima]';
  if (Array.isArray(data)) return data.slice(0, 250).map(item => sanitizeGestorAssistantContext(item, depth + 1));
  if (typeof data === 'string') return maskSecretPatterns(data);
  if (!data || typeof data !== 'object') return data;

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([key]) => !ALWAYS_BLOCKED_KEYS.has(key.toLowerCase()))
      .map(([key, value]) => [key, sanitizeGestorAssistantContext(value, depth + 1)]),
  );
}

/** @deprecated Mantido para compatibilidade; gestor usa sanitizeGestorAssistantContext. */
export function sanitizeAssistantContext(data: unknown): unknown {
  return sanitizeGestorAssistantContext(data);
}

function mapPatientForGestor(patient: ApiPatient) {
  const mapped = apiPatientToPaciente(patient);
  return {
    id: patient.id,
    nome: patient.full_name,
    nomeSocial: patient.social_name,
    cpf: patient.cpf,
    email: patient.email,
    telefone: patient.phone_mobile || patient.phone1,
    telefone2: patient.phone2,
    nascimento: patient.birth_date,
    sexo: patient.sex,
    endereco: [patient.street, patient.number, patient.neighborhood, patient.city, patient.state]
      .filter(Boolean)
      .join(', '),
    cep: patient.cep,
    tipoSanguineo: patient.blood_type,
    pesoKg: patient.weight_kg,
    alturaM: patient.height_m,
    imc: patient.bmi,
    vip: patient.vip,
    observacoes: patient.notes,
    condicaoPrincipal: mapped.condicaoSaudePrincipal,
    estadoCondicao: mapped.condicaoSaudePontuacao,
    comorbidades: mapped.comorbidades,
    nivelDor: mapped.nivelDor,
  };
}

function mapReportForGestor(report: ApiReport, patientName: string) {
  const contentJson = report.content_json && Object.keys(report.content_json).length > 0
    ? JSON.stringify(report.content_json).slice(0, 2000)
    : undefined;
  return {
    id: report.id,
    numeroPedido: report.order_number,
    paciente: patientName,
    pacienteId: report.patient_id,
    status: report.status,
    exame: report.exam,
    solicitadoPor: report.requested_by,
    cid: report.cid_code,
    diagnostico: report.diagnosis,
    conclusao: report.conclusion,
    conteudoResumo: htmlToPlainText(report.content_html),
    conteudoEstruturado: contentJson,
    vencimento: report.due_at?.slice(0, 10),
    criadoEm: report.created_at?.slice(0, 10),
  };
}

function mapAppointmentForGestor(appointment: ApiAppointment, patientName: string, doctorName: string) {
  return {
    id: appointment.id,
    data: appointment.scheduled_at.slice(0, 10),
    hora: appointment.scheduled_at.slice(11, 16),
    paciente: patientName,
    pacienteId: appointment.patient_id,
    medico: doctorName,
    medicoId: appointment.doctor_id,
    status: appointment.status,
    duracaoMinutos: appointment.duration_minutes,
    observacoes: appointment.notes,
  };
}

export function buildAssistantContext(
  action: ManagerSearchAssistantAction,
  data: ManagerAssistantDataSet,
  period: { startDate: string; endDate: string },
  source: ManagerSearchAssistantSource = inferSource(action),
): ManagerAssistantBuiltContext {
  const warnings: string[] = [];
  const patients = data.patients ?? [];
  const uiPatients = patients.map(apiPatientToPaciente);
  const doctors = data.doctors ?? [];
  const users = data.users ?? [];
  const reports = (data.reports ?? []).filter(report => {
    const date = report.created_at?.slice(0, 10);
    if (!date) return true;
    return date >= period.startDate && date <= period.endDate;
  });
  const appointments = (data.appointments ?? []).filter(appointment => {
    const date = appointment.scheduled_at.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  const patientById = new Map(patients.map(patient => [patient.id, patient]));
  const doctorById = new Map(doctors.map(doctor => [doctor.id, doctor.full_name]));

  const byStatus = countBy(appointments, appointment => appointment.status);
  const byDoctor = doctors
    .map(doctor => {
      const own = appointments.filter(appointment => appointment.doctor_id === doctor.id);
      return {
        nome: doctor.full_name,
        especialidade: doctor.specialty,
        crm: doctor.crm,
        email: doctor.email,
        telefone: doctor.phone_mobile,
        totalConsultas: own.length,
        realizadas: own.filter(appointment => appointment.status === 'completed').length,
        canceladas: own.filter(appointment => appointment.status === 'cancelled').length,
        pendentes: own.filter(appointment => appointment.status === 'requested').length,
      };
    })
    .filter(item => item.totalConsultas > 0)
    .sort((a, b) => b.totalConsultas - a.totalConsultas)
    .slice(0, 20);

  const appointmentDetails = appointments
    .slice()
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))
    .slice(0, 200)
    .map(appointment => {
      const patient = patientById.get(appointment.patient_id);
      return mapAppointmentForGestor(
        appointment,
        patient?.full_name ?? 'Paciente não identificado',
        doctorById.get(appointment.doctor_id) ?? 'Médico não identificado',
      );
    });

  const cancelledAppointments = appointmentDetails.filter(item => item.status === 'cancelled');

  const reportDetails = reports
    .slice()
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .slice(0, 150)
    .map(report => mapReportForGestor(report, patientById.get(report.patient_id)?.full_name ?? 'Paciente não identificado'));

  const pendingReports = reportDetails.filter(report =>
    ['draft', 'rascunho', 'pending', 'pendente'].includes(String(report.status ?? '').toLowerCase()),
  );

  const patientDetails = patients.slice(0, 300).map(mapPatientForGestor);

  const userDetails = users.slice(0, 80).map(user => ({
    id: user.id,
    nome: user.full_name,
    email: user.email,
    perfil: user.role,
    telefone: user.phone,
    cpf: user.cpf,
    departamento: user.department,
    ativo: user.active,
  }));

  const context = sanitizeGestorAssistantContext({
    accessLevel: GESTOR_ASSISTANT_ACCESS_LEVEL,
    escopo: 'O gestor autenticado tem acesso administrativo completo de leitura aos dados abaixo, equivalente ao que visualiza no MediConnect.',
    periodo: {
      inicio: period.startDate,
      fim: period.endDate,
      texto: formatAssistantPeriod(period.startDate, period.endDate),
    },
    fonteSolicitada: source,
    totalPacientes: patients.length,
    totalUsuarios: users.length,
    consultas: {
      total: appointments.length,
      solicitadas: byStatus.requested ?? 0,
      confirmadas: byStatus.confirmed ?? 0,
      realizadas: byStatus.completed ?? 0,
      canceladas: byStatus.cancelled ?? 0,
      porMedico: byDoctor,
      cancelamentos: action === 'missed_appointments' ? cancelledAppointments : cancelledAppointments.slice(0, 20),
      registros: appointmentDetails,
    },
    laudosRelatorios: {
      total: reports.length,
      rascunhos: pendingReports.length,
      pendentes: pendingReports.slice(0, 40),
      liberados: reports.filter(report =>
        ['released', 'completed', 'finalized', 'liberado', 'finalizado', 'signed'].includes(report.status?.toLowerCase()),
      ).length,
      registros: reportDetails,
    },
    pacientes: {
      total: patients.length,
      registros: patientDetails,
    },
    medicos: {
      total: doctors.length,
      registros: doctors.slice(0, 50).map(doctor => ({
        id: doctor.id,
        nome: doctor.full_name,
        especialidade: doctor.specialty,
        crm: doctor.crm,
        email: doctor.email,
        telefone: doctor.phone_mobile,
        ativo: doctor.active,
      })),
    },
    usuarios: {
      total: users.length,
      registros: userDetails,
    },
    financeiro: {
      receitaEstimada: null,
      recebido: null,
      pendente: null,
      observacao: 'Sem dados financeiros estruturados neste contexto.',
    },
    prioridadeInternaPacientes: buildPriorityMetricsSummary(uiPatients, []),
  }) as Record<string, unknown>;

  const dataSummary = [
    `${appointments.length} consulta${appointments.length === 1 ? '' : 's'} no período`,
    `${patients.length} paciente${patients.length === 1 ? '' : 's'}`,
    `${doctors.length} médico${doctors.length === 1 ? '' : 's'}`,
    `${reports.length} laudo${reports.length === 1 ? '' : 's'}`,
    users.length ? `${users.length} usuário${users.length === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(' • ');

  return { context, dataSummary, warnings, source };
}

function inferSource(action: ManagerSearchAssistantAction): ManagerSearchAssistantSource {
  if (action === 'financial_summary') return 'financial';
  if (action === 'doctor_performance') return 'doctors';
  if (action === 'message_draft') return 'patients';
  if (action === 'missed_appointments' || action.includes('summary')) return 'appointments';
  return 'mixed';
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}
