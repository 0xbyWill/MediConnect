import { Brain, MessagesSquare, ListOrdered, Gauge } from 'lucide-react';

const VISION = [
  {
    icon: Brain,
    title: 'IA Gerencial',
    text: 'Insights administrativos que evoluem junto com os dados da sua clínica.',
  },
  {
    icon: MessagesSquare,
    title: 'Comunicação Inteligente',
    text: 'Mensagens no momento certo para informar pacientes e reduzir faltas.',
  },
  {
    icon: ListOrdered,
    title: 'Fila Inteligente de Antecipação',
    text: 'Horários cancelados são oferecidos automaticamente a quem está na fila.',
  },
  {
    icon: Gauge,
    title: 'Insights Operacionais',
    text: 'Indicadores claros sobre desempenho, ociosidade e oportunidades.',
  },
];

export default function FutureSection() {
  return (
    <section className="mcl-section mcl-future" id="futuro">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">Visão de futuro</span>
          <h2 className="mcl-section-title">O futuro da gestão clínica é inteligente.</h2>
          <p className="mcl-section-lead">
            Conceitos que já fazem parte da plataforma e seguem evoluindo de forma
            natural — sempre a serviço da operação da sua clínica.
          </p>
        </div>

        <div className="mcl-grid-4">
          {VISION.map(({ icon: Icon, title, text }) => (
            <article key={title} className="mcl-card mcl-card-future">
              <span className="mcl-card-ic mcl-card-ic-glow">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mcl-card-title">{title}</h3>
              <p className="mcl-card-text">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
