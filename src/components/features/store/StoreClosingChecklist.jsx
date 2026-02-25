import React, { useState, useEffect, useRef } from 'react';
import {
    Copy, Printer, ChevronLeft, Check, ChevronRight,
    ArrowLeft, RotateCcw, Calendar, Building2, PenLine,
    Info, AlertCircle, CheckCircle2, XCircle
} from 'lucide-react';

/* ══════════════════════════════════════════════
   SVG ANIMATIONS & ICONS
   ═══════════════════════════════════════════════ */

const RippleSVG = ({ active, color }) => {
    if (!active) return null;
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
            {[0, 1, 2].map(i => (
                <circle key={i} cx="50%" cy="50%"
                    r="0" fill="none"
                    stroke={color} strokeWidth={3 - i * 0.8}
                    style={{
                        animation: `rippleBurst 0.6s ease-out ${i * 0.1}s both`,
                        opacity: 1 - i * 0.25
                    }}
                />
            ))}
        </svg>
    );
};

const AnimatedCheck = ({ playing }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
        <circle cx="12" cy="12" r="10"
            stroke="#1a73e8" strokeWidth="2"
            fill={playing ? '#e8f0fe' : 'white'}
            style={{ transition: 'fill 0.25s ease' }}
        />
        <path
            d="M7 12 L10.5 15.5 L17 9"
            stroke="#1a73e8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="22"
            style={{
                strokeDashoffset: playing ? 0 : 22,
                transition: playing ? 'stroke-dashoffset 0.35s cubic-bezier(0.4,0,0.2,1) 0.05s' : 'none'
            }}
        />
    </svg>
);

const AnimatedX = ({ playing }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}>
        <circle cx="12" cy="12" r="10"
            stroke="#d93025" strokeWidth="2"
            fill={playing ? '#fce8e6' : 'white'}
            style={{ transition: 'fill 0.25s ease' }}
        />
        <path
            d="M9 9 L15 15"
            stroke="#d93025"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="15"
            style={{
                strokeDashoffset: playing ? 0 : 15,
                transition: playing ? 'stroke-dashoffset 0.25s cubic-bezier(0.4,0,0.2,1) 0.02s' : 'none'
            }}
        />
        <path
            d="M15 9 L9 15"
            stroke="#d93025"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="15"
            style={{
                strokeDashoffset: playing ? 0 : 15,
                transition: playing ? 'stroke-dashoffset 0.25s cubic-bezier(0.4,0,0.2,1) 0.12s' : 'none'
            }}
        />
    </svg>
);

const ParticleBurst = ({ active, color, count = 8 }) => {
    if (!active) return null;
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 20 }}>
            {Array.from({ length: count }).map((_, i) => {
                const angle = (i / count) * 360;
                const rad = (angle * Math.PI) / 180;
                const tx = Math.cos(rad) * 36;
                const ty = Math.sin(rad) * 36;
                return (
                    <circle key={i}
                        cx="50%" cy="50%"
                        r="3"
                        fill={color}
                        style={{
                            animation: `particle 0.55s cubic-bezier(0.4,0,1,1) ${i * 0.02}s both`,
                            '--tx': `${tx}px`,
                            '--ty': `${ty}px`,
                        }}
                    />
                );
            })}
        </svg>
    );
};

const LinearProgress = ({ value, total }) => {
    const pct = Math.min(100, Math.max(0, (value / total) * 100));
    return (
        <div style={{ position: 'relative', height: 6, background: '#f1f3f4', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #1a73e8, #4285f4)',
                borderRadius: 3,
                transition: 'width 0.5s cubic-bezier(0.4,0,0.2,1)',
                boxShadow: '0 0 10px rgba(26,115,232,0.3)'
            }} />
        </div>
    );
};

const StepDots = ({ total, current, answers, items, onJump }) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {Array.from({ length: total }).map((_, i) => {
            const ans = answers[items[i].id];
            const isCur = i === current;
            return (
                <button key={i} onClick={() => onJump(i)}
                    title={`ລາຍການ ${i + 1}`}
                    style={{
                        width: isCur ? 32 : 10,
                        height: 10,
                        borderRadius: 99,
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        background: isCur
                            ? '#1a73e8'
                            : ans === 'pass' ? '#34a853'
                                : ans === 'fail' ? '#d93025'
                                    : '#e8eaed',
                        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                        outline: 'none',
                        transform: isCur ? 'scale(1.2)' : 'scale(1)',
                        opacity: isCur ? 1 : 0.6
                    }}
                />
            );
        })}
    </div>
);

const TableCheckSVG = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <circle cx="12" cy="12" r="10" fill="#e6f4ea" />
        <path d="M7 12 L10.5 15.5 L17 9"
            stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="14"
            style={{ animation: 'svgDraw 0.4s ease forwards' }}
        />
    </svg>
);

const TableFailSVG = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
        <circle cx="12" cy="12" r="10" fill="#fce8e6" />
        <path d="M9 9 L15 15" stroke="#d93025" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="10"
            style={{ animation: 'svgDraw 0.3s ease forwards' }}
        />
        <path d="M15 9 L9 15" stroke="#d93025" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray="10"
            style={{ animation: 'svgDraw 0.3s ease forwards 0.08s' }}
        />
    </svg>
);

/* ══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
const StoreClosingChecklist = ({ onBack }) => {
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [branch] = useState('PSN');
    const [copyStatus, setCopyStatus] = useState(false);
    const [isWizardMode, setIsWizardMode] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({});
    const [remarks, setRemarks] = useState({});
    // Animation states
    const [passAnim, setPassAnim] = useState(false);
    const [failAnim, setFailAnim] = useState(false);
    const [cardKey, setCardKey] = useState(0);

    const checklistItems = [
        { id: 1, category: "ດ້ານນອກ / ລານຈອດລົດ", catColor: '#f9ab00', task: "ສະອາດ, ເປັນລະບຽບ, ພ້ອມໃຫ້ບໍລິການ", criteriaPass: "ພື້ນທີ່ສະອາດ, ບໍ່ມີຂີ້ເຫຍື້ອ, ປ້າຍຕ່າງໆຕັ້ງຊື່ເປັນລະບຽບ", criteriaFail: "ພົບຂີ້ເຫຍື້ອຊະຊາຍ, ພື້ນທີ່ເປິເປື້ອນ ຫຼື ມີສິ່ງກີດຂວາງທາງຍ່າງ" },
        { id: 2, category: "ດ້ານນອກ / ລານຈອດລົດ", catColor: '#f9ab00', task: "ຄວາມປອດໄພທົ່ວໄປ", criteriaPass: "ໄຟເຍືອງທາງແຈ້ງດີ, ບໍ່ມີຈຸດສ່ຽງ ຫຼື ອຸປະຕິເຫດ, ປະຕູປິດແໜ້ນໜາ", criteriaFail: "ໄຟດັບເປັນບາງຈຸດ, ພົບວັດຖຸອັນຕະລາຍ ຫຼື ປະຕູຮົ້ວມີບັນຫາ" },
        { id: 3, category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ", catColor: '#1a73e8', task: "ສິນຄ້າເຕັມແທ່ນ (Full Stock)", criteriaPass: "ສິນຄ້າຖືກຕີເຕັມໜ້າຊັ້ນ, ບໍ່ມີຊ່ອງວ່າງທີ່ເຫັນໄດ້ຊັດເຈນ", criteriaFail: "ມີຊ່ອງວ່າງຫຼາຍ, ສິນຄ້າໜ້າຊັ້ນບາງ ຫຼື ບໍ່ໄດ້ດຶງສິນຄ້າ" },
        { id: 4, category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ", catColor: '#1a73e8', task: "ຈຳນວນ SKU ຄົບຖ້ວນ", criteriaPass: "ສິນຄ້າວາງຄົບຕາມ Planogram, ບໍ່ມີສິນຄ້າຫາຍຈາກຊັ້ນ", criteriaFail: "ສິນຄ້າບາງ SKU ຫາຍໄປ ຫຼື ວາງສິນຄ້າອື່ນປົນ" },
        { id: 5, category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ", catColor: '#1a73e8', task: "ຄວາມສະອາດຂອງຊັ້ນວາງ", criteriaPass: "ບໍ່ມີຂີ້ຝຸ່ນ, ຊັ້ນວາງໃສ, ບໍ່ມີສິ່ງທີ່ບໍ່ກ່ຽວຂ້ອງ", criteriaFail: "ຂີ້ຝຸ່ນໜາ, ຄາບເປື້ອນ ຫຼື ຂີ້ເຫຍື້ອຕາມຊອກຊັ້ນ" },
        { id: 6, category: "ພື້ນທີ່ຂາຍ / ປ້າຍລາຄາ", catColor: '#34a853', task: "ຕຳແໜ່ງປ້າຍລາຄາກົງກັບສິນຄ້າ", criteriaPass: "ປ້າຍລາຄາຢູ່ລຸ່ມສິນຄ້າທີ່ກ່ຽວຂ້ອງ 100%", criteriaFail: "ປ້າຍລາຄາບໍ່ກົງ ເຮັດໃຫ້ລູກຄ້າສັບສົນ" },
        { id: 7, category: "ພື້ນທີ່ຂາຍ / ປ້າຍລາຄາ", catColor: '#34a853', task: "ປ້າຍລາຄາສິນຄ້າຄົບຖ້ວນ", criteriaPass: "ທຸກສິນຄ້າມີປ້າຍລາຄາ, ປ້າຍບໍ່ຈີກຂາດ", criteriaFail: "ສິນຄ້າບໍ່ມີປ້າຍ ຫຼື ປ້າຍຈີກຂາດ" },
        { id: 8, category: "ເຄົາເຕີ້ / ແຄດເຊຍ", catColor: '#ea4335', task: "ພື້ນທີ່ຊຳລະເງິນສະອາດ", criteriaPass: "ເຄົາເຕີ້ສະອາດ, ຄອມ ແລະ ອຸປະກອນວາງລະບຽບ", criteriaFail: "ຂີ້ເຫຍື້ອ, ເປິເປື້ອນ ຫຼື ເອກະສານຊາຊາຍ" },
        { id: 9, category: "ເຄົາເຕີ້ / ແຄດເຊຍ", catColor: '#ea4335', task: "ເງິນທອນ ແລະ ຂໍ້ມູນ", criteriaPass: "ເງິນທອນຄົບ, ອັດຕາແລກປ່ຽນອັບເດດ", criteriaFail: "ເງິນທອນບໍ່ຄົບ, ຂໍ້ມູນຜິດ" },
        { id: 10, category: "ເຄົາເຕີ້ / ແຄດເຊຍ", catColor: '#ea4335', task: "ຕູ້ເກັບເງິນກຽມພ້ອມ", criteriaPass: "ຕູ້ລັອກດີ, ລະບົບໄຟຟ້າປົກກະຕິ", criteriaFail: "ຕູ້ບໍ່ລັອກ, ບັນຫາເຕັກນິກ" },
        { id: 11, category: "ສາງ / ຮັບເຂົ້າ", catColor: '#9334e6', task: "ຄວາມສະອາດ ແລະ ລະບຽບ", criteriaPass: "ທາງຍ່າງໂລ່ງ, ກ່ອງບໍ່ກີດຂວາງ, ສາງສະອາດ", criteriaFail: "ກ່ອງກີດທາງ, ສາງເປິ, ຂີ້ຝຸ່ນ" },
        { id: 12, category: "ສາງ / ຮັບເຂົ້າ", catColor: '#9334e6', task: "ຮັບສິນຄ້າຖືກຕ້ອງ", criteriaPass: "ສິນຄ້າໃໝ່ຖືກເຊັກ ແລະ ຈັດທີ່", criteriaFail: "ສິນຄ້າຄ້າງ ຫຼື ວາງຜິດທີ່" },
        { id: 13, category: "ສາງ / ຮັບເຂົ້າ", catColor: '#9334e6', task: "ຈັດເກັບສິນຄ້າປອດໄພ", criteriaPass: "ໜັກລຸ່ມ, ເບົາເທິງ, ສົມດຸນ", criteriaFail: "ຊ້ອນສູງ, ບໍ່ສົມດຸນ, ສ່ຽງລົ້ມ" },
        { id: 14, category: "ອື່ນໆ", catColor: '#f29900', task: "ການແຈ້ງ Handover", criteriaPass: "ຈົດບັນທຶກວຽກຄ້າງຊັດເຈນ", criteriaFail: "ບໍ່ແຈ້ງ, ເຮັດໃຫ້ຮອບໃໝ່ມີບັນຫາ" }
    ];

    const passCount = Object.values(answers).filter(v => v === 'pass').length;
    const failCount = Object.values(answers).filter(v => v === 'fail').length;
    const currentTask = checklistItems[currentStep];

    const handleAnswer = (id, status) => {
        if (status === 'pass') {
            setPassAnim(true);
            setTimeout(() => setPassAnim(false), 700);
        } else {
            setFailAnim(true);
            setTimeout(() => setFailAnim(false), 700);
        }
        setAnswers(prev => ({ ...prev, [id]: status }));
        setTimeout(() => {
            if (currentStep < checklistItems.length - 1) {
                setCurrentStep(p => p + 1);
                setCardKey(k => k + 1);
            } else {
                setIsWizardMode(false);
            }
        }, 380);
    };

    const resetWizard = () => {
        setAnswers({}); setRemarks({}); setCurrentStep(0); setCardKey(0); setIsWizardMode(true);
    };

    const copyTable = () => {
        const t = document.getElementById('checklistTable');
        if (!t) return;
        const r = document.createRange();
        r.selectNode(t);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(r);
        try { document.execCommand('copy'); setCopyStatus(true); setTimeout(() => setCopyStatus(false), 2000); }
        catch { }
        window.getSelection().removeAllRanges();
    };

    const progress = isWizardMode && currentTask ? Math.round(((currentStep + (answers[currentTask.id] ? 1 : 0)) / checklistItems.length) * 100) : 100;

    // Category chip color map
    const catChipStyle = (color) => ({
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 12px', borderRadius: 99,
        background: color + '15', border: `1px solid ${color}30`,
        fontSize: 12, fontWeight: 600, color: color,
        letterSpacing: '0.02em', whiteSpace: 'nowrap'
    });

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Noto+Sans+Lao:wght@400;500;700&display=swap');

        :root {
          --font-main: 'Google Sans', 'Noto Sans Lao', sans-serif;
          --color-bg: #f8f9fa;
          --color-surface: #ffffff;
          --color-primary: #1a73e8;
          --color-success: #34a853;
          --color-danger: #d93025;
          --color-warning: #f9ab00;
          --color-text-main: #202124;
          --color-text-sec: #5f6368;
          --color-border: #e8eaed;
          --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.08);
          --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
          --radius-md: 12px;
          --radius-lg: 20px;
          --radius-xl: 28px;
        }

        .cl3 { font-family: var(--font-main); color: var(--color-text-main); background: var(--color-bg); }
        .cl3 * { box-sizing: border-box; }

        /* Animations */
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0)   scale(1); } 
        }
        @keyframes rippleBurst {
          0%   { r: 0;  opacity: 0.8; }
          100% { r: 60px; opacity: 0; }
        }
        @keyframes particle {
          0%   { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
        }
        @keyframes svgDraw {
          from { stroke-dashoffset: 14; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.2); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes shakeX {
          0%,100% { transform: translateX(0); }
          20%     { transform: translateX(-6px); }
          40%     { transform: translateX(6px); }
          60%     { transform: translateX(-4px); }
          80%     { transform: translateX(4px); }
        }

        .card-in     { animation: cardIn 0.4s cubic-bezier(0.2,0.8,0.2,1) both; }
        .fade-up     { animation: fadeUp 0.5s cubic-bezier(0.2,0.8,0.2,1) both; }
        .pop-in      { animation: popIn  0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
        .shake-x     { animation: shakeX 0.4s ease; }

        /* Buttons */
        .btn-google {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          border: none; cursor: pointer; border-radius: 100px;
          font-family: inherit; font-weight: 500; font-size: 14px;
          transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
          position: relative; overflow: hidden;
          outline: none; user-select: none;
          padding: 10px 20px;
        }
        .btn-google:active { transform: scale(0.96); }
        .btn-google:focus-visible { box-shadow: 0 0 0 2px rgba(26,115,232,0.4); }

        .btn-pass-style {
          background: white; color: var(--color-primary);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
        }
        .btn-pass-style:hover, .btn-pass-style.active {
          background: #e8f0fe; border-color: var(--color-primary);
          box-shadow: 0 4px 12px rgba(26,115,232,0.2);
        }

        .btn-fail-style {
          background: white; color: var(--color-danger);
          border: 1px solid var(--color-border);
          box-shadow: var(--shadow-sm);
        }
        .btn-fail-style:hover, .btn-fail-style.active {
          background: #fce8e6; border-color: var(--color-danger);
          box-shadow: 0 4px 12px rgba(217,48,37,0.2);
        }

        .btn-primary {
          background: var(--color-primary); color: white;
          box-shadow: 0 2px 8px rgba(26,115,232,0.3);
        }
        .btn-primary:hover { background: #1557b0; }

        /* Cards */
        .el-card {
          background: var(--color-surface);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-md);
          border: 1px solid rgba(0,0,0,0.04);
        }

        /* Table */
        .table-row:hover td { background: #f8f9fa !important; }
        .table-row { transition: background 0.15s ease; }
        
        /* Input */
        .input-underline {
          background: transparent; border: none;
          borderBottom: 1px solid var(--color-border);
          padding: 6px 0; font-size: 13px; color: var(--color-text-main);
          outline: none; font-family: inherit; width: 100%;
          transition: border-color 0.2s;
        }
        .input-underline:focus { border-bottom-color: var(--color-primary); }

        @media print {
          .no-print { display: none !important; }
          .cl3 { background: white; }
          .el-card { box-shadow: none; border: 1px solid #ddd; }
        }
      `}</style>

            <div className="cl3 fade-up" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto', paddingBottom: 80, paddingLeft: 20, paddingRight: 20 }}>

                {/* ── NAV ── */}
                <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, paddingTop: 20 }}>
                    <button onClick={onBack} className="btn-google"
                        style={{ background: 'white', color: '#3c4043', border: '1px solid #dadce0', boxShadow: 'var(--shadow-sm)' }}>
                        <ChevronLeft size={20} /> ກັບຄືນ
                    </button>
                    <div style={{ display: 'flex', gap: 12 }}>
                        {!isWizardMode && (
                            <button onClick={resetWizard} className="btn-google"
                                style={{ background: 'white', color: '#f9ab00', border: '1px solid #f9ab00', boxShadow: 'var(--shadow-sm)' }}>
                                <RotateCcw size={18} /> ເຮັດຄືນ
                            </button>
                        )}
                        <button onClick={copyTable} className="btn-google"
                            style={{
                                background: copyStatus ? '#34a853' : '#1a73e8',
                                color: 'white', border: 'none',
                                boxShadow: copyStatus ? 'none' : '0 2px 8px rgba(26,115,232,0.3)'
                            }}>
                            {copyStatus ? <Check size={18} /> : <Copy size={18} />}
                            {copyStatus ? 'ຄັດລອກແລ້ວ!' : 'ຄັດລອກ Excel'}
                        </button>
                        <button onClick={() => window.print()} className="btn-google"
                            style={{ background: 'white', color: '#3c4043', border: '1px solid #dadce0', boxShadow: 'var(--shadow-sm)' }}>
                            <Printer size={18} /> Print
                        </button>
                    </div>
                </div>

                {/* ══════ WIZARD MODE ══════ */}
                {isWizardMode ? (
                    <div>
                        {/* Progress header card */}
                        <div className="el-card" style={{ padding: '24px 32px', marginBottom: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 13, color: '#80868b', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 6, textTransform: 'uppercase' }}>
                                        Store Closing Checklist
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 700, color: '#202124', display: 'flex', alignItems: 'baseline', gap: 12 }}>
                                        ລາຍການທີ {currentStep + 1}
                                        <span style={{ fontSize: 16, color: '#80868b', fontWeight: 500 }}>/ {checklistItems.length}</span>
                                    </div>
                                </div>

                                {/* Score badges */}
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', background: '#e6f4ea', borderRadius: 16, minWidth: 100 }}>
                                        <span style={{ fontSize: 24, fontWeight: 700, color: '#34a853', lineHeight: 1 }}>{passCount}</span>
                                        <span style={{ fontSize: 12, color: '#1e8e3e', fontWeight: 600, marginTop: 4 }}>ຜ່ານ</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 24px', background: '#fce8e6', borderRadius: 16, minWidth: 100 }}>
                                        <span style={{ fontSize: 24, fontWeight: 700, color: '#d93025', lineHeight: 1 }}>{failCount}</span>
                                        <span style={{ fontSize: 12, color: '#c5221f', fontWeight: 600, marginTop: 4 }}>ບໍ່ຜ່ານ</span>
                                    </div>
                                </div>
                            </div>
                            <LinearProgress value={currentStep + (currentTask && answers[currentTask.id] ? 1 : 0)} total={checklistItems.length} />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                                <span style={{ fontSize: 13, color: '#80868b', fontWeight: 500 }}>{progress}% ສຳເລັດ</span>
                            </div>
                        </div>

                        {/* Main question card */}
                        <div key={cardKey} className="card-in el-card"
                            style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 24, border: '1px solid rgba(0,0,0,0.05)' }}>

                            {/* Category color bar */}
                            <div style={{ height: 6, background: currentTask.catColor }} />

                            <div style={{ padding: '40px 48px' }}>
                                {/* Category chip */}
                                <div style={{ marginBottom: 24 }}>
                                    <span style={{ ...catChipStyle(currentTask.catColor), fontSize: 14, padding: '6px 16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: currentTask.catColor }} />
                                        {currentTask.category}
                                    </span>
                                </div>

                                {/* Task title */}
                                <h2 style={{ fontSize: 32, fontWeight: 700, color: '#202124', margin: '0 0 40px', lineHeight: 1.4 }}>
                                    {currentTask.task}
                                </h2>

                                {/* Criteria cards */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 48 }}>
                                    {/* PASS criteria */}
                                    <div style={{ padding: '28px', background: '#f8fffe', border: '1px solid #ceead6', borderRadius: 20, borderLeft: '5px solid #34a853' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                            <CheckCircle2 size={24} color="#34a853" strokeWidth={2.5} />
                                            <span style={{ fontSize: 15, fontWeight: 700, color: '#1e8e3e', letterSpacing: '0.02em' }}>ເກນ: ຜ່ານ</span>
                                        </div>
                                        <p style={{ fontSize: 16, color: '#3c4043', lineHeight: 1.7, margin: 0 }}>
                                            {currentTask.criteriaPass}
                                        </p>
                                    </div>

                                    {/* FAIL criteria */}
                                    <div style={{ padding: '28px', background: '#fff8f7', border: '1px solid #f5c6c3', borderRadius: 20, borderLeft: '5px solid #d93025' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                            <AlertCircle size={24} color="#d93025" strokeWidth={2.5} />
                                            <span style={{ fontSize: 15, fontWeight: 700, color: '#c5221f', letterSpacing: '0.02em' }}>ເກນ: ບໍ່ຜ່ານ</span>
                                        </div>
                                        <p style={{ fontSize: 16, color: '#3c4043', lineHeight: 1.7, margin: 0 }}>
                                            {currentTask.criteriaFail}
                                        </p>
                                    </div>
                                </div>

                                {/* ════ ACTION BUTTONS with SVG animation ════ */}
                                <div style={{ display: 'flex', gap: 24, justifyContent: 'center' }}>

                                    {/* FAIL button */}
                                    <button
                                        onClick={() => handleAnswer(currentTask.id, 'fail')}
                                        className={`btn-google btn-fail-style ${failAnim ? 'active shake-x' : ''}`}
                                        style={{ flex: 1, maxWidth: 320, height: 64, fontSize: 18, borderRadius: 32 }}
                                    >
                                        <RippleSVG active={failAnim} color="#d93025" />
                                        <ParticleBurst active={failAnim} color="#d93025" count={7} />
                                        <AnimatedX playing={failAnim} />
                                        <span>ບໍ່ຜ່ານ</span>
                                    </button>

                                    {/* PASS button */}
                                    <button
                                        onClick={() => handleAnswer(currentTask.id, 'pass')}
                                        className={`btn-google btn-pass-style ${passAnim ? 'active' : ''}`}
                                        style={{ flex: 1, maxWidth: 320, height: 64, fontSize: 18, borderRadius: 32 }}
                                    >
                                        <RippleSVG active={passAnim} color="#1a73e8" />
                                        <ParticleBurst active={passAnim} color="#34a853" count={8} />
                                        <AnimatedCheck playing={passAnim} />
                                        <span>ຜ່ານ</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Dot navigation card */}
                        <div className="el-card no-print" style={{ padding: '20px 32px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <button onClick={() => { setCurrentStep(p => Math.max(0, p - 1)); setCardKey(k => k + 1); }}
                                    disabled={currentStep === 0}
                                    className="btn-google"
                                    style={{
                                        background: 'transparent', color: currentStep === 0 ? '#dadce0' : '#5f6368',
                                        border: 'none', padding: '10px 20px', fontSize: 14,
                                        opacity: currentStep === 0 ? 0.4 : 1, boxShadow: 'none'
                                    }}>
                                    <ArrowLeft size={20} /> ຍ້ອນກັບ
                                </button>

                                <StepDots
                                    total={checklistItems.length}
                                    current={currentStep}
                                    answers={answers}
                                    items={checklistItems}
                                    onJump={(i) => { setCurrentStep(i); setCardKey(k => k + 1); }}
                                />

                                <button
                                    onClick={() => { setCurrentStep(p => Math.min(checklistItems.length - 1, p + 1)); setCardKey(k => k + 1); }}
                                    disabled={!answers[currentTask.id] || currentStep === checklistItems.length - 1}
                                    className="btn-google"
                                    style={{
                                        background: 'transparent', color: '#1a73e8', border: 'none',
                                        padding: '10px 20px', fontSize: 14,
                                        opacity: (!answers[currentTask.id] || currentStep === checklistItems.length - 1) ? 0.4 : 1,
                                        boxShadow: 'none'
                                    }}>
                                    ຕໍ່ໄປ  <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>
                    </div>

                ) : (
                    /* ══════ SUMMARY / TABLE MODE ══════ */
                    <div className="fade-up">

                        {/* Document header */}
                        <div className="el-card" style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 24 }}>

                            {/* Top color accent */}
                            <div style={{ height: 6, background: 'linear-gradient(90deg, #1a73e8 0%, #34a853 33%, #f9ab00 66%, #ea4335 100%)' }} />

                            <div style={{ padding: '32px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 32 }}>

                                {/* Logo + title */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
                                        <svg width="80" height="28" viewBox="0 0 80 28">
                                            <text x="0" y="22" fontFamily="'Google Sans', sans-serif" fontWeight="700" fontSize="22" fill="#202124">Joah</text>
                                        </svg>
                                        <span style={{ fontSize: 10, color: '#80868b', letterSpacing: '0.15em', fontWeight: 700 }}>JOB A RIUM</span>
                                    </div>
                                    <div style={{ fontSize: 14, color: '#5f6368', fontWeight: 500, marginBottom: 4 }}>ເຊັກລິສປິດຮ້ານ</div>
                                    <div style={{ fontSize: 24, fontWeight: 700, color: '#202124' }}>Store Closing Checklist</div>
                                </div>

                                {/* Summary stats */}
                                <div style={{ display: 'flex', gap: 24 }}>
                                    {/* SVG donut chart */}
                                    <div style={{ position: 'relative' }}>
                                        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                            <defs>
                                                <linearGradient id="donutPass" x1="0%" y1="0%" x2="100%" y2="0%">
                                                    <stop offset="0%" stopColor="#34a853" />
                                                    <stop offset="100%" stopColor="#1a73e8" />
                                                </linearGradient>
                                            </defs>
                                            <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f3f4" strokeWidth="12" />
                                            <circle cx="50" cy="50" r="40" fill="none"
                                                stroke="url(#donutPass)" strokeWidth="12"
                                                strokeLinecap="round"
                                                strokeDasharray={`${(passCount / checklistItems.length) * 251} 251`}
                                                style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)' }}
                                            />
                                        </svg>
                                        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                            <span style={{ fontSize: 20, fontWeight: 700, color: '#202124' }}>{passCount}</span>
                                            <span style={{ fontSize: 11, color: '#80868b', fontWeight: 500 }}>ຜ່ານ</span>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 12 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#34a853' }} />
                                            <span style={{ fontSize: 14, color: '#3c4043' }}>ຜ່ານ: <strong style={{ color: '#34a853' }}>{passCount}</strong></span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#d93025' }} />
                                            <span style={{ fontSize: 14, color: '#3c4043' }}>ບໍ່ຜ່ານ: <strong style={{ color: '#d93025' }}>{failCount}</strong></span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#dadce0' }} />
                                            <span style={{ fontSize: 14, color: '#80868b' }}>ທັງໝົດ: {checklistItems.length}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Meta info */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f8f9fa', borderRadius: 12, border: '1px solid #e8eaed' }}>
                                        <Calendar size={16} color="#5f6368" />
                                        <input type="date" value={currentDate}
                                            onChange={e => setCurrentDate(e.target.value)}
                                            style={{ background: 'none', border: 'none', fontSize: 14, color: '#3c4043', outline: 'none', fontFamily: 'inherit', fontWeight: 500 }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f8f9fa', borderRadius: 12, border: '1px solid #e8eaed' }}>
                                        <Building2 size={16} color="#5f6368" />
                                        <span style={{ fontSize: 14, color: '#3c4043', fontWeight: 500 }}>ສາຂາ: {branch}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: '#f8f9fa', borderRadius: 12, border: '1px solid #e8eaed' }}>
                                        <PenLine size={16} color="#5f6368" />
                                        <span style={{ fontSize: 14, color: '#80868b', borderBottom: '1px solid #dadce0', flex: 1, minWidth: 100 }}> &nbsp; </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Table card */}
                        <div className="el-card" style={{ borderRadius: 24, overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table id="checklistTable" style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                    <thead>
                                        <tr style={{ background: '#f8f9fa', borderBottom: '2px solid #e8eaed' }}>
                                            {[
                                                { label: 'ລ/ດ', w: 60, center: true },
                                                { label: 'ໝວດ / ລາຍລະອຽດ', w: 'auto' },
                                                { label: 'ຜ່ານ', w: 80, center: true },
                                                { label: 'ບໍ່ຜ່ານ', w: 90, center: true },
                                                { label: 'ໝາຍເຫດ', w: 200 }
                                            ].map((h, i) => (
                                                <th key={i} style={{
                                                    padding: '16px', fontSize: 12, fontWeight: 700,
                                                    color: '#5f6368', letterSpacing: '0.06em', textTransform: 'uppercase',
                                                    textAlign: h.center ? 'center' : 'left', width: h.w
                                                }}>
                                                    {h.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checklistItems.map((item, idx) => {
                                            const ans = answers[item.id];
                                            return (
                                                <tr key={item.id} className="table-row"
                                                    style={{ borderBottom: '1px solid #f1f3f4', background: 'white' }}>
                                                    <td style={{ padding: '16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#80868b' }}>
                                                        {String(item.id).padStart(2, '0')}
                                                    </td>
                                                    <td style={{ padding: '16px' }}>
                                                        <div style={catChipStyle(item.catColor)}>
                                                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.catColor }} />
                                                            {item.category}
                                                        </div>
                                                        <div style={{ marginTop: 6, fontSize: 15, color: '#202124', fontWeight: 500 }}>{item.task}</div>
                                                    </td>
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        {ans === 'pass' && (
                                                            <span className="pop-in" style={{ display: 'inline-block' }}>
                                                                <TableCheckSVG />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                                        {ans === 'fail' && (
                                                            <span className="pop-in" style={{ display: 'inline-block' }}>
                                                                <TableFailSVG />
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '16px' }}>
                                                        <input type="text"
                                                            value={remarks[item.id] || ''}
                                                            onChange={e => setRemarks(p => ({ ...p, [item.id]: e.target.value }))}
                                                            placeholder="ໝາຍເຫດ..."
                                                            className="input-underline"
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Table footer */}
                            <div style={{ padding: '20px 32px', background: '#f8f9fa', borderTop: '1px solid #e8eaed', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
                                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                                    {['ປອດໄພ', 'ສະອາດ', 'ຖືກຕ້ອງ', 'ເປັນລະບຽບ', 'ໃຊ້ງານໄດ້'].map((tag, i) => (
                                        <span key={i} style={{ fontSize: 13, color: '#5f6368', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Check size={14} color="#34a853" /> {tag}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                    {/* Animated mini score bar */}
                                    <svg width="120" height="32" viewBox="0 0 120 32">
                                        <rect x="0" y="10" width="120" height="12" rx="6" fill="#e8eaed" />
                                        <rect x="0" y="10"
                                            width={passCount > 0 ? (passCount / checklistItems.length) * 120 : 0}
                                            height="12" rx="6" fill="#34a853"
                                            style={{ transition: 'width 1s cubic-bezier(0.4,0,0.2,1)' }}
                                        />
                                        <text x="60" y="28" textAnchor="middle" fontSize="10" fill="#5f6368" fontFamily="'Google Sans', sans-serif" fontWeight="500">
                                            {Math.round((passCount / checklistItems.length) * 100)}% ຜ່ານ
                                        </text>
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Info tip ── */}
                <div className="no-print" style={{ marginTop: 24, padding: '16px 24px', background: '#e8f0fe', borderRadius: 16, display: 'flex', gap: 16, alignItems: 'flex-start', border: '1px solid #d2e3fc' }}>
                    <Info size={20} color="#1a73e8" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 14, color: '#174ea6', margin: 0, lineHeight: 1.6 }}>
                        {isWizardMode
                            ? "ເລືອກ 'ຜ່ານ' ຫຼື 'ບໍ່ຜ່ານ' ໂດຍອີງຕາມເກນທີ່ສະແດງ. ກົດ dot ໄດ້ເພື່ອກະໂດດໄປລາຍການໃດກໍ່ໄດ້."
                            : "Checklist ນີ້ຮັບປະກັນຄຸນນະພາບ ແລະ ຄວາມພ້ອມກ່ອນປິດຮ້ານ. ກວດໃຫ້ຄົບ 14 ລາຍການ."
                        }
                    </p>
                </div>

            </div>
        </>
    );
};
export default StoreClosingChecklist;