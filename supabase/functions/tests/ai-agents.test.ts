import { DescriptionAgent, SupportAgent } from '../_shared/ai/agents.ts';
import type { AiAgentRepository } from '../_shared/ai/agents.ts';

function assertEquals(actual: unknown, expected: unknown, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label}: esperado ${JSON.stringify(expected)}, recebido ${JSON.stringify(actual)}`);
  }
}

function createMockRepo(overrides: Partial<AiAgentRepository> = {}): AiAgentRepository {
  return { ...baseRepo(), ...overrides };
}

function baseRepo(): AiAgentRepository {
  return {
    createConversation: async () => ({ id: 'conversation-1' }),
    createMessage: async (_conversationId: string, sender: string, content: string) => ({ id: `message-${sender}`, content }),
    saveOutput: async (_userId: string | null, type: string, _inputData: Record<string, unknown>, outputText: string) => ({ id: `output-${type}`, output_text: outputText }),
    log: async () => undefined,
    getActiveInstructions: async () => [],
    searchFaqs: async () => [],
    searchKnowledge: async () => [],
    getCorrections: async () => [],
    adminList: async () => [],
    adminCreate: async (_table: string, payload: Record<string, unknown>) => ({ id: 'created-1', ...payload }),
    adminUpdate: async () => undefined,
    deactivate: async () => undefined,
    listInstructionVersions: async () => [],
  };
}

const mockProvider = {
  generateText: async () => 'Texto gerado pelo mock.',
  generateJson: async <T>(_messages: unknown[], fallback: T) => ({
    ...fallback,
    answer: 'Resposta baseada em FAQ.',
    needsHumanSupport: false,
  }) as T,
  generateEmbedding: async () => [0.1, 0.2, 0.3],
};

Deno.test('SupportAgent responde com FAQ quando ha contexto', async () => {
  const repo = createMockRepo({
    searchFaqs: async () => [{ id: 'faq-1', question: 'Como vejo laudos?', answer: 'Acesse Laudos.', category: 'uso' }],
  });
  const agent = new SupportAgent(repo, mockProvider);

  const result = await agent.answer('user-1', 'Como vejo meus laudos?');

  assertEquals(result.sourceType, 'faq', 'sourceType');
  assertEquals(result.needsHumanSupport, false, 'needsHumanSupport');
  assertEquals(result.answer, 'Resposta baseada em FAQ.', 'answer');
});

Deno.test('SupportAgent usa fallback quando nao ha contexto', async () => {
  const agent = new SupportAgent(createMockRepo(), mockProvider);

  const result = await agent.answer('user-1', 'Pergunta desconhecida');

  assertEquals(result.sourceType, 'fallback', 'sourceType');
  assertEquals(result.needsHumanSupport, true, 'needsHumanSupport');
});

Deno.test('DescriptionAgent salva output como rascunho', async () => {
  const savedTypes: string[] = [];
  const repo = createMockRepo({
    saveOutput: async (_userId: string | null, type: string, _inputData: Record<string, unknown>, outputText: string) => {
      savedTypes.push(type);
      return { id: 'output-description', output_text: outputText };
    },
  });
  const agent = new DescriptionAgent(repo, mockProvider);

  const result = await agent.generate('user-1', {
    title: 'Consulta inicial',
    category: 'Atendimento',
    details: 'Avaliacao geral',
    tone: 'professional',
  });

  assertEquals(result.approved, false, 'approved');
  assertEquals(savedTypes, ['description'], 'saved type');
});
