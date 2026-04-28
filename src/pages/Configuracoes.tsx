import type { ElementType, ReactNode } from 'react';
import { Database, Save, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Configuracoes() {
  const { user } = useAuth();

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(16px, 3vw, 32px)', maxWidth: 760 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Configurações</h1>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 28 }}>Dados operacionais conectados à API do projeto.</p>

      <Section title="Perfil autenticado" icon={UserCog}>
        <Info label="Nome" value={user?.full_name || '—'} />
        <Info label="E-mail" value={user?.email || '—'} />
        <Info label="Perfil" value={user?.role || '—'} />
        <Info label="Especialidade" value={user?.specialty || '—'} />
        <Info label="CRM" value={user?.crm || '—'} />
      </Section>

      <Section title="Integração da API" icon={Database}>
        <Info label="Backend" value="Supabase / RiseUP API" />
        <Info label="Base URL" value="https://yuanqfswhberkoevtmfr.supabase.co" />
        <Info label="Persistência" value="API REST e Edge Functions" />
        <Info label="Documentação" value="https://do5wegrct3.apidog.io/" />
      </Section>

      <Section title="Segurança" icon={ShieldCheck}>
        <Info label="Autenticação" value="JWT Bearer via /auth/v1/token" />
        <Info label="API Key" value="Enviada no header apikey" />
        <Info label="Sessão local" value="Somente token e perfil autenticado" />
      </Section>

      <button style={{ marginTop: 4, padding: '10px 20px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Save size={15} /> Configuração aplicada
      </button>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--dark)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
