import { useState, useCallback } from 'react';
import { store } from './store';
import type { Paciente, Agendamento, Laudo, PageType } from './types';
import { ROLE_PAGES } from './types';
import { useAuth } from './contexts/AuthContext';

import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Dashboard from './pages/Dashboard';
import Pacientes from './pages/Pacientes';
import Agenda from './pages/Agenda';
import Laudos from './pages/Laudos';
import Configuracoes from './pages/Configuracoes';
import Comunicacao from './pages/Comunicacao';
import Relatorios from './pages/Relatorios';
import Usuarios from './pages/Usuarios';
import Metricas from './pages/Metricas';

// Inicializa dados padrão no localStorage
store.initDefaults();

export default function App() {
  const { user, loading } = useAuth();

  const [pacientes, setPacientes] = useState<Paciente[]>(store.getPacientes());
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>(store.getAgendamentos());
  const [laudos, setLaudos] = useState<Laudo[]>(store.getLaudos());
  const [highlightPatientId, setHighlightPatientId] = useState<string>();
  const [openAgendaModal, setOpenAgendaModal] = useState(false);
  const [openPacienteModal, setOpenPacienteModal] = useState(false);

  // Página inicial baseada no perfil do usuário
  const getDefaultPage = (): PageType => 'dashboard';
  const [page, setPage] = useState<PageType>(getDefaultPage());

  const refresh = () => {
    setPacientes(store.getPacientes());
    setAgendamentos(store.getAgendamentos());
    setLaudos(store.getLaudos());
  };

  // Pacientes CRUD
  const addPaciente = useCallback((p: Omit<Paciente, 'id'>) => { store.addPaciente(p); refresh(); }, []);
  const updatePaciente = useCallback((p: Paciente) => { store.updatePaciente(p); refresh(); }, []);
  const deletePaciente = useCallback((id: string) => { store.deletePaciente(id); refresh(); }, []);

  // Agendamentos CRUD
  const addAgendamento = useCallback((a: Omit<Agendamento, 'id'>) => { store.addAgendamento(a); refresh(); }, []);
  const updateAgendamento = useCallback((a: Agendamento) => { store.updateAgendamento(a); refresh(); }, []);
  const deleteAgendamento = useCallback((id: string) => { store.deleteAgendamento(id); refresh(); }, []);

  // Laudos CRUD
  const addLaudo = useCallback((l: Omit<Laudo, 'id'>) => { store.addLaudo(l); refresh(); }, []);
  const updateLaudo = useCallback((l: Laudo) => { store.updateLaudo(l); refresh(); }, []);
  const deleteLaudo = useCallback((id: string) => { store.deleteLaudo(id); refresh(); }, []);

  const capacidade = Math.min(100, Math.round((pacientes.length / 300) * 100));

  // Busca com navegação para paciente
  const handleSearchNavigate = (id: string) => {
    if (user && ROLE_PAGES[user.role].includes('pacientes')) {
      setHighlightPatientId(id);
      setPage('pacientes');
      setTimeout(() => setHighlightPatientId(undefined), 3000);
    }
  };

  // Ações rápidas do dashboard
  const handleNovoAgendamento = () => {
    setOpenAgendaModal(true);
    setPage('agenda');
  };
  const handleNovoPaciente = () => {
    setOpenPacienteModal(true);
    setPage('pacientes');
  };

  // Garante que a página está acessível para o perfil
  const handleNavigate = (p: PageType) => {
    if (!user) return;
    if (ROLE_PAGES[user.role].includes(p)) {
      setPage(p);
      setOpenAgendaModal(false);
      setOpenPacienteModal(false);
    }
  };

  // Tela de loading durante verificação de sessão
  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, border: '4px solid var(--mint)', borderTop: '4px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 14, color: 'var(--gray-500)', fontWeight: 600 }}>Carregando...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Redireciona para login se não autenticado
  if (!user) return <Login />;

  // Garante que a página atual é permitida para o perfil
  const allowedPages = ROLE_PAGES[user.role];
  const currentPage = allowedPages.includes(page) ? page : allowedPages[0];

  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100dvh', overflow: 'hidden' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        capacidade={capacidade}
      />
      <div style={{ flex: 1, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          currentPage={currentPage}
          pacientes={pacientes}
          onSearchNavigate={handleSearchNavigate}
        />
        <main style={{ flex: 1, minWidth: 0, width: '100%', overflow: 'hidden', display: 'flex', position: 'relative' }}>
          {currentPage === 'dashboard' && (
            <Dashboard
              pacientes={pacientes}
              agendamentos={agendamentos}
              laudos={laudos}
              onNavigate={setPage}
              onNovoAgendamento={handleNovoAgendamento}
              onNovoPaciente={handleNovoPaciente}
            />
          )}

          {currentPage === 'pacientes' && allowedPages.includes('pacientes') && (
            <Pacientes
              pacientes={pacientes}
              onAdd={addPaciente}
              onUpdate={updatePaciente}
              onDelete={deletePaciente}
              highlightId={highlightPatientId}
              initialOpen={openPacienteModal}
              // Secretaria tem acesso limitado (sem prontuário completo)
              readOnly={user.role === 'secretaria'}
            />
          )}

          {currentPage === 'agenda' && allowedPages.includes('agenda') && (
            <Agenda
              agendamentos={agendamentos}
              pacientes={pacientes}
              onAdd={addAgendamento}
              onUpdate={updateAgendamento}
              onDelete={deleteAgendamento}
              initialOpen={openAgendaModal}
            />
          )}

          {currentPage === 'laudos' && allowedPages.includes('laudos') && (
            <Laudos
              laudos={laudos}
              pacientes={pacientes}
              onAdd={addLaudo}
              onUpdate={updateLaudo}
              onDelete={deleteLaudo}
            />
          )}

          {currentPage === 'comunicacao' && allowedPages.includes('comunicacao') && (
            <Comunicacao pacientes={pacientes} />
          )}

          {currentPage === 'relatorios' && allowedPages.includes('relatorios') && (
            <Relatorios
              pacientes={pacientes}
              agendamentos={agendamentos}
              laudos={laudos}
            />
          )}

          {currentPage === 'usuarios' && allowedPages.includes('usuarios') && (
            <Usuarios />
          )}

          {currentPage === 'metricas' && allowedPages.includes('metricas') && (
            <Metricas
              pacientes={pacientes}
              agendamentos={agendamentos}
              laudos={laudos}
            />
          )}

          {currentPage === 'configuracoes' && allowedPages.includes('configuracoes') && (
            <Configuracoes />
          )}
        </main>
      </div>
    </div>
  );
}