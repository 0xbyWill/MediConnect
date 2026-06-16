import type { Medication, MedicationInteraction, MedicationSearchResult } from '../../types';
import { MEDICATIONS_CATALOG } from '../../shared/constants/medications';
import { getAnvisaById, searchAnvisa } from './providers/anvisa';
import { getBularioById, searchBulario } from './providers/bulario';
import { getOpenFdaById, searchOpenFda } from './providers/openfda';
import {
  dedupeSearchResults,
  normalizeSearchText,
  parseMedicationId,
} from './utils';

function medicationMatchesQuery(medication: Medication, query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return false;
  const names = [
    medication.name,
    medication.activeIngredient,
    ...medication.commercialNames,
  ].map(normalizeSearchText);
  if (names.some(name => name.startsWith(normalized))) return true;
  const haystack = [
    ...names,
    medication.therapeuticClass,
    medication.category,
  ].map(normalizeSearchText).join(' ');
  return haystack.includes(normalized) || normalized.split(/\s+/).every(token => haystack.includes(token));
}

function localMatchScore(medication: Medication, query: string) {
  const normalized = normalizeSearchText(query);
  if (!normalized) return 0;
  const names = [medication.name, medication.activeIngredient, ...medication.commercialNames].map(normalizeSearchText);
  if (names.some(name => name.startsWith(normalized))) return 3;
  if (medicationMatchesQuery(medication, query)) return 1;
  return 0;
}

export function searchLocalMedications(query: string, limit = 12): MedicationSearchResult[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return MEDICATIONS_CATALOG
    .map(medication => ({ medication, score: localMatchScore(medication, trimmed) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.medication.name.localeCompare(b.medication.name))
    .map(item => toSearchResult(item.medication))
    .slice(0, limit);
}

async function searchRemoteMedications(query: string, limit: number) {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [] as MedicationSearchResult[];

  const remoteFetch = Promise.all([
    searchBulario(trimmed, limit).catch(() => [] as MedicationSearchResult[]),
    searchAnvisa(trimmed, limit).catch(() => [] as MedicationSearchResult[]),
    searchOpenFda(trimmed, limit).catch(() => [] as MedicationSearchResult[]),
  ]).then(batches => batches.flat());

  return Promise.race([
    remoteFetch,
    new Promise<MedicationSearchResult[]>(resolve => {
      window.setTimeout(() => resolve([]), 3500);
    }),
  ]);
}

export async function searchMedicationsClient(query: string, limit = 12) {
  const trimmed = query.trim();
  if (!trimmed) return { data: [] as MedicationSearchResult[], warnings: [] as string[] };

  const localResults = searchLocalMedications(trimmed, limit);
  const remoteResults = await searchRemoteMedications(trimmed, limit);
  const data = dedupeSearchResults([...localResults, ...remoteResults], limit);

  return { data, warnings: [] as string[] };
}

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

function findLocalCatalog(nameOrIngredient: string) {
  const normalized = normalizeSearchText(nameOrIngredient);
  return MEDICATIONS_CATALOG.find(medication =>
    normalizeSearchText(medication.name) === normalized ||
    normalizeSearchText(medication.activeIngredient) === normalized ||
    medication.commercialNames.some(commercial => normalizeSearchText(commercial) === normalized)
  ) ?? null;
}

function enrichMedication(medication: Medication): Medication {
  if (medication.dosages.length > 0 && medication.contraindications.absolute.length > 0) {
    return medication;
  }
  const local = findLocalCatalog(medication.name) ?? findLocalCatalog(medication.activeIngredient);
  if (!local) return medication;
  return {
    ...medication,
    dosages: medication.dosages.length ? medication.dosages : local.dosages,
    contraindications: medication.contraindications.absolute.length || medication.contraindications.warnings.length
      ? medication.contraindications
      : local.contraindications,
    interactions: medication.interactions.length ? medication.interactions : local.interactions,
    summary: medication.summary || local.summary,
  };
}

export async function getMedicationClient(id: string) {
  const warnings: string[] = [];
  const { source, externalId } = parseMedicationId(id);

  try {
    if (source === 'bulário') {
      const medication = await getBularioById(externalId);
      if (medication) return { data: enrichMedication(medication), warnings };
    }
    if (source === 'anvisa') {
      const medication = await getAnvisaById(externalId);
      if (medication) return { data: enrichMedication(medication), warnings };
    }
    if (source === 'openfda') {
      const medication = await getOpenFdaById(externalId);
      if (medication) return { data: enrichMedication(medication), warnings };
    }
  } catch (err) {
    warnings.push(`${source}: ${err instanceof Error ? err.message : 'falha ao carregar'}`);
  }

  const local = MEDICATIONS_CATALOG.find(medication =>
    medication.id === id ||
    medication.id === externalId ||
    medication.id === `local:${externalId}`
  );
  if (local) {
    warnings.push('Detalhes complementares do catálogo local.');
    return { data: local, warnings };
  }

  return { data: null, warnings: [...warnings, 'Medicamento não encontrado.'] };
}

function resolveLocalInteractions(medicationIds: string[]) {
  const normalized = new Set(medicationIds.map(id => {
    const parsed = parseMedicationId(id);
    return parsed.externalId.toLowerCase();
  }));
  const interactions: MedicationInteraction[] = [];

  for (const medication of MEDICATIONS_CATALOG) {
    const medKey = (medication.externalId ?? medication.id.replace(/^local:/, '')).toLowerCase();
    if (!normalized.has(medKey) && !normalized.has(medication.id.toLowerCase())) continue;
    for (const interaction of medication.interactions) {
      const otherKey = interaction.medicationAId === medication.id
        ? interaction.medicationBId
        : interaction.medicationAId;
      if (normalized.has(otherKey.toLowerCase()) || medicationIds.includes(otherKey)) {
        interactions.push(interaction);
      }
    }
  }
  return interactions;
}

function dedupeInteractions(items: MedicationInteraction[]) {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = [item.medicationAId, item.medicationBId, item.description].sort().join(':');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function checkMedicationInteractionsClient(medicationIds: string[]) {
  const warnings: string[] = [];
  const meds: Medication[] = [];

  for (const id of medicationIds) {
    const { data, warnings: loadWarnings } = await getMedicationClient(id);
    warnings.push(...loadWarnings);
    if (data) meds.push(data);
  }

  const interactions: MedicationInteraction[] = [];
  const seen = new Set<string>();

  for (const med of meds) {
    for (const interaction of med.interactions) {
      const key = interaction.description;
      if (seen.has(key)) continue;
      seen.add(key);
      interactions.push(interaction);
    }
  }

  interactions.push(...resolveLocalInteractions(medicationIds));
  return { data: dedupeInteractions(interactions), warnings };
}

export function isClientMedicationMode() {
  return String(import.meta.env.VITE_MEDICATION_USE_SUPABASE ?? '').trim().toLowerCase() !== 'true';
}
