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
import { HEALTH_KNOWLEDGE_PROMPT, CHATBOT_RESPONSE_QUALITY_RULES, AI_PROFESSIONAL_TEXT_RULES } from '../shared/constants/healthKnowledge';

export interface PatientAssistantHistoryItem {
  sender: 'bot' | 'patient' | 'system';
  text: string;
}

export interface PatientHealthConcern {
  urgent?: boolean;
  personal?: boolean;
}

export interface PatientAssistantResult {
  answer: string;
  source: 'gemini-tools' | 'deterministic' | 'support';
  usedTools: string[];
}

const MAX_TOOL_ITERATIONS = 6;

function buildSystemPrompt(ctx: PatientAssistantContext, healthConcern?: PatientHealthConcern): string {
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
    'Você é a Panaceia, assistente virtual inteligente do MediConnect que atende PACIENTES.',
    `Você está conversando com ${firstName} (paciente autenticado). Trate-o pelo primeiro nome quando fizer sentido.`,
    `Data atual em São Paulo: ${currentDate}. Hora atual: ${currentTime}.`,
    '',
    'CAPACIDADES:',
    '- Consultar dados reais do paciente via ferramentas (consultas, laudos, perfil, histórico).',
    '- Explicar termos médicos, doenças e condições de saúde de forma geral (ex.: "o que é bronquite", "o que é diabetes").',
    '- Acolher relatos de sintomas pessoais e orientar com empatia: especialista indicado, consulta e exames que o médico pode solicitar — sem diagnosticar.',
    '- Orientar preparo para consultas/exames e esclarecer a estrutura de laudos (Achados, Análise, Conclusão, Recomendações).',
    '- Orientar sobre fluxos do sistema, direitos do paciente e saúde preventiva em nível educativo.',
    '',
    HEALTH_KNOWLEDGE_PROMPT,
    '',
    'REGRAS OBRIGATÓRIAS:',
    `- ${CHATBOT_RESPONSE_QUALITY_RULES}`,
    `- ${AI_PROFESSIONAL_TEXT_RULES}`,
    '- Responda SEMPRE à mensagem do paciente. Nunca recuse por achar que está fora do escopo — tente ajudar de forma útil.',
    '- PROIBIDO: respostas genéricas, listas de capacidades ("posso ajudar com...") ou encerrar sem orientação concreta.',
    '- Responda sempre em português do Brasil, com tom acolhedor, claro e profissional.',
    '- Cite a queixa ou pergunta do paciente na resposta. Estrutura: acolhimento → informação específica → próximo passo (especialista, consulta, exame ou secretaria).',
    '- Para QUALQUER pergunta sobre os dados do paciente (consultas, agendamentos, laudos, exames, perfil, telefone, e-mail, convênio, endereço, histórico, lembretes), você DEVE chamar a ferramenta apropriada e usar apenas os dados retornados.',
    '- NUNCA invente, suponha ou estime dados. Se a ferramenta não retornar a informação, diga claramente que não foi encontrada.',
    '- Os dados retornados pelas ferramentas já pertencem exclusivamente a este paciente. Nunca peça nem exponha dados de outros pacientes.',
    '- NÃO diagnostique, NÃO prescreva, NÃO indique medicamentos/doses e NÃO interprete laudos individuais do paciente.',
    '- Quando o paciente relatar sintomas ou preocupações pessoais, acolha, explique o contexto geral, indique especialista adequado, sugira consulta/exames possíveis e convide a falar com a secretaria para agendar.',
    '- Se não souber ou não tiver dados suficientes: diga honestamente e oriente o melhor caminho (profissional indicado, urgência PS/SAMU vs consulta eletiva, secretaria).',
    '- Não confirme nem prometa agendamento, remarcação, cancelamento ou alteração cadastral: oriente procurar a secretaria para essas ações.',
    healthConcern?.urgent
      ? '- URGÊNCIA POSSÍVEL: comece orientando pronto-socorro ou SAMU (192) se os sintomas forem intensos ou súbitos; em seguida indique especialista e consulta de acompanhamento.'
      : '',
    healthConcern?.personal && !healthConcern?.urgent
      ? '- O paciente relatou sintoma ou queixa pessoal nesta mensagem: priorize acolhimento, especialista indicado e sugestão de consulta/exames.'
      : '',
    '- Seja útil e completo quando necessário (até 6 parágrafos curtos). Use listas curtas (com "-") para vários itens. Use **negrito** apenas para destacar datas/horários ou rótulos importantes.',
    '- Formate datas no padrão brasileiro e inclua o horário quando existir.',
  ].filter(Boolean).join('\n');
}

function historyToContents(history: PatientAssistantHistoryItem[]): GeminiContent[] {
  return history
    .filter(item => item.sender === 'patient' || item.sender === 'bot')
    .slice(-8)
    .map<GeminiContent>(item => ({
      role: item.sender === 'patient' ? 'user' : 'model',
      parts: [{ text: item.text }],
    }));
}

async function runGeminiWithTools(
  ctx: PatientAssistantContext,
  message: string,
  history: PatientAssistantHistoryItem[],
  healthConcern?: PatientHealthConcern,
): Promise<PatientAssistantResult> {
  const system = buildSystemPrompt(ctx, healthConcern);
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
      maxOutputTokens: 900,
      temperature: 0.35,
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
  healthConcern?: PatientHealthConcern;
}): Promise<PatientAssistantResult> {
  const { context, message, healthConcern } = params;
  const history = params.history ?? [];

  // 1) Function calling com Gemini (modo direto), quando disponível.
  if (isGeminiBrowserDirectAvailable()) {
    try {
      return await runGeminiWithTools(context, message, history, healthConcern);
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
    healthConcern,
  });
  return { answer: support.answer, source: 'support', usedTools: [] };
}
