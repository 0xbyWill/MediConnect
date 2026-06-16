export type UserRole = 'medico' | 'gestao' | 'secretaria' | 'paciente';

export type PageType =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'fila-prioridade'
  | 'registro'
  | 'laudos'
  | 'comunicacao'
  | 'mensagens'
  | 'relatorios'
  | 'usuarios'
  | 'metricas'
  | 'ia'
  | 'biblioteca-farmacologica'
  | 'configuracoes';

export const ROLE_PAGES: Record<UserRole, PageType[]> = {
  medico: ['dashboard', 'pacientes', 'laudos', 'agenda', 'relatorios', 'biblioteca-farmacologica'],
  gestao: ['dashboard', 'pacientes', 'laudos', 'agenda', 'fila-prioridade', 'comunicacao', 'mensagens', 'relatorios', 'usuarios', 'metricas', 'ia', 'biblioteca-farmacologica', 'configuracoes'],
  secretaria: ['dashboard', 'agenda', 'pacientes', 'fila-prioridade', 'comunicacao', 'mensagens'],
  paciente: ['dashboard', 'registro', 'agenda', 'laudos', 'mensagens'],
};
