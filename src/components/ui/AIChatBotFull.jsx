import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  MessageSquare, X, Send, Sparkles, PanelLeft, Paperclip, FileText, Trash2,
  Volume2, VolumeX, Image as ImageIcon, Plus, Download, RefreshCw, Check, Copy,
  ArrowDown, Brain, AlertTriangle, RotateCcw, ChevronDown, Calculator,
  FileSpreadsheet, Languages, PenLine
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import JoahLogo from '../../assets/Joah.jpeg';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';
import { askJoi, ZeroGPUQuotaError, isZeroGPUQuotaError } from '../../services/joiApi';

const BOT_NAME = 'Joi';
const MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash'; // gemini-1.5-flash ຖືກຢຸດໃຫ້ບໍລິການແລ້ວ
const HISTORY_KEY = 'joah_ai_history';

const SUGGESTIONS = [
  { icon: Calculator, title: 'ຄິດໄລ່ສະຕັອກຄົງເຫຼືອ', sub: 'ຄິດໄລ່ຈຳນວນສິນຄ້າທີ່ເຫຼືອໃນສາງ' },
  { icon: FileSpreadsheet, title: 'ສະຫຼຸບລາຍງານຈາກ Excel', sub: 'ແນບໄຟລ໌ແລ້ວໃຫ້ Joi ວິເຄາະ' },
  { icon: Languages, title: 'ແປພາສາ ລາວ - ອັງກິດ', sub: 'ແປຂໍ້ຄວາມ ຫຼື ເອກະສານສັ້ນໆ' },
  { icon: PenLine, title: 'ຊ່ວຍຮ່າງຂໍ້ຄວາມເຖິງຊັບພລາຍເອີ', sub: 'ຮ່າງອີເມລ ຫຼື ຂໍ້ຄວາມທາງການ' },
];

// ── Helpers ──────────────────────────────────────────────────
const fmtTime = (ts) =>
  ts ? new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';

const toFriendlyError = (err) => {
  const msg = err?.message || '';
  if (/No endpoint matching/i.test(msg))
    return { title: 'ລະບົບ AI ຍັງຕັ້ງຄ່າບໍ່ສົມບູນ', hint: 'ກະລຸນາແຈ້ງທີມ IT ເພື່ອກວດສອບການເຊື່ອມຕໍ່ກັບ Joi', detail: msg };
  if (/network|fetch|failed|timeout/i.test(msg))
    return { title: 'ເຊື່ອມຕໍ່ອິນເຕີເນັດບໍ່ໄດ້', hint: 'ກວດສອບເຄືອຂ່າຍ ແລ້ວລອງໃໝ່ອີກຄັ້ງ', detail: msg };
  return { title: 'ບໍ່ສາມາດຕອບໄດ້ໃນຂະນະນີ້', hint: 'ກະລຸນາລອງໃໝ່ອີກຄັ້ງ', detail: msg };
};

// ── Markdown ─────────────────────────────────────────────────
const mdComponents = {
  h1: ({ children }) => <h1 className="joi-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="joi-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="joi-h3">{children}</h3>,
  p: ({ children }) => <p className="joi-p">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-[#fff4e8]">{children}</strong>,
  em: ({ children }) => <em className="italic text-[#d9c9b8]">{children}</em>,
  ul: ({ children }) => <ul className="joi-list list-disc">{children}</ul>,
  ol: ({ children }) => <ol className="joi-list list-decimal">{children}</ol>,
  li: ({ children }) => <li className="leading-[1.75]">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-orange-500/70 pl-4 my-4 py-2 pr-4 text-[#d9c9b8] bg-orange-500/[0.06] rounded-r-xl text-[15px]">
      {children}
    </blockquote>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children, ...props }) => {
    const isBlock = /language-/.test(className || '') || String(children).includes('\n');
    return isBlock ? (
      <div className="rounded-xl overflow-hidden my-4 border border-white/10">
        <div className="bg-black/40 px-4 py-2 text-[11px] font-mono text-[#a8988a] border-b border-white/10">
          {(className || '').replace('language-', '') || 'code'}
        </div>
        <code className="block bg-[#0a0807] text-[#ffd9b3] p-4 overflow-x-auto text-[13px] leading-relaxed font-mono" {...props}>
          {children}
        </code>
      </div>
    ) : (
      <code className="bg-white/10 px-1.5 py-0.5 rounded-md text-[13px] font-mono text-orange-300" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-white/10">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-white/[0.06]">{children}</thead>,
  th: ({ children }) => (
    <th className="px-4 py-3 text-left font-semibold text-orange-300 text-[13px] whitespace-nowrap">{children}</th>
  ),
  td: ({ children }) => (
    <td className="px-4 py-2.5 border-t border-white/5 text-[#e6d9cb] text-[13px]">{children}</td>
  ),
  tr: ({ children }) => <tr className="hover:bg-white/[0.03]">{children}</tr>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-orange-400 underline decoration-orange-400/40 underline-offset-4 hover:text-orange-300">
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
};

// ── Small components ─────────────────────────────────────────
const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={handleCopy}
      aria-label="ຄັດລອກ"
      title="ຄັດລອກ"
      className="p-1.5 rounded-lg text-[#8f8073] hover:text-[#f3ece4] hover:bg-white/10 transition-colors"
    >
      {copied ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
    </button>
  );
};

const ErrorBubble = ({ title, hint, detail, onRetry }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.08] p-5 max-w-xl">
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-rose-500/15 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-rose-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-rose-100">{title}</p>
          <p className="text-[13px] text-[#b5a596] mt-1">{hint}</p>
          <div className="flex items-center gap-4 mt-3.5">
            <button
              onClick={onRetry}
              className="px-3.5 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 text-[13px] font-semibold flex items-center gap-2 transition-colors"
            >
              <RotateCcw size={13} /> ລອງໃໝ່
            </button>
            {detail && (
              <button
                onClick={() => setOpen(!open)}
                className="text-[12px] text-[#8f8073] hover:text-[#d9c9b8] flex items-center gap-1 transition-colors"
              >
                ລາຍລະອຽດ <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
          {open && (
            <pre className="mt-3 p-3 rounded-lg bg-black/40 text-[11px] text-[#a8988a] whitespace-pre-wrap break-all max-h-36 overflow-auto">
              {detail}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main ─────────────────────────────────────────────────────
const AIChatBotFull = ({ onBack, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [attachedFile, setAttachedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [deepThinking, setDeepThinking] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const { language } = useLanguage();

  const userName = currentUser?.name || currentUser?.user_metadata?.full_name || 'ທ່ານ';

  // ── TTS ────────────────────────────────────────────────────
  const speakText = (text) => {
    if (!isTTSEnabled || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const clean = text.replace(/[*#`_|]/g, '');
    const ut = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();
    const hasLao = voices.some(v => v.lang?.toLowerCase().startsWith('lo'));
    ut.lang = language === 'la' && hasLao ? 'lo-LA' : 'th-TH';
    ut.rate = 1.0;
    window.speechSynthesis.speak(ut);
  };
  const stopSpeaking = () => window.speechSynthesis?.cancel();
  const toggleTTS = () => {
    if (isTTSEnabled) stopSpeaking();
    setIsTTSEnabled(!isTTSEnabled);
  };

  // ── Chat history ───────────────────────────────────────────
  const makeWelcome = () => ({ role: 'assistant', isWelcome: true, content: '', ts: Date.now() });

  const startNewChat = () => {
    setCurrentChatId(Date.now().toString());
    stopSpeaking();
    setMessages([makeWelcome()]);
    setAttachedFile(null);
    setFileContent('');
    setImagePreview(null);
  };

  useEffect(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setChatHistory(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
          setMessages(parsed[0].messages);
          return;
        }
      } catch { /* fall through */ }
    }
    startNewChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentChatId || messages.length === 0) return;
    const hasUserMsg = messages.some(m => m.role === 'user');
    if (!hasUserMsg) return; // ບໍ່ບັນທຶກແຊັດເປົ່າ
    // ບໍ່ບັນທຶກ streaming placeholder ແລະ error ລົງ history
    const clean = messages.filter(m => !m._streaming && !m.isError);
    const title = messages.find(m => m.role === 'user')?.content?.substring(0, 36) || 'ການສົນທະນາໃໝ່';
    setChatHistory(prev => {
      const exists = prev.some(c => c.id === currentChatId);
      const updated = exists
        ? prev.map(c => (c.id === currentChatId ? { ...c, messages: clean, title } : c))
        : [{ id: currentChatId, messages: clean, title }, ...prev];
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const loadChat = (chat) => {
    stopSpeaking();
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setAttachedFile(null);
    setFileContent('');
    setImagePreview(null);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    const updated = chatHistory.filter(c => c.id !== id);
    setChatHistory(updated);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
    if (currentChatId === id) startNewChat();
  };

  // ── Scroll ─────────────────────────────────────────────────
  const isAutoScrollLockedRef = useRef(true);

  const scrollToBottom = useCallback((behavior = 'auto') => {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // เลื่อนจอเมื่อ messages เปลี่ยน แต่ใช้ auto (ไม่ใช้ smooth) ตอน streaming เพื่อไม่ให้ตีกับ animation จนจอกระตุก
  useEffect(() => {
    if (isAutoScrollLockedRef.current) {
      scrollToBottom('auto');
    }
  }, [messages, scrollToBottom]);

  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (!c) return;
    const isAtBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 100;
    isAutoScrollLockedRef.current = isAtBottom;
    setShowScrollBottom(!isAtBottom);
  };

  // ── Files ──────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      alert(`ຂະໜາດໄຟລ໌ຕ້ອງບໍ່ເກີນ 1MB (ໄຟລ໌ນີ້: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      return;
    }
    setAttachedFile(file);
    const name = file.name.toLowerCase();

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => { setImagePreview(e.target.result); setFileContent(''); };
      reader.readAsDataURL(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      try {
        const buffer = await file.arrayBuffer();
        const workbook = await readExcelFile(buffer);
        const first = workbook.SheetNames[0];
        const json = sheetToJSON(workbook.Sheets[first]);
        setFileContent(JSON.stringify(json.slice(0, 100), null, 2));
        setImagePreview(null);
      } catch (err) {
        console.error('Error reading spreadsheet', err);
        setFileContent(`[Error reading file: ${file.name}]`);
      }
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { setFileContent(String(e.target.result).slice(0, 50000)); setImagePreview(null); };
      reader.readAsText(file);
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const f = item.getAsFile();
          if (f) { processFile(f); break; }
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [processFile]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 180) + 'px';
    }
  }, [input]);

  // ── Send ───────────────────────────────────────────────────
  // override: ຂໍ້ຄວາມທີ່ຈະສົ່ງ (ໃຊ້ກັບ suggestion / retry)
  // baseMessages: ປະຫວັດທີ່ໃຊ້ແທນ state ປັດຈຸບັນ (ໃຊ້ຕອນ retry)
  const handleSend = async (override, baseMessages) => {
    const inputMsg = (typeof override === 'string' ? override : input).trim();
    if (!inputMsg && !attachedFile) return;
    if (isLoading) return;

    const currentImg = imagePreview;
    const currentFile = attachedFile;
    const currentFileContent = fileContent;

    const userMsg = {
      role: 'user',
      content: inputMsg,
      hasFile: !!currentFile,
      fileName: currentFile?.name,
      imagePreview: currentImg,
      ts: Date.now(),
    };

    const history = (baseMessages ?? messages).filter(m => !m._streaming && !m.isError && !m.isWelcome);

    setMessages(prev => [...(baseMessages ?? prev).filter(m => !m.isWelcome), userMsg]);
    setInput('');
    setAttachedFile(null);
    setImagePreview(null);
    setFileContent('');
    setIsLoading(true);

    try {
      // Option 1: Image (Gemini)
      if (currentImg && GEMINI_API_KEY) {
        const base64Data = currentImg.split(',')[1] || '';
        const mimeType = currentImg.split(';')[0].split(':')[1] || 'image/png';
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                parts: [
                  { text: `You are Joi, the AI assistant of Joy of a Home. Analyze this image and answer clearly in Lao:\n\n${inputMsg || 'Describe this image'}` },
                  { inline_data: { mime_type: mimeType, data: base64Data } },
                ],
              }],
            }),
          }
        );
        const data = await res.json();
        const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!replyText) throw new Error(data.error?.message || 'Gemini response was empty');
        setMessages(prev => [...prev, { role: 'assistant', content: replyText, ts: Date.now() }]);
        speakText(replyText);
        return;
      }

      // Option 2: Text / File (Joi via HF Space)
      const streamId = Date.now().toString();
      setMessages(prev => [...prev, { role: 'assistant', content: '', _id: streamId, _streaming: true, ts: Date.now() }]);

      const messageWithFile = currentFileContent
        ? `[File: ${currentFile?.name}]\n${currentFileContent}\n\n${inputMsg}`
        : inputMsg;

      let accumulated = '';
      let rafId = null;

      const finalReply = await askJoi({
        message: messageWithFile,
        messages: [...history, userMsg],
        maxTokens: 768,
        temperature: 0.7,
        deepThinking,
        onToken: (text) => {
          accumulated = text;
          if (rafId) return;
          rafId = requestAnimationFrame(() => {
            setMessages(prev => prev.map(m => (m._id === streamId ? { ...m, content: accumulated } : m)));
            rafId = null;
          });
        },
      });

      if (rafId) cancelAnimationFrame(rafId);

      const replyToSave = finalReply || accumulated || 'ບໍ່ມີຄຳຕອບຈາກ Joi';
      setMessages(prev =>
        prev.map(m => (m._id === streamId ? { role: 'assistant', content: replyToSave, ts: Date.now() } : m))
      );
      speakText(replyToSave);
    } catch (err) {
      console.error('Chat error:', err);
      const isQuota = err instanceof ZeroGPUQuotaError || isZeroGPUQuotaError(err);
      const friendly = isQuota
        ? { title: 'ໂຄວຕາ AI ຂອງມື້ນີ້ໝົດແລ້ວ', hint: 'ລະບົບຈະຣີເຊັດໃນ 24 ຊົ່ວໂມງ ກະລຸນາກັບມາໃໝ່ມື້ອື່ນ', detail: null }
        : toFriendlyError(err);
      setMessages(prev => [
        ...prev.filter(m => !m._streaming),
        { role: 'assistant', isError: true, retryText: inputMsg, ts: Date.now(), ...friendly },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = (errMsg) => {
    const idx = messages.indexOf(errMsg);
    if (idx < 1) return;
    // ຕັດ error bubble ແລະ ຂໍ້ຄວາມຜູ້ໃຊ້ທີ່ລົ້ມເຫຼວອອກ ແລ້ວສົ່ງໃໝ່
    const base = messages.slice(0, idx - 1);
    handleSend(errMsg.retryText, base);
  };

  // ── Export Excel ───────────────────────────────────────────
  const handleExportExcel = async (content) => {
    try {
      const lines = content.split('\n');
      const tableData = [];
      let headerSignature = null;

      for (const line of lines) {
        if (!line.trim().startsWith('|')) continue;
        if (line.replace(/[\s|\-:]/g, '').length === 0) continue;
        let cols = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1);
        cols = cols.map(c => c.replace(/\*\*/g, '').replace(/`/g, ''));
        if (cols.length === 0) continue;
        const sig = cols.join(',');
        if (!headerSignature) {
          headerSignature = sig;
          tableData.push(cols);
        } else {
          if (sig === headerSignature || sig.includes('Barcode,') || sig.includes('ຊື່ສິນຄ້າ,')) continue;
          tableData.push(cols);
        }
      }

      if (tableData.length === 0) { alert('ບໍ່ພົບຕາຕະລາງໃນຂໍ້ຄວາມນີ້'); return; }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Joi_Report');
      worksheet.getRow(1).height = 50;
      worksheet.getRow(2).height = 10;

      try {
        const response = await fetch(JoahLogo);
        const buffer = await response.arrayBuffer();
        const logoId = workbook.addImage({ buffer, extension: 'jpeg' });
        worksheet.addImage(logoId, { tl: { col: 0, row: 0 }, ext: { width: 120, height: 50 } });
      } catch (e) {
        console.warn('Could not load Joah logo', e);
      }

      worksheet.mergeCells('B1:F1');
      const titleCell = worksheet.getCell('B1');
      titleCell.value = 'ລາຍງານຂໍ້ມູນສິນຄ້າ / Joi AI Report';
      titleCell.font = { name: 'Phetsarath OT', size: 15, bold: true, color: { argb: 'FFEA580C' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

      tableData.forEach((row, idx) => {
        const excelRow = worksheet.addRow(row);
        const isHeader = idx === 0;
        excelRow.eachCell((cell) => {
          cell.font = { name: 'Phetsarath OT', size: 10, bold: isHeader };
          cell.alignment = { vertical: 'middle', horizontal: isHeader ? 'center' : 'left' };
          const b = { style: 'thin', color: { argb: 'FFE2E8F0' } };
          cell.border = { top: b, left: b, bottom: b, right: b };
          if (isHeader) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        });
      });

      worksheet.columns.forEach((column, i) => {
        column.width = i === 0 ? 12 : i === 2 ? 38 : 22;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Joi_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການສ້າງ Excel');
    }
  };

  // ── Render ─────────────────────────────────────────────────
  const isWelcomeOnly = messages.length > 0 && messages.every(m => m.isWelcome);
  const hasTable = (c) => c?.includes('|') && c?.includes('\n|');
  const canSend = (input.trim() || attachedFile) && !isLoading;

  return (
    <div
      className="joi-root w-full h-full flex-1 min-h-0 flex text-[#f3ece4] relative overflow-hidden select-text"
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700&family=Noto+Sans+Thai:wght@400;500;600&display=swap');
        .joi-root { background:#0f0c0a; font-family:'Noto Sans Lao','Noto Sans Thai','Phetsarath OT',system-ui,sans-serif; }
        .joi-root ::-webkit-scrollbar { width:8px; height:8px; }
        .joi-root ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:8px; }
        .joi-root ::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,.18); }
        .joi-sidebar { background:#14100d; border-right:1px solid rgba(255,255,255,.06); }
        .joi-header { background:rgba(15,12,10,.82); backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,.06); }
        .joi-bubble { background:#1a1512; border:1px solid rgba(255,255,255,.07); will-change: contents; }
        .joi-composer { background:#1a1512; border:1px solid rgba(255,255,255,.09); box-shadow:0 18px 40px -18px rgba(0,0,0,.7); transition:border-color .2s, box-shadow .2s; }
        .joi-composer:focus-within { border-color:rgba(249,115,22,.55); box-shadow:0 18px 44px -18px rgba(249,115,22,.28); }
        .joi-h1 { font-size:22px; font-weight:700; margin:22px 0 10px; color:#ffb877; }
        .joi-h2 { font-size:19px; font-weight:700; margin:20px 0 8px; color:#fff4e8; }
        .joi-h3 { font-size:16px; font-weight:600; margin:16px 0 6px; color:#f3ece4; }
        .joi-p { font-size:15.5px; line-height:1.8; margin-bottom:12px; color:#eadfd2; }
        .joi-p:last-child { margin-bottom:0; }
        .joi-list { padding-left:22px; margin-bottom:14px; font-size:15.5px; color:#eadfd2; }
        .joi-list li::marker { color:#f97316; }
        .joi-fade { animation: joiFade .35s ease both; }
        @keyframes joiFade { from { opacity:0; transform:translateY(6px);} to { opacity:1; transform:none;} }
        .joi-dot { animation: joiDot 1.2s infinite ease-in-out both; }
        .joi-dot:nth-child(2){ animation-delay:.15s } .joi-dot:nth-child(3){ animation-delay:.3s }
        @keyframes joiDot { 0%,80%,100%{ transform:scale(.55); opacity:.4 } 40%{ transform:scale(1); opacity:1 } }
        @media (prefers-reduced-motion: reduce){ .joi-fade,.joi-dot{ animation:none } }
      `}</style>

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        aria-label="ປະຫວັດການສົນທະນາ"
        className={`joi-sidebar shrink-0 flex flex-col z-30 overflow-hidden transition-[width] duration-300 ease-out
          max-lg:absolute max-lg:inset-y-0 max-lg:left-0 ${isSidebarOpen ? 'w-[300px]' : 'w-0 border-r-0'}`}
      >
        <div className="w-[300px] h-full flex flex-col">
          <div className="px-5 pt-5 pb-4 flex items-center gap-3">
            <img src={JoahLogo} alt="JOAH" className="h-9 w-auto rounded-md object-contain bg-white/5" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold leading-tight">Joi AI</p>
              <p className="text-[12px] text-[#8f8073] leading-tight mt-0.5">Joy of a Home</p>
            </div>
            <button
              onClick={() => setIsSidebarOpen(false)}
              aria-label="ປິດແຖບປະຫວັດ"
              className="ml-auto p-2 rounded-lg text-[#8f8073] hover:text-white hover:bg-white/10 lg:hidden"
            >
              <X size={17} />
            </button>
          </div>

          <div className="px-4 pb-3">
            <button
              onClick={startNewChat}
              className="w-full flex items-center gap-2.5 px-4 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-[#1a0d02] font-semibold text-[14px] transition-colors"
            >
              <Plus size={17} /> ສົນທະນາໃໝ່
            </button>
          </div>

          <p className="px-6 pt-3 pb-2 text-[12px] font-medium text-[#8f8073]">ປະຫວັດການສົນທະນາ</p>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-0.5">
            {chatHistory.length === 0 ? (
              <p className="text-center py-10 text-[13px] text-[#6d6054]">ຍັງບໍ່ມີປະຫວັດການສົນທະນາ</p>
            ) : (
              chatHistory.map((chat) => {
                const active = currentChatId === chat.id;
                return (
                  <div
                    key={chat.id}
                    onClick={() => loadChat(chat)}
                    className={`group flex items-center gap-3 px-3.5 py-2.5 rounded-xl cursor-pointer text-[14px] transition-colors ${active ? 'bg-orange-500/[0.14] text-orange-200' : 'text-[#b5a596] hover:bg-white/5 hover:text-[#f3ece4]'
                      }`}
                  >
                    <MessageSquare size={15} className="shrink-0 opacity-70" />
                    <span className="truncate flex-1">{chat.title || 'ການສົນທະນາໃໝ່'}</span>
                    <button
                      onClick={(e) => deleteChat(e, chat.id)}
                      aria-label="ລຶບການສົນທະນາ"
                      className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="px-5 py-4 border-t border-white/[0.06] text-[12px] text-[#6d6054]">
            ປະຫວັດຖືກເກັບໄວ້ໃນເຄື່ອງນີ້ເທົ່ານັ້ນ
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[420px] rounded-full bg-orange-600/[0.07] blur-[120px]" />

        {/* Header */}
        <header className="joi-header h-[68px] px-5 sm:px-8 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="ເປີດ/ປິດແຖບປະຫວັດ"
              className="p-2.5 rounded-xl text-[#b5a596] hover:text-white hover:bg-white/10 transition-colors"
            >
              <PanelLeft size={20} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-[#1a0d02]">
                <Sparkles size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="text-[16px] font-semibold leading-none">{BOT_NAME}</span>
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.07] text-[#c9b9a8]">AI</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isLoading ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                  <span className="text-[12px] text-[#8f8073]">{isLoading ? 'ກຳລັງຕອບ' : 'ພ້ອມໃຊ້ງານ'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeepThinking(!deepThinking)}
              aria-pressed={deepThinking}
              title="ໂໝດຄິດລະອຽດ"
              className={`px-3.5 py-2 rounded-xl text-[13px] font-medium flex items-center gap-2 border transition-colors ${deepThinking
                ? 'bg-orange-500 text-[#1a0d02] border-orange-400'
                : 'bg-white/[0.04] text-[#b5a596] border-white/[0.08] hover:bg-white/10 hover:text-white'
                }`}
            >
              <Brain size={16} /> ຄິດລະອຽດ
            </button>
            <button
              onClick={toggleTTS}
              aria-pressed={isTTSEnabled}
              aria-label={isTTSEnabled ? 'ປິດສຽງອ່ານ' : 'ເປີດສຽງອ່ານ'}
              title={isTTSEnabled ? 'ສຽງອ່ານ: ເປີດ' : 'ສຽງອ່ານ: ປິດ'}
              className={`p-2.5 rounded-xl border transition-colors ${isTTSEnabled
                ? 'bg-white/10 text-orange-400 border-orange-500/40'
                : 'bg-white/[0.04] text-[#b5a596] border-white/[0.08] hover:bg-white/10 hover:text-white'
                }`}
            >
              {isTTSEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <div className="w-px h-6 bg-white/10 mx-1.5" />
            <button
              onClick={onBack}
              aria-label="ປິດແຊັດ"
              title="ປິດ"
              className="p-2.5 rounded-xl text-[#b5a596] hover:text-rose-300 hover:bg-rose-500/15 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative z-10"
        >
          <div className="w-full max-w-[880px] mx-auto px-5 sm:px-8 py-8 flex flex-col gap-7">
            {/* Welcome */}
            {isWelcomeOnly && (
              <section className="joi-fade pt-6 sm:pt-14 pb-2">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center text-[#1a0d02] mb-7">
                  <Sparkles size={28} />
                </div>
                <h1 className="text-[34px] sm:text-[42px] font-bold leading-[1.25] tracking-tight">
                  ສະບາຍດີ, {userName}
                </h1>
                <p className="mt-3 text-[17px] text-[#b5a596] leading-relaxed max-w-[560px]">
                  ຂ້ອຍແມ່ນ Joi ຜູ້ຊ່ວຍ AI ຂອງ Joy of a Home ຊ່ວຍວິເຄາະວຽກສາງ, ຄິດໄລ່ ແລະ ແປພາສາ.
                  ພິມຄຳຖາມ, ແນບໄຟລ໌ Excel ຫຼື ສົ່ງຮູບພາບໄດ້ເລີຍ.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-10">
                  {SUGGESTIONS.map(({ icon: Icon, title, sub }) => (
                    <button
                      key={title}
                      onClick={() => handleSend(title)}
                      className="text-left p-5 rounded-2xl bg-[#1a1512] border border-white/[0.07] hover:border-orange-500/40 hover:bg-[#211a15] transition-colors group"
                    >
                      <Icon size={20} className="text-orange-400 mb-3.5" />
                      <p className="text-[15px] font-semibold text-[#f3ece4]">{title}</p>
                      <p className="text-[13px] text-[#8f8073] mt-1">{sub}</p>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Conversation */}
            {messages.filter(m => !m.isWelcome).map((m, i) => (
              <div
                key={m._id || `${m.ts}-${i}`}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${m._streaming ? '' : 'joi-fade'}`}
              >
                {m.role === 'user' ? (
                  <div className="max-w-[80%] flex flex-col items-end">
                    <div className="bg-orange-500 text-[#1a0d02] px-5 py-3.5 rounded-2xl rounded-br-md text-[15.5px] leading-[1.7] break-words">
                      {m.imagePreview && (
                        <img src={m.imagePreview} alt="ຮູບທີ່ສົ່ງ" className="max-h-64 rounded-xl object-contain mb-3 bg-black/10" />
                      )}
                      {m.content && <div className="whitespace-pre-wrap font-medium">{m.content}</div>}
                      {m.hasFile && !m.imagePreview && (
                        <div className="mt-2.5 px-3 py-2 bg-black/10 rounded-lg flex items-center gap-2 text-[13px]">
                          <FileText size={15} className="shrink-0" />
                          <span className="truncate">{m.fileName}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] text-[#6d6054] mt-1.5 px-1">{fmtTime(m.ts)}</span>
                  </div>
                ) : (
                  <div className="flex gap-4 w-full">
                    <div className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center bg-orange-500/[0.14] text-orange-400 mt-0.5">
                      <Sparkles size={17} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {m.isError ? (
                        <ErrorBubble {...m} onRetry={() => handleRetry(m)} />
                      ) : (
                        <div className="joi-bubble rounded-2xl rounded-tl-md px-6 py-5">
                          {m._streaming && !m.content ? (
                            <div className="flex items-center gap-3 text-[#b5a596] text-[14px] py-1">
                              <span className="flex gap-1.5">
                                <span className="joi-dot w-2 h-2 rounded-full bg-orange-400" />
                                <span className="joi-dot w-2 h-2 rounded-full bg-orange-400" />
                                <span className="joi-dot w-2 h-2 rounded-full bg-orange-400" />
                              </span>
                              Joi ກຳລັງຄິດ
                            </div>
                          ) : (
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                              {m.content}
                            </ReactMarkdown>
                          )}
                          {hasTable(m.content) && !m._streaming && (
                            <div className="mt-4 pt-4 border-t border-white/[0.08]">
                              <button
                                onClick={() => handleExportExcel(m.content)}
                                className="px-4 py-2 rounded-lg bg-orange-500/[0.14] hover:bg-orange-500/25 text-orange-300 text-[13px] font-semibold flex items-center gap-2 transition-colors"
                              >
                                <Download size={15} /> ສົ່ງອອກ Excel (.xlsx)
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                      {!m.isError && !m._streaming && (
                        <div className="flex items-center gap-1 mt-1.5 px-1">
                          <span className="text-[11px] text-[#6d6054] mr-1">{fmtTime(m.ts)}</span>
                          <CopyButton text={m.content} />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div ref={messagesEndRef} className="h-1" />
          </div>
        </div>

        {/* Scroll-to-bottom */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom()}
            aria-label="ເລື່ອນລົງລຸ່ມສຸດ"
            className="absolute bottom-40 right-10 z-30 p-3 rounded-full bg-orange-500 text-[#1a0d02] shadow-xl hover:bg-orange-400 transition-colors"
          >
            <ArrowDown size={18} />
          </button>
        )}

        {/* Composer */}
        <div className="shrink-0 relative z-20 px-5 sm:px-8 pb-5 pt-2">
          <div className="w-full max-w-[880px] mx-auto">
            {attachedFile && (
              <div className="joi-fade mb-3 inline-flex items-center gap-3 bg-[#1a1512] border border-orange-500/30 rounded-xl px-3.5 py-2.5 max-w-sm">
                {imagePreview ? (
                  <img src={imagePreview} alt="ຕົວຢ່າງ" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-orange-500/[0.14] text-orange-400 flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-medium truncate">{attachedFile.name}</p>
                  <p className="text-[11px] text-[#8f8073]">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button
                  onClick={() => { setAttachedFile(null); setImagePreview(null); setFileContent(''); }}
                  aria-label="ລົບໄຟລ໌ແນບ"
                  className="p-1.5 rounded-md text-[#8f8073] hover:text-rose-400 hover:bg-white/10"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            <div className="joi-composer rounded-2xl p-2.5 pl-3 flex items-end gap-1.5">
              <div className="flex items-center gap-0.5 pb-1">
                <button
                  onClick={() => document.getElementById('joi-img-input')?.click()}
                  aria-label="ສົ່ງຮູບພາບ"
                  title="ສົ່ງຮູບພາບ"
                  className="p-2.5 text-[#8f8073] hover:text-orange-400 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <ImageIcon size={20} />
                </button>
                <input id="joi-img-input" type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <button
                  onClick={() => document.getElementById('joi-file-input')?.click()}
                  aria-label="ແນບໄຟລ໌ Excel ຫຼື ຂໍ້ຄວາມ"
                  title="ແນບໄຟລ໌ Excel / CSV / Text"
                  className="p-2.5 text-[#8f8073] hover:text-orange-400 hover:bg-white/5 rounded-xl transition-colors"
                >
                  <Paperclip size={20} />
                </button>
                <input id="joi-file-input" type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden" onChange={handleFileChange} />
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="ຖາມ Joi ໄດ້ທຸກເລື່ອງ..."
                aria-label="ຂໍ້ຄວາມເຖິງ Joi"
                rows={1}
                className="flex-1 bg-transparent border-none outline-none focus:ring-0 px-2 py-3 text-[15.5px] text-[#f3ece4] placeholder-[#6d6054] resize-none max-h-44"
              />

              <div className="pb-1 shrink-0">
                <button
                  onClick={() => handleSend()}
                  disabled={!canSend}
                  aria-label="ສົ່ງຂໍ້ຄວາມ"
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${canSend
                    ? 'bg-orange-500 hover:bg-orange-400 text-[#1a0d02]'
                    : 'bg-orange-500/30 text-[#1a0d02]/70 cursor-not-allowed'
                    }`}
                >
                  {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>

            <p className="text-center mt-3 text-[12px] text-[#6d6054]">
              Enter ເພື່ອສົ່ງ, Shift + Enter ເພື່ອຂຶ້ນແຖວໃໝ່. Joi ອາດຕອບຜິດພາດ ກະລຸນາກວດສອບຂໍ້ມູນສຳຄັນກ່ອນນຳໄປໃຊ້.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AIChatBotFull;