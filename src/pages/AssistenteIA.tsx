import type { CSSProperties, ElementType } from 'react';
import { Bot, Search, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import GestaoSearchAssistant from './GestaoSearchAssistant';

const panelStyle = {
  background: '#fff',
  borderRadius: 8,
  border: '1px solid var(--gray-100)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  padding: 18,
} satisfies CSSProperties;

export default function AssistenteIA() {
  const { user } = useAuth();

  if (user?.role !== 'gestao') {
    return (
      <div style={{ flex: 1, padding: 24 }}>
        <h1 style={{ fontSize: 24, color: 'var(--dark)' }}>Assistente IA</h1>
        <p role="alert" style={{ color: 'var(--red-600)', marginTop: 12 }}>Apenas usuarios de gestao podem acessar esta area.</p>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 28px)' }}>
      <div style={{ maxWidth: 1180 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--dark)' }}>Assistente IA</h1>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
              Verificacoes gerenciais com Gemini usando somente os dados que a tela ja pode ler.
            </p>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--gray-600)', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 800 }}>
            <ShieldCheck size={16} color="var(--primary)" /> Sem permissao Supabase para IA
          </div>
        </header>

        <section style={{ ...panelStyle, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 14 }}>Integração Gemini</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 10 }}>
            <StatusCard icon={Bot} title="Gemini direto" text="A chamada usa VITE_GEMINI_API_KEY no navegador e nao passa por Edge Function." />
            <StatusCard icon={Search} title="Permissoes existentes" text="Os dados sao carregados pelas APIs normais do app antes da IA receber o contexto." />
            <StatusCard icon={ShieldCheck} title="Somente leitura" text="O assistente analisa os dados recebidos e nao cria, edita, exclui ou envia nada." />
          </div>
        </section>

        <GestaoSearchAssistant embedded />
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, title, text }: { icon: ElementType; title: string; text: string }) {
  return (
    <div style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: 12, background: 'var(--gray-50)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Icon size={15} color="var(--primary)" />
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--gray-800)' }}>{title}</div>
      </div>
      <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>{text}</p>
    </div>
  );
}
