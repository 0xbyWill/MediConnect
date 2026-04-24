import { useState } from 'react';
import { BarChart2, Search, Bell, ChevronRight } from 'lucide-react';
import type { PageType, Paciente, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface TopbarProps {
  currentPage: PageType;
  pacientes: Paciente[];
  onSearchNavigate: (id: string) => void;
}

const pageLabels: Record<PageType, string> = {
  dashboard:     'Dashboard',
  pacientes:     'Pacientes',
  agenda:        'Agenda',
  laudos:        'Laudos',
  comunicacao:   'Comunicação',
  relatorios:    'Relatórios',
  usuarios:      'Usuários',
  metricas:      'Métricas',
  configuracoes: 'Configurações',
};

const ROLE_LABEL: Record<UserRole, string> = {
  medico:     'Médico',
  gestao:     'Gestão / Coord.',
  secretaria: 'Secretaria',
};

const ROLE_DOT_COLOR: Record<UserRole, string> = {
  medico:     'var(--light)',
  gestao:     '#a78bfa',
  secretaria: '#fbbf24',
};

export default function Topbar({ currentPage, pacientes, onSearchNavigate }: TopbarProps) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Paciente[]>([]);

  const role = user?.role ?? 'secretaria';

  const handleSearch = (val: string) => {
    setQuery(val);
    if (!val.trim()) { setResults([]); return; }
    const q = val.toLowerCase();
    setResults(
      pacientes
        .filter(p => p.nome.toLowerCase().includes(q) || p.cpf.includes(q))
        .slice(0, 5)
    );
  };

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
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>
        <BarChart2 size={14} />
        <ChevronRight size={12} />
        <span style={{ color: '#fff', fontWeight: 600 }}>{pageLabels[currentPage]}</span>
      </div>

      {/* Search */}
      <div style={{ flex: 1, minWidth: 220, maxWidth: 480, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.5)' }} />
          <input
            value={query}
            onChange={e => handleSearch(e.target.value)}
            onBlur={() => setTimeout(() => setResults([]), 200)}
            placeholder="Buscar paciente ou prontuário..."
            style={{
              width: '100%', padding: '8px 12px 8px 36px',
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 10, color: '#fff', fontSize: 13, outline: 'none',
            }}
          />
        </div>
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
            background: '#fff', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 100, overflow: 'hidden',
          }}>
            {results.map(p => (
              <button
                key={p.id}
                onMouseDown={() => { onSearchNavigate(p.id); setQuery(''); setResults([]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  width: '100%', border: 'none', background: 'none', cursor: 'pointer',
                  textAlign: 'left', borderBottom: '1px solid var(--gray-100)',
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: 'var(--mint)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'var(--dark)', flexShrink: 0,
                }}>
                  {p.nome.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{p.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p.cpf} · {p.convenio}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Notificação */}
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

        {/* Perfil — dados reais do usuário autenticado */}
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

        {/* Badge de perfil */}
        <div style={{
          background: 'rgba(255,255,255,0.12)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 20, padding: '4px 10px',
          fontSize: 11, color: '#fff',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ width: 6, height: 6, background: ROLE_DOT_COLOR[role], borderRadius: '50%' }} />
          {ROLE_LABEL[role]}
        </div>
      </div>
    </header>
  );
}