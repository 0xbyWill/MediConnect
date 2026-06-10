import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ComponentType, FormEvent, KeyboardEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUp,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCircle2,
  FileText,
  Headset,
  KeyRound,
  Loader2,
  Mic,
  Paperclip,
  Sparkles,
  UserCog,
  X,
} from 'lucide-react';
import type { Agendamento, ChatbotMessage, Laudo, Paciente, PageType } from '../types';
import { messagesApi, type ApiDoctor } from '../lib/api';
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

type LucideIcon = ComponentType<{ size?: number | string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

// Anexos: validados no frontend por MIME e tamanho (barreira inicial, não única).
const ATTACHMENT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,application/pdf';
const ATTACHMENT_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;
const ATTACHMENT_MAX_COUNT = 5;

interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
  isImage: boolean;
}

// Tipagem mínima da Web Speech API (não faz parte do lib.dom padrão de forma estável).
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Metadados puramente visuais para transformar as opções em cards ricos.
// Não altera a lógica de atendimento — apenas ícone e descrição curta.
const OPTION_META: Record<string, { icon: LucideIcon; hint: string }> = {
  appointments: { icon: CalendarCheck, hint: 'Veja suas consultas marcadas' },
  reschedule: { icon: CalendarClock, hint: 'Encontre um novo horário' },
  cancel: { icon: CalendarX, hint: 'Cancele com a secretaria' },
  reports: { icon: FileText, hint: 'Acesse laudos liberados' },
  'update-data': { icon: UserCog, hint: 'Atualize seu cadastro' },
  'login-issues': { icon: KeyRound, hint: 'Resolva problemas de acesso' },
  secretary: { icon: Headset, hint: 'Fale com a equipe' },
};

// Sugestões em destaque: apenas as ações mais usadas pelo paciente.
// As demais opções continuam acessíveis pelo texto livre e pela lógica existente.
const FEATURED_OPTION_IDS = ['appointments', 'reports', 'reschedule', 'secretary'];

// Realce visual de mensagens sensíveis (segurança, suporte, sucesso).
const KIND_META: Partial<Record<NonNullable<ChatbotMessage['kind']>, { icon: LucideIcon; label: string; tone: string }>> = {
  safety: { icon: AlertTriangle, label: 'Atenção', tone: 'safety' },
  support: { icon: Headset, label: 'Atendimento', tone: 'support' },
  success: { icon: CheckCircle2, label: 'Concluído', tone: 'success' },
};

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
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const voiceBaseTextRef = useRef('');
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  attachmentsRef.current = attachments;
  const voiceSupported = useMemo(() => getSpeechRecognitionCtor() !== null, []);
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
  }, [open, messages, aiLoading, attachments]);

  // Encerra reconhecimento de voz e libera os object URLs ao desmontar.
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      attachmentsRef.current.forEach(item => URL.revokeObjectURL(item.url));
    };
  }, []);

  // Registra a solicitação no chat interno para que a secretaria veja o contato.
  const persistSecretaryHandoff = useCallback(async (text: string) => {
    const patientId = ownPaciente?.id;
    if (!patientId) return;
    try {
      await messagesApi.create({ patient_id: patientId, author: 'paciente', body: text });
    } catch {
      // Envio é best-effort: a navegação para o chat acontece de qualquer forma.
    }
  }, [ownPaciente?.id]);

  // Mantido após os hooks para respeitar a ordem fixa de hooks do React.
  if (!isPatient || !user) return null;

  const pushMessages = (...nextMessages: ChatbotMessage[]) => {
    setMessages(prev => [...prev, ...nextMessages].slice(-30));
  };

  // ----- Comando por voz (Web Speech API) -----
  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const toggleVoice = () => {
    if (aiLoading || !voiceSupported) return;
    if (isListening) {
      stopListening();
      return;
    }
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = true;
    voiceBaseTextRef.current = freeText.trim();
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = event => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      const base = voiceBaseTextRef.current;
      const combined = base ? `${base} ${transcript}` : transcript;
      setFreeText(combined.slice(0, 600));
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // ----- Anexar arquivos -----
  const openFilePicker = () => {
    if (aiLoading) return;
    setAttachError(null);
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const fileList = event.target.files;
    event.target.value = '';
    if (!fileList || fileList.length === 0) return;

    const accepted: ChatAttachment[] = [];
    let invalid = false;
    Array.from(fileList).forEach(file => {
      const okType = ATTACHMENT_ACCEPTED_TYPES.includes(file.type);
      const okSize = file.size <= ATTACHMENT_MAX_SIZE;
      if (!okType || !okSize) {
        invalid = true;
        return;
      }
      accepted.push({
        id: `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
      });
    });

    setAttachments(prev => {
      const room = Math.max(0, ATTACHMENT_MAX_COUNT - prev.length);
      const allowed = accepted.slice(0, room);
      accepted.slice(allowed.length).forEach(item => URL.revokeObjectURL(item.url));
      return [...prev, ...allowed];
    });
    setAttachError(invalid ? 'Use imagens (PNG, JPG, WEBP, GIF) ou PDF de até 10 MB.' : null);
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => {
      const target = prev.find(item => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter(item => item.id !== id);
    });
  };

  const clearAttachments = () => {
    setAttachments(prev => {
      prev.forEach(item => URL.revokeObjectURL(item.url));
      return [];
    });
    setAttachError(null);
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
      void persistSecretaryHandoff('Olá, gostaria de falar com a secretaria.');
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
    if (aiLoading) return;
    if (isListening) stopListening();
    const message = freeText.trim();

    // Anexos vão para a secretaria: a IA ainda não interpreta arquivos.
    if (attachments.length > 0) {
      const names = attachments.map(item => item.name).join(', ');
      const patientText = message ? `${message}\n\n**Anexo(s):** ${names}` : `**Anexo(s):** ${names}`;
      setFreeText('');
      pushMessages(
        createMessage('patient', patientText),
        createMessage(
          'bot',
          'Recebi seu anexo. A Panaceia ainda não analisa arquivos diretamente, então registrei seu envio e encaminhei para a secretaria dar sequência.',
          'support',
        ),
      );
      void persistSecretaryHandoff(`Anexo(s) enviado(s) pelo paciente: ${names}${message ? ` — ${message}` : ''}`);
      clearAttachments();
      setAwaitingResolution(true);
      return;
    }

    if (!message) return;

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

  // Enter envia, Shift+Enter quebra linha — padrão ChatGPT/Claude.
  // Apenas dispara o submit existente, sem mudar a lógica de envio.
  const handleComposeKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
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
    void persistSecretaryHandoff('Olá, gostaria de falar com a secretaria.');
    window.setTimeout(() => {
      setOpen(false);
      onOpenSecretaryChat();
    }, 450);
  };

  return (
    <>
      <button
        type="button"
        className={`pcb-fab${open ? ' pcb-fab-open' : ''}`}
        onClick={() => setOpen(value => !value)}
        aria-label={open ? 'Fechar atendimento da Panaceia' : 'Abrir atendimento da Panaceia'}
      >
        {open ? (
          <X size={22} aria-hidden="true" />
        ) : (
          <>
            <span className="pcb-fab-avatar" aria-hidden="true">
              <img src={PANACEIA_AVATAR_SRC} alt="" />
            </span>
            <span className="pcb-fab-presence" aria-hidden="true" />
          </>
        )}
      </button>

      {open && (
        <section className="pcb-panel" aria-label="Assistente de IA Panaceia" role="dialog">
          <header className="pcb-header">
            <div className="pcb-identity">
              <span className="pcb-avatar" aria-hidden="true">
                <img src={PANACEIA_AVATAR_SRC} alt="" />
                <span className="pcb-presence" />
              </span>
              <div className="pcb-identity-text">
                <h2>
                  Panaceia
                  <Sparkles size={15} aria-hidden="true" />
                </h2>
                <p>
                  <span className="pcb-status-dot" aria-hidden="true" />
                  Assistente IA · Online
                </p>
              </div>
            </div>
            <button
              type="button"
              className="pcb-header-close"
              onClick={() => setOpen(false)}
              aria-label="Fechar atendimento da Panaceia"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </header>

          <div className="pcb-body" aria-live="polite">
            <div className="pcb-messages">
              {messages.map((message, index) => {
                const isPatientMsg = message.sender === 'patient';
                const kindMeta = !isPatientMsg && message.kind ? KIND_META[message.kind] : undefined;
                return (
                  <div
                    key={message.id}
                    className={`pcb-row pcb-row-${isPatientMsg ? 'patient' : 'bot'}`}
                    style={{ animationDelay: `${Math.min(index, 6) * 35}ms` }}
                  >
                    {!isPatientMsg && (
                      <span className="pcb-msg-avatar" aria-hidden="true">
                        <img src={PANACEIA_AVATAR_SRC} alt="" />
                      </span>
                    )}
                    <div
                      className={`pcb-bubble pcb-bubble-${isPatientMsg ? 'patient' : 'bot'}${
                        kindMeta ? ` pcb-bubble-${kindMeta.tone}` : ''
                      }`}
                    >
                      {kindMeta && (
                        <span className={`pcb-bubble-tag pcb-bubble-tag-${kindMeta.tone}`}>
                          <kindMeta.icon size={13} aria-hidden="true" />
                          {kindMeta.label}
                        </span>
                      )}
                      <div className="pcb-bubble-text">{renderRichText(message.text, message.id)}</div>
                    </div>
                  </div>
                );
              })}

              {aiLoading && (
                <div className="pcb-row pcb-row-bot">
                  <span className="pcb-msg-avatar" aria-hidden="true">
                    <img src={PANACEIA_AVATAR_SRC} alt="" />
                  </span>
                  <div className="pcb-bubble pcb-bubble-bot pcb-typing" aria-label="Panaceia está pensando">
                    <span className="pcb-typing-label">
                      <Sparkles size={13} aria-hidden="true" />
                      Panaceia está pensando
                    </span>
                    <span className="pcb-typing-dots"><span /><span /><span /></span>
                  </div>
                </div>
              )}

              {!awaitingResolution && !aiLoading && (
                <div className="pcb-suggestions" aria-label="Sugestões rápidas">
                  <span className="pcb-suggestions-title">
                    <Sparkles size={14} aria-hidden="true" />
                    Sugestões rápidas
                  </span>
                  <div className="pcb-suggestions-grid">
                    {FEATURED_OPTION_IDS.map(id => {
                      const option = CHATBOT_OPTIONS.find(item => item.id === id);
                      if (!option) return null;
                      const meta = OPTION_META[option.id];
                      const Icon = meta?.icon ?? Sparkles;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className="pcb-suggestion"
                          onClick={() => handleOption(option.id)}
                        >
                          <span className="pcb-suggestion-icon" aria-hidden="true">
                            <Icon size={18} />
                          </span>
                          <span className="pcb-suggestion-body">
                            <span className="pcb-suggestion-label">{option.label}</span>
                            {meta?.hint && <span className="pcb-suggestion-hint">{meta.hint}</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {awaitingResolution && !aiLoading && (
                <div className="pcb-resolution" aria-label="Isso resolveu sua dúvida?">
                  <span className="pcb-resolution-title">{CHATBOT_RESOLUTION_PROMPT}</span>
                  <div className="pcb-resolution-actions">
                    <button type="button" className="pcb-resolution-yes" onClick={handleResolved}>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      Sim, resolveu
                    </button>
                    <button type="button" className="pcb-resolution-no" onClick={handleSecretary}>
                      <Headset size={15} aria-hidden="true" />
                      Falar com a secretaria
                    </button>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="pcb-footer">
            <form ref={formRef} className="pcb-compose" onSubmit={handleFreeText}>
              <label htmlFor="patient-chatbot-message" className="pcb-sr-only">
                Mensagem para a Panaceia
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept={ATTACHMENT_ACCEPT}
                multiple
                className="pcb-sr-only"
                onChange={handleFilesSelected}
                tabIndex={-1}
                aria-hidden="true"
              />

              {attachments.length > 0 && (
                <div className="pcb-attachments" aria-label="Anexos selecionados">
                  {attachments.map(att => (
                    <div key={att.id} className="pcb-attachment">
                      {att.isImage ? (
                        <img src={att.url} alt="" className="pcb-attachment-thumb" />
                      ) : (
                        <span className="pcb-attachment-thumb pcb-attachment-thumb-file" aria-hidden="true">
                          <FileText size={16} />
                        </span>
                      )}
                      <span className="pcb-attachment-info">
                        <span className="pcb-attachment-name">{att.name}</span>
                        <span className="pcb-attachment-size">{formatFileSize(att.size)}</span>
                      </span>
                      <button
                        type="button"
                        className="pcb-attachment-remove"
                        onClick={() => removeAttachment(att.id)}
                        aria-label={`Remover anexo ${att.name}`}
                      >
                        <X size={13} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {attachError && (
                <p className="pcb-attach-error" role="alert">
                  {attachError}
                </p>
              )}

              <div className={`pcb-input-shell${isListening ? ' pcb-input-shell-recording' : ''}`}>
                <button
                  type="button"
                  className="pcb-tool-btn"
                  onClick={openFilePicker}
                  disabled={aiLoading}
                  title="Anexar arquivo"
                  aria-label="Anexar arquivo"
                >
                  <Paperclip size={18} aria-hidden="true" />
                </button>
                <textarea
                  id="patient-chatbot-message"
                  value={freeText}
                  onChange={event => setFreeText(event.target.value.slice(0, 600))}
                  onKeyDown={handleComposeKeyDown}
                  disabled={aiLoading}
                  maxLength={600}
                  rows={1}
                  placeholder={isListening ? 'Ouvindo... pode falar' : 'Pergunte algo à Panaceia...'}
                />
                {voiceSupported && (
                  <button
                    type="button"
                    className={`pcb-tool-btn${isListening ? ' pcb-tool-btn-recording' : ''}`}
                    onClick={toggleVoice}
                    disabled={aiLoading}
                    title={isListening ? 'Parar gravação' : 'Falar com a Panaceia'}
                    aria-label={isListening ? 'Parar gravação de voz' : 'Ditar mensagem por voz'}
                    aria-pressed={isListening}
                  >
                    <Mic size={18} aria-hidden="true" />
                  </button>
                )}
                <button
                  type="submit"
                  className="pcb-send-btn"
                  disabled={aiLoading || (!freeText.trim() && attachments.length === 0)}
                  aria-label="Enviar mensagem para a Panaceia"
                >
                  {aiLoading ? (
                    <Loader2 className="pcb-spin" size={18} aria-hidden="true" />
                  ) : (
                    <ArrowUp size={18} aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="pcb-disclaimer">
                {isListening
                  ? 'Gravando sua mensagem por voz...'
                  : 'A Panaceia ajuda com assuntos do MediConnect. Em emergências, procure atendimento médico.'}
              </p>
            </form>
          </footer>
        </section>
      )}

      <style>{`
            .pcb-fab {
              position: fixed;
              right: 22px;
              bottom: 22px;
              z-index: 900;
              width: 60px;
              height: 60px;
              padding: 0;
              border: 0;
              border-radius: 18px;
              background: linear-gradient(140deg, var(--primary), var(--darker));
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              box-shadow: 0 16px 34px rgba(0, 166, 63, 0.34);
              transition: transform .2s ease, box-shadow .2s ease;
            }

            .pcb-fab:hover {
              transform: translateY(-2px) scale(1.03);
              box-shadow: 0 20px 40px rgba(0, 166, 63, 0.42);
            }

            .pcb-fab:active {
              transform: scale(0.97);
            }

            .pcb-fab-open {
              border-radius: 16px;
            }

            .pcb-fab-avatar {
              width: 44px;
              height: 44px;
              border-radius: 14px;
              overflow: hidden;
              border: 2px solid rgba(255,255,255,0.7);
              display: inline-flex;
            }

            .pcb-fab-avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .pcb-fab-presence {
              position: absolute;
              right: 8px;
              top: 8px;
              width: 13px;
              height: 13px;
              border-radius: 50%;
              background: #4ade80;
              border: 2px solid #fff;
              box-shadow: 0 0 0 0 rgba(74,222,128,.6);
              animation: pcb-pulse 2s infinite;
            }

            .pcb-panel {
              position: fixed;
              right: 22px;
              bottom: 92px;
              z-index: 900;
              width: min(420px, calc(100vw - 28px));
              height: min(700px, calc(100dvh - 120px));
              display: flex;
              flex-direction: column;
              overflow: hidden;
              border: 1px solid rgba(15,118,75,0.14);
              border-radius: 22px;
              background: #fff;
              box-shadow: 0 30px 70px rgba(15, 23, 42, 0.26);
              transform-origin: bottom right;
              animation: pcb-panel-in .26s cubic-bezier(.16,1,.3,1);
            }

            .pcb-header {
              position: relative;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              padding: 16px 18px;
              color: #fff;
              background:
                radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,.18), transparent 55%),
                linear-gradient(135deg, var(--primary), var(--darker));
            }

            .pcb-identity {
              display: flex;
              align-items: center;
              gap: 13px;
              min-width: 0;
            }

            .pcb-avatar {
              position: relative;
              width: 52px;
              height: 52px;
              border-radius: 16px;
              background: #fff;
              border: 2px solid rgba(255,255,255,0.85);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              overflow: hidden;
              box-shadow: 0 6px 16px rgba(0,0,0,.18);
            }

            .pcb-avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .pcb-presence {
              position: absolute;
              right: -2px;
              bottom: -2px;
              width: 15px;
              height: 15px;
              border-radius: 50%;
              background: #4ade80;
              border: 2.5px solid var(--darker);
              box-shadow: 0 0 0 0 rgba(74,222,128,.6);
              animation: pcb-pulse 2s infinite;
            }

            .pcb-identity-text {
              min-width: 0;
            }

            .pcb-identity-text h2 {
              margin: 0;
              font-size: 18px;
              font-weight: 800;
              color: #fff;
              letter-spacing: -.01em;
              display: flex;
              align-items: center;
              gap: 6px;
            }

            .pcb-identity-text h2 svg {
              color: #d9ffe7;
            }

            .pcb-identity-text p {
              margin-top: 3px;
              font-size: 12.5px;
              color: rgba(255,255,255,0.82);
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 7px;
            }

            .pcb-status-dot {
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: #86efac;
              box-shadow: 0 0 0 3px rgba(134,239,172,.22);
              animation: pcb-blink 2.4s infinite;
            }

            .pcb-header-close {
              flex-shrink: 0;
              width: 36px;
              height: 36px;
              border: 0;
              border-radius: 12px;
              background: rgba(255,255,255,0.16);
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: background .15s ease;
            }

            .pcb-header-close:hover {
              background: rgba(255,255,255,0.28);
            }

            .pcb-body {
              flex: 1;
              min-height: 0;
              padding: 18px 16px;
              overflow-y: auto;
              scroll-behavior: smooth;
              scrollbar-width: thin;
              scrollbar-color: rgba(0,166,63,.25) transparent;
              background:
                radial-gradient(110% 60% at 50% 0%, rgba(0,166,63,.05), transparent 60%),
                linear-gradient(180deg, #f7fbf9, #f3f8f5);
            }

            .pcb-body::-webkit-scrollbar {
              width: 7px;
            }

            .pcb-body::-webkit-scrollbar-thumb {
              background: rgba(0,166,63,.22);
              border-radius: 99px;
            }

            .pcb-messages {
              display: flex;
              flex-direction: column;
              gap: 14px;
            }

            .pcb-row {
              display: flex;
              align-items: flex-end;
              gap: 9px;
              animation: pcb-msg-in .32s cubic-bezier(.16,1,.3,1) both;
            }

            .pcb-row-patient {
              justify-content: flex-end;
            }

            .pcb-row-bot {
              justify-content: flex-start;
            }

            .pcb-msg-avatar {
              width: 32px;
              height: 32px;
              border-radius: 10px;
              border: 1px solid rgba(0,166,63,.18);
              background: #fff;
              overflow: hidden;
              flex: 0 0 auto;
              box-shadow: var(--shadow-sm);
            }

            .pcb-msg-avatar img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }

            .pcb-bubble {
              max-width: 80%;
              padding: 12px 14px;
              border-radius: 18px;
              font-size: 13.5px;
              line-height: 1.5;
              overflow-wrap: anywhere;
              box-shadow: 0 2px 8px rgba(15,23,42,.06);
            }

            .pcb-bubble-text p + p {
              margin-top: 8px;
            }

            .pcb-bubble-text strong {
              font-weight: 800;
            }

            .patient-chatbot-list {
              margin: 8px 0 0;
              padding-left: 18px;
              display: grid;
              gap: 5px;
            }

            .patient-chatbot-list li {
              list-style: disc;
            }

            .pcb-bubble-bot {
              background: #fff;
              border: 1px solid var(--gray-100);
              color: var(--gray-800);
              border-bottom-left-radius: 6px;
            }

            .pcb-bubble-patient {
              background: linear-gradient(135deg, var(--primary), var(--primary-hover));
              color: #fff;
              border-bottom-right-radius: 6px;
              box-shadow: 0 4px 14px rgba(0,166,63,.28);
            }

            .pcb-bubble-tag {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              margin-bottom: 7px;
              padding: 3px 9px;
              border-radius: 99px;
              font-size: 11px;
              font-weight: 800;
              text-transform: uppercase;
              letter-spacing: .02em;
            }

            .pcb-bubble-tag-safety {
              background: var(--amber-100);
              color: var(--amber-600);
            }

            .pcb-bubble-tag-support {
              background: #e0f2fe;
              color: #0369a1;
            }

            .pcb-bubble-tag-success {
              background: var(--mint);
              color: var(--darker);
            }

            .pcb-bubble-safety {
              border-color: rgba(217,119,6,.3);
              background: #fffbeb;
            }

            .pcb-bubble-support {
              border-color: rgba(3,105,161,.22);
              background: #f0f9ff;
            }

            .pcb-bubble-success {
              border-color: rgba(0,166,63,.24);
              background: #f0fdf4;
            }

            .pcb-typing {
              display: inline-flex;
              flex-direction: column;
              gap: 7px;
              padding: 12px 14px;
            }

            .pcb-typing-label {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              font-size: 12px;
              font-weight: 700;
              color: var(--primary);
            }

            .pcb-typing-label svg {
              animation: pcb-spin 1.6s linear infinite;
            }

            .pcb-typing-dots {
              display: inline-flex;
              gap: 5px;
            }

            .pcb-typing-dots span {
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: var(--primary);
              opacity: .55;
              animation: pcb-bounce 1.2s infinite ease-in-out;
            }

            .pcb-typing-dots span:nth-child(2) { animation-delay: .18s; }
            .pcb-typing-dots span:nth-child(3) { animation-delay: .36s; }

            .pcb-suggestions {
              margin-top: 4px;
              animation: pcb-msg-in .32s cubic-bezier(.16,1,.3,1) both;
            }

            .pcb-suggestions-title {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              margin: 6px 2px 10px;
              font-size: 12px;
              font-weight: 800;
              color: var(--gray-600);
              text-transform: uppercase;
              letter-spacing: .03em;
            }

            .pcb-suggestions-title svg {
              color: var(--primary);
            }

            .pcb-suggestions-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 9px;
            }

            .pcb-suggestion {
              display: flex;
              align-items: center;
              gap: 10px;
              padding: 11px 12px;
              border: 1px solid var(--gray-100);
              border-radius: 14px;
              background: #fff;
              text-align: left;
              cursor: pointer;
              box-shadow: var(--shadow-sm);
              transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
            }

            .pcb-suggestion:hover {
              transform: translateY(-2px);
              border-color: rgba(0,166,63,.4);
              box-shadow: 0 10px 22px rgba(0,166,63,.14);
            }

            .pcb-suggestion-icon {
              flex-shrink: 0;
              width: 36px;
              height: 36px;
              border-radius: 11px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: linear-gradient(135deg, rgba(0,166,63,.14), rgba(0,166,63,.06));
              color: var(--primary);
            }

            .pcb-suggestion-body {
              display: flex;
              flex-direction: column;
              gap: 2px;
              min-width: 0;
            }

            .pcb-suggestion-label {
              font-size: 13px;
              font-weight: 800;
              color: var(--gray-800);
              line-height: 1.2;
            }

            .pcb-suggestion-hint {
              font-size: 11px;
              font-weight: 500;
              color: var(--gray-500);
              line-height: 1.25;
            }

            .pcb-resolution {
              margin-top: 4px;
              padding: 14px;
              border: 1px solid var(--gray-100);
              border-radius: 16px;
              background: #fff;
              box-shadow: var(--shadow-sm);
              animation: pcb-msg-in .32s cubic-bezier(.16,1,.3,1) both;
            }

            .pcb-resolution-title {
              display: block;
              margin-bottom: 11px;
              color: var(--gray-700);
              font-size: 13px;
              font-weight: 800;
            }

            .pcb-resolution-actions {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 9px;
            }

            .pcb-resolution-actions button {
              min-height: 44px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 7px;
              border-radius: 12px;
              padding: 8px 10px;
              font-size: 12.5px;
              font-weight: 800;
              cursor: pointer;
              transition: transform .14s ease, filter .14s ease;
            }

            .pcb-resolution-actions button:hover {
              transform: translateY(-1px);
            }

            .pcb-resolution-yes {
              border: 0;
              background: linear-gradient(135deg, var(--primary), var(--primary-hover));
              color: #fff;
            }

            .pcb-resolution-no {
              border: 1px solid rgba(0,166,63,.28);
              background: #fff;
              color: var(--gray-700);
            }

            .pcb-footer {
              flex-shrink: 0;
              padding: 12px 14px 14px;
              border-top: 1px solid var(--gray-100);
              background: #fff;
            }

            .pcb-sr-only {
              position: absolute;
              width: 1px;
              height: 1px;
              padding: 0;
              margin: -1px;
              overflow: hidden;
              clip: rect(0 0 0 0);
              white-space: nowrap;
              border: 0;
            }

            .pcb-compose {
              display: grid;
              gap: 7px;
            }

            .pcb-input-shell {
              display: flex;
              align-items: flex-end;
              gap: 6px;
              padding: 7px 8px;
              border: 1.5px solid var(--gray-200);
              border-radius: 20px;
              background: var(--gray-50);
              transition: border-color .15s ease, box-shadow .15s ease;
            }

            .pcb-input-shell:focus-within {
              border-color: var(--primary);
              box-shadow: var(--focus-ring);
              background: #fff;
            }

            .pcb-input-shell textarea {
              flex: 1;
              width: 100%;
              min-height: 28px;
              max-height: 120px;
              resize: none;
              border: 0;
              background: transparent;
              padding: 6px 4px;
              color: var(--gray-800);
              font: inherit;
              font-size: 14px;
              line-height: 1.4;
              outline: none;
            }

            .pcb-input-shell textarea::placeholder {
              color: var(--gray-400);
            }

            .pcb-tool-btn {
              flex-shrink: 0;
              width: 38px;
              height: 38px;
              border: 0;
              border-radius: 12px;
              background: transparent;
              color: var(--gray-500);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: background .15s ease, color .15s ease;
            }

            .pcb-tool-btn:hover:not(:disabled) {
              background: var(--gray-100);
              color: var(--primary);
            }

            .pcb-tool-btn:disabled {
              opacity: .55;
              cursor: not-allowed;
            }

            .pcb-send-btn {
              flex-shrink: 0;
              width: 40px;
              height: 40px;
              border: 0;
              border-radius: 13px;
              background: linear-gradient(135deg, var(--primary), var(--primary-hover));
              color: #fff;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              box-shadow: 0 6px 16px rgba(0,166,63,.3);
              transition: transform .14s ease, box-shadow .14s ease, background .15s ease;
            }

            .pcb-send-btn:hover:not(:disabled) {
              transform: translateY(-1px);
            }

            .pcb-send-btn:disabled {
              background: var(--gray-300);
              box-shadow: none;
              cursor: not-allowed;
            }

            .pcb-spin {
              animation: pcb-spin 1s linear infinite;
            }

            .pcb-disclaimer {
              margin: 0;
              text-align: center;
              font-size: 10.5px;
              color: var(--gray-400);
              line-height: 1.3;
            }

            .pcb-input-shell-recording {
              border-color: var(--red-500);
              background: var(--red-50);
            }

            .pcb-tool-btn-recording {
              background: var(--red-100);
              color: var(--red-600);
              animation: pcb-rec 1.3s infinite;
            }

            .pcb-attachments {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }

            .pcb-attachment {
              display: flex;
              align-items: center;
              gap: 8px;
              max-width: 100%;
              padding: 6px 8px 6px 6px;
              border: 1px solid var(--gray-200);
              border-radius: 12px;
              background: var(--gray-50);
              animation: pcb-msg-in .24s ease both;
            }

            .pcb-attachment-thumb {
              width: 34px;
              height: 34px;
              border-radius: 9px;
              object-fit: cover;
              flex-shrink: 0;
            }

            .pcb-attachment-thumb-file {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: rgba(0,166,63,.12);
              color: var(--primary);
            }

            .pcb-attachment-info {
              display: flex;
              flex-direction: column;
              min-width: 0;
            }

            .pcb-attachment-name {
              font-size: 12px;
              font-weight: 700;
              color: var(--gray-800);
              max-width: 150px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }

            .pcb-attachment-size {
              font-size: 10.5px;
              color: var(--gray-500);
            }

            .pcb-attachment-remove {
              flex-shrink: 0;
              width: 22px;
              height: 22px;
              border: 0;
              border-radius: 7px;
              background: var(--gray-200);
              color: var(--gray-600);
              display: inline-flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: background .14s ease, color .14s ease;
            }

            .pcb-attachment-remove:hover {
              background: var(--red-100);
              color: var(--red-600);
            }

            .pcb-attach-error {
              margin: 0;
              font-size: 11.5px;
              font-weight: 600;
              color: var(--red-600);
            }

            @keyframes pcb-rec {
              0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); }
              50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); }
            }

            @keyframes pcb-bounce {
              0%, 60%, 100% { transform: translateY(0); opacity: .5; }
              30% { transform: translateY(-5px); opacity: 1; }
            }

            @keyframes pcb-pulse {
              0% { box-shadow: 0 0 0 0 rgba(74,222,128,.55); }
              70% { box-shadow: 0 0 0 8px rgba(74,222,128,0); }
              100% { box-shadow: 0 0 0 0 rgba(74,222,128,0); }
            }

            @keyframes pcb-blink {
              0%, 100% { opacity: 1; }
              50% { opacity: .45; }
            }

            @keyframes pcb-spin {
              to { transform: rotate(360deg); }
            }

            @keyframes pcb-msg-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }

            @keyframes pcb-panel-in {
              from { opacity: 0; transform: translateY(16px) scale(.97); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }

            @media (prefers-reduced-motion: reduce) {
              .pcb-fab, .pcb-panel, .pcb-row, .pcb-suggestions, .pcb-resolution,
              .pcb-fab-presence, .pcb-presence, .pcb-status-dot, .pcb-typing-label svg,
              .pcb-typing-dots span, .pcb-spin, .pcb-tool-btn-recording, .pcb-attachment {
                animation: none !important;
              }
            }

            @media (max-width: 560px) {
              .pcb-fab {
                right: 16px;
                bottom: 16px;
              }

              .pcb-panel {
                right: 0;
                left: 0;
                bottom: 0;
                width: 100vw;
                height: 100dvh;
                max-height: 100dvh;
                border: 0;
                border-radius: 0;
              }

              .pcb-suggestions-grid {
                grid-template-columns: 1fr;
              }

              .pcb-bubble {
                max-width: 86%;
              }
            }
          `}</style>
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
