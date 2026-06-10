import { CalendarClock, Server, MessageCircle, UserRound, ArrowDown } from 'lucide-react';

const FLOW = [
  { icon: CalendarClock, label: 'Consulta agendada', sub: 'Evento criado no sistema' },
  { icon: Server, label: 'MediConnect', sub: 'Dispara a mensagem certa' },
  { icon: MessageCircle, label: 'WhatsApp / SMS', sub: 'Entrega automática' },
  { icon: UserRound, label: 'Paciente', sub: 'Informado em tempo real' },
];

const EXAMPLES = [
  { tag: 'Confirmação', text: 'Olá, Maria! Sua consulta foi confirmada para quinta, 14h. Até lá!' },
  { tag: 'Lembrete', text: 'Lembrete: sua consulta é amanhã às 09h com Dr. Pereira.' },
  { tag: 'Reagendamento', text: 'Precisou remarcar? Responda esta mensagem e escolha um novo horário.' },
  { tag: 'Antecipação', text: 'Abriu um horário hoje às 16h. Quer antecipar sua consulta?' },
];

export default function CommunicationSection() {
  return (
    <section className="mcl-section mcl-comm" id="comunicacao">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">Comunicação</span>
          <h2 className="mcl-section-title">
            Pacientes informados.
            <br />
            <span className="mcl-grad-text">Equipe mais produtiva.</span>
          </h2>
          <p className="mcl-section-lead">
            Envie mensagens por WhatsApp e SMS sem sair da plataforma. Menos ligações,
            menos faltas e uma equipe livre para o que importa.
          </p>
        </div>

        <div className="mcl-comm-grid">
          <div className="mcl-flow" aria-label="Fluxo de comunicação">
            {FLOW.map(({ icon: Icon, label, sub }, i) => (
              <div key={label} className="mcl-flow-item">
                <div className="mcl-flow-node">
                  <span className="mcl-flow-ic"><Icon size={20} aria-hidden="true" /></span>
                  <div>
                    <strong>{label}</strong>
                    <span>{sub}</span>
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <span className="mcl-flow-arrow" aria-hidden="true"><ArrowDown size={18} /></span>
                )}
              </div>
            ))}
          </div>

          <div className="mcl-comm-examples">
            {EXAMPLES.map(({ tag, text }) => (
              <div key={tag} className="mcl-msg">
                <span className="mcl-msg-tag">{tag}</span>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
