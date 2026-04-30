import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Eye, Pencil, Trash2, X, Camera, User,
  Filter, Calendar, ChevronDown, Phone, MapPin,
  AlertCircle, Clock, CheckCircle2,
} from 'lucide-react';
import type { Paciente, ConvenioType, StatusPaciente } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';
import { digitsOnly, isValidCpf } from '../shared/utils/cpf';
import { initials } from '../shared/utils/text';

// ─── Constantes ───────────────────────────────────────────────────────────────
const CONVENIOS: ConvenioType[] = [
  'Particular', 'Unimed Nacional', 'Bradesco Saúde',
  'Amil S450', 'SulAmérica', 'Porto Seguro', 'Notre Dame',
];

const RACAS  = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União estável', 'Separado(a)'];
const NACIONALIDADES = [
  'Brasileira', 'Afegã', 'Alemã', 'Angolana', 'Argentina', 'Australiana', 'Belga',
  'Boliviana', 'Canadense', 'Chilena', 'Chinesa', 'Colombiana', 'Coreana',
  'Cubana', 'Espanhola', 'Estadunidense', 'Francesa', 'Haitiana', 'Indiana',
  'Italiana', 'Japonesa', 'Mexicana', 'Moçambicana', 'Paraguaia', 'Peruana',
  'Portuguesa', 'Reino-unidense', 'Uruguaia', 'Venezuelana', 'Outra',
];
const TIPOS_DOC = ['CNH', 'Passaporte', 'Certidão de Nascimento', 'Carteira de Trabalho', 'Outro'];
const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Abas do formulário
const FORM_TABS = [
  { id: 'dados',     label: 'Dados Pessoais' },
  { id: 'endereco',  label: 'Endereço' },
  { id: 'medico',    label: 'Inf. Médicas' },
  { id: 'convenio',  label: 'Convênio' },
  { id: 'obs',       label: 'Observações' },
];

// ─── Tipos auxiliares ─────────────────────────────────────────────────────────
interface PacienteExtended extends Paciente {
  rg?: string;
  sexo?: string;
  naturalidade?: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  nomeMae?: string;
  profissaoMae?: string;
  nomePai?: string;
  profissaoPai?: string;
  nomeResponsavel?: string;
  cpfResponsavel?: string;
  nomeEsposo?: string;
  rnGuiaConvenio?: boolean;
  codigoLegado?: string;
  outroDocTipo?: string;
  outroDocNumero?: string;
  telefone2?: string;
  tipoSanguineo?: string;
  peso?: string;
  altura?: string;
  alergias?: string;
  planoConvenio?: string;
  matriculaConvenio?: string;
  validadeCarteira?: string;
  ultimoAtendimento?: string;
  proximoAtendimento?: string;
  cidade?: string;
  estado?: string;
}

interface PacientesProps {
  pacientes: Paciente[];
  onAdd: (p: Omit<Paciente, 'id'>) => void | Promise<void>;
  onUpdate: (p: Paciente) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  highlightId?: string;
  initialOpen?: boolean;
  readOnly?: boolean;
  allowDelete?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateTime(iso: string) {
  if (!iso) return 'Ainda não houve atendimento';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function formatDateISO(d: Date) {
  return dateToISO(d);
}
function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return formatDateISO(d);
}
function responsiveGrid(min = 180, gap = 12): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap };
}

function calcIMC(peso: string, altura: string) {
  const p = parseFloat(peso), a = parseFloat(altura);
  if (!p || !a) return '';
  return (p / (a * a)).toFixed(1);
}
function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}
function hasResponsibleData(p: PacienteExtended) {
  return Boolean(
    p.nomeMae || p.profissaoMae || p.nomePai || p.profissaoPai ||
    p.nomeResponsavel || p.cpfResponsavel || p.nomeEsposo || p.rnGuiaConvenio
  );
}

const emptyForm: PacienteExtended = {
  id: '', nome: '', nomeSocial: '', cpf: '', rg: '', sexo: '',
  dataNasc: '', raca: '', naturalidade: '', nacionalidade: '',
  profissao: '', estadoCivil: '', nomeMae: '', profissaoMae: '',
  nomePai: '', profissaoPai: '', nomeResponsavel: '', cpfResponsavel: '',
  nomeEsposo: '', rnGuiaConvenio: false, codigoLegado: '',
  outroDocTipo: '', outroDocNumero: '',
  email: '', telefone: '', telefone2: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  tipoSanguineo: '', peso: '', altura: '', alergias: '',
  convenio: 'Particular', planoConvenio: '', matriculaConvenio: '', validadeCarteira: '',
  status: 'Ativo',
  observacoes: '', foto: '',
};

// ─── Sub-componentes de campo ─────────────────────────────────────────────────
function FieldInput({ label, value, onChange, placeholder = '', type = 'text', required = false, disabled = false, error = '', max, inputMode, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; disabled?: boolean; error?: string;
  max?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: 'var(--red-500)' }}>*</span>}
      </label>
      <input
        type={type} value={value} placeholder={placeholder}
        max={max}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{
          padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
          border: `1px solid ${error ? 'var(--red-500)' : 'var(--gray-200)'}`,
          background: disabled ? 'var(--gray-50)' : '#fff', color: 'var(--gray-800)',
          width: '100%', boxSizing: 'border-box',
        }}
      />
      {error && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{error}</span>}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, required = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; required?: boolean; disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: 'var(--red-500)' }}>*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', border: '1px solid var(--gray-200)', background: disabled ? 'var(--gray-50)' : '#fff', color: 'var(--gray-800)', cursor: disabled ? 'default' : 'pointer', width: '100%', boxSizing: 'border-box' }}>
        <option value="">Selecione</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SectionHeader({ label, icon: Icon }: { label: string; icon?: React.ElementType }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, paddingBottom: 10, borderBottom: '2px solid var(--mint)' }}>
      {Icon && <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={14} color="var(--primary)" /></div>}
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
    </div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function Pacientes({ pacientes, onAdd, onUpdate, onDelete, highlightId, initialOpen, readOnly = false, allowDelete = false }: PacientesProps) {
  const { user } = useAuth();
  const hideAddButton = user?.role === 'medico';

  // ── Estados de lista/filtro ──
  const [search, setSearch]               = useState('');
  const [filterConvenio, setFilterConvenio] = useState('');
  const [showFiltroAvancado, setShowFiltroAvancado] = useState(false);
  const [filtroEstado, setFiltroEstado]   = useState('');
  const [filtroCidade, setFiltroCidade]   = useState('');
  const [visibleCount, setVisibleCount]   = useState(20);
  const loaderRef = useRef<HTMLDivElement>(null);

  // ── Estados do modal ──
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit' | 'view'; data: PacienteExtended }>({
    open: false, mode: 'add', data: { ...emptyForm },
  });
  const [activeTab, setActiveTab] = useState('dados');
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [saving, setSaving]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [duplicateWarn, setDuplicateWarn] = useState(false);
  const [showResponsavel, setShowResponsavel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const maxBirthDate = yesterdayISO();

  // Scroll infinito
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) setVisibleCount(v => v + 20);
    }, { threshold: 1 });
    if (loaderRef.current) obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Filtros ──
  const filtered = pacientes.filter(p => {
    const q = search.toLowerCase().trim();
    const qDigits = digitsOnly(search);
    const ext = p as PacienteExtended;
    const matchSearch = !q
      || p.nome.toLowerCase().includes(q)
      || p.cpf.toLowerCase().includes(q)
      || (qDigits && digitsOnly(p.cpf).includes(qDigits))
      || (p.telefone || '').toLowerCase().includes(q)
      || (qDigits && digitsOnly(p.telefone).includes(qDigits));
    const matchConvenio = !filterConvenio || p.convenio === filterConvenio;
    const matchEstado = !filtroEstado || (ext.estado || '').toLowerCase().includes(filtroEstado.toLowerCase());
    const matchCidade = !filtroCidade || (ext.cidade || '').toLowerCase().includes(filtroCidade.toLowerCase());
    return matchSearch && matchConvenio && matchEstado && matchCidade;
  });

  const visible = filtered.slice(0, visibleCount);

  // ── Abrir modal ──
  const openAdd  = useCallback(() => {
    if (hideAddButton) return;
    setModal({ open: true, mode: 'add', data: { ...emptyForm } });
    setActiveTab('dados');
    setErrors({});
    setSubmitError('');
    setDuplicateWarn(false);
    setShowResponsavel(false);
  }, [hideAddButton]);
  const openEdit = (p: Paciente) => {
    const data = { ...emptyForm, ...p, cpf: formatCpf(p.cpf) };
    setModal({ open: true, mode: 'edit', data });
    setShowResponsavel(hasResponsibleData(data));
    setActiveTab('dados'); setErrors({}); setSubmitError(''); setDuplicateWarn(false);
  };
  const openView = (p: Paciente) => {
    const data = { ...emptyForm, ...p, cpf: formatCpf(p.cpf) };
    setModal({ open: true, mode: 'view', data });
    setShowResponsavel(hasResponsibleData(data));
    setActiveTab('dados');
  };
  const closeModal = () => { if (saving) return; setModal({ open: false, mode: 'add', data: { ...emptyForm } }); setErrors({}); setSubmitError(''); setDuplicateWarn(false); setShowResponsavel(false); };

  useEffect(() => { if (initialOpen) openAdd(); }, [initialOpen, openAdd]);

  // ── Set field helper ──
  const setField = useCallback(<K extends keyof PacienteExtended>(field: K, value: PacienteExtended[K]) => {
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  }, []);

  // ── Foto ──
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setField('foto', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Validação ──
  const validate = (d: PacienteExtended) => {
    const e: Record<string, string> = {};
    if (!d.nome.trim()) e.nome = 'Nome obrigatório';
    if (!d.cpf.trim()) e.cpf = 'CPF obrigatório pela API';
    if (d.cpf && !isValidCpf(d.cpf)) e.cpf = 'CPF inválido';
    if (!d.dataNasc) e.dataNasc = 'Data de nascimento obrigatória';
    else if (d.dataNasc > maxBirthDate) e.dataNasc = 'A data de nascimento deve ser no mínimo de ontem.';
    if (!d.email.trim()) e.email = 'E-mail obrigatório pela API';
    if (!d.telefone.trim()) e.telefone = 'Telefone obrigatório pela API';
    return e;
  };

  // ── Salvar ──
  const savePatient = async (ignoreDuplicate = false) => {
    if (saving) return;
    const e = validate(modal.data);
    if (Object.keys(e).length) {
      setErrors(e);
      // Vai para a aba que tem o erro
      if (e.nome || e.cpf || e.dataNasc || e.email || e.telefone) setActiveTab('dados');
      return;
    }
    // Verifica duplicidade por CPF
    const cpfLimpo = digitsOnly(modal.data.cpf);
    if (cpfLimpo && modal.mode === 'add' && !ignoreDuplicate) {
      const dup = pacientes.find(p => digitsOnly(p.cpf) === cpfLimpo);
      if (dup) { setDuplicateWarn(true); return; }
    }
    setSaving(true);
    setSubmitError('');
    try {
      if (modal.mode === 'add') await onAdd(modal.data as Omit<Paciente, 'id'>);
      else await onUpdate(modal.data as Paciente);
      setSaving(false);
      closeModal();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar paciente.';
      setSubmitError(msg);
      setSaving(false);
    }
  };

  const handleSave = () => { void savePatient(); };

  const handleDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await onDelete(confirmDelete);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir paciente.');
    } finally {
      setDeleting(false);
    }
  };

  const isView = modal.mode === 'view';
  const d = modal.data;

  // ─── IMC calculado ───
  const imc = calcIMC(d.peso || '', d.altura || '');

  // ─── Renderização ────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ── Área scrollável ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)', minHeight: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--dark)' }}>Pacientes</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
              {readOnly ? 'Cadastro e consulta de pacientes' : 'Gerencie as informações de seus pacientes'}
            </p>
          </div>
          {!hideAddButton && (
            <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
              <Plus size={16} /> Adicionar
            </button>
          )}
        </div>

        {/* Filtros */}
        <div style={{ background: '#fff', borderRadius: 14, padding: '14px 18px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Busca */}
            <div style={{ flex: 2, minWidth: 200, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(20); }}
                placeholder="Buscar por nome, CPF ou telefone..."
                style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }} />
            </div>

            {/* Convênio */}
            <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
              <User size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <select value={filterConvenio} onChange={e => setFilterConvenio(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 30px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer', appearance: 'none' }}>
                <option value="">Selecione o Convênio</option>
                {CONVENIOS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>

            {/* Filtro avançado */}
            <button onClick={() => setShowFiltroAvancado(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 8, border: `1px solid ${showFiltroAvancado ? 'var(--primary)' : 'var(--gray-200)'}`, background: showFiltroAvancado ? 'var(--mint)' : 'var(--gray-50)', fontSize: 13, fontWeight: 600, color: showFiltroAvancado ? 'var(--dark)' : 'var(--gray-500)', cursor: 'pointer' }}>
              <Filter size={14} /> Filtro avançado <ChevronDown size={12} style={{ transform: showFiltroAvancado ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
          </div>

          {/* Filtro avançado expandido */}
          {showFiltroAvancado && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Cidade</label>
                <input value={filtroCidade} onChange={e => setFiltroCidade(e.target.value)} placeholder="Ex: Aracaju"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Estado</label>
                <input value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)} placeholder="Ex: Sergipe"
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }} />
              </div>
              <button onClick={() => { setFiltroCidade(''); setFiltroEstado(''); setFilterConvenio(''); setSearch(''); }}
                style={{ alignSelf: 'flex-end', padding: '8px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', overflow: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                {['Nome', 'Telefone', 'Cidade', 'Estado', 'Último atendimento', 'Próximo atendimento', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const ext = p as PacienteExtended;
                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid var(--gray-50)', transition: 'background .1s', background: highlightId === p.id ? 'var(--mint)' : undefined }}
                    onMouseEnter={e => { if (highlightId !== p.id) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--gray-50)'; }}
                    onMouseLeave={e => { if (highlightId !== p.id) (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>

                    {/* Nome */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 50, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--dark)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                          {p.foto ? <img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials(p.nome)}
                        </div>
                        <div>
                          <button onClick={() => openView(p)}
                            style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                            {p.nome}
                          </button>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{p.cpf || '—'}</div>
                        </div>
                      </div>
                    </td>

                    {/* Telefone */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--gray-600)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Phone size={12} color="var(--gray-400)" />
                        {p.telefone || '—'}
                      </div>
                    </td>

                    {/* Cidade */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--gray-600)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={12} color="var(--gray-400)" />
                        {ext.cidade || '—'}
                      </div>
                    </td>

                    {/* Estado */}
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--gray-600)' }}>{ext.estado || '—'}</td>

                    {/* Último atendimento */}
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Clock size={12} color="var(--gray-400)" />
                        {formatDateTime(ext.ultimoAtendimento || '')}
                      </div>
                    </td>

                    {/* Próximo atendimento */}
                    <td style={{ padding: '12px 16px', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {ext.proximoAtendimento ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--primary)' }}>
                          <CheckCircle2 size={12} />
                          {formatDateTime(ext.proximoAtendimento)}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--gray-400)', fontSize: 12 }}>Nenhum atendimento agendado</span>
                      )}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 2 }}>
                        <ActionBtn icon={Eye} color="var(--primary)" title="Ver prontuário" onClick={() => openView(p)} />
                        <ActionBtn icon={Pencil} color="#d97706" title="Editar" onClick={() => openEdit(p)} />
                        <ActionBtn icon={Calendar} color="#7c3aed" title="Marcar consulta" onClick={() => {}} />
                        {(!readOnly || allowDelete) && <ActionBtn icon={Trash2} color="var(--red-500)" title="Excluir" onClick={() => { setDeleteError(''); setConfirmDelete(p.id); }} />}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Search size={28} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Nenhum paciente encontrado</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>Tente ajustar os filtros ou adicione um novo paciente.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {/* Rodapé / Scroll infinito */}
          <div style={{ padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--gray-100)', background: 'var(--gray-50)', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
              Exibindo <strong>{Math.min(visible.length, filtered.length)}</strong> de <strong>{filtered.length}</strong> paciente{filtered.length !== 1 ? 's' : ''}
            </span>
            {filtered.length > pacientes.length && (
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Total cadastrado: {pacientes.length}</span>
            )}
          </div>
          {/* Sentinela de scroll infinito */}
          {visible.length < filtered.length && (
            <div ref={loaderRef} style={{ padding: 12, textAlign: 'center', fontSize: 12, color: 'var(--gray-400)' }}>Carregando mais...</div>
          )}
        </div>

      </div>{/* fim área scrollável */}

      {/* ─── Modal de Cadastro/Edição/Visualização ─────────────────────────── */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 'min(1080px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Cabeçalho do modal */}
            <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  {/* Avatar */}
                  <div style={{ width: 52, height: 52, borderRadius: 50, background: 'var(--mint)', border: '2px solid var(--light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', flexShrink: 0, cursor: !isView ? 'pointer' : 'default' }}
                    onClick={() => !isView && fileRef.current?.click()}>
                    {d.foto ? <img src={d.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <User size={22} color="var(--light)" />}
                    {!isView && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}>
                        <Camera size={16} color="#fff" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)' }}>
                      {modal.mode === 'add' ? 'Dados do Paciente' : modal.mode === 'edit' ? 'Editar Paciente' : 'Prontuário'}
                    </h2>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
                      {modal.mode === 'add' ? 'Preencha os dados abaixo para cadastrar' : d.nome || 'Visualização completa'}
                    </div>
                  </div>
                </div>
                <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
                  <X size={15} />
                </button>
              </div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />

              {/* Aviso de duplicidade */}
              {duplicateWarn && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--amber-100)', border: '1px solid #f59e0b', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                  <AlertCircle size={14} color="#d97706" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>Já existe um paciente com este CPF cadastrado. Confirme para continuar mesmo assim.</span>
                  <button onClick={() => { setDuplicateWarn(false); void savePatient(true); }} disabled={saving}
                    style={{ marginLeft: 'auto', padding: '4px 10px', background: '#d97706', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                    Confirmar mesmo assim
                  </button>
                </div>
              )}
              {submitError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 8, padding: '9px 12px', marginBottom: 12 }}>
                  <AlertCircle size={14} color="var(--red-500)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--red-600)' }}>{submitError}</span>
                </div>
              )}

              {/* Abas */}
              <div style={{ display: 'flex', gap: 0, flexWrap: 'wrap' }}>
                {FORM_TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    style={{ padding: '9px 16px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`, color: activeTab === tab.id ? 'var(--primary)' : 'var(--gray-500)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>
                    {tab.label}
                    {/* Indicador de erro na aba */}
                    {tab.id === 'dados' && (errors.nome || errors.cpf || errors.dataNasc || errors.email || errors.telefone) && (
                      <span style={{ marginLeft: 4, width: 6, height: 6, borderRadius: '50%', background: 'var(--red-500)', display: 'inline-block' }} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Conteúdo da aba — scrollável */}
            <div style={{ flex: 1, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)', minHeight: 0 }}>

              {/* ── ABA: Dados Pessoais ── */}
              {activeTab === 'dados' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Identificação" icon={User} />
                  <div style={responsiveGrid(240)}>
                    <FieldInput label="Nome Completo" value={d.nome} onChange={v => setField('nome', v)} required disabled={isView} error={errors.nome} placeholder="Ex: Maria Oliveira da Silva" />
                    <FieldInput label="Nome Social" value={d.nomeSocial || ''} onChange={v => setField('nomeSocial', v)} disabled={isView} placeholder="Apelido ou nome social" />
                  </div>
                  <div style={responsiveGrid(220)}>
                    <FieldInput label="CPF" value={d.cpf} onChange={v => setField('cpf', formatCpf(v))} disabled={isView} error={errors.cpf} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                    <FieldInput label="RG" value={d.rg || ''} onChange={v => setField('rg', v)} disabled={isView} placeholder="00.000.000-0" />
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Outros documentos</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <select value={d.outroDocTipo || ''} onChange={e => setField('outroDocTipo', e.target.value)} disabled={isView}
                          style={{ flex: 1, padding: '9px 8px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, outline: 'none', background: isView ? 'var(--gray-50)' : '#fff', cursor: isView ? 'default' : 'pointer' }}>
                          <option value="">Selecione</option>
                          {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                        </select>
                        <input value={d.outroDocNumero || ''} onChange={e => setField('outroDocNumero', e.target.value)} disabled={isView}
                          placeholder="Número" style={{ flex: 1, padding: '9px 8px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, outline: 'none', background: isView ? 'var(--gray-50)' : '#fff' }} />
                      </div>
                    </div>
                  </div>

                  <div style={responsiveGrid(220)}>
                    {/* Sexo */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Sexo</label>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {['Masculino', 'Feminino', 'Outro'].map(s => (
                          <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-700)', cursor: isView ? 'default' : 'pointer' }}>
                            <input type="radio" name="sexo" value={s} checked={d.sexo === s}
                              onChange={() => !isView && setField('sexo', s)} disabled={isView}
                              style={{ accentColor: 'var(--primary)' }} />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                    <FieldInput label="Data de Nascimento" value={d.dataNasc} onChange={v => setField('dataNasc', v)} type="date" max={maxBirthDate} required disabled={isView} error={errors.dataNasc} />
                  </div>

                  <div style={responsiveGrid(220)}>
                    <FieldSelect label="Raça" value={d.raca || ''} onChange={v => setField('raca', v)} options={RACAS} disabled={isView} />
                  </div>
                  <div style={responsiveGrid(220)}>
                    <FieldInput label="Naturalidade" value={d.naturalidade || ''} onChange={v => setField('naturalidade', v)} disabled={isView} placeholder="Cidade de nascimento" />
                    <FieldSelect label="Nacionalidade" value={d.nacionalidade || ''} onChange={v => setField('nacionalidade', v)} options={NACIONALIDADES} disabled={isView} />
                  </div>
                  <div style={responsiveGrid(220)}>
                    <FieldInput label="Profissão" value={d.profissao || ''} onChange={v => setField('profissao', v)} disabled={isView} placeholder="Ex: Engenheiro" />
                    <FieldSelect label="Estado Civil" value={d.estadoCivil || ''} onChange={v => setField('estadoCivil', v)} options={ESTADOS_CIVIS} disabled={isView} />
                  </div>

                  <SectionHeader label="Contato" icon={Phone} />
                  <div style={responsiveGrid(240)}>
                    <FieldInput label="E-mail" value={d.email} onChange={v => setField('email', v)} type="email" required disabled={isView} error={errors.email} placeholder="paciente@exemplo.com" />
                    <FieldInput label="Celular / WhatsApp" value={d.telefone} onChange={v => setField('telefone', v)} required disabled={isView} error={errors.telefone} placeholder="(79) 99000-0000" />
                    <FieldInput label="Telefone 2" value={d.telefone2 || ''} onChange={v => setField('telefone2', v)} disabled={isView} placeholder="(79) 3000-0000" />
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
                    <Toggle label="Paciente é menor de idade?" value={showResponsavel} onChange={setShowResponsavel} disabled={isView} />
                  </div>

                  {showResponsavel && (
                    <>
                      <SectionHeader label="Filiação e Responsável" />
                      <div style={responsiveGrid(240)}>
                        <FieldInput label="Nome da mãe" value={d.nomeMae || ''} onChange={v => setField('nomeMae', v)} disabled={isView} />
                        <FieldInput label="Profissão da mãe" value={d.profissaoMae || ''} onChange={v => setField('profissaoMae', v)} disabled={isView} />
                        <FieldInput label="Nome do pai" value={d.nomePai || ''} onChange={v => setField('nomePai', v)} disabled={isView} />
                        <FieldInput label="Profissão do pai" value={d.profissaoPai || ''} onChange={v => setField('profissaoPai', v)} disabled={isView} />
                        <FieldInput label="Nome do responsável" value={d.nomeResponsavel || ''} onChange={v => setField('nomeResponsavel', v)} disabled={isView} />
                        <FieldInput label="CPF do responsável" value={d.cpfResponsavel || ''} onChange={v => setField('cpfResponsavel', formatCpf(v))} disabled={isView} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                        <FieldInput label="Nome do esposo(a)" value={d.nomeEsposo || ''} onChange={v => setField('nomeEsposo', v)} disabled={isView} />
                        <FieldInput label="Código legado" value={d.codigoLegado || ''} onChange={v => setField('codigoLegado', v)} disabled={isView} placeholder="ID de outro sistema" />
                      </div>
                      <Toggle label="RN na Guia do convênio" value={d.rnGuiaConvenio || false} onChange={v => !isView && setField('rnGuiaConvenio', v)} disabled={isView} />
                    </>
                  )}

                  {/* Status */}
                  {!readOnly && (
                    <div style={{ maxWidth: 200 }}>
                      <FieldSelect label="Status" value={d.status} onChange={v => setField('status', v as StatusPaciente)} options={['Ativo', 'Inativo']} disabled={isView} />
                    </div>
                  )}
                </div>
              )}

              {/* ── ABA: Endereço ── */}
              {activeTab === 'endereco' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Endereço" icon={MapPin} />
                  <div style={responsiveGrid(180)}>
                    <FieldInput label="CEP" value={d.cep || ''} onChange={v => setField('cep', v)} disabled={isView} placeholder="00000-000" />
                    <FieldInput label="Logradouro / Endereço" value={d.logradouro || ''} onChange={v => setField('logradouro', v)} disabled={isView} placeholder="Rua, Avenida..." />
                  </div>
                  <div style={responsiveGrid(150)}>
                    <FieldInput label="Número" value={d.numero || ''} onChange={v => setField('numero', v)} disabled={isView} placeholder="Ex: 123" />
                    <FieldInput label="Complemento" value={d.complemento || ''} onChange={v => setField('complemento', v)} disabled={isView} placeholder="Apto, Bloco..." />
                    <FieldInput label="Bairro" value={d.bairro || ''} onChange={v => setField('bairro', v)} disabled={isView} />
                  </div>
                  <div style={responsiveGrid(180)}>
                    <FieldInput label="Cidade" value={d.cidade || ''} onChange={v => setField('cidade', v)} disabled={isView} />
                    <FieldInput label="Estado" value={d.estado || ''} onChange={v => setField('estado', v)} disabled={isView} placeholder="Ex: Sergipe" />
                  </div>
                </div>
              )}

              {/* ── ABA: Informações Médicas ── */}
              {activeTab === 'medico' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Informações Médicas" />
                  <div style={{ ...responsiveGrid(140), alignItems: 'end' }}>
                    <FieldSelect label="Tipo Sanguíneo" value={d.tipoSanguineo || ''} onChange={v => setField('tipoSanguineo', v)} options={TIPOS_SANGUINEOS} disabled={isView} />
                    <FieldInput label="Peso (kg)" value={d.peso || ''} onChange={v => setField('peso', v)} type="number" disabled={isView} placeholder="Ex: 70" />
                    <FieldInput label="Altura (m)" value={d.altura || ''} onChange={v => setField('altura', v)} type="number" disabled={isView} placeholder="Ex: 1.75" />
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>IMC</label>
                      <div style={{ padding: '9px 12px', background: imc ? 'var(--mint)' : 'var(--gray-50)', borderRadius: 8, fontSize: 13, fontWeight: 700, color: imc ? 'var(--dark)' : 'var(--gray-400)', border: '1px solid var(--gray-200)' }}>
                        {imc ? `${imc} kg/m²` : '—'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Alergias</label>
                    <textarea value={d.alergias || ''} onChange={e => !isView && setField('alergias', e.target.value)} disabled={isView} rows={3}
                      placeholder="Ex: AAS, Dipirona, látex..."
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: isView ? 'var(--gray-50)' : '#fff', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }} />
                  </div>
                </div>
              )}

              {/* ── ABA: Convênio ── */}
              {activeTab === 'convenio' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Informações de Convênio" />
                  <div style={responsiveGrid(180)}>
                    <FieldSelect label="Convênio" value={d.convenio} onChange={v => setField('convenio', v as ConvenioType)} options={CONVENIOS} disabled={isView || readOnly} />
                    <FieldInput label="Plano" value={d.planoConvenio || ''} onChange={v => setField('planoConvenio', v)} disabled={isView} placeholder="Ex: Enfermaria, Apartamento..." />
                    <FieldInput label="Nº de Matrícula" value={d.matriculaConvenio || ''} onChange={v => setField('matriculaConvenio', v)} disabled={isView} placeholder="Número da carteirinha" />
                    <FieldInput label="Validade da Carteira" value={d.validadeCarteira || ''} onChange={v => setField('validadeCarteira', v)} type="date" disabled={isView} />
                  </div>
                </div>
              )}

              {/* ── ABA: Observações ── */}
              {activeTab === 'obs' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Observações e Notas" />
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Notas clínicas e observações gerais</label>
                    <textarea value={d.observacoes || ''} onChange={e => !isView && setField('observacoes', e.target.value)} disabled={isView} rows={6}
                      placeholder="Alergias, restrições, notas relevantes sobre o paciente..."
                      style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: isView ? 'var(--gray-50)' : '#fff', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }} />
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'right', marginTop: 4 }}>{(d.observacoes || '').length} caracteres</div>
                  </div>

                  {/* Histórico de alterações — informativo */}
                  <div style={{ background: 'var(--gray-50)', borderRadius: 10, padding: '12px 14px', border: '1px solid var(--gray-100)' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Histórico</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                      {modal.mode === 'add' ? 'Registro novo — ainda não foi salvo.' : `Último acesso registrado pelo sistema.`}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Rodapé do modal */}
            {!isView && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                  Campos com <span style={{ color: 'var(--red-500)', fontWeight: 700 }}>*</span> são obrigatórios
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={closeModal} disabled={saving} style={{ padding: '10px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--gray-700)', opacity: saving ? 0.6 : 1 }}>Cancelar</button>
                  <button onClick={handleSave} disabled={saving} style={{ padding: '10px 24px', background: saving ? 'var(--gray-300)' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 2px 8px rgba(58,170,53,0.3)' }}>
                    {modal.mode === 'add' ? '+ Salvar Paciente' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Confirm Delete ─────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--red-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Trash2 size={20} color="var(--red-500)" />
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Excluir paciente?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 20 }}>
              Esta ação é <strong>irreversível</strong>. Todos os dados do paciente serão removidos permanentemente do sistema.
            </p>
            {deleteError && (
              <div style={{ padding: '9px 11px', borderRadius: 8, background: 'var(--red-50)', color: 'var(--red-600)', fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button disabled={deleting} onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', color: 'var(--gray-700)', opacity: deleting ? 0.7 : 1 }}>Cancelar</button>
              <button disabled={deleting} onClick={() => void handleDelete()}
                style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────
function ActionBtn({ icon: Icon, color, title, onClick }: { icon: React.ElementType; color: string; title: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-100)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
      <Icon size={14} />
    </button>
  );
}

function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', userSelect: 'none' }}>
      <div onClick={() => !disabled && onChange(!value)}
        style={{ width: 36, height: 20, borderRadius: 10, background: value ? 'var(--primary)' : 'var(--gray-300)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{label}</span>
    </label>
  );
}
