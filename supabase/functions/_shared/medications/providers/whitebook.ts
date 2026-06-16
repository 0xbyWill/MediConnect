import type { Medication, MedicationProvider, MedicationSearchResult } from '../types.ts';
import { buildMedicationId, emptyContraindications, emptyDosages, fetchJson, firstString } from '../utils.ts';

type WhitebookSearchResponse = {
  data?: Array<Record<string, unknown>>;
  results?: Array<Record<string, unknown>>;
};

function baseUrl() {
  return (Deno.env.get('WHITEBOOK_API_BASE') ?? 'https://api.whitebook.com.br').replace(/\/+$/, '');
}

function apiKey() {
  return Deno.env.get('WHITEBOOK_API_KEY')?.trim() ?? '';
}

function authHeaders() {
  const key = apiKey();
  if (!key) throw new Error('WHITEBOOK_API_KEY não configurada.');
  return {
    accept: 'application/json',
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  };
}

function mapSearchItem(item: Record<string, unknown>, index: number): MedicationSearchResult {
  const externalId = firstString(item.id) || firstString(item.code) || String(index);
  const name = firstString(item.title) || firstString(item.commercialName) || firstString(item.name) || 'Medicamento Whitebook';
  const activeIngredient = firstString(item.activeIngredient) || firstString(item.substance) || name;
  return {
    id: buildMedicationId('whitebook', externalId),
    name,
    activeIngredient,
    commercialNames: [firstString(item.commercialName) || name],
    therapeuticClass: firstString(item.therapeuticClass) || 'Whitebook',
    category: firstString(item.category) || 'Medicamento',
    source: 'whitebook',
    externalId,
  };
}

function mapDetail(item: Record<string, unknown>, externalId: string): Medication {
  const name = firstString(item.title) || firstString(item.commercialName) || externalId;
  const activeIngredient = firstString(item.activeIngredient) || firstString(item.substance) || name;
  return {
    id: buildMedicationId('whitebook', externalId),
    name,
    activeIngredient,
    commercialNames: [firstString(item.commercialName) || name],
    therapeuticClass: firstString(item.therapeuticClass) || 'Whitebook',
    category: firstString(item.category) || 'Medicamento',
    presentations: Array.isArray(item.presentations) ? item.presentations.map(String) : [],
    manufacturers: firstString(item.manufacturer) ? [firstString(item.manufacturer)] : undefined,
    summary: firstString(item.summary) || firstString(item.description) || 'Informações obtidas via Whitebook.',
    dosages: emptyDosages(),
    contraindications: emptyContraindications(),
    interactions: [],
    source: 'whitebook',
    externalId,
  };
}

export const whitebookProvider: MedicationProvider = {
  id: 'whitebook',
  isConfigured: () => Boolean(apiKey()),
  async search(query, limit) {
    if (!apiKey()) return [];
    const url = `${baseUrl()}/v1/medications/search?q=${encodeURIComponent(query.trim())}&limit=${Math.min(limit, 12)}`;
    const data = await fetchJson<WhitebookSearchResponse>(url, { headers: authHeaders() });
    const rows = data.data ?? data.results ?? [];
    return rows.map(mapSearchItem).slice(0, limit);
  },
  async getById(externalId) {
    if (!apiKey()) return null;
    const url = `${baseUrl()}/v1/medications/${encodeURIComponent(externalId)}`;
    const data = await fetchJson<Record<string, unknown>>(url, { headers: authHeaders() });
    return mapDetail(data, externalId);
  },
};
