interface FooterProps {
  onEnter: () => void;
  onNavigate: (id: string) => void;
}

export default function Footer({ onEnter, onNavigate }: FooterProps) {
  return (
    <footer className="mcl-footer">
      <div className="mcl-container mcl-footer-inner">
        <div className="mcl-footer-brand">
          <div className="mcl-footer-logo">
            <img src="/mediconnect-mark.png" alt="" aria-hidden="true" />
            <span>MediConnect</span>
          </div>
          <p>Gestão inteligente para clínicas e consultórios.</p>
        </div>

        <nav className="mcl-footer-nav" aria-label="Links do rodapé">
          <button type="button" onClick={onEnter}>Entrar</button>
          <button type="button" onClick={() => onNavigate('problema')}>Recursos</button>
          <button type="button" onClick={() => onNavigate('assistente-ia')}>Assistente IA</button>
          <button type="button" onClick={() => onNavigate('comunicacao')}>Comunicação</button>
        </nav>
      </div>

      <div className="mcl-footer-bottom">
        <div className="mcl-container">
          <span>&copy; 2026 MediConnect. Todos os direitos reservados.</span>
        </div>
      </div>
    </footer>
  );
}
