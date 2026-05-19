import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, X, Send, Sparkles, LayoutDashboard,
  Paperclip, FileText, Trash2, Volume2, VolumeX, Image, User,
  Plus, Settings
} from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';
import { supabase } from '../../utils/supabaseClient';

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
  code: ({ inline, children, ...props }) => inline
    ? <code className="bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>{children}</code>
    : <code className="block bg-slate-900 dark:bg-slate-950 text-green-400 p-4 rounded-2xl overflow-x-auto text-sm font-mono my-3 border border-slate-700" {...props}>{children}</code>,
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
    <div className="flex flex-col overflow-hidden mr-2">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Attachment</span>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{file.name}</span>
    </div>
    <button onClick={onRemove} className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-900/30 text-slate-400 hover:text-rose-500 rounded-full transition-all">
      <Trash2 size={14} />
    </button>
  </div>
);

const AIChatBotFull = ({ onBack, currentUser }) => {
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

  // ── Send Message ──────────────────────────────────────────
  const handleSend = async () => {
    const inputMsg = input.trim();
    if (!inputMsg && !attachedFile) return;

    const userMsg = { role: 'user', content: inputMsg, hasFile: !!attachedFile, fileName: attachedFile?.name, imagePreview };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachedFile(null);
    setImagePreview(null);
    setIsLoading(true);

    try {
      // --- TOOL FUNCTIONS DEFINITIONS ---
      const fetchStockData = async (barcode) => {
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
      };

      const searchProductByName = async (keyword) => {
        const { data: storeData } = await supabase.from('store_inventory')
          .select('barcode_no, item_name')
          .ilike('item_name', `%${keyword}%`)
          .limit(10);
        
        if (!storeData || storeData.length === 0) return `No products found matching '${keyword}'.`;
        
        const uniqueProducts = [];
        const seen = new Set();
        storeData.forEach(p => {
          if (!seen.has(p.barcode_no)) {
            seen.add(p.barcode_no);
            uniqueProducts.push(p);
          }
        });

        let res = `Found ${uniqueProducts.length} products matching '${keyword}':\n`;
        uniqueProducts.forEach((p, i) => {
          res += `${i + 1}. Barcode: ${p.barcode_no} | Name: ${p.item_name}\n`;
        });
        res += `\nIMPORTANT: Use one of these barcodes to call check_stock_by_barcode or get_request_history_by_barcode.`;
        return res;
      };

      const fetchDailyRequests = async () => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const { data: requests } = await supabase.from('store_requests')
          .select('*')
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`)
          .order('created_at', { ascending: false });

        if (!requests?.length) return `No requests found for today (${today}).`;

        let details = `REAL DATA ONLY - Requests for ${today}. Show this data EXACTLY as given. DO NOT rename, translate, or substitute any product names.\n`;
        details += `Total: ${requests.length} requests\n\n`;
        requests.slice(0, 50).forEach((r, i) => {
          const stockBefore = r.stock_at_request ?? '-';
          const remaining = (r.stock_at_request != null && r.qty != null) ? r.stock_at_request - r.qty : '-';
          details += `${i + 1}. DocNo: ${r.doc_no || '-'} | Branch: ${r.branch_id} | Barcode: ${r.barcode || 'N/A'} | Product: ${r.product_name || r.barcode || 'N/A'} | Requested: ${r.qty} | Stock@Request: ${stockBefore} | Remaining: ${remaining} | Status: ${r.status} | RequestBy: ${r.request_by} | ApprovedBy: ${r.accepted_by || '-'}\n`;
        });
        return details;
      };

      const fetchRequestHistoryByBarcode = async (barcode, fromDate, toDate) => {
        const d = new Date();
        const defaultTo = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const defaultFrom = new Date(d.getTime() - 90 * 24 * 60 * 60 * 1000);
        const defaultFromStr = `${defaultFrom.getFullYear()}-${String(defaultFrom.getMonth() + 1).padStart(2, '0')}-${String(defaultFrom.getDate()).padStart(2, '0')}`;
        const from = fromDate || defaultFromStr;
        const to = toDate || defaultTo;

        const { data: records, error } = await supabase.from('store_requests')
          .select('*')
          .eq('barcode', barcode)
          .gte('created_at', `${from}T00:00:00`)
          .lte('created_at', `${to}T23:59:59`)
          .order('created_at', { ascending: false });

        if (error) return `Error fetching history: ${error.message}`;
        if (!records?.length) return `No request history found for barcode ${barcode} between ${from} and ${to}.`;

        let out = `Request history for barcode ${barcode} (${from} to ${to}): ${records.length} records found.\n\n`;
        records.forEach((r, i) => {
          const stockBefore = r.stock_at_request ?? '-';
          const remaining = (r.stock_at_request != null && r.qty != null) ? r.stock_at_request - r.qty : '-';
          const date = new Date(r.created_at).toLocaleDateString('en-GB');
          out += `${i + 1}. Date: ${date} | DocNo: ${r.doc_no || '-'} | Branch: ${r.branch_id} | Product: ${r.product_name || r.barcode} | Requested: ${r.qty} | Stock@Request: ${stockBefore} | Remaining: ${remaining} | Status: ${r.status} | By: ${r.request_by}\n`;
        });
        return out;
      };

      const tools = [
        {
          type: "function",
          function: {
            name: "search_product_by_name",
            description: "Search for a product's barcode by its name. Use this FIRST when the user asks about a product by name but doesn't provide a barcode. You can then use the returned barcode in other tools.",
            parameters: { type: "object", properties: { keyword: { type: "string", description: "The product name or keyword to search for" } }, required: ["keyword"] }
          }
        },
        {
          type: "function",
          function: {
            name: "check_stock_by_barcode",
            description: "Check real-time stock balance for a product barcode across all branches.",
            parameters: { type: "object", properties: { barcode: { type: "string" } }, required: ["barcode"] }
          }
        },
        {
          type: "function",
          function: {
            name: "get_daily_requests",
            description: "Get today's store requests. Use ONLY when user asks about today's requests.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "get_request_history_by_barcode",
            description: "Get historical request records for a specific barcode over a date range. Use when user asks about past requests, history, or how many times an item was requested. If no dates given, default to last 90 days.",
            parameters: {
              type: "object",
              properties: {
                barcode: { type: "string", description: "The product barcode" },
                from_date: { type: "string", description: "Start date in YYYY-MM-DD format (optional)" },
                to_date: { type: "string", description: "End date in YYYY-MM-DD format (optional)" }
              },
              required: ["barcode"]
            }
          }
        }
      ];

      const techSpecExtra = isTechToSpec ? `\n\nTECH MODE: Respond as a technical specification.` : '';
      const VALID_BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ'];
      const systemPrompt = `You are ${BOT_NAME}, a data-accurate AI assistant for Joah Inventory.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Branches: ${VALID_BRANCHES.join(', ')}.

CRITICAL RULES — READ CAREFULLY:
1. TOOL DATA IS LAW: Every product name, barcode, qty, and status you report MUST come from the tool result verbatim. Copy the text exactly.
2. ZERO HALLUCINATION: You are FORBIDDEN from using your own knowledge to fill in or rename product names. If the tool says 'Product: ຄັນຮົ່ມ /4842', you must say 'ຄັນຮົ່ມ /4842' — not 'umbrella', not 'C-VIT', not anything else.
3. MISSING DATA = SAY SO: If a field is 'N/A' or '-', say it is not available. Never substitute.
4. FORMAT LIKE HQ: Present requests in a clear table with columns: # | Doc | Branch | Barcode | Product | Qty Requested | Stock Before | Remaining | Status | Approved By
5. Reply in ${detectedLang}.

Never mention DeepSeek.${techSpecExtra}`;

      let finalAiMsg;

      if (userMsg.imagePreview && GEMINI_API_KEY) {
        // --- Gemini (Images) ---
        const base64Data = userMsg.imagePreview.split(',')[1] || '';
        const mimeType = userMsg.imagePreview.split(';')[0].split(':')[1] || 'image/png';
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: `${systemPrompt}\n\nQuestion: ${inputMsg}` }, { inline_data: { mime_type: mimeType, data: base64Data } }] }] })
        });
        const data = await res.json();
        if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
          finalAiMsg = { role: 'assistant', content: data.candidates[0].content.parts[0].text };
        } else throw new Error('Gemini failed');
      } else {
        // --- DeepSeek (Text + Tools) ---
        const apiHistory = messages.slice(-10).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
        let apiMessages = [{ role: 'system', content: systemPrompt }, ...apiHistory, { role: 'user', content: fileContent ? `[File: ${userMsg.fileName}]\n${fileContent}\n\n${inputMsg}` : inputMsg }];

        let isDone = false;
        let iters = 0;
        while (!isDone && iters < 5) {
          iters++;
          const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: apiMessages, tools: tools, temperature: 0.1 })
          });
          const data = await res.json();
          if (!data.choices?.[0]) throw new Error(data.error?.message || 'DeepSeek error');
          const msg = data.choices[0].message;
          apiMessages.push(msg);

          if (msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              const fn = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments || '{}');
              let content;
              if (fn === "search_product_by_name") content = await searchProductByName(args.keyword);
              else if (fn === "check_stock_by_barcode") content = await fetchStockData(args.barcode);
              else if (fn === "get_daily_requests") content = await fetchDailyRequests();
              else if (fn === "get_request_history_by_barcode") content = await fetchRequestHistoryByBarcode(args.barcode, args.from_date, args.to_date);
              else content = `Unknown function: ${fn}`;
              apiMessages.push({ role: "tool", tool_call_id: toolCall.id, name: fn, content });
            }
          } else {
            isDone = true;
            finalAiMsg = msg;
          }
        }
      }

      if (finalAiMsg) {
        setMessages(prev => [...prev, finalAiMsg]);
        if (isTTSEnabled) speakText(finalAiMsg.content);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ຂໍອະໄພ, ເກີດຂໍ້ຜິດພາດ: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex bg-slate-50 dark:bg-slate-950 animate-in fade-in duration-300">
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes eye-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      <div className={`transition-all duration-500 overflow-hidden bg-white/80 dark:bg-slate-900/90 backdrop-blur-2xl border-r border-slate-200/60 dark:border-slate-800/60 flex flex-col ${isSidebarOpen ? 'w-72 p-5 shadow-2xl shadow-blue-500/5' : 'w-0 p-0'}`}>
          <div className="flex items-center justify-between mb-6 whitespace-nowrap">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Memory Vault</h3>
            <button onClick={startNewChat} className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95">
              <Plus size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide px-1">
            {chatHistory.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat)}
                className={`group p-4 rounded-[1.5rem] cursor-pointer transition-all border ${currentChatId === chat.id ? 'bg-white/80 dark:bg-blue-600/20 border-blue-200 dark:border-blue-700/50 shadow-md' : 'border-transparent hover:bg-white/50 dark:hover:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${currentChatId === chat.id ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                      <MessageSquare size={14} />
                    </div>
                    <span className={`font-bold text-xs truncate ${currentChatId === chat.id ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{chat.title}</span>
                  </div>
                  <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:text-rose-500 transition-all text-slate-400 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* Main Container */}
      <div 
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-white dark:bg-slate-900"
        style={{
          fontFamily: "'Noto Sans Lao', 'IBM Plex Sans', sans-serif"
        }}
      >
        {/* Animated Background Blobs */}
        <div className="absolute top-[-10%] right-[-10%] w-64 h-64 bg-orange-400/5 blur-[100px] rounded-full pointer-events-none animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-64 h-64 bg-amber-400/5 blur-[100px] rounded-full pointer-events-none animate-pulse" style={{ animationDelay: '2s' }} />

        {/* Premium Orange Header */}
        <div 
          className="px-6 py-4 flex items-center justify-between shrink-0 relative overflow-hidden z-10"
          style={{
            background: 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #ea580c 100%)',
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-6 -right-4 w-20 h-20 rounded-full bg-white/10 pointer-events-none" />
          <div className="absolute -bottom-3 right-[50px] w-[50px] h-[50px] rounded-full bg-white/7% pointer-events-none" />

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(p => !p)} 
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all shadow-sm shrink-0"
            >
              <LayoutDashboard size={18} />
            </button>

            {/* Avatar block */}
            <div 
              className="w-[42px] h-[42px] rounded-full bg-white/20 border-2 border-white/45 flex items-center justify-center text-xl shrink-0 shadow-lg relative overflow-hidden"
            >
              {/* JOI PET FACE inside avatar */}
              <svg viewBox="0 0 100 100" className={`w-8 h-8 text-white ${isLoading ? 'animate-bounce' : ''}`}>
                <g className="fill-white">
                  <circle cx="35" cy="45" r="6" className={isLoading ? 'animate-pulse' : 'animate-[eye-blink_4s_infinite]'} />
                  <circle cx="65" cy="45" r="6" className={isLoading ? 'animate-pulse' : 'animate-[eye-blink_4s_infinite]'} />
                </g>
                <path d={isLoading ? "M 35 65 Q 50 75 65 65" : "M 35 65 Q 50 70 65 65"} fill="none" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
              </svg>
            </div>

            {/* Info details */}
            <div className="text-left">
              <div className="text-white font-bold text-[15px] tracking-wide leading-none">{BOT_NAME} AI</div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-[7px] h-[7px] rounded-full bg-[#4ade80] shadow-[0_0_0_2px_rgba(74,222,128,0.35)] shrink-0 animate-pulse" />
                <span className="text-white/85 text-[11px] font-medium leading-none">
                  Online · ຜູ້ຊ່ວຍສິນຄ້າຄົງຄັງ
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 relative z-20">
            <button 
              onClick={onBack} 
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, lineHeight: 1,
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.32)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.18)'}
              title="Back to Admin Menu"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Dynamic Status / Mode Chips Bar */}
        <div className="bg-[#fff7ed] dark:bg-orange-950/10 border-b border-[#fed7aa] dark:border-orange-900/30 px-[14px] py-[7px] flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setIsTechToSpec(p => !p)} 
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 ${isTechToSpec ? 'bg-[#f97316] text-white border-transparent' : 'bg-orange-500/10 dark:bg-orange-500/5 text-[#ea580c] border-[#fed7aa] dark:border-orange-900/30'}`}
          >
            Tech Mode
          </button>
          <button 
            onClick={toggleTTS} 
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 ${isTTSEnabled ? 'bg-[#ea580c] text-white border-transparent' : 'bg-orange-500/10 dark:bg-orange-500/5 text-[#ea580c] border-[#fed7aa] dark:border-orange-900/30'}`}
          >
            {isTTSEnabled ? 'Audio ON' : 'Audio OFF'}
          </button>
          <div className="ml-auto text-[11px] text-[#9ca3af] dark:text-[#9ca3af]/60 font-semibold shrink-0">
            Active
          </div>
        </div>

        {/* Messages */}
        <div 
          className={`flex-1 overflow-y-auto space-y-4 scrollbar-hide relative z-10 px-4 py-3 sm:px-6 sm:py-4`}
          style={{
            background: 'linear-gradient(180deg, #fff9f5 0%, #fff 60%)',
          }}
        >
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`} style={{ animationDelay: `${i * 0.1}s` }}>
              <div className={`flex gap-2 sm:gap-3 w-full max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                
                {/* Robot Avatar for Assistant messages */}
                {m.role !== 'user' && (
                  <div className="w-[28px] h-[28px] rounded-full shrink-0 flex items-center justify-center text-xs shadow-md" style={{ background: 'linear-gradient(135deg, #f97316, #c2410c)' }}>
                    🤖
                  </div>
                )}

                <div className={`flex flex-col gap-1 flex-1 min-w-0 ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div 
                    className={`px-[13px] py-[9px] text-[13px] leading-[1.6] shadow-sm max-w-full overflow-x-auto transition-all ${m.role === 'user' 
                      ? 'text-white rounded-[18px] rounded-br-[4px]' 
                      : 'bg-white dark:bg-slate-800 text-slate-850 dark:text-slate-100 rounded-[18px] rounded-bl-[4px] border border-[#fed7aa] dark:border-slate-700/50'
                    }`}
                    style={{
                      background: m.role === 'user' ? 'linear-gradient(135deg, #f97316, #ea580c)' : undefined,
                      boxShadow: m.role === 'user' ? '0 4px 14px rgba(249,115,22,0.28)' : '0 2px 8px rgba(0,0,0,0.07)',
                    }}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                    {m.hasFile && (
                      <div className="mt-3 p-2 bg-white/10 rounded-xl flex items-center gap-2 border border-white/20 max-w-full overflow-hidden">
                        <FileText size={14} className="shrink-0" /> 
                        <span className="text-[10px] font-bold truncate">{m.fileName}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-2">{m.role === 'user' ? 'You' : BOT_NAME}</span>
                </div>
              </div>
            </div>
          ))}
          {isLoading && <ThinkingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-[#fed7aa] dark:border-slate-800 bg-white relative z-10 w-full px-4 py-3">
          <div className="max-w-4xl mx-auto relative w-full">
            {attachedFile && <AttachmentBadge file={attachedFile} imagePreview={imagePreview} onRemove={() => { setAttachedFile(null); setImagePreview(null); setFileContent(''); }} />}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center bg-[#fff7ed] dark:bg-slate-800 border-[1.5px] border-[#fed7aa] dark:border-orange-900/30 rounded-[20px] px-3.5 py-1.5 flex-1 min-w-0">
                <input 
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="ຖາມ Joi ສິ່ງໃດກໍໄດ້..."
                  className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 text-[13px] color-[#374151] dark:text-white placeholder-slate-400 min-w-0"
                />
                
                {/* File Attachment Buttons inside input area */}
                <div className="flex items-center gap-1.5 ml-2">
                  <button onClick={() => document.getElementById('ai-file-input').click()} className="p-1 text-slate-400 hover:text-orange-500 transition-colors shrink-0">
                    <Paperclip size={16} />
                  </button>
                  <input id="ai-file-input" type="file" className="hidden" onChange={handleFileChange} />
                  <button onClick={() => document.getElementById('ai-img-input').click()} className="p-1 text-slate-400 hover:text-orange-500 transition-colors shrink-0">
                    <Image size={16} />
                  </button>
                </div>
              </div>

              <button 
                onClick={handleSend} 
                disabled={isLoading || (!input.trim() && !attachedFile)} 
                className="w-10 h-10 rounded-full border-none flex items-center justify-center transition-all shrink-0"
                style={{
                  background: (input.trim() || attachedFile) ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#f3f4f6',
                  cursor: (input.trim() || attachedFile) ? 'pointer' : 'default',
                  boxShadow: (input.trim() || attachedFile) ? '0 4px 12px rgba(249,115,22,0.4)' : 'none',
                }}
              >
                <Send size={16} className={(input.trim() || attachedFile) ? 'text-white' : 'text-[#9ca3af]'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBotFull;
