import type { Agendamento, Paciente, PatientPriorityLevel, PatientPriorityMetrics } from '../../types';
import { calculatePatientPriority, normalizePriorityInput } from './patientPriority';

type CountMap = Record<string, number>;

export function calculatePriorityDistribution(patients: Paciente[]): Record<PatientPriorityLevel, number> {
  return patients.reduce<Record<PatientPriorityLevel, number>>((acc, patient) => {
    const priority = calculatePatientPriority(patient);
    acc[priority.level] += 1;
    return acc;
  }, { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 });
}

export function calculateAveragePriorityScore(patients: Paciente[]): number {
  if (patients.length === 0) return 0;
  const total = patients.reduce((sum, patient) => sum + calculatePatientPriority(patient).score, 0);
  return Number((total / patients.length).toFixed(1));
}

export function calculateHighPriorityPatientsCount(patients: Paciente[]): number {
  return patients.filter(patient => {
    const level = calculatePatientPriority(patient).level;
    return level === 'P1' || level === 'P2' || level === 'P3';
  }).length;
}

export function calculatePriorityByAgeGroup(patients: Paciente[]): CountMap {
  return patients.reduce<CountMap>((acc, patient) => {
    const age = normalizePriorityInput(patient).age;
    const key =
      age === null ? 'idade_nao_informada' :
      age <= 2 ? '0_2' :
      age <= 12 ? '3_12' :
      age <= 59 ? '13_59' :
      age <= 69 ? '60_69' :
      age <= 79 ? '70_79' :
      '80_mais';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function calculatePriorityByMobility(patients: Paciente[]): CountMap {
  return patients.reduce<CountMap>((acc, patient) => {
    const key = normalizePriorityInput(patient).mobility;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function calculatePriorityByLocation(patients: Paciente[]): CountMap {
  return patients.reduce<CountMap>((acc, patient) => {
    const key = normalizePriorityInput(patient).locationKey;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export function calculatePriorityByDoctor(patients: Paciente[], appointments: Agendamento[]): Record<string, PatientPriorityMetrics> {
  const patientById = new Map(patients.map(patient => [patient.id, patient]));
  const doctorGroups = appointments.reduce<Record<string, Set<string>>>((acc, appointment) => {
    const doctorId = appointment.medicoId ?? 'medico_nao_informado';
    acc[doctorId] ??= new Set<string>();
    acc[doctorId].add(appointment.pacienteId);
    return acc;
  }, {});

  return Object.fromEntries(
    Object.entries(doctorGroups).map(([doctorId, patientIds]) => {
      const doctorPatients = Array.from(patientIds)
        .map(patientId => patientById.get(patientId))
        .filter((patient): patient is Paciente => Boolean(patient));
      return [doctorId, buildPriorityMetricsSummary(doctorPatients, [])];
    })
  );
}

export function calculatePriorityByPeriod(
  patients: Paciente[],
  appointments: Agendamento[],
  period: { startDate: string; endDate: string },
): PatientPriorityMetrics {
  const patientIds = new Set(
    appointments
      .filter(appointment => appointment.data >= period.startDate && appointment.data <= period.endDate)
      .map(appointment => appointment.pacienteId)
  );
  return buildPriorityMetricsSummary(patients.filter(patient => patientIds.has(patient.id)), []);
}

export function buildPriorityMetricsSummary(patients: Paciente[], appointments: Agendamento[] = []): PatientPriorityMetrics {
  void appointments;
  const distribution = calculatePriorityDistribution(patients);
  const normalized = patients.map(patient => normalizePriorityInput(patient));
  const priorities = patients.map(patient => calculatePatientPriority(patient));

  return {
    totalPatients: patients.length,
    p1Count: distribution.P1,
    p2Count: distribution.P2,
    p3Count: distribution.P3,
    p4Count: distribution.P4,
    p5Count: distribution.P5,
    highPriorityCount: priorities.filter(priority => ['P1', 'P2', 'P3'].includes(priority.level)).length,
    averagePriorityScore: calculateAveragePriorityScore(patients),
    mobilityRiskCount: normalized.filter(input => ['uses_support', 'wheelchair', 'bedridden'].includes(input.mobility)).length,
    accessDifficultyCount: normalized.filter(input => ['medium', 'high', 'special_transport_required'].includes(input.accessDifficulty)).length,
    elderlyPriorityCount: normalized.filter(input => input.age !== null && input.age >= 60).length,
    childPriorityCount: normalized.filter(input => input.age !== null && input.age <= 12).length,
    humanReviewRequiredCount: priorities.filter(priority => priority.requiresHumanReview).length,
  };
}
