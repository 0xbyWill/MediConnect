import { LayoutDashboard, Users, Calendar, FileText, Settings, MessageSquare, BarChart2, UserCog, Activity, LogOut, Headset, Bot, ClipboardList } from 'lucide-react';
import type { PageType } from '../types';
import { ROLE_PAGES } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  currentPage: PageType;
  onNavigate: (page: PageType) => void;
}

const ALL_NAV: { id: PageType; label: string; icon: React.ElementType; group: 'principal' | 'clinico' | 'gestao' | 'sistema' }[] = [
  { id: 'dashboard',     label: 'Dashboard',        icon: LayoutDashboard, group: 'principal' },
  { id: 'pacientes',     label: 'Pacientes',         icon: Users,           group: 'clinico' },
  { id: 'agenda',        label: 'Agenda',            icon: Calendar,        group: 'clinico' },
  { id: 'registro',      label: 'Registro',          icon: ClipboardList,   group: 'clinico' },
  { id: 'laudos',        label: 'Laudos',            icon: FileText,        group: 'clinico' },
  { id: 'comunicacao',   label: 'Comunicação',       icon: Headset,         group: 'clinico' },
  { id: 'mensagens',     label: 'Mensagens',         icon: MessageSquare,   group: 'clinico' },
  { id: 'relatorios',    label: 'Relatórios',        icon: BarChart2,       group: 'clinico' },
  { id: 'usuarios',      label: 'Usuários',          icon: UserCog,         group: 'gestao' },
  { id: 'metricas',      label: 'Métricas',          icon: Activity,        group: 'gestao' },
  { id: 'ia',            label: 'Assistente IA',     icon: Bot,             group: 'gestao' },
  { id: 'configuracoes', label: 'Configurações',     icon: Settings,        group: 'sistema' },
];

const PROJECT_MARK_SRC = '/mediconnect-mark.png';

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const role = user?.role ?? 'secretaria';
  const allowed = ROLE_PAGES[role];
  const visibleNav = ALL_NAV.filter(item => allowed.includes(item.id));

  const groups: { key: string; label: string; items: typeof ALL_NAV }[] = [
    { key: 'principal', label: 'Principal', items: visibleNav.filter(i => i.group === 'principal') },
    { key: 'clinico', label: 'Clínico', items: visibleNav.filter(i => i.group === 'clinico') },
    { key: 'gestao', label: 'Gestão', items: visibleNav.filter(i => i.group === 'gestao') },
    { key: 'sistema', label: 'Sistema', items: visibleNav.filter(i => i.group === 'sistema') },
  ].filter(g => g.items.length > 0);

  return (
    <aside
      className="app-sidebar"
      style={{
        width: 'var(--sidebar-w)',
        flexShrink: 0,
        height: '100dvh',
        minHeight: 0,
        background: '#008f51',
        borderRight: '1px solid rgba(255,255,255,0.18)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        boxShadow: 'none',
      }}
    >
      <div
        className="app-sidebar-logo"
        style={{
          height: 'var(--topbar-h)',
          flexShrink: 0,
          padding: '0 16px',
          borderBottom: '1px solid rgba(255,255,255,0.18)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="app-sidebar-brand-row" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <div
            style={{
              width: 40,
              height: 40,
              background: '#fff',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'none',
              flexShrink: 0,
              overflow: 'hidden',
              padding: 4,
            }}
          >
            <img
              src={PROJECT_MARK_SRC}
              alt=""
              aria-hidden="true"
              style={{ width: '220%', height: '220%', display: 'block', objectFit: 'contain' }}
            />
          </div>
          <div className="app-sidebar-label" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: 0, lineHeight: 1.1, textAlign: 'center' }}>MediConnect</div>
          </div>
        </div>
      </div>

      <nav className="app-sidebar-nav" style={{ padding: '12px', flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {groups.map(group => (
          <div key={group.key}>
            <div
              className="app-sidebar-group-label"
              style={{
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1.6,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.62)',
                padding: '0 8px',
                margin: '14px 0 7px',
              }}
            >
              {group.label}
            </div>
            {group.items.map(item => {
              const active = currentPage === item.id;
              const Icon = item.icon;
              return (
                <button
                  className="app-sidebar-nav-button"
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    color: '#fff',
                    fontSize: 13,
                    fontWeight: active ? 800 : 650,
                    marginBottom: 4,
                    border: active ? '1px solid rgba(255,255,255,0.32)' : '1px solid transparent',
                    background: active ? 'rgba(255,255,255,0.18)' : 'transparent',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'background .16s ease, color .16s ease, border-color .16s ease, transform .16s ease',
                    boxShadow: 'none',
                  }}
                  onMouseEnter={event => {
                    if (!active) {
                      event.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                      event.currentTarget.style.color = '#fff';
                      event.currentTarget.style.transform = 'translateX(2px)';
                    }
                  }}
                  onMouseLeave={event => {
                    if (!active) {
                      event.currentTarget.style.background = 'transparent';
                      event.currentTarget.style.color = '#fff';
                      event.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <Icon size={16} color="#fff" />
                  <span className="app-sidebar-label">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="app-sidebar-footer" style={{ padding: '10px 12px 12px', borderTop: '1px solid rgba(255,255,255,0.18)' }}>
        <button
          className="app-sidebar-logout"
          onClick={logout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.86)',
            fontSize: 13,
            fontWeight: 700,
            background: 'none',
            border: '1px solid transparent',
            transition: 'all .15s',
          }}
          onMouseEnter={event => {
            event.currentTarget.style.background = 'rgba(255,255,255,0.14)';
            event.currentTarget.style.color = '#fff';
            event.currentTarget.style.borderColor = 'rgba(255,255,255,0.24)';
          }}
          onMouseLeave={event => {
            event.currentTarget.style.background = 'none';
            event.currentTarget.style.color = 'rgba(255,255,255,0.86)';
            event.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={15} />
          <span className="app-sidebar-logout-label">Sair do sistema</span>
        </button>
      </div>
    </aside>
  );
}
