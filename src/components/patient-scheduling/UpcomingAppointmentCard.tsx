interface UpcomingAppointmentCardProps {
  specialty: string;
  dateLabel: string;
  doctorName: string;
  onViewDetails: () => void;
}

export function UpcomingAppointmentCard({
  specialty,
  dateLabel,
  doctorName,
  onViewDetails,
}: UpcomingAppointmentCardProps) {
  return (
    <section
      style={{
        border: '1px solid var(--gray-100)',
        background: '#fff',
        borderRadius: 14,
        padding: 14,
        display: 'grid',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
        Sua próxima consulta
      </span>
      <strong style={{ fontSize: 18, color: '#0f172a' }}>{specialty}</strong>
      <span style={{ fontSize: 14, color: '#334155' }}>{dateLabel}</span>
      <span style={{ fontSize: 14, color: '#334155' }}>{doctorName}</span>
      <div>
        <button
          type="button"
          onClick={onViewDetails}
          style={{
            border: '1px solid var(--primary)',
            background: '#fff',
            color: 'var(--primary)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Ver detalhes
        </button>
      </div>
    </section>
  );
}
