// ─────────────────────────────────────────────────────────────────────────────
// Camada de ferramentas (tools) do assistente do paciente (Panaceia).
//
// IMPORTANTE (restrições do projeto):
// - Estas ferramentas NÃO fazem chamadas de API novas. Elas operam exclusivamente
//   sobre os dados que o App já carregou via os services existentes
//   (patientsApi / appointmentsApi / reportsApi / doctorsApi) para o paciente
//   autenticado. Assim reutilizamos os endpoints já consumidos pelo frontend,
//   sem duplicar requisições nem depender de mudanças no backend.
// - Segurança: todas as ferramentas só operam para role 'paciente' e filtram os
//   registros pelos identificadores do próprio paciente (defesa em profundidade).
// ─────────────────────────────────────────────────────────────────────────────
import type { ApiDoctor } from './api';
import type { Agendamento, AuthUser, Laudo, Paciente, StatusAgendamento } from '../types';
import { formatDateBR } from '../shared/utils/date';

export interface PatientAssistantContext {
  user: AuthUser;
  paciente: Paciente | null;
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors: ApiDoctor[];
  now: Date;
}

export type PatientToolName =
  | 'getPatientProfile'
  | 'getUpcomingAppointments'
  | 'getPastAppointments'
  | 'getReleasedReports'
  | 'getNotifications'
  | 'getMedicalHistorySummary';

const APPOINTMENT_STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: 'Confirmada',
  pendente: 'Aguardando confirmação',
  cancelado: 'Cancelada',
  realizado: 'Realizada',
};

// ─── Helpers internos ─────────────────────────────────────────────────────────
function isPatient(ctx: PatientAssistantContext) {
  return ctx.user.role === 'paciente';
}

function ownPatientIds(ctx: PatientAssistantContext): string[] {
  return Array.from(
    new Set(
      [ctx.paciente?.id, ctx.user.patient_id, ctx.user.id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
}

function isOwnAppointment(ctx: PatientAssistantContext, item: Agendamento) {
  const ids = ownPatientIds(ctx);
  return ids.length === 0 || ids.includes(item.pacienteId);
}

function isOwnReport(ctx: PatientAssistantContext, item: Laudo) {
  const ids = ownPatientIds(ctx);
  return ids.length === 0 || ids.includes(item.pacienteId);
}

function resolveDoctor(ctx: PatientAssistantContext, doctorId?: string) {
  const doctor = ctx.doctors.find(item => item.id === doctorId);
  return {
    medico: doctor?.full_name ?? 'Médico não informado',
    especialidade: doctor?.specialty ?? 'Especialidade não informada',
  };
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function toTimeKey(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isUpcoming(ctx: PatientAssistantContext, item: Agendamento) {
  if (item.status === 'cancelado' || item.status === 'realizado') return false;
  const todayKey = toDateKey(ctx.now);
  const nowKey = toTimeKey(ctx.now);
  return item.data > todayKey || (item.data === todayKey && item.hora >= nowKey);
}

function calcAge(birthISO?: string, now = new Date()): number | null {
  if (!birthISO) return null;
  const match = birthISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const [, y, m, d] = match;
  const birth = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(birth.getTime())) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function maskCpf(cpf?: string): string | undefined {
  const digits = (cpf ?? '').replace(/\D/g, '');
  if (digits.length !== 11) return cpf?.trim() || undefined;
  // Mantém apenas os 2 últimos dígitos visíveis (proteção em logs de chat).
  return `***.***.***-${digits.slice(9)}`;
}

function buildAddress(p: Paciente | null): string | undefined {
  if (!p) return undefined;
  const street = [p.logradouro, p.numero].filter(Boolean).join(', ');
  const parts = [street, p.bairro, [p.cidade, p.estado].filter(Boolean).join(' - ')]
    .map(part => part?.trim())
    .filter(Boolean);
  const address = parts.join(', ');
  return address || undefined;
}

function sortByDateTimeAsc(a: Agendamento, b: Agendamento) {
  return `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`);
}

function sortByDateTimeDesc(a: Agendamento, b: Agendamento) {
  return `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`);
}

// ─── Tools ────────────────────────────────────────────────────────────────────
export function getPatientProfile(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const p = ctx.paciente;
  if (!p) {
    return { authorized: true as const, found: false as const };
  }
  return {
    authorized: true as const,
    found: true as const,
    nome: p.nome,
    primeiroNome: p.nome?.split(' ')[0] ?? '',
    email: p.email || ctx.user.email || undefined,
    telefone: p.telefone || undefined,
    telefoneSecundario: p.telefone2 || undefined,
    cpf: maskCpf(p.cpf),
    dataNascimento: p.dataNasc ? formatDateBR(p.dataNasc) : undefined,
    idade: calcAge(p.dataNasc, ctx.now),
    convenio: p.convenio || undefined,
    sexo: p.sexo || undefined,
    endereco: buildAddress(p),
    cidade: p.cidade || undefined,
    estado: p.estado || undefined,
    tipoSanguineo: p.tipoSanguineo || undefined,
  };
}

export function getUpcomingAppointments(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const consultas = ctx.agendamentos
    .filter(item => isOwnAppointment(ctx, item) && isUpcoming(ctx, item))
    .sort(sortByDateTimeAsc)
    .map(item => {
      const { medico, especialidade } = resolveDoctor(ctx, item.medicoId);
      return {
        data: item.data,
        dataBR: formatDateBR(item.data),
        hora: item.hora,
        medico,
        especialidade,
        status: item.status,
        statusLabel: APPOINTMENT_STATUS_LABEL[item.status] ?? item.status,
        tipo: item.tipo,
        observacoes: item.observacoes || undefined,
      };
    });
  return { authorized: true as const, total: consultas.length, consultas };
}

export function getPastAppointments(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const consultas = ctx.agendamentos
    .filter(item => isOwnAppointment(ctx, item) && !isUpcoming(ctx, item) && item.status !== 'cancelado')
    .sort(sortByDateTimeDesc)
    .slice(0, 20)
    .map(item => {
      const { medico, especialidade } = resolveDoctor(ctx, item.medicoId);
      return {
        data: item.data,
        dataBR: formatDateBR(item.data),
        hora: item.hora,
        medico,
        especialidade,
        status: item.status,
        statusLabel: APPOINTMENT_STATUS_LABEL[item.status] ?? item.status,
        tipo: item.tipo,
      };
    });
  return { authorized: true as const, total: consultas.length, consultas };
}

export function getReleasedReports(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const laudos = ctx.laudos
    .filter(item => isOwnReport(ctx, item) && item.status === 'liberado')
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .map(item => {
      const { medico, especialidade } = resolveDoctor(ctx, item.medicoId);
      return {
        dataBR: item.data ? formatDateBR(item.data) : (item.createdAt ? formatDateBR(item.createdAt.slice(0, 10)) : undefined),
        exame: item.exame || 'Laudo médico',
        diagnostico: item.diagnostico || undefined,
        impressao: item.impressao || undefined,
        medico,
        especialidade,
        numero: item.orderNumber || undefined,
      };
    });
  return {
    authorized: true as const,
    total: laudos.length,
    laudos,
    // Apenas laudos liberados são acessíveis pelo paciente no frontend.
    // Laudos em rascunho/pendentes não são expostos a este perfil.
    observacao: 'Somente laudos já liberados ficam visíveis para o paciente.',
  };
}

export function getNotifications(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const lembretes: Array<{ tipo: string; titulo: string; mensagem: string }> = [];

  const proximas = ctx.agendamentos
    .filter(item => isOwnAppointment(ctx, item) && isUpcoming(ctx, item))
    .sort(sortByDateTimeAsc)
    .slice(0, 3);
  const todayKey = toDateKey(ctx.now);
  proximas.forEach(item => {
    const { medico } = resolveDoctor(ctx, item.medicoId);
    lembretes.push({
      tipo: 'consulta',
      titulo: item.data === todayKey ? 'Consulta hoje' : 'Consulta próxima',
      mensagem: `${formatDateBR(item.data)} às ${item.hora} com ${medico}.`,
    });
  });

  const laudosRecentes = ctx.laudos
    .filter(item => isOwnReport(ctx, item) && item.status === 'liberado')
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
    .slice(0, 3);
  laudosRecentes.forEach(item => {
    lembretes.push({
      tipo: 'laudo',
      titulo: 'Laudo disponível',
      mensagem: `${item.exame || 'Laudo'} - ${item.data ? formatDateBR(item.data) : 'data não informada'}.`,
    });
  });

  return { authorized: true as const, total: lembretes.length, lembretes };
}

export function getMedicalHistorySummary(ctx: PatientAssistantContext) {
  if (!isPatient(ctx)) return { authorized: false as const };
  const past = getPastAppointments(ctx);
  const reports = getReleasedReports(ctx);
  const upcoming = getUpcomingAppointments(ctx);
  return {
    authorized: true as const,
    totalConsultasRealizadas: past.authorized ? past.total : 0,
    totalLaudosLiberados: reports.authorized ? reports.total : 0,
    totalConsultasFuturas: upcoming.authorized ? upcoming.total : 0,
    ultimasConsultas: past.authorized ? past.consultas.slice(0, 5) : [],
    laudos: reports.authorized ? reports.laudos.slice(0, 5) : [],
  };
}

// ─── Executor genérico (usado pelo function-calling do Gemini) ────────────────
export function executePatientTool(name: string, ctx: PatientAssistantContext): Record<string, unknown> {
  switch (name as PatientToolName) {
    case 'getPatientProfile':
      return getPatientProfile(ctx);
    case 'getUpcomingAppointments':
      return getUpcomingAppointments(ctx);
    case 'getPastAppointments':
      return getPastAppointments(ctx);
    case 'getReleasedReports':
      return getReleasedReports(ctx);
    case 'getNotifications':
      return getNotifications(ctx);
    case 'getMedicalHistorySummary':
      return getMedicalHistorySummary(ctx);
    default:
      return { error: `Ferramenta desconhecida: ${name}` };
  }
}

// ─── Declarações para o Function Calling do Gemini ────────────────────────────
const EMPTY_PARAMS = { type: 'object', properties: {} } as const;

export const PATIENT_ASSISTANT_TOOL_DECLARATIONS = [
  {
    name: 'getPatientProfile',
    description:
      'Retorna os dados cadastrais do paciente autenticado: nome, e-mail, telefone(s), CPF (mascarado), data de nascimento, idade, convênio, sexo, endereço, cidade/estado e tipo sanguíneo. Use para perguntas sobre dados pessoais/contato/cadastro (ex.: "qual meu telefone", "qual meu convênio", "qual meu e-mail cadastrado").',
    parameters: EMPTY_PARAMS,
  },
  {
    name: 'getUpcomingAppointments',
    description:
      'Retorna as consultas/agendamentos FUTUROS do paciente (data, horário, médico, especialidade e status). Use para perguntas como "tenho consultas marcadas?", "qual minha próxima consulta?", "quando é minha consulta?".',
    parameters: EMPTY_PARAMS,
  },
  {
    name: 'getPastAppointments',
    description:
      'Retorna as consultas/atendimentos PASSADOS ou já realizados do paciente. Use para perguntas sobre histórico de consultas anteriores.',
    parameters: EMPTY_PARAMS,
  },
  {
    name: 'getReleasedReports',
    description:
      'Retorna os laudos/exames LIBERADOS disponíveis para o paciente (data, exame, médico responsável). Use para perguntas como "tenho algum laudo disponível?", "meus exames saíram?", "tenho laudo pendente?".',
    parameters: EMPTY_PARAMS,
  },
  {
    name: 'getNotifications',
    description:
      'Retorna lembretes e avisos do paciente, derivados das próximas consultas e dos laudos recém-liberados.',
    parameters: EMPTY_PARAMS,
  },
  {
    name: 'getMedicalHistorySummary',
    description:
      'Retorna um resumo consolidado do paciente: total de consultas realizadas, total de consultas futuras, total de laudos liberados e os itens mais recentes.',
    parameters: EMPTY_PARAMS,
  },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Fallback determinístico (sem IA): garante respostas com dados reais mesmo se o
// Gemini estiver indisponível. Nunca inventa informação — usa apenas o contexto.
// Retorna null quando a pergunta não corresponde a nenhuma intenção de dados.
// ─────────────────────────────────────────────────────────────────────────────
function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchesAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term));
}

export function buildDeterministicAnswer(message: string, ctx: PatientAssistantContext): string | null {
  if (!isPatient(ctx)) return null;
  const text = normalize(message);
  const firstName = ctx.paciente?.nome?.split(' ')[0] || ctx.user.full_name?.split(' ')[0] || 'paciente';

  // ── Próximas consultas ──
  if (matchesAny(text, ['proxima consulta', 'proximas consultas', 'consultas marcadas', 'consulta marcada', 'tenho consulta', 'minhas consultas', 'agendamento', 'agendamentos', 'quando e minha consulta', 'quando sera minha consulta'])) {
    const result = getUpcomingAppointments(ctx);
    if (!result.authorized || result.total === 0) {
      return `No momento não encontrei nenhuma consulta futura marcada no seu cadastro, ${firstName}. Se acabou de agendar, pode levar alguns instantes para aparecer. Caso precise, posso te encaminhar para a secretaria.`;
    }
    const linhas = result.consultas.map(c =>
      `- ${c.dataBR} às ${c.hora} — ${c.medico} (${c.especialidade}) · ${c.statusLabel}`,
    );
    return `Você tem ${result.total} consulta(s) futura(s), ${firstName}:\n\n${linhas.join('\n')}`;
  }

  // ── Laudos / exames ──
  if (matchesAny(text, ['laudo', 'laudos', 'exame', 'exames', 'resultado', 'resultados'])) {
    const result = getReleasedReports(ctx);
    if (!result.authorized || result.total === 0) {
      return `Não encontrei nenhum laudo liberado para você no momento, ${firstName}. Assim que um laudo for liberado pela equipe, ele aparecerá aqui e na sua área de Registro.`;
    }
    const linhas = result.laudos.map(l =>
      `- ${l.dataBR ?? 'Sem data'} — ${l.exame} (${l.medico})`,
    );
    return `Você tem ${result.total} laudo(s) liberado(s), ${firstName}:\n\n${linhas.join('\n')}\n\nVocê pode visualizá-los na área de Registro.`;
  }

  // ── Histórico / consultas passadas ──
  if (matchesAny(text, ['historico', 'consultas anteriores', 'consultas passadas', 'ja fui atendido', 'ultimas consultas', 'atendimentos anteriores'])) {
    const result = getPastAppointments(ctx);
    if (!result.authorized || result.total === 0) {
      return `Ainda não encontrei consultas anteriores registradas no seu histórico, ${firstName}.`;
    }
    const linhas = result.consultas.slice(0, 8).map(c =>
      `- ${c.dataBR} — ${c.medico} (${c.especialidade}) · ${c.statusLabel}`,
    );
    return `Seu histórico recente de atendimentos, ${firstName}:\n\n${linhas.join('\n')}`;
  }

  // ── Notificações / lembretes ──
  if (matchesAny(text, ['lembrete', 'lembretes', 'aviso', 'avisos', 'notificacao', 'notificacoes'])) {
    const result = getNotifications(ctx);
    if (!result.authorized || result.total === 0) {
      return `Você não tem lembretes pendentes no momento, ${firstName}.`;
    }
    const linhas = result.lembretes.map(n => `- ${n.titulo}: ${n.mensagem}`);
    return `Seus lembretes, ${firstName}:\n\n${linhas.join('\n')}`;
  }

  // ── Dados de perfil / contato ──
  if (matchesAny(text, ['telefone', 'celular', 'contato', 'email', 'e-mail', 'convenio', 'plano', 'meu cpf', 'data de nascimento', 'nascimento', 'idade', 'meu endereco', 'meus dados', 'meu cadastro', 'meu perfil', 'tipo sanguineo'])) {
    const profile = getPatientProfile(ctx);
    if (!profile.authorized || !profile.found) {
      return `Não consegui localizar seu cadastro de paciente neste momento, ${firstName}. Verifique com a secretaria se sua conta está vinculada a um cadastro.`;
    }
    if (matchesAny(text, ['telefone', 'celular', 'contato'])) {
      if (!profile.telefone) return `Não há um telefone cadastrado no seu perfil, ${firstName}. A secretaria pode atualizar esse dado para você.`;
      const extra = profile.telefoneSecundario ? ` (telefone secundário: ${profile.telefoneSecundario})` : '';
      return `Seu telefone cadastrado é ${profile.telefone}${extra}, ${firstName}.`;
    }
    if (matchesAny(text, ['email', 'e-mail'])) {
      return profile.email
        ? `Seu e-mail cadastrado é ${profile.email}, ${firstName}.`
        : `Não há um e-mail cadastrado no seu perfil, ${firstName}.`;
    }
    if (matchesAny(text, ['convenio', 'plano'])) {
      return `Seu convênio cadastrado é ${profile.convenio ?? 'Particular'}, ${firstName}.`;
    }
    if (matchesAny(text, ['cpf'])) {
      return profile.cpf
        ? `Por segurança mostro seu CPF parcialmente: ${profile.cpf}. O número completo está disponível na sua área de cadastro.`
        : `Não há um CPF cadastrado no seu perfil, ${firstName}.`;
    }
    if (matchesAny(text, ['nascimento', 'idade'])) {
      const idade = profile.idade != null ? ` (${profile.idade} anos)` : '';
      return profile.dataNascimento
        ? `Sua data de nascimento cadastrada é ${profile.dataNascimento}${idade}, ${firstName}.`
        : `Não há uma data de nascimento cadastrada no seu perfil, ${firstName}.`;
    }
    if (matchesAny(text, ['endereco'])) {
      return profile.endereco
        ? `Seu endereço cadastrado é: ${profile.endereco}.`
        : `Não há um endereço completo cadastrado no seu perfil, ${firstName}.`;
    }
    if (matchesAny(text, ['tipo sanguineo'])) {
      return profile.tipoSanguineo
        ? `Seu tipo sanguíneo cadastrado é ${profile.tipoSanguineo}, ${firstName}.`
        : `Não há tipo sanguíneo cadastrado no seu perfil, ${firstName}.`;
    }
    // Resumo geral do cadastro.
    const linhas = [
      profile.nome && `- Nome: ${profile.nome}`,
      profile.email && `- E-mail: ${profile.email}`,
      profile.telefone && `- Telefone: ${profile.telefone}`,
      profile.convenio && `- Convênio: ${profile.convenio}`,
      profile.dataNascimento && `- Nascimento: ${profile.dataNascimento}${profile.idade != null ? ` (${profile.idade} anos)` : ''}`,
      profile.cidade && `- Cidade: ${profile.cidade}${profile.estado ? ` - ${profile.estado}` : ''}`,
    ].filter(Boolean);
    return `Estes são os seus dados cadastrais, ${firstName}:\n\n${linhas.join('\n')}`;
  }

  return null;
}
