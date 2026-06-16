interface MyAppointmentItem {
  id: string;
  specialty: string;
  doctorName: string;
  dateLabel: string;
}

interface MyAppointmentsProps {
  appointments: MyAppointmentItem[];
}

export function MyAppointments({ appointments }: MyAppointmentsProps) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#071327' }}>Próximas consultas</h3>
      {appointments.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Você ainda não possui consultas futuras.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {appointments.map(appointment => (
            <article
              key={appointment.id}
              style={{
                border: '1px solid var(--gray-100)',
                background: '#fff',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <strong style={{ fontSize: 14, color: '#0f172a' }}>{appointment.specialty}</strong>
                <span style={{ fontSize: 13, color: '#334155' }}>{appointment.doctorName}</span>
                <span style={{ fontSize: 13, color: '#334155' }}>{appointment.dateLabel}</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
