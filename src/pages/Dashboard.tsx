import React from 'react';
import { Calendar, Clock, UserPlus, FileText, PlusCircle, UserCheck, Star, ArrowRight } from 'lucide-react';
import type { Paciente, Agendamento, Laudo } from '../types';
import { store } from '../store';

interface DashboardProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  onNavigate: (page: 'pacientes' | 'agenda' | 'laudos') => void;
  onNovoAgendamento: () => void;
  onNovoPaciente: () => void;
}

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function Dashboard({ pacientes, agendamentos, laudos, onNavigate, onNovoAgendamento, onNovoPaciente }: DashboardProps) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayAppts = agendamentos.filter(a => a.data === todayStr).sort((a, b) => a.hora.localeCompare(b.hora));
  const waitAppts = todayAppts.filter(a => a.status === 'pendente');
  const laudosLiberados = laudos.filter(l => l.status === 'liberado');

  const dateStr = `${DAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`;

  const KPI = ({ label, value, icon: Icon, live }: { label: string; value: number; icon: React.ElementType; live?: boolean }) => (
    <div style={{ flex: 1, background: '#fff', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
          {label}
          {live && <span style={{ background: '#3aaa35', color: '#fff', fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 20, letterSpacing: 0.5 }}>LIVE</span>}
        </div>
        <div style={{ fontSize: 38, fontWeight: 700, color: 'var(--dark)', marginTop: 4 }}>{value}</div>
      </div>
      <div style={{ width: 48, height: 48, background: 'var(--mint)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={22} color="var(--primary)" />
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Olá, Dr. User Profile</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{dateStr}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid var(--gray-200)', borderRadius: 20, padding: '4px 12px', fontSize: 12, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 6, height: 6, background: 'var(--primary)', borderRadius: '50%' }} />
          Clínico Geral
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KPI label="Consultas Hoje" value={todayAppts.length} icon={Calendar} />
        <KPI label="Pacientes na Espera" value={waitAppts.length} icon={Clock} live />
        <KPI label="Total de Pacientes" value={pacientes.length} icon={UserPlus} />
        <KPI label="Laudos Emitidos" value={laudosLiberados.length} icon={FileText} />
      </div>

      {/* Main Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* Agenda */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gray-800)' }}>Agenda do Dia</h2>
            <button onClick={() => onNavigate('agenda')} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
              Ver completa
            </button>
          </div>
          {todayAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
              <Calendar size={32} style={{ marginBottom: 8 }} />
              <p>Nenhuma consulta hoje</p>
            </div>
          ) : (
            todayAppts.slice(0, 5).map((a, i) => {
              const p = store.getPaciente(a.pacienteId);
              const isFirst = i === 0 && a.status === 'confirmado';
              const badgeStyle = a.status === 'pendente'
                ? { background: 'var(--amber-100)', color: 'var(--amber-600)' }
                : { background: 'var(--mint)', color: 'var(--dark)' };
              return (
                <div key={a.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', borderRadius: 10, background: isFirst ? 'linear-gradient(90deg, var(--mint) 0%, transparent 100%)' : 'transparent' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: isFirst ? 'var(--primary)' : 'var(--gray-700)', minWidth: 44 }}>{a.hora}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)' }}>{p?.nome || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{p?.convenio} · {a.tipo}</div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, ...badgeStyle }}>
                      {a.status === 'pendente' ? 'Em espera' : 'Confirmada'}
                    </span>
                  </div>
                  {i < todayAppts.slice(0, 5).length - 1 && <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 14px' }} />}
                </div>
              );
            })
          )}
          {todayAppts.length > 0 && (
            <button onClick={() => onNavigate('agenda')} style={{ marginTop: 16, width: '100%', padding: '10px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              VER AGENDA COMPLETA <ArrowRight size={14} />
            </button>
          )}
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Ações Rápidas */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 14 }}>Ações Rápidas</h3>
            <button onClick={onNovoAgendamento} style={{ width: '100%', padding: '11px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
              <PlusCircle size={16} /> Novo Agendamento
            </button>
            <button onClick={onNovoPaciente} style={{ width: '100%', padding: '11px 16px', background: '#fff', color: 'var(--gray-700)', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <UserCheck size={16} /> Cadastrar Paciente
            </button>
          </div>

          {/* Lembretes */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)' }}>Lembretes</h3>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
            </div>
            {[
              { icon: FileText, text: 'Retorno de exames da paciente Maria', sub: 'Urgência: Média' },
              { icon: UserCheck, text: 'Reunião de equipe às 14h', sub: 'Sala de Reuniões B' },
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i === 0 ? '1px solid var(--gray-100)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <r.icon size={13} color="var(--primary)" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-700)' }}>{r.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fluxo */}
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gray-800)', marginBottom: 14 }}>Fluxo de Clínica</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
              {[20, 35, 25, 40, 30, 45, 38, 55, 42, 60].map((h, i) => (
                <div key={i} style={{ flex: 1, background: i === 9 ? 'var(--primary)' : 'var(--mint)', borderRadius: 3, height: `${h}%` }} />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 600, marginTop: 8 }}>+12% em relação a ontem</div>
          </div>
        </div>
      </div>
    </div>
  );
}