import { useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { MessageSquare, Search, Send } from 'lucide-react';
import type { Paciente } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { digitsOnly } from '../shared/utils/cpf';
import { formatPhoneBR } from '../shared/utils/validation';

interface MensagensProps {
  pacientes: Paciente[];
}

type AutorMensagemInterna = 'paciente' | 'secretaria';

interface MensagemInterna {
  id: string;
  pacienteId: string;
  autor: AutorMensagemInterna;
  texto: string;
  data: string;
  hora: string;
  lida: boolean;
}

const MESSAGE_MAX_LENGTH = 1000;

const fieldStyle = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid var(--gray-200)',
  borderRadius: 8,
  fontSize: 13,
  outline: 'none',
  background: 'var(--gray-50)',
} satisfies CSSProperties;

const labelStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--gray-600)',
  textTransform: 'uppercase',
  letterSpacing: 0,
  display: 'block',
  marginBottom: 6,
} satisfies CSSProperties;

function splitDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    data: safeDate.toISOString().split('T')[0],
    hora: `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`,
  };
}

function buildInitialInternalMessages(pacientes: Paciente[]): MensagemInterna[] {
  const now = splitDateTime();
  return pacientes.slice(0, 3).map((paciente, index) => ({
    id: `mock-paciente-${paciente.id}`,
    pacienteId: paciente.id,
    autor: 'paciente',
    texto: index === 0
      ? 'Olá, preciso confirmar o horário da minha consulta.'
      : 'Bom dia, gostaria de falar com a secretaria.',
    data: now.data,
    hora: now.hora,
    lida: index > 0,
  }));
}

export default function Mensagens({ pacientes }: MensagensProps) {
  const { user } = useAuth();
  const isPatient = user?.role === 'paciente';
  const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
  const [pacienteConversaId, setPacienteConversaId] = useState('');
  const [buscaConversa, setBuscaConversa] = useState('');
  const [respostaSecretaria, setRespostaSecretaria] = useState('');

  const mensagensMock = useMemo(
    () => buildInitialInternalMessages(pacientes),
    [pacientes]
  );

  const effectivePacienteConversaId = isPatient ? (pacientes[0]?.id ?? '') : pacienteConversaId;

  const mensagensVisiveis = useMemo(
    () => (mensagens.length > 0 ? mensagens : (isPatient ? [] : mensagensMock)),
    [isPatient, mensagens, mensagensMock]
  );

  const pacientesConversa = useMemo(() => {
    const query = buscaConversa.trim().toLowerCase();
    const queryDigits = digitsOnly(query);
    return pacientes.filter(p => {
      if (!query) return true;
      return (
        p.nome.toLowerCase().includes(query) ||
        formatPhoneBR(p.telefone).includes(query) ||
        Boolean(queryDigits && (digitsOnly(p.telefone).includes(queryDigits) || digitsOnly(p.cpf).includes(queryDigits)))
      );
    });
  }, [buscaConversa, pacientes]);

  const pacienteConversa = useMemo(
    () => pacientes.find(p => p.id === effectivePacienteConversaId),
    [effectivePacienteConversaId, pacientes]
  );

  const mensagensDaConversa = useMemo(
    () => mensagensVisiveis.filter(msg => msg.pacienteId === effectivePacienteConversaId),
    [mensagensVisiveis, effectivePacienteConversaId]
  );

  const unreadCount = mensagensVisiveis.filter(msg => msg.autor === 'paciente' && !msg.lida).length;

  const abrirConversa = (id: string) => {
    setPacienteConversaId(id);
    setMensagens(prev => (prev.length > 0 ? prev : mensagensMock).map(msg => (
      msg.pacienteId === id && msg.autor === 'paciente' ? { ...msg, lida: true } : msg
    )));
  };

  const handleEnviarResposta = (event: FormEvent) => {
    event.preventDefault();
    const message = respostaSecretaria.trim();
    if (!effectivePacienteConversaId || !message) return;

    const now = splitDateTime();
    setMensagens(prev => [...(prev.length > 0 ? prev : (isPatient ? [] : mensagensMock)), {
      id: `${isPatient ? 'paciente' : 'secretaria'}-${Date.now()}`,
      pacienteId: effectivePacienteConversaId,
      autor: isPatient ? 'paciente' : 'secretaria',
      texto: message,
      data: now.data,
      hora: now.hora,
      lida: true,
    }]);
    setRespostaSecretaria('');
  };

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Mensagens</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
          {isPatient ? 'Canal direto para conversar com a secretaria.' : 'Chat paciente-secretaria iniciado pelo assistente do paciente.'}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isPatient ? 'minmax(0, 760px)' : 'minmax(280px, 360px) minmax(0, 1fr)', gap: 20, alignItems: 'stretch' }}>
        {!isPatient && (
        <section style={{ background: '#fff', borderRadius: 8, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', minHeight: 520 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={16} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Conversas</h2>
            <span style={{ marginLeft: 'auto', background: unreadCount ? 'var(--primary)' : 'var(--gray-100)', color: unreadCount ? '#fff' : 'var(--gray-500)', borderRadius: 8, padding: '3px 7px', fontSize: 11, fontWeight: 700 }}>
              {unreadCount}
            </span>
          </div>

          <label htmlFor="internal-message-patient-search" style={labelStyle}>Buscar paciente</label>
          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
            <input
              id="internal-message-patient-search"
              value={buscaConversa}
              onChange={e => setBuscaConversa(e.target.value)}
              placeholder="Nome, CPF ou telefone"
              autoComplete="off"
              style={{ ...fieldStyle, paddingLeft: 30 }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 410, overflow: 'auto' }}>
            {pacientesConversa.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '12px 4px' }}>Nenhum paciente encontrado.</div>
            )}
            {pacientesConversa.map(p => {
              const patientMessages = mensagensVisiveis.filter(msg => msg.pacienteId === p.id);
              const lastMessage = patientMessages.at(-1);
              const unread = patientMessages.some(msg => msg.autor === 'paciente' && !msg.lida);
              const selected = p.id === pacienteConversaId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => abrirConversa(p.id)}
                  style={{
                    width: '100%',
                    border: `1px solid ${selected ? 'var(--primary)' : 'var(--gray-100)'}`,
                    borderRadius: 8,
                    background: selected ? 'var(--mint)' : '#fff',
                    padding: '12px',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nome}</span>
                    {unread && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--primary)', flex: '0 0 auto' }} />}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{formatPhoneBR(p.telefone)}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--gray-600)', marginTop: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {lastMessage?.texto || 'Sem mensagens nesta estrutura local.'}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        )}

        <section style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)', minHeight: 520, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>{isPatient ? 'Secretaria' : (pacienteConversa?.nome || 'Selecione uma conversa')}</h2>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                {isPatient
                  ? 'Envie mensagens para a equipe da secretaria.'
                  : pacienteConversa ? `${formatPhoneBR(pacienteConversa.telefone)} - chat interno paciente/secretaria` : 'Escolha um paciente para responder o chat.'}
              </p>
            </div>
            <span style={{ background: 'var(--gray-100)', color: 'var(--gray-600)', borderRadius: 8, padding: '5px 8px', fontSize: 11, fontWeight: 700 }}>Chat</span>
          </div>

          <div style={{ flex: 1, border: '1px solid var(--gray-100)', borderRadius: 8, padding: 14, background: 'var(--gray-50)', overflow: 'auto', minHeight: 300 }}>
            {!effectivePacienteConversaId && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{isPatient ? 'Ainda não há mensagens nesta conversa.' : 'Escolha um paciente na lista para visualizar a ponte de comunicação.'}</div>
            )}
            {effectivePacienteConversaId && mensagensDaConversa.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Ainda não há mensagens nesta conversa.</div>
            )}
            {mensagensDaConversa.map(msg => {
              const isSecretaria = msg.autor === 'secretaria';
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: isSecretaria ? 'flex-end' : 'flex-start', marginBottom: 10 }}>
                  <div style={{
                    maxWidth: '72%',
                    background: isSecretaria ? 'var(--primary)' : '#fff',
                    color: isSecretaria ? '#fff' : 'var(--gray-800)',
                    border: `1px solid ${isSecretaria ? 'var(--primary)' : 'var(--gray-200)'}`,
                    borderRadius: 8,
                    padding: '9px 11px',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{isSecretaria ? 'Secretaria' : 'Paciente'}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.45, overflowWrap: 'anywhere' }}>{msg.texto}</div>
                    <div style={{ fontSize: 10, opacity: 0.75, marginTop: 5, textAlign: 'right' }}>{msg.hora}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleEnviarResposta} style={{ marginTop: 14 }}>
            <label htmlFor="internal-message-reply" style={labelStyle}>{isPatient ? 'Mensagem para secretaria' : 'Resposta da secretaria'}</label>
            <textarea
              id="internal-message-reply"
              value={respostaSecretaria}
              onChange={e => setRespostaSecretaria(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
              disabled={!effectivePacienteConversaId}
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={isPatient ? 'Digite sua mensagem para a secretaria' : 'Digite uma resposta para o paciente'}
              style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{respostaSecretaria.length}/{MESSAGE_MAX_LENGTH} caracteres</span>
              <button
                type="submit"
                disabled={!effectivePacienteConversaId || !respostaSecretaria.trim()}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 8,
                  background: !effectivePacienteConversaId || !respostaSecretaria.trim() ? 'var(--gray-200)' : 'var(--primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: !effectivePacienteConversaId || !respostaSecretaria.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Send size={15} />
                {isPatient ? 'Enviar mensagem' : 'Enviar resposta'}
              </button>
            </div>
          </form>

        </section>
      </div>
    </div>
  );
}
