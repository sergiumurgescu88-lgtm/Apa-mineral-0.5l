
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
  
  // Advanced Features State
  const [isThinkingEnabled, setIsThinkingEnabled] = useState(true); // Default to true for "Think More" capability
  const [showGenModal, setShowGenModal] = useState(false);
  const [genParams, setGenParams] = useState<{ prompt: string, size: ImageSize }>({ prompt: '', size: '1K' });
  const [thinkingMessageIndex, setThinkingMessageIndex] = useState(0);

  // Image Editing Context
  const [editingImage, setEditingImage] = useState<{ data: string, mimeType: string, source: 'upload'|'gen' } | null>(null);
  
  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState(false);
  const recognitionRef = useRef<any>(null);

  // File upload state
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);
  
  // Track the last uploaded/generated image for context in editing
  const [lastContextImage, setLastContextImage] = useState<string | undefined>(undefined);

  const orchestratorRef = useRef<GeminiOrchestrator | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const QUICK_ACTIONS = [
    { 
      id: 'trade_bot', 
      label: lang === 'ro' ? 'AI Energy Trader' : 'AI Energy Trader', 
      icon: '📈', 
      prompt: lang === 'ro' 
        ? 'Analizează prognoza meteo și prețurile OPCOM. Execută o strategie de tranzacționare (BUY/SELL) pentru următoarele 24h.' 
        : 'Analyze weather forecast and OPCOM prices. Execute an energy trading strategy (BUY/SELL) for the next 24h.' 
    },
    { 
      id: 'predict_fail', 
      label: lang === 'ro' ? 'Predicție Avarii (LSTM)' : 'Predict Failures (LSTM)', 
      icon: '🔧', 
      prompt: lang === 'ro' 
        ? 'Rulează modelul LSTM pentru a prezice defectarea invertoarelor sau a string-urilor în următoarele 14 zile.' 
        : 'Run the LSTM predictive model to forecast component failures (inverters/strings) for the upcoming 14 days.' 
    },
    { 
      id: 'agri_plan', 
      label: lang === 'ro' ? 'Plan Agrivoltaic' : 'Agrivoltaics Plan', 
      icon: '🌱', 
      prompt: lang === 'ro' 
        ? 'Generează un studiu de compatibilitate agrivoltaică. Ce culturi sunt potrivite aici și care este impactul umbririi?' 
        : 'Generate an agrivoltaics compatibility study. Which crops are suitable here and what is the shading impact?' 
    },
    { 
      id: 'benchmark', 
      label: lang === 'ro' ? 'Benchmark Flotă' : 'Fleet Benchmark', 
      icon: '🏆', 
      prompt: lang === 'ro' 
        ? 'Compară performanța acestui parc (PR, Randament) cu media regională și cu cei mai buni performeri.' 
        : 'Compare this park\'s performance (PR, Yield) against the regional fleet average and top performers.' 
    },
  ];

  // Thinking Message Cycler
  useEffect(() => {
    let interval: any;
    if (isLoading) {
        interval = setInterval(() => {
            setThinkingMessageIndex(prev => {
                const msgs = lang === 'ro' ? THINKING_MESSAGES_RO : THINKING_MESSAGES_EN;
                return (prev + 1) % msgs.length;
            });
        }, 2200); // Change message every 2.2 seconds to allow reading
    } else {
        setThinkingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isLoading, lang]);

  // Listen for report generation triggers from other components
  useEffect(() => {
    const handleReportTrigger = (e: any) => {
        const { siteName, data, actionPrompt } = e.detail;
        
        let prompt = actionPrompt;
        
        // If no specific action prompt is provided, default to the Site Report generation logic
        if (!prompt) {
             prompt = `Please generate a comprehensive technical site report for ${siteName}. Use the generate_technical_site_report tool with the following context: ${JSON.stringify(data)}`;
        } else {
             // Optional: Append context if available and not already in prompt
             if (siteName && !prompt.includes(siteName)) {
                 prompt += ` for ${siteName}`;
             }
        }
        
        // If image generation is requested via action, we might want to set config
        const isImageGenRequest = prompt.toLowerCase().includes('generate image') || prompt.toLowerCase().includes('imagine');
        const config: GeminiRequestConfig = isImageGenRequest ? { isImageGen: true, imageSize: '1K' } : {};

        handleSend(prompt, isImageGenRequest ? config : undefined);
    };
    window.addEventListener('helios-report-trigger', handleReportTrigger);
    return () => window.removeEventListener('helios-report-trigger', handleReportTrigger);
  }, []);

  // Reset/Init welcome message when language changes
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
    if (apiKey) {
      orchestratorRef.current = new GeminiOrchestrator(apiKey);
    }
  }, []);

  // --- Voice Recognition Setup ---
  useEffect(() => {
    const { webkitSpeechRecognition, SpeechRecognition } = window as unknown as IWindow;
    const Recognition = SpeechRecognition || webkitSpeechRecognition;

    if (Recognition) {
      const recognition = new Recognition();
      recognition.continuous = false; 
      recognition.interimResults = true; 
      recognition.lang = lang === 'ro' ? 'ro-RO' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
        setMicError(true);
      };

      recognitionRef.current = recognition;
    }
  }, [lang]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]); // Scroll when messages change or loading state (for typing indicator)

  const handleSaveChat = () => {
    if (messages.length === 0) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content = `# Smart Helios Chat Export - ${new Date().toLocaleString()}\n\n`;

    messages.forEach(msg => {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const role = msg.role === 'model' ? '🤖 SMART HELIOS' : (msg.role === 'user' ? '👤 USER' : '⚙️ SYSTEM');
      
      content += `### ${role} [${time}]\n`;
      content += `${msg.content}\n`;
      
      if (msg.attachment) {
         content += `\n*[Attachment: ${msg.attachment.name} (${msg.attachment.mimeType})]*\n`;
      }
      
      if (msg.groundingSources && msg.groundingSources.length > 0) {
         content += `\n> **Sources:**\n`;
         msg.groundingSources.forEach(s => {
             content += `> - [${s.title || 'Link'}](${s.uri})\n`;
         });
      }
      
      content += `\n---\n\n`;
    });

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `helios-chat-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        const data = base64String.split(',')[1]; 
        
        setSelectedFile({
            name: file.name,
            mimeType: file.type,
            data: data
        });
        
        // Reset editing state if new file uploaded, user must explicitly click "Edit"
        setEditingImage(null);
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleEditImage = (imageData: string, mimeType: string) => {
      // Remove data:image/png;base64, prefix if present
      const base64 = imageData.includes('base64,') ? imageData.split('base64,')[1] : imageData;
      setEditingImage({ data: base64, mimeType, source: 'gen' });
      setInput(''); // Clear input for prompt
      setSelectedFile(null); // Clear selection as we are moving to edit mode
      
      // Focus input
      setTimeout(() => {
        const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
        if(inputEl) inputEl.focus();
      }, 100);
  };

  const handleGenerateImage = () => {
      if (!genParams.prompt) return;
      setShowGenModal(false);
      
      const config: GeminiRequestConfig = {
          isImageGen: true,
          imageSize: genParams.size
      };
      
      handleSend(genParams.prompt, config);
  };

  const handleSend = async (overrideText?: string, customConfig?: GeminiRequestConfig) => {
    const textToSend = overrideText || input;
    if ((!textToSend.trim() && !selectedFile) || isLoading) return;
    
    if (isListening) {
        recognitionRef.current?.stop();
    }
    
    if (!orchestratorRef.current) {
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'system',
            content: t(lang, 'chat', 'apiKeyMissing'),
            timestamp: Date.now()
        }]);
        return;
    }

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      attachment: selectedFile || undefined,
      timestamp: Date.now()
    };

    if (selectedFile && selectedFile.mimeType.startsWith('image/')) {
        setLastContextImage(`data:${selectedFile.mimeType};base64,${selectedFile.data}`);
    }

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    // Create a placeholder message for the streaming response
    const streamingMsgId = (Date.now() + 1).toString();
    const placeholderMsg: Message = {
      id: streamingMsgId,
      role: 'model',
      content: '', // Starts empty
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, placeholderMsg]);

    try {
      // Prepare Config
      const config: GeminiRequestConfig = customConfig || {
          isThinking: isThinkingEnabled,
          isImageEdit: !!editingImage,
          editContext: editingImage ? { data: editingImage.data, mimeType: editingImage.mimeType } : undefined
      };

      const response = await orchestratorRef.current.sendMessage(
          textToSend, 
          userMsg.attachment,
          (toolName: any, args: any) => {
            onToolActivity({
                toolName,
                args,
                result: 'Pending...',
                timestamp: Date.now()
            });
          },
          lastContextImage,
          lang,
          activeModel,
          config,
          (streamedText) => {
              // Update the message content in real-time
              setMessages(prevMessages => 
                  prevMessages.map(msg => 
                      msg.id === streamingMsgId 
                      ? { ...msg, content: streamedText } 
                      : msg
                  )
              );
          }
      );

      if (response.generatedImage) {
          setLastContextImage(response.generatedImage);
      }

      // If we were editing, clear the editing state after sending
      if (editingImage) {
          setEditingImage(null);
      }

      // Final update to ensure everything is synced (image, grounding, final text)
      setMessages(prevMessages => 
          prevMessages.map(msg => 
              msg.id === streamingMsgId 
              ? { 
                  ...msg, 
                  content: response.text, // Ensure final text matches
                  image: response.generatedImage, 
                  groundingSources: response.groundingSources 
                } 
              : msg
          )
      );

    } catch (error) {
      // Remove the placeholder if it was empty, or append error
      const isQuotaError = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'));
      
      const content = isQuotaError 
        ? t(lang, 'chat', 'quotaError') 
        : `${t(lang, 'chat', 'error')}: ${error instanceof Error ? error.message : 'Unknown error'}`;

      const errorMsg: Message = {
        id: (Date.now() + 2).toString(),
        role: 'system',
        content: content,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
      
      // Optionally remove the stuck streaming message if it had no content
      setMessages(prev => prev.filter(m => m.id !== streamingMsgId || m.content.length > 0));

    } finally {
      setIsLoading(false);
    }
  };

  const renderAttachmentPreview = (attachment: Attachment) => {
      const isImage = attachment.mimeType.startsWith('image/');
      if (isImage) {
          return (
              <div className="mb-2 rounded overflow-hidden border border-black/20 max-w-xs relative group">
                  <img src={`data:${attachment.mimeType};base64,${attachment.data}`} alt="attachment" className="w-full h-auto" />
              </div>
          );
      }
      return (
        <div className="mb-2 p-3 bg-slate-800 rounded border border-slate-700 flex items-center gap-3 max-w-xs">
            <div className="bg-slate-700 p-2 rounded">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div className="overflow-hidden">
                <p className="text-sm font-medium text-slate-200 truncate">{attachment.name}</p>
                <p className="text-[10px] text-slate-400 uppercase">{attachment.mimeType.split('/')[1]}</p>
            </div>
        </div>
      );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 relative">
      
      {/* --- IMAGE GENERATION MODAL --- */}
      {showGenModal && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur flex items-center justify-center p-6">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <span className="text-xl">🎨</span> Generate Image
                      </h3>
                      <button onClick={() => setShowGenModal(false)} className="text-slate-500 hover:text-white">✕</button>
                  </div>
                  
                  <div>
                      <label className="text-xs text-slate-400 font-mono uppercase mb-2 block">Model</label>
                      <div className="bg-slate-800 p-2 rounded text-sm text-indigo-400 font-bold border border-indigo-500/30 flex justify-between items-center">
                          <span>Nano Banana Pro (Gemini 3 Pro)</span>
                          <span className="text-[10px] bg-indigo-900 px-1.5 py-0.5 rounded text-indigo-200">VISION</span>
                      </div>
                  </div>

                  <div>
                      <label className="text-xs text-slate-400 font-mono uppercase mb-2 block">Prompt</label>
                      <textarea 
                        className="w-full bg-slate-950 border border-slate-700 rounded p-3 text-sm focus:border-indigo-500 focus:outline-none h-24 resize-none"
                        placeholder="Describe the image you want to generate..."
                        value={genParams.prompt}
                        onChange={(e) => setGenParams({...genParams, prompt: e.target.value})}
                      />
                  </div>
                  
                  <div>
                      <label className="text-xs text-slate-400 font-mono uppercase mb-2 block">Size</label>
                      <div className="flex gap-2">
                          {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                              <button
                                key={size}
                                // Fix: Use correct state setter setGenParams instead of undefined setParams
                                onClick={() => setGenParams({...genParams, size})}
                                className={`flex-1 py-2 rounded font-mono text-sm border transition-all ${genParams.size === size ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                              >
                                  {size}
                              </button>
                          ))}
                      </div>
                  </div>

                  <button 
                    onClick={handleGenerateImage}
                    disabled={!genParams.prompt}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    GENERATE
                  </button>
              </div>
          </div>
      )}

      <div className="p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
        <h2 className="text-sm font-mono font-semibold text-primary-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          HELIOS ORCHESTRATOR
        </h2>
        
        <div className="flex items-center gap-3">
             {/* Thinking Toggle */}
            <div className="flex items-center gap-2 bg-slate-800 rounded-full px-1 py-0.5 border border-slate-700">
                <button
                    onClick={() => setIsThinkingEnabled(!isThinkingEnabled)}
                    className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${isThinkingEnabled ? 'bg-violet-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    title="Enable Deep Thinking Mode (Gemini 3 Pro + 32k Budget)"
                >
                    <span className="text-xs">🧠</span> THINK
                </button>
            </div>

            <button
                onClick={handleSaveChat}
                disabled={messages.length === 0}
                className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title={t(lang, 'chat', 'saveChat')}
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary-600 text-white'
                  : msg.role === 'system' 
                  ? 'bg-red-900/20 text-red-400 border border-red-900/50'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              {msg.role === 'model' && (
                <div className="mb-1 text-xs text-primary-400 font-mono font-bold flex justify-between items-center">
                    <span>{t(lang, 'chat', 'agentName')}</span>
                </div>
              )}
              
              {msg.attachment && renderAttachmentPreview(msg.attachment)}

              {msg.image && (
                <div className="mb-3 rounded overflow-hidden border border-black/20 relative group">
                    <img src={msg.image} alt="content" className="max-w-full h-auto" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button 
                            onClick={() => {
                                const a = document.createElement('a');
                                a.href = msg.image!;
                                a.download = `helios-gen-${Date.now()}.png`;
                                a.click();
                            }}
                            className="bg-white text-black text-xs font-bold px-3 py-2 rounded-full hover:scale-105 transition-transform"
                        >
                            Download
                        </button>
                        <button 
                            onClick={() => handleEditImage(msg.image!, 'image/png')}
                            className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-full hover:scale-105 transition-transform flex items-center gap-1"
                        >
                            <span>✏️</span> Edit
                        </button>
                    </div>
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content}</div>

              {msg.groundingSources && msg.groundingSources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-[10px] uppercase font-bold text-slate-500 mb-2">{t(lang, 'chat', 'sources')}</p>
                      <div className="flex flex-wrap gap-2">
                          {msg.groundingSources.map((source, idx) => (
                              <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noreferrer"
                                className="block max-w-full bg-slate-950/50 border border-slate-700 hover:border-primary-500 rounded px-2 py-1 flex items-center gap-2 transition-colors group"
                              >
                                  {source.type === 'web' ? (
                                     <svg className="text-slate-500 group-hover:text-primary-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1 4-10z"/></svg>
                                  ) : (
                                     <svg className="text-emerald-500 group-hover:text-emerald-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                  )}
                                  <span className="text-xs text-slate-300 truncate max-w-[150px]">{source.title || 'Source'}</span>
                              </a>
                          ))}
                      </div>
                  </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'model' && messages[messages.length - 1].content === '' && (
            <div className="flex justify-start w-full">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 max-w-[85%] animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                            <div className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                        </div>
                        <span className="text-xs font-mono text-violet-300">
                             {lang === 'ro' ? THINKING_MESSAGES_RO[thinkingMessageIndex] : THINKING_MESSAGES_EN[thinkingMessageIndex]}
                        </span>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800">
        
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar items-center">
            {/* Image Gen Button */}
            <button
                onClick={() => setShowGenModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/30 hover:border-indigo-400 rounded-full text-xs transition-all whitespace-nowrap group text-indigo-300"
            >
                <span>🎨</span>
                <span className="font-bold">GENERATE IMAGE</span>
            </button>

            {QUICK_ACTIONS.map(action => (
                <button
                    key={action.id}
                    onClick={() => handleSend(action.prompt)}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-primary-500/50 rounded-full text-xs transition-all whitespace-nowrap group disabled:opacity-50"
                >
                    <span className="text-sm">{action.icon}</span>
                    <span className="text-slate-300 group-hover:text-white font-medium">{action.label}</span>
                </button>
            ))}
        </div>

        {/* Editing Context Indicator */}
        {editingImage && (
             <div className="mb-2 flex items-center gap-2 bg-indigo-900/20 p-2 rounded border border-indigo-500/50 w-fit animate-in slide-in-from-bottom-2 fade-in">
                <img src={`data:${editingImage.mimeType};base64,${editingImage.data}`} alt="Editing" className="w-8 h-8 object-cover rounded" />
                <div className="flex flex-col">
                    <span className="text-xs text-indigo-300 font-bold">EDITING MODE</span>
                    <span className="text-[10px] text-indigo-400/70">Using Gemini 2.5 Flash Image</span>
                </div>
                <button 
                    onClick={() => setEditingImage(null)}
                    className="ml-2 text-indigo-400 hover:text-white"
                >
                    ✕
                </button>
            </div>
        )}

        {selectedFile && !editingImage && (
            <div className="mb-2 flex items-center gap-2 bg-slate-900 p-2 rounded border border-slate-700 w-fit">
                {selectedFile.mimeType.startsWith('image/') ? (
                    <img src={`data:${selectedFile.mimeType};base64,${selectedFile.data}`} alt="Preview" className="w-8 h-8 object-cover rounded" />
                ) : (
                    <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    </div>
                )}
                <div className="flex flex-col">
                    <span className="text-xs text-slate-300 font-medium max-w-[200px] truncate">{selectedFile.name}</span>
                    <span className="text-[10px] text-slate-500">{t(lang, 'chat', 'fileAttached')}</span>
                </div>
                <span className="ml-2 text-[10px] bg-indigo-900/50 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-700/50 font-mono">
                    PRO VISION
                </span>

                {/* Switch to Edit Mode Button */}
                {selectedFile.mimeType.startsWith('image/') && (
                    <button 
                        onClick={() => handleEditImage(selectedFile.data, selectedFile.mimeType)}
                        className="ml-2 flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded text-[10px] font-bold transition-colors"
                        title="Use text prompts to edit this image (Gemini 2.5 Flash)"
                    >
                        <span>✨</span> Enter Edit Mode
                    </button>
                )}

                <button 
                    onClick={() => setSelectedFile(null)}
                    className="ml-2 text-slate-500 hover:text-red-400"
                >
                    ✕
                </button>
            </div>
        )}

        {isListening && (
            <div className="mb-2 flex items-center gap-3 animate-pulse text-primary-400 bg-primary-900/20 px-3 py-1.5 rounded-full w-fit">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
                </span>
                <span className="text-xs font-mono font-medium tracking-wide uppercase">{t(lang, 'chat', 'listening')}</span>
            </div>
        )}
        
        {micError && (
            <div className="mb-2 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded w-fit">
                {t(lang, 'chat', 'micError')}
            </div>
        )}

        <div className="relative flex gap-2">
          <button
            onClick={toggleListening}
            className={`p-3 rounded-lg border transition-all duration-200 group ${
                isListening 
                ? 'bg-red-500/20 border-red-500 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.4)]' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-primary-400'
            }`}
            title={t(lang, 'chat', 'tapToSpeak')}
          >
             {isListening ? (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
             ) : (
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
             )}
          </button>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg border border-slate-700 transition-colors"
            title={t(lang, 'chat', 'uploadTitle')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" 
            className="hidden" 
          />
          
          <input
            type="text"
            className={`flex-1 bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-1 transition-all text-white placeholder-slate-500 font-mono ${
                editingImage ? 'focus:border-indigo-500 focus:ring-indigo-500 border-indigo-500/30' : 'focus:border-primary-500 focus:ring-primary-500'
            }`}
            placeholder={editingImage ? "Enter instructions to edit the image (e.g., 'Add a retro filter')..." : (isListening ? t(lang, 'chat', 'listening') : t(lang, 'chat', 'placeholder'))}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button
            onClick={() => handleSend()}
            disabled={isLoading || (!input.trim() && !selectedFile)}
            className={`absolute right-2 top-2 bottom-2 p-1.5 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10 ${
                editingImage ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-primary-600 hover:bg-primary-500'
            }`}
            title={t(lang, 'chat', 'send')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
