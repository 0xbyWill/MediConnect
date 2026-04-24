import type { ApiPatient, ApiAppointment, ApiReport } from './lib/api';

// ─── Perfis de usuário ────────────────────────────────────────────────────────
export type UserRole = 'medico' | 'gestao' | 'secretaria';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  specialty?: string;
  crm?: string;
  avatar_url?: string;
  doctor_id?: string;
}

// ─── Páginas disponíveis ──────────────────────────────────────────────────────
export type PageType =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'laudos'
  | 'comunicacao'
  | 'relatorios'
  | 'usuarios'
  | 'metricas'
  | 'configuracoes';

// ─── Permissões por perfil ────────────────────────────────────────────────────
export const ROLE_PAGES: Record<UserRole, PageType[]> = {
  medico:     ['dashboard', 'pacientes', 'laudos', 'agenda', 'comunicacao', 'relatorios'],
  gestao:     ['dashboard', 'pacientes', 'laudos', 'agenda', 'comunicacao', 'relatorios', 'usuarios', 'metricas', 'configuracoes'],
  secretaria: ['dashboard', 'agenda', 'pacientes', 'comunicacao'],
};

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

// ─── Paciente (modelo interno) ────────────────────────────────────────────────
export interface Paciente {
  id: string;
  nome: string;
  cpf: string;
  dataNasc: string;
  email: string;
  telefone: string;
  convenio: ConvenioType;
  status: StatusPaciente;
  etnia?: string;
  raca?: string;
  foto?: string;
  nomeSocial?: string;
  rg?: string;
  sexo?: string;
  naturalidade?: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  nomeMae?: string;
  nomePai?: string;
  nomeResponsavel?: string;
  cpfResponsavel?: string;
  observacoes?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  complemento?: string;
  isVip?: boolean;
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
  duracao?: number;
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
  return {
    id: p.id,
    nome: p.full_name,
    cpf: p.cpf,
    dataNasc: p.birth_date ?? '',
    email: p.email,
    telefone: p.phone_mobile,
    convenio: (p.health_insurance as ConvenioType) ?? 'Particular',
    status: p.status === 'inactive' ? 'Inativo' : 'Ativo',
    etnia: p.etnia,
    raca: p.raca,
    foto: p.avatar_url,
  };
}

export function pacienteToApiPatient(p: Omit<Paciente, 'id'>): Omit<ApiPatient, 'id'> {
  return {
    full_name: p.nome,
    cpf: p.cpf.replace(/\D/g, ''),
    birth_date: p.dataNasc,
    email: p.email,
    phone_mobile: p.telefone,
    health_insurance: p.convenio,
    status: p.status === 'Ativo' ? 'active' : 'inactive',
    etnia: p.etnia,
    raca: p.raca,
    avatar_url: p.foto,
  };
}

export function apiAppointmentToAgendamento(a: ApiAppointment): Agendamento {
  const dt = new Date(a.scheduled_at);
  const data = dt.toISOString().split('T')[0];
  const hora = `${String(dt.getUTCHours()).padStart(2, '0')}:${String(dt.getUTCMinutes()).padStart(2, '0')}`;
  const statusMap: Record<string, StatusAgendamento> = {
    requested: 'pendente',
    confirmed:  'confirmado',
    completed:  'realizado',
    cancelled:  'cancelado',
  };
  return {
    id: a.id,
    pacienteId: a.patient_id,
    medicoId:   a.doctor_id,
    data,
    hora,
    tipo:       (a.type as TipoConsulta) ?? 'Primeira Consulta',
    status:     statusMap[a.status] ?? 'pendente',
    observacoes: a.notes,
    duracao:    a.duration_minutes,
  };
}

export function agendamentoToApiAppointment(
  a: Omit<Agendamento, 'id'>,
  createdBy: string
): Omit<ApiAppointment, 'id'> {
  const statusMap: Record<StatusAgendamento, ApiAppointment['status']> = {
    pendente:   'requested',
    confirmado: 'confirmed',
    realizado:  'completed',
    cancelado:  'cancelled',
  };
  return {
    doctor_id:        a.medicoId ?? '',
    patient_id:       a.pacienteId,
    scheduled_at:     `${a.data}T${a.hora}:00Z`,
    duration_minutes: a.duracao ?? 30,
    status:           statusMap[a.status],
    notes:            a.observacoes,
    type:             a.tipo,
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
    patient_id:    l.pacienteId,
    status:        l.status === 'liberado' ? 'completed' : 'draft',
    cid_code:      l.cid,
    diagnosis:     l.diagnostico,
    conclusion:    l.impressao,
    exam:          l.tecnica ?? l.exame,
    requested_by:  l.solicitante,
    content_html:  l.conteudoHtml,
    hide_date:     l.ocultarData,
    hide_signature: l.ocultarAssinatura,
    created_by:    createdBy,
  };
}