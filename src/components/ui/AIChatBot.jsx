import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, X, Send, Sparkles, LayoutDashboard,
  Paperclip, FileText, Trash2, Volume2, VolumeX, Image, User
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';

const BOT_NAME = 'Joi';
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || 'sk-14413bf76ea64927854417be978a7a9b';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ── Markdown Components (Claude-style) ──────────────────────
const mdComponents = {
  h1: ({ children }) => <h1 className="text-xl font-black text-slate-800 dark:text-white mt-4 mb-2 border-b border-slate-200 dark:border-slate-700 pb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-black text-slate-800 dark:text-white mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
  strong: ({ children }) => <strong className="font-black text-slate-900 dark:text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-700 dark:text-slate-300">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-400 pl-4 my-2 text-slate-500 dark:text-slate-400 italic">{children}</blockquote>,
  code: ({ inline, children }) => inline
    ? <code className="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md text-sm font-mono">{children}</code>
    : <pre className="bg-slate-900 dark:bg-slate-950 text-green-400 p-4 rounded-2xl overflow-x-auto text-sm font-mono my-3 border border-slate-700"><code>{children}</code></pre>,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse rounded-xl overflow-hidden">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-blue-600 text-white">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-black text-xs uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">{children}</td>,
  tr: ({ children }) => <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">{children}</tr>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-blue-500 underline hover:text-blue-700 transition-colors">{children}</a>,
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
    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate">{file.name}</span>
    <button onClick={onRemove} className="p-1 rounded-full hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 transition-all text-slate-400">
      <X size={14} />
    </button>
  </div>
);

// ── Main Component ────────────────────────────────────────────
const AIChatBot = ({ onBack, currentUser }) => {
  const { t } = useLanguage();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [attachedFile, setAttachedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTechToSpec, setIsTechToSpec] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // ── TTS ──────────────────────────────────────────────────
  const speakText = (text, forceSpeak = false) => {
    if (!window.speechSynthesis) return;
    // forceSpeak=true: always speak (per-message button)
    // forceSpeak=false: only speak when TTS toggle is ON (auto-speak)
    if (!forceSpeak && !isTTSEnabled) return;

    window.speechSynthesis.cancel();
    const clean = text.replace(/[#*`_~\[\]()>]/g, '').substring(0, 2000);
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Smart voice selection: try preferred langs, fallback to any available
    const tryLangs = ['th-TH', 'th', 'lo-LA', 'en-US'];
    const voices = window.speechSynthesis.getVoices();
    let picked = null;
    for (const lang of tryLangs) {
      picked = voices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
      if (picked) break;
    }
    if (picked) utterance.voice = picked;
    // If no voice found, browser will use its default voice

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };
  const stopSpeaking = () => { window.speechSynthesis?.cancel(); setIsSpeaking(false); };
  const toggleTTS = () => { if (isTTSEnabled) stopSpeaking(); setIsTTSEnabled(p => !p); };

  // ── History ───────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('joah_ai_history');
    if (saved) {
      const parsed = JSON.parse(saved);
      setChatHistory(parsed);
      if (parsed.length > 0) { setCurrentChatId(parsed[0].id); setMessages(parsed[0].messages); }
      else startNewChat();
    } else startNewChat();
  }, []);

  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      const updated = chatHistory.map(c => c.id === currentChatId ? { ...c, messages, lastActive: Date.now() } : c);
      if (!chatHistory.find(c => c.id === currentChatId)) {
        const title = messages.find(m => m.role === 'user')?.content?.substring(0, 30) || 'New Chat';
        updated.unshift({ id: currentChatId, title: title + (title.length >= 30 ? '...' : ''), messages, lastActive: Date.now() });
      }
      setChatHistory(updated);
      localStorage.setItem('joah_ai_history', JSON.stringify(updated));
    }
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    stopSpeaking();
    const name = currentUser?.name || currentUser?.user_metadata?.full_name || 'ທ່ານ';
    setMessages([{ role: 'assistant', content: `ສະບາຍດີ ທ່ານ **${name}** 👋\nຂ້ອຍຊື່ **${BOT_NAME}** — AI Assistant ຂອງ Joah Inventory\nມີຫຍັງໃຫ້ຊ່ວຍບໍ່? ສາມາດສົ່ງຂໍ້ຄວາມ, ໄຟລ໌ ຫຼື ຮູບພາບໄດ້ເລີຍ 📎` }]);
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

  // ── Paste Image from Clipboard ────────────────────────────
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

  // ── Auto-resize textarea ──────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; }
  }, [input]);

  // ── Send Message ──────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;
    stopSpeaking();

    // Build user message for display
    const userMsg = {
      role: 'user',
      content: input || (attachedFile ? `📎 ${attachedFile.name}` : ''),
      fileName: attachedFile?.name,
      hasFile: !!attachedFile && !imagePreview,
      imagePreview: imagePreview || null
    };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); setAttachedFile(null); setFileContent(''); setImagePreview(null);
    setIsLoading(true);

    try {
      // Detect language from the current user message
      const userText = input || '';
      const isLao = /[\u0E80-\u0EFF]/.test(userText);
      const isThai = /[\u0E00-\u0E7F]/.test(userText);
      const isEnglish = /^[a-zA-Z0-9\s.,!?'"()\-:;@#]+$/.test(userText.trim());
      const detectedLang = isLao ? 'Lao (ພາສາລາວ)' : isThai ? 'Thai (ภาษาไทย)' : isEnglish ? 'English' : 'the same language as the user message';

      const techSpecExtra = isTechToSpec
        ? `\n\nTECH TO SPEC MODE ENABLED: Structure every response as a technical specification document. Use headings, bullet points, tables, and code blocks where appropriate. Be precise, detailed, and engineering-focused.`
        : '';
      const systemPrompt = `You are ${BOT_NAME}, a smart and friendly AI assistant built for Joah Inventory system, created by Santisouk Laxayphone. Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

CRITICAL LANGUAGE RULE: You MUST reply in ${detectedLang}. Detect the language from the user's latest message and respond ONLY in that language. Do NOT switch languages. Do NOT default to Lao unless the user writes in Lao.

Format your response using Markdown. Never mention DeepSeek.${techSpecExtra}`;

      let data;
      if (userMsg.imagePreview && GEMINI_API_KEY) {
        // ── Use Gemini for Images ──
        const base64Data = userMsg.imagePreview.split(',')[1] || '';
        const mimeType = userMsg.imagePreview.split(';')[0].split(':')[1] || 'image/png';
        
        const geminiPayload = {
          contents: [{
            parts: [
              { text: `${systemPrompt}\n\nUser Question: ${input || 'Please describe this image.'}` },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 2048 }
        };

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(geminiPayload)
        });

        const geminiData = await res.json();
        if (geminiData.candidates?.[0]?.content?.parts?.[0]?.text) {
          data = { choices: [{ message: { role: 'assistant', content: geminiData.candidates[0].content.parts[0].text } }] };
        } else {
          throw new Error(geminiData.error?.message || 'Gemini error');
        }
      } else {
        // ── Use DeepSeek for Text/Files ──
        // Build API messages — DeepSeek chat does NOT support image_url, strip images from history
        const apiHistory = messages.slice(-10).map(m => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : ''
        }));

        let userContent;
        if (userMsg.imagePreview) {
          // Fallback if Gemini key is missing
          const base64Data = userMsg.imagePreview.split(',')[1] || '';
          userContent = `[User attached an image: ${userMsg.fileName || 'image'}]\nImage data (base64, first 200 chars): ${base64Data.substring(0, 200)}...\n\nNote: DeepSeek cannot see images. Acknowledge the image and ask for description.\n\nUser question: ${input || '(No text provided)'}`;
        } else if (fileContent) {
          userContent = `I attached a file: "${userMsg.fileName || 'file'}"\n\n${fileContent}\n\nQuestion: ${input || 'Please summarize this file.'}`;
        } else {
          userContent = input;
        }

        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: systemPrompt }, ...apiHistory, { role: 'user', content: userContent }],
            temperature: 0.8
          })
        });
        data = await res.json();
      }

      if (data.choices?.[0]) {
        const aiMsg = data.choices[0].message;
        setMessages(prev => [...prev, aiMsg]);
        if (isTTSEnabled) speakText(aiMsg.content);
      } else {
        throw new Error(data.error?.message || 'No response');
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ຂໍອະໄພ, ເກີດຂໍ້ຜິດພາດ: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] flex gap-4 animate-in fade-in duration-300">
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }`}</style>

      {/* Sidebar */}
      <div className={`transition-all duration-500 overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] flex flex-col ${isSidebarOpen ? 'w-72 p-5' : 'w-0 p-0'}`}>
        <div className="flex items-center justify-between mb-6 whitespace-nowrap">
          <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Chat History</h3>
          </div>
          <button onClick={startNewChat} className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg hover:shadow-blue-500/30 transition-all hover:scale-105 active:scale-95">
            <Sparkles size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-hide">
          {chatHistory.map(chat => (
            <div key={chat.id} onClick={() => loadChat(chat)}
              className={`group p-3.5 rounded-2xl cursor-pointer transition-all border text-sm ${currentChatId === chat.id ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={14} className={currentChatId === chat.id ? 'text-blue-500 shrink-0' : 'text-slate-400 shrink-0'} />
                  <span className={`font-bold truncate ${currentChatId === chat.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>{chat.title}</span>
                </div>
                <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all text-slate-400 shrink-0">
                  <X size={12} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2rem] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(p => !p)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-all">
              <LayoutDashboard size={18} />
            </button>
            <button onClick={onBack} className="text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors px-3 py-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              ✕ Close
            </button>
            {/* Tech to Spec Toggle */}
            <button
              onClick={() => setIsTechToSpec(p => !p)}
              title={isTechToSpec ? 'ปิด Tech to Spec' : 'เปิด Tech to Spec Mode'}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                isTechToSpec
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-105'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600'
              }`}
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Tech to Spec</span>
              {isTechToSpec && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={toggleTTS} title={isTTSEnabled ? 'ปิด TTS' : 'เปิด TTS'}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${isTTSEnabled ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              {isTTSEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
              <span className="hidden sm:inline">{isTTSEnabled ? (isSpeaking ? 'Reading...' : 'TTS ON') : 'TTS'}</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-violet-500 via-blue-500 to-cyan-400 p-[2px] shadow-lg shadow-blue-500/20">
                <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                  <Sparkles size={14} className="text-blue-500" />
                </div>
              </div>
              <div>
                <h2 className="text-base font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-violet-500 to-cyan-500">{BOT_NAME}</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest -mt-0.5">Joah Intelligence</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {/* Avatar */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-sm ${m.role === 'user' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-gradient-to-tr from-violet-500 to-blue-500 text-white shadow-blue-500/20'}`}>
                  {m.role === 'user' ? <User size={16} /> : <Sparkles size={14} />}
                </div>
                {/* Bubble */}
                <div className={`text-sm leading-relaxed ${m.role === 'user'
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 px-5 py-3.5 rounded-[1.5rem] rounded-tr-none shadow-sm'
                    : 'text-slate-800 dark:text-slate-100 prose prose-sm dark:prose-invert max-w-none'
                  }`}>
                  {m.imagePreview && <img src={m.imagePreview} alt="attachment" className="max-h-48 rounded-2xl mb-2 border border-slate-200 dark:border-slate-700 object-contain" />}
                  {m.hasFile && (
                    <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-600 text-xs font-bold">
                      <FileText size={12} /> <span>{m.fileName}</span>
                    </div>
                  )}
                  {m.role === 'assistant'
                    ? <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                    : <span>{m.content}</span>
                  }
                  {m.role === 'assistant' && (
                    <button onClick={() => speakText(m.content, true)} className="mt-2 p-1.5 rounded-full text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all" title="ฟังข้อความนี้">
                      <Volume2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && <ThinkingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-5 pb-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
          <div className="max-w-3xl mx-auto relative">
            {attachedFile && <AttachmentBadge file={attachedFile} imagePreview={imagePreview} onRemove={() => { setAttachedFile(null); setFileContent(''); setImagePreview(null); }} />}
            <div className="relative flex items-end bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 rounded-[1.5rem] shadow-lg focus-within:border-blue-400 dark:focus-within:border-blue-600 focus-within:shadow-blue-500/10 transition-all p-2 pl-4 gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.txt,.csv,.png,.jpg,.jpeg,.webp,.gif" className="hidden" />
              <button onClick={() => fileInputRef.current.click()} className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-500 transition-all shrink-0 mb-0.5" title="แนบไฟล์">
                {imagePreview ? <Image size={18} className="text-blue-500" /> : <Paperclip size={18} />}
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="ພິມຂໍ້ຄວາມ... (Shift+Enter ຂຶ້ນບັນທັດໃໝ່, ວາງຮູບ Ctrl+V)"
                rows={1}
                className="flex-1 bg-transparent outline-none text-slate-800 dark:text-white text-sm font-medium resize-none leading-relaxed py-2 scrollbar-hide placeholder:text-slate-400"
                style={{ maxHeight: 160 }}
              />
              <button onClick={handleSend} disabled={isLoading || (!input.trim() && !attachedFile)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shrink-0 mb-0.5 ${(input.trim() || attachedFile) && !isLoading ? 'bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 active:scale-95' : 'text-slate-300 cursor-not-allowed'}`}>
                <Send size={18} />
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-2 font-medium tracking-wide">
              {BOT_NAME} · Joah Intelligence · PNG/Image · Markdown · TTS · วาง Ctrl+V
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBot;
