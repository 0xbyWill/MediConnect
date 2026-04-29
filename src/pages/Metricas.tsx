import { Activity, AlertCircle, Calendar, Clock, FileText, Users } from 'lucide-react';
import type { ElementType } from 'react';
import type { Agendamento, Laudo, Paciente } from '../types';

interface MetricasProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
}

function MetricCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: ElementType; color: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--dark)', margin: '4px 0' }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{sub}</div>}
        </div>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} color={color} />
        </div>
      </div>
    </div>
  );
}

function Gauge({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 8px' }}>
        <svg viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="40" cy="40" r="32" fill="none" stroke="var(--gray-100)" strokeWidth="8" />
          <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="8" strokeDasharray={`${(value / 100) * 201} 201`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: 'var(--dark)' }}>{value}%</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700 }}>{label}</div>
    </div>
  );
}

export default function Metricas({ pacientes, agendamentos, laudos }: MetricasProps) {
  const total = agendamentos.length;
  const confirmados = agendamentos.filter(a => a.status === 'confirmado').length;
  const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
  const realizados = agendamentos.filter(a => a.status === 'realizado').length;
  const laudosLiberados = laudos.filter(l => l.status === 'liberado').length;
  const taxaComparecimento = total > 0 ? Math.round((realizados / total) * 100) : 0;
  const taxaCancelamento = total > 0 ? Math.round((cancelados / total) * 100) : 0;
  const duracoes = agendamentos.map(a => parseInt(a.duracao || '0', 10)).filter(v => Number.isFinite(v) && v > 0);
  const tempoMedio = duracoes.length ? Math.round(duracoes.reduce((sum, v) => sum + v, 0) / duracoes.length) : 0;

  const fluxoHoras = Array.from({ length: 13 }, (_, index) => {
    const hora = index + 7;
    return {
      label: `${String(hora).padStart(2, '0')}h`,
      value: agendamentos.filter(a => parseInt(a.hora.slice(0, 2), 10) === hora).length,
    };
  });
  const maxFluxo = Math.max(1, ...fluxoHoras.map(item => item.value));
  const pico = fluxoHoras.reduce((max, item) => item.value > max.value ? item : max, fluxoHoras[0]);

  const consultasPorPaciente = Object.entries(agendamentos.reduce<Record<string, number>>((acc, appt) => {
    const paciente = pacientes.find(p => p.id === appt.pacienteId);
    const nome = paciente?.nome || 'Paciente removido';
    acc[nome] = (acc[nome] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const laudosPorPaciente = Object.entries(laudos.reduce<Record<string, number>>((acc, laudo) => {
    const paciente = pacientes.find(p => p.id === laudo.pacienteId);
    const nome = paciente?.nome || 'Paciente removido';
    acc[nome] = (acc[nome] || 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Métricas de Performance</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>Fluxos, produtividade e tabelas com dados reais carregados da API.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
        <MetricCard label="Pacientes" value={pacientes.length} sub={`${pacientes.filter(p => p.status === 'Ativo').length} ativos`} icon={Users} color="var(--primary)" />
        <MetricCard label="Agendamentos" value={total} sub={`${confirmados} confirmados`} icon={Calendar} color="#3b82f6" />
        <MetricCard label="Laudos emitidos" value={laudosLiberados} sub={`${laudos.length} total`} icon={Activity} color="#7c3aed" />
        <MetricCard label="Tempo médio" value={tempoMedio ? `${tempoMedio} min` : '0 min'} sub="por consulta" icon={Clock} color="#f59e0b" />
        <MetricCard label="Cancelamentos" value={`${taxaCancelamento}%`} sub={`${cancelados} cancelado${cancelados === 1 ? '' : 's'}`} icon={AlertCircle} color="#ef4444" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
        <Panel title="Taxas principais" icon={Activity}>
          <div style={{ display: 'flex', justifyContent: 'space-around', gap: 12, flexWrap: 'wrap' }}>
            <Gauge value={taxaComparecimento} label="Comparecimento" color="var(--primary)" />
            <Gauge value={100 - taxaCancelamento} label="Retenção" color="#3b82f6" />
            <Gauge value={laudos.length ? Math.round((laudosLiberados / laudos.length) * 100) : 0} label="Laudos OK" color="#7c3aed" />
          </div>
        </Panel>

        <Panel title="Fluxo por hora" icon={Calendar}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 92 }}>
            {fluxoHoras.map(item => (
              <div key={item.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div style={{ width: '100%', height: `${(item.value / maxFluxo) * 70}px`, background: item.label === pico.label ? 'var(--primary)' : 'var(--mint)', borderRadius: '5px 5px 0 0' }} />
                <span style={{ fontSize: 9, color: 'var(--gray-400)', fontWeight: 700 }}>{item.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, marginTop: 10 }}>Pico: {pico.label} · {pico.value} atendimento{pico.value === 1 ? '' : 's'}</div>
        </Panel>

        <TablePanel title="Consultas por paciente" icon={Users} rows={consultasPorPaciente} />
        <TablePanel title="Laudos por paciente" icon={FileText} rows={laudosPorPaciente} />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 16, padding: 24, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h3>
      {children}
    </div>
  );
}

function TablePanel({ title, icon, rows }: { title: string; icon: ElementType; rows: [string, number][] }) {
  return (
    <Panel title={title} icon={icon}>
      {rows.length === 0 ? (
        <div style={{ padding: 22, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Sem dados disponíveis.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} style={{ borderBottom: '1px solid var(--gray-50)' }}>
                <td style={{ padding: '10px 0', fontSize: 13, color: 'var(--gray-700)', fontWeight: 600 }}>{label}</td>
                <td style={{ padding: '10px 0', fontSize: 13, color: 'var(--dark)', fontWeight: 800, textAlign: 'right' }}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
