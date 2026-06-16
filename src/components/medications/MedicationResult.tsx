import { Pill } from 'lucide-react';
import type { Medication } from '../../types';
import MedicationTabs from './MedicationTabs';

interface MedicationResultProps {
  medication: Medication;
  readOnly?: boolean;
}

export default function MedicationResult({ medication, readOnly = false }: MedicationResultProps) {
  return (
    <article
      aria-label={`Detalhes de ${medication.name}`}
      style={{
        border: '1px solid var(--gray-200)',
        borderRadius: 16,
        background: '#fff',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <header style={{
        padding: '16px 18px',
        borderBottom: '1px solid var(--gray-200)',
        background: 'linear-gradient(180deg, #fff 0%, var(--gray-50) 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: 'var(--mint)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Pill size={20} color="var(--primary)" aria-hidden="true" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'var(--dark)', lineHeight: 1.2 }}>
              {medication.name}
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-600)' }}>
              {medication.activeIngredient} · {medication.therapeuticClass}
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--gray-500)' }}>
              {medication.category}
              {medication.commercialNames.length > 0 && ` · ${medication.commercialNames.slice(0, 3).join(', ')}`}
            </p>
          </div>
        </div>
      </header>

      <div style={{ padding: '16px 18px 18px' }}>
        <MedicationTabs medication={medication} readOnly={readOnly} />
      </div>
    </article>
  );
}
