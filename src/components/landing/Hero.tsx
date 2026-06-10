import {
  ArrowRight,
  Sparkles,
  CalendarCheck,
  Users,
  TrendingUp,
  BellRing,
  Activity,
} from 'lucide-react';

interface HeroProps {
  onEnter: () => void;
  onExplore: () => void;
}

export default function Hero({ onEnter, onExplore }: HeroProps) {
  return (
    <section className="mcl-hero" id="inicio">
      <div className="mcl-hero-glow" aria-hidden="true" />

      <div className="mcl-container mcl-hero-inner">
        <div className="mcl-hero-copy">
          <span className="mcl-badge">
            <Sparkles size={15} aria-hidden="true" />
            Gestão clínica inteligente
          </span>

          <h1 className="mcl-hero-title">
            Sua clínica já gera dados.
            <span className="mcl-grad-text"> Agora transforme esses dados em decisões.</span>
          </h1>

          <p className="mcl-hero-sub">
            O MediConnect conecta gestão, equipe, pacientes e inteligência artificial
            para reduzir retrabalho e aumentar a eficiência operacional.
          </p>

          <div className="mcl-hero-actions">
            <button type="button" className="mcl-btn mcl-btn-primary mcl-btn-lg" onClick={onEnter}>
              Entrar no Sistema
              <ArrowRight size={19} aria-hidden="true" />
            </button>
            <button type="button" className="mcl-btn mcl-btn-ghost mcl-btn-lg" onClick={onExplore}>
              Conhecer Recursos
            </button>
          </div>

          <ul className="mcl-hero-points" aria-label="Resumo da plataforma">
            <li>Pacientes e agenda centralizados</li>
            <li>Comunicação por WhatsApp e SMS</li>
            <li>IA gerencial para apoiar decisões</li>
          </ul>
        </div>

        <div className="mcl-hero-visual" aria-hidden="true">
          <div className="mcl-mock mcl-mock-dash">
            <div className="mcl-mock-bar">
              <span className="mcl-dot" />
              <span className="mcl-dot" />
              <span className="mcl-dot" />
              <span className="mcl-mock-bar-title">MediConnect · Painel</span>
            </div>

            <div className="mcl-mock-body">
              <div className="mcl-kpi-row">
                <div className="mcl-kpi">
                  <span className="mcl-kpi-ic mcl-kpi-ic-green"><CalendarCheck size={16} /></span>
                  <span className="mcl-kpi-val">128</span>
                  <span className="mcl-kpi-lbl">Consultas no mês</span>
                </div>
                <div className="mcl-kpi">
                  <span className="mcl-kpi-ic mcl-kpi-ic-blue"><Users size={16} /></span>
                  <span className="mcl-kpi-val">2.340</span>
                  <span className="mcl-kpi-lbl">Pacientes ativos</span>
                </div>
                <div className="mcl-kpi">
                  <span className="mcl-kpi-ic mcl-kpi-ic-amber"><TrendingUp size={16} /></span>
                  <span className="mcl-kpi-val">94%</span>
                  <span className="mcl-kpi-lbl">Taxa de presença</span>
                </div>
              </div>

              <div className="mcl-chart-card">
                <div className="mcl-chart-head">
                  <span>Atendimentos por semana</span>
                  <span className="mcl-chip mcl-chip-up"><Activity size={12} /> +18%</span>
                </div>
                <div className="mcl-bars">
                  {[42, 58, 50, 70, 64, 82, 76].map((h, i) => (
                    <span key={i} className="mcl-bar" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mcl-float mcl-float-ai">
            <span className="mcl-float-ic"><Sparkles size={16} /></span>
            <div>
              <strong>Assistente IA</strong>
              <p>Quedas de comparecimento concentradas às sextas.</p>
            </div>
          </div>

          <div className="mcl-float mcl-float-notify">
            <span className="mcl-float-ic mcl-float-ic-green"><BellRing size={16} /></span>
            <div>
              <strong>Lembrete enviado</strong>
              <p>WhatsApp · consulta confirmada</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
