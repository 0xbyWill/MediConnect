import { Activity, TrendingUp, TrendingDown, Users, Calendar, Clock, Star } from 'lucide-react';
import type { Paciente, Agendamento, Laudo } from '../types';

interface MetricasProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
}

export default function Metricas({ pacientes, agendamentos, laudos }: MetricasProps) {
  const total = agendamentos.length;
  const confirmados = agendamentos.filter(a => a.status === 'confirmado').length;
  const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
  const realizados = agendamentos.filter(a => a.status === 'realizado').length;
  const taxaComp = total > 0 ? Math.round((realizados / total) * 100) : 0;
  const taxaCanc = total > 0 ? Math.round((cancelados / total) * 100) : 0;
  const laudosLiberados = laudos.filter(l => l.status === 'liberado').length;

  const Gauge = ({ value, label, color }: { value: number; label: string; color: string }) => (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 8px' }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--gray-100)" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={`${(value / 100) * 201} 201`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>
          {value}%
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600 }}>{label}</div>
    </div>
  );

  const MetricCard = ({ label, value, sub, trend, icon: Icon, color }: { label: string; value: string | number; sub?: string; trend?: 'up' | 'down'; icon: React.ElementType; color: string }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--dark)', margin: '4px 0' }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{sub}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon size={18} color={color} />
          </div>
          {trend && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 700, color: trend === 'up' ? 'var(--primary)' : 'var(--red-500)' }}>
              {trend === 'up' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend === 'up' ? '+12%' : '-3%'}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  // Fluxo por hora (mock)
  const fluxoHoras = [
    { hora: '08h', valor: 3 }, { hora: '09h', valor: 7 }, { hora: '10h', valor: 5 },
    { hora: '11h', valor: 8 }, { hora: '12h', valor: 2 }, { hora: '13h', valor: 1 },
    { hora: '14h', valor: 6 }, { hora: '15h', valor: 9 }, { hora: '16h', valor: 7 },
    { hora: '17h', valor: 4 },
  ];
  const maxFluxo = Math.max(...fluxoHoras.map(h => h.valor));

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Métricas de Performance</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Acompanhe os indicadores de performance da clínica em tempo real.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Total Pacientes" value={pacientes.length} sub={`${pacientes.filter(p => p.status === 'Ativo').length} ativos`} trend="up" icon={Users} color="var(--primary)" />
        <MetricCard label="Agendamentos" value={total} sub={`${confirmados} confirmados`} trend="up" icon={Calendar} color="#3b82f6" />
        <MetricCard label="Laudos Emitidos" value={laudosLiberados} sub={`${laudos.length} total`} trend="up" icon={Activity} color="#7c3aed" />
        <MetricCard label="Tempo Médio" value="28 min" sub="por consulta" icon={Clock} color="#f59e0b" />
        <MetricCard label="Satisfação" value="4.8" sub="★ avaliação média" trend="up" icon={Star} color="#f59e0b" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
        {/* Gauges */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 20 }}>Taxas de Performance</h3>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <Gauge value={taxaComp || 87} label="Comparecimento" color="var(--primary)" />
            <Gauge value={100 - taxaCanc} label="Retenção" color="#3b82f6" />
            <Gauge value={laudos.length > 0 ? Math.round((laudosLiberados / laudos.length) * 100) : 0} label="Laudos OK" color="#7c3aed" />
          </div>
        </div>

        {/* Fluxo por hora */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 20 }}>Fluxo de Pacientes por Hora</h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {fluxoHoras.map((h, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{
                  width: '100%', background: i === 7 ? 'var(--primary)' : 'var(--mint)',
                  borderRadius: '4px 4px 0 0',
                  height: `${(h.valor / maxFluxo) * 64}px`,
                  transition: 'height .4s',
                }} />
                <span style={{ fontSize: 9, color: 'var(--gray-400)', fontWeight: 600 }}>{h.hora}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 700, marginTop: 10 }}>Pico: 15h · {maxFluxo} atendimentos</div>
        </div>

        {/* Top convênios */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 20 }}>Top Convênios</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {Object.entries(
              pacientes.reduce<Record<string, number>>((acc, p) => {
                acc[p.convenio] = (acc[p.convenio] || 0) + 1;
                return acc;
              }, {})
            ).sort((a, b) => b[1] - a[1]).map(([conv, count], i) => {
              const pct = pacientes.length > 0 ? Math.round((count / pacientes.length) * 100) : 0;
              const colors = ['var(--primary)', '#3b82f6', '#7c3aed', '#f59e0b', '#ef4444', '#ec4899', '#0891b2'];
              return (
                <div key={conv}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-700)', fontWeight: 600 }}>{conv}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--gray-100)', borderRadius: 3 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: colors[i % colors.length], borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}