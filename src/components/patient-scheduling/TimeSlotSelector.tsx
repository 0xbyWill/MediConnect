interface TimeSlotSelectorProps {
  slots: string[];
  selectedSlot: string | null;
  onSelect: (slot: string) => void;
  loading?: boolean;
}

export function TimeSlotSelector({
  slots,
  selectedSlot,
  onSelect,
  loading = false,
}: TimeSlotSelectorProps) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#071327' }}>Horários disponíveis</h3>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Carregando horários...</div>
      ) : slots.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>
          Não há horários livres para este profissional nesta data.
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {slots.map(slot => {
            const selected = slot === selectedSlot;
            return (
              <button
                key={slot}
                type="button"
                onClick={() => onSelect(slot)}
                style={{
                  minWidth: 84,
                  border: selected ? 'none' : '1px solid var(--gray-200)',
                  background: selected ? 'var(--primary)' : '#fff',
                  color: selected ? '#fff' : '#0f172a',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {slot}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
