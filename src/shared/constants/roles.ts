export type UserRole = 'medico' | 'gestao' | 'secretaria' | 'paciente';

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

export const ROLE_PAGES: Record<UserRole, PageType[]> = {
  medico: ['dashboard', 'pacientes', 'laudos', 'agenda', 'comunicacao', 'relatorios'],
  gestao: ['dashboard', 'pacientes', 'laudos', 'agenda', 'comunicacao', 'relatorios', 'usuarios', 'metricas', 'configuracoes'],
  secretaria: ['dashboard', 'agenda', 'pacientes', 'comunicacao'],
  paciente: ['dashboard', 'agenda', 'laudos', 'comunicacao'],
};
