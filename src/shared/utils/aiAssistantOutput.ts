import type { AiChartSpec, AiGeneratedFile, AiStructuredResponse } from '../../types';

type DownloadType = AiGeneratedFile['type'];

export function parseAiStructuredResponse(text: string): AiStructuredResponse {
  const trimmed = text.trim();
  const parsed = parseJsonObject(trimmed);
  if (parsed) {
    return normalizeStructured(parsed, trimmed);
  }

  const sections = splitTextSections(trimmed);
  return {
    summary: sections.resumo?.join('\n') || firstParagraph(trimmed) || 'Resposta gerada sem resumo estruturado.',
    indicators: sections.indicadores,
    insights: sections.tendencias || sections.insights,
    risks: sections.riscos,
    recommendations: sections.recomendacoes,
    observations: sections.observacoes,
    rawText: trimmed,
  };
}

export function createDownloadFile(file: AiGeneratedFile) {
  const mime: Record<DownloadType, string> = {
    txt: 'text/plain;charset=utf-8',
    csv: 'text/csv;charset=utf-8',
    json: 'application/json;charset=utf-8',
  };
  const blob = new Blob([file.content], { type: mime[file.type] });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function generateCsvContent(rows: Array<Record<string, string | number>>) {
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [
    headers.join(','),
    ...rows.map(row => headers.map(header => escapeCell(row[header])).join(',')),
  ].join('\n');
}

export function buildGeneratedFiles(params: {
  response: AiStructuredResponse;
  fallbackName: string;
  charts: AiChartSpec[];
}) {
  const date = new Date().toISOString().slice(0, 10);
  const base = sanitizeFileName(`${date}-${params.fallbackName}`);
  const files: AiGeneratedFile[] = [
    {
      id: 'txt-report',
      name: `${base}.txt`,
      type: 'txt',
      content: structuredToText(params.response),
    },
    {
      id: 'json-report',
      name: `${base}.json`,
      type: 'json',
      content: JSON.stringify({ ...params.response, charts: params.charts }, null, 2),
    },
  ];

  const firstChartWithData = params.charts.find(chart => chart.data.length > 0);
  if (firstChartWithData) {
    files.push({
      id: 'csv-chart',
      name: `${base}-${sanitizeFileName(firstChartWithData.title)}.csv`,
      type: 'csv',
      content: generateCsvContent(firstChartWithData.data),
    });
  }

  return [...files, ...(params.response.files ?? [])];
}

export function supportsSpeechRecognition() {
  return Boolean(getSpeechRecognitionCtor());
}

export function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

export function normalizeAiChartData(charts: AiChartSpec[] = []) {
  return charts
    .filter(chart => chart.id && chart.title && Array.isArray(chart.data) && chart.data.length > 0)
    .map(chart => ({
      ...chart,
      data: chart.data
        .map(row => Object.fromEntries(
          Object.entries(row).filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        ) as Record<string, string | number>)
        .filter(row => Object.keys(row).length > 0),
    }))
    .filter(chart => chart.data.length > 0);
}

function parseJsonObject(text: string) {
  const direct = tryParse(text);
  if (direct) return direct;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return tryParse(fenced);
  const object = text.match(/\{[\s\S]*\}/)?.[0];
  return object ? tryParse(object) : null;
}

function tryParse(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function normalizeStructured(parsed: Record<string, unknown>, rawText: string): AiStructuredResponse {
  return {
    summary: stringValue(parsed.summary) || stringValue(parsed.resumo) || firstParagraph(rawText) || 'Resumo não informado.',
    indicators: stringArray(parsed.indicators ?? parsed.indicadores),
    insights: stringArray(parsed.insights ?? parsed.tendencias),
    risks: stringArray(parsed.risks ?? parsed.riscos),
    recommendations: stringArray(parsed.recommendations ?? parsed.recomendacoes),
    observations: stringArray(parsed.observations ?? parsed.observacoes),
    charts: normalizeAiChartData(Array.isArray(parsed.charts) ? parsed.charts as AiChartSpec[] : []),
    files: Array.isArray(parsed.files) ? parsed.files as AiGeneratedFile[] : [],
    rawText,
  };
}

function splitTextSections(text: string) {
  const sections: Record<string, string[]> = {};
  let current = 'resumo';
  text.split('\n').forEach(line => {
    const clean = line.replace(/^[-*#\s]+/, '').trim();
    const key = normalizeHeader(clean.replace(/:$/, ''));
    if (['resumo', 'indicadores', 'tendencias', 'insights', 'riscos', 'recomendacoes', 'observacoes'].includes(key)) {
      current = key;
      sections[current] ??= [];
      return;
    }
    if (clean) {
      sections[current] ??= [];
      sections[current].push(clean);
    }
  });
  return sections;
}

function normalizeHeader(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function firstParagraph(text: string) {
  return text.split(/\n{2,}/).map(item => item.trim()).find(Boolean) ?? '';
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const items = value.map(item => String(item).trim()).filter(Boolean);
  return items.length ? items : undefined;
}

function structuredToText(response: AiStructuredResponse) {
  const block = (title: string, items?: string[]) => items?.length ? `\n${title}\n${items.map(item => `- ${item}`).join('\n')}` : '';
  return [
    `Resumo\n${response.summary}`,
    block('Indicadores', response.indicators),
    block('Tendências', response.insights),
    block('Riscos', response.risks),
    block('Recomendações', response.recommendations),
    block('Observações', response.observations),
    response.rawText && response.rawText !== response.summary ? `\nTexto original\n${response.rawText}` : '',
  ].filter(Boolean).join('\n');
}

function sanitizeFileName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface SpeechRecognitionErrorEvent {
  error?: string;
}
