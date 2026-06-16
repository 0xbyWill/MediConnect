import { Bot, Loader2, Send } from 'lucide-react';
import { useState } from 'react';
import type { Medication } from '../../types';
import AiRichText from '../AiRichText';
import { medicationPharmacologyAiApi, isDirectAiMode } from '../../lib/aiApi';
import { toUserFacingErrorMessage } from '../../shared/utils/errors';

interface MedicationAITabProps {
  medication: Medication;
  readOnly?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'Quais cuidados devo observar em pacientes idosos?',
  'Existe alguma observação relevante para diabéticos?',
  'Há recomendações específicas para insuficiência renal?',
];

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

export default function MedicationAITab({ medication, readOnly = false }: MedicationAITabProps) {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<ChatEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed || loading || readOnly) return;

    setLoading(true);
    setError(null);
    setQuestion('');

    const nextHistory: ChatEntry[] = [...history, { role: 'user', text: trimmed }];
    setHistory(nextHistory);

    try {
      const response = await medicationPharmacologyAiApi.ask({
        medicationName: medication.name,
        activeIngredient: medication.activeIngredient,
        question: trimmed,
        history: nextHistory.slice(-8),
      });
      setHistory(prev => [...prev, { role: 'assistant', text: response.answer }]);
    } catch (err) {
      setError(toUserFacingErrorMessage(err, 'Não foi possível consultar a IA farmacológica agora.'));
      setHistory(prev => prev.slice(0, -1));
      setQuestion(trimmed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{
        padding: 12,
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--gray-200)',
        background: 'var(--gray-50)',
        fontSize: 12,
        color: 'var(--gray-600)',
        lineHeight: 1.5,
      }}>
        <Bot size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} aria-hidden="true" />
        A IA complementa informações farmacológicas. Não prescreve nem recomenda tratamento.
        {!isDirectAiMode() && ' Configure VITE_GEMINI_API_KEY para habilitar respostas.'}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {SUGGESTED_QUESTIONS.map(item => (
          <button
            key={item}
            type="button"
            disabled={loading || readOnly}
            onClick={() => void ask(item)}
            style={{
              padding: '8px 10px',
              borderRadius: 999,
              border: '1px solid var(--gray-200)',
              background: '#fff',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--gray-700)',
              cursor: readOnly ? 'not-allowed' : 'pointer',
              opacity: readOnly ? 0.6 : 1,
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <div
        aria-live="polite"
        style={{
          minHeight: 180,
          maxHeight: 360,
          overflowY: 'auto',
          display: 'grid',
          gap: 10,
          padding: 12,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--gray-200)',
          background: '#fff',
        }}
      >
        {history.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--gray-500)' }}>
            Faça uma pergunta sobre {medication.name} para obter observações farmacológicas.
          </p>
        )}
        {history.map((entry, index) => (
          <div
            key={`${entry.role}-${index}`}
            style={{
              alignSelf: entry.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '92%',
              padding: '10px 12px',
              borderRadius: 12,
              background: entry.role === 'user' ? 'var(--primary)' : 'var(--gray-50)',
              color: entry.role === 'user' ? '#fff' : 'var(--gray-800)',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {entry.role === 'assistant'
              ? <AiRichText text={entry.text} idPrefix={`med-ai-${index}`} />
              : entry.text}
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)', fontSize: 12 }}>
            <Loader2 size={14} className="mc-spin" aria-hidden="true" />
            Consultando IA...
          </div>
        )}
      </div>

      {error && (
        <p role="alert" style={{ margin: 0, fontSize: 12, color: 'var(--red-600)', fontWeight: 600 }}>
          {error}
        </p>
      )}

      <form
        onSubmit={event => {
          event.preventDefault();
          void ask(question);
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <label htmlFor="medication-ai-question" className="sr-only">
          Pergunta sobre {medication.name}
        </label>
        <input
          id="medication-ai-question"
          type="text"
          value={question}
          onChange={event => setQuestion(event.target.value)}
          disabled={loading || readOnly}
          placeholder="Digite sua pergunta farmacológica..."
          style={{
            flex: 1,
            padding: '10px 12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--gray-200)',
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={loading || readOnly || !question.trim()}
          aria-label="Enviar pergunta"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 42,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: 'var(--primary)',
            color: '#fff',
            cursor: loading || readOnly ? 'not-allowed' : 'pointer',
            opacity: loading || readOnly || !question.trim() ? 0.6 : 1,
          }}
        >
          <Send size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
