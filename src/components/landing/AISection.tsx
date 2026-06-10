import { Sparkles, BarChart3, TrendingUp, FileText, Lightbulb } from 'lucide-react';

const QUESTIONS = [
  'Quais especialidades tiveram mais cancelamentos?',
  'Como foi o desempenho deste mês?',
  'Quais pacientes possuem maior recorrência de faltas?',
  'Quais horários apresentam mais ociosidade?',
];

const CAPABILITIES = [
  { icon: BarChart3, label: 'Análises administrativas' },
  { icon: TrendingUp, label: 'Tendências e padrões' },
  { icon: FileText, label: 'Relatórios e indicadores' },
  { icon: Lightbulb, label: 'Recomendações práticas' },
];

export default function AISection() {
  return (
    <section className="mcl-section mcl-ai" id="assistente-ia">
      <div className="mcl-ai-glow" aria-hidden="true" />
      <div className="mcl-container mcl-ai-inner">
        <div className="mcl-ai-copy">
          <span className="mcl-eyebrow mcl-eyebrow-light">Assistente IA Gerencial</span>
          <h2 className="mcl-section-title mcl-title-light">
            Sua clínica já possui respostas.
            <br />
            <span className="mcl-grad-text">A IA ajuda você a encontrá-las.</span>
          </h2>
          <p className="mcl-section-lead mcl-lead-light">
            O Assistente IA Gerencial do MediConnect transforma dados administrativos
            em insights claros para apoiar suas decisões — sem planilhas, sem ruído.
          </p>

          <div className="mcl-ai-caps">
            {CAPABILITIES.map(({ icon: Icon, label }) => (
              <span key={label} className="mcl-ai-cap">
                <Icon size={16} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>

          <div className="mcl-ai-questions">
            <span className="mcl-ai-questions-label">Pergunte em linguagem natural</span>
            <ul>
              {QUESTIONS.map(q => (
                <li key={q}>“{q}”</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mcl-ai-visual" aria-hidden="true">
          <div className="mcl-mock mcl-mock-ai">
            <div className="mcl-mock-bar mcl-mock-bar-ai">
              <span className="mcl-ai-avatar"><Sparkles size={15} /></span>
              <span className="mcl-mock-bar-title">Assistente IA Gerencial</span>
            </div>

            <div className="mcl-ai-chat">
              <div className="mcl-bubble mcl-bubble-user">
                Como foi o desempenho deste mês?
              </div>

              <div className="mcl-bubble mcl-bubble-ai">
                <p>Em junho a clínica realizou <strong>128 consultas</strong>, alta de 18% sobre maio.</p>
                <div className="mcl-bubble-stats">
                  <div>
                    <span className="mcl-stat-val">94%</span>
                    <span className="mcl-stat-lbl">presença</span>
                  </div>
                  <div>
                    <span className="mcl-stat-val">-12%</span>
                    <span className="mcl-stat-lbl">cancelamentos</span>
                  </div>
                  <div>
                    <span className="mcl-stat-val">7</span>
                    <span className="mcl-stat-lbl">especialidades</span>
                  </div>
                </div>
                <div className="mcl-mini-bars">
                  {[40, 62, 55, 78, 70, 88].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
                <p className="mcl-bubble-insight">
                  <Lightbulb size={14} /> Sextas à tarde concentram a maior ociosidade — considere realocar encaixes.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
