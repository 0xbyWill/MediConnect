import { useState } from 'react';
import { BarChart2, Calendar, FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ElementType } from 'react';
import type { Agendamento, Laudo, Paciente } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface RelatoriosProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
}

type Periodo = 'diario' | 'semanal' | 'mensal' | 'trimestral' | 'semestral' | 'anual';

const PERIODOS: Record<Periodo, { label: string; days: number }> = {
  diario: { label: 'Diário', days: 1 },
  semanal: { label: 'Semanal', days: 7 },
  mensal: { label: 'Mensal', days: 30 },
  trimestral: { label: 'Trimestral', days: 90 },
  semestral: { label: 'Semestral', days: 180 },
  anual: { label: 'Anual', days: 365 },
};

function dateToISO(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateBR(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function inRange(iso: string, start: string, end: string) {
  return iso >= start && iso <= end;
}

function KPI({ label, value, sub, icon: Icon, color = 'var(--primary)' }: { label: string; value: number | string; sub?: string; icon: ElementType; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--dark)', marginTop: 4 }}>{value}</div>
          {sub && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{sub}</div>}
        </div>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </div>
      </div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(100px, 150px) 1fr 42px', alignItems: 'center', gap: 10 }}>
      <div title={label} style={{ fontSize: 12, color: 'var(--gray-600)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ height: 9, background: 'var(--gray-100)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, height: '100%', background: color, borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-700)', textAlign: 'right' }}>{value}</div>
    </div>
  );
}

export default function Relatorios({ pacientes, agendamentos, laudos }: RelatoriosProps) {
  const { user } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>('mensal');
  const isGestao = user?.role === 'gestao';
  const end = dateToISO(new Date());
  const start = dateToISO(addDays(new Date(), -(PERIODOS[periodo].days - 1)));
  const prevEnd = dateToISO(addDays(new Date(`${start}T00:00:00`), -1));
  const prevStart = dateToISO(addDays(new Date(`${prevEnd}T00:00:00`), -(PERIODOS[periodo].days - 1)));

  const appts = agendamentos.filter(a => inRange(a.data, start, end));
  const prevAppts = agendamentos.filter(a => inRange(a.data, prevStart, prevEnd));
  const reports = laudos.filter(l => inRange(l.data, start, end));
  const novosPacientes = pacientes.filter(p => appts.some(a => a.pacienteId === p.id)).length;
  const comparecimento = appts.length > 0 ? Math.round((appts.filter(a => a.status === 'realizado').length / appts.length) * 100) : 0;
  const growth = prevAppts.length > 0 ? Math.round(((appts.length - prevAppts.length) / prevAppts.length) * 100) : appts.length > 0 ? 100 : 0;

  const byPatient = Object.entries(
    appts.reduce<Record<string, number>>((acc, appt) => {
      const patient = pacientes.find(p => p.id === appt.pacienteId);
      const name = patient?.nome || 'Paciente removido';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const byHour = Object.entries(
    appts.reduce<Record<string, number>>((acc, appt) => {
      const hour = `${appt.hora.slice(0, 2)}h`;
      acc[hour] = (acc[hour] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const maxPatient = Math.max(1, ...byPatient.map(([, value]) => value));
  const maxHour = Math.max(1, ...byHour.map(([, value]) => value));

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>
            {isGestao ? 'Relatórios Gerenciais' : 'Relatórios Médicos'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            Período de {formatDateBR(start)} até {formatDateBR(end)}, usando dados carregados da API.
          </p>
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}
          style={{ minWidth: 190, padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>
          {Object.entries(PERIODOS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 22 }}>
        <KPI label="Consultas no período" value={appts.length} sub={`${growth >= 0 ? '+' : ''}${growth}% vs. período anterior`} icon={Calendar} />
        <KPI label="Pacientes atendidos" value={novosPacientes} icon={Users} />
        <KPI label="Laudos no período" value={reports.length} sub={`${reports.filter(l => l.status === 'liberado').length} liberados`} icon={FileText} color="#7c3aed" />
        <KPI label="Comparecimento" value={`${comparecimento}%`} icon={growth >= 0 ? TrendingUp : TrendingDown} color={comparecimento >= 70 ? 'var(--primary)' : '#ef4444'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 22 }}>
        <Panel title="Consultas por paciente" icon={Users}>
          {byPatient.length ? byPatient.map(([name, value]) => <Bar key={name} label={name} value={value} max={maxPatient} color="var(--primary)" />) : <Empty />}
        </Panel>

        <Panel title="Horários com maior volume" icon={BarChart2}>
          {byHour.length ? byHour.map(([hour, value]) => <Bar key={hour} label={hour} value={value} max={maxHour} color="#0369a1" />) : <Empty />}
        </Panel>

        <Panel title="Evolução recente" icon={TrendingUp}>
          <div style={{ display: 'grid', gap: 10 }}>
            <Info label="Período atual" value={`${appts.length} consulta${appts.length === 1 ? '' : 's'}`} />
            <Info label="Período anterior" value={`${prevAppts.length} consulta${prevAppts.length === 1 ? '' : 's'}`} />
            <Info label="Tendência" value={`${growth >= 0 ? 'Crescimento' : 'Queda'} de ${Math.abs(growth)}%`} />
            <Info label="Cancelamentos" value={`${appts.filter(a => a.status === 'cancelado').length}`} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: ElementType; children: React.ReactNode }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 22, border: '1px solid var(--gray-100)', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <Icon size={16} color="var(--primary)" /> {title}
      </h3>
      <div style={{ display: 'grid', gap: 12 }}>{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--gray-50)', paddingBottom: 8 }}>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{label}</span>
      <strong style={{ fontSize: 13, color: 'var(--gray-800)' }}>{value}</strong>
    </div>
  );
}

function Empty() {
  return <div style={{ padding: 22, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>Sem dados para este período.</div>;
}
