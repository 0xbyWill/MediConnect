import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Search, Plus, Eye, Pencil, Trash2, X, Camera, User,
  Filter, Calendar, ChevronDown, Phone, MapPin, Gauge,
  AlertCircle, ArrowLeft, Mail,
} from 'lucide-react';
import type { Agendamento, Laudo, Paciente, ConvenioType, StatusPaciente } from '../types';
import type { ApiDoctor } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO, formatDateBR } from '../shared/utils/date';
import { digitsOnly, formatCpf, isValidCpf } from '../shared/utils/cpf';
import { formatCep, formatPhoneBR, isValidCep, isValidEmail, isValidPhoneBR, validateImageFile } from '../shared/utils/validation';
import { initials } from '../shared/utils/text';

// --- Constantes ---------------------------------------------------------------
const CONVENIOS: ConvenioType[] = [
  'Particular', 'Unimed Nacional', 'Bradesco Saúde',
  'Amil S450', 'SulAmérica', 'Porto Seguro', 'Notre Dame',
];

const RACAS  = ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não declarada'];
const ESTADOS_CIVIS = ['Solteiro(a)', 'Casado(a)', 'Divorciado(a)', 'Viúvo(a)', 'União Estável', 'Outro'];
const NACIONALIDADES = [
  'Brasileira', 'Afegã', 'Alemã', 'Angolana', 'Argentina', 'Australiana', 'Belga',
  'Boliviana', 'Canadense', 'Chilena', 'Chinesa', 'Colombiana', 'Coreana',
  'Cubana', 'Espanhola', 'Estadunidense', 'Francesa', 'Haitiana', 'Indiana',
  'Italiana', 'Japonesa', 'Mexicana', 'Moçambicana', 'Paraguaia', 'Peruana',
  'Portuguesa', 'Reino-unidense', 'Uruguaia', 'Venezuelana', 'Outra',
];
const TIPOS_DOC = ['CNH', 'Passaporte', 'RNE', 'CTPS', 'Outro'];
const TIPOS_SANGUINEOS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Abas do formulário
const FORM_TABS = [
  { id: 'dados',     label: 'Dados Pessoais' },
  { id: 'endereco',  label: 'Endereço' },
  { id: 'medico',    label: 'Inf. Médicas' },
  { id: 'prioridade', label: 'Prioridade' },
  { id: 'convenio',  label: 'Convênio' },
  { id: 'obs',       label: 'Observações' },
];

const PROFILE_TABS = [
  { id: 'resumo', label: 'Resumo' },
  { id: 'dados', label: 'Dados Pessoais' },
  { id: 'historico', label: 'Histórico Médico' },
  { id: 'prontuarios', label: 'Prontuários' },
  { id: 'receitas', label: 'Receitas' },
];

const HEALTH_CONDITION_OPTIONS = [
  'Sem doença relevante ou condição controlada',
  'Condição leve/controlada',
  'Doença crônica com impacto moderado',
  'Múltiplas doenças, pós-operatório, imunossupressão ou risco de piora',
  'Condição instável, piora recente ou necessidade de acompanhamento frequente',
];

const PHYSICAL_INTEGRITY_OPTIONS = [
  'Sem limitação física relevante',
  'Dor leve ou desconforto leve',
  'Dor moderada, lesão simples ou limitação parcial',
  'Dor intensa, limitação severa, risco de queda ou lesão importante',
  'Lesão grave, imobilidade, sangramento relevante ou risco físico imediato',
];

const MOBILITY_OPTIONS = [
  'Independente',
  'Independente com pequena dificuldade',
  'Precisa de apoio ocasional',
  'Precisa de ajuda frequente',
  'Acamado ou dependente total/quase total',
];

const THERAPEUTIC_URGENCY_OPTIONS = [
  'Atendimento eletivo, sem prejuízo relevante se esperar',
  'Acompanhamento preventivo',
  'Atraso pode gerar piora leve/moderada',
  'Atraso pode causar piora funcional, dor persistente ou risco aumentado',
  'Atraso representa alto risco de agravamento ou perda funcional importante',
];

const WAITING_TIME_OPTIONS = [
  'Entrou recentemente na fila',
  'Espera curta',
  'Espera moderada',
  'Espera longa',
  'Espera muito longa ou acima do prazo máximo da clínica',
];

const FIT_AVAILABILITY_OPTIONS = [
  'Não consegue comparecer em encaixes',
  'Baixa chance de comparecer',
  'Chance incerta',
  'Boa chance de comparecer',
  'Confirmou disponibilidade imediata ou alta disponibilidade',
];

const NPS_PRIORITY_LABEL: Record<number, string> = {
  1: 'baixa prioridade',
  2: 'prioridade leve',
  3: 'prioridade intermediária',
  4: 'alta prioridade',
  5: 'prioridade máxima',
};

const priorityCellStyle: React.CSSProperties = {
  padding: '9px 10px',
  borderTop: '1px solid var(--gray-50)',
  fontSize: 12,
  color: 'var(--gray-700)',
  verticalAlign: 'top',
  overflowWrap: 'anywhere',
};

// --- Tipos auxiliares ---------------------------------------------------------
interface PacienteExtended extends Paciente {
  rg?: string;
  sexo?: string;
  naturalidade?: string;
  nacionalidade?: string;
  profissao?: string;
  estadoCivil?: string;
  nomeResponsavel?: string;
  cpfResponsavel?: string;
  vip?: boolean;
  urlRedirecionamento?: string;
  outroDocTipo?: string;
  outroDocNumero?: string;
  telefone2?: string;
  telefone3?: string;
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
  referencia?: string;
  condicaoSaudePrincipal?: string;
  condicaoSaudePontuacao?: string;
  comorbidades?: string;
  nivelDor?: string;
  mobilidade?: string;
  dependenciaFuncional?: string;
  integridadeFisica?: string;
  urgenciaTerapeutica?: string;
  tempoNaFila?: string;
  faltasAnteriores?: string;
  disponibilidadeEncaixe?: string;
  tempoMinimoChegar?: string;
  tempoDeslocamento?: string;
  tipoAtendimentoNecessario?: string;
  profissionalEspecialidadeNecessaria?: string;
  observacoesClinicas?: string;
  alertasCriticos?: string;
  compatibilidadeVaga?: string;
  viabilidadeComparecimento?: string;
}

interface PacientesProps {
  pacientes: Paciente[];
  agendamentos?: Agendamento[];
  laudos?: Laudo[];
  doctors?: ApiDoctor[];
  onAdd: (p: Omit<Paciente, 'id'>) => void | Promise<void>;
  onUpdate: (p: Paciente) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onSchedule?: (pacienteId: string) => void;
  highlightId?: string;
  initialOpen?: boolean;
  readOnly?: boolean;
  allowDelete?: boolean;
}

// --- Helpers ------------------------------------------------------------------
function formatDateTime(iso: string) {
  if (!iso) return 'Ainda não houve atendimento';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function displayCpf(value?: string) {
  const formatted = formatCpf(value || '');
  return formatted || '—';
}
function displayPhone(value?: string) {
  const formatted = formatPhoneBR(value || '');
  return formatted || '—';
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
  const p = Number(String(peso).replace(',', '.'));
  let a = Number(String(altura).replace(',', '.'));
  if (!p || !a) return '';
  if (a > 3) a = a / 100;
  return (p / (a * a)).toFixed(1);
}
function hasResponsibleData(p: PacienteExtended) {
  return Boolean(p.nomeResponsavel || p.cpfResponsavel);
}

function ageFromBirthDate(value?: string) {
  if (!value) return null;
  const birth = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

function optionScore(value: string | undefined, options: string[]) {
  if (!value) return null;
  const index = options.indexOf(value);
  return index >= 0 ? index : null;
}

function numericValue(value?: string) {
  const number = Number(String(value ?? '').replace(/\D/g, ''));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function painScore(value?: string) {
  const pain = numericValue(value);
  if (pain === null) return null;
  if (pain <= 1) return 0;
  if (pain <= 3) return 1;
  if (pain <= 6) return 2;
  if (pain <= 8) return 3;
  return 4;
}

function viabilityScore(d: PacienteExtended) {
  const availability = optionScore(d.disponibilidadeEncaixe, FIT_AVAILABILITY_OPTIONS);
  if (availability === null) return null;

  const minArrival = numericValue(d.tempoMinimoChegar);
  const travel = numericValue(d.tempoDeslocamento);
  let score = availability;
  if ((minArrival !== null && minArrival > 120) || (travel !== null && travel > 90)) score -= 1;
  if ((minArrival !== null && minArrival <= 30) || (travel !== null && travel <= 30)) score += 1;
  return Math.min(Math.max(score, 0), 4);
}

function compatibilityScore(d: PacienteExtended) {
  const hasType = Boolean(d.tipoAtendimentoNecessario?.trim());
  const hasProfessional = Boolean(d.profissionalEspecialidadeNecessaria?.trim());
  if (!hasType) return null;
  return hasProfessional ? 4 : 3;
}

function hasPriorityInput(d: PacienteExtended) {
  return Boolean(
    d.condicaoSaudePrincipal?.trim() ||
    d.condicaoSaudePontuacao ||
    d.comorbidades?.trim() ||
    d.nivelDor ||
    d.mobilidade ||
    d.dependenciaFuncional ||
    d.integridadeFisica ||
    d.urgenciaTerapeutica ||
    d.tempoNaFila ||
    d.faltasAnteriores?.trim() ||
    d.disponibilidadeEncaixe ||
    d.tempoMinimoChegar?.trim() ||
    d.tempoDeslocamento?.trim() ||
    d.tipoAtendimentoNecessario?.trim() ||
    d.profissionalEspecialidadeNecessaria?.trim() ||
    d.observacoesClinicas?.trim() ||
    d.alertasCriticos?.trim()
  );
}

function ageReserveScore(age: number | null, d: PacienteExtended) {
  if (age === null) return null;
  const hasClinicalRisk = Boolean(
    d.condicaoSaudePrincipal?.trim() ||
    d.comorbidades?.trim() ||
    optionScore(d.mobilidade, MOBILITY_OPTIONS) ||
    optionScore(d.dependenciaFuncional, MOBILITY_OPTIONS) ||
    optionScore(d.integridadeFisica, PHYSICAL_INTEGRITY_OPTIONS)
  );
  if (!hasClinicalRisk && age >= 18 && age < 60) return 0;
  if (age >= 85 || age < 1) return hasClinicalRisk ? 3 : 1;
  if (age >= 75 || age < 6) return hasClinicalRisk ? 2 : 1;
  if (age >= 60 || age < 18) return 1;
  return hasClinicalRisk ? 1 : 0;
}

function npsLevel(total: number) {
  if (total <= 7) return 1;
  if (total <= 13) return 2;
  if (total <= 20) return 3;
  if (total <= 26) return 4;
  return 5;
}

function calculatePatientPriority(d: PacienteExtended) {
  const hasPriorityData = hasPriorityInput(d);
  if (!hasPriorityData) {
    const age = ageFromBirthDate(d.dataNasc);
    return {
      age,
      total: 0,
      level: 1,
      priority: `NPS 1 = ${NPS_PRIORITY_LABEL[1]}`,
      canAttend: true,
      cannotAttendReason: '',
      missing: [],
      professionalAlert: '',
      shortJustification: 'Paciente sem critérios especiais informados; tratado como consulta ou retorno eletivo.',
    };
  }

  const age = ageFromBirthDate(d.dataNasc);
  const idadeReserva = ageReserveScore(age, d);
  const condicaoSaude = optionScore(d.condicaoSaudePontuacao, HEALTH_CONDITION_OPTIONS);
  const integridadeBase = optionScore(d.integridadeFisica, PHYSICAL_INTEGRITY_OPTIONS);
  const integridadeFisica = Math.max(integridadeBase ?? 0, painScore(d.nivelDor) ?? 0);
  const mobilidadeAutonomia = Math.max(
    optionScore(d.mobilidade, MOBILITY_OPTIONS) ?? 0,
    optionScore(d.dependenciaFuncional, MOBILITY_OPTIONS) ?? 0
  );
  const urgenciaTerapeutica = optionScore(d.urgenciaTerapeutica, THERAPEUTIC_URGENCY_OPTIONS);
  const tempoEspera = optionScore(d.tempoNaFila, WAITING_TIME_OPTIONS);
  const viabilidadeComparecimento = viabilityScore(d);
  const compatibilidadeVaga = compatibilityScore(d);
  const missing: string[] = [];

  if (age === null) missing.push('idade');
  if (!d.condicaoSaudePrincipal?.trim()) missing.push('condição de saúde principal');
  if (condicaoSaude === null) missing.push('estado da condição de saúde');
  if (integridadeBase === null && !d.nivelDor) missing.push('integridade física ou nível de dor');
  if (urgenciaTerapeutica === null) missing.push('urgência terapêutica');
  if (tempoEspera === null) missing.push('tempo na fila');
  if (viabilidadeComparecimento === null) missing.push('viabilidade de comparecimento');
  if (compatibilidadeVaga === null && (d.tipoAtendimentoNecessario?.trim() || d.profissionalEspecialidadeNecessaria?.trim())) {
    missing.push('compatibilidade com a vaga');
  }

  const total =
    (idadeReserva ?? 0) +
    (condicaoSaude ?? 0) +
    (integridadeFisica ?? 0) +
    mobilidadeAutonomia +
    (urgenciaTerapeutica ?? 0) +
    (tempoEspera ?? 0) +
    (viabilidadeComparecimento ?? 0) +
    (compatibilidadeVaga ?? 0);

  const hasCriticalAlert = Boolean(d.alertasCriticos?.trim());
  const level = hasCriticalAlert ? 5 : npsLevel(total);
  const cannotAttendReason =
    viabilidadeComparecimento === 0
        ? 'Paciente não consegue comparecer à vaga liberada.'
        : '';

  return {
    age,
    total,
    level,
    priority: `NPS ${level} = ${NPS_PRIORITY_LABEL[level]}`,
    canAttend: !cannotAttendReason && missing.length === 0,
    cannotAttendReason,
    missing,
    professionalAlert: hasCriticalAlert
      ? 'Alerta crítico informado. Pode exigir contato com profissional responsável.'
      : '',
    shortJustification: missing.length
      ? 'Classificação incompleta por dados essenciais ausentes.'
      : `NPS ${level} por urgência, integridade física, fila e viabilidade operacional.`,
  };
}

const emptyForm: PacienteExtended = {
  id: '', nome: '', nomeSocial: '', cpf: '', rg: '', sexo: '',
  dataNasc: '', raca: '', naturalidade: '', nacionalidade: '',
  profissao: '', estadoCivil: '', nomeResponsavel: '', cpfResponsavel: '',
  vip: false, urlRedirecionamento: '',
  outroDocTipo: '', outroDocNumero: '',
  email: '', telefone: '', telefone2: '', telefone3: '',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', referencia: '',
  tipoSanguineo: '', peso: '', altura: '', alergias: '',
  condicaoSaudePrincipal: '', condicaoSaudePontuacao: '', comorbidades: '', nivelDor: '',
  mobilidade: '', dependenciaFuncional: '', integridadeFisica: '', urgenciaTerapeutica: '',
  tempoNaFila: '', faltasAnteriores: '', disponibilidadeEncaixe: '', tempoMinimoChegar: '',
  tempoDeslocamento: '', tipoAtendimentoNecessario: '', profissionalEspecialidadeNecessaria: '',
  observacoesClinicas: '', alertasCriticos: '', compatibilidadeVaga: '', viabilidadeComparecimento: '',
  convenio: 'Particular', planoConvenio: '', matriculaConvenio: '', validadeCarteira: '',
  status: 'Ativo',
  observacoes: '', foto: '',
};

// --- Sub-componentes de campo -------------------------------------------------
function FieldInput({ label, value, onChange, placeholder = '', type = 'text', required = false, disabled = false, error = '', min, max, step, inputMode, maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean; disabled?: boolean; error?: string;
  min?: string; max?: string; step?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; maxLength?: number;
}) {
  const inputId = React.useId();
  const errorId = `${inputId}-error`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label htmlFor={inputId} style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: 'var(--red-500)' }}>*</span>}
      </label>
      <input
        id={inputId}
        type={type} value={value} placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)} disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        style={{
          padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none',
          border: `1px solid ${error ? 'var(--red-500)' : 'var(--gray-200)'}`,
          background: disabled ? 'var(--gray-50)' : '#fff', color: 'var(--gray-800)',
          width: '100%', boxSizing: 'border-box',
        }}
      />
      {error && <span id={errorId} role="alert" style={{ fontSize: 11, color: 'var(--red-500)' }}>{error}</span>}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, required = false, disabled = false }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; required?: boolean; disabled?: boolean;
}) {
  const selectId = React.useId();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <label htmlFor={selectId} style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label} {required && <span style={{ color: 'var(--red-500)' }}>*</span>}
      </label>
      <select id={selectId} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        style={{ padding: '9px 12px', borderRadius: 8, fontSize: 13, outline: 'none', border: '1px solid var(--gray-200)', background: disabled ? 'var(--gray-50)' : '#fff', color: 'var(--gray-800)', cursor: disabled ? 'default' : 'pointer', width: '100%', boxSizing: 'border-box' }}>
        <option value="">Selecione</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function PriorityTextArea({ label, value, onChange, placeholder = '', disabled = false }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const textareaId = React.useId();
  return (
    <div>
      <label htmlFor={textareaId} style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{label}</label>
      <textarea
        id={textareaId}
        value={value}
        onChange={e => onChange(e.target.value.slice(0, 1200))}
        disabled={disabled}
        rows={4}
        maxLength={1200}
        placeholder={placeholder}
        style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: disabled ? 'var(--gray-50)' : '#fff', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
      />
      <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'right', marginTop: 4 }}>{value.length}/1200</div>
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

function PriorityBadge({ level, incomplete }: { level: number; incomplete: boolean }) {
  const colors: Record<number, { bg: string; color: string }> = {
    1: { bg: 'var(--gray-100)', color: 'var(--gray-600)' },
    2: { bg: '#ecfdf5', color: '#047857' },
    3: { bg: 'var(--amber-100)', color: 'var(--amber-600)' },
    4: { bg: '#ffedd5', color: '#c2410c' },
    5: { bg: 'var(--red-50)', color: 'var(--red-600)' },
  };
  const tone = colors[level] ?? colors[1];
  return (
    <span title={incomplete ? 'Classificação incompleta' : NPS_PRIORITY_LABEL[level]} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 9px',
      borderRadius: 999,
      background: tone.bg,
      color: tone.color,
      fontSize: 12,
      fontWeight: 800,
      whiteSpace: 'nowrap',
    }}>
      <Gauge size={13} />
      NPS {level}{incomplete ? ' incompleto' : ''}
    </span>
  );
}

// --- Componente Principal -----------------------------------------------------
export default function Pacientes({
  pacientes,
  agendamentos = [],
  laudos = [],
  doctors = [],
  onAdd,
  onUpdate,
  onDelete,
  onSchedule,
  highlightId,
  initialOpen,
  readOnly = false,
  allowDelete = false,
}: PacientesProps) {
  const { user } = useAuth();
  const hideAddButton = user?.role === 'medico';
  const canSchedulePatient = user?.role !== 'medico' && Boolean(onSchedule);
  const canDeletePatient = user?.role !== 'medico' && (!readOnly || allowDelete);

  // -- Estados de lista/filtro --
  const [search, setSearch]               = useState('');
  const [filterConvenio, setFilterConvenio] = useState('');
  const [showFiltroAvancado, setShowFiltroAvancado] = useState(false);
  const [filtroPrioridade, setFiltroPrioridade] = useState('');
  const [visibleCount, setVisibleCount]   = useState(20);
  const [profilePatient, setProfilePatient] = useState<PacienteExtended | null>(null);
  const [profileTab, setProfileTab] = useState('resumo');
  const loaderRef = useRef<HTMLDivElement>(null);

  // -- Estados do modal --
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

  // -- Filtros --
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
    const priority = calculatePatientPriority(ext);
    const matchPrioridade = !filtroPrioridade || String(priority.level) === filtroPrioridade;
    return matchSearch && matchConvenio && matchPrioridade;
  });

  const visible = filtered.slice(0, visibleCount);

  // -- Abrir modal --
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
    setProfilePatient(data);
    setProfileTab('resumo');
  };
  const closeModal = () => { if (saving) return; setModal({ open: false, mode: 'add', data: { ...emptyForm } }); setErrors({}); setSubmitError(''); setDuplicateWarn(false); setShowResponsavel(false); };

  useEffect(() => { if (initialOpen) openAdd(); }, [initialOpen, openAdd]);

  // -- Set field helper --
  const setField = useCallback(<K extends keyof PacienteExtended>(field: K, value: PacienteExtended[K]) => {
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  }, []);

  // -- Foto --
  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateImageFile(file, 2);
    if (fileError) {
      setSubmitError(fileError);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => setSubmitError('Nao foi possivel ler a imagem selecionada.');
    reader.onload = ev => setField('foto', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // -- Validação --
  const validate = (d: PacienteExtended) => {
    const e: Record<string, string> = {};
    if (showResponsavel && !d.nomeResponsavel?.trim()) e.nomeResponsavel = 'Nome do responsável obrigatório.';
    if (showResponsavel && !d.cpfResponsavel?.trim()) e.cpfResponsavel = 'CPF do responsável obrigatório.';
    if (d.cpfResponsavel && !isValidCpf(d.cpfResponsavel)) e.cpfResponsavel = 'CPF do responsável inválido.';
    if (d.email.trim() && !isValidEmail(d.email)) e.email = 'Informe um e-mail valido.';
    if (d.telefone.trim() && !isValidPhoneBR(d.telefone)) e.telefone = 'Informe um telefone com DDD.';
    if (d.telefone2 && !isValidPhoneBR(d.telefone2, false)) e.telefone2 = 'Informe um telefone com DDD.';
    if (d.telefone3 && !isValidPhoneBR(d.telefone3, false)) e.telefone3 = 'Informe um telefone com DDD.';
    if (d.cep && !isValidCep(d.cep)) e.cep = 'Informe um CEP com 8 digitos.';
    if (d.urlRedirecionamento && !/^https?:\/\/\S+$/i.test(d.urlRedirecionamento.trim())) e.urlRedirecionamento = 'Informe uma URL iniciada por http:// ou https://.';
    if (!d.nome.trim()) e.nome = 'Nome obrigatório';
    if (!d.cpf.trim()) e.cpf = 'CPF obrigatório pela API';
    if (d.cpf && !isValidCpf(d.cpf)) e.cpf = 'CPF inválido';
    if (!d.dataNasc) e.dataNasc = 'Data de nascimento obrigatória';
    else if (d.dataNasc > maxBirthDate) e.dataNasc = 'A data de nascimento deve ser no mínimo de ontem.';
    if (!d.email.trim()) e.email = 'E-mail obrigatório pela API';
    if (!d.telefone.trim()) e.telefone = 'Telefone obrigatório pela API';
    return e;
  };

  // -- Salvar --
  const savePatient = async (ignoreDuplicate = false) => {
    if (saving) return;
    const e = validate(modal.data);
    if (Object.keys(e).length) {
      setErrors(e);
      // Vai para a aba que tem o erro
      if (e.nome || e.cpf || e.dataNasc || e.email || e.telefone || e.nomeResponsavel || e.cpfResponsavel) setActiveTab('dados');
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

  // --- IMC calculado ---
  const imc = calcIMC(d.peso || '', d.altura || '');
  const priority = calculatePatientPriority(d);
  const modalAge = ageFromBirthDate(d.dataNasc);

  if (profilePatient) {
    const p = profilePatient;
    const profileAge = ageFromBirthDate(p.dataNasc);
    const profilePriority = calculatePatientPriority(p);
    const weight = p.peso && p.peso !== 'null' ? p.peso : '—';
    const height = p.altura && p.altura !== 'null' ? p.altura : '—';
    const profileImc = calcIMC(p.peso || '', p.altura || '') || '—';
    const patientAppointments = agendamentos
      .filter(a => a.pacienteId === p.id)
      .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));
    const todayISO = dateToISO(new Date());
    const upcomingAppointments = patientAppointments
      .filter(a => a.data >= todayISO && a.status !== 'cancelado')
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
    const pastAppointments = patientAppointments
      .filter(a => a.data < todayISO || a.status === 'realizado')
      .sort((a, b) => `${b.data} ${b.hora}`.localeCompare(`${a.data} ${a.hora}`));
    const patientReports = laudos
      .filter(l => l.pacienteId === p.id)
      .sort((a, b) => b.data.localeCompare(a.data));
    const releasedReports = patientReports.filter(l => l.status === 'liberado');
    const doctorName = (doctorId?: string) => doctors.find(doctor => doctor.id === doctorId)?.full_name || 'Profissional nao informado';
    const personalRows: Array<[string, unknown]> = [
      ['Nome completo', p.nome],
      ['Nome social', p.nomeSocial],
      ['CPF', displayCpf(p.cpf)],
      ['RG', p.rg],
      ['Sexo', p.sexo],
      ['Nascimento', p.dataNasc ? formatDateBR(p.dataNasc) : '---'],
      ['Idade', profileAge !== null ? `${profileAge} anos` : '---'],
      ['Raça/cor', p.raca],
      ['Naturalidade', p.naturalidade],
      ['Nacionalidade', p.nacionalidade],
      ['Profissao', p.profissao],
      ['Estado civil', p.estadoCivil],
      ['Responsavel', p.nomeResponsavel],
      ['CPF responsavel', displayCpf(p.cpfResponsavel)],
      ['Convenio', p.convenio],
      ['Plano', p.planoConvenio],
      ['Matricula', p.matriculaConvenio],
      ['Validade carteira', p.validadeCarteira ? formatDateBR(p.validadeCarteira) : '---'],
      ['Telefone 1', displayPhone(p.telefone)],
      ['Telefone 2', displayPhone(p.telefone2)],
      ['Telefone 3', displayPhone(p.telefone3)],
      ['E-mail', p.email],
      ['CEP', p.cep ? formatCep(p.cep) : '---'],
      ['Logradouro', [p.logradouro, p.numero].filter(Boolean).join(', ') || '---'],
      ['Complemento', p.complemento],
      ['Bairro', p.bairro],
      ['Cidade/UF', [p.cidade, p.estado].filter(Boolean).join(' / ') || '---'],
      ['Referência', p.referencia],
    ];
    const clinicalRows: Array<[string, unknown]> = [
      ['Tipo sanguíneo', p.tipoSanguineo],
      ['Peso', weight === '---' || weight === '—' ? '---' : `${weight} kg`],
      ['Altura', height === '---' || height === '—' ? '---' : `${height} m`],
      ['IMC', profileImc],
      ['Alergias', p.alergias],
      ['Condição principal', p.condicaoSaudePrincipal],
      ['Estado da condição', p.condicaoSaudePontuacao],
      ['Comorbidades', p.comorbidades],
      ['Nível de dor', p.nivelDor],
      ['Mobilidade', p.mobilidade],
      ['Dependência funcional', p.dependenciaFuncional],
      ['Integridade física', p.integridadeFisica],
      ['Urgência terapêutica', p.urgenciaTerapeutica],
      ['Tempo na fila', p.tempoNaFila],
      ['Disponibilidade encaixe', p.disponibilidadeEncaixe],
      ['Tipo de atendimento necessário', p.tipoAtendimentoNecessario],
      ['Profissional/especialidade necessária', p.profissionalEspecialidadeNecessaria],
      ['Observações clínicas', p.observacoesClinicas],
      ['Alertas críticos', p.alertasCriticos],
      ['Observações gerais', p.observacoes],
    ];
    const profileContact = [
      { label: 'Celular', value: displayPhone(p.telefone), icon: Phone },
      { label: 'E-mail', value: p.email || '—', icon: Mail },
      { label: 'Endereço', value: [p.logradouro, p.numero, p.bairro, p.cidade].filter(Boolean).join(', ') || '—', icon: MapPin },
    ];

    return (
      <div style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--app-gutter-y) var(--app-gutter-x) 44px', minHeight: 0 }}>
          <section style={{ overflow: 'hidden', borderRadius: 12, background: '#fff', border: '1px solid rgba(15,118,75,0.10)', boxShadow: 'none' }}>
            <div style={{ padding: '32px clamp(28px, 3.4vw, 48px)', background: '#008f51', color: '#fff' }}>
              <button onClick={() => setProfilePatient(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 800, cursor: 'pointer', padding: 0, marginBottom: 18 }}>
                <ArrowLeft size={16} /> Voltar
              </button>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 22, alignItems: 'center', minWidth: 0 }}>
                  <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', color: '#52735f', display: 'grid', placeItems: 'center', fontSize: 30, fontWeight: 800, overflow: 'hidden', flexShrink: 0 }}>
                    {p.foto ? <img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials(p.nome)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h1 style={{ fontSize: 26, fontWeight: 800, color: '#fff', lineHeight: 1.15, margin: 0 }}>{p.nome}</h1>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.88)', marginTop: 8 }}>{p.convenio || 'Particular'} · {profileAge !== null ? `${profileAge} anos` : 'idade não informada'} · {p.dataNasc || 'nascimento não informado'}</p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.74)', marginTop: 3 }}>CPF: {displayCpf(p.cpf)}</p>
                    <span style={{ display: 'inline-flex', marginTop: 12, padding: '5px 12px', borderRadius: 999, background: 'rgba(221,251,233,0.18)', color: '#eafff2', fontSize: 12, fontWeight: 800 }}>{p.status}</span>
                  </div>
                </div>
                <button onClick={() => { openEdit(p); setProfilePatient(null); }} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.22)', border: '1px solid rgba(255,255,255,0.42)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Editar cadastro</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginTop: 30, borderRadius: 10, background: 'rgba(255,255,255,0.10)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.14)' }}>
                {[
                  [String(patientAppointments.length), 'Consultas'],
                  [String(patientReports.length), 'Prontuários'],
                  [String(releasedReports.length), 'Receitas'],
                  [profilePriority.total ? String(profilePriority.total) : '—', 'Score'],
                  [p.ultimoAtendimento ? formatDateTime(p.ultimoAtendimento).split(' ')[0] : '—', 'Última visita'],
                ].map(([value, label]) => (
                  <div key={label} style={{ padding: '22px 12px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.14)' }}>
                    <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{value}</div>
                    <div style={{ color: 'rgba(255,255,255,0.66)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', background: '#fff', borderBottom: '1px solid var(--gray-100)' }}>
              {PROFILE_TABS.map(tab => (
                <button key={tab.id} onClick={() => setProfileTab(tab.id)} style={{ padding: '17px 22px', border: 'none', borderBottom: `2px solid ${profileTab === tab.id ? 'var(--primary)' : 'transparent'}`, background: 'transparent', color: profileTab === tab.id ? 'var(--primary)' : 'var(--gray-600)', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>{tab.label}</button>
              ))}
            </div>
          </section>

          {profileTab === 'resumo' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 22, marginTop: 22 }}>
              <ProfileCard title="Próxima consulta">
                {upcomingAppointments[0] ? (
                  <InfoLine label={`${formatDateBR(upcomingAppointments[0].data)} às ${upcomingAppointments[0].hora}`} value={`${upcomingAppointments[0].tipo} - ${doctorName(upcomingAppointments[0].medicoId)}`} />
                ) : <EmptyProfileState text="Nenhuma consulta agendada." />}
              </ProfileCard>
              <ProfileCard title="Últimas consultas">
                <AppointmentList items={pastAppointments.slice(0, 4)} doctorName={doctorName} />
              </ProfileCard>
              <ProfileCard title="Sinais vitais">
                <InfoLine label="Peso" value={weight} />
                <InfoLine label="Altura" value={height} />
                <InfoLine label="IMC" value={profileImc} />
              </ProfileCard>
              <ProfileCard title="Contato">
                {profileContact.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--gray-100)' }}>
                      <Icon size={16} color="var(--primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.7 }}>{item.label}</div>
                        <div style={{ fontSize: 13, color: 'var(--dark)', marginTop: 4 }}>{item.value}</div>
                      </div>
                    </div>
                  );
                })}
              </ProfileCard>
            </div>
          )}

          {profileTab === 'dados' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))', gap: 22, marginTop: 22 }}>
              <ProfileCard title="Identificação e contato"><DetailGrid rows={personalRows} /></ProfileCard>
              <ProfileCard title="Informações médicas"><DetailGrid rows={clinicalRows} /></ProfileCard>
            </div>
          )}

          {profileTab === 'historico' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(460px, 100%), 1fr))', gap: 22, marginTop: 22 }}>
              <ProfileCard title="Histórico de consultas"><AppointmentList items={patientAppointments} doctorName={doctorName} /></ProfileCard>
              <ProfileCard title="Histórico médico"><DetailGrid rows={clinicalRows} /></ProfileCard>
            </div>
          )}

          {profileTab === 'prontuarios' && (
            <div style={{ marginTop: 22 }}>
              <ProfileCard title="Prontuários e laudos vinculados"><ReportsList items={patientReports} /></ProfileCard>
            </div>
          )}

          {profileTab === 'receitas' && (
            <div style={{ marginTop: 22 }}>
              <ProfileCard title="Receitas e orientações">
                {releasedReports.length > 0 ? <ReportsList items={releasedReports} /> : <EmptyProfileState text="Nenhuma receita ou orientação liberada para este paciente." />}
              </ProfileCard>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Renderização ------------------------------------------------------------
  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
      {/* -- Área scrollável -- */}
      <div style={{ flex: 1, overflow: 'auto', padding: 'var(--app-gutter-y) var(--app-gutter-x) 44px', minHeight: 0 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12, textAlign: 'center' }}>
          <div style={{ width: '100%' }}>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#071327', lineHeight: 1.15, margin: 0 }}>Gerenciar Pacientes</h1>
            <p style={{ fontSize: 14, color: '#334155', marginTop: 8 }}>
              {readOnly ? 'Visualize os pacientes cadastrados' : 'Visualize e gerencie os pacientes cadastrados'}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px', marginBottom: 22, boxShadow: 'none', border: '1px solid rgba(15,118,75,0.10)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Busca */}
            <div style={{ flex: 2, minWidth: 260, position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input value={search} onChange={e => { setSearch(e.target.value); setVisibleCount(20); }}
                placeholder="Buscar paciente por nome, telefone..."
                style={{ width: '100%', minHeight: 50, padding: '12px 14px 12px 42px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 14, outline: 'none', background: '#fff' }} />
            </div>

            {/* Filtro avançado */}
            <button onClick={() => setShowFiltroAvancado(v => !v)}
              style={{ minHeight: 50, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 10, border: `1px solid ${showFiltroAvancado ? 'var(--primary)' : 'var(--gray-200)'}`, background: showFiltroAvancado ? 'var(--mint)' : '#fff', fontSize: 14, fontWeight: 800, color: showFiltroAvancado ? 'var(--dark)' : '#071327', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
              <Filter size={18} /> Filtros <ChevronDown size={14} style={{ transform: showFiltroAvancado ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {!hideAddButton && (
              <button onClick={openAdd} style={{ minHeight: 50, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,166,63,0.22)' }}>
                <Plus size={16} /> Novo Paciente
              </button>
            )}
          </div>

          {/* Filtro avançado expandido */}
          {showFiltroAvancado && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--gray-100)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label htmlFor="patient-insurance-filter" style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Convênio</label>
                <select id="patient-insurance-filter" value={filterConvenio} onChange={e => setFilterConvenio(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}>
                  <option value="">Todos</option>
                  {CONVENIOS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label htmlFor="patient-priority-filter" style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Prioridade</label>
                <select id="patient-priority-filter" value={filtroPrioridade} onChange={e => setFiltroPrioridade(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}>
                  <option value="">Todas</option>
                  {[1, 2, 3, 4, 5].map(level => <option key={level} value={level}>NPS {level}</option>)}
                </select>
              </div>
              <button onClick={() => { setFiltroPrioridade(''); setFilterConvenio(''); setSearch(''); }}
                style={{ alignSelf: 'flex-end', padding: '8px 14px', border: '1px solid var(--gray-200)', borderRadius: 8, background: 'none', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>
          )}
        </div>

        {/* Tabela */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: 'none', border: '1px solid rgba(15,118,75,0.10)', overflow: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--gray-100)', background: 'var(--gray-50)' }}>
                {['Nome', 'Telefone', 'Prioridade', 'Último Atendimento', 'Próximo Atendimento', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '18px 24px', textAlign: 'left', fontSize: 13, fontWeight: 800, color: '#071327', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(p => {
                const ext = p as PacienteExtended;
                const priority = calculatePatientPriority(ext);
                return (
                  <tr key={p.id}
                    style={{ borderBottom: '1px solid var(--gray-100)', transition: 'background .1s', background: highlightId === p.id ? 'var(--mint)' : undefined }}
                    onMouseEnter={e => { if (highlightId !== p.id) (e.currentTarget as HTMLTableRowElement).style.background = 'var(--gray-50)'; }}
                    onMouseLeave={e => { if (highlightId !== p.id) (e.currentTarget as HTMLTableRowElement).style.background = ''; }}>

                    {/* Nome */}
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 50, background: '#d9ffe8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: 'var(--primary)', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
                          {p.foto ? <img src={p.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : initials(p.nome)}
                        </div>
                        <div>
                          <button onClick={() => openView(p)}
                            style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                            {p.nome}
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* Telefone */}
                    <td style={{ padding: '18px 24px', fontSize: 14, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
                      {displayPhone(p.telefone)}
                    </td>

                    {/* Prioridade */}
                    <td style={{ padding: '18px 24px', fontSize: 14, color: 'var(--gray-700)', whiteSpace: 'nowrap' }}>
                      <PriorityBadge level={priority.level} incomplete={priority.missing.length > 0} />
                    </td>

                    {/* Último atendimento */}
                    <td style={{ padding: '18px 24px', fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(ext.ultimoAtendimento || '')}
                    </td>

                    {/* Próximo atendimento */}
                    <td style={{ padding: '18px 24px', fontSize: 13, color: 'var(--gray-500)', whiteSpace: 'nowrap' }}>
                      {ext.proximoAtendimento ? formatDateTime(ext.proximoAtendimento) : 'Nenhum atendimento agendado'}
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '18px 24px' }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <ActionBtn icon={Eye} color="var(--primary)" title="Ver prontuário" onClick={() => openView(p)} />
                        <ActionBtn icon={Pencil} color="#d97706" title="Editar" onClick={() => openEdit(p)} />
                        {canSchedulePatient && <ActionBtn icon={Calendar} color="#7c3aed" title="Marcar consulta" onClick={() => onSchedule?.(p.id)} />}
                        {canDeletePatient && <ActionBtn icon={Trash2} color="var(--red-500)" title="Excluir" onClick={() => { setDeleteError(''); setConfirmDelete(p.id); }} />}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--gray-400)' }}>
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

      {/* --- Modal de Cadastro/Edição/Visualização --------------------------- */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: isView ? '#f4f6f5' : '#fff', borderRadius: isView ? 0 : 20, width: isView ? 'min(1180px, calc(100vw - 24px))' : 'min(1080px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            {/* Cabeçalho do modal */}
            <div style={{
              padding: isView ? '18px 24px 0' : '20px 24px 0',
              borderBottom: '1px solid var(--gray-100)',
              background: isView
                ? 'linear-gradient(135deg, #00A63F 0%, #009E57 100%), repeating-linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 22px)'
                : '#fff',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                  {/* Avatar */}
                  <div style={{ width: isView ? 96 : 52, height: isView ? 96 : 52, borderRadius: 50, background: isView ? 'rgba(255,255,255,0.92)' : 'var(--mint)', border: isView ? '1px solid rgba(255,255,255,0.80)' : '2px solid var(--light)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', flexShrink: 0, cursor: !isView ? 'pointer' : 'default', color: isView ? '#667f70' : 'var(--light)', fontSize: isView ? 30 : 12, fontWeight: 800 }}
                    onClick={() => !isView && fileRef.current?.click()}>
                    {d.foto ? <img src={d.foto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : isView ? initials(d.nome || 'Paciente') : <User size={22} color="var(--light)" />}
                    {!isView && (
                      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; }}>
                        <Camera size={16} color="#fff" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h2 style={{ fontSize: isView ? 24 : 17, fontWeight: 800, color: isView ? '#fff' : 'var(--gray-800)' }}>
                      {modal.mode === 'add' ? 'Dados do Paciente' : modal.mode === 'edit' ? 'Editar Paciente' : d.nome || 'Prontuário'}
                    </h2>
                    <div style={{ fontSize: 12, color: isView ? 'rgba(255,255,255,0.86)' : 'var(--gray-400)', marginTop: 6, lineHeight: 1.7 }}>
                      {modal.mode === 'add'
                        ? 'Preencha os dados abaixo para cadastrar'
                        : isView
                          ? `${d.convenio || 'Particular'} · ${modalAge !== null ? `${modalAge} anos` : 'idade não informada'} · ${d.dataNasc || 'nascimento não informado'}`
                          : d.nome || 'Visualização completa'}
                      {isView && <><br />CPF: {displayCpf(d.cpf)}</>}
                    </div>
                    {isView && (
                      <span style={{ display: 'inline-flex', marginTop: 10, padding: '5px 12px', borderRadius: 999, background: 'rgba(0,166,63,0.22)', color: '#dff8ea', fontSize: 12, fontWeight: 800 }}>
                        {d.status}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {isView && (
                    <button onClick={() => setModal(m => ({ ...m, mode: 'edit' }))} style={{ padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.30)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                      Editar cadastro
                    </button>
                  )}
                  <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, background: isView ? 'rgba(255,255,255,0.12)' : 'var(--gray-100)', border: isView ? '1px solid rgba(255,255,255,0.24)' : 'none', color: isView ? '#fff' : 'var(--gray-700)', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
                    <X size={15} />
                  </button>
                </div>
              </div>
              {isView && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(110px, 1fr))', gap: 0, marginTop: 20, borderRadius: 14, background: 'rgba(255,255,255,0.10)', overflow: 'hidden' }}>
                  {[
                    ['0', 'Consultas'],
                    ['0', 'Prontuários'],
                    ['0', 'Receitas'],
                    [priority.total ? String(priority.total) : '—', 'Score'],
                    [d.ultimoAtendimento ? formatDateTime(d.ultimoAtendimento).split(' ')[0] : '—', 'Última visita'],
                  ].map(([value, label]) => (
                    <div key={label} style={{ padding: '16px 10px', textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.16)' }}>
                      <div style={{ color: '#fff', fontSize: 18, fontWeight: 800 }}>{value}</div>
                      <div style={{ color: 'rgba(255,255,255,0.64)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
                    </div>
                  ))}
                </div>
              )}
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

              {/* -- ABA: Dados Pessoais -- */}
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
                    <FieldSelect label="Tipo de documento" value={d.outroDocTipo || ''} onChange={v => setField('outroDocTipo', v)} options={TIPOS_DOC} disabled={isView} />
                    <FieldInput label="Número do documento" value={d.outroDocNumero || ''} onChange={v => setField('outroDocNumero', v)} disabled={isView} placeholder="Número" />
                  </div>

                  <div style={responsiveGrid(220)}>
                    {/* Sexo */}
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Sexo</label>
                      <div style={{ display: 'flex', gap: 16 }}>
                        {['Masculino', 'Feminino', 'Outro', 'Não informar'].map(s => (
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
                    <FieldInput label="Celular / WhatsApp" value={d.telefone} onChange={v => setField('telefone', formatPhoneBR(v))} required disabled={isView} error={errors.telefone} placeholder="(79) 99000-0000" inputMode="tel" maxLength={15} />
                    <FieldInput label="Telefone fixo 1" value={d.telefone2 || ''} onChange={v => setField('telefone2', formatPhoneBR(v))} disabled={isView} error={errors.telefone2} placeholder="(79) 3000-0000" inputMode="tel" maxLength={15} />
                    <FieldInput label="Telefone fixo 2" value={d.telefone3 || ''} onChange={v => setField('telefone3', formatPhoneBR(v))} disabled={isView} error={errors.telefone3} placeholder="(79) 3000-0000" inputMode="tel" maxLength={15} />
                  </div>

                  {/* Toggles */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', flexWrap: 'wrap' }}>
                    <Toggle label="Paciente é menor de idade?" value={showResponsavel} onChange={setShowResponsavel} disabled={isView} />
                  </div>

                  {showResponsavel && (
                    <>
                      <SectionHeader label="Responsável" />
                      <div style={responsiveGrid(240)}>
                        <FieldInput label="Nome do responsável" value={d.nomeResponsavel || ''} onChange={v => setField('nomeResponsavel', v)} required disabled={isView} error={errors.nomeResponsavel} />
                        <FieldInput label="CPF do responsável" value={d.cpfResponsavel || ''} onChange={v => setField('cpfResponsavel', formatCpf(v))} required disabled={isView} error={errors.cpfResponsavel} placeholder="000.000.000-00" inputMode="numeric" maxLength={14} />
                      </div>
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

              {/* -- ABA: Endereço -- */}
              {activeTab === 'endereco' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Endereço" icon={MapPin} />
                  <div style={responsiveGrid(180)}>
                    <FieldInput label="CEP" value={d.cep || ''} onChange={v => setField('cep', formatCep(v))} disabled={isView} error={errors.cep} placeholder="00000-000" inputMode="numeric" maxLength={9} />
                    <FieldInput label="Logradouro / Endereço" value={d.logradouro || ''} onChange={v => setField('logradouro', v)} disabled={isView} placeholder="Rua, Avenida..." />
                  </div>
                  <div style={responsiveGrid(150)}>
                    <FieldInput label="Número" value={d.numero || ''} onChange={v => setField('numero', v)} disabled={isView} placeholder="Ex: 123" />
                    <FieldInput label="Complemento" value={d.complemento || ''} onChange={v => setField('complemento', v)} disabled={isView} placeholder="Apto, Bloco..." />
                    <FieldInput label="Bairro" value={d.bairro || ''} onChange={v => setField('bairro', v)} disabled={isView} />
                  </div>
                  <div style={responsiveGrid(180)}>
                    <FieldInput label="Ponto de referência" value={d.referencia || ''} onChange={v => setField('referencia', v)} disabled={isView} placeholder="Ex: Próximo ao metrô" />
                  </div>
                </div>
              )}

              {/* -- ABA: Informações Médicas -- */}
              {activeTab === 'medico' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="Informações Médicas" />
                  <div style={{ ...responsiveGrid(140), alignItems: 'end' }}>
                    <FieldSelect label="Tipo Sanguíneo" value={d.tipoSanguineo || ''} onChange={v => setField('tipoSanguineo', v)} options={TIPOS_SANGUINEOS} disabled={isView} />
                    <FieldInput label="Peso (kg)" value={d.peso || ''} onChange={v => setField('peso', v)} type="number" disabled={isView} placeholder="Ex: 70" min="0" step="0.1" inputMode="decimal" />
                    <FieldInput label="Altura (m)" value={d.altura || ''} onChange={v => setField('altura', v)} type="number" disabled={isView} placeholder="Ex: 1.75" min="0" step="0.01" inputMode="decimal" />
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

              {/* -- ABA: Prioridade -- */}
              {activeTab === 'prioridade' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <SectionHeader label="NPS-Paciente para substituição de agenda" icon={Gauge} />

                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--gray-100)', background: 'var(--gray-50)', fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    Classificação de apoio operacional para encaixes. Não substitui avaliação médica, enfermagem, fisioterapia ou decisão profissional.
                  </div>

                  <div style={responsiveGrid(220)}>
                    <FieldInput label="Condição de saúde principal" value={d.condicaoSaudePrincipal || ''} onChange={v => setField('condicaoSaudePrincipal', v)} disabled={isView} placeholder="Resumo operacional, sem excesso de dados sensíveis" />
                    <FieldSelect label="Estado da condição de saúde" value={d.condicaoSaudePontuacao || ''} onChange={v => setField('condicaoSaudePontuacao', v)} options={HEALTH_CONDITION_OPTIONS} disabled={isView} />
                    <FieldInput label="Comorbidades" value={d.comorbidades || ''} onChange={v => setField('comorbidades', v)} disabled={isView} placeholder="Ex: condição crônica controlada" />
                    <FieldInput label="Nível de dor" value={d.nivelDor || ''} onChange={v => setField('nivelDor', String(Math.min(Number(v.replace(/\D/g, '').slice(0, 2) || 0), 10)))} disabled={isView} placeholder="0 a 10" inputMode="numeric" maxLength={2} />
                  </div>

                  <div style={responsiveGrid(220)}>
                    <FieldSelect label="Integridade física" value={d.integridadeFisica || ''} onChange={v => setField('integridadeFisica', v)} options={PHYSICAL_INTEGRITY_OPTIONS} disabled={isView} />
                    <FieldSelect label="Mobilidade" value={d.mobilidade || ''} onChange={v => setField('mobilidade', v)} options={MOBILITY_OPTIONS} disabled={isView} />
                    <FieldSelect label="Dependência funcional" value={d.dependenciaFuncional || ''} onChange={v => setField('dependenciaFuncional', v)} options={MOBILITY_OPTIONS} disabled={isView} />
                    <FieldSelect label="Urgência terapêutica" value={d.urgenciaTerapeutica || ''} onChange={v => setField('urgenciaTerapeutica', v)} options={THERAPEUTIC_URGENCY_OPTIONS} disabled={isView} />
                  </div>

                  <div style={responsiveGrid(220)}>
                    <FieldSelect label="Tempo na fila" value={d.tempoNaFila || ''} onChange={v => setField('tempoNaFila', v)} options={WAITING_TIME_OPTIONS} disabled={isView} />
                    <FieldSelect label="Disponibilidade para encaixe" value={d.disponibilidadeEncaixe || ''} onChange={v => setField('disponibilidadeEncaixe', v)} options={FIT_AVAILABILITY_OPTIONS} disabled={isView} />
                    <FieldInput label="Faltas anteriores" value={d.faltasAnteriores || ''} onChange={v => setField('faltasAnteriores', v)} disabled={isView} placeholder="Ex: 1 falta justificada" />
                    <FieldInput label="Tempo mínimo para chegar" value={d.tempoMinimoChegar || ''} onChange={v => setField('tempoMinimoChegar', v.replace(/\D/g, '').slice(0, 3))} disabled={isView} placeholder="Ex: 40 min" inputMode="numeric" maxLength={3} />
                  </div>

                  <div style={responsiveGrid(220)}>
                    <FieldInput label="Tempo de deslocamento" value={d.tempoDeslocamento || ''} onChange={v => setField('tempoDeslocamento', v.replace(/\D/g, '').slice(0, 3))} disabled={isView} placeholder="Ex: 25 min" inputMode="numeric" maxLength={3} />
                    <FieldInput label="Tipo de atendimento necessário" value={d.tipoAtendimentoNecessario || ''} onChange={v => setField('tipoAtendimentoNecessario', v)} disabled={isView} placeholder="Ex: consulta, retorno, procedimento" />
                    <FieldInput label="Profissional ou especialidade necessária" value={d.profissionalEspecialidadeNecessaria || ''} onChange={v => setField('profissionalEspecialidadeNecessaria', v)} disabled={isView} placeholder="Ex: cardiologia, fisioterapia, Dr(a). responsável" />
                  </div>

                  <div style={responsiveGrid(260)}>
                    <PriorityTextArea label="Observações clínicas" value={d.observacoesClinicas || ''} onChange={v => setField('observacoesClinicas', v)} disabled={isView} placeholder="Use linguagem objetiva e evite diagnósticos sensíveis desnecessários." />
                    <PriorityTextArea label="Alertas críticos" value={d.alertasCriticos || ''} onChange={v => setField('alertasCriticos', v)} disabled={isView} placeholder="Ex: risco de queda, piora recente, alerta para profissional." />
                  </div>

                  <SectionHeader label="Resultado calculado" icon={Gauge} />
                  <div style={responsiveGrid(180)}>
                    <div style={{ padding: 14, borderRadius: 8, background: '#fff', border: '1px solid var(--gray-100)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Nível calculado</div>
                      <div style={{ marginTop: 8 }}><PriorityBadge level={priority.level} incomplete={priority.missing.length > 0} /></div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 8, background: '#fff', border: '1px solid var(--gray-100)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Pontuação calculada</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--dark)', marginTop: 4 }}>{priority.total}/32</div>
                    </div>
                    <div style={{ padding: 14, borderRadius: 8, background: '#fff', border: '1px solid var(--gray-100)' }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>Pode ocupar vaga?</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: priority.canAttend ? 'var(--primary)' : 'var(--red-600)', marginTop: 8 }}>{priority.canAttend ? 'Sim' : 'Não'}</div>
                    </div>
                  </div>

                  <div style={{ padding: 12, borderRadius: 8, border: '1px solid var(--gray-100)', background: priority.canAttend ? 'var(--mint)' : 'var(--red-50)', fontSize: 12, color: priority.canAttend ? 'var(--dark)' : 'var(--red-600)', lineHeight: 1.6 }}>
                    <strong>Justificativa curta:</strong> {priority.shortJustification}<br />
                    {!priority.canAttend && <><strong>Motivo:</strong> {priority.cannotAttendReason || 'Dados essenciais ausentes.'}<br /></>}
                    {priority.missing.length > 0 && <><strong>Dados faltantes:</strong> {priority.missing.join(', ')}<br /></>}
                    {priority.professionalAlert && <><strong>Alerta:</strong> {priority.professionalAlert}</>}
                  </div>

                  <div style={{ overflow: 'auto', border: '1px solid var(--gray-100)', borderRadius: 8 }}>
                    <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', background: '#fff' }}>
                      <thead>
                        <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                          {['posição_na_fila', 'paciente_id', 'idade', 'nps_nivel', 'pontuação_total', 'prioridade', 'pode_ocupar_vaga', 'motivo_se_não_puder', 'dados_faltantes', 'alerta_para_profissional'].map(header => (
                            <th key={header} style={{ padding: '9px 10px', textAlign: 'left', fontSize: 10, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td style={priorityCellStyle}>—</td>
                          <td style={priorityCellStyle}>{d.id || 'novo'}</td>
                          <td style={priorityCellStyle}>{priority.age ?? '—'}</td>
                          <td style={priorityCellStyle}>NPS {priority.level}</td>
                          <td style={priorityCellStyle}>{priority.total}</td>
                          <td style={priorityCellStyle}>{priority.priority}</td>
                          <td style={priorityCellStyle}>{priority.canAttend ? 'sim' : 'não'}</td>
                          <td style={priorityCellStyle}>{priority.cannotAttendReason || '—'}</td>
                          <td style={priorityCellStyle}>{priority.missing.join(', ') || '—'}</td>
                          <td style={priorityCellStyle}>{priority.professionalAlert || '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* -- ABA: Convênio -- */}
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

              {/* -- ABA: Observações -- */}
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
                  <div style={responsiveGrid(220)}>
                    <FieldInput label="URL de redirecionamento" value={d.urlRedirecionamento || ''} onChange={v => setField('urlRedirecionamento', v)} type="url" disabled={isView} error={errors.urlRedirecionamento} placeholder="https://exemplo.com/retorno" />
                    <div style={{ display: 'flex', alignItems: 'end', paddingBottom: 8 }}>
                      <Toggle label="Paciente VIP" value={d.vip || false} onChange={v => !isView && setField('vip', v)} disabled={isView} />
                    </div>
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

      {/* --- Confirm Delete --------------------------------------------------- */}
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

// --- Componentes auxiliares ---------------------------------------------------
function ProfileCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid rgba(15,118,75,0.10)', boxShadow: 'none', overflow: 'hidden' }}>
      <div style={{ padding: '17px 20px', background: '#fbfefd', borderBottom: '1px solid var(--gray-100)', fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.7, color: 'var(--dark)' }}>{title}</div>
      <div style={{ padding: 22, display: 'grid', gap: 14 }}>{children}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
      <span style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>{label}</span>
      <strong style={{ fontSize: 13, color: 'var(--gray-800)', textAlign: 'right', overflowWrap: 'anywhere' }}>{value || '---'}</strong>
    </div>
  );
}

function DetailGrid({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
      {rows.map(([label, value]) => (
        <div key={label} style={{ minWidth: 0, padding: 14, border: '1px solid var(--gray-100)', borderRadius: 10, background: 'var(--gray-50)' }}>
          <div style={{ fontSize: 10, color: 'var(--gray-500)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-800)', fontWeight: 700, marginTop: 5, overflowWrap: 'anywhere' }}>
            {String(value || '---')}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyProfileState({ text }: { text: string }) {
  return <div style={{ padding: '12px 0', color: 'var(--gray-400)', fontSize: 13, fontStyle: 'italic' }}>{text}</div>;
}

function AppointmentList({ items, doctorName }: { items: Agendamento[]; doctorName: (doctorId?: string) => string }) {
  if (items.length === 0) return <EmptyProfileState text="Nenhuma consulta registrada." />;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map(item => (
        <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '92px 1fr auto', gap: 12, alignItems: 'center', padding: 12, border: '1px solid var(--gray-100)', borderRadius: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--dark)' }}>{item.hora}</div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{formatDateBR(item.data)}</div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)' }}>{item.tipo}</div>
            <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>{doctorName(item.medicoId)}</div>
            {item.observacoes && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 5 }}>{item.observacoes}</div>}
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: item.status === 'cancelado' ? 'var(--red-600)' : 'var(--primary)', background: item.status === 'cancelado' ? 'var(--red-50)' : 'var(--mint)', borderRadius: 999, padding: '4px 9px' }}>
            {item.status}
          </span>
        </div>
      ))}
    </div>
  );
}

function ReportsList({ items }: { items: Laudo[] }) {
  if (items.length === 0) return <EmptyProfileState text="Nenhum prontuário ou laudo vinculado." />;

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {items.map(item => (
        <div key={item.id} style={{ padding: 12, border: '1px solid var(--gray-100)', borderRadius: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{item.exame || 'Laudo médico'}</strong>
            <span style={{ fontSize: 11, color: item.status === 'liberado' ? 'var(--primary)' : 'var(--amber-600)', fontWeight: 800 }}>{item.status}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{formatDateBR(item.data)}{item.cid ? ` - CID ${item.cid}` : ''}</div>
          {item.diagnostico && <div style={{ fontSize: 12, color: 'var(--gray-700)', marginTop: 8 }}>{item.diagnostico}</div>}
          {item.impressao && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 5 }}>{item.impressao}</div>}
        </div>
      ))}
    </div>
  );
}

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
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        border: 'none',
        background: 'transparent',
        padding: 0,
        fontFamily: 'inherit',
        opacity: disabled ? 0.7 : 1,
      }}>
      <span
        aria-hidden="true"
        style={{ width: 36, height: 20, borderRadius: 10, background: value ? 'var(--primary)' : 'var(--gray-300)', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
        <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 18 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </span>
      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{label}</span>
    </button>
  );
}
