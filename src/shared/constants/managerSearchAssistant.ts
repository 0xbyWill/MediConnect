import type { ManagerSearchAssistantAction, ManagerSearchAssistantSource } from '../../types';

export const MANAGER_ASSISTANT_CLINICAL_BLOCK_MESSAGE =
  'Não posso realizar análise clínica, diagnóstico, prescrição ou interpretação médica. Posso ajudar apenas com informações administrativas e gerenciais disponíveis no sistema.';

export const MANAGER_ASSISTANT_FORBIDDEN_ACTION_MESSAGE =
  'Não posso executar essa ação automaticamente. Posso apenas localizar informações, resumir dados ou gerar um rascunho para revisão humana.';

export const MANAGER_ASSISTANT_EMPTY_STATE =
  'Faça uma pergunta ou escolha uma ação rápida para resumir os dados administrativos disponíveis.';

export const MANAGER_ASSISTANT_LIMITS = [
  'Somente leitura: não cria, edita, exclui, cancela, envia mensagens ou altera financeiro.',
  'Não interpreta laudos clinicamente e não substitui revisão humana.',
  'Responde apenas com base no contexto carregado e resumido pelo sistema.',
];

export const MANAGER_ASSISTANT_EXAMPLE_QUESTIONS = [
  'Quais foram os principais volumes de atendimento deste mês?',
  'Quais médicos tiveram mais consultas realizadas no período?',
  'Existe alguma pendência administrativa relevante?',
  'Crie um rascunho de comunicado para pacientes com consulta amanhã.',
];

export const MANAGER_ASSISTANT_QUICK_ACTIONS: Array<{
  action: ManagerSearchAssistantAction;
  label: string;
  prompt: string;
  source: ManagerSearchAssistantSource;
}> = [
  {
    action: 'daily_summary',
    label: 'Consultas do dia',
    prompt: 'Resuma as consultas de hoje com totais por status e principais pontos administrativos.',
    source: 'appointments',
  },
  {
    action: 'weekly_summary',
    label: 'Consultas da semana',
    prompt: 'Resuma o volume de consultas da semana e destaque cancelamentos, pendências e produtividade.',
    source: 'appointments',
  },
  {
    action: 'monthly_summary',
    label: 'Consultas do mês',
    prompt: 'Resuma as consultas do mês e destaque tendências administrativas relevantes.',
    source: 'mixed',
  },
  {
    action: 'missed_appointments',
    label: 'Pacientes faltosos',
    prompt: 'Liste possíveis faltas ou ausências registradas no período, sem expor dados sensíveis.',
    source: 'appointments',
  },
  {
    action: 'financial_summary',
    label: 'Financeiro do mês',
    prompt: 'Analise o financeiro básico disponível no contexto, sem inventar valores ausentes.',
    source: 'financial',
  },
  {
    action: 'doctor_performance',
    label: 'Desempenho médico',
    prompt: 'Compare os médicos por volume de atendimentos e status das consultas no período.',
    source: 'doctors',
  },
  {
    action: 'message_draft',
    label: 'Rascunho comunicado',
    prompt: 'Gere apenas um rascunho de comunicado administrativo para revisão humana.',
    source: 'patients',
  },
  {
    action: 'admin_pending_tasks',
    label: 'Pendências',
    prompt: 'Liste pendências administrativas a partir de consultas, laudos e cadastros disponíveis.',
    source: 'mixed',
  },
];

export const MANAGER_ASSISTANT_DATA_SOURCES: Array<{
  value: ManagerSearchAssistantSource;
  label: string;
}> = [
  { value: 'mixed', label: 'Dados gerais' },
  { value: 'appointments', label: 'Consultas' },
  { value: 'reports', label: 'Relatórios e laudos' },
  { value: 'patients', label: 'Pacientes' },
  { value: 'doctors', label: 'Médicos' },
  { value: 'financial', label: 'Financeiro básico' },
];
