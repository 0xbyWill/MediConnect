import { sanitizePayload } from './security.ts';

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
};

export type QueryResult<T = unknown> = Promise<{ data?: T | null; error?: Error | null; count?: number | null }>;

export type QueryBuilder<T = unknown> = {
  insert(payload: unknown): QueryBuilder<T>;
  update(payload: unknown): QueryBuilder<T>;
  select(columns?: string, options?: unknown): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  in(column: string, values: unknown[]): QueryBuilder<T>;
  or(filter: string): QueryBuilder<T>;
  order(column: string, options?: unknown): QueryBuilder<T>;
  limit(count: number): QueryBuilder<T>;
  maybeSingle(): QueryResult<T>;
  single(): QueryResult<T>;
  then<TResult1 = { data?: T[] | null; error?: Error | null; count?: number | null }, TResult2 = never>(
    onfulfilled?: ((value: { data?: T[] | null; error?: Error | null; count?: number | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
};

export type SupabaseClientLike = {
  auth: {
    getUser(): QueryResult<{ user?: SupabaseUser }>;
  };
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T>;
  rpc<T = Record<string, unknown>>(functionName: string, args?: Record<string, unknown>): QueryResult<T[]>;
};

type AiRow = Record<string, unknown> & { id: string; content?: string; output_text?: string };

export class AiRepository {
  constructor(private supabase: SupabaseClientLike) {}

  async createConversation(userId: string | null, type: string): Promise<AiRow> {
    const { data, error } = await this.supabase
      .from('ai_conversations')
      .insert({ user_id: userId, type, status: 'open' })
      .select()
      .single();
    if (error) throw error;
    return data as AiRow;
  }

  async createMessage(conversationId: string, sender: string, content: string, metadata: Record<string, unknown> = {}): Promise<AiRow> {
    const { data, error } = await this.supabase
      .from('ai_messages')
      .insert({ conversation_id: conversationId, sender, content, metadata: sanitizePayload(metadata) })
      .select()
      .single();
    if (error) throw error;
    return data as AiRow;
  }

  async saveOutput(userId: string | null, type: string, inputData: Record<string, unknown>, outputText: string): Promise<AiRow> {
    const { data, error } = await this.supabase
      .from('ai_generated_outputs')
      .insert({ user_id: userId, type, input_data: sanitizePayload(inputData), output_text: outputText, approved: false })
      .select()
      .single();
    if (error) throw error;
    return data as AiRow;
  }

  async log(actionType: string, payload: { userId?: string | null; adminId?: string | null; input?: Record<string, unknown>; output?: Record<string, unknown>; status: string; error?: string }) {
    await this.supabase.from('ai_action_logs').insert({
      user_id: payload.userId ?? null,
      admin_id: payload.adminId ?? null,
      action_type: actionType,
      input_payload: sanitizePayload(payload.input ?? {}),
      output_payload: sanitizePayload(payload.output ?? {}),
      status: payload.status,
      error_message: payload.error ? String(payload.error).slice(0, 500) : null,
    });
  }

  async getActiveInstructions(scope: string): Promise<AiRow[]> {
    const { data, error } = await this.supabase
      .from('ai_instructions')
      .select('*')
      .eq('active', true)
      .in('scope', ['general', scope])
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []) as AiRow[];
  }

  async searchFaqs(query: string, limit = 5, embedding: number[] | null = null): Promise<AiRow[]> {
    if (embedding?.length) {
      const { data, error } = await this.supabase.rpc('match_ai_faqs', {
        query_embedding: embedding,
        match_count: limit,
      });
      if (!error && data?.length) return data as AiRow[];
    }

    const safeQuery = query.replace(/[%_*]/g, ' ').slice(0, 200);
    const { data, error } = await this.supabase
      .from('ai_faqs')
      .select('*')
      .eq('active', true)
      .or(`question.ilike.%${safeQuery}%,answer.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%`)
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AiRow[];
  }

  async searchKnowledge(query: string, limit = 5, embedding: number[] | null = null): Promise<AiRow[]> {
    if (embedding?.length) {
      const { data, error } = await this.supabase.rpc('match_ai_knowledge_documents', {
        query_embedding: embedding,
        match_count: limit,
      });
      if (!error && data?.length) return data as AiRow[];
    }

    const safeQuery = query.replace(/[%_*]/g, ' ').slice(0, 200);
    const { data, error } = await this.supabase
      .from('ai_knowledge_documents')
      .select('*')
      .eq('active', true)
      .or(`title.ilike.%${safeQuery}%,content.ilike.%${safeQuery}%,category.ilike.%${safeQuery}%`)
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AiRow[];
  }

  async getCorrections(limit = 5): Promise<AiRow[]> {
    const { data, error } = await this.supabase
      .from('ai_corrections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as AiRow[];
  }

  async adminList(table: string): Promise<AiRow[]> {
    const { data, error } = await this.supabase.from(table).select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return (data ?? []) as AiRow[];
  }

  async adminCreate(table: string, payload: Record<string, unknown>, adminId: string): Promise<AiRow> {
    const { data, error } = await this.supabase
      .from(table)
      .insert({ ...sanitizePayload(payload), created_by: adminId, updated_by: adminId })
      .select()
      .single();
    if (error) throw error;
    return data as AiRow;
  }

  async listInstructionVersions(instructionId: string): Promise<AiRow[]> {
    const { data, error } = await this.supabase
      .from('ai_instruction_versions')
      .select('*')
      .eq('instruction_id', instructionId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as AiRow[];
  }

  async adminUpdate(table: string, id: string, payload: Record<string, unknown>, adminId: string) {
    const { error } = await this.supabase.from(table).update({ ...sanitizePayload(payload), updated_by: adminId }).eq('id', id);
    if (error) throw error;
  }

  async deactivate(table: string, id: string, adminId: string) {
    const { error } = await this.supabase.from(table).update({ active: false, updated_by: adminId }).eq('id', id);
    if (error) throw error;
  }
}
