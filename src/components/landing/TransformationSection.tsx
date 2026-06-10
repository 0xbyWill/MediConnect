import { ArrowRight, Check, X } from 'lucide-react';

const BEFORE = [
  'Planilhas dispersas',
  'Anotações em papel',
  'Processos manuais',
  'Informações isoladas',
];

const AFTER = [
  'Pacientes centralizados',
  'Agenda organizada',
  'Comunicação integrada',
  'Indicadores em tempo real',
  'Inteligência artificial apoiando decisões',
];

export default function TransformationSection() {
  return (
    <section className="mcl-section mcl-transform" id="transformacao">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">A transformação</span>
          <h2 className="mcl-section-title">O que muda quando tudo está conectado.</h2>
          <p className="mcl-section-lead">
            A mesma clínica, a mesma equipe. A diferença está em ter tudo em um único
            lugar, com inteligência apoiando cada decisão.
          </p>
        </div>

        <div className="mcl-compare">
          <article className="mcl-compare-card mcl-compare-before">
            <header className="mcl-compare-head">
              <span className="mcl-compare-tag mcl-compare-tag-before">Antes</span>
              <h3>Operação fragmentada</h3>
            </header>
            <ul className="mcl-compare-list">
              {BEFORE.map(item => (
                <li key={item}>
                  <span className="mcl-compare-mark mcl-compare-mark-x"><X size={14} /></span>
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <span className="mcl-compare-arrow" aria-hidden="true">
            <ArrowRight size={22} />
          </span>

          <article className="mcl-compare-card mcl-compare-after">
            <header className="mcl-compare-head">
              <span className="mcl-compare-tag mcl-compare-tag-after">Depois</span>
              <h3>Operação conectada</h3>
            </header>
            <ul className="mcl-compare-list">
              {AFTER.map(item => (
                <li key={item}>
                  <span className="mcl-compare-mark mcl-compare-mark-check"><Check size={14} /></span>
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </div>
    </section>
  );
}
