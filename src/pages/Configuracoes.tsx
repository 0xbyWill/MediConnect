import type { ElementType, ReactNode } from 'react';
import { Bell, Database, Lock, Palette, ShieldCheck, UserCog } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Configuracoes() {
  const { user } = useAuth();

  return (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(16px, 3vw, 32px)' }}>
      <div style={{ maxWidth: 1040 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Configurações</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>Preferências organizadas por categoria. Dados sensíveis seguem a autenticação e permissões da API.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
          <Section title="Perfil" icon={UserCog}>
            <Info label="Nome" value={user?.full_name || '—'} />
            <Info label="E-mail" value={user?.email || '—'} />
            <Info label="Perfil" value={user?.role || '—'} />
            <Info label="Especialidade" value={user?.specialty || '—'} />
            <Info label="CRM" value={user?.crm || '—'} />
          </Section>

          <Section title="Conta" icon={Lock}>
            <Info label="Sessão" value="JWT Bearer ativo" />
            <Info label="Identificador" value={user?.id || '—'} />
            <Info label="Perfil médico" value={user?.doctor_id || 'Não vinculado'} />
          </Section>

          <Section title="Preferências" icon={Palette}>
            <Info label="Tema visual" value="Padrão MediConnect" />
            <Info label="Idioma" value="Português (Brasil)" />
            <Info label="Atualização de dados" value="Automática a cada 30s" />
          </Section>

          <Section title="Notificações" icon={Bell}>
            <Info label="Eventos" value="Consultas, laudos e erros operacionais" />
            <Info label="Leitura" value="Marcável no sino superior" />
            <Info label="Persistência" value="Local até existir tabela de notificações" />
          </Section>

          <Section title="Segurança e permissões" icon={ShieldCheck}>
            <Info label="Controle de telas" value="Por perfil do usuário" />
            <Info label="Proteção real" value="RLS / Edge Functions no Supabase" />
            <Info label="Perfis" value="Médico, Gestão e Secretaria" />
          </Section>

          <Section title="Integração da API" icon={Database}>
            <Info label="Backend" value="Supabase / RiseUP API" />
            <Info label="Base URL" value="https://yuanqfswhberkoevtmfr.supabase.co" />
            <Info label="Persistência" value="REST e Edge Functions" />
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: ElementType; children: ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--dark)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--gray-50)' }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-700)', textAlign: 'right', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
