import { maskSensitive } from './security.ts';

export interface AiProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class AiProviderService {
  private apiKey = Deno.env.get('AI_API_KEY') ?? '';
  private model = Deno.env.get('AI_MODEL') ?? 'gpt-4o-mini';
  private embeddingModel = Deno.env.get('AI_EMBEDDING_MODEL') ?? 'text-embedding-3-small';
  private provider = Deno.env.get('AI_PROVIDER') ?? 'openai';
  private temperature = Number(Deno.env.get('AI_TEMPERATURE') ?? '0.2');
  private maxTokens = Number(Deno.env.get('AI_MAX_TOKENS') ?? '700');

  async generateText(messages: AiProviderMessage[]) {
    if (!this.apiKey) {
      return 'Nao encontrei configuracao ativa do provedor de IA. Encaminhe para suporte humano.';
    }

    try {
      const result = await this.callModel(messages);
      return maskSensitive(result.trim());
    } catch {
      return this.handleProviderError();
    }
  }

  async generateJson<T>(messages: AiProviderMessage[], fallback: T): Promise<T> {
    const text = await this.generateText(messages);
    try {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      const json = jsonStart >= 0 && jsonEnd >= jsonStart ? text.slice(jsonStart, jsonEnd + 1) : text;
      return JSON.parse(json) as T;
    } catch {
      return fallback;
    }
  }

  async generateEmbedding(input: string): Promise<number[] | null> {
    if (!this.apiKey) return null;
    if (this.provider !== 'openai') return null;

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: maskSensitive(input).slice(0, 8000),
        }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const embedding = data?.data?.[0]?.embedding;
      return Array.isArray(embedding) ? embedding.map(Number) : null;
    } catch {
      return null;
    }
  }

  private async callModel(messages: AiProviderMessage[]) {
    if (this.provider !== 'openai') {
      throw new Error(`Provider nao suportado neste MVP: ${this.provider}`);
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      }),
    });

    if (!response.ok) throw new Error(`Falha no provedor de IA: ${response.status}`);
    const data = await response.json();
    return String(data?.choices?.[0]?.message?.content ?? '');
  }

  private handleProviderError() {
    return 'Nao consegui gerar uma resposta agora. Encaminhe para suporte humano.';
  }
}
