import type { Medication, MedicationSearchResult } from '../../../types';
import {
  anvisaConsultasBase,
  anvisaConsultasHeaders,
  buildMedicationId,
  emptyContraindications,
  emptyDosages,
  fetchJson,
  firstString,
  serializeParams,
} from '../utils';

type BularioPage = { content?: Array<Record<string, unknown>> };
type MedicamentoDetalhe = {
  content?: Array<Record<string, unknown>>;
  medicamento?: Record<string, unknown>;
  empresaFarmaceutica?: Record<string, unknown>;
};

function mapBularioItem(item: Record<string, unknown>): MedicationSearchResult {
  const processo = firstString(item.numProcesso) || firstString(item.processo);
  const name = firstString(item.nomeProduto) || firstString(item.nome) || 'Medicamento';
  const activeIngredient = firstString(item.principioAtivo) || firstString(item.substancia) || name;
  return {
    id: buildMedicationId('bulário', processo || name),
    name,
    activeIngredient,
    commercialNames: [name],
    therapeuticClass: firstString(item.categoriaRegulatoria) || 'Medicamento registrado',
    category: firstString(item.tipoProduto) || 'Bulário ANVISA',
    source: 'bulário',
    externalId: processo || name,
  };
}

function mapMedicamentoDetalhe(payload: MedicamentoDetalhe, externalId: string): Medication | null {
  const med = (payload.medicamento ?? payload.content?.[0] ?? payload) as Record<string, unknown>;
  if (!med || typeof med !== 'object') return null;

  const base = anvisaConsultasBase();
  const name = firstString(med.nome) || firstString(med.nomeProduto) || externalId;
  const activeIngredient = firstString(med.principioAtivo) || firstString(med.substancia) || name;
  const empresa = payload.empresaFarmaceutica;

  return {
    id: buildMedicationId('bulário', externalId),
    name,
    activeIngredient,
    commercialNames: [name],
    therapeuticClass: firstString(med.categoriaRegulatoria) || 'Medicamento registrado',
    category: firstString(med.categoriaMedicamentoNotificado) || 'Bulário eletrônico',
    presentations: [firstString(med.apresentacao) || firstString(med.formaFarmaceutica) || 'Consultar bula'].filter(Boolean),
    manufacturers: empresa?.razaoSocial ? [String(empresa.razaoSocial)] : undefined,
    summary: [
      firstString(med.indicacoes) && `Indicações: ${firstString(med.indicacoes)}`,
      firstString(med.situacaoApresentacao) && `Situação: ${firstString(med.situacaoApresentacao)}`,
      firstString(med.numeroRegistroFormatado) && `Registro: ${firstString(med.numeroRegistroFormatado)}`,
    ].filter(Boolean).join(' · ') || 'Informações extraídas do Bulário Eletrônico da ANVISA.',
    dosages: emptyDosages(),
    contraindications: emptyContraindications(),
    interactions: [],
    source: 'bulário',
    externalId,
    bulaPatientUrl: firstString(med.idBulaPacienteProtegido)
      ? `${base}/api/consulta/medicamentos/arquivo/bula/parecer/${firstString(med.idBulaPacienteProtegido)}/?Authorization=`
      : undefined,
    bulaProfessionalUrl: firstString(med.idBulaProfissionalProtegido)
      ? `${base}/api/consulta/medicamentos/arquivo/bula/parecer/${firstString(med.idBulaProfissionalProtegido)}/?Authorization=`
      : undefined,
  };
}

export async function searchBulario(query: string, limit: number) {
  const base = anvisaConsultasBase();
  const url = `${base}/api/consulta/bulario?${serializeParams({
    count: Math.min(limit, 12),
    page: 1,
    filter: { nomeProduto: query.trim() },
  })}`;
  const data = await fetchJson<BularioPage>(url, { headers: anvisaConsultasHeaders() });
  return (data.content ?? []).map(mapBularioItem).slice(0, limit);
}

export async function getBularioById(externalId: string) {
  const base = anvisaConsultasBase();
  const url = `${base}/api/consulta/medicamento/produtos/${encodeURIComponent(externalId)}`;
  const data = await fetchJson<MedicamentoDetalhe>(url, { headers: anvisaConsultasHeaders() });
  return mapMedicamentoDetalhe(data, externalId);
}
