import { useMemo, useState } from 'react';
import type { CSSProperties, ElementType, FormEvent } from 'react';
import {
  BarChart3,
  Bot,
  Clipboard,
  Eraser,
  FileText,
  Loader2,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { appointmentsApi, doctorsApi, patientsApi, reportsApi } from '../lib/api';
import type { ApiAppointment, ApiDoctor, ApiPatient, ApiReport } from '../lib/api';
import { managerSearchAssistantApi } from '../lib/aiApi';
import type {
  ManagerSearchAssistantAction,
  ManagerSearchAssistantResponse,
  ManagerSearchAssistantSource,
} from '../types';
import {
  MANAGER_ASSISTANT_DATA_SOURCES,
  MANAGER_ASSISTANT_EMPTY_STATE,
  MANAGER_ASSISTANT_EXAMPLE_QUESTIONS,
  MANAGER_ASSISTANT_LIMITS,
  MANAGER_ASSISTANT_QUICK_ACTIONS,
} from '../shared/constants/managerSearchAssistant';
import {
  buildAssistantContext,
  detectUnsafeRequest,
  formatAssistantPeriod,
} from '../shared/utils/managerSearchAssistant';

type AssistantMessage = {
  id: string;
  prompt: string;
  response: ManagerSearchAssistantResponse;
};

const today = new Date();
const todayISO = toISO(today);
const monthStartISO = toISO(new Date(today.getFullYear(), today.getMonth(), 1));

const buttonBase = {
  borderRadius: 8,
  border: '1px solid var(--gray-200)',
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
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

const labelStyle = {
  display: 'block',
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0,
} satisfies CSSProperties;

export default function GestaoSearchAssistant({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [action, setAction] = useState<ManagerSearchAssistantAction>('general_search');
  const [source, setSource] = useState<ManagerSearchAssistantSource>('mixed');
  const [prompt, setPrompt] = useState('');
  const [startDate, setStartDate] = useState(monthStartISO);
  const [endDate, setEndDate] = useState(todayISO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSummary, setLastSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);

  const activePrompt = prompt.trim();
  const lastAnswer = messages[0]?.response.answer ?? '';
  const periodLabel = useMemo(() => formatAssistantPeriod(startDate, endDate), [startDate, endDate]);

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
    try {
      const data = await loadReadOnlyData(source);
      const built = buildAssistantContext(action, data, { startDate, endDate }, source);
      setLastSummary(built.dataSummary);

      const response = await managerSearchAssistantApi.ask({
        action,
        prompt: activePrompt,
        period: { startDate, endDate },
        context: built.context,
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
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível consultar o assistente.');
    } finally {
      setLoading(false);
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setLastSummary(null);
    setError(null);
  };

  const copyAnswer = async () => {
    if (!lastAnswer) return;
    try {
      await navigator.clipboard.writeText(lastAnswer);
    } catch {
      setError('Não foi possível copiar automaticamente neste navegador.');
    }
  };

  if (user?.role !== 'gestao') {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Assistente de Busca Gerencial</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>Apenas usuários de gestão podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div style={{
      flex: 1,
      width: '100%',
      minWidth: 0,
      minHeight: 0,
      overflow: embedded ? 'visible' : 'auto',
      padding: embedded ? 0 : 'clamp(14px, 3vw, 24px)',
    }}>
      <div style={{ maxWidth: embedded ? 'none' : 1220 }}>
        {!embedded && (
        <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--dark)' }}>Assistente de Busca Gerencial</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              Pesquise relatórios, consultas, financeiro e pendências usando os dados disponíveis do sistema.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 800 }}>
            <ShieldCheck size={16} color="var(--primary)" /> Somente leitura
          </div>
        </header>
        )}

        {error && (
          <div role="alert" style={{ background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
          <section style={panelStyle}>
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
                <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{prompt.length}/1500</div>
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

              <button type="submit" disabled={loading} style={{ ...buttonBase, background: loading ? 'var(--gray-300)' : 'var(--primary)', color: '#fff', borderColor: loading ? 'var(--gray-300)' : 'var(--primary)' }}>
                {loading ? <Loader2 size={16} /> : <Search size={16} />} {loading ? 'Buscando...' : 'Buscar com IA'}
              </button>
            </form>

            <div style={{ borderTop: '1px solid var(--gray-100)', marginTop: 16, paddingTop: 14 }}>
              <h2 style={sectionTitleStyle}>Ações rápidas</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {MANAGER_ASSISTANT_QUICK_ACTIONS.map(item => (
                  <button
                    key={item.action}
                    type="button"
                    onClick={() => applyQuickAction(item.action)}
                    style={{
                      ...buttonBase,
                      padding: '8px 10px',
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
                  <h2 style={{ ...sectionTitleStyle, marginBottom: 2 }}>Resposta</h2>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>Período: {periodLabel}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={copyAnswer} disabled={!lastAnswer} style={{ ...buttonBase, background: '#fff', color: 'var(--gray-700)' }}>
                    <Clipboard size={15} /> Copiar
                  </button>
                  <button type="button" onClick={clearConversation} style={{ ...buttonBase, background: '#fff', color: 'var(--gray-700)' }}>
                    <Eraser size={15} /> Limpar
                  </button>
                </div>
              </div>

              {loading && (
                <div role="status" style={emptyStyle}>
                  <Loader2 size={18} color="var(--primary)" /> Consultando dados e gerando resposta segura...
                </div>
              )}

              {!loading && messages.length === 0 && (
                <div style={emptyStyle}>
                  <Bot size={18} color="var(--primary)" /> {MANAGER_ASSISTANT_EMPTY_STATE}
                </div>
              )}

              {!loading && messages.map(message => (
                <article key={message.id} style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 14, marginTop: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: 'var(--gray-600)', fontSize: 12, fontWeight: 800 }}>
                    <Search size={14} color="var(--primary)" /> {message.prompt}
                  </div>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, color: 'var(--gray-800)', fontSize: 14, overflowWrap: 'anywhere' }}>
                    {message.response.answer}
                  </p>
                  {message.response.warnings?.length ? (
                    <div style={{ display: 'grid', gap: 6, marginTop: 12 }}>
                      {message.response.warnings.map(warning => (
                        <div key={warning} style={{ fontSize: 12, color: 'var(--amber-600)', background: 'var(--amber-100)', borderRadius: 8, padding: '8px 10px', fontWeight: 700 }}>
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
              <InfoCard icon={BarChart3} title="Resumo dos dados" text={lastSummary ?? 'Nenhuma busca executada ainda.'} />
              <InfoCard icon={ShieldCheck} title="Limites de segurança" text={MANAGER_ASSISTANT_LIMITS.join(' ')} />
              <InfoCard icon={FileText} title="Exemplos" text={MANAGER_ASSISTANT_EXAMPLE_QUESTIONS.slice(0, 2).join(' ')} />
            </div>
          </section>
        </div>
      </div>
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
  padding: 18,
} satisfies CSSProperties;

const sectionTitleStyle = {
  fontSize: 15,
  fontWeight: 800,
  color: 'var(--gray-800)',
  marginBottom: 10,
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
