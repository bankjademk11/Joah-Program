import React, { useState, useEffect, useRef } from 'react';
import AIChatBot from './AIChatBot';

// ─── Mock AIChatBot (replace with your real <AIChatBot /> import) ─────────────
const MockChat = ({ onClose, currentUser }) => {
  const [messages, setMessages] = useState([
    {
      id: 1, from: 'joi',
      text: `ສະບາຍດີ ${currentUser?.name || 'ທ່ານ'}! 👋\nຂ້ອຍແມ່ນ Joi ຜູ້ຊ່ວຍສິນຄ້າຄົງຄັງຂອງທ່ານ ✨\nມີຫຍັງໃຫ້ຊ່ວຍບໍ່?`,
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const send = () => {
    if (!input.trim()) return;
    setMessages(p => [...p, { id: Date.now(), from: 'user', text: input, time: new Date() }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(p => [...p, {
        id: Date.now() + 1, from: 'joi',
        text: 'ໄດ້ຮັບຂໍ້ຄວາມຂອງທ່ານແລ້ວ! ກໍາລັງດໍາເນີນການ... 🔍',
        time: new Date(),
      }]);
    }, 1500);
  };

  const fmt = d => d.toLocaleTimeString('lo', { hour: '2-digit', minute: '2-digit' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: "'Noto Sans Lao', 'IBM Plex Sans', sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #fb923c 0%, #f97316 55%, #ea580c 100%)',
        padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        position: 'relative', overflow: 'hidden', flexShrink: 0,
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', top: -24, right: -16, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: -12, right: 50, width: 50, height: 50, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', pointerEvents: 'none' }} />

        {/* Avatar */}
        <div style={{
          width: 42, height: 42, borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          border: '2px solid rgba(255,255,255,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, flexShrink: 0,
          boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        }}>🤖</div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, letterSpacing: '0.02em', lineHeight: 1.2 }}>Joi AI</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: '#4ade80', flexShrink: 0,
              boxShadow: '0 0 0 2px rgba(74,222,128,0.35)'
            }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 500 }}>
              Online · ຜູ້ຊ່ວຍສິນຄ້າຄົງຄັງ
            </span>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
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
        >✕</button>
      </div>

      {/* ── Mode chips ── */}
      <div style={{
        background: '#fff7ed',
        borderBottom: '1px solid #fed7aa',
        padding: '7px 14px',
        display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0,
      }}>
        {[['Tech Mode', true], ['Inventory', false], ['Checklist', false]].map(([label, active]) => (
          <span key={label} style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
            background: active ? '#f97316' : 'rgba(249,115,22,0.08)',
            color: active ? '#fff' : '#ea580c',
            border: active ? 'none' : '1px solid rgba(249,115,22,0.25)',
            transition: 'all 0.15s',
          }}>{label}</span>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af' }}>Audio OFF</span>
      </div>

      {/* ── Messages ── */}
      <div className="joi-scroll" style={{
        flex: 1, overflowY: 'auto', padding: '14px 14px 8px',
        background: 'linear-gradient(180deg, #fff9f5 0%, #fff 60%)',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex',
            flexDirection: msg.from === 'user' ? 'row-reverse' : 'row',
            alignItems: 'flex-end', gap: 7,
          }}>
            {msg.from === 'joi' && (
              <div style={{
                width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #f97316, #c2410c)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12,
              }}>🤖</div>
            )}
            <div style={{
              maxWidth: '76%',
              background: msg.from === 'user'
                ? 'linear-gradient(135deg, #f97316, #ea580c)'
                : '#fff',
              color: msg.from === 'user' ? '#fff' : '#1f2937',
              padding: '9px 13px',
              borderRadius: msg.from === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              fontSize: 13, lineHeight: 1.6,
              whiteSpace: 'pre-line',
              boxShadow: msg.from === 'user'
                ? '0 4px 14px rgba(249,115,22,0.28)'
                : '0 2px 8px rgba(0,0,0,0.07)',
              border: msg.from === 'joi' ? '1px solid #fed7aa' : 'none',
            }}>
              {msg.text}
              <div style={{
                fontSize: 10, marginTop: 3, textAlign: 'right',
                color: msg.from === 'user' ? 'rgba(255,255,255,0.6)' : '#9ca3af',
              }}>{fmt(msg.time)}</div>
            </div>
          </div>
        ))}

        {typing && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
            <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'linear-gradient(135deg,#f97316,#c2410c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>🤖</div>
            <div style={{
              background: '#fff', border: '1px solid #fed7aa',
              borderRadius: '18px 18px 18px 4px',
              padding: '11px 15px', display: 'flex', gap: 4, alignItems: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              {[0, 0.2, 0.4].map((d, i) => (
                <span key={i} style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'inline-block',
                  animation: `dot-bounce 1s ${d}s infinite ease-in-out`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <div style={{
        padding: '10px 14px 14px',
        background: '#fff',
        borderTop: '1px solid #fed7aa',
        display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0,
      }}>
        <div style={{
          flex: 1, background: '#fff7ed',
          border: '1.5px solid #fed7aa', borderRadius: 20,
          padding: '9px 14px', display: 'flex', alignItems: 'center',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="ຖາມ Joi ສິ່ງໃດກໍໄດ້..."
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', fontSize: 13, color: '#374151',
              fontFamily: "'Noto Sans Lao', sans-serif",
            }}
          />
        </div>
        <button onClick={send} style={{
          width: 40, height: 40, borderRadius: '50%', border: 'none',
          background: input.trim()
            ? 'linear-gradient(135deg, #f97316, #ea580c)'
            : '#f3f4f6',
          cursor: input.trim() ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
          boxShadow: input.trim() ? '0 4px 12px rgba(249,115,22,0.4)' : 'none',
          flexShrink: 0,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke={input.trim() ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() ? '#fff' : '#9ca3af'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};


// ─── JoiWidget ─────────────────────────────────────────────────────────────────
const JoiWidget = ({ currentUser = { name: 'Santisouk DEV' } }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [showBadge, setShowBadge] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Delayed entrance so widget doesn't flash on page load
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 600);
    return () => clearTimeout(t);
  }, []);

  // Periodic pulse to draw attention when closed
  useEffect(() => {
    if (isOpen) { setShowBadge(false); return; }
    const id = setInterval(() => {
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    }, 12000);
    return () => clearInterval(id);
  }, [isOpen]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;600;700&display=swap');
 
        @keyframes dot-bounce {
          0%,80%,100% { transform:scale(0.75); opacity:0.5; }
          40%          { transform:scale(1.2);  opacity:1;   }
        }
        @keyframes joi-btn-in {
          from { opacity:0; transform:scale(0.6) translateY(10px); }
          to   { opacity:1; transform:scale(1)   translateY(0);    }
        }
        @keyframes panel-in {
          from { opacity:0; transform:scale(0.86) translateY(20px); }
          to   { opacity:1; transform:scale(1)    translateY(0);    }
        }
        @keyframes panel-out {
          from { opacity:1; transform:scale(1)    translateY(0);    }
          to   { opacity:0; transform:scale(0.86) translateY(20px); }
        }
        @keyframes ring-pulse {
          0%   { transform:scale(1);   opacity:0.65; }
          100% { transform:scale(2.1); opacity:0;    }
        }
        @keyframes badge-pop {
          0%   { transform:scale(0);   }
          65%  { transform:scale(1.3); }
          100% { transform:scale(1);   }
        }
        .joi-scroll::-webkit-scrollbar { width:4px; }
        .joi-scroll::-webkit-scrollbar-track { background:transparent; }
        .joi-scroll::-webkit-scrollbar-thumb { background:#fed7aa; border-radius:99px; }
      `}</style>

      {/* ── Floating Action Button (Thumb-Friendly Toggle) ──────────────────────── */}
      {mounted && (
        <button
          onClick={() => setIsOpen(prev => !prev)}
          aria-label={isOpen ? "Close Joi AI assistant" : "Open Joi AI assistant"}
          style={{
            position: 'fixed', bottom: 28, left: 28, zIndex: 100000,
            width: 58, height: 58, borderRadius: '50%',
            border: 'none', cursor: 'pointer', padding: 0,
            background: 'linear-gradient(145deg, #fb923c, #f97316, #ea580c)',
            boxShadow: '0 8px 28px rgba(249,115,22,0.45), 0 2px 8px rgba(0,0,0,0.14)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'joi-btn-in 0.45s cubic-bezier(0.34,1.56,0.64,1) both',
            // Keep button visible and interactive at all times
            opacity: 1,
            transform: pulse && !isOpen ? 'scale(1.07)' : 'scale(1)',
            transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), background 0.3s',
            pointerEvents: 'auto',
          }}
        >
          {/* Attention ring */}
          {pulse && !isOpen && (
            <span style={{
              position: 'absolute', inset: -5, borderRadius: '50%',
              border: '2.5px solid rgba(249,115,22,0.7)',
              animation: 'ring-pulse 1.2s ease-out forwards',
              pointerEvents: 'none',
            }} />
          )}

          {/* Dynamic Icon: Smiley face or Close cross */}
          {isOpen ? (
            <span style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 1, transform: 'rotate(0deg)', animation: 'badge-pop 0.3s ease' }}>✕</span>
          ) : (
            <svg width="26" height="26" viewBox="0 0 36 36" fill="none" style={{ animation: 'badge-pop 0.3s ease' }}>
              <circle cx="18" cy="18" r="16" fill="rgba(255,255,255,0.15)" />
              <circle cx="12.5" cy="16" r="2.8" fill="white" />
              <circle cx="23.5" cy="16" r="2.8" fill="white" />
              <circle cx="13.5" cy="15" r="1.1" fill="rgba(255,255,255,0.45)" />
              <circle cx="24.5" cy="15" r="1.1" fill="rgba(255,255,255,0.45)" />
              <path d="M13 23 Q18 27.5 23 23" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            </svg>
          )}

          {/* Notification badge */}
          {showBadge && !isOpen && (
            <span style={{
              position: 'absolute', top: 3, right: 3,
              width: 15, height: 15, borderRadius: '50%',
              background: '#22c55e', border: '2px solid white',
              fontSize: 8, fontWeight: 800, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'badge-pop 0.4s 0.9s cubic-bezier(0.34,1.56,0.64,1) both',
            }}>1</span>
          )}
        </button>
      )}

      {/* ── Chat Panel ─────────────────────────────────── */}
      {mounted && (
        <div 
          className="bg-[#0f172a] border border-slate-800"
          style={{
            position: 'fixed', bottom: 100, left: 28, zIndex: 9999,
            width: 375,
            height: Math.min(570, window.innerHeight - 130),
            maxWidth: 'calc(100vw - 40px)',
            borderRadius: 22,
            overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.16), 0 6px 18px rgba(249,115,22,0.14)',
            display: 'flex', flexDirection: 'column',
            transformOrigin: 'bottom left',
            animation: isOpen ? 'panel-in 0.4s cubic-bezier(0.34,1.56,0.64,1) both' : 'panel-out 0.25s ease both',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}>
          {/* Render real AIChatBot to connect with DeepSeek API */}
          <AIChatBot isWidget={true} onClose={() => setIsOpen(false)} currentUser={currentUser} />
        </div>
      )}
    </>
  );
};

export default JoiWidget;
