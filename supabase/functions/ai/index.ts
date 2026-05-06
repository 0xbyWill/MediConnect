import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AiOrchestratorAgent } from '../_shared/ai/agents.ts';
import { AiProviderService } from '../_shared/ai/provider.ts';
import { AiRepository } from '../_shared/ai/repository.ts';
import { jsonResponse, readJson, requireUser, sanitizePayload } from '../_shared/ai/security.ts';

function createSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({});

  const supabase = createSupabase(req);
  const repo = new AiRepository(supabase);
  const orchestrator = new AiOrchestratorAgent(repo, new AiProviderService(), supabase);
  const action = new URL(req.url).pathname.split('/').filter(Boolean).at(-1) ?? '';

  try {
    const user = await requireUser(supabase);
    const body = sanitizePayload(await readJson<Record<string, unknown>>(req));

    if (req.method === 'POST' && action === 'generate-description') {
      const result = await orchestrator.handleDescriptionGeneration(user.id, {
        title: String(body.title ?? ''),
        category: String(body.category ?? ''),
        details: String(body.details ?? ''),
        tone: String(body.tone ?? 'professional'),
      });
      await orchestrator.audit.register('generate_description', { userId: user.id, input: body, output: result, status: 'success' });
      return jsonResponse(result);
    }

    if (req.method === 'POST' && action === 'generate-user-message') {
      const result = await orchestrator.handleUserMessageGeneration(String(body.userId ?? user.id), {
        messageType: String(body.messageType ?? 'custom'),
        context: String(body.context ?? ''),
      });
      await orchestrator.audit.register('generate_user_message', { userId: user.id, input: body, output: result, status: 'success' });
      return jsonResponse(result);
    }

    if (req.method === 'POST' && action === 'support') {
      const targetUserId = String(body.userId ?? user.id);
      if (targetUserId !== user.id) throw new Error('Usuario comum so pode pedir suporte para si mesmo.');
      const result = await orchestrator.handleSupportQuestion(user.id, String(body.question ?? ''));
      await orchestrator.audit.register('support_question', { userId: user.id, input: body, output: result, status: 'success' });
      return jsonResponse(result);
    }

    if (req.method === 'POST' && action === 'feedback') {
      const { error } = await supabase.from('ai_feedback').insert({
        message_id: String(body.messageId ?? ''),
        rating: Number(body.rating ?? 1),
        comment: String(body.comment ?? '').slice(0, 1000),
      });
      if (error) throw error;
      await orchestrator.audit.register('feedback_saved', { userId: user.id, input: body, output: { status: 'saved' }, status: 'success' });
      return jsonResponse({ status: 'saved' });
    }

    return jsonResponse({ message: 'Endpoint de IA nao encontrado.' }, 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno na IA.';
    await repo.log(`ai_${action || 'unknown'}`, { input: {}, output: {}, status: 'error', error: message }).catch(() => undefined);
    return jsonResponse({ message }, message.includes('Permissao') || message.includes('autenticado') ? 403 : 400);
  }
});
