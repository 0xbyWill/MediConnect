import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aggregateGetById, aggregateInteractions, aggregateSearch } from '../_shared/medications/aggregator.ts';
import { requireMedicationLibraryAccess } from '../_shared/medications/auth.ts';
import type {
  MedicationLibraryGetRequest,
  MedicationLibraryInteractionsRequest,
  MedicationLibrarySearchRequest,
  MedicationProviderId,
} from '../_shared/medications/types.ts';
import { jsonResponse, readJson, sanitizePayload, sanitizeText } from '../_shared/ai/security.ts';

const ALLOWED_PROVIDERS = new Set<MedicationProviderId>(['local', 'anvisa', 'openfda', 'bulário', 'whitebook']);

function createSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

function sanitizeProviders(value: unknown): MedicationProviderId[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const providers = value
    .map(item => sanitizeText(item, 20))
    .filter((item): item is MedicationProviderId => ALLOWED_PROVIDERS.has(item as MedicationProviderId));
  return providers.length ? providers : undefined;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({}, 200, req);
  if (req.method !== 'POST') return jsonResponse({ message: 'Metodo nao permitido.' }, 405, req);

  const action = new URL(req.url).pathname.split('/').filter(Boolean).at(-1) ?? '';

  try {
    const supabase = createSupabase(req);
    await requireMedicationLibraryAccess(supabase);
    const body = sanitizePayload(await readJson<Record<string, unknown>>(req));

    if (action === 'search') {
      const payload = body as MedicationLibrarySearchRequest;
      const query = sanitizeText(payload.query, 120);
      if (!query) throw new Error('Consulta obrigatoria.');
      const limit = Math.min(Math.max(Number(payload.limit ?? 12), 1), 20);
      const result = await aggregateSearch(query, sanitizeProviders(payload.providers), limit);
      return jsonResponse(result, 200, req);
    }

    if (action === 'get') {
      const payload = body as MedicationLibraryGetRequest;
      const id = sanitizeText(payload.id, 180);
      if (!id) throw new Error('Identificador obrigatorio.');
      const result = await aggregateGetById(id);
      if (!result.data) return jsonResponse(result, 404, req);
      return jsonResponse(result, 200, req);
    }

    if (action === 'interactions') {
      const payload = body as MedicationLibraryInteractionsRequest;
      const medicationIds = Array.isArray(payload.medicationIds)
        ? payload.medicationIds.map(item => sanitizeText(item, 180)).filter(Boolean).slice(0, 8)
        : [];
      if (medicationIds.length < 2) throw new Error('Informe ao menos dois medicamentos.');
      const result = await aggregateInteractions(medicationIds);
      return jsonResponse(result, 200, req);
    }

    return jsonResponse({ message: 'Endpoint da biblioteca farmacologica nao encontrado.' }, 404, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno na biblioteca farmacologica.';
    const status = message.includes('Permissao') || message.includes('autenticado') ? 403 : 400;
    return jsonResponse({ message }, status, req);
  }
});
