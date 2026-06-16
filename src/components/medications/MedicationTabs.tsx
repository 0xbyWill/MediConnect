import { useState } from 'react';
import type { Medication } from '../../types';
import MedicationInfoTab from './MedicationInfoTab';
import MedicationDosageTab from './MedicationDosageTab';
import MedicationContraindicationsTab from './MedicationContraindicationsTab';
import MedicationInteractionsTab from './MedicationInteractionsTab';
import MedicationAITab from './MedicationAITab';

type MedicationTabId = 'informacoes' | 'dosagens' | 'contraindicacoes' | 'interacoes' | 'ia';

interface MedicationTabsProps {
  medication: Medication;
  readOnly?: boolean;
}

const TABS: { id: MedicationTabId; label: string }[] = [
  { id: 'informacoes', label: 'Informações' },
  { id: 'dosagens', label: 'Dosagens' },
  { id: 'contraindicacoes', label: 'Contraindicações' },
  { id: 'interacoes', label: 'Interações' },
  { id: 'ia', label: 'IA Médica' },
];

export default function MedicationTabs({ medication, readOnly = false }: MedicationTabsProps) {
  const [activeTab, setActiveTab] = useState<MedicationTabId>('informacoes');

  return (
    <div>
      <div
        role="tablist"
        aria-label="Detalhes do medicamento"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          marginBottom: 14,
          borderBottom: '1px solid var(--gray-200)',
          paddingBottom: 8,
        }}
      >
        {TABS.map(tab => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`med-tab-${tab.id}`}
              aria-selected={selected}
              aria-controls={`med-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: selected ? '1px solid var(--primary)' : '1px solid transparent',
                background: selected ? 'var(--mint)' : 'transparent',
                color: selected ? 'var(--darker)' : 'var(--gray-600)',
                fontSize: 12,
                fontWeight: selected ? 800 : 650,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {TABS.map(tab => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`med-panel-${tab.id}`}
          aria-labelledby={`med-tab-${tab.id}`}
          hidden={activeTab !== tab.id}
        >
          {tab.id === 'informacoes' && <MedicationInfoTab medication={medication} />}
          {tab.id === 'dosagens' && <MedicationDosageTab medication={medication} />}
          {tab.id === 'contraindicacoes' && <MedicationContraindicationsTab medication={medication} />}
          {tab.id === 'interacoes' && <MedicationInteractionsTab key={medication.id} medication={medication} />}
          {tab.id === 'ia' && <MedicationAITab medication={medication} readOnly={readOnly} />}
        </div>
      ))}
    </div>
  );
}
