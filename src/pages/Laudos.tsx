import React, { useState, useRef, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Check, Eye, Printer,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Download, ZoomIn, ZoomOut,
  FileText, Image, ChevronDown, AlertCircle, Send,
  Star, CheckCircle2, BookOpen, MessageSquare, LayoutTemplate,
  Maximize2,
} from 'lucide-react';
import type { Laudo, Paciente, StatusLaudo } from '../types';
import { useAuth } from '../contexts/AuthContext';

// ─── Constantes ───────────────────────────────────────────────────────────────
const today = new Date().toISOString().split('T')[0];

const FONTES  = ['Helvetica','Arial','Times New Roman','Courier New','Georgia','Verdana'];
const TAMANHOS = ['8','10','12','14','16','18','20','24','28','32'];

const MODELOS_BIBLIOTECA = [
  { id: 'm1', titulo: 'Relatório Médico Geral', conteudo: 'Relatório médico referente ao paciente {NOME}.\n\nData do atendimento: {DATA}\n\nCID: {CID}\n\nDiagnóstico:\n{DIAGNOSTICO}\n\nConclusão:\n{CONCLUSAO}' },
  { id: 'm2', titulo: 'Laudo de Exame de Imagem', conteudo: 'LAUDO DE EXAME DE IMAGEM\n\nPaciente: {NOME}\nIdade: {IDADE}\nData: {DATA}\n\nExame: \nTécnica: \n\nAchados:\n\nConclusão:\n' },
  { id: 'm3', titulo: 'Atestado Médico', conteudo: 'ATESTADO MÉDICO\n\nAtesto para os devidos fins que o(a) paciente {NOME}, portador(a) do CPF {CPF}, esteve sob meus cuidados médicos, necessitando de repouso por _____ dias, a partir de {DATA}.\n\nCID: {CID}' },
  { id: 'm4', titulo: 'Encaminhamento', conteudo: 'ENCAMINHAMENTO MÉDICO\n\nEncaminho o(a) paciente {NOME} para avaliação especializada.\n\nMotivo do encaminhamento:\n\nHipótese diagnóstica: {CID}\n\nInformações clínicas relevantes:' },
  { id: 'm5', titulo: 'Solicitação de Exame', conteudo: 'SOLICITAÇÃO DE EXAME\n\nPaciente: {NOME}\nData: {DATA}\n\nSolicito os seguintes exames:\n\nJustificativa clínica:\nCID: {CID}' },
];

const FRASES_COMUNS = [
  'Paciente em bom estado geral.',
  'Ausência de alterações significativas.',
  'Recomenda-se acompanhamento ambulatorial.',
  'Solicito avaliação especializada.',
  'Prescrito tratamento medicamentoso conforme orientação.',
  'Sem queixas no momento.',
  'Exame dentro dos parâmetros normais.',
  'Evolução clínica satisfatória.',
];

const CAMPOS_DINAMICOS = [
  { label: '{NOME}',       desc: 'Nome do paciente' },
  { label: '{CPF}',        desc: 'CPF do paciente' },
  { label: '{IDADE}',      desc: 'Idade do paciente' },
  { label: '{DATA}',       desc: 'Data atual' },
  { label: '{CID}',        desc: 'Código CID' },
  { label: '{MEDICO}',     desc: 'Nome do médico' },
  { label: '{CRM}',        desc: 'CRM do médico' },
  { label: '{DIAGNOSTICO}', desc: 'Diagnóstico' },
  { label: '{CONCLUSAO}',  desc: 'Conclusão' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function initials(nome: string) {
  return nome.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('').toUpperCase();
}
function formatDateBR(iso: string) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function calcIdade(dataNasc: string) {
  if (!dataNasc) return '';
  const nasc = new Date(dataNasc);
  const hoje = new Date();
  let anos = hoje.getFullYear() - nasc.getFullYear();
  const meses = hoje.getMonth() - nasc.getMonth();
  if (meses < 0 || (meses === 0 && hoje.getDate() < nasc.getDate())) anos--;
  return `${anos} anos`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface LaudosProps {
  laudos: Laudo[];
  pacientes: Paciente[];
  onAdd: (l: Omit<Laudo,'id'>) => void;
  onUpdate: (l: Laudo) => void;
  onDelete: (id: string) => void;
}

type ViewMode = 'lista' | 'editor' | 'preview';
type AbaLista = 'rascunho' | 'liberado' | 'todos';

const emptyLaudo = (): Omit<Laudo,'id'> => ({
  pacienteId: '', cid: '', data: today,
  diagnostico: '', tecnica: '', impressao: '',
  status: 'rascunho', conteudoHtml: '',
  ocultarData: false, ocultarAssinatura: false,
});

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Laudos({ laudos, pacientes, onAdd, onUpdate, onDelete }: LaudosProps) {
  const { user } = useAuth();
  const isMedico = user?.role === 'medico' || user?.role === 'gestao';

  // ── Estados gerais ──
  const [view, setView]                 = useState<ViewMode>('lista');
  const [abaLista, setAbaLista]         = useState<AbaLista>('rascunho');
  const [search, setSearch]             = useState('');
  const [editingLaudo, setEditingLaudo] = useState<Partial<Laudo> & { id?: string }>({});
  const [isNew, setIsNew]               = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [confirmLiberar, setConfirmLiberar] = useState<string|null>(null);
  const [searchPac, setSearchPac]       = useState('');
  const [showPacList, setShowPacList]   = useState(false);
  const [errors, setErrors]             = useState<Record<string,string>>({});

  // ── Estados do editor ──
  const [fonte, setFonte]               = useState('Helvetica');
  const [tamanho, setTamanho]           = useState('12');
  const [showModelos, setShowModelos]   = useState(false);
  const [showFrases, setShowFrases]     = useState(false);
  const [showCampos, setShowCampos]     = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [zoom, setZoom]                 = useState(100);
  const editorRef                       = useRef<HTMLDivElement>(null);
  const fileInputRef                    = useRef<HTMLInputElement>(null);
  const imgInputRef                     = useRef<HTMLInputElement>(null);

  // ── Filtros ──
  const filtered = laudos.filter(l => {
    const pac = pacientes.find(p => p.id === l.pacienteId);
    const q   = search.toLowerCase();
    const matchSearch = !q || pac?.nome.toLowerCase().includes(q) || l.cid.toLowerCase().includes(q) || l.diagnostico.toLowerCase().includes(q);
    const matchAba = abaLista === 'todos' || l.status === abaLista;
    return matchSearch && matchAba;
  }).sort((a,b) => b.data.localeCompare(a.data));

  const countRascunho = laudos.filter(l => l.status === 'rascunho').length;
  const countLiberado = laudos.filter(l => l.status === 'liberado').length;

  // ── Abrir editor ──
  const openNew = () => {
    setEditingLaudo({ ...emptyLaudo() });
    setEditorContent('');
    setIsNew(true);
    setErrors({});
    setSearchPac('');
    setView('editor');
  };

  const openEdit = (l: Laudo) => {
    setEditingLaudo({ ...l });
    setEditorContent(l.conteudoHtml || l.diagnostico || '');
    setIsNew(false);
    setErrors({});
    setView('editor');
  };

  const closeEditor = () => {
    setView('lista');
    setShowModelos(false);
    setShowFrases(false);
    setShowCampos(false);
  };

  // ── Set field ──
  const setField = useCallback(<K extends keyof Laudo>(k: K, v: Laudo[K]) => {
    setEditingLaudo(prev => ({ ...prev, [k]: v }));
  }, []);

  // ── Executa comando de formatação ──
  const execCmd = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  };

  // ── Insere texto no editor ──
  const insertText = (txt: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, txt);
  };

  // ── Resolve campos dinâmicos ──
  const resolveCampos = (texto: string) => {
    const pac = pacientes.find(p => p.id === editingLaudo.pacienteId);
    return texto
      .replace(/{NOME}/g, pac?.nome || '[Nome do Paciente]')
      .replace(/{CPF}/g, pac?.cpf || '')
      .replace(/{IDADE}/g, pac ? calcIdade(pac.dataNasc) : '')
      .replace(/{DATA}/g, formatDateBR(today))
      .replace(/{CID}/g, editingLaudo.cid || '')
      .replace(/{MEDICO}/g, user?.full_name || '')
      .replace(/{CRM}/g, user?.crm || '')
      .replace(/{DIAGNOSTICO}/g, editingLaudo.diagnostico || '')
      .replace(/{CONCLUSAO}/g, editingLaudo.impressao || '');
  };

  // ── Salvar ──
  const validate = () => {
    const e: Record<string,string> = {};
    if (!editingLaudo.pacienteId) e.paciente = 'Selecione um paciente';
    return e;
  };

  const handleSave = (novoStatus?: StatusLaudo) => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const conteudo = editorRef.current?.innerHTML || editorContent;
    const payload: Omit<Laudo,'id'> = {
      pacienteId:        editingLaudo.pacienteId!,
      cid:               editingLaudo.cid || '',
      data:              editingLaudo.data || today,
      diagnostico:       editingLaudo.diagnostico || '',
      tecnica:           editingLaudo.tecnica || '',
      impressao:         editingLaudo.impressao || '',
      status:            novoStatus ?? editingLaudo.status ?? 'rascunho',
      conteudoHtml:      conteudo,
      ocultarData:       editingLaudo.ocultarData,
      ocultarAssinatura: editingLaudo.ocultarAssinatura,
    };
    if (isNew) onAdd(payload);
    else onUpdate({ ...payload, id: editingLaudo.id! });
    closeEditor();
  };

  // ── Importar PDF (simulado) ──
  const handleImportPDF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    insertText(`\n[Arquivo anexado: ${file.name}]\n`);
  };

  // ── Upload imagem ──
  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      editorRef.current?.focus();
      document.execCommand('insertImage', false, ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const filteredPacs = pacientes.filter(p => !searchPac || p.nome.toLowerCase().includes(searchPac.toLowerCase()) || p.cpf.includes(searchPac));

  // ─────────────────────────────────────────────────────────────────────────────
  // VISÃO: LISTA
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'lista') return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>Gerenciamento de Laudo</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>Nesta seção você pode gerenciar todos os laudos gerados.</p>
        </div>
        {isMedico && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
            <Plus size={16}/> Novo Laudo
          </button>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--gray-100)', marginBottom: 16 }}>
        {([
          { id: 'rascunho', label: 'A descrever', count: countRascunho },
          { id: 'liberado', label: 'Liberado',    count: countLiberado },
          { id: 'todos',    label: 'Entregues',   count: laudos.length },
        ] as {id: AbaLista; label: string; count: number}[]).map(tab => (
          <button key={tab.id} onClick={() => setAbaLista(tab.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', border: 'none', borderBottom: `2px solid ${abaLista === tab.id ? 'var(--primary)' : 'transparent'}`, marginBottom: -2, background: 'none', fontSize: 13, fontWeight: 600, color: abaLista === tab.id ? 'var(--primary)' : 'var(--gray-500)', cursor: 'pointer', transition: 'all .15s' }}>
            {tab.label}
            <span style={{ background: abaLista === tab.id ? 'var(--primary)' : 'var(--gray-100)', color: abaLista === tab.id ? '#fff' : 'var(--gray-500)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente/pedido..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}/>
        </div>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
          Hoje
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
          Semana
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid var(--primary)', borderRadius: 8, background: 'var(--mint)', fontSize: 13, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
          Mês
        </button>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
          <AlignLeft size={13}/> Filtros
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: '#fff', fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
            <Search size={13}/> Pesquisar
          </button>
          <button style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: 'none', borderRadius: 8, background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            <Download size={13}/> Exportar <ChevronDown size={12}/>
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
              {['Pedido','Data','Prazo','Paciente','Executante/Solicitante','Exame/Classificação','Ação'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => {
              const pac = pacientes.find(p => p.id === l.pacienteId);
              const vencido = l.data < today;
              return (
                <tr key={l.id} style={{ borderBottom: '1px solid var(--gray-50)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--gray-50)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>

                  {/* Pedido */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>{l.orderNumber || l.id.slice(0,9)}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{l.data.replace(/-/g,'').slice(2)}</div>
                  </td>

                  {/* Data */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                    <div>{formatDateBR(l.data)}</div>
                  </td>

                  {/* Prazo */}
                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: vencido && l.status === 'rascunho' ? 'var(--red-600)' : 'var(--gray-600)' }}>
                      {formatDateBR(l.data)}
                      {vencido && l.status === 'rascunho' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red-500)', display: 'inline-block' }}/>}
                    </div>
                  </td>

                  {/* Paciente */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--dark)', flexShrink: 0 }}>
                        {pac ? initials(pac.nome) : '?'}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-800)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pac?.cpf && <span style={{ color: 'var(--gray-400)', fontSize: 10 }}>{pac.cpf} – </span>}
                          {pac?.nome || 'Paciente removido'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Executante */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.solicitante || user?.full_name || '—'}
                  </td>

                  {/* Exame */}
                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.tecnica || '—'}
                  </td>

                  {/* Ações */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {isMedico && <TblBtn icon={Pencil}       color="var(--amber-600)" title="Editar"             onClick={() => openEdit(l)} />}
                      <TblBtn icon={Printer}      color="#0369a1"        title="Imprimir"           onClick={() => { openEdit(l); setTimeout(() => setView('preview'), 100); }} />
                      {l.status === 'rascunho' && isMedico && (
                        <TblBtn icon={Send}        color="var(--primary)" title="Liberar laudo"       onClick={() => setConfirmLiberar(l.id)} />
                      )}
                      {l.status === 'liberado' && (
                        <TblBtn icon={CheckCircle2} color="#7c3aed"       title="Protocolo entregue" onClick={() => {}} />
                      )}
                      {isMedico && <TblBtn icon={Trash2} color="var(--red-500)" title="Excluir" onClick={() => setConfirmDelete(l.id)} />}
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <FileText size={28} style={{ display: 'block', margin: '0 auto 8px' }}/>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum laudo encontrado</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Ajuste os filtros ou crie um novo laudo.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--gray-500)', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
          <strong>{filtered.length}</strong> laudo{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Confirm Liberar */}
      {confirmLiberar && (
        <Modal onClose={() => setConfirmLiberar(null)}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <Send size={20} color="#7c3aed"/>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--gray-800)' }}>Liberar Laudo?</h3>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 20 }}>Ao liberar, o laudo ficará disponível para impressão e envio ao paciente. Esta ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmLiberar(null)} style={btnSecStyle}>Cancelar</button>
            <button onClick={() => { const l = laudos.find(x => x.id === confirmLiberar); if (l) onUpdate({ ...l, status: 'liberado' }); setConfirmLiberar(null); }}
              style={{ ...btnPrimStyle, background: '#7c3aed' }}>
              <Send size={14}/> Liberar
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--red-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <AlertCircle size={22} color="var(--red-500)"/>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--gray-800)' }}>Excluir laudo?</h3>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 20 }}>Esta ação é irreversível.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmDelete(null)} style={btnSecStyle}>Cancelar</button>
            <button onClick={() => { onDelete(confirmDelete); setConfirmDelete(null); }} style={{ ...btnPrimStyle, background: 'var(--red-500)' }}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISÃO: PREVIEW
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'preview') {
    const pac = pacientes.find(p => p.id === editingLaudo.pacienteId);
    const conteudo = editorRef.current?.innerHTML || editorContent;
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', zIndex: 2000 }}>
        {/* Header do preview */}
        <div style={{ background: 'var(--dark)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Pré-visualização de Laudo</h2>
          <button onClick={() => setView('editor')} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Área do preview */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32, background: '#e5e7eb' }}>
          <div style={{ transform: `scale(${zoom/100})`, transformOrigin: 'top center', transition: 'transform .2s' }}>
            <div style={{
              width: 794, minHeight: 1123, background: '#fff',
              padding: '60px 72px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              fontFamily: fonte, fontSize: `${tamanho}pt`, lineHeight: 1.6, color: '#111',
            }}>
              {/* Cabeçalho do documento */}
              <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 32 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>RELATÓRIO MÉDICO</h1>
              </div>

              {/* Dados do paciente */}
              {pac && (
                <div style={{ marginBottom: 24, fontSize: 12, color: '#555', borderBottom: '1px dashed #ccc', paddingBottom: 12 }}>
                  <strong>{pac.nome}</strong> · Idade: {calcIdade(pac.dataNasc)} · CPF: {pac.cpf} · Convênio: {pac.convenio}
                </div>
              )}

              {/* Conteúdo */}
              <div dangerouslySetInnerHTML={{ __html: resolveCampos(conteudo) }} style={{ minHeight: 400 }} />

              {/* CID */}
              {editingLaudo.cid && (
                <div style={{ marginTop: 24, fontSize: 12 }}><strong>CID:</strong> {editingLaudo.cid}</div>
              )}

              {/* Data e assinatura */}
              <div style={{ marginTop: 48 }}>
                {!editingLaudo.ocultarData && (
                  <div style={{ fontSize: 12, marginBottom: 32 }}>
                    {pac?.cidade || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric' })}
                  </div>
                )}
                {!editingLaudo.ocultarAssinatura && (
                  <div style={{ borderTop: '1px solid #111', paddingTop: 8, display: 'inline-block', minWidth: 240 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{user?.full_name || 'Dr. Médico'}</div>
                    {user?.crm && <div style={{ fontSize: 11, color: '#666' }}>{user.crm} · {user.specialty}</div>}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controles do preview */}
        <div style={{ background: 'var(--dark)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 30, padding: '6px 12px' }}>
            <button onClick={() => setZoom(z => Math.max(50, z-10))} style={previewBtnStyle}><ZoomOut size={15}/></button>
            <button onClick={() => setZoom(z => Math.min(150, z+10))} style={previewBtnStyle}><ZoomIn size={15}/></button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }}/>
            <button onClick={() => setZoom(100)} style={previewBtnStyle}><Maximize2 size={14}/></button>
            <button onClick={() => window.print()} style={previewBtnStyle}><Download size={14}/></button>
          </div>
          <button onClick={() => setView('editor')}
            style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Voltar
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VISÃO: EDITOR
  // ─────────────────────────────────────────────────────────────────────────────
  const pac = pacientes.find(p => p.id === editingLaudo.pacienteId);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden' }}>

      {/* ── Cabeçalho do editor ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
        {/* Linha: título + ações */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={closeEditor} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15}/>
            </button>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>{isNew ? 'Novo Laudo' : 'Editar Laudo'}</h2>
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>
                Status: <span style={{ fontWeight: 700, color: editingLaudo.status === 'liberado' ? '#7c3aed' : 'var(--amber-600)' }}>
                  {editingLaudo.status === 'liberado' ? 'Liberado' : 'Rascunho'}
                </span>
              </div>
            </div>
          </div>

          {/* Identificação do paciente no header */}
          {pac && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--dark)', flexShrink: 0 }}>
                {initials(pac.nome)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>{pac.nome}</span>
                  <Star size={13} color="var(--gray-300)" style={{ cursor: 'pointer' }}/>
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                  Idade: {formatDateBR(pac.dataNasc)} ({calcIdade(pac.dataNasc)}) · CPF: {pac.cpf} · Convênio: {pac.convenio || '—'}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setView('preview')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>
              <Eye size={14}/> Pré-visualizar
            </button>
            <button onClick={() => handleSave('liberado')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              <Send size={13}/> Liberar Laudo
            </button>
          </div>
        </div>

        {/* Linha: seleção de paciente (se não selecionado) */}
        {!pac && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}/>
              <input value={searchPac} onChange={e => { setSearchPac(e.target.value); setShowPacList(true); }}
                onFocus={() => setShowPacList(true)}
                placeholder="Buscar paciente..."
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: `1px solid ${errors.paciente ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }}/>
              {errors.paciente && <span style={{ fontSize: 11, color: 'var(--red-500)', marginTop: 2, display: 'block' }}>{errors.paciente}</span>}
              {showPacList && searchPac && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                  {filteredPacs.slice(0,6).map(p => (
                    <button key={p.id} onClick={() => { setField('pacienteId', p.id); setSearchPac(''); setShowPacList(false); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--gray-50)' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-50)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
                      <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--dark)' }}>{initials(p.nome)}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{p.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.cpf}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Barra de formatação ── */}
        <div style={{ padding: '6px 16px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', background: '#fafafa' }}>
          {/* Formatação de texto */}
          <FmtBtn title="Negrito (Ctrl+B)"     onClick={() => execCmd('bold')}><Bold size={13}/></FmtBtn>
          <FmtBtn title="Itálico (Ctrl+I)"     onClick={() => execCmd('italic')}><Italic size={13}/></FmtBtn>
          <FmtBtn title="Sublinhado (Ctrl+U)"  onClick={() => execCmd('underline')}><Underline size={13}/></FmtBtn>

          <Divider/>

          {/* Tamanho */}
          <select value={tamanho} onChange={e => { setTamanho(e.target.value); execCmd('fontSize', e.target.value); }}
            style={selectStyle}>
            {TAMANHOS.map(t => <option key={t}>{t}</option>)}
          </select>

          {/* Fonte */}
          <select value={fonte} onChange={e => { setFonte(e.target.value); execCmd('fontName', e.target.value); }}
            style={{ ...selectStyle, minWidth: 100 }}>
            {FONTES.map(f => <option key={f}>{f}</option>)}
          </select>

          {/* Cor */}
          <div title="Cor da fonte" style={{ position: 'relative' }}>
            <input type="color" onChange={e => execCmd('foreColor', e.target.value)}
              style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--gray-200)', borderRadius: 4, cursor: 'pointer' }}/>
          </div>

          <Divider/>

          {/* Alinhamento */}
          <FmtBtn title="Esquerda"   onClick={() => execCmd('justifyLeft')}><AlignLeft size={13}/></FmtBtn>
          <FmtBtn title="Centro"     onClick={() => execCmd('justifyCenter')}><AlignCenter size={13}/></FmtBtn>
          <FmtBtn title="Direita"    onClick={() => execCmd('justifyRight')}><AlignRight size={13}/></FmtBtn>
          <FmtBtn title="Justificar" onClick={() => execCmd('justifyFull')}><AlignJustify size={13}/></FmtBtn>

          <Divider/>

          {/* Listas */}
          <FmtBtn title="Lista com marcadores"  onClick={() => execCmd('insertUnorderedList')}><List size={13}/></FmtBtn>
          <FmtBtn title="Lista numerada"        onClick={() => execCmd('insertOrderedList')}><ListOrdered size={13}/></FmtBtn>

          <Divider/>

          {/* Imagem */}
          <FmtBtn title="Inserir imagem" onClick={() => imgInputRef.current?.click()}><Image size={13}/></FmtBtn>
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload}/>
        </div>

        {/* ── Barra de inserção (Modelos, Frases, Campos, Importar PDF) ── */}
        <div style={{ padding: '6px 16px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', position: 'relative' }}>
          {/* Modelos */}
          <DropBtn label="Modelos" icon={<LayoutTemplate size={13}/>} active={showModelos}
            onClick={() => { setShowModelos(!showModelos); setShowFrases(false); setShowCampos(false); }}>
            {showModelos && (
              <DropPanel>
                {MODELOS_BIBLIOTECA.map(m => (
                  <DropItem key={m.id} label={m.titulo} onClick={() => { insertText(resolveCampos(m.conteudo)); setShowModelos(false); }}/>
                ))}
              </DropPanel>
            )}
          </DropBtn>

          {/* Frases */}
          <DropBtn label="Frases" icon={<MessageSquare size={13}/>} active={showFrases}
            onClick={() => { setShowFrases(!showFrases); setShowModelos(false); setShowCampos(false); }}>
            {showFrases && (
              <DropPanel>
                {FRASES_COMUNS.map(f => (
                  <DropItem key={f} label={f} onClick={() => { insertText(f + ' '); setShowFrases(false); }}/>
                ))}
              </DropPanel>
            )}
          </DropBtn>

          {/* Campos */}
          <DropBtn label="Campos" icon={<BookOpen size={13}/>} active={showCampos}
            onClick={() => { setShowCampos(!showCampos); setShowModelos(false); setShowFrases(false); }}>
            {showCampos && (
              <DropPanel>
                {CAMPOS_DINAMICOS.map(c => (
                  <DropItem key={c.label} label={`${c.label} — ${c.desc}`} onClick={() => { insertText(c.label); setShowCampos(false); }}/>
                ))}
              </DropPanel>
            )}
          </DropBtn>

          {/* Importar PDF */}
          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
            <FileText size={13}/> Importar PDF
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleImportPDF}/>
        </div>
      </div>

      {/* ── Área principal: editor + painel lateral ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Editor de texto — simulando folha A4 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: '#e5e7eb', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 794 }}>
            {/* Campo título */}
            <div style={{ background: '#fff', padding: '12px 16px', borderRadius: '8px 8px 0 0', borderBottom: '1px solid var(--gray-100)' }}>
              <input
                value={editingLaudo.exame || 'RELATÓRIO MÉDICO'}
                onChange={e => setField('exame', e.target.value)}
                style={{ width: '100%', border: 'none', outline: 'none', fontSize: 15, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, color: 'var(--dark)', background: 'transparent' }}
                placeholder="TÍTULO DO LAUDO"
              />
            </div>

            {/* Folha do editor */}
            <div
              ref={editorRef}
              contentEditable={isMedico}
              suppressContentEditableWarning
              onInput={() => setEditorContent(editorRef.current?.innerHTML || '')}
              style={{
                minHeight: 600,
                background: '#fff',
                padding: '32px 40px',
                outline: 'none',
                fontFamily: fonte,
                fontSize: `${tamanho}pt`,
                lineHeight: 1.8,
                color: '#111',
                borderRadius: '0 0 8px 8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                cursor: isMedico ? 'text' : 'default',
              }}
              dangerouslySetInnerHTML={{ __html: editorContent || (isMedico ? '<br/>' : '<p style="color:#aaa">Somente médicos podem editar este laudo.</p>') }}
            />
          </div>
        </div>

        {/* Painel lateral direito */}
        <div style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid var(--gray-100)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* CID e campos clínicos */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Campos Clínicos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SideField label="CID" value={editingLaudo.cid || ''} onChange={v => setField('cid', v)} placeholder="Ex: M54.5"/>
              <SideField label="Data do Exame" value={editingLaudo.data || today} onChange={v => setField('data', v)} type="date"/>
              <SideField label="Solicitante" value={editingLaudo.solicitante || ''} onChange={v => setField('solicitante', v)} placeholder="Nome do solicitante"/>
              <SideField label="Técnica/Exame" value={editingLaudo.tecnica || ''} onChange={v => setField('tecnica', v)} placeholder="Ex: Ecocardiograma"/>
            </div>
          </div>

          {/* Imagens */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Imagens</div>
              <button onClick={() => imgInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--mint)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                <Plus size={11}/> Adicionar
              </button>
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 8, border: '1px dashed var(--gray-200)', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => imgInputRef.current?.click()}>
              <Image size={20} color="var(--gray-400)" style={{ display: 'block', margin: '0 auto 6px' }}/>
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Clique para adicionar imagem ou ultrassom</div>
            </div>
          </div>

          {/* Auditoria */}
          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Auditoria</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Criado por', value: user?.full_name || '—' },
                { label: 'Data criação', value: formatDateBR(today) },
                { label: 'Versão', value: isNew ? 'v1 (novo)' : 'v1' },
              ].map(a => (
                <div key={a.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--gray-400)' }}>{a.label}</span>
                  <span style={{ color: 'var(--gray-700)', fontWeight: 600 }}>{a.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rodapé do editor ── */}
      <div style={{ background: '#fff', borderTop: '1px solid var(--gray-100)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          {/* Ocultar data */}
          <Toggle label="Ocultar data" value={editingLaudo.ocultarData || false} onChange={v => setField('ocultarData', v)}/>
          {/* Ocultar assinatura */}
          <Toggle label="Ocultar assinatura" value={editingLaudo.ocultarAssinatura || false} onChange={v => setField('ocultarAssinatura', v)}/>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={closeEditor} style={btnSecStyle}>Cancelar</button>
          <button onClick={() => handleSave('rascunho')} style={btnPrimStyle}>
            <Check size={14}/> Salvar Laudo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function TblBtn({ icon: Icon, color, title, onClick }: { icon: React.ElementType; color: string; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-100)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
      <Icon size={14}/>
    </button>
  );
}

function FmtBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title?: string }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 26, height: 26, borderRadius: 5, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-700)', transition: 'background .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-100)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
      {children}
    </button>
  );
}

function Divider() {
  return <div style={{ width: 1, height: 18, background: 'var(--gray-200)', margin: '0 2px' }}/>;
}

function DropBtn({ label, icon, active, onClick, children }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: active ? 'var(--mint)' : 'none', border: `1px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: active ? 'var(--primary)' : 'var(--gray-600)', cursor: 'pointer', transition: 'all .15s' }}>
        {icon} {label} <ChevronDown size={11}/>
      </button>
      {children}
    </div>
  );
}

function DropPanel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 220, maxHeight: 240, overflowY: 'auto' }}>
      {children}
    </div>
  );
}

function DropItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ display: 'block', width: '100%', padding: '9px 14px', border: 'none', background: 'none', textAlign: 'left', fontSize: 12, color: 'var(--gray-700)', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-50)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
      {label}
    </button>
  );
}

function SideField({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 3 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-200)', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--gray-50)', color: 'var(--gray-800)' }}/>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!value)}
        style={{ width: 34, height: 18, borderRadius: 9, background: value ? 'var(--primary)' : 'var(--gray-300)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
      </div>
      <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{label}</span>
    </label>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 400, width: '90%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 12, right: 12, width: 28, height: 28, borderRadius: 6, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={13}/>
        </button>
        {children}
      </div>
    </div>
  );
}

const btnSecStyle: React.CSSProperties = {
  padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)',
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)',
};
const btnPrimStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '9px 18px', background: 'var(--primary)', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  padding: '3px 6px', border: '1px solid var(--gray-200)', borderRadius: 5,
  fontSize: 12, outline: 'none', background: '#fff', cursor: 'pointer',
};
const previewBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: 28, height: 28,
};