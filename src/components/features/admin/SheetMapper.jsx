import { useState } from 'react';
import { ChevronDown, MapPin, Database, Check, Layers } from 'lucide-react';

const SheetMapper = ({ sheetNames, suggestions, onConfirm }) => {
    const [locationSheet, setLocationSheet] = useState(suggestions.location || '');
    const [dataSheet, setDataSheet] = useState(suggestions.data || '');

    const handleConfirm = () => {
        if (!locationSheet) {
            alert('ກະລຸນາເລືອກ Sheet Location');
            return;
        }
        onConfirm({ locationSheet, dataSheet });
    };

    return (
        <div className="space-y-6 animate-fade-in transition-colors">
            <div className="space-y-6">
                {/* Location Sheet Selection */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">
                        <MapPin size={14} className="text-joah-orange" />
                        Sheet ໜ້າວຽກ (Location)
                    </label>
                    <div className="relative group">
                        <select
                            value={locationSheet}
                            onChange={(e) => setLocationSheet(e.target.value)}
                            className="w-full h-14 pl-5 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl appearance-none focus:outline-none focus:border-joah-orange focus:bg-white dark:focus:bg-slate-800 transition-all duration-300 font-bold text-slate-700 dark:text-white"
                        >
                            <option value="" className="dark:bg-slate-900">-- ເລືອກ Sheet --</option>
                            {sheetNames.map((name) => (
                                <option key={name} value={name} className="dark:bg-slate-900">{name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none group-focus-within:text-joah-orange transition-colors" size={20} />
                    </div>
                </div>

                {/* Data Sheet Selection */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 transition-colors">
                        <Database size={14} className="text-sky-500" />
                        Sheet ຖານຂໍ້ມູນ (DATA)
                    </label>
                    <div className="relative group">
                        <select
                            value={dataSheet}
                            onChange={(e) => setDataSheet(e.target.value)}
                            className="w-full h-14 pl-5 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl appearance-none focus:outline-none focus:border-sky-500 focus:bg-white dark:focus:bg-slate-800 transition-all duration-300 font-bold text-slate-700 dark:text-white"
                        >
                            <option value="" className="dark:bg-slate-900">-- ເລືອກ Sheet (ຖ້າມີ) --</option>
                            {sheetNames.map((name) => (
                                <option key={name} value={name} className="dark:bg-slate-900">{name}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none group-focus-within:text-sky-500 transition-colors" size={20} />
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        onClick={handleConfirm}
                        className="w-full btn-primary h-14 text-lg group shadow-xl shadow-orange-500/20"
                    >
                        <span>ເລີ່ມການກວດສອບ</span>
                        <Check className="group-hover:translate-x-1 group-hover:scale-110 transition-all" size={20} />
                    </button>
                </div>
            </div>

            <div className="p-5 bg-orange-50/50 dark:bg-orange-500/5 rounded-2xl border border-orange-100/50 dark:border-orange-500/10 flex gap-4 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-joah-orange flex flex-shrink-0 items-center justify-center font-black transition-colors">!</div>
                <p className="text-xs text-orange-700/80 dark:text-orange-400/80 leading-relaxed font-bold transition-colors">
                    ລະບົບພະຍາຍາມຈັບຄູ່ຊື່ Sheet ໃຫ້ອັດຕະໂນມັດ ໂດຍອີງຈາກຊື່ໄຟລ໌ຂອງທ່ານ. ຫາກຊື່ບໍ່ຖືກຕ້ອງ ສາມາດປ່ຽນໄດ້ດ້ວຍຕົນເອງ.
                </p>
            </div>
        </div>
    );
};

export default SheetMapper;
