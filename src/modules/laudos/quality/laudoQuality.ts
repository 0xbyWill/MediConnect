import type { Laudo, Paciente } from '../../../types';

export type LaudoAgentId =
  | 'domain-specialist'
  | 'critical-reviewer'
  | 'professional-writing'
  | 'compliance-security'
  | 'standardization'
  | 'final-validation';

export type LaudoQualitySeverity = 'critical' | 'warning' | 'info';

export interface LaudoQualityIssue {
  agent: LaudoAgentId;
  severity: LaudoQualitySeverity;
  title: string;
  message: string;
}

export interface LaudoQualityReview {
  score: number;
  canApprove: boolean;
  issues: LaudoQualityIssue[];
  missingSections: string[];
}

interface ReviewInput {
  laudo: Partial<Laudo>;
  paciente?: Partial<Paciente>;
  html: string;
}

const REQUIRED_SECTIONS = ['achados', 'analise', 'conclusao', 'recomendacoes'];
const VAGUE_TERMS = ['normal', 'bom estado geral', 'sem alteracoes', 'sem queixas', 'satisfatorio'];
const OPTIONAL_PLACEHOLDERS = new Set(['[CID]']);
const SENSITIVE_PATTERNS = [
  /\btoken\b/i,
  /\bsenha\b/i,
  /\bsecret\b/i,
  /\bapi[_ -]?key\b/i,
  /\bcart[aã]o\b/i,
];

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function hasSection(text: string, section: string) {
  return new RegExp(`\\b${section}\\b\\s*:`, 'i').test(text);
}

function add(issues: LaudoQualityIssue[], issue: LaudoQualityIssue) {
  issues.push(issue);
}

export function reviewLaudoQuality(input: ReviewInput): LaudoQualityReview {
  const issues: LaudoQualityIssue[] = [];
  const text = htmlToPlainText(input.html);
  const lowerText = text.toLowerCase();
  const missingSections = REQUIRED_SECTIONS.filter(section => !hasSection(lowerText, section));
  const unresolvedPlaceholders = Array.from(new Set(text.match(/\[[A-Z0-9_/\s.-]+\]/g) ?? []))
    .filter(placeholder => !OPTIONAL_PLACEHOLDERS.has(placeholder));

  if (!input.laudo.pacienteId) {
    add(issues, {
      agent: 'final-validation',
      severity: 'critical',
      title: 'Paciente ausente',
      message: 'Selecione um paciente antes de salvar ou liberar o laudo.',
    });
  }

  if (!input.laudo.exame?.trim()) {
    add(issues, {
      agent: 'standardization',
      severity: 'info',
      title: 'Título do exame ausente',
      message: 'O sistema usará um título padrão se o exame não for informado.',
    });
  }

  if (text.length < 80) {
    add(issues, {
      agent: 'domain-specialist',
      severity: 'warning',
      title: 'Conteúdo insuficiente',
      message: 'O texto está curto. Revise se há informações suficientes antes de liberar.',
    });
  }

  if (unresolvedPlaceholders.length > 0) {
    add(issues, {
      agent: 'critical-reviewer',
      severity: 'warning',
      title: 'Campos pendentes no texto',
      message: `Ainda existem placeholders editáveis no texto: ${unresolvedPlaceholders.slice(0, 6).join(', ')}.`,
    });
  }

  if (missingSections.length > 0) {
    add(issues, {
      agent: 'standardization',
      severity: 'warning',
      title: 'Estrutura incompleta',
      message: `Inclua ou renomeie seções para manter o padrão: ${missingSections.join(', ')}.`,
    });
  }

  const hasConclusion = hasSection(lowerText, 'conclusao') || lowerText.includes('diagnostico');
  const hasEvidence = hasSection(lowerText, 'achados') || hasSection(lowerText, 'analise') || hasSection(lowerText, 'exames');
  if (hasConclusion && !hasEvidence) {
    add(issues, {
      agent: 'critical-reviewer',
      severity: 'warning',
      title: 'Conclusão sem evidência explícita',
      message: 'Inclua achados, análise ou exames que sustentem a conclusão registrada.',
    });
  }

  if (VAGUE_TERMS.some(term => lowerText.includes(term)) && !hasEvidence) {
    add(issues, {
      agent: 'professional-writing',
      severity: 'warning',
      title: 'Linguagem possivelmente vaga',
      message: 'Termos como normal ou satisfatório devem estar acompanhados de achados objetivos.',
    });
  }

  if (input.laudo.cid && lowerText.includes(String(input.laudo.cid).toLowerCase())) {
    add(issues, {
      agent: 'compliance-security',
      severity: 'warning',
      title: 'CID no corpo do laudo',
      message: 'Confirme se há consentimento ou justificativa legal antes de expor CID no documento.',
    });
  }

  if (SENSITIVE_PATTERNS.some(pattern => pattern.test(text))) {
    add(issues, {
      agent: 'compliance-security',
      severity: 'warning',
      title: 'Possível dado sensível indevido',
      message: 'Revise se há tokens, senhas, chaves ou dados financeiros no texto do laudo.',
    });
  }

  if (!input.paciente?.dataNasc) {
    add(issues, {
      agent: 'final-validation',
      severity: 'info',
      title: 'Nascimento não informado',
      message: 'A idade pode ficar ausente no documento se a data de nascimento não estiver cadastrada.',
    });
  }

  const criticalCount = issues.filter(issue => issue.severity === 'critical').length;
  const warningCount = issues.filter(issue => issue.severity === 'warning').length;
  const score = Math.max(0, 100 - criticalCount * 30 - warningCount * 10 - missingSections.length * 3);

  return {
    score,
    canApprove: criticalCount === 0,
    issues,
    missingSections,
  };
}
