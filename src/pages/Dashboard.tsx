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
  Users,
} from 'lucide-react';
import type { ApiDoctor } from '../lib/api';
import type { Agendamento, Laudo, Paciente, PageType, UserRole } from '../types';
import { ROLE_PAGES } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO } from '../shared/utils/date';

interface DashboardProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors?: ApiDoctor[];
  onNavigate: (page: PageType) => void;
  onNovoAgendamento: () => void;
  onNovoPaciente: () => void;
}

type KpiItem = {
  label: string;
  value: number | string;
  icon: React.ElementType;
  live?: boolean;
};

type ListItem = {
  id: string;
  title: string;
  subtitle: string;
  meta?: string;
  status?: string;
};

type DashboardModel = {
  title: string;
  agendaTitle: string;
  kpis: KpiItem[];
  mainList: ListItem[];
  secondaryTitle: string;
  secondaryList: ListItem[];
  reminders: { icon: React.ElementType; text: string; sub: string }[];
  showLaudos: boolean;
  showManagementFlow: boolean;
};

const DAYS = ['Domingo', 'Segunda-feira', 'Terca-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sabado'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  confirmado: { bg: 'var(--mint)', color: 'var(--dark)', label: 'Confirmada' },
  pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)', label: 'Pendente' },
  cancelado: { bg: 'var(--red-100)', color: 'var(--red-600)', label: 'Cancelada' },
  realizado: { bg: '#ede9fe', color: '#5b21b6', label: 'Realizada' },
};

function formatDate(iso: string) {
  const [year, month, day] = iso.split('-');
  return year && month && day ? `${day}/${month}/${year}` : iso;
}

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

function EmptyState({ text, compact = false }: { text: string; compact?: boolean }) {
  return (
    <div style={{ textAlign: 'center', padding: compact ? '18px 0' : '32px 0', color: 'var(--gray-400)' }}>
      <Calendar size={compact ? 24 : 32} style={{ marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
      <p style={{ fontSize: 13 }}>{text}</p>
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

function ListRows({ items, emptyText, limit = 6 }: { items: ListItem[]; emptyText: string; limit?: number }) {
  if (items.length === 0) return <EmptyState text={emptyText} compact />;

  return (
    <>
      {items.slice(0, limit).map((item, i) => {
        const badge = item.status ? STATUS_BADGE[item.status] : undefined;
        return (
          <div key={item.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 12px', borderRadius: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{item.subtitle}</div>
                {item.meta && <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>{item.meta}</div>}
              </div>
              {badge && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 20, flexShrink: 0, background: badge.bg, color: badge.color }}>
                  {badge.label}
                </span>
              )}
            </div>
            {i < Math.min(items.length, limit) - 1 && <div style={{ height: 1, background: 'var(--gray-100)', margin: '0 12px' }} />}
          </div>
        );
      })}
    </>
  );
}

function buildDashboardModel(params: {
  role: UserRole;
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors: ApiDoctor[];
  todayStr: string;
}): DashboardModel {
  const { role, pacientes, agendamentos, laudos, doctors, todayStr } = params;
  const todayAppts = agendamentos.filter(a => a.data === todayStr).sort((a, b) => a.hora.localeCompare(b.hora));
  const upcomingAppts = agendamentos.filter(a => a.data >= todayStr).sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
  const waitAppts = todayAppts.filter(a => a.status === 'pendente');
  const confirmedAppts = todayAppts.filter(a => a.status === 'confirmado');
  const laudosLiberados = laudos.filter(l => l.status === 'liberado');
  const laudosRascunho = laudos.filter(l => l.status === 'rascunho');
  const pacAtivos = pacientes.filter(p => p.status === 'Ativo');
  const taxaConfirmacao = todayAppts.length > 0 ? `${Math.round((confirmedAppts.length / todayAppts.length) * 100)}%` : '0%';
  const patientName = (id: string) => pacientes.find(p => p.id === id)?.nome || 'Paciente não localizado';
  const doctorName = (id?: string) => doctors.find(d => d.id === id)?.full_name || 'Médico não informado';
  const appointmentItem = (a: Agendamento): ListItem => ({
    id: a.id,
    title: patientName(a.pacienteId),
    subtitle: `${formatDate(a.data)} às ${a.hora} - ${a.tipo}`,
    meta: doctorName(a.medicoId),
    status: a.status,
  });

  const baseReminders = {
    medico: [
      { icon: FileText, text: 'Laudos em rascunho', sub: `${laudosRascunho.length} pendente${laudosRascunho.length === 1 ? '' : 's'} de revisão` },
      { icon: Clock, text: 'Agenda do dia', sub: `${todayAppts.length} consulta${todayAppts.length === 1 ? '' : 's'} programada${todayAppts.length === 1 ? '' : 's'}` },
    ],
    secretaria: [
      { icon: Clock, text: 'Lembretes do dia', sub: `${todayAppts.length} consulta${todayAppts.length === 1 ? '' : 's'} para confirmar ou acompanhar` },
      { icon: MessageSquare, text: 'Confirmações', sub: `${confirmedAppts.length} consulta${confirmedAppts.length === 1 ? '' : 's'} confirmada${confirmedAppts.length === 1 ? '' : 's'}` },
    ],
    gestao: [
      { icon: BarChart2, text: 'Indicadores gerais', sub: 'Acompanhe produção, agenda e equipe' },
      { icon: UserCog, text: 'Equipe ativa', sub: `${doctors.length} médico${doctors.length === 1 ? '' : 's'} cadastrado${doctors.length === 1 ? '' : 's'}` },
    ],
    paciente: [
      { icon: Clock, text: 'Próximas consultas', sub: `${upcomingAppts.length} consulta${upcomingAppts.length === 1 ? '' : 's'} programada${upcomingAppts.length === 1 ? '' : 's'}` },
      { icon: FileText, text: 'Exames e laudos', sub: `${laudosLiberados.length} laudo${laudosLiberados.length === 1 ? '' : 's'} disponível${laudosLiberados.length === 1 ? '' : 'is'}` },
    ],
  } satisfies Record<UserRole, { icon: React.ElementType; text: string; sub: string }[]>;

  const models: Record<UserRole, DashboardModel> = {
    medico: {
      title: 'Visão clínica do dia',
      agendaTitle: 'Pacientes do dia',
      kpis: [
        { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
        { label: 'Pacientes na Espera', value: waitAppts.length, icon: Clock, live: true },
        { label: 'Meus Pacientes', value: pacAtivos.length, icon: UserPlus },
        { label: 'Laudos Emitidos', value: laudosLiberados.length, icon: FileText },
      ],
      mainList: todayAppts.map(appointmentItem),
      secondaryTitle: 'Próximas consultas',
      secondaryList: upcomingAppts.slice(0, 5).map(appointmentItem),
      reminders: baseReminders.medico,
      showLaudos: true,
      showManagementFlow: false,
    },
    gestao: {
      title: 'Painel de gestão',
      agendaTitle: 'Operação do dia',
      kpis: [
        { label: 'Médicos', value: doctors.length, icon: Users },
        { label: 'Pacientes Hoje', value: new Set(todayAppts.map(a => a.pacienteId)).size, icon: UserPlus },
        { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
        { label: 'Taxa de Confirmação', value: taxaConfirmacao, icon: Activity },
      ],
      mainList: todayAppts.map(appointmentItem),
      secondaryTitle: 'Médicos responsáveis',
      secondaryList: doctors.slice(0, 6).map(d => ({
        id: d.id,
        title: d.full_name,
        subtitle: d.specialty || 'Especialidade não informada',
        meta: d.crm ? `CRM ${d.crm}/${d.crm_uf}` : d.email,
      })),
      reminders: baseReminders.gestao,
      showLaudos: true,
      showManagementFlow: true,
    },
    secretaria: {
      title: 'Organização da agenda',
      agendaTitle: 'Pacientes com consulta hoje',
      kpis: [
        { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
        { label: 'Fila de Espera', value: waitAppts.length, icon: Clock, live: true },
        { label: 'Pacientes Ativos', value: pacAtivos.length, icon: UserPlus },
        { label: 'Confirmação Hoje', value: taxaConfirmacao, icon: MessageSquare },
      ],
      mainList: todayAppts.map(appointmentItem),
      secondaryTitle: 'Médicos do dia',
      secondaryList: todayAppts.slice(0, 6).map(a => ({
        id: `doctor-${a.id}`,
        title: doctorName(a.medicoId),
        subtitle: `${patientName(a.pacienteId)} às ${a.hora}`,
        status: a.status,
      })),
      reminders: baseReminders.secretaria,
      showLaudos: false,
      showManagementFlow: false,
    },
    paciente: {
      title: 'Meu acompanhamento',
      agendaTitle: 'Minhas próximas consultas',
      kpis: [
        { label: 'Consultas Hoje', value: todayAppts.length, icon: Calendar },
        { label: 'Próximas Consultas', value: upcomingAppts.length, icon: Clock },
        { label: 'Laudos Disponíveis', value: laudosLiberados.length, icon: FileText },
        { label: 'Pendentes', value: laudos.filter(l => l.status === 'rascunho').length, icon: Activity },
      ],
      mainList: upcomingAppts.slice(0, 6).map(appointmentItem),
      secondaryTitle: 'Exames e laudos',
      secondaryList: laudos.slice(0, 6).map(l => ({
        id: l.id,
        title: l.exame || 'Laudo médico',
        subtitle: `${formatDate(l.data)} - ${l.status === 'liberado' ? 'Disponível' : 'Pendente'}`,
        status: l.status,
      })),
      reminders: baseReminders.paciente,
      showLaudos: true,
      showManagementFlow: false,
    },
  };

  return models[role] ?? models.secretaria;
}

export default function Dashboard({
  pacientes, agendamentos, laudos, doctors = [],
  onNavigate, onNovoAgendamento, onNovoPaciente,
}: DashboardProps) {
  const { user } = useAuth();
  const role = user?.role ?? 'secretaria';
  const allowedPages = ROLE_PAGES[role] ?? ROLE_PAGES.secretaria;
  const canNavigate = (page: PageType) => allowedPages.includes(page);
  const today = new Date();
  const todayStr = dateToISO(today);
  const model = buildDashboardModel({ role, pacientes, agendamentos, laudos, doctors, todayStr });
  const laudosLiberados = laudos.filter(l => l.status === 'liberado');
  const laudosRascunho = laudos.filter(l => l.status === 'rascunho');
  const todayAppts = agendamentos.filter(a => a.data === todayStr);
  const dateStr = `${DAYS[today.getDay()]}, ${today.getDate()} de ${MONTHS[today.getMonth()]} de ${today.getFullYear()}`;
  const hora = today.getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  const displayName = user?.full_name?.trim() || 'Usuário';

  const quickActions = [
    canNavigate('agenda') && role !== 'paciente' && { label: 'Novo Agendamento', icon: PlusCircle, onClick: onNovoAgendamento, primary: true },
    canNavigate('pacientes') && role !== 'paciente' && (
      role === 'medico'
        ? { label: 'Pacientes Cadastrados', icon: UserCheck, onClick: () => onNavigate('pacientes') }
        : { label: 'Novo Paciente', icon: UserCheck, onClick: onNovoPaciente }
    ),
    canNavigate('agenda') && { label: role === 'paciente' ? 'Ver minhas consultas' : 'Abrir Agenda', icon: Calendar, onClick: () => onNavigate('agenda') },
    canNavigate('laudos') && role !== 'secretaria' && { label: role === 'paciente' ? 'Ver exames' : 'Abrir Laudos', icon: FileText, onClick: () => onNavigate('laudos') },
    canNavigate('relatorios') && role === 'gestao' && { label: 'Ver Relatórios', icon: BarChart2, onClick: () => onNavigate('relatorios') },
  ].filter(Boolean) as { label: string; icon: React.ElementType; onClick: () => void; primary?: boolean }[];

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 28 }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--dark)', lineHeight: 1.25, wordBreak: 'break-word' }}>
            {saudacao}, {displayName}!
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 3 }}>{dateStr} - {model.title}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {model.kpis.map(item => <KPI key={item.label} {...item} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 12 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--gray-800)' }}>{model.agendaTitle}</h2>
              {canNavigate('agenda') && (
                <button onClick={() => onNavigate('agenda')}
                  style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                  Ver completa
                </button>
              )}
            </div>

            <ListRows items={model.mainList} emptyText={role === 'paciente' ? 'Nenhuma consulta próxima' : 'Nenhuma consulta hoje'} />
            {canNavigate('agenda') && model.mainList.length > 0 && (
              <button onClick={() => onNavigate('agenda')}
                style={{ marginTop: 14, width: '100%', padding: '10px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 10, fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                VER AGENDA COMPLETA <ArrowRight size={13} />
              </button>
            )}
          </Panel>

          <Panel style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 12 }}>{model.secondaryTitle}</h3>
            <ListRows items={model.secondaryList} emptyText="Nenhum registro encontrado" limit={5} />
          </Panel>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <Panel style={{ padding: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 14 }}>Ações Rápidas</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
              {quickActions.length ? quickActions.map(action => <ActionButton key={action.label} {...action} />) : <EmptyState text="Nenhuma ação disponível para este perfil" compact />}
            </div>
          </Panel>

          {model.showLaudos && (
            <Panel style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)', marginBottom: 14 }}>Laudos</h3>
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
            {model.reminders.map((r, i) => (
              <div key={r.text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < model.reminders.length - 1 ? '1px solid var(--gray-100)' : 'none' }}>
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

          {model.showManagementFlow && (
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
