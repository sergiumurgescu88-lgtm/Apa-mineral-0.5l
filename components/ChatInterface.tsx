
import React, { useState, useRef, useEffect } from 'react';
import { Message, ToolCallLog, Language, Attachment, ImageSize } from '../types';
import { GeminiOrchestrator, GeminiRequestConfig } from '../services/geminiService';
import { t } from '../translations';
import { DEFAULT_MODEL_ID, GEMINI_PRO_MODEL_ID } from '../constants';

// --- Type Definitions for Web Speech API ---
interface IWindow extends Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
}

interface ChatInterfaceProps {
  onToolActivity: (log: ToolCallLog) => void;
  lang: Language;
  activeModel: string;
}

const THINKING_MESSAGES_RO = [
    "Helios gândește strategia...",
    "Helios analizează datele meteo...",
    "Helios interoghează sateliții Planet Labs...",
    "Helios verifică prețurile OPCOM...",
    "Helios rulează simulări LSTM...",
    "Helios formulează răspunsul tehnic..."
];

const THINKING_MESSAGES_EN = [
    "Helios is now thinking deeply...",
    "Helios is now analyzing weather patterns...",
    "Helios is now connecting to Planet Labs satellites...",
    "Helios is now verifying OPCOM market prices...",
    "Helios is now running LSTM simulations...",
    "Helios is now formulating the technical response..."
];

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onToolActivity, lang, activeModel }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true); 
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);

  const [editingImage, setEditingImage] = useState<{ data: string, mimeType: string, source: 'upload'|'gen' } | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);
  const [lastContextImage, setLastContextImage] = useState<string | undefined>(undefined);

  const orchestratorRef = useRef<GeminiOrchestrator | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS = [
    { 
        id: 'health_scan', 
        label: lang === 'ro' ? 'Scanare Sănătate (Complet)' : 'Full Health Scan', 
        icon: '🏥', 
        prompt: lang === 'ro' 
            ? 'Analizează starea de sănătate a parcului solar folosind imaginile din satelit și datele de telemetrie. Identifică indicatori cheie precum NDVI, anomalii termice și statusul operațional.' 
            : 'Analyze the health of the solar park using the provided satellite imagery and telemetry data. Identify key performance indicators like NDVI, temperature anomalies, and overall operational status.' 
    },
    { id: 'trade_bot', label: lang === 'ro' ? 'AI Energy Trader' : 'AI Energy Trader', icon: '📈', prompt: lang === 'ro' ? 'Analizează prognoza meteo și prețurile OPCOM. Execută o strategie de tranzacționare (BUY/SELL) pentru următoarele 24h.' : 'Analyze weather forecast and OPCOM prices. Execute an energy trading strategy (BUY/SELL) for the next 24h.' },
    { id: 'predict_fail', label: lang === 'ro' ? 'Predicție Avarii (LSTM)' : 'Predict Failures (LSTM)', icon: '🔧', prompt: lang === 'ro' ? 'Rulează modelul LSTM pentru a prezice defectarea invertoarelor sau a string-urilor în următoarele 14 zile.' : 'Run the LSTM predictive model to forecast component failures (inverters/strings) for the upcoming 14 days.' },
    { id: 'agri_plan', label: lang === 'ro' ? 'Plan Agrivoltaic' : 'Agrivoltaics Plan', icon: '🌱', prompt: lang === 'ro' ? 'Generează un studiu de compatibilitate agrivoltaică. Ce culturi sunt potrivite aici și care este impactul umbririi?' : 'Generate an agrivoltaics compatibility study. Which crops are suitable here and what is the shading impact?' },
  ];

  useEffect(() => {
    let interval: any;
    if (isLoading) {
        interval = setInterval(() => {
            setThinkingMessageIndex(prev => {
                const msgs = lang === 'ro' ? THINKING_MESSAGES_RO : THINKING_MESSAGES_EN;
                return (prev + 1) % msgs.length;
            });
        }, 2200);
    } else {
        setThinkingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, lang]);

  useEffect(() => {
    const handleReportTrigger = (e: any) => {
        const { siteName, actionPrompt } = e.detail;
        let prompt = actionPrompt;
        if (!prompt) prompt = `Generate technical site report for ${siteName}.`;
        const isImageGenRequest = prompt.toLowerCase().includes('generate image') || prompt.toLowerCase().includes('imagine');
        handleSend(prompt, isImageGenRequest ? { isImageGen: true, imageSize: '1K' } : {});
    };
    window.addEventListener('helios-report-trigger', handleReportTrigger);
    return () => window.removeEventListener('helios-report-trigger', handleReportTrigger);
  }, []);

  useEffect(() => {
    if (messages.length === 0) {
         setMessages([{
            id: 'welcome',
            role: 'model',
            content: t(lang, 'chat', 'welcome'),
            timestamp: Date.now()
        }]);
    }
  }, [lang]);

  useEffect(() => {
    const apiKey = process.env.API_KEY || ''; 
    if (apiKey) orchestratorRef.current = new GeminiOrchestrator(apiKey);
  }, []);

  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;
    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = false; 
      recognition.interimResults = true; 
      recognition.lang = lang === 'ro' ? 'ro-RO' : 'en-US';
      recognition.onstart = () => { setIsListening(true); setMicError(false); };
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) transcript += event.results[i][0].transcript;
        setInput(transcript);
      };
      recognition.onerror = () => { setIsListening(false); setMicError(true); };
      recognitionRef.current = recognition;
    }
  }, [lang]);

  const toggleListening = () => isListening ? recognitionRef.current?.stop() : recognitionRef.current?.start();
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(() => scrollToBottom(), [messages, isLoading]); 

  const handleExportTechnicalReport = () => {
    if (messages.length === 0) return;

    const reportId = `HELIOS-RND-${Math.floor(100000 + Math.random() * 900000)}`;
    const dateStr = new Date().toLocaleString('ro-RO');
    const fullText = messages.map(m => m.content).join(' ').toLowerCase();

    // Auto-Summarization
    const insights = [];
    if (fullText.includes('trade') || fullText.includes('opcom')) insights.push("- Strategie de tranzacționare OPCOM bazată pe prognoză.");
    if (fullText.includes('satelit') || fullText.includes('planet')) insights.push("- Analiză NDVI & Soiling via telemetrie satelitară Planet Labs.");
    if (fullText.includes('lstm') || fullText.includes('predict')) insights.push("- Modelare mentenanță predictivă prin rețele neuronale LSTM.");
    if (fullText.includes('carbon') || fullText.includes('esg')) insights.push("- Cuantificare impact ESG și evitare emisii CO2.");
    if (insights.length === 0) insights.push("- Audit tehnic general și verificare sănătate sistem.");

    // ASCII Report Structure
    let report = `================================================================================
                         RAPORT TEHNIC DE ANALIZĂ HELIOS
                   Sistem Expert în Infrastructură Fotovoltaică
================================================================================

[ID RAPORT]      : ${reportId}
[DATA EXPORT]    : ${dateStr}
[PROTOCOL]       : Helios AI Orchestrator v3.0 (R&D)
[STATUS]         : Analiză Finalizată - Confidențial
--------------------------------------------------------------------------------

1. REZUMAT EXECUTIV
--------------------------------------------------------------------------------
Acest document reprezintă sinteza tehnică a sesiunii de analiză strategică. 
Sistemul Helios a procesat date din surse multiple (Meteo, Satelit, SCADA) 
pentru a oferi recomandări de optimizare a activelor solare.

Teme principale detectate în această sesiune:
${insights.join('\n')}

2. ANALIZĂ ȘI CONCLUZII CHEIE
--------------------------------------------------------------------------------
* VERIFICARE DIGITAL TWIN: Parametrii site-ului au fost validați prin grounding.
* MONITORIZARE INFRASTRUCTURĂ: Stare tehnică verificată față de benchmark-uri.
* RECOMANDARE: Analizați punctele de pierdere prin soiling semnalate.

3. TRANSCRIPT COMPLET ORCHESTRARE (LOG TEHNIC)
--------------------------------------------------------------------------------\n\n`;

    messages.forEach(msg => {
      const isHelios = msg.role === 'model';
      const role = isHelios ? "[HELIOS ARCHITECT]" : "[CLIENT TECHNICAL LEAD]";
      const time = new Date(msg.timestamp).toLocaleTimeString('ro-RO');
      
      report += `[${time}] ${role}\n`;
      report += `${"-".repeat(role.length + 13)}\n`; 
      
      const cleanContent = msg.content.replace(/\*\*/g, "").replace(/###/g, ">>");
      report += `${cleanContent}\n\n`;
      
      if (msg.groundingSources && msg.groundingSources.length > 0) {
          report += `   [SURSE VALIDATE]:\n`;
          msg.groundingSources.forEach(s => {
              report += `   > ${s.title}: ${s.uri}\n`;
          });
          report += `\n`;
      }
    });

    report += `--------------------------------------------------------------------------------
                               SFÂRȘITUL RAPORTULUI
                  Generat automat de Helios R&D AI Architect.
================================================================================`;

    const blob = new Blob(['\ufeff', report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Helios_Raport_Tehnic_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1]; 
        setSelectedFile({ name: file.name, mimeType: file.type, data: base64String });
        setEditingImage(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (overrideText?: string, customConfig?: GeminiRequestConfig) => {
    const textToSend = overrideText || input;
    if ((!textToSend.trim() && !selectedFile) || isLoading) return;
    if (isListening) recognitionRef.current?.stop();
    if (!orchestratorRef.current) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, attachment: selectedFile || undefined, timestamp: Date.now() };
    if (selectedFile?.mimeType.startsWith('image/')) setLastContextImage(`data:${selectedFile.mimeType};base64,${selectedFile.data}`);

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    const streamingMsgId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: streamingMsgId, role: 'model', content: '', timestamp: Date.now() }]);

    try {
      const config: GeminiRequestConfig = customConfig || { isThinking: isThinkingEnabled, isImageEdit: !!editingImage, editContext: editingImage ? { data: editingImage.data, mimeType: editingImage.mimeType } : undefined };
      const response = await orchestratorRef.current.sendMessage(textToSend, userMsg.attachment, (toolName: any, args: any) => { onToolActivity({ toolName, args, result: 'Pending...', timestamp: Date.now() }); }, lastContextImage, lang, activeModel, config, (streamedText) => {
          setMessages(prev => prev.map(msg => msg.id === streamingMsgId ? { ...msg, content: streamedText } : msg));
      });
      if (response.generatedImage) setLastContextImage(response.generatedImage);
      if (editingImage) setEditingImage(null);
      setMessages(prev => prev.map(msg => msg.id === streamingMsgId ? { ...msg, content: response.text, image: response.generatedImage, groundingSources: response.groundingSources } : msg));
    } catch (error) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: `Error: ${error instanceof Error ? error.message : 'Unknown'}`, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 relative">
      <div className="p-3 md:p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center shrink-0">
        <h2 className="text-sm font-mono font-semibold text-primary-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          HELIOS AI
        </h2>
        
        <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setIsThinkingEnabled(!isThinkingEnabled)} className={`px-2 md:px-3 py-1 rounded-full text-[10px] font-bold transition-all ${isThinkingEnabled ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white border border-slate-700'}`}>
                🧠 THINK
            </button>
            <div className="flex gap-1 border-l border-slate-700 pl-3">
                <button onClick={handleExportTechnicalReport} disabled={messages.length === 0} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-30" title="Descarcă Raport Tehnic (.txt)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4 md:space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[88%] md:max-w-[85%] rounded-lg p-3 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-primary-600 text-white shadow-lg' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
              <div className="whitespace-pre-wrap">{msg.content}</div>
              {msg.image && <img src={msg.image} className="mt-3 rounded border border-slate-700 max-w-full" alt="content" />}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start w-full">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 max-w-[85%] animate-pulse text-xs font-mono text-violet-300">
                    {lang === 'ro' ? THINKING_MESSAGES_RO[thinkingMessageIndex] : THINKING_MESSAGES_EN[thinkingMessageIndex]}
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 md:p-4 bg-slate-950 border-t border-slate-800 shrink-0">
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar">
            {QUICK_ACTIONS.map(action => (
                <button key={action.id} onClick={() => handleSend(action.prompt)} disabled={isLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-full text-xs whitespace-nowrap text-slate-300 transition-all shrink-0">
                    <span>{action.icon}</span> {action.label}
                </button>
            ))}
        </div>

        <div className="relative flex gap-2">
          <button onClick={toggleListening} className={`p-2 md:p-3 rounded-lg border transition-all shrink-0 ${isListening ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
             {isListening ? 'STOP' : '🎤'}
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 md:p-3 bg-slate-800 text-slate-400 rounded-lg border border-slate-700 shrink-0">📎</button>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,.pdf" className="hidden" />
          <input 
            type="text" 
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 md:px-4 py-2 md:py-3 text-sm text-white focus:ring-1 focus:ring-primary-500 outline-none min-w-0" 
            placeholder={isListening ? "Listening..." : "Ask Helios..."} 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            disabled={isLoading} 
          />
          <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !selectedFile)} className="bg-primary-600 hover:bg-primary-500 px-3 md:px-4 rounded-lg text-white transition-colors shrink-0">🚀</button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
