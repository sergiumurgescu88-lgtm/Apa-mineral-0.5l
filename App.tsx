
import React, { useState } from 'react';
import ChatInterface from './components/ChatInterface';
import MapView from './components/MapView';
import SimulationStatusPanel from './components/SimulationStatus';
import PVsystPanel from './components/PVsystPanel';
import ToolsPanel from './components/ToolsPanel';
import { ToolCallLog, Language } from './types';
import { t } from './translations';
import { DEFAULT_MODEL_ID, GEMINI_FLASH_MODEL_ID, GEMINI_PRO_MODEL_ID } from './constants';

export default function App() {
  const [activeToolLog, setActiveToolLog] = useState<ToolCallLog | null>(null);
  const [activeJobIds, setActiveJobIds] = useState<string[]>([]);
  const [logs, setLogs] = useState<ToolCallLog[]>([]);
  const [viewMode, setViewMode] = useState<'map' | 'pvsyst' | 'tools'>('map');
  const [lang, setLang] = useState<Language>('ro'); // Default to Romanian
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL_ID);

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
    <div className="flex h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">H</div>
            <h1 className="font-semibold tracking-tight text-white">...say hello to Helios :)</h1>
          </div>
          <div className="flex gap-4 items-center">
             
             <div className="flex items-center bg-slate-900 rounded border border-slate-700 overflow-hidden mr-2">
                <button 
                    onClick={() => setActiveModel(GEMINI_FLASH_MODEL_ID)}
                    className={`px-3 py-1 text-xs font-bold ${activeModel === GEMINI_FLASH_MODEL_ID ? 'bg-emerald-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Faster, higher rate limits (Best for Free Tier)"
                >
                    FLASH
                </button>
                <button 
                    onClick={() => setActiveModel(GEMINI_PRO_MODEL_ID)}
                    className={`px-3 py-1 text-xs font-bold ${activeModel === GEMINI_PRO_MODEL_ID ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                    title="Smarter, but lower rate limits"
                >
                    PRO
                </button>
             </div>

             <button 
                onClick={() => setViewMode('map')}
                className={`text-xs font-mono px-3 py-1 rounded transition-colors ${viewMode === 'map' ? 'bg-primary-600 text-white' : 'text-slate-500 hover:text-white'}`}
             >
                {t(lang, 'app', 'geoBtn')}
             </button>
             <button 
                onClick={() => setViewMode('pvsyst')}
                className={`text-xs font-mono px-3 py-1 rounded transition-colors ${viewMode === 'pvsyst' ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:text-white'}`}
             >
                {t(lang, 'app', 'pvsystBtn')}
             </button>
             <button 
                onClick={() => setViewMode('tools')}
                className={`text-xs font-mono px-3 py-1 rounded transition-colors ${viewMode === 'tools' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}
             >
                {t(lang, 'app', 'toolsBtn')}
             </button>

             <div className="ml-4 flex items-center bg-slate-900 rounded border border-slate-700 overflow-hidden">
                <button 
                    onClick={() => setLang('ro')}
                    className={`px-3 py-1 text-xs font-bold ${lang === 'ro' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    RO
                </button>
                <button 
                    onClick={() => setLang('en')}
                    className={`px-3 py-1 text-xs font-bold ${lang === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    EN
                </button>
             </div>
          </div>
        </header>

        <div className="flex-1 grid grid-rows-2 p-6 gap-6 overflow-hidden">
            
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden relative shadow-2xl">
                {viewMode === 'map' ? (
                   <>
                    <div className="absolute top-0 left-0 p-2 z-10 bg-slate-950/80 rounded-br-lg border-b border-r border-slate-800">
                        <span className="text-xs font-mono text-accent-500 uppercase">{t(lang, 'app', 'geoBtn')}</span>
                    </div>
                    <MapView activeToolLog={activeToolLog} lang={lang} />
                   </>
                ) : viewMode === 'pvsyst' ? (
                    <div className="h-full w-full p-4">
                        <h2 className="text-sm font-mono text-emerald-500 uppercase mb-4">{t(lang, 'pvsyst', 'title')}</h2>
                        <PVsystPanel lang={lang} />
                    </div>
                ) : (
                    <div className="h-full w-full p-6">
                        <ToolsPanel lang={lang} />
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-6 min-h-0">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col overflow-hidden">
                     <h3 className="text-xs font-mono text-primary-400 uppercase mb-4 flex justify-between">
                        <span>{t(lang, 'app', 'jobQueue')}</span>
                        <span>{activeJobIds.length} {t(lang, 'app', 'active')}</span>
                     </h3>
                     <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                        <SimulationStatusPanel jobs={activeJobIds} lang={lang} />
                     </div>
                </div>

                <div className="bg-slate-900 rounded-xl border border-slate-800 p-4 flex flex-col overflow-hidden">
                    <h3 className="text-xs font-mono text-slate-400 uppercase mb-4">{t(lang, 'app', 'eventsTitle')}</h3>
                    <div className="flex-1 overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar">
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

      <div className="w-[450px] shadow-2xl z-20">
        <ChatInterface onToolActivity={handleToolActivity} lang={lang} activeModel={activeModel} />
      </div>

    </div>
  );
}
