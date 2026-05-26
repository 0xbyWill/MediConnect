import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Brain, CalendarClock, CheckCircle2, Loader2, MessageSquare, RefreshCw, Send, XCircle } from 'lucide-react';
import type { Agendamento, Paciente, QueueAdvanceOffer, QueueAvailableSlot, QueueCandidate, QueueSuggestion } from '../types';
import type { ApiDoctor, ApiDoctorAvailability } from '../lib/api';
import { availabilityApi, smsApi } from '../lib/api';
import { queueAiApi } from '../lib/aiApi';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';
import { normalizePhoneBRForSms } from '../shared/utils/validation';
import {
  buildAdvanceOfferMessage,
  buildAllQueueCandidates,
  buildQueueCandidates,
  isSameSpecialty,
  sortQueueCandidates,
  validateGeminiQueueSuggestion,
} from '../shared/utils/advanceQueue';

interface FilaPrioridadeProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  doctors: ApiDoctor[];
  onUpdateAppointment: (a: Agendamento) => Promise<void>;
}

const OFFERS_KEY = 'mc_advance_queue_offers';
const LOOKAHEAD_DAYS = 14;

export default function FilaPrioridade({ pacientes, agendamentos, doctors, onUpdateAppointment }: FilaPrioridadeProps) {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<ApiDoctorAvailability[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [offers, setOffers] = useState<QueueAdvanceOffer[]>(readOffers);
  const [suggestion, setSuggestion] = useState<QueueSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [sendingId, setSendingId] = useState('');
  const [applyingId, setApplyingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const slots = useMemo(() => buildAvailableSlots({ availability, agendamentos, doctors }), [agendamentos, availability, doctors]);
  const filteredSlots = useMemo(() => slots.filter(slot =>
    (!specialtyFilter || slot.specialty === specialtyFilter)
  ), [slots, specialtyFilter]);
  const doctorSlotOptions = useMemo(() => {
    const byDoctor = new Map<string, QueueAvailableSlot>();
    filteredSlots.forEach(slot => {
      if (!byDoctor.has(slot.doctorId)) byDoctor.set(slot.doctorId, slot);
    });
    return Array.from(byDoctor.values());
  }, [filteredSlots]);
  const selectedSlot = slots.find(slot => slot.id === selectedSlotId) ?? null;
  const doctorSpecialties = useMemo(() => Array.from(new Set(doctors.map(doctor => doctor.specialty).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [doctors]);
  const refusalCounts = useMemo(() => offers.reduce<Record<string, number>>((acc, offer) => {
    if (offer.status === 'declined') acc[offer.candidatePatientId] = (acc[offer.candidatePatientId] ?? 0) + 1;
    return acc;
  }, {}), [offers]);
  const candidates = useMemo(() => {
    const base = selectedSlot
      ? buildQueueCandidates({
          slotSpecialty: selectedSlot.specialty,
          slotDate: selectedSlot.date,
          slotTime: selectedSlot.time,
          patients: pacientes,
          appointments: agendamentos,
          doctors,
          refusalCounts,
        })
      : buildAllQueueCandidates({
          patients: pacientes,
          appointments: agendamentos,
          doctors,
          refusalCounts,
    });
    return base.filter(candidate =>
      (!selectedSlot || isSameSpecialty(candidate.specialty, selectedSlot.specialty)) &&
      (!specialtyFilter || candidate.specialty === specialtyFilter)
    );
  }, [agendamentos, doctors, pacientes, refusalCounts, selectedSlot, specialtyFilter]);
  const orderedCandidates = useMemo(() => {
    if (!suggestion || !selectedSlot) return sortQueueCandidates(candidates);
    const byId = new Map(candidates.map(candidate => [candidate.patientId, candidate]));
    return suggestion.orderedPatientIds
      .map(id => byId.get(id))
      .filter((candidate): candidate is QueueCandidate => Boolean(candidate && isSameSpecialty(candidate.specialty, selectedSlot.specialty)));
  }, [candidates, selectedSlot, suggestion]);

  useEffect(() => {
    localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
    window.dispatchEvent(new Event('mc-advance-offers-updated'));
  }, [offers]);

  const loadAvailability = async () => {
    if (user?.role !== 'gestao') return;
    setLoading(true);
    setError('');
    try {
      const rows = await availabilityApi.list({ active: true });
      setAvailability(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar vagas da agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    setSuggestion(null);
  }, [selectedSlotId]);

  useEffect(() => {
    if (!selectedSlot) return;
    if (specialtyFilter && selectedSlot.specialty !== specialtyFilter) {
      setSelectedSlotId('');
    }
  }, [selectedSlot, specialtyFilter]);

  if (user?.role !== 'gestao') {
    return (
      <div style={{ padding: 32 }}>
        <div role="alert" style={{ border: '1px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: 12, padding: 14, fontWeight: 700 }}>
          A fila de prioridade é restrita ao perfil Gestão.
        </div>
      </div>
    );
  }

  const runAiSuggestion = async () => {
    if (!selectedSlot) return;
    setAiLoading(true);
    setError('');
    try {
      const response = await queueAiApi.suggestOrder({
        specialty: selectedSlot.specialty,
        slotDate: selectedSlot.date,
        slotTime: selectedSlot.time,
        candidates,
      });
      const validated = validateGeminiQueueSuggestion(
        candidates.map(candidate => candidate.patientId),
        response.orderedPatientIds,
        selectedSlot.specialty,
        candidates
      );
      setSuggestion({ ...validated, warnings: [...validated.warnings, ...response.warnings] });
    } catch (err) {
      setSuggestion({
        orderedPatientIds: sortQueueCandidates(candidates).map(candidate => candidate.patientId),
        source: 'fallback',
        warnings: [err instanceof Error ? err.message : 'Gemini indisponível; fallback determinístico aplicado.'],
      });
    } finally {
      setAiLoading(false);
    }
  };

  const sendOffer = async (candidate: QueueCandidate) => {
    if (!selectedSlot) return;
    const duplicate = offers.some(offer =>
      offer.slotId === selectedSlot.id &&
      offer.candidatePatientId === candidate.patientId &&
      ['pending', 'sent', 'accepted'].includes(offer.status)
    );
    if (duplicate) {
      setError('Já existe oferta enviada ou pendente para este paciente nesta vaga.');
      return;
    }

    const patient = pacientes.find(item => item.id === candidate.patientId);
    const phone = normalizePhoneBRForSms(patient?.telefone ?? '');
    if (!patient || !phone) {
      setError('Paciente sem telefone válido para SMS.');
      return;
    }

    setSendingId(candidate.patientId);
    setError('');
    setSuccess('');
    const offerId = `${selectedSlot.id}:${candidate.patientId}:${Date.now()}`;
    const message = buildAdvanceOfferMessage({
      patientName: candidate.patientName,
      specialty: selectedSlot.specialty,
      date: selectedSlot.date,
      time: selectedSlot.time,
    });

    try {
      const response = await smsApi.send({ patient_id: patient.id, phone_number: phone, message });
      if (response.success === false) throw new Error(response.message || 'A API não confirmou o envio do SMS.');
      setOffers(current => [...current, {
        id: offerId,
        slotId: selectedSlot.id,
        candidatePatientId: candidate.patientId,
        appointmentId: candidate.appointmentId,
        slotDoctorId: selectedSlot.doctorId,
        slotDate: selectedSlot.date,
        slotTime: selectedSlot.time,
        slotSpecialty: selectedSlot.specialty,
        status: 'sent',
        sentAt: new Date().toISOString(),
        smsSid: response.sid,
      }]);
      setSuccess('Oferta enviada por SMS. Aguarde aceite/recusa antes de remarcar.');
    } catch (err) {
      setOffers(current => [...current, {
        id: offerId,
        slotId: selectedSlot.id,
        candidatePatientId: candidate.patientId,
        appointmentId: candidate.appointmentId,
        slotDoctorId: selectedSlot.doctorId,
        slotDate: selectedSlot.date,
        slotTime: selectedSlot.time,
        slotSpecialty: selectedSlot.specialty,
        status: 'failed',
        sentAt: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Falha ao enviar SMS.',
      }]);
      setError(err instanceof Error ? err.message : 'Falha ao enviar SMS.');
    } finally {
      setSendingId('');
    }
  };

  const markDeclined = (candidate: QueueCandidate) => {
    if (!selectedSlot) return;
    const openOffer = findLatestOffer(offers, selectedSlot.id, candidate.patientId);
    setError('');
    setSuccess('');
    if (!openOffer) {
      setOffers(current => [...current, buildLocalOffer(selectedSlot, candidate, 'declined')]);
    } else {
      setOffers(current => current.map(offer => offer.id === openOffer.id
        ? { ...offer, status: 'declined', respondedAt: new Date().toISOString() }
        : offer));
    }
    setSuccess('Recusa registrada. A consulta original foi mantida.');
  };

  const acceptOffer = async (candidate: QueueCandidate) => {
    if (!selectedSlot) return;
    const openOffer = findLatestOffer(offers, selectedSlot.id, candidate.patientId);
    const appointment = agendamentos.find(appt => appt.id === candidate.appointmentId);
    if (!appointment) {
      setError('Consulta original não encontrada.');
      return;
    }
    if (hasConflict(agendamentos, selectedSlot, appointment.id)) {
      setError('A vaga foi ocupada por outra consulta. Atualize a fila.');
      return;
    }

    setApplyingId(candidate.patientId);
    setError('');
    try {
      await onUpdateAppointment({
        ...appointment,
        medicoId: selectedSlot.doctorId,
        data: selectedSlot.date,
        hora: selectedSlot.time,
        status: 'confirmado',
      });
      if (!openOffer) {
        setOffers(current => [...current, buildLocalOffer(selectedSlot, candidate, 'accepted')]);
      } else {
        setOffers(current => current.map(offer => offer.id === openOffer.id
          ? { ...offer, status: 'accepted', respondedAt: new Date().toISOString() }
          : offer));
      }
      setSuccess('Antecipação confirmada e consulta remarcada.');
      await loadAvailability();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remarcar consulta.');
    } finally {
      setApplyingId('');
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '30px clamp(18px, 4vw, 36px)', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#071327', margin: 0, lineHeight: 1.15 }}>Fila de Prioridade</h1>
          <p style={{ fontSize: 14, color: '#334155', marginTop: 6 }}>Antecipe consultas por especialidade, prioridade operacional e aceite do paciente.</p>
        </div>
        <button type="button" onClick={() => void loadAvailability()} disabled={loading} style={buttonStyle('#fff', 'var(--primary)', '1px solid rgba(0,166,63,0.28)')}>
          {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />} Atualizar
        </button>
      </div>

      {error && <Alert tone="error" text={error} />}
      {success && <Alert tone="success" text={success} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(min(100%, 320px), 0.8fr) minmax(min(100%, 480px), 1.2fr)', gap: 20, alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <CalendarClock size={19} color="var(--primary)" />
            <h2 style={sectionTitleStyle}>Vagas elegíveis</h2>
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 14 }}>
            <div>
              <label htmlFor="queue-specialty-filter" style={labelStyle}>Especialidade</label>
              <select id="queue-specialty-filter" value={specialtyFilter} onChange={event => setSpecialtyFilter(event.target.value)} style={fieldStyle}>
                <option value="">Todas as especialidades</option>
                {doctorSpecialties.map(specialty => <option key={specialty} value={specialty}>{specialty}</option>)}
              </select>
            </div>
          </div>

          <label htmlFor="queue-slot" style={labelStyle}>Médico com vaga</label>
          <select id="queue-slot" value={selectedSlotId} onChange={event => setSelectedSlotId(event.target.value)} style={fieldStyle} disabled={loading || slots.length === 0}>
            <option value="">{doctorSlotOptions.length === 0 ? 'Nenhum médico com vaga futura' : 'Todos os médicos / visão geral'}</option>
            {doctorSlotOptions.map(slot => (
              <option key={slot.id} value={slot.id}>
                {slot.doctorName} - {slot.specialty}
              </option>
            ))}
          </select>

          {selectedSlot && (
            <div style={{ marginTop: 16, display: 'grid', gap: 8, fontSize: 13, color: '#334155' }}>
              <strong style={{ color: '#071327' }}>{selectedSlot.doctorName}</strong>
              <span>{selectedSlot.specialty}</span>
              <span>Próxima vaga: {formatDateBR(selectedSlot.date)} às {selectedSlot.time}</span>
              <span>{selectedSlot.source === 'cancelled' ? 'Origem: consulta cancelada' : 'Origem: disponibilidade ativa'}</span>
            </div>
          )}
          {!selectedSlot && (
            <div style={{ marginTop: 16, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
              Modo geral ativo: exibindo todos os pacientes com consultas futuras. Selecione uma vaga apenas quando quiser montar a chamada para antecipação.
            </div>
          )}
        </section>

        <section style={panelStyle}>
          <div style={{ ...sectionHeaderStyle, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Brain size={19} color="var(--primary)" />
              <h2 style={sectionTitleStyle}>Sequência sugerida</h2>
            </div>
            <button type="button" onClick={() => void runAiSuggestion()} disabled={!selectedSlot || candidates.length === 0 || aiLoading} style={buttonStyle('var(--primary)', '#fff', 'none')}>
              {aiLoading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={15} />} Ordenar com IA
            </button>
          </div>

          {suggestion && (
            <div style={{ fontSize: 12, color: '#475569', marginBottom: 12 }}>
              Fonte: {suggestion.source === 'gemini' ? 'Gemini validado' : 'fallback determinístico'}
              {suggestion.warnings.length > 0 && ` - ${suggestion.warnings[0]}`}
            </div>
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {orderedCandidates.map((candidate, index) => {
              const offer = selectedSlot ? findLatestOffer(offers, selectedSlot.id, candidate.patientId) : null;
              return (
                <article key={candidate.appointmentId} style={{ border: '1px solid #dbe7e2', borderRadius: 10, padding: 14, background: '#fff', display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 13, color: '#64748b', fontWeight: 800 }}>#{index + 1} - NPS {candidate.priorityLevel}</div>
                      <h3 style={{ fontSize: 16, margin: '3px 0 0', color: '#071327' }}>{candidate.patientName}</h3>
                    </div>
                    <StatusPill status={offer?.status ?? 'pending'} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, fontSize: 12, color: '#334155' }}>
                    <span>Prioridade: {candidate.priorityValue}/5</span>
                    <span>Espera: {candidate.waitingDays} dia(s)</span>
                    <span>Consulta: {formatDateBR(candidate.originalDate)} {candidate.originalTime}</span>
                    <span>Recusas: {candidate.refusalCount}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => void sendOffer(candidate)} disabled={!selectedSlot || sendingId === candidate.patientId || Boolean(offer && ['sent', 'accepted'].includes(offer.status))} style={buttonStyle('#fff', 'var(--primary)', '1px solid rgba(0,166,63,0.28)')}>
                      {sendingId === candidate.patientId ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />} Enviar oferta
                    </button>
                    <button type="button" onClick={() => void acceptOffer(candidate)} disabled={!selectedSlot || offer?.status === 'accepted' || applyingId === candidate.patientId} style={buttonStyle('var(--primary)', '#fff', 'none')}>
                      {applyingId === candidate.patientId ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />} Aceite recebido
                    </button>
                    <button type="button" onClick={() => markDeclined(candidate)} disabled={!selectedSlot || offer?.status === 'declined' || offer?.status === 'accepted'} style={buttonStyle('#fff', 'var(--red-600)', '1px solid var(--red-100)')}>
                      <XCircle size={14} /> Recusou
                    </button>
                  </div>
                  {!candidate.canReceiveSms && <div style={{ fontSize: 12, color: 'var(--red-600)', fontWeight: 700 }}>Paciente sem telefone para SMS.</div>}
                </article>
              );
            })}
            {!selectedSlot && orderedCandidates.length > 0 && <Empty text="Selecione uma vaga para enviar oferta ou confirmar antecipação." />}
            {selectedSlot && orderedCandidates.length === 0 && <Empty text="Nenhum paciente elegível da mesma especialidade para esta vaga." />}
            {!selectedSlot && orderedCandidates.length === 0 && <Empty text="Nenhum paciente futuro encontrado para os filtros atuais." />}
          </div>
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function buildAvailableSlots(params: { availability: ApiDoctorAvailability[]; agendamentos: Agendamento[]; doctors: ApiDoctor[] }): QueueAvailableSlot[] {
  const today = dateToISO(new Date());
  const doctorById = new Map(params.doctors.map(doctor => [doctor.id, doctor]));
  const slots: QueueAvailableSlot[] = [];

  for (let dayOffset = 0; dayOffset < LOOKAHEAD_DAYS; dayOffset += 1) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    const iso = dateToISO(date);
    const weekday = date.getDay();
    params.availability.filter(rule => rule.active !== false && rule.weekday === weekday).forEach(rule => {
      const doctor = doctorById.get(rule.doctor_id);
      if (!doctor?.specialty) return;
      const start = timeToMinutes(rule.start_time);
      const end = timeToMinutes(rule.end_time);
      if (start === null || end === null || end <= start) return;
      const step = Math.max(30, rule.slot_minutes || 30);
      for (let current = start; current < end; current += step) {
        const time = minutesToTime(current);
        if (`${iso} ${time}` <= `${today} ${currentTime()}`) continue;
        if (hasConflict(params.agendamentos, { doctorId: doctor.id, date: iso, time }, '')) continue;
        slots.push({ id: `availability:${doctor.id}:${iso}:${time}`, doctorId: doctor.id, doctorName: doctor.full_name, specialty: doctor.specialty, date: iso, time, source: 'availability' });
      }
    });
  }

  params.agendamentos
    .filter(appt => appt.status === 'cancelado' && appt.data >= today && appt.medicoId)
    .forEach(appt => {
      const doctor = appt.medicoId ? doctorById.get(appt.medicoId) : undefined;
      if (!doctor?.specialty || hasConflict(params.agendamentos, { doctorId: doctor.id, date: appt.data, time: appt.hora }, appt.id)) return;
      slots.push({ id: `cancelled:${appt.id}`, doctorId: doctor.id, doctorName: doctor.full_name, specialty: doctor.specialty, date: appt.data, time: appt.hora, source: 'cancelled', cancelledAppointmentId: appt.id });
    });

  const unique = new Map(slots.map(slot => [`${slot.doctorId}:${slot.date}:${slot.time}`, slot]));
  return Array.from(unique.values()).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

function hasConflict(agendamentos: Agendamento[], slot: Pick<QueueAvailableSlot, 'doctorId' | 'date' | 'time'>, ignoreAppointmentId: string) {
  return agendamentos.some(appt =>
    appt.id !== ignoreAppointmentId &&
    appt.medicoId === slot.doctorId &&
    appt.data === slot.date &&
    appt.hora === slot.time &&
    appt.status !== 'cancelado'
  );
}

function readOffers(): QueueAdvanceOffer[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFERS_KEY) || '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is QueueAdvanceOffer => Boolean(item && typeof item === 'object' && 'id' in item)) : [];
  } catch {
    return [];
  }
}

function findLatestOffer(offers: QueueAdvanceOffer[], slotId: string, patientId: string) {
  return [...offers].reverse().find(offer => offer.slotId === slotId && offer.candidatePatientId === patientId && offer.status !== 'failed');
}

function buildLocalOffer(slot: QueueAvailableSlot, candidate: QueueCandidate, status: 'accepted' | 'declined'): QueueAdvanceOffer {
  const now = new Date().toISOString();
  return {
    id: `${slot.id}:${candidate.patientId}:manual:${Date.now()}`,
    slotId: slot.id,
    candidatePatientId: candidate.patientId,
    appointmentId: candidate.appointmentId,
    slotDoctorId: slot.doctorId,
    slotDate: slot.date,
    slotTime: slot.time,
    slotSpecialty: slot.specialty,
    status,
    sentAt: now,
    respondedAt: now,
  };
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function minutesToTime(value: number) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function formatDateBR(iso: string) {
  const [, month, day] = iso.split('-');
  return `${day}/${month}`;
}

function Alert({ tone, text }: { tone: 'error' | 'success'; text: string }) {
  const error = tone === 'error';
  return (
    <div role={error ? 'alert' : 'status'} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, background: error ? 'var(--red-50)' : 'var(--mint)', color: error ? 'var(--red-600)' : 'var(--dark)', border: `1px solid ${error ? 'var(--red-100)' : '#b7ebc7'}`, marginBottom: 14, fontSize: 13, fontWeight: 700 }}>
      {error ? <AlertCircle size={15} /> : <MessageSquare size={15} />} {text}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ border: '1px dashed #dbe7e2', borderRadius: 10, padding: 18, textAlign: 'center', color: '#64748b', fontSize: 13, fontWeight: 700 }}>{text}</div>;
}

function StatusPill({ status }: { status: QueueAdvanceOffer['status'] }) {
  const label: Record<QueueAdvanceOffer['status'], string> = {
    pending: 'Pendente',
    sent: 'Enviada',
    accepted: 'Aceita',
    declined: 'Recusada',
    expired: 'Expirada',
    failed: 'Falhou',
  };
  return <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 20, background: status === 'accepted' ? 'var(--mint)' : status === 'declined' || status === 'failed' ? 'var(--red-50)' : 'var(--amber-100)', color: status === 'accepted' ? 'var(--dark)' : status === 'declined' || status === 'failed' ? 'var(--red-600)' : 'var(--amber-600)' }}>{label[status]}</span>;
}

const panelStyle: CSSProperties = { background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, padding: 20, boxShadow: 'none' };
const sectionHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 };
const sectionTitleStyle: CSSProperties = { fontSize: 17, fontWeight: 800, color: '#071327', margin: 0 };
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 };
const fieldStyle: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' };
function buttonStyle(background: string, color: string, border: string): CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 13px', background, color, border, borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer' };
}
