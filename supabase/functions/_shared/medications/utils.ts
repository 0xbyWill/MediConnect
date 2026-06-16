import type { MedicationInteractionSeverity, MedicationProviderId } from './types.ts';

const ANVISA_CONSULTAS_BASE = 'https://consultas.anvisa.gov.br';

export function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function buildMedicationId(source: MedicationProviderId, externalId: string) {
  return `${source}:${externalId}`;
}

export function parseMedicationId(id: string): { source: MedicationProviderId; externalId: string } {
  const separator = id.indexOf(':');
  if (separator <= 0) return { source: 'local', externalId: id };
  const source = id.slice(0, separator) as MedicationProviderId;
  return { source, externalId: id.slice(separator + 1) };
}

export function anvisaConsultasHeaders() {
  return {
    accept: 'application/json, text/plain, */*',
    authorization: 'Guest',
    'content-type': 'application/json',
    referer: `${ANVISA_CONSULTAS_BASE}/`,
  };
}

export function serializeParams(params: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    const nextKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(serializeParams(value as Record<string, unknown>, nextKey));
      continue;
    }
    parts.push(`${encodeURIComponent(nextKey)}=${encodeURIComponent(String(value))}`);
  }
  return parts.filter(Boolean).join('&');
}

export async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ao consultar ${new URL(url).hostname}`);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

export function firstString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    const item = value.find(entry => typeof entry === 'string' && entry.trim());
    return typeof item === 'string' ? item.trim() : '';
  }
  return '';
}

export function splitLabelSections(text: string, maxItems = 6) {
  return text
    .split(/\n+/)
    .map(item => item.replace(/^[\s\-*•]+/, '').trim())
    .filter(item => item.length > 12)
    .slice(0, maxItems);
}

export function classifyInteractionSeverity(text: string): MedicationInteractionSeverity {
  const normalized = normalizeSearchText(text);
  if (/(contraindic|nao utilizar|nao usar|evitar|grave|risco de morte|anafilax)/.test(normalized)) return 'grave';
  if (/(moderad|monitor|ajust|cuidado|atenção|atencao)/.test(normalized)) return 'moderada';
  return 'leve';
}

export function dedupeSearchResults<T extends { id: string; name: string; activeIngredient: string }>(items: T[], limit: number) {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = `${normalizeSearchText(item.name)}|${normalizeSearchText(item.activeIngredient)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

export function emptyContraindications() {
  return { absolute: [] as string[], relative: [] as string[], warnings: [] as string[] };
}

export function emptyDosages() {
  return [] as Array<{
    population: 'adultos' | 'pediatrico' | 'idosos' | 'gestantes';
    usualDose: string;
    frequency: string;
    maxDose: string;
    notes?: string;
  }>;
}
