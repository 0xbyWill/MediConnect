import type { Medication, MedicationProvider, MedicationSearchResult } from '../types.ts';
import {
  buildMedicationId,
  classifyInteractionSeverity,
  fetchJson,
  firstString,
  normalizeSearchText,
  splitLabelSections,
} from '../utils.ts';

type OpenFdaLabel = Record<string, unknown> & {
  openfda?: Record<string, unknown>;
};

type OpenFdaResponse = {
  results?: OpenFdaLabel[];
};

function openFdaKey() {
  return Deno.env.get('OPENFDA_API_KEY')?.trim() ?? '';
}

function buildSearchUrl(query: string, limit: number) {
  const term = query.trim().replace(/\s+/g, '+');
  const key = openFdaKey();
  const keySuffix = key ? `&api_key=${encodeURIComponent(key)}` : '';
  return `https://api.fda.gov/drug/label.json?search=(openfda.generic_name:${term}+OR+openfda.brand_name:${term})&limit=${Math.min(limit, 12)}${keySuffix}`;
}

function mapLabel(label: OpenFdaLabel, index: number): MedicationSearchResult {
  const openfda = label.openfda ?? {};
  const brand = firstString(openfda.brand_name) || firstString(label.brand_name) || `Medicamento FDA ${index + 1}`;
  const generic = firstString(openfda.generic_name) || firstString(label.generic_name) || brand;
  const setId = firstString(label.set_id) || firstString(label.id) || `${normalizeSearchText(generic)}-${index}`;
  return {
    id: buildMedicationId('openfda', setId),
    name: brand,
    activeIngredient: generic,
    commercialNames: Array.isArray(openfda.brand_name) ? openfda.brand_name.map(String) : [brand],
    therapeuticClass: firstString(openfda.pharm_class_epc) || firstString(openfda.pharm_class_cs) || 'FDA Drug Label',
    category: firstString(openfda.product_type) || 'Medicamento',
    source: 'openfda',
    externalId: setId,
  };
}

function mapLabelToMedication(label: OpenFdaLabel, externalId: string): Medication {
  const openfda = label.openfda ?? {};
  const brand = firstString(openfda.brand_name) || firstString(label.brand_name) || externalId;
  const generic = firstString(openfda.generic_name) || firstString(label.generic_name) || brand;
  const dosageText = firstString(label.dosage_and_administration);
  const contraindicationsText = firstString(label.contraindications);
  const warningsText = firstString(label.warnings) || firstString(label.boxed_warning);
  const interactionsText = firstString(label.drug_interactions);

  return {
    id: buildMedicationId('openfda', externalId),
    name: brand,
    activeIngredient: generic,
    commercialNames: Array.isArray(openfda.brand_name) ? openfda.brand_name.map(String) : [brand],
    therapeuticClass: firstString(openfda.pharm_class_epc) || 'FDA Drug Label',
    category: firstString(openfda.product_type) || 'Medicamento',
    presentations: splitLabelSections(firstString(label.spl_product_data_elements) || brand, 4),
    manufacturers: firstString(openfda.manufacturer_name) ? [firstString(openfda.manufacturer_name)] : undefined,
    summary: firstString(label.indications_and_usage) || firstString(label.purpose) || 'Informações extraídas do rótulo OpenFDA.',
    dosages: dosageText ? [{
      population: 'adultos',
      usualDose: splitLabelSections(dosageText, 1)[0] ?? dosageText.slice(0, 240),
      frequency: 'Consultar bula/label FDA',
      maxDose: 'Consultar bula/label FDA',
      notes: 'Posologia em inglês — validar com protocolo institucional.',
    }] : [],
    contraindications: {
      absolute: splitLabelSections(contraindicationsText, 5),
      relative: [],
      warnings: splitLabelSections(warningsText, 5),
    },
    interactions: interactionsText
      ? splitLabelSections(interactionsText, 4).map((description, index) => ({
          id: `openfda-${externalId}-${index}`,
          medicationAId: buildMedicationId('openfda', externalId),
          medicationBId: 'openfda:unknown',
          medicationAName: brand,
          medicationBName: 'Outros medicamentos',
          severity: classifyInteractionSeverity(description),
          description,
        }))
      : [],
    source: 'openfda',
    externalId,
  };
}

export const openFdaProvider: MedicationProvider = {
  id: 'openfda',
  isConfigured: () => true,
  async search(query, limit) {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const url = buildSearchUrl(trimmed, limit);
    const data = await fetchJson<OpenFdaResponse>(url);
    return (data.results ?? []).map(mapLabel).slice(0, limit);
  },
  async getById(externalId) {
    const key = openFdaKey();
    const keySuffix = key ? `&api_key=${encodeURIComponent(key)}` : '';
    const url = `https://api.fda.gov/drug/label.json?search=set_id:${encodeURIComponent(externalId)}&limit=1${keySuffix}`;
    const data = await fetchJson<OpenFdaResponse>(url);
    const label = data.results?.[0];
    return label ? mapLabelToMedication(label, externalId) : null;
  },
};
