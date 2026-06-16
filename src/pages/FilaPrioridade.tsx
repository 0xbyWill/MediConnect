import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarClock, CheckCircle2, Loader2, MessageSquare, RefreshCw, Send, XCircle } from 'lucide-react';
import type { Agendamento, Paciente, QueueAdvanceOffer, QueueAvailableSlot, QueueCandidate, QueueSuggestion } from '../types';
import type { ApiDoctor } from '../lib/api';
import { smsApi } from '../lib/api';
import { queueAiApi } from '../lib/aiApi';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PAGES } from '../shared/constants/roles';
import { dateToISO, timeToHHMM } from '../shared/utils/date';
import { normalizePhoneBRForSms } from '../shared/utils/validation';
import { toUserFacingErrorMessage } from '../shared/utils/errors';
import {
  buildAdvanceOfferMessage,
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
export default function FilaPrioridade({ pacientes, agendamentos, doctors, onUpdateAppointment }: FilaPrioridadeProps) {
  const { user } = useAuth();
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [specialtyFilter, setSpecialtyFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [offers, setOffers] = useState<QueueAdvanceOffer[]>(readOffers);
  const [suggestion, setSuggestion] = useState<QueueSuggestion | null>(null);
  const [sendingId, setSendingId] = useState('');
  const [applyingId, setApplyingId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const slots = useMemo(() => buildCancelledSlots({ agendamentos, doctors, offers }), [agendamentos, doctors, offers]);
  const reschedulableSlots = useMemo(() => slots.filter(slot =>
    buildQueueCandidates({
      slotDoctorId: slot.doctorId,
      slotSpecialty: slot.specialty,
      slotDate: slot.date,
      slotTime: slot.time,
      patients: pacientes,
      appointments: agendamentos,
      doctors,
    }).length > 0
  ), [agendamentos, doctors, pacientes, slots]);
  const filteredSlots = useMemo(() => reschedulableSlots.filter(slot =>
    (!specialtyFilter || slot.specialty === specialtyFilter) &&
    (!doctorFilter || slot.doctorId === doctorFilter) &&
    (!monthFilter || slot.date.startsWith(monthFilter))
  ), [doctorFilter, monthFilter, reschedulableSlots, specialtyFilter]);
  const selectedSlot = slots.find(slot => slot.id === selectedSlotId) ?? null;
  const doctorSpecialties = useMemo(() => Array.from(new Set(doctors.map(doctor => doctor.specialty).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [doctors]);
  const doctorOptions = useMemo(() => {
    const doctorIdsWithSlots = new Set(reschedulableSlots.map(slot => slot.doctorId));
    return doctors
      .filter(doctor => doctorIdsWithSlots.has(doctor.id))
      .sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [doctors, reschedulableSlots]);
  const refusalCounts = useMemo(() => offers.reduce<Record<string, number>>((acc, offer) => {
    if (offer.status === 'declined') acc[offer.candidatePatientId] = (acc[offer.candidatePatientId] ?? 0) + 1;
    return acc;
  }, {}), [offers]);
  const candidates = useMemo(() => {
    if (!selectedSlot) return [];
    return buildQueueCandidates({
      slotDoctorId: selectedSlot.doctorId,
      slotSpecialty: selectedSlot.specialty,
      slotDate: selectedSlot.date,
      slotTime: selectedSlot.time,
      patients: pacientes,
      appointments: agendamentos,
      doctors,
      refusalCounts,
    }).filter(candidate =>
      candidate.doctorId === selectedSlot.doctorId &&
      (!selectedSlot.specialty || isSameSpecialty(candidate.specialty, selectedSlot.specialty)) &&
      (!specialtyFilter || candidate.specialty === specialtyFilter)
    );
  }, [agendamentos, doctors, pacientes, refusalCounts, selectedSlot, specialtyFilter]);
  const orderedCandidates = useMemo(() => {
    if (!suggestion || !selectedSlot) return sortQueueCandidates(candidates);
    const byId = new Map(candidates.map(candidate => [candidate.patientId, candidate]));
    return suggestion.orderedPatientIds
      .map(id => byId.get(id))
      .filter((candidate): candidate is QueueCandidate => Boolean(candidate && (!selectedSlot.specialty || isSameSpecialty(candidate.specialty, selectedSlot.specialty))));
  }, [candidates, selectedSlot, suggestion]);
  const sentOffersCount = offers.filter(offer => ['sent', 'accepted'].includes(offer.status)).length;
  const acceptedOffersCount = offers.filter(offer => offer.status === 'accepted').length;

  useEffect(() => {
    localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
    window.dispatchEvent(new Event('mc-advance-offers-updated'));
  }, [offers]);

  useEffect(() => {
    setSuggestion(null);
  }, [selectedSlotId]);

  useEffect(() => {
    if (!selectedSlot || candidates.length === 0) {
      setSuggestion(null);
      return;
    }

    let active = true;
    queueAiApi.suggestOrder({
      specialty: selectedSlot.specialty,
      slotDate: selectedSlot.date,
      slotTime: selectedSlot.time,
      candidates,
    })
      .then(response => {
        if (!active) return;
        const validated = validateGeminiQueueSuggestion(
          candidates.map(candidate => candidate.patientId),
          response.orderedPatientIds,
          selectedSlot.specialty,
          candidates
        );
        setSuggestion({ ...validated, warnings: [...validated.warnings, ...response.warnings] });
      })
      .catch(() => {
        if (!active) return;
        setSuggestion({
          orderedPatientIds: sortQueueCandidates(candidates).map(candidate => candidate.patientId),
          source: 'fallback',
          warnings: [],
        });
      });

    return () => {
      active = false;
    };
  }, [candidates, selectedSlot]);

  useEffect(() => {
    if (!selectedSlot) return;
    if (
      (specialtyFilter && selectedSlot.specialty !== specialtyFilter) ||
      (doctorFilter && selectedSlot.doctorId !== doctorFilter) ||
      (monthFilter && !selectedSlot.date.startsWith(monthFilter))
    ) {
      setSelectedSlotId('');
    }
  }, [doctorFilter, monthFilter, selectedSlot, specialtyFilter]);

  useEffect(() => {
    if (selectedSlotId || filteredSlots.length === 0) return;
    setSelectedSlotId(filteredSlots[0].id);
  }, [filteredSlots, selectedSlotId]);

  const canAccessQueue = user?.role && ROLE_PAGES[user.role].includes('fila-prioridade');
  if (!canAccessQueue) {
    return (
      <div style={{ padding: 32 }}>
        <div role="alert" style={{ border: '1px solid var(--red-100)', background: 'var(--red-50)', color: 'var(--red-600)', borderRadius: 12, padding: 14, fontWeight: 700 }}>
          Você não tem permissão para acessar a fila de prioridade.
        </div>
      </div>
    );
  }

  const sendOffer = async (candidate: QueueCandidate) => {
    if (!selectedSlot) return;
    const duplicate = offers.some(offer =>
      offer.slotId === selectedSlot.id &&
      offer.candidatePatientId === candidate.patientId &&
      offer.appointmentId === candidate.appointmentId &&
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
    const offerId = `${selectedSlot.id}:${candidate.patientId}:${candidate.appointmentId}:${Date.now()}`;
    const message = buildAdvanceOfferMessage({
      patientName: candidate.patientName,
      specialty: selectedSlot.specialty || candidate.specialty,
      doctorName: candidate.doctorName || selectedSlot.doctorName,
      date: selectedSlot.date,
      time: selectedSlot.time,
    });

    try {
      const response = await smsApi.send({ patient_id: patient.id, phone_number: phone, message });
      if (response.success === false) throw new Error(response.message || 'O envio do SMS não foi confirmado.');
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
        error: toUserFacingErrorMessage(err, 'Falha ao enviar SMS.'),
      }]);
      setError(toUserFacingErrorMessage(err, 'Falha ao enviar SMS. Tente novamente em instantes.'));
    } finally {
      setSendingId('');
    }
  };

  const markDeclined = (candidate: QueueCandidate) => {
    if (!selectedSlot) return;
    const openOffer = findLatestOffer(offers, selectedSlot.id, candidate.patientId, candidate.appointmentId);
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
    const openOffer = findLatestOffer(offers, selectedSlot.id, candidate.patientId, candidate.appointmentId);
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
      setSelectedSlotId('');
      setSuggestion(null);
    } catch (err) {
      setError(toUserFacingErrorMessage(err, 'Erro ao remarcar consulta. Tente novamente em instantes.'));
    } finally {
      setApplyingId('');
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: '30px clamp(18px, 4vw, 36px)', background: 'transparent' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: '#071327', margin: 0, lineHeight: 1.15 }}>Cancelamentos e Realocações</h1>
          <p style={{ fontSize: 14, color: '#334155', marginTop: 6 }}>Controle horários cancelados, envie ofertas por SMS e realoque apenas pacientes do mesmo médico.</p>
        </div>
        <button type="button" onClick={() => setOffers(readOffers())} style={buttonStyle('#fff', 'var(--primary)', '1px solid rgba(0,166,63,0.28)')}>
          <RefreshCw size={16} /> Atualizar ofertas
        </button>
      </div>

      {error && <Alert tone="error" text={error} />}
      {success && <Alert tone="success" text={success} />}

      <div style={summaryGridStyle}>
        <MetricCard label="Cancelamentos" value={filteredSlots.length} hint="Horários para realocar" />
        <MetricCard label="Candidatos da vaga" value={selectedSlot ? candidates.length : 0} hint="Mesmo médico" />
        <MetricCard label="Ofertas ativas" value={sentOffersCount} hint={`${acceptedOffersCount} aceita(s)`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(min(100%, 380px), 0.95fr) minmax(min(100%, 520px), 1.3fr)', gap: 20, alignItems: 'start' }}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <CalendarClock size={19} color="var(--primary)" />
            <h2 style={sectionTitleStyle}>1. Horário cancelado</h2>
          </div>

          <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
            <div>
              <label htmlFor="queue-specialty-filter" style={labelStyle}>Especialidade</label>
              <select id="queue-specialty-filter" value={specialtyFilter} onChange={event => setSpecialtyFilter(event.target.value)} style={fieldStyle}>
                <option value="">Todas as especialidades</option>
                {doctorSpecialties.map(specialty => <option key={specialty} value={specialty}>{specialty}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="queue-doctor-filter" style={labelStyle}>Médico</label>
              <select id="queue-doctor-filter" value={doctorFilter} onChange={event => setDoctorFilter(event.target.value)} style={fieldStyle}>
                <option value="">Todos os médicos com vaga</option>
                {doctorOptions.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.full_name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="queue-month-filter" style={labelStyle}>Mês</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  id="queue-month-filter"
                  type="month"
                  value={monthFilter}
                  onChange={event => setMonthFilter(event.target.value)}
                  style={{ ...fieldStyle, flex: 1 }}
                />
                {monthFilter && (
                  <button type="button" onClick={() => setMonthFilter('')} style={buttonStyle('#fff', 'var(--gray-600)', '1px solid var(--gray-200)')}>
                    Limpar
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, maxHeight: 520, overflowY: 'auto', paddingRight: 4 }}>
            {filteredSlots.map(slot => (
              <button
                key={slot.id}
                type="button"
                onClick={() => setSelectedSlotId(slot.id)}
                style={slotCardStyle(selectedSlotId === slot.id)}
              >
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                  <strong>{slot.doctorName}</strong>
                  <SourcePill />
                </span>
                <span>{slot.specialty}</span>
                <span style={{ color: '#0f172a', fontWeight: 800 }}>{formatDateBR(slot.date)} às {slot.time}</span>
              </button>
            ))}
            {filteredSlots.length === 0 && <Empty text="Nenhum cancelamento com paciente disponível para remarcação nos filtros selecionados." />}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <RefreshCw size={19} color="var(--primary)" />
              <h2 style={sectionTitleStyle}>2. Pacientes elegíveis</h2>
            </div>
          </div>

          {selectedSlot ? (
            <div style={selectedSlotStyle}>
              <div>
                <span style={labelStyle}>Vaga selecionada</span>
                <strong style={{ display: 'block', color: '#071327', fontSize: 15 }}>{selectedSlot.doctorName}</strong>
                <span style={{ color: '#334155', fontSize: 13 }}>{selectedSlot.specialty} - {formatDateBR(selectedSlot.date)} às {selectedSlot.time}</span>
              </div>
              <SourcePill />
            </div>
          ) : (
            <Empty text="Escolha um cancelamento à esquerda para ver apenas pacientes daquele médico." />
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {orderedCandidates.map((candidate, index) => {
              const offer = selectedSlot ? findLatestOffer(offers, selectedSlot.id, candidate.patientId, candidate.appointmentId) : null;
              const sendDisabled = !selectedSlot || sendingId === candidate.patientId || Boolean(offer && ['sent', 'accepted'].includes(offer.status));
              const acceptDisabled = !selectedSlot || offer?.status === 'accepted' || applyingId === candidate.patientId;
              const declineDisabled = !selectedSlot || offer?.status === 'declined' || offer?.status === 'accepted';
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
                    <span>Médico atual: {candidate.doctorName}</span>
                    <span>Recusas: {candidate.refusalCount}</span>
                  </div>
                  {candidate.reasons.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {candidate.reasons.map(reason => <span key={reason} style={reasonPillStyle}>{reason}</span>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <button type="button" onClick={() => void sendOffer(candidate)} disabled={sendDisabled} style={buttonStyle('#fff', 'var(--primary)', '1px solid rgba(0,166,63,0.28)', sendDisabled)}>
                      {sendingId === candidate.patientId ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />} Enviar oferta
                    </button>
                    <button type="button" onClick={() => void acceptOffer(candidate)} disabled={acceptDisabled} style={buttonStyle('var(--primary)', '#fff', 'none', acceptDisabled)}>
                      {applyingId === candidate.patientId ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={14} />} Aceite recebido
                    </button>
                    <button type="button" onClick={() => markDeclined(candidate)} disabled={declineDisabled} style={buttonStyle('#fff', 'var(--red-600)', '1px solid var(--red-100)', declineDisabled)}>
                      <XCircle size={14} /> Recusou
                    </button>
                  </div>
                  {!candidate.canReceiveSms && <div style={{ fontSize: 12, color: 'var(--red-600)', fontWeight: 700 }}>Paciente sem telefone para SMS.</div>}
                </article>
              );
            })}
            {selectedSlot && orderedCandidates.length === 0 && <Empty text="Nenhum paciente elegível do mesmo médico para esta vaga." />}
          </div>
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function buildCancelledSlots(params: { agendamentos: Agendamento[]; doctors: ApiDoctor[]; offers: QueueAdvanceOffer[] }): QueueAvailableSlot[] {
  const now = new Date();
  const today = dateToISO(now);
  const nowKey = `${today} ${timeToHHMM(now)}`;
  const isFuture = (date: string, time: string) => `${date} ${time}` >= nowKey;
  const doctorById = new Map(params.doctors.map(doctor => [doctor.id, doctor]));
  const slots: QueueAvailableSlot[] = [];

  params.agendamentos
    .filter(appt => appt.status === 'cancelado' && appt.medicoId && isFuture(appt.data, appt.hora))
    .forEach(appt => {
      const doctorId = appt.medicoId!;
      const doctor = doctorById.get(doctorId);
      if (hasConflict(params.agendamentos, { doctorId, date: appt.data, time: appt.hora }, appt.id)) return;
      slots.push({
        id: `cancelled:${appt.id}`,
        doctorId,
        doctorName: doctor?.full_name ?? 'Médico não identificado',
        specialty: doctor?.specialty ?? '',
        date: appt.data,
        time: appt.hora,
        source: 'cancelled',
        cancelledAppointmentId: appt.id,
      });
    });

  params.offers
    .filter(offer => offer.slotDoctorId && offer.slotDate && offer.slotTime && offer.slotSpecialty)
    .filter(offer => isFuture(offer.slotDate!, offer.slotTime!))
    .forEach(offer => {
      const doctor = offer.slotDoctorId ? doctorById.get(offer.slotDoctorId) : undefined;
      if (hasConflict(params.agendamentos, { doctorId: offer.slotDoctorId!, date: offer.slotDate!, time: offer.slotTime! }, '')) return;
      slots.push({
        id: offer.slotId,
        doctorId: offer.slotDoctorId!,
        doctorName: doctor?.full_name ?? 'Médico não identificado',
        specialty: offer.slotSpecialty!,
        date: offer.slotDate!,
        time: offer.slotTime!,
        source: 'cancelled',
        cancelledAppointmentId: offer.slotId.startsWith('cancelled:') ? offer.slotId.slice('cancelled:'.length) : undefined,
      });
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

function findLatestOffer(offers: QueueAdvanceOffer[], slotId: string, patientId: string, appointmentId: string) {
  return [...offers].reverse().find(offer =>
    offer.slotId === slotId &&
    offer.candidatePatientId === patientId &&
    offer.appointmentId === appointmentId &&
    offer.status !== 'failed'
  );
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

function SourcePill() {
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 900,
      textTransform: 'uppercase',
      padding: '4px 8px',
      borderRadius: 999,
      background: 'var(--amber-100)',
      color: 'var(--amber-600)',
      whiteSpace: 'nowrap',
    }}>
      Cancelamento
    </span>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div style={metricCardStyle}>
      <span style={{ color: '#64748b', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</span>
      <strong style={{ color: '#071327', fontSize: 24, lineHeight: 1 }}>{value}</strong>
      <span style={{ color: '#64748b', fontSize: 12 }}>{hint}</span>
    </div>
  );
}

const panelStyle: CSSProperties = { background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, padding: 20, boxShadow: 'none' };
const sectionHeaderStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 };
const sectionTitleStyle: CSSProperties = { fontSize: 17, fontWeight: 800, color: '#071327', margin: 0 };
const labelStyle: CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 };
const fieldStyle: CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, background: 'var(--gray-50)' };
const summaryGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 };
const metricCardStyle: CSSProperties = { background: '#fff', border: '1px solid #dbe7e2', borderRadius: 12, padding: 14, display: 'grid', gap: 6 };
const selectedSlotStyle: CSSProperties = { marginBottom: 14, border: '1px solid rgba(0,166,63,0.18)', background: '#f0fdf4', borderRadius: 12, padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' };
const reasonPillStyle: CSSProperties = { borderRadius: 999, background: '#f1f5f9', color: '#334155', padding: '4px 8px', fontSize: 11, fontWeight: 700 };

function slotCardStyle(active: boolean): CSSProperties {
  return {
    width: '100%',
    textAlign: 'left',
    display: 'grid',
    gap: 6,
    padding: 13,
    borderRadius: 12,
    border: active ? '2px solid var(--primary)' : '1px solid #dbe7e2',
    background: active ? '#f0fdf4' : '#fff',
    color: '#334155',
    cursor: 'pointer',
    boxShadow: active ? '0 8px 18px rgba(0,166,63,0.08)' : 'none',
  };
}

function buttonStyle(background: string, color: string, border: string, disabled = false): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 13px',
    background,
    color,
    border,
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
  };
}
