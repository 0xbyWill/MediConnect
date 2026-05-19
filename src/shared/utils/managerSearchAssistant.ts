import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from '../../lib/api';
import { apiPatientToPaciente } from '../../types';
import type { ManagerSearchAssistantAction, ManagerSearchAssistantSource } from '../../types';
import {
  MANAGER_ASSISTANT_CLINICAL_BLOCK_MESSAGE,
  MANAGER_ASSISTANT_FORBIDDEN_ACTION_MESSAGE,
} from '../constants/managerSearchAssistant';
import { buildPriorityMetricsSummary } from './patientPriorityMetrics';

export interface ManagerAssistantDataSet {
  appointments?: ApiAppointment[];
  doctors?: ApiDoctor[];
  patients?: ApiPatient[];
  reports?: ApiReport[];
}

export interface ManagerAssistantBuiltContext {
  source: ManagerSearchAssistantSource;
  dataSummary: string;
  warnings: string[];
  context: Record<string, unknown>;
}

const SENSITIVE_KEYS = new Set([
  'cpf',
  'guardian_cpf',
  'email',
  'phone',
  'phone_mobile',
  'phone1',
  'phone2',
  'rg',
  'document_number',
  'cep',
  'street',
  'number',
  'complement',
  'reference',
  'content_html',
  'content_json',
  'diagnosis',
  'conclusion',
  'notes',
  'blood_type',
  'weight_kg',
  'height_m',
  'bmi',
]);

const CLINICAL_TERMS = [
  'diagnóstico',
  'diagnostico',
  'prescrição',
  'prescricao',
  'receita médica',
  'receita medica',
  'interpretar laudo',
  'interprete o laudo',
  'conduta clínica',
  'conduta clinica',
  'tratamento',
  'medicação',
  'medicacao',
  'cid',
  'exame indica',
];

const WRITE_TERMS = [
  'cancele',
  'cancelar consulta',
  'marque',
  'agende',
  'remarque',
  'cadastre',
  'crie paciente',
  'exclua',
  'delete',
  'apague',
  'atualize',
  'altere',
  'envie mensagem',
  'mandar mensagem',
  'enviar sms',
  'cobre',
  'dar baixa',
  'baixar pagamento',
  'registrar pagamento',
];

export function detectUnsafeRequest(prompt: string): { blocked: boolean; message?: string } {
  const normalized = prompt.toLowerCase();
  if (CLINICAL_TERMS.some(term => normalized.includes(term))) {
    return { blocked: true, message: MANAGER_ASSISTANT_CLINICAL_BLOCK_MESSAGE };
  }
  if (WRITE_TERMS.some(term => normalized.includes(term))) {
    return { blocked: true, message: MANAGER_ASSISTANT_FORBIDDEN_ACTION_MESSAGE };
  }
  return { blocked: false };
}

export function formatAssistantPeriod(startDate: string, endDate: string) {
  if (!startDate || !endDate) return 'Período não informado';
  if (startDate === endDate) return startDate.split('-').reverse().join('/');
  return `${startDate.split('-').reverse().join('/')} a ${endDate.split('-').reverse().join('/')}`;
}

export function sanitizeAssistantContext(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(item => sanitizeAssistantContext(item));
  if (!data || typeof data !== 'object') return data;

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.has(key))
      .map(([key, value]) => {
        if (typeof value === 'string') return [key, value.slice(0, 500)];
        return [key, sanitizeAssistantContext(value)];
      })
  );
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
  const reports = (data.reports ?? []).filter(report => {
    const date = report.created_at?.slice(0, 10);
    if (!date) return true;
    return date >= period.startDate && date <= period.endDate;
  });
  const appointments = (data.appointments ?? []).filter(appointment => {
    const date = appointment.scheduled_at.slice(0, 10);
    return date >= period.startDate && date <= period.endDate;
  });

  const patientById = new Map(patients.map(patient => [patient.id, patient.full_name]));
  const doctorById = new Map(doctors.map(doctor => [doctor.id, doctor.full_name]));

  const byStatus = countBy(appointments, appointment => appointment.status);
  const byDoctor = doctors
    .map(doctor => {
      const own = appointments.filter(appointment => appointment.doctor_id === doctor.id);
      return {
        nome: doctor.full_name,
        especialidade: doctor.specialty,
        totalConsultas: own.length,
        realizadas: own.filter(appointment => appointment.status === 'completed').length,
        canceladas: own.filter(appointment => appointment.status === 'cancelled').length,
        pendentes: own.filter(appointment => appointment.status === 'requested').length,
      };
    })
    .filter(item => item.totalConsultas > 0)
    .sort((a, b) => b.totalConsultas - a.totalConsultas)
    .slice(0, 10);

  const cancelledAppointments = appointments
    .filter(appointment => appointment.status === 'cancelled')
    .slice(0, 20)
    .map(appointment => ({
      data: appointment.scheduled_at.slice(0, 10),
      paciente: patientById.get(appointment.patient_id) ?? 'Paciente não identificado',
      medico: doctorById.get(appointment.doctor_id) ?? 'Médico não identificado',
      status: appointment.status,
    }));

  if (action === 'missed_appointments') {
    warnings.push('O sistema não possui um status específico de falta; foram usados cancelamentos como sinal administrativo, sem concluir ausência.');
  }

  if (source === 'financial' || action === 'financial_summary') {
    warnings.push('Não há API financeira dedicada carregada neste contexto; valores de receita, recebido e pendente só podem ser analisados se já estiverem no contexto.');
  }

  const pendingReports = reports
    .filter(report => report.status?.toLowerCase() === 'draft' || report.status?.toLowerCase() === 'rascunho')
    .slice(0, 20)
    .map(report => ({
      id: report.id,
      paciente: patientById.get(report.patient_id) ?? 'Paciente não identificado',
      exame: report.exam ?? 'Não informado',
      criadoEm: report.created_at?.slice(0, 10) ?? 'Sem data',
    }));

  const context = sanitizeAssistantContext({
    periodo: {
      inicio: period.startDate,
      fim: period.endDate,
      texto: formatAssistantPeriod(period.startDate, period.endDate),
    },
    fonteSolicitada: source,
    totalPacientes: patients.length,
    pacientesAtivosAproximado: patients.length,
    consultas: {
      total: appointments.length,
      solicitadas: byStatus.requested ?? 0,
      confirmadas: byStatus.confirmed ?? 0,
      realizadas: byStatus.completed ?? 0,
      canceladas: byStatus.cancelled ?? 0,
      porMedico: byDoctor,
      cancelamentos: action === 'missed_appointments' ? cancelledAppointments : cancelledAppointments.slice(0, 8),
    },
    laudosRelatorios: {
      total: reports.length,
      rascunhos: pendingReports.length,
      pendentes: pendingReports,
      liberados: reports.filter(report => ['released', 'completed', 'finalized', 'liberado', 'finalizado', 'signed'].includes(report.status?.toLowerCase())).length,
    },
    financeiro: {
      receitaEstimada: null,
      recebido: null,
      pendente: null,
      observacao: 'Não há dados financeiros estruturados disponíveis nas APIs lidas pelo assistente.',
    },
    prioridadeInternaPacientes: buildPriorityMetricsSummary(uiPatients, []),
  }) as Record<string, unknown>;

  const dataSummary = [
    `${appointments.length} consulta${appointments.length === 1 ? '' : 's'} no período`,
    `${patients.length} paciente${patients.length === 1 ? '' : 's'} carregado${patients.length === 1 ? '' : 's'}`,
    `${doctors.length} médico${doctors.length === 1 ? '' : 's'} ativo${doctors.length === 1 ? '' : 's'}`,
    `${reports.length} laudo${reports.length === 1 ? '' : 's'} ${reports.length === 1 ? 'disponível' : 'disponíveis'}`,
  ].join(' • ');

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
