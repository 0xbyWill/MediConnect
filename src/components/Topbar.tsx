import { BarChart2, Bell, Check, ChevronRight, Trash2 } from 'lucide-react';
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
  laudos: 'Laudos',
  comunicacao: 'Comunicação',
  relatorios: 'Relatórios',
  usuarios: 'Usuários',
  metricas: 'Métricas',
  configuracoes: 'Configurações',
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

  return (
    <header className="app-topbar" style={{
      width: '100%', minWidth: 0,
      minHeight: 'var(--topbar-h)', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--darker) 0%, var(--dark) 58%, #2f8f49 100%)',
      display: 'flex', alignItems: 'center',
      gap: 16, padding: '12px clamp(16px, 2.4vw, 28px)',
      flexWrap: 'wrap',
      boxShadow: '0 1px 0 rgba(255,255,255,0.12) inset, 0 8px 24px rgba(20,83,45,0.14)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.74)', fontSize: 13, minWidth: 0 }}>
        <BarChart2 size={14} />
        <ChevronRight size={12} />
        <span style={{ color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pageLabels[currentPage]}</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setOpen(v => !v)} style={{
            width: 36, height: 36, borderRadius: 'var(--radius-md)',
            background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', position: 'relative',
            transition: 'background .16s ease, border-color .16s ease, transform .16s ease',
          }}>
            <Bell size={16} color="#fff" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                minWidth: 16, height: 16, background: '#ef4444',
                borderRadius: 999, border: '2px solid var(--darker)',
                color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center',
              }}>{unreadCount}</span>
            )}
          </button>

          {open && (
            <div style={{ position: 'absolute', top: 44, right: 0, width: 'min(360px, calc(100vw - 24px))', background: '#fff', border: '1px solid var(--gray-100)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', zIndex: 100, overflow: 'hidden' }}>
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--gray-100)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, background: 'linear-gradient(180deg, #fff 0%, var(--gray-50) 100%)' }}>
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
                  <button key={notification.id} onClick={() => onMarkNotificationRead?.(notification.id)}
                    style={{ width: '100%', border: 'none', background: notification.read ? '#fff' : 'var(--mint)', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', borderBottom: '1px solid var(--gray-50)', display: 'flex', gap: 10 }}>
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

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.13)',
          border: '1px solid rgba(255,255,255,0.22)',
          borderRadius: 'var(--radius-md)', padding: '6px 12px 6px 6px',
          minWidth: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 'var(--radius-sm)', background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
            flexShrink: 0,
          }}>
            {user?.full_name ? initials(user.full_name) : '??'}
          </div>
          <div className="app-topbar-user-copy" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              {user?.full_name || 'Usuário'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>
              {user?.specialty || ROLE_LABEL[role]}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
