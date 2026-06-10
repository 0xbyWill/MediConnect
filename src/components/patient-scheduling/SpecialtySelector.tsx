import {
  Activity,
  Bone,
  Brain,
  Eye,
  HeartPulse,
  LayoutGrid,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import { formatSpecialty, pluralize } from './format';

interface SpecialtyItem {
  id: string;
  name: string;
  doctorCount?: number;
}

interface SpecialtySelectorProps {
  specialties: SpecialtyItem[];
  selectedSpecialty: string | null;
  onSelect: (specialtyId: string) => void;
}

const ICON_BY_SPECIALTY: Record<string, typeof HeartPulse> = {
  cardiologia: HeartPulse,
  neurologia: Brain,
  dermatologia: Activity,
  ortopedia: Bone,
  ginecologia: Stethoscope,
  pediatria: UserRound,
  oftalmologia: Eye,
};

function normalizeSpecialty(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

function getSpecialtyIcon(id: string, name: string) {
  if (id === '__all__') return LayoutGrid;
  const normalized = normalizeSpecialty(name);
  for (const key of Object.keys(ICON_BY_SPECIALTY)) {
    if (normalized.startsWith(key)) return ICON_BY_SPECIALTY[key];
  }
  return Stethoscope;
}

export function SpecialtySelector({
  specialties,
  selectedSpecialty,
  onSelect,
}: SpecialtySelectorProps) {
  return (
    <section style={{ display: 'grid', gap: 12 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 22, color: '#071327' }}>Qual especialidade você procura?</h2>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#475569' }}>
          Escolha uma especialidade para começarmos a busca.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12,
        }}
      >
        {specialties.map(specialty => {
          const selected = selectedSpecialty === specialty.id;
          const Icon = getSpecialtyIcon(specialty.id, specialty.name);
          const displayName = specialty.id === '__all__' ? specialty.name : formatSpecialty(specialty.name);
          return (
            <button
              key={specialty.id}
              type="button"
              onClick={() => onSelect(specialty.id)}
              aria-label={`Selecionar ${displayName}`}
              aria-pressed={selected}
              style={{
                border: `1px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
                background: selected ? 'rgba(0,166,63,0.08)' : '#fff',
                borderRadius: 14,
                padding: '16px 14px',
                display: 'grid',
                gridTemplateRows: 'auto 1fr auto',
                justifyItems: 'start',
                gap: 10,
                cursor: 'pointer',
                minHeight: 132,
                textAlign: 'left',
                transition: 'border-color 120ms ease, background 120ms ease',
              }}
            >
              <span
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: selected ? 'var(--primary)' : 'var(--mint)',
                  color: selected ? '#fff' : 'var(--primary)',
                  flexShrink: 0,
                }}
              >
                <Icon size={18} />
              </span>
              <strong
                style={{
                  fontSize: 14,
                  lineHeight: 1.3,
                  color: '#0f172a',
                  alignSelf: 'start',
                  overflowWrap: 'anywhere',
                }}
              >
                {displayName}
              </strong>
              {typeof specialty.doctorCount === 'number' && (
                <span style={{ fontSize: 12, color: '#64748b', lineHeight: 1.3 }}>
                  {pluralize(specialty.doctorCount, 'médico disponível', 'médicos disponíveis')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
