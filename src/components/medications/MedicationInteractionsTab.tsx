import { Loader2, Plus, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import type { Medication, MedicationInteraction, MedicationInteractionSeverity } from '../../types';
import { checkMedicationInteractions, resolveMedicationByName } from '../../lib/medicationApi';
import { MEDICATION_SEARCH_EXAMPLES } from '../../shared/constants/medications';

interface MedicationInteractionsTabProps {
  medication: Medication;
}

const SEVERITY_STYLES: Record<MedicationInteractionSeverity, { label: string; bg: string; color: string; border: string }> = {
  grave: { label: 'Grave', bg: 'var(--red-50)', color: 'var(--red-600)', border: 'var(--red-100)' },
  moderada: { label: 'Moderada', bg: 'var(--amber-100)', color: 'var(--amber-600)', border: '#fde68a' },
  leve: { label: 'Leve', bg: 'var(--mint)', color: 'var(--darker)', border: 'var(--gray-200)' },
};

export default function MedicationInteractionsTab({ medication }: MedicationInteractionsTabProps) {
  const [extraEntries, setExtraEntries] = useState<Array<{ id: string; name: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [interactions, setInteractions] = useState<MedicationInteraction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedEntries = useMemo(
    () => [{ id: medication.id, name: medication.name }, ...extraEntries.filter(item => item.id !== medication.id)],
    [extraEntries, medication.id, medication.name],
  );

  const selectedIds = selectedEntries.map(item => item.id);

  const fetchInteractions = useCallback(async (ids: string[]) => {
    if (ids.length < 2) {
      setInteractions([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await checkMedicationInteractions(ids);
      setInteractions(result);
    } catch {
      setError('Não foi possível verificar interações agora.');
    } finally {
      setLoading(false);
    }
  }, []);

  const visibleInteractions = selectedIds.length >= 2 ? interactions : [];

  const addMedication = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || resolving) return;

    setResolving(true);
    setError(null);

    try {
      const resolved = await resolveMedicationByName(trimmed);
      if (!resolved) {
        setError(`Medicamento "${trimmed}" não encontrado nos provedores consultados.`);
        return;
      }
      if (selectedIds.includes(resolved.id)) {
        setError('Este medicamento já foi adicionado.');
        return;
      }

      const nextExtraEntries = [...extraEntries, { id: resolved.id, name: resolved.name }];
      const nextSelectedIds = [medication.id, ...nextExtraEntries.map(item => item.id)];
      setExtraEntries(nextExtraEntries);
      setInputValue('');
      await fetchInteractions(nextSelectedIds);
    } finally {
      setResolving(false);
    }
  };

  const removeMedication = (id: string) => {
    if (id === medication.id) return;
    const nextExtraEntries = extraEntries.filter(item => item.id !== id);
    const nextSelectedIds = [medication.id, ...nextExtraEntries.map(item => item.id)];
    setExtraEntries(nextExtraEntries);
    void fetchInteractions(nextSelectedIds);
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label htmlFor="interaction-med-input" style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 8 }}>
          Adicionar medicamento
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="interaction-med-input"
            type="text"
            value={inputValue}
            onChange={event => setInputValue(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addMedication();
              }
            }}
            placeholder="Ex.: Losartana, Metformina, Sinvastatina"
            list="interaction-med-suggestions"
            disabled={resolving}
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--gray-200)',
              fontSize: 13,
            }}
          />
          <datalist id="interaction-med-suggestions">
            {MEDICATION_SEARCH_EXAMPLES.filter(item => item !== medication.name).map(item => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={() => void addMedication()}
            disabled={resolving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 13,
              cursor: resolving ? 'not-allowed' : 'pointer',
              opacity: resolving ? 0.7 : 1,
            }}
          >
            <Plus size={15} aria-hidden="true" />
            Adicionar
          </button>
        </div>
        {error && (
          <p role="alert" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--red-600)', fontWeight: 600 }}>
            {error}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {selectedEntries.map(item => (
          <span
            key={item.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 999,
              background: item.id === medication.id ? 'var(--mint)' : '#fff',
              border: '1px solid var(--gray-200)',
              fontSize: 12,
              fontWeight: 700,
              color: 'var(--gray-700)',
            }}
          >
            {item.name}
            {item.id !== medication.id && (
              <button
                type="button"
                onClick={() => removeMedication(item.id)}
                aria-label={`Remover ${item.name}`}
                style={{ border: 'none', background: 'none', padding: 0, display: 'inline-flex', cursor: 'pointer' }}
              >
                <X size={14} color="var(--gray-500)" />
              </button>
            )}
          </span>
        ))}
      </div>

      {(loading || resolving) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)', fontSize: 13 }}>
          <Loader2 size={16} className="mc-spin" aria-hidden="true" />
          {resolving ? 'Buscando medicamento...' : 'Verificando interações...'}
        </div>
      )}

      {!loading && !resolving && selectedIds.length < 2 && (
        <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Adicione ao menos um medicamento para verificar interações.</p>
      )}

      {!loading && !resolving && selectedIds.length >= 2 && visibleInteractions.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--gray-600)' }}>Nenhuma interação relevante encontrada nos provedores consultados para esta combinação.</p>
      )}

      <div style={{ display: 'grid', gap: 10 }}>
        {visibleInteractions.map(interaction => {
          const style = SEVERITY_STYLES[interaction.severity];
          return (
            <article
              key={interaction.id}
              style={{
                padding: 14,
                borderRadius: 'var(--radius-md)',
                border: `1px solid ${style.border}`,
                background: style.bg,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>
                  {interaction.medicationAName} + {interaction.medicationBName}
                </strong>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: '#fff',
                  color: style.color,
                  border: `1px solid ${style.border}`,
                }}>
                  {style.label}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.55 }}>{interaction.description}</p>
              {interaction.clinicalManagement && (
                <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--gray-600)' }}>
                  <strong>Manejo:</strong> {interaction.clinicalManagement}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
