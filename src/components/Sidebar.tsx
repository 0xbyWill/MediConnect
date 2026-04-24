import { LayoutDashboard, Users, Calendar, FileText, Settings, Heart, MessageSquare, BarChart2, UserCog, Activity, LogOut } from 'lucide-react';
import type { PageType, UserRole } from '../types';
import { ROLE_PAGES } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
  capacidade: number;
}

// ─── Definição de todos os itens de navegação ─────────────────────────────────
const ALL_NAV: { id: PageType; label: string; icon: React.ElementType; group: 'principal' | 'clinico' | 'gestao' | 'sistema' }[] = [
  { id: 'dashboard',     label: 'Dashboard',        icon: LayoutDashboard, group: 'principal' },
  { id: 'pacientes',     label: 'Pacientes',         icon: Users,           group: 'clinico' },
  { id: 'agenda',        label: 'Agenda',            icon: Calendar,        group: 'clinico' },
  { id: 'laudos',        label: 'Laudos',            icon: FileText,        group: 'clinico' },
  { id: 'comunicacao',   label: 'Comunicação',       icon: MessageSquare,   group: 'clinico' },
  { id: 'relatorios',    label: 'Relatórios',        icon: BarChart2,       group: 'clinico' },
  { id: 'usuarios',      label: 'Usuários',          icon: UserCog,         group: 'gestao' },
  { id: 'metricas',      label: 'Métricas',          icon: Activity,        group: 'gestao' },
  { id: 'configuracoes', label: 'Configurações',     icon: Settings,        group: 'sistema' },
];

const ROLE_LABEL: Record<UserRole, string> = {
  medico:    'Médico',
  gestao:    'Gestão',
  secretaria: 'Secretaria',
};

const ROLE_COLOR: Record<UserRole, string> = {
  medico:    'var(--light)',
  gestao:    '#a78bfa',
  secretaria: '#fbbf24',
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function Sidebar({ currentPage, onNavigate, capacidade }: SidebarProps) {
  const { user, logout } = useAuth();
  const role = user?.role ?? 'secretaria';
  const allowed = ROLE_PAGES[role];

  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));

  const groups: { key: string; label: string; items: typeof ALL_NAV }[] = [
    { key: 'principal', label: 'Principal',    items: visibleNav.filter(i => i.group === 'principal') },
    { key: 'clinico',   label: 'Clínico',      items: visibleNav.filter(i => i.group === 'clinico') },
    { key: 'gestao',    label: 'Gestão',        items: visibleNav.filter(i => i.group === 'gestao') },
    { key: 'sistema',   label: 'Sistema',       items: visibleNav.filter(i => i.group === 'sistema') },
  ].filter(g => g.items.length > 0);

  return (
    <aside style={{
      width: 'clamp(88px, 18vw, var(--sidebar-w))',
      flexShrink: 0,
      minHeight: '100dvh',
      background: 'linear-gradient(180deg, var(--darker) 0%, var(--dark) 100%)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{ padding: '20px 20px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, background: 'var(--primary)', borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(58,170,53,0.4)',
          }}>
            <Heart size={18} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>MediConnect</div>
            <div style={{ fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 1 }}>
              Clinical Sanctuary
            </div>
          </div>
        </div>
      </div>

      {/* Badge de perfil */}
      {user && (
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{
            background: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: '8px 10px',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 800, color: '#fff',
            }}>
              {user.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.full_name}
              </div>
              <div style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: ROLE_COLOR[role], flexShrink: 0 }} />
                <span style={{ color: ROLE_COLOR[role], fontWeight: 600 }}>{ROLE_LABEL[role]}</span>
                {user.specialty && (
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>· {user.specialty}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ padding: '10px 12px', flex: 1, overflowY: 'auto' }}>
        {groups.map(group => (
          <div key={group.key}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.8, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)', padding: '0 8px', margin: '10px 0 5px',
            }}>
              {group.label}
            </div>
            {group.items.map(item => {
              const active = currentPage === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
                    color: active ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontSize: 13.5, fontWeight: 500, marginBottom: 2,
                    border: active ? '1px solid rgba(58,170,53,0.3)' : '1px solid transparent',
                    background: active ? 'rgba(58,170,53,0.22)' : 'none',
                    width: '100%', textAlign: 'left', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { if (!active) { (e.currentTarget).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget).style.color = '#fff'; } }}
                  onMouseLeave={e => { if (!active) { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'rgba(255,255,255,0.6)'; } }}
                >
                  <Icon size={16} color={active ? 'var(--light)' : undefined} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Capacidade */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            Capacidade Clínica
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '2px 0 5px' }}>{capacidade}%</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--light), var(--primary))', borderRadius: 2, width: `${capacidade}%`, transition: 'width .3s' }} />
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', borderRadius: 10, cursor: 'pointer',
            color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 500,
            background: 'none', border: '1px solid transparent', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget).style.color = '#f87171'; (e.currentTarget).style.borderColor = 'rgba(239,68,68,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget).style.background = 'none'; (e.currentTarget).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget).style.borderColor = 'transparent'; }}
        >
          <LogOut size={15} />
          Sair do sistema
        </button>
      </div>
    </aside>
  );
}