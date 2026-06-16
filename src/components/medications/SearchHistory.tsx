import { Clock } from 'lucide-react';
import type { MedicationSearchHistoryItem } from '../../types';

interface SearchHistoryProps {
  items: MedicationSearchHistoryItem[];
  onSelect: (id: string) => void;
  onClear: () => void;
}

export default function SearchHistory({ items, onSelect, onClear }: SearchHistoryProps) {
  if (items.length === 0) return null;

  return (
    <section aria-label="Histórico de pesquisas" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 1.2, margin: 0 }}>
          Últimas consultas
        </h2>
        <button
          type="button"
          onClick={onClear}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--primary)',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: '2px 4px',
          }}
        >
          Limpar
        </button>
      </div>
      <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map(item => (
          <li key={`${item.id}-${item.searchedAt}`}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--gray-200)',
                background: '#fff',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <Clock size={14} color="var(--gray-400)" aria-hidden="true" />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{item.name}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)' }}>{item.activeIngredient}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
