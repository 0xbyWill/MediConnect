import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle, Calendar, CalendarCheck, Clock, Loader2, Mail, MapPin,
  Pencil, Phone, Plus, Search, Trash2, Users, X,
} from 'lucide-react';
import type { Agendamento, Paciente, TipoConsulta } from '../types';
import { availabilityApi } from '../lib/api';
import type { ApiDoctor, ApiDoctorAvailability, DoctorAppointmentType } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';
import { initials } from '../shared/utils/text';

const TIPOS: TipoConsulta[] = ['Primeira Consulta', 'Retorno', 'Check-up', 'Urgência'];
const SLOT_STEP_MINUTES = 30;
const WEEKDAYS = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
] as const;
const SLOT_MINUTE_OPTIONS = [30, 60, 90, 120] as const;

type FormData = Omit<Agendamento, 'id' | 'duracao'> & { id?: string };
type AvailabilityForm = {
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  appointment_type: DoctorAppointmentType;
  active: boolean;
};

interface AgendaProps {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  doctors?: ApiDoctor[];
  onAdd: (a: Omit<Agendamento, 'id'>) => Promise<void>;
  onUpdate: (a: Agendamento) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialOpen?: boolean;
  readOnly?: boolean;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return dateToISO(d);
}

function startOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDateBR(iso: string) {
  if (!iso) return 'Sem data';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function normalizeTime(value?: string | null) {
  return value?.slice(0, 5) ?? '';
}

function timeToMinutes(value: string) {
  const [hour, minute] = normalizeTime(value).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function buildTimeSlotsFromAvailability(availabilities: ApiDoctorAvailability[]) {
  return Array.from(new Set(
    availabilities.flatMap(availability => {
      const start = timeToMinutes(availability.start_time);
      const end = timeToMinutes(availability.end_time);
      if (start === null || end === null || end <= start) return [];
      const step = Math.max(SLOT_STEP_MINUTES, availability.slot_minutes || SLOT_STEP_MINUTES);
      const slots: string[] = [];
      for (let current = start; current < end; current += step) {
        slots.push(minutesToTime(current));
      }
      return slots;
    })
  )).sort();
}

function emptyForm(date = dateToISO(new Date())): FormData {
  return {
    pacienteId: '',
    medicoId: '',
    data: date,
    hora: '',
    tipo: 'Primeira Consulta',
    status: 'pendente',
    observacoes: '',
    enviarEmail: true,
    enviarWhatsapp: true,
  };
}

function emptyAvailabilityForm(doctorId = ''): AvailabilityForm {
  return {
    doctor_id: doctorId,
    weekday: 1,
    start_time: '08:00',
    end_time: '18:00',
    slot_minutes: SLOT_STEP_MINUTES,
    appointment_type: 'presencial',
    active: true,
  };
}

function byChronology(a: Agendamento, b: Agendamento) {
  return `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`);
}

const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  display: 'block',
  marginBottom: 5,
};

const STATUS_LABEL: Record<Agendamento['status'], { label: string; bg: string; color: string }> = {
  confirmado: { label: 'Confirmada', bg: 'var(--mint)', color: 'var(--dark)' },
  pendente: { label: 'Pendente', bg: 'var(--amber-100)', color: 'var(--amber-600)' },
  cancelado: { label: 'Cancelada', bg: 'var(--red-100)', color: 'var(--red-600)' },
  realizado: { label: 'Realizada', bg: '#ede9fe', color: '#5b21b6' },
};

export default function Agenda({ agendamentos, pacientes, doctors = [], onAdd, onUpdate, onDelete, initialOpen, readOnly = false }: AgendaProps) {
  const { user } = useAuth();
  const isMedico = user?.role === 'medico';
  const isPaciente = user?.role === 'paciente' || readOnly;
  const today = dateToISO(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes' | 'todos'>('semana');
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [statusFilter, setStatusFilter] = useState<Agendamento['status'] | ''>('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: FormData }>({
    open: false,
    mode: 'add',
    data: emptyForm(today),
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [availability, setAvailability] = useState<ApiDoctorAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityModal, setAvailabilityModal] = useState<{ open: boolean; data: AvailabilityForm }>({
    open: false,
    data: emptyAvailabilityForm(),
  });
  const [availabilityFormErrors, setAvailabilityFormErrors] = useState<Record<string, string>>({});
  const [availabilitySaveError, setAvailabilitySaveError] = useState('');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);

  const openModal = useCallback((appt?: Agendamento, dateOverride = selectedDate, timeOverride = '') => {
    if (isPaciente) return;
    setErrors({});
    setApiError('');
    if (appt) {
      setModal({
        open: true,
        mode: 'edit',
        data: {
          id: appt.id,
          pacienteId: appt.pacienteId,
          medicoId: appt.medicoId || '',
          data: appt.data,
          hora: appt.hora,
          tipo: appt.tipo,
          status: appt.status,
          observacoes: appt.observacoes || '',
          enviarEmail: false,
          enviarWhatsapp: false,
        },
      });
      setPatientSearch('');
      return;
    }
    setModal({ open: true, mode: 'add', data: { ...emptyForm(dateOverride), medicoId: filterDoctorId, hora: timeOverride } });
    setPatientSearch('');
  }, [filterDoctorId, isPaciente, selectedDate]);

  useEffect(() => {
    if (initialOpen && !isPaciente) openModal();
  }, [initialOpen, isPaciente, openModal]);

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, mode: 'add', data: emptyForm(selectedDate) });
    setErrors({});
    setApiError('');
  };

  const openAvailabilityModal = () => {
    if (isPaciente) return;
    const doctorId = isMedico ? user?.doctor_id || '' : filterDoctorId;
    setAvailabilityModal({ open: true, data: emptyAvailabilityForm(doctorId) });
    setAvailabilityFormErrors({});
    setAvailabilitySaveError('');
  };

  const closeAvailabilityModal = () => {
    if (availabilitySaving) return;
    setAvailabilityModal({ open: false, data: emptyAvailabilityForm() });
    setAvailabilityFormErrors({});
    setAvailabilitySaveError('');
  };

  const setField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  const setAvailabilityField = <K extends keyof AvailabilityForm>(field: K, value: AvailabilityForm[K]) => {
    setAvailabilityModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  const activeDoctorId = isMedico ? user?.doctor_id || '' : filterDoctorId;
  const selectedPatient = pacientes.find(p => p.id === modal.data.pacienteId);
  const patientOptions = pacientes.filter(p => {
    const q = patientSearch.toLowerCase().trim();
    return !q || p.nome.toLowerCase().includes(q) || p.cpf.includes(q);
  });

  const periodStart = period === 'semana'
    ? startOfWeek(new Date(`${selectedDate}T00:00:00`))
    : period === 'mes'
    ? startOfMonth(new Date(`${selectedDate}T00:00:00`))
    : selectedDate;

  const filteredAppointments = agendamentos
    .filter(a => {
      const patient = pacientes.find(p => p.id === a.pacienteId);
      const q = filterPatient.toLowerCase().trim();
      const matchDoctor = !activeDoctorId || a.medicoId === activeDoctorId;
      const matchPatient = !q || patient?.nome.toLowerCase().includes(q) || patient?.cpf.includes(q);
      const matchStatus = !statusFilter || a.status === statusFilter;
      const matchPeriod =
        period === 'todos' ||
        (period === 'dia' && a.data === selectedDate) ||
        (period === 'semana' && a.data >= periodStart && a.data <= dateToISO(new Date(new Date(`${periodStart}T00:00:00`).getTime() + 6 * 86400000))) ||
        (period === 'mes' && a.data.slice(0, 7) === selectedDate.slice(0, 7));
      return matchDoctor && matchPatient && matchPeriod && matchStatus;
    })
    .sort(byChronology);

  const scheduledToday = agendamentos.filter(a => a.data === today).length;
  const uniquePatients = new Set(filteredAppointments.map(a => a.pacienteId)).size;
  const busiestHour = Object.entries(
    filteredAppointments.reduce<Record<string, number>>((acc, a) => {
      const hour = a.hora.slice(0, 2);
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  const selectedDateObject = new Date(`${selectedDate}T00:00:00`);
  const calendarWeekStart = startOfWeek(selectedDateObject);
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${calendarWeekStart}T00:00:00`);
    date.setDate(date.getDate() + index);
    const iso = dateToISO(date);
    const shortLabels = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sab.'];
    return {
      iso,
      label: shortLabels[date.getDay()],
      dayMonth: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      isToday: iso === today,
    };
  });
  const calendarDays = period === 'dia' ? weekDays.filter(day => day.iso === selectedDate) : weekDays;
  const calendarStartMinutes = 7 * 60;
  const calendarEndMinutes = 19 * 60;
  const calendarSlots = Array.from(
    { length: Math.floor((calendarEndMinutes - calendarStartMinutes) / SLOT_STEP_MINUTES) + 1 },
    (_, index) => minutesToTime(calendarStartMinutes + index * SLOT_STEP_MINUTES)
  );
  const calendarAppointments = filteredAppointments.filter(a => calendarDays.some(day => day.iso === a.data));
  const activeDoctors = doctors.filter(doctor => !activeDoctorId || doctor.id === activeDoctorId);
  const doctorSidebarItems = isMedico
    ? doctors.filter(doctor => doctor.id === user?.doctor_id)
    : doctors;
  const weekRangeLabel = `${formatDateBR(weekDays[0].iso)} - ${formatDateBR(weekDays[6].iso)}`;

  const modalDoctorId = isMedico ? user?.doctor_id || '' : modal.data.medicoId || '';
  const modalWeekday = modal.data.data ? new Date(`${modal.data.data}T00:00:00`).getDay() : undefined;
  const availableTimeSlots = buildTimeSlotsFromAvailability(availability);

  useEffect(() => {
    if (!modal.open || !modalDoctorId || !modal.data.data || modalWeekday === undefined) {
      setAvailability([]);
      setAvailabilityLoading(false);
      setAvailabilityError('');
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    void availabilityApi
      .list({ doctor_id: modalDoctorId, weekday: modalWeekday, active: true })
      .then(rows => {
        if (cancelled) return;
        setAvailability(rows);
      })
      .catch(err => {
        if (cancelled) return;
        setAvailability([]);
        setAvailabilityError(err instanceof Error ? err.message : 'Erro ao carregar disponibilidade do médico.');
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modal.data.data, modal.open, modalDoctorId, modalWeekday]);

  const dayConflicts = agendamentos.filter(a =>
    a.medicoId === modalDoctorId &&
    a.data === modal.data.data &&
    a.id !== modal.data.id
  );

  const validateAvailability = () => {
    const data = availabilityModal.data;
    const nextErrors: Record<string, string> = {};
    const start = timeToMinutes(data.start_time);
    const end = timeToMinutes(data.end_time);

    if (!data.doctor_id) nextErrors.doctor_id = isMedico ? 'Seu perfil médico não está vinculado.' : 'Selecione um médico.';
    if (data.weekday < 0 || data.weekday > 6) nextErrors.weekday = 'Selecione um dia da semana.';
    if (start === null) nextErrors.start_time = 'Informe o horário inicial.';
    if (end === null) nextErrors.end_time = 'Informe o horário final.';
    if (start !== null && end !== null && start >= end) nextErrors.end_time = 'O término deve ser depois do início.';
    if (!SLOT_MINUTE_OPTIONS.includes(data.slot_minutes as (typeof SLOT_MINUTE_OPTIONS)[number])) {
      nextErrors.slot_minutes = 'Selecione uma duração válida.';
    }
    if (data.appointment_type !== 'presencial' && data.appointment_type !== 'telemedicina') {
      nextErrors.appointment_type = 'Selecione o tipo de atendimento.';
    }

    return nextErrors;
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!modal.data.pacienteId) nextErrors.paciente = 'Selecione um paciente do banco.';
    if (!modal.data.data) nextErrors.data = 'Informe a data da consulta.';
    if (modal.data.data && modal.data.data < today) nextErrors.data = 'A consulta não pode ser agendada para data anterior a hoje.';
    if (!modal.data.hora) nextErrors.hora = 'Informe o horário.';
    if (!isMedico && !modal.data.medicoId) nextErrors.medico = 'Selecione um médico.';
    if (modalDoctorId && modal.data.data && !availabilityLoading && !availabilityError && availableTimeSlots.length === 0) {
      nextErrors.hora = 'Este médico não possui disponibilidade ativa para esta data.';
    }
    if (modal.data.hora && availableTimeSlots.length > 0 && !availableTimeSlots.includes(modal.data.hora)) {
      nextErrors.hora = 'Selecione um horário dentro da disponibilidade do médico.';
    }
    if (modal.data.hora && dayConflicts.some(a => a.hora === modal.data.hora)) {
      nextErrors.hora = 'Este médico já possui consulta neste horário.';
    }
    return nextErrors;
  };

  const handleSaveAvailability = async () => {
    if (isPaciente) return;
    const nextErrors = validateAvailability();
    if (Object.keys(nextErrors).length) {
      setAvailabilityFormErrors(nextErrors);
      return;
    }

    setAvailabilitySaving(true);
    setAvailabilitySaveError('');
    try {
      const created = await availabilityApi.create({
        doctor_id: availabilityModal.data.doctor_id,
        weekday: availabilityModal.data.weekday,
        start_time: normalizeTime(availabilityModal.data.start_time),
        end_time: normalizeTime(availabilityModal.data.end_time),
        slot_minutes: availabilityModal.data.slot_minutes,
        appointment_type: availabilityModal.data.appointment_type,
        active: availabilityModal.data.active,
      });

      if (
        modal.open &&
        created.active !== false &&
        created.doctor_id === modalDoctorId &&
        created.weekday === modalWeekday
      ) {
        setAvailability(current => [...current.filter(item => item.id !== created.id), created]);
      }

      closeAvailabilityModal();
    } catch (err) {
      setAvailabilitySaveError(err instanceof Error ? err.message : 'Erro ao salvar disponibilidade.');
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleSave = async () => {
    if (isPaciente) return;
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setApiError('');
    try {
      const payload: Omit<Agendamento, 'id'> = {
        pacienteId: modal.data.pacienteId,
        medicoId: modalDoctorId,
        data: modal.data.data,
        hora: modal.data.hora,
        tipo: modal.data.tipo,
        observacoes: modal.data.observacoes,
        enviarEmail: modal.data.enviarEmail,
        enviarWhatsapp: modal.data.enviarWhatsapp,
        status: modal.data.status ?? 'pendente',
        duracao: '30 min',
      };

      if (modal.mode === 'add') await onAdd(payload);
      else await onUpdate({ ...payload, id: modal.data.id! });
      closeModal();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isPaciente) return;
    if (!confirmDelete) return;
    try {
      await onDelete(confirmDelete);
      setConfirmDelete(null);
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Erro ao excluir agendamento.');
      setConfirmDelete(null);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--background)', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: '#fff', borderBottom: '1px solid var(--gray-100)', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)', margin: 0 }}>Agenda</h1>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 3 }}>
              {isPaciente ? 'Acompanhe suas consultas agendadas e anteriores.' : 'Consultas organizadas por data, horário e paciente cadastrado.'}
            </p>
          </div>
          {!isPaciente && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <button onClick={openAvailabilityModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: '#fff', color: 'var(--primary)', border: '1px solid var(--light)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <Clock size={16} /> Disponibilidade
              </button>
              {!isMedico && (
                <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  <Plus size={16} /> Agendar
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
          <Metric label="Consultas filtradas" value={filteredAppointments.length} icon={CalendarCheck} />
          <Metric label="Hoje" value={scheduledToday} icon={Clock} />
          <Metric label="Pacientes no período" value={uniquePatients} icon={Users} />
          <Metric label="Horário de pico" value={busiestHour ? `${busiestHour[0]}h` : '—'} icon={Calendar} />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {!isMedico && (
            <div>
              <label htmlFor="agenda-doctor-filter" style={labelStyle}>Agenda</label>
              <select id="agenda-doctor-filter" value={filterDoctorId} onChange={e => setFilterDoctorId(e.target.value)}
              style={{ minWidth: 220, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
              <option value="">Todos os médicos</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}</option>)}
              </select>
            </div>
          )}
          <div>
            <label htmlFor="agenda-date-filter" style={labelStyle}>Data base</label>
            <input id="agenda-date-filter" type="date" value={selectedDate} min={today} onChange={e => setSelectedDate(e.target.value)}
              style={{ padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
          </div>
          <div>
            <label htmlFor="agenda-period-filter" style={labelStyle}>Visualizacao</label>
            <select id="agenda-period-filter" value={period} onChange={e => setPeriod(e.target.value as typeof period)}
            style={{ padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
            <option value="dia">Dia</option>
            <option value="semana">Semana</option>
            <option value="mes">Mês</option>
            <option value="todos">Todos</option>
            </select>
          </div>
          <div>
            <label htmlFor="agenda-status-filter" style={labelStyle}>Status</label>
            <select id="agenda-status-filter" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Agendamento['status'] | '')}
              style={{ minWidth: 160, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="confirmado">Confirmada</option>
              <option value="realizado">Realizada</option>
              <option value="cancelado">Cancelada</option>
            </select>
          </div>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <label htmlFor="agenda-patient-filter" style={labelStyle}>Paciente</label>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 32, color: 'var(--gray-400)' }} />
            <input id="agenda-patient-filter" value={filterPatient} onChange={e => setFilterPatient(e.target.value)} placeholder="Filtrar por paciente ou CPF..."
              style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={15} /> {apiError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 260px) minmax(720px, 1fr)', gap: 14, alignItems: 'start' }}>
          <aside style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: 14, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Agendas</h2>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '2px 0 0' }}>{activeDoctors.length || doctors.length} medico(s)</p>
              </div>
              {!isMedico && (
                <button type="button" onClick={() => setFilterDoctorId('')} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                  Todas
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 'calc(100dvh - 310px)', overflow: 'auto' }}>
              {doctorSidebarItems.map(doctor => {
                const selected = !filterDoctorId || filterDoctorId === doctor.id || isMedico;
                const count = filteredAppointments.filter(appt => appt.medicoId === doctor.id).length;
                return (
                  <button key={doctor.id} type="button" onClick={() => !isMedico && setFilterDoctorId(filterDoctorId === doctor.id ? '' : doctor.id)}
                    style={{ width: '100%', textAlign: 'left', border: `1px solid ${selected ? 'var(--light)' : 'var(--gray-100)'}`, background: selected ? '#f8f7ff' : '#fff', borderRadius: 12, padding: 10, display: 'flex', gap: 9, alignItems: 'center', cursor: isMedico ? 'default' : 'pointer' }}>
                    <span style={{ width: 18, height: 18, borderRadius: 6, background: selected ? 'var(--primary)' : 'var(--gray-100)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900 }}>
                      {selected ? 'x' : ''}
                    </span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span title={doctor.full_name} style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doctor.full_name}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{doctor.specialty || 'Clinica geral'}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>{count}</span>
                  </button>
                );
              })}
              {doctorSidebarItems.length === 0 && (
                <div style={{ border: '1px dashed var(--gray-200)', borderRadius: 12, padding: 14, color: 'var(--gray-500)', fontSize: 12, lineHeight: 1.5 }}>
                  Nenhum medico disponivel para listar.
                </div>
              )}
            </div>
          </aside>

          <section style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>{period === 'dia' ? formatDateBR(selectedDate) : weekRangeLabel}</div>
                <h2 style={{ fontSize: 16, color: 'var(--gray-800)', fontWeight: 850, margin: '2px 0 0' }}>Calendario de atendimentos</h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setSelectedDate(today)} style={{ border: '1px solid var(--gray-200)', background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: 'var(--gray-700)', cursor: 'pointer' }}>
                  Hoje
                </button>
                {!isPaciente && (
                  <button type="button" onClick={() => openModal(undefined, selectedDate)} style={{ border: 'none', background: 'var(--primary)', color: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Plus size={14} /> Agendar
                  </button>
                )}
              </div>
            </div>

            <div style={{ overflow: 'auto' }}>
              <div style={{ minWidth: period === 'dia' ? 420 : 980, display: 'grid', gridTemplateColumns: `58px repeat(${calendarDays.length}, minmax(${period === 'dia' ? 300 : 126}px, 1fr))` }}>
                <div style={{ position: 'sticky', left: 0, zIndex: 3, background: '#f8fafc', borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)' }} />
                {calendarDays.map(day => (
                  <div key={day.iso} style={{ minHeight: 50, padding: '8px 10px', textAlign: 'center', background: day.isToday ? '#f0fdf4' : '#f8fafc', borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)' }}>{day.label}</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: day.isToday ? 'var(--primary)' : 'var(--gray-800)', marginTop: 2 }}>{day.dayMonth}</div>
                  </div>
                ))}

                {calendarSlots.map(slot => (
                  <React.Fragment key={slot}>
                    <div style={{ position: 'sticky', left: 0, zIndex: 2, minHeight: 74, padding: '8px 6px', textAlign: 'right', background: '#fbfdff', color: 'var(--gray-500)', fontSize: 11, fontWeight: 800, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)' }}>
                      {slot}
                    </div>
                    {calendarDays.map(day => {
                      const slotItems = calendarAppointments.filter(appt => appt.data === day.iso && normalizeTime(appt.hora) === slot);
                      return (
                        <div key={`${day.iso}-${slot}`} onDoubleClick={() => !isPaciente && openModal(undefined, day.iso, slot)}
                          style={{ minHeight: 74, padding: 5, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)', background: day.isToday ? '#fcfffd' : '#fff', cursor: isPaciente ? 'default' : 'cell' }}>
                          {slotItems.map(appt => {
                            const patient = pacientes.find(p => p.id === appt.pacienteId);
                            const doctor = doctors.find(d => d.id === appt.medicoId);
                            return (
                              <button key={appt.id} type="button" onClick={() => !isPaciente && openModal(appt)}
                                style={{ width: '100%', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 10, padding: 8, marginBottom: 5, textAlign: 'left', boxShadow: '0 6px 14px rgba(245, 158, 11, 0.12)', cursor: isPaciente ? 'default' : 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 999, background: '#f59e0b', flexShrink: 0 }} />
                                  <span title={patient?.nome || ''} style={{ fontSize: 12, fontWeight: 900, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient?.nome || 'Paciente nao encontrado'}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--gray-600)', fontWeight: 700, marginTop: 5 }}>{appt.hora} - {appt.duracao || '30 min'}</div>
                                <div title={doctor?.full_name || ''} style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doctor?.full_name || user?.full_name || 'Medico nao informado'}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.tipo}</span>
                                  <StatusBadge status={appt.status} />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>

            {calendarAppointments.length === 0 && (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--gray-400)', borderTop: '1px solid var(--gray-100)' }}>
                <Calendar size={30} style={{ display: 'block', margin: '0 auto 8px' }} />
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-600)' }}>Nenhuma consulta neste recorte</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{isPaciente ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerao aqui.' : 'Use os filtros, escolha outra data ou crie um novo agendamento.'}</div>
              </div>
            )}
          </section>
        </div>

        <div style={{ display: 'none', background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
          <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '24%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '8%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)' }}>
                {['Data', 'Paciente', 'Médico', 'Tipo', 'Observações', isPaciente ? 'Status' : 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map(appt => {
                const patient = pacientes.find(p => p.id === appt.pacienteId);
                const doctor = doctors.find(d => d.id === appt.medicoId);
                return (
                  <tr key={appt.id} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                    <td style={tdStyle}>
                      <div style={{ fontWeight: 800, color: 'var(--gray-800)' }}>{formatDateBR(appt.data)}</div>
                      <div style={{ fontSize: 12, color: 'var(--primary)', marginTop: 2 }}>{appt.hora}</div>
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--mint)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flexShrink: 0 }}>
                          {initials(patient?.nome || 'Paciente')}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div title={patient?.nome || ''} style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient?.nome || 'Paciente não encontrado'}</div>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 1 }}>{patient?.cpf || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tdStyle}>{doctor?.full_name || (isMedico ? user?.full_name : '—')}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: 'var(--mint)', color: 'var(--dark)' }}>{appt.tipo}</span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--gray-500)' }}>{appt.observacoes || '—'}</td>
                    <td style={tdStyle}>
                      {isPaciente ? (
                        <StatusBadge status={appt.status} />
                      ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <IconButton title="Editar" icon={Pencil} color="var(--amber-600)" onClick={() => openModal(appt)} />
                        <IconButton title="Excluir" icon={Trash2} color="var(--red-500)" onClick={() => setConfirmDelete(appt.id)} />
                      </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filteredAppointments.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: '54px 24px', textAlign: 'center', color: 'var(--gray-400)' }}>
                    <Calendar size={32} style={{ display: 'block', margin: '0 auto 10px' }} />
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-600)' }}>Nenhuma consulta encontrada</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>{isPaciente ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerao aqui.' : 'Ajuste os filtros ou crie um novo agendamento.'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(760px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>{modal.mode === 'add' ? 'Novo Agendamento' : 'Editar Agendamento'}</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Paciente e horário serão salvos usando dados reais da API.</p>
              </div>
              <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: saving ? 'not-allowed' : 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
              {apiError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {apiError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="agenda-paciente-search" style={labelStyle}>Paciente <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  {selectedPatient ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--light)', borderRadius: 10, background: 'var(--mint)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{initials(selectedPatient.nome)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)' }}>{selectedPatient.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{selectedPatient.cpf || '—'} · {selectedPatient.telefone || '—'}</div>
                      </div>
                      <button onClick={() => setField('pacienteId', '')} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><X size={13} /></button>
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
                        <input id="agenda-paciente-search" value={patientSearch} onChange={e => setPatientSearch(e.target.value)} placeholder="Pesquisar paciente no banco..."
                          style={{ width: '100%', padding: '10px 12px 10px 34px', border: `1px solid ${errors.paciente ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)', outline: 'none' }} />
                      </div>
                      {patientSearch && (
                        <div style={{ marginTop: 5, maxHeight: 190, overflow: 'auto', border: '1px solid var(--gray-100)', borderRadius: 10, background: '#fff', boxShadow: '0 6px 18px rgba(0,0,0,0.08)' }}>
                          {patientOptions.slice(0, 10).map(p => (
                            <button key={p.id} onClick={() => { setField('pacienteId', p.id); setPatientSearch(''); }}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: 'none', background: '#fff', borderBottom: '1px solid var(--gray-50)', textAlign: 'left', cursor: 'pointer' }}>
                              <div style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--mint)', color: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800 }}>{initials(p.nome)}</div>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{p.nome}</div>
                                <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{p.cpf || '—'} · {p.convenio}</div>
                              </div>
                            </button>
                          ))}
                          {patientOptions.length === 0 && <div style={{ padding: 14, fontSize: 12, color: 'var(--gray-400)' }}>Nenhum paciente encontrado.</div>}
                        </div>
                      )}
                    </>
                  )}
                  {errors.paciente && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.paciente}</span>}
                </div>

                {!isMedico && (
                  <div>
                    <label htmlFor="agenda-medico" style={labelStyle}>Médico <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select id="agenda-medico" value={modal.data.medicoId || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, medicoId: e.target.value, hora: '' } }))}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.medico ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                      <option value="">Selecione o médico</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}</option>)}
                    </select>
                    {errors.medico && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.medico}</span>}
                  </div>
                )}

                <div>
                  <label htmlFor="agenda-data" style={labelStyle}>Data <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <input id="agenda-data" type="date" min={today} value={modal.data.data} onChange={e => setModal(m => ({ ...m, data: { ...m.data, data: e.target.value, hora: '' } }))}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.data ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }} />
                  {errors.data && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.data}</span>}
                </div>

                <div>
                  <label htmlFor="agenda-hora" style={labelStyle}>Horário <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <select id="agenda-hora" value={modal.data.hora} onChange={e => setField('hora', e.target.value)}
                    disabled={!modalDoctorId || !modal.data.data || availabilityLoading || Boolean(availabilityError) || availableTimeSlots.length === 0}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.hora ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    <option value="">
                      {!modalDoctorId ? 'Selecione o médico' : availabilityLoading ? 'Carregando disponibilidade...' : availableTimeSlots.length === 0 ? 'Sem disponibilidade ativa' : 'Selecione'}
                    </option>
                    {availableTimeSlots.map(slot => (
                      <option key={slot} value={slot} disabled={dayConflicts.some(a => a.hora === slot)}>
                        {slot}{dayConflicts.some(a => a.hora === slot) ? ' - ocupado' : ''}
                      </option>
                    ))}
                  </select>
                  {errors.hora && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.hora}</span>}
                  {!errors.hora && availabilityError && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityError}</span>}
                  {!errors.hora && !availabilityError && modalDoctorId && modal.data.data && !availabilityLoading && availableTimeSlots.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Este médico não possui disponibilidade ativa para este dia.</span>
                  )}
                  {!errors.hora && !availabilityError && availableTimeSlots.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Horários exibidos de 30 em 30 minutos conforme disponibilidade do médico.</span>
                  )}
                </div>

                <div>
                  <label style={labelStyle}>Tipo de consulta</label>
                  <select value={modal.data.tipo} onChange={e => setField('tipo', e.target.value as TipoConsulta)}
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    {TIPOS.map(tipo => <option key={tipo}>{tipo}</option>)}
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Observações</label>
                  <textarea value={modal.data.observacoes || ''} onChange={e => setField('observacoes', e.target.value)} rows={4}
                    placeholder="Motivo da consulta, orientações e informações importantes..."
                    style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                {selectedPatient && (
                  <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                    <InfoPill icon={Phone} label="Telefone" value={selectedPatient.telefone || '—'} />
                    <InfoPill icon={Mail} label="E-mail" value={selectedPatient.email || '—'} />
                    <InfoPill icon={MapPin} label="Cidade" value={selectedPatient.cidade || '—'} />
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={closeModal} disabled={saving} style={{ padding: '9px 20px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: '9px 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {saving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><CalendarCheck size={14} /> Salvar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {availabilityModal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(620px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Criar disponibilidade</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Os horários da agenda serão montados a partir da disponibilidade ativa do médico.</p>
              </div>
              <button onClick={closeAvailabilityModal} disabled={availabilitySaving} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: availabilitySaving ? 'not-allowed' : 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
              {availabilitySaveError && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {availabilitySaveError}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {!isMedico ? (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="availability-doctor" style={labelStyle}>Médico <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select id="availability-doctor" value={availabilityModal.data.doctor_id} onChange={e => setAvailabilityField('doctor_id', e.target.value)}
                      disabled={availabilitySaving}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.doctor_id ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                      <option value="">Selecione o médico</option>
                      {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}</option>)}
                    </select>
                    {availabilityFormErrors.doctor_id && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.doctor_id}</span>}
                  </div>
                ) : (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>Médico</label>
                    <div style={{ padding: '10px 12px', border: `1px solid ${availabilityFormErrors.doctor_id ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)', color: 'var(--gray-700)', fontWeight: 700 }}>
                      {user?.full_name || 'Perfil médico'}
                    </div>
                    {availabilityFormErrors.doctor_id && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.doctor_id}</span>}
                  </div>
                )}

                <div>
                  <label htmlFor="availability-weekday" style={labelStyle}>Dia da semana <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <select id="availability-weekday" value={availabilityModal.data.weekday} onChange={e => setAvailabilityField('weekday', Number(e.target.value))}
                    disabled={availabilitySaving}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.weekday ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    {WEEKDAYS.map(day => <option key={day.value} value={day.value}>{day.label}</option>)}
                  </select>
                  {availabilityFormErrors.weekday && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.weekday}</span>}
                </div>

                <div>
                  <label htmlFor="availability-type" style={labelStyle}>Tipo <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <select id="availability-type" value={availabilityModal.data.appointment_type} onChange={e => setAvailabilityField('appointment_type', e.target.value as DoctorAppointmentType)}
                    disabled={availabilitySaving}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.appointment_type ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    <option value="presencial">Presencial</option>
                    <option value="telemedicina">Telemedicina</option>
                  </select>
                  {availabilityFormErrors.appointment_type && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.appointment_type}</span>}
                </div>

                <div>
                  <label htmlFor="availability-start" style={labelStyle}>Início <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <input id="availability-start" type="time" step={SLOT_STEP_MINUTES * 60} value={availabilityModal.data.start_time} onChange={e => setAvailabilityField('start_time', e.target.value)}
                    disabled={availabilitySaving}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.start_time ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }} />
                  {availabilityFormErrors.start_time && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.start_time}</span>}
                </div>

                <div>
                  <label htmlFor="availability-end" style={labelStyle}>Término <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <input id="availability-end" type="time" step={SLOT_STEP_MINUTES * 60} value={availabilityModal.data.end_time} onChange={e => setAvailabilityField('end_time', e.target.value)}
                    disabled={availabilitySaving}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.end_time ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }} />
                  {availabilityFormErrors.end_time && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.end_time}</span>}
                </div>

                <div>
                  <label htmlFor="availability-slot" style={labelStyle}>Duração do horário <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  <select id="availability-slot" value={availabilityModal.data.slot_minutes} onChange={e => setAvailabilityField('slot_minutes', Number(e.target.value))}
                    disabled={availabilitySaving}
                    style={{ width: '100%', padding: '10px 12px', border: `1px solid ${availabilityFormErrors.slot_minutes ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                    {SLOT_MINUTE_OPTIONS.map(minutes => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
                  </select>
                  {availabilityFormErrors.slot_minutes && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{availabilityFormErrors.slot_minutes}</span>}
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                  <label htmlFor="availability-active" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', padding: '10px 0', cursor: availabilitySaving ? 'not-allowed' : 'pointer' }}>
                    <input id="availability-active" type="checkbox" checked={availabilityModal.data.active} onChange={e => setAvailabilityField('active', e.target.checked)}
                      disabled={availabilitySaving}
                      style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                    Disponibilidade ativa
                  </label>
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={closeAvailabilityModal} disabled={availabilitySaving} style={{ padding: '9px 20px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, cursor: availabilitySaving ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveAvailability} disabled={availabilitySaving} style={{ padding: '9px 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: availabilitySaving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {availabilitySaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Clock size={14} /> Salvar disponibilidade</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
            <AlertCircle size={24} color="var(--red-500)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)', margin: '12px 0 6px' }}>Excluir agendamento?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5 }}>Esta ação removerá a consulta da agenda.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 16px', border: '1px solid var(--gray-200)', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '9px 16px', border: 'none', borderRadius: 9, background: 'var(--red-500)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: '13px 16px',
  fontSize: 13,
  color: 'var(--gray-600)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  verticalAlign: 'middle',
};

function Metric({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div style={{ border: '1px solid var(--gray-100)', background: 'var(--gray-50)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 20, color: 'var(--dark)', fontWeight: 800 }}>{value}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Agendamento['status'] }) {
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.pendente;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', borderRadius: 20, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
      {st.label}
    </span>
  );
}

function IconButton({ title, icon: Icon, color, onClick }: { title: string; icon: React.ElementType; color: string; onClick: () => void }) {
  return (
    <button title={title} onClick={onClick} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon size={14} />
    </button>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--gray-100)', background: '#fff', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 9 }}>
      <Icon size={14} color="var(--primary)" />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
    </div>
  );
}
