import type { ElementType } from 'react';
import { AlertTriangle, ShieldAlert, ShieldX } from 'lucide-react';
import type { Medication } from '../../types';

interface MedicationContraindicationsTabProps {
  medication: Medication;
}

function AlertSection({
  title,
  items,
  tone,
  icon: Icon,
}: {
  title: string;
  items: string[];
  tone: 'danger' | 'warning' | 'info';
  icon: ElementType;
}) {
  if (items.length === 0) return null;

  const styles = {
    danger: { bg: 'var(--red-50)', border: 'var(--red-100)', color: 'var(--red-600)', icon: 'var(--red-600)' },
    warning: { bg: 'var(--amber-100)', border: '#fde68a', color: 'var(--amber-600)', icon: 'var(--amber-600)' },
    info: { bg: 'var(--gray-50)', border: 'var(--gray-200)', color: 'var(--gray-700)', icon: 'var(--gray-600)' },
  }[tone];

  return (
    <section
      aria-label={title}
      style={{
        padding: 14,
        borderRadius: 'var(--radius-md)',
        border: `1px solid ${styles.border}`,
        background: styles.bg,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={styles.icon} aria-hidden="true" />
        <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: styles.color }}>{title}</h3>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, color: styles.color, fontSize: 13, lineHeight: 1.6 }}>
        {items.map(item => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function MedicationContraindicationsTab({ medication }: MedicationContraindicationsTabProps) {
  const { contraindications } = medication;

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <AlertSection
        title="Contraindicações absolutas"
        items={contraindications.absolute}
        tone="danger"
        icon={ShieldX}
      />
      <AlertSection
        title="Contraindicações relativas"
        items={contraindications.relative}
        tone="warning"
        icon={ShieldAlert}
      />
      <AlertSection
        title="Advertências"
        items={contraindications.warnings}
        tone="info"
        icon={AlertTriangle}
      />
    </div>
  );
}
