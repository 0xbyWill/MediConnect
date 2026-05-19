import type {
  PatientAccessDifficultyInput,
  PatientDependencyInput,
  PatientHealthConditionInput,
  PatientMobilityInput,
  PatientPriorityLevel,
} from '../../types';

export const PATIENT_PRIORITY_LEVELS: Record<PatientPriorityLevel, { label: string; min: number; max: number }> = {
  P1: { label: 'Crítico interno', min: 13, max: Number.POSITIVE_INFINITY },
  P2: { label: 'Muito alta', min: 9, max: 12 },
  P3: { label: 'Alta', min: 6, max: 8 },
  P4: { label: 'Moderada', min: 3, max: 5 },
  P5: { label: 'Rotina', min: 0, max: 2 },
};

export const PATIENT_PRIORITY_SCORE_LIMITS: Array<{ level: PatientPriorityLevel; min: number; max: number }> = [
  { level: 'P1', min: 13, max: Number.POSITIVE_INFINITY },
  { level: 'P2', min: 9, max: 12 },
  { level: 'P3', min: 6, max: 8 },
  { level: 'P4', min: 3, max: 5 },
  { level: 'P5', min: 0, max: 2 },
];

export const PATIENT_PRIORITY_AGE_WEIGHTS = [
  { min: 0, max: 2, score: 3, reason: 'Paciente de 0 a 2 anos' },
  { min: 3, max: 12, score: 2, reason: 'Paciente infantil' },
  { min: 13, max: 59, score: 0, reason: '' },
  { min: 60, max: 69, score: 2, reason: 'Paciente idoso' },
  { min: 70, max: 79, score: 3, reason: 'Paciente idoso com maior prioridade legal' },
  { min: 80, max: Number.POSITIVE_INFINITY, score: 4, reason: 'Paciente com 80 anos ou mais' },
];

export const PATIENT_PRIORITY_MOBILITY_WEIGHTS: Record<PatientMobilityInput, number> = {
  normal: 0,
  mild_limitation: 1,
  uses_support: 2,
  wheelchair: 3,
  bedridden: 4,
  unknown: 0,
};

export const PATIENT_PRIORITY_ACCESS_WEIGHTS: Record<PatientAccessDifficultyInput, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  special_transport_required: 4,
  unknown: 0,
};

export const PATIENT_PRIORITY_DEPENDENCY_WEIGHTS: Record<PatientDependencyInput, number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  total: 4,
  unknown: 0,
};

export const PATIENT_PRIORITY_HEALTH_WEIGHTS: Record<PatientHealthConditionInput, number> = {
  none: 0,
  stable_chronic: 1,
  frequent_followup: 2,
  postoperative_or_functional_limitation: 3,
  alert: 4,
  unknown: 0,
};

export const PATIENT_PRIORITY_LEGAL_PRIORITY_WEIGHT = 1;

export const PATIENT_PRIORITY_SAFETY_MESSAGES = {
  administrativeOnly: 'Prioridade interna para apoio administrativo; não é diagnóstico.',
  humanReview: 'Sinal de alerta exige revisão humana.',
  incompleteData: 'Dados incompletos para cálculo total.',
  noClinicalInference: 'Não inferir condição clínica sem dado real informado.',
};

export const PATIENT_PRIORITY_REASONS = {
  mobility: {
    mild_limitation: 'Mobilidade com pequena limitação',
    uses_support: 'Mobilidade com uso de apoio',
    wheelchair: 'Uso de cadeira de rodas',
    bedridden: 'Paciente acamado ou com dependência total',
  },
  access: {
    low: 'Baixa dificuldade de acesso',
    medium: 'Dificuldade média de acesso',
    high: 'Alta dificuldade de acesso',
    special_transport_required: 'Necessidade de transporte especial',
  },
  dependency: {
    low: 'Baixa dependência de cuidador ou acompanhante',
    medium: 'Dependência média de cuidador ou acompanhante',
    high: 'Alta dependência de cuidador ou acompanhante',
    total: 'Dependência total de cuidador ou acompanhante',
  },
  health: {
    stable_chronic: 'Condição crônica estável informada',
    frequent_followup: 'Necessidade de acompanhamento frequente informada',
    postoperative_or_functional_limitation: 'Pós-operatório ou limitação funcional informada',
    alert: 'Sinal de alerta informado para revisão humana',
  },
};
