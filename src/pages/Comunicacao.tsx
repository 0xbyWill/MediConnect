import { useState } from 'react';
import { MessageSquare, Send, Mail, Phone, Bell, Clock, CheckCircle2, XCircle, Search, Plus } from 'lucide-react';
import type { Paciente } from '../types';

interface ComunicacaoProps {
  pacientes: Paciente[];
}

type Canal = 'whatsapp' | 'email' | 'sms';
type StatusMsg = 'enviado' | 'pendente' | 'falhou';

interface Mensagem {
  id: string;
  pacienteId: string;
  canal: Canal;
  texto: string;
  status: StatusMsg;
  data: string;
  hora: string;
}

const CANAL_ICON: Record<Canal, React.ElementType> = {
  whatsapp: Phone,
  email: Mail,
  sms: MessageSquare,
};

const CANAL_COLOR: Record<Canal, string> = {
  whatsapp: '#25d366',
  email: '#3b82f6',
  sms: '#f59e0b',
};

const CANAL_LABEL: Record<Canal, string> = {
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  sms: 'SMS',
};

const STATUS_STYLE: Record<StatusMsg, { bg: string; color: string; icon: React.ElementType; label: string }> = {
  enviado:  { bg: 'var(--mint)',     color: 'var(--dark)',       icon: CheckCircle2, label: 'Enviado' },
  pendente: { bg: 'var(--amber-100)', color: 'var(--amber-600)', icon: Clock,        label: 'Pendente' },
  falhou:   { bg: 'var(--red-100)',  color: 'var(--red-600)',    icon: XCircle,      label: 'Falhou' },
};

const TEMPLATES = [
  { label: 'Confirmação de consulta', texto: 'Olá {nome}! Confirmamos sua consulta para {data} às {hora}. Responda SIM para confirmar ou NÃO para cancelar.' },
  { label: 'Lembrete de consulta', texto: 'Olá {nome}! Lembramos que você tem consulta amanhã às {hora}. Qualquer dúvida, entre em contato.' },
  { label: 'Resultado de exame', texto: 'Olá {nome}! Seu resultado de exame está disponível. Entre em contato para mais informações.' },
  { label: 'Boas-vindas', texto: 'Bem-vindo(a) à nossa clínica, {nome}! Estamos à disposição para cuidar da sua saúde.' },
];

// Mock de histórico
const mockMensagens: Mensagem[] = [
  { id: 'm1', pacienteId: '1', canal: 'whatsapp', texto: 'Confirmamos sua consulta para hoje às 09:00.', status: 'enviado', data: new Date().toISOString().split('T')[0], hora: '08:00' },
  { id: 'm2', pacienteId: '3', canal: 'email', texto: 'Seu resultado de exame está disponível.', status: 'enviado', data: new Date().toISOString().split('T')[0], hora: '07:30' },
  { id: 'm3', pacienteId: '2', canal: 'sms', texto: 'Lembrete: consulta amanhã às 10:15.', status: 'pendente', data: new Date().toISOString().split('T')[0], hora: '08:45' },
];

export default function Comunicacao({ pacientes }: ComunicacaoProps) {
  const [canal, setCanal] = useState<Canal>('whatsapp');
  const [pacienteId, setPacienteId] = useState('');
  const [texto, setTexto] = useState('');
  const [search, setSearch] = useState('');
  const [mensagens] = useState<Mensagem[]>(mockMensagens);
  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const filteredPacientes = pacientes.filter(p =>
    !search || p.nome.toLowerCase().includes(search.toLowerCase())
  );

  const handleTemplate = (t: string) => {
    const p = pacientes.find(x => x.id === pacienteId);
    setTexto(t.replace('{nome}', p?.nome || '[Paciente]'));
  };

  const handleEnviar = async () => {
    if (!pacienteId || !texto.trim()) return;
    setEnviando(true);
    await new Promise(r => setTimeout(r, 1200));
    setEnviando(false);
    setSucesso(true);
    setTexto('');
    setTimeout(() => setSucesso(false), 3000);
  };

  return (
    <div style={{ flex: 1, width: '100%', minWidth: 0, overflow: 'auto', padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--dark)' }}>Comunicação</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>
          Envie mensagens e gerencie o histórico de comunicação com pacientes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, alignItems: 'start' }}>
        {/* Nova mensagem */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus size={16} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Nova Mensagem</h2>
          </div>

          {/* Canal */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Canal</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['whatsapp', 'email', 'sms'] as Canal[]).map(c => {
                const Icon = CANAL_ICON[c];
                const active = canal === c;
                return (
                  <button key={c} onClick={() => setCanal(c)} style={{
                    flex: 1, padding: '8px 6px', borderRadius: 10, cursor: 'pointer',
                    border: active ? `2px solid ${CANAL_COLOR[c]}` : '2px solid var(--gray-200)',
                    background: active ? `${CANAL_COLOR[c]}15` : '#fff',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    transition: 'all .15s',
                  }}>
                    <Icon size={16} color={active ? CANAL_COLOR[c] : 'var(--gray-400)'} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: active ? CANAL_COLOR[c] : 'var(--gray-400)' }}>{CANAL_LABEL[c]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paciente */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Paciente</label>
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-400)' }} />
              <input
                placeholder="Buscar paciente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '9px 12px 9px 30px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)' }}
              />
            </div>
            <select
              value={pacienteId}
              onChange={e => setPacienteId(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', cursor: 'pointer' }}
            >
              <option value="">Selecione o paciente</option>
              {filteredPacientes.map(p => (
                <option key={p.id} value={p.id}>{p.nome} — {p.telefone}</option>
              ))}
            </select>
          </div>

          {/* Templates */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Modelos de mensagem</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => handleTemplate(t.texto)} style={{
                  padding: '5px 10px', background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
                  borderRadius: 20, fontSize: 11, fontWeight: 600, color: 'var(--gray-600)', cursor: 'pointer',
                }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mensagem */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Mensagem</label>
            <textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              rows={4}
              placeholder="Digite ou selecione um modelo acima..."
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--gray-200)', borderRadius: 8, fontSize: 13, outline: 'none', background: 'var(--gray-50)', resize: 'vertical', fontFamily: 'Montserrat, sans-serif' }}
            />
            <div style={{ fontSize: 11, color: 'var(--gray-400)', textAlign: 'right' }}>{texto.length} caracteres</div>
          </div>

          {sucesso && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--mint)', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <CheckCircle2 size={15} color="var(--primary)" />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>Mensagem enviada com sucesso!</span>
            </div>
          )}

          <button
            onClick={handleEnviar}
            disabled={enviando || !pacienteId || !texto.trim()}
            style={{
              width: '100%', padding: '11px', background: !pacienteId || !texto.trim() ? 'var(--gray-200)' : 'var(--primary)',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: !pacienteId || !texto.trim() ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <Send size={15} />
            {enviando ? 'Enviando...' : 'Enviar Mensagem'}
          </button>
        </div>

        {/* Histórico */}
        <div style={{ background: '#fff', borderRadius: 16, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid var(--gray-100)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={16} color="var(--primary)" />
            </div>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-800)' }}>Histórico de Comunicação</h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {mensagens.map(msg => {
              const pac = pacientes.find(p => p.id === msg.pacienteId);
              const Icon = CANAL_ICON[msg.canal];
              const st = STATUS_STYLE[msg.status];
              const StIcon = st.icon;
              return (
                <div key={msg.id} style={{ border: '1px solid var(--gray-100)', borderRadius: 12, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${CANAL_COLOR[msg.canal]}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon size={13} color={CANAL_COLOR[msg.canal]} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{pac?.nome || 'Paciente'}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{CANAL_LABEL[msg.canal]} · {msg.hora}</div>
                      </div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, background: st.bg, color: st.color, fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20 }}>
                      <StIcon size={11} /> {st.label}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5 }}>{msg.texto}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}