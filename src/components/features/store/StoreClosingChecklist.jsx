import React, { useState, useEffect } from 'react';
import {
    Copy,
    Printer,
    ChevronLeft,
    CheckCircle2,
    XCircle,
    Calendar,
    Building2,
    PenLine,
    Check,
    AlertTriangle,
    ChevronRight,
    ArrowLeft,
    RotateCcw,
    Sparkles,
    ShieldCheck,
    ThumbsUp,
    ThumbsDown
} from 'lucide-react';

const StoreClosingChecklist = ({ onBack }) => {
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [branch, setBranch] = useState('PSN');
    const [copyStatus, setCopyStatus] = useState(false);

    // Wizard States
    const [isWizardMode, setIsWizardMode] = useState(true);
    const [currentStep, setCurrentStep] = useState(0);
    const [answers, setAnswers] = useState({}); // { itemId: 'pass' | 'fail' }
    const [remarks, setRemarks] = useState({}); // { itemId: string }

    // Checklist items with detailed criteria
    const checklistItems = [
        {
            id: 1,
            category: "ດ້ານນອກ / ລານຈອດລົດ",
            task: "ສະອາດ, ເປັນລະບຽບ, ພ້ອມໃຫ້ບໍລິການ",
            criteriaPass: "ພື້ນທີ່ສະອາດ, ບໍ່ມີຂີ້ເຫຍື້ອ, ປ້າຍຕ່າງໆຕັ້ງຊື່ເປັນລະบຽບ",
            criteriaFail: "ພົບຂີ້ເຫຍື້ອຊະຊາຍ, ພື້ນທີ່ເປິເປື້ອນ ຫຼື ມີສິ່ງກີดຂວາງທາງຍ່າງ"
        },
        {
            id: 2,
            category: "ດ້ານນອກ / ລານຈອດລົດ",
            task: "ຄວາມປອດໄພທົ່ວໄປ",
            criteriaPass: "ໄຟເຍືອງທາງແຈ້ງດີ, ບໍ່ມີຈຸດສ່ຽງ ຫຼື ອຸປະຕິເຫດ, ປະຕູປິດແໜ້ນໜາ",
            criteriaFail: "ໄຟດັບເປັນບາງຈຸດ, ພົບວັດຖຸອັນຕະລາຍ ຫຼື ປະຕູຮົ້ວມີບັນຫາ"
        },
        {
            id: 3,
            category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ",
            task: "ສິນຄ້າເຕັມແທ່ນ (Full Stock)",
            criteriaPass: "ສິນຄ້າຖືກຕີເຕັມໜ້າຊັ້ນ, ບໍ່ມີຊ່ອງວ່າງທີ່ເຫັນໄດ້ຊັດເຈນ",
            criteriaFail: "ມີຊ່ອງວ່າງຫຼາຍ, ສິນຄ້າໜ້າຊັ້ນບາງ ຫຼື ບໍ່ໄດ້ດຶງສິນຄ້າອອກມາຂ້າງໜ້າ"
        },
        {
            id: 4,
            category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ",
            task: "ຈຳນວນ SKU ຄົບຖ້ວນ",
            criteriaPass: "ສິນຄ້າວາງຄົບຕາມແຜนຜັງ (Planogram), ບໍ່ມີສິນຄ້າຫາຍຈາກຊັ້ນ",
            criteriaFail: "ສິນຄ້າບາງ SKU ຫາຍໄປ ຫຼື ວາງສິນຄ້າອື່ນມາປົນແທນ"
        },
        {
            id: 5,
            category: "ພື້ນທີ່ຂາຍ / ຊັ້ນວາງສິນຄ້າ",
            task: "ຄວາມສະອາດຂອງຊັ້ນວາງ",
            criteriaPass: "ບໍ່ມີຂີ້ຝຸ່ນ, ຊັ້ນວາງໃສສະອາດ, ບໍ່ມີສິ່ງຂອງທີ່ບໍ່ກ່ຽວຂ້ອງວາງປົນ",
            criteriaFail: "ພົບຂີ້ຝຸ່ນໜາ, ມີຄາບເປື້ອນ ຫຼື ມີຂີ້ເຫຍື້ອຕົກຄ້າງຕາມຊອກຊັ້ນ"
        },
        {
            id: 6,
            category: "ພື້ນທີ່ຂາຍ / ປ້າຍລາຄາ",
            task: "ຕຳແໜ່ງປ້າຍລາຄາກົງກັບສິນຄ້າ",
            criteriaPass: "ປ້າຍລາຄາວາງຢູ່ລຸ່ມສິນຄ້າທີ່ກ່ຽວຂ້ອງ 100%, ບໍ່ມີການວາງສະຫຼັບ",
            criteriaFail: "ປ້າຍລາຄາວາງບໍ່ກົງກັບຕົວສິນຄ້າ ເຮັດໃຫ້ລູກຄ້າສັບສົນ"
        },
        {
            id: 7,
            category: "ພື້ນທີ່ຂາຍ / ປ້າຍລາຄາ",
            task: "ປ້າຍລາຄາສິນຄ້າຄົບຖ້ວນ",
            criteriaPass: "ທຸກໆສິນຄ້າມີປ້າຍລາຄາບອກຊັດເຈນ, ປ້າຍບໍ່ຈີກຂาด",
            criteriaFail: "ມີສິນຄ້າທີ່ບໍ່ມີປ້າຍລາຄາ ຫຼື ປ້າຍລາคາເກົ່າ/ຈີກຂາດຈົນເບິ່ງບໍ່ເຫັນ"
        },
        {
            id: 8,
            category: "ເຄົາເຕີ້ບໍລິການ / ແຄັດເຊຍ",
            task: "ພື້ນທີ່ຊຳລະເງິນສະອາດ",
            criteriaPass: "ເຄົາເຕີ້ບໍ່ມີຂີ້ຝຸ່ນ, ຄອມພິວເຕີ ແລະ ອຸປະກອນວາງເປັນລະບຽບ",
            criteriaFail: "ມີຂີ້ເຫຍື້ອໃຕ້ເຄົາເຕີ້, ພື້ນທີ່ເປິເປື້ອນ ຫຼື ເອກະສານວາງຊະຊາຍ"
        },
        {
            id: 9,
            category: "ເຄົາເຕີ້ບໍລິການ / ແຄັດເຊຍ",
            task: "ການກະກຽມເງິນທອນ ແລະ ຂໍ້ມູນ",
            criteriaPass: "ເງິນທອນກຽມຄົບ, ອັດຕາແລກປ່ຽນອັບເດດລ້າສຸດ",
            criteriaFail: "ເງິນທອນບໍ່ຄົບ, ບໍ່ມີປ້າຍອັດຕາແລกປ່ຽນ ຫຼື ຂໍ້ມູນຜິດພາດ"
        },
        {
            id: 10,
            category: "ເຄົາເຕີ້ບໍລິການ / ແຄັດເຊຍ",
            task: "ລະບົບຕູ້ເກັບເງິນກຽມພ້ອม",
            criteriaPass: "ຕູ້ເກັບເງິນປິດລັອກແໜ້ນໜາ, ລະບົບໄຟຟ້າປິດປົກກະຕິ",
            criteriaFail: "ຕູ້ບໍ່ໄດ້ລັອກ, ພົບບັນຫາທາງເຕັກນິກທີ່ບໍ່ໄດ້ແຈ້ງການ"
        },
        {
            id: 11,
            category: "ສາງ / ພື້ນທີ່ຮັບເຂົ້າ",
            task: "ຄວາມສະອາດ ແລະ ເປັນລະບຽບ",
            criteriaPass: "ທາງຍ່າງໃນສາງໂລ່ງ, ບໍ່ມີກ່ອງວາງກີດຂວາງ, ພື້ນສະອາດ",
            criteriaFail: "ມີກ່ອງວາງຢຽດທາງຍ່າງ, ສາງເປິເປື້ອນ ຫຼື ບໍ່ໄດ້ກວາດຂີ້ຝຸ່ນ"
        },
        {
            id: 12,
            category: "ສາງ / ພື້ນທີ່ຮັບເຂົ້າ",
            task: "ຮັບສິນຄ້າເຂົ້າສາງຖືກຕ້ອງ",
            criteriaPass: "ສິນຄ້າທີ່ຮັບມາໃໝ່ຖືກເຊັກຄົບ ແລະ ຈັດລຽງເຂົ້າທີ່",
            criteriaFail: "ມີສິນຄ້າຕົກຄ້າງທີ່ຍັງບໍ່ໄດ້ເຊັກ ຫຼື ວາງບໍ່ຖືກບ່ອນ"
        },
        {
            id: 13,
            category: "ສາງ / ພື້ນທີ່ຮັບເຂົ້າ",
            task: "ຈັດເກັບສິນຄ້າເປັນກຸ່ມປອດໄພ",
            criteriaPass: "ສິນຄ້າໜັກວາງລຸ່ມ, ສິນຄ້າເບົາວາງເທິງ, ບໍ່ສ່ຽງຕໍ່ການລົ້ມທັບ",
            criteriaFail: "ວາງຊ້ອນກັນສูງເກີນໄປ, ວາງສິນຄ້າບໍ່สมดຸນ ຫຼື ປົນປະເພດກັນ"
        },
        {
            id: 14,
            category: "ອື່ນໆ",
            task: "ການແຈ້ງງານທີ່ຍັງຄ້າງ (Handover)",
            criteriaPass: "ມີການຈົດບັນທຶກວຽກທີ່ຄ້າງໄວ້ຊັດເຈນເພື່ອຮອບການເປີດຮ້ານມື້ຖັດໄປ",
            criteriaFail: "ບໍ່ມີການແຈ້ງວຽກ, ເຮັດໃຫ້ຮອບເປີດຮ້ານພົບບັນຫາຕໍ່ເນື່ອງ"
        }
    ];

    const handleAnswer = (itemId, status) => {
        setAnswers(prev => ({ ...prev, [itemId]: status }));
        // Auto-next delay for smoother experience
        setTimeout(() => {
            if (currentStep < checklistItems.length - 1) {
                setCurrentStep(prev => prev + 1);
            } else {
                setIsWizardMode(false); // Go to summary after last item
            }
        }, 400);
    };

    const resetWizard = () => {
        setAnswers({});
        setRemarks({});
        setCurrentStep(0);
        setIsWizardMode(true);
    };

    const copyTable = () => {
        const table = document.getElementById('checklistTable');
        if (!table) return;

        const range = document.createRange();
        range.selectNode(table);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);

        try {
            document.execCommand('copy');
            setCopyStatus(true);
            setTimeout(() => setCopyStatus(false), 2000);
        } catch (err) {
            alert('ບໍ່ສາມາດຄັດລອກໄດ້');
        }
        window.getSelection().removeAllRanges();
    };

    const handlePrint = () => {
        window.print();
    };

    const currentTask = checklistItems[currentStep];
    const progress = ((currentStep + 1) / checklistItems.length) * 100;

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in-up pb-20">
            {/* Navigation Header */}
            <div className="flex items-center justify-between no-print">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm border border-slate-200 dark:border-slate-800"
                >
                    <ChevronLeft size={18} />
                    <span>ກັບຄືນ</span>
                </button>
                <div className="flex gap-3">
                    {!isWizardMode && (
                        <button
                            onClick={resetWizard}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-bold text-sm hover:bg-amber-100 transition-all border border-amber-200 dark:border-amber-800/50 shadow-sm"
                        >
                            <RotateCcw size={18} />
                            <span>ເຮັດຄືນໃໝ່</span>
                        </button>
                    )}
                    <button
                        onClick={copyTable}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all shadow-lg ${copyStatus ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-slate-800 text-white hover:bg-slate-700 shadow-slate-900/20'
                            }`}
                    >
                        {copyStatus ? <Check size={18} /> : <Copy size={18} />}
                        <span>{copyStatus ? 'ຄັດລອກແລ້ວ!' : 'ຄັດລອກໄປ Excel'}</span>
                    </button>
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-800 shadow-lg"
                    >
                        <Printer size={18} />
                        <span>Print Checklist</span>
                    </button>
                </div>
            </div>

            {isWizardMode ? (
                /* STEP-BY-STEP WIZARD MODE */
                <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    {/* Wizard Progress Bar */}
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 w-full">
                        <div
                            className="h-full bg-gradient-to-r from-joah-orange to-amber-500 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="p-8 md:p-12 space-y-8">
                        {/* Header Info */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 text-joah-orange">
                                    <Sparkles size={18} />
                                    <span className="text-xs font-black uppercase tracking-widest">Store Closing Checklist</span>
                                </div>
                                <h2 className="text-3xl font-black text-slate-900 dark:text-white leading-tight">
                                    ກວດສອບລາຍການທີ {currentStep + 1}
                                </h2>
                                <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">
                                    ຫມວດ: {currentTask.category}
                                </p>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl flex items-center gap-4 border border-slate-100 dark:border-slate-700/50">
                                <span className="text-4xl font-black text-slate-200 dark:text-slate-700">#{currentTask.id}</span>
                                <div className="h-10 w-px bg-slate-200 dark:bg-slate-700" />
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase">Progress</p>
                                    <p className="text-xl font-black text-slate-800 dark:text-white">{currentStep + 1} / {checklistItems.length}</p>
                                </div>
                            </div>
                        </div>

                        {/* Task Question */}
                        <div className="bg-amber-50/50 dark:bg-amber-900/10 p-8 rounded-[2rem] border-2 border-amber-100 dark:border-amber-900/30">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-6 text-center">
                                {currentTask.task}
                            </h3>

                            {/* CRITERIA DETAILS */}
                            <div className="grid md:grid-cols-2 gap-6">
                                {/* PASS Criteria */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 text-emerald-100 dark:text-emerald-900/20 group-hover:scale-125 transition-transform">
                                        <CheckCircle2 size={64} />
                                    </div>
                                    <div className="relative z-10 space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 text-[10px] font-black">
                                            <ThumbsUp size={12} />
                                            ເກນການໃຫ້: ຜ່ານ
                                        </div>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {currentTask.criteriaPass}
                                        </p>
                                    </div>
                                </div>

                                {/* FAIL Criteria */}
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 shadow-sm relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-3 text-rose-100 dark:text-rose-900/20 group-hover:scale-125 transition-transform">
                                        <XCircle size={64} />
                                    </div>
                                    <div className="relative z-10 space-y-3">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 dark:bg-rose-900/30 text-rose-600 text-[10px] font-black">
                                            <ThumbsDown size={12} />
                                            ເກນການໃຫ້: ບໍ່ຜ່ານ
                                        </div>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300 leading-relaxed">
                                            {currentTask.criteriaFail}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 py-4">
                            <button
                                onClick={() => handleAnswer(currentTask.id, 'fail')}
                                className="w-full md:w-auto px-12 py-5 rounded-3xl bg-white dark:bg-slate-800 border-2 border-rose-200 dark:border-rose-900/50 text-rose-500 font-black text-xl hover:bg-rose-500 hover:text-white transition-all shadow-xl shadow-rose-500/10 flex items-center justify-center gap-3 active:scale-95"
                            >
                                <XCircle size={28} />
                                <span>ບໍ່ຜ່ານ</span>
                            </button>
                            <button
                                onClick={() => handleAnswer(currentTask.id, 'pass')}
                                className="w-full md:w-auto px-12 py-5 rounded-3xl bg-emerald-500 text-white font-black text-xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-3 active:scale-95"
                            >
                                <CheckCircle2 size={28} />
                                <span>ຜ່ານ</span>
                            </button>
                        </div>

                        {/* Wizard Navigation */}
                        <div className="flex items-center justify-between pt-8 border-t border-slate-100 dark:border-slate-800">
                            <button
                                onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                                disabled={currentStep === 0}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 font-bold transition-all"
                            >
                                <ArrowLeft size={18} />
                                <span>ຍ້ອນກັບ</span>
                            </button>

                            <div className="flex gap-2">
                                {checklistItems.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${i === currentStep ? 'w-6 bg-joah-orange' :
                                                answers[checklistItems[i].id] ? 'bg-emerald-400' : 'bg-slate-200 dark:bg-slate-700'
                                            }`}
                                    />
                                ))}
                            </div>

                            <button
                                onClick={() => setCurrentStep(prev => Math.min(checklistItems.length - 1, prev + 1))}
                                disabled={currentStep === checklistItems.length - 1 || !answers[currentTask.id]}
                                className="flex items-center gap-2 text-slate-400 hover:text-slate-600 disabled:opacity-30 font-bold transition-all"
                            >
                                <span>ຕໍ່ໄປ</span>
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* SUMMARY / TABLE VIEW (FOR PRINT & EXCEL) */
                <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 print:shadow-none print:border-none">

                    {/* Document Header */}
                    <div className="flex flex-col md:flex-row items-stretch border-b-4 border-yellow-400">

                        {/* Logo Section */}
                        <div className="flex flex-col items-center justify-center px-8 py-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 min-w-[150px]">
                            <div className="text-3xl font-black tracking-tight text-slate-800 dark:text-white font-mono">Joah</div>
                            <div className="text-[10px] text-slate-400 font-black tracking-[0.3em] mt-1 font-mono">JOB A RIUM</div>
                        </div>

                        {/* Title Section */}
                        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                            <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-white text-center leading-tight">ເຊັກລິສກວດຄວາມພ້ອມກ່ອນ</h2>
                            <p className="text-lg md:text-xl font-black text-joah-orange text-center mt-1">"ປິດຮ້ານ" (Store Closing)</p>
                        </div>

                        {/* Meta Info Section */}
                        <div className="p-4 flex flex-col justify-center gap-2 min-w-[220px]">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <Calendar size={14} className="text-slate-400" />
                                <input
                                    type="date"
                                    value={currentDate}
                                    onChange={(e) => setCurrentDate(e.target.value)}
                                    className="bg-transparent border-none p-0 text-sm font-bold text-slate-700 dark:text-slate-200 outline-none w-full"
                                />
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <Building2 size={14} className="text-slate-400" />
                                <div className="flex-1 flex items-center justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase">ສາຂາ:</span>
                                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{branch}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <PenLine size={14} className="text-slate-400" />
                                <div className="flex-1 border-b border-slate-300 dark:border-slate-600 h-4"></div>
                            </div>
                        </div>
                    </div>

                    {/* Table Content */}
                    <div className="p-6 md:p-8 overflow-x-auto">
                        <table id="checklistTable" className="w-full border-collapse">
                            <thead>
                                <tr className="bg-yellow-400">
                                    <th className="border border-yellow-500 px-4 py-3 text-left text-xs font-black text-zinc-900 uppercase tracking-wider w-12">ລ/ດ</th>
                                    <th className="border border-yellow-500 px-6 py-3 text-left text-xs font-black text-zinc-900 uppercase tracking-wider">ລາຍລະອຽດໜ້າວຽກ (Tasks)</th>
                                    <th className="border border-yellow-500 px-4 py-3 text-center text-xs font-black text-zinc-900 uppercase tracking-wider w-20">ຜ່ານ</th>
                                    <th className="border border-yellow-500 px-4 py-3 text-center text-xs font-black text-zinc-900 uppercase tracking-wider w-20">ບໍ່ຜ່ານ</th>
                                    <th className="border border-yellow-500 px-6 py-3 text-left text-xs font-black text-zinc-900 uppercase tracking-wider w-40">ໝາຍເຫດ</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {checklistItems.map((item, idx) => (
                                    <tr key={item.id} className={`${idx % 2 === 1 ? 'bg-slate-50/50 dark:bg-slate-800/20' : 'bg-white dark:bg-slate-900'} hover:bg-yellow-50/30 dark:hover:bg-yellow-900/10 transition-colors`}>
                                        <td className="border border-slate-100 dark:border-slate-800 px-4 py-4 text-center font-bold text-slate-400">{item.id}</td>
                                        <td className="border border-slate-100 dark:border-slate-800 px-6 py-4">
                                            <span className="font-bold text-rose-500 dark:text-rose-400 block mb-0.5">{item.category}:</span>
                                            <span className="text-slate-700 dark:text-slate-300 font-medium">{item.task}</span>
                                        </td>
                                        <td className="border border-slate-100 dark:border-slate-800 px-4 py-4 text-center">
                                            {answers[item.id] === 'pass' && <CheckCircle2 className="text-emerald-500 mx-auto" size={24} />}
                                        </td>
                                        <td className="border border-slate-100 dark:border-slate-800 px-4 py-4 text-center">
                                            {answers[item.id] === 'fail' && <XCircle className="text-rose-500 mx-auto" size={24} />}
                                        </td>
                                        <td className="border border-slate-100 dark:border-slate-800 px-6 py-4">
                                            <input
                                                type="text"
                                                value={remarks[item.id] || ''}
                                                onChange={(e) => setRemarks(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                placeholder="..."
                                                className="bg-transparent border-none w-full text-xs font-medium focus:ring-0"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Document Footer */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-yellow-400 px-8 py-4">
                        <div className="flex flex-wrap justify-center gap-y-2 gap-x-6">
                            {['ປອດໄພບໍ່', 'ສະອາດບໍ່', 'ຖືກຕ້ອງບໍ່', 'ເປັນລະບຽບບໍ່', 'ໃຊ້ງານໄດ້ບໍ່'].map((tag, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    <span className="text-sm font-black text-rose-500 uppercase tracking-wide">{tag}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="no-print bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-xl">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-wider mb-1">ຂໍ້ມູນການກວດສອບ</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold max-w-xl">
                        {isWizardMode
                            ? "ກະລຸນາເລືອກ 'ຜ່ານ' ຫຼື 'ບໍ່ຜ່ານ' ໂດຍອີງຕາມເກນການໃຫ້ທີ່ລະບຸໄວ້ໃນແຕ່ລະລາຍການ."
                            : "Checklist ນີ້ໃຊ້ເພື່ອຮັບປະກັນຄຸນນະພາບ ແລະ ຄວາມພ້ອມຂອງສະຖານທີ່ກ່ອນປິດຮ້ານ. ກະລຸນາກວດສອບໃຫ້ຄົບຖ້ວນເພື່ອຄວາມສະດວກໃນການເປີດຮ້ານມື້ຖັດໄປ."
                        }
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StoreClosingChecklist;
