import type { Medication, MedicationInteraction, MedicationSearchResult } from '../types.ts';
import type { MedicationProvider } from '../types.ts';
import { buildMedicationId } from '../utils.ts';

const INTERACTIONS: MedicationInteraction[] = [
  { id: 'int-losartana-metformina', medicationAId: 'losartana', medicationBId: 'metformina', medicationAName: 'Losartana', medicationBName: 'Metformina', severity: 'leve', description: 'Associação comum em pacientes diabéticos hipertensos. Monitorar função renal e potássio sérico.', clinicalManagement: 'Avaliar creatinina e potássio periodicamente.' },
  { id: 'int-losartana-amoxicilina', medicationAId: 'losartana', medicationBId: 'amoxicilina', medicationAName: 'Losartana', medicationBName: 'Amoxicilina', severity: 'leve', description: 'Interação clínica geralmente não significativa em curto prazo.' },
  { id: 'int-metformina-amoxicilina', medicationAId: 'metformina', medicationBId: 'amoxicilina', medicationAName: 'Metformina', medicationBName: 'Amoxicilina', severity: 'leve', description: 'Sem interação farmacodinâmica relevante documentada de rotina.' },
  { id: 'int-sinvastatina-amoxicilina', medicationAId: 'sinvastatina', medicationBId: 'amoxicilina', medicationAName: 'Sinvastatina', medicationBName: 'Amoxicilina', severity: 'moderada', description: 'Alguns antibióticos podem elevar níveis de estatinas; monitorar mialgia.', clinicalManagement: 'Orientar paciente sobre mialgia ou fraqueza muscular.' },
  { id: 'int-ozempic-metformina', medicationAId: 'ozempic', medicationBId: 'metformina', medicationAName: 'Ozempic', medicationBName: 'Metformina', severity: 'moderada', description: 'Combinação indicada em DM2, com risco de hipoglicemia se associada a secretagogos.', clinicalManagement: 'Monitorar glicemia.' },
];

const CATALOG: Medication[] = [
  {
    id: buildMedicationId('local', 'dipirona'),
    name: 'Dipirona',
    activeIngredient: 'Metamizol sódico',
    commercialNames: ['Novalgina', 'Anador'],
    therapeuticClass: 'Analgésico e antipirético',
    category: 'Analgésico',
    presentations: ['500 mg comprimido', '1 g comprimido'],
    summary: 'Analgésico e antipirético de uso comum no Brasil.',
    dosages: [{ population: 'adultos', usualDose: '500 mg a 1 g', frequency: 'A cada 6–8 h', maxDose: '4 g/dia' }],
    contraindications: { absolute: ['Hipersensibilidade a pirazolonas'], relative: ['Asma induzida por AINES'], warnings: ['Risco de agranulocitose (raro)'] },
    interactions: INTERACTIONS.filter(item => item.medicationAId.includes('dipirona') || item.medicationBId.includes('dipirona')),
    source: 'local',
    externalId: 'dipirona',
  },
  {
    id: buildMedicationId('local', 'metformina'),
    name: 'Metformina',
    activeIngredient: 'Cloridrato de metformina',
    commercialNames: ['Glifage', 'Dimefor'],
    therapeuticClass: 'Biguanida antidiabética',
    category: 'Antidiabético oral',
    presentations: ['500 mg', '850 mg', 'XR 500 mg'],
    summary: 'Primeira linha no diabetes tipo 2.',
    dosages: [{ population: 'adultos', usualDose: '500–850 mg', frequency: '2–3x/dia', maxDose: '2.550 mg/dia' }],
    contraindications: { absolute: ['ClCr < 30 mL/min', 'Acidose metabólica'], relative: ['Contraste iodado'], warnings: ['Risco de acidose lática (raro)'] },
    interactions: INTERACTIONS.filter(item => item.medicationAId.includes('metformina') || item.medicationBId.includes('metformina')),
    source: 'local',
    externalId: 'metformina',
  },
  {
    id: buildMedicationId('local', 'losartana'),
    name: 'Losartana',
    activeIngredient: 'Losartana potássica',
    commercialNames: ['Cozaar', 'Aradois'],
    therapeuticClass: 'Antagonista do receptor de angiotensina II',
    category: 'Anti-hipertensivo',
    presentations: ['25 mg', '50 mg', '100 mg'],
    summary: 'Anti-hipertensivo da classe BRA.',
    dosages: [{ population: 'adultos', usualDose: '50 mg', frequency: '1x/dia', maxDose: '100 mg/dia' }],
    contraindications: { absolute: ['Gravidez (2º/3º trimestres)'], relative: ['Hipercalemia'], warnings: ['Monitorar creatinina e potássio'] },
    interactions: INTERACTIONS.filter(item => item.medicationAId.includes('losartana') || item.medicationBId.includes('losartana')),
    source: 'local',
    externalId: 'losartana',
  },
];

export const localMedicationProvider: MedicationProvider = {
  id: 'local',
  isConfigured: () => true,
  async search(query, limit) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return CATALOG
      .filter(item => [item.name, item.activeIngredient, ...item.commercialNames].join(' ').toLowerCase().includes(normalized))
      .map(item => ({
        id: item.id,
        name: item.name,
        activeIngredient: item.activeIngredient,
        commercialNames: item.commercialNames,
        therapeuticClass: item.therapeuticClass,
        category: item.category,
        source: 'local' as const,
        externalId: item.externalId,
      }))
      .slice(0, limit) satisfies MedicationSearchResult[];
  },
  async getById(externalId) {
    return CATALOG.find(item => item.externalId === externalId || item.id === externalId) ?? null;
  },
};

export function resolveLocalInteractions(medicationIds: string[]) {
  const normalized = new Set(medicationIds.map(id => {
    const parsed = id.includes(':') ? id.split(':').slice(1).join(':') : id;
    return parsed.toLowerCase();
  }));
  const output: MedicationInteraction[] = [];
  for (const interaction of INTERACTIONS) {
    const a = interaction.medicationAId.toLowerCase();
    const b = interaction.medicationBId.toLowerCase();
    if (normalized.has(a) && normalized.has(b)) {
      output.push(interaction);
    }
  }
  return output;
}

export function resolveLocalByName(name: string) {
  const normalized = name.trim().toLowerCase();
  return CATALOG.find(item =>
    item.name.toLowerCase() === normalized ||
    item.activeIngredient.toLowerCase() === normalized ||
    item.commercialNames.some(commercial => commercial.toLowerCase() === normalized)
  ) ?? null;
}
