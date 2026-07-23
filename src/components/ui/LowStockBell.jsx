import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bell, X, MapPin, Package, AlertTriangle, Search, Download, FileSpreadsheet, ArrowDownRight, History, Sparkles } from 'lucide-react';
import { useLowStock } from '../../contexts/LowStockContext';
import SkuTimelineModal from './SkuTimelineModal';

/**
 * Severity language borrowed from real shelf-edge stock tags:
 * a colored spine on the left of each row (like the plastic
 * edge-strips staff already clip onto shelves), plus a
 * generated barcode glyph next to every SKU so the alert
 * reads like something you'd actually pull off a shelf,
 * not a generic dashboard card.
 */
const SEVERITY_THEME = {
    empty: {
        label: 'ໝົດສະຕ໋ອກ',
        spine: 'bg-rose-600',
        chip: 'bg-rose-600 text-white',
        text: 'text-rose-600 dark:text-rose-400',
        bar: 'bg-rose-600',
        ring: 'ring-rose-600/15',
    },
    critical: {
        label: 'ວິກິດ',
        spine: 'bg-orange-500',
        chip: 'bg-orange-500 text-white',
        text: 'text-orange-600 dark:text-orange-400',
        bar: 'bg-orange-500',
        ring: 'ring-orange-500/15',
    },
    warning: {
        label: 'ໃກ້ໝົດ',
        spine: 'bg-amber-400',
        chip: 'bg-amber-400 text-amber-950',
        text: 'text-amber-600 dark:text-amber-400',
        bar: 'bg-amber-400',
        ring: 'ring-amber-400/15',
    },
};

// Deterministic little barcode glyph generated from the code string itself —
// not decoration, it's literally encoding the barcode's own characters as bar widths.
function MiniBarcode({ value = '' }) {
    const bars = useMemo(() => {
        const chars = value.split('');
        return chars.map((c, i) => {
            const n = c.charCodeAt(0);
            const w = 1 + (n % 3); // 1-3px
            const tall = n % 5 !== 0;
            return { w, tall, key: `${c}-${i}` };
        }).slice(0, 26);
    }, [value]);

    if (!value) return null;

    return (
        <svg
            width={Math.min(bars.length * 2.6, 70)}
            height="16"
            className="shrink-0 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
        >
            {bars.map((b, i) => (
                <rect
                    key={b.key}
                    x={i * 2.6}
                    y={b.tall ? 0 : 3}
                    width={b.w}
                    height={b.tall ? 16 : 10}
                    fill="currentColor"
                />
            ))}
        </svg>
    );
}

export default function LowStockBell() {
    const { lowStockItems, exportLowStockToExcel, exportNegativeStockReportForGM, viewingBranch } = useLowStock();
    const [isOpen, setIsOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [timelineBarcode, setTimelineBarcode] = useState(null);
    const [timelineItemName, setTimelineItemName] = useState('');
    const [isExportingGM, setIsExportingGM] = useState(false);

    const negativeCount = useMemo(() => lowStockItems.filter(i => Number(i.qty) < 0).length, [lowStockItems]);

    const handleExportGMReport = async () => {
        setIsExportingGM(true);
        try {
            await exportNegativeStockReportForGM(lowStockItems, { branch: viewingBranch });
        } catch (e) {
            console.error('Error exporting GM negative report:', e);
        } finally {
            setIsExportingGM(false);
        }
    };

    const total = lowStockItems.length;
    const emptyCount = lowStockItems.filter((i) => i.severity === 'empty').length;
    const criticalCount = lowStockItems.filter((i) => i.severity === 'critical').length;
    const warningCount = lowStockItems.filter((i) => i.severity === 'warning').length;

    const filteredItems = lowStockItems.filter((item) => {
        const matchesFilter = activeFilter === 'all' || item.severity === activeFilter;
        const q = searchQuery.toLowerCase();
        const matchesSearch =
            (item.name || '').toLowerCase().includes(q) ||
            (item.barcode || '').toLowerCase().includes(q) ||
            (item.rackLocation || '').toLowerCase().includes(q);
        return matchesFilter && matchesSearch;
    });

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    if (total === 0) return null;

    const isMostSevere = emptyCount > 0 ? 'empty' : criticalCount > 0 ? 'critical' : 'warning';
    const alertTheme = SEVERITY_THEME[isMostSevere];

    const filters = [
        { key: 'all', label: 'ທັງໝົດ', count: total, dot: null },
        { key: 'empty', label: 'ໝົດສະຕ໋ອກ', count: emptyCount, dot: 'bg-rose-600' },
        { key: 'critical', label: 'ວິກິດ', count: criticalCount, dot: 'bg-orange-500' },
        { key: 'warning', label: 'ໃກ້ໝົດ', count: warningCount, dot: 'bg-amber-400' },
    ];

    const handleExportExcel = (itemsToExport) => {
        if (exportLowStockToExcel) {
            const dateStr = new Date().toISOString().slice(0, 10);
            exportLowStockToExcel(itemsToExport, {
                filename: `ບົດລາຍງານສິນຄ້າສະຕ໋ອກຕໍ່າ_JOAH_${dateStr}.xlsx`
            });
        }
    };

    const modalContent = isOpen && (
        <div
            className="fixed inset-0 z-[99999] w-screen h-screen bg-[#FAF7F2] dark:bg-[#0B0F14] flex flex-col"
            onClick={() => setIsOpen(false)}
            style={{ fontFamily: "'Noto Sans Lao', 'Phetsarath', 'Inter', system-ui, sans-serif" }}
        >
            <div
                className="w-full h-full flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="bg-white dark:bg-slate-900 border-b-2 border-slate-900/5 dark:border-white/5 px-6 sm:px-10 py-5 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className={`w-13 h-13 rounded-2xl ${alertTheme.chip} flex items-center justify-center shadow-sm p-3`}>
                            <AlertTriangle size={28} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                ສິນຄ້າສະຕ໋ອກຕໍ່າໜ້າຮ້ານ
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                                ສິນຄ້າເຫຼືອຕໍ່າກວ່າ 30% ຂອງຄວາມຈຸສູງສຸດ — ແຈ້ງເຕືອນ ແລະ ຈັດການເບີກເຕີມສິນຄ້າ
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                        {/* 🚨 Smart GM Report Export Button */}
                        <button
                            onClick={handleExportGMReport}
                            disabled={isExportingGM}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-extrabold text-sm shadow-lg shadow-rose-600/20 active:scale-95 transition-all border border-rose-500 cursor-pointer"
                            title="ดาวน์โหลดรายงานวิเคราะห์สต็อกติดลบพร้อมหลักฐานสำหรับ GM ทั้งหมดในคลิกเดียว"
                        >
                            <Sparkles size={17} className="text-amber-300 animate-pulse" />
                            <span>Export ບົດລາຍງານ GM ({negativeCount} ຕິດລົບ)</span>
                        </button>

                        {/* Export Excel Button */}
                        <button
                            onClick={() => handleExportExcel(filteredItems)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm shadow-md transition-all border border-emerald-500"
                            title="ສົ່ງອອກບົດລາຍງານ Excel ສຳລັບແຈ້ງພະນັກງານເບີກເຕີມສິນຄ້າ"
                        >
                            <FileSpreadsheet size={18} />
                            <span>Export Excel ({filteredItems.length})</span>
                        </button>

                        <span className={`text-base font-black px-4 py-2 rounded-xl ${alertTheme.chip}`}>
                            {total} ລາຍການ
                        </span>

                        <button
                            onClick={() => setIsOpen(false)}
                            className="w-11 h-11 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white border-2 border-slate-200 dark:border-slate-700 transition-colors"
                            aria-label="ປິດ"
                        >
                            <X size={22} />
                        </button>
                    </div>
                </header>

                {/* Filters + search */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 sm:px-10 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
                    <div className="flex flex-wrap gap-2">
                        {filters.map((f) => (
                            <button
                                key={f.key}
                                onClick={() => setActiveFilter(f.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${activeFilter === f.key
                                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white'
                                        : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                            >
                                {f.dot && <span className={`w-2.5 h-2.5 rounded-full ${f.dot}`} />}
                                {f.label}
                                <span className="opacity-60">({f.count})</span>
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-96">
                        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            placeholder="ຄົ້ນຫາຊື່, ບາໂຄ້ດ ຫຼື ໂລເຄຊັ່ນ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-semibold focus:outline-none focus:border-slate-900 dark:focus:border-white transition-colors placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Shelf-tag list */}
                <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6">
                    {filteredItems.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-3">
                            <Package size={56} strokeWidth={1.3} />
                            <p className="text-base font-bold">ບໍ່ພົບລາຍການທີ່ກົງກັບເງື່ອນໄຂ</p>
                        </div>
                    ) : (
                        <div className="max-w-5xl mx-auto flex flex-col gap-3">
                            {filteredItems.map((item) => {
                                const theme = SEVERITY_THEME[item.severity];
                                const pct = Math.max(0, Math.min(100, item.ratio * 100));
                                return (
                                    <div
                                        key={item.id}
                                        className={`relative flex bg-white dark:bg-slate-900 rounded-r-2xl rounded-l-md shadow-sm ring-1 ${theme.ring} overflow-hidden`}
                                    >
                                        {/* Spine — the "shelf-edge strip" */}
                                        <div className={`w-2 shrink-0 ${theme.spine}`} />

                                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 px-5 py-4">
                                            {/* Severity + name */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                    <span className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${theme.chip}`}>
                                                        {theme.label}
                                                    </span>
                                                    {item.rackLocation && item.rackLocation !== '-' && (
                                                        <span className="flex items-center gap-1 text-xs font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded-md border border-cyan-200 dark:border-cyan-800/40">
                                                            <MapPin size={12} strokeWidth={2.5} /> ໜ້າຮ້ານ: {item.rackLocation}
                                                        </span>
                                                    )}
                                                </div>
                                                <h4 className="text-base font-bold text-slate-900 dark:text-white leading-snug">
                                                    {item.name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <MiniBarcode value={item.barcode} />
                                                    <span className="font-mono text-xs text-slate-400 dark:text-slate-500">
                                                        {item.barcode}
                                                    </span>

                                                    {/* 🔍 SKU Timeline Button */}
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
                                                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm border border-blue-500 text-xs font-bold transition-all active:scale-95 cursor-pointer z-10"
                                                        title="ดูประวัติการเคลื่อนไหวของบาร์โค้ดนี้ 360°"
                                                    >
                                                        <Sparkles size={13} className="text-amber-300 animate-pulse" />
                                                        <span>ประวัติ SKU</span>
                                                    </button>
                                                </div>

                                                {/* Staff Action Advice Tag */}
                                                {item.actionInstruction && (
                                                    <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                                        <ArrowDownRight size={14} className="text-emerald-500" />
                                                        <span>ຂໍ້ແນະນຳພະນັກງານ: <strong className="text-emerald-600 dark:text-emerald-400">{item.actionInstruction}</strong></span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Qty + progress */}
                                            <div className="w-full sm:w-64 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 sm:pl-6 pt-3 sm:pt-0">
                                                <div className="flex items-baseline justify-between mb-1">
                                                    <span className="text-2xl font-black text-slate-900 dark:text-white">
                                                        {item.qty}
                                                        <span className="text-sm font-bold text-slate-400"> / {item.maxQty} ຊິ້ນ</span>
                                                    </span>
                                                    <span className={`text-sm font-black ${theme.text}`}>{pct.toFixed(0)}%</span>
                                                </div>

                                                <div className="flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 mb-1.5">
                                                    <span>ຕ້ອງເຕີມເພີ່ມ:</span>
                                                    <span className="font-black text-sm">{item.neededQty ?? (item.maxQty - item.qty)} ຊິ້ນ</span>
                                                </div>

                                                <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mb-2.5">
                                                    <div
                                                        className={`h-full ${theme.bar} rounded-full`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                
                                                {/* Warehouse Stock Info */}
                                                <div className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg border ${
                                                    item.warehouseQty > 0 
                                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' 
                                                        : 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
                                                }`}>
                                                    <Package size={14} className={item.warehouseQty > 0 ? "text-emerald-500" : "text-rose-500"} />
                                                    <span className="opacity-80">ຫຼັງສາງ:</span>
                                                    <span className="font-black text-[13px]">{item.warehouseQty}</span>
                                                    <span className="opacity-80">ຊິ້ນ</span>
                                                    {item.warehouseQty > 0 && item.warehouseRack && item.warehouseRack !== '-' && (
                                                        <span className="flex items-center gap-1 opacity-90 text-[11px] ml-auto font-mono">
                                                            <MapPin size={10} strokeWidth={2.5} /> {item.warehouseRack}
                                                        </span>
                                                    )}
                                                    {item.warehouseQty === 0 && <span className="ml-auto text-[10px] uppercase tracking-wider bg-rose-100 dark:bg-rose-900/80 px-1.5 py-0.5 rounded text-rose-700 dark:text-rose-300 font-bold">Request DC</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-6 sm:px-10 py-3 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">
                    <span>ແຈ້ງເຕືອນເມື່ອສະຕ໋ອກຫຼຸດຕໍ່າກວ່າ 30% ຂອງຄວາມຈຸຊັ້ນວາງ</span>
                    <span>JOAH INVENTORY • v3.1</span>
                </footer>

                {/* Sku Timeline Modal */}
                <SkuTimelineModal
                    barcode={timelineBarcode}
                    itemName={timelineItemName}
                    isOpen={!!timelineBarcode}
                    onClose={() => setTimelineBarcode(null)}
                />
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className={`relative p-2.5 sm:p-3 rounded-xl transition-colors border-2 ${isOpen
                        ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-950 dark:text-white'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                title={`ສິນຄ້າໃກ້ໝົດ ${total} ລາຍການ`}
            >
                <Bell size={18} className="sm:w-5 sm:h-5" />
                <span className={`absolute -top-1.5 -right-1.5 w-5 h-5 ${alertTheme.spine} text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950`}>
                    {total}
                </span>
            </button>

            {createPortal(modalContent, document.body)}
        </>
    );
}