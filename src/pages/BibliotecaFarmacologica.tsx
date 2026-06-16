import { PillBottle } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Medication, MedicationSearchHistoryItem, MedicationSearchResult } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ROLE_PAGES } from '../types';
import {
  getMedicationById,
  pushMedicationSearchHistory,
  readMedicationSearchHistory,
  searchLocalMedications,
  searchMedications,
} from '../lib/medicationApi';
import { MEDICATION_SEARCH_HISTORY_KEY } from '../shared/constants/medications';
import MedicationSearch from '../components/medications/MedicationSearch';
import MedicationResult from '../components/medications/MedicationResult';
import SearchHistory from '../components/medications/SearchHistory';

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export default function BibliotecaFarmacologica() {
  const { user } = useAuth();
  const allowed = user ? ROLE_PAGES[user.role].includes('biblioteca-farmacologica') : false;

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = useState<MedicationSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedResult, setSelectedResult] = useState<MedicationSearchResult | null>(null);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [history, setHistory] = useState<MedicationSearchHistoryItem[]>(() => readMedicationSearchHistory());
  const loadMedication = useCallback(async (result: MedicationSearchResult) => {
    setSelectedResult(result);
    setDetailLoading(true);
    setDetailError(null);
    setQuery(result.name);

    try {
      const detail = await getMedicationById(result.id);
      if (!detail) {
        setMedication(null);
        setDetailError('Medicamento não encontrado.');
        return;
      }
      setMedication(detail);
      setHistory(pushMedicationSearchHistory({
        id: detail.id,
        name: detail.name,
        activeIngredient: detail.activeIngredient,
      }));
    } catch {
      setDetailError('Não foi possível carregar os detalhes do medicamento.');
      setMedication(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setResults(searchLocalMedications(trimmed, 12));
  }, [query]);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (trimmed.length < 3) {
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSearchLoading(true);

    void searchMedications(trimmed)
      .then(items => {
        if (!cancelled && items.length > 0) setResults(items);
      })
      .finally(() => {
        if (!cancelled) setSearchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const handleHistorySelect = useCallback(async (id: string) => {
    const detail = await getMedicationById(id);
    if (!detail) {
      setDetailError('Medicamento do histórico não encontrado.');
      return;
    }
    await loadMedication({
      id: detail.id,
      name: detail.name,
      activeIngredient: detail.activeIngredient,
      commercialNames: detail.commercialNames,
      therapeuticClass: detail.therapeuticClass,
      category: detail.category,
    });
  }, [loadMedication]);

  const clearHistory = () => {
    localStorage.removeItem(MEDICATION_SEARCH_HISTORY_KEY);
    setHistory([]);
  };

  if (!allowed) {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Biblioteca Farmacológica</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>
          Seu perfil não tem permissão para acessar esta área.
        </p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: '18px clamp(16px, 3vw, 28px)' }}>
      <div style={{ maxWidth: 1320, margin: '0 auto' }}>
        <header style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <PillBottle size={24} color="var(--primary)" aria-hidden="true" />
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#071327', margin: 0, lineHeight: 1.15 }}>
              Biblioteca Farmacológica
            </h1>
          </div>
          <p style={{ fontSize: 13, color: '#334155', margin: 0, maxWidth: 760 }}>
            Consulte informações de medicamentos, dosagens, contraindicações e interações medicamentosas.
          </p>
        </header>

        <div
          className="med-library-layout"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <aside style={{ position: 'sticky', top: 12 }}>
            <MedicationSearch
              query={query}
              onQueryChange={setQuery}
              results={results}
              loading={searchLoading}
              selectedId={selectedResult?.id ?? null}
              onSelect={result => void loadMedication(result)}
            />
            <SearchHistory
              items={history}
              onSelect={id => void handleHistorySelect(id)}
              onClear={clearHistory}
            />
          </aside>

          <section aria-live="polite" style={{ minWidth: 0 }}>
            {detailLoading && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--gray-600)', fontSize: 14 }}>
                Carregando medicamento...
              </div>
            )}

            {detailError && (
              <p role="alert" style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--red-50)', color: 'var(--red-600)', fontWeight: 600 }}>
                {detailError}
              </p>
            )}

            {!detailLoading && !detailError && medication && (
              <MedicationResult medication={medication} />
            )}

            {!detailLoading && !detailError && !medication && (
              <div style={{
                padding: '48px 24px',
                borderRadius: 16,
                border: '1px dashed var(--gray-200)',
                background: '#fff',
                textAlign: 'center',
              }}>
                <PillBottle size={40} color="var(--gray-300)" aria-hidden="true" />
                <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--gray-500)' }}>
                  Pesquise um medicamento para visualizar informações farmacológicas.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .med-library-layout {
            grid-template-columns: 1fr !important;
          }
          .med-library-layout aside {
            position: static !important;
          }
        }
        .mc-spin {
          animation: mc-spin 0.8s linear infinite;
        }
        @keyframes mc-spin {
          to { transform: rotate(360deg); }
        }
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
      `}</style>
    </div>
  );
}
