import type {
  Medication,
  MedicationInteraction,
  MedicationProvider,
  MedicationProviderId,
  MedicationSearchResult,
} from './types.ts';
import { dedupeSearchResults, parseMedicationId } from './utils.ts';
import { anvisaProvider } from './providers/anvisa.ts';
import { bularioProvider } from './providers/bulario.ts';
import { localMedicationProvider, resolveLocalByName, resolveLocalInteractions } from './providers/local.ts';
import { openFdaProvider } from './providers/openfda.ts';
import { whitebookProvider } from './providers/whitebook.ts';

const ALL_PROVIDERS: MedicationProvider[] = [
  bularioProvider,
  anvisaProvider,
  openFdaProvider,
  whitebookProvider,
  localMedicationProvider,
];

const PROVIDER_MAP = new Map<MedicationProviderId, MedicationProvider>(
  ALL_PROVIDERS.map(provider => [provider.id, provider]),
);

const DEFAULT_PROVIDER_ORDER: MedicationProviderId[] = ['bulário', 'anvisa', 'openfda', 'whitebook', 'local'];

export function listConfiguredProviders(requested?: MedicationProviderId[]) {
  const order = requested?.length ? requested : DEFAULT_PROVIDER_ORDER;
  return order
    .map(id => PROVIDER_MAP.get(id))
    .filter((provider): provider is MedicationProvider => Boolean(provider));
}

export async function aggregateSearch(query: string, providers?: MedicationProviderId[], limit = 12) {
  const warnings: string[] = [];
  const configured = listConfiguredProviders(providers);
  const providersUsed: MedicationProviderId[] = [];
  const batches = await Promise.all(configured.map(async provider => {
    if (provider.id === 'whitebook' && !provider.isConfigured()) {
      warnings.push('Whitebook não configurado (WHITEBOOK_API_KEY ausente).');
      return [] as MedicationSearchResult[];
    }
    try {
      const results = await provider.search(query, limit);
      if (results.length > 0) providersUsed.push(provider.id);
      return results;
    } catch (err) {
      warnings.push(`${provider.id}: ${err instanceof Error ? err.message : 'falha na consulta'}`);
      return [] as MedicationSearchResult[];
    }
  }));

  const data = dedupeSearchResults(batches.flat(), limit);
  if (data.length === 0 && warnings.length === 0) {
    warnings.push('Nenhum medicamento encontrado nos provedores consultados.');
  }
  return { data, warnings, providersUsed };
}

export async function aggregateGetById(id: string) {
  const { source, externalId } = parseMedicationId(id);
  const provider = PROVIDER_MAP.get(source) ?? localMedicationProvider;
  const warnings: string[] = [];

  try {
    const medication = await provider.getById(externalId);
    if (medication) {
      return { data: enrichMedication(medication), warnings, providersUsed: [provider.id] };
    }
  } catch (err) {
    warnings.push(`${provider.id}: ${err instanceof Error ? err.message : 'falha ao carregar detalhes'}`);
  }

  const localFallback = await localMedicationProvider.getById(externalId);
  if (localFallback) {
    warnings.push('Detalhes complementares carregados do catálogo local.');
    return { data: localFallback, warnings, providersUsed: ['local'] };
  }

  return { data: null, warnings: [...warnings, 'Medicamento não encontrado.'], providersUsed: [] };
}

function enrichMedication(medication: Medication): Medication {
  if (medication.dosages.length > 0 && medication.contraindications.absolute.length > 0) {
    return medication;
  }

  const local = resolveLocalByName(medication.name) ?? resolveLocalByName(medication.activeIngredient);
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

export async function aggregateInteractions(medicationIds: string[]) {
  const warnings: string[] = [];
  const namesById = new Map<string, string>();
  const meds: Medication[] = [];

  for (const id of medicationIds) {
    const { data, warnings: loadWarnings } = await aggregateGetById(id);
    warnings.push(...loadWarnings);
    if (data) {
      meds.push(data);
      namesById.set(id, data.name);
    }
  }

  const interactions: MedicationInteraction[] = [];
  const seen = new Set<string>();

  for (const med of meds) {
    for (const interaction of med.interactions) {
      const key = [interaction.description, interaction.medicationAName, interaction.medicationBName].join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      interactions.push(interaction);
    }
  }

  for (let i = 0; i < meds.length; i += 1) {
    for (let j = i + 1; j < meds.length; j += 1) {
      const a = meds[i];
      const b = meds[j];
      const openFdaInteractions = extractPairFromOpenFdaLabels(a, b);
      for (const interaction of openFdaInteractions) {
        const key = interaction.description;
        if (seen.has(key)) continue;
        seen.add(key);
        interactions.push(interaction);
      }
    }
  }

  interactions.push(...resolveLocalInteractions(medicationIds));

  const deduped = dedupeInteractions(interactions);
  return { data: deduped, warnings, providersUsed: ['openfda', 'local', 'bulário', 'anvisa'] as MedicationProviderId[] };
}

function extractPairFromOpenFdaLabels(a: Medication, b: Medication) {
  if (a.source !== 'openfda' && b.source !== 'openfda') return [] as MedicationInteraction[];
  const text = `${a.summary} ${a.contraindications.warnings.join(' ')}`.toLowerCase();
  const target = b.activeIngredient.toLowerCase();
  if (!text.includes(target.split(' ')[0])) return [];
  return [{
    id: `pair-${a.id}-${b.id}`,
    medicationAId: a.id,
    medicationBId: b.id,
    medicationAName: a.name,
    medicationBName: b.name,
    severity: 'moderada' as const,
    description: `OpenFDA menciona possível interação ou alerta envolvendo ${b.activeIngredient}. Validar no rótulo completo.`,
  }];
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
