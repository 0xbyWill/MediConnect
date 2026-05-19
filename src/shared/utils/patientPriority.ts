import type {
  NormalizedPatientPriorityInput,
  Paciente,
  PatientAccessDifficultyInput,
  PatientDependencyInput,
  PatientHealthConditionInput,
  PatientMobilityInput,
  PatientPriorityLevel,
  PatientPriorityResult,
} from '../../types';
import {
  PATIENT_PRIORITY_ACCESS_WEIGHTS,
  PATIENT_PRIORITY_AGE_WEIGHTS,
  PATIENT_PRIORITY_DEPENDENCY_WEIGHTS,
  PATIENT_PRIORITY_HEALTH_WEIGHTS,
  PATIENT_PRIORITY_LEGAL_PRIORITY_WEIGHT,
  PATIENT_PRIORITY_MOBILITY_WEIGHTS,
  PATIENT_PRIORITY_REASONS,
  PATIENT_PRIORITY_SAFETY_MESSAGES,
  PATIENT_PRIORITY_SCORE_LIMITS,
} from '../constants/patientPriority';

export function calculatePatientPriority(patient: Paciente): PatientPriorityResult {
  const score = calculatePriorityScore(patient);
  const normalized = normalizePriorityInput(patient);
  return {
    level: getPriorityLevel(score, patient),
    score,
    reasons: getPriorityReasons(patient),
    requiresHumanReview: normalized.hasCriticalAlert || normalized.healthCondition === 'alert',
  };
}

export function calculatePriorityScore(patient: Paciente): number {
  const normalized = normalizePriorityInput(patient);
  return (
    getAgeWeight(normalized.age).score +
    PATIENT_PRIORITY_MOBILITY_WEIGHTS[normalized.mobility] +
    PATIENT_PRIORITY_ACCESS_WEIGHTS[normalized.accessDifficulty] +
    PATIENT_PRIORITY_DEPENDENCY_WEIGHTS[normalized.dependency] +
    PATIENT_PRIORITY_HEALTH_WEIGHTS[normalized.healthCondition] +
    (normalized.hasLegalPriority ? PATIENT_PRIORITY_LEGAL_PRIORITY_WEIGHT : 0)
  );
}

export function getPriorityLevel(score: number, patient?: Paciente): PatientPriorityLevel {
  if (patient && hasCriticalAlert(patient)) return 'P1';
  return PATIENT_PRIORITY_SCORE_LIMITS.find(limit => score >= limit.min && score <= limit.max)?.level ?? 'P5';
}

export function getPriorityReasons(patient: Paciente): string[] {
  const normalized = normalizePriorityInput(patient);
  const reasons: string[] = [];
  const ageWeight = getAgeWeight(normalized.age);

  if (ageWeight.reason) reasons.push(ageWeight.reason);
  if (normalized.hasLegalPriority) reasons.push('Prioridade legal identificada');
  if (normalized.mobility !== 'normal' && normalized.mobility !== 'unknown') {
    reasons.push(PATIENT_PRIORITY_REASONS.mobility[normalized.mobility]);
  }
  if (normalized.accessDifficulty !== 'none' && normalized.accessDifficulty !== 'unknown') {
    reasons.push(PATIENT_PRIORITY_REASONS.access[normalized.accessDifficulty]);
  }
  if (normalized.dependency !== 'none' && normalized.dependency !== 'unknown') {
    reasons.push(PATIENT_PRIORITY_REASONS.dependency[normalized.dependency]);
  }
  if (normalized.healthCondition !== 'none' && normalized.healthCondition !== 'unknown') {
    reasons.push(PATIENT_PRIORITY_REASONS.health[normalized.healthCondition]);
  }
  if (normalized.hasCriticalAlert) reasons.push(PATIENT_PRIORITY_SAFETY_MESSAGES.humanReview);
  if (normalized.hasIncompleteData) reasons.push(PATIENT_PRIORITY_SAFETY_MESSAGES.incompleteData);

  return Array.from(new Set(reasons));
}

export function hasCriticalAlert(patient: Paciente): boolean {
  const text = [
    patient.alertasCriticos,
    patient.observacoesClinicas,
    patient.condicaoSaudePrincipal,
    patient.integridadeFisica,
    patient.urgenciaTerapeutica,
  ].filter(Boolean).join(' ').toLowerCase();

  return [
    'alerta',
    'crítico',
    'critico',
    'piora recente',
    'risco de queda',
    'risco imediato',
    'alto risco',
    'sangramento',
    'imobilidade',
  ].some(term => text.includes(term));
}

export function normalizePriorityInput(patient: Paciente): NormalizedPatientPriorityInput {
  const age = calculateAge(patient.dataNasc);
  const mobility = normalizeMobility(patient.mobilidade);
  const dependency = normalizeDependency(patient.dependenciaFuncional);
  const accessDifficulty = normalizeAccessDifficulty(patient);
  const healthCondition = normalizeHealthCondition(patient);
  const hasLegalPriority = Boolean(patient.vip || (age !== null && (age < 13 || age >= 60)));
  const hasIncompleteData = [
    patient.dataNasc,
    patient.mobilidade,
    patient.dependenciaFuncional,
    patient.condicaoSaudePrincipal ?? patient.condicaoSaudePontuacao,
  ].some(value => !String(value ?? '').trim());

  return {
    age,
    mobility,
    accessDifficulty,
    dependency,
    healthCondition,
    hasLegalPriority,
    hasCriticalAlert: hasCriticalAlert(patient),
    hasIncompleteData,
    locationKey: normalizeLocationKey(patient),
  };
}

function calculateAge(value?: string): number | null {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

function getAgeWeight(age: number | null) {
  if (age === null) return { score: 0, reason: '' };
  return PATIENT_PRIORITY_AGE_WEIGHTS.find(item => age >= item.min && age <= item.max) ?? { score: 0, reason: '' };
}

function normalizeMobility(value?: string): PatientMobilityInput {
  const text = normalizeText(value);
  if (!text) return 'unknown';
  if (matches(text, ['acamado', 'dependente total', 'quase total'])) return 'bedridden';
  if (matches(text, ['cadeira de rodas', 'wheelchair'])) return 'wheelchair';
  if (matches(text, ['apoio', 'ajuda ocasional', 'muleta', 'andador'])) return 'uses_support';
  if (matches(text, ['pequena dificuldade', 'leve', 'limitação leve', 'limitacao leve'])) return 'mild_limitation';
  if (matches(text, ['independente', 'normal', 'sem limitação', 'sem limitacao'])) return 'normal';
  return 'unknown';
}

function normalizeDependency(value?: string): PatientDependencyInput {
  const text = normalizeText(value);
  if (!text) return 'unknown';
  if (matches(text, ['total', 'quase total', 'acamado'])) return 'total';
  if (matches(text, ['frequente', 'alta', 'severa'])) return 'high';
  if (matches(text, ['moderada', 'média', 'media', 'parcial'])) return 'medium';
  if (matches(text, ['pequena', 'baixa', 'ocasional', 'leve'])) return 'low';
  if (matches(text, ['independente', 'normal', 'nenhuma', 'sem'])) return 'none';
  return 'unknown';
}

function normalizeAccessDifficulty(patient: Paciente): PatientAccessDifficultyInput {
  const text = normalizeText([
    patient.viabilidadeComparecimento,
    patient.disponibilidadeEncaixe,
    patient.tempoMinimoChegar,
    patient.tempoDeslocamento,
    patient.cidade,
    patient.estado,
    patient.referencia,
  ].filter(Boolean).join(' '));

  const arrival = numericValue(patient.tempoMinimoChegar);
  const travel = numericValue(patient.tempoDeslocamento);

  if (matches(text, ['transporte especial', 'ambulância', 'ambulancia', 'remoção', 'remocao'])) return 'special_transport_required';
  if ((arrival !== null && arrival > 180) || (travel !== null && travel > 120)) return 'high';
  if ((arrival !== null && arrival > 90) || (travel !== null && travel > 60)) return 'medium';
  if ((arrival !== null && arrival > 45) || (travel !== null && travel > 30)) return 'low';
  if (matches(text, ['não consegue comparecer', 'nao consegue comparecer', 'baixa chance'])) return 'high';
  if (matches(text, ['chance incerta'])) return 'medium';
  if (matches(text, ['boa chance', 'alta disponibilidade', 'imediata'])) return 'none';
  return text ? 'low' : 'unknown';
}

function normalizeHealthCondition(patient: Paciente): PatientHealthConditionInput {
  const text = normalizeText([
    patient.condicaoSaudePrincipal,
    patient.condicaoSaudePontuacao,
    patient.comorbidades,
    patient.integridadeFisica,
    patient.urgenciaTerapeutica,
    patient.observacoesClinicas,
    patient.alertasCriticos,
  ].filter(Boolean).join(' '));

  if (!text) return 'unknown';
  if (hasCriticalAlert(patient) || matches(text, ['instável', 'instavel', 'piora recente', 'alerta', 'alto risco'])) return 'alert';
  if (matches(text, ['pós-operatório', 'pos-operatorio', 'pós operatorio', 'limitação funcional', 'limitacao funcional', 'risco de piora'])) {
    return 'postoperative_or_functional_limitation';
  }
  if (matches(text, ['acompanhamento frequente', 'frequente', 'doença crônica com impacto', 'doenca cronica com impacto'])) return 'frequent_followup';
  if (matches(text, ['controlada', 'crônica estável', 'cronica estavel', 'leve'])) return 'stable_chronic';
  if (matches(text, ['sem doença', 'sem doenca', 'sem condição', 'sem condicao'])) return 'none';
  return 'stable_chronic';
}

function normalizeLocationKey(patient: Paciente): string {
  return [patient.cidade, patient.estado].filter(Boolean).join('/').trim() || 'Localização não informada';
}

function numericValue(value?: string): number | null {
  const match = String(value ?? '').match(/\d+/);
  if (!match) return null;
  const number = Number(match[0]);
  return Number.isFinite(number) ? number : null;
}

function normalizeText(value?: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function matches(text: string, terms: string[]) {
  return terms.some(term => text.includes(normalizeText(term)));
}
