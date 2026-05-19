export type UserRole = 'medico' | 'gestao' | 'secretaria' | 'paciente';

export type PageType =
  | 'dashboard'
  | 'pacientes'
  | 'agenda'
  | 'registro'
  | 'laudos'
  | 'comunicacao'
  | 'mensagens'
  | 'relatorios'
  | 'usuarios'
  | 'metricas'
  | 'ia'
  | 'configuracoes';

export const ROLE_PAGES: Record<UserRole, PageType[]> = {
  medico: ['dashboard', 'pacientes', 'laudos', 'agenda', 'relatorios'],
  gestao: ['dashboard', 'pacientes', 'laudos', 'agenda', 'comunicacao', 'mensagens', 'relatorios', 'usuarios', 'metricas', 'ia', 'configuracoes'],
  secretaria: ['dashboard', 'agenda', 'pacientes', 'comunicacao', 'mensagens'],
  paciente: ['dashboard', 'registro', 'agenda', 'laudos', 'mensagens'],
};
