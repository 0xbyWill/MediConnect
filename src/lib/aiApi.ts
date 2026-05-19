import { request } from './httpClient';
import type { ManagerSearchAssistantRequest, ManagerSearchAssistantResponse } from '../types';

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

export const managerSearchAssistantApi = {
  ask: (data: ManagerSearchAssistantRequest) =>
    request<ManagerSearchAssistantResponse>('/functions/v1/manager-search-assistant', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};
