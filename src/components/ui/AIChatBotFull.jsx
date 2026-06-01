import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, X, Send, Sparkles, LayoutDashboard,
  Paperclip, FileText, Trash2, Volume2, VolumeX, Image, User,
  Plus, Settings, Download, Bot
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JoahLogo from '../../assets/Joah.jpeg';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';
import { supabase } from '../../utils/supabaseClient';

const BOT_NAME = 'Joi';
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || 'sk-14413bf76ea64927854417be978a7a9b';
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// ── Markdown Components (Premium Ambient) ──────────────────────
const mdComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold mt-6 mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-amber-300">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-bold mt-5 mb-3 text-slate-100">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-semibold mt-4 mb-2 text-slate-200">{children}</h3>,
  p: ({ children }) => <p className="mb-4 leading-relaxed text-slate-300">{children}</p>,
  strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-400">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-6 mb-4 space-y-2 marker:text-orange-500 text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 space-y-2 marker:text-orange-500 text-slate-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-orange-500 pl-5 my-5 italic text-slate-400 bg-orange-500/5 py-2 pr-4 rounded-r-2xl">{children}</blockquote>,
  code: ({ inline, children, ...props }) => inline
    ? <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[13px] font-mono text-orange-300 border border-white/5 shadow-sm" {...props}>{children}</code>
    : <div className="rounded-2xl overflow-hidden my-5 border border-white/10 shadow-xl"><div className="bg-black/40 backdrop-blur-md px-4 py-2.5 text-xs font-mono text-slate-400 border-b border-white/5 flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500/80"/><div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"/><div className="w-2.5 h-2.5 rounded-full bg-green-500/80"/><span className="ml-2">Code Snippet</span></div><code className="block bg-[#0a0a0a]/80 backdrop-blur-xl text-emerald-300 p-5 overflow-x-auto text-[13px] leading-relaxed font-mono" {...props}>{children}</code></div>,
  table: ({ children }) => <div className="overflow-x-auto my-5 rounded-2xl border border-white/10 shadow-xl"><table className="w-full text-sm border-collapse bg-white/5 backdrop-blur-sm">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-black/20 border-b border-white/10">{children}</thead>,
  th: ({ children }) => <th className="px-5 py-3.5 text-left font-semibold text-slate-200 uppercase tracking-wider text-[11px]">{children}</th>,
  td: ({ children }) => <td className="px-5 py-3.5 border-b border-white/5 text-slate-300">{children}</td>,
  tr: ({ children }) => <tr className="transition-colors hover:bg-white/5">{children}</tr>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-orange-400 underline decoration-orange-400/30 underline-offset-4 hover:decoration-orange-400 transition-all">{children}</a>,
  hr: () => <hr className="my-8 border-white/10" />,
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

      const fetchDailyRequests = async (branchId = null, date = null) => {
        const d = date ? new Date(date) : new Date();
        const targetDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let query = supabase.from('store_requests')
          .select('*')
          .gte('created_at', `${targetDate}T00:00:00+07:00`)
          .lte('created_at', `${targetDate}T23:59:59+07:00`);

        if (branchId) {
          query = query.eq('branch_id', branchId);
        }

        const { data: requests } = await query.order('created_at', { ascending: false });

        if (!requests?.length) return `No requests found for ${targetDate}${branchId ? ` at branch ${branchId}` : ''}.`;

        let details = `REAL DATA ONLY - Requests for ${targetDate}. Show this data EXACTLY as given. DO NOT rename, translate, or substitute any product names.\n`;
        details += `Total: ${requests.length} requests\n\n`;
        requests.slice(0, 300).forEach((r, i) => {
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
          .gte('created_at', `${from}T00:00:00+07:00`)
          .lte('created_at', `${to}T23:59:59+07:00`)
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

      const fetchLowStockAlerts = async (branchId, threshold = 5) => {
        try {
          let query = supabase
            .from('location_inventory')
            .select('barcode_no, qty, branch_id, rack_location')
            .lte('qty', threshold);

          if (branchId) {
            query = query.eq('branch_id', branchId);
          }

          const { data: invRows, error: invErr } = await query.order('qty', { ascending: true });
          if (invErr) throw invErr;
          if (!invRows || invRows.length === 0) {
            return `ບໍ່ພົບສິນຄ້າທີ່ມີສະຕັອກຕ່ຳກວ່າ ຫຼື ເທົ່າກັບ ${threshold} ໜ່ວຍ.`;
          }

          const barcodes = [...new Set(invRows.map(r => r.barcode_no).filter(Boolean))];
          let namesMap = {};
          if (barcodes.length > 0) {
            const { data: storeRows } = await supabase
              .from('store_inventory')
              .select('barcode_no, item_name')
              .in('barcode_no', barcodes.slice(0, 100));
            if (storeRows) {
              storeRows.forEach(r => {
                namesMap[r.barcode_no] = r.item_name;
              });
            }
          }

          let out = `[LOW STOCK REPORT] (Threshold <= ${threshold}): ${invRows.length} rows found.\n\n`;
          invRows.forEach((r, idx) => {
            const name = namesMap[r.barcode_no] || 'Unknown Product';
            out += `${idx + 1}. สาขา: ${r.branch_id} | Barcode: ${r.barcode_no} | Product: ${name} | Qty: ${r.qty} | Rack: ${r.rack_location || '-'}\n`;
          });
          return out;
        } catch (err) {
          return `Error in get_low_stock_alerts: ${err.message}`;
        }
      };

      const suggestStockTransfers = async () => {
        try {
          const { data: allInv, error: invErr } = await supabase
            .from('location_inventory')
            .select('barcode_no, qty, branch_id, rack_location');
          if (invErr) throw invErr;
          if (!allInv || allInv.length === 0) return "ບໍ່ມີຂໍ້ມູນສະຕັອກໃນລະບົບ.";

          const stockByBarcode = {};
          allInv.forEach(r => {
            if (!r.barcode_no) return;
            if (!stockByBarcode[r.barcode_no]) stockByBarcode[r.barcode_no] = {};
            stockByBarcode[r.barcode_no][r.branch_id] = { qty: r.qty || 0, rack: r.rack_location || '-' };
          });

          const branches = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ'];
          const suggestions = [];

          for (const barcode of Object.keys(stockByBarcode)) {
            const branchesStock = stockByBarcode[barcode];
            for (const targetBranch of branches) {
              const targetQty = branchesStock[targetBranch]?.qty || 0;
              if (targetQty === 0) {
                for (const sourceBranch of branches) {
                  if (sourceBranch === targetBranch) continue;
                  const sourceQty = branchesStock[sourceBranch]?.qty || 0;
                  if (sourceQty >= 10) {
                    const sourceRack = branchesStock[sourceBranch]?.rack || '-';
                    suggestions.push({
                      barcode,
                      sourceBranch,
                      sourceQty,
                      sourceRack,
                      targetBranch,
                      suggestedQty: Math.floor(sourceQty / 2)
                    });
                  }
                }
              }
            }
          }

          if (suggestions.length === 0) {
            return "ບໍ່ພົບຄວາມບໍ່ສົມດຸນຂອງສະຕັອກລະຫວ່າງສາຂາ (ບໍ່ມີການແນະນຳການໂອນຍ້າຍໃນເວລານີ້).";
          }

          const barcodes = [...new Set(suggestions.map(s => s.barcode))];
          let namesMap = {};
          if (barcodes.length > 0) {
            const { data: storeRows } = await supabase
              .from('store_inventory')
              .select('barcode_no, item_name')
              .in('barcode_no', barcodes.slice(0, 50));
            if (storeRows) {
              storeRows.forEach(r => {
                namesMap[r.barcode_no] = r.item_name;
              });
            }
          }

          let out = `[STOCK TRANSFER RECOMMENDATIONS] Suggestions based on stock imbalance:\n\n`;
          suggestions.slice(0, 30).forEach((s, idx) => {
            const name = namesMap[s.barcode] || 'Unknown Product';
            out += `${idx + 1}. Suggest transferring **${s.suggestedQty}** units of "${name}" (Barcode: ${s.barcode})\n`;
            out += `   - FROM: ${s.sourceBranch} (Available: ${s.sourceQty} at Rack ${s.sourceRack})\n`;
            out += `   - TO: ${s.targetBranch} (Current Stock: 0 - Out of Stock!)\n\n`;
          });
          return out;
        } catch (err) {
          return `Error in suggest_stock_transfers: ${err.message}`;
        }
      };

      const getStoreAnalytics = async (days = 30) => {
        try {
          const d = new Date();
          const sinceDate = new Date(d.getTime() - days * 24 * 60 * 60 * 1000);
          const sinceStr = `${sinceDate.getFullYear()}-${String(sinceDate.getMonth() + 1).padStart(2, '0')}-${String(sinceDate.getDate()).padStart(2, '0')}T00:00:00`;

          const { data: requests, error } = await supabase
            .from('store_requests')
            .select('status, branch_id, barcode, product_name, qty')
            .gte('created_at', sinceStr);

          if (error) throw error;
          if (!requests || requests.length === 0) {
            return `ບໍ່ພົບຂໍ້ມູນຄຳຮ້ອງຂໍພາຍໃນ ${days} ວັນທີ່ຜ່ານມາ.`;
          }

          let accepted = 0;
          let rejected = 0;
          let pending = 0;
          const branchCounts = {};
          const productCounts = {};

          requests.forEach(r => {
            if (r.status === 'accepted') accepted++;
            else if (r.status === 'rejected') rejected++;
            else pending++;

            branchCounts[r.branch_id] = (branchCounts[r.branch_id] || 0) + 1;

            const key = `${r.product_name || r.barcode} (${r.barcode})`;
            productCounts[key] = (productCounts[key] || 0) + (r.qty || 1);
          });

          const topProducts = Object.entries(productCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

          const topBranches = Object.entries(branchCounts)
            .sort((a, b) => b[1] - a[1]);

          let out = `[HQ OPERATION ANALYTICS] (Past ${days} Days):\n`;
          out += `- Total requests: ${requests.length}\n`;
          out += `- Accepted: ${accepted} (${Math.round((accepted / requests.length) * 100)}%)\n`;
          out += `- Rejected: ${rejected} (${Math.round((rejected / requests.length) * 100)}%)\n`;
          out += `- Pending: ${pending} (${Math.round((pending / requests.length) * 100)}%)\n\n`;

          out += `Top 5 Requested Products (by Qty):\n`;
          topProducts.forEach((p, idx) => {
            out += `${idx + 1}. ${p[0]} - Total Qty: ${p[1]}\n`;
          });

          out += `\nRequests by Branch:\n`;
          topBranches.forEach((b, idx) => {
            out += `${idx + 1}. สาขา ${b[0]}: ${b[1]} requests\n`;
          });

          return out;
        } catch (err) {
          return `Error in get_store_analytics: ${err.message}`;
        }
      };

      const getSalesAndImportSummary = async (days = 7) => {
        try {
          const d = new Date();
          const sinceDate = new Date(d.getTime() - days * 24 * 60 * 60 * 1000);
          const sinceStr = `${sinceDate.getFullYear()}-${String(sinceDate.getMonth() + 1).padStart(2, '0')}-${String(sinceDate.getDate()).padStart(2, '0')}T00:00:00`;

          const [{ data: salesData, error: salesErr }, { data: dcData, error: dcErr }] = await Promise.all([
            supabase.from('store_sales_log').select('sales_qty, branch_id').gte('import_date', sinceStr),
            supabase.from('store_dc_log').select('imported_qty, branch_id').gte('import_date', sinceStr)
          ]);

          if (salesErr) throw salesErr;
          if (dcErr) throw dcErr;

          const branchSales = {};
          const branchImports = {};

          (salesData || []).forEach(s => {
            branchSales[s.branch_id] = (branchSales[s.branch_id] || 0) + (s.sales_qty || 0);
          });

          (dcData || []).forEach(dc => {
            branchImports[dc.branch_id] = (branchImports[dc.branch_id] || 0) + (dc.imported_qty || 0);
          });

          const allBranches = new Set([...Object.keys(branchSales), ...Object.keys(branchImports)]);

          let out = `[AUDIT: SALES VS DC IMPORTS SUMMARY] (Past ${days} Days):\n\n`;
          out += `| ສາຂາ (Branch) | ຍອດນຳເຂົ້າ DC (DC Imported Qty) | ຍອດຂາຍ (Sold Qty) | ຄວາມຕ່າງ (Discrepancy) |\n`;
          out += `| --- | --- | --- | --- |\n`;
          allBranches.forEach(b => {
            const imported = branchImports[b] || 0;
            const sold = branchSales[b] || 0;
            const diff = imported - sold;
            out += `| ${b} | ${imported} | ${sold} | ${diff > 0 ? '+' : ''}${diff} |\n`;
          });

          return out;
        } catch (err) {
          return `Error in get_sales_and_import_summary: ${err.message}`;
        }
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
            name: "get_store_requests_by_date",
            description: "Get store requests for a specific date (today or any past date). Use when user asks about requests. If user mentions a branch, pass as branch_id. If user mentions a specific date (e.g. 20 May 2026, 20/05/2026), convert to YYYY-MM-DD and pass as date parameter.",
            parameters: {
              type: "object",
              properties: {
                branch_id: { type: "string", description: "Branch name to filter (optional). Use exact Lao name: ຕະຫຼາດລາວ, ສີວິໄລ, ໂພນສີນວນ, or ວັງຊາຍ. Omit to get all branches." },
                date: { type: "string", description: "Date in YYYY-MM-DD format (optional). Defaults to today if omitted. Use when user asks about a past date (e.g. 2026-05-20)." }
              }
            }
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
        },
        {
          type: "function",
          function: {
            name: "get_low_stock_alerts",
            description: "Check for products with low stock levels (below a threshold) in location_inventory. Can be filtered by branch.",
            parameters: {
              type: "object",
              properties: {
                branch_id: { type: "string", description: "Branch name to check (optional)." },
                threshold: { type: "integer", description: "Low stock threshold. Default is 5." }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "suggest_stock_transfers",
            description: "Identify stock imbalances across branches (e.g. 0 qty in one branch but high qty in another) and suggest transfer actions.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "get_store_analytics",
            description: "Get request trends and statistics over the last X days. Useful to analyze accepted/rejected/pending stats and top requested items.",
            parameters: {
              type: "object",
              properties: {
                days: { type: "integer", description: "Number of past days to analyze. Default is 30." }
              }
            }
          }
        },
        {
          type: "function",
          function: {
            name: "get_sales_and_import_summary",
            description: "Get sales and DC import summary by branch over the last X days. Useful for auditing performance.",
            parameters: {
              type: "object",
              properties: {
                days: { type: "integer", description: "Number of past days to check. Default is 7." }
              }
            }
          }
        }
      ];

      const techSpecExtra = isTechToSpec ? `\n\nTECH MODE: Respond as a technical specification.` : '';
      const VALID_BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ'];
      const systemPrompt = `You are ${BOT_NAME}, an autonomous, highly-intelligent Inventory Consultant and AI Assistant for Joah Inventory System.
Today: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
Branches: ${VALID_BRANCHES.join(', ')}.

== STRICT ANTI-HALLUCINATION RULES (CRITICAL) ==
1. ZERO HALLUCINATION / NO FAKE DATA: You are STRICTLY FORBIDDEN from inventing any requests, stock quantities, product names, dates, names, or barcode info.
2. ONLY USE TOOL OUTPUTS: If you do not have data from a tool response, say "ບໍ່ພົບຂໍ້ມູນ" or "I do not have this data". Never guess, approximate, or fabricate.
3. 0 IS 0: If a tool returns 0 records, you must say there are no records. Never generate mock list items or placeholders to satisfy a user query.
4. EXACT COPYING: Copy all numbers, barcodes, names, and statuses EXACTLY as returned by the tools.
5. NO SPECTACLE/NO ASSUMPTION: Do not assume or extrapolate info. If the user asks about an unknown barcode, you must run 'search_product_by_name' or state that it doesn't exist in the database. Never guess.
6. SHOW ALL RECORDS: When listing results from a tool call (such as daily requests, history, or stock), you MUST list every single record returned. Do not select, skip, group, or filter rows (e.g. showing only remaining=0) unless the user explicitly requested such a filter.

== PERSONALITY & STYLE ==
- Speak politely, naturally, and warmly in ${detectedLang} (like Gemini).
- You can greet the user, summarize findings nicely, and offer smart strategic recommendations.
- Present reports with elegant Markdown formatting, tables, bold text, and highlights.
- Avoid sounding robotic. Be helpful and professional.

== AGENTIC THINKING LOOP ==
- You possess advanced tools: stock checks, low stock alerts, stock transfer suggestions, request analytics, and sales audit summaries.
- When the user asks for a summary, reports, health checks, or advice, you should proactively call multiple tools to cross-reference data.
- E.g., if a branch has low stock, check if other branches have surplus using 'check_stock_by_barcode' or 'suggest_stock_transfers' to recommend a smart transfer.

== UI ELEMENTS TO USE ==
- Use GitHub-style highlights/alerts:
  > [!WARNING]
  > For critical warnings like out of stock or negative discrepancies.
  > [!TIP]
  > For actionable recommendations (e.g. transfer suggestions).
  > [!NOTE]
  > For general summaries.

== DATA RULES (STRICT ACCURACY) ==
1. ONLY use data returned by tool calls. Never fabricate, guess, or use training data for product names, quantities, or statuses.
2. If a tool returns no records, state "ບໍ່ພົບຂໍ້ມູນ" (data not found) politely.
3. Copy product names, barcodes, and quantities EXACTLY as returned.
4. When listing daily requests or history, ALWAYS output every single record returned by the tool as a detailed row. You are FORBIDDEN from omitting, truncating, grouping, or selectively filtering rows. Print the entire table. Always include all available columns from the tool data to provide full context:
   - ລຳດັບ (No.)
   - ເວລາ (Time/Date)
   - Barcode
   - ຊື່ສินຄ້າ (Product Name)
   - ຈຳນວນ (Qty)
   - ສະຖານະ (Status)
   - ຜູ້ຮ້ອງຂໍ (Requester - from 'By' field)
   - ຜູ້ອະນຸມັດ (Approver - from 'Approved' field)
5. Never mention DeepSeek, GPT, Gemini, or any AI model name.
6. LARGE DATASET PAGINATION (CRITICAL RULES): You are displaying a large dataset. Each response can only show ~30 rows due to token limit.
   STRICT RULES:
   1. End EVERY response with EXACTLY one of these markers:
      - [[MORE]] if there are more items to show
      - [[DONE]] if this is the last batch
   2. When you receive "continue from row X", you MUST start the NEXT batch at exactly row X. NEVER repeat rows before X.
   3. NEVER add extra text like "type continue" or "more?" after the marker. NO summary between batches.
   4. The system will auto-send "continue from row X" when it sees [[MORE]]. Follow strictly.${techSpecExtra}`;

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
        const apiHistory = messages.slice(-20).map(m => ({ role: m.role, content: typeof m.content === 'string' ? m.content : '' }));
        let apiMessages = [{ role: 'system', content: systemPrompt }, ...apiHistory, { role: 'user', content: fileContent ? `[File: ${userMsg.fileName}]\n${fileContent}\n\n${inputMsg}` : inputMsg }];

        let isDone = false;
        let iters = 0;
        const seenBatches = new Set();
        while (!isDone && iters < 10) {
          iters++;
          const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-v4-flash', messages: apiMessages, tools: tools, temperature: 0.0, max_tokens: 4500 })
          });
          const data = await res.json();
          if (!data.choices?.[0]) throw new Error(data.error?.message || 'DeepSeek error');
          const choice = data.choices[0];
          const finishReason = choice.finish_reason; // 'stop', 'length', 'tool_calls'
          const msg = choice.message;
          apiMessages.push(msg);

          if (msg.tool_calls) {
            for (const toolCall of msg.tool_calls) {
              const fn = toolCall.function.name;
              const args = JSON.parse(toolCall.function.arguments || '{}');
              let content;
              if (fn === "search_product_by_name") content = await searchProductByName(args.keyword);
              else if (fn === "check_stock_by_barcode") content = await fetchStockData(args.barcode);
              else if (fn === "get_store_requests_by_date") content = await fetchDailyRequests(args.branch_id || null, args.date || null);
              else if (fn === "get_request_history_by_barcode") content = await fetchRequestHistoryByBarcode(args.barcode, args.from_date, args.to_date);
              else if (fn === "get_low_stock_alerts") content = await fetchLowStockAlerts(args.branch_id || null, args.threshold || 5);
              else if (fn === "suggest_stock_transfers") content = await suggestStockTransfers();
              else if (fn === "get_store_analytics") content = await getStoreAnalytics(args.days || 30);
              else if (fn === "get_sales_and_import_summary") content = await getSalesAndImportSummary(args.days || 7);
              else content = `Unknown function: ${fn}`;
              apiMessages.push({ role: "tool", tool_call_id: toolCall.id, name: fn, content });
            }
          } else {
            const content = msg.content || '';

            let cleanContent = content.replace('[[MORE]]', '').replace('[[DONE]]', '').trim();
            cleanContent = cleanContent.replace(/ພິມ\s*['"]?ສະແດງຕໍ່['"]?\s*(ເດີ)?/g, '');
            cleanContent = cleanContent.replace(/ຍັງເຫຼືອອີກ.*$/gm, '');
            cleanContent = cleanContent.replace(/ມາແລ້ວ!.*?ເດີ້/g, '');

            // Smart duplicate detection: fingerprint using first 3 row numbers (supports table and list formats)
            const rowNums = cleanContent.match(/^(\d+)[\t\s|\.,]/gm)
              ?.map(s => s.match(/\d+/)?.[0])
              .filter(Boolean)
              .slice(0, 3)
              .join(',') || '';
            const batchKey = rowNums || cleanContent.slice(0, 100);
            if (seenBatches.has(batchKey) && batchKey.length > 0) {
              isDone = true;
              break;
            }
            seenBatches.add(batchKey);

            // wantsMore: check explicit markers, Lao phrases, OR if API cut us off at token limit
            const wasTruncated = finishReason === 'length';
            const wantsMore = wasTruncated || content.includes('[[MORE]]') || content.includes('ສະແດງຕໍ່') || content.includes('ຍັງເຫຼືອອີກ') || content.includes('ຍັງມີລາຍການອີກ');

            if (wantsMore && !content.includes('[[DONE]]')) {
              // Track highest row number seen to tell AI exactly where to continue from
              const allRowNums = cleanContent.match(/^(\d+)[\t\s|\.,]/gm)
                ?.map(s => parseInt(s.match(/\d+/)?.[0] || '0', 10))
                .filter(n => n > 0) || [];
              const lastRowNum = allRowNums.length ? Math.max(...allRowNums) : 0;

              finalAiMsg = { role: 'assistant', content: (finalAiMsg ? finalAiMsg.content + '\n' : '') + cleanContent };
              apiMessages.push({ role: 'assistant', content: cleanContent });
              apiMessages.push({ role: 'user', content: lastRowNum > 0 ? `continue from row ${lastRowNum + 1}` : 'continue' });
            } else {
              isDone = true;
              finalAiMsg = { role: 'assistant', content: (finalAiMsg ? finalAiMsg.content + '\n' : '') + cleanContent };
            }
          }
        }
      }

      if (finalAiMsg) {
        // Post-process: remove duplicate row sections before displaying
        const deduped = (() => {
          const raw = finalAiMsg.content;
          const rowPattern = /^(\d+)\t/gm;
          const seenRows = new Set();
          let cutPosition = -1;
          let match;
          while ((match = rowPattern.exec(raw)) !== null) {
            const rowNum = parseInt(match[1], 10);
            if (seenRows.has(rowNum)) {
              // Walk back to find the nearest section heading (📋 or blank line)
              const sectionStart = raw.lastIndexOf('\n\n', match.index);
              cutPosition = sectionStart > 0 ? sectionStart : match.index;
              break;
            }
            seenRows.add(rowNum);
          }
          return cutPosition > 0 ? raw.substring(0, cutPosition).trim() : raw;
        })();
        setMessages(prev => [...prev, { ...finalAiMsg, content: deduped }]);
        if (isTTSEnabled) speakText(deduped);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `❌ ຂໍອະໄພ, ເກີດຂໍ້ຜິດພາດ: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportExcel = async (content) => {
    try {
      const lines = content.split('\n');
      let tableData = [];
      let headerSignature = null;
      
      for (const line of lines) {
        if (line.trim().startsWith('|')) {
          if (line.replace(/[\s\|\-:]/g, '').length === 0) continue;
          
          let cols = line.split('|')
            .map(c => c.trim())
            .filter((_, i, arr) => i > 0 && i < arr.length - 1); 
            
          cols = cols.map(c => c.replace(/\*\*/g, '').replace(/`/g, ''));

          if (cols.length > 0) {
            const sig = cols.join(',');
            if (!headerSignature) {
              headerSignature = sig;
              tableData.push(cols);
            } else {
              if (sig === headerSignature || sig.includes('Barcode,') || sig.includes('ຊື່ສິນຄ້າ,')) continue;
              tableData.push(cols);
            }
          }
        }
      }

      if (tableData.length === 0) {
        alert('ບໍ່ພົບຕາຕະລາງໃນຂໍ້ຄວາມນີ້');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Data');

      // Add Spacer for Logo
      worksheet.getRow(1).height = 60;
      worksheet.getRow(2).height = 10;
      
      // Fetch and embed the Joah logo
      try {
        const response = await fetch(JoahLogo);
        const buffer = await response.arrayBuffer();
        const logoId = workbook.addImage({
          buffer: buffer,
          extension: 'jpeg',
        });
        
        // Insert logo at A1
        worksheet.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 140, height: 60 }
        });
      } catch (err) {
        console.error("Could not load logo", err);
      }

      // Add Title
      worksheet.mergeCells('B1:F1');
      const titleCell = worksheet.getCell('B1');
      titleCell.value = 'ລາຍງານຂໍ້ມູນສິນຄ້າ / Request Report';
      titleCell.font = { name: 'Phetsarath OT', size: 16, bold: true, color: { argb: 'FFEA580C' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      // Add Data starting at row 3
      tableData.forEach((row, idx) => {
        const excelRow = worksheet.addRow(row);
        const isHeader = idx === 0;
        
        excelRow.eachCell((cell, colNumber) => {
          cell.font = { name: 'Phetsarath OT', size: 11, bold: isHeader };
          cell.alignment = { vertical: 'middle', horizontal: isHeader ? 'center' : 'left' };
          
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };

          if (isHeader) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF1F5F9' }
            };
          }
        });
      });

      // Set column widths
      worksheet.columns.forEach((column, i) => {
        if (i === 0) column.width = 10;
        else if (i === 2) column.width = 40;
        else column.width = 20;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Joi_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
    } catch (err) {
      console.error("Export failed:", err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການສະກັດຂໍ້ມູນລົງ Excel');
    }
  };

  return (
    <div className="w-full flex-1 flex bg-[#030712] relative overflow-hidden animate-in fade-in duration-500 text-slate-300" style={{ fontFamily: "'Phetsarath OT', 'Noto Sans Lao', 'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin-slow { animation: spin-slow 4s linear infinite; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-input { background: rgba(0, 0, 0, 0.2); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3); }
        .mesh-bg { background-image: radial-gradient(at 0% 0%, hsla(28,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 100% 0%, hsla(253,16%,7%,1) 0px, transparent 50%), radial-gradient(at 100% 100%, hsla(333,100%,53%,0.1) 0px, transparent 50%), radial-gradient(at 0% 100%, hsla(22,100%,77%,0.1) 0px, transparent 50%); }
      `}</style>
      
      {/* Ambient Orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full bg-purple-500/5 blur-[100px] pointer-events-none mix-blend-screen" />
      
      {/* Mesh Background Overlay */}
      <div className="absolute inset-0 mesh-bg pointer-events-none opacity-50" />

      {/* Sidebar (Glassmorphic) */}
      <div className={`transition-all duration-500 overflow-hidden glass-panel border-r border-white/5 flex flex-col z-20 ${isSidebarOpen ? 'w-[320px]' : 'w-0'}`}>
        <div className="p-6 flex items-center justify-between">
           <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Chats</div>
           <div className="flex items-center gap-2">
             <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white">
               <LayoutDashboard size={18} />
             </button>
             <button onClick={startNewChat} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-slate-300 hover:text-white border border-white/5 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <Plus size={18} />
             </button>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1.5 px-4 pb-6 scrollbar-hide">
          {chatHistory.map(chat => (
            <div key={chat.id} onClick={() => loadChat(chat)}
              className={`group flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-gradient-to-r from-orange-500/20 to-transparent border-l-2 border-orange-500 text-white' : 'hover:bg-white/5 text-slate-400 hover:text-slate-200 border-l-2 border-transparent'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={16} className={`shrink-0 ${currentChatId === chat.id ? 'text-orange-400' : 'opacity-60'}`} />
                <span className="font-medium text-[13px] truncate">{chat.title}</span>
              </div>
              <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-lg hover:text-red-400 transition-all shrink-0">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        {/* Premium Header */}
        <div className="px-6 py-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5">
            {!isSidebarOpen && (
              <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="p-2.5 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white backdrop-blur-md border border-transparent hover:border-white/10"
              >
                <LayoutDashboard size={20} />
              </button>
            )}
            <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 p-[1px]">
                  <div className="w-full h-full bg-slate-950 rounded-xl flex items-center justify-center">
                     <Sparkles size={18} className="text-orange-400" />
                  </div>
               </div>
               <div>
                 <div className="text-[18px] font-bold text-white tracking-tight leading-none">{BOT_NAME}</div>
                 <div className="text-[11px] font-medium text-orange-400 tracking-widest uppercase mt-1">Intelligence</div>
               </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-black/20 backdrop-blur-md border border-white/5 rounded-2xl p-1.5">
            <button 
              onClick={() => setIsTechToSpec(p => !p)} 
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${isTechToSpec ? 'bg-orange-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
            >
              Tech
            </button>
            <button 
              onClick={toggleTTS} 
              className={`p-2.5 rounded-xl transition-all ${isTTSEnabled ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
            >
              {isTTSEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <button 
              onClick={onBack} 
              className="p-2.5 hover:bg-red-500/20 rounded-xl transition-all text-slate-400 hover:text-red-400"
              title="Close Chat"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 w-full max-w-[960px] mx-auto scrollbar-hide flex flex-col gap-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-700`} style={{ animationDelay: `${i * 0.05}s` }}>
              
              {m.role === 'user' ? (
                // USER MESSAGE (Glassmorphic)
                <div className="max-w-[85%] group">
                  <div className="glass-panel px-6 py-4 rounded-[28px] rounded-br-xl text-[15px] leading-relaxed shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
                    <div className="relative z-10 text-slate-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                    </div>
                    {m.hasFile && (
                      <div className="mt-4 p-3 bg-black/30 rounded-2xl flex items-center gap-3 max-w-full overflow-hidden border border-white/5 relative z-10">
                        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center shrink-0">
                           <FileText size={18} className="text-orange-400" /> 
                        </div>
                        <span className="text-[13px] font-medium text-slate-300 truncate">{m.fileName}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                // AI MESSAGE (Gemini Style but Premium)
                <div className="flex gap-6 w-full">
                  <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-400 via-amber-500 to-rose-500 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)] mt-1 relative">
                    <div className="absolute inset-0 bg-white/20 rounded-2xl animate-pulse" />
                    <Sparkles size={18} className="relative z-10" />
                  </div>
                  <div className="flex-1 min-w-0 pb-2">
                    <div className="text-[15px] leading-[1.8] text-slate-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                    </div>
                    {m.content.includes('|') && m.content.includes('\n|') && (
                      <div className="mt-6 flex">
                        <button 
                          onClick={() => handleExportExcel(m.content)}
                          className="px-5 py-2.5 rounded-xl border border-white/10 hover:border-orange-500/50 hover:bg-orange-500/10 text-[13px] font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2 transition-all shadow-lg backdrop-blur-md"
                        >
                          <Download size={14} /> Export Excel
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-6 w-full animate-in fade-in duration-500">
              <div className="w-10 h-10 rounded-2xl shrink-0 flex items-center justify-center bg-gradient-to-br from-orange-400 to-rose-500 text-white mt-1 shadow-[0_0_20px_rgba(249,115,22,0.3)]">
                <Sparkles size={18} className="animate-spin-slow" />
              </div>
              <div className="flex-1 pt-2.5 flex flex-col gap-4">
                <div className="h-3 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full w-3/4 animate-pulse" />
                <div className="h-3 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full w-2/4 animate-pulse" style={{ animationDelay: '200ms' }} />
                <div className="h-3 bg-gradient-to-r from-slate-700 to-slate-800 rounded-full w-3/5 animate-pulse" style={{ animationDelay: '400ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-6" />
        </div>

        {/* Premium Input Area */}
        <div className="px-4 pb-8 pt-4 w-full max-w-[960px] mx-auto relative z-20">
          <div className="relative">
            {attachedFile && (
              <div className="absolute -top-16 left-6 flex items-center gap-3 bg-slate-900/90 backdrop-blur-xl border border-white/10 rounded-2xl px-4 py-2 shadow-2xl animate-in slide-in-from-bottom-2">
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="w-8 h-8 rounded-lg object-cover border border-white/10" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
                    <FileText size={16} className="text-orange-400" />
                  </div>
                )}
                <div className="flex flex-col max-w-[150px]">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Attached</span>
                  <span className="text-[13px] font-bold text-slate-200 truncate">{attachedFile.name}</span>
                </div>
                <button onClick={() => { setAttachedFile(null); setImagePreview(null); setFileContent(''); }} className="hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-lg text-slate-400 transition-all ml-1">
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div className="glass-input rounded-[32px] p-2 pl-4 flex items-end relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-transparent to-white/5 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
              
              <div className="flex items-center gap-1.5 pb-1.5 relative z-10">
                <button onClick={() => document.getElementById('ai-img-input-full').click()} className="p-3 text-slate-400 hover:bg-white/10 hover:text-white rounded-2xl transition-all shrink-0">
                  <Image size={22} />
                </button>
                <input id="ai-img-input-full" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button onClick={() => document.getElementById('ai-file-input-full').click()} className="p-3 text-slate-400 hover:bg-white/10 hover:text-white rounded-2xl transition-all shrink-0 hidden sm:block">
                  <Paperclip size={22} />
                </button>
                <input id="ai-file-input-full" type="file" className="hidden" onChange={handleFileChange} />
              </div>

              <textarea 
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Message Joi..."
                rows={1}
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-4 py-4 text-[15px] text-white placeholder-slate-500 resize-none max-h-40 scrollbar-hide min-w-0 relative z-10"
              />
              
              <div className="px-2 pb-1.5 shrink-0 relative z-10">
                <button 
                  onClick={handleSend} 
                  disabled={isLoading || (!input.trim() && !attachedFile)} 
                  className={`w-12 h-12 rounded-[20px] flex items-center justify-center transition-all ${
                    (input.trim() || attachedFile) && !isLoading
                      ? 'bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-[0_4px_20px_rgba(249,115,22,0.4)] hover:scale-105 active:scale-95' 
                      : 'bg-white/5 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Send size={20} className={(input.trim() || attachedFile) ? 'ml-1' : ''} />
                </button>
              </div>
            </div>
          </div>
          <div className="text-center mt-4 text-[11px] font-medium text-slate-500 uppercase tracking-widest flex items-center justify-center gap-2">
            <Sparkles size={10} />
            Powered by Gemini & DeepSeek Intelligence
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBotFull;
