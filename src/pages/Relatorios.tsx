import { useState } from 'react';
import { BarChart2, Calendar, Download, FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import type { ElementType } from 'react';
import type { Agendamento, Laudo, Paciente } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { dateToISO, formatDateBR } from '../shared/utils/date';
import { downloadHtmlAsPdf } from '../shared/utils/pdf';
import { toUserFacingErrorMessage } from '../shared/utils/errors';

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function inRange(iso: string, start: string, end: string) {
  return iso >= start && iso <= end;
}

function KPI({ label, value, sub, icon: Icon, color = 'var(--primary)' }: { label: string; value: number | string; sub?: string; icon: ElementType; color?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--gray-100)', boxShadow: 'none' }}>
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
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
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

  const buildReportHtml = () => {
    const titulo = isGestao ? 'Relatório Gerencial' : 'Relatório Médico';
    const periodoLabel = PERIODOS[periodo].label;
    const geradoEm = new Date().toLocaleString('pt-BR');
    const responsavel = user?.full_name || 'Equipe MediConnect';

    const kpis = [
      { label: 'Consultas no período', value: String(appts.length), sub: `${growth >= 0 ? '+' : ''}${growth}% vs. período anterior` },
      { label: 'Pacientes atendidos', value: String(novosPacientes), sub: '' },
      { label: 'Laudos no período', value: String(reports.length), sub: `${reports.filter(l => l.status === 'liberado').length} liberados` },
      { label: 'Comparecimento', value: `${comparecimento}%`, sub: '' },
    ];

    const kpiHtml = kpis.map(k => `
      <div class="kpi">
        <span class="kpi-label">${escapeHtml(k.label)}</span>
        <span class="kpi-value">${escapeHtml(k.value)}</span>
        ${k.sub ? `<span class="kpi-sub">${escapeHtml(k.sub)}</span>` : ''}
      </div>`).join('');

    const barRows = (rows: [string, number][], max: number) =>
      rows.length
        ? rows.map(([label, value]) => `
            <div class="bar-row">
              <span class="bar-label">${escapeHtml(label)}</span>
              <span class="bar-track"><span class="bar-fill" style="width:${max > 0 ? (value / max) * 100 : 0}%"></span></span>
              <span class="bar-value">${value}</span>
            </div>`).join('')
        : '<div class="empty">Sem dados para este período.</div>';

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(titulo)} - ${escapeHtml(periodoLabel)}</title>
          <style>
            @page { size: A4; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; background: #eef2f7; font-family: Arial, Helvetica, sans-serif; color: #101828; }
            .page { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; padding: 16mm; position: relative; }
            .topline { position: absolute; left: 0; right: 0; top: 0; height: 5mm; background: linear-gradient(135deg, #00A63F 0%, #009E57 100%); }
            header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #009E57; padding: 8mm 0 5mm; margin-bottom: 8mm; }
            header h1 { margin: 0; font-size: 22px; color: #101828; }
            header .meta { font-size: 11px; color: #475467; text-align: right; line-height: 1.6; }
            header .brand { font-size: 13px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #009E57; margin-bottom: 4px; }
            .kpis { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 10mm; }
            .kpi { border: 1px solid #e4e7ec; border-radius: 10px; padding: 12px 14px; display: flex; flex-direction: column; }
            .kpi-label { font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; color: #667085; }
            .kpi-value { font-size: 26px; font-weight: 800; color: #101828; margin-top: 4px; }
            .kpi-sub { font-size: 10px; color: #98a2b3; margin-top: 2px; }
            section.block { margin-bottom: 8mm; }
            section.block h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #009E57; border-bottom: 1px solid #e4e7ec; padding-bottom: 5px; margin: 0 0 10px; }
            .bar-row { display: grid; grid-template-columns: 45mm 1fr 14mm; align-items: center; gap: 8px; margin-bottom: 7px; font-size: 11px; }
            .bar-label { color: #344054; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
            .bar-track { height: 9px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
            .bar-fill { display: block; height: 100%; background: #009E57; border-radius: 999px; }
            .bar-value { font-weight: 800; color: #101828; text-align: right; }
            .info { display: flex; justify-content: space-between; border-bottom: 1px solid #f2f4f7; padding: 6px 0; font-size: 12px; }
            .info span { color: #667085; }
            .info strong { color: #101828; }
            .empty { font-size: 12px; color: #98a2b3; padding: 8px 0; }
            footer { margin-top: 10mm; border-top: 1px solid #e4e7ec; padding-top: 5mm; font-size: 9px; color: #98a2b3; text-align: center; }
          </style>
        </head>
        <body>
          <section class="page">
            <div class="topline"></div>
            <header>
              <div>
                <div class="brand">MediConnect</div>
                <h1>${escapeHtml(titulo)}</h1>
              </div>
              <div class="meta">
                Período: <strong>${escapeHtml(periodoLabel)}</strong><br>
                ${escapeHtml(formatDateBR(start))} a ${escapeHtml(formatDateBR(end))}<br>
                Responsável: ${escapeHtml(responsavel)}<br>
                Gerado em: ${escapeHtml(geradoEm)}
              </div>
            </header>

            <div class="kpis">${kpiHtml}</div>

            <section class="block">
              <h2>Consultas por paciente</h2>
              ${barRows(byPatient as [string, number][], maxPatient)}
            </section>

            <section class="block">
              <h2>Horários com maior volume</h2>
              ${barRows(byHour as [string, number][], maxHour)}
            </section>

            <section class="block">
              <h2>Evolução recente</h2>
              <div class="info"><span>Período atual</span><strong>${appts.length} consulta${appts.length === 1 ? '' : 's'}</strong></div>
              <div class="info"><span>Período anterior</span><strong>${prevAppts.length} consulta${prevAppts.length === 1 ? '' : 's'}</strong></div>
              <div class="info"><span>Tendência</span><strong>${growth >= 0 ? 'Crescimento' : 'Queda'} de ${Math.abs(growth)}%</strong></div>
              <div class="info"><span>Cancelamentos</span><strong>${appts.filter(a => a.status === 'cancelado').length}</strong></div>
            </section>

            <footer>Documento gerado automaticamente pelo MediConnect · Uso interno e demonstrativo.</footer>
          </section>
        </body>
      </html>`;
  };

  const handleDownloadPdf = async () => {
    if (generatingPdf) return;
    setGeneratingPdf(true);
    setPdfError('');
    try {
      const titulo = isGestao ? 'Relatório Gerencial' : 'Relatório Médico';
      await downloadHtmlAsPdf(buildReportHtml(), `${titulo} - ${PERIODOS[periodo].label} - ${end}.pdf`);
    } catch (err) {
      setPdfError(toUserFacingErrorMessage(err, 'Não foi possível gerar o PDF do relatório. Tente novamente.'));
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>
            {isGestao ? 'Relatórios Gerenciais' : 'Relatórios Médicos'}
          </h1>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
            Período de {formatDateBR(start)} até {formatDateBR(end)}, usando dados carregados do sistema.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)}
            style={{ minWidth: 190, padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 700, color: 'var(--gray-700)' }}>
            {Object.entries(PERIODOS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
          <button type="button" onClick={() => { void handleDownloadPdf(); }} disabled={generatingPdf}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', border: 'none', borderRadius: 10, background: generatingPdf ? 'var(--gray-300)' : 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: generatingPdf ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(58,170,53,0.3)' }}>
            <Download size={15} /> {generatingPdf ? 'Gerando PDF...' : 'Baixar PDF'}
          </button>
        </div>
      </div>
      {pdfError && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 12px', border: '1px solid var(--red-100)', borderRadius: 10, background: 'var(--red-50)', color: 'var(--red-600)', fontSize: 12, fontWeight: 700 }}>
          {pdfError}
        </div>
      )}

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
    <div style={{ background: '#fff', borderRadius: 12, padding: 22, border: '1px solid var(--gray-100)', boxShadow: 'none' }}>
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
