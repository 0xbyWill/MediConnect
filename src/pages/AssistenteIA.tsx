import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ElementType, FormEvent, ReactNode } from 'react';
import { Bot, Brain, FileQuestion, FileText, History, ListChecks, MessageSquare, Plus, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminAiApi } from '../lib/aiApi';
import type { AiAdminItem, AiDashboardStats, AiInstructionVersion, AiLogItem, AiScope } from '../lib/aiApi';

type Tab = 'dashboard' | 'chat' | 'knowledge' | 'instructions' | 'faqs' | 'history';

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  background: 'var(--gray-50)',
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

const buttonBase = {
  border: 'none',
  borderRadius: 8,
  padding: '10px 12px',
  fontSize: 13,
  fontWeight: 800,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
} satisfies CSSProperties;

const scopeOptions: AiScope[] = ['general', 'support', 'description', 'user_message', 'admin'];

export default function AssistenteIA() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [dashboard, setDashboard] = useState<AiDashboardStats | null>(null);
  const [knowledge, setKnowledge] = useState<AiAdminItem[]>([]);
  const [instructions, setInstructions] = useState<AiAdminItem[]>([]);
  const [faqs, setFaqs] = useState<AiAdminItem[]>([]);
  const [logs, setLogs] = useState<AiLogItem[]>([]);
  const [instructionVersions, setInstructionVersions] = useState<AiInstructionVersion[]>([]);
  const [selectedInstructionId, setSelectedInstructionId] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'admin' | 'ai'; content: string }>>([]);
  const [chatText, setChatText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [knowledgeForm, setKnowledgeForm] = useState({ title: '', category: '', content: '', active: true });
  const [instructionForm, setInstructionForm] = useState({ title: '', scope: 'general' as AiScope, content: '', active: true });
  const [faqForm, setFaqForm] = useState({ question: '', category: '', answer: '', active: true });
  const [correctionForm, setCorrectionForm] = useState({ messageId: '', correctAnswer: '', notes: '' });

  const loadAll = async () => {
    setError(null);
    setStatus('Carregando dados da IA...');
    try {
      const [stats, knowledgeRows, instructionRows, faqRows, logRows] = await Promise.all([
        adminAiApi.dashboard().catch(() => null),
        adminAiApi.listKnowledge().catch(() => ({ items: [] as AiAdminItem[] })),
        adminAiApi.listInstructions().catch(() => ({ items: [] as AiAdminItem[] })),
        adminAiApi.listFaqs().catch(() => ({ items: [] as AiAdminItem[] })),
        adminAiApi.listLogs().catch(() => ({ items: [] as AiLogItem[] })),
      ]);
      setDashboard(stats);
      setKnowledge(knowledgeRows.items);
      setInstructions(instructionRows.items);
      setFaqs(faqRows.items);
      setLogs(logRows.items);
      setStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar a área de IA.');
      setStatus(null);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const stats = useMemo(() => [
    { label: 'Conversas', value: dashboard?.conversations ?? 0, icon: MessageSquare },
    { label: 'Respostas geradas', value: dashboard?.generatedOutputs ?? 0, icon: Bot },
    { label: 'Conhecimentos', value: dashboard?.knowledgeDocuments ?? knowledge.length, icon: FileText },
    { label: 'FAQs', value: dashboard?.faqs ?? faqs.length, icon: FileQuestion },
    { label: 'Correcoes', value: dashboard?.corrections ?? 0, icon: ListChecks },
  ], [dashboard, faqs.length, knowledge.length]);

  const runAction = async (action: () => Promise<void>, success: string) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await action();
      setStatus(success);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ação não concluída.');
    } finally {
      setSaving(false);
    }
  };

  const sendChat = (event: FormEvent) => {
    event.preventDefault();
    const message = chatText.trim();
    if (!message || !user) return;
    setChatMessages(prev => [...prev, { sender: 'admin', content: message }]);
    setChatText('');
    void runAction(async () => {
      const response = await adminAiApi.chat({ adminId: user.id, message });
      setChatMessages(prev => [...prev, { sender: 'ai', content: response.answer }]);
    }, 'Resposta administrativa salva no histórico.');
  };

  const createKnowledge = (event: FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      await adminAiApi.createKnowledge(knowledgeForm);
      setKnowledgeForm({ title: '', category: '', content: '', active: true });
    }, 'Documento de conhecimento criado.');
  };

  const createInstruction = (event: FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      if (selectedInstructionId) {
        await adminAiApi.updateInstruction(selectedInstructionId, instructionForm);
      } else {
        await adminAiApi.createInstruction(instructionForm);
      }
      setInstructionForm({ title: '', scope: 'general', content: '', active: true });
      setSelectedInstructionId('');
      setInstructionVersions([]);
    }, selectedInstructionId ? 'Instrução administrativa atualizada.' : 'Instrução administrativa criada.');
  };

  const selectInstruction = async (item: AiAdminItem) => {
    setSelectedInstructionId(item.id);
    setInstructionForm({
      title: item.title ?? '',
      scope: item.scope ?? 'general',
      content: item.content ?? '',
      active: item.active !== false,
    });
    setError(null);
    try {
      const response = await adminAiApi.listInstructionVersions(item.id);
      setInstructionVersions(response.items);
    } catch (err) {
      setInstructionVersions([]);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar versões.');
    }
  };

  const deactivateInstruction = () => {
    if (!selectedInstructionId) return;
    void runAction(async () => {
      await adminAiApi.deactivateInstruction(selectedInstructionId);
      setInstructionForm({ title: '', scope: 'general', content: '', active: true });
      setSelectedInstructionId('');
      setInstructionVersions([]);
    }, 'Instrução desativada.');
  };

  const createFaq = (event: FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      await adminAiApi.createFaq(faqForm);
      setFaqForm({ question: '', category: '', answer: '', active: true });
    }, 'FAQ criada.');
  };

  const createCorrection = (event: FormEvent) => {
    event.preventDefault();
    void runAction(async () => {
      await adminAiApi.createCorrection(correctionForm);
      setCorrectionForm({ messageId: '', correctAnswer: '', notes: '' });
    }, 'Correção salva para revisão futura.');
  };

  if (user?.role !== 'gestao') {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Assistente IA</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>Apenas usuários de gestão podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 28px)' }}>
      <div style={{ maxWidth: 1180 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--dark)' }}>Assistente IA</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>Gestão de conhecimento, FAQs, instruções, correções e chat administrativo.</p>
          </div>
          <button type="button" onClick={() => void loadAll()} style={{ ...buttonBase, background: 'var(--primary)', color: '#fff' }}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </header>

        {(status || error) && (
          <div role={error ? 'alert' : 'status'} style={{
            marginBottom: 14,
            padding: '10px 12px',
            borderRadius: 8,
            border: `1px solid ${error ? 'var(--red-100)' : 'var(--gray-200)'}`,
            background: error ? 'var(--red-50)' : '#fff',
            color: error ? 'var(--red-600)' : 'var(--gray-700)',
            fontSize: 13,
            fontWeight: 700,
          }}>{error || status}</div>
        )}

        <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {([
            ['dashboard', 'Dashboard', Brain],
            ['chat', 'Chat admin', MessageSquare],
            ['knowledge', 'Conhecimento', FileText],
            ['instructions', 'Instrucoes', ShieldCheck],
            ['faqs', 'FAQs', FileQuestion],
            ['history', 'Histórico', History],
          ] satisfies Array<[Tab, string, ElementType]>).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              style={{
                ...buttonBase,
                background: tab === id ? 'var(--primary)' : '#fff',
                color: tab === id ? '#fff' : 'var(--gray-700)',
                border: `1px solid ${tab === id ? 'var(--primary)' : 'var(--gray-200)'}`,
              }}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </nav>

        {tab === 'dashboard' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            {stats.map(item => {
              const Icon = item.icon;
              return (
                <section key={item.label} style={panelStyle}>
                  <Icon size={18} color="var(--primary)" />
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--dark)', marginTop: 10 }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>{item.label}</div>
                </section>
              );
            })}
            <section style={{ ...panelStyle, gridColumn: '1 / -1' }}>
              <h2 style={sectionTitleStyle}>Ultimos logs</h2>
              <ItemList items={logs.slice(0, 6).map(log => ({ id: log.id, title: log.action_type, subtitle: `${log.status} - ${log.created_at ?? ''}` }))} empty="Nenhum log retornado." />
            </section>
          </div>
        )}

        {tab === 'chat' && (
          <section style={panelStyle}>
            <h2 style={sectionTitleStyle}>Chat administrativo</h2>
            <div style={{ border: '1px solid var(--gray-100)', borderRadius: 8, background: 'var(--gray-50)', minHeight: 280, padding: 14, marginBottom: 14, overflow: 'auto' }}>
              {chatMessages.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Converse com a IA para preparar FAQs, instrucoes e documentos de conhecimento.</p>}
              {chatMessages.map((message, index) => (
                <div key={`${message.sender}-${index}`} style={{ display: 'flex', justifyContent: message.sender === 'admin' ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <div style={{ maxWidth: '78%', borderRadius: 8, padding: '10px 12px', background: message.sender === 'admin' ? 'var(--primary)' : '#fff', color: message.sender === 'admin' ? '#fff' : 'var(--gray-800)', border: '1px solid var(--gray-200)', fontSize: 13, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                    {message.content}
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={sendChat} style={{ display: 'flex', gap: 10 }}>
              <label htmlFor="ai-admin-chat" style={{ ...labelStyle, position: 'absolute', left: -9999 }}>Mensagem</label>
              <input id="ai-admin-chat" value={chatText} onChange={e => setChatText(e.target.value.slice(0, 2000))} maxLength={2000} placeholder="Pergunte ou peça ajuda para estruturar conhecimento" style={inputStyle} />
              <button type="submit" disabled={saving || !chatText.trim()} style={{ ...buttonBase, background: saving ? 'var(--gray-300)' : 'var(--primary)', color: '#fff', flex: '0 0 auto' }}>
                <MessageSquare size={15} /> Enviar
              </button>
            </form>
          </section>
        )}

        {tab === 'knowledge' && (
          <EditorPanel title="Base de conhecimento" onSubmit={createKnowledge} disabled={saving}>
            <Field id="ai-knowledge-title" label="Titulo" value={knowledgeForm.title} onChange={value => setKnowledgeForm(prev => ({ ...prev, title: value }))} maxLength={120} />
            <Field id="ai-knowledge-category" label="Categoria" value={knowledgeForm.category} onChange={value => setKnowledgeForm(prev => ({ ...prev, category: value }))} maxLength={80} />
            <TextField id="ai-knowledge-content" label="Conteudo" value={knowledgeForm.content} onChange={value => setKnowledgeForm(prev => ({ ...prev, content: value }))} maxLength={8000} />
            <ItemList items={knowledge.map(item => ({ id: item.id, title: item.title ?? 'Sem titulo', subtitle: `${item.category ?? 'geral'} - ${item.active === false ? 'inativo' : 'ativo'}` }))} empty="Nenhum documento cadastrado." />
          </EditorPanel>
        )}

        {tab === 'instructions' && (
          <EditorPanel title="Instrucoes da IA" onSubmit={createInstruction} disabled={saving}>
            <Field id="ai-instruction-title" label="Titulo" value={instructionForm.title} onChange={value => setInstructionForm(prev => ({ ...prev, title: value }))} maxLength={120} />
            <label htmlFor="ai-instruction-scope" style={labelStyle}>Escopo</label>
            <select id="ai-instruction-scope" value={instructionForm.scope} onChange={e => setInstructionForm(prev => ({ ...prev, scope: e.target.value as AiScope }))} style={inputStyle}>
              {scopeOptions.map(scope => <option key={scope} value={scope}>{scope}</option>)}
            </select>
            <TextField id="ai-instruction-content" label="Instrução" value={instructionForm.content} onChange={value => setInstructionForm(prev => ({ ...prev, content: value }))} maxLength={5000} />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {selectedInstructionId && (
                <>
                  <button type="button" onClick={() => { setSelectedInstructionId(''); setInstructionVersions([]); setInstructionForm({ title: '', scope: 'general', content: '', active: true }); }} style={{ ...buttonBase, background: '#fff', color: 'var(--gray-700)', border: '1px solid var(--gray-200)' }}>
                    Nova instrução
                  </button>
                  <button type="button" onClick={deactivateInstruction} disabled={saving} style={{ ...buttonBase, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)' }}>
                    Desativar
                  </button>
                </>
              )}
            </div>
            <InstructionVersionEditor
              instructions={instructions}
              versions={instructionVersions}
              selectedInstructionId={selectedInstructionId}
              onSelect={selectInstruction}
              onRestore={content => setInstructionForm(prev => ({ ...prev, content }))}
            />
          </EditorPanel>
        )}

        {tab === 'faqs' && (
          <EditorPanel title="FAQs" onSubmit={createFaq} disabled={saving}>
            <Field id="ai-faq-question" label="Pergunta" value={faqForm.question} onChange={value => setFaqForm(prev => ({ ...prev, question: value }))} maxLength={300} />
            <Field id="ai-faq-category" label="Categoria" value={faqForm.category} onChange={value => setFaqForm(prev => ({ ...prev, category: value }))} maxLength={80} />
            <TextField id="ai-faq-answer" label="Resposta" value={faqForm.answer} onChange={value => setFaqForm(prev => ({ ...prev, answer: value }))} maxLength={3000} />
            <ItemList items={faqs.map(item => ({ id: item.id, title: item.question ?? 'Sem pergunta', subtitle: `${item.category ?? 'geral'} - ${item.active === false ? 'inativa' : 'ativa'}` }))} empty="Nenhuma FAQ cadastrada." />
          </EditorPanel>
        )}

        {tab === 'history' && (
          <EditorPanel title="Corrigir resposta da IA" onSubmit={createCorrection} disabled={saving}>
            <Field id="ai-correction-message-id" label="ID da mensagem" value={correctionForm.messageId} onChange={value => setCorrectionForm(prev => ({ ...prev, messageId: value }))} maxLength={80} />
            <TextField id="ai-correction-answer" label="Resposta correta" value={correctionForm.correctAnswer} onChange={value => setCorrectionForm(prev => ({ ...prev, correctAnswer: value }))} maxLength={3000} />
            <TextField id="ai-correction-notes" label="Notas administrativas" value={correctionForm.notes} onChange={value => setCorrectionForm(prev => ({ ...prev, notes: value }))} maxLength={2000} />
            <ItemList items={logs.map(log => ({ id: log.id, title: log.action_type, subtitle: `${log.status} - ${log.created_at ?? ''}` }))} empty="Nenhum histórico retornado." />
          </EditorPanel>
        )}
      </div>
    </div>
  );
}

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid var(--gray-100)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 18,
} satisfies CSSProperties;

const sectionTitleStyle = {
  fontSize: 16,
  fontWeight: 800,
  color: 'var(--gray-800)',
  marginBottom: 14,
} satisfies CSSProperties;

function EditorPanel({ title, onSubmit, disabled, children }: { title: string; onSubmit: (event: FormEvent) => void; disabled: boolean; children: ReactNode }) {
  return (
    <section style={panelStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
        {children}
        <button type="submit" disabled={disabled} style={{ ...buttonBase, background: disabled ? 'var(--gray-300)' : 'var(--primary)', color: '#fff', justifySelf: 'start' }}>
          {disabled ? <RefreshCw size={15} /> : <Save size={15} />} Salvar
        </button>
      </form>
    </section>
  );
}

function Field({ id, label, value, onChange, maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <input id={id} value={value} onChange={e => onChange(e.target.value.slice(0, maxLength))} maxLength={maxLength} autoComplete="off" style={inputStyle} />
    </div>
  );
}

function TextField({ id, label, value, onChange, maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; maxLength: number }) {
  return (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      <textarea id={id} value={value} onChange={e => onChange(e.target.value.slice(0, maxLength))} maxLength={maxLength} rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }} />
      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{value.length}/{maxLength}</div>
    </div>
  );
}

function ItemList({ items, empty }: { items: Array<{ id: string; title: string; subtitle: string }>; empty: string }) {
  return (
    <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, color: 'var(--gray-600)', fontSize: 12, fontWeight: 800 }}>
        <Plus size={14} /> Registros
      </div>
      {items.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>{empty}</p>}
      <div style={{ display: 'grid', gap: 8 }}>
        {items.slice(0, 8).map(item => (
          <div key={item.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 10, background: 'var(--gray-50)' }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)', overflowWrap: 'anywhere' }}>{item.title}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 3, overflowWrap: 'anywhere' }}>{item.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstructionVersionEditor({
  instructions,
  versions,
  selectedInstructionId,
  onSelect,
  onRestore,
}: {
  instructions: AiAdminItem[];
  versions: AiInstructionVersion[];
  selectedInstructionId: string;
  onSelect: (item: AiAdminItem) => void;
  onRestore: (content: string) => void;
}) {
  const selected = instructions.find(item => item.id === selectedInstructionId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginTop: 6 }}>
      <section>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10 }}>Instrucoes cadastradas</h3>
        <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
          {instructions.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Nenhuma instrução cadastrada.</p>}
          {instructions.map(item => {
            const active = item.id === selectedInstructionId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                style={{
                  border: `1px solid ${active ? 'var(--primary)' : 'var(--gray-100)'}`,
                  borderRadius: 8,
                  background: active ? 'var(--mint)' : 'var(--gray-50)',
                  padding: 10,
                  textAlign: 'left',
                }}
              >
                <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: 'var(--gray-800)', overflowWrap: 'anywhere' }}>{item.title ?? 'Sem titulo'}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 3 }}>{item.scope ?? 'general'} - {item.active === false ? 'inativa' : 'ativa'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-700)', marginBottom: 10 }}>
          {selected ? `Versões de ${selected.title ?? 'instrução'}` : 'Versões'}
        </h3>
        <div style={{ display: 'grid', gap: 8, maxHeight: 360, overflow: 'auto' }}>
          {!selectedInstructionId && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Selecione uma instrução para ver o histórico.</p>}
          {selectedInstructionId && versions.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Nenhuma versao registrada.</p>}
          {versions.map(version => (
            <div key={version.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, background: '#fff', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)' }}>{version.created_at ?? 'Sem data'}</span>
                <button type="button" onClick={() => onRestore(version.content)} style={{ ...buttonBase, padding: '6px 8px', background: 'var(--mint)', color: 'var(--dark)', fontSize: 11 }}>
                  Restaurar no editor
                </button>
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-700)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{version.content}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
