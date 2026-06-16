import { Loader2, Search } from 'lucide-react';
import type { MedicationSearchResult } from '../../types';
import { MEDICATION_SEARCH_EXAMPLES } from '../../shared/constants/medications';

interface MedicationSearchProps {
  query: string;
  onQueryChange: (value: string) => void;
  results: MedicationSearchResult[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (result: MedicationSearchResult) => void;
}

export default function MedicationSearch({
  query,
  onQueryChange,
  results,
  loading,
  selectedId,
  onSelect,
}: MedicationSearchProps) {
  const trimmedQuery = query.trim();
  const showResults = trimmedQuery.length > 0;

  return (
    <div>
      <label htmlFor="medication-search" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8 }}>
        Pesquisar medicamento
      </label>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 14px',
          borderRadius: 14,
          border: '2px solid var(--gray-200)',
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <Search size={18} color="var(--gray-400)" aria-hidden="true" />
        <input
          id="medication-search"
          type="search"
          value={query}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Pesquisar medicamento..."
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="medication-search-results"
          aria-expanded={showResults}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            padding: '14px 0',
            fontSize: 15,
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--gray-800)',
          }}
        />
        {loading && <Loader2 size={18} color="var(--primary)" aria-label="Buscando medicamentos" className="mc-spin" />}
      </div>

      <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 8 }}>
        Exemplos: {MEDICATION_SEARCH_EXAMPLES.join(', ')}
      </p>

      {showResults && (
        <ul
          id="medication-search-results"
          role="listbox"
          aria-label="Resultados da busca"
          style={{
            listStyle: 'none',
            margin: '10px 0 0',
            padding: 6,
            background: '#fff',
            border: '1px solid var(--gray-200)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            maxHeight: 360,
            overflowY: 'auto',
          }}
        >
          {!loading && results.length === 0 && (
            <li role="option" aria-selected={false} style={{ padding: '12px 10px', fontSize: 13, color: 'var(--gray-500)' }}>
              Nenhum medicamento encontrado.
            </li>
          )}
          {results.map(result => {
            const active = selectedId === result.id;
            return (
              <li key={result.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => onSelect(result)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 12px',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    background: active ? 'var(--mint)' : 'transparent',
                  }}
                >
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>{result.name}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>{result.activeIngredient}</span>
                  {result.commercialNames && result.commercialNames.length > 0 && (
                    <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
                      {result.commercialNames.slice(0, 2).join(' · ')}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
