import { CalendarCheck, ClipboardList, FileText, Stethoscope } from 'lucide-react';
import type { ElementType } from 'react';
import type { ApiDoctor } from '../lib/api';
import type { Agendamento, Laudo, Paciente } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { formatDateBR } from '../shared/utils/date';

interface RegistroProps {
  pacientes: Paciente[];
  agendamentos: Agendamento[];
  laudos: Laudo[];
  doctors?: ApiDoctor[];
}

type RegistroItem = {
  id: string;
  data: string;
  hora?: string;
  medico: string;
  especialidade: string;
  tipo: string;
  resumo?: string;
  status: string;
  source: 'consulta' | 'laudo';
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  confirmado: { bg: 'var(--mint)', color: 'var(--dark)', label: 'Confirmada' },
  pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)', label: 'Pendente' },
  cancelado: { bg: 'var(--red-100)', color: 'var(--red-600)', label: 'Cancelada' },
  realizado: { bg: '#ede9fe', color: '#5b21b6', label: 'Atendido' },
  liberado: { bg: 'var(--mint)', color: 'var(--dark)', label: 'Liberado' },
  rascunho: { bg: 'var(--gray-100)', color: 'var(--gray-500)', label: 'Rascunho' },
};

function byDateDesc(a: RegistroItem, b: RegistroItem) {
  return `${b.data} ${b.hora ?? '99:99'}`.localeCompare(`${a.data} ${a.hora ?? '99:99'}`);
}

export default function Registro({ pacientes, agendamentos, laudos, doctors = [] }: RegistroProps) {
  const { user } = useAuth();
  const patientIds = user?.role === 'paciente'
    ? Array.from(new Set([
        ...pacientes.map(p => p.id),
        user.patient_id,
        user.id,
      ].filter(Boolean)))
    : [];
  const paciente = pacientes.find(p => p.email.toLowerCase() === user?.email.toLowerCase()) ?? pacientes[0];

  const doctorInfo = (doctorId?: string) => {
    const doctor = doctors.find(d => d.id === doctorId);
    return {
      name: doctor?.full_name ?? 'Médico não informado',
      specialty: doctor?.specialty ?? 'Especialidade não informada',
    };
  };

  const registros: RegistroItem[] = patientIds.length > 0
    ? [
        ...agendamentos
          .filter(agendamento => patientIds.includes(agendamento.pacienteId))
          .map(agendamento => {
            const doctor = doctorInfo(agendamento.medicoId);
            return {
              id: `consulta-${agendamento.id}`,
              data: agendamento.data,
              hora: agendamento.hora,
              medico: doctor.name,
              especialidade: doctor.specialty,
              tipo: agendamento.tipo,
              resumo: agendamento.observacoes,
              status: agendamento.status,
              source: 'consulta' as const,
            };
          }),
        ...laudos
          .filter(laudo => patientIds.includes(laudo.pacienteId) && laudo.status === 'liberado')
          .map(laudo => {
            const doctor = doctorInfo(laudo.medicoId);
            return {
              id: `laudo-${laudo.id}`,
              data: laudo.data || laudo.createdAt?.slice(0, 10) || '',
              medico: doctor.name,
              especialidade: doctor.specialty,
              tipo: laudo.exame || 'Laudo médico',
              resumo: laudo.impressao || laudo.diagnostico,
              status: laudo.status,
              source: 'laudo' as const,
            };
          }),
      ].sort(byDateDesc)
    : [];

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)', minHeight: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--dark)' }}>Registro</h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 4 }}>
            Histórico de atendimentos, consultas e laudos liberados do paciente.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 12, background: '#fff' }}>
          <ClipboardList size={18} color="var(--primary)" />
          <div>
            <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 700 }}>Paciente</div>
            <div style={{ fontSize: 13, color: 'var(--gray-800)', fontWeight: 800 }}>{paciente?.nome ?? user?.full_name ?? 'Paciente'}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 22 }}>
        <Metric label="Registros" value={registros.length} icon={ClipboardList} />
        <Metric label="Atendimentos" value={registros.filter(item => item.source === 'consulta').length} icon={CalendarCheck} />
        <Metric label="Laudos liberados" value={registros.filter(item => item.source === 'laudo').length} icon={FileText} />
      </div>

      {patientIds.length === 0 ? (
        <EmptyState title="Registro indisponível" text="Não foi possível vincular sua conta a um paciente. Verifique seu cadastro com a unidade de saúde." />
      ) : registros.length === 0 ? (
        <EmptyState title="Nenhum registro encontrado" text="Quando houver atendimentos anteriores ou laudos liberados, eles aparecerao aqui." />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {registros.map(item => {
            const status = STATUS_STYLE[item.status] ?? { bg: 'var(--gray-100)', color: 'var(--gray-500)', label: item.status };
            return (
              <article key={item.id} style={{ background: '#fff', border: '1px solid rgba(15,118,75,0.10)', borderRadius: 12, padding: 18, display: 'grid', gridTemplateColumns: 'minmax(130px, 170px) 1fr', gap: 18 }}>
                <div style={{ borderRight: '1px solid var(--gray-100)', paddingRight: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--dark)' }}>{item.data ? formatDateBR(item.data) : 'Sem data'}</div>
                  {item.hora && <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 5 }}>{item.hora}</div>}
                  <span style={{ display: 'inline-flex', marginTop: 12, fontSize: 11, fontWeight: 800, padding: '4px 9px', borderRadius: 999, background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span style={{ width: 30, height: 30, borderRadius: 9, background: 'var(--mint)', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      {item.source === 'consulta' ? <Stethoscope size={16} /> : <FileText size={16} />}
                    </span>
                    <h2 style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)' }}>{item.tipo}</h2>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: item.resumo ? 12 : 0 }}>
                    <Info label="Médico responsável" value={item.medico} />
                    <Info label="Especialidade" value={item.especialidade} />
                  </div>
                  {item.resumo && (
                    <p style={{ margin: 0, color: 'var(--gray-600)', fontSize: 13, lineHeight: 1.6 }}>
                      {item.resumo}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: number; icon: ElementType }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,118,75,0.10)', borderRadius: 12, padding: 18, minHeight: 112 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
        <Icon size={19} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--dark)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 700, color: 'var(--gray-600)' }}>{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gray-500)', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ marginTop: 3, fontSize: 13, fontWeight: 700, color: 'var(--gray-800)' }}>{value}</div>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,118,75,0.10)', borderRadius: 12, padding: '42px 24px', textAlign: 'center' }}>
      <ClipboardList size={34} color="var(--gray-400)" />
      <h2 style={{ marginTop: 12, fontSize: 16, fontWeight: 800, color: 'var(--gray-800)' }}>{title}</h2>
      <p style={{ margin: '6px auto 0', maxWidth: 520, fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.6 }}>{text}</p>
    </div>
  );
}
