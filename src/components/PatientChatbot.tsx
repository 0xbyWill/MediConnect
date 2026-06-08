import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { HelpCircle, Loader2, MessageCircle, Send, X } from 'lucide-react';
import type { Agendamento, ChatbotMessage, Laudo, Paciente, PageType } from '../types';
import type { ApiDoctor } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { askPatientAssistant } from '../lib/patientAssistant';
import type { PatientAssistantContext } from '../lib/patientAssistantTools';
import {
  CHATBOT_EMERGENCY_KEYWORDS,
  CHATBOT_EMERGENCY_MESSAGE,
  CHATBOT_INITIAL_MESSAGE,
  CHATBOT_MEDICAL_BLOCK_MESSAGE,
  CHATBOT_MEDICAL_KEYWORDS,
  CHATBOT_OPTIONS,
  CHATBOT_RESOLUTION_PROMPT,
} from '../shared/constants/chatbot';

const PANACEIA_AVATAR_SRC = '/WhatsApp Image 2026-05-07 at 19.38.48.jpeg';

interface PatientChatbotProps {
  onOpenSecretaryChat: () => void;
  onNavigate: (page: PageType) => void;
  pacientes?: Paciente[];
  agendamentos?: Agendamento[];
  laudos?: Laudo[];
  doctors?: ApiDoctor[];
}

function nowISO() {
  return new Date().toISOString();
}

function createMessage(sender: ChatbotMessage['sender'], text: string, kind?: ChatbotMessage['kind']): ChatbotMessage {
  return {
    id: `${sender}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    sender,
    text,
    kind,
    createdAt: nowISO(),
  };
}

// Renderizador leve de markdown (negrito + listas) — sem dependências externas
// e sem dangerouslySetInnerHTML, para manter a segurança.
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const bold = part.match(/^\*\*([^*]+)\*\*$/);
    if (bold) return <strong key={`${keyPrefix}-b-${index}`}>{bold[1]}</strong>;
    return <span key={`${keyPrefix}-t-${index}`}>{part}</span>;
  });
}

function renderRichText(text: string, idPrefix: string): ReactNode {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const items = [...listItems];
    blocks.push(
      <ul key={`${idPrefix}-ul-${blocks.length}`} className="patient-chatbot-list">
        {items.map((item, index) => (
          <li key={`${idPrefix}-li-${blocks.length}-${index}`}>{renderInline(item, `${idPrefix}-li-${blocks.length}-${index}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const bulletMatch = line.match(/^\s*[-*•]\s+(.*)$/);
    if (bulletMatch) {
      listItems.push(bulletMatch[1]);
      return;
    }
    flushList();
    if (line.trim()) {
      blocks.push(
        <p key={`${idPrefix}-p-${index}`}>{renderInline(line, `${idPrefix}-p-${index}`)}</p>,
      );
    }
  });
  flushList();

  return blocks.length ? blocks : <p>{text}</p>;
}

export default function PatientChatbot({
  onOpenSecretaryChat,
  onNavigate,
  pacientes = [],
  agendamentos = [],
  laudos = [],
  doctors = [],
}: PatientChatbotProps) {
  const { user } = useAuth();
  const isPatient = user?.role === 'paciente';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    createMessage('bot', CHATBOT_INITIAL_MESSAGE, 'initial'),
  ]);
  const [awaitingResolution, setAwaitingResolution] = useState(false);
  const [freeText, setFreeText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const patientName = useMemo(() => user?.full_name?.split(' ')[0] || 'paciente', [user?.full_name]);

  // Localiza o cadastro do próprio paciente entre os dados já carregados pelo App.
  const ownPaciente = useMemo<Paciente | null>(() => {
    if (!user) return null;
    const byEmail = pacientes.find(p => p.email?.toLowerCase() === user.email.toLowerCase());
    const byId = pacientes.find(p => p.id === user.patient_id || p.id === user.id);
    return byEmail ?? byId ?? pacientes[0] ?? null;
  }, [pacientes, user]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, messages, aiLoading]);

  if (!isPatient || !user) return null;

  const pushMessages = (...nextMessages: ChatbotMessage[]) => {
    setMessages(prev => [...prev, ...nextMessages].slice(-30));
  };

  const handleOption = (optionId: string) => {
    const option = CHATBOT_OPTIONS.find(item => item.id === optionId);
    if (!option) return;

    if (option.id === 'secretary') {
      pushMessages(
        createMessage('patient', option.label),
        createMessage('bot', 'Vou abrir sua conversa com a secretaria agora. Por lá, você fala diretamente com a equipe administrativa.', 'support')
      );
      setAwaitingResolution(false);
      window.setTimeout(() => {
        setOpen(false);
        onOpenSecretaryChat();
      }, 450);
      return;
    }

    pushMessages(
      createMessage('patient', option.label),
      createMessage('bot', option.response, 'answer')
    );
    setAwaitingResolution(true);
  };

  const handleFreeText = async (event: FormEvent) => {
    event.preventDefault();
    const message = freeText.trim();
    if (!message || aiLoading) return;

    const normalized = message.toLowerCase();
    setFreeText('');
    setAwaitingResolution(false);
    pushMessages(createMessage('patient', message));

    if (isCurrentDateTimeQuestion(message)) {
      pushMessages(createMessage('bot', currentDateTimeAnswer(), 'answer'));
      setAwaitingResolution(true);
      return;
    }

    // Emergência e bloqueio clínico têm prioridade máxima (segurança).
    if (CHATBOT_EMERGENCY_KEYWORDS.some(keyword => normalized.includes(keyword))) {
      pushMessages(createMessage('bot', CHATBOT_EMERGENCY_MESSAGE, 'safety'));
      setAwaitingResolution(true);
      return;
    }

    if (CHATBOT_MEDICAL_KEYWORDS.some(keyword => normalized.includes(keyword))) {
      pushMessages(createMessage('bot', CHATBOT_MEDICAL_BLOCK_MESSAGE, 'safety'));
      setAwaitingResolution(true);
      return;
    }

    // Navegação apenas quando há pedido explícito (ex.: "abrir agenda").
    const navigationIntent = getExplicitNavigationIntent(message);
    if (navigationIntent) {
      pushMessages(createMessage('bot', navigationIntent.message, 'answer'));
      setAwaitingResolution(false);
      window.setTimeout(() => {
        setOpen(false);
        onNavigate(navigationIntent.page);
      }, 550);
      return;
    }

    // Ações que exigem a secretaria (agendar, remarcar, cancelar, alterar dados).
    if (needsSecretary(message)) {
      pushMessages(createMessage('bot', 'Esse pedido precisa da secretaria para confirmar dados e registrar a solicitação. Posso abrir a conversa direta para você continuar por lá.', 'support'));
      setAwaitingResolution(true);
      return;
    }

    if (!isSystemRelatedQuestion(message)) {
      pushMessages(createMessage('bot', 'Posso ajudar apenas com assuntos do MediConnect: suas consultas, laudos liberados, dados de cadastro, lembretes, login, mensagens e contato com a secretaria.', 'safety'));
      setAwaitingResolution(true);
      return;
    }

    setAiLoading(true);
    try {
      const context: PatientAssistantContext = {
        user,
        paciente: ownPaciente,
        agendamentos,
        laudos,
        doctors,
        now: new Date(),
      };
      const response = await askPatientAssistant({
        context,
        message,
        history: messages.slice(-8).map(item => ({ sender: item.sender, text: item.text })),
      });
      pushMessages(createMessage('bot', response.answer, 'answer'));
      setAwaitingResolution(true);
    } catch {
      pushMessages(
        createMessage(
          'bot',
          'Não consegui responder agora. A secretaria pode te ajudar pelo atendimento direto.',
          'support'
        )
      );
      setAwaitingResolution(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleResolved = () => {
    pushMessages(
      createMessage('patient', 'Sim, resolveu'),
      createMessage('bot', `Perfeito, ${patientName}. Continuo por aqui se precisar de outra ajuda administrativa.`, 'answer')
    );
    setAwaitingResolution(false);
  };

  const handleSecretary = () => {
    pushMessages(
      createMessage('patient', 'Quero falar com a secretaria'),
      createMessage('bot', 'Certo. Vou te levar para a conversa com a secretaria.', 'support')
    );
    setAwaitingResolution(false);
    window.setTimeout(() => {
      setOpen(false);
      onOpenSecretaryChat();
    }, 450);
  };

  return (
    <>
      <button
        type="button"
        className="patient-chatbot-fab"
        style={{
          position: 'fixed',
          right: 22,
          bottom: 22,
          zIndex: 900,
          width: 52,
          height: 52,
          border: 0,
          borderRadius: 14,
          background: 'var(--primary)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 14px 30px rgba(0, 166, 63, 0.28)',
        }}
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Fechar atendimento da Panaceia' : 'Abrir atendimento da Panaceia'}
      >
        {open ? <X size={20} aria-hidden="true" /> : <MessageCircle size={21} aria-hidden="true" />}
      </button>

      {open && (
        <section className="patient-chatbot-panel" aria-label="Atendimento virtual Panaceia">
          <header className="patient-chatbot-header">
            <span className="patient-chatbot-header-avatar" aria-hidden="true">
              <img src={PANACEIA_AVATAR_SRC} alt="" />
            </span>
            <div>
              <h2>Panaceia</h2>
              <p><span aria-hidden="true" />Atendente virtual online</p>
            </div>
          </header>

          <div className="patient-chatbot-body" aria-live="polite">
            <div className="patient-chatbot-messages">
              {messages.map(message => (
                <div key={message.id} className={`patient-chatbot-row patient-chatbot-row-${message.sender}`}>
                  {(message.sender === 'bot' || message.sender === 'system') && (
                    <span className="patient-chatbot-bubble-avatar" aria-hidden="true">
                      <img src={PANACEIA_AVATAR_SRC} alt="" />
                    </span>
                  )}
                  <div className={`patient-chatbot-message patient-chatbot-message-${message.sender}`}>
                    {renderRichText(message.text, message.id)}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="patient-chatbot-row patient-chatbot-row-bot">
                  <span className="patient-chatbot-bubble-avatar" aria-hidden="true">
                    <img src={PANACEIA_AVATAR_SRC} alt="" />
                  </span>
                  <div className="patient-chatbot-message patient-chatbot-message-bot patient-chatbot-typing" aria-label="Panaceia está digitando">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="patient-chatbot-footer">
            <form className="patient-chatbot-compose" onSubmit={handleFreeText}>
              <label htmlFor="patient-chatbot-message">Mensagem para a Panaceia</label>
              <div>
                <textarea
                  id="patient-chatbot-message"
                  value={freeText}
                  onChange={event => setFreeText(event.target.value.slice(0, 600))}
                  disabled={aiLoading}
                  maxLength={600}
                  rows={2}
                  placeholder="Digite sua dúvida..."
                />
                <button type="submit" disabled={aiLoading || !freeText.trim()} aria-label="Enviar mensagem para a Panaceia">
                  {aiLoading ? <Loader2 size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                </button>
              </div>
            </form>

            {!awaitingResolution ? (
              <div className="patient-chatbot-options" aria-label="Escolha uma opção de atendimento">
                {CHATBOT_OPTIONS.map(option => (
                  <button key={option.id} type="button" onClick={() => handleOption(option.id)}>
                    <HelpCircle size={14} aria-hidden="true" />
                    {option.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="patient-chatbot-resolution">
                <span>{CHATBOT_RESOLUTION_PROMPT}</span>
                <div>
                  <button type="button" onClick={handleResolved}>
                    Sim, resolveu
                  </button>
                  <button type="button" onClick={handleSecretary}>
                    Falar com a secretaria
                  </button>
                </div>
              </div>
            )}
          </footer>

          <style>{`
            .patient-chatbot-fab {
              position: fixed;
              right: 22px;
              bottom: 22px;
              z-index: 900;
              width: 52px;
              height: 52px;
              border: 0;
              border-radius: 14px;
              background: var(--primary);
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 14px 30px rgba(0, 166, 63, 0.28);
            }

            .patient-chatbot-panel {
              position: fixed;
              right: 22px;
              bottom: 86px;
              z-index: 900;
              width: min(390px, calc(100vw - 28px));
              height: min(620px, calc(100dvh - 110px));
              display: flex;
              flex-direction: column;
              overflow: hidden;
              border: 1px solid rgba(15,118,75,0.14);
              border-radius: 16px;
              background: #fff;
              box-shadow: 0 22px 48px rgba(15, 23, 42, 0.18);
            }

            .patient-chatbot-header {
              display: flex;
              align-items: center;
              gap: 12px;
              padding: 14px 16px;
              background: var(--primary);
              color: #fff;
            }

            .patient-chatbot-header-avatar {
              width: 42px;
              height: 42px;
              border-radius: 50%;
              background: #fff;
              border: 2px solid rgba(255,255,255,0.72);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              overflow: hidden;
            }

            .patient-chatbot-header-avatar img,
            .patient-chatbot-bubble-avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .patient-chatbot-header h2 {
              margin: 0;
              font-size: 15px;
              font-weight: 800;
              color: #fff;
            }

            .patient-chatbot-header p {
              margin-top: 2px;
              font-size: 12px;
              color: rgba(255,255,255,0.78);
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 6px;
            }

            .patient-chatbot-header p span {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #86efac;
              box-shadow: 0 0 0 3px rgba(134,239,172,.2);
            }

            .patient-chatbot-body {
              flex: 1;
              min-height: 0;
              padding: 14px;
              overflow-y: auto;
              scrollbar-width: none;
              background:
                linear-gradient(rgba(243, 248, 245, .92), rgba(243, 248, 245, .92)),
                repeating-linear-gradient(135deg, rgba(0,166,63,.05) 0 1px, transparent 1px 12px);
            }

            .patient-chatbot-body::-webkit-scrollbar {
              display: none;
            }

            .patient-chatbot-messages {
              display: flex;
              min-height: 100%;
              flex-direction: column;
              justify-content: flex-end;
              gap: 9px;
            }

            .patient-chatbot-row {
              display: flex;
              align-items: flex-end;
              gap: 7px;
            }

            .patient-chatbot-row-patient {
              justify-content: flex-end;
            }

            .patient-chatbot-row-bot,
            .patient-chatbot-row-system {
              justify-content: flex-start;
            }

            .patient-chatbot-bubble-avatar {
              width: 28px;
              height: 28px;
              border-radius: 50%;
              border: 1px solid rgba(0,166,63,.16);
              background: #fff;
              overflow: hidden;
              flex: 0 0 auto;
            }

            .patient-chatbot-message {
              max-width: 84%;
              padding: 10px 12px;
              border-radius: 14px;
              font-size: 13px;
              line-height: 1.45;
              overflow-wrap: anywhere;
              box-shadow: 0 1px 2px rgba(15,23,42,.05);
            }

            .patient-chatbot-message p + p {
              margin-top: 7px;
            }

            .patient-chatbot-message strong {
              font-weight: 800;
            }

            .patient-chatbot-list {
              margin: 6px 0 0;
              padding-left: 18px;
              display: grid;
              gap: 4px;
            }

            .patient-chatbot-list li {
              list-style: disc;
            }

            .patient-chatbot-typing {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 12px 14px;
            }

            .patient-chatbot-typing span {
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: var(--gray-400, #94a3b8);
              animation: patient-chatbot-bounce 1.2s infinite ease-in-out;
            }

            .patient-chatbot-typing span:nth-child(2) {
              animation-delay: 0.2s;
            }

            .patient-chatbot-typing span:nth-child(3) {
              animation-delay: 0.4s;
            }

            @keyframes patient-chatbot-bounce {
              0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
              30% { transform: translateY(-4px); opacity: 1; }
            }

            .patient-chatbot-message-bot {
              background: #fff;
              border: 1px solid var(--gray-100);
              color: var(--gray-800);
              border-bottom-left-radius: 5px;
            }

            .patient-chatbot-message-system {
              max-width: 92%;
              background: #e8f8ef;
              border: 1px solid rgba(0,166,63,.14);
              color: var(--dark);
              text-align: center;
              font-size: 12px;
            }

            .patient-chatbot-message-patient {
              background: #dcfce7;
              border: 1px solid rgba(0,166,63,.16);
              color: var(--dark);
              border-bottom-right-radius: 5px;
            }

            .patient-chatbot-footer {
              flex-shrink: 0;
              padding: 12px;
              border-top: 1px solid var(--gray-100);
              background: #fff;
            }

            .patient-chatbot-compose {
              display: grid;
              gap: 6px;
              margin-bottom: 10px;
            }

            .patient-chatbot-compose label {
              font-size: 11px;
              font-weight: 800;
              color: var(--gray-600);
              text-transform: uppercase;
              letter-spacing: 0;
            }

            .patient-chatbot-compose > div {
              display: grid;
              grid-template-columns: 1fr 42px;
              gap: 8px;
              align-items: stretch;
            }

            .patient-chatbot-compose textarea {
              width: 100%;
              min-height: 42px;
              max-height: 92px;
              resize: vertical;
              border: 1px solid var(--gray-200);
              border-radius: 10px;
              padding: 9px 10px;
              color: var(--gray-800);
              font: inherit;
              font-size: 13px;
              line-height: 1.35;
              outline: none;
            }

            .patient-chatbot-compose button {
              width: 42px;
              min-height: 42px;
              border: 0;
              border-radius: 10px;
              background: var(--primary);
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
            }

            .patient-chatbot-compose button:disabled {
              background: var(--gray-300);
              cursor: not-allowed;
            }

            .patient-chatbot-options {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 8px;
            }

            .patient-chatbot-options button,
            .patient-chatbot-resolution button {
              min-height: 42px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 6px;
              border: 1px solid rgba(0, 166, 63, 0.20);
              border-radius: 10px;
              padding: 8px 10px;
              background: #fff;
              color: var(--gray-700);
              font-size: 12px;
              font-weight: 800;
              text-align: center;
            }

            .patient-chatbot-resolution > span {
              display: block;
              margin: 0 0 9px;
              color: var(--gray-700);
              font-size: 12px;
              font-weight: 800;
            }

            .patient-chatbot-resolution div {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 8px;
            }

            @media (max-width: 560px) {
              .patient-chatbot-fab {
                right: 14px;
                bottom: 14px;
              }

              .patient-chatbot-panel {
                right: 14px;
                bottom: 76px;
                width: calc(100vw - 28px);
                height: calc(100dvh - 92px);
              }
            }
          `}</style>
        </section>
      )}
    </>
  );
}

function needsSecretary(message: string) {
  const normalized = message.toLowerCase();
  return [
    'agendar',
    'marcar consulta',
    'remarcar',
    'cancelar',
    'alterar meus dados',
    'atualizar meus dados',
    'trocar telefone',
    'trocar email',
    'mudar email',
    'falar com secretaria',
    'secretaria',
  ].some(term => normalized.includes(term));
}

const NAVIGATION_VERBS = [
  'abrir',
  'abre',
  'abra',
  'ir para',
  'ir pra',
  'ir a',
  'me leva',
  'me leve',
  'leva para',
  'leve para',
  'acessar',
  'acesse',
  'navegar',
  'mostrar a tela',
  'mostra a tela',
  'ver a tela',
  'abrir a tela',
  'abrir a area',
  'abrir a área',
];

function getExplicitNavigationIntent(message: string): { page: PageType; message: string } | null {
  const normalized = message.toLowerCase();
  // Só navega quando o paciente pede explicitamente para abrir/ir até uma tela.
  if (!NAVIGATION_VERBS.some(verb => normalized.includes(verb))) return null;
  return getNavigationIntent(message);
}

function getNavigationIntent(message: string): { page: PageType; message: string } | null {
  const normalized = message.toLowerCase();

  if (matchesAny(normalized, ['secretaria', 'mensagem', 'mensagens', 'suporte', 'atendimento', 'falar com alguem', 'falar com alguém'])) {
    return {
      page: 'mensagens',
      message: 'Vou abrir a área de mensagens para você falar com a secretaria.',
    };
  }

  if (matchesAny(normalized, ['laudo', 'laudos', 'resultado', 'resultados', 'exame', 'exames'])) {
    return {
      page: 'laudos',
      message: 'Vou levar você para a área de laudos liberados.',
    };
  }

  if (matchesAny(normalized, ['registro', 'histórico', 'historico', 'meu cadastro', 'meus dados', 'perfil', 'minha conta'])) {
    return {
      page: 'registro',
      message: 'Vou abrir seu registro para você conferir seus dados e histórico.',
    };
  }

  if (matchesAny(normalized, ['agenda', 'agendamento', 'agendar', 'consulta', 'consultas', 'marcar consulta', 'minhas consultas'])) {
    return {
      page: 'agenda',
      message: 'Vou abrir a agenda para você consultar seus horários.',
    };
  }

  if (matchesAny(normalized, ['inicio', 'início', 'dashboard', 'home', 'principal'])) {
    return {
      page: 'dashboard',
      message: 'Vou levar você para a página inicial.',
    };
  }

  return null;
}

function matchesAny(text: string, terms: string[]) {
  return terms.some(term => text.includes(term));
}

function isCurrentDateTimeQuestion(message: string) {
  const normalized = message.toLowerCase();
  const asksToday = [
    'que dia e hoje',
    'que dia é hoje',
    'qual dia e hoje',
    'qual dia é hoje',
    'data de hoje',
    'hora atual',
    'horario atual',
    'horário atual',
    'agora',
  ].some(term => normalized.includes(term));
  const asksClock = ['que horas', 'qual horario', 'qual horário'].some(term => normalized.includes(term));
  return asksToday || asksClock;
}

function currentDateTimeAnswer() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'full',
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  const time = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(now);
  return `Hoje é ${date}. Agora são ${time}, no horário de São Paulo.`;
}

function isSystemRelatedQuestion(message: string) {
  const normalized = message.toLowerCase();
  return [
    'mediconnect',
    'panaceia',
    'sistema',
    'consulta',
    'consultas',
    'agendamento',
    'agendar',
    'agenda',
    'remarcar',
    'cancelar',
    'laudo',
    'laudos',
    'resultado',
    'exame',
    'registro',
    'cadastro',
    'dados',
    'email',
    'e-mail',
    'telefone',
    'senha',
    'login',
    'acesso',
    'entrar',
    'secretaria',
    'mensagem',
    'mensagens',
    'suporte',
    'perfil',
    'minha conta',
    'meu perfil',
    'paciente',
    'médico',
    'medico',
    'clínica',
    'clinica',
  ].some(term => normalized.includes(term));
}
