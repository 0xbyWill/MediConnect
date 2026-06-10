import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { MessageSquare, Search, Send } from 'lucide-react';
import type { Paciente } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { messagesApi, type ApiPatientMessage } from '../lib/api';
import { digitsOnly } from '../shared/utils/cpf';
import { formatPhoneBR } from '../shared/utils/validation';
import { toUserFacingErrorMessage } from '../shared/utils/errors';

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
const POLL_INTERVAL_MS = 15000;
type MessagesDataSource = 'api' | 'mock';

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

function apiMessageToInterna(message: ApiPatientMessage): MensagemInterna {
  const when = splitDateTime(message.created_at);
  return {
    id: message.id,
    pacienteId: message.patient_id,
    autor: message.author,
    texto: message.body,
    lida: message.read,
    ...when,
  };
}

function buildMockMessages(pacientes: Paciente[]): MensagemInterna[] {
  const now = Date.now();
  const base = splitDateTime();
  return pacientes.slice(0, 6).flatMap((paciente, index) => {
    const patientMsgTime = new Date(now - (index + 1) * 3 * 60 * 1000).toISOString();
    const secretaryMsgTime = new Date(now - (index + 1) * 2 * 60 * 1000).toISOString();
    const patientWhen = splitDateTime(patientMsgTime);
    const secretaryWhen = splitDateTime(secretaryMsgTime);
    return [
      {
        id: `mock-patient-${paciente.id}`,
        pacienteId: paciente.id,
        autor: 'paciente' as const,
        texto: index % 2 === 0
          ? 'Oi, queria confirmar meu horário de consulta.'
          : 'Consigo remarcar para outro dia?',
        lida: false,
        ...patientWhen,
      },
      {
        id: `mock-secretary-${paciente.id}`,
        pacienteId: paciente.id,
        autor: 'secretaria' as const,
        texto: index % 2 === 0
          ? 'Claro! Vou verificar sua agenda e já te retorno.'
          : 'Consigo sim. Me confirma o melhor período para você.',
        lida: true,
        ...secretaryWhen,
      },
    ];
  }).sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)) || [{
    id: 'mock-empty',
    pacienteId: '',
    autor: 'secretaria',
    texto: 'Sem conversas no momento.',
    lida: true,
    ...base,
  }];
}

export default function Mensagens({ pacientes }: MensagensProps) {
  const { user } = useAuth();
  const isPatient = user?.role === 'paciente';
  const incomingAuthor: AutorMensagemInterna = isPatient ? 'secretaria' : 'paciente';

  const [mensagens, setMensagens] = useState<MensagemInterna[]>([]);
  const [pacienteConversaId, setPacienteConversaId] = useState('');
  const [buscaConversa, setBuscaConversa] = useState('');
  const [respostaSecretaria, setRespostaSecretaria] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState('');
  const [dataSource, setDataSource] = useState<MessagesDataSource>('api');
  const [info, setInfo] = useState('');
  const loadedOnceRef = useRef(false);

  const ownPatientId = useMemo(() => pacientes[0]?.id ?? '', [pacientes]);
  const effectivePacienteConversaId = isPatient ? ownPatientId : pacienteConversaId;

  const load = useCallback(async () => {
    try {
      const rows = await messagesApi.list(isPatient && ownPatientId ? { patient_id: ownPatientId } : {});
      setMensagens(rows.map(apiMessageToInterna));
      setErro('');
      setInfo('');
      setDataSource('api');
    } catch (err) {
      if (!loadedOnceRef.current) {
        setMensagens(buildMockMessages(pacientes).filter(msg => !isPatient || msg.pacienteId === ownPatientId));
      }
      setDataSource('mock');
      setErro('');
      setInfo(toUserFacingErrorMessage(err, 'Modo demonstração ativo: mostrando dados mockados para manter o fluxo da tela.'));
    } finally {
      loadedOnceRef.current = true;
      setLoading(false);
    }
  }, [isPatient, ownPatientId, pacientes]);

  useEffect(() => {
    void load();
    const intervalId = window.setInterval(() => { void load(); }, POLL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [load]);

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

  useEffect(() => {
    if (!isPatient && !pacienteConversaId && pacientesConversa.length > 0) {
      setPacienteConversaId(pacientesConversa[0].id);
    }
  }, [isPatient, pacienteConversaId, pacientesConversa]);

  const pacienteConversa = useMemo(
    () => pacientes.find(p => p.id === effectivePacienteConversaId),
    [effectivePacienteConversaId, pacientes]
  );

  const mensagensDaConversa = useMemo(
    () => mensagens
      .filter(msg => msg.pacienteId === effectivePacienteConversaId)
      .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`)),
    [mensagens, effectivePacienteConversaId]
  );

  const unreadCount = mensagens.filter(msg => msg.autor === incomingAuthor && !msg.lida).length;

  const markConversationRead = useCallback(async (patientId: string) => {
    const unreadIds = mensagens
      .filter(msg => msg.pacienteId === patientId && msg.autor === incomingAuthor && !msg.lida)
      .map(msg => msg.id);
    if (unreadIds.length === 0) return;
    setMensagens(prev => prev.map(msg => (unreadIds.includes(msg.id) ? { ...msg, lida: true } : msg)));
    try {
      if (dataSource === 'mock') return;
      await messagesApi.markRead(unreadIds);
    } catch {
      // Falha ao marcar como lida não bloqueia a leitura; será reprocessada no próximo load.
    }
  }, [mensagens, incomingAuthor, dataSource]);

  // Paciente: marca mensagens da secretaria como lidas ao abrir a tela.
  useEffect(() => {
    if (isPatient && effectivePacienteConversaId) void markConversationRead(effectivePacienteConversaId);
  }, [isPatient, effectivePacienteConversaId, markConversationRead]);

  const abrirConversa = (id: string) => {
    setPacienteConversaId(id);
    void markConversationRead(id);
  };

  const handleEnviarResposta = async (event: FormEvent) => {
    event.preventDefault();
    const message = respostaSecretaria.trim();
    const patientId = effectivePacienteConversaId;
    if (!patientId || !message || sending) return;

    setSending(true);
    try {
      if (dataSource === 'mock') {
        const when = splitDateTime();
        setMensagens(prev => [...prev, {
          id: `mock-local-${Date.now()}`,
          pacienteId: patientId,
          autor: isPatient ? 'paciente' : 'secretaria',
          texto: message,
          lida: true,
          ...when,
        }]);
      } else {
        const created = await messagesApi.create({
          patient_id: patientId,
          author: isPatient ? 'paciente' : 'secretaria',
          body: message,
        });
        setMensagens(prev => [...prev, apiMessageToInterna(created)]);
      }
      setRespostaSecretaria('');
      setErro('');
      if (dataSource === 'mock') {
        setInfo('Mensagem enviada no modo demonstração (local).');
      }
    } catch (err) {
      setErro(toUserFacingErrorMessage(err, 'Não foi possível enviar a mensagem. Tente novamente em instantes.'));
    } finally {
      setSending(false);
    }
  };

  const composerDisabled = !effectivePacienteConversaId || sending;
  const patientWithoutRecord = isPatient && !ownPatientId;

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Mensagens</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
          {isPatient ? 'Canal direto para conversar com a secretaria.' : 'Chat paciente-secretaria iniciado pelo assistente do paciente.'}
        </p>
      </div>

      {info && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--amber-50)', border: '1px solid var(--amber-200)', color: 'var(--amber-700)', fontSize: 13, fontWeight: 600 }}>
          {info}
        </div>
      )}

      {erro && (
        <div role="alert" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--red-50)', border: '1px solid var(--red-100)', color: 'var(--red-600)', fontSize: 13, fontWeight: 600 }}>
          {erro}
        </div>
      )}

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
            {loading && pacientesConversa.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '12px 4px' }}>Carregando conversas...</div>
            )}
            {!loading && pacientesConversa.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)', padding: '12px 4px' }}>Nenhum paciente encontrado.</div>
            )}
            {pacientesConversa.map(p => {
              const patientMessages = mensagens
                .filter(msg => msg.pacienteId === p.id)
                .sort((a, b) => `${a.data} ${a.hora}`.localeCompare(`${b.data} ${b.hora}`));
              const lastMessage = patientMessages.at(-1);
              const unread = patientMessages.some(msg => msg.autor === incomingAuthor && !msg.lida);
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
                    {lastMessage?.texto || 'Nenhuma mensagem ainda.'}
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
            {patientWithoutRecord && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Seu perfil ainda não está vinculado a um cadastro de paciente. Fale com a secretaria para concluir o vínculo.</div>
            )}
            {!patientWithoutRecord && loading && mensagensDaConversa.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Carregando mensagens...</div>
            )}
            {!patientWithoutRecord && !loading && !effectivePacienteConversaId && (
              <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>{isPatient ? 'Ainda não há mensagens nesta conversa.' : 'Escolha um paciente na lista para visualizar a ponte de comunicação.'}</div>
            )}
            {!patientWithoutRecord && !loading && effectivePacienteConversaId && mensagensDaConversa.length === 0 && (
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
              disabled={composerDisabled || patientWithoutRecord}
              rows={3}
              maxLength={MESSAGE_MAX_LENGTH}
              placeholder={isPatient ? 'Digite sua mensagem para a secretaria' : 'Digite uma resposta para o paciente'}
              style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{respostaSecretaria.length}/{MESSAGE_MAX_LENGTH} caracteres</span>
              <button
                type="submit"
                disabled={composerDisabled || patientWithoutRecord || !respostaSecretaria.trim()}
                style={{
                  padding: '10px 14px',
                  border: 'none',
                  borderRadius: 8,
                  background: composerDisabled || patientWithoutRecord || !respostaSecretaria.trim() ? 'var(--gray-200)' : 'var(--primary)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: composerDisabled || patientWithoutRecord || !respostaSecretaria.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Send size={15} />
                {sending ? 'Enviando...' : isPatient ? 'Enviar mensagem' : 'Enviar resposta'}
              </button>
            </div>
          </form>

        </section>
      </div>
    </div>
  );
}
