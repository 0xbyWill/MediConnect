import { HEALTH_KNOWLEDGE_PROMPT } from './healthKnowledge.ts';
import { agentPrompts, buildPrompt } from './prompts.ts';
import { AiProviderService } from './provider.ts';
import { AiRepository } from './repository.ts';
import type { SupabaseClientLike } from './repository.ts';
import { sanitizeText, validateSafeInstruction } from './security.ts';

type SourceType = 'faq' | 'knowledge_base' | 'correction' | 'health_knowledge' | 'fallback';
export type AiAgentProvider = Pick<AiProviderService, 'generateText' | 'generateJson' | 'generateEmbedding'>;
export type AiAgentRepository = Pick<
  AiRepository,
  | 'createConversation'
  | 'createMessage'
  | 'saveOutput'
  | 'log'
  | 'getActiveInstructions'
  | 'searchFaqs'
  | 'searchKnowledge'
  | 'getCorrections'
  | 'adminList'
  | 'adminCreate'
  | 'adminUpdate'
  | 'deactivate'
  | 'listInstructionVersions'
>;

function contextBlock(label: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) return `${label}: nenhum item encontrado.`;
  return `${label}:\n${rows.map((row, index) => {
    const safeRow = Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'embedding'));
    return `${index + 1}. ${JSON.stringify(safeRow)}`;
  }).join('\n')}`;
}

export class SupportAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider) {}

  async answer(userId: string, question: string) {
    const cleanQuestion = sanitizeText(question, 1500);
    const embedding = await this.provider.generateEmbedding(cleanQuestion);
    const [instructions, faqs, knowledge, corrections] = await Promise.all([
      this.repo.getActiveInstructions('support'),
      this.repo.searchFaqs(cleanQuestion, 8, embedding),
      this.repo.searchKnowledge(cleanQuestion, 8, embedding),
      this.repo.getCorrections(),
    ]);

    let sourceType: SourceType = 'health_knowledge';
    if (faqs.length) sourceType = 'faq';
    else if (knowledge.length) sourceType = 'knowledge_base';
    else if (corrections.length) sourceType = 'correction';

    const conversation = await this.repo.createConversation(userId, 'support');
    await this.repo.createMessage(conversation.id, 'user', cleanQuestion);

    const prompt = buildPrompt([
      agentPrompts.support,
      `Conhecimento base em saude:\n${HEALTH_KNOWLEDGE_PROMPT}`,
      contextBlock('Instrucoes administrativas', instructions),
      contextBlock('FAQs', faqs),
      contextBlock('Base de conhecimento', knowledge),
      contextBlock('Correcoes anteriores', corrections),
    ]);

    const result = await this.provider.generateJson<{ answer: string; needsHumanSupport: boolean }>([
      { role: 'system', content: prompt },
      { role: 'user', content: cleanQuestion },
    ], {
      answer: 'Nao encontrei essa informacao na base de conhecimento. Fale com o suporte humano para receber ajuda.',
      needsHumanSupport: true,
    });

    const answer = sanitizeText(result.answer, 2500);
    const aiMessage = await this.repo.createMessage(conversation.id, 'ai', answer, { sourceType, needsHumanSupport: result.needsHumanSupport });
    await this.repo.saveOutput(userId, 'support_answer', { question: cleanQuestion }, answer);
    return { answer, sourceType, needsHumanSupport: Boolean(result.needsHumanSupport), messageId: aiMessage.id };
  }
}

export class DescriptionAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider) {}

  async generate(userId: string, payload: { title: string; category: string; details: string; tone: string }) {
    const instructions = await this.repo.getActiveInstructions('description');
    const input = {
      title: sanitizeText(payload.title, 160),
      category: sanitizeText(payload.category, 100),
      details: sanitizeText(payload.details, 3000),
      tone: sanitizeText(payload.tone, 30),
    };
    const description = await this.provider.generateText([
      { role: 'system', content: buildPrompt([agentPrompts.description, contextBlock('Instrucoes administrativas', instructions)]) },
      { role: 'user', content: JSON.stringify(input) },
    ]);
    const output = await this.repo.saveOutput(userId, 'description', input, description);
    return { description, approved: false as const, outputId: output.id };
  }
}

export class CommunicationAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider) {}

  async generate(userId: string, payload: { messageType: string; context: string }) {
    const instructions = await this.repo.getActiveInstructions('user_message');
    const input = {
      messageType: sanitizeText(payload.messageType, 60),
      context: sanitizeText(payload.context, 2500),
    };
    const message = await this.provider.generateText([
      { role: 'system', content: buildPrompt([agentPrompts.communication, contextBlock('Instrucoes administrativas', instructions)]) },
      { role: 'user', content: JSON.stringify(input) },
    ]);
    const output = await this.repo.saveOutput(userId, 'user_message', input, message);
    return { message, approved: false as const, outputId: output.id };
  }
}

export class AdminAssistantAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider, private supabase: SupabaseClientLike) {}

  async chat(adminId: string, message: string) {
    const cleanMessage = sanitizeText(message, 2000);
    const instructions = await this.repo.getActiveInstructions('admin');
    const { data: conversation, error } = await this.supabase
      .from('ai_admin_conversations')
      .insert({ admin_id: adminId, status: 'open' })
      .select()
      .single();
    if (error) throw error;
    if (!conversation?.id) throw new Error('Nao foi possivel criar conversa administrativa.');
    await this.supabase.from('ai_admin_messages').insert({ conversation_id: conversation.id, sender: 'admin', content: cleanMessage });
    const answer = await this.provider.generateText([
      { role: 'system', content: buildPrompt([agentPrompts.admin, contextBlock('Instrucoes administrativas', instructions)]) },
      { role: 'user', content: cleanMessage },
    ]);
    const { data: aiMessage } = await this.supabase
      .from('ai_admin_messages')
      .insert({ conversation_id: conversation.id, sender: 'ai', content: answer })
      .select()
      .single();
    await this.repo.saveOutput(adminId, 'admin_answer', { message: cleanMessage }, answer);
    return { answer, conversationId: conversation.id, messageId: aiMessage?.id };
  }
}

export class KnowledgeManagerAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider) {}
  list() { return this.repo.adminList('ai_knowledge_documents'); }
  async create(payload: Record<string, unknown>, adminId: string) {
    const embedding = await this.provider.generateEmbedding(`${payload.title ?? ''}\n${payload.category ?? ''}\n${payload.content ?? ''}`);
    return this.repo.adminCreate('ai_knowledge_documents', { ...payload, embedding }, adminId);
  }
  async update(id: string, payload: Record<string, unknown>, adminId: string) {
    const embedding = await this.provider.generateEmbedding(`${payload.title ?? ''}\n${payload.category ?? ''}\n${payload.content ?? ''}`);
    return this.repo.adminUpdate('ai_knowledge_documents', id, { ...payload, embedding }, adminId);
  }
  deactivate(id: string, adminId: string) { return this.repo.deactivate('ai_knowledge_documents', id, adminId); }
}

export class InstructionManagerAgent {
  constructor(private repo: AiAgentRepository, private supabase: SupabaseClientLike) {}
  list() { return this.repo.adminList('ai_instructions'); }
  versions(id: string) { return this.repo.listInstructionVersions(id); }
  async create(payload: Record<string, unknown>, adminId: string) {
    validateSafeInstruction(String(payload.content ?? ''));
    const row = await this.repo.adminCreate('ai_instructions', payload, adminId);
    await this.supabase.from('ai_instruction_versions').insert({ instruction_id: row.id, content: row.content, changed_by: adminId });
    return row;
  }
  async update(id: string, payload: Record<string, unknown>, adminId: string) {
    validateSafeInstruction(String(payload.content ?? ''));
    await this.repo.adminUpdate('ai_instructions', id, payload, adminId);
    await this.supabase.from('ai_instruction_versions').insert({ instruction_id: id, content: String(payload.content ?? ''), changed_by: adminId });
  }
  deactivate(id: string, adminId: string) { return this.repo.deactivate('ai_instructions', id, adminId); }
}

export class FAQAgent {
  constructor(private repo: AiAgentRepository, private provider: AiAgentProvider) {}
  list() { return this.repo.adminList('ai_faqs'); }
  async create(payload: Record<string, unknown>, adminId: string) {
    const embedding = await this.provider.generateEmbedding(`${payload.question ?? ''}\n${payload.category ?? ''}\n${payload.answer ?? ''}`);
    return this.repo.adminCreate('ai_faqs', { ...payload, embedding }, adminId);
  }
  async update(id: string, payload: Record<string, unknown>, adminId: string) {
    const embedding = await this.provider.generateEmbedding(`${payload.question ?? ''}\n${payload.category ?? ''}\n${payload.answer ?? ''}`);
    return this.repo.adminUpdate('ai_faqs', id, { ...payload, embedding }, adminId);
  }
  deactivate(id: string, adminId: string) { return this.repo.deactivate('ai_faqs', id, adminId); }
}

export class CorrectionAgent {
  constructor(private repo: AiAgentRepository, private supabase: SupabaseClientLike) {}
  async create(payload: { messageId: string; correctAnswer: string; notes?: string }, adminId: string) {
    const { data: message, error } = await this.supabase.from('ai_messages').select('*').eq('id', payload.messageId).maybeSingle();
    if (error) throw error;
    if (!message) throw new Error('Mensagem original nao encontrada.');
    await this.supabase.from('ai_corrections').insert({
      message_id: payload.messageId,
      original_answer: message.content,
      correct_answer: sanitizeText(payload.correctAnswer, 3000),
      notes: sanitizeText(payload.notes, 2000),
      created_by: adminId,
    });
  }
}

export class AuditAndSecurityAgent {
  constructor(private repo: AiAgentRepository) {}

  async register(actionType: string, payload: { userId?: string | null; adminId?: string | null; input?: Record<string, unknown>; output?: Record<string, unknown>; status: string; error?: string }) {
    await this.repo.log(actionType, payload);
  }
}

export class AiOrchestratorAgent {
  support: SupportAgent;
  description: DescriptionAgent;
  communication: CommunicationAgent;
  adminAssistant: AdminAssistantAgent;
  knowledge: KnowledgeManagerAgent;
  instructions: InstructionManagerAgent;
  faqs: FAQAgent;
  corrections: CorrectionAgent;
  audit: AuditAndSecurityAgent;

  constructor(repo: AiRepository, provider: AiProviderService, supabase: SupabaseClientLike) {
    this.support = new SupportAgent(repo, provider);
    this.description = new DescriptionAgent(repo, provider);
    this.communication = new CommunicationAgent(repo, provider);
    this.adminAssistant = new AdminAssistantAgent(repo, provider, supabase);
    this.knowledge = new KnowledgeManagerAgent(repo, provider);
    this.instructions = new InstructionManagerAgent(repo, supabase);
    this.faqs = new FAQAgent(repo, provider);
    this.corrections = new CorrectionAgent(repo, supabase);
    this.audit = new AuditAndSecurityAgent(repo);
  }

  handleSupportQuestion(userId: string, question: string) {
    return this.support.answer(userId, question);
  }

  handleDescriptionGeneration(userId: string, payload: { title: string; category: string; details: string; tone: string }) {
    return this.description.generate(userId, payload);
  }

  handleUserMessageGeneration(userId: string, payload: { messageType: string; context: string }) {
    return this.communication.generate(userId, payload);
  }

  handleAdminChat(adminId: string, message: string) {
    return this.adminAssistant.chat(adminId, message);
  }

  handleKnowledgeUpdate(payload: Record<string, unknown>, adminId: string) {
    return this.knowledge.create(payload, adminId);
  }

  handleCorrection(payload: { messageId: string; correctAnswer: string; notes?: string }, adminId: string) {
    return this.corrections.create(payload, adminId);
  }
}
