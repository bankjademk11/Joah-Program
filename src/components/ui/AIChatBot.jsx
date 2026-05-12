import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, LayoutDashboard, Paperclip, FileText, Trash2, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { readExcelFile, sheetToJSON } from '../../utils/excelProcessor';

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
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Text-to-Speech ──────────────────────────────────────
  const speakText = (text) => {
    if (!isTTSEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // หยุดเสียงเก่าก่อน
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'th-TH'; // ภาษาไทย / ลาว
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
  };

  const toggleTTS = () => {
    if (isTTSEnabled) stopSpeaking();
    setIsTTSEnabled(prev => !prev);
  };
  // ────────────────────────────────────────────────────────

  // Load History on Mount
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

  // Save current chat to history
  useEffect(() => {
    if (messages.length > 0 && currentChatId) {
      const updatedHistory = chatHistory.map(chat =>
        chat.id === currentChatId ? { ...chat, messages, lastActive: Date.now() } : chat
      );
      if (!chatHistory.find(c => c.id === currentChatId)) {
        const firstUserMsg = messages.find(m => m.role === 'user')?.content || 'New Chat';
        updatedHistory.unshift({
          id: currentChatId,
          title: firstUserMsg.substring(0, 30) + (firstUserMsg.length > 30 ? '...' : ''),
          messages,
          lastActive: Date.now()
        });
      }
      setChatHistory(updatedHistory);
      localStorage.setItem('joah_ai_history', JSON.stringify(updatedHistory));
    }
  }, [messages]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setCurrentChatId(newId);
    stopSpeaking();
    const userName = currentUser?.name || currentUser?.user_metadata?.full_name || 'ທ່ານ';
    setMessages([{
      role: 'assistant',
      content: `ສະບາຍດີ ທ່ານ ${userName}, ມີຫຍັງໃຫ້ Joah AI ຊ່ວຍບໍ່?`
    }]);
    setAttachedFile(null);
    setFileContent('');
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAttachedFile(file);
    setIsLoading(true);
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = await readExcelFile(file);
        const firstSheetName = workbook.SheetNames[0];
        const jsonData = sheetToJSON(workbook, firstSheetName);
        const textPreview = jsonData.slice(0, 50).map(row => JSON.stringify(row)).join('\n');
        setFileContent(`[Excel File Content - First 50 Rows]:\n${textPreview}`);
      } else {
        const text = await file.text();
        setFileContent(`[File Content]:\n${text.substring(0, 5000)}`);
      }
    } catch (error) {
      console.error('File Read Error:', error);
      alert('Error reading file. Please use .xlsx or .txt');
      setAttachedFile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadChat = (chat) => {
    stopSpeaking();
    setCurrentChatId(chat.id);
    setMessages(chat.messages);
    setAttachedFile(null);
    setFileContent('');
  };

  const deleteChat = (e, id) => {
    e.stopPropagation();
    const updated = chatHistory.filter(c => c.id !== id);
    setChatHistory(updated);
    localStorage.setItem('joah_ai_history', JSON.stringify(updated));
    if (currentChatId === id) startNewChat();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && !attachedFile) return;
    stopSpeaking();

    let finalPrompt = input;
    if (fileContent) {
      finalPrompt = `I have attached a file named "${attachedFile.name}". Here is the content:\n\n${fileContent}\n\nUser Question: ${input || 'Please summarize this file.'}`;
    }

    const userMessage = {
      role: 'user',
      content: input || `Uploaded: ${attachedFile?.name}`,
      fileName: attachedFile?.name,
      hasFile: !!attachedFile
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setAttachedFile(null);
    setFileContent('');
    setIsLoading(true);

    try {
      const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || 'sk-14413bf76ea64927854417be978a7a9b';

      if (!DEEPSEEK_API_KEY) {
        setMessages(prev => [...prev, { role: 'assistant', content: '❌ Error: API Key not found.' }]);
        setIsLoading(false);
        return;
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `You are Joah AI, an intelligent and friendly assistant developed by Santisouk Laxayphone. 
              Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
              Current Time: ${new Date().toLocaleTimeString('en-US', { hour12: false })}.
              You can process file content provided in the prompt. If a user provides file data, analyze it carefully. 
              IMPORTANT: Always state you are Joah AI created by Santisouk Laxayphone. Never mention DeepSeek.`
            },
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: finalPrompt }
          ],
          temperature: 0.8
        })
      });

      const data = await response.json();
      if (data.choices?.[0]) {
        const aiMessage = data.choices[0].message;
        setMessages(prev => [...prev, aiMessage]);
        // 🔊 Auto-speak if TTS is ON
        if (isTTSEnabled) {
          speakText(aiMessage.content);
        }
      }
    } catch (error) {
      console.error('Chat Error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'ຂໍອະໄພ, ມີຂໍ້ຜິດພາດບາງຢ່າງ.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-[calc(100vh-120px)] flex animate-fade-in gap-4">
      {/* Sidebar */}
      <div className={`transition-all duration-500 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-[2.5rem] flex flex-col ${isSidebarOpen ? 'w-80 p-6' : 'w-0 p-0'}`}>
        <div className="flex items-center justify-between mb-8 whitespace-nowrap">
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Recent Chats</h3>
          <button onClick={startNewChat} className="p-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all">
            <Sparkles size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-hide">
          {chatHistory.map((chat) => (
            <div
              key={chat.id}
              onClick={() => loadChat(chat)}
              className={`group p-4 rounded-2xl cursor-pointer transition-all border ${
                currentChatId === chat.id
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                  : 'bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 overflow-hidden">
                  <MessageSquare size={16} className={currentChatId === chat.id ? 'text-blue-500' : 'text-slate-400'} />
                  <span className={`text-sm font-bold truncate ${currentChatId === chat.id ? 'text-blue-700 dark:text-blue-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {chat.title}
                  </span>
                </div>
                <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-all">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-3 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-slate-500"
            >
              <LayoutDashboard size={20} />
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-all text-sm font-bold text-slate-500"
            >
              Close AI
            </button>

            {/* TTS Toggle Button */}
            <button
              onClick={toggleTTS}
              title={isTTSEnabled ? 'ปิด Text-to-Speech' : 'เปิด Text-to-Speech'}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                isTTSEnabled
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 animate-pulse'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {isTTSEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span className="hidden sm:inline">{isTTSEnabled ? (isSpeaking ? 'ກຳລັງອ່ານ...' : 'TTS ON') : 'TTS OFF'}</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500">Joah AI</h2>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 p-[2px]">
              <div className="w-full h-full rounded-full bg-white dark:bg-slate-900 flex items-center justify-center">
                <Sparkles size={20} className="text-blue-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-12 space-y-8 scrollbar-hide pb-10">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
              <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-slate-200 dark:bg-slate-800' : 'bg-gradient-to-tr from-blue-500 to-purple-600 text-white'
                }`}>
                  {m.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                </div>
                <div className={`mt-1 text-[15px] leading-relaxed flex flex-col gap-2 ${
                  m.role === 'user'
                    ? 'bg-slate-100 dark:bg-slate-800 p-4 rounded-[1.5rem] rounded-tr-none text-slate-800 dark:text-slate-200'
                    : 'text-slate-800 dark:text-slate-100 font-medium whitespace-pre-wrap'
                }`}>
                  {m.hasFile && (
                    <div className="flex items-center gap-2 p-2 bg-blue-500/10 rounded-xl border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold mb-1">
                      <FileText size={14} />
                      <span className="truncate max-w-[200px]">{m.fileName}</span>
                    </div>
                  )}
                  {m.content}
                  {/* Speaker icon on AI messages */}
                  {m.role === 'assistant' && (
                    <button
                      onClick={() => speakText(m.content)}
                      className="self-start mt-1 p-1.5 rounded-full text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                      title="ฟังข้อความนี้"
                    >
                      <Volume2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-400 to-purple-500 flex items-center justify-center text-white">
                <Sparkles size={18} className="animate-spin" />
              </div>
              <div className="h-4 w-48 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="px-4 pb-8">
          <div className="max-w-3xl mx-auto relative group">
            {attachedFile && (
              <div className="absolute -top-14 left-6 flex items-center gap-3 p-3 bg-white dark:bg-slate-900 border border-blue-500/30 rounded-2xl shadow-lg animate-fade-in-up">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <FileText size={18} />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 truncate max-w-[150px]">{attachedFile.name}</span>
                <button onClick={() => { setAttachedFile(null); setFileContent(''); }} className="p-1 hover:text-rose-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-[2.5rem] opacity-20 blur-lg group-focus-within:opacity-40 transition-opacity"></div>
            <div className="relative flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] shadow-xl p-2 pl-6">
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".xlsx,.xls,.txt,.csv" className="hidden" />
              <button onClick={() => fileInputRef.current.click()} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all">
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Enter a prompt here..."
                className="flex-1 h-12 bg-transparent outline-none text-slate-800 dark:text-white font-medium ml-2"
              />
              <button
                onClick={handleSend}
                disabled={isLoading || (!input.trim() && !attachedFile)}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  (input.trim() || attachedFile) ? 'bg-blue-600 text-white shadow-lg active:scale-90' : 'text-slate-300'
                }`}
              >
                <Send size={20} />
              </button>
            </div>
            <p className="text-center text-[10px] text-slate-400 mt-4 font-medium">
              Joah AI · Translation · File Analysis · TTS
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIChatBot;
