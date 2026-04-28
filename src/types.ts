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
  etnia?: string;
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
  isVip?: boolean;
  foto?: string;
  observacoes?: string;
  // Atendimentos (gerados a partir de agendamentos)
  ultimoAtendimento?: string;
  proximoAtendimento?: string;
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
  return {
    id:          p.id,
    nome:        p.full_name,
    cpf:         p.cpf,
    dataNasc:    p.birth_date ?? '',
    email:       p.email,
    telefone:    p.phone_mobile,
    convenio:    'Particular',
    status:      'Ativo',
    raca:        p.race,
    sexo:        p.sex,
    cidade:      p.city,
    estado:      p.state,
    observacoes: p.notes,
  };
}

export function pacienteToApiPatient(p: Omit<Paciente, 'id'>): Omit<ApiPatient, 'id'> {
  return {
    full_name:        p.nome,
    cpf:              p.cpf.replace(/\D/g, ''),
    birth_date:       p.dataNasc,
    email:            p.email,
    phone_mobile:     p.telefone,
    race:             p.raca,
    sex:              p.sexo,
    city:             p.cidade,
    state:            p.estado,
    notes:            p.observacoes,
  };
}

function splitApiDateTime(value: string) {
  const direct = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (direct) {
    return { data: direct[1], hora: `${direct[2]}:${direct[3]}` };
  }

  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return { data: '', hora: '' };

  return {
    data: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
    hora: `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`,
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
  const statusMap: Record<StatusAgendamento, ApiAppointment['status']> = {
    pendente: 'requested', confirmado: 'confirmed',
    realizado: 'completed', cancelado: 'cancelled',
  };
  return {
    doctor_id:        a.medicoId ?? '',
    patient_id:       a.pacienteId,
    scheduled_at:     `${a.data}T${a.hora}:00Z`,
    duration_minutes: a.duracao ? parseInt(a.duracao) : 30,
    status:           statusMap[a.status],
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
