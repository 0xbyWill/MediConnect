import type { ManagerSearchAssistantAction, ManagerSearchAssistantSource } from '../../types';

export const MANAGER_ASSISTANT_CLINICAL_BLOCK_MESSAGE =
  'Pedido bloqueado por tentar alterar regras de segurança do assistente.';

export const MANAGER_ASSISTANT_FORBIDDEN_ACTION_MESSAGE =
  'Pedido bloqueado por tentar alterar regras de segurança do assistente.';

export const MANAGER_ASSISTANT_EMPTY_STATE =
  'Faça uma pergunta ou escolha uma ação rápida. Com VITE_GEMINI_API_KEY, a IA roda direto no navegador com acesso completo aos dados do gestor.';

export const MANAGER_ASSISTANT_LIMITS = [
  'Modo direto (recomendado): configure VITE_GEMINI_API_KEY — sem Edge Functions do Supabase.',
  'Acesso administrativo completo de leitura: pacientes, consultas, laudos, médicos e usuários.',
  'A IA orienta e sugere ações; o gestor executa manualmente no sistema.',
];

export const MANAGER_ASSISTANT_EXAMPLE_QUESTIONS = [
  'Quais pacientes têm laudos pendentes com diagnóstico e conclusão?',
  'Monte um plano para reduzir cancelamentos desta semana.',
  'Liste consultas de amanhã com telefone e e-mail do paciente.',
  'Compare desempenho por especialidade e sugira redistribuição.',
  'Gere rascunho de SMS para pacientes com laudo liberado hoje.',
  'Quais laudos em rascunho precisam de revisão urgente?',
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
    prompt: 'Resuma as consultas de hoje com totais por status, pacientes e médicos envolvidos.',
    source: 'appointments',
  },
  {
    action: 'weekly_summary',
    label: 'Consultas da semana',
    prompt: 'Resuma o volume de consultas da semana e destaque cancelamentos, pendências e produtividade por médico.',
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
    prompt: 'Liste possíveis faltas ou cancelamentos no período com paciente, médico, contato e data.',
    source: 'appointments',
  },
  {
    action: 'financial_summary',
    label: 'Financeiro do mês',
    prompt: 'Analise indicadores operacionais disponíveis; sugira ações se houver gaps.',
    source: 'financial',
  },
  {
    action: 'doctor_performance',
    label: 'Desempenho médico',
    prompt: 'Compare os médicos por volume de atendimentos, especialidade e status das consultas no período.',
    source: 'doctors',
  },
  {
    action: 'message_draft',
    label: 'Rascunho comunicado',
    prompt: 'Gere um rascunho de comunicado administrativo com base nos dados do período.',
    source: 'patients',
  },
  {
    action: 'admin_pending_tasks',
    label: 'Pendências',
    prompt: 'Liste pendências administrativas prioritárias: laudos, consultas e cadastros.',
    source: 'mixed',
  },
];

export const MANAGER_ASSISTANT_DATA_SOURCES: Array<{
  value: ManagerSearchAssistantSource;
  label: string;
}> = [
  { value: 'mixed', label: 'Visão completa (recomendado)' },
  { value: 'appointments', label: 'Foco em consultas' },
  { value: 'reports', label: 'Foco em laudos' },
  { value: 'patients', label: 'Foco em pacientes' },
  { value: 'doctors', label: 'Foco em médicos' },
  { value: 'financial', label: 'Indicadores operacionais' },
];
