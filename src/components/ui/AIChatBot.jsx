import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, X, Send, Sparkles, LayoutDashboard,
  Paperclip, FileText, Trash2, Volume2, VolumeX, Image, User,
  Plus, Settings, Bot
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';
import { supabase } from '../../utils/supabaseClient';
import { askJoi, ZeroGPUQuotaError, isZeroGPUQuotaError } from '../../services/joiApi';

const BOT_NAME = 'Joi';
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ── Markdown Components (Claude-style) ──────────────────────
const mdComponents = {
  h1: ({ children }) => <h1 className="text-xl font-black mt-4 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-black mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-black">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-orange-500 pl-4 my-2 italic opacity-80">{children}</blockquote>,
  code: ({ inline, children, ...props }) => inline
    ? <code className="bg-slate-200 dark:bg-slate-800 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>{children}</code>
    : <code className="block bg-slate-100 dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 p-4 rounded-2xl overflow-x-auto text-sm font-mono my-3 border border-slate-200 dark:border-slate-800" {...props}>{children}</code>,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-slate-200 dark:bg-slate-800">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-black text-xs uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 border-b border-slate-200 dark:border-slate-700/80">{children}</td>,
  tr: ({ children }) => <tr className="hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors">{children}</tr>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-orange-500 dark:text-orange-400 underline hover:opacity-80 transition-opacity">{children}</a>,
  hr: () => <hr className="my-4 border-slate-200 dark:border-slate-700" />,
};

// ── Thinking / Loading Animation ─────────────────────────────
const ThinkingDots = () => (
  <div className="flex justify-start items-end gap-3">
    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-500 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-violet-500/30 shrink-0">
      <Sparkles size={16} />
    </div>
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[1.5rem] rounded-bl-none px-5 py-3.5 shadow-md">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-blue-500"
            style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  </div>
);

// ── File/Image Preview Badge ──────────────────────────────────
const AttachmentBadge = ({ file, imagePreview, onRemove }) => (
  <div className="absolute -top-16 left-4 flex items-center gap-2 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-2xl px-3 py-2 shadow-lg animate-in slide-in-from-bottom-2 duration-200 max-w-xs">
    {imagePreview
      ? <img src={imagePreview} alt="preview" className="w-8 h-8 rounded-lg object-cover border border-blue-200" />
      : <FileText size={16} className="text-blue-500 shrink-0" />
    }
    <div className="flex flex-col overflow-hidden mr-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Attachment</span>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{file.name}</span>
    </div>
    <button onClick={onRemove} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 rounded-full transition-all">
      <Trash2 size={14} />
    </button>
  </div>
);

const AIChatBot = ({ onBack, currentUser, isWidget, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTechToSpec, setIsTechToSpec] = useState(false);
  const [attachedFile, setAttachedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const { language } = useLanguage();
  const detectedLang = language === 'la' ? 'Lao' : 'Thai';

  // ── Speech Synthesis (TTS) ──────────────────────────────────
  const speakText = (text) => {
    if (!isTTSEnabled || !text) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_]/g, '');
    const ut = new SpeechSynthesisUtterance(cleanText);
    ut.lang = language === 'la' ? 'th-TH' : 'th-TH'; // Lao uses Thai TTS engine usually
    ut.rate = 1.0; ut.pitch = 1.0;
    ut.onstart = () => setIsSpeaking(true);
    ut.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(ut);
  };
  const stopSpeaking = () => { window.speechSynthesis.cancel(); setIsSpeaking(false); };
  const toggleTTS = () => { if (isTTSEnabled) stopSpeaking(); setIsTTSEnabled(!isTTSEnabled); };

  // ── Chat History Logic ────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('joah_ai_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      setChatHistory(parsed);
      if (parsed.length > 0) {
        setCurrentChatId(parsed[0].id);
        setMessages(parsed[0].messages);
      } else {
        startNewChat();
      }
    } else {
      startNewChat();
    }
  }, []);

  useEffect(() => {
    if (currentChatId && messages.length > 0) {
      const u = chatHistory.map(c => c.id === currentChatId ? { ...c, messages, title: messages[1]?.content?.substring(0, 30) || 'New Conversation' } : c);
      if (!chatHistory.find(c => c.id === currentChatId)) {
        u.push({ id: currentChatId, messages, title: messages[1]?.content?.substring(0, 30) || 'New Conversation' });
      }
      setChatHistory(u);
      localStorage.setItem('joah_ai_history', JSON.stringify(u));
    }
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    stopSpeaking();
    const name = currentUser?.name || currentUser?.user_metadata?.full_name || 'ທ່ານ';
    setMessages([{ role: 'assistant', content: `ສະບາຍດີ ທ່ານ **${name}** 👋\nຂ້ອຍຊື່ **${BOT_NAME}** — AI Assistant ຂອງ Joah Inventory\nມີຫຍັງໃຫ້ຊ່ວຍບໍ່? ສາມາດສົ່ງຂໍ້ຄວາມ, ໄຟລ໌ ຫຼື ຮູບພາບໄດ້ເລີย 📎` }]);
    setAttachedFile(null); setFileContent(''); setImagePreview(null);
  };

  const loadChat = (chat) => { stopSpeaking(); setCurrentChatId(chat.id); setMessages(chat.messages); setAttachedFile(null); setFileContent(''); setImagePreview(null); };
  const deleteChat = (e, id) => { e.stopPropagation(); const u = chatHistory.filter(c => c.id !== id); setChatHistory(u); localStorage.setItem('joah_ai_history', JSON.stringify(u)); if (currentChatId === id) startNewChat(); };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isLoading]);

  // ── File/Image Handler ────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { alert(`ขนาดไฟล์ต้องไม่เกิน 1MB (ไฟล์นี้: ${(file.size / 1024 / 1024).toFixed(2)}MB)`); return; }
    setAttachedFile(file);
    const isImage = file.type.startsWith('image/');
    if (isImage) {
      const reader = new FileReader();
      reader.onload = (e) => { setImagePreview(e.target.result); setFileContent(''); };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
      setIsLoading(true);
      try {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const wb = await readExcelFile(file);
          const json = sheetToJSON(wb, wb.SheetNames[0]);
          setFileContent(`[Excel - First 50 rows]:\n${json.slice(0, 50).map(r => JSON.stringify(r)).join('\n')}`);
        } else {
          const text = await file.text();
          setFileContent(`[File Content]:\n${text.substring(0, 5000)}`);
        }
      } catch { alert('ไม่สามารถอ่านไฟล์ได้'); setAttachedFile(null); }
      finally { setIsLoading(false); }
    }
  }, []);

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const handlePaste = useCallback((e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        processFile(item.getAsFile());
        return;
      }
    }
  }, [processFile]);

  useEffect(() => {
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  }, [input]);

  // ── Send Message (Joi AI via Hugging Face) ───────────────
  const handleSend = async () => {
    const inputMsg = input.trim();
    if (!inputMsg && !attachedFile) return;

    const userMsg = { role: 'user', content: inputMsg, hasFile: !!attachedFile, fileName: attachedFile?.name, imagePreview };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    const capturedImagePreview = imagePreview;
    setImagePreview(null);
    setIsLoading(true);

    // ── Image path: use Gemini for vision ───────────────────
    if (capturedImagePreview && GEMINI_API_KEY) {
      try {
        const base64Data = capturedImagePreview.split(',')[1] || '';
        const mimeType = capturedImagePreview.split(';')[0].split(':')[1] || 'image/png';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { text: `You are Joi, a helpful assistant for Joy of a Home inventory system. Answer in the same language as the user. Question: ${inputMsg}` },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]}]
          })
        });
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const aiMsg = { role: 'assistant', content: data.candidates[0].content.parts[0].text };
          setMessages(prev => [...prev, aiMsg]);
          if (isTTSEnabled) speakText(aiMsg.content);
        } else {
          throw new Error(data.error?.message || 'Gemini image failed');
        }
      } catch (err) {
        setMessages(prev => [...prev, { role: 'assistant', content: `❌ ບໍ່ສາມາດວິເຄາະຮູບພາບໄດ້: ${err.message}` }]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // ── Text path: Joi AI via Hugging Face Space ─────────────
    // Insert a streaming placeholder for assistant message
    const placeholderId = `streaming-${Date.now()}`;
    setMessages(prev => [...prev, { role: 'assistant', content: '...', _id: placeholderId, _streaming: true }]);

    try {
      // Build message text (include extracted file content if present)
      const messageText = fileContent
        ? `[File: ${userMsg.fileName}]\n${fileContent}\n\n${inputMsg}`
        : inputMsg;

      setFileContent('');

      // Call Joi AI with streaming
      const finalText = await askJoi({
        message: messageText,
        messages: messages, // full history for context
        systemPrompt: '',   // HF Space already has Joi's system prompt
        maxTokens: 768,
        temperature: 0.7,
        deepThinking: false,
        onToken: (streamedText) => {
          // Update the placeholder with streamed content
          setMessages(prev => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            if (lastIdx >= 0 && next[lastIdx]._id === placeholderId) {
              next[lastIdx] = { ...next[lastIdx], content: streamedText };
            }
            return next;
          });
        },
      });

      // Finalize the message (remove streaming flag)
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx]._id === placeholderId) {
          next[lastIdx] = { role: 'assistant', content: finalText || next[lastIdx].content };
        }
        return next;
      });

      if (isTTSEnabled && finalText) speakText(finalText);

    } catch (err) {
      let errorContent;

      if (err instanceof ZeroGPUQuotaError || isZeroGPUQuotaError(err)) {
        // Friendly ZeroGPU quota error
        errorContent = language === 'la'
          ? `⚠️ **Joi AI ໃຊ້ GPU ບໍ່ໄດ້ຊົ່ວຄາວ**\n\nZeroGPU quota ຂອງ Hugging Face ໝົດແລ້ວ ກະລຸນາລໍຖ້າຈົນຮອດ quota ຕໍ່ໄປ ຫຼື ລອງໃໝ່ໃນພາຍຫຼັງ 🙏`
          : `⚠️ **Joi AI ใช้ GPU ชั่วคราวไม่ได้**\n\nZeroGPU quota ของ Hugging Face หมดแล้วค่ะ กรุณารอจนกว่า quota จะรีเซ็ต หรือลองใหม่ในภายหลัง 🙏`;
      } else if (String(err.message).includes('Failed to fetch') || String(err.message).includes('NetworkError')) {
        errorContent = language === 'la'
          ? `❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ Joi ໄດ້ໃນຂະນະນີ້ ກະລຸນາກວດເບິ່ງການເຊື່ອມຕໍ່ອິນເຕີເນັດ`
          : `❌ ไม่สามารถเชื่อมต่อ Joi ได้ในขณะนี้ค่ะ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต`;
      } else {
        errorContent = `❌ ຂໍອະໄພ, ເກີດຂໍ້ຜິດພາດ: ${err.message}`;
      }

      // Replace placeholder with error message
      setMessages(prev => {
        const next = [...prev];
        const lastIdx = next.length - 1;
        if (lastIdx >= 0 && next[lastIdx]._id === placeholderId) {
          next[lastIdx] = { role: 'assistant', content: errorContent };
        } else {
          next.push({ role: 'assistant', content: errorContent });
        }
        return next;
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── [Phase B placeholder] Supabase tool functions ─────────
  // These are preserved for future secure backend integration.
  // In Phase B, these will be orchestrated server-side by Joi.
  const _fetchStockData = async (barcode) => {
        const [{ data: storeData }, { data: dcData }, { data: locData }] = await Promise.all([
          supabase.from('store_inventory').select('*').eq('barcode_no', barcode),
          supabase.from('table_dc_stock').select('*').eq('barcode_no', barcode),
          supabase.from('location_inventory').select('*').eq('barcode_no', barcode)
        ]);
        let res = `Stock data for ${barcode}:\n`;
        const itemName = storeData?.[0]?.item_name || locData?.[0]?.item_name || dcData?.[0]?.item_name || 'Unknown Item';
        res += `- Name: ${itemName}\n`;
        if (storeData?.length) storeData.forEach(r => res += `- Shop ${r.branch_id}: Qty=${r.store_qty || 0}, Sales=${r.sales_qty || 0}\n`);
        if (locData?.length) locData.forEach(r => res += `- Backstore ${r.branch_id}: Qty=${r.qty || 0}, Rack=${r.rack_location}\n`);
        if (dcData?.length) dcData.forEach(r => res += `- DC ${r.branch_id}: Qty=${r.qty || 0}\n`);
        if (!storeData?.length && !locData?.length && !dcData?.length) res = 'No data found.';
        return res;
  }; // end _fetchStockData

  // Phase B placeholder: Supabase tool functions will be moved to secure backend.
  // eslint-disable-next-line no-unused-vars
  const _phaseB = true;



  return (
    <div className={isWidget ? "flex flex-col h-full bg-transparent w-full" : "w-full h-[calc(100vh-120px)] flex gap-4 animate-in fade-in duration-300"} style={{ fontFamily: "'Phetsarath OT', 'Noto Sans Lao', 'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes eye-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      {!isWidget && (
        <div className={`transition-all duration-300 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col ${isSidebarOpen ? 'w-72 p-4 mr-4 shadow-sm' : 'w-0 p-0 border-none'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Chat History</h3>
            <button onClick={startNewChat} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors">
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide px-1">
            {chatHistory.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat)}
                className={`group p-3 rounded-xl cursor-pointer transition-colors border ${currentChatId === chat.id ? 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${currentChatId === chat.id ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                      <MessageSquare size={14} />
                    </div>
                    <span className={`font-medium text-sm truncate ${currentChatId === chat.id ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{chat.title}</span>
                  </div>
                  <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-red-500 transition-colors text-slate-400 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Container */}
      <div 
        className={`flex-1 flex flex-col min-w-0 overflow-hidden relative ${isWidget ? 'rounded-none border-none bg-transparent' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm'}`}
      >
        {/* Clean Header */}
        <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            {!isWidget && (
              <button 
                onClick={() => setIsSidebarOpen(p => !p)} 
                className="p-2 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors shrink-0"
              >
                <LayoutDashboard size={18} />
              </button>
            )}

            {/* Avatar block */}
            <div className="w-10 h-10 rounded-full bg-slate-900 dark:bg-slate-100 flex items-center justify-center shrink-0 shadow-sm relative overflow-hidden">
              <Bot size={20} className="text-white dark:text-slate-900" />
            </div>

            {/* Info details */}
            <div className="text-left">
              <div className="text-slate-900 dark:text-white font-bold text-sm tracking-wide leading-none">{BOT_NAME} AI</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-slate-500 dark:text-slate-400 text-xs font-medium leading-none">
                  Online · AI Assistant
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-20">
            <button 
              onClick={isWidget ? onClose : onBack} 
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dynamic Status / Mode Chips Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setIsTechToSpec(p => !p)} 
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border shrink-0 ${isTechToSpec ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Tech Mode
          </button>
          <button 
            onClick={toggleTTS} 
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border shrink-0 ${isTTSEnabled ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            {isTTSEnabled ? 'Audio ON' : 'Audio OFF'}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-6 scrollbar-hide relative z-10 px-4 py-6 sm:px-6 bg-white dark:bg-[#0a0f1c]">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in duration-300`} style={{ animationDelay: `${i * 0.05}s` }}>
              <div className={`flex gap-3 w-full max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                
                {/* Robot Avatar for Assistant messages */}
                {m.role !== 'user' && (
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm border border-slate-200 dark:border-slate-700">
                    <Bot size={16} />
                  </div>
                )}

                <div className={`flex flex-col gap-1.5 flex-1 min-w-0 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-4 py-3 text-sm leading-relaxed max-w-full overflow-x-auto ${m.role === 'user' 
                      ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl rounded-tr-sm' 
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 shadow-sm'
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                    {m.hasFile && (
                      <div className="mt-3 p-2.5 bg-black/5 dark:bg-white/5 rounded-lg flex items-center gap-2 max-w-full overflow-hidden">
                        <FileText size={14} className="shrink-0" /> 
                        <span className="text-xs font-medium truncate">{m.fileName}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-1">{m.role === 'user' ? 'You' : BOT_NAME}</span>
                </div>
              </div>
            </div>
          ))}
          {isLoading && <ThinkingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10 w-full px-4 py-4">
          <div className="max-w-4xl mx-auto relative w-full">
            {attachedFile && <AttachmentBadge file={attachedFile} imagePreview={imagePreview} onRemove={() => { setAttachedFile(null); setImagePreview(null); setFileContent(''); }} />}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 flex-1 min-w-0 focus-within:border-slate-400 dark:focus-within:border-slate-500 transition-colors">
                <input 
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="ຖາມ Joi ສິ່ງໃດກໍໄດ້..."
                  className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 text-sm text-slate-900 dark:text-white placeholder-slate-400 min-w-0"
                />
                
                {/* File Attachment Buttons inside input area */}
                <div className="flex items-center gap-2 ml-2">
                  <button onClick={() => document.getElementById('ai-file-input').click()} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0">
                    <Paperclip size={18} />
                  </button>
                  <input id="ai-file-input" type="file" className="hidden" onChange={handleFileChange} />
                  <button onClick={() => document.getElementById('ai-img-input').click()} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors shrink-0">
                    <Image size={18} />
                  </button>
                </div>
              </div>

              <button 
                onClick={handleSend} 
                disabled={isLoading || (!input.trim() && !attachedFile)} 
                className="w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBot;
