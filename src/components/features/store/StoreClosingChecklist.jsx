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
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20">
            {[0, 1, 2].map(i => (
                <circle key={i} cx="50%" cy="50%"
                    r="0" fill="none"
                    stroke={color} strokeWidth={3 - i * 0.8}
                    className="animate-ripple"
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
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mr-2">
        <circle cx="12" cy="12" r="10"
            className={`stroke-blue-600 transition-fill duration-300 ${playing ? 'fill-blue-50' : 'fill-white'}`}
            strokeWidth="2"
        />
        <path
            d="M7 12 L10.5 15.5 L17 9"
            className={`stroke-blue-600 transition-all duration-500 delay-75 ${playing ? 'opacity-100' : 'opacity-0'}`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            strokeDasharray="22"
            style={{ strokeDashoffset: playing ? 0 : 22 }}
        />
    </svg>
);

const AnimatedX = ({ playing }) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="mr-2">
        <circle cx="12" cy="12" r="10"
            className={`stroke-red-600 transition-fill duration-300 ${playing ? 'fill-red-50' : 'fill-white'}`}
            strokeWidth="2"
        />
        <path
            d="M9 9 L15 15"
            className={`stroke-red-600 transition-all duration-300 ${playing ? 'opacity-100' : 'opacity-0'}`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="15"
            style={{ strokeDashoffset: playing ? 0 : 15 }}
        />
        <path
            d="M15 9 L9 15"
            className={`stroke-red-600 transition-all duration-300 delay-100 ${playing ? 'opacity-100' : 'opacity-0'}`}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="15"
            style={{ strokeDashoffset: playing ? 0 : 15 }}
        />
    </svg>
);

const ParticleBurst = ({ active, color, count = 8 }) => {
    if (!active) return null;
    return (
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-20">
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
        <div className="relative h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500 ease-in-out shadow-sm"
                style={{ width: `${pct}%` }} />
        </div>
    );
};

const StepDots = ({ total, current, answers, items, onJump }) => (
    <div className="flex gap-1.5 items-center flex-wrap justify-center">
        {Array.from({ length: total }).map((_, i) => {
            const ans = answers[items[i].id];
            const isCur = i === current;
            return (
                <button key={i} onClick={() => onJump(i)}
                    title={`ລາຍການ ${i + 1}`}
                    className={`h-2.5 rounded-full transition-all duration-300 transform outline-none
                        ${isCur ? 'w-8 bg-blue-600 scale-110 opacity-100' : 'w-2.5 opacity-60'}
                        ${!isCur && ans === 'pass' ? 'bg-emerald-500 opacity-80' : ''}
                        ${!isCur && ans === 'fail' ? 'bg-rose-500 opacity-80' : ''}
                        ${!isCur && !ans ? 'bg-slate-200' : ''}`}
                />
            );
        })}
    </div>
);

const TableCheckSVG = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="block">
        <circle cx="12" cy="12" r="10" fill="#e6f4ea" className="animate-scale-in" />
        <path d="M7 12 L10.5 15.5 L17 9"
            stroke="#34a853" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            strokeDasharray="14"
            className="animate-path-flow"
            style={{ animation: 'svgDraw 0.4s ease forwards' }}
        />
    </svg>
);

const TableFailSVG = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="block">
        <circle cx="12" cy="12" r="10" fill="#fce8e6" className="animate-scale-in" />
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
    const catChipStyle = (color) => `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap`;

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 px-4 md:px-6 animate-fade-in">
            {/* ── NAV ── */}
            <div className="print:hidden flex justify-between items-center mb-8 pt-5">
                <button onClick={onBack} className="btn-secondary px-5 py-2.5 rounded-full flex items-center gap-2">
                    <ChevronLeft size={20} /> ກັບຄືນ
                </button>
                <div className="flex gap-3">
                    {!isWizardMode && (
                        <button onClick={resetWizard} className="btn-secondary px-5 py-2.5 rounded-full flex items-center gap-2 border-amber-400 text-amber-600 hover:bg-amber-50">
                            <RotateCcw size={18} /> ເຮັດຄືນ
                        </button>
                    )}
                    <button onClick={copyTable} className={`px-5 py-2.5 rounded-full flex items-center gap-2 transition-all duration-300 shadow-lg ${copyStatus ? 'bg-emerald-600 text-white shadow-emerald-500/20' : 'bg-blue-600 text-white shadow-blue-500/20'}`}>
                        {copyStatus ? <Check size={18} /> : <Copy size={18} />}
                        {copyStatus ? 'ຄັດລອກແລ້ວ!' : 'ຄັດລອກ Excel'}
                    </button>
                    <button onClick={() => window.print()} className="btn-secondary px-5 py-2.5 rounded-full flex items-center gap-2">
                        <Printer size={18} /> Print
                    </button>
                </div>
            </div>

            {/* ══════ WIZARD MODE ══════ */}
            {isWizardMode && currentTask ? (
                <div className="space-y-6">
                    {/* Progress header card */}
                    <div className="glass-card p-6 md:p-8 rounded-3xl shadow-xl border-white/40">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-6">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                                    Store Closing Checklist
                                </div>
                                <div className="text-3xl font-black text-slate-800 dark:text-white flex items-baseline gap-3">
                                    ລາຍການທີ {currentStep + 1}
                                    <span className="text-lg text-slate-400 font-bold tracking-tight">/ {checklistItems.length}</span>
                                </div>
                            </div>

                            {/* Score badges */}
                            <div className="flex gap-4">
                                <div className="flex flex-col items-center px-6 py-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl min-w-[100px] border border-emerald-100 dark:border-emerald-500/20">
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{passCount}</span>
                                    <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-widest mt-1">ຜ່ານ</span>
                                </div>
                                <div className="flex flex-col items-center px-6 py-3 bg-rose-50 dark:bg-rose-500/10 rounded-2xl min-w-[100px] border border-rose-100 dark:border-rose-500/20">
                                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none">{failCount}</span>
                                    <span className="text-[10px] text-rose-500 dark:text-rose-400 font-bold uppercase tracking-widest mt-1">ບໍ່ຜ່ານ</span>
                                </div>
                            </div>
                        </div>
                        <LinearProgress value={currentStep + (currentTask && answers[currentTask.id] ? 1 : 0)} total={checklistItems.length} />
                        <div className="flex justify-end mt-3">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{progress}% ສຳເລັດ</span>
                        </div>
                    </div>

                    {/* Main question card */}
                    <div key={cardKey} className="animate-scale-in glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-white/60">
                        {/* Category color bar */}
                        <div className="h-2 w-full" style={{ backgroundColor: currentTask.catColor }} />

                        <div className="p-8 md:p-12">
                            {/* Category chip */}
                            <div className="mb-8">
                                <span className={catChipStyle(currentTask.catColor)} style={{ backgroundColor: `${currentTask.catColor}15`, color: currentTask.catColor, border: `1px solid ${currentTask.catColor}30` }}>
                                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: currentTask.catColor }} />
                                    {currentTask.category}
                                </span>
                            </div>

                            {/* Task title */}
                            <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white mb-10 leading-relaxed md:leading-tight">
                                {currentTask.task}
                            </h2>

                            {/* Criteria cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                                {/* PASS criteria */}
                                <div className="p-7 bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 rounded-3xl border-l-[6px] border-l-emerald-500">
                                    <div className="flex items-center gap-3 mb-4">
                                        <CheckCircle2 size={24} className="text-emerald-600 dark:text-emerald-400" strokeWidth={3} />
                                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">ເກນ: ຜ່ານ</span>
                                    </div>
                                    <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                        {currentTask.criteriaPass}
                                    </p>
                                </div>

                                {/* FAIL criteria */}
                                <div className="p-7 bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 rounded-3xl border-l-[6px] border-l-rose-500">
                                    <div className="flex items-center gap-3 mb-4">
                                        <AlertCircle size={24} className="text-rose-600 dark:text-rose-400" strokeWidth={3} />
                                        <span className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">ເກນ: ບໍ່ຜ່ານ</span>
                                    </div>
                                    <p className="text-base text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                                        {currentTask.criteriaFail}
                                    </p>
                                </div>
                            </div>

                            {/* ACTION BUTTONS */}
                            <div className="flex flex-col sm:flex-row gap-6 justify-center">
                                {/* FAIL button */}
                                <button
                                    onClick={() => handleAnswer(currentTask.id, 'fail')}
                                    className={`group flex-1 max-w-sm h-16 rounded-full flex items-center justify-center gap-3 font-black text-lg transition-all duration-300 shadow-xl relative overflow-hidden active:scale-95
                                        ${failAnim ? 'bg-rose-600 text-white shadow-rose-500/40 ring-4 ring-rose-500/20' : 'bg-white dark:bg-slate-800 text-rose-600 border-2 border-rose-100 dark:border-rose-900 shadow-slate-200 dark:shadow-none hover:bg-rose-50 dark:hover:bg-rose-500/10'}`}
                                >
                                    <RippleSVG active={failAnim} color="#e11d48" />
                                    <ParticleBurst active={failAnim} color="#e11d48" count={7} />
                                    <AnimatedX playing={failAnim} />
                                    <span>ບໍ່ຜ່ານ</span>
                                </button>

                                {/* PASS button */}
                                <button
                                    onClick={() => handleAnswer(currentTask.id, 'pass')}
                                    className={`group flex-1 max-w-sm h-16 rounded-full flex items-center justify-center gap-3 font-black text-lg transition-all duration-300 shadow-xl relative overflow-hidden active:scale-95
                                        ${passAnim ? 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-blue-500/20' : 'bg-white dark:bg-slate-800 text-blue-600 border-2 border-blue-100 dark:border-blue-900 shadow-slate-200 dark:shadow-none hover:bg-blue-50 dark:hover:bg-blue-500/10'}`}
                                >
                                    <RippleSVG active={passAnim} color="#2563eb" />
                                    <ParticleBurst active={passAnim} color="#10b981" count={8} />
                                    <AnimatedCheck playing={passAnim} />
                                    <span>ຜ່ານ</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Dot navigation card */}
                    <div className="glass-card print:hidden p-5 md:px-8 rounded-3xl shadow-lg border-white/40">
                        <div className="flex items-center justify-between">
                            <button onClick={() => { setCurrentStep(p => Math.max(0, p - 1)); setCardKey(k => k + 1); }}
                                disabled={currentStep === 0}
                                className={`flex items-center gap-2 font-bold text-sm transition-opacity ${currentStep === 0 ? 'opacity-30 cursor-not-allowed' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white'}`}
                            >
                                <ArrowLeft size={20} /> <span className="hidden sm:inline">ຍ້ອນກັບ</span>
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
                                disabled={!currentTask || !answers[currentTask.id] || currentStep === checklistItems.length - 1}
                                className={`flex items-center gap-2 font-bold text-sm transition-opacity ${(!currentTask || !answers[currentTask.id] || currentStep === checklistItems.length - 1) ? 'opacity-30 cursor-not-allowed' : 'text-blue-600 dark:text-blue-400 hover:opacity-80'}`}
                            >
                                <span className="hidden sm:inline">ຕໍ່ໄປ</span> <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* ══════ SUMMARY / TABLE MODE ══════ */
                <div className="animate-fade-in space-y-8">
                    {/* Document header */}
                    <div className="glass-card rounded-[2rem] overflow-hidden shadow-xl border-white/60">
                        {/* Top color accent */}
                        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-emerald-500 to-rose-500" />

                        <div className="p-8 flex flex-col lg:flex-row items-center justify-between gap-10">
                            {/* Logo + title */}
                            <div className="text-center lg:text-left">
                                <div className="flex items-baseline justify-center lg:justify-start gap-2 mb-2">
                                    <span className="text-2xl font-black text-slate-800 dark:text-white">Joah</span>
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">JOB A RIUM</span>
                                </div>
                                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-1">ເຊັກລິສປິດຮ້ານ</div>
                                <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Store Closing Checklist</h1>
                            </div>

                            {/* Summary stats */}
                            <div className="flex items-center gap-8 bg-slate-50/50 dark:bg-slate-900/50 p-6 rounded-3xl border border-white/40 dark:border-slate-800">
                                {/* SVG donut chart */}
                                <div className="relative w-24 h-24">
                                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-100 dark:text-slate-800" />
                                        <circle cx="50" cy="50" r="40" fill="none"
                                            stroke="url(#donutPass)" strokeWidth="12"
                                            strokeLinecap="round"
                                            strokeDasharray={`${(passCount / checklistItems.length) * 251} 251`}
                                            className="transition-all duration-1000 ease-out"
                                        />
                                        <defs>
                                            <linearGradient id="donutPass" x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="#10b981" />
                                                <stop offset="100%" stopColor="#3b82f6" />
                                            </linearGradient>
                                        </defs>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                        <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{passCount}</span>
                                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">ຜ່ານ</span>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full animate-pulse bg-emerald-500" />
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">ຜ່ານ: <span className="text-emerald-600 dark:text-emerald-400">{passCount}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300">ບໍ່ຜ່ານ: <span className="text-rose-600 dark:text-rose-400">{failCount}</span></span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
                                        <span className="text-sm font-bold text-slate-400">ທັງໝົດ: {checklistItems.length}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Meta info */}
                            <div className="grid grid-cols-1 gap-3 sm:min-w-[240px]">
                                <div className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-2xl">
                                    <Calendar size={18} className="text-slate-400" />
                                    <input type="date" value={currentDate}
                                        onChange={e => setCurrentDate(e.target.value)}
                                        className="bg-transparent border-none text-sm font-bold text-slate-700 dark:text-white outline-none w-full" />
                                </div>
                                <div className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-2xl">
                                    <Building2 size={18} className="text-slate-400" />
                                    <span className="text-sm font-bold text-slate-700 dark:text-white lowercase">ສາຂາ: {branch}</span>
                                </div>
                                <div className="flex items-center gap-3 p-3.5 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 rounded-2xl">
                                    <PenLine size={18} className="text-slate-400" />
                                    <div className="flex-1 border-b border-dashed border-slate-200 dark:border-slate-700 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table card */}
                    <div className="glass-card rounded-[2rem] overflow-hidden shadow-2xl border-white/60">
                        <div className="overflow-x-auto min-h-[400px]">
                            <table id="checklistTable" className="w-full border-collapse">
                                <thead>
                                    <tr className="bg-slate-50/80 dark:bg-slate-900/80 border-b-2 border-slate-200/50 dark:border-slate-800/50">
                                        <th className="p-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-20">ລ/ດ</th>
                                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">ໝວດ / ລາຍລະອຽດ</th>
                                        <th className="p-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-24">ຜ່ານ</th>
                                        <th className="p-5 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 w-24">ບໍ່ຜ່ານ</th>
                                        <th className="p-5 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 min-w-[200px]">ໝາຍເຫດ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/50">
                                    {checklistItems.map((item, idx) => {
                                        const ans = answers[item.id];
                                        return (
                                            <tr key={item.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-500/5 transition-colors duration-200">
                                                <td className="p-5 text-center text-xs font-black text-slate-400 tracking-tighter">
                                                    {String(item.id).padStart(2, '0')}
                                                </td>
                                                <td className="p-5">
                                                    <div className="flex flex-col gap-1.5">
                                                        <span className={catChipStyle(item.catColor)} style={{ backgroundColor: `${item.catColor}15`, color: item.catColor, border: `1px solid ${item.catColor}30` }}>
                                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.catColor }} />
                                                            {item.category}
                                                        </span>
                                                        <div className="text-sm font-bold text-slate-800 dark:text-white">{item.task}</div>
                                                    </div>
                                                </td>
                                                <td className="p-5 text-center">
                                                    {ans === 'pass' && (
                                                        <div className="flex justify-center animate-scale-in">
                                                            <TableCheckSVG />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-5 text-center">
                                                    {ans === 'fail' && (
                                                        <div className="flex justify-center animate-scale-in">
                                                            <TableFailSVG />
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-5">
                                                    <input type="text"
                                                        value={remarks[item.id] || ''}
                                                        onChange={e => setRemarks(p => ({ ...p, [item.id]: e.target.value }))}
                                                        placeholder="ໝາຍເຫດ..."
                                                        className="w-full bg-transparent border-b border-transparent focus:border-blue-500/50 py-1 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                                    />
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Table footer */}
                        <div className="p-6 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-6">
                            <div className="flex flex-wrap justify-center gap-4">
                                {['ປອດໄພ', 'ສະອາດ', 'ຖືກຕ້ອງ', 'ເປັນລະບຽບ', 'ໃຊ້ງານໄດ້'].map((tag, i) => (
                                    <span key={i} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                        <Check size={14} className="text-emerald-500 animate-pulse" /> {tag}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{Math.round((passCount / checklistItems.length) * 100)}% ສຳເລັດ</span>
                                    <div className="w-32 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                                        <div className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-1000 shadow-sm shadow-emerald-500/20"
                                            style={{ width: `${(passCount / checklistItems.length) * 100}%` }} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Info tip ── */}
            <div className="print:hidden mt-8 p-5 bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20 rounded-3xl flex gap-4 items-start shadow-sm">
                <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300 leading-relaxed">
                    {isWizardMode
                        ? "ເລືອກ 'ຜ່ານ' ຫຼື 'ບໍ່ຜ່ານ' ໂດຍອີງຕາມເກນທີ່ສະແດງ. ກົດ dot ໄດ້ເພື່ອກະໂດດໄປລາຍການໃດກໍ່ໄດ້."
                        : "Checklist ນີ້ຮັບປະກັນຄຸນນະພາບ ແລະ ຄວາມພ້ອມກ່ອນປິດຮ້ານ. ກວດໃຫ້ຄົບ 14 ລາຍການ."
                    }
                </p>
            </div>
        </div>
    );
};

export default StoreClosingChecklist;