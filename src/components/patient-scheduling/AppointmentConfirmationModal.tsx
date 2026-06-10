interface AppointmentConfirmationModalProps {
  open: boolean;
  specialty: string;
  doctorName: string;
  dateLabel: string;
  time: string;
  patientName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AppointmentConfirmationModal({
  open,
  specialty,
  doctorName,
  dateLabel,
  time,
  patientName,
  loading = false,
  onConfirm,
  onCancel,
}: AppointmentConfirmationModalProps) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 1200,
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Confirmar consulta"
    >
      <div
        style={{
          width: 'min(460px, 100%)',
          background: '#fff',
          borderRadius: 14,
          border: '1px solid var(--gray-100)',
          padding: 18,
          display: 'grid',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 20, color: '#071327' }}>Confirmar consulta</h3>
        <div style={{ display: 'grid', gap: 8, fontSize: 14, color: '#334155' }}>
          <div>
            Especialidade: <strong>{specialty}</strong>
          </div>
          <div>
            Profissional: <strong>{doctorName}</strong>
          </div>
          <div>
            Data: <strong>{dateLabel}</strong>
          </div>
          <div>
            Horário: <strong>{time}</strong>
          </div>
          <div>
            Paciente: <strong>{patientName}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{
              border: '1px solid var(--gray-200)',
              background: '#fff',
              borderRadius: 10,
              padding: '9px 14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              border: 'none',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 10,
              padding: '9px 14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Confirmando...' : 'Confirmar Consulta'}
          </button>
        </div>
      </div>
    </div>
  );
}
