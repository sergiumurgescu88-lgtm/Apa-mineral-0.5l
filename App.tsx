
import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import MapView from './components/MapView';
import SimulationStatusPanel from './components/SimulationStatus';
import PVsystPanel from './components/PVsystPanel';
import ToolsPanel from './components/ToolsPanel';
import ProfilePanel from './components/ProfilePanel';
import AdminDashboard from './components/AdminDashboard';
import AuthModal from './components/AuthModal';
import { ToolCallLog, Language, User, Message } from './types';
import { t } from './translations';
import { DEFAULT_MODEL_ID } from './constants';

const Icons = {
  Dashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Chat: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Status: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeToolLog, setActiveToolLog] = useState<ToolCallLog | null>(null);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<ToolCallLog[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'pvsyst' | 'tools' | 'profile' | 'admin'>('map');
  const [lang, setLang] = useState<Language>('ro');
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL_ID);
  
  const [mobileView, setMobileView] = useState<'chat' | 'dashboard' | 'command'>('chat');
  const [globalChatHistory, setGlobalChatHistory] = useState<Message[]>([]);

  useEffect(() => {
    const savedUser = localStorage.getItem('helios_session_user');
    if (savedUser) {
        try {
            const parsedUser = JSON.parse(savedUser);
            setUser(parsedUser);
            if (parsedUser.role === 'admin') setViewMode('admin');
        } catch (e) {
            localStorage.removeItem('helios_session_user');
        }
    }
  }, []);

  const handleLogin = (u: User) => {
      setUser(u);
      localStorage.setItem('helios_session_user', JSON.stringify(u));
      if (u.role === 'admin') setViewMode('admin');
  };

  const handleLogout = () => {
    if (confirm(lang === 'ro' ? 'Ești sigur că vrei să te deconectezi?' : 'Are you sure you want to log out?')) {
      setUser(null);
      setLogs([]);
      setGlobalChatHistory([]);
      setViewMode('map');
      localStorage.removeItem('helios_session_user');
    }
  };

  const handleToolActivity = (log: ToolCallLog) => {
    setActiveToolLog(log);
    setLogs(prev => [log, ...prev]);
  };

  const handleMobileNav = (view: 'chat' | 'dashboard' | 'command') => {
    setMobileView(view);
    if (view === 'dashboard') {
        setViewMode('map');
    } else if (view === 'command') {
        setViewMode('tools');
    }
  };

  if (!user) {
    return <AuthModal onLogin={handleLogin} lang={lang} />;
  }

  const DashboardContent = () => (
    <div className="flex flex-col h-full bg-slate-950 md:rounded-3xl overflow-hidden md:border border-slate-800 shadow-2xl">
        <header className="h-14 md:h-16 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/90 backdrop-blur-md flex-shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">H</div>
            <div className="flex flex-col">
              <h1 className="font-bold tracking-tight text-white text-sm md:text-lg leading-tight">Command Center</h1>
              <span className="text-[9px] text-slate-500 font-mono uppercase tracking-widest hidden md:block">{user.role === 'admin' ? 'System Administrator' : 'R&D Interface'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
             <nav className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
              {user.role === 'admin' && (
                  <button onClick={() => setViewMode('admin')} className={`px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${viewMode === 'admin' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'}`}>ADMIN</button>
              )}
              {[
                { id: 'map', label: 'MAP', color: 'bg-primary-500' },
                { id: 'pvsyst', label: 'CLI', color: 'bg-emerald-500' },
                { id: 'tools', label: 'TOOLS', color: 'bg-indigo-500' }
              ].map(btn => (
                <button key={btn.id} onClick={() => setViewMode(btn.id as any)} className={`px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-all ${viewMode === btn.id ? `${btn.color} text-white shadow-lg` : 'text-slate-500 hover:text-slate-300'}`}>
                  {btn.label}
                </button>
              ))}
            </nav>
            <button onClick={() => setViewMode('profile')} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700">
               <img src={user.avatar} className="w-5 h-5 rounded" alt="User" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col p-2 md:p-6 gap-4 md:gap-6 overflow-hidden bg-slate-950 relative">
             <div className="flex-1 overflow-hidden relative rounded-2xl border border-slate-800 shadow-xl bg-slate-900">
                {viewMode === 'admin' ? (
                    <AdminDashboard />
                ) : viewMode === 'map' ? (
                  <MapView activeToolLog={activeToolLog} lang={lang} />
                ) : viewMode === 'pvsyst' ? (
                  <div className="h-full w-full p-2 md:p-6"><PVsystPanel lang={lang} /></div>
                ) : viewMode === 'tools' ? (
                  <div className="h-full w-full p-2 md:p-6"><ToolsPanel lang={lang} /></div>
                ) : (
                  <ProfilePanel user={user} logs={logs} chatHistory={globalChatHistory} lang={lang} onLogout={handleLogout} />
                )}
             </div>

             {viewMode !== 'admin' && viewMode !== 'profile' && (
                <div className="hidden md:grid h-1/3 min-h-[200px] grid-cols-2 gap-6 animate-in slide-in-from-bottom-5">
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col overflow-hidden">
                        <h3 className="text-[10px] font-mono text-primary-400 uppercase mb-2 flex justify-between">
                            <span>Simulations</span>
                            <span className="bg-primary-500/10 px-1.5 rounded">{activeJobIds.length} Active</span>
                        </h3>
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <SimulationStatusPanel jobs={activeJobIds} lang={lang} />
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-4 flex flex-col overflow-hidden">
                         <h3 className="text-[10px] font-mono text-slate-400 uppercase mb-2">System Logs</h3>
                         <div className="flex-1 overflow-y-auto font-mono text-[9px] space-y-2 custom-scrollbar">
                            {logs.map((log, i) => (
                                <div key={i} className="bg-slate-950/50 p-2 rounded border border-slate-800 flex justify-between items-center">
                                    <div className="flex gap-2 items-center">
                                        <span className="text-slate-600">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-primary-400 font-bold truncate max-w-[120px]">{log.toolName}</span>
                                    </div>
                                    <span className="text-emerald-500 opacity-60">OK</span>
                                </div>
                            ))}
                            {logs.length === 0 && <div className="text-slate-600 italic text-center py-4">System Idle.</div>}
                        </div>
                    </div>
                </div>
             )}
        </main>
    </div>
  );

  return (
    <div className="flex h-screen w-screen bg-black text-slate-200 overflow-hidden font-sans relative">
      
      {/* DESKTOP LAYOUT */}
      <div className="hidden md:flex w-full h-full p-4 gap-4">
        <div className="w-[450px] shrink-0 h-full rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col bg-slate-900">
             <ChatInterface onToolActivity={handleToolActivity} lang={lang} activeModel={activeModel} onHistoryUpdate={setGlobalChatHistory} />
        </div>
        <div className="flex-1 h-full min-w-0">
            <DashboardContent />
        </div>
      </div>

      {/* MOBILE LAYOUT */}
      <div className="md:hidden w-full h-full relative overflow-hidden bg-slate-950">
          
          {/* LAYER 1: CHAT - Always accessible base layer */}
          <div className="absolute inset-0 z-0">
               <ChatInterface onToolActivity={handleToolActivity} lang={lang} activeModel={activeModel} onHistoryUpdate={setGlobalChatHistory} />
          </div>

          {/* LAYER 2: DASHBOARD (SHEET) - COMPLETELY HIDDEN WHEN NOT ACTIVE */}
          <div className={`absolute inset-0 z-10 transition-all duration-500 cubic-bezier(0.32, 0.72, 0, 1) 
            ${mobileView !== 'chat' ? 'translate-y-0 opacity-100 visible' : 'translate-y-[110%] opacity-0 invisible hidden'}`}>
              <div className="h-full w-full bg-slate-950 shadow-2xl overflow-hidden rounded-t-[30px] border-t border-slate-700/50 relative">
                  <div className="w-full flex justify-center pt-3 pb-1 bg-slate-900/50 backdrop-blur absolute top-0 z-50 cursor-pointer" onClick={() => setMobileView('chat')}>
                      <div className="w-12 h-1.5 bg-slate-600/50 rounded-full"></div>
                  </div>
                  <div className="h-full pt-4">
                     <DashboardContent />
                  </div>
              </div>
          </div>

          {/* FLOATING NAVIGATION DOCK */}
          <div className="absolute bottom-6 left-0 right-0 z-50 flex justify-center pointer-events-none">
              <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-full p-1.5 shadow-2xl pointer-events-auto flex items-center gap-1">
                  <button 
                    onClick={() => handleMobileNav('chat')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-full transition-all duration-300 ${mobileView === 'chat' ? 'bg-primary-600 text-white shadow-lg' : 'text-slate-400 hover:text-white px-3'}`}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      {mobileView === 'chat' && <span className="text-xs font-bold animate-in fade-in slide-in-from-left-2 duration-300">Helios</span>}
                  </button>

                  <button 
                    onClick={() => handleMobileNav('dashboard')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-full transition-all duration-300 ${mobileView === 'dashboard' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-white px-3'}`}
                  >
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                       {mobileView === 'dashboard' && <span className="text-xs font-bold animate-in fade-in slide-in-from-bottom-2 duration-300">Dashboard</span>}
                  </button>

                  <button 
                    onClick={() => handleMobileNav('command')}
                    className={`flex items-center gap-2 px-4 py-3 rounded-full transition-all duration-300 ${mobileView === 'command' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white px-3'}`}
                  >
                       <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                       {mobileView === 'command' && <span className="text-xs font-bold animate-in fade-in slide-in-from-right-2 duration-300">Command</span>}
                  </button>
              </div>
          </div>
      </div>
    </div>
  );
}
