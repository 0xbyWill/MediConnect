import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, Calendar, CalendarCheck, ChevronLeft, ChevronRight, Clock, Loader2, Mail, MapPin,
  Pencil, Phone, Plus, Power, PowerOff, Search, Trash2, Users, X,
} from 'lucide-react';
import type { Agendamento, Paciente, TipoConsulta } from '../types';
import { availabilityApi, doctorsApi } from '../lib/api';
import type { ApiDoctor, ApiDoctorAvailability, DoctorAppointmentType } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';
import { initials } from '../shared/utils/text';
import { toUserFacingErrorMessage } from '../shared/utils/errors';
import { SpecialtySelector } from '../components/patient-scheduling/SpecialtySelector';
import { AvailableDates, type AvailableDateItem } from '../components/patient-scheduling/AvailableDates';
import { DoctorSelector, type DoctorAvailabilityItem } from '../components/patient-scheduling/DoctorSelector';
import { TimeSlotSelector } from '../components/patient-scheduling/TimeSlotSelector';
import { AppointmentConfirmationModal } from '../components/patient-scheduling/AppointmentConfirmationModal';
import { UpcomingAppointmentCard } from '../components/patient-scheduling/UpcomingAppointmentCard';
import { MyAppointments } from '../components/patient-scheduling/MyAppointments';
import { formatSpecialty } from '../components/patient-scheduling/format';

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
  id?: string;
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
  onConfirm?: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  initialOpen?: boolean;
  initialPatientId?: string | null;
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

function isPastAppointmentSlot(date: string, time: string, now = new Date()) {
  if (!date || !time) return false;
  const todayISO = dateToISO(now);
  if (date < todayISO) return true;
  if (date > todayISO) return false;
  const slotMinutes = timeToMinutes(time);
  if (slotMinutes === null) return false;
  return slotMinutes <= now.getHours() * 60 + now.getMinutes();
}

function isElapsedAppointment(appt: Pick<Agendamento, 'data' | 'hora' | 'status'>) {
  return appt.status !== 'cancelado' && isPastAppointmentSlot(appt.data, appt.hora);
}

function effectiveAppointmentStatus(appt: Agendamento): Agendamento['status'] {
  return isElapsedAppointment(appt) ? 'realizado' : appt.status;
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

function buildSlotDoctorsFromAvailability(availabilities: ApiDoctorAvailability[]) {
  return availabilities.reduce<Record<string, Set<string>>>((acc, availability) => {
    const start = timeToMinutes(availability.start_time);
    const end = timeToMinutes(availability.end_time);
    if (start === null || end === null || end <= start) return acc;
    const step = Math.max(SLOT_STEP_MINUTES, availability.slot_minutes || SLOT_STEP_MINUTES);
    for (let current = start; current < end; current += step) {
      const slot = minutesToTime(current);
      acc[slot] ??= new Set<string>();
      acc[slot].add(availability.doctor_id);
    }
    return acc;
  }, {});
}

function byAvailabilityOrder(a: ApiDoctorAvailability, b: ApiDoctorAvailability) {
  return a.weekday - b.weekday || normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time));
}

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

function groupAvailabilityByWeekday(rules: ApiDoctorAvailability[]) {
  const map = new Map<number, ApiDoctorAvailability[]>();
  for (const rule of rules) {
    const list = map.get(rule.weekday) ?? [];
    list.push(rule);
    map.set(rule.weekday, list);
  }
  return WEEKDAYS
    .map(day => ({
      day,
      rules: (map.get(day.value) ?? []).sort((a, b) =>
        normalizeTime(a.start_time).localeCompare(normalizeTime(b.start_time))
      ),
    }))
    .filter(group => group.rules.length > 0);
}

function availabilityRulesSummary(rules: ApiDoctorAvailability[]) {
  const active = rules.filter(rule => rule.active !== false).length;
  const slotMinutes = new Set(rules.map(rule => rule.slot_minutes));
  return {
    total: rules.length,
    inactive: rules.length - active,
    singleSlotMinutes: slotMinutes.size === 1 ? [...slotMinutes][0] : null,
    multipleDoctors: new Set(rules.map(rule => rule.doctor_id)).size > 1,
  };
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
    id: undefined,
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
  realizado: { label: 'Atendido', bg: '#ede9fe', color: '#5b21b6' },
};
const STATUS_ORDER: Agendamento['status'][] = ['confirmado', 'pendente', 'realizado', 'cancelado'];
const PERIOD_OPTIONS: Array<{ value: 'dia' | 'semana' | 'mes' | 'todos'; label: string }> = [
  { value: 'dia', label: 'Dia' },
  { value: 'semana', label: 'Semana' },
  { value: 'mes', label: 'Mês' },
  { value: 'todos', label: 'Lista' },
];

type PatientFlowDoctor = Pick<ApiDoctor, 'id' | 'full_name' | 'specialty' | 'active'>;

function formatDateAndTimeBR(date: string, time: string) {
  return `${formatDateBR(date)} às ${time}`;
}

function formatRelativeDateLabel(date: string) {
  const today = dateToISO(new Date());
  const tomorrowDate = new Date(`${today}T00:00:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = dateToISO(tomorrowDate);
  const dayMonth = `${date.slice(8, 10)}/${date.slice(5, 7)}`;

  if (date === today) return `Hoje · ${dayMonth}`;
  if (date === tomorrow) return `Amanhã · ${dayMonth}`;

  const weekday = new Date(`${date}T00:00:00`)
    .toLocaleDateString('pt-BR', { weekday: 'long' })
    .replace(/^./, letter => letter.toUpperCase());
  return `${weekday} · ${dayMonth}`;
}

function PatientSchedulingExperience({
  agendamentos,
  pacientes,
  doctors,
  onAdd,
  userName,
  userId,
  userPatientId,
}: {
  agendamentos: Agendamento[];
  pacientes: Paciente[];
  doctors: ApiDoctor[];
  onAdd: (a: Omit<Agendamento, 'id'>) => Promise<void>;
  userName: string;
  userId: string;
  userPatientId?: string;
}) {
  const ownPatientId = userPatientId || pacientes[0]?.id || userId;
  const myAppointments = agendamentos
    .filter(appt => appt.pacienteId === ownPatientId)
    .sort(byChronology);

  const [specialties, setSpecialties] = useState<Array<{ id: string; name: string; doctorCount: number }>>([]);
  const [specialtiesLoading, setSpecialtiesLoading] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(null);
  const [specialtyDoctors, setSpecialtyDoctors] = useState<PatientFlowDoctor[]>([]);
  const [specialtyDoctorsLoading, setSpecialtyDoctorsLoading] = useState(false);
  const [availabilityByDoctor, setAvailabilityByDoctor] = useState<Record<string, ApiDoctorAvailability[]>>({});
  const [availableDates, setAvailableDates] = useState<AvailableDateItem[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [availableDoctors, setAvailableDoctors] = useState<DoctorAvailabilityItem[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [savingAppointment, setSavingAppointment] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const datesRef = useRef<HTMLDivElement>(null);
  const doctorsRef = useRef<HTMLDivElement>(null);
  const slotsRef = useRef<HTMLDivElement>(null);

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    window.requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  useEffect(() => {
    let cancelled = false;
    setSpecialtiesLoading(true);
    setError('');

    void Promise.all([
      doctorsApi.listForScheduling(),
      availabilityApi.list({ active: true }),
    ])
      .then(([rows, availabilities]) => {
        if (cancelled) return;
        const doctorsWithAvailability = new Set(
          availabilities
            .filter(item => item.active !== false)
            .map(item => item.doctor_id)
        );
        const activeRows = rows.filter(
          doctor => doctor.active !== false && doctorsWithAvailability.has(doctor.id)
        );
        const counter = new Map<string, { label: string; count: number }>();
        for (const doctor of activeRows) {
          const specialty = doctor.specialty?.trim() || 'Clínica geral';
          const key = specialty.toLowerCase();
          const current = counter.get(key);
          if (current) current.count += 1;
          else counter.set(key, { label: specialty, count: 1 });
        }
        const sorted = Array.from(counter.entries())
          .map(([id, value]) => ({ id, name: value.label, doctorCount: value.count }))
          .sort((a, b) => a.name.localeCompare(b.name));
        setSpecialties(sorted);
      })
      .catch(err => {
        if (cancelled) return;
        setError(toUserFacingErrorMessage(err, 'Não foi possível carregar as especialidades.'));
      })
      .finally(() => {
        if (!cancelled) setSpecialtiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const computeFreeSlotsForDoctorDate = useCallback(
    (doctorId: string, date: string) => {
      const weekday = new Date(`${date}T00:00:00`).getDay();
      const availabilities = availabilityByDoctor[doctorId] ?? [];
      const dayAvailabilities = availabilities.filter(item => item.weekday === weekday && item.active !== false);
      const baseSlots = buildTimeSlotsFromAvailability(dayAvailabilities);
      const occupied = new Set(
        agendamentos
          .filter(appt => appt.medicoId === doctorId && appt.data === date && appt.status !== 'cancelado')
          .map(appt => normalizeTime(appt.hora))
          .filter(Boolean)
      );
      return baseSlots.filter(slot => !occupied.has(slot) && !isPastAppointmentSlot(date, slot));
    },
    [agendamentos, availabilityByDoctor]
  );

  const buildAvailabilitySteps = useCallback(
    (doctorsList: PatientFlowDoctor[], map: Record<string, ApiDoctorAvailability[]>) => {
      const dates: AvailableDateItem[] = [];
      const now = new Date();
      for (let i = 0; i < 30; i += 1) {
        const date = new Date(now);
        date.setDate(date.getDate() + i);
        const isoDate = dateToISO(date);
        let totalSlots = 0;
        for (const doctor of doctorsList) {
          const weekday = date.getDay();
          const dayAvailabilities = (map[doctor.id] ?? []).filter(item => item.weekday === weekday && item.active !== false);
          const baseSlots = buildTimeSlotsFromAvailability(dayAvailabilities);
          if (baseSlots.length === 0) continue;
          const occupied = new Set(
            agendamentos
              .filter(appt => appt.medicoId === doctor.id && appt.data === isoDate && appt.status !== 'cancelado')
              .map(appt => normalizeTime(appt.hora))
              .filter(Boolean)
          );
          totalSlots += baseSlots.filter(slot => !occupied.has(slot) && !isPastAppointmentSlot(isoDate, slot)).length;
        }
        if (totalSlots > 0) {
          dates.push({
            date: isoDate,
            label: formatRelativeDateLabel(isoDate),
            slotsCount: totalSlots,
          });
        }
        if (dates.length >= 8) break;
      }
      setAvailableDates(dates);
      setSelectedDate(null);
    },
    [agendamentos]
  );

  const handleSelectSpecialty = useCallback(
    async (specialtyId: string) => {
      setSelectedSpecialty(specialtyId);
      setSelectedDate(null);
      setSelectedDoctorId(null);
      setSelectedSlot(null);
      setTimeSlots([]);
      setAvailableDoctors([]);
      setAvailableDates([]);
      setError('');
      setSuccessMessage('');
      setSpecialtyDoctorsLoading(true);

      try {
        const querySpecialty = specialtyId === '__all__'
          ? undefined
          : specialties.find(item => item.id === specialtyId)?.name;
        const rows = await doctorsApi.listForScheduling({ specialty: querySpecialty });
        const normalizedDoctors: PatientFlowDoctor[] = rows
          .filter(item => item.active !== false)
          .map(item => ({
            id: item.id,
            full_name: item.full_name,
            specialty: item.specialty || 'Clínica geral',
            active: item.active,
          }));
        setSpecialtyDoctors(normalizedDoctors);

        const availabilityPairs = await Promise.all(
          normalizedDoctors.map(async doctor => {
            const list = await availabilityApi.list({ doctor_id: doctor.id, active: true });
            return [doctor.id, list] as const;
          })
        );
        const nextMap = Object.fromEntries(availabilityPairs);
        setAvailabilityByDoctor(nextMap);
        buildAvailabilitySteps(normalizedDoctors, nextMap);
        scrollToRef(datesRef);
      } catch (err) {
        setError(toUserFacingErrorMessage(err, 'Não foi possível carregar disponibilidade para a especialidade.'));
      } finally {
        setSpecialtyDoctorsLoading(false);
      }
    },
    [buildAvailabilitySteps, specialties]
  );

  useEffect(() => {
    if (!selectedDate) return;
    const doctorsByDate = specialtyDoctors
      .map(doctor => {
        const free = computeFreeSlotsForDoctorDate(doctor.id, selectedDate);
        if (free.length === 0) return null;
        return {
          doctorId: doctor.id,
          doctorName: doctor.full_name,
          specialty: doctor.specialty || 'Clínica geral',
          nextSlot: free[0],
        } satisfies DoctorAvailabilityItem;
      })
      .filter((item): item is DoctorAvailabilityItem => Boolean(item));
    setAvailableDoctors(doctorsByDate);
    setSelectedDoctorId(previous => (
      previous && doctorsByDate.some(item => item.doctorId === previous) ? previous : null
    ));
    setSelectedSlot(null);
    setTimeSlots([]);
  }, [computeFreeSlotsForDoctorDate, selectedDate, specialtyDoctors]);

  const handleSelectDoctor = useCallback(
    async (doctorId: string) => {
      if (!selectedDate) return;
      setSelectedDoctorId(doctorId);
      setSelectedSlot(null);
      setTimeSlotsLoading(true);
      setError('');
      scrollToRef(slotsRef);
      try {
        const response = await availabilityApi.getAvailableSlots({ doctor_id: doctorId, date: selectedDate });
        const payload = Array.isArray(response.data)
          ? response.data
          : response.data && typeof response.data === 'object'
          ? response.data.slots ?? response.data.available_slots ?? []
          : response.slots ?? response.available_slots ?? [];
        const freeSlots = payload.map(normalizeTime).filter(Boolean);
        setTimeSlots(freeSlots.length > 0 ? freeSlots : computeFreeSlotsForDoctorDate(doctorId, selectedDate));
      } catch {
        setTimeSlots(computeFreeSlotsForDoctorDate(doctorId, selectedDate));
      } finally {
        setTimeSlotsLoading(false);
      }
    },
    [computeFreeSlotsForDoctorDate, selectedDate]
  );

  const selectedDoctor = availableDoctors.find(item => item.doctorId === selectedDoctorId) ?? null;
  const selectedSpecialtyRaw = specialties.find(item => item.id === selectedSpecialty)?.name ?? 'Especialidade';
  const selectedSpecialtyLabel = selectedSpecialty === '__all__' ? selectedSpecialtyRaw : formatSpecialty(selectedSpecialtyRaw);
  const nextAppointment = myAppointments.find(appt => !isPastAppointmentSlot(appt.data, appt.hora) && appt.status !== 'cancelado') ?? null;
  const allDoctorList = [...doctors, ...specialtyDoctors.map(doc => ({
    id: doc.id,
    full_name: doc.full_name,
    specialty: doc.specialty,
  } as ApiDoctor))];
  const uniqueDoctors = Array.from(new Map(allDoctorList.map(item => [item.id, item])).values());

  const doctorById = (doctorId?: string) => uniqueDoctors.find(doctor => doctor.id === doctorId);

  const upcomingLabel = nextAppointment ? formatDateAndTimeBR(nextAppointment.data, normalizeTime(nextAppointment.hora)) : '';
  const myUpcomingAppointments = myAppointments
    .filter(appt => !isPastAppointmentSlot(appt.data, appt.hora) && appt.status !== 'cancelado')
    .slice(0, 10)
    .map(appt => {
      const doctor = doctorById(appt.medicoId);
      return {
        id: appt.id,
        specialty: doctor?.specialty ? formatSpecialty(doctor.specialty) : 'Especialidade não informada',
        doctorName: doctor?.full_name || 'Médico não informado',
        dateLabel: formatDateAndTimeBR(appt.data, normalizeTime(appt.hora)),
      };
    });

  const handleConfirmAppointment = useCallback(async () => {
    if (!selectedDate || !selectedDoctorId || !selectedSlot) return;
    setSavingAppointment(true);
    setError('');
    try {
      await onAdd({
        pacienteId: ownPatientId,
        medicoId: selectedDoctorId,
        data: selectedDate,
        hora: selectedSlot,
        tipo: 'Primeira Consulta',
        status: 'pendente',
        observacoes: 'Agendamento feito pela área do paciente.',
        duracao: '30 min',
        enviarEmail: true,
        enviarWhatsapp: true,
      });
      setConfirmOpen(false);
      setSuccessMessage('Consulta agendada com sucesso.');
      setSelectedDoctorId(null);
      setSelectedSlot(null);
      setTimeSlots([]);
      await handleSelectSpecialty(selectedSpecialty ?? '__all__');
    } catch (err) {
      setError(toUserFacingErrorMessage(err, 'Erro ao agendar consulta. Tente novamente.'));
    } finally {
      setSavingAppointment(false);
    }
  }, [handleSelectSpecialty, onAdd, ownPatientId, selectedDate, selectedDoctorId, selectedSlot, selectedSpecialty]);

  const selectedDateLabel = selectedDate ? formatDateBR(selectedDate) : '';
  const selectedDoctorName = selectedDoctor?.doctorName ?? 'Médico';

  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '20px clamp(14px, 4vw, 36px) 24px' }}>
      <div style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto' }}>
        <header style={{ display: 'grid', gap: 6 }}>
          <h1 style={{ margin: 0, fontSize: 30, color: '#071327' }}>Agendar consulta</h1>
          <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>
            Encontre o melhor horário em poucos passos.
          </p>
        </header>

        {nextAppointment && (
          <UpcomingAppointmentCard
            specialty={doctorById(nextAppointment.medicoId)?.specialty ? formatSpecialty(doctorById(nextAppointment.medicoId)?.specialty) : 'Especialidade não informada'}
            dateLabel={upcomingLabel}
            doctorName={doctorById(nextAppointment.medicoId)?.full_name || 'Médico não informado'}
            onViewDetails={() => {
              const element = document.getElementById('patient-my-appointments');
              if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          />
        )}

        {error && (
          <div
            role="alert"
            style={{
              border: '1px solid var(--red-100)',
              background: 'var(--red-50)',
              color: 'var(--red-600)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              border: '1px solid rgba(0,166,63,0.2)',
              background: 'rgba(0,166,63,0.08)',
              color: '#065f46',
              borderRadius: 12,
              padding: 14,
              display: 'grid',
              gap: 10,
            }}
          >
            <strong>{successMessage}</strong>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  const element = document.getElementById('patient-my-appointments');
                  if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                style={{
                  border: '1px solid var(--primary)',
                  background: '#fff',
                  color: 'var(--primary)',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Ver minhas consultas
              </button>
              <button
                type="button"
                onClick={() => setSuccessMessage('')}
                style={{
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '8px 12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Agendar outra consulta
              </button>
            </div>
          </div>
        )}

        {specialtiesLoading ? (
          <div style={{ fontSize: 14, color: '#64748b' }}>Carregando especialidades...</div>
        ) : (
          <SpecialtySelector
            specialties={specialties}
            selectedSpecialty={selectedSpecialty}
            onSelect={handleSelectSpecialty}
          />
        )}

        {selectedSpecialty && (
          <div ref={datesRef} style={{ scrollMarginTop: 16 }}>
            <AvailableDates
              dates={availableDates}
              selectedDate={selectedDate}
              onSelect={date => {
                setSelectedDate(date);
                setSelectedDoctorId(null);
                setSelectedSlot(null);
                setTimeSlots([]);
                scrollToRef(doctorsRef);
              }}
              loading={specialtyDoctorsLoading}
            />
          </div>
        )}

        {selectedSpecialty && selectedDate && (
          <div ref={doctorsRef} style={{ scrollMarginTop: 16 }}>
            <DoctorSelector
              doctors={availableDoctors}
              selectedDoctorId={selectedDoctorId}
              onSelect={handleSelectDoctor}
              loading={specialtyDoctorsLoading}
            />
          </div>
        )}

        {selectedDoctorId && (
          <div ref={slotsRef} style={{ scrollMarginTop: 16 }}>
            <TimeSlotSelector
              slots={timeSlots}
              selectedSlot={selectedSlot}
              onSelect={slot => {
                setSelectedSlot(slot);
                setConfirmOpen(true);
              }}
              loading={timeSlotsLoading}
            />
          </div>
        )}

        <div id="patient-my-appointments">
          <MyAppointments appointments={myUpcomingAppointments} />
        </div>
      </div>

      <AppointmentConfirmationModal
        open={confirmOpen}
        specialty={selectedSpecialtyLabel}
        doctorName={selectedDoctorName}
        dateLabel={selectedDateLabel}
        time={selectedSlot || ''}
        patientName={userName}
        loading={savingAppointment}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => void handleConfirmAppointment()}
      />
    </div>
  );
}

export default function Agenda({ agendamentos, pacientes, doctors = [], onAdd, onUpdate, onConfirm, onDelete, initialOpen, initialPatientId, readOnly = false }: AgendaProps) {
  const { user } = useAuth();
  const isGestao = user?.role === 'gestao';
  const isMedico = user?.role === 'medico';
  const isSecretaria = user?.role === 'secretaria';
  const isPaciente = user?.role === 'paciente' || readOnly;
  const isPatientOnlyExperience = user?.role === 'paciente';
  const canPatientSchedule = user?.role === 'paciente' && !readOnly;
  const canCreateAgendamento = canPatientSchedule || (!isPaciente && !isMedico);
  const canCancelAgendamento = canPatientSchedule || isGestao || isMedico || isSecretaria;
  const canManageAvailability = !isPaciente && !isSecretaria;
  const canToggleAvailability = isMedico || isGestao;
  const today = dateToISO(new Date());

  const [selectedDate, setSelectedDate] = useState(today);
  const [period, setPeriod] = useState<'dia' | 'semana' | 'mes' | 'todos'>('dia');
  const [filterDoctorId, setFilterDoctorId] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [statusFilter, setStatusFilter] = useState<Agendamento['status'] | ''>('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [modal, setModal] = useState<{ open: boolean; mode: 'add' | 'edit'; data: FormData }>({
    open: false,
    mode: 'add',
    data: emptyForm(today),
  });
  const [patientSearch, setPatientSearch] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [detailsSlot, setDetailsSlot] = useState<{ date: string; slot: string } | null>(null);
  const [availability, setAvailability] = useState<ApiDoctorAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [dayAvailability, setDayAvailability] = useState<ApiDoctorAvailability[]>([]);
  const [dayAvailabilityLoading, setDayAvailabilityLoading] = useState(false);
  const [dayAvailabilityError, setDayAvailabilityError] = useState('');
  const [modalDoctorAvailability, setModalDoctorAvailability] = useState<ApiDoctorAvailability[]>([]);
  const [modalDoctorAvailabilityLoading, setModalDoctorAvailabilityLoading] = useState(false);
  const [modalDoctorAvailabilityError, setModalDoctorAvailabilityError] = useState('');
  const [availabilityModal, setAvailabilityModal] = useState<{ open: boolean; data: AvailabilityForm }>({
    open: false,
    data: emptyAvailabilityForm(),
  });
  const [availabilityRules, setAvailabilityRules] = useState<ApiDoctorAvailability[]>([]);
  const [availabilityRulesLoading, setAvailabilityRulesLoading] = useState(false);
  const [availabilityRulesError, setAvailabilityRulesError] = useState('');
  const [availabilityFormErrors, setAvailabilityFormErrors] = useState<Record<string, string>>({});
  const [availabilitySaveError, setAvailabilitySaveError] = useState('');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityDeletingId, setAvailabilityDeletingId] = useState<string | null>(null);
  const [availabilityTogglingId, setAvailabilityTogglingId] = useState<string | null>(null);
  const initialOpenKeyRef = useRef('');

  const openModal = useCallback((appt?: Agendamento, dateOverride = selectedDate, timeOverride = '', pacienteId = '', doctorIdOverride = '') => {
    if (isPaciente && appt) return;
    if (appt && isElapsedAppointment(appt)) return;
    if (!appt && !canCreateAgendamento) return;
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
    const ownPatientId = canPatientSchedule ? user?.patient_id || pacientes[0]?.id || user?.id || '' : pacienteId;
    setModal({ open: true, mode: 'add', data: { ...emptyForm(dateOverride), pacienteId: ownPatientId, medicoId: doctorIdOverride || filterDoctorId, hora: timeOverride } });
    setPatientSearch('');
  }, [canCreateAgendamento, canPatientSchedule, filterDoctorId, isPaciente, pacientes, selectedDate, user?.id, user?.patient_id]);

  useEffect(() => {
    if (!initialOpen) {
      initialOpenKeyRef.current = '';
      return;
    }
    const key = initialPatientId ?? 'novo';
    if (canCreateAgendamento && initialOpenKeyRef.current !== key) {
      initialOpenKeyRef.current = key;
      openModal(undefined, selectedDate, '', initialPatientId ?? '');
    }
  }, [canCreateAgendamento, initialOpen, initialPatientId, openModal, selectedDate]);

  const closeModal = () => {
    if (saving) return;
    setModal({ open: false, mode: 'add', data: emptyForm(selectedDate) });
    setErrors({});
    setApiError('');
  };

  const loadAvailabilityRules = useCallback(async (doctorId?: string) => {
    if (!canManageAvailability) return;
    setAvailabilityRulesLoading(true);
    setAvailabilityRulesError('');
    try {
      const rows = await availabilityApi.list(doctorId ? { doctor_id: doctorId } : {});
      setAvailabilityRules(rows.sort(byAvailabilityOrder));
    } catch (err) {
      setAvailabilityRules([]);
      setAvailabilityRulesError(toUserFacingErrorMessage(err, 'Erro ao carregar disponibilidades. Tente novamente em instantes.'));
    } finally {
      setAvailabilityRulesLoading(false);
    }
  }, [canManageAvailability]);

  const openAvailabilityModal = () => {
    if (!canManageAvailability) return;
    const doctorId = isMedico ? user?.doctor_id || '' : filterDoctorId;
    setAvailabilityModal({ open: true, data: emptyAvailabilityForm(doctorId) });
    setAvailabilityFormErrors({});
    setAvailabilitySaveError('');
    setAvailabilityRulesError('');
  };

  const closeAvailabilityModal = () => {
    if (availabilitySaving || availabilityDeletingId || availabilityTogglingId) return;
    setAvailabilityModal({ open: false, data: emptyAvailabilityForm() });
    setAvailabilityRules([]);
    setAvailabilityFormErrors({});
    setAvailabilitySaveError('');
    setAvailabilityRulesError('');
  };

  const setField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  const setAvailabilityField = <K extends keyof AvailabilityForm>(field: K, value: AvailabilityForm[K]) => {
    setAvailabilityModal(m => ({ ...m, data: { ...m.data, [field]: value } }));
  };

  useEffect(() => {
    if (!availabilityModal.open) return;
    void loadAvailabilityRules(availabilityModal.data.doctor_id);
  }, [availabilityModal.data.doctor_id, availabilityModal.open, loadAvailabilityRules]);

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

  const baseFilteredAppointments = agendamentos
    .filter(a => {
      const patient = pacientes.find(p => p.id === a.pacienteId);
      const q = filterPatient.toLowerCase().trim();
      const matchDoctor = !activeDoctorId || a.medicoId === activeDoctorId;
      const matchPatient = !q || patient?.nome.toLowerCase().includes(q) || patient?.cpf.includes(q);
      return matchDoctor && matchPatient;
    })
    .sort(byChronology);
  const statusScopedAppointments = baseFilteredAppointments.filter(a => !statusFilter || effectiveAppointmentStatus(a) === statusFilter);
  const filteredAppointments = statusScopedAppointments
    .filter(a => {
      const matchStatus = !statusFilter || effectiveAppointmentStatus(a) === statusFilter;
      const matchPeriod =
        period === 'todos' ||
        (period === 'dia' && a.data === selectedDate) ||
        (period === 'semana' && a.data >= periodStart && a.data <= dateToISO(new Date(new Date(`${periodStart}T00:00:00`).getTime() + 6 * 86400000))) ||
        (period === 'mes' && a.data.slice(0, 7) === selectedDate.slice(0, 7));
      return matchPeriod && matchStatus;
    })
    .sort(byChronology);

  const todayAppointments = statusScopedAppointments.filter(a => a.data === today);
  const selectedMonthAppointments = statusScopedAppointments.filter(a => a.data.slice(0, 7) === selectedDate.slice(0, 7));
  const scheduledToday = todayAppointments.length;
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
  const calendarAppointments = filteredAppointments.filter(a => calendarDays.some(day => day.iso === a.data));
  const activeDoctors = doctors.filter(doctor => !activeDoctorId || doctor.id === activeDoctorId);
  const availableDoctorIds = new Set(dayAvailability.map(item => item.doctor_id));
  const doctorSpecialties = Array.from(new Set(doctors.map(doctor => doctor.specialty).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const visibleDoctors = doctors.filter(doctor => {
    const query = doctorSearch.toLowerCase().trim();
    const matchesQuery =
      !query ||
      doctor.full_name.toLowerCase().includes(query) ||
      doctor.specialty?.toLowerCase().includes(query) ||
      doctor.crm?.toLowerCase().includes(query);
    const matchesSpecialty = !specialtyFilter || doctor.specialty === specialtyFilter;
    return matchesQuery && matchesSpecialty;
  });
  const doctorSidebarItems = isMedico
    ? doctors.filter(doctor => doctor.id === user?.doctor_id)
    : visibleDoctors;
  const weekRangeLabel = `${formatDateBR(weekDays[0].iso)} - ${formatDateBR(weekDays[6].iso)}`;
  const selectedDateLabel = selectedDateObject.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const monthLabel = selectedDateObject.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const periodLabel = period === 'dia'
    ? selectedDateLabel
    : period === 'semana'
    ? weekRangeLabel
    : period === 'mes'
    ? monthLabel
    : 'Todos os agendamentos';
  const monthStart = new Date(selectedDateObject.getFullYear(), selectedDateObject.getMonth(), 1);
  const monthGridStart = new Date(monthStart);
  monthGridStart.setDate(monthGridStart.getDate() - monthGridStart.getDay());
  const monthDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(monthGridStart);
    date.setDate(date.getDate() + index);
    const iso = dateToISO(date);
    const appointments = statusScopedAppointments.filter(appt => appt.data === iso);
    return {
      iso,
      day: date.getDate(),
      inMonth: date.getMonth() === selectedDateObject.getMonth(),
      isSelected: iso === selectedDate,
      isToday: iso === today,
      isPast: iso < today,
      count: appointments.length,
      appointments,
    };
  });
  const selectedDayAppointments = filteredAppointments.filter(appt => appt.data === selectedDate);
  const ownPatientId = user?.role === 'paciente' ? user.patient_id || pacientes[0]?.id || user.id : '';
  const canCancelAppointment = (appt: Agendamento) =>
    canCancelAgendamento &&
    effectiveAppointmentStatus(appt) !== 'cancelado' &&
    effectiveAppointmentStatus(appt) !== 'realizado' &&
    !isElapsedAppointment(appt) &&
    (
      isGestao ||
      isSecretaria ||
      (canPatientSchedule && appt.pacienteId === ownPatientId) ||
      (isMedico && Boolean(user?.doctor_id) && appt.medicoId === user?.doctor_id)
    );
  const canConfirmAppointment = (appt: Agendamento) =>
    effectiveAppointmentStatus(appt) === 'pendente' &&
    !isElapsedAppointment(appt) &&
    (
      user?.role === 'gestao' ||
      user?.role === 'secretaria' ||
      (canPatientSchedule && appt.pacienteId === ownPatientId)
    );
  const selectedDateWeekday = selectedDateObject.getDay();
  const dayAvailabilitySlots = buildTimeSlotsFromAvailability(dayAvailability);
  const daySlotDoctors = buildSlotDoctorsFromAvailability(dayAvailability);
  const appointmentSlots = selectedDayAppointments.map(appt => normalizeTime(appt.hora)).filter(Boolean);
  const selectedDaySlots = Array.from(new Set([...dayAvailabilitySlots, ...appointmentSlots])).sort().map(slot => {
    const appointments = selectedDayAppointments.filter(appt => normalizeTime(appt.hora) === slot);
    const availableDoctorIds = daySlotDoctors[slot] ?? new Set<string>();
    const busyDoctorIds = new Set(appointments.filter(appt => appt.status !== 'cancelado').map(appt => appt.medicoId).filter((id): id is string => Boolean(id)));
    const availableDoctorId = Array.from(availableDoctorIds).find(doctorId => !busyDoctorIds.has(doctorId)) || '';
    const isAvailable = Boolean(availableDoctorId);
    const isPast = isPastAppointmentSlot(selectedDate, slot);
    return { slot, appointments, isAvailable, isPast, availableDoctorId };
  });
  const visibleSelectedDaySlots = selectedDaySlots.filter(item => !(item.isPast && item.appointments.length === 0));
  const calendarSlots = selectedDaySlots.map(item => item.slot);
  const freeSlots = visibleSelectedDaySlots.filter(item => item.isAvailable && !item.isPast).length;
  const occupancyRate = dayAvailabilitySlots.length
    ? Math.min(100, Math.round((selectedDayAppointments.length / dayAvailabilitySlots.length) * 100))
    : 0;
  const todayStatusCounts = STATUS_ORDER.reduce<Record<Agendamento['status'], number>>((acc, status) => {
    acc[status] = todayAppointments.filter(appt => effectiveAppointmentStatus(appt) === status).length;
    return acc;
  }, { confirmado: 0, pendente: 0, realizado: 0, cancelado: 0 });
  const monthStatusCounts = STATUS_ORDER.reduce<Record<Agendamento['status'], number>>((acc, status) => {
    acc[status] = selectedMonthAppointments.filter(appt => effectiveAppointmentStatus(appt) === status).length;
    return acc;
  }, { confirmado: 0, pendente: 0, realizado: 0, cancelado: 0 });
  const shiftSelectedDate = (direction: -1 | 1) => {
    const next = new Date(`${selectedDate}T00:00:00`);
    if (period === 'mes') next.setMonth(next.getMonth() + direction);
    else if (period === 'semana') next.setDate(next.getDate() + direction * 7);
    else next.setDate(next.getDate() + direction);
    setSelectedDate(dateToISO(next));
  };

  const modalDoctorId = isMedico ? user?.doctor_id || '' : modal.data.medicoId || '';
  const modalWeekday = modal.data.data ? new Date(`${modal.data.data}T00:00:00`).getDay() : undefined;
  const availableTimeSlots = buildTimeSlotsFromAvailability(availability)
    .filter(slot => !isPastAppointmentSlot(modal.data.data, slot));
  const modalAvailableDoctorIds = new Set(modalDoctorAvailability.map(item => item.doctor_id));
  const modalDoctorOptions = visibleDoctors;
  const hasModalAvailabilityForDate = modalDoctorAvailability.length > 0;
  const availabilityDoctorName = (doctorId: string) =>
    doctors.find(doctor => doctor.id === doctorId)?.full_name || (isMedico && doctorId === user?.doctor_id ? user?.full_name : 'Médico não informado');

  useEffect(() => {
    if (!selectedDate) {
      setDayAvailability([]);
      setDayAvailabilityLoading(false);
      setDayAvailabilityError('');
      return;
    }

    let cancelled = false;
    setDayAvailabilityLoading(true);
    setDayAvailabilityError('');
    void availabilityApi
      .list({
        ...(activeDoctorId ? { doctor_id: activeDoctorId } : {}),
        active: true,
      })
      .then(rows => {
        if (cancelled) return;
        setDayAvailability(rows.filter(row => row.weekday === selectedDateWeekday));
      })
      .catch(err => {
        if (cancelled) return;
        setDayAvailability([]);
        setDayAvailabilityError(toUserFacingErrorMessage(err, 'Erro ao carregar disponibilidade do dia.'));
      })
      .finally(() => {
        if (!cancelled) setDayAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeDoctorId, selectedDate, selectedDateWeekday]);

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
      .list({ doctor_id: modalDoctorId, active: true })
      .then(rows => {
        if (cancelled) return;
        setAvailability(rows.filter(row => row.weekday === modalWeekday));
      })
      .catch(err => {
        if (cancelled) return;
        setAvailability([]);
        setAvailabilityError(toUserFacingErrorMessage(err, 'Erro ao carregar disponibilidade do médico.'));
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [modal.data.data, modal.open, modalDoctorId, modalWeekday]);

  useEffect(() => {
    if (!canPatientSchedule || !modal.open || !modal.data.data || modalWeekday === undefined) {
      setModalDoctorAvailability([]);
      setModalDoctorAvailabilityLoading(false);
      setModalDoctorAvailabilityError('');
      return;
    }

    let cancelled = false;
    setModalDoctorAvailabilityLoading(true);
    setModalDoctorAvailabilityError('');
    void availabilityApi
      .list({ active: true })
      .then(rows => {
        if (!cancelled) setModalDoctorAvailability(rows.filter(row => row.weekday === modalWeekday));
      })
      .catch(err => {
        if (cancelled) return;
        setModalDoctorAvailability([]);
        setModalDoctorAvailabilityError(toUserFacingErrorMessage(err, 'Erro ao carregar médicos disponíveis.'));
      })
      .finally(() => {
        if (!cancelled) setModalDoctorAvailabilityLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canPatientSchedule, modal.data.data, modal.open, modalWeekday]);

  useEffect(() => {
    if (!canPatientSchedule || !import.meta.env.DEV) return;
    console.info('[Agenda paciente] médicos carregados', {
      total: doctors.length,
      filtradosNaTela: visibleDoctors.length,
      filtros: { busca: doctorSearch, especialidade: specialtyFilter },
      dataSelecionada: selectedDate,
      disponibilidadesNoDia: dayAvailability.length,
      medicosComHorarioNoDia: availableDoctorIds.size,
    });
  }, [availableDoctorIds.size, canPatientSchedule, dayAvailability.length, doctorSearch, doctors.length, selectedDate, specialtyFilter, visibleDoctors.length]);

  const dayConflicts = agendamentos.filter(a =>
    a.medicoId === modalDoctorId &&
    a.data === modal.data.data &&
    a.id !== modal.data.id &&
    a.status !== 'cancelado'
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
    return nextErrors;
  };

  const validate = () => {
    const nextErrors: Record<string, string> = {};
    if (!modal.data.pacienteId) nextErrors.paciente = canPatientSchedule ? 'Seu perfil de paciente não está vinculado a um cadastro de paciente.' : 'Selecione um paciente do banco.';
    if (!modal.data.data) nextErrors.data = 'Informe a data da consulta.';
    if (modal.data.data && modal.data.data < today) nextErrors.data = 'A consulta não pode ser agendada para data anterior a hoje.';
    if (!modal.data.hora) nextErrors.hora = 'Informe o horário.';
    if (modal.data.data && modal.data.hora && isPastAppointmentSlot(modal.data.data, modal.data.hora)) {
      nextErrors.hora = 'A consulta não pode ser agendada para horário que já passou.';
    }
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

  const editAvailability = (rule: ApiDoctorAvailability) => {
    setAvailabilityModal(m => ({
      ...m,
      data: {
        id: rule.id,
        doctor_id: rule.doctor_id,
        weekday: rule.weekday,
        start_time: normalizeTime(rule.start_time),
        end_time: normalizeTime(rule.end_time),
        slot_minutes: rule.slot_minutes || SLOT_STEP_MINUTES,
        appointment_type: rule.appointment_type || 'presencial',
        active: rule.active !== false,
      },
    }));
    setAvailabilityFormErrors({});
    setAvailabilitySaveError('');
  };

  const handleSaveAvailability = async () => {
    if (!canManageAvailability) return;
    const nextErrors = validateAvailability();
    if (Object.keys(nextErrors).length) {
      setAvailabilityFormErrors(nextErrors);
      return;
    }

    setAvailabilitySaving(true);
    setAvailabilitySaveError('');
    try {
      const payload = {
        doctor_id: availabilityModal.data.doctor_id,
        weekday: availabilityModal.data.weekday,
        start_time: normalizeTime(availabilityModal.data.start_time),
        end_time: normalizeTime(availabilityModal.data.end_time),
        slot_minutes: availabilityModal.data.slot_minutes,
        appointment_type: 'presencial' as DoctorAppointmentType,
        active: availabilityModal.data.active,
      };
      const saved = availabilityModal.data.id
        ? await availabilityApi.update(availabilityModal.data.id, payload)
        : await availabilityApi.create(payload);

      if (
        modal.open &&
        saved.active !== false &&
        saved.doctor_id === modalDoctorId &&
        saved.weekday === modalWeekday
      ) {
        setAvailability(current => [...current.filter(item => item.id !== saved.id), saved]);
      } else {
        setAvailability(current => current.filter(item => item.id !== saved.id));
      }
      if (saved.weekday === selectedDateWeekday && (!activeDoctorId || saved.doctor_id === activeDoctorId)) {
        setDayAvailability(current => saved.active === false
          ? current.filter(item => item.id !== saved.id)
          : [...current.filter(item => item.id !== saved.id), saved]);
      } else {
        setDayAvailability(current => current.filter(item => item.id !== saved.id));
      }

      setAvailabilityModal(m => ({ ...m, data: emptyAvailabilityForm(saved.doctor_id) }));
      await loadAvailabilityRules(saved.doctor_id);
    } catch (err) {
      setAvailabilitySaveError(toUserFacingErrorMessage(err, 'Erro ao salvar disponibilidade. Tente novamente em instantes.'));
    } finally {
      setAvailabilitySaving(false);
    }
  };

  const handleToggleAvailability = async (rule: ApiDoctorAvailability) => {
    if (!canToggleAvailability || availabilityTogglingId || availabilityDeletingId || availabilitySaving) return;
    const nextActive = rule.active === false;
    setAvailabilityTogglingId(rule.id);
    setAvailabilitySaveError('');
    try {
      const saved = await availabilityApi.update(rule.id, { active: nextActive });
      setAvailabilityRules(current => current.map(item => item.id === saved.id ? saved : item).sort(byAvailabilityOrder));
      if (
        modal.open &&
        saved.active !== false &&
        saved.doctor_id === modalDoctorId &&
        saved.weekday === modalWeekday
      ) {
        setAvailability(current => [...current.filter(item => item.id !== saved.id), saved]);
      } else {
        setAvailability(current => current.filter(item => item.id !== saved.id));
      }
      if (saved.weekday === selectedDateWeekday && (!activeDoctorId || saved.doctor_id === activeDoctorId)) {
        setDayAvailability(current => saved.active === false
          ? current.filter(item => item.id !== saved.id)
          : [...current.filter(item => item.id !== saved.id), saved]);
      } else {
        setDayAvailability(current => current.filter(item => item.id !== saved.id));
      }
      if (availabilityModal.data.id === saved.id) {
        setAvailabilityModal(m => ({ ...m, data: { ...m.data, active: saved.active !== false } }));
      }
    } catch (err) {
      setAvailabilitySaveError(toUserFacingErrorMessage(err, 'Erro ao alterar status da disponibilidade. Tente novamente em instantes.'));
    } finally {
      setAvailabilityTogglingId(null);
    }
  };

  const handleDeleteAvailability = async (rule: ApiDoctorAvailability) => {
    if (!canManageAvailability || availabilityDeletingId) return;
    setAvailabilityDeletingId(rule.id);
    setAvailabilitySaveError('');
    try {
      await availabilityApi.delete(rule.id);
      setAvailabilityRules(current => current.filter(item => item.id !== rule.id));
      setAvailability(current => current.filter(item => item.id !== rule.id));
      setDayAvailability(current => current.filter(item => item.id !== rule.id));
      if (availabilityModal.data.id === rule.id) {
        setAvailabilityModal(m => ({ ...m, data: emptyAvailabilityForm(rule.doctor_id) }));
      }
    } catch (err) {
      setAvailabilitySaveError(toUserFacingErrorMessage(err, 'Erro ao excluir disponibilidade. Tente novamente em instantes.'));
    } finally {
      setAvailabilityDeletingId(null);
    }
  };

  const handleSave = async () => {
    if (isPaciente && modal.mode !== 'add') return;
    if (modal.mode === 'edit' && modal.data.id) {
      const original = agendamentos.find(appt => appt.id === modal.data.id);
      if (original && isElapsedAppointment(original)) {
        setApiError('Consultas com horário já passado ficam como atendidas e não podem ser alteradas.');
        return;
      }
    }
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setSaving(true);
    setApiError('');
    try {
      const payload: Omit<Agendamento, 'id'> = {
        pacienteId: canPatientSchedule ? modal.data.pacienteId || user?.patient_id || pacientes[0]?.id || user?.id || '' : modal.data.pacienteId,
        medicoId: modalDoctorId,
        data: modal.data.data,
        hora: modal.data.hora,
        tipo: modal.data.tipo,
        observacoes: modal.data.observacoes,
        enviarEmail: modal.data.enviarEmail,
        enviarWhatsapp: modal.data.enviarWhatsapp,
        status: canPatientSchedule ? 'pendente' : modal.data.status ?? 'pendente',
        duracao: '30 min',
      };

      if (modal.mode === 'add') await onAdd(payload);
      else await onUpdate({ ...payload, id: modal.data.id! });
      closeModal();
    } catch (err) {
      setApiError(toUserFacingErrorMessage(err, 'Erro ao salvar agendamento. Tente novamente em instantes.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!canCancelAgendamento) return;
    if (!confirmDelete) return;
    const appointment = agendamentos.find(appt => appt.id === confirmDelete);
    if (appointment && isElapsedAppointment(appointment)) {
      setApiError('Consultas com horário já passado ficam como atendidas e não podem ser canceladas.');
      setConfirmDelete(null);
      return;
    }
    try {
      await onDelete(confirmDelete);
      setConfirmDelete(null);
    } catch (err) {
      setApiError(toUserFacingErrorMessage(err, 'Erro ao excluir agendamento. Tente novamente em instantes.'));
      setConfirmDelete(null);
    }
  };

  const handleConfirmAppointment = async (appt: Agendamento) => {
    if (!canConfirmAppointment(appt) || confirmingId) return;
    setConfirmingId(appt.id);
    setApiError('');
    try {
      if (canPatientSchedule && onConfirm) {
        await onConfirm(appt.id);
      } else {
        await onUpdate({ ...appt, status: 'confirmado' });
      }
    } catch (err) {
      setApiError(toUserFacingErrorMessage(err, 'Erro ao confirmar consulta. Tente novamente em instantes.'));
    } finally {
      setConfirmingId(null);
    }
  };

  const detailsSlotAppointments = detailsSlot
    ? agendamentos
        .filter(appt => appt.data === detailsSlot.date && normalizeTime(appt.hora) === detailsSlot.slot)
        .sort(byChronology)
    : [];

  if (isPatientOnlyExperience) {
    return (
      <PatientSchedulingExperience
        agendamentos={agendamentos}
        pacientes={pacientes}
        doctors={doctors}
        onAdd={onAdd}
        userName={user?.full_name || 'Paciente'}
        userId={user?.id || ''}
        userPatientId={user?.patient_id}
      />
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'block', background: 'transparent', overflowY: 'auto', overflowX: 'hidden' }}>
      <div style={{ background: 'transparent', borderBottom: 'none', padding: '30px clamp(18px, 4vw, 36px) 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 30, fontWeight: 800, color: '#071327', margin: 0, lineHeight: 1.15 }}>Agenda de Consultas</h1>
            <p style={{ fontSize: 14, color: '#334155', marginTop: 6 }}>
              {isPaciente ? 'Acompanhe suas consultas agendadas e anteriores.' : isMedico ? 'Acompanhe seus horários e consultas vinculadas.' : 'Gerencie seus horários e agendamentos'}
            </p>
          </div>
          {(canManageAvailability || canCreateAgendamento) && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {canManageAvailability && (
                <button onClick={openAvailabilityModal} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 16px', background: '#fff', color: 'var(--primary)', border: '1px solid rgba(0,166,63,0.28)', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
                  <Clock size={16} /> Disponibilidade
                </button>
              )}
              {canCreateAgendamento && (
                <button onClick={() => openModal()} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '11px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 24px rgba(0,166,63,0.20)' }}>
                  <Plus size={16} /> Novo Agendamento
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Metric label="Consultas filtradas" value={filteredAppointments.length} icon={CalendarCheck} />
          <Metric label="Hoje" value={scheduledToday} icon={Clock} />
          <Metric label="Pacientes no período" value={uniquePatients} icon={Users} />
          <Metric label="Horário de pico" value={busiestHour ? `${busiestHour[0]}h` : '—'} icon={Calendar} />
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', background: 'rgba(255,255,255,0.88)', border: '1px solid rgba(15,118,75,0.10)', borderRadius: 14, padding: 14, boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', background: '#f1f5f9', border: '1px solid #dbe7e2', borderRadius: 12, padding: 4 }}>
            {PERIOD_OPTIONS.map(option => {
              const selected = period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  style={{
                    border: 'none',
                    borderRadius: 9,
                    padding: '8px 13px',
                    background: selected ? 'var(--primary)' : 'transparent',
                    color: selected ? '#fff' : '#334155',
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: 'pointer',
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => shiftSelectedDate(-1)} title="Período anterior" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #dbe7e2', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ minWidth: 190, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>Visualização atual</div>
              <div style={{ fontSize: 14, color: '#071327', fontWeight: 900, textTransform: period === 'mes' ? 'lowercase' : 'none' }}>{periodLabel}</div>
            </div>
            <button type="button" onClick={() => shiftSelectedDate(1)} title="Próximo período" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid #dbe7e2', background: '#fff', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <ChevronRight size={16} />
            </button>
            <button type="button" onClick={() => setSelectedDate(today)} style={{ border: '1px solid #dbe7e2', background: '#fff', color: '#334155', borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 900, cursor: 'pointer' }}>
              Hoje
            </button>
          </div>
        </div>
      </div>

      <div style={{ overflow: 'visible', padding: '0 clamp(18px, 4vw, 36px) 36px' }}>
        {apiError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
            <AlertCircle size={15} /> {apiError}
          </div>
        )}

        {period === 'mes' && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 14, alignItems: 'start', marginBottom: 18 }}>
            <div style={{ background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #dbe7e2', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: '#071327', margin: 0, textTransform: 'lowercase' }}>{monthLabel}</h2>
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>Visão geral do mês com consultas por status.</p>
                </div>
                <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 900 }}>{selectedMonthAppointments.length} consulta{selectedMonthAppointments.length === 1 ? '' : 's'}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                {['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'].map(day => (
                  <div key={day} style={{ padding: '9px 10px', background: '#f8fafc', borderRight: '1px solid #dbe7e2', borderBottom: '1px solid #dbe7e2', color: '#64748b', fontSize: 11, fontWeight: 900, textAlign: 'center' }}>
                    {day}
                  </div>
                ))}
                {monthDays.map(day => (
                  <button
                    key={`month-${day.iso}`}
                    type="button"
                    onClick={() => setSelectedDate(day.iso)}
                    style={{
                      minHeight: 104,
                      minWidth: 0,
                      padding: 8,
                      border: 'none',
                      borderRight: '1px solid #dbe7e2',
                      borderBottom: '1px solid #dbe7e2',
                      background: day.isSelected ? '#ecfdf5' : day.isToday ? '#f0fdf4' : day.inMonth ? '#fff' : '#f8fafc',
                      color: day.inMonth ? '#071327' : '#94a3b8',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <strong style={{ fontSize: 12, color: day.isSelected ? 'var(--primary)' : 'inherit' }}>{day.day}</strong>
                      {day.count > 0 && <span style={{ fontSize: 10, fontWeight: 900, color: '#64748b' }}>{day.count}</span>}
                    </span>
                    <span style={{ display: 'grid', gap: 4 }}>
                      {day.appointments.slice(0, 3).map(appt => {
                        const patient = pacientes.find(p => p.id === appt.pacienteId);
                        const st = STATUS_LABEL[effectiveAppointmentStatus(appt)] ?? STATUS_LABEL.pendente;
                        return (
                          <span key={appt.id} title={`${appt.hora} - ${patient?.nome || 'Paciente não encontrado'}`} style={{ display: 'block', borderRadius: 6, padding: '4px 6px', background: st.bg, color: st.color, fontSize: 10, fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {appt.hora} {patient?.nome || 'Paciente'}
                          </span>
                        );
                      })}
                      {day.appointments.length > 3 && <span style={{ fontSize: 10, color: '#64748b', fontWeight: 800 }}>mais {day.appointments.length - 3}</span>}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <aside style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, padding: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#071327', margin: '0 0 14px' }}>Resumo de hoje</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  <StatLine label="Hoje" value={todayAppointments.length} />
                  <StatLine label="Confirmadas" value={todayStatusCounts.confirmado} tone="green" />
                  <StatLine label="Pendentes" value={todayStatusCounts.pendente} />
                  <StatLine label="Canceladas" value={todayStatusCounts.cancelado} />
                </div>
              </div>

              <div style={{ background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, padding: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 900, color: '#071327', margin: '0 0 14px' }}>Status do mês</h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {STATUS_ORDER.map(status => (
                    <StatusLegendItem key={status} status={status} count={monthStatusCounts[status]} />
                  ))}
                </div>
              </div>
            </aside>
          </section>
        )}

        <div style={{ display: period === 'dia' ? 'grid' : 'none', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 24, alignItems: 'start' }}>
          <aside style={{ background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, boxShadow: 'none', padding: 22, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
              <Calendar size={20} color="var(--primary)" />
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#071327', margin: 0 }}>Calendário</h2>
            </div>

            <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 900, color: '#071327', marginBottom: 20, textTransform: 'lowercase' }}>
              {monthLabel}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 'clamp(8px, 1.5vh, 16px)', columnGap: 8, marginBottom: 24 }}>
              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, index) => (
                <div key={`${day}-${index}`} style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, color: '#334155', height: 22 }}>
                  {day}
                </div>
              ))}
              {monthDays.map(day => (
                <button
                  key={day.iso}
                  type="button"
                  onClick={() => setSelectedDate(day.iso)}
                  style={{
                    width: 'clamp(36px, 5.2vh, 46px)',
                    height: 'clamp(36px, 5.2vh, 46px)',
                    justifySelf: 'center',
                    border: day.isSelected ? 'none' : day.isPast ? '1px solid #e5e7eb' : '1px solid transparent',
                    borderRadius: day.isSelected ? 10 : 8,
                    background: day.isSelected ? 'var(--primary)' : day.isToday ? '#e8faef' : day.isPast ? '#f1f5f9' : 'transparent',
                    color: day.isSelected ? '#fff' : day.isPast ? '#94a3b8' : day.inMonth ? '#071327' : '#94a3b8',
                    fontSize: 15,
                    fontWeight: day.isSelected || day.count ? 900 : 700,
                    cursor: 'pointer',
                    opacity: day.isPast && !day.isSelected ? 0.68 : 1,
                    position: 'relative',
                  }}
                  title={`${formatDateBR(day.iso)}${day.count ? ` - ${day.count} consulta(s)` : ''}`}
                >
                  {day.day}
                  {day.count > 0 && (
                    <span style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: 4,
                      width: 5,
                      height: 5,
                      borderRadius: 999,
                      transform: 'translateX(-50%)',
                      background: day.isSelected ? '#fff' : day.isPast ? '#94a3b8' : 'var(--primary)',
                    }} />
                  )}
                </button>
              ))}
            </div>

            <div style={{ borderTop: '1px solid #dbe7e2', paddingTop: 18, display: 'grid', gap: 12 }}>
              <StatLine label="Total de Consultas" value={selectedDayAppointments.length} />
              <StatLine label="Horários livres" value={freeSlots} tone="green" />
              <StatLine label="Taxa de ocupação" value={`${occupancyRate}%`} />
            </div>
          </aside>

          <section style={{ background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, boxShadow: 'none', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Clock size={20} color="var(--primary)" />
                  <h2 style={{ fontSize: 17, fontWeight: 800, color: '#071327', margin: 0 }}>Horários do dia</h2>
                </div>
                <p style={{ fontSize: 13, color: '#475569', marginTop: 6, textTransform: 'lowercase' }}>{selectedDateLabel}</p>
              </div>
            </div>

            <div style={{ padding: '0 24px 14px', display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {canCreateAgendamento && (
                <div>
                  <label htmlFor="agenda-doctor-filter-visual" style={labelStyle}>Agenda</label>
                  <select id="agenda-doctor-filter-visual" value={filterDoctorId} onChange={e => setFilterDoctorId(e.target.value)}
                    style={{ minWidth: 210, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
                    <option value="">Todos os médicos ativos</option>
                    {visibleDoctors.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}{canPatientSchedule && !availableDoctorIds.has(d.id) ? ' - sem horários no dia' : ''}</option>)}
                  </select>
                  {canPatientSchedule && !dayAvailabilityLoading && visibleDoctors.length === 0 && (
                    <span style={{ display: 'block', marginTop: 5, fontSize: 11, color: 'var(--gray-400)' }}>Nenhum médico ativo encontrado para os filtros.</span>
                  )}
                </div>
              )}
              {canPatientSchedule && (
                <>
                  <div style={{ position: 'relative', flex: '1 1 220px' }}>
                    <label htmlFor="agenda-doctor-search" style={labelStyle}>Buscar médico</label>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 32, color: 'var(--gray-400)' }} />
                    <input id="agenda-doctor-search" value={doctorSearch} onChange={e => setDoctorSearch(e.target.value)} placeholder="Nome, CRM ou especialidade..."
                      style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
                  </div>
                  <div>
                    <label htmlFor="agenda-specialty-filter" style={labelStyle}>Especialidade</label>
                    <select id="agenda-specialty-filter" value={specialtyFilter} onChange={e => setSpecialtyFilter(e.target.value)}
                      style={{ minWidth: 180, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
                      <option value="">Todas</option>
                      {doctorSpecialties.map(specialty => <option key={specialty} value={specialty}>{specialty}</option>)}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label htmlFor="agenda-date-filter-visual" style={labelStyle}>Data</label>
                <input id="agenda-date-filter-visual" type="date" value={selectedDate} min={today} onChange={e => setSelectedDate(e.target.value)}
                  style={{ padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
              </div>
              <div>
                <label htmlFor="agenda-status-filter-visual" style={labelStyle}>Status</label>
                <select id="agenda-status-filter-visual" value={statusFilter} onChange={e => setStatusFilter(e.target.value as Agendamento['status'] | '')}
                  style={{ minWidth: 150, padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }}>
                  <option value="">Todos</option>
                  <option value="pendente">Pendente</option>
                  <option value="confirmado">Confirmada</option>
                  <option value="realizado">Atendido</option>
                  <option value="cancelado">Cancelada</option>
                </select>
              </div>
              <div style={{ position: 'relative', flex: '1 1 220px' }}>
                <label htmlFor="agenda-patient-filter-visual" style={labelStyle}>Paciente</label>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 32, color: 'var(--gray-400)' }} />
                <input id="agenda-patient-filter-visual" value={filterPatient} onChange={e => setFilterPatient(e.target.value)} placeholder="Filtrar por paciente ou CPF..."
                  style={{ width: '100%', padding: '9px 12px 9px 32px', border: '1px solid var(--gray-200)', borderRadius: 9, fontSize: 13, background: 'var(--gray-50)' }} />
              </div>
            </div>

            <div style={{ maxHeight: 'min(720px, calc(100dvh - 330px))', overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain', scrollbarGutter: 'stable', padding: '10px 18px 24px 24px', display: 'grid', alignContent: 'start', gap: 12 }}>
              {dayAvailabilityError && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {dayAvailabilityError}
                </div>
              )}

              {dayAvailabilityLoading && (
                <div style={{ padding: '20px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--gray-500)', fontSize: 13, fontWeight: 700 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando disponibilidade...
                </div>
              )}

              {!dayAvailabilityLoading && visibleSelectedDaySlots.map(({ slot, appointments, isAvailable, isPast, availableDoctorId }) => {
                const canClickSlotToSchedule = canCreateAgendamento && isAvailable && !isPast && appointments.length === 0;
                const openSlotSchedule = () => openModal(undefined, selectedDate, slot, '', availableDoctorId);
                const canOfferAdditionalSlot = canCreateAgendamento && isAvailable && !isPast;
                return (
                <div
                  key={slot}
                  role={canClickSlotToSchedule ? 'button' : undefined}
                  tabIndex={canClickSlotToSchedule ? 0 : undefined}
                  onClick={canClickSlotToSchedule ? openSlotSchedule : undefined}
                  onKeyDown={event => {
                    if (!canClickSlotToSchedule) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openSlotSchedule();
                    }
                  }}
                  style={{
                  border: isPast ? '1px solid #e5e7eb' : appointments.length ? '1px solid #86efac' : isAvailable ? '1px solid #dbe7e2' : '1px solid #f8d7da',
                  borderRadius: 9,
                  background: isPast ? '#f8fafc' : appointments.length ? '#ecfdf3' : isAvailable ? '#fff' : '#fff7f7',
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 12,
                  padding: '14px 16px',
                  opacity: isPast ? 0.7 : 1,
                  cursor: canClickSlotToSchedule ? 'pointer' : 'default',
                }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, paddingBottom: 10, borderBottom: '1px solid rgba(148, 163, 184, 0.24)' }}>
                    <div style={{ fontSize: 19, fontWeight: 900, color: isPast ? '#64748b' : '#071327', lineHeight: 1 }}>{slot}</div>
                    <div style={{ fontSize: 12, color: '#475569' }}>30min</div>
                  </div>

                  <div style={{ minWidth: 0, display: 'grid', gap: 10 }}>
                    {appointments.length === 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                        <span style={{ color: '#64748b', fontSize: 15, fontStyle: 'italic' }}>Horário disponível</span>
                        {canOfferAdditionalSlot && (
                          <button type="button" onClick={event => { event.stopPropagation(); openSlotSchedule(); }} style={{ border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                            Agendar
                          </button>
                        )}
                      </div>
                    ) : appointments.map(appt => {
                      const patient = pacientes.find(p => p.id === appt.pacienteId);
                      const doctor = doctors.find(d => d.id === appt.medicoId);
                      return (
                        <article key={appt.id} style={{ minWidth: 0, display: 'grid', gap: 10, padding: '10px 12px', border: '1px solid rgba(134, 239, 172, 0.55)', borderRadius: 10, background: '#fff' }}>
                          <div style={{ minWidth: 0 }}>
                            <div title={patient?.nome || ''} style={{ fontSize: 15, fontWeight: 800, color: '#071327', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {patient?.nome || 'Paciente não encontrado'}
                            </div>
                            <div title={doctor?.full_name || ''} style={{ fontSize: 13, color: '#334155', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {appt.tipo}{doctor?.full_name ? ` - ${doctor.full_name}` : ''}
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                            <StatusBadge status={effectiveAppointmentStatus(appt)} />
                            {!isPaciente && (
                              <button type="button" onClick={() => setDetailsSlot({ date: selectedDate, slot })} style={{ border: 'none', background: 'transparent', color: 'var(--primary)', fontSize: 13, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Ver Detalhes
                              </button>
                            )}
                            {canConfirmAppointment(appt) && (
                              <button type="button" onClick={() => void handleConfirmAppointment(appt)} disabled={confirmingId === appt.id} style={{ border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: confirmingId === appt.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {confirmingId === appt.id ? 'Confirmando...' : 'Confirmar'}
                              </button>
                            )}
                            {canCancelAppointment(appt) && (
                              <button type="button" onClick={() => setConfirmDelete(appt.id)} style={{ border: '1px solid var(--red-100)', background: '#fff', color: 'var(--red-600)', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                Cancelar
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                    {appointments.length > 0 && canOfferAdditionalSlot && (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button type="button" onClick={() => openModal(undefined, selectedDate, slot, '', availableDoctorId)} style={{ border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', borderRadius: 10, padding: '7px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          Agendar outro
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}

              {!dayAvailabilityLoading && visibleSelectedDaySlots.length === 0 && (
                <div style={{ padding: '20px 10px 4px', textAlign: 'center', color: 'var(--gray-400)' }}>
                  <Calendar size={30} style={{ display: 'block', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-600)' }}>
                    {selectedDate < today ? 'Dia encerrado' : 'Nenhum horário disponível'}
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{selectedDate < today ? 'Os horários deste dia já ficaram no histórico.' : canPatientSchedule ? 'Escolha outro médico ou outra data para encontrar horários ativos.' : isPaciente ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerão aqui.' : 'Cadastre a disponibilidade do médico para liberar horários na agenda.'}</div>
                </div>
              )}
            </div>
          </section>
        </div>

        <div style={{ display: period === 'semana' ? 'grid' : 'none', gridTemplateColumns: 'minmax(220px, 260px) minmax(720px, 1fr)', gap: 14, alignItems: 'start' }}>
          <aside style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', padding: 14, position: 'sticky', top: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div>
                <h2 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Agendas</h2>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: '2px 0 0' }}>{activeDoctors.length || doctors.length} médico(s)</p>
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
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{doctor.specialty || 'Clínica geral'}</span>
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)' }}>{count}</span>
                  </button>
                );
              })}
              {doctorSidebarItems.length === 0 && (
                <div style={{ border: '1px dashed var(--gray-200)', borderRadius: 12, padding: 14, color: 'var(--gray-500)', fontSize: 12, lineHeight: 1.5 }}>
                  Nenhum médico disponível para listar.
                </div>
              )}
            </div>
          </aside>

          <section style={{ background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--gray-500)', fontWeight: 700 }}>{period === 'dia' ? formatDateBR(selectedDate) : weekRangeLabel}</div>
                <h2 style={{ fontSize: 16, color: 'var(--gray-800)', fontWeight: 850, margin: '2px 0 0' }}>Calendário de atendimentos</h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => setSelectedDate(today)} style={{ border: '1px solid var(--gray-200)', background: '#fff', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, color: 'var(--gray-700)', cursor: 'pointer' }}>
                  Hoje
                </button>
                {canCreateAgendamento && (
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
                        <div key={`${day.iso}-${slot}`} onDoubleClick={() => canCreateAgendamento && openModal(undefined, day.iso, slot)}
                          style={{ minHeight: 74, padding: 5, borderRight: '1px solid var(--gray-100)', borderBottom: '1px solid var(--gray-100)', background: day.isToday ? '#fcfffd' : '#fff', cursor: canCreateAgendamento ? 'cell' : 'default' }}>
                          {slotItems.map(appt => {
                            const patient = pacientes.find(p => p.id === appt.pacienteId);
                            const doctor = doctors.find(d => d.id === appt.medicoId);
                            return (
                              <button key={appt.id} type="button" onClick={() => !isPaciente && !isElapsedAppointment(appt) && openModal(appt)}
                                style={{ width: '100%', border: '1px solid #fbbf24', background: '#fffbeb', borderRadius: 10, padding: 8, marginBottom: 5, textAlign: 'left', boxShadow: '0 6px 14px rgba(245, 158, 11, 0.12)', cursor: isPaciente || isElapsedAppointment(appt) ? 'default' : 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <span style={{ width: 7, height: 7, borderRadius: 999, background: '#f59e0b', flexShrink: 0 }} />
                                  <span title={patient?.nome || ''} style={{ fontSize: 12, fontWeight: 900, color: 'var(--gray-900)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{patient?.nome || 'Paciente não encontrado'}</span>
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--gray-600)', fontWeight: 700, marginTop: 5 }}>{appt.hora} - {appt.duracao || '30 min'}</div>
                                <div title={doctor?.full_name || ''} style={{ fontSize: 10, color: 'var(--gray-500)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doctor?.full_name || user?.full_name || 'Médico não informado'}</div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 7 }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.tipo}</span>
                                  <StatusBadge status={effectiveAppointmentStatus(appt)} />
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
                <div style={{ fontSize: 12, marginTop: 4 }}>{isPaciente || isMedico ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerão aqui.' : 'Use os filtros, escolha outra data ou crie um novo agendamento.'}</div>
              </div>
            )}
          </section>
        </div>

        <div style={{ display: period === 'todos' ? 'block' : 'none', background: '#fff', borderRadius: 14, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'auto' }}>
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
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center', flexWrap: 'wrap' }}>
                          <StatusBadge status={effectiveAppointmentStatus(appt)} />
                          {canConfirmAppointment(appt) && (
                            <IconButton title="Confirmar consulta" icon={CalendarCheck} color="var(--primary)" onClick={() => void handleConfirmAppointment(appt)} disabled={confirmingId === appt.id} />
                          )}
                          {canPatientSchedule && canCancelAppointment(appt) && (
                            <IconButton title="Cancelar" icon={Trash2} color="var(--red-500)" onClick={() => setConfirmDelete(appt.id)} />
                          )}
                        </div>
                      ) : (
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        {canConfirmAppointment(appt) && (
                          <IconButton title="Confirmar consulta" icon={CalendarCheck} color="var(--primary)" onClick={() => void handleConfirmAppointment(appt)} disabled={confirmingId === appt.id} />
                        )}
                        {!isElapsedAppointment(appt) && <IconButton title="Editar" icon={Pencil} color="var(--amber-600)" onClick={() => openModal(appt)} />}
                        {canCancelAppointment(appt) && <IconButton title="Cancelar" icon={Trash2} color="var(--red-500)" onClick={() => setConfirmDelete(appt.id)} />}
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
                    <div style={{ fontSize: 12, marginTop: 4 }}>{isPaciente || isMedico ? 'Quando houver consultas vinculadas ao seu perfil, elas aparecerão aqui.' : 'Ajuste os filtros ou crie um novo agendamento.'}</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {detailsSlot && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(680px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>Detalhes do horário</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>
                  {formatDateBR(detailsSlot.date)} às {detailsSlot.slot} - {detailsSlotAppointments.length} consulta{detailsSlotAppointments.length === 1 ? '' : 's'}
                </p>
              </div>
              <button onClick={() => setDetailsSlot(null)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)', display: 'grid', gap: 12 }}>
              {detailsSlotAppointments.map(appt => {
                const patient = pacientes.find(p => p.id === appt.pacienteId);
                const doctor = doctors.find(d => d.id === appt.medicoId);
                return (
                  <article key={appt.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 12, padding: 14, background: '#fff', display: 'grid', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900, color: '#071327', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {patient?.nome || 'Paciente não encontrado'}
                        </div>
                        <div style={{ fontSize: 12, color: '#334155', marginTop: 4 }}>
                          {appt.tipo} - {doctor?.full_name || 'Médico não informado'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 3 }}>
                          {doctor?.specialty || 'Especialidade não informada'} · {appt.data.split('-').reverse().join('/')} às {appt.hora}
                        </div>
                      </div>
                      <StatusBadge status={effectiveAppointmentStatus(appt)} />
                    </div>

                    {appt.observacoes && (
                      <div style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5, padding: '9px 10px', borderRadius: 9, background: 'var(--gray-50)', border: '1px solid var(--gray-100)' }}>
                        {appt.observacoes}
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                      {!isPaciente && !isElapsedAppointment(appt) && (
                        <button type="button" onClick={() => { setDetailsSlot(null); openModal(appt); }} style={{ border: '1px solid var(--gray-200)', background: '#fff', color: 'var(--gray-700)', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          Editar
                        </button>
                      )}
                      {canConfirmAppointment(appt) && (
                        <button type="button" onClick={() => void handleConfirmAppointment(appt)} disabled={confirmingId === appt.id} style={{ border: '1px solid var(--primary)', background: '#fff', color: 'var(--primary)', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: confirmingId === appt.id ? 'not-allowed' : 'pointer' }}>
                          {confirmingId === appt.id ? 'Confirmando...' : 'Confirmar'}
                        </button>
                      )}
                      {canCancelAppointment(appt) && (
                        <button type="button" onClick={() => setConfirmDelete(appt.id)} style={{ border: '1px solid var(--red-100)', background: '#fff', color: 'var(--red-600)', borderRadius: 9, padding: '8px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                          Cancelar consulta
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
              {detailsSlotAppointments.length === 0 && (
                <div style={{ padding: 18, border: '1px dashed var(--gray-200)', borderRadius: 12, color: 'var(--gray-500)', textAlign: 'center', fontSize: 13, fontWeight: 700 }}>
                  Nenhuma consulta encontrada neste horário.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modal.open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(760px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>{modal.mode === 'add' ? 'Novo Agendamento' : 'Editar Agendamento'}</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Paciente e horário serão salvos com dados reais do sistema.</p>
              </div>
              <button onClick={closeModal} disabled={saving} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: saving ? 'not-allowed' : 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
              {apiError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {apiError}
                </div>
              )}
              {canPatientSchedule && errors.paciente && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {errors.paciente}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                {!canPatientSchedule && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <label htmlFor="agenda-paciente-search" style={labelStyle}>Paciente <span style={{ color: 'var(--red-500)' }}>*</span></label>
                  {selectedPatient ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--light)', borderRadius: 10, background: 'var(--mint)' }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800 }}>{initials(selectedPatient.nome)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)' }}>{selectedPatient.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{selectedPatient.cpf || '—'} · {selectedPatient.telefone || '—'}</div>
                      </div>
                      {!canPatientSchedule && (
                        <button onClick={() => setField('pacienteId', '')} style={{ width: 28, height: 28, borderRadius: 7, border: 'none', background: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}><X size={13} /></button>
                      )}
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
                )}

                {!isMedico && (
                  <div>
                    <label htmlFor="agenda-medico" style={labelStyle}>Médico <span style={{ color: 'var(--red-500)' }}>*</span></label>
                    <select id="agenda-medico" value={modal.data.medicoId || ''} onChange={e => setModal(m => ({ ...m, data: { ...m.data, medicoId: e.target.value, hora: '' } }))}
                      disabled={saving || modalDoctorOptions.length === 0}
                      style={{ width: '100%', padding: '10px 12px', border: `1px solid ${errors.medico ? 'var(--red-500)' : 'var(--gray-200)'}`, borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' }}>
                      <option value="">{modalDoctorAvailabilityLoading ? 'Carregando disponibilidade...' : 'Selecione o médico'}</option>
                      {modalDoctorOptions.map(d => <option key={d.id} value={d.id}>{d.full_name}{d.specialty ? ` - ${d.specialty}` : ''}{canPatientSchedule && modal.data.data && !modalAvailableDoctorIds.has(d.id) ? ' - sem horários nesta data' : ''}</option>)}
                    </select>
                    {errors.medico && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{errors.medico}</span>}
                    {!errors.medico && modalDoctorAvailabilityError && <span style={{ fontSize: 11, color: 'var(--red-500)' }}>{modalDoctorAvailabilityError}</span>}
                    {!errors.medico && !modalDoctorAvailabilityError && canPatientSchedule && modal.data.data && !modalDoctorAvailabilityLoading && doctors.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Nenhum médico ativo encontrado.</span>
                    )}
                    {!errors.medico && !modalDoctorAvailabilityError && canPatientSchedule && modal.data.data && !modalDoctorAvailabilityLoading && doctors.length > 0 && !hasModalAvailabilityForDate && (
                      <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>Ainda não há disponibilidade ativa cadastrada para esta data.</span>
                    )}
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

                {selectedPatient && !canPatientSchedule && (
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

      {availabilityModal.open && canManageAvailability && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 'clamp(8px, 2vw, 16px)' }}>
          <div style={{ background: '#fff', borderRadius: 18, width: 'min(620px, calc(100vw - 16px))', maxHeight: 'calc(100dvh - 16px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--gray-800)', margin: 0 }}>{availabilityModal.data.id ? 'Editar disponibilidade' : 'Criar disponibilidade'}</h2>
                <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 3 }}>Os horários da agenda serão montados a partir da disponibilidade ativa do médico.</p>
              </div>
              <button onClick={closeAvailabilityModal} disabled={availabilitySaving || Boolean(availabilityDeletingId) || Boolean(availabilityTogglingId)} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--gray-100)', cursor: availabilitySaving || availabilityDeletingId || availabilityTogglingId ? 'not-allowed' : 'pointer' }}><X size={15} /></button>
            </div>

            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
              {availabilitySaveError && (
                <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', border: '1px solid var(--red-100)', marginBottom: 14, fontSize: 13, fontWeight: 600 }}>
                  <AlertCircle size={15} /> {availabilitySaveError}
                </div>
              )}

              <div style={{ border: '1px solid var(--gray-100)', borderRadius: 12, overflow: 'hidden', marginBottom: 16, background: '#fff' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)' }}>Disponibilidades cadastradas</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                      {availabilityModal.data.doctor_id ? availabilityDoctorName(availabilityModal.data.doctor_id) : 'Todos os médicos'}
                    </div>
                    {!availabilityRulesLoading && availabilityRules.length > 0 && (() => {
                      const summary = availabilityRulesSummary(availabilityRules);
                      const parts = [
                        `${summary.total} ${summary.total === 1 ? 'faixa' : 'faixas'}`,
                        summary.singleSlotMinutes != null ? `${summary.singleSlotMinutes} min` : null,
                        summary.inactive > 0 ? `${summary.inactive} inativa${summary.inactive > 1 ? 's' : ''}` : null,
                      ].filter(Boolean);
                      return (
                        <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4, fontWeight: 600 }}>
                          {parts.join(' · ')}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {availabilityRulesError && (
                  <div role="alert" style={{ padding: '10px 14px', color: 'var(--red-600)', fontSize: 12, fontWeight: 700 }}>
                    {availabilityRulesError}
                  </div>
                )}

                {availabilityRulesLoading ? (
                  <div style={{ padding: '18px 14px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-500)', fontSize: 13, fontWeight: 700 }}>
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando disponibilidades...
                  </div>
                ) : availabilityRules.length === 0 ? (
                  <div style={{ padding: '18px 14px', color: 'var(--gray-400)', fontSize: 13 }}>
                    Nenhuma disponibilidade cadastrada para este recorte.
                  </div>
                ) : (
                  <div style={{ display: 'grid' }}>
                    {(() => {
                      const summary = availabilityRulesSummary(availabilityRules);
                      const showDoctor = summary.multipleDoctors && !availabilityModal.data.doctor_id;
                      const showDuration = summary.singleSlotMinutes === null;
                      return groupAvailabilityByWeekday(availabilityRules).map(({ day, rules }) => (
                        <div
                          key={day.value}
                          style={{
                            padding: '10px 14px',
                            display: 'grid',
                            gridTemplateColumns: 'minmax(64px, 76px) minmax(0, 1fr)',
                            gap: '8px 12px',
                            alignItems: 'start',
                            borderTop: '1px solid var(--gray-50)',
                          }}
                        >
                          <div style={{ paddingTop: 7 }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-700)', lineHeight: 1.2 }} title={day.label}>
                              {WEEKDAY_SHORT[day.value]}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--gray-400)', fontWeight: 700, marginTop: 2 }}>
                              {rules.length} {rules.length === 1 ? 'faixa' : 'faixas'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {rules.map(rule => {
                              const selected = availabilityModal.data.id === rule.id;
                              const deleting = availabilityDeletingId === rule.id;
                              const toggling = availabilityTogglingId === rule.id;
                              const inactive = rule.active === false;
                              const actionDisabled = availabilitySaving || deleting || toggling || Boolean(availabilityDeletingId) || Boolean(availabilityTogglingId);
                              const metaParts = [
                                showDoctor ? availabilityDoctorName(rule.doctor_id) : null,
                                showDuration ? `${rule.slot_minutes} min` : null,
                                inactive ? 'Inativa' : null,
                              ].filter(Boolean);
                              return (
                                <div
                                  key={rule.id}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    padding: '6px 8px 6px 10px',
                                    borderRadius: 10,
                                    border: `1px solid ${selected ? 'rgba(15,118,75,0.35)' : 'var(--gray-200)'}`,
                                    background: selected ? '#ecfdf5' : inactive ? 'var(--gray-50)' : '#fff',
                                    opacity: inactive ? 0.72 : 1,
                                    maxWidth: '100%',
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => editAvailability(rule)}
                                    disabled={actionDisabled}
                                    title={`${day.label}: ${normalizeTime(rule.start_time)} às ${normalizeTime(rule.end_time)}${metaParts.length ? ` (${metaParts.join(' · ')})` : ''}`}
                                    style={{
                                      border: 'none',
                                      background: 'transparent',
                                      padding: 0,
                                      margin: 0,
                                      cursor: actionDisabled ? 'not-allowed' : 'pointer',
                                      textAlign: 'left',
                                      minWidth: 0,
                                    }}
                                  >
                                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-800)', whiteSpace: 'nowrap' }}>
                                      {normalizeTime(rule.start_time)} – {normalizeTime(rule.end_time)}
                                    </span>
                                    {metaParts.length > 0 && (
                                      <span style={{ display: 'block', fontSize: 10, color: 'var(--gray-500)', fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>
                                        {metaParts.join(' · ')}
                                      </span>
                                    )}
                                  </button>
                                  <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                                    {canToggleAvailability && (
                                      <button
                                        type="button"
                                        onClick={() => void handleToggleAvailability(rule)}
                                        disabled={actionDisabled}
                                        title={inactive ? 'Ativar disponibilidade' : 'Desativar disponibilidade'}
                                        aria-label={inactive ? 'Ativar disponibilidade' : 'Desativar disponibilidade'}
                                        style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: inactive ? 'var(--primary)' : 'var(--gray-500)', cursor: actionDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                      >
                                        {toggling ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : inactive ? <Power size={13} /> : <PowerOff size={13} />}
                                      </button>
                                    )}
                                    <button type="button" onClick={() => editAvailability(rule)} disabled={actionDisabled} title="Editar disponibilidade" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--amber-600)', cursor: actionDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      <Pencil size={13} />
                                    </button>
                                    <button type="button" onClick={() => void handleDeleteAvailability(rule)} disabled={actionDisabled} title="Excluir disponibilidade" style={{ width: 26, height: 26, borderRadius: 7, border: 'none', background: 'transparent', color: 'var(--red-500)', cursor: actionDisabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {deleting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={13} />}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

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
                  {canToggleAvailability ? (
                    <label htmlFor="availability-active" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', padding: '10px 0', cursor: availabilitySaving ? 'not-allowed' : 'pointer' }}>
                      <input id="availability-active" type="checkbox" checked={availabilityModal.data.active} onChange={e => setAvailabilityField('active', e.target.checked)}
                        disabled={availabilitySaving}
                        style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
                      Disponibilidade ativa
                    </label>
                  ) : (
                    <div style={{ padding: '10px 0' }}>
                      <div style={labelStyle}>Status</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: availabilityModal.data.active ? 'var(--primary)' : 'var(--gray-500)' }}>
                        {availabilityModal.data.active ? 'Ativa' : 'Inativa'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 24px', background: 'var(--gray-50)', borderTop: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={closeAvailabilityModal} disabled={availabilitySaving || Boolean(availabilityDeletingId) || Boolean(availabilityTogglingId)} style={{ padding: '9px 20px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, cursor: availabilitySaving || availabilityDeletingId || availabilityTogglingId ? 'not-allowed' : 'pointer' }}>Cancelar</button>
              <button onClick={handleSaveAvailability} disabled={availabilitySaving || Boolean(availabilityDeletingId) || Boolean(availabilityTogglingId)} style={{ padding: '9px 22px', border: 'none', borderRadius: 10, background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: availabilitySaving || availabilityDeletingId || availabilityTogglingId ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                {availabilitySaving ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : <><Clock size={14} /> {availabilityModal.data.id ? 'Salvar alterações' : 'Salvar disponibilidade'}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001, padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 24, maxWidth: 380, width: '100%', boxShadow: '0 12px 32px rgba(0,0,0,0.15)' }}>
            <AlertCircle size={24} color="var(--red-500)" />
            <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)', margin: '12px 0 6px' }}>Cancelar agendamento?</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5 }}>Esta ação marcará a consulta como cancelada.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '9px 16px', border: '1px solid var(--gray-200)', borderRadius: 9, background: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleDelete} style={{ padding: '9px 16px', border: 'none', borderRadius: 9, background: 'var(--red-500)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>Cancelar consulta</button>
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
    <div style={{ border: '1px solid rgba(15,118,75,0.10)', background: 'rgba(255,255,255,0.78)', borderRadius: 14, padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
        <Icon size={16} />
      </div>
      <div>
        <div style={{ fontSize: 11, color: '#475569', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
        <div style={{ fontSize: 21, color: '#071327', fontWeight: 800 }}>{value}</div>
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

function StatusLegendItem({ status, count }: { status: Agendamento['status']; count: number }) {
  const st = STATUS_LABEL[status] ?? STATUS_LABEL.pendente;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, fontSize: 12 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontWeight: 700 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: st.color }} />
        {st.label}
      </span>
      <strong style={{ color: '#071327', fontWeight: 900 }}>{count}</strong>
    </div>
  );
}

function StatLine({ label, value, tone }: { label: string; value: number | string; tone?: 'green' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', fontSize: 13 }}>
      <span style={{ color: '#334155', fontWeight: 500 }}>{label}</span>
      <strong style={{ color: tone === 'green' ? 'var(--primary)' : '#071327', fontWeight: 900 }}>{value}</strong>
    </div>
  );
}

function IconButton({ title, icon: Icon, color, onClick, disabled = false }: { title: string; icon: React.ElementType; color: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button title={title} onClick={onClick} disabled={disabled} style={{ width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent', color, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
