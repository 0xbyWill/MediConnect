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
  userId: string;
  message: string;
  patientName?: string;
  history?: Array<{ sender: 'bot' | 'patient' | 'system'; text: string }>;
}

export interface PatientChatbotAiResponse {
  answer: string;
}

export class AIError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AIError';
    this.cause = cause;
  }
}

const GEMINI_FALLBACK_KEY = String(import.meta.env.VITE_GEMINI_API_KEY ?? '').trim();
const GEMINI_FALLBACK_MODEL = String(import.meta.env.VITE_GEMINI_MODEL ?? 'gemini-1.5-flash').trim();
const GEMINI_MODEL_FALLBACKS = [
  'gemini-1.5-flash',
  'gemini-1.5-flash-latest',
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

function canUseGeminiFallback() {
  return Boolean(GEMINI_FALLBACK_KEY);
}

async function askDevGemini(system: string, userText: string, maxOutputTokens = 700): Promise<string> {
  if (!canUseGeminiFallback()) {
    throw new AIError('Assistente indisponível neste ambiente.');
  }

  const models = Array.from(new Set([GEMINI_FALLBACK_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(Boolean)));
  let lastError = 'Não foi possível consultar o assistente agora.';

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': GEMINI_FALLBACK_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens,
        },
      }),
    });

    if (response.status === 404 || response.status === 400) {
      lastError = 'Modelo do assistente indisponível.';
      continue;
    }

    if (!response.ok) {
      throw new AIError('Não foi possível consultar o assistente agora.');
    }

    const data = await response.json();
    const answer = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('')
      .trim();

    if (answer) return answer;
    lastError = 'O assistente não retornou resposta.';
  }

  throw new AIError(lastError);
}

// ─── Function calling do Gemini (modo direto no navegador) ────────────────────
export interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

export interface GeminiFunctionResponse {
  name: string;
  response: Record<string, unknown>;
}

export interface GeminiPart {
  text?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: GeminiFunctionResponse;
  thoughtSignature?: string;
}

export interface GeminiContent {
  role: 'user' | 'model' | 'function';
  parts: GeminiPart[];
}

export interface GeminiToolDeclaration {
  functionDeclarations: ReadonlyArray<{
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
  }>;
}

export function isGeminiBrowserDirectAvailable(): boolean {
  return canUseGeminiFallback();
}

/**
 * Chamada de baixo nível ao Gemini (modo direto no navegador) com suporte a
 * function calling. Reaproveita a chave/modelo já configurados (VITE_GEMINI_*).
 * Retorna o `content` do candidato (que pode conter `functionCall`s ou texto).
 */
export async function geminiGenerateContent(params: {
  system: string;
  contents: GeminiContent[];
  tools?: GeminiToolDeclaration[];
  maxOutputTokens?: number;
  temperature?: number;
}): Promise<GeminiContent | null> {
  if (!canUseGeminiFallback()) {
    throw new AIError('Assistente indisponível neste ambiente.');
  }

  const models = Array.from(new Set([GEMINI_FALLBACK_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(Boolean)));
  let lastError = 'Não foi possível consultar o assistente agora.';

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': GEMINI_FALLBACK_KEY,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: params.system }] },
        contents: params.contents,
        ...(params.tools && params.tools.length ? { tools: params.tools } : {}),
        generationConfig: {
          temperature: params.temperature ?? 0.2,
          maxOutputTokens: params.maxOutputTokens ?? 700,
        },
      }),
    });

    if (response.status === 404 || response.status === 400) {
      lastError = 'Modelo do assistente indisponível.';
      continue;
    }

    if (!response.ok) {
      throw new AIError('Não foi possível consultar o assistente agora.');
    }

    const data = await response.json();
    const content = data?.candidates?.[0]?.content;
    if (content && Array.isArray(content.parts)) {
      return {
        role: content.role === 'model' || content.role === 'user' || content.role === 'function' ? content.role : 'model',
        parts: content.parts as GeminiPart[],
      };
    }
    lastError = 'O assistente não retornou resposta.';
  }

  throw new AIError(lastError);
}

function sourceForAction(action: ManagerSearchAssistantRequest['action']): ManagerSearchAssistantResponse['source'] {
  if (action === 'financial_summary') return 'financial';
  if (action === 'doctor_performance') return 'doctors';
  if (action === 'message_draft') return 'patients';
  if (action === 'missed_appointments' || action.includes('summary')) return 'appointments';
  return 'mixed';
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

export const patientChatbotAiApi = {
  ask: async (data: PatientChatbotAiRequest): Promise<PatientChatbotAiResponse> => {
    try {
      const answer = await aiApi.support({
        userId: data.userId,
        question: data.message,
      });
      return {
        answer: answer.answer || 'Não consegui responder agora. A secretaria pode te ajudar pelo atendimento direto.',
      };
    } catch (err) {
      if (!canUseGeminiFallback()) throw err;

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
      const history = (data.history ?? [])
        .slice(-8)
        .map(item => `${item.sender}: ${item.text}`)
        .join('\n');
      const system = [
        'Você é a Panaceia, atendente virtual do MediConnect para pacientes.',
        'Responda sempre em português do Brasil, com tom acolhedor, objetivo e administrativo.',
        'Ajude apenas com navegação do sistema, consultas, laudos liberados, cadastro, acesso/login e contato com a secretaria.',
        'Não execute, prometa ou confirme agendamento, remarcação, cancelamento, envio de mensagem ou alteração cadastral.',
        'Não faça diagnóstico, prescrição, triagem, interpretação de laudos, orientação sobre sintomas, medicamentos ou tratamento.',
        'Se houver urgência ou emergência, oriente procurar atendimento médico imediato.',
        'Responda em no máximo 4 frases curtas.',
      ].join('\n');
      const userText = [
        `Paciente: ${data.patientName ?? 'paciente'}`,
        `Data atual em São Paulo: ${currentDate}`,
        `Hora atual em São Paulo: ${currentTime}`,
        history ? `Histórico recente:\n${history}` : '',
        `Mensagem do paciente:\n${data.message}`,
      ].filter(Boolean).join('\n\n');

      return { answer: await askDevGemini(system, userText, 450) };
    }
  },
};

export const managerSearchAssistantApi = {
  ask: async (data: ManagerSearchAssistantRequest): Promise<ManagerSearchAssistantResponse> => {
    try {
      return await request<ManagerSearchAssistantResponse>('/functions/v1/manager-search-assistant', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (!canUseGeminiFallback()) throw err;

      const currentDate = new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'full',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date());
      const system = [
        'Você é o Assistente de Busca Gerencial do MediConnect.',
        'Responda sempre em português do Brasil, de forma objetiva, clara e profissional.',
        'Use somente os dados no contexto recebido. Se faltar informação, diga que não há informação suficiente.',
        'Não execute, prometa ou confirme criação, edição, exclusão, cancelamento, envio de mensagem ou ação financeira.',
        'Não faça diagnóstico, prescrição, orientação médica ou interpretação clínica de laudos.',
        'Para mensagens, gere apenas rascunhos para revisão humana.',
        'Responda somente ao que foi perguntado. Use JSON apenas quando o gestor pedir saída estruturada, resumo, relatório, indicadores, gráficos ou arquivos.',
      ].join('\n');
      const userText = [
        `Data atual em São Paulo: ${currentDate}`,
        `Ação solicitada: ${data.action}`,
        data.behaviorInstructions ? `Preferências de comportamento:\n${data.behaviorInstructions}` : '',
        `Pergunta do gestor: ${data.prompt}`,
        'Período:',
        JSON.stringify(data.period ?? {}),
        'Contexto administrativo sanitizado em JSON:',
        JSON.stringify(data.context ?? {}).slice(0, 14000),
      ].filter(Boolean).join('\n\n');

      return {
        answer: await askDevGemini(system, userText, 900),
        warnings: ['Resposta gerada diretamente pelo modelo de IA (modo direto, sem a função do servidor).'],
        source: sourceForAction(data.action),
      };
    }
  },
};

export const queueAiApi = {
  suggestOrder: async (data: { specialty: string; slotDate: string; slotTime: string; candidates: QueueCandidate[] }) => {
    const ordered = [...data.candidates].sort((a, b) =>
      b.priorityValue - a.priorityValue ||
      b.waitingDays - a.waitingDays ||
      a.originalDate.localeCompare(b.originalDate) ||
      (b.age ?? 0) - (a.age ?? 0) ||
      a.refusalCount - b.refusalCount
    );
    if (canUseGeminiFallback() && ordered.length > 0) {
      try {
        const sanitized = ordered.slice(0, 20).map(candidate => ({
          patient_id: candidate.patientId,
          priority_level: candidate.priorityLevel,
          priority_value: candidate.priorityValue,
          waiting_days: candidate.waitingDays,
          original_date: candidate.originalDate,
          original_time: candidate.originalTime,
          age: candidate.age ?? null,
          refusal_count: candidate.refusalCount,
          can_receive_sms: candidate.canReceiveSms,
          reasons: candidate.reasons,
        }));
        const answer = await askDevGemini(
          [
            'Você é um assistente operacional de fila de antecipação de consultas.',
            'Ordene apenas os patient_id fornecidos para realocação administrativa.',
            'Priorize maior prioridade, maior espera, consulta original mais próxima, prioridade legal e menos recusas.',
            'Responda somente JSON válido no formato {"ordered_patient_ids":["..."],"warnings":[]}.',
          ].join('\n'),
          [
            `Especialidade: ${data.specialty}`,
            `Horário cancelado: ${data.slotDate} ${data.slotTime}`,
            'Candidatos sem dados sensíveis:',
            JSON.stringify(sanitized),
          ].join('\n\n'),
          500
        );
        const match = answer.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(match?.[0] ?? answer) as { ordered_patient_ids?: unknown; warnings?: unknown };
        const validIds = new Set(ordered.map(candidate => candidate.patientId));
        const ids = Array.isArray(parsed.ordered_patient_ids)
          ? parsed.ordered_patient_ids.map(String).filter(id => validIds.has(id))
          : [];
        if (ids.length > 0) {
          const missing = ordered.map(candidate => candidate.patientId).filter(id => !ids.includes(id));
          return {
            orderedPatientIds: [...new Set([...ids, ...missing])],
            warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
          };
        }
      } catch {
        // Fallback determinístico abaixo.
      }
    }
    return {
      orderedPatientIds: ordered.map(candidate => candidate.patientId),
      warnings: ['Ordenação feita por critérios locais de prioridade.'],
    };
  },
};
