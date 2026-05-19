import type { ApiPatient, ApiAppointment, ApiReport } from './lib/api';
import type { UserRole } from './shared/constants/roles';
import { dateToISO, splitApiDateTime, timeToHHMM } from './shared/utils/date';
import { digitsOnly } from './shared/utils/cpf';
import { normalizeCep, normalizeDecimalText, normalizeEmail, normalizePhoneBR } from './shared/utils/validation';
export type { PageType, UserRole } from './shared/constants/roles';
export { ROLE_PAGES } from './shared/constants/roles';

// ─── Perfis de usuário ────────────────────────────────────────────────────────
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  specialty?: string;
  crm?: string;
  avatar_url?: string;
  doctor_id?: string;
  patient_id?: string;
}

export type ChatbotIntent =
  | 'appointments'
  | 'reschedule'
  | 'cancel'
  | 'reports'
  | 'update-data'
  | 'login-issues'
  | 'secretary';

export interface ChatbotOption {
  id: ChatbotIntent;
  label: string;
  response: string;
  opensSupport?: boolean;
}

export interface ChatbotMessage {
  id: string;
  sender: 'bot' | 'patient' | 'system';
  text: string;
  createdAt: string;
  kind?: 'initial' | 'answer' | 'safety' | 'support' | 'success';
}

export interface ChatbotSupportRequest {
  patient_id?: string;
  subject: string;
  message: string;
  contact_preference?: 'email' | 'phone' | 'whatsapp';
  created_at: string;
  status: 'open';
}

export interface SendSmsRequest {
  patient_id: string;
  phone_number: string;
  message: string;
}

export interface SendSmsResponse {
  success: boolean;
  message?: string;
  provider_message_id?: string;
  sid?: string;
  error?: string;
}

export type ManagerSearchAssistantAction =
  | 'general_search'
  | 'daily_summary'
  | 'weekly_summary'
  | 'monthly_summary'
  | 'missed_appointments'
  | 'financial_summary'
  | 'doctor_performance'
  | 'message_draft'
  | 'admin_pending_tasks';

export type ManagerSearchAssistantSource =
  | 'appointments'
  | 'reports'
  | 'patients'
  | 'doctors'
  | 'financial'
  | 'mixed';

export interface ManagerSearchAssistantRequest {
  action: ManagerSearchAssistantAction;
  prompt: string;
  period?: {
    startDate: string;
    endDate: string;
  };
  context?: Record<string, unknown>;
}

export interface ManagerSearchAssistantResponse {
  answer: string;
  dataSummary?: string;
  warnings?: string[];
  source?: ManagerSearchAssistantSource;
}

export type PatientPriorityLevel = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';

export type PatientMobilityInput =
  | 'normal'
  | 'mild_limitation'
  | 'uses_support'
  | 'wheelchair'
  | 'bedridden'
  | 'unknown';

export type PatientAccessDifficultyInput =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'special_transport_required'
  | 'unknown';

export type PatientDependencyInput =
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'total'
  | 'unknown';

export type PatientHealthConditionInput =
  | 'none'
  | 'stable_chronic'
  | 'frequent_followup'
  | 'postoperative_or_functional_limitation'
  | 'alert'
  | 'unknown';

export interface NormalizedPatientPriorityInput {
  age: number | null;
  mobility: PatientMobilityInput;
  accessDifficulty: PatientAccessDifficultyInput;
  dependency: PatientDependencyInput;
  healthCondition: PatientHealthConditionInput;
  hasLegalPriority: boolean;
  hasCriticalAlert: boolean;
  hasIncompleteData: boolean;
  locationKey: string;
}

export interface PatientPriorityResult {
  level: PatientPriorityLevel;
  score: number;
  reasons: string[];
  requiresHumanReview: boolean;
}

export interface PatientPriorityMetrics {
  totalPatients: number;
  p1Count: number;
  p2Count: number;
  p3Count: number;
  p4Count: number;
  p5Count: number;
  highPriorityCount: number;
  averagePriorityScore: number;
  mobilityRiskCount: number;
  accessDifficultyCount: number;
  elderlyPriorityCount: number;
  childPriorityCount: number;
  humanReviewRequiredCount: number;
}

// ─── Páginas disponíveis ──────────────────────────────────────────────────────
// ─── Permissões por perfil ────────────────────────────────────────────────────
// ─── Convênios ────────────────────────────────────────────────────────────────
export type ConvenioType =
  | 'Particular'
  | 'Unimed Nacional'
  | 'Bradesco Saúde'
  | 'Amil S450'
  | 'SulAmérica'
  | 'Porto Seguro'
  | 'Notre Dame';

export type StatusPaciente = 'Ativo' | 'Inativo';

// ─── Paciente (modelo interno — completo) ─────────────────────────────────────
export interface Paciente {
  id: string;
  // Identificação
  nome: string;
  nomeSocial?: string;
  cpf: string;
  rg?: string;
  outroDocTipo?: string;
  outroDocNumero?: string;
  sexo?: string;
  dataNasc: string;
  raca?: string;
  naturalidade?: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  // Filiação
  nomeResponsável?: string;
  cpfResponsável?: string;
  vip?: boolean;
  urlRedirecionamento?: string;
  // Contato
  email: string;
  telefone: string;
  telefone2?: string;
  telefone3?: string;
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  referencia?: string;
  // Informações médicas
  tipoSanguineo?: string;
  peso?: string;
  altura?: string;
  alergias?: string;
  condicaoSaudePrincipal?: string;
  condicaoSaudePontuacao?: string;
  comorbidades?: string;
  nivelDor?: string;
  mobilidade?: string;
  dependenciaFuncional?: string;
  integridadeFisica?: string;
  urgenciaTerapeutica?: string;
  tempoNaFila?: string;
  faltasAnteriores?: string;
  disponibilidadeEncaixe?: string;
  tempoMinimoChegar?: string;
  tempoDeslocamento?: string;
  tipoAtendimentoNecessario?: string;
  profissionalEspecialidadeNecessaria?: string;
  observacoesClinicas?: string;
  alertasCriticos?: string;
  compatibilidadeVaga?: string;
  viabilidadeComparecimento?: string;
  // Convênio
  convenio: ConvenioType;
  planoConvenio?: string;
  matriculaConvenio?: string;
  validadeCarteira?: string;
  // Status / controle
  status: StatusPaciente;
  foto?: string;
  observacoes?: string;
  // Atendimentos (gerados a partir de agendamentos)
  ultimoAtendimento?: string;
  proximoAtendimento?: string;
}

const PATIENT_EXTRA_MARKER = '\n\n__MC_PATIENT_EXTRA__=';

type PatientExtraData = Partial<Omit<Paciente, 'id' | 'nome' | 'cpf' | 'dataNasc' | 'email' | 'telefone' | 'raca' | 'sexo' | 'cidade' | 'estado' | 'observacoes'>>;

function splitPatientNotes(notes?: string): { observacoes?: string; extra: PatientExtraData } {
  if (!notes) return { observacoes: notes, extra: {} };
  const markerIndex = notes.indexOf(PATIENT_EXTRA_MARKER);
  if (markerIndex < 0) return { observacoes: notes, extra: {} };

  const rawExtra = notes.slice(markerIndex + PATIENT_EXTRA_MARKER.length).trim();
  try {
    return {
      observacoes: notes.slice(0, markerIndex).trimEnd(),
      extra: JSON.parse(rawExtra) as PatientExtraData,
    };
  } catch {
    return { observacoes: notes.slice(0, markerIndex).trimEnd(), extra: {} };
  }
}

function buildPatientNotes(p: Omit<Paciente, 'id'>): string | undefined {
  const extra: PatientExtraData = {
    nomeSocial: p.nomeSocial?.trim(),
    rg: p.rg?.trim(),
    outroDocTipo: p.outroDocTipo,
    outroDocNumero: p.outroDocNumero?.trim(),
    naturalidade: p.naturalidade?.trim(),
    nacionalidade: p.nacionalidade,
    profissao: p.profissao?.trim(),
    estadoCivil: p.estadoCivil,
    nomeResponsável: p.nomeResponsável?.trim(),
    cpfResponsável: p.cpfResponsável ? digitsOnly(p.cpfResponsável) : undefined,
    vip: p.vip,
    urlRedirecionamento: p.urlRedirecionamento?.trim(),
    telefone2: p.telefone2 ? normalizePhoneBR(p.telefone2) : undefined,
    telefone3: p.telefone3 ? normalizePhoneBR(p.telefone3) : undefined,
    cep: p.cep ? normalizeCep(p.cep) : undefined,
    logradouro: p.logradouro?.trim(),
    numero: p.numero?.trim(),
    complemento: p.complemento?.trim(),
    bairro: p.bairro?.trim(),
    referencia: p.referencia?.trim(),
    tipoSanguineo: p.tipoSanguineo,
    peso: p.peso ? normalizeDecimalText(p.peso) : undefined,
    altura: p.altura ? normalizeDecimalText(p.altura) : undefined,
    alergias: p.alergias?.trim(),
    condicaoSaudePrincipal: p.condicaoSaudePrincipal?.trim(),
    condicaoSaudePontuacao: p.condicaoSaudePontuacao,
    comorbidades: p.comorbidades?.trim(),
    nivelDor: p.nivelDor,
    mobilidade: p.mobilidade,
    dependenciaFuncional: p.dependenciaFuncional,
    integridadeFisica: p.integridadeFisica,
    urgenciaTerapeutica: p.urgenciaTerapeutica,
    tempoNaFila: p.tempoNaFila,
    faltasAnteriores: p.faltasAnteriores?.trim(),
    disponibilidadeEncaixe: p.disponibilidadeEncaixe?.trim(),
    tempoMinimoChegar: p.tempoMinimoChegar?.trim(),
    tempoDeslocamento: p.tempoDeslocamento?.trim(),
    tipoAtendimentoNecessario: p.tipoAtendimentoNecessario?.trim(),
    profissionalEspecialidadeNecessaria: p.profissionalEspecialidadeNecessaria?.trim(),
    observacoesClinicas: p.observacoesClinicas?.trim(),
    alertasCriticos: p.alertasCriticos?.trim(),
    compatibilidadeVaga: p.compatibilidadeVaga,
    viabilidadeComparecimento: p.viabilidadeComparecimento,
    convenio: p.convenio,
    planoConvenio: p.planoConvenio?.trim(),
    matriculaConvenio: p.matriculaConvenio?.trim(),
    validadeCarteira: p.validadeCarteira,
    status: p.status,
    foto: p.foto,
  };
  const cleaned = Object.fromEntries(
    Object.entries(extra).filter(([, value]) => value !== undefined && value !== '')
  );
  const base = p.observacoes?.trimEnd() ?? '';
  if (Object.keys(cleaned).length === 0) return base || undefined;
  return `${base}${PATIENT_EXTRA_MARKER}${JSON.stringify(cleaned)}`;
}

// ─── Agendamento ──────────────────────────────────────────────────────────────
export type TipoConsulta = 'Primeira Consulta' | 'Retorno' | 'Check-up' | 'Urgência';
export type StatusAgendamento = 'confirmado' | 'pendente' | 'cancelado' | 'realizado';

export interface Agendamento {
  id: string;
  pacienteId: string;
  medicoId?: string;
  data: string;
  hora: string;
  tipo: TipoConsulta;
  status: StatusAgendamento;
  observacoes?: string;
  duracao?: string;
  enviarEmail?: boolean;
  enviarWhatsapp?: boolean;
}

// ─── Laudo ────────────────────────────────────────────────────────────────────
export type StatusLaudo = 'rascunho' | 'liberado';

export interface Laudo {
  id: string;
  pacienteId: string;
  medicoId?: string;
  cid: string;
  data: string;
  diagnostico: string;
  tecnica?: string;
  impressao?: string;
  status: StatusLaudo;
  exame?: string;
  solicitante?: string;
  conteudoHtml?: string;
  ocultarData?: boolean;
  ocultarAssinatura?: boolean;
  orderNumber?: string;
  templateId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Helpers de mapeamento API ↔ modelo interno ───────────────────────────────
export function apiPatientToPaciente(p: ApiPatient): Paciente {
  const { observacoes, extra } = splitPatientNotes(p.notes);
  const notes = observacoes && !p.notes?.includes(PATIENT_EXTRA_MARKER) ? undefined : observacoes;
  return {
    id:          p.id,
    nome:        p.full_name,
    cpf:         p.cpf,
    dataNasc:    p.birth_date ?? '',
    email:       p.email,
    telefone:    p.phone_mobile,
    convenio:    extra.convenio ?? 'Particular',
    status:      extra.status ?? 'Ativo',
    raca:        p.race,
    sexo:        p.sex,
    observacoes: notes,
    ...extra,
    nomeSocial:  p.social_name ?? extra.nomeSocial,
    rg:          p.rg ?? extra.rg,
    outroDocTipo: p.document_type ?? extra.outroDocTipo,
    outroDocNumero: p.document_number ?? extra.outroDocNumero,
    telefone2:   p.phone1 ?? extra.telefone2,
    telefone3:   p.phone2 ?? extra.telefone3,
    naturalidade: p.naturality ?? extra.naturalidade,
    nacionalidade: p.nationality ?? extra.nacionalidade,
    profissao:   p.profession ?? extra.profissao,
    estadoCivil: p.marital_status ?? extra.estadoCivil,
    nomeResponsável: p.guardian_name ?? extra.nomeResponsável,
    cpfResponsável: p.guardian_cpf ?? extra.cpfResponsável,
    cep:         p.cep ?? extra.cep,
    logradouro:  p.street ?? extra.logradouro,
    numero:      p.number ?? extra.numero,
    complemento: p.complement ?? extra.complemento,
    bairro:      p.neighborhood ?? extra.bairro,
    cidade:      p.city,
    estado:      p.state,
    referencia:  p.reference ?? extra.referencia,
    tipoSanguineo: p.blood_type ?? extra.tipoSanguineo,
    peso:        p.weight_kg === undefined ? extra.peso : String(p.weight_kg),
    altura:      p.height_m === undefined ? extra.altura : String(p.height_m),
    vip:         p.vip ?? extra.vip,
    urlRedirecionamento: p.redirect_url ?? extra.urlRedirecionamento,
    alergias:    p.notes?.includes(PATIENT_EXTRA_MARKER) ? extra.alergias : p.notes ?? extra.alergias,
  };
}

export function pacienteToApiPatient(p: Omit<Paciente, 'id'>): Omit<ApiPatient, 'id'> {
  const weight = p.peso ? Number(normalizeDecimalText(p.peso)) : undefined;
  const height = p.altura ? Number(normalizeDecimalText(p.altura)) : undefined;
  const bmi = weight && height ? Number((weight / (height * height)).toFixed(2)) : undefined;
  return {
    full_name:        p.nome.trim(),
    social_name:      p.nomeSocial?.trim(),
    cpf:              digitsOnly(p.cpf),
    rg:               p.rg?.trim(),
    document_type:    p.outroDocTipo,
    document_number:  p.outroDocNumero?.trim(),
    birth_date:       p.dataNasc,
    email:            normalizeEmail(p.email),
    phone_mobile:     normalizePhoneBR(p.telefone),
    phone1:           p.telefone2 ? normalizePhoneBR(p.telefone2) : undefined,
    phone2:           p.telefone3 ? normalizePhoneBR(p.telefone3) : undefined,
    race:             p.raca,
    sex:              p.sexo,
    nationality:      p.nacionalidade,
    naturality:       p.naturalidade?.trim(),
    profession:       p.profissao?.trim(),
    marital_status:   p.estadoCivil,
    guardian_name:    p.nomeResponsável?.trim(),
    guardian_cpf:     p.cpfResponsável ? digitsOnly(p.cpfResponsável) : undefined,
    cep:              p.cep ? normalizeCep(p.cep) : undefined,
    street:           p.logradouro?.trim(),
    number:           p.numero?.trim(),
    complement:       p.complemento?.trim(),
    neighborhood:     p.bairro?.trim(),
    city:             p.cidade?.trim(),
    state:            p.estado?.trim().toUpperCase(),
    reference:        p.referencia?.trim(),
    blood_type:       p.tipoSanguineo,
    weight_kg:        Number.isFinite(weight) ? weight : undefined,
    height_m:         Number.isFinite(height) ? height : undefined,
    bmi,
    vip:              p.vip,
    notes:            buildPatientNotes({
      ...p,
      observacoes: [p.alergias?.trim(), p.observacoes?.trim()].filter(Boolean).join('\n\n'),
    }),
    redirect_url:     p.urlRedirecionamento?.trim(),
  };
}

export function apiAppointmentToAgendamento(a: ApiAppointment): Agendamento {
  const { data, hora } = splitApiDateTime(a.scheduled_at);
  const statusMap: Record<string, StatusAgendamento> = {
    requested: 'pendente', confirmed: 'confirmado',
    completed: 'realizado', cancelled: 'cancelado',
  };
  return {
    id:          a.id,
    pacienteId:  a.patient_id,
    medicoId:    a.doctor_id,
    data, hora,
    tipo:        'Primeira Consulta',
    status:      statusMap[a.status] ?? 'pendente',
    observacoes: a.notes,
    duracao: a.duration_minutes ? `${a.duration_minutes} min` : undefined,
  };
}

export function agendamentoToApiAppointment(
  a: Omit<Agendamento, 'id'>,
  createdBy: string
): Omit<ApiAppointment, 'id'> {
  const today = new Date();
  const todayISO = dateToISO(today);
  if (a.data < todayISO) {
    throw new Error('A consulta não pode ser agendada para data anterior a hoje.');
  }
  if (!a.pacienteId) throw new Error('Selecione um paciente para o agendamento.');
  if (!a.medicoId) throw new Error('Selecione um médico para o agendamento.');
  if (!a.hora) throw new Error('Informe o horário do agendamento.');
  if (a.data === todayISO && a.hora <= timeToHHMM(today)) {
    throw new Error('A consulta não pode ser agendada para horário que já passou.');
  }
  if (!createdBy) throw new Error('Usuário autenticado não identificado para criar o agendamento.');
  const statusMap: Record<StatusAgendamento, ApiAppointment['status']> = {
    pendente: 'requested', confirmado: 'confirmed',
    realizado: 'completed', cancelado: 'cancelled',
  };
  return {
    doctor_id:        a.medicoId ?? '',
    patient_id:       a.pacienteId,
    scheduled_at:     `${a.data}T${a.hora}:00Z`,
    duration_minutes: 30,
    status:           statusMap[a.status || 'pendente'],
    notes:            a.observacoes,
    created_by:       createdBy,
  };
}

export function apiReportToLaudo(r: ApiReport): Laudo {
  const releasedStatuses = new Set(['completed', 'released', 'liberado', 'finalized', 'finalizado', 'signed']);
  const normalizedStatus = r.status.toLowerCase().trim();
  const mediconnectStatus = typeof r.content_json?.mediconnect_status === 'string'
    ? r.content_json.mediconnect_status.toLowerCase().trim()
    : '';
  return {
    id:                r.id,
    pacienteId:        r.patient_id,
    medicoId:          r.created_by,
    cid:               r.cid_code ?? '',
    data:              r.created_at ? r.created_at.split('T')[0] : '',
    diagnostico:       r.diagnosis ?? '',
    tecnica:           r.exam,
    impressao:         r.conclusion,
    status:            mediconnectStatus === 'liberado' || releasedStatuses.has(normalizedStatus) ? 'liberado' : 'rascunho',
    exame:             r.exam,
    solicitante:       r.requested_by,
    conteudoHtml:      r.content_html,
    ocultarData:       r.hide_date,
    ocultarAssinatura: r.hide_signature,
    orderNumber:       r.order_number,
    templateId:         typeof r.content_json?.templateId === 'string' ? r.content_json.templateId : undefined,
    createdAt:          r.created_at,
    updatedAt:          r.updated_at,
  };
}

export function laudoToApiReport(
  l: Omit<Laudo, 'id'>,
  createdBy: string
): Omit<ApiReport, 'id' | 'order_number' | 'created_at' | 'updated_at'> {
  const contentJson: Record<string, unknown> = {
    mediconnect_status: l.status,
  };
  if (l.templateId) contentJson.templateId = l.templateId;

  return {
    patient_id:     l.pacienteId,
    status:         'draft',
    cid_code:       l.cid,
    diagnosis:      l.diagnostico,
    conclusion:     l.impressao,
    exam:           l.tecnica ?? l.exame,
    requested_by:   l.solicitante,
    content_html:   l.conteudoHtml,
    hide_date:      l.ocultarData,
    hide_signature: l.ocultarAssinatura,
    content_json:   contentJson,
    created_by:     createdBy,
  };
}
