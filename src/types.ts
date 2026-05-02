import type { ApiPatient, ApiAppointment, ApiReport } from './lib/api';
import type { UserRole } from './shared/constants/roles';
import { splitApiDateTime } from './shared/utils/date';
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
  nomeMae?: string;
  profissaoMae?: string;
  nomePai?: string;
  profissaoPai?: string;
  nomeResponsavel?: string;
  cpfResponsavel?: string;
  nomeEsposo?: string;
  rnGuiaConvenio?: boolean;
  codigoLegado?: string;
  // Contato
  email: string;
  telefone: string;
  telefone2?: string;
  // Endereço
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  // Informações médicas
  tipoSanguineo?: string;
  peso?: string;
  altura?: string;
  alergias?: string;
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
    nomeMae: p.nomeMae?.trim(),
    profissaoMae: p.profissaoMae?.trim(),
    nomePai: p.nomePai?.trim(),
    profissaoPai: p.profissaoPai?.trim(),
    nomeResponsavel: p.nomeResponsavel?.trim(),
    cpfResponsavel: p.cpfResponsavel ? digitsOnly(p.cpfResponsavel) : undefined,
    nomeEsposo: p.nomeEsposo?.trim(),
    rnGuiaConvenio: p.rnGuiaConvenio,
    codigoLegado: p.codigoLegado?.trim(),
    telefone2: p.telefone2 ? normalizePhoneBR(p.telefone2) : undefined,
    cep: p.cep ? normalizeCep(p.cep) : undefined,
    logradouro: p.logradouro?.trim(),
    numero: p.numero?.trim(),
    complemento: p.complemento?.trim(),
    bairro: p.bairro?.trim(),
    tipoSanguineo: p.tipoSanguineo,
    peso: p.peso ? normalizeDecimalText(p.peso) : undefined,
    altura: p.altura ? normalizeDecimalText(p.altura) : undefined,
    alergias: p.alergias?.trim(),
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
}

// ─── Helpers de mapeamento API ↔ modelo interno ───────────────────────────────
export function apiPatientToPaciente(p: ApiPatient): Paciente {
  const { observacoes, extra } = splitPatientNotes(p.notes);
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
    cidade:      p.city,
    estado:      p.state,
    observacoes,
    ...extra,
  };
}

export function pacienteToApiPatient(p: Omit<Paciente, 'id'>): Omit<ApiPatient, 'id'> {
  return {
    full_name:        p.nome.trim(),
    cpf:              digitsOnly(p.cpf),
    birth_date:       p.dataNasc,
    email:            normalizeEmail(p.email),
    phone_mobile:     normalizePhoneBR(p.telefone),
    race:             p.raca,
    sex:              p.sexo,
    city:             p.cidade?.trim(),
    state:            p.estado?.trim(),
    notes:            buildPatientNotes(p),
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
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (a.data < todayISO) {
    throw new Error('A consulta não pode ser agendada para data anterior a hoje.');
  }
  if (!a.pacienteId) throw new Error('Selecione um paciente para o agendamento.');
  if (!a.medicoId) throw new Error('Selecione um medico para o agendamento.');
  if (!a.hora) throw new Error('Informe o horario do agendamento.');
  if (!createdBy) throw new Error('Usuario autenticado nao identificado para criar o agendamento.');
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
  return {
    id:                r.id,
    pacienteId:        r.patient_id,
    medicoId:          r.created_by,
    cid:               r.cid_code ?? '',
    data:              r.created_at ? r.created_at.split('T')[0] : '',
    diagnostico:       r.diagnosis ?? '',
    tecnica:           r.exam,
    impressao:         r.conclusion,
    status:            r.status === 'completed' ? 'liberado' : 'rascunho',
    exame:             r.exam,
    solicitante:       r.requested_by,
    conteudoHtml:      r.content_html,
    ocultarData:       r.hide_date,
    ocultarAssinatura: r.hide_signature,
    orderNumber:       r.order_number,
  };
}

export function laudoToApiReport(
  l: Omit<Laudo, 'id'>,
  createdBy: string
): Omit<ApiReport, 'id' | 'order_number' | 'created_at' | 'updated_at'> {
  return {
    patient_id:     l.pacienteId,
    status:         l.status === 'liberado' ? 'completed' : 'draft',
    cid_code:       l.cid,
    diagnosis:      l.diagnostico,
    conclusion:     l.impressao,
    exam:           l.tecnica ?? l.exame,
    requested_by:   l.solicitante,
    content_html:   l.conteudoHtml,
    hide_date:      l.ocultarData,
    hide_signature: l.ocultarAssinatura,
    created_by:     createdBy,
  };
}
