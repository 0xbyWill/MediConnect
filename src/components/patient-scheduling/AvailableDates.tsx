import { pluralize } from './format';

export interface AvailableDateItem {
  date: string;
  label: string;
  slotsCount: number;
}

interface AvailableDatesProps {
  dates: AvailableDateItem[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
  loading?: boolean;
}

export function AvailableDates({
  dates,
  selectedDate,
  onSelect,
  loading = false,
}: AvailableDatesProps) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#071327' }}>Próximas datas disponíveis</h3>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Carregando datas...</div>
      ) : dates.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>
          Não encontramos datas com disponibilidade para essa especialidade.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {dates.map(item => {
            const selected = item.date === selectedDate;
            return (
              <button
                key={item.date}
                type="button"
                onClick={() => onSelect(item.date)}
                aria-pressed={selected}
                style={{
                  border: `1px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
                  background: selected ? 'rgba(0,166,63,0.08)' : '#fff',
                  borderRadius: 12,
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  gap: 12,
                  textAlign: 'left',
                }}
              >
                <div>
                  <strong style={{ display: 'block', color: '#0f172a', fontSize: 15 }}>{item.label}</strong>
                  <span style={{ color: '#64748b', fontSize: 12 }}>
                    {pluralize(item.slotsCount, 'horário disponível', 'horários disponíveis')}
                  </span>
                </div>
                <span
                  style={{
                    flexShrink: 0,
                    fontSize: 12,
                    fontWeight: 700,
                    color: selected ? 'var(--primary)' : '#475569',
                    background: selected ? 'rgba(0,166,63,0.12)' : 'var(--gray-50)',
                    border: `1px solid ${selected ? 'rgba(0,166,63,0.25)' : 'var(--gray-200)'}`,
                    borderRadius: 999,
                    padding: '4px 10px',
                  }}
                >
                  {item.slotsCount}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
