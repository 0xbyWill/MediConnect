import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, MessageCircle, X } from 'lucide-react';
import type { ChatbotMessage } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  CHATBOT_INITIAL_MESSAGE,
  CHATBOT_OPTIONS,
  CHATBOT_RESOLUTION_PROMPT,
} from '../shared/constants/chatbot';

const PANACEIA_AVATAR_SRC = '/WhatsApp Image 2026-05-07 at 19.38.48.jpeg';

interface PatientChatbotProps {
  onOpenSecretaryChat: () => void;
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

export default function PatientChatbot({ onOpenSecretaryChat }: PatientChatbotProps) {
  const { user } = useAuth();
  const isPatient = user?.role === 'paciente';
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatbotMessage[]>([
    createMessage('bot', CHATBOT_INITIAL_MESSAGE, 'initial'),
  ]);
  const [awaitingResolution, setAwaitingResolution] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const patientName = useMemo(() => user?.full_name?.split(' ')[0] || 'paciente', [user?.full_name]);

  useEffect(() => {
    if (!open) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [open, messages]);

  if (!isPatient) return null;

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
                    {message.text.split('\n').map((line, index) => (
                      <p key={`${message.id}-${index}`}>{line}</p>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="patient-chatbot-footer">
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
