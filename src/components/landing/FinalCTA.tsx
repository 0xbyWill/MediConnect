import { ArrowRight } from 'lucide-react';

interface FinalCTAProps {
  onEnter: () => void;
}

export default function FinalCTA({ onEnter }: FinalCTAProps) {
  return (
    <section className="mcl-section mcl-final" id="comecar">
      <div className="mcl-container">
        <div className="mcl-final-card">
          <div className="mcl-final-glow" aria-hidden="true" />
          <h2 className="mcl-final-title">
            Sua clínica já trabalha duro.
            <br />
            <span className="mcl-grad-text">Agora trabalhe com mais inteligência.</span>
          </h2>
          <p className="mcl-final-text">
            Centralize operações, reduza retrabalho e utilize inteligência artificial
            para apoiar decisões.
          </p>
          <button type="button" className="mcl-btn mcl-btn-primary mcl-btn-lg" onClick={onEnter}>
            Entrar no MediConnect
            <ArrowRight size={19} aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
