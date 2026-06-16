import { useAuth } from '../contexts/AuthContext';
import GestaoSearchAssistant from './GestaoSearchAssistant';

export default function AssistenteIA() {
  const { user } = useAuth();

  if (user?.role !== 'gestao') {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Assistente IA Gerencial</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>Apenas usuários de gestão podem acessar esta área.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: '18px clamp(16px, 3vw, 28px)' }}>
      <div style={{ maxWidth: 1320 }}>
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#071327', margin: 0, lineHeight: 1.15 }}>Assistente IA Gerencial</h1>
          <p style={{ fontSize: 13, color: '#334155', marginTop: 5, maxWidth: 760 }}>
            Consultas, laudos, pacientes e indicadores operacionais — com apoio inteligente para a gestão da clínica.
          </p>
        </header>

        <GestaoSearchAssistant embedded />
      </div>
    </div>
  );
}
