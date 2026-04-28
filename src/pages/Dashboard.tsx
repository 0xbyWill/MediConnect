import React from 'react';
import {
  Activity,
  ArrowRight,
  BarChart2,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  PlusCircle,
  Star,
  UserCheck,
  UserCog,
  UserPlus,
} from 'lucide-react';
import type { Agendamento, Laudo, Paciente, PageType, UserRole } from '../types';
import { ROLE_PAGES } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface DashboardProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  onNavigate: (page: PageType) => void;
  onNovoAgendamento: () => void;
  onNovoPaciente: () => void;
}

const DAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  confirmado: { bg: 'var(--mint)', color: 'var(--dark)', label: 'Confirmada' },
  pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)', label: 'Em espera' },
  cancelado: { bg: 'var(--red-100)', color: 'var(--red-600)', label: 'Cancelado' },
  realizado: { bg: '#ede9fe', color: '#5b21b6', label: 'Realizado' },
};

type KpiItem = {
  label: string;
  value: number | string;
  icon: React.ElementType;
  live?: boolean;
};

function KPI({ label, value, icon: Icon, live }: KpiItem) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', minWidth: 0 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {label}
          {live && <span style={{ background: 'var(--primary)', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 20 }}>LIVE</span>}
        </div>
        <div style={{ fontSize: 36, fontWeight: 800, color: 'var(--dark)', marginTop: 6, lineHeight: 1 }}>{value}</div>
      </div>
      <div style={{ width: 48, height: 48, background: 'var(--mint)', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={22} color="var(--primary)" />
      </div>
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', ...style }}>
      {children}
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, primary = false }: { icon: React.ElementType; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button onClick={onClick}
      style={{ width: '100%', padding: '11px 16px', background: primary ? 'var(--primary)' : '#fff', color: primary ? '#fff' : 'var(--gray-700)', border: primary ? 'none' : '1px solid var(--gray-200)', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: primary ? '0 2px 8px rgba(58,170,53,0.25)' : 'none' }}>
      <Icon size={15} /> {label}
    </button>
  );
}

export default function Dashboard({
  pacientes, agendamentos, laudos,
  onNavigate, onNovoAgendamento, onNovoPaciente,
}: DashboardProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'secretaria';
  const allowedPages = ROLE_PAGES[role];
  const canNavigate = (page: PageType) => allowedPages.includes(page);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const todayAppts = agendamentos.filter(a => a.data === todayStr).sort((a, b) => a.hora.localeCompare(b.hora));
  const waitAppts = todayAppts.filter(a => a.status === 'pendente');
  const confirmedAppts = todayAppts.filter(a => a.status === 'confirmado');
  const laudosLiberados = laudos.filter(l => l.status === 'liberado');
  const laudosRascunho = laudos.filter(l => l.status === 'rascunho');
  const pacAtivos = pacientes.filter(p => p.status === 'Ativo');
  const taxaConfirmacao = todayAppts.length > 0 ? `${Math.round((confirmedAppts.length / todayAppts.length) * 100)}%` : '0%';

  const dateStr = `${DAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`;
  const hora = today.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const displayName = user?.full_name?.trim() || 'Usuário';

  const kpisByRole: Record<UserRole, KpiItem[]> = {
    medico: [
      { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
      { label: 'Pacientes na Espera', value: waitAppts.length, icon: Clock, live: true },
      { label: 'Meus Pacientes', value: pacAtivos.length, icon: UserPlus },
      { label: 'Laudos Emitidos', value: laudosLiberados.length, icon: FileText },
    ],
    secretaria: [
      { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
      { label: 'Fila de Espera', value: waitAppts.length, icon: Clock, live: true },
      { label: 'Pacientes Ativos', value: pacAtivos.length, icon: UserPlus },
      { label: 'Confirmação Hoje', value: taxaConfirmacao, icon: MessageSquare },
    ],
    gestao: [
      { label: 'Pacientes Ativos', value: pacAtivos.length, icon: UserPlus },
      { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
      { label: 'Laudos Emitidos', value: laudosLiberados.length, icon: FileText },
      { label: 'Taxa de Confirmação', value: taxaConfirmacao, icon: Activity },
    ],
  };

  const remindersByRole: Record<UserRole, { icon: React.ElementType; text: string; sub: string }[]> = {
    medico: [
      { icon: FileText, text: 'Laudos em rascunho', sub: `${laudosRascunho.length} pendente${laudosRascunho.length === 1 ? '' : 's'} de revisão` },
      { icon: Clock, text: 'Agenda do dia', sub: `${todayAppts.length} consulta${todayAppts.length === 1 ? '' : 's'} programada${todayAppts.length === 1 ? '' : 's'}` },
    ],
    secretaria: [
      { icon: Clock, text: 'Fila de espera', sub: `${waitAppts.length} paciente${waitAppts.length === 1 ? '' : 's'} aguardando hoje` },
      { icon: MessageSquare, text: 'Confirmações', sub: 'Priorize pacientes com status pendente' },
    ],
    gestao: [
      { icon: BarChart2, text: 'Acompanhar indicadores', sub: 'Revise produção e taxa de confirmação' },
      { icon: UserCog, text: 'Equipe e acessos', sub: 'Mantenha usuários e permissões atualizados' },
    ],
  };

  const quickActions = [
    canNavigate('agenda') && { label: 'Novo Agendamento', icon: PlusCircle, onClick: onNovoAgendamento, primary: true },
    canNavigate('pacientes') && { label: role === 'medico' ? 'Cadastrar Paciente' : 'Novo Paciente', icon: UserCheck, onClick: onNovoPaciente },
    canNavigate('laudos') && role !== 'secretaria' && { label: 'Abrir Laudos', icon: FileText, onClick: () => onNavigate('laudos') },
    canNavigate('relatorios') && role === 'gestao' && { label: 'Ver Relatórios', icon: BarChart2, onClick: () => onNavigate('relatorios') },
  ].filter(Boolean) as { label: string; icon: React.ElementType; onClick: () => void; primary?: boolean }[];

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--dark)', lineHeight: 1.25, wordBreak: 'break-word' }}>
            {saudacao}, {displayName}!
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 3 }}>{dateStr}</p>
        </div>

      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {kpisByRole[role].map(item => <KPI key={item.label} {...item} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 24, alignItems: 'start' }}>
        <Panel>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)' }}>
              {role === 'gestao' ? 'Operação do Dia' : 'Agenda do Dia'}
            </h2>
            {canNavigate('agenda') && (
              <button onClick={() => onNavigate('agenda')}
                style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                Ver completa
              </button>
            )}
          </div>

          {todayAppts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--gray-400)' }}>
              <Calendar size={32} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
              <p style={{ fontSize: 13 }}>Nenhuma consulta hoje</p>
              {canNavigate('agenda') && (
                <button onClick={onNovoAgendamento}
                  style={{ marginTop: 12, padding: '8px 16px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  + Agendar consulta
                </button>
              )}
            </div>
          ) : (
            <>
              {todayAppts.slice(0, 6).map((a, i) => {
                const p = pacientes.find(pac => pac.id === a.pacienteId);
                const isFirst = i === 0 && a.status === 'confirmado';
                const badge = STATUS_BADGE[a.status] ?? STATUS_BADGE.confirmado;
                return (
                  <div key={a.id}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', borderRadius: 10, background: isFirst ? 'linear-gradient(90deg, var(--mint) 0%, transparent 100%)' : 'transparent' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: isFirst ? 'var(--primary)' : 'var(--gray-700)', minWidth: 40 }}>{a.hora}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p?.nome || 'Paciente não localizado'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{p?.convenio && `${p.convenio} · `}{a.tipo}</div>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, flexShrink: 0, background: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    {i < Math.min(todayAppts.length, 6) - 1 && <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 12px' }} />}
                  </div>
                );
              })}
              {canNavigate('agenda') && (
                <button onClick={() => onNavigate('agenda')}
                  style={{ marginTop: 14, width: '100%', padding: '10px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  VER AGENDA COMPLETA <ArrowRight size={13} />
                </button>
              )}
            </>
          )}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 14 }}>Ações Rápidas</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {quickActions.map(action => <ActionButton key={action.label} {...action} />)}
            </div>
          </Panel>

          {role !== 'secretaria' && (
            <Panel style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>Laudos</h3>
                {canNavigate('laudos') && (
                  <button onClick={() => onNavigate('laudos')}
                    style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Ver todos</button>
                )}
              </div>
              {[
                { label: 'A descrever', value: laudosRascunho.length, color: '#f59e0b' },
                { label: 'Liberados', value: laudosLiberados.length, color: 'var(--primary)' },
                { label: 'Total', value: laudos.length, color: 'var(--gray-600)' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--gray-50)' }}>
                  <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>{item.label}</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </Panel>
          )}

          <Panel style={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>Lembretes</h3>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
            </div>
            {remindersByRole[role].map((r, i) => (
              <div key={r.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < remindersByRole[role].length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <r.icon size={13} color="var(--primary)" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-700)' }}>{r.text}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{r.sub}</div>
                </div>
              </div>
            ))}
          </Panel>

          {role === 'gestao' && (
            <Panel style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 14 }}>Fluxo da Clínica</h3>
              <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 44 }}>
                {[20, 35, 25, 40, 30, 45, 38, 55, 42, 60].map((h, i) => (
                  <div key={i} style={{ flex: 1, background: i === 9 ? 'var(--primary)' : 'var(--mint)', borderRadius: 3, height: `${h}%`, transition: 'height .3s' }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--primary)', fontWeight: 800, marginTop: 8 }}>
                {todayAppts.length > 0 ? `${todayAppts.length} consulta${todayAppts.length > 1 ? 's' : ''} hoje` : 'Sem consultas hoje'}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
