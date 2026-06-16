import type { Medication, MedicationDosagePopulation } from '../../types';

interface MedicationDosageTabProps {
  medication: Medication;
}

const POPULATION_LABELS: Record<MedicationDosagePopulation, string> = {
  adultos: 'Adultos',
  pediatrico: 'Pediátrico',
  idosos: 'Idosos',
  gestantes: 'Gestantes',
};

const POPULATION_ORDER: MedicationDosagePopulation[] = ['adultos', 'pediatrico', 'idosos', 'gestantes'];

export default function MedicationDosageTab({ medication }: MedicationDosageTabProps) {
  const byPopulation = new Map(medication.dosages.map(item => [item.population, item]));

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      {POPULATION_ORDER.map(population => {
        const dosage = byPopulation.get(population);
        if (!dosage) return null;

        return (
          <section
            key={population}
            aria-label={`Dosagens — ${POPULATION_LABELS[population]}`}
            style={{
              border: '1px solid var(--gray-200)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            <header style={{
              padding: '10px 14px',
              background: 'var(--mint)',
              borderBottom: '1px solid var(--gray-200)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--darker)',
            }}>
              {POPULATION_LABELS[population]}
            </header>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 0 }}>
              {[
                { label: 'Dose usual', value: dosage.usualDose },
                { label: 'Frequência', value: dosage.frequency },
                { label: 'Dose máxima', value: dosage.maxDose },
              ].map((field, index) => (
                <div
                  key={field.label}
                  style={{
                    padding: '12px 14px',
                    borderRight: index < 2 ? '1px solid var(--gray-100)' : undefined,
                    borderBottom: '1px solid var(--gray-100)',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
                    {field.label}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{field.value}</div>
                </div>
              ))}
            </div>
            {dosage.notes && (
              <p style={{ margin: 0, padding: '10px 14px', fontSize: 12, color: 'var(--gray-600)', background: 'var(--gray-50)' }}>
                {dosage.notes}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
