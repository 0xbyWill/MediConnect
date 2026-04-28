import { BarChart2, Bell, ChevronRight } from 'lucide-react';
import type { PageType, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TopbarProps {
  currentPage: PageType;
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
};

export default function Topbar({ currentPage }: TopbarProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'secretaria';

  return (
    <header style={{
      width: '100%', minWidth: 0,
      minHeight: 'var(--topbar-h)', flexShrink: 0,
      background: 'linear-gradient(135deg, var(--darker) 0%, var(--dark) 60%, #2d8a45 100%)',
      display: 'flex', alignItems: 'center',
      gap: 16, padding: '12px 24px',
      flexWrap: 'wrap',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
        <BarChart2 size={14} />
        <ChevronRight size={12} />
        <span style={{ color: '#fff', fontWeight: 600 }}>{pageLabels[currentPage]}</span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', position: 'relative',
        }}>
          <Bell size={16} color="#fff" />
          <span style={{
            position: 'absolute', top: 6, right: 6,
            width: 8, height: 8, background: '#ef4444',
            borderRadius: '50%', border: '2px solid var(--darker)',
          }} />
        </button>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, padding: '6px 12px 6px 6px',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: 'var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
          }}>
            {user?.full_name?.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??'}
          </div>
          <div>
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
