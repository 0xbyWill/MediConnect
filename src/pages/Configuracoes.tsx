import React, { useState } from 'react';
import { Save, Trash2, AlertTriangle } from 'lucide-react';

export default function Configuracoes() {
  const [nome, setNome] = useState('Dr. User Profile');
  const [especialidade, setEspecialidade] = useState('Cardiologista');
  const [crm, setCrm] = useState('CRM/SP 123456');
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    ['mc_pacientes', 'mc_agendamentos', 'mc_laudos'].forEach(k => localStorage.removeItem(k));
    window.location.reload();
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div style={{ background: '#fff', borderRadius: 14, padding: 24, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--dark)', marginBottom: 20 }}>{title}</h2>
      {children}
    </div>
  );

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 32, maxWidth: 700 }}>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)', marginBottom: 8 }}>Configurações</h1>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 28 }}>Personalize o sistema conforme sua preferência.</p>

      <Section title="Perfil do Médico">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Nome Completo', value: nome, set: setNome },
            { label: 'Especialidade', value: especialidade, set: setEspecialidade },
            { label: 'CRM', value: crm, set: setCrm },
          ].map(f => (
            <div key={f.label}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>{f.label}</label>
              <input value={f.value} onChange={e => f.set(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--background)' }} />
            </div>
          ))}
          <button onClick={handleSave} style={{ marginTop: 4, padding: '10px 20px', background: saved ? '#16a34a' : 'var(--primary)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', transition: 'background .2s' }}>
            <Save size={15} /> {saved ? 'Salvo!' : 'Salvar Alterações'}
          </button>
        </div>
      </Section>

      <Section title="Sobre o Sistema">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { label: 'Sistema', value: 'MediConnect — Clinical Sanctuary' },
            { label: 'Versão', value: '1.0.0' },
            { label: 'Stack', value: 'React + TypeScript + Vite' },
            { label: 'Persistência', value: 'localStorage (sem backend)' },
          ].map(i => (
            <div key={i.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--gray-50)' }}>
              <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{i.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{i.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Zona de Perigo">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 16, background: 'var(--red-50)', borderRadius: 10, border: '1px solid var(--red-100)' }}>
          <AlertTriangle size={20} color="var(--red-500)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--red-600)', marginBottom: 4 }}>Resetar todos os dados</div>
            <p style={{ fontSize: 12, color: 'var(--gray-600)', marginBottom: 12 }}>Esta ação irá apagar todos os pacientes, agendamentos e laudos do sistema. Esta ação não pode ser desfeita.</p>
            <button onClick={() => setConfirmReset(true)} style={{ padding: '8px 16px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Trash2 size={13} /> Resetar Sistema
            </button>
          </div>
        </div>
      </Section>

      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '90%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--red-600)', marginBottom: 8 }}>⚠️ Confirmar Reset</h3>
            <p style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 20 }}>Todos os dados serão apagados permanentemente. Tem certeza?</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmReset(false)} style={{ padding: '9px 18px', background: 'none', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={handleReset} style={{ padding: '9px 18px', background: 'var(--red-500)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Sim, resetar tudo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}