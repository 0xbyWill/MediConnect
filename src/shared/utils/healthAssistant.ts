import { CHATBOT_EMERGENCY_KEYWORDS } from '../constants/chatbot';

const CLINICAL_ADVICE_PATTERNS = [
  /\b(o que (eu )?tenho|tenho (alguma|que) doença)\b/i,
  /\b(posso tomar|devo tomar|qual rem[eé]dio|que medicamento|me receita)\b/i,
  /\b(dose|dosagem|mg por dia|quantos comprimidos)\b/i,
  /\b(meu laudo significa|interpreta(r)? (meu|esse|este) (laudo|exame|resultado))\b/i,
  /\b(estou com|sinto|tenho) (dor|febre|sintoma|sintomas|mal estar|enjoo|v[oô]mito|diarreia|tontura)\b/i,
  /\b(estou com|sinto|tenho)\b/i,
  /\b(formig|dormenc|coceira|inchad|fraqueza|mal[- ]estar|cansad)\b/i,
  /\b(minha|meu|minhas|meus)\s+(perna|pernas|bra[çc]o|bra[çc]os|cabe[çc]a|costas|barriga|coluna|m[aã]o|m[aã]os|p[eé]|p[eé]s|corpo)\b/i,
  /\b(dor no peito|dor de peito|dor tor[aá]cica|dor abdominal|dor de cabe[cç]a|falta de ar)\b/i,
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

/** Perguntas educativas gerais sobre saúde (ex.: "o que é bronquite", "explique diabetes"). */
const GENERAL_HEALTH_EDUCATION_PATTERNS = [
  /\b(o que (e|é)|o que (são|sao)|significa|explique|explica|me fala sobre|fale sobre|conte sobre|o que causa)\b/i,
  /\b(como funciona|quais (são|sao) (os )?(sintomas|causas|tipos|fatores|riscos|efeitos|sinais)|para que serve)\b/i,
  /\b(diferen[cç]a entre|tipos? de)\b/i,
];

const NON_HEALTH_TOPIC_TERMS = [
  'mediconnect',
  'panaceia',
  'senha',
  'login',
  'cadastro',
  'aplicativo',
  'whatsapp',
  'instagram',
  'facebook',
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
  'doenca',
  'doença',
  'sintoma',
  'sintomas',
  'condicao',
  'condição',
  'virus',
  'vírus',
  'bacteria',
  'bactéria',
  'infec',
  'alergia',
  'tratamento',
  'prevencao',
  'prevenção',
  'bronquite',
  'asma',
  'diabetes',
  'hipertens',
  'gripe',
  'covid',
  'cancer',
  'câncer',
];

export function requiresEmergencyRedirect(message: string): boolean {
  const normalized = message.toLowerCase();
  return CHATBOT_EMERGENCY_KEYWORDS.some(keyword => normalized.includes(keyword));
}

/** Relato pessoal de sintomas, medicação ou pedido de diagnóstico — orientar, não bloquear. */
export function isPersonalHealthConcern(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  return CLINICAL_ADVICE_PATTERNS.some(pattern => pattern.test(normalized));
}

/** @deprecated Use isPersonalHealthConcern */
export function isClinicalAdviceRequest(message: string): boolean {
  return isPersonalHealthConcern(message);
}

export function isHealthEducationQuestion(message: string): boolean {
  const normalized = message.trim();
  if (!normalized) return false;
  if (HEALTH_EDUCATION_PATTERNS.some(pattern => pattern.test(normalized))) return true;

  const lower = normalized.toLowerCase();
  const isGeneralHealthEducation = GENERAL_HEALTH_EDUCATION_PATTERNS.some(pattern => pattern.test(normalized));
  if (!isGeneralHealthEducation) return false;
  if (NON_HEALTH_TOPIC_TERMS.some(term => lower.includes(term))) return false;

  return true;
}

export function shouldRouteToHealthAssistant(message: string): boolean {
  return (
    requiresEmergencyRedirect(message) ||
    isPersonalHealthConcern(message) ||
    isHealthEducationQuestion(message) ||
    isHealthOrSystemQuestion(message)
  );
}

export function isHealthOrSystemQuestion(message: string): boolean {
  const normalized = message.toLowerCase();
  return SYSTEM_HEALTH_TERMS.some(term => normalized.includes(term));
}
