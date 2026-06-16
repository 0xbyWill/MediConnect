import type { ChatbotIntent, ChatbotOption } from '../../types';

export const CHATBOT_INITIAL_MESSAGE =
  'Olá! Eu sou a Panaceia, sua assistente do MediConnect. Posso consultar seus dados reais, explicar termos médicos de forma geral, orientar sobre preparo de exames e ajudar com consultas, laudos e cadastro. Por exemplo: "Tenho consultas marcadas?", "O que significa hemograma?" ou "Como me preparo para exame de sangue?". Como posso ajudar?';

export const CHATBOT_RESOLUTION_PROMPT = 'Isso resolveu sua dúvida?';

export const CHATBOT_MEDICAL_BLOCK_MESSAGE =
  'Não posso orientar sobre diagnóstico, sintomas pessoais, medicações ou tratamento do seu caso. Para isso, entre em contato com a equipe médica ou agende uma consulta. Posso ajudar com informações gerais sobre saúde, preparo de exames e uso do sistema.';

export const CHATBOT_EMERGENCY_MESSAGE =
  'Se for uma emergência, procure atendimento médico imediato ou ligue para o serviço de emergência da sua região.';

export const CHATBOT_SUPPORT_SUCCESS_MESSAGE =
  'Sua solicitação foi enviada para a secretaria. Em breve alguém entrará em contato.';

export const CHATBOT_OPTIONS: ChatbotOption[] = [
  {
    id: 'appointments',
    label: 'Minhas consultas',
    response: 'Você pode visualizar suas consultas na área Registro ou na área de consultas do paciente, conforme disponível no seu perfil.',
  },
  {
    id: 'reschedule',
    label: 'Remarcar consulta',
    response: 'Para remarcar uma consulta, envie uma solicitação para a secretaria informando a consulta desejada e o melhor horário para contato.',
    opensSupport: true,
  },
  {
    id: 'cancel',
    label: 'Cancelar consulta',
    response: 'Para cancelar uma consulta, entre em contato com a secretaria. Essa ação precisa ser confirmada para evitar cancelamentos indevidos.',
    opensSupport: true,
  },
  {
    id: 'reports',
    label: 'Acessar laudos',
    response: 'Os laudos liberados ficam disponíveis na tela Registro do paciente. Caso algum laudo não apareça, ele pode ainda não ter sido liberado.',
  },
  {
    id: 'update-data',
    label: 'Atualizar meus dados',
    response: 'Para atualizar dados cadastrais, solicite atendimento da secretaria informando quais dados precisam ser corrigidos.',
    opensSupport: true,
  },
  {
    id: 'login-issues',
    label: 'Problemas com login',
    response: 'Verifique se o e-mail informado está correto. Caso continue com dificuldades, solicite suporte da secretaria.',
    opensSupport: true,
  },
  {
    id: 'secretary',
    label: 'Falar com a secretaria',
    response: 'Descreva sua dúvida ou solicitação. A secretaria receberá sua mensagem e poderá entrar em contato.',
    opensSupport: true,
  },
];

export const CHATBOT_RESPONSES: Record<ChatbotIntent, string> = CHATBOT_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.id]: option.response }),
  {} as Record<ChatbotIntent, string>
);

export const CHATBOT_EMERGENCY_KEYWORDS = [
  'emergência',
  'emergencia',
  'urgência',
  'urgencia',
  'socorro',
  'desmaio',
  'falta de ar',
  'dor no peito',
  'sangramento',
  'acidente',
];
