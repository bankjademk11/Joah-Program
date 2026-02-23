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
    AlertTriangle
} from 'lucide-react';

const StoreClosingChecklist = ({ onBack }) => {
    const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
    const [branch, setBranch] = useState('PSN');
    const [copyStatus, setCopyStatus] = useState(false);

    // Checklist items based on the mockup
    const checklistItems = [
        { id: 1, category: "ດ້ານນອກ/ລານຈອດລົດ/ພື້ນທີ່ເຊົ່າ", task: "ສະອາດ, ເປັນລະບຽບ, ພ້ອມໃຫ້ບໍລິການ" },
        { id: 2, category: "ດ້ານນອກ/ລານຈອດລົດ/ພື້ນທີ່ເຊົ່າ", task: "ປອດໄພ, ພ້ອມໃຫ້ບໍລິການ" },
        { id: 3, category: "ພື້ນທີ່ຂາຍ/ຊັ້ນວາງສິນຄ້າ/ຈຸດຕັ້ງກ່ອງໄຟ", task: "ສິນຄ້າເຕັມແທ່ນ" },
        { id: 4, category: "ພື້ນທີ່ຂາຍ/ຊັ້ນວາງສິນຄ້າ/ຈຸດຕັ້ງກ່ອງໄຟ", task: "ຈຳນວນ SKU ຄົບຕາມຈຳນວນທີ່ກຳນົດໄວ້ໃນແຕ່ລະຊັ້ນ" },
        { id: 5, category: "ພື້ນທີ່ຂາຍ/ຊັ້ນວາງສິນຄ້າ/ຈຸດຕັ້ງກ່ອງໄຟ", task: "ສະອາດເປັນລະບຽບ" },
        { id: 6, category: "ພື້ນທີ່ຂາຍ/ຊັ້ນວາງສິນຄ້າ/ຈຸດຕັ້ງກ່ອງໄຟ", task: "ຕຳແໜ່ງປ້າຍລາຄາກົງກັບສິນຄ້າ" },
        { id: 7, category: "ພື້ນທີ່ຂາຍ/ຊັ້ນວາງສິນຄ້າ/ຈຸດຕັ້ງກ່ອງໄຟ", task: "ປ້າຍລາຄາສິນຄ້າຄົບຖ້ວນ ແລະ ຖືກຕ້ອງ" },
        { id: 8, category: "ເຄົາເຕີ້ບໍລິການ/ແແຄັດເຊຍ", task: "ພື້ນທີ່ຊຳລະເງິນສະອາດ" },
        { id: 9, category: "ເຄົາເຕີ້ບໍລິການ/ແແຄັດເຊຍ", task: "ການກະກຽມເງິນທອນ, ເງິນສຳຮອງ ແລະ ຂໍ້ມູນອັດຕາແລກປ່ຽນ" },
        { id: 10, category: "ເຄົາເຕີ້ບໍລິການ/ແແຄັດເຊຍ", task: "ລະບົບຕູ້ເກັບເງິນກຽມພ້ອມ" },
        { id: 11, category: "ສາງ/ຮັບເຂົ້າ", task: "ຄວາມສະອາດ ແລະ ເປັນລະບຽບ" },
        { id: 12, category: "ສາງ/ຮັບເຂົ້າ", task: "ຮັບສິນຄ້າເຂົ້າສາງຖືກຕ້ອງ" },
        { id: 13, category: "ສາງ/ຮັບເຂົ້າ", task: "ຈັດເກັບສິນຄ້າໃຫ້ເປັນກຸ່ມ ແລະ ປອດໄພ" },
        { id: 14, category: "ອື່ນໆ", task: "ຂຽນ/ຈັດທີ່ແຈ້ງງານທີ່ຍັງຄ້າງໄວ້ໃຫ້ກະຊັບດຳເນີນການຕໍ່ໃນຮອບການເປີດຮ້ານໃນມື້ຖັດໄປ" },
    ];

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

            {/* Main Checklist Document */}
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
                                    <td className="border border-slate-100 dark:border-slate-800 px-4 py-4"></td>
                                    <td className="border border-slate-100 dark:border-slate-800 px-4 py-4"></td>
                                    <td className="border border-slate-100 dark:border-slate-800 px-6 py-4"></td>
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

            <div className="no-print bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                <div className="p-3 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-xl">
                    <AlertTriangle size={24} />
                </div>
                <div>
                    <h4 className="text-sm font-black text-amber-900 dark:text-amber-100 uppercase tracking-wider mb-1">ຂໍ້ມູນການກວດສອບ</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-bold max-w-xl">
                        Checklist ນີ້ໃຊ້ເພື່ອຮັບປະກັນຄຸນນະພາບ ແລະ ຄວາມພ້ອມຂອງສະຖານທີ່ກ່ອນປິດຮ້ານ. ກະລຸນາກວດສອບໃຫ້ຄົບຖ້ວນເພື່ອຄວາມສະດວກໃນການເປີດຮ້ານມື້ຖັດໄປ.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default StoreClosingChecklist;
