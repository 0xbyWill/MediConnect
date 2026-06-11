import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { jsonResponse, maskSensitive, readJson, requireUser, sanitizePayload, sanitizeText } from '../_shared/ai/security.ts';

type AssistantAction =
  | 'general_search'
  | 'daily_summary'
  | 'weekly_summary'
  | 'monthly_summary'
  | 'missed_appointments'
  | 'financial_summary'
  | 'doctor_performance'
  | 'message_draft'
  | 'admin_pending_tasks';

type AssistantSource = 'appointments' | 'reports' | 'patients' | 'doctors' | 'financial' | 'mixed';

type AssistantRequest = {
  action?: AssistantAction;
  prompt?: string;
  period?: {
    startDate?: string;
    endDate?: string;
  };
  context?: Record<string, unknown>;
};

const ALLOWED_ACTIONS = new Set<AssistantAction>([
  'general_search',
  'daily_summary',
  'weekly_summary',
  'monthly_summary',
  'missed_appointments',
  'financial_summary',
  'doctor_performance',
  'message_draft',
  'admin_pending_tasks',
]);

const SENSITIVE_KEYS = new Set([
  'cpf',
  'guardian_cpf',
  'email',
  'phone',
  'phone_mobile',
  'phone1',
  'phone2',
  'rg',
  'document_number',
  'cep',
  'street',
  'number',
  'complement',
  'reference',
  'content_html',
  'content_json',
  'diagnosis',
  'conclusion',
  'notes',
  'blood_type',
  'weight_kg',
  'height_m',
  'bmi',
]);

const BLOCKED_TERMS = [
  'diagnóstico',
  'diagnostico',
  'prescrição',
  'prescricao',
  'interpretar laudo',
  'conduta clínica',
  'conduta clinica',
  'tratamento',
  'medicação',
  'medicacao',
  'cancele',
  'agende',
  'remarque',
  'cadastre',
  'exclua',
  'delete',
  'atualize',
  'altere',
  'envie mensagem',
  'registrar pagamento',
  'dar baixa',
];

function createSupabase(req: Request) {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } },
  );
}

async function requireManager(supabase: ReturnType<typeof createSupabase>) {
  const user = await requireUser(supabase);
  const { data: profile } = await supabase
    .from('profiles')
    .select('role,active,disabled')
    .or(`id.eq.${user.id},user_id.eq.${user.id},auth_user_id.eq.${user.id}`)
    .maybeSingle();

  const metadataRole = String(user.app_metadata?.role ?? user.user_metadata?.role ?? '').toLowerCase();
  const role = String(profile?.role ?? metadataRole).toLowerCase();
  const active = profile?.active !== false && profile?.disabled !== true;

  if (!active || !['gestao', 'gestor', 'admin', 'manager'].includes(role)) {
    throw new Error('Permissao de gestao obrigatoria.');
  }

  return user;
}

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive).slice(0, 80);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? maskSensitive(value).slice(0, 700) : value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, child]) => [key, stripSensitive(child)]),
  );
}

function validatePrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (BLOCKED_TERMS.some(term => normalized.includes(term))) {
    throw new Error('Pedido bloqueado: o assistente e somente leitura e nao realiza atos clinicos, financeiros ou alteracoes no sistema.');
  }
}

function inferSource(action: AssistantAction): AssistantSource {
  if (action === 'financial_summary') return 'financial';
  if (action === 'doctor_performance') return 'doctors';
  if (action === 'message_draft') return 'patients';
  if (action === 'missed_appointments' || action.includes('summary')) return 'appointments';
  return 'mixed';
}

async function callGemini(prompt: string, context: Record<string, unknown>, action: AssistantAction) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY nao configurada nos secrets da Supabase.');
  }

  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-1.5-flash';
  const system = [
    'Voce e o Assistente de Busca Gerencial do MediConnect.',
    'Responda sempre em portugues do Brasil, de forma objetiva, clara e profissional.',
    'Use somente os dados no contexto recebido. Se faltar informacao, diga que nao ha informacao suficiente.',
    'Nao diga que consultou banco de dados; o contexto ja foi fornecido pelo sistema.',
    'Nao execute, prometa ou confirme criacao, edicao, exclusao, cancelamento, envio de mensagem ou acao financeira.',
    'Nao faca diagnostico, prescricao, orientacao medica ou interpretacao clinica de laudos.',
    'Para mensagens, gere apenas rascunhos para revisao humana.',
  ].join('\n');

  const userText = [
    `Acao solicitada: ${action}`,
    `Pergunta do gestor: ${prompt}`,
    'Contexto administrativo sanitizado em JSON:',
    JSON.stringify(context).slice(0, 14000),
  ].join('\n\n');

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: userText }],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 900,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao chamar Gemini (${response.status}).`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('').trim();
  return maskSensitive(String(text || 'Nao foi possivel gerar uma resposta com os dados fornecidos.'));
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return jsonResponse({}, 200, req);
  if (req.method !== 'POST') return jsonResponse({ message: 'Metodo nao permitido.' }, 405, req);

  try {
    const supabase = createSupabase(req);
    await requireManager(supabase);

    const body = sanitizePayload(await readJson<Record<string, unknown>>(req)) as AssistantRequest;
    const action = ALLOWED_ACTIONS.has(body.action as AssistantAction) ? (body.action as AssistantAction) : 'general_search';
    const prompt = sanitizeText(body.prompt, 1500);
    if (!prompt) throw new Error('Pergunta obrigatoria.');
    validatePrompt(prompt);

    const context = stripSensitive(body.context ?? {}) as Record<string, unknown>;
    const period = {
      startDate: sanitizeText(body.period?.startDate, 10),
      endDate: sanitizeText(body.period?.endDate, 10),
    };

    const answer = await callGemini(prompt, { ...context, period }, action);
    return jsonResponse({
      answer,
      warnings: [],
      source: inferSource(action),
    }, 200, req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno no assistente gerencial.';
    const status = message.includes('Permissao') || message.includes('autenticado') ? 403 : 400;
    return jsonResponse({ message }, status, req);
  }
});
