import {
  Activity,
  BarChart2,
  Bell,
  Bot,
  Calendar,
  Check,
  ClipboardList,
  FileText,
  Headset,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PillBottle,
  Settings,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { PageType, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { initials } from '../shared/utils/text';

interface TopbarProps {
  currentPage: PageType;
  notifications?: {
    id: string;
    title: string;
    message: string;
    read: boolean;
  }[];
  onMarkNotificationRead?: (id: string) => void;
  onClearNotifications?: () => void;
}

const pageLabels: Record<PageType, string> = {
  dashboard: 'Dashboard',
  pacientes: 'Pacientes',
  agenda: 'Agenda',
  'fila-prioridade': 'Fila de Prioridade',
  registro: 'Registro',
  laudos: 'Laudos',
  comunicacao: 'Comunicação',
  mensagens: 'Mensagens',
  relatorios: 'Relatórios',
  usuarios: 'Usuários',
  metricas: 'Métricas',
  ia: 'Assistente IA',
  'biblioteca-farmacologica': 'Biblioteca Farmacológica',
  configuracoes: 'Configurações',
};

const pageIcons: Record<PageType, React.ElementType> = {
  dashboard: LayoutDashboard,
  pacientes: Users,
  agenda: Calendar,
  'fila-prioridade': ListChecks,
  registro: ClipboardList,
  laudos: FileText,
  comunicacao: Headset,
  mensagens: MessageSquare,
  relatorios: BarChart2,
  usuarios: UserCog,
  metricas: Activity,
  ia: Bot,
  'biblioteca-farmacologica': PillBottle,
  configuracoes: Settings,
};

const ROLE_LABEL: Record<UserRole, string> = {
  medico: 'Médico',
  gestao: 'Gestão / Coord.',
  secretaria: 'Secretaria',
  paciente: 'Paciente',
};

export default function Topbar({ currentPage, notifications = [], onMarkNotificationRead, onClearNotifications }: TopbarProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const role = user?.role ?? 'secretaria';
  const unreadCount = notifications.filter(n => !n.read).length;
  const PageIcon = pageIcons[currentPage];

  return (
    <header
      className="app-topbar"
      style={{
        width: '100%',
        minWidth: 0,
        height: 'var(--topbar-h)',
        flexShrink: 0,
        background: 'rgba(255,255,255,0.94)',
        borderBottom: '1px solid var(--layout-line)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 var(--app-gutter-x)',
        flexWrap: 'nowrap',
        boxShadow: 'none',
        backdropFilter: 'blur(18px)',
        position: 'relative',
        zIndex: 200,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#475569', minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--mint)',
            color: 'var(--primary)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PageIcon size={18} strokeWidth={2.4} />
        </span>
        <span style={{ color: '#111827', fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {pageLabels[currentPage]}
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', overflow: 'visible' }}>
          <button
            onClick={() => setOpen(value => !value)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: '#fff',
              border: '1px solid rgba(15,118,75,0.12)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background .16s ease, border-color .16s ease, transform .16s ease',
              boxShadow: 'none',
            }}
          >
            <Bell size={16} color="#334155" />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -7,
                  right: -7,
                  minWidth: 20,
                  height: 20,
                  background: '#f97316',
                  borderRadius: 999,
                  border: '2px solid #fff',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: 'none',
                  zIndex: 2,
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div style={{ position: 'absolute', top: 48, right: 0, width: 'min(360px, calc(100vw - 24px))', background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 1000, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: '#fff' }}>
                <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>Notificações</strong>
                {notifications.length > 0 && (
                  <button onClick={onClearNotifications} title="Limpar notificações" style={{ border: 'none', background: 'none', color: 'var(--gray-400)', cursor: 'pointer', display: 'flex' }}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div style={{ maxHeight: 320, overflow: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 18, fontSize: 13, color: 'var(--gray-400)', textAlign: 'center' }}>Nenhuma notificação recente.</div>
                ) : notifications.map(notification => (
                  <button
                    key={notification.id}
                    onClick={() => onMarkNotificationRead?.(notification.id)}
                    style={{ width: '100%', border: 'none', background: notification.read ? '#fff' : 'var(--mint)', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)', display: 'flex', gap: 10 }}
                  >
                    <Check size={14} color={notification.read ? 'var(--gray-300)' : 'var(--primary)'} style={{ flexShrink: 0, marginTop: 2 }} />
                    <span>
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--gray-800)', fontWeight: 800 }}>{notification.title}</span>
                      <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-500)', marginTop: 2, lineHeight: 1.4 }}>{notification.message}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: '#fff',
            border: '1px solid rgba(15,118,75,0.12)',
            borderRadius: 'var(--radius-md)',
            padding: '6px 12px 6px 6px',
            minWidth: 0,
            boxShadow: 'none',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: '#d7fae5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              color: 'var(--primary)',
              flexShrink: 0,
            }}
          >
            {user?.full_name ? initials(user.full_name) : '??'}
          </div>
          <div className="app-topbar-user-copy" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#111827', lineHeight: 1.2 }}>
              {user?.full_name || 'Usuario'}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>
              {user?.specialty || ROLE_LABEL[role]}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
