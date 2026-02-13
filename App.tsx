
import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import MapView from './components/MapView';
import SimulationStatusPanel from './components/SimulationStatus';
import PVsystPanel from './components/PVsystPanel';
import ToolsPanel from './components/ToolsPanel';
import { ToolCallLog, Language } from './types';
import { t } from './translations';
import { DEFAULT_MODEL_ID, GEMINI_FLASH_MODEL_ID, GEMINI_PRO_MODEL_ID } from './constants';

// --- Mobile Navigation Icons ---
const Icons = {
  Dashboard: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  Chat: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Status: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
};

export default function App() {
  const [activeToolLog, setActiveToolLog] = useState<ToolCallLog | null>(null);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<ToolCallLog[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'pvsyst' | 'tools'>('map');
  const [lang, setLang] = useState<Language>('ro'); // Default to Romanian
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL_ID);
  
  // Mobile Tab State
  const [mobileTab, setMobileTab] = useState<'dashboard' | 'chat' | 'status'>('chat');

  const handleToolActivity = (log: ToolCallLog) => {
    setActiveToolLog(log);
    setLogs(prev => [log, ...prev]);

    if (log.toolName === 'runSimulation' && log.result && !log.result.error) {
        if (log.result.jobId) {
            setActiveJobIds(prev => [...prev, log.result.jobId]);
        }
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans flex-col md:flex-row">
      
      {/* --- LEFT SIDE: DASHBOARD & STATUS (Desktop: Always Visible | Mobile: Conditional) --- */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden ${mobileTab === 'chat' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Responsive Header */}
        <header className="h-14 md:h-16 border-b border-slate-800 flex items-center justify-between px-3 md:px-6 bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">H</div>
            <div className="flex flex-col">
              <h1 className="font-semibold tracking-tight text-white leading-tight">Smart Helios</h1>
              <span className="text-[10px] text-slate-500 hidden md:block">AI Digital Twin & Asset Manager</span>
            </div>
          </div>

          <div className="flex gap-2 md:gap-4 items-center overflow-x-auto no-scrollbar pl-2 mask-linear">
             {/* Model Selector */}
             <div className="flex items-center bg-slate-900 rounded border border-slate-700 overflow-hidden flex-shrink-0">
                <button 
                    onClick={() => setActiveModel(GEMINI_FLASH_MODEL_ID)}
                    className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold ${activeModel === GEMINI_FLASH_MODEL_ID ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    FLASH
                </button>
                <button 
                    onClick={() => setActiveModel(GEMINI_PRO_MODEL_ID)}
                    className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold ${activeModel === GEMINI_PRO_MODEL_ID ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    PRO
                </button>
             </div>

             {/* Dashboard View Toggles - Visible on Desktop OR Mobile Dashboard Tab */}
             <div className={`flex gap-1 md:gap-2 ${(mobileTab !== 'dashboard' && 'hidden md:flex')}`}>
                 <button onClick={() => setViewMode('map')} className={`text-[10px] md:text-xs font-mono px-2 md:px-3 py-1 rounded transition-colors ${viewMode === 'map' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                    {t(lang, 'app', 'geoBtn')}
                 </button>
                 <button onClick={() => setViewMode('pvsyst')} className={`text-[10px] md:text-xs font-mono px-2 md:px-3 py-1 rounded transition-colors ${viewMode === 'pvsyst' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                    {t(lang, 'app', 'pvsystBtn')}
                 </button>
                 <button onClick={() => setViewMode('tools')} className={`text-[10px] md:text-xs font-mono px-2 md:px-3 py-1 rounded transition-colors ${viewMode === 'tools' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>
                    {t(lang, 'app', 'toolsBtn')}
                 </button>
             </div>

             {/* Language */}
             <div className="flex items-center bg-slate-900 rounded border border-slate-700 overflow-hidden flex-shrink-0">
                <button onClick={() => setLang('ro')} className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold ${lang === 'ro' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>RO</button>
                <button onClick={() => setLang('en')} className={`px-2 md:px-3 py-1 text-[10px] md:text-xs font-bold ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>EN</button>
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col md:grid md:grid-rows-2 p-2 md:p-6 gap-2 md:gap-6 overflow-hidden relative">
            
            {/* UPPER PANEL: Dashboard Content (Map/PVsyst/Tools) */}
            {/* Mobile: Shown only if mobileTab is 'dashboard'. Desktop: Always shown (row 1) */}
            <div className={`bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl flex-1 md:flex-auto ${mobileTab === 'status' ? 'hidden md:block' : 'block'}`}>
                {viewMode === 'map' ? (
                   <>
                    <div className="absolute top-0 left-0 p-2 z-10 bg-slate-950/80 rounded-br-lg border-b border-r border-slate-800 pointer-events-none">
                        <span className="text-[10px] font-mono text-accent-500 uppercase">{t(lang, 'app', 'geoBtn')}</span>
                    </div>
                    <MapView activeToolLog={activeToolLog} lang={lang} />
                   </>
                ) : viewMode === 'pvsyst' ? (
                    <div className="h-full w-full p-2 md:p-4">
                        <h2 className="text-xs md:text-sm font-mono text-emerald-500 uppercase mb-2 md:mb-4">{t(lang, 'pvsyst', 'title')}</h2>
                        <PVsystPanel lang={lang} />
                    </div>
                ) : (
                    <div className="h-full w-full p-2 md:p-6">
                        <ToolsPanel lang={lang} />
                    </div>
                )}
            </div>

            {/* LOWER PANEL: Status & Logs */}
            {/* Mobile: Shown only if mobileTab is 'status'. Desktop: Always shown (row 2) */}
            <div className={`flex-1 md:min-h-0 grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-6 ${mobileTab === 'status' ? 'flex flex-col h-full' : 'hidden md:grid'}`}>
                {/* Job Queue */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 md:p-4 flex flex-col overflow-hidden h-full">
                     <h3 className="text-xs font-mono text-primary-400 uppercase mb-2 md:mb-4 flex justify-between">
                        <span>{t(lang, 'app', 'jobQueue')}</span>
                        <span>{activeJobIds.length} {t(lang, 'app', 'active')}</span>
                     </h3>
                     <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <SimulationStatusPanel jobs={activeJobIds} lang={lang} />
                     </div>
                </div>

                {/* Event Logs */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-3 md:p-4 flex flex-col overflow-hidden h-full">
                    <h3 className="text-xs font-mono text-slate-400 uppercase mb-2 md:mb-4">{t(lang, 'app', 'eventsTitle')}</h3>
                    <div className="flex-1 overflow-y-auto font-mono text-[10px] md:text-xs space-y-3 custom-scrollbar">
                        {logs.map((log, i) => (
                            <div key={i} className="border-l-2 border-slate-700 pl-3 py-1">
                                <div className="flex justify-between text-slate-500 mb-1">
                                    <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    <span className="text-primary-400">{log.toolName}</span>
                                </div>
                                <div className="text-slate-300 truncate opacity-80">
                                    Args: {JSON.stringify(log.args)}
                                </div>
                                <div className="text-emerald-500/80 mt-1 truncate">
                                    {log.result ? 'Success' : 'Pending...'}
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <div className="text-slate-600 italic">{t(lang, 'app', 'noEvents')}</div>}
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- RIGHT SIDE: CHAT INTERFACE --- */}
      {/* Mobile: Full Screen if mobileTab is 'chat'. Desktop: Fixed width sidebar */}
      <div className={`w-full md:w-[450px] shadow-2xl z-20 bg-slate-900 border-l border-slate-800 flex flex-col ${mobileTab === 'chat' ? 'flex-1' : 'hidden md:flex'}`}>
        <ChatInterface onToolActivity={handleToolActivity} lang={lang} activeModel={activeModel} />
      </div>

      {/* --- MOBILE BOTTOM NAVIGATION --- */}
      <div className="md:hidden h-16 bg-slate-950 border-t border-slate-800 flex items-center justify-around px-2 z-30 shrink-0 pb-safe">
          <button onClick={() => setMobileTab('dashboard')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileTab === 'dashboard' ? 'text-primary-400' : 'text-slate-500'}`}>
              <Icons.Dashboard />
              <span className="text-[10px] font-medium">Dashboard</span>
          </button>
          <button onClick={() => setMobileTab('chat')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileTab === 'chat' ? 'text-primary-400' : 'text-slate-500'}`}>
              <Icons.Chat />
              <span className="text-[10px] font-medium">Helios AI</span>
          </button>
          <button onClick={() => setMobileTab('status')} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${mobileTab === 'status' ? 'text-primary-400' : 'text-slate-500'}`}>
              <Icons.Status />
              <span className="text-[10px] font-medium">Logs</span>
          </button>
      </div>

    </div>
  );
}
