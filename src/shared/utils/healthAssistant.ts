import { CHATBOT_EMERGENCY_KEYWORDS } from '../constants/chatbot';

const CLINICAL_ADVICE_PATTERNS = [
  /\b(o que (eu )?tenho|tenho (alguma|que) doença)\b/i,
  /\b(posso tomar|devo tomar|qual rem[eé]dio|que medicamento|me receita)\b/i,
  /\b(dose|dosagem|mg por dia|quantos comprimidos)\b/i,
  /\b(meu laudo significa|interpreta(r)? (meu|esse|este) (laudo|exame|resultado))\b/i,
  /\b(estou com|sinto|tenho) (dor|febre|sintoma|sintomas|mal estar|enjoo|v[oô]mito|diarreia|tontura)\b/i,
  /\b(e normal|é grave|devo me preocupar|isso (e|é) (s[eé]rio|perigoso))\b.*\b(meu|minha|meu laudo|meu exame|minha dor|minha febre)\b/i,
  /\b(diagn[oó]stico|prescri[cç][aã]o|tratamento para (minha|meu|a minha|o meu))\b/i,
  /\b(parei de tomar|substituir|trocar) (o |a )?(rem[eé]dio|medicamento|medicacao|medicação)\b/i,
];

const HEALTH_EDUCATION_PATTERNS = [
  /\b(o que (e|é)|significa|explique|explica)\b.*\b(hemograma|glicemia|colesterol|press[aã]o|ecg|eletro|resson[aâ]ncia|tomografia|creatinina|tsh|pcr|vsg|urina|urocultura)\b/i,
  /\b(como (me )?prepar(o|ar)|preciso (de )?jejum|preparo (para|do) (exame|consulta))\b/i,
  /\b(o que (e|é)|significa)\b.*\b(achados|an[aá]lise|conclus[aã]o|recomenda[cç][oõ]es)\b.*\b(laudo|relat[oó]rio)\b/i,
  /\b(direitos? do paciente|consentimento informado|sigilo m[eé]dico|segunda opini[aã]o)\b/i,
  /\b(s[aá]ude preventiva|vacina(c[aã]o|s)?|check[- ]?up|rastreamento)\b/i,
  /\b(quando (devo|preciso) (procurar|ir ao|ir no|ir na) (m[eé]dico|consulta|pronto socorro|emerg[eê]ncia))\b/i,
  /\b(diferen[cç]a entre|tipos? de) (consulta|exame|especialidade|m[eé]dico)\b/i,
];

const SYSTEM_HEALTH_TERMS = [
  'consulta',
  'exame',
  'laudo',
  'medico',
  'médico',
  'clinica',
  'clínica',
  'hospital',
  'especialidade',
  'hemograma',
  'glicemia',
  'colesterol',
  'pressao',
  'pressão',
  'vacina',
  'preventiva',
  'saude',
  'saúde',
  'preparo',
  'jejum',
  'achados',
  'conclusao',
  'conclusão',
];

export function requiresEmergencyRedirect(message: string): boolean {
  const normalized = message.toLowerCase();
  return CHATBOT_EMERGENCY_KEYWORDS.some(keyword => normalized.includes(keyword));
}

export function isClinicalAdviceRequest(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  return CLINICAL_ADVICE_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isHealthEducationQuestion(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  if (isClinicalAdviceRequest(normalized)) return false;
  return HEALTH_EDUCATION_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isHealthOrSystemQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  return SYSTEM_HEALTH_TERMS.some(term => normalized.includes(term));
}
