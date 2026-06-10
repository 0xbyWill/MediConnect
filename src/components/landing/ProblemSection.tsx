import {
  CalendarX,
  UserX,
  MessageSquareOff,
  LineChart,
  ListTodo,
  FolderTree,
} from 'lucide-react';

const PROBLEMS = [
  {
    icon: CalendarX,
    title: 'Consultas esquecidas',
    text: 'Encaixes perdidos e horários ociosos que poderiam ter sido preenchidos.',
  },
  {
    icon: UserX,
    title: 'Faltas de pacientes',
    text: 'Ausências sem aviso que desorganizam a agenda e reduzem o faturamento.',
  },
  {
    icon: MessageSquareOff,
    title: 'Comunicação falha',
    text: 'Mensagens manuais, confirmações perdidas e pacientes mal informados.',
  },
  {
    icon: LineChart,
    title: 'Decisões sem indicadores',
    text: 'Escolhas baseadas em percepção, não em dados reais da operação.',
  },
  {
    icon: ListTodo,
    title: 'Excesso de tarefas operacionais',
    text: 'A equipe gasta o dia administrando processos em vez de cuidar de pessoas.',
  },
  {
    icon: FolderTree,
    title: 'Informações espalhadas',
    text: 'Dados em planilhas, papéis e cabeças diferentes, sem uma fonte única.',
  },
];

export default function ProblemSection() {
  return (
    <section className="mcl-section mcl-problem" id="problema">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">O custo do caos</span>
          <h2 className="mcl-section-title">
            O problema não é falta de esforço.
            <br />
            <span className="mcl-muted-title">É falta de visibilidade.</span>
          </h2>
          <p className="mcl-section-lead">
            Clínicas trabalham duro todos os dias. O que falta é enxergar a operação
            com clareza para agir antes que o problema aconteça.
          </p>
        </div>

        <div className="mcl-grid-3">
          {PROBLEMS.map(({ icon: Icon, title, text }) => (
            <article key={title} className="mcl-card mcl-card-problem">
              <span className="mcl-card-ic mcl-card-ic-soft">
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
