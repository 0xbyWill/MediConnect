import { ShieldCheck, ClipboardList, Stethoscope, UserRound } from 'lucide-react';

const ROLES = [
  {
    icon: ShieldCheck,
    name: 'Gestão',
    text: 'Controle indicadores, usuários, agenda e desempenho da clínica.',
  },
  {
    icon: ClipboardList,
    name: 'Secretaria',
    text: 'Organize pacientes e consultas com agilidade no dia a dia.',
  },
  {
    icon: Stethoscope,
    name: 'Médico',
    text: 'Acompanhe atendimentos e o histórico de cada paciente.',
  },
  {
    icon: UserRound,
    name: 'Paciente',
    text: 'Consulte seu histórico e os laudos liberados com facilidade.',
  },
];

export default function RolesSection() {
  return (
    <section className="mcl-section mcl-roles" id="perfis">
      <div className="mcl-container">
        <div className="mcl-section-head">
          <span className="mcl-eyebrow">Perfis</span>
          <h2 className="mcl-section-title">Uma experiência para cada usuário.</h2>
          <p className="mcl-section-lead">
            Cada pessoa vê exatamente o que precisa para trabalhar melhor — nada além disso.
          </p>
        </div>

        <div className="mcl-grid-4">
          {ROLES.map(({ icon: Icon, name, text }) => (
            <article key={name} className="mcl-card mcl-card-role">
              <span className="mcl-card-ic mcl-card-ic-grad">
                <Icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mcl-card-title">{name}</h3>
              <p className="mcl-card-text">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
