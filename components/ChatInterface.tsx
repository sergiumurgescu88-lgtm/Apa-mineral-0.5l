import React, { useState, useRef, useEffect } from 'react';
import { Message, ToolCallLog, Language, Attachment } from '../types';
import { GeminiOrchestrator } from '../services/geminiService';
import { t } from '../translations';
import { DEFAULT_MODEL_ID } from '../constants';

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

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onToolActivity, lang, activeModel }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
      recognition.continuous = false; // Stop after one sentence/pause
      recognition.interimResults = true; // Show results as we speak
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
        // Append to existing input if user pauses and speaks again in same session, 
        // but for continuous=false, it usually resets. 
        // Here we just set the input to the current result.
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
  }, [messages]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const base64String = event.target?.result as string;
        // Strip prefix for data extraction, but keep full string for preview if image
        const data = base64String.split(',')[1]; 
        
        setSelectedFile({
            name: file.name,
            mimeType: file.type,
            data: data
        });
      };
      
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedFile) || isLoading) return;
    
    // Stop listening if we hit send manually
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
      content: input,
      attachment: selectedFile || undefined,
      timestamp: Date.now()
    };

    // If image, update context for potential editing
    if (selectedFile && selectedFile.mimeType.startsWith('image/')) {
        setLastContextImage(`data:${selectedFile.mimeType};base64,${selectedFile.data}`);
    }

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      // Pass activeModel to sendMessage
      const response = await orchestratorRef.current.sendMessage(
          input, 
          userMsg.attachment,
          (toolName, args) => {
            onToolActivity({
                toolName,
                args,
                result: 'Pending...',
                timestamp: Date.now()
            });
          },
          lastContextImage,
          lang,
          activeModel
      );

      if (response.generatedImage) {
          setLastContextImage(response.generatedImage);
      }

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: response.text,
        image: response.generatedImage, 
        groundingSources: response.groundingSources,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMsg]);

    } catch (error) {
      const isQuotaError = error instanceof Error && 
        (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED'));
      
      const content = isQuotaError 
        ? t(lang, 'chat', 'quotaError') 
        : `${t(lang, 'chat', 'error')}: ${error instanceof Error ? error.message : 'Unknown error'}`;

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: content,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderAttachmentPreview = (attachment: Attachment) => {
      const isImage = attachment.mimeType.startsWith('image/');
      if (isImage) {
          return (
              <div className="mb-2 rounded overflow-hidden border border-black/20 max-w-xs">
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
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-10 flex justify-between items-center">
        <h2 className="text-sm font-mono font-semibold text-primary-400 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          HELIOS ORCHESTRATOR
        </h2>
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
                <div className="mb-1 text-xs text-primary-400 font-mono font-bold">{t(lang, 'chat', 'agentName')}</div>
              )}
              
              {/* Render Attachments (User) */}
              {msg.attachment && renderAttachmentPreview(msg.attachment)}

              {/* Render Images (Model Generated) */}
              {msg.image && (
                <div className="mb-3 rounded overflow-hidden border border-black/20">
                    <img src={msg.image} alt="content" className="max-w-full h-auto" />
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content}</div>

              {/* Render Grounding Sources */}
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
                                     <svg className="text-slate-500 group-hover:text-primary-400" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
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
        {isLoading && (
            <div className="flex justify-start animate-pulse">
                <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                        <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-slate-950 border-t border-slate-800">
        {selectedFile && (
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
                <button 
                    onClick={() => setSelectedFile(null)}
                    className="ml-2 text-slate-500 hover:text-red-400"
                >
                    ✕
                </button>
            </div>
        )}

        {/* --- VOICE FEEDBACK OVERLAY --- */}
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
          {/* --- MIC BUTTON --- */}
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
                 // Stop Icon
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
             ) : (
                 // Mic Icon
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
            // Accept images, PDFs, Excel, Word, PPT
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" 
            className="hidden" 
          />
          
          <input
            type="text"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg pl-4 pr-12 py-3 text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all text-white placeholder-slate-500 font-mono"
            placeholder={isListening ? t(lang, 'chat', 'listening') : t(lang, 'chat', 'placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || (!input.trim() && !selectedFile)}
            className="absolute right-2 top-2 bottom-2 p-1.5 bg-primary-600 hover:bg-primary-500 rounded-md text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center w-10"
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