import { request } from './httpClient';
import type { ManagerSearchAssistantRequest, ManagerSearchAssistantResponse, QueueCandidate } from '../types';

export type AiTone = 'professional' | 'friendly' | 'simple';
export type AiMessageType = 'welcome' | 'warning' | 'support_initial' | 'payment_reminder' | 'custom';
export type AiSourceType = 'faq' | 'knowledge_base' | 'correction' | 'fallback';
export type AiScope = 'general' | 'support' | 'description' | 'user_message' | 'admin';

export interface AiGeneratedTextResponse {
  description?: string;
  message?: string;
  approved: false;
  outputId?: string;
}

export interface AiSupportResponse {
  answer: string;
  sourceType: AiSourceType;
  needsHumanSupport: boolean;
  messageId?: string;
}

export interface AiAdminChatResponse {
  answer: string;
  conversationId?: string;
  messageId?: string;
}

export interface AiAdminItem {
  id: string;
  title?: string;
  question?: string;
  answer?: string;
  content?: string;
  category?: string;
  scope?: AiScope;
  active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface AiConversationItem {
  id: string;
  user_id?: string;
  admin_id?: string;
  type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AiLogItem {
  id: string;
  user_id?: string;
  admin_id?: string;
  action_type: string;
  status: string;
  error_message?: string;
  created_at?: string;
}

export interface AiInstructionVersion {
  id: string;
  instruction_id: string;
  content: string;
  changed_by?: string;
  created_at?: string;
}

export interface AiDashboardStats {
  conversations: number;
  generatedOutputs: number;
  knowledgeDocuments: number;
  faqs: number;
  corrections: number;
  logs: AiLogItem[];
  reviewItems: AiAdminItem[];
}

export interface PatientChatbotAiRequest {
  message: string;
  patientName?: string;
  history?: Array<{ sender: 'bot' | 'patient' | 'system'; text: string }>;
}

export interface PatientChatbotAiResponse {
  answer: string;
}

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type AIMode = 'groq' | 'gemini' | 'direct' | 'none';

export interface ChatRequestOptions {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

interface OpenAICompatibleResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string; code?: number };
}

export class AIError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
  }
}

const DEFAULT_OPENAI_MODEL = String(import.meta.env.VITE_OPENAI_MODEL ?? 'gpt-4o-mini');
const DEFAULT_MAX_TOKENS = Number(import.meta.env.VITE_AI_MAX_TOKENS ?? import.meta.env.VITE_OPENAI_MAX_TOKENS ?? 700);
const DIRECT_OPENAI_KEY = String(import.meta.env.VITE_OPENAI_API_KEY ?? '').trim();
const GEMINI_KEY = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const GEMINI_MODEL = String(import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-1.5-flash').trim();
const GROQ_KEY = String(import.meta.env.VITE_GROQ_API_KEY ?? '').trim();
const GROQ_MODEL = String(import.meta.env.VITE_GROQ_MODEL ?? 'llama-3.3-70b-versatile').trim();
const FORCED_PROVIDER = String(import.meta.env.VITE_AI_PROVIDER ?? 'auto').trim().toLowerCase();

const GROQ_MODEL_FALLBACKS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'llama3-70b-8192',
  'llama3-8b-8192',
] as const;

const GEMINI_MODEL_FALLBACKS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash-8b-latest',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
] as const;

function qs(params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });
  return search.toString();
}

export const aiApi = {
  generateDescription: (data: { title: string; category: string; details: string; tone: AiTone }) =>
    request<AiGeneratedTextResponse>('/functions/v1/ai/generate-description', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  generateUserMessage: (data: { userId: string; messageType: AiMessageType; context: string }) =>
    request<AiGeneratedTextResponse>('/functions/v1/ai/generate-user-message', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  support: (data: { userId: string; question: string }) =>
    request<AiSupportResponse>('/functions/v1/ai/support', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  feedback: (data: { messageId: string; rating: number; comment: string }) =>
    request<{ status: 'saved' }>('/functions/v1/ai/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const adminAiApi = {
  dashboard: () => request<AiDashboardStats>('/functions/v1/admin-ai/dashboard'),

  chat: (data: { adminId: string; message: string }) =>
    request<AiAdminChatResponse>('/functions/v1/admin-ai/chat', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listInstructions: () => request<{ items: AiAdminItem[] }>('/functions/v1/admin-ai/instructions'),
  listInstructionVersions: (id: string) =>
    request<{ items: AiInstructionVersion[] }>(`/functions/v1/admin-ai/instructions/${id}/versions`),
  createInstruction: (data: { title: string; content: string; scope: AiScope; active: boolean }) =>
    request<{ id: string; status: 'created' }>('/functions/v1/admin-ai/instructions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInstruction: (id: string, data: { title: string; content: string; scope: AiScope; active: boolean }) =>
    request<{ status: 'updated' }>(`/functions/v1/admin-ai/instructions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deactivateInstruction: (id: string) =>
    request<{ status: 'deactivated' }>(`/functions/v1/admin-ai/instructions/${id}/deactivate`, { method: 'PATCH' }),

  listKnowledge: () => request<{ items: AiAdminItem[] }>('/functions/v1/admin-ai/knowledge'),
  createKnowledge: (data: { title: string; content: string; category: string; active: boolean }) =>
    request<{ id: string; status: 'created' }>('/functions/v1/admin-ai/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateKnowledge: (id: string, data: { title: string; content: string; category: string; active: boolean }) =>
    request<{ status: 'updated' }>(`/functions/v1/admin-ai/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deactivateKnowledge: (id: string) =>
    request<{ status: 'deactivated' }>(`/functions/v1/admin-ai/knowledge/${id}/deactivate`, { method: 'PATCH' }),

  listFaqs: () => request<{ items: AiAdminItem[] }>('/functions/v1/admin-ai/faqs'),
  createFaq: (data: { question: string; answer: string; category: string; active: boolean }) =>
    request<{ id: string; status: 'created' }>('/functions/v1/admin-ai/faqs', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateFaq: (id: string, data: { question: string; answer: string; category: string; active: boolean }) =>
    request<{ status: 'updated' }>(`/functions/v1/admin-ai/faqs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deactivateFaq: (id: string) =>
    request<{ status: 'deactivated' }>(`/functions/v1/admin-ai/faqs/${id}/deactivate`, { method: 'PATCH' }),

  createCorrection: (data: { messageId: string; correctAnswer: string; notes: string }) =>
    request<{ status: 'saved' }>('/functions/v1/admin-ai/corrections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  listConversations: (filters: { userId?: string; type?: string; status?: string; startDate?: string; endDate?: string } = {}) =>
    request<{ items: AiConversationItem[] }>(`/functions/v1/admin-ai/conversations?${qs(filters)}`),

  listLogs: () => request<{ items: AiLogItem[] }>('/functions/v1/admin-ai/logs'),
};

export function getAIMode(): AIMode {
  if (FORCED_PROVIDER === 'groq') return GROQ_KEY ? 'groq' : 'none';
  if (FORCED_PROVIDER === 'gemini') return GEMINI_KEY ? 'gemini' : 'none';
  if (FORCED_PROVIDER === 'direct') return DIRECT_OPENAI_KEY ? 'direct' : 'none';
  if (FORCED_PROVIDER !== 'auto' && FORCED_PROVIDER !== '') return 'none';
  if (GROQ_KEY) return 'groq';
  if (GEMINI_KEY) return 'gemini';
  if (DIRECT_OPENAI_KEY) return 'direct';
  return 'none';
}

export function isAIConfigured() {
  return getAIMode() !== 'none';
}

export function getAIModel() {
  const mode = getAIMode();
  if (mode === 'groq') return GROQ_MODEL;
  if (mode === 'gemini') return GEMINI_MODEL;
  if (mode === 'direct') return DEFAULT_OPENAI_MODEL;
  return '';
}

async function parseJsonResponse<T>(response: Response): Promise<{ raw: string; parsed: T | null }> {
  const raw = await response.text().catch(() => '');
  try {
    return { raw, parsed: raw ? JSON.parse(raw) as T : null };
  } catch {
    return { raw, parsed: null };
  }
}

function isAbortError(err: unknown) {
  return err instanceof DOMException && err.name === 'AbortError';
}

async function chatCompleteOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  options: ChatRequestOptions,
  providerLabel: 'Groq' | 'OpenAI',
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
      }),
      signal: options.signal,
    });
  } catch (err) {
    if (isAbortError(err)) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new AIError(`Falha de rede ao chamar ${providerLabel}: ${message}`, err);
  }

  const { raw, parsed } = await parseJsonResponse<OpenAICompatibleResponse>(response);
  if (!response.ok) {
    const message = parsed?.error?.message
      ?? (response.status === 401 ? `Chave ${providerLabel} inválida.`
        : response.status === 429 ? `Limite de uso do ${providerLabel} atingido. Aguarde e tente novamente.`
        : `Erro ${response.status} ao consultar ${providerLabel}.`);
    throw new AIError(message || raw);
  }

  const content = parsed?.choices?.[0]?.message?.content?.trim() ?? '';
  if (!content) throw new AIError(`${providerLabel} não retornou conteúdo.`);
  return content;
}

async function chatCompleteGroq(messages: ChatMessage[], options: ChatRequestOptions) {
  const requested = options.model ?? GROQ_MODEL;
  const models = [...new Set([requested, ...GROQ_MODEL_FALLBACKS])];
  let lastError = '';

  for (const model of models) {
    try {
      return await chatCompleteOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        GROQ_KEY,
        model,
        messages,
        options,
        'Groq',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/model|decommission|not found|does not exist|invalid model/i.test(message)) {
        lastError = message;
        continue;
      }
      throw err;
    }
  }

  throw new AIError(lastError || 'Nenhum modelo Groq configurado respondeu.');
}

async function chatCompleteDirect(messages: ChatMessage[], options: ChatRequestOptions) {
  return chatCompleteOpenAICompatible(
    'https://api.openai.com/v1/chat/completions',
    DIRECT_OPENAI_KEY,
    options.model ?? DEFAULT_OPENAI_MODEL,
    messages,
    options,
    'OpenAI',
  );
}

async function chatCompleteGemini(messages: ChatMessage[], options: ChatRequestOptions) {
  const systemInstruction = messages
    .filter(message => message.role === 'system')
    .map(message => message.content.trim())
    .filter(Boolean)
    .join('\n\n');
  const contents = messages
    .filter(message => message.role !== 'system')
    .map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));

  if (!contents.length) throw new AIError('Nenhuma mensagem de usuário para enviar ao Gemini.');

  const requested = options.model ?? GEMINI_MODEL;
  const models = [...new Set([requested, ...GEMINI_MODEL_FALLBACKS])];
  let lastError = '';

  for (const model of models) {
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': GEMINI_KEY,
        },
        body: JSON.stringify({
          ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
          contents,
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            maxOutputTokens: options.maxTokens ?? DEFAULT_MAX_TOKENS,
          },
        }),
        signal: options.signal,
      });
    } catch (err) {
      if (isAbortError(err)) throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new AIError(`Falha de rede ao chamar Gemini: ${message}`, err);
    }

    const { raw, parsed } = await parseJsonResponse<GeminiResponse>(response);
    if (response.status === 404) {
      lastError = parsed?.error?.message ?? `Modelo Gemini nao encontrado: ${model}`;
      continue;
    }
    if (response.status === 429) {
      const message = parsed?.error?.message ?? raw;
      const noFreeTier = /free[_ ]tier[\s\S]*limit:\s*0|limit:\s*0[\s\S]*free[_ ]tier/i.test(message);
      if (noFreeTier) {
        lastError = `Modelo ${model} indisponível no tier free desta chave.`;
        continue;
      }
      throw new AIError('Cota do Gemini atingida temporariamente. Aguarde alguns segundos e tente de novo.');
    }
    if (!response.ok) {
      const message = parsed?.error?.message
        ?? (response.status === 400 ? 'Requisição inválida para a API do Gemini.'
          : response.status === 401 || response.status === 403 ? 'Chave do Gemini inválida ou sem permissão.'
          : `Erro ${response.status} ao consultar Gemini.`);
      throw new AIError(message);
    }
    if (parsed?.promptFeedback?.blockReason) {
      throw new AIError(`Resposta bloqueada pelo Gemini (${parsed.promptFeedback.blockReason}).`);
    }

    const content = parsed?.candidates?.[0]?.content?.parts
      ?.map(part => part.text ?? '')
      .join('')
      .trim() ?? '';
    if (!content) throw new AIError('Gemini não retornou conteúdo.');
    return content;
  }

  throw new AIError(lastError || 'Nenhum modelo Gemini configurado respondeu.');
}

export async function chatComplete(messages: ChatMessage[], options: ChatRequestOptions = {}) {
  if (!messages.length) throw new AIError('Nenhuma mensagem para enviar.');
  const mode = getAIMode();
  if (mode === 'groq') return chatCompleteGroq(messages, options);
  if (mode === 'gemini') return chatCompleteGemini(messages, options);
  if (mode === 'direct') return chatCompleteDirect(messages, options);
  throw new AIError('Assistente indisponível: configure VITE_GROQ_API_KEY, VITE_GEMINI_API_KEY ou VITE_OPENAI_API_KEY.');
}

export const patientChatbotAiApi = {
  ask: async (data: PatientChatbotAiRequest): Promise<PatientChatbotAiResponse> => {
    const now = new Date();
    const currentDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeZone: 'America/Sao_Paulo',
    }).format(now);
    const currentTime = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(now);
    const system = [
      'Você é a Panaceia, atendente virtual do MediConnect para pacientes.',
      'Responda sempre em português do Brasil, com tom acolhedor, objetivo e administrativo.',
      'Ajude apenas com navegação do sistema, consultas, laudos liberados, cadastro, acesso/login e contato com a secretaria.',
      'Se a pergunta não for sobre o sistema MediConnect, recuse de forma breve e redirecione para consultas, laudos, cadastro, login ou secretaria.',
      'Use a data e hora atuais informadas no contexto. Nunca invente datas, horários, consultas, laudos ou status.',
      'Não afirme ter consultado banco de dados. Você não tem permissão nem token do Supabase.',
      'Não execute, prometa ou confirme agendamento, remarcação, cancelamento, envio de mensagem ou alteração cadastral.',
      'Quando o pedido exigir ação humana, oriente a falar com a secretaria pelo botão da conversa.',
      'Não faça diagnóstico, prescrição, triagem, interpretação de laudos, orientação sobre sintomas, medicamentos ou tratamento.',
      'Se houver urgência ou emergência, oriente procurar atendimento médico imediato.',
      'Responda em no máximo 4 frases curtas.',
    ].join('\n');

    const history = (data.history ?? [])
      .slice(-8)
      .map(item => `${item.sender}: ${item.text}`)
      .join('\n');

    const userText = [
      `Paciente: ${data.patientName ?? 'paciente'}`,
      `Data atual em São Paulo: ${currentDate}`,
      `Hora atual em São Paulo: ${currentTime}`,
      history ? `Histórico recente:\n${history}` : '',
      `Mensagem do paciente:\n${data.message}`,
    ].filter(Boolean).join('\n\n');

    const answer = await chatComplete([
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ], { maxTokens: 450, temperature: 0.2 });
    return {
      answer: answer || 'Não consegui responder agora. A secretaria pode te ajudar pelo atendimento direto.',
    };
  },
};

export const managerSearchAssistantApi = {
  ask: async (data: ManagerSearchAssistantRequest): Promise<ManagerSearchAssistantResponse> => {
    const now = new Date();
    const currentDate = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'full',
      timeZone: 'America/Sao_Paulo',
    }).format(now);
    const system = [
      'Você é o Assistente de Busca Gerencial do MediConnect.',
      'Responda sempre em português do Brasil, de forma objetiva, clara e profissional.',
      'Use somente os dados no contexto recebido. Se faltar informação, diga que não há informação suficiente.',
      'Use a data atual informada no contexto. Nunca invente datas, horários, consultas, laudos ou status.',
      'Não diga que consultou banco de dados; o contexto já foi fornecido pela tela usando as permissões existentes do usuário.',
      'Não execute, prometa ou confirme criação, edição, exclusão, cancelamento, envio de mensagem ou ação financeira.',
      'Não faça diagnóstico, prescrição, orientação médica ou interpretação clínica de laudos.',
      'Para mensagens, gere apenas rascunhos para revisao humana.',
      'Responda somente ao que foi perguntado, sem adicionar resumo, recomendacoes, indicadores, riscos, observacoes, graficos ou arquivos se o gestor nao pedir explicitamente.',
      'Para perguntas simples, responda em texto curto, direto, com no maximo 4 frases ou bullets.',
      'Use JSON apenas quando o gestor pedir uma saida estruturada, resumo, relatorio, indicadores, graficos ou arquivos.',
      'Ao usar JSON, inclua somente as chaves necessarias ao pedido. Use charts e files apenas se forem solicitados explicitamente.',
      'charts deve conter especificacoes simples com id, title, type, data, xKey/yKey ou categoryKey/valueKey. Nao inclua dados sensiveis.',
    ].join('\n');

    const userText = [
      `Data atual em São Paulo: ${currentDate}`,
      `Ação solicitada: ${data.action}`,
      data.behaviorInstructions ? `Preferencias de comportamento definidas pelo gestor:\n${data.behaviorInstructions}` : '',
      `Pergunta do gestor: ${data.prompt}`,
      'Periodo:',
      JSON.stringify(data.period ?? {}),
      'Contexto administrativo sanitizado em JSON:',
      JSON.stringify(data.context ?? {}).slice(0, 14000),
    ].filter(Boolean).join('\n\n');

    const answer = await chatComplete([
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ], { maxTokens: 900, temperature: 0.2 });

    return {
      answer: answer || 'Não foi possível gerar uma resposta com os dados fornecidos.',
      warnings: [],
      source: data.context?.fonteSolicitada as ManagerSearchAssistantResponse['source'],
    };
  },
};

export const queueAiApi = {
  suggestOrder: async (data: { specialty: string; slotDate: string; slotTime: string; candidates: QueueCandidate[] }) => {
    const sanitized = data.candidates.slice(0, 20).map(candidate => ({
      patient_id: candidate.patientId,
      specialty: candidate.specialty,
      priority_level: candidate.priorityLevel,
      priority_value: candidate.priorityValue,
      waiting_days: candidate.waitingDays,
      original_date: candidate.originalDate,
      original_time: candidate.originalTime,
      age: candidate.age ?? null,
      refusal_count: candidate.refusalCount,
      can_receive_sms: candidate.canReceiveSms,
    }));

    const system = [
      'Voce e um assistente operacional de fila de antecipacao de consultas.',
      'Ordene apenas os patient_id fornecidos para contato administrativo.',
      'Nunca invente pacientes, datas ou especialidades.',
      'Nunca misture especialidades; se houver especialidade divergente, ignore o item.',
      'A decisao final e humana. Responda somente JSON valido no formato {"ordered_patient_ids":["..."],"warnings":[]}.',
    ].join('\n');

    const userText = [
      `Especialidade da vaga: ${data.specialty}`,
      `Vaga: ${data.slotDate} ${data.slotTime}`,
      'Candidatos sanitizados sem nome, CPF, telefone, email ou dados clinicos livres:',
      JSON.stringify(sanitized),
      'Critérios: maior priority_value, maior waiting_days, original_date mais próxima, idade/prioridade legal, menor refusal_count.',
    ].join('\n\n');

    const answer = await chatComplete([
      { role: 'system', content: system },
      { role: 'user', content: userText },
    ], { maxTokens: 500, temperature: 0.1 });

    const match = answer.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] ?? answer) as { ordered_patient_ids?: unknown; warnings?: unknown };
    return {
      orderedPatientIds: Array.isArray(parsed.ordered_patient_ids) ? parsed.ordered_patient_ids.map(String) : [],
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
    };
  },
};
