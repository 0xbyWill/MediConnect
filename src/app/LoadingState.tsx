interface LoadingStateProps {
  label?: string;
}

export default function LoadingState({ label = 'Carregando...' }: LoadingStateProps) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      minHeight: '100%',
      display: 'grid',
      placeItems: 'center',
      background: 'var(--background)',
      padding: 24,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48,
          height: 48,
          border: '4px solid var(--mint)',
          borderTop: '4px solid var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600 }}>{label}</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
