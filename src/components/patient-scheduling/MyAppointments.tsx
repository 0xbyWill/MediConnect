interface MyAppointmentItem {
  id: string;
  specialty: string;
  doctorName: string;
  dateLabel: string;
  statusLabel: string;
}

interface MyAppointmentsProps {
  appointments: MyAppointmentItem[];
  onConfirm?: (id: string) => void;
  confirmingId?: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  Pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)' },
  Confirmada: { bg: 'var(--mint)', color: 'var(--dark)' },
  Realizada: { bg: '#ede9fe', color: '#5b21b6' },
  Cancelada: { bg: 'var(--red-100)', color: 'var(--red-600)' },
};

export function MyAppointments({ appointments, onConfirm, confirmingId }: MyAppointmentsProps) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#071327' }}>Próximas consultas</h3>
      {appointments.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Você ainda não possui consultas futuras.</div>
      ) : (
        <div style={{ display: 'grid', gap: 8 }}>
          {appointments.map(appointment => {
            const statusStyle = STATUS_STYLE[appointment.statusLabel] ?? STATUS_STYLE.Pendente;
            const canConfirm = appointment.statusLabel === 'Pendente' && Boolean(onConfirm);
            const isConfirming = confirmingId === appointment.id;
            return (
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
                <div style={{ flexShrink: 0, display: 'grid', gap: 8, justifyItems: 'end' }}>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {appointment.statusLabel}
                  </span>
                  {canConfirm && (
                    <button
                      type="button"
                      onClick={() => onConfirm?.(appointment.id)}
                      disabled={isConfirming}
                      style={{
                        border: '1px solid var(--primary)',
                        background: isConfirming ? 'var(--gray-50)' : 'var(--primary)',
                        color: isConfirming ? 'var(--gray-400)' : '#fff',
                        borderRadius: 9,
                        padding: '6px 12px',
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: isConfirming ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {isConfirming ? 'Confirmando...' : 'Confirmar'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
