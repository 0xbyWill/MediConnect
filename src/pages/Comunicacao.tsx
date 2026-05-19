import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ElementType, FormEvent } from 'react';
import { Bell, CheckCircle2, Clock, Mail, MessageSquare, Phone, Plus, Search, Send, XCircle } from 'lucide-react';
import type { Paciente } from '../types';
import { smsApi, type ApiSmsLog } from '../lib/api';
import { SMS_MESSAGE_MAX_LENGTH, SMS_TEMPLATES } from '../shared/constants/smsTemplates';
import { formatPhoneBR, isValidPhoneBRForSms, normalizePhoneBRForSms } from '../shared/utils/validation';
import { digitsOnly, formatCpf } from '../shared/utils/cpf';

interface ComunicacaoProps {
  pacientes: Paciente[];
}

type Canal = 'whatsapp' | 'email' | 'sms';
type StatusMsg = 'enviado' | 'pendente' | 'falhou';

interface Mensagem {
  id: string;
  pacienteId?: string;
  canal: Canal;
  telefone: string;
  texto: string;
  status: StatusMsg;
  data: string;
  hora: string;
  sid?: string;
}

const MESSAGE_MAX_LENGTH = SMS_MESSAGE_MAX_LENGTH;
const STORAGE_KEY = 'mc_communication_history';

const CANAL_ICON: Record<Canal, ElementType> = {
  whatsapp: Phone,
  email: Mail,
  sms: MessageSquare,
};

const CANAL_COLOR: Record<Canal, string> = {
  whatsapp: '#25d366',
  email: '#2563eb',
  sms: '#d97706',
};

const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
};

const STATUS_STYLE: Record<StatusMsg, { bg: string; color: string; icon: ElementType; label: string }> = {
  enviado: { bg: 'var(--mint)', color: 'var(--dark)', icon: CheckCircle2, label: 'Enviado' },
  pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)', icon: Clock, label: 'Pendente' },
  falhou: { bg: 'var(--red-100)', color: 'var(--red-600)', icon: XCircle, label: 'Falhou' },
};

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

function readStoredMessages(): Mensagem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as Mensagem[] : [];
  } catch {
    return [];
  }
}

function toStatus(status?: string | null): StatusMsg {
  const value = status?.toLowerCase().trim();
  if (value === 'sent' || value === 'enviado' || value === 'delivered' || value === 'success') return 'enviado';
  if (value === 'failed' || value === 'falhou' || value === 'error' || value === 'undelivered') return 'falhou';
  return 'pendente';
}

function splitDateTime(value?: string) {
  const date = value ? new Date(value) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return {
    data: safeDate.toISOString().split('T')[0],
    hora: `${String(safeDate.getHours()).padStart(2, '0')}:${String(safeDate.getMinutes()).padStart(2, '0')}`,
  };
}

function smsLogToMensagem(log: ApiSmsLog): Mensagem {
  const when = splitDateTime(log.created_at);
  return {
    id: log.id,
    pacienteId: log.patient_id ?? undefined,
    canal: 'sms',
    telefone: log.phone_number,
    texto: log.message,
    status: toStatus(log.status),
    sid: log.sid ?? log.twilio_sid ?? undefined,
    ...when,
  };
}

function getProblemMessage(err: unknown) {
  const msg = err instanceof Error ? err.message : 'Erro ao enviar SMS.';
  const lower = msg.toLowerCase();
  if (msg.includes('503') || lower.includes('service-disabled') || lower.includes('serviço desabilitado') || lower.includes('serviço de SMS está temporariamente desabilitado')) {
    return 'O serviço de SMS está temporariamente desabilitado no servidor.';
  }
  return msg;
}

export default function Comunicacao({ pacientes }: ComunicacaoProps) {
  const [pacienteId, setPacienteId] = useState('');
  const [texto, setTexto] = useState('');
  const [search, setSearch] = useState('');
  const [mensagens, setMensagens] = useState<Mensagem[]>(readStoredMessages);
  const [enviando, setEnviando] = useState(false);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [sucesso, setSucesso] = useState('');
  const [erro, setErro] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ pacienteId?: string; texto?: string }>({});

  const paciente = useMemo(
    () => pacientes.find(p => p.id === pacienteId),
    [pacienteId, pacientes]
  );

  const filteredPacientes = useMemo(() => {
    const query = search.trim().toLowerCase();
    const queryDigits = digitsOnly(query);
    return pacientes.filter(p => {
      if (!query) return true;
      const phoneDigits = digitsOnly(p.telefone);
      const cpfDigits = digitsOnly(p.cpf);
      return (
        p.nome.toLowerCase().includes(query) ||
        formatPhoneBR(p.telefone).includes(query) ||
        Boolean(queryDigits && (phoneDigits.includes(queryDigits) || cpfDigits.includes(queryDigits)))
      );
    });
  }, [pacientes, search]);

  useEffect(() => {
    let cancelled = false;
    setCarregandoHistorico(true);

    smsApi.logs()
      .then(logs => {
        if (!cancelled) setMensagens(logs.map(smsLogToMensagem));
      })
      .catch(() => {
        if (!cancelled) setMensagens(readStoredMessages());
      })
      .finally(() => {
        if (!cancelled) setCarregandoHistorico(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mensagens.slice(0, 100)));
  }, [mensagens]);

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const message = texto.trim();

    if (!pacienteId) errors.pacienteId = 'Selecione um paciente.';
    if (pacienteId && !paciente?.telefone) errors.pacienteId = 'Paciente sem telefone cadastrado.';
    if (paciente?.telefone && !isValidPhoneBRForSms(paciente.telefone)) errors.pacienteId = 'Paciente sem telefone com DDD válido para SMS.';
    if (!message) errors.texto = 'Informe a mensagem.';
    if (message.length > MESSAGE_MAX_LENGTH) errors.texto = `A mensagem deve ter no máximo ${MESSAGE_MAX_LENGTH} caracteres.`;

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTemplate = (template: string) => {
    const name = paciente?.nome || '[Paciente]';
    setTexto(
      template
        .replace('{nome}', name)
        .replace('{data}', 'DD/MM/AAAA')
        .replace('{hora}', 'HH:mm')
        .slice(0, MESSAGE_MAX_LENGTH)
    );
    setFieldErrors(prev => ({ ...prev, texto: undefined }));
  };

  const handleEnviar = async (event: FormEvent) => {
    event.preventDefault();
    setSucesso('');
    setErro('');
    if (!validate() || !paciente) return;

    const message = texto.trim();
    const phoneNumber = normalizePhoneBRForSms(paciente.telefone);

    setEnviando(true);
    try {
      const response = await smsApi.send({
        patient_id: paciente.id,
        phone_number: phoneNumber,
        message,
      });

      if (response.success === false) {
        throw new Error(response.message || 'A API não confirmou o envio do SMS.');
      }

      const now = splitDateTime();
      setMensagens(prev => [{
        id: response.sid || String(Date.now()),
        pacienteId: paciente.id,
        canal: 'sms',
        telefone: phoneNumber,
        texto: message,
        status: 'enviado',
        sid: response.sid,
        ...now,
      }, ...prev]);
      setSucesso(response.message || 'SMS enviado e registrado em sms_logs.');
      setTexto('');
      setFieldErrors({});
      window.setTimeout(() => setSucesso(''), 3000);
    } catch (err) {
      const msg = getProblemMessage(err);
      setErro(msg);
      const now = splitDateTime();
      setMensagens(prev => [{
        id: `failed-${Date.now()}`,
        pacienteId: paciente.id,
        canal: 'sms',
        telefone: phoneNumber,
        texto: message,
        status: 'falhou',
        ...now,
      }, ...prev]);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(14px, 3vw, 24px)' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Comunicação</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
          Confirme consultas e envie comunicados administrativos por SMS. WhatsApp e e-mail ficam separados como canais de comunicação.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
        <form onSubmit={handleEnviar} style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Confirmação de consulta</h2>
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={labelStyle}>Canal</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['whatsapp', 'email', 'sms'] as Canal[]).map(c => {
                const Icon = CANAL_ICON[c];
                const active = c === 'sms';
                return (
                  <button key={c} type="button" disabled={!active} title={!active ? 'Canal preparado para integração futura' : 'Enviar SMS'} style={{
                    flex: 1,
                    padding: '8px 6px',
                    borderRadius: 8,
                    border: active ? `2px solid ${CANAL_COLOR[c]}` : '2px solid var(--gray-200)',
                    background: active ? `${CANAL_COLOR[c]}15` : 'var(--gray-50)',
                    opacity: active ? 1 : 0.55,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    cursor: active ? 'default' : 'not-allowed',
                  }}>
                    <Icon size={16} color={active ? CANAL_COLOR[c] : 'var(--gray-400)'} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? CANAL_COLOR[c] : 'var(--gray-400)' }}>{CANAL_LABEL[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="communication-patient-search" style={labelStyle}>Paciente</label>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                id="communication-patient-search"
                placeholder="Ex.: Maria, CPF ou (11) 99999-9999"
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setPacienteId('');
                  setFieldErrors(prev => ({ ...prev, pacienteId: undefined }));
                }}
                disabled={enviando}
                aria-invalid={Boolean(fieldErrors.pacienteId)}
                aria-describedby={fieldErrors.pacienteId ? 'communication-patient-error' : undefined}
                autoComplete="off"
                style={{ ...fieldStyle, paddingLeft: 30 }}
              />
            </div>
            {search.trim() && (
              <div style={{ border: '1px solid var(--gray-200)', borderRadius: 8, marginBottom: 10, maxHeight: 180, overflow: 'auto', background: '#fff' }}>
                {filteredPacientes.length === 0 && (
                  <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--gray-500)' }}>Nenhum paciente encontrado.</div>
                )}
                {filteredPacientes.map(p => {
                  const selected = p.id === pacienteId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setPacienteId(p.id);
                        setSearch(p.nome);
                        setFieldErrors(prev => ({ ...prev, pacienteId: undefined }));
                      }}
                      style={{
                        width: '100%',
                        border: 'none',
                        borderBottom: '1px solid var(--gray-100)',
                        background: selected ? 'var(--mint)' : '#fff',
                        color: 'var(--gray-800)',
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{p.nome}</span>
                      <span style={{ display: 'block', fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>{formatPhoneBR(p.telefone)} - CPF {formatCpf(p.cpf) || 'não informado'}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {fieldErrors.pacienteId && <div id="communication-patient-error" role="alert" style={{ fontSize: 12, color: 'var(--red-600)', marginTop: 6 }}>{fieldErrors.pacienteId}</div>}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Modelos de mensagem</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {SMS_TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => handleTemplate(t.message)} disabled={enviando} style={{
                  padding: '5px 10px',
                  background: 'var(--gray-50)',
                  border: '1px solid var(--gray-200)',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--gray-600)',
                  cursor: enviando ? 'not-allowed' : 'pointer',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="communication-message" style={labelStyle}>Mensagem</label>
            <textarea
              id="communication-message"
              value={texto}
              onChange={e => {
                setTexto(e.target.value.slice(0, MESSAGE_MAX_LENGTH));
                setFieldErrors(prev => ({ ...prev, texto: undefined }));
              }}
              rows={5}
              placeholder="Ex.: Lembrete: consulta amanhã às 14h"
              disabled={enviando}
              maxLength={MESSAGE_MAX_LENGTH}
              aria-invalid={Boolean(fieldErrors.texto)}
              aria-describedby={fieldErrors.texto ? 'communication-message-error' : 'communication-message-count'}
              style={{ ...fieldStyle, resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
            />
            <div id="communication-message-count" style={{ fontSize: 11, color: texto.length > 900 ? 'var(--amber-600)' : 'var(--gray-400)', textAlign: 'right' }}>
              {texto.length}/{MESSAGE_MAX_LENGTH} caracteres
            </div>
            {fieldErrors.texto && <div id="communication-message-error" role="alert" style={{ fontSize: 12, color: 'var(--red-600)', marginTop: 6 }}>{fieldErrors.texto}</div>}
          </div>

          {sucesso && (
            <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mint)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <CheckCircle2 size={15} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{sucesso}</span>
            </div>
          )}

          {erro && (
            <div role="alert" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--red-50)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <XCircle size={15} color="var(--red-500)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--red-600)' }}>{erro}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={enviando || !pacienteId || !texto.trim()}
            style={{
              width: '100%',
              padding: '11px',
              background: enviando || !pacienteId || !texto.trim() ? 'var(--gray-200)' : 'var(--primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: enviando || !pacienteId || !texto.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <Send size={15} />
            {enviando ? 'Enviando...' : 'Enviar SMS'}
          </button>
        </form>

        <section style={{ background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Histórico de Comunicação</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {carregandoHistorico && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Carregando histórico...</div>}
            {!carregandoHistorico && mensagens.length === 0 && <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>Nenhum SMS registrado ainda.</div>}

            {mensagens.map(msg => {
              const pac = pacientes.find(p => p.id === msg.pacienteId);
              const Icon = CANAL_ICON[msg.canal];
              const st = STATUS_STYLE[msg.status];
              const StIcon = st.icon;
              return (
                <article key={msg.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 8, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${CANAL_COLOR[msg.canal]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                        <Icon size={13} color={CANAL_COLOR[msg.canal]} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pac?.nome || msg.telefone || 'Paciente'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{CANAL_LABEL[msg.canal]} - {msg.data.split('-').reverse().join('/')} às {msg.hora}</div>
                      </div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 8, flex: '0 0 auto' }}>
                      <StIcon size={11} /> {st.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{msg.texto}</p>
                  {msg.sid && <div style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 8 }}>SID: {msg.sid}</div>}
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
