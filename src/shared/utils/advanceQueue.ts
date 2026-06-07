import type { Agendamento, Paciente, PatientPriorityLevel, QueueCandidate, QueueSuggestion } from '../../types';
import type { ApiDoctor } from '../../lib/api';
import { calculatePatientPriority, normalizePriorityInput } from './patientPriority';

const PRIORITY_VALUE: Record<PatientPriorityLevel, number> = {
  P1: 5,
  P2: 4,
  P3: 3,
  P4: 2,
  P5: 1,
};

export function normalizeSpecialty(value?: string) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isSameSpecialty(a?: string, b?: string) {
  const left = normalizeSpecialty(a);
  const right = normalizeSpecialty(b);
  return Boolean(left && right && left === right);
}

export function priorityValue(level: PatientPriorityLevel) {
  return PRIORITY_VALUE[level] ?? 1;
}

export function calculateQueueScore(candidate: Pick<QueueCandidate, 'priorityValue' | 'waitingDays' | 'refusalCount' | 'age'>) {
  const ageBonus = candidate.age !== null && candidate.age !== undefined && (candidate.age >= 60 || candidate.age < 13) ? 8 : 0;
  return candidate.priorityValue * 1000 + Math.min(candidate.waitingDays, 365) * 3 + ageBonus - candidate.refusalCount * 20;
}

export function sortQueueCandidates(candidates: QueueCandidate[]) {
  return [...candidates].sort((a, b) =>
    b.priorityValue - a.priorityValue ||
    b.waitingDays - a.waitingDays ||
    `${a.originalDate} ${a.originalTime}`.localeCompare(`${b.originalDate} ${b.originalTime}`) ||
    (Number(b.age ?? -1) - Number(a.age ?? -1)) ||
    a.refusalCount - b.refusalCount ||
    a.patientName.localeCompare(b.patientName)
  );
}

export function buildQueueCandidates(params: {
  slotDoctorId?: string;
  slotSpecialty: string;
  slotDate: string;
  slotTime: string;
  patients: Paciente[];
  appointments: Agendamento[];
  doctors: ApiDoctor[];
  refusalCounts?: Record<string, number>;
}) {
  const { slotDoctorId, slotSpecialty, slotDate, slotTime, patients, appointments, doctors, refusalCounts = {} } = params;
  const patientById = new Map(patients.map(patient => [patient.id, patient]));
  const doctorById = new Map(doctors.map(doctor => [doctor.id, doctor]));
  const slotDateTime = `${slotDate} ${slotTime}`;

  const candidates = appointments
    .filter(appt => appt.status !== 'cancelado' && appt.status !== 'realizado')
    .filter(appt => `${appt.data} ${appt.hora}` > slotDateTime)
    .map((appt): QueueCandidate | null => {
      const patient = patientById.get(appt.pacienteId);
      const doctor = appt.medicoId ? doctorById.get(appt.medicoId) : undefined;
      if (slotDoctorId && doctor?.id !== slotDoctorId) return null;
      if (!patient || !doctor) return null;
      if (slotSpecialty && !isSameSpecialty(doctor.specialty, slotSpecialty)) return null;

      const priority = calculatePatientPriority(patient);
      const normalized = normalizePriorityInput(patient);
      const waitingDays = parseWaitingDays(patient.tempoNaFila, appt.data);
      const age = normalized.age ?? null;
      const refusalCount = refusalCounts[patient.id] ?? 0;
      const priorityNumber = priorityValue(priority.level);

      return {
        patientId: patient.id,
        patientName: patient.nome,
        appointmentId: appt.id,
        doctorId: doctor.id,
        doctorName: doctor.full_name,
        specialty: doctor.specialty,
        originalDate: appt.data,
        originalTime: appt.hora,
        priorityLevel: priority.level,
        priorityValue: priorityNumber,
        priorityScore: calculateQueueScore({ priorityValue: priorityNumber, waitingDays, refusalCount, age }),
        waitingDays,
        age,
        refusalCount,
        canReceiveSms: Boolean(patient.telefone),
        reasons: priority.reasons.slice(0, 3),
      } satisfies QueueCandidate;
    })
    .filter((candidate): candidate is QueueCandidate => Boolean(candidate))
    .sort((a, b) => `${a.originalDate} ${a.originalTime}`.localeCompare(`${b.originalDate} ${b.originalTime}`));

  const nearestAppointmentByPatient = new Map<string, QueueCandidate>();
  candidates.forEach(candidate => {
    if (!nearestAppointmentByPatient.has(candidate.patientId)) {
      nearestAppointmentByPatient.set(candidate.patientId, candidate);
    }
  });

  return sortQueueCandidates(Array.from(nearestAppointmentByPatient.values()));
}

export function buildAllQueueCandidates(params: {
  patients: Paciente[];
  appointments: Agendamento[];
  doctors: ApiDoctor[];
  refusalCounts?: Record<string, number>;
  today?: string;
}) {
  const { patients, appointments, doctors, refusalCounts = {}, today = new Date().toISOString().slice(0, 10) } = params;
  const patientById = new Map(patients.map(patient => [patient.id, patient]));
  const doctorById = new Map(doctors.map(doctor => [doctor.id, doctor]));

  return sortQueueCandidates(
    appointments
      .filter(appt => appt.status !== 'cancelado' && appt.status !== 'realizado')
      .filter(appt => appt.data >= today)
      .map((appt): QueueCandidate | null => {
        const patient = patientById.get(appt.pacienteId);
        const doctor = appt.medicoId ? doctorById.get(appt.medicoId) : undefined;
        if (!patient || !doctor?.specialty) return null;

        const priority = calculatePatientPriority(patient);
        const normalized = normalizePriorityInput(patient);
        const waitingDays = parseWaitingDays(patient.tempoNaFila, appt.data);
        const age = normalized.age ?? null;
        const refusalCount = refusalCounts[patient.id] ?? 0;
        const priorityNumber = priorityValue(priority.level);

        return {
          patientId: patient.id,
          patientName: patient.nome,
          appointmentId: appt.id,
          doctorId: doctor.id,
          doctorName: doctor.full_name,
          specialty: doctor.specialty,
          originalDate: appt.data,
          originalTime: appt.hora,
          priorityLevel: priority.level,
          priorityValue: priorityNumber,
          priorityScore: calculateQueueScore({ priorityValue: priorityNumber, waitingDays, refusalCount, age }),
          waitingDays,
          age,
          refusalCount,
          canReceiveSms: Boolean(patient.telefone),
          reasons: priority.reasons.slice(0, 3),
        } satisfies QueueCandidate;
      })
      .filter((candidate): candidate is QueueCandidate => Boolean(candidate))
  );
}

export function validateGeminiQueueSuggestion(candidateIds: string[], rawIds: unknown, slotSpecialty: string, candidates: QueueCandidate[]): QueueSuggestion {
  const validIds = new Set(candidateIds);
  const candidateById = new Map(candidates.map(candidate => [candidate.patientId, candidate]));
  const raw = Array.isArray(rawIds) ? rawIds : [];
  const ordered = raw
    .map(id => String(id))
    .filter(id => validIds.has(id))
    .filter(id => !slotSpecialty || isSameSpecialty(candidateById.get(id)?.specialty, slotSpecialty));
  const unique = Array.from(new Set(ordered));
  const missing = candidateIds.filter(id => !unique.includes(id));
  return {
    orderedPatientIds: [...unique, ...missing],
    source: unique.length ? 'gemini' : 'fallback',
    warnings: unique.length ? [] : ['Gemini não retornou uma sequência válida; fallback determinístico aplicado.'],
  };
}

export function buildAdvanceOfferMessage(params: { patientName: string; date: string; time: string; specialty?: string; doctorName?: string }) {
  const patientName = params.patientName?.trim().split(' ')[0];
  const specialty = params.specialty?.trim();
  const doctorName = sanitizeDoctorName(params.doctorName);

  const greeting = patientName ? `Ola, ${patientName}!` : 'Ola!';
  const consulta = specialty ? `consulta de ${specialty}` : 'consulta';
  const comMedico = doctorName ? ` com Dr(a). ${doctorName}` : '';

  return [
    `MediConnect: ${greeting} Abriu uma vaga para antecipar sua ${consulta}${comMedico} para ${formatDateBR(params.date)} as ${params.time}.`,
    'Para confirmar, responda SIM. Para recusar, responda NAO.',
    'Sua consulta atual sera mantida ate a confirmacao.',
  ].join(' ');
}

function sanitizeDoctorName(value?: string) {
  const name = value?.trim();
  if (!name || name.toLowerCase().includes('nao identificado')) return '';
  return name.replace(/^dr[a]?\.?\s+/i, '');
}

export function parseWaitingDays(value?: string, fallbackDate?: string) {
  const numeric = String(value ?? '').match(/\d+/);
  if (numeric) return Number(numeric[0]);
  if (!fallbackDate) return 0;
  const start = new Date(`${fallbackDate}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(start.getTime())) return 0;
  return Math.max(0, Math.round((start.getTime() - now.getTime()) / 86400000));
}

function formatDateBR(iso: string) {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}
