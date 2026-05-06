import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AiOrchestratorAgent } from '../_shared/ai/agents.ts';
import { AiProviderService } from '../_shared/ai/provider.ts';
import { AiRepository } from '../_shared/ai/repository.ts';
import { jsonResponse, readJson, requireAdmin, sanitizePayload } from '../_shared/ai/security.ts';

function createSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

function parts(req: Request) {
  const all = new URL(req.url).pathname.split('/').filter(Boolean);
  const root = all.indexOf('admin-ai');
  return root >= 0 ? all.slice(root + 1) : all.slice(1);
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({});

  const supabase = createSupabase(req);
  const repo = new AiRepository(supabase);
  const orchestrator = new AiOrchestratorAgent(repo, new AiProviderService(), supabase);

  try {
    const admin = await requireAdmin(supabase);
    const path = parts(req);
    const body = sanitizePayload(await readJson<Record<string, unknown>>(req));
    const [resource, id, subAction] = path;

    if (req.method === 'GET' && resource === 'dashboard') {
      const [conversations, outputs, knowledge, faqs, corrections, logs, reviewItems] = await Promise.all([
        supabase.from('ai_conversations').select('id', { count: 'exact', head: true }),
        supabase.from('ai_generated_outputs').select('id', { count: 'exact', head: true }),
        supabase.from('ai_knowledge_documents').select('id', { count: 'exact', head: true }),
        supabase.from('ai_faqs').select('id', { count: 'exact', head: true }),
        supabase.from('ai_corrections').select('id', { count: 'exact', head: true }),
        supabase.from('ai_action_logs').select('*').order('created_at', { ascending: false }).limit(8),
        supabase.from('ai_generated_outputs').select('*').eq('approved', false).order('created_at', { ascending: false }).limit(8),
      ]);
      return jsonResponse({
        conversations: conversations.count ?? 0,
        generatedOutputs: outputs.count ?? 0,
        knowledgeDocuments: knowledge.count ?? 0,
        faqs: faqs.count ?? 0,
        corrections: corrections.count ?? 0,
        logs: logs.data ?? [],
        reviewItems: reviewItems.data ?? [],
      });
    }

    if (req.method === 'POST' && resource === 'chat') {
      const result = await orchestrator.handleAdminChat(admin.id, String(body.message ?? ''));
      await orchestrator.audit.register('admin_chat', { adminId: admin.id, input: body, output: result, status: 'success' });
      return jsonResponse(result);
    }

    if (resource === 'instructions') {
      if (req.method === 'GET' && id && subAction === 'versions') {
        return jsonResponse({ items: await orchestrator.instructions.versions(id) });
      }
      if (req.method === 'GET') return jsonResponse({ items: await orchestrator.instructions.list() });
      if (req.method === 'POST') {
        const row = await orchestrator.instructions.create(body, admin.id);
        await orchestrator.audit.register('instruction_created', { adminId: admin.id, input: body, output: { id: row.id }, status: 'success' });
        return jsonResponse({ id: row.id, status: 'created' });
      }
      if (req.method === 'PUT' && id) {
        await orchestrator.instructions.update(id, body, admin.id);
        return jsonResponse({ status: 'updated' });
      }
      if (req.method === 'PATCH' && id && subAction === 'deactivate') {
        await orchestrator.instructions.deactivate(id, admin.id);
        return jsonResponse({ status: 'deactivated' });
      }
    }

    if (resource === 'knowledge') {
      if (req.method === 'GET') return jsonResponse({ items: await orchestrator.knowledge.list() });
      if (req.method === 'POST') {
        const row = await orchestrator.handleKnowledgeUpdate(body, admin.id);
        await orchestrator.audit.register('knowledge_created', { adminId: admin.id, input: body, output: { id: row.id }, status: 'success' });
        return jsonResponse({ id: row.id, status: 'created' });
      }
      if (req.method === 'PUT' && id) {
        await orchestrator.knowledge.update(id, body, admin.id);
        return jsonResponse({ status: 'updated' });
      }
      if (req.method === 'PATCH' && id && subAction === 'deactivate') {
        await orchestrator.knowledge.deactivate(id, admin.id);
        return jsonResponse({ status: 'deactivated' });
      }
    }

    if (resource === 'faqs') {
      if (req.method === 'GET') return jsonResponse({ items: await orchestrator.faqs.list() });
      if (req.method === 'POST') {
        const row = await orchestrator.faqs.create(body, admin.id);
        await orchestrator.audit.register('faq_created', { adminId: admin.id, input: body, output: { id: row.id }, status: 'success' });
        return jsonResponse({ id: row.id, status: 'created' });
      }
      if (req.method === 'PUT' && id) {
        await orchestrator.faqs.update(id, body, admin.id);
        return jsonResponse({ status: 'updated' });
      }
      if (req.method === 'PATCH' && id && subAction === 'deactivate') {
        await orchestrator.faqs.deactivate(id, admin.id);
        return jsonResponse({ status: 'deactivated' });
      }
    }

    if (req.method === 'POST' && resource === 'corrections') {
      await orchestrator.handleCorrection({
        messageId: String(body.messageId ?? ''),
        correctAnswer: String(body.correctAnswer ?? ''),
        notes: String(body.notes ?? ''),
      }, admin.id);
      await orchestrator.audit.register('correction_saved', { adminId: admin.id, input: body, output: { status: 'saved' }, status: 'success' });
      return jsonResponse({ status: 'saved' });
    }

    if (req.method === 'GET' && resource === 'conversations') {
      const { data, error } = await supabase.from('ai_conversations').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return jsonResponse({ items: data ?? [] });
    }

    if (req.method === 'GET' && resource === 'logs') {
      const { data, error } = await supabase.from('ai_action_logs').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return jsonResponse({ items: data ?? [] });
    }

    return jsonResponse({ message: 'Endpoint administrativo de IA nao encontrado.' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno na IA administrativa.';
    await repo.log('admin_ai_error', { input: {}, output: {}, status: 'error', error: message }).catch(() => undefined);
    return jsonResponse({ message }, message.includes('Permissao') || message.includes('autenticado') ? 403 : 400);
  }
});
