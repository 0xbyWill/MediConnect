import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, ElementType, FormEvent } from 'react';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { appointmentsApi, doctorsApi, patientsApi, reportsApi } from '../lib/api';
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from '../lib/api';
import { managerSearchAssistantApi } from '../lib/aiApi';
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
  const [activeTab, setActiveTab] = useState<'resposta' | 'graficos' | 'arquivos'>('resposta');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const activePrompt = prompt.trim();
  const currentMessage = messages[0];
  const periodLabel = useMemo(() => formatAssistantPeriod(startDate, endDate), [startDate, endDate]);
  const speechSupported = typeof window !== 'undefined' && supportsSpeechRecognition();

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

    setLoading(true);
    setActiveTab('resposta');
    try {
      const data = await loadReadOnlyData(source);
      const built = buildAssistantContext(action, data, { startDate, endDate }, source);
      const localCharts = buildLocalCharts(data, source);
      setLastSummary(built.dataSummary);

      const response = await managerSearchAssistantApi.ask({
        action,
        prompt: activePrompt,
        period: { startDate, endDate },
        context: built.context,
      });

      const structured = parseAiStructuredResponse(response.answer);
      const charts = normalizeAiChartData([...(structured.charts ?? []), ...localCharts]);
      const files = buildGeneratedFiles({
        response: structured,
        fallbackName: action,
        charts,
      });

      setMessages(prev => [
        {
          id: crypto.randomUUID(),
          prompt: activePrompt,
          response: {
            ...response,
            dataSummary: response.dataSummary ?? built.dataSummary,
            warnings: [...built.warnings, ...(response.warnings ?? [])],
            source: response.source ?? built.source,
          },
          structured,
          charts,
          files,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o assistente.');
    } finally {
      setLoading(false);
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

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 0.86fr) minmax(520px, 1.14fr)', gap: 18, alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <Sparkles size={18} color="var(--primary)" />
            <h2 style={sectionTitleStyle}>Pergunta e filtros</h2>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14 }}>
            <div>
              <label htmlFor="manager-assistant-prompt" style={labelStyle}>Pergunta</label>
              <textarea
                id="manager-assistant-prompt"
                value={prompt}
                onChange={event => setPrompt(event.target.value.slice(0, 1500))}
                maxLength={1500}
                rows={5}
                placeholder="Ex.: Resuma as consultas desta semana por status e por médico"
                style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif', lineHeight: 1.5 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginTop: 6, alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{prompt.length}/1500</span>
                <button type="button" onClick={listening ? stopSpeech : startSpeech} style={{ ...smallButtonStyle, color: listening ? 'var(--red-600)' : 'var(--primary)' }}>
                  {listening ? <MicOff size={14} /> : <Mic size={14} />} {listening ? 'Ouvindo...' : 'Falar com IA'}
                </button>
              </div>
            </div>

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
              <button type="submit" disabled={loading} style={{ ...primaryButtonStyle, opacity: loading ? 0.75 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />} {loading ? 'Analisando...' : 'Analisar com IA'}
              </button>
              <button type="button" onClick={clearConversation} style={secondaryButtonStyle}>
                <Eraser size={15} /> Limpar
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
        </section>

        <section style={{ display: 'grid', gap: 14 }}>
          <div style={panelStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ ...sectionTitleStyle, marginBottom: 2 }}>Resultado da análise</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>Período: {periodLabel}</p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={copyAnswer} disabled={!currentMessage} style={secondaryButtonStyle}>
                  <Clipboard size={15} /> Copiar
                </button>
              </div>
            </div>

            <div role="tablist" aria-label="Resultado do assistente" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
              <TabButton active={activeTab === 'resposta'} onClick={() => setActiveTab('resposta')} label="Resposta" />
              <TabButton active={activeTab === 'graficos'} onClick={() => setActiveTab('graficos')} label="Gráficos" />
              <TabButton active={activeTab === 'arquivos'} onClick={() => setActiveTab('arquivos')} label="Arquivos" />
            </div>

            {loading && <LoadingBox />}
            {!loading && !currentMessage && <EmptyBox />}
            {!loading && currentMessage && activeTab === 'resposta' && <StructuredResponseView message={currentMessage} />}
            {!loading && currentMessage && activeTab === 'graficos' && <ChartsView charts={currentMessage.charts} />}
            {!loading && currentMessage && activeTab === 'arquivos' && <FilesView files={currentMessage.files} />}
          </div>

          {lastSummary && <InfoCard icon={BarChart3} title="Resumo dos dados" text={lastSummary} />}
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

async function loadReadOnlyData(source: ManagerSearchAssistantSource) {
  const needsAppointments = source === 'mixed' || source === 'appointments' || source === 'doctors' || source === 'financial';
  const needsPatients = source === 'mixed' || source === 'patients' || source === 'appointments' || source === 'financial';
  const needsDoctors = source === 'mixed' || source === 'doctors' || source === 'appointments';
  const needsReports = source === 'mixed' || source === 'reports' || source === 'financial';

  const [appointments, patients, doctors, reports] = await Promise.all([
    needsAppointments ? appointmentsApi.list({}) : Promise.resolve([] as ApiAppointment[]),
    needsPatients ? patientsApi.list({ limit: 500 }) : Promise.resolve([] as ApiPatient[]),
    needsDoctors ? doctorsApi.list({ active: true }) : Promise.resolve([] as ApiDoctor[]),
    needsReports ? reportsApi.list({}) : Promise.resolve([] as ApiReport[]),
  ]);

  return { appointments, patients, doctors, reports };
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

function StructuredResponseView({ message }: { message: AssistantMessage }) {
  const { structured } = message;
  return (
    <article style={{ display: 'grid', gap: 12 }}>
      <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: 14, background: 'var(--gray-50)' }}>
        <div style={blockTitleStyle}>Resumo</div>
        <p style={bodyTextStyle}>{structured.summary}</p>
      </div>
      <ListBlock title="Indicadores" items={structured.indicators} />
      <ListBlock title="Tendências" items={structured.insights} />
      <ListBlock title="Riscos" items={structured.risks} tone="warning" />
      <ListBlock title="Recomendações" items={structured.recommendations} />
      <ListBlock title="Observações" items={structured.observations} />
      {message.response.warnings?.length ? <ListBlock title="Avisos" items={message.response.warnings} tone="warning" /> : null}
    </article>
  );
}

function ListBlock({ title, items, tone }: { title: string; items?: string[]; tone?: 'warning' }) {
  if (!items?.length) return null;
  return (
    <div style={{ border: `1px solid ${tone === 'warning' ? 'var(--amber-100)' : 'var(--gray-100)'}`, borderRadius: 10, padding: 14, background: tone === 'warning' ? '#fffbeb' : '#fff' }}>
      <div style={blockTitleStyle}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
        {items.map(item => <li key={item} style={bodyTextStyle}>{item}</li>)}
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

function LoadingBox() {
  return <div role="status" style={emptyStyle}><Loader2 size={18} color="var(--primary)" style={{ animation: 'spin 1s linear infinite' }} /> Consultando dados e gerando resposta segura...</div>;
}

function EmptyBox() {
  return <div style={emptyStyle}><Bot size={18} color="var(--primary)" /> {MANAGER_ASSISTANT_EMPTY_STATE}</div>;
}

function EmptyInline({ icon: Icon, text }: { icon: ElementType; text: string }) {
  return <div style={emptyStyle}><Icon size={18} color="var(--primary)" /> {text}</div>;
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="tab" aria-selected={active} onClick={onClick} style={{ ...chipStyle, background: active ? 'var(--mint)' : '#fff', borderColor: active ? '#b7ebcc' : 'var(--gray-200)', color: active ? 'var(--dark)' : 'var(--gray-700)' }}>
      {label}
    </button>
  );
}

function FieldDate({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} type="date" value={value} onChange={event => onChange(event.target.value)} max="2999-12-31" style={inputStyle} />
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <div style={panelStyle}>
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

const smallButtonStyle = {
  ...secondaryButtonStyle,
  padding: '6px 9px',
  fontSize: 12,
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
