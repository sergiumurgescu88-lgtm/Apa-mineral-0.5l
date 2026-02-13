
import React, { useState, useEffect } from 'react';
import { User, ToolCallLog, Message, Language, SavedChat } from '../types';

interface ProfilePanelProps {
  user: User;
  logs: ToolCallLog[];
  chatHistory: Message[];
  lang: Language;
  onLogout: () => void;
}

const ProfilePanel: React.FC<ProfilePanelProps> = ({ user, logs, chatHistory, lang, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'audit' | 'archive' | 'settings'>('overview');
  
  const [savedChats, setSavedChats] = useState<SavedChat[]>(() => {
    const saved = localStorage.getItem(`helios_chats_${user.id}`);
    return saved ? JSON.parse(saved) : [
      { id: '1', title: 'Audit Tehnic Livada 56MW', date: '2023-11-15', preview: 'Analiză NDVI și soiling detectat...', messageCount: 8 },
      { id: '2', title: 'Strategie Trading OPCOM', date: '2023-11-10', preview: 'Plan BUY/SELL pe intervalul 14:00...', messageCount: 14 },
      { id: '3', title: 'Calcul Carbon Prahova', date: '2023-11-05', preview: 'ESG Assessment finalizat pentru site-ul...', messageCount: 5 }
    ];
  });

  useEffect(() => {
    localStorage.setItem(`helios_chats_${user.id}`, JSON.stringify(savedChats));
  }, [savedChats, user.id]);

  const handleSaveCurrentSession = () => {
    if (chatHistory.length < 2) return;
    const firstMsg = chatHistory.find(m => m.role === 'user')?.content.substring(0, 40) || 'Sesiune Nouă';
    const newChat: SavedChat = {
      id: Date.now().toString(),
      title: firstMsg + '...',
      date: new Date().toISOString().split('T')[0],
      preview: chatHistory[chatHistory.length - 1].content.substring(0, 100) + '...',
      messageCount: chatHistory.length
    };
    setSavedChats([newChat, ...savedChats]);
    alert(lang === 'ro' ? 'Sesiunea a fost salvată în baza ta de date!' : 'Session archived to your strategic database!');
  };

  return (
    <div className="bg-slate-900 h-full flex flex-col rounded-3xl border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-500">
      
      {/* --- PROFIL HEADER (LARGE & CLEAR) --- */}
      <div className="p-10 bg-gradient-to-r from-slate-950 to-slate-900 border-b border-slate-800 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex items-center gap-8">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary-500 to-indigo-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
            <img src={user.avatar} alt="Avatar" className="relative w-28 h-28 rounded-3xl border-2 border-slate-800 shadow-2xl object-cover" />
            <div className="absolute -bottom-2 -right-2 bg-emerald-500 w-8 h-8 rounded-full border-4 border-slate-950 flex items-center justify-center shadow-lg">
              <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
            </div>
          </div>
          <div className="text-center md:text-left">
            <div className="flex items-center gap-3 mb-2 justify-center md:justify-start">
                <h2 className="text-3xl font-bold text-white tracking-tight">{user.name}</h2>
                <span className="bg-emerald-500/10 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded border border-emerald-500/20 uppercase">VERIFIED</span>
            </div>
            <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
              <span className="bg-primary-500/10 text-primary-400 text-xs font-bold px-3 py-1 rounded-full border border-primary-500/20 uppercase tracking-widest">{user.role}</span>
              <span className="text-slate-400 text-sm font-medium flex items-center gap-2">
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>
                {user.company || 'Helios R&D Strategic'}
              </span>
              <span className="text-slate-500 text-xs font-mono bg-slate-800/50 px-2 py-1 rounded">SYS_ID: {user.id}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
            <button onClick={onLogout} className="px-8 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-95">
                {lang === 'ro' ? 'DECONECTARE' : 'SIGN OUT'}
            </button>
        </div>
      </div>

      {/* --- NAVIGARE TAB-URI (CLEAN) --- */}
      <div className="flex px-10 bg-slate-950 border-b border-slate-800">
        {[
          { id: 'overview', label: lang === 'ro' ? 'DASHBOARD STRATEGIC' : 'STRATEGIC OVERVIEW' },
          { id: 'audit', label: lang === 'ro' ? 'JURNAL AUDIT' : 'AUDIT TRAIL' },
          { id: 'archive', label: lang === 'ro' ? 'SESIUNI ARHIVATE' : 'ARCHIVED SESSIONS' },
          { id: 'settings', label: lang === 'ro' ? 'SETĂRI SISTEM' : 'SYSTEM SETTINGS' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-5 px-8 text-xs font-bold tracking-widest transition-all border-b-2 relative ${
              activeTab === tab.id 
              ? 'border-primary-500 text-white bg-primary-500/5' 
              : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-400 blur-sm"></div>}
          </button>
        ))}
      </div>

      {/* --- CONȚINUT DINAMIC (FULL HEIGHT SCROLLABLE) --- */}
      <div className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-slate-950/20">
        
        {activeTab === 'overview' && (
          <div className="space-y-10 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {/* Grid Statistici Mari */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl hover:border-primary-500/30 transition-all">
                <p className="text-slate-500 text-xs font-mono uppercase mb-3 tracking-widest">Utilizare AI</p>
                <p className="text-5xl font-bold text-white mb-2">{logs.length}</p>
                <p className="text-[10px] text-slate-600 font-mono">Funcții Gemini Orchestrate apelate</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl hover:border-emerald-500/30 transition-all">
                <p className="text-slate-500 text-xs font-mono uppercase mb-3 tracking-widest">Impact Carbon</p>
                <p className="text-5xl font-bold text-emerald-400 mb-2">1,240</p>
                <p className="text-[10px] text-slate-600 font-mono">Tone CO2 evitate prin optimizare</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl hover:border-indigo-500/30 transition-all">
                <p className="text-slate-500 text-xs font-mono uppercase mb-3 tracking-widest">Arhivă Inteligentă</p>
                <p className="text-5xl font-bold text-indigo-400 mb-2">{savedChats.length}</p>
                <p className="text-[10px] text-slate-600 font-mono">Rapoarte tehnice stocate în profil</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl hover:border-amber-500/30 transition-all">
                <p className="text-slate-500 text-xs font-mono uppercase mb-3 tracking-widest">Securitate</p>
                <p className="text-5xl font-bold text-amber-500 mb-2">98%</p>
                <p className="text-[10px] text-slate-600 font-mono">Score integritate date SCADA</p>
              </div>
            </div>

            {/* Save Current Session CTA (IMPULSIVE DESIGN) */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-primary-600 to-indigo-700 border border-white/10 p-10 rounded-[40px] flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl shadow-primary-500/20">
              <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 bg-white/10 rounded-full blur-[100px] pointer-events-none"></div>
              <div className="relative z-10">
                <h3 className="text-3xl font-bold text-white mb-4">Securizează Sesiunea în Baza de Cunoștințe</h3>
                <p className="text-primary-100 text-lg max-w-2xl opacity-80">
                  Ai {chatHistory.length} interacțiuni în sesiunea curentă. Arhivarea acestora permite modelului Helios să învețe din contextul tău specific și să genereze predicții personalizate pe termen lung.
                </p>
              </div>
              <button 
                onClick={handleSaveCurrentSession}
                disabled={chatHistory.length < 2}
                className="relative z-10 px-10 py-5 bg-white text-primary-700 font-black rounded-2xl transition-all shadow-2xl hover:bg-slate-50 hover:scale-105 disabled:opacity-30 disabled:hover:scale-100 active:scale-95 whitespace-nowrap"
              >
                SALVEAZĂ RAPORTUL ACUM
              </button>
            </div>
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-6 animate-in slide-in-from-left-5 duration-500">
            <div className="flex items-center justify-between mb-8">
                <h3 className="text-white font-bold text-2xl">Audit Trail Complet</h3>
                <span className="text-xs font-mono text-slate-500 bg-slate-900 px-3 py-1 rounded border border-slate-800">ISO 27001 Compliance Log</span>
            </div>
            {logs.length === 0 ? (
              <div className="text-center py-32 bg-slate-950/30 rounded-[40px] border border-dashed border-slate-800 flex flex-col items-center gap-4">
                <svg className="text-slate-700" width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="text-slate-600 font-mono uppercase text-xs tracking-widest">Niciun eveniment detectat în coada de execuție.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {logs.map((log, i) => (
                    <div key={i} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-8 hover:bg-slate-800/50 transition-all group">
                    <div className="text-xs font-mono text-slate-500 w-24 shrink-0 font-bold">{new Date(log.timestamp).toLocaleTimeString()}</div>
                    <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-400 font-black text-xs border border-primary-500/20 group-hover:bg-primary-500 group-hover:text-white transition-all">{i+1}</div>
                    <div className="flex-1">
                        <p className="text-white font-bold text-md uppercase tracking-tight mb-1">{log.toolName}</p>
                        <p className="text-slate-500 text-xs font-mono truncate max-w-xl bg-slate-950/50 p-2 rounded">{JSON.stringify(log.args)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                        <span className="text-emerald-500 text-[10px] font-black font-mono bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">EXECUTED</span>
                        <span className="text-slate-600 text-[9px] font-mono">Latency: 12ms</span>
                    </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'archive' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
            {savedChats.map(chat => (
              <div key={chat.id} className="group bg-slate-900 border border-slate-800 p-8 rounded-3xl hover:border-primary-500/50 hover:bg-slate-800/30 transition-all cursor-pointer flex flex-col h-full shadow-lg">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 group-hover:border-primary-500/30 transition-all">
                    <svg className="text-primary-500" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-slate-600 bg-slate-950 px-2 py-1 rounded uppercase">{chat.date}</span>
                </div>
                <h4 className="text-white font-bold text-xl mb-4 group-hover:text-primary-400 transition-colors line-clamp-1">{chat.title}</h4>
                <p className="text-slate-500 text-sm mb-8 line-clamp-3 leading-relaxed flex-1">{chat.preview}</p>
                <div className="flex items-center justify-between mt-auto pt-6 border-t border-slate-800">
                  <span className="text-xs text-slate-500 font-mono font-bold">💬 {chat.messageCount} MESSAGES</span>
                  <button className="text-primary-500 text-xs font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">RESTORE SESSION →</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
            <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-xl">
                <h3 className="text-white font-bold text-xl mb-8 flex items-center gap-3">
                    <svg className="text-primary-500" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                    Preferințe Interfață AI
                </h3>
                <div className="space-y-8">
                    <div className="flex justify-between items-center group">
                        <div>
                        <p className="text-white text-md font-bold group-hover:text-primary-400 transition-colors">Salvare Automată Sesiuni</p>
                        <p className="text-slate-500 text-xs mt-1">Stochează orice conversație tehnică peste 10 interacțiuni.</p>
                        </div>
                        <div className="w-14 h-7 bg-primary-600 rounded-full relative shadow-inner"><div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg"></div></div>
                    </div>
                    <div className="flex justify-between items-center group opacity-50">
                        <div>
                        <p className="text-white text-md font-bold">Mod Debug SCADA</p>
                        <p className="text-slate-500 text-xs mt-1">Afișează timestamp-uri brute și payloads JSON.</p>
                        </div>
                        <div className="w-14 h-7 bg-slate-800 rounded-full relative"><div className="absolute left-1 top-1 w-5 h-5 bg-slate-600 rounded-full"></div></div>
                    </div>
                    <div className="flex justify-between items-center group">
                        <div>
                        <p className="text-white text-md font-bold group-hover:text-emerald-400 transition-colors">Notificări Anomalii</p>
                        <p className="text-slate-500 text-xs mt-1">Alerte push în browser pentru Health Score sub 70%.</p>
                        </div>
                        <div className="w-14 h-7 bg-emerald-600 rounded-full relative shadow-inner"><div className="absolute right-1 top-1 w-5 h-5 bg-white rounded-full shadow-lg"></div></div>
                    </div>
                </div>
            </div>
            
            <div className="bg-slate-900 p-10 rounded-[40px] border border-slate-800 shadow-xl flex flex-col justify-between">
                <div>
                    <h3 className="text-white font-bold text-xl mb-4">Securitatea Datelor</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">Datele tale sunt criptate end-to-end și stocate local în cache-ul securizat al Helios Strategics. Administratorul sistemului nu are acces la rapoartele tale private de trading.</p>
                </div>
                <div className="space-y-4 pt-8">
                    <button className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-2xl border border-slate-700 transition-all flex items-center justify-center gap-2">
                        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                        SCHIMBĂ PAROLA ADMIN
                    </button>
                    <button className="w-full py-4 bg-red-500/10 text-red-500 font-bold rounded-2xl border border-red-500/20 hover:bg-red-500/20 transition-all">
                        ȘTERGE TOATE DATELE DIN PROFIL
                    </button>
                </div>
            </div>
          </div>
        )}

      </div>
      
      {/* --- FOOTER STATUS BAR --- */}
      <div className="px-10 py-4 bg-slate-950 border-t border-slate-800 flex justify-between items-center">
          <div className="flex gap-6">
              <span className="text-[10px] font-mono text-slate-600 flex items-center gap-2 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
                  Bază de date: SQLite Operational
              </span>
              <span className="text-[10px] font-mono text-slate-600 flex items-center gap-2 uppercase tracking-widest">
                  <span className="w-1.5 h-1.5 bg-primary-500 rounded-full"></span>
                  Google OAuth 2.0: Connected
              </span>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Helios Strategic AI Architecture v3.1.2 - © 2024</span>
      </div>
    </div>
  );
};

export default ProfilePanel;
