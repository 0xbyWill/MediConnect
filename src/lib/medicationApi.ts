import { request } from './httpClient';
import type {
  Medication,
  MedicationDataProvider,
  MedicationInteraction,
  MedicationSearchHistoryItem,
  MedicationSearchResult,
} from '../types';
import {
  MEDICATIONS_CATALOG,
  MEDICATION_SEARCH_HISTORY_KEY,
  MEDICATION_SEARCH_HISTORY_MAX,
} from '../shared/constants/medications';
import {
  checkMedicationInteractionsClient,
  getMedicationClient,
  isClientMedicationMode,
  searchLocalMedications,
  searchMedicationsClient,
} from './medications/aggregator';
import { normalizeSearchText } from './medications/utils';

function toSearchResult(medication: Medication): MedicationSearchResult {
  return {
    id: medication.id,
    name: medication.name,
    activeIngredient: medication.activeIngredient,
    commercialNames: medication.commercialNames,
    therapeuticClass: medication.therapeuticClass,
    category: medication.category,
    source: medication.source ?? 'local',
    externalId: medication.externalId ?? medication.id,
  };
}

interface MedicationLibraryPayload<T> {
  data: T;
  warnings?: string[];
}

const medicationLibraryApi = {
  search: (data: { query: string; limit?: number }) =>
    request<MedicationLibraryPayload<MedicationSearchResult[]>>('/functions/v1/medication-library/search', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  get: (data: { id: string }) =>
    request<MedicationLibraryPayload<Medication | null>>('/functions/v1/medication-library/get', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  interactions: (data: { medicationIds: string[] }) =>
    request<MedicationLibraryPayload<MedicationInteraction[]>>('/functions/v1/medication-library/interactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

/** Provedor 100% local — offline. */
export const localMedicationProvider: MedicationDataProvider = {
  id: 'local',
  async search(query) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const normalized = normalizeSearchText(trimmed);
    return MEDICATIONS_CATALOG
      .filter(medication => {
        const haystack = [
          medication.name,
          medication.activeIngredient,
          ...medication.commercialNames,
        ].map(normalizeSearchText).join(' ');
        return haystack.includes(normalized);
      })
      .map(toSearchResult)
      .slice(0, 12);
  },
  async getById(id) {
    const externalId = id.includes(':') ? id.split(':').slice(1).join(':') : id;
    return MEDICATIONS_CATALOG.find(medication =>
      medication.id === id || medication.id === externalId
    ) ?? null;
  },
  async checkInteractions(medicationIds) {
    const { data } = await checkMedicationInteractionsClient(medicationIds);
    return data;
  },
};

/** Provedor no navegador: Bulário + ANVISA + OpenFDA + catálogo local. */
const clientMedicationProvider: MedicationDataProvider = {
  id: 'local',
  async search(query) {
    const { data } = await searchMedicationsClient(query, 12);
    return data;
  },
  async getById(id) {
    const { data } = await getMedicationClient(id);
    return data;
  },
  async checkInteractions(medicationIds) {
    const { data } = await checkMedicationInteractionsClient(medicationIds);
    return data;
  },
};

/** Provedor via Supabase Edge Function (opcional). */
const supabaseMedicationProvider: MedicationDataProvider = {
  id: 'local',
  async search(query) {
    try {
      const response = await medicationLibraryApi.search({ query, limit: 12 });
      return response.data ?? [];
    } catch {
      return clientMedicationProvider.search(query);
    }
  },
  async getById(id) {
    try {
      const response = await medicationLibraryApi.get({ id });
      return response.data ?? null;
    } catch {
      return clientMedicationProvider.getById(id);
    }
  },
  async checkInteractions(medicationIds) {
    try {
      const response = await medicationLibraryApi.interactions({ medicationIds });
      return response.data ?? [];
    } catch {
      return clientMedicationProvider.checkInteractions!(medicationIds);
    }
  },
};

let activeProvider: MedicationDataProvider = isClientMedicationMode()
  ? clientMedicationProvider
  : supabaseMedicationProvider;

export function setMedicationDataProvider(provider: MedicationDataProvider) {
  activeProvider = provider;
}

export function useLocalMedicationProvider() {
  activeProvider = localMedicationProvider;
}

export function useClientMedicationProvider() {
  activeProvider = clientMedicationProvider;
}

export function useSupabaseMedicationProvider() {
  activeProvider = supabaseMedicationProvider;
}

export function getMedicationDataProvider() {
  return activeProvider;
}

export function isDirectMedicationMode() {
  return isClientMedicationMode();
}

export async function searchMedications(query: string): Promise<MedicationSearchResult[]> {
  return activeProvider.search(query);
}

export { searchLocalMedications };

export async function getMedicationById(id: string): Promise<Medication | null> {
  return activeProvider.getById(id);
}

export async function checkMedicationInteractions(medicationIds: string[]): Promise<MedicationInteraction[]> {
  if (activeProvider.checkInteractions) {
    return activeProvider.checkInteractions(medicationIds);
  }
  const { data } = await checkMedicationInteractionsClient(medicationIds);
  return data;
}

export async function resolveMedicationByName(name: string): Promise<MedicationSearchResult | null> {
  const normalized = normalizeSearchText(name);
  const local = MEDICATIONS_CATALOG.find(medication =>
    normalizeSearchText(medication.name) === normalized ||
    medication.commercialNames.some(commercial => normalizeSearchText(commercial) === normalized) ||
    normalizeSearchText(medication.activeIngredient) === normalized
  );
  if (local) return toSearchResult(local);

  const results = await searchMedications(name);
  return results.find(item =>
    normalizeSearchText(item.name) === normalized ||
    normalizeSearchText(item.activeIngredient) === normalized
  ) ?? results[0] ?? null;
}

export function readMedicationSearchHistory(): MedicationSearchHistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(MEDICATION_SEARCH_HISTORY_KEY) || '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is MedicationSearchHistoryItem =>
        Boolean(item && typeof item === 'object' && 'id' in item && 'name' in item)
      )
      .slice(0, MEDICATION_SEARCH_HISTORY_MAX);
  } catch {
    return [];
  }
}

export function pushMedicationSearchHistory(item: Omit<MedicationSearchHistoryItem, 'searchedAt'>) {
  const current = readMedicationSearchHistory().filter(entry => entry.id !== item.id);
  const next: MedicationSearchHistoryItem[] = [
    { ...item, searchedAt: new Date().toISOString() },
    ...current,
  ].slice(0, MEDICATION_SEARCH_HISTORY_MAX);
  localStorage.setItem(MEDICATION_SEARCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export async function searchMedicationsWithMeta(query: string) {
  if (isClientMedicationMode()) {
    return searchMedicationsClient(query, 12);
  }
  try {
    const response = await medicationLibraryApi.search({ query, limit: 12 });
    return { data: response.data ?? [], warnings: response.warnings ?? [] };
  } catch (err) {
    const fallback = await searchMedicationsClient(query, 12);
    fallback.warnings.unshift(
      err instanceof Error ? `Supabase indisponível: ${err.message}` : 'Supabase indisponível; usando modo direto.',
    );
    return fallback;
  }
}
