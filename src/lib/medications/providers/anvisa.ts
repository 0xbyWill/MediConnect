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

type ProdutosPage = { content?: Array<Record<string, unknown>> };

function mapProduto(item: Record<string, unknown>): MedicationSearchResult {
  const processo = firstString(item.numeroProcesso) || firstString(item.numProcesso) || firstString(item.processo);
  const name = firstString(item.nomeProduto) || firstString(item.nome) || 'Medicamento';
  const activeIngredient = firstString(item.principioAtivo) || firstString(item.substancia) || name;
  return {
    id: buildMedicationId('anvisa', processo || name),
    name,
    activeIngredient,
    commercialNames: [name],
    therapeuticClass: firstString(item.classeTerapeutica) || 'Produto registrado ANVISA',
    category: firstString(item.categoriaRegulatoria) || 'Medicamento',
    source: 'anvisa',
    externalId: processo || name,
  };
}

function mapDetalhe(item: Record<string, unknown>, externalId: string): Medication {
  const med = (item.medicamento ?? item) as Record<string, unknown>;
  const name = firstString(med.nome) || firstString(med.nomeProduto) || externalId;
  const activeIngredient = firstString(med.principioAtivo) || name;
  const empresa = item.empresaFarmaceutica as Record<string, unknown> | undefined;

  return {
    id: buildMedicationId('anvisa', externalId),
    name,
    activeIngredient,
    commercialNames: [name],
    therapeuticClass: firstString(med.classeTerapeutica) || firstString(med.categoriaRegulatoria) || 'Medicamento',
    category: firstString(med.tipoProduto) || 'Registro ANVISA',
    presentations: [firstString(med.apresentacao) || firstString(med.formaFarmaceutica) || 'Consultar registro'].filter(Boolean),
    manufacturers: empresa?.razaoSocial ? [String(empresa.razaoSocial)] : undefined,
    summary: [
      firstString(med.situacaoRegistro) && `Situação do registro: ${firstString(med.situacaoRegistro)}`,
      firstString(med.numeroRegistroFormatado) && `Registro: ${firstString(med.numeroRegistroFormatado)}`,
      firstString(med.dataVencimentoRegistro) && `Validade: ${firstString(med.dataVencimentoRegistro)}`,
    ].filter(Boolean).join(' · ') || 'Dados de registro obtidos via consulta ANVISA.',
    dosages: emptyDosages(),
    contraindications: emptyContraindications(),
    interactions: [],
    source: 'anvisa',
    externalId,
  };
}

export async function searchAnvisa(query: string, limit: number) {
  const base = anvisaConsultasBase();
  const url = `${base}/api/consulta/medicamento/produtos/?${serializeParams({
    count: Math.min(limit, 12),
    page: 1,
    filter: {
      nomeProduto: query.trim(),
      situacaoRegistro: 'V',
    },
  })}`;
  const data = await fetchJson<ProdutosPage>(url, { headers: anvisaConsultasHeaders() });
  return (data.content ?? []).map(mapProduto).slice(0, limit);
}

export async function getAnvisaById(externalId: string) {
  const base = anvisaConsultasBase();
  const url = `${base}/api/consulta/medicamento/produtos/${encodeURIComponent(externalId)}`;
  const data = await fetchJson<Record<string, unknown>>(url, { headers: anvisaConsultasHeaders() });
  return mapDetalhe(data, externalId);
}
