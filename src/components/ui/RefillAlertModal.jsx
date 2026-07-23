import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, Package, MapPin, ArrowRight, CheckCircle2, Sparkles } from 'lucide-react';
import { useLowStock } from '../../contexts/LowStockContext';
import lowStockSound from '../../assets/Sound/lowstockstore.mp3';
import SkuTimelineModal from './SkuTimelineModal';

export default function RefillAlertModal() {
    const { refillableItems, isRefillPopupOpen, dismissRefillPopup } = useLowStock();
    const audioRef = useRef(null);
    const [timelineBarcode, setTimelineBarcode] = useState(null);
    const [timelineItemName, setTimelineItemName] = useState('');

    useEffect(() => {
        if (isRefillPopupOpen && refillableItems.length > 0) {
            document.body.style.overflow = 'hidden';
            // Play the MP3 alert sound
            try {
                if (!audioRef.current) {
                    audioRef.current = new Audio(lowStockSound);
                    audioRef.current.volume = 0.8;
                }
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => console.warn('Audio play prevented:', e));
            } catch (e) {
                console.warn('Audio init error:', e);
            }
        } else {
            document.body.style.overflow = '';
            // Stop audio if popup closes
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isRefillPopupOpen, refillableItems.length]);

    if (!isRefillPopupOpen || !refillableItems || refillableItems.length === 0) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-rose-500/30 overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header Banner */}
                <div className="bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 p-4 text-white relative shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl animate-bounce shrink-0">
                                <Bell className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-lg leading-tight">
                                    🚨 ຕ້ອງເຕີມສິນຄ້າໜ້າຮ້ານດ່ວນ!
                                </h3>
                                <p className="text-xs text-rose-100 mt-0.5 font-medium">
                                    ພົບສິນຄ້າໜ້າຮ້ານ 0 ຊິ້ນ ແຕ່ມີໃນຫຼັງສາງ ({refillableItems.length} ລາຍການ)
                                </p>
                            </div>
                        </div>

                        <button
                            onClick={dismissRefillPopup}
                            className="p-1.5 rounded-full hover:bg-white/20 transition-colors text-white/80 hover:text-white"
                            title="ปิด"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body - Scrollable Items List */}
                <div className="p-4 overflow-y-auto space-y-3 flex-1 bg-slate-50 dark:bg-slate-950/50">
                    {refillableItems.map((item, index) => {
                        const fetchQty = Math.min(item.neededQty, item.warehouseQty);

                        return (
                            <div
                                key={item.id || index}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-rose-500" />

                                <div className="pl-2">
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm line-clamp-2">
                                            {item.name}
                                        </h4>
                                        <span className="shrink-0 px-2 py-0.5 text-[11px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/80 dark:text-rose-300 rounded-full border border-rose-200 dark:border-rose-800">
                                            ໜ້າຮ້ານ: 0
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                                            {item.barcode}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                e.preventDefault();
                                                const bc = item.barcode && item.barcode !== '-' ? item.barcode : (item.id || item.barcode_no || '');
                                                console.log('🔍 Clicked SKU Timeline for:', bc, item);
                                                setTimelineBarcode(bc || 'UNKNOWN');
                                                setTimelineItemName(item.name || '');
                                            }}
                                            className="flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 px-2 py-0.5 rounded-md border border-blue-500 shadow-sm transition-all active:scale-95 cursor-pointer"
                                        >
                                            <Sparkles size={11} className="text-amber-300 animate-pulse" />
                                            <span>ປະຫວັດ SKU</span>
                                        </button>
                                    </div>

                                    {/* Warehouse & Rack Box */}
                                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl text-xs">
                                        <div>
                                            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">
                                                📍 ໂລເຄຊັ່ນໜ້າຮ້ານ
                                            </span>
                                            <span className="font-semibold text-slate-700 dark:text-slate-200">
                                                {item.rackLocation}
                                            </span>
                                        </div>

                                        <div className="bg-emerald-50 dark:bg-emerald-950/60 p-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                                            <span className="text-emerald-700 dark:text-emerald-400 block text-[10px] font-bold uppercase tracking-wider">
                                                📦 ຫຼັງສາງ (ລັອກ {item.warehouseRack})
                                            </span>
                                            <span className="font-extrabold text-emerald-800 dark:text-emerald-300 text-sm">
                                                ເບີກເຕີມ: {fetchQty} ຊິ້ນ
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Footer Action */}
                <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
                    <button
                        onClick={dismissRefillPopup}
                        className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-sm"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                        <span>ຮັບຊາບ (ແຈ້ງເຕືອນໃໝ່ອີກ 15 ນາທີ)</span>
                    </button>
                </div>

                {/* SKU Timeline Modal */}
                <SkuTimelineModal
                    barcode={timelineBarcode}
                    itemName={timelineItemName}
                    isOpen={!!timelineBarcode}
                    onClose={() => setTimelineBarcode(null)}
                />

            </div>
        </div>,
        document.body
    );
}
