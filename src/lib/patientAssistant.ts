// ─────────────────────────────────────────────────────────────────────────────
// Orquestrador do assistente inteligente do paciente (Panaceia).
//
// Fluxo:
// 1. Se houver chave do Gemini no navegador (VITE_GEMINI_API_KEY), executa um
//    loop de FUNCTION CALLING: o Gemini decide quais ferramentas chamar, nós as
//    executamos contra os dados já carregados no frontend e devolvemos o
//    resultado para o modelo gerar a resposta final em linguagem natural.
// 2. Se o Gemini não estiver disponível (ou falhar), usa um fallback
//    determinístico que responde com os mesmos dados reais (sem inventar nada).
// 3. Para perguntas genéricas (não relacionadas a dados), recai no assistente de
//    suporte já existente (Edge Function `ai/support`).
// ─────────────────────────────────────────────────────────────────────────────
import {
  geminiGenerateContent,
  isGeminiBrowserDirectAvailable,
  patientChatbotAiApi,
  type GeminiContent,
  type GeminiPart,
} from './aiApi';
import {
  PATIENT_ASSISTANT_TOOL_DECLARATIONS,
  buildDeterministicAnswer,
  executePatientTool,
  type PatientAssistantContext,
} from './patientAssistantTools';

export interface PatientAssistantHistoryItem {
  sender: 'bot' | 'patient' | 'system';
  text: string;
}

export interface PatientAssistantResult {
  answer: string;
  source: 'gemini-tools' | 'deterministic' | 'support';
  usedTools: string[];
}

const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(ctx: PatientAssistantContext): string {
  const now = ctx.now;
  const currentDate = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  const currentTime = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  const firstName = ctx.paciente?.nome?.split(' ')[0] || ctx.user.full_name?.split(' ')[0] || 'paciente';

  return [
    'Você é a Panaceia, assistente virtual do MediConnect que atende PACIENTES.',
    `Você está conversando com ${firstName} (paciente autenticado). Trate-o pelo primeiro nome quando fizer sentido.`,
    `Data atual em São Paulo: ${currentDate}. Hora atual: ${currentTime}.`,
    '',
    'REGRAS OBRIGATÓRIAS:',
    '- Responda sempre em português do Brasil, com tom acolhedor, claro e profissional.',
    '- Para QUALQUER pergunta sobre os dados do paciente (consultas, agendamentos, laudos, exames, perfil, telefone, e-mail, convênio, endereço, histórico, lembretes), você DEVE chamar a ferramenta apropriada e usar apenas os dados retornados.',
    '- NUNCA invente, suponha ou estime dados. Se a ferramenta não retornar a informação, diga claramente que não foi encontrada.',
    '- Os dados retornados pelas ferramentas já pertencem exclusivamente a este paciente. Nunca peça nem exponha dados de outros pacientes.',
    '- Não faça diagnóstico, prescrição, triagem, interpretação clínica de laudos, nem oriente sobre sintomas, medicamentos ou tratamento.',
    '- Não confirme nem prometa agendamento, remarcação, cancelamento ou alteração cadastral: oriente procurar a secretaria para essas ações.',
    '- Se houver sinal de emergência, oriente procurar atendimento médico imediato.',
    '- Seja conciso. Use listas curtas (com "-") quando houver vários itens (consultas, laudos). Use **negrito** apenas para destacar datas/horários ou rótulos importantes.',
    '- Formate datas no padrão brasileiro e inclua o horário quando existir.',
  ].join('\n');
}

function historyToContents(history: PatientAssistantHistoryItem[]): GeminiContent[] {
  return history
    .filter(item => item.sender === 'patient' || item.sender === 'bot')
    .slice(-6)
    .map<GeminiContent>(item => ({
      role: item.sender === 'patient' ? 'user' : 'model',
      parts: [{ text: item.text }],
    }));
}

async function runGeminiWithTools(
  ctx: PatientAssistantContext,
  message: string,
  history: PatientAssistantHistoryItem[],
): Promise<PatientAssistantResult> {
  const system = buildSystemPrompt(ctx);
  const tools = [{ functionDeclarations: PATIENT_ASSISTANT_TOOL_DECLARATIONS }];
  const usedTools: string[] = [];

  const contents: GeminiContent[] = [
    ...historyToContents(history),
    { role: 'user', parts: [{ text: message }] },
  ];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
    const content = await geminiGenerateContent({
      system,
      contents,
      tools,
      maxOutputTokens: 700,
    });
    if (!content) break;

    // Preserva o turno do modelo (incluindo functionCall / thoughtSignature).
    contents.push(content);

    const functionCalls = content.parts.filter(part => part.functionCall);
    if (functionCalls.length === 0) {
      const text = content.parts
        .map(part => part.text ?? '')
        .join('')
        .trim();
      if (text) {
        return { answer: text, source: 'gemini-tools', usedTools };
      }
      break;
    }

    const responseParts: GeminiPart[] = functionCalls.map(part => {
      const name = part.functionCall!.name;
      usedTools.push(name);
      const result = executePatientTool(name, ctx);
      return { functionResponse: { name, response: result } };
    });
    contents.push({ role: 'function', parts: responseParts });
  }

  throw new Error('Function calling não produziu resposta utilizável.');
}

export async function askPatientAssistant(params: {
  context: PatientAssistantContext;
  message: string;
  history?: PatientAssistantHistoryItem[];
}): Promise<PatientAssistantResult> {
  const { context, message } = params;
  const history = params.history ?? [];

  // 1) Function calling com Gemini (modo direto), quando disponível.
  if (isGeminiBrowserDirectAvailable()) {
    try {
      return await runGeminiWithTools(context, message, history);
    } catch {
      // Cai para o fallback determinístico abaixo.
    }
  }

  // 2) Fallback determinístico com dados reais (nunca inventa).
  const deterministic = buildDeterministicAnswer(message, context);
  if (deterministic) {
    return { answer: deterministic, source: 'deterministic', usedTools: [] };
  }

  // 3) Pergunta genérica → assistente de suporte existente (Edge Function).
  const support = await patientChatbotAiApi.ask({
    userId: context.user.id,
    message,
    patientName: context.paciente?.nome?.split(' ')[0] ?? context.user.full_name?.split(' ')[0],
    history: history.map(item => ({ sender: item.sender, text: item.text })),
  });
  return { answer: support.answer, source: 'support', usedTools: [] };
}
