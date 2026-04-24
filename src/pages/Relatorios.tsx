import { BarChart2, TrendingUp, Users, Calendar, FileText, Clock, Download } from 'lucide-react';
import type { Paciente, Agendamento, Laudo } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RelatoriosProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
}

export default function Relatorios({ pacientes, agendamentos, laudos }: RelatoriosProps) {
  const { user } = useAuth();
  const isGestao = user?.role === 'gestao';

  const today = new Date().toISOString().split('T')[0];
  const todayAppts = agendamentos.filter(a => a.data === today);
  const confirmados = agendamentos.filter(a => a.status === 'confirmado').length;
  const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
  const laudosLiberados = laudos.filter(l => l.status === 'liberado').length;
  const laudosRascunho = laudos.filter(l => l.status === 'rascunho').length;
  const pacientesAtivos = pacientes.filter(p => p.status === 'Ativo').length;

  const KPI = ({ label, value, sub, icon: Icon, color = 'var(--primary)' }: { label: string; value: number | string; sub?: string; icon: React.ElementType; color?: string }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
        <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--dark)', margin: '4px 0' }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{sub}</div>}
      </div>
      <div style={{ width: 46, height: 46, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color={color} />
      </div>
    </div>
  );

  const BarSimple = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--gray-600)', minWidth: 80 }}>{label}</div>
      <div style={{ flex: 1, height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width .4s' }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)', minWidth: 24, textAlign: 'right' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>
            {isGestao ? 'Relatórios Gerenciais' : 'Relatórios Médicos'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            {isGestao ? 'Visão completa de performance e métricas da clínica.' : 'Acompanhe sua produção e laudos emitidos.'}
          </p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', background: 'var(--primary)', color: '#fff',
          border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          <Download size={15} /> Exportar Relatório
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPI label="Consultas Hoje" value={todayAppts.length} icon={Calendar} />
        <KPI label="Total Pacientes" value={pacientes.length} sub={`${pacientesAtivos} ativos`} icon={Users} />
        <KPI label="Laudos Emitidos" value={laudosLiberados} sub={`${laudosRascunho} em rascunho`} icon={FileText} color="#7c3aed" />
        {isGestao && (
          <KPI label="Taxa de Confirmação" value={`${agendamentos.length > 0 ? Math.round((confirmados / agendamentos.length) * 100) : 0}%`} icon={TrendingUp} color="#0369a1" />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        {/* Agendamentos por status */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <BarChart2 size={16} color="var(--primary)" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Agendamentos por Status</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BarSimple label="Confirmados" value={confirmados} max={agendamentos.length} color="var(--primary)" />
            <BarSimple label="Pendentes" value={agendamentos.filter(a => a.status === 'pendente').length} max={agendamentos.length} color="#f59e0b" />
            <BarSimple label="Realizados" value={agendamentos.filter(a => a.status === 'realizado').length} max={agendamentos.length} color="#3b82f6" />
            <BarSimple label="Cancelados" value={cancelados} max={agendamentos.length} color="#ef4444" />
          </div>
        </div>

        {/* Laudos */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <FileText size={16} color="#7c3aed" />
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Laudos</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <BarSimple label="Liberados" value={laudosLiberados} max={laudos.length || 1} color="#7c3aed" />
            <BarSimple label="Rascunhos" value={laudosRascunho} max={laudos.length || 1} color="#f59e0b" />
          </div>
          <div style={{ marginTop: 20, padding: '14px', background: 'var(--gray-50)', borderRadius: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 4 }}>Total de laudos</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--dark)' }}>{laudos.length}</div>
          </div>
        </div>

        {/* Convênios — só para gestão */}
        {isGestao && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Users size={16} color="#0369a1" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Pacientes por Convênio</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(
                pacientes.reduce<Record<string, number>>((acc, p) => {
                  acc[p.convenio] = (acc[p.convenio] || 0) + 1;
                  return acc;
                }, {})
              ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([conv, count]) => (
                <BarSimple key={conv} label={conv} value={count} max={pacientes.length} color="#0369a1" />
              ))}
            </div>
          </div>
        )}

        {/* Tempo médio — só para gestão */}
        {isGestao && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 22, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <Clock size={16} color="#f59e0b" />
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Métricas de Performance</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Taxa de comparecimento', value: '87%', color: 'var(--primary)' },
                { label: 'Taxa de cancelamento', value: `${agendamentos.length > 0 ? Math.round((cancelados / agendamentos.length) * 100) : 0}%`, color: '#ef4444' },
                { label: 'Pacientes ativos', value: `${pacientesAtivos}/${pacientes.length}`, color: '#7c3aed' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{m.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: m.color }}>{m.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}