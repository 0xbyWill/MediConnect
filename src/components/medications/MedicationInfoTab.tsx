import type { Medication } from '../../types';

interface MedicationInfoTabProps {
  medication: Medication;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: 14,
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--gray-200)',
      background: '#fff',
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', lineHeight: 1.45 }}>{value}</div>
    </div>
  );
}

export default function MedicationInfoTab({ medication }: MedicationInfoTabProps) {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <InfoCard label="Nome" value={medication.name} />
        <InfoCard label="Princípio ativo" value={medication.activeIngredient} />
        <InfoCard label="Classe terapêutica" value={medication.therapeuticClass} />
        <InfoCard label="Categoria" value={medication.category} />
      </div>

      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--gray-200)',
        background: '#fff',
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
          Apresentações disponíveis
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--gray-700)', fontSize: 13, lineHeight: 1.6 }}>
          {medication.presentations.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {medication.manufacturers && medication.manufacturers.length > 0 && (
        <div style={{
          padding: 16,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--gray-200)',
          background: '#fff',
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
            Fabricantes
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)' }}>{medication.manufacturers.join(' · ')}</p>
        </div>
      )}

      {(medication.bulaPatientUrl || medication.bulaProfessionalUrl) && (
        <div style={{
          padding: 16,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--gray-200)',
          background: '#fff',
        }}>
          <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
            Bulas ANVISA
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {medication.bulaPatientUrl && (
              <a href={medication.bulaPatientUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                Bula do paciente
              </a>
            )}
            {medication.bulaProfessionalUrl && (
              <a href={medication.bulaProfessionalUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>
                Bula profissional
              </a>
            )}
          </div>
        </div>
      )}

      <div style={{
        padding: 16,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--gray-200)',
        background: 'var(--gray-50)',
      }}>
        <h3 style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.8, margin: '0 0 10px' }}>
          Descrição resumida
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--gray-700)', lineHeight: 1.65 }}>{medication.summary}</p>
      </div>
    </div>
  );
}
