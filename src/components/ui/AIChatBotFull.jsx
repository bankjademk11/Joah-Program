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
  h1: ({ children }) => <h1 className="text-xl font-black text-slate-100 mt-4 mb-2 border-b border-slate-800 pb-1">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-black text-slate-100 mt-3 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-bold text-slate-200 mt-2 mb-1">{children}</h3>,
  p: ({ children }) => <p className="mb-2 leading-relaxed text-slate-300">{children}</p>,
  strong: ({ children }) => <strong className="font-black text-white">{children}</strong>,
  em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-slate-300">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-slate-300">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed text-slate-350">{children}</li>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-orange-500 pl-4 my-2 text-slate-400 italic">{children}</blockquote>,
  code: ({ inline, children, ...props }) => inline
    ? <code className="bg-slate-800 text-orange-400 px-1.5 py-0.5 rounded-md text-sm font-mono" {...props}>{children}</code>
    : <code className="block bg-slate-950 text-emerald-400 p-4 rounded-2xl overflow-x-auto text-sm font-mono my-3 border border-slate-800" {...props}>{children}</code>,
  table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse rounded-xl overflow-hidden border border-slate-800">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-gradient-to-r from-orange-600 to-amber-600 text-white">{children}</thead>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-black text-xs uppercase tracking-wider">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 border-b border-slate-800/80 text-slate-300">{children}</td>,
  tr: ({ children }) => <tr className="hover:bg-slate-800/40 transition-colors">{children}</tr>,
  a: ({ href, children }) => <a href={href} target="_blank" rel="noreferrer" className="text-orange-400 underline hover:text-orange-300 transition-colors">{children}</a>,
  hr: () => <hr className="my-4 border-slate-850" />,
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

      const fetchDailyRequests = async (branchId = null) => {
        const d = new Date();
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let query = supabase.from('store_requests')
          .select('*')
          .gte('created_at', `${today}T00:00:00+07:00`)
          .lte('created_at', `${today}T23:59:59+07:00`);
        
        if (branchId) {
          query = query.eq('branch_id', branchId);
        }

        const { data: requests } = await query.order('created_at', { ascending: false });

        if (!requests?.length) return `No requests found for today (${today})${branchId ? ` at branch ${branchId}` : ''}.`;

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
            name: "get_daily_requests",
            description: "Get today's store requests. Use when user asks about today's requests. If user mentions a specific branch name (e.g. ສີວິໄລ, ຕະຫຼາດລາວ, ໂພນສີນວນ, ວັງຊາຍ), pass it as branch_id to filter precisely.",
            parameters: {
              type: "object",
              properties: {
                branch_id: { type: "string", description: "Branch name to filter (optional). Use exact Lao name: ຕະຫຼາດລາວ, ສีວິໄລ, ໂພນສີນວນ, or ວັງຊາຍ. Omit to get all branches." }
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
5. Never mention DeepSeek, GPT, Gemini, or any AI model name.${techSpecExtra}`;

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
            body: JSON.stringify({ model: 'deepseek-chat', messages: apiMessages, tools: tools, temperature: 0.0, max_tokens: 8000 })
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
              else if (fn === "get_daily_requests") content = await fetchDailyRequests(args.branch_id || null);
              else if (fn === "get_request_history_by_barcode") content = await fetchRequestHistoryByBarcode(args.barcode, args.from_date, args.to_date);
              else if (fn === "get_low_stock_alerts") content = await fetchLowStockAlerts(args.branch_id || null, args.threshold || 5);
              else if (fn === "suggest_stock_transfers") content = await suggestStockTransfers();
              else if (fn === "get_store_analytics") content = await getStoreAnalytics(args.days || 30);
              else if (fn === "get_sales_and_import_summary") content = await getSalesAndImportSummary(args.days || 7);
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
    <div className="w-full h-screen flex bg-[#0b0f19] animate-in fade-in duration-300">
      <style>{`
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
        @keyframes eye-blink { 0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.1)} }
        .animate-spin-slow { animation: spin 8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      {/* Sidebar */}
      <div className={`transition-all duration-500 overflow-hidden bg-[#0d131f] border-r border-slate-800 flex flex-col ${isSidebarOpen ? 'w-72 p-5 shadow-2xl shadow-blue-500/5' : 'w-0 p-0'}`}>
          <div className="flex items-center justify-between mb-6 whitespace-nowrap">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Memory Vault</h3>
            <button onClick={startNewChat} className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95">
              <Plus size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide px-1">
            {chatHistory.map(chat => (
              <div key={chat.id} onClick={() => loadChat(chat)}
                className={`group p-4 rounded-[1.5rem] cursor-pointer transition-all border ${currentChatId === chat.id ? 'bg-slate-800/80 border-slate-700 shadow-md' : 'border-transparent hover:bg-slate-900/60 hover:border-slate-800'}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${currentChatId === chat.id ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                      <MessageSquare size={14} />
                    </div>
                    <span className={`font-bold text-xs truncate ${currentChatId === chat.id ? 'text-white' : 'text-slate-450'}`}>{chat.title}</span>
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
        className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-[#0f172a]"
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
        <div className="bg-[#0b0f19] border-b border-slate-800/80 px-[14px] py-[7px] flex gap-2 items-center shrink-0 overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setIsTechToSpec(p => !p)} 
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 ${isTechToSpec ? 'bg-[#f97316] text-white border-transparent' : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750'}`}
          >
            Tech Mode
          </button>
          <button 
            onClick={toggleTTS} 
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 ${isTTSEnabled ? 'bg-[#ea580c] text-white border-transparent' : 'bg-slate-800 text-slate-350 border-slate-700 hover:bg-slate-750'}`}
          >
            {isTTSEnabled ? 'Audio ON' : 'Audio OFF'}
          </button>
          <div className="ml-auto text-[11px] text-slate-500 font-semibold shrink-0">
            Active
          </div>
        </div>

        {/* Messages */}
        <div 
          className={`flex-1 overflow-y-auto space-y-4 scrollbar-hide relative z-10 px-4 py-3 sm:px-6 sm:py-4`}
          style={{
            background: 'linear-gradient(180deg, #0b0f19 0%, #0f172a 100%)',
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
                      : 'bg-[#1e293b] text-slate-100 rounded-[18px] rounded-bl-[4px] border border-slate-800'
                    }`}
                    style={{
                      background: m.role === 'user' ? 'linear-gradient(135deg, #f97316, #ea580c)' : undefined,
                      boxShadow: m.role === 'user' ? '0 4px 14px rgba(249,115,22,0.28)' : '0 2px 8px rgba(0,0,0,0.2)',
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
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest px-2">{m.role === 'user' ? 'You' : BOT_NAME}</span>
                </div>
              </div>
            </div>
          ))}
          {isLoading && <ThinkingDots />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800 bg-[#0b0f19] relative z-10 w-full px-4 py-3">
          <div className="max-w-4xl mx-auto relative w-full">
            {attachedFile && <AttachmentBadge file={attachedFile} imagePreview={imagePreview} onRemove={() => { setAttachedFile(null); setImagePreview(null); setFileContent(''); }} />}
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center bg-[#1e293b] border border-slate-750 rounded-[20px] px-3.5 py-1.5 flex-1 min-w-0">
                <input 
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="ຖາມ Joi ສິ່ງໃດກໍໄດ້..."
                  className="flex-1 bg-transparent border-none outline-none focus:ring-0 p-0 text-[13px] text-slate-100 placeholder-slate-500 min-w-0"
                />
                
                {/* File Attachment Buttons inside input area */}
                <div className="flex items-center gap-1.5 ml-2">
                  <button onClick={() => document.getElementById('ai-file-input').click()} className="p-1 text-slate-400 hover:text-orange-400 transition-colors shrink-0">
                    <Paperclip size={16} />
                  </button>
                  <input id="ai-file-input" type="file" className="hidden" onChange={handleFileChange} />
                  <button onClick={() => document.getElementById('ai-img-input').click()} className="p-1 text-slate-400 hover:text-orange-400 transition-colors shrink-0">
                    <Image size={16} />
                  </button>
                </div>
              </div>

              <button 
                onClick={handleSend} 
                disabled={isLoading || (!input.trim() && !attachedFile)} 
                className="w-10 h-10 rounded-full border-none flex items-center justify-center transition-all shrink-0"
                style={{
                  background: (input.trim() || attachedFile) ? 'linear-gradient(135deg, #f97316, #ea580c)' : '#1e293b',
                  cursor: (input.trim() || attachedFile) ? 'pointer' : 'default',
                  boxShadow: (input.trim() || attachedFile) ? '0 4px 12px rgba(249,115,22,0.4)' : 'none',
                }}
              >
                <Send size={16} className={(input.trim() || attachedFile) ? 'text-white' : 'text-slate-500'} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBotFull;
