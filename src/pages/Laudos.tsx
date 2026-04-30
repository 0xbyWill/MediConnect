import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, Check, Eye, Printer,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  AlignJustify, List, ListOrdered, Download, ZoomIn, ZoomOut,
  FileText, Image, ChevronDown, AlertCircle, Send,
  Star, CheckCircle2, BookOpen, MessageSquare, LayoutTemplate,
  Maximize2, Mic, MicOff,
} from 'lucide-react';
import type { Laudo, Paciente, StatusLaudo } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO, formatDateBR } from '../shared/utils/date';
import { initials } from '../shared/utils/text';
import { sanitizeHtml } from '../features/laudos/sanitizeHtml';

// ─── Constantes ───────────────────────────────────────────────────────────────
const today = dateToISO(new Date());

const FONTES   = ['Helvetica','Arial','Times New Roman','Courier New','Georgia','Verdana'];
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
  { label: '{NOME}',        desc: 'Nome do paciente' },
  { label: '{CPF}',         desc: 'CPF do paciente' },
  { label: '{IDADE}',       desc: 'Idade do paciente' },
  { label: '{DATA}',        desc: 'Data atual' },
  { label: '{CID}',         desc: 'Código CID' },
  { label: '{MEDICO}',      desc: 'Nome do médico' },
  { label: '{CRM}',         desc: 'CRM do médico' },
  { label: '{DIAGNOSTICO}', desc: 'Diagnóstico' },
  { label: '{CONCLUSAO}',   desc: 'Conclusão' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseISODate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}
function startOfWeek(date: Date) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}
function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}
function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}
function isDateInRange(iso: string, start: Date, end: Date) {
  const date = parseISODate(iso);
  return Boolean(date && date >= start && date <= end);
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
interface LaudoExtra {
  exame?: string;
  solicitante?: string;
  orderNumber?: string;
  cidade?: string;
}

interface LaudosProps {
  laudos: (Laudo & LaudoExtra)[];
  pacientes: (Paciente & { convenio?: string; cidade?: string })[];
  onAdd: (l: Omit<Laudo & LaudoExtra, 'id'>) => void | Promise<void>;
  onUpdate: (l: Laudo & LaudoExtra) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  readOnly?: boolean;
}

type ViewMode = 'lista' | 'editor' | 'preview';
type AbaLista = 'rascunho' | 'liberado' | 'todos';
type PeriodoFiltro = 'todos' | 'hoje' | 'semana' | 'mes';

type SpeechRecognitionCtor = new () => SpeechRecognition;

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
};

const emptyLaudo = (): Omit<Laudo & LaudoExtra, 'id'> => ({
  pacienteId: '', cid: '', data: today,
  diagnostico: '', tecnica: '', impressao: '',
  status: 'rascunho', conteudoHtml: '',
  ocultarData: false, ocultarAssinatura: false,
  exame: 'RELATÓRIO MÉDICO', solicitante: '',
});

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Laudos({ laudos, pacientes, onAdd, onUpdate, onDelete, readOnly = false }: LaudosProps) {
  const { user } = useAuth();
  const isPaciente = user?.role === 'paciente' || readOnly;
  const isMedico = !isPaciente && (user?.role === 'medico' || user?.role === 'gestao');

  // ── Estados gerais ──
  const [view, setView]                     = useState<ViewMode>('lista');
  const [abaLista, setAbaLista]             = useState<AbaLista>('rascunho');
  const [periodoFiltro, setPeriodoFiltro]   = useState<PeriodoFiltro>('todos');
  const [search, setSearch]                 = useState('');
  const [editingLaudo, setEditingLaudo]     = useState<Partial<Laudo & LaudoExtra> & { id?: string }>({});
  const [isNew, setIsNew]                   = useState(false);
  const [confirmDelete, setConfirmDelete]   = useState<string | null>(null);
  const [confirmLiberar, setConfirmLiberar] = useState<string | null>(null);
  const [searchPac, setSearchPac]           = useState('');
  const [showPacList, setShowPacList]       = useState(false);
  const [errors, setErrors]                 = useState<Record<string, string>>({});
  const [saveError, setSaveError]           = useState('');
  const [saving, setSaving]                 = useState(false);
  const [voiceState, setVoiceState]         = useState<'idle' | 'listening' | 'unsupported' | 'error'>('idle');
  const [voiceMessage, setVoiceMessage]     = useState('');

  // ── Estados do editor ──
  const [fonte, setFonte]         = useState('Helvetica');
  const [tamanho, setTamanho]     = useState('12');
  const [showModelos, setShowModelos] = useState(false);
  const [showFrases, setShowFrases]   = useState(false);
  const [showCampos, setShowCampos]   = useState(false);
  // editorContent guarda o HTML serializado para persistência entre views
  const [editorContent, setEditorContent] = useState('');
  const [zoom, setZoom]           = useState(100);
  const editorRef                 = useRef<HTMLDivElement>(null);
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const imgInputRef               = useRef<HTMLInputElement>(null);
  const recognitionRef            = useRef<SpeechRecognition | null>(null);
  // Controla se o editor já foi inicializado para evitar sobrescrever o DOM
  const editorInitialized         = useRef(false);

  // ── FIX #2: Inicializa o innerHTML do editor UMA vez ao montar / ao abrir ──
  // Remove o uso de dangerouslySetInnerHTML no contentEditable
  useEffect(() => {
    if (view === 'editor' && editorRef.current && !editorInitialized.current) {
      editorRef.current.innerHTML = sanitizeHtml(
        editorContent || (isMedico ? '<br/>' : '<p style="color:#aaa">Somente médicos podem editar este laudo.</p>')
      );
      editorInitialized.current = true;
    }
    if (view !== 'editor') {
      editorInitialized.current = false;
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  // ── Salva/restaura seleção — o <select> rouba foco antes do onChange disparar ──
  const savedRangeRef = useRef<Range | null>(null);

  const saveSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const restoreSelection = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || !savedRangeRef.current) return null;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
    return savedRangeRef.current;
  };

  // ── Envolve range em span com estilo — lida com seleções que cruzam tags ──
  const wrapRangeWithSpan = (range: Range, style: Partial<CSSStyleDeclaration>) => {
    // Extrai o conteúdo do range e coloca dentro de um span
    const frag = range.extractContents();
    const span = document.createElement('span');
    Object.assign(span.style, style);
    span.appendChild(frag);
    range.insertNode(span);
    // Reposiciona cursor após o span
    const sel = window.getSelection();
    if (sel) {
      const r = document.createRange();
      r.setStartAfter(span);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    return span;
  };

  // ── Aplica tamanho em pt ──
  // Estratégia: sempre usa insertHTML com span inline.
  // Para seleção: extrai e re-insere. Para cursor: insere span vazio e posiciona dentro.
  const applyFontSize = useCallback((size: string) => {
    editorRef.current?.focus();
    const range = restoreSelection();

    const sel = window.getSelection();
    if (!sel) return;

    const ptSize = `${size}pt`;

    if (range && !range.collapsed) {
      // Tem texto selecionado: envolve
      wrapRangeWithSpan(range, { fontSize: ptSize });
    } else {
      // Sem seleção: insere span de "marcador" com zero-width space para o cursor ficar dentro
      // O próximo texto digitado herdará o font-size do span
      const marker = document.createElement('span');
      marker.style.fontSize = ptSize;
      marker.innerHTML = '​'; // zero-width space
      const currentRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (currentRange) {
        currentRange.insertNode(marker);
        // Posiciona cursor dentro do span (após o zero-width space)
        const r = document.createRange();
        r.setStart(marker, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }

    setEditorContent(editorRef.current?.innerHTML || '');
    editorRef.current?.focus();
  }, []);

  // ── Aplica fonte — mesma estratégia ──
  const applyFont = useCallback((font: string) => {
    editorRef.current?.focus();
    const range = restoreSelection();
    const sel = window.getSelection();
    if (!sel) return;

    if (range && !range.collapsed) {
      wrapRangeWithSpan(range, { fontFamily: font });
    } else {
      const marker = document.createElement('span');
      marker.style.fontFamily = font;
      marker.innerHTML = '​';
      const currentRange = sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      if (currentRange) {
        currentRange.insertNode(marker);
        const r = document.createRange();
        r.setStart(marker, 1);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }

    setEditorContent(editorRef.current?.innerHTML || '');
    editorRef.current?.focus();
  }, []);

  // ── Filtros ──
  const hoje = startOfDay(new Date());
  const periodos: Record<PeriodoFiltro, { label: string; match: (data: string) => boolean }> = {
    todos:  { label: 'Todos',  match: () => true },
    hoje:   { label: 'Hoje',   match: data => data === today },
    semana: { label: 'Semana', match: data => isDateInRange(data, startOfWeek(hoje), endOfWeek(hoje)) },
    mes:    { label: 'Mês',    match: data => isDateInRange(data, startOfMonth(hoje), endOfMonth(hoje)) },
  };

  const filtered = laudos.filter(l => {
    const pac = pacientes.find(p => p.id === l.pacienteId);
    const q   = search.toLowerCase().trim();
    const matchSearch = !q
      || pac?.nome.toLowerCase().includes(q)
      || pac?.cpf.includes(q)
      || l.orderNumber?.toLowerCase().includes(q)
      || l.cid.toLowerCase().includes(q)
      || l.diagnostico.toLowerCase().includes(q)
      || l.exame?.toLowerCase().includes(q)
      || l.solicitante?.toLowerCase().includes(q);
    // FIX #3: 'todos' mostra todos os status (label corrigido no JSX)
    const matchAba = abaLista === 'todos' || l.status === abaLista;
    const matchPeriodo = periodos[periodoFiltro].match(l.data);
    return matchSearch && matchAba && matchPeriodo;
  }).sort((a, b) => b.data.localeCompare(a.data));

  const countRascunho = laudos.filter(l => l.status === 'rascunho').length;
  const countLiberado = laudos.filter(l => l.status === 'liberado').length;
  const periodoOptions: PeriodoFiltro[] = ['todos', 'hoje', 'semana', 'mes'];
  const hasActiveFilters = search.trim() || periodoFiltro !== 'todos' || abaLista !== 'todos';
  const clearFilters = () => {
    setSearch('');
    setPeriodoFiltro('todos');
    setAbaLista('todos');
  };

  // ── Abrir editor ──
  const openNew = () => {
    const initial = { ...emptyLaudo() };
    setEditingLaudo(initial);
    setEditorContent('');
    setIsNew(true);
    setErrors({});
    setSaveError('');
    setSearchPac('');
    editorInitialized.current = false;
    setView('editor');
  };

  const openEdit = (l: Laudo & LaudoExtra) => {
    setEditingLaudo({ ...l });
    setEditorContent(l.conteudoHtml || l.diagnostico || '');
    setIsNew(false);
    setErrors({});
    setSaveError('');
    editorInitialized.current = false;
    setView('editor');
  };

  const closeEditor = () => {
    setView('lista');
    setShowModelos(false);
    setShowFrases(false);
    setShowCampos(false);
  };

  // ── Set field ──
  const setField = useCallback(<K extends keyof (Laudo & LaudoExtra)>(k: K, v: (Laudo & LaudoExtra)[K]) => {
    setEditingLaudo(prev => ({ ...prev, [k]: v }));
  }, []);

  // ── Executa comando de formatação (bold, italic, underline, alinhamento, listas) ──
  const execCmd = (cmd: string, val?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    // Sincroniza conteúdo após comando
    setEditorContent(editorRef.current?.innerHTML || '');
  };

  // ── Insere texto no editor ──
  const insertText = (txt: string) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, txt);
    setEditorContent(editorRef.current?.innerHTML || '');
  };

  const toggleVoiceDictation = () => {
    const SpeechCtor = (window as SpeechWindow).SpeechRecognition || (window as SpeechWindow).webkitSpeechRecognition;
    if (!SpeechCtor) {
      setVoiceState('unsupported');
      setVoiceMessage('Reconhecimento de voz não suportado neste navegador.');
      return;
    }

    if (voiceState === 'listening') {
      recognitionRef.current?.stop();
      setVoiceState('idle');
      setVoiceMessage('Ditado pausado.');
      return;
    }

    const recognition = new SpeechCtor();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = event => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript;
      }
      if (text.trim()) insertText(`${text.trim()} `);
    };
    recognition.onerror = event => {
      setVoiceState('error');
      setVoiceMessage(event.error === 'not-allowed' ? 'Permissão do microfone negada.' : `Erro no ditado: ${event.error}`);
    };
    recognition.onend = () => {
      setVoiceState(state => state === 'listening' ? 'idle' : state);
    };
    recognitionRef.current = recognition;
    setVoiceState('listening');
    setVoiceMessage('Ouvindo...');
    recognition.start();
  };

  // ── Resolve campos dinâmicos ──
  const resolveCampos = (texto: string) => {
    const pac = pacientes.find(p => p.id === editingLaudo.pacienteId);
    return texto
      .replace(/{NOME}/g,        pac?.nome || '[Nome do Paciente]')
      .replace(/{CPF}/g,         pac?.cpf || '')
      .replace(/{IDADE}/g,       pac ? calcIdade(pac.dataNasc) : '')
      .replace(/{DATA}/g,        formatDateBR(today))
      .replace(/{CID}/g,         editingLaudo.cid || '')
      .replace(/{MEDICO}/g,      user?.full_name || '')
      .replace(/{CRM}/g,         user?.crm || '')
      .replace(/{DIAGNOSTICO}/g, editingLaudo.diagnostico || '')
      .replace(/{CONCLUSAO}/g,   editingLaudo.impressao || '');
  };

  // ── Salvar ──
  const validate = () => {
    const e: Record<string, string> = {};
    if (!editingLaudo.pacienteId) e.paciente = 'Selecione um paciente';
    return e;
  };

  // FIX #4: Lê innerHTML do editor de forma confiável antes de mudar de view
  const getEditorHtml = (): string => {
    if (editorRef.current) {
      return sanitizeHtml(editorRef.current.innerHTML);
    }
    return sanitizeHtml(editorContent);
  };

  const handleSave = async (novoStatus?: StatusLaudo) => {
    if (saving) return;
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    const conteudo = getEditorHtml();
    const payload: Omit<Laudo & LaudoExtra, 'id'> = {
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
      exame:             editingLaudo.exame || 'RELATÓRIO MÉDICO',
      solicitante:       editingLaudo.solicitante || '',
    };
    setSaving(true);
    setSaveError('');
    try {
      if (isNew) await onAdd(payload);
      else await onUpdate({ ...payload, id: editingLaudo.id! });
      closeEditor();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar laudo.');
    } finally {
      setSaving(false);
    }
  };

  // FIX #5: Ao ir para preview, salva o HTML atual do editor no estado antes de desmontar
  const handleGoPreview = () => {
    const html = getEditorHtml();
    setEditorContent(html);
    setView('preview');
  };

  const exportLaudo = (l?: Laudo & LaudoExtra) => {
    const target = l || (editingLaudo.id ? laudos.find(item => item.id === editingLaudo.id) : undefined);
    const current = target || editingLaudo;
    const pac = pacientes.find(p => p.id === current.pacienteId);
    const content = sanitizeHtml(current.conteudoHtml || current.diagnostico || editorContent || '');
    const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=1100');
    if (!win) return;
    win.document.write(`<!doctype html>
      <html>
        <head>
          <title>${current.exame || 'Laudo'} - ${pac?.nome || 'Paciente'}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 48px; line-height: 1.6; }
            header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 16px; margin-bottom: 28px; }
            h1 { font-size: 18px; letter-spacing: 1.5px; text-transform: uppercase; }
            .patient { border-bottom: 1px dashed #ccc; padding-bottom: 12px; margin-bottom: 24px; color: #555; font-size: 13px; }
            .signature { margin-top: 56px; border-top: 1px solid #111; padding-top: 8px; display: inline-block; min-width: 260px; }
            @media print { body { margin: 32px; } }
          </style>
        </head>
        <body>
          <header><h1>${current.exame || 'Relatório Médico'}</h1></header>
          <section class="patient">
            <strong>${pac?.nome || 'Paciente não selecionado'}</strong>
            ${pac ? ` · CPF: ${pac.cpf || ''} · Idade: ${calcIdade(pac.dataNasc)} · Convênio: ${pac.convenio || ''}` : ''}
            ${current.cid ? ` · CID: ${current.cid}` : ''}
          </section>
          <main>${content}</main>
          <p>${formatDateBR(current.data || today)}</p>
          <section class="signature"><strong>${user?.full_name || ''}</strong>${user?.crm ? `<br>${user.crm}` : ''}</section>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>`);
    win.document.close();
  };

  // ── Importar PDF (simulado) ──
  const handleImportPDF = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    insertText(`\n[Arquivo anexado: ${file.name}]\n`);
    e.target.value = '';
  };

  // ── Upload imagem ──
  const handleImgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      editorRef.current?.focus();
      document.execCommand('insertImage', false, ev.target?.result as string);
      setEditorContent(editorRef.current?.innerHTML || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredPacs = pacientes.filter(p =>
    !searchPac
    || p.nome.toLowerCase().includes(searchPac.toLowerCase())
    || p.cpf.includes(searchPac)
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // VISÃO: LISTA
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'lista') return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>{isPaciente ? 'Meus Laudos' : 'Gerenciamento de Laudo'}</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            {isPaciente ? 'Visualize os laudos vinculados ao seu perfil.' : 'Nesta seção você pode gerenciar todos os laudos gerados.'}
          </p>
        </div>
        {isMedico && (
          <button onClick={openNew}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
            <Plus size={16} /> Novo Laudo
          </button>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--gray-100)', marginBottom: 16 }}>
        {([
          { id: 'rascunho', label: 'A descrever', count: countRascunho },
          { id: 'liberado', label: 'Liberado',    count: countLiberado },
          // FIX #3: Label "Todos" em vez de "Entregues" para refletir o filtro real
          { id: 'todos',    label: 'Todos',        count: laudos.length },
        ] as { id: AbaLista; label: string; count: number }[]).map(tab => (
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
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar paciente/pedido..."
            style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }} />
        </div>
        {periodoOptions.map(periodo => {
          const active = periodoFiltro === periodo;
          return (
            <button key={periodo} onClick={() => setPeriodoFiltro(periodo)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: `1px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 8, background: active ? 'var(--mint)' : '#fff', fontSize: 13, fontWeight: active ? 700 : 600, color: active ? 'var(--primary)' : 'var(--gray-600)', cursor: 'pointer' }}>
              {periodos[periodo].label}
            </button>
          );
        })}
        <button onClick={clearFilters}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', border: `1px solid ${hasActiveFilters ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 8, background: hasActiveFilters ? 'var(--mint)' : '#fff', fontSize: 12, fontWeight: 600, color: hasActiveFilters ? 'var(--primary)' : 'var(--gray-600)', cursor: 'pointer' }}>
          <AlignLeft size={13} /> Limpar filtros
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => exportLaudo(filtered[0])} disabled={!filtered[0]}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', border: 'none', borderRadius: 8, background: filtered[0] ? 'var(--primary)' : 'var(--gray-200)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: filtered[0] ? 'pointer' : 'not-allowed' }}>
            <Download size={13} /> Exportar <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
              {['Pedido', 'Data', 'Prazo', 'Paciente', 'Executante/Solicitante', 'Exame/Classificação', 'Ação'].map(h => (
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

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>{l.orderNumber || l.id.slice(0, 9)}</div>
                    <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>{l.data.replace(/-/g, '').slice(2)}</div>
                  </td>

                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                    <div>{formatDateBR(l.data)}</div>
                  </td>

                  <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: vencido && l.status === 'rascunho' ? 'var(--red-600)' : 'var(--gray-600)' }}>
                      {formatDateBR(l.data)}
                      {vencido && l.status === 'rascunho' && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--red-500)', display: 'inline-block' }} />}
                    </div>
                  </td>

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

                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.solicitante || user?.full_name || '—'}
                  </td>

                  <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-600)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {l.tecnica || '—'}
                  </td>

                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {isMedico && <TblBtn icon={Pencil} color="var(--amber-600)" title="Editar" onClick={() => openEdit(l)} />}
                      {/* FIX: Removida a race condition — openEdit já define a view como editor; preview vai separado */}
                      <TblBtn icon={Printer} color="#0369a1" title="Exportar/Imprimir" onClick={() => exportLaudo(l)} />
                      {l.status === 'rascunho' && isMedico && (
                        <TblBtn icon={Send} color="var(--primary)" title="Liberar laudo" onClick={() => setConfirmLiberar(l.id)} />
                      )}
                      {l.status === 'liberado' && (
                        <TblBtn icon={CheckCircle2} color="#7c3aed" title="Protocolo entregue" onClick={() => { }} />
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
                  <FileText size={28} style={{ display: 'block', margin: '0 auto 8px' }} />
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
            <Send size={20} color="#7c3aed" />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--gray-800)' }}>Liberar Laudo?</h3>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 20 }}>Ao liberar, o laudo ficará disponível para impressão e envio ao paciente. Esta ação não pode ser desfeita.</p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setConfirmLiberar(null)} style={btnSecStyle}>Cancelar</button>
            <button onClick={() => {
              const l = laudos.find(x => x.id === confirmLiberar);
              if (l) onUpdate({ ...l, status: 'liberado' });
              setConfirmLiberar(null);
            }} style={{ ...btnPrimStyle, background: '#7c3aed' }}>
              <Send size={14} /> Liberar
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm Delete */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--red-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
            <AlertCircle size={22} color="var(--red-500)" />
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
  // FIX #5: Usa editorContent (estado) em vez de editorRef.current (desmontado)
  // ─────────────────────────────────────────────────────────────────────────────
  if (view === 'preview') {
    const pac = pacientes.find(p => p.id === editingLaudo.pacienteId);
    // editorContent foi salvo via handleGoPreview antes de desmontar o editor
    const conteudoPreview = sanitizeHtml(resolveCampos(editorContent));
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', zIndex: 2000 }}>
        <div style={{ background: 'var(--dark)', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <h2 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: 0 }}>Pré-visualização de Laudo</h2>
          <button onClick={() => setView('editor')} style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32, background: '#e5e7eb' }}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform .2s' }}>
            <div style={{
              width: 794, minHeight: 1123, background: '#fff',
              padding: '60px 72px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              fontFamily: fonte, fontSize: `${tamanho}pt`, lineHeight: 1.6, color: '#111',
            }}>
              <div style={{ textAlign: 'center', borderBottom: '2px solid #111', paddingBottom: 16, marginBottom: 32 }}>
                <h1 style={{ fontSize: 16, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', margin: 0 }}>
                  {editingLaudo.exame || 'RELATÓRIO MÉDICO'}
                </h1>
              </div>

              {pac && (
                <div style={{ marginBottom: 24, fontSize: 12, color: '#555', borderBottom: '1px dashed #ccc', paddingBottom: 12 }}>
                  <strong>{pac.nome}</strong> · Idade: {calcIdade(pac.dataNasc)} · CPF: {pac.cpf} · Convênio: {pac.convenio}
                </div>
              )}

              {/* FIX XSS: conteúdo sanitizado antes de renderizar */}
              <div dangerouslySetInnerHTML={{ __html: conteudoPreview }} style={{ minHeight: 400 }} />

              {editingLaudo.cid && (
                <div style={{ marginTop: 24, fontSize: 12 }}><strong>CID:</strong> {editingLaudo.cid}</div>
              )}

              <div style={{ marginTop: 48 }}>
                {!editingLaudo.ocultarData && (
                  <div style={{ fontSize: 12, marginBottom: 32 }}>
                    {pac?.cidade || 'Local'}, {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
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

        <div style={{ background: 'var(--dark)', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 30, padding: '6px 12px' }}>
            <button onClick={() => setZoom(z => Math.max(50, z - 10))} style={previewBtnStyle}><ZoomOut size={15} /></button>
            <button onClick={() => setZoom(z => Math.min(150, z + 10))} style={previewBtnStyle}><ZoomIn size={15} /></button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.3)' }} />
            <button onClick={() => setZoom(100)} style={previewBtnStyle}><Maximize2 size={14} /></button>
            <button onClick={() => exportLaudo()} style={previewBtnStyle}><Download size={14} /></button>
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
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden', minHeight: 0 }}>

      {/* ── Cabeçalho do editor ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={closeEditor} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={15} />
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

          {pac && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: 'var(--gray-50)', borderRadius: 10, border: '1px solid var(--gray-100)' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--dark)', flexShrink: 0 }}>
                {initials(pac.nome)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>{pac.nome}</span>
                  <Star size={13} color="var(--gray-300)" style={{ cursor: 'pointer' }} />
                </div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                  Idade: {formatDateBR(pac.dataNasc)} ({calcIdade(pac.dataNasc)}) · CPF: {pac.cpf} · Convênio: {pac.convenio || '—'}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* FIX #5: Usa handleGoPreview para salvar HTML antes de desmontar o editor */}
            <button onClick={handleGoPreview}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--gray-700)' }}>
              <Eye size={14} /> Pré-visualizar
            </button>
            <button onClick={() => { void handleSave('liberado'); }} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: saving ? 'var(--gray-300)' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
              <Send size={13} /> {saving ? 'Salvando...' : 'Liberar Laudo'}
            </button>
          </div>
        </div>

        {/* Linha: seleção de paciente */}
        {!pac && (
          <div style={{ padding: '0 20px 12px' }}>
            <div style={{ position: 'relative', maxWidth: 420 }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input value={searchPac} onChange={e => { setSearchPac(e.target.value); setShowPacList(true); }}
                onFocus={() => setShowPacList(true)}
                placeholder="Buscar paciente..."
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: `1px solid ${errors.paciente ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: '#fff' }} />
              {errors.paciente && <span style={{ fontSize: 11, color: 'var(--red-500)', marginTop: 2, display: 'block' }}>{errors.paciente}</span>}
              {showPacList && searchPac && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 8, zIndex: 10, maxHeight: 160, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: 2 }}>
                  {filteredPacs.slice(0, 6).map(p => (
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
          <FmtBtn title="Negrito (Ctrl+B)"    onClick={() => execCmd('bold')}><Bold size={13} /></FmtBtn>
          <FmtBtn title="Itálico (Ctrl+I)"    onClick={() => execCmd('italic')}><Italic size={13} /></FmtBtn>
          <FmtBtn title="Sublinhado (Ctrl+U)" onClick={() => execCmd('underline')}><Underline size={13} /></FmtBtn>

          <Divider />

          {/* Tamanho: salva seleção no onMouseDown pois o select rouba foco antes do onChange */}
          <select value={tamanho}
            onMouseDown={saveSelection}
            onFocus={saveSelection}
            onChange={e => { setTamanho(e.target.value); applyFontSize(e.target.value); }}
            style={selectStyle}>
            {TAMANHOS.map(t => <option key={t}>{t}</option>)}
          </select>

          {/* Fonte: mesma estratégia de salvar seleção */}
          <select value={fonte}
            onMouseDown={saveSelection}
            onFocus={saveSelection}
            onChange={e => { setFonte(e.target.value); applyFont(e.target.value); }}
            style={{ ...selectStyle, minWidth: 100 }}>
            {FONTES.map(f => <option key={f}>{f}</option>)}
          </select>

          <div title="Cor da fonte" style={{ position: 'relative' }}>
            <input type="color" onChange={e => execCmd('foreColor', e.target.value)}
              style={{ width: 28, height: 24, padding: 0, border: '1px solid var(--gray-200)', borderRadius: 4, cursor: 'pointer' }} />
          </div>

          <Divider />

          <FmtBtn title="Esquerda"   onClick={() => execCmd('justifyLeft')}><AlignLeft size={13} /></FmtBtn>
          <FmtBtn title="Centro"     onClick={() => execCmd('justifyCenter')}><AlignCenter size={13} /></FmtBtn>
          <FmtBtn title="Direita"    onClick={() => execCmd('justifyRight')}><AlignRight size={13} /></FmtBtn>
          <FmtBtn title="Justificar" onClick={() => execCmd('justifyFull')}><AlignJustify size={13} /></FmtBtn>

          <Divider />

          <FmtBtn title="Lista com marcadores" onClick={() => execCmd('insertUnorderedList')}><List size={13} /></FmtBtn>
          <FmtBtn title="Lista numerada"       onClick={() => execCmd('insertOrderedList')}><ListOrdered size={13} /></FmtBtn>

          <Divider />

          <FmtBtn title="Inserir imagem" onClick={() => imgInputRef.current?.click()}><Image size={13} /></FmtBtn>
          <input ref={imgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgUpload} />
          <button type="button" title="Digitação por voz" onClick={toggleVoiceDictation}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 6, border: `1px solid ${voiceState === 'listening' ? 'var(--primary)' : 'var(--gray-200)'}`, background: voiceState === 'listening' ? 'var(--mint)' : '#fff', color: voiceState === 'listening' ? 'var(--primary)' : 'var(--gray-600)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
            {voiceState === 'listening' ? <MicOff size={13} /> : <Mic size={13} />}
            {voiceState === 'listening' ? 'Parar ditado' : 'Digitação por voz'}
          </button>
          {voiceMessage && (
            <span style={{ fontSize: 11, color: voiceState === 'error' || voiceState === 'unsupported' ? 'var(--red-600)' : 'var(--gray-500)', marginLeft: 4 }}>
              {voiceMessage}
            </span>
          )}
        </div>

        {/* ── Barra de inserção ── */}
        <div style={{ padding: '6px 16px', borderTop: '1px solid var(--gray-100)', display: 'flex', alignItems: 'center', gap: 8, background: '#fff', position: 'relative' }}>
          <DropBtn label="Modelos" icon={<LayoutTemplate size={13} />} active={showModelos}
            onClick={() => { setShowModelos(!showModelos); setShowFrases(false); setShowCampos(false); }}>
            {showModelos && (
              <DropPanel>
                {MODELOS_BIBLIOTECA.map(m => (
                  <DropItem key={m.id} label={m.titulo} onClick={() => { insertText(resolveCampos(m.conteudo)); setShowModelos(false); }} />
                ))}
              </DropPanel>
            )}
          </DropBtn>

          <DropBtn label="Frases" icon={<MessageSquare size={13} />} active={showFrases}
            onClick={() => { setShowFrases(!showFrases); setShowModelos(false); setShowCampos(false); }}>
            {showFrases && (
              <DropPanel>
                {FRASES_COMUNS.map(f => (
                  <DropItem key={f} label={f} onClick={() => { insertText(f + ' '); setShowFrases(false); }} />
                ))}
              </DropPanel>
            )}
          </DropBtn>

          <DropBtn label="Campos" icon={<BookOpen size={13} />} active={showCampos}
            onClick={() => { setShowCampos(!showCampos); setShowModelos(false); setShowFrases(false); }}>
            {showCampos && (
              <DropPanel>
                {CAMPOS_DINAMICOS.map(c => (
                  <DropItem key={c.label} label={`${c.label} — ${c.desc}`} onClick={() => { insertText(c.label); setShowCampos(false); }} />
                ))}
              </DropPanel>
            )}
          </DropBtn>

          <button onClick={() => fileInputRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer' }}>
            <FileText size={13} /> Importar PDF
          </button>
          <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleImportPDF} />
        </div>
      </div>

      {/* ── Área principal ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Editor — fundo cinza simulando mesa, folha A4 centralizada */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '32px 24px',
          background: '#c8cdd4',          /* cinza escuro tipo "mesa" */
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Folha A4: 794px largura, proporção A4 ≈ 1:1.414, margens Word (2.5cm ≈ 96px) */}
          <div style={{
            width: 794,
            minHeight: 1123,              /* altura mínima A4 a 96dpi */
            background: '#ffffff',
            boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 1px 4px rgba(0,0,0,0.2)',
            padding: '96px 96px 96px 96px', /* margens A4 padrão Word ~2.5cm */
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            marginBottom: 32,
          }}>

            {/* ── Cabeçalho interno da folha (título editável) ── */}
            <div style={{
              borderBottom: '2px solid #111',
              paddingBottom: 12,
              marginBottom: 24,
              textAlign: 'center',
            }}>
              <input
                value={editingLaudo.exame || 'RELATÓRIO MÉDICO'}
                onChange={e => setField('exame', e.target.value)}
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  fontSize: 16,
                  fontWeight: 700,
                  textAlign: 'center',
                  textTransform: 'uppercase',
                  letterSpacing: 2,
                  color: '#111',
                  background: 'transparent',
                  fontFamily: fonte,
                }}
                placeholder="TÍTULO DO LAUDO"
              />
            </div>

            {/* ── Dados do paciente (linha de identificação) ── */}
            {pac && (
              <div style={{
                fontSize: 11,
                color: '#555',
                borderBottom: '1px dashed #ccc',
                paddingBottom: 10,
                marginBottom: 20,
                lineHeight: 1.6,
              }}>
                <strong>{pac.nome}</strong>
                {' · '}Idade: {calcIdade(pac.dataNasc)}
                {' · '}CPF: {pac.cpf}
                {pac.convenio ? ` · Convênio: ${pac.convenio}` : ''}
                {editingLaudo.cid ? ` · CID: ${editingLaudo.cid}` : ''}
                {editingLaudo.data ? ` · Data: ${formatDateBR(editingLaudo.data)}` : ''}
              </div>
            )}

            {/* ── Área de texto contentEditable ── */}
            {/*
              innerHTML inicializado via useEffect (montagem apenas).
              Sem dangerouslySetInnerHTML para não sobrescrever DOM a cada render.
            */}
            <div
              ref={editorRef}
              contentEditable={isMedico}
              suppressContentEditableWarning
              onInput={() => setEditorContent(editorRef.current?.innerHTML || '')}
              style={{
                flex: 1,
                minHeight: 700,
                outline: 'none',
                fontFamily: fonte,
                fontSize: `${tamanho}pt`,
                lineHeight: 1.8,
                color: '#111',
                cursor: isMedico ? 'text' : 'default',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            />

            {/* ── Rodapé da folha: data e assinatura ── */}
            <div style={{ marginTop: 48, paddingTop: 16 }}>
              {!editingLaudo.ocultarData && (
                <div style={{ fontSize: 11, color: '#555', marginBottom: 40 }}>
                  {pac?.cidade || 'Local'},{' '}
                  {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              )}
              {!editingLaudo.ocultarAssinatura && (
                <div style={{ display: 'inline-block', minWidth: 220, borderTop: '1px solid #111', paddingTop: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>{user?.full_name || 'Dr. Médico'}</div>
                  {user?.crm && (
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>{user.crm}{user.specialty ? ` · ${user.specialty}` : ''}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Painel lateral */}
        <div style={{ width: 260, flexShrink: 0, background: '#fff', borderLeft: '1px solid var(--gray-100)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Campos Clínicos</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SideField label="CID"           value={editingLaudo.cid || ''}         onChange={v => setField('cid', v)}         placeholder="Ex: M54.5" />
              <SideField label="Data do Exame" value={editingLaudo.data || today}      onChange={v => setField('data', v)}        type="date" />
              <SideField label="Solicitante"   value={editingLaudo.solicitante || ''} onChange={v => setField('solicitante', v)} placeholder="Nome do solicitante" />
              <SideField label="Técnica/Exame" value={editingLaudo.tecnica || ''}     onChange={v => setField('tecnica', v)}     placeholder="Ex: Ecocardiograma" />
            </div>
          </div>

          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Imagens</div>
              <button onClick={() => imgInputRef.current?.click()}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: 'var(--mint)', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, color: 'var(--primary)', cursor: 'pointer' }}>
                <Plus size={11} /> Adicionar
              </button>
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 8, border: '1px dashed var(--gray-200)', padding: '16px', textAlign: 'center', cursor: 'pointer' }}
              onClick={() => imgInputRef.current?.click()}>
              <Image size={20} color="var(--gray-400)" style={{ display: 'block', margin: '0 auto 6px' }} />
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>Clique para adicionar imagem</div>
            </div>
          </div>

          <div style={{ padding: 16, borderBottom: '1px solid var(--gray-100)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Auditoria</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { label: 'Criado por',   value: user?.full_name || '—' },
                { label: 'Data criação', value: formatDateBR(today) },
                { label: 'Versão',       value: isNew ? 'v1 (novo)' : 'v1' },
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

      {/* ── Rodapé ── */}
      <div style={{ background: '#fff', borderTop: '1px solid var(--gray-100)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Toggle label="Ocultar data"       value={editingLaudo.ocultarData || false}       onChange={v => setField('ocultarData', v)} />
          <Toggle label="Ocultar assinatura" value={editingLaudo.ocultarAssinatura || false} onChange={v => setField('ocultarAssinatura', v)} />
        </div>
        {saveError && (
          <div style={{ color: 'var(--red-600)', fontSize: 12, fontWeight: 700, flex: 1, minWidth: 220 }}>
            {saveError}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={closeEditor} disabled={saving} style={btnSecStyle}>Cancelar</button>
          <button onClick={() => { void handleSave('rascunho'); }} disabled={saving} style={{ ...btnPrimStyle, background: saving ? 'var(--gray-300)' : btnPrimStyle.background, cursor: saving ? 'not-allowed' : 'pointer' }}>
            <Check size={14} /> {saving ? 'Salvando...' : 'Salvar Laudo'}
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
      <Icon size={14} />
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
  return <div style={{ width: 1, height: 18, background: 'var(--gray-200)', margin: '0 2px' }} />;
}

function DropBtn({ label, icon, active, onClick, children }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void; children?: React.ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: active ? 'var(--mint)' : 'none', border: `1px solid ${active ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 6, fontSize: 12, fontWeight: 600, color: active ? 'var(--primary)' : 'var(--gray-600)', cursor: 'pointer', transition: 'all .15s' }}>
        {icon} {label} <ChevronDown size={11} />
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
        style={{ width: '100%', padding: '7px 10px', border: '1px solid var(--gray-200)', borderRadius: 7, fontSize: 12, outline: 'none', background: 'var(--gray-50)', color: 'var(--gray-800)' }} />
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
      <div onClick={() => onChange(!value)}
        style={{ width: 34, height: 18, borderRadius: 9, background: value ? 'var(--primary)' : 'var(--gray-300)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
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
          <X size={13} />
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
