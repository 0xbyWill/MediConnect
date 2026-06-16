import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ADMIN_HEALTH_KNOWLEDGE_PROMPT, HEALTH_KNOWLEDGE_PROMPT } from '../_shared/ai/healthKnowledge.ts';
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

const GESTOR_FULL_ACCESS = 'gestor_full';

const ALWAYS_BLOCKED_KEYS = new Set(['password', 'token', 'secret', 'content_json']);

const CLINICAL_ADVICE_PATTERNS = [
  /\b(prescri[cç][aã]o|receita m[eé]dica)\s+(para|do|da|desse|deste|dele|dela)\b/i,
  /\binterpret(e|ar)\s+(o|este|esse|meu|seu)\s+laudo\b/i,
  /\bqual\s+(rem[eé]dio|medicamento|tratamento)\s+(devo|posso|tomar)\b/i,
  /\bconduta cl[ií]nica\s+(para|do|da)\b/i,
  /\b(o que (eu )?tenho|tenho (alguma|que) doen[cç]a)\b/i,
];

const EXECUTION_PATTERNS = [
  /\b(cancele|cancela|exclua|excluir|delete|apague|remova|remover)\s+(a|o|as|os|este|esse|meu|minha|do|da)\b/i,
  /\b(agende|marque|cadastre|crie|criar|atualize|altere|modifique)\s+(a|o|as|os|um|uma|novo|nova|este|esse)\b/i,
  /\b(envie|mande|dispare)\s+(uma\s+)?(mensagem|sms|e-mail|email)\b/i,
  /\b(dar baixa|registrar pagamento|baixar pagamento)\b/i,
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

function sanitizeGestorContext(value: unknown, depth = 0): unknown {
  if (depth > 8) return '[profundidade maxima]';
  if (Array.isArray(value)) return value.slice(0, 120).map(item => sanitizeGestorContext(item, depth + 1));
  if (typeof value === 'string') return maskSensitive(value).slice(0, 1200);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !ALWAYS_BLOCKED_KEYS.has(key.toLowerCase()))
      .map(([key, child]) => [key, sanitizeGestorContext(child, depth + 1)]),
  );
}

function stripSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSensitive).slice(0, 80);
  if (!value || typeof value !== 'object') {
    return typeof value === 'string' ? maskSensitive(value).slice(0, 700) : value;
  }

  const blocked = new Set([
    'cpf', 'guardian_cpf', 'email', 'phone', 'phone_mobile', 'phone1', 'phone2', 'rg',
    'document_number', 'cep', 'street', 'number', 'complement', 'reference',
    'content_html', 'content_json', 'diagnosis', 'conclusion', 'notes',
    'blood_type', 'weight_kg', 'height_m', 'bmi',
  ]);

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !blocked.has(key.toLowerCase()))
      .map(([key, child]) => [key, stripSensitive(child)]),
  );
}

function prepareContext(context: Record<string, unknown>) {
  if (context.accessLevel === GESTOR_FULL_ACCESS) {
    return sanitizeGestorContext(context) as Record<string, unknown>;
  }
  return stripSensitive(context) as Record<string, unknown>;
}

function validatePrompt(prompt: string) {
  const normalized = prompt.trim();
  if (CLINICAL_ADVICE_PATTERNS.some(pattern => pattern.test(normalized))) {
    throw new Error('Pedido bloqueado: nao faco orientacao clinica personalizada. Posso analisar dados administrativos e laudos no contexto fornecido.');
  }
  if (EXECUTION_PATTERNS.some(pattern => pattern.test(normalized))) {
    throw new Error('Pedido bloqueado: o assistente nao executa alteracoes no sistema. Posso localizar dados, resumir informacoes e gerar rascunhos.');
  }
}

function inferSource(action: AssistantAction): AssistantSource {
  if (action === 'financial_summary') return 'financial';
  if (action === 'doctor_performance') return 'doctors';
  if (action === 'message_draft') return 'patients';
  if (action === 'missed_appointments' || action.includes('summary')) return 'appointments';
  return 'mixed';
}

async function callGemini(
  prompt: string,
  context: Record<string, unknown>,
  action: AssistantAction,
  behaviorInstructions?: string,
) {
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY nao configurada nos secrets da Supabase.');
  }

  const isGestorFull = context.accessLevel === GESTOR_FULL_ACCESS;
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-1.5-flash';
  const system = [
    'Voce e o Assistente IA Gerencial do MediConnect para perfis de gestao.',
    'Responda sempre em portugues do Brasil, de forma objetiva, clara e profissional.',
    'Use somente os dados no contexto recebido. Se faltar informacao, diga que nao ha informacao suficiente.',
    'Nao diga que consultou banco de dados; o contexto ja foi carregado pelo sistema com as permissoes do gestor.',
    isGestorFull
      ? 'O gestor autenticado tem acesso administrativo completo de LEITURA aos dados abaixo (pacientes, consultas, laudos, medicos, usuarios). Voce pode cruzar, filtrar, resumir e detalhar esses registros como um analista administrativo.'
      : 'Use apenas os dados resumidos no contexto.',
    'Nao execute, prometa ou confirme criacao, edicao, exclusao, cancelamento, envio de mensagem ou acao financeira no sistema.',
    'Nao faca diagnostico, prescricao ou orientacao clinica personalizada. Pode descrever laudos, diagnosticos e conclusoes ja registrados no sistema para fins administrativos.',
    'Para mensagens externas, gere apenas rascunhos para revisao humana.',
    behaviorInstructions?.trim() ? `Preferencias do gestor:\n${behaviorInstructions.trim()}` : '',
    '',
    ADMIN_HEALTH_KNOWLEDGE_PROMPT,
    '',
    HEALTH_KNOWLEDGE_PROMPT,
  ].filter(Boolean).join('\n');

  const contextLimit = isGestorFull ? 28000 : 14000;
  const userText = [
    `Acao solicitada: ${action}`,
    `Pergunta do gestor: ${prompt}`,
    'Contexto administrativo em JSON:',
    JSON.stringify(context).slice(0, contextLimit),
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
        temperature: 0.35,
        maxOutputTokens: 1200,
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

    const body = sanitizePayload(await readJson<Record<string, unknown>>(req)) as AssistantRequest & {
      behaviorInstructions?: string;
    };
    const action = ALLOWED_ACTIONS.has(body.action as AssistantAction) ? (body.action as AssistantAction) : 'general_search';
    const prompt = sanitizeText(body.prompt, 1500);
    if (!prompt) throw new Error('Pergunta obrigatoria.');
    validatePrompt(prompt);

    const context = prepareContext((body.context ?? {}) as Record<string, unknown>);
    const period = {
      startDate: sanitizeText(body.period?.startDate, 10),
      endDate: sanitizeText(body.period?.endDate, 10),
    };

    const answer = await callGemini(
      prompt,
      { ...context, period },
      action,
      sanitizeText(body.behaviorInstructions, 1200),
    );
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
