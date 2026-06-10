import { formatSpecialty } from './format';

export interface DoctorAvailabilityItem {
  doctorId: string;
  doctorName: string;
  specialty: string;
  nextSlot: string;
}

interface DoctorSelectorProps {
  doctors: DoctorAvailabilityItem[];
  selectedDoctorId: string | null;
  onSelect: (doctorId: string) => void;
  loading?: boolean;
}

export function DoctorSelector({
  doctors,
  selectedDoctorId,
  onSelect,
  loading = false,
}: DoctorSelectorProps) {
  return (
    <section style={{ display: 'grid', gap: 10 }}>
      <h3 style={{ margin: 0, fontSize: 18, color: '#071327' }}>Médicos disponíveis</h3>

      {loading ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>Carregando médicos...</div>
      ) : doctors.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: 14 }}>
          Não há médicos com horários livres nesta data.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {doctors.map(doctor => {
            const selected = doctor.doctorId === selectedDoctorId;
            return (
              <article
                key={doctor.doctorId}
                style={{
                  border: `1px solid ${selected ? 'var(--primary)' : 'var(--gray-200)'}`,
                  background: '#fff',
                  borderRadius: 12,
                  padding: '12px 14px',
                  display: 'grid',
                  gap: 8,
                }}
              >
                <div>
                  <strong style={{ display: 'block', fontSize: 15, color: '#0f172a' }}>{doctor.doctorName}</strong>
                  <span style={{ fontSize: 13, color: '#475569' }}>{formatSpecialty(doctor.specialty)}</span>
                </div>
                <div style={{ fontSize: 13, color: '#334155' }}>
                  Próximo horário: <strong>{doctor.nextSlot}</strong>
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => onSelect(doctor.doctorId)}
                    style={{
                      border: selected ? 'none' : '1px solid var(--primary)',
                      background: selected ? 'var(--primary)' : '#fff',
                      color: selected ? '#fff' : 'var(--primary)',
                      borderRadius: 10,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    {selected ? 'Horários selecionados' : 'Ver horários'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
