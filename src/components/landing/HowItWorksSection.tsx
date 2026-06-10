const STEPS = [
  { n: '01', title: 'Cadastre pacientes e equipe', text: 'Centralize todos os cadastros em uma base única e confiável.' },
  { n: '02', title: 'Organize consultas e agenda', text: 'Visualize horários, evite conflitos e reduza a ociosidade.' },
  { n: '03', title: 'Comunique-se via WhatsApp e SMS', text: 'Confirmações e lembretes automáticos para reduzir faltas.' },
  { n: '04', title: 'Utilize IA para identificar oportunidades', text: 'Descubra padrões, tendências e gargalos da operação.' },
  { n: '05', title: 'Tome decisões com confiança', text: 'Aja com base em dados reais, não em achismos.' },
];

export default function HowItWorksSection() {
  return (
    <section className="mcl-section mcl-how" id="como-funciona">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">Como funciona</span>
          <h2 className="mcl-section-title">Do caos à clareza em cinco passos.</h2>
        </div>

        <ol className="mcl-steps">
          {STEPS.map(({ n, title, text }) => (
            <li key={n} className="mcl-step">
              <span className="mcl-step-num">{n}</span>
              <div className="mcl-step-copy">
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
