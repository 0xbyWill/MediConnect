import type { Medication, MedicationProvider, MedicationSearchResult } from '../types.ts';
import {
  anvisaConsultasHeaders,
  buildMedicationId,
  emptyContraindications,
  emptyDosages,
  fetchJson,
  firstString,
  serializeParams,
} from '../utils.ts';

const CONSULTAS_BASE = 'https://consultas.anvisa.gov.br';
const GATEWAY_BASE = Deno.env.get('ANVISA_API_BASE')
  ?? 'https://api-gateway.prd.apps.anvisa.gov.br/consultas-externas-api';

type ProdutosPage = {
  content?: Array<Record<string, unknown>>;
};

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

async function searchGateway(query: string, limit: number): Promise<MedicationSearchResult[]> {
  const token = Deno.env.get('ANVISA_API_TOKEN')?.trim();
  if (!token) return [];

  const response = await fetch(`${GATEWAY_BASE}/api/v1/dossie`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      page: 1,
      count: Math.min(limit, 12),
      filter: {
        parametroProduto: query.trim(),
        tiposProduto: '6',
        tipoAssunto: '1',
      },
    }),
  });

  if (!response.ok) return [];
  const data = await response.json() as { content?: Array<Record<string, unknown>> };
  return (data.content ?? []).map(item => ({
    id: buildMedicationId('anvisa', firstString(item.processo) || firstString(item.numeroProcesso) || query),
    name: firstString(item.produto) || firstString(item.nomeProduto) || query,
    activeIngredient: firstString(item.principioAtivo) || firstString(item.substancia) || query,
    therapeuticClass: 'Consulta externa ANVISA',
    category: 'Medicamento',
    source: 'anvisa' as const,
    externalId: firstString(item.processo) || firstString(item.numeroProcesso) || query,
  }));
}

export const anvisaProvider: MedicationProvider = {
  id: 'anvisa',
  isConfigured: () => true,
  async search(query, limit) {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const gatewayResults = await searchGateway(trimmed, limit).catch(() => []);
    if (gatewayResults.length > 0) return gatewayResults.slice(0, limit);

    const url = `${CONSULTAS_BASE}/api/consulta/medicamento/produtos/?${serializeParams({
      count: Math.min(limit, 12),
      page: 1,
      filter: {
        nomeProduto: trimmed,
        situacaoRegistro: 'V',
      },
    })}`;

    const data = await fetchJson<ProdutosPage>(url, { headers: anvisaConsultasHeaders() });
    return (data.content ?? []).map(mapProduto).slice(0, limit);
  },
  async getById(externalId) {
    const url = `${CONSULTAS_BASE}/api/consulta/medicamento/produtos/${encodeURIComponent(externalId)}`;
    const data = await fetchJson<Record<string, unknown>>(url, { headers: anvisaConsultasHeaders() });
    return mapDetalhe(data, externalId);
  },
};
