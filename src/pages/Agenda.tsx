import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus, ChevronLeft, ChevronRight, X, Check, Clock,
  Calendar, Users, Search, Pencil, Trash2, AlertCircle,
  Mail, Phone, CalendarCheck, MoreHorizontal, Loader2,
} from 'lucide-react';
import type { Agendamento, Paciente, TipoConsulta, StatusAgendamento } from '../types';
import type { ApiDoctor } from '../lib/api';
import { availabilityApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Constantes ───────────────────────────────────────────────────────────────
const TIPOS: TipoConsulta[] = ['Primeira Consulta', 'Retorno', 'Check-up', 'Urgência'];
const STATUS_LIST: StatusAgendamento[] = ['confirmado', 'pendente', 'cancelado', 'realizado'];

const STATUS_LABEL: Record<StatusAgendamento, string> = {
  confirmado: 'Confirmado', pendente: 'Pendente',
  cancelado: 'Cancelado',  realizado: 'Realizado',
};

const STATUS_STYLE: Record<StatusAgendamento, { bg: string; color: string; border: string }> = {
  confirmado: { bg: 'var(--mint)',   color: 'var(--dark)',    border: 'var(--primary)' },
  pendente:   { bg: '#fef9c3',       color: '#a16207',        border: '#eab308' },
  cancelado:  { bg: 'var(--red-50)', color: 'var(--red-600)', border: 'var(--red-500)' },
  realizado:  { bg: '#ede9fe',       color: '#5b21b6',        border: '#7c3aed' },
};

const TIPO_STYLE: Record<TipoConsulta, { bg: string; color: string }> = {
  'Primeira Consulta': { bg: '#dbeafe', color: '#1e40af' },
  'Retorno':           { bg: 'var(--mint)', color: 'var(--dark)' },
  'Check-up':          { bg: '#f0fdf4', color: '#166534' },
  'Urgência':          { bg: 'var(--red-100)', color: 'var(--red-600)' },
};

const DURACOES  = ['10 min','20 min','30 min','40 min','50 min','60 min','90 min'];
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DAYS_FULL = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const MONTHS_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// Slots de 10 em 10 min — 07:00 às 19:50 (fallback quando API não retorna slots)
const TIME_SLOTS_FALLBACK: string[] = [];
for (let h = 7; h <= 19; h++) {
  for (let m = 0; m < 60; m += 10) {
    TIME_SLOTS_FALLBACK.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDateISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function startOfWeek(d: Date) { const r = new Date(d); r.setDate(d.getDate() - d.getDay()); return r; }
function initials(nome: string) { return nome.split(' ').filter(Boolean).map(n => n[0]).slice(0,2).join('').toUpperCase(); }
function responsiveGrid(min = 180, gap = 12): React.CSSProperties {
  return { display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap };
}

// Normaliza slot retornado pela API para formato HH:MM
function normalizeSlot(raw: string): string {
  // A API pode retornar "08:00", "08:00:00" ou ISO "2024-01-01T08:00:00Z"
  if (raw.includes('T')) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return `${String(d.getUTCHours()).padStart(2,'0')}:${String(d.getUTCMinutes()).padStart(2,'0')}`;
    }
  }
  // HH:MM:SS → HH:MM
  return raw.substring(0, 5);
}

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function durationToMinutes(duration?: string) {
  const parsed = parseInt(duration || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30;
}

function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

type FormData = Omit<Agendamento,'id'> & { duracao: string; enviarEmail: boolean; enviarWhatsapp: boolean; id?: string };

const emptyForm = (dateStr: string): FormData => ({
  pacienteId: '', medicoId: '', data: dateStr,
  hora: '', tipo: 'Primeira Consulta', status: 'confirmado',
  observacoes: '', duracao: '30 min', enviarEmail: true, enviarWhatsapp: true,
});

// ─── Props ────────────────────────────────────────────────────────────────────
interface AgendaProps {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  doctors?: ApiDoctor[];
  onAdd: (a: Omit<Agendamento,'id'>) => Promise<void>;
  onUpdate: (a: Agendamento) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialOpen?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Agenda({ agendamentos, pacientes, doctors = [], onAdd, onUpdate, onDelete, initialOpen }: AgendaProps) {
  const { user } = useAuth();
  const isMedico = user?.role === 'medico';

  const [selectedDate, setSelectedDate]     = useState(new Date());
  const [viewMode, setViewMode]             = useState<'dia'|'semana'|'mes'>('dia');
  const [activeTab, setActiveTab]           = useState<'calendario'|'fila'>('calendario');
  const [shiftAnnounce, setShiftAnnounce]   = useState('');
  const [filterStatus, setFilterStatus]     = useState('');
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [modal, setModal]                   = useState<{ open: boolean; mode: 'add'|'edit'; data: FormData }>({ open: false, mode: 'add', data: emptyForm(formatDateISO(new Date())) });
  const [searchPaciente, setSearchPaciente] = useState('');
  const [errors, setErrors]                 = useState<Record<string,string>>({});
  const [confirmDelete, setConfirmDelete]   = useState<string|null>(null);
  const [savedFeedback, setSavedFeedback]   = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [apiError, setApiError]             = useState<string|null>(null);

  // ── Slots disponíveis da API ──
  const [slots, setSlots]             = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const slotsAbortRef = useRef<AbortController | null>(null);

  const dateStr = formatDateISO(selectedDate);

  // ── Busca slots quando médico ou data mudam no modal ──
  useEffect(() => {
    const doctorId = isMedico ? user?.doctor_id : modal.data.medicoId;
    const date     = modal.data.data;

    if (!modal.open || !doctorId || !date) {
      setSlots([]);
      return;
    }

    // Cancela requisição anterior se ainda estiver em andamento
    slotsAbortRef.current?.abort();
    slotsAbortRef.current = new AbortController();

    setSlotsLoading(true);
    setSlots([]);

    availabilityApi.getAvailableSlots({ doctor_id: doctorId, date })
      .then(res => {
        // A API pode retornar em diferentes formatos
        let rawSlots: string[] = [];
        if (Array.isArray(res.slots)) rawSlots = res.slots;
        else if (Array.isArray(res.available_slots)) rawSlots = res.available_slots;
        else if (Array.isArray(res.data)) rawSlots = res.data as string[];
        else if (res.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
          const d = res.data as { slots?: string[]; available_slots?: string[] };
          rawSlots = d.slots ?? d.available_slots ?? [];
        }
        setSlots(rawSlots.map(normalizeSlot));
      })
      .catch(() => setSlots([]))  // Em caso de erro usa fallback estático
      .finally(() => setSlotsLoading(false));

    return () => { slotsAbortRef.current?.abort(); };
  }, [modal.open, modal.data.medicoId, modal.data.data, isMedico, user?.doctor_id]);

  // Os horários exibidos no select: slots da API se disponíveis, senão fallback estático
  const timeSlots = slots.length > 0 ? slots : TIME_SLOTS_FALLBACK;

  const openModal = useCallback((appt?: Agendamento, slot?: string, dateOverride = dateStr) => {
    setApiError(null);
    if (appt) {
      setModal({ open: true, mode: 'edit', data: { ...emptyForm(dateStr), ...appt, duracao: appt.duracao || '30 min', enviarEmail: false, enviarWhatsapp: false, id: appt.id } });
    } else {
      setModal({ open: true, mode: 'add', data: { ...emptyForm(dateOverride), medicoId: filterDoctorId, hora: slot || '' } });
    }
    setSearchPaciente('');
    setErrors({});
  }, [dateStr, filterDoctorId]);

  // ── Atalhos de teclado ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (modal.open) return;
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const isEditable = (e.target as HTMLElement).isContentEditable;
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (e.key === 'c' || e.key === 'C') { setActiveTab('calendario'); setShiftAnnounce('Calendário aberto (C)'); setTimeout(() => setShiftAnnounce(''), 2000); }
      if (e.key === 'f' || e.key === 'F') { setActiveTab('fila'); setShiftAnnounce('Fila de espera aberta (F)'); setTimeout(() => setShiftAnnounce(''), 2000); }
      if (e.key === 'n' || e.key === 'N') { openModal(); setShiftAnnounce('Novo agendamento (N)'); setTimeout(() => setShiftAnnounce(''), 2000); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modal.open, openModal]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (initialOpen) openModal(); }, [initialOpen]);

  // ── Dados filtrados ──
  const activeDoctorId = isMedico ? user?.doctor_id ?? '' : filterDoctorId;
  const filteredAgendamentos = agendamentos.filter(a =>
    (!activeDoctorId || a.medicoId === activeDoctorId) &&
    (!filterStatus || a.status === filterStatus)
  );
  const dayAppts  = filteredAgendamentos.filter(a => a.data === dateStr).sort((a,b) => a.hora.localeCompare(b.hora));
  const waitAppts = filteredAgendamentos.filter(a => a.data === dateStr && a.status === 'pendente');
  const weekStart = startOfWeek(selectedDate);
  const weekDays  = Array.from({length:7}, (_,i) => addDays(weekStart, i));

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, mode: 'add', data: emptyForm(dateStr) });
    setErrors({});
    setApiError(null);
    setSaving(false);
  };

  const setField = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setModal(m => ({ ...m, data: { ...m.data, [k]: v } }));

  const selectedPaciente   = pacientes.find(p => p.id === modal.data.pacienteId);
  const filteredPacientes  = pacientes.filter(p => !searchPaciente || p.nome.toLowerCase().includes(searchPaciente.toLowerCase()) || p.cpf.includes(searchPaciente));
  const modalDoctorId = isMedico ? user?.doctor_id ?? '' : modal.data.medicoId || '';
  const selectedDoctor = doctors.find(d => d.id === modalDoctorId);
  const modalDoctorDayAppts = agendamentos
    .filter(a => a.medicoId === modalDoctorId && a.data === modal.data.data && a.status !== 'cancelado')
    .sort((a, b) => a.hora.localeCompare(b.hora));
  const modalTimeSlots = Array.from(new Set([...timeSlots, modal.data.hora].filter(Boolean))).sort();
  const findScheduleConflict = (hora: string, duracao = modal.data.duracao) => {
    if (!hora) return undefined;
    const start = timeToMinutes(hora);
    const end = start + durationToMinutes(duracao);
    return modalDoctorDayAppts.find(appt => {
      if (appt.id === modal.data.id) return false;
      const apptStart = timeToMinutes(appt.hora);
      const apptEnd = apptStart + durationToMinutes(appt.duracao);
      return rangesOverlap(start, end, apptStart, apptEnd);
    });
  };

  const validate = () => {
    const e: Record<string,string> = {};
    if (!modal.data.pacienteId) e.paciente = 'Selecione um paciente';
    if (!modal.data.hora)       e.hora     = 'Horário obrigatório';
    if (!modal.data.data)       e.data     = 'Data obrigatória';
    if (!isMedico && !modal.data.medicoId) e.medico = 'Selecione um médico';
    if (modalDoctorId && modal.data.hora) {
      const conflict = findScheduleConflict(modal.data.hora);
      if (conflict) e.hora = `Este médico já possui agendamento às ${conflict.hora}.`;
    }
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }

    setSaving(true);
    setApiError(null);

    try {
      const { id, duracao, enviarEmail, enviarWhatsapp, ...rest } = modal.data;
      const payload = { ...rest, duracao, enviarEmail, enviarWhatsapp };

      if (modal.mode === 'add') {
        await onAdd(payload);
      } else {
        await onUpdate({ ...payload, id: id! } as Agendamento);
      }

      setSavedFeedback(true);
      setTimeout(() => {
        setSavedFeedback(false);
        closeModal();
      }, 700);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar agendamento.';
      setApiError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await onDelete(id);
      setConfirmDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao excluir agendamento.';
      setApiError(msg);
      setConfirmDelete(null);
    }
  };

  const handleQuickUpdate = async (appt: Agendamento, newStatus: StatusAgendamento) => {
    try {
      await onUpdate({ ...appt, status: newStatus });
    } catch {
      // erro tratado pelo App.tsx via apiError
    }
  };

  const dayLabelFull = `${DAYS_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_PT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--background)',
      overflow: 'hidden',
      minHeight: 0,
    }}>

      {/* ── Anúncio atalho ── */}
      {shiftAnnounce && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--dark)', color: '#fff', fontSize: 13, fontWeight: 600, padding: '8px 18px', borderRadius: 20, zIndex: 9999, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {shiftAnnounce}
        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--gray-100)', zIndex: 10 }}>

        {/* Linha 1: título + botão */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px 10px', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>Agenda</h1>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '2px 0 0' }}>
              Atalhos:{' '}
              <kbd style={{ background: 'var(--gray-100)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>C</kbd> Calendário{' '}
              <kbd style={{ background: 'var(--gray-100)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>F</kbd> Fila{' '}
              <kbd style={{ background: 'var(--gray-100)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>N</kbd> Novo
            </p>
          </div>
          <button onClick={() => openModal()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
            <Plus size={16} /> Agendar
          </button>
        </div>

        {/* Linha 2: filtros + navegação */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 24px 10px', flexWrap: 'wrap' }}>
          {/* Badge médico ou select de profissional */}
          {isMedico ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'var(--mint)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {initials(user?.full_name || '')}
              </div>
              {user?.full_name}
              {user?.specialty && <span style={{ color: 'var(--gray-500)', fontWeight: 400 }}>· {user.specialty}</span>}
            </div>
          ) : doctors.length > 0 ? (
            <select
              value={filterDoctorId}
              style={{ padding: '7px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}
              onChange={e => {
                setFilterDoctorId(e.target.value);
              }}
            >
              <option value="">Todos os médicos</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` — ${d.specialty}` : ''}</option>
              ))}
            </select>
          ) : (
            <div style={{ position: 'relative', minWidth: 200 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input placeholder="Buscar profissional..."
                style={{ padding: '7px 12px 7px 30px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', width: '100%' }} />
            </div>
          )}

          {/* Filtro status */}
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            style={{ padding: '7px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
            <option value="">Todos os status</option>
            {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>

          {/* Navegação de data + modos */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'semana' ? -7 : viewMode === 'mes' ? -30 : -1))}
              style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={15} />
            </button>

            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', minWidth: 160, textAlign: 'center', flex: '1 1 180px' }}>
              {viewMode === 'dia'
                ? `${DAYS_FULL[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_PT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
                : viewMode === 'semana'
                ? `${weekDays[0].getDate()} – ${weekDays[6].getDate()} ${MONTHS_PT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`
                : `${MONTHS_PT[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`}
            </span>

            <button onClick={() => setSelectedDate(d => addDays(d, viewMode === 'semana' ? 7 : viewMode === 'mes' ? 30 : 1))}
              style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--gray-50)', border: '1px solid var(--gray-200)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ChevronRight size={15} />
            </button>

            <div style={{ display: 'flex', background: 'var(--gray-50)', border: '1px solid var(--gray-200)', borderRadius: 8, overflow: 'hidden', marginLeft: 4 }}>
              {(['dia','semana','mes'] as const).map(mode => (
                <button key={mode} onClick={() => setViewMode(mode)}
                  style={{ padding: '6px 13px', border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: viewMode === mode ? 'var(--primary)' : 'transparent', color: viewMode === mode ? '#fff' : 'var(--gray-600)', transition: 'all .15s' }}>
                  {mode === 'dia' ? 'Dia' : mode === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>

            <button onClick={() => setSelectedDate(new Date())}
              style={{ padding: '6px 13px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: '#fff', color: 'var(--dark)' }}>
              Hoje
            </button>
          </div>
        </div>

        {/* Abas */}
        <div style={{ display: 'flex', padding: '0 24px', borderTop: '1px solid var(--gray-100)' }}>
          {[{id:'calendario', label:'Calendário', icon: Calendar}, {id:'fila', label:'Fila de espera', icon: Users}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as 'calendario'|'fila')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary)' : 'transparent'}`, background: 'none', fontSize: 13, fontWeight: 600, color: activeTab === tab.id ? 'var(--primary)' : 'var(--gray-500)', cursor: 'pointer', transition: 'all .15s' }}>
              <tab.icon size={14} />
              {tab.label}
              {tab.id === 'fila' && waitAppts.length > 0 && (
                <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{waitAppts.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CORPO ── */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', minHeight: 0 }}>

        {/* ── ABA CALENDÁRIO ── */}
        {activeTab === 'calendario' && (
          <>
            {/* VISÃO DIA */}
            {viewMode === 'dia' && (
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'auto' }}>
                <div style={{ flex: '1 1 520px', minWidth: 360, overflowY: 'auto', overflowX: 'hidden' }}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 5, background: '#f8fafc', borderBottom: '1px solid var(--gray-100)', padding: '10px 16px', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', textAlign: 'center' }}>
                    {dayLabelFull}
                  </div>
                  {TIME_SLOTS_FALLBACK.map(slot => {
                    const isHour    = slot.endsWith(':00');
                    const slotAppts = dayAppts.filter(a => a.hora === slot);
                    const hasAppts  = slotAppts.length > 0;
                    return (
                      <div key={slot}
                        onClick={() => !hasAppts && openModal(undefined, slot)}
                        style={{ display: 'flex', minHeight: isHour ? 48 : 32, borderBottom: `1px solid ${isHour ? 'var(--gray-100)' : 'var(--gray-50)'}`, cursor: !hasAppts ? 'pointer' : 'default' }}
                        onMouseEnter={e => { if (!hasAppts) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = ''; }}>
                        <div style={{ width: 60, flexShrink: 0, paddingRight: 10, paddingTop: isHour ? 10 : 4, fontSize: 11, fontWeight: 600, color: isHour ? 'var(--gray-500)' : 'transparent', textAlign: 'right', userSelect: 'none', background: '#fff', borderRight: '1px solid var(--gray-100)' }}>
                          {slot}
                        </div>
                        <div style={{ flex: 1, padding: hasAppts ? '3px 10px' : '2px 10px' }}>
                          {slotAppts.map(appt => {
                            const pac = pacientes.find(p => p.id === appt.pacienteId);
                            const st  = STATUS_STYLE[appt.status];
                            const tp  = TIPO_STYLE[appt.tipo];
                            return (
                              <div key={appt.id} onClick={e => e.stopPropagation()}
                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', background: st.bg, borderLeft: `3px solid ${st.border}`, borderRadius: 8, marginBottom: 2, cursor: 'default' }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {appt.hora} · {pac?.nome || 'Paciente'}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, ...tp }}>{appt.tipo}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, color: st.color }}>· {STATUS_LABEL[appt.status]}</span>
                                    {pac?.telefone && <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>· {pac.telefone}</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                  <ApptBtn icon={Pencil}  color="var(--amber-600)" onClick={() => openModal(appt)} />
                                  {appt.status !== 'realizado' && <ApptBtn icon={Check} color="var(--primary)" onClick={() => handleQuickUpdate(appt, 'realizado')} />}
                                  <ApptBtn icon={Trash2}  color="var(--red-500)"   onClick={() => setConfirmDelete(appt.id)} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ height: 32 }} />
                </div>

                {/* Painel lateral */}
                <div style={{ width: 240, flex: '0 0 240px', borderLeft: '1px solid var(--gray-100)', overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, background: '#fff' }}>
                  <div style={{ background: 'var(--gray-50)', borderRadius: 12, border: '1px solid var(--gray-100)', padding: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Resumo do dia</div>
                    {[
                      { label: 'Total',       value: dayAppts.length,                                     color: 'var(--dark)' },
                      { label: 'Confirmados', value: dayAppts.filter(a=>a.status==='confirmado').length,  color: 'var(--primary)' },
                      { label: 'Pendentes',   value: dayAppts.filter(a=>a.status==='pendente').length,    color: '#d97706' },
                      { label: 'Realizados',  value: dayAppts.filter(a=>a.status==='realizado').length,   color: '#7c3aed' },
                      { label: 'Cancelados',  value: dayAppts.filter(a=>a.status==='cancelado').length,   color: 'var(--red-500)' },
                    ].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid var(--gray-100)' }}>
                        <span style={{ fontSize: 12, color: 'var(--gray-600)' }}>{r.label}</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: r.color }}>{r.value}</span>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => openModal()}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
                    <Plus size={15} /> Novo Agendamento
                  </button>

                  {dayAppts.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Próximos</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {dayAppts.slice(0,5).map(appt => {
                          const pac = pacientes.find(p => p.id === appt.pacienteId);
                          const st  = STATUS_STYLE[appt.status];
                          return (
                            <div key={appt.id} style={{ padding: '8px 10px', borderRadius: 8, background: st.bg, borderLeft: `2px solid ${st.border}` }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-700)' }}>{appt.hora} · {pac?.nome?.split(' ')[0]}</div>
                              <div style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 1 }}>{appt.tipo}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VISÃO SEMANA */}
            {viewMode === 'semana' && (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: 600 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 4 }}>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--gray-100)' }}>
                      <th style={{ width: 60, padding: '8px', fontSize: 11, color: 'var(--gray-400)', borderRight: '1px solid var(--gray-100)' }}></th>
                      {weekDays.map(d => {
                        const isToday = formatDateISO(d) === formatDateISO(new Date());
                        return (
                          <th key={d.toISOString()} style={{ padding: '8px 4px', textAlign: 'center', borderRight: '1px solid var(--gray-100)', cursor: 'pointer' }}
                            onClick={() => { setSelectedDate(d); setViewMode('dia'); }}>
                            <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, textTransform: 'uppercase' }}>{DAYS_PT[d.getDay()]}</div>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: isToday ? 'var(--primary)' : 'transparent', color: isToday ? '#fff' : 'var(--gray-700)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '2px auto 0' }}>
                              {d.getDate()}
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {TIME_SLOTS_FALLBACK.map(slot => {
                      const isHour = slot.endsWith(':00');
                      if (!isHour && !slot.endsWith(':30')) return null;
                      return (
                        <tr key={slot} style={{ borderBottom: '1px solid var(--gray-50)', height: 40 }}>
                          <td style={{ padding: '0 8px', textAlign: 'right', fontSize: 10, color: 'var(--gray-400)', fontWeight: 600, verticalAlign: 'middle', borderRight: '1px solid var(--gray-100)', background: '#fff', whiteSpace: 'nowrap' }}>
                            {isHour ? slot : ''}
                          </td>
                          {weekDays.map(day => {
                            const ds        = formatDateISO(day);
                            const slotAppts = filteredAgendamentos.filter(a => a.data === ds && a.hora === slot);
                            return (
                              <td key={day.toISOString()} style={{ borderRight: '1px solid var(--gray-50)', padding: 2, verticalAlign: 'top', cursor: 'pointer' }}
                                onClick={() => {
                                  if (slotAppts.length === 0) {
                                    setSelectedDate(day);
                                    openModal(undefined, slot, ds);
                                  }
                                }}>
                                {slotAppts.map(appt => {
                                  const pac = pacientes.find(p => p.id === appt.pacienteId);
                                  const st  = STATUS_STYLE[appt.status];
                                  return (
                                    <div key={appt.id} onClick={e => { e.stopPropagation(); openModal(appt); }}
                                      style={{ fontSize: 10, fontWeight: 600, padding: '2px 5px', background: st.bg, borderLeft: `2px solid ${st.border}`, borderRadius: 4, marginBottom: 1, cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', color: st.color }}>
                                      {pac?.nome?.split(' ')[0] || '?'}
                                    </div>
                                  );
                                })}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* VISÃO MÊS */}
            {viewMode === 'mes' && (
              <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 6 }}>
                  {DAYS_PT.map(d => (
                    <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', padding: '4px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>{d}</div>
                  ))}
                </div>
                {(() => {
                  const first = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                  const last  = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                  const days: (Date|null)[] = Array(first.getDay()).fill(null);
                  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), d));
                  while (days.length % 7 !== 0) days.push(null);
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
                      {days.map((day, i) => {
                        if (!day) return <div key={i} />;
                        const ds      = formatDateISO(day);
                         const count   = filteredAgendamentos.filter(a => a.data === ds).length;
                        const isToday = ds === formatDateISO(new Date());
                        const isSel   = ds === dateStr;
                        return (
                          <div key={i} onClick={() => { setSelectedDate(day); setViewMode('dia'); }}
                            style={{ minHeight: 72, borderRadius: 10, border: `1px solid ${isSel ? 'var(--primary)' : 'var(--gray-100)'}`, background: isSel ? 'var(--mint)' : '#fff', padding: 6, cursor: 'pointer', transition: 'all .15s' }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: isToday ? 'var(--primary)' : 'transparent', color: isToday ? '#fff' : 'var(--gray-700)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                              {day.getDate()}
                            </div>
                            {count > 0 && (
                              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--primary)', background: 'var(--mint)', padding: '1px 5px', borderRadius: 10, display: 'inline-block' }}>
                                {count} consulta{count>1?'s':''}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}

        {/* ── ABA FILA DE ESPERA ── */}
        {activeTab === 'fila' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--dark)' }}>Fila de Espera</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>{dayLabelFull}</p>
              </div>
              <span style={{ background: waitAppts.length > 0 ? 'var(--primary)' : 'var(--gray-200)', color: waitAppts.length > 0 ? '#fff' : 'var(--gray-500)', fontSize: 13, fontWeight: 700, padding: '4px 14px', borderRadius: 20 }}>
                {waitAppts.length} aguardando
              </span>
            </div>

            {waitAppts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>
                <Users size={36} style={{ display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, fontWeight: 600 }}>Fila vazia!</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Nenhum paciente aguardando hoje.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
                {waitAppts.map((appt, idx) => {
                  const pac = pacientes.find(p => p.id === appt.pacienteId);
                  const tp  = TIPO_STYLE[appt.tipo];
                  return (
                    <div key={appt.id} style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 12, left: 12, width: 24, height: 24, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: 'var(--dark)' }}>
                        {idx+1}
                      </div>
                      <div style={{ paddingLeft: 32, marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>{pac?.nome || '—'}</div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, ...tp }}>{appt.tipo}</span>
                          <span style={{ fontSize: 11, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10}/> {appt.hora}</span>
                        </div>
                      </div>
                      {pac?.telefone && <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}><Phone size={11}/> {pac.telefone}</div>}
                      {pac?.email    && <div style={{ fontSize: 12, color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 10 }}><Mail size={11}/> {pac.email}</div>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleQuickUpdate(appt, 'confirmado')}
                          style={{ flex: 1, padding: '7px', background: 'var(--mint)', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, color: 'var(--dark)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <Check size={13}/> Confirmar
                        </button>
                        <button onClick={() => openModal(appt)} style={{ width: 32, height: 32, background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-600)' }}><Pencil size={13}/></button>
                        <button onClick={() => setConfirmDelete(appt.id)} style={{ width: 32, height: 32, background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red-500)' }}><Trash2 size={13}/></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Modal de Agendamento ─────────────────────────────────────────────── */}
      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 20, width: 'min(640px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>

            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-800)', margin: 0 }}>
                    {modal.mode === 'add' ? 'Novo Agendamento' : 'Editar Agendamento'}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '2px 0 0' }}>Preencha os dados do atendimento</p>
                </div>
                <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gray-100)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.5 : 1 }}>
                  <X size={15}/>
                </button>
              </div>
            </div>

            {/* Conteúdo scrollável */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(14px, 3vw, 24px)', minHeight: 0 }}>

              {/* Erro da API */}
              {apiError && (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', background: 'var(--red-50)', border: '1px solid var(--red-100)', borderRadius: 10, marginBottom: 16 }}>
                  <AlertCircle size={15} color="var(--red-500)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 13, color: 'var(--red-600)', fontWeight: 600 }}>{apiError}</span>
                </div>
              )}

              {/* Paciente */}
              <ModalSection label="Informações do paciente" icon={Users}>
                <div>
                  <label style={labelStyle}>Nome do paciente <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  {selectedPaciente ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--mint)', borderRadius: 10, border: '1px solid var(--light)' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                        {initials(selectedPaciente.nome)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)' }}>{selectedPaciente.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>CPF: {selectedPaciente.cpf || '—'} · {selectedPaciente.telefone || '—'}</div>
                      </div>
                      <button onClick={() => setField('pacienteId', '')} style={{ width: 24, height: 24, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-500)' }}><X size={13}/></button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }}/>
                        <input value={searchPaciente} onChange={e => setSearchPaciente(e.target.value)} placeholder="Insira o nome do paciente..."
                          style={{ width: '100%', padding: '10px 12px 10px 36px', border: `1px solid ${errors.paciente ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}/>
                      </div>
                      {errors.paciente && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.paciente}</span>}
                      {searchPaciente && filteredPacientes.length > 0 && (
                        <div style={{ border: '1px solid var(--gray-200)', borderRadius: 10, overflow: 'hidden', marginTop: 4, maxHeight: 180, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {filteredPacientes.slice(0,8).map(p => (
                            <button key={p.id} onClick={() => { setField('pacienteId', p.id); setSearchPaciente(''); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', width: '100%', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--gray-50)' }}
                              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--gray-50)'; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: 'var(--dark)', flexShrink: 0 }}>
                                {initials(p.nome)}
                              </div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{p.nome}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.cpf} · {p.convenio}</div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {selectedPaciente && (
                  <div style={responsiveGrid(140, 10)}>
                    <ReadField label="CPF"      value={selectedPaciente.cpf || '—'}      />
                    <ReadField label="Telefone" value={selectedPaciente.telefone || '—'} />
                    <ReadField label="Convênio" value={selectedPaciente.convenio}         />
                  </div>
                )}
              </ModalSection>

              {/* Atendimento */}
              <ModalSection label="Informações do atendimento" icon={CalendarCheck}>

                {/* Médico — só aparece para secretaria/gestão */}
                {!isMedico && (
                  <div>
                    <label style={labelStyle}>Médico responsável <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select
                      value={modal.data.medicoId || ''}
                      onChange={e => setModal(m => ({ ...m, data: { ...m.data, medicoId: e.target.value, hora: '' } }))}
                      style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.medico ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}
                    >
                      <option value="">Selecione o médico</option>
                      {doctors.map(doctor => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.full_name}{doctor.specialty ? ` — ${doctor.specialty}` : ''}{doctor.crm ? ` (CRM ${doctor.crm}/${doctor.crm_uf})` : ''}
                        </option>
                      ))}
                    </select>
                    {errors.medico && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.medico}</span>}
                    {doctors.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <AlertCircle size={11}/> Nenhum médico cadastrado na API.
                      </span>
                    )}
                  </div>
                )}

                {modalDoctorId && modal.data.data && (
                  <div style={{ border: '1px solid var(--gray-100)', borderRadius: 10, padding: 12, background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                          Agendamentos do médico
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>
                          {selectedDoctor?.full_name || user?.full_name || 'Médico selecionado'} · {modal.data.data}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 800, color: modalDoctorDayAppts.length ? 'var(--primary)' : 'var(--gray-400)' }}>
                        {modalDoctorDayAppts.length} cadastrado{modalDoctorDayAppts.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {modalDoctorDayAppts.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                        Nenhum agendamento cadastrado para este médico nesta data.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                        {modalDoctorDayAppts.map(appt => {
                          const pac = pacientes.find(p => p.id === appt.pacienteId);
                          const st = STATUS_STYLE[appt.status];
                          const isCurrent = appt.id === modal.data.id;
                          return (
                            <div key={appt.id} style={{ padding: '8px 10px', borderRadius: 8, background: isCurrent ? 'var(--mint)' : st.bg, borderLeft: `3px solid ${st.border}` }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-800)' }}>
                                {appt.hora} · {pac?.nome || 'Paciente'}
                              </div>
                              <div style={{ fontSize: 10, color: st.color, fontWeight: 700, marginTop: 2 }}>
                                {STATUS_LABEL[appt.status]}{isCurrent ? ' · edição atual' : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Data e Horário */}
                <div style={responsiveGrid(160)}>
                  <div>
                    <label style={labelStyle}>Data <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <input type="date" value={modal.data.data} onChange={e => setModal(m => ({ ...m, data: { ...m.data, data: e.target.value, hora: '' } }))}
                      style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.data ? 'var(--red-500)':'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}/>
                    {errors.data && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.data}</span>}
                  </div>
                  <div>
                    <label style={labelStyle}>
                      Horário <span style={{ color: 'var(--red-500)' }}>*</span>
                      {slotsLoading && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--gray-400)', fontWeight: 400, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> buscando horários...
                        </span>
                      )}
                      {!slotsLoading && slots.length > 0 && (
                        <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--primary)', fontWeight: 400 }}>
                          ({slots.length} disponíveis)
                        </span>
                      )}
                    </label>
                    <select value={modal.data.hora} onChange={e => setField('hora', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: `1px solid ${errors.hora ? 'var(--red-500)':'var(--gray-200)'}`, borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                      <option value="">{slotsLoading ? 'Carregando...' : '--:--'}</option>
                      {modalTimeSlots.map(h => {
                        const conflict = findScheduleConflict(h);
                        return (
                          <option key={h} value={h} disabled={Boolean(conflict)}>
                            {h}{conflict ? ` - ocupado (${conflict.hora})` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {errors.hora && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.hora}</span>}
                    {!slotsLoading && slots.length === 0 && modal.data.medicoId && modal.data.data && (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)', display: 'block', marginTop: 3 }}>
                        Exibindo todos os horários (médico sem disponibilidade cadastrada).
                      </span>
                    )}
                  </div>
                </div>

                {/* Tipo, Duração e Status */}
                <div style={responsiveGrid(150)}>
                  <div>
                    <label style={labelStyle}>Tipo de consulta <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select value={modal.data.tipo} onChange={e => setField('tipo', e.target.value as TipoConsulta)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                      {TIPOS.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Duração</label>
                    <select value={modal.data.duracao} onChange={e => setField('duracao', e.target.value)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                      {DURACOES.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Status</label>
                    <select value={modal.data.status} onChange={e => setField('status', e.target.value as StatusAgendamento)}
                      style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}>
                      {STATUS_LIST.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                </div>

                {/* Observações (notes → API) */}
                <div>
                  <label style={labelStyle}>Observações / Motivo da consulta</label>
                  <textarea value={modal.data.observacoes || ''} onChange={e => setField('observacoes', e.target.value)}
                    placeholder="Descreva o motivo da consulta, orientações especiais, histórico relevante..."
                    rows={3}
                    style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}/>
                </div>
              </ModalSection>

              {/* Confirmação */}
              <ModalSection label="Enviar confirmação" icon={Mail}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <ToggleOpt icon={Mail}  label="Confirmar por E-mail"   value={modal.data.enviarEmail}    onChange={v => setField('enviarEmail', v)}    disabled={!selectedPaciente?.email} />
                  <ToggleOpt icon={Phone} label="Confirmar por WhatsApp" value={modal.data.enviarWhatsapp} onChange={v => setField('enviarWhatsapp', v)} disabled={!selectedPaciente?.telefone} />
                </div>
                {!selectedPaciente && <p style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Selecione um paciente para habilitar o envio de confirmação.</p>}
              </ModalSection>
            </div>

            {/* Rodapé */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--gray-50)', flexShrink: 0, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gray-400)' }}>
                <MoreHorizontal size={14}/> Bloqueio de Agenda
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={closeModal} disabled={saving}
                  style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', color: 'var(--gray-700)', opacity: saving ? 0.5 : 1 }}>
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: '9px 24px', background: savedFeedback ? '#16a34a' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'background .2s', boxShadow: '0 2px 8px rgba(58,170,53,0.3)', opacity: saving ? 0.8 : 1 }}>
                  {saving
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }}/> Salvando...</>
                    : savedFeedback
                    ? <><Check size={14}/> Salvo!</>
                    : <><CalendarCheck size={14}/> Salvar alterações</>
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Confirm Delete ── */}
      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--red-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <AlertCircle size={22} color="var(--red-500)"/>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 8 }}>Excluir agendamento?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 20 }}>Esta ação não pode ser desfeita. O registro será removido permanentemente.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function ApptBtn({ icon: Icon, color, onClick }: { icon: React.ElementType; color: string; onClick: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onClick(); }}
      style={{ width: 26, height: 26, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color, transition: 'background .15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; }}>
      <Icon size={13}/>
    </button>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--gray-600)',
  textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5,
};

function ModalSection({ label, icon: Icon, children }: { label: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 8, borderBottom: '2px solid var(--mint)' }}>
        {Icon && <div style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={13} color="var(--primary)"/></div>}
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--dark)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', padding: '7px 10px', background: 'var(--gray-50)', borderRadius: 7, border: '1px solid var(--gray-100)' }}>{value}</div>
    </div>
  );
}

function ToggleOpt({ icon: Icon, label, value, onChange, disabled }: { icon: React.ElementType; label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button onClick={() => !disabled && onChange(!value)}
      style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `1px solid ${value && !disabled ? 'var(--primary)' : 'var(--gray-200)'}`, background: value && !disabled ? 'var(--mint)' : 'var(--gray-50)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'all .15s' }}>
      <Icon size={15} color={value && !disabled ? 'var(--primary)' : 'var(--gray-400)'}/>
      <span style={{ fontSize: 12, fontWeight: 600, color: value && !disabled ? 'var(--dark)' : 'var(--gray-500)' }}>{label}</span>
      <div style={{ marginLeft: 'auto', width: 32, height: 17, borderRadius: 9, background: value && !disabled ? 'var(--primary)' : 'var(--gray-300)', position: 'relative', transition: 'background .2s' }}>
        <div style={{ width: 13, height: 13, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: value ? 17 : 2, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}/>
      </div>
    </button>
  );
}
