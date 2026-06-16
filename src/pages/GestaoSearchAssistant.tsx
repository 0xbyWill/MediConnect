import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType, FormEvent } from 'react';
import AiRichText, { renderAiInlineMarkdown } from '../components/AiRichText';
import {
  BarChart3,
  Bot,
  Clipboard,
  Download,
  Eraser,
  FileJson,
  Loader2,
  Mic,
  MicOff,
  PieChart,
  Search,
  Sparkles,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { appointmentsApi, doctorsApi, patientsApi, reportsApi, usersApi } from '../lib/api';
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from '../lib/api';
import { isDirectAiMode, managerSearchAssistantApi } from '../lib/aiApi';
import type {
  AiChartSpec,
  AiGeneratedFile,
  AiStructuredResponse,
  ManagerSearchAssistantAction,
  ManagerSearchAssistantResponse,
  ManagerSearchAssistantSource,
} from '../types';
import {
  MANAGER_ASSISTANT_DATA_SOURCES,
  MANAGER_ASSISTANT_EMPTY_STATE,
  MANAGER_ASSISTANT_QUICK_ACTIONS,
} from '../shared/constants/managerSearchAssistant';
import {
  buildAssistantContext,
  detectUnsafeRequest,
  formatAssistantPeriod,
} from '../shared/utils/managerSearchAssistant';
import {
  buildGeneratedFiles,
  createDownloadFile,
  getSpeechRecognitionCtor,
  normalizeAiChartData,
  parseAiStructuredResponse,
  supportsSpeechRecognition,
} from '../shared/utils/aiAssistantOutput';
import { toUserFacingErrorMessage } from '../shared/utils/errors';

type AssistantMessage = {
  id: string;
  prompt: string;
  response: ManagerSearchAssistantResponse;
  structured: AiStructuredResponse;
  charts: AiChartSpec[];
  files: AiGeneratedFile[];
};

type ReadOnlyData = {
  appointments: ApiAppointment[];
  patients: ApiPatient[];
  doctors: ApiDoctor[];
  reports: ApiReport[];
  users: Awaited<ReturnType<typeof usersApi.list>>;
};

type AiToneSetting = 'objetivo' | 'acolhedor' | 'tecnico';
type AiLengthSetting = 'curta' | 'media' | 'detalhada';

type AiBehaviorSettings = {
  tone: AiToneSetting;
  responseLength: AiLengthSetting;
  allowProactiveInsights: boolean;
  customInstructions: string;
};

const AI_BEHAVIOR_STORAGE_KEY = 'mediconnect.managerAi.behavior.v1';
const DEFAULT_AI_BEHAVIOR_SETTINGS: AiBehaviorSettings = {
  tone: 'objetivo',
  responseLength: 'curta',
  allowProactiveInsights: false,
  customInstructions: '',
};

const today = new Date();
const todayISO = toISO(today);
const monthStartISO = toISO(new Date(today.getFullYear(), today.getMonth(), 1));

export default function GestaoSearchAssistant({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const [action, setAction] = useState<ManagerSearchAssistantAction>('general_search');
  const [source, setSource] = useState<ManagerSearchAssistantSource>('mixed');
  const [prompt, setPrompt] = useState('');
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [behaviorSettings, setBehaviorSettings] = useState<AiBehaviorSettings>(() => loadAiBehaviorSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activePrompt = prompt.trim();
  const currentMessage = messages[messages.length - 1];
  const directAiMode = isDirectAiMode();
  const periodLabel = useMemo(() => formatAssistantPeriod(startDate, endDate), [startDate, endDate]);
  const speechSupported = typeof window !== 'undefined' && supportsSpeechRecognition();

  useEffect(() => {
    saveAiBehaviorSettings(behaviorSettings);
  }, [behaviorSettings]);

  const applyQuickAction = (nextAction: ManagerSearchAssistantAction) => {
    const selected = MANAGER_ASSISTANT_QUICK_ACTIONS.find(item => item.action === nextAction);
    if (!selected) return;
    setAction(selected.action);
    setSource(selected.source);
    setPrompt(selected.prompt);

    const now = new Date();
    if (selected.action === 'daily_summary') {
      setStartDate(toISO(now));
      setEndDate(toISO(now));
    } else if (selected.action === 'weekly_summary') {
      const day = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(toISO(monday));
      setEndDate(toISO(sunday));
    } else if (selected.action === 'monthly_summary' || selected.action === 'financial_summary') {
      setStartDate(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
      setEndDate(toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    void askAssistant();
  };

  const askAssistant = async () => {
    setError(null);
    setLastSummary(null);

    if (user?.role !== 'gestao') {
      setError('Apenas usuários de gestão podem acessar este assistente.');
      return;
    }
    if (!activePrompt) {
      setError('Digite uma pergunta ou selecione uma ação rápida.');
      return;
    }
    if (startDate > endDate) {
      setError('A data inicial deve ser anterior ou igual à data final.');
      return;
    }

    const unsafe = detectUnsafeRequest(activePrompt);
    if (unsafe.blocked) {
      setError(unsafe.message ?? 'Pedido bloqueado por segurança.');
      return;
    }

    const submittedPrompt = activePrompt;
    setPrompt('');
    setPendingPrompt(submittedPrompt);
    setLoading(true);
    try {
      const data = await loadReadOnlyData();
      const built = buildAssistantContext(action, data, { startDate, endDate }, source);
      const wantsCharts = shouldIncludeCharts(submittedPrompt);
      const wantsFiles = shouldIncludeFiles(submittedPrompt);
      const localCharts = wantsCharts ? buildLocalCharts(data, source) : [];
      setLastSummary(built.dataSummary);

      const response = await managerSearchAssistantApi.ask({
        action,
        prompt: submittedPrompt,
        behaviorInstructions: buildBehaviorInstructions(behaviorSettings),
        period: { startDate, endDate },
        context: built.context,
      });

      const structured = parseAiStructuredResponse(response.answer);
      const charts = wantsCharts ? normalizeAiChartData([...(structured.charts ?? []), ...localCharts]) : [];
      const files = wantsFiles ? buildGeneratedFiles({
        response: structured,
        fallbackName: action,
        charts,
      }) : [];

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          prompt: submittedPrompt,
          response: {
            ...response,
            dataSummary: response.dataSummary ?? built.dataSummary,
            source: response.source ?? built.source,
          },
          structured,
          charts,
          files,
        },
      ]);
    } catch (err) {
      setPrompt(submittedPrompt);
      setError(toUserFacingErrorMessage(err, 'Não foi possível consultar o assistente. Tente novamente em instantes.'));
    } finally {
      setLoading(false);
      setPendingPrompt(null);
    }
  };

  const startSpeech = () => {
    setError(null);
    if (!speechSupported) {
      setError('Reconhecimento de voz não suportado neste navegador. Digite sua pergunta normalmente.');
      return;
    }
    const Recognition = getSpeechRecognitionCtor();
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .flatMap(result => Array.from(result).map(item => item.transcript))
        .join(' ')
        .trim();
      if (transcript) setPrompt(current => `${current ? `${current} ` : ''}${transcript}`.slice(0, 1500));
    };
    recognition.onerror = () => {
      setError('Não foi possível capturar a fala. Verifique a permissão do microfone.');
      setListening(false);
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  };

  const stopSpeech = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const clearConversation = () => {
    setMessages([]);
    setLastSummary(null);
    setError(null);
    setPrompt('');
  };

  const resetBehaviorSettings = () => {
    setBehaviorSettings(DEFAULT_AI_BEHAVIOR_SETTINGS);
  };

  const copyAnswer = async () => {
    const text = currentMessage?.response.answer ?? '';
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      setError('Não foi possível copiar automaticamente neste navegador.');
    }
  };

  if (user?.role !== 'gestao') {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Assistente IA Gerencial</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>Apenas usuários de gestão podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: embedded ? 'visible' : 'auto', padding: embedded ? 0 : 'clamp(14px, 3vw, 24px)' }}>
      {error && (
        <div role="alert" style={alertStyle}>
          {error}
        </div>
      )}

      <div className="ai-chat-shell" style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)', gap: 18, alignItems: 'stretch' }}>
        <aside className="ai-sidebar" style={{ ...panelStyle, alignSelf: 'start', position: 'sticky', top: 0 }}>
          <div style={sectionHeaderStyle}>
            <Sparkles size={18} color="var(--primary)" />
            <h2 style={sectionTitleStyle}>Contexto</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FieldDate id="assistant-start-date" label="Início" value={startDate} onChange={setStartDate} />
              <FieldDate id="assistant-end-date" label="Fim" value={endDate} onChange={setEndDate} />
            </div>

            <div>
              <label htmlFor="assistant-source" style={labelStyle}>Tipo de dado</label>
              <select id="assistant-source" value={source} onChange={event => setSource(event.target.value as ManagerSearchAssistantSource)} style={inputStyle}>
                {MANAGER_ASSISTANT_DATA_SOURCES.map(item => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" onClick={clearConversation} style={{ ...secondaryButtonStyle, width: '100%' }}>
                <Eraser size={15} /> Nova conversa
              </button>
            </div>
          </form>

          <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: 14, paddingTop: 14 }}>
            <h2 style={{ ...sectionTitleStyle, fontSize: 14 }}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {MANAGER_ASSISTANT_QUICK_ACTIONS.map(item => (
                <button
                  key={item.action}
                  type="button"
                  onClick={() => applyQuickAction(item.action)}
                  style={{
                    ...chipStyle,
                    background: action === item.action ? 'var(--mint)' : '#fff',
                    color: action === item.action ? 'var(--dark)' : 'var(--gray-700)',
                    borderColor: action === item.action ? '#b7ebcc' : 'var(--gray-200)',
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          {lastSummary && (
            <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: 14, paddingTop: 14 }}>
              <InfoCard icon={BarChart3} title="Resumo dos dados" text={lastSummary} compact />
            </div>
          )}
        </aside>

        <section className="ai-chat-panel" style={{ ...panelStyle, minHeight: 'calc(100dvh - 170px)', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ ...sectionTitleStyle, marginBottom: 2 }}>Conversa gerencial</h2>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>
                Período: {periodLabel}
                {directAiMode ? ' · Assistente ativo' : ' · Assistente indisponível'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setSettingsOpen(true)} aria-label="Configurar comportamento da IA" title="Configurar comportamento da IA" style={iconSmallButtonStyle}>
                <Wrench size={17} />
              </button>
              <button type="button" onClick={copyAnswer} disabled={!currentMessage} style={{ ...secondaryButtonStyle, opacity: currentMessage ? 1 : 0.6 }}>
                <Clipboard size={15} /> Copiar última
              </button>
            </div>
          </div>

          <div style={{ overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16, background: 'linear-gradient(180deg, #ffffff 0%, var(--gray-50) 100%)' }}>
            {!messages.length && !pendingPrompt && !loading && <EmptyBox />}
            {messages.map(message => (
              <ChatTurn key={message.id} message={message} onCopy={() => void navigator.clipboard.writeText(message.response.answer).catch(() => setError('Não foi possível copiar automaticamente neste navegador.'))} />
            ))}
            {pendingPrompt && <UserBubble text={pendingPrompt} />}
            {loading && <AssistantLoadingBubble />}
          </div>

          <form onSubmit={handleSubmit} style={{ padding: 14, borderTop: '1px solid var(--gray-100)', background: '#fff' }}>
            <label htmlFor="manager-assistant-prompt" style={labelStyle}>Mensagem</label>
            <div className="ai-composer-row" style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'end' }}>
              <textarea
                id="manager-assistant-prompt"
                value={prompt}
                onChange={event => setPrompt(event.target.value.slice(0, 1500))}
                onKeyDown={event => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void askAssistant();
                  }
                }}
                disabled={loading}
                maxLength={1500}
                rows={2}
                placeholder="Pergunte sobre consultas, faltas, agenda, laudos ou desempenho..."
                style={{ ...inputStyle, minHeight: 52, maxHeight: 120, resize: 'vertical', fontFamily: 'Montserrat, sans-serif', lineHeight: 1.45 }}
              />
              <button type="button" onClick={listening ? stopSpeech : startSpeech} disabled={loading} aria-label={listening ? 'Parar microfone' : 'Falar com IA'} style={{ ...iconButtonStyle, color: listening ? 'var(--red-600)' : 'var(--primary)' }}>
                {listening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button type="submit" disabled={loading || !activePrompt} style={{ ...primaryButtonStyle, minHeight: 52, opacity: loading || !activePrompt ? 0.7 : 1, cursor: loading || !activePrompt ? 'not-allowed' : 'pointer' }}>
                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                {loading ? 'Analisando' : 'Enviar'}
              </button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{prompt.length}/1500</span>
              <span style={{ fontSize: 11, color: listening ? 'var(--primary)' : 'var(--gray-400)', fontWeight: 700 }}>
                {listening ? 'Ouvindo...' : 'Enter envia, Shift+Enter quebra linha'}
              </span>
            </div>
          </form>
        </section>
      </div>

      {settingsOpen && (
        <AiBehaviorSettingsModal
          settings={behaviorSettings}
          onChange={setBehaviorSettings}
          onClose={() => setSettingsOpen(false)}
          onReset={resetBehaviorSettings}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 920px) {
          .ai-chat-shell { grid-template-columns: 1fr !important; }
          .ai-sidebar { position: static !important; }
          .ai-chat-panel { min-height: calc(100dvh - 220px) !important; }
        }
        @media (max-width: 560px) {
          .ai-composer-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function AiBehaviorSettingsModal({
  settings,
  onChange,
  onClose,
  onReset,
}: {
  settings: AiBehaviorSettings;
  onChange: (settings: AiBehaviorSettings) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const setField = <K extends keyof AiBehaviorSettings>(field: K, value: AiBehaviorSettings[K]) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div style={modalOverlayStyle} role="presentation" onMouseDown={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="ai-behavior-title" style={modalStyle} onMouseDown={event => event.stopPropagation()}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={assistantAvatarStyle}><Wrench size={15} /></span>
            <div>
              <h2 id="ai-behavior-title" style={{ ...sectionTitleStyle, marginBottom: 2 }}>Comportamento da IA</h2>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: 0 }}>As preferencias ficam salvas neste navegador.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar configuracoes" style={iconSmallButtonStyle}>
            <X size={17} />
          </button>
        </header>

        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label htmlFor="ai-tone-setting" style={labelStyle}>Tom de resposta</label>
            <select id="ai-tone-setting" value={settings.tone} onChange={event => setField('tone', event.target.value as AiToneSetting)} style={inputStyle}>
              <option value="objetivo">Objetivo e direto</option>
              <option value="acolhedor">Acolhedor</option>
              <option value="tecnico">Tecnico</option>
            </select>
          </div>

          <div>
            <label htmlFor="ai-length-setting" style={labelStyle}>Tamanho padrao</label>
            <select id="ai-length-setting" value={settings.responseLength} onChange={event => setField('responseLength', event.target.value as AiLengthSetting)} style={inputStyle}>
              <option value="curta">Curta</option>
              <option value="media">Media</option>
              <option value="detalhada">Detalhada</option>
            </select>
          </div>

          <label htmlFor="ai-proactive-setting" style={toggleRowStyle}>
            <input
              id="ai-proactive-setting"
              type="checkbox"
              checked={settings.allowProactiveInsights}
              onChange={event => setField('allowProactiveInsights', event.target.checked)}
            />
            <span>
              <strong style={{ display: 'block', color: 'var(--gray-800)', fontSize: 13 }}>Permitir sugestoes extras quando fizer sentido</strong>
              <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>Mantem graficos e arquivos somente quando forem pedidos.</span>
            </span>
          </label>

          <div>
            <label htmlFor="ai-custom-instructions" style={labelStyle}>Instrucao personalizada</label>
            <textarea
              id="ai-custom-instructions"
              value={settings.customInstructions}
              onChange={event => setField('customInstructions', event.target.value.slice(0, 900))}
              maxLength={900}
              rows={5}
              placeholder="Ex.: responder sempre em bullets curtos; evitar termos tecnicos; priorizar acoes administrativas..."
              style={{ ...inputStyle, resize: 'vertical', minHeight: 110, fontFamily: 'Montserrat, sans-serif', lineHeight: 1.5 }}
            />
            <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 6 }}>{settings.customInstructions.length}/900</p>
          </div>
        </div>

        <footer style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button type="button" onClick={onReset} style={secondaryButtonStyle}>
            <RotateCcw size={15} /> Restaurar padrao
          </button>
          <button type="button" onClick={onClose} style={primaryButtonStyle}>
            Salvar
          </button>
        </footer>
      </section>
    </div>
  );
}

async function loadReadOnlyData() {
  const [appointments, patients, doctors, reports, users] = await Promise.all([
    appointmentsApi.list({}),
    patientsApi.list({ limit: 2000 }),
    doctorsApi.list({ active: true }),
    reportsApi.list({}),
    usersApi.list().catch(() => []),
  ]);

  return { appointments, patients, doctors, reports, users };
}

function buildLocalCharts(data: ReadOnlyData, source: ManagerSearchAssistantSource): AiChartSpec[] {
  const charts: AiChartSpec[] = [];
  if (source === 'mixed' || source === 'appointments' || source === 'financial') {
    charts.push({
      id: 'appointments-by-status',
      title: 'Consultas por status',
      type: 'bar',
      data: countBy(data.appointments, item => item.status || 'sem_status'),
      xKey: 'label',
      yKey: 'value',
    });
    charts.push({
      id: 'appointments-by-month',
      title: 'Consultas por mês',
      type: 'line',
      data: countBy(data.appointments, item => (item.scheduled_at || '').slice(0, 7) || 'sem_data'),
      xKey: 'label',
      yKey: 'value',
    });
  }
  if (source === 'mixed' || source === 'doctors' || source === 'appointments') {
    const doctorById = new Map(data.doctors.map(doctor => [doctor.id, doctor]));
    charts.push({
      id: 'appointments-by-specialty',
      title: 'Volume por especialidade',
      type: 'pie',
      data: countBy(data.appointments, item => doctorById.get(item.doctor_id)?.specialty || 'Não informado'),
      categoryKey: 'label',
      valueKey: 'value',
    });
  }
  if (source === 'mixed' || source === 'reports') {
    charts.push({
      id: 'reports-by-status',
      title: 'Laudos por status',
      type: 'bar',
      data: countBy(data.reports, item => item.status || 'sem_status'),
      xKey: 'label',
      yKey: 'value',
    });
  }
  return charts.filter(chart => chart.data.length > 0);
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const map = new Map<string, number>();
  items.forEach(item => {
    const key = getKey(item);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }));
}

function ChatTurn({ message, onCopy }: { message: AssistantMessage; onCopy: () => void }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <UserBubble text={message.prompt} />
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <article style={assistantBubbleStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={assistantAvatarStyle}><Bot size={15} /></span>
              <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>Assistente IA</strong>
            </div>
            <button type="button" onClick={onCopy} style={{ ...secondaryButtonStyle, padding: '6px 9px', fontSize: 12 }}>
              <Clipboard size={14} /> Copiar
            </button>
          </div>
          <StructuredResponseView message={message} />
          {message.charts.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={blockTitleStyle}>Gráficos</div>
              <ChartsView charts={message.charts} />
            </div>
          )}
          {message.files.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={blockTitleStyle}>Arquivos gerados</div>
              <FilesView files={message.files} />
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={userBubbleStyle}>{text}</div>
    </div>
  );
}

function AssistantLoadingBubble() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div role="status" style={{ ...assistantBubbleStyle, display: 'inline-flex', alignItems: 'center', gap: 8, width: 'auto' }}>
        <Loader2 size={17} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} />
        A IA está analisando os dados do MediConnect...
      </div>
    </div>
  );
}

function StructuredResponseView({ message }: { message: AssistantMessage }) {
  const { structured } = message;
  const hasLists = Boolean(
    structured.indicators?.length ||
    structured.insights?.length ||
    structured.risks?.length ||
    structured.recommendations?.length ||
    structured.observations?.length
  );
  const showSummaryCard = shouldIncludeSummary(message.prompt) || hasLists;

  if (!showSummaryCard) {
    return <AiRichText text={structured.summary} idPrefix={`summary-${message.id}`} style={bodyTextStyle} />;
  }

  return (
    <article style={{ display: 'grid', gap: 12 }}>
      <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: 14, background: 'var(--gray-50)' }}>
        <div style={blockTitleStyle}>Resumo</div>
        <AiRichText text={structured.summary} idPrefix={`summary-${message.id}`} style={bodyTextStyle} />
      </div>
      <ListBlock title="Indicadores" items={structured.indicators} />
      <ListBlock title="Tendências" items={structured.insights} />
      <ListBlock title="Riscos" items={structured.risks} tone="warning" />
      <ListBlock title="Recomendações" items={structured.recommendations} />
      <ListBlock title="Observações" items={structured.observations} />
    </article>
  );
}

function shouldIncludeSummary(prompt: string) {
  return /\b(resumo|resuma|sumario|sumario|relatorio|relatório|analise|análise|indicador|indicadores|dashboard)\b/i.test(prompt);
}

function shouldIncludeCharts(prompt: string) {
  return /\b(grafico|grafico?s|gráfico|gráficos|chart|charts|dashboard|visualizacao|visualização)\b/i.test(prompt);
}

function shouldIncludeFiles(prompt: string) {
  return /\b(arquivo|arquivos|export|exportar|download|baixar|csv|json|txt|planilha)\b/i.test(prompt);
}

function ListBlock({ title, items, tone }: { title: string; items?: string[]; tone?: 'warning' }) {
  if (!items?.length) return null;
  return (
    <div style={{ border: `1px solid ${tone === 'warning' ? 'var(--amber-100)' : 'var(--gray-100)'}`, borderRadius: 10, padding: 14, background: tone === 'warning' ? '#fffbeb' : '#fff' }}>
      <div style={blockTitleStyle}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        {items.map(item => <li key={item} style={bodyTextStyle}>{renderAiInlineMarkdown(item, item)}</li>)}
      </ul>
    </div>
  );
}

function ChartsView({ charts }: { charts: AiChartSpec[] }) {
  if (!charts.length) {
    return <EmptyInline icon={PieChart} text="Nenhum gráfico disponível para esta resposta." />;
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {charts.map(chart => <SimpleChart key={chart.id} chart={chart} />)}
    </div>
  );
}

function SimpleChart({ chart }: { chart: AiChartSpec }) {
  const labelKey = chart.xKey ?? chart.categoryKey ?? 'label';
  const valueKey = chart.yKey ?? chart.valueKey ?? 'value';
  const max = Math.max(...chart.data.map(row => Number(row[valueKey]) || 0), 1);
  return (
    <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: 14, background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div>
          <div style={blockTitleStyle}>{chart.title}</div>
          {chart.description && <p style={{ ...bodyTextStyle, marginTop: 3 }}>{chart.description}</p>}
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{chart.type}</span>
      </div>
      {chart.type === 'line' ? (
        <LineChart rows={chart.data} labelKey={labelKey} valueKey={valueKey} max={max} />
      ) : chart.type === 'pie' ? (
        <PieList rows={chart.data} labelKey={labelKey} valueKey={valueKey} max={max} />
      ) : (
        <BarList rows={chart.data} labelKey={labelKey} valueKey={valueKey} max={max} />
      )}
    </div>
  );
}

function BarList({ rows, labelKey, valueKey, max }: { rows: Array<Record<string, string | number>>; labelKey: string; valueKey: string; max: number }) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {rows.slice(0, 10).map(row => {
        const value = Number(row[valueKey]) || 0;
        return (
          <div key={`${row[labelKey]}-${value}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(90px, 150px) 1fr auto', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <span style={{ color: 'var(--gray-600)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(row[labelKey])}</span>
            <span style={{ height: 9, borderRadius: 999, background: 'var(--gray-100)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${(value / max) * 100}%`, background: 'var(--primary)' }} />
            </span>
            <strong style={{ color: 'var(--gray-800)' }}>{value}</strong>
          </div>
        );
      })}
    </div>
  );
}

function PieList(props: { rows: Array<Record<string, string | number>>; labelKey: string; valueKey: string; max: number }) {
  return <BarList {...props} />;
}

function LineChart({ rows, labelKey, valueKey, max }: { rows: Array<Record<string, string | number>>; labelKey: string; valueKey: string; max: number }) {
  const width = 420;
  const height = 120;
  const points = rows.slice(0, 12).map((row, index, list) => {
    const x = list.length === 1 ? width / 2 : (index / (list.length - 1)) * width;
    const y = height - ((Number(row[valueKey]) || 0) / max) * (height - 12) - 6;
    return { x, y, label: String(row[labelKey]), value: Number(row[valueKey]) || 0 };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="130" role="img" aria-label={rows.map(row => `${row[labelKey]}: ${row[valueKey]}`).join(', ')}>
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
        {points.map(point => <circle key={`${point.label}-${point.x}`} cx={point.x} cy={point.y} r="4" fill="var(--primary)" />)}
      </svg>
    </div>
  );
}

function FilesView({ files }: { files: AiGeneratedFile[] }) {
  if (!files.length) {
    return <EmptyInline icon={FileJson} text="Nenhum arquivo gerado para esta análise." />;
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {files.map(file => (
        <div key={file.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: 12, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)' }}>{file.name}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 800 }}>{file.type}</div>
          </div>
          <button type="button" onClick={() => createDownloadFile(file)} style={secondaryButtonStyle}>
            <Download size={15} /> Baixar
          </button>
        </div>
      ))}
    </div>
  );
}

function EmptyBox() {
  return <div style={emptyStyle}><Bot size={18} color="var(--primary)" /> {MANAGER_ASSISTANT_EMPTY_STATE}</div>;
}

function EmptyInline({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return <div style={emptyStyle}><Icon size={18} color="var(--primary)" /> {text}</div>;
}

function FieldDate({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} type="date" value={value} onChange={event => onChange(event.target.value)} max="2999-12-31" style={inputStyle} />
    </div>
  );
}

function InfoCard({ icon: Icon, title, text, compact = false }: { icon: ElementType; title: string; text: string; compact?: boolean }) {
  return (
    <div style={compact ? { background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-100)', padding: 12 } : panelStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Icon size={16} color="var(--primary)" />
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)' }}>{title}</h3>
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.55 }}>{text}</p>
    </div>
  );
}

function toISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function loadAiBehaviorSettings(): AiBehaviorSettings {
  if (typeof window === 'undefined') return DEFAULT_AI_BEHAVIOR_SETTINGS;
  try {
    const raw = window.localStorage.getItem(AI_BEHAVIOR_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_BEHAVIOR_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AiBehaviorSettings>;
    return normalizeAiBehaviorSettings(parsed);
  } catch {
    return DEFAULT_AI_BEHAVIOR_SETTINGS;
  }
}

function saveAiBehaviorSettings(settings: AiBehaviorSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AI_BEHAVIOR_STORAGE_KEY, JSON.stringify(settings));
}

function normalizeAiBehaviorSettings(value: Partial<AiBehaviorSettings>): AiBehaviorSettings {
  return {
    tone: isToneSetting(value.tone) ? value.tone : DEFAULT_AI_BEHAVIOR_SETTINGS.tone,
    responseLength: isLengthSetting(value.responseLength) ? value.responseLength : DEFAULT_AI_BEHAVIOR_SETTINGS.responseLength,
    allowProactiveInsights: Boolean(value.allowProactiveInsights),
    customInstructions: typeof value.customInstructions === 'string' ? value.customInstructions.slice(0, 900) : '',
  };
}

function isToneSetting(value: unknown): value is AiToneSetting {
  return value === 'objetivo' || value === 'acolhedor' || value === 'tecnico';
}

function isLengthSetting(value: unknown): value is AiLengthSetting {
  return value === 'curta' || value === 'media' || value === 'detalhada';
}

function buildBehaviorInstructions(settings: AiBehaviorSettings) {
  const tone: Record<AiToneSetting, string> = {
    objetivo: 'Tom objetivo, direto e administrativo.',
    acolhedor: 'Tom acolhedor, claro e profissional.',
    tecnico: 'Tom tecnico, preciso e profissional.',
  };
  const responseLength: Record<AiLengthSetting, string> = {
    curta: 'Respostas curtas por padrao, com no maximo 4 frases ou bullets, salvo pedido contrario.',
    media: 'Respostas medias por padrao, com contexto suficiente e sem alongar desnecessariamente.',
    detalhada: 'Respostas detalhadas quando a pergunta exigir, mantendo objetividade.',
  };
  return [
    tone[settings.tone],
    responseLength[settings.responseLength],
    settings.allowProactiveInsights
      ? 'Pode incluir sugestoes, alertas ou proximos passos quando forem claramente uteis, mas nao inclua graficos ou arquivos sem pedido explicito.'
      : 'Nao inclua sugestoes, recomendacoes, alertas ou proximos passos extras sem pedido explicito.',
    settings.customInstructions.trim() ? `Instrucao adicional do gestor: ${settings.customInstructions.trim()}` : '',
  ].filter(Boolean).join('\n');
}

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid var(--gray-100)',
  boxShadow: 'none',
  padding: 16,
} satisfies CSSProperties;

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 12,
} satisfies CSSProperties;

const sectionTitleStyle = {
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--gray-800)',
  margin: 0,
} satisfies CSSProperties;

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0,
} satisfies CSSProperties;

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  background: '#fff',
  color: 'var(--gray-800)',
  fontSize: 13,
} satisfies CSSProperties;

const primaryButtonStyle = {
  borderRadius: 8,
  border: '1px solid var(--primary)',
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'var(--primary)',
  color: '#fff',
} satisfies CSSProperties;

const secondaryButtonStyle = {
  borderRadius: 8,
  border: '1px solid var(--gray-200)',
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: '#fff',
  color: 'var(--gray-700)',
  cursor: 'pointer',
} satisfies CSSProperties;

const chipStyle = {
  borderRadius: 999,
  border: '1px solid var(--gray-200)',
  padding: '8px 11px',
  fontSize: 12,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
} satisfies CSSProperties;

const iconButtonStyle = {
  width: 52,
  height: 52,
  borderRadius: 8,
  border: '1px solid var(--gray-200)',
  background: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} satisfies CSSProperties;

const iconSmallButtonStyle = {
  width: 38,
  height: 38,
  borderRadius: 8,
  border: '1px solid var(--gray-200)',
  background: '#fff',
  color: 'var(--gray-700)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
} satisfies CSSProperties;

const modalOverlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: 'rgba(15, 23, 42, 0.42)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
} satisfies CSSProperties;

const modalStyle = {
  width: 'min(560px, 100%)',
  maxHeight: 'calc(100dvh - 32px)',
  overflowY: 'auto',
  background: '#fff',
  borderRadius: 8,
  border: '1px solid var(--gray-100)',
  boxShadow: '0 24px 60px rgba(15, 23, 42, 0.18)',
  padding: 18,
} satisfies CSSProperties;

const toggleRowStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  border: '1px solid var(--gray-100)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--gray-50)',
  cursor: 'pointer',
} satisfies CSSProperties;

const userBubbleStyle = {
  maxWidth: 'min(720px, 82%)',
  borderRadius: '16px 16px 4px 16px',
  padding: '12px 14px',
  background: 'var(--primary)',
  color: '#fff',
  fontSize: 13,
  lineHeight: 1.55,
  fontWeight: 600,
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
} satisfies CSSProperties;

const assistantBubbleStyle = {
  width: 'min(860px, 94%)',
  borderRadius: '16px 16px 16px 4px',
  border: '1px solid var(--gray-100)',
  background: '#fff',
  padding: 14,
  color: 'var(--gray-700)',
  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.04)',
} satisfies CSSProperties;

const assistantAvatarStyle = {
  width: 28,
  height: 28,
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--mint)',
  color: 'var(--primary)',
} satisfies CSSProperties;

const alertStyle = {
  background: 'var(--red-50)',
  color: 'var(--red-600)',
  border: '1px solid var(--red-100)',
  borderRadius: 8,
  padding: '10px 12px',
  marginBottom: 14,
  fontSize: 13,
  fontWeight: 700,
} satisfies CSSProperties;

const emptyStyle = {
  minHeight: 180,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  textAlign: 'center',
  background: 'var(--gray-50)',
  border: '1px dashed var(--gray-200)',
  borderRadius: 8,
  color: 'var(--gray-500)',
  fontSize: 13,
  fontWeight: 700,
  padding: 18,
} satisfies CSSProperties;

const blockTitleStyle = {
  fontSize: 12,
  fontWeight: 900,
  color: 'var(--gray-800)',
  textTransform: 'uppercase',
  letterSpacing: 0,
  marginBottom: 7,
} satisfies CSSProperties;

const bodyTextStyle = {
  color: 'var(--gray-700)',
  fontSize: 13,
  lineHeight: 1.62,
  overflowWrap: 'anywhere',
} satisfies CSSProperties;
