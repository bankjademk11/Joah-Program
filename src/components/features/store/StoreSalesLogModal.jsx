import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../utils/supabaseClient';
import { X, Search, Download, PackageSearch, Loader2, BarChart3, Table2, TrendingUp, TrendingDown, Minus, Filter, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    XAxis, YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';

/* ============================================================================
   DESIGN TOKENS — "Enterprise ERP Light" Style (Optimized for GM 50+)
   ----------------------------------------------------------------------------
   Rationale: High contrast, warm light backgrounds, crisp borders, and zero 
   dark-mode clutter. Colors and font weights are selected to prevent eye strain
   for older executives while maintaining an authoritative, audited ERP look.
   ============================================================================ */

const TOKENS = {
    pageBg: '#F8FAFC',       // Slate 50 — Soft on the eyes, removes harsh glare
    surface: '#FFFFFF',      // Pure White for data cards & tables
    border: '#CBD5E1',       // Slate 300 — Visible, structured ERP borders
    borderLight: '#E2E8F0',  // Slate 200 — Table row dividers

    textPrimary: '#0F172A',  // Slate 900 — Maximum legibility
    textSecondary: '#334155',// Slate 700 — High contrast muted text (no pale gray)
    textMuted: '#64748B',    // Slate 500 — For timestamps and secondary labels

    brand: '#0369A1',        // Sky 700 — Classic Corporate/ERP Blue
    brandSoft: '#E0F2FE',    // Sky 100

    amber: '#C2410C',        // Orange 700 — High visibility for routine stock deduction
    amberSoft: '#FFEDD5',
    danger: '#DC2626',       // Red 600 — Clear failure indicator
    dangerSoft: '#FEE2E2',
};

function useDocumentFonts() {
    useEffect(() => {
        const id = 'jsl-modal-fonts';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap';
        document.head.appendChild(link);
    }, []);
}

const FONT_STACK = "'Inter', 'Noto Sans Lao', 'Noto Sans', sans-serif";
const MONO_STACK = "'Inter', 'Noto Sans Lao', ui-monospace, 'SF Mono', monospace";

export default function StoreSalesLogModal({ isOpen, onClose, branchId }) {
    useDocumentFonts();
    const [loading, setLoading] = useState(false);
    const [logs, setLogs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'analytics'
    const [filterType, setFilterType] = useState('latest'); // 'latest' | 'all' | 'custom'
    const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [startTime, setStartTime] = useState('00:00');
    const [endDate, setEndDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [endTime, setEndTime] = useState('23:59');

    // UI-only temporary states for the filter drawer
    const [tempFilterType, setTempFilterType] = useState('latest');
    const [tempStartDate, setTempStartDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [tempStartTime, setTempStartTime] = useState('00:00');
    const [tempEndDate, setTempEndDate] = useState(new Date().toLocaleDateString('en-CA'));
    const [tempEndTime, setTempEndTime] = useState('23:59');

    const [showFilterPanel, setShowFilterPanel] = useState(false);
    const searchInputRef = useRef(null);

    // Helper to convert local Vientiane date-time range to ISO strings
    const getUtcBoundsForRange = (dateStr, timeStr) => {
        if (!dateStr) return null;
        const dt = new Date(`${dateStr}T${timeStr || '00:00'}:00`);
        return dt.toISOString();
    };

    // Fetch logs when parameters change
    useEffect(() => {
        if (isOpen && branchId) {
            fetchLogs();
        }
    }, [isOpen, branchId, filterType, startDate, startTime, endDate, endTime]);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, onClose]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const PAGE_SIZE = 1000;

            let filterLogId = null;
            let startUtc = null;
            let endUtc = null;

            if (filterType === 'latest') {
                const { data: latestLog, error: latestError } = await supabase
                    .from('odoo_sync_logs')
                    .select('id')
                    .eq('branch_id', branchId)
                    .order('id', { ascending: false })
                    .limit(1)
                    .single();

                if (!latestError && latestLog) {
                    filterLogId = latestLog.id;
                } else if (latestError && latestError.code !== 'PGRST116') {
                    throw latestError;
                }

                if (!filterLogId) {
                    setLogs([]);
                    setLoading(false);
                    return;
                }
            } else if (filterType === 'custom') {
                startUtc = getUtcBoundsForRange(startDate, startTime);
                endUtc = getUtcBoundsForRange(endDate, endTime);
            }

            // Step 1: Get count
            let countQuery = supabase
                .from('odoo_sync_details')
                .select('*, odoo_sync_logs!inner(branch_id, sync_completed_at)', { count: 'exact', head: true })
                .eq('odoo_sync_logs.branch_id', branchId);

            if (filterType === 'latest' && filterLogId) {
                countQuery = countQuery.eq('log_id', filterLogId);
            } else if (filterType === 'custom') {
                countQuery = countQuery
                    .gte('odoo_sync_logs.sync_completed_at', startUtc)
                    .lte('odoo_sync_logs.sync_completed_at', endUtc);
            }

            const { count, error: countError } = await countQuery;

            if (countError) throw countError;

            if (!count || count === 0) {
                setLogs([]);
                return;
            }

            // Step 2: Fire all page requests in parallel
            const totalPages = Math.ceil(count / PAGE_SIZE);
            const pagePromises = Array.from({ length: totalPages }, (_, i) => {
                let q = supabase
                    .from('odoo_sync_details')
                    .select(`
                        *,
                        odoo_sync_logs!inner(sync_completed_at, branch_id)
                    `)
                    .eq('odoo_sync_logs.branch_id', branchId)
                    .order('id', { ascending: false })
                    .range(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);

                if (filterType === 'latest' && filterLogId) {
                    q = q.eq('log_id', filterLogId);
                } else if (filterType === 'custom') {
                    q = q
                        .gte('odoo_sync_logs.sync_completed_at', startUtc)
                        .lte('odoo_sync_logs.sync_completed_at', endUtc);
                }
                return q;
            });

            const responses = await Promise.all(pagePromises);

            const allData = responses.flatMap(res => {
                if (res.error) throw res.error;
                return res.data || [];
            });

            setLogs(allData);
        } catch (error) {
            console.error("Error fetching sales logs:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToExcel = () => {
        if (logs.length === 0) return;

        const exportData = logs.map(log => ({
            'ວັນທີ-ເວລາ (Date)': log.odoo_sync_logs?.sync_completed_at ? new Date(log.odoo_sync_logs.sync_completed_at).toLocaleString('lo-LA') : '',
            'ບາໂຄດ (Barcode)': log.barcode_no,
            'ຊື່ສິນຄ້າ (Item Name)': log.item_name,
            'ຈຳນວນທີ່ຂາຍ (Sold Qty)': log.qty_sold,
            'ສະຕັອກກ່ອນຫັກ (Old Qty)': log.old_store_qty,
            'ສະຕັອກຫຼັງຫັກ (New Qty)': log.new_store_qty,
            'ສະຖານະ (Status)': log.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sales_Deduct_Logs');
        XLSX.writeFile(workbook, `Sales_Deduct_Log_${branchId}_${new Date().getTime()}.xlsx`);
    };

    const splitProduct = (productStr) => {
        if (!productStr) return { barcode: '-', name: '-' };
        const match = productStr.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) return { barcode: match[1], name: match[2] };
        return { barcode: '-', name: productStr };
    };

    const filteredLogs = useMemo(() => {
        const term = searchTerm.toLowerCase();
        if (!term) return logs;
        return logs.filter(log =>
            log.barcode_no?.toLowerCase().includes(term) ||
            log.item_name?.toLowerCase().includes(term)
        );
    }, [logs, searchTerm]);

    const stats = useMemo(() => {
        const totalQty = logs.reduce((sum, l) => sum + (Number(l.qty_sold) || 0), 0);
        const uniqueItems = new Set(logs.map(l => l.barcode_no)).size;
        const lastSync = logs[0]?.odoo_sync_logs?.sync_completed_at;

        const byDay = {};
        logs.forEach(l => {
            const raw = l.odoo_sync_logs?.sync_completed_at;
            if (!raw) return;
            const key = new Date(raw).toLocaleDateString('en-CA');
            byDay[key] = (byDay[key] || 0) + (Number(l.qty_sold) || 0);
        });
        const days = Object.keys(byDay).sort();
        const today = byDay[days[days.length - 1]] || 0;
        const yesterday = byDay[days[days.length - 2]] || 0;
        let trend = 'flat';
        if (days.length >= 2) {
            if (today > yesterday) trend = 'up';
            else if (today < yesterday) trend = 'down';
        }

        return {
            totalTx: logs.length,
            totalQty,
            uniqueItems,
            lastSync: lastSync ? new Date(lastSync).toLocaleString('lo-LA') : '-',
            trend,
        };
    }, [logs]);

    const trendData = useMemo(() => {
        const byDay = {};
        logs.forEach(log => {
            const raw = log.odoo_sync_logs?.sync_completed_at;
            if (!raw) return;
            const d = new Date(raw);
            const key = d.toLocaleDateString('en-CA');
            const label = d.toLocaleDateString('lo-LA', { day: '2-digit', month: '2-digit' });
            if (!byDay[key]) byDay[key] = { key, label, qty: 0, tx: 0 };
            byDay[key].qty += Number(log.qty_sold) || 0;
            byDay[key].tx += 1;
        });
        return Object.values(byDay).sort((a, b) => a.key.localeCompare(b.key));
    }, [logs]);

    const topItems = useMemo(() => {
        const byItem = {};
        logs.forEach(log => {
            const { name } = splitProduct(log.item_name);
            const key = name || 'ບໍ່ລະບຸ';
            if (!byItem[key]) byItem[key] = { name: key, qty: 0 };
            byItem[key].qty += Number(log.qty_sold) || 0;
        });
        return Object.values(byItem)
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 8)
            .map(item => ({
                ...item,
                shortName: item.name.length > 22 ? item.name.slice(0, 22) + '…' : item.name
            }))
            .reverse();
    }, [logs]);

    const activeFilterDisplay = useMemo(() => {
        if (filterType === 'latest') {
            return `ຊິງຄ໌ລ່າສຸດ (${stats.lastSync})`;
        } else if (filterType === 'all') {
            return 'ປະຫວັດທັງໝົດ (All History)';
        } else {
            const d1 = new Date(`${startDate}T${startTime}`).toLocaleString('lo-LA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            const d2 = new Date(`${endDate}T${endTime}`).toLocaleString('lo-LA', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
            return `${d1} ➔ ${d2}`;
        }
    }, [filterType, stats.lastSync, startDate, startTime, endDate, endTime]);

    if (!isOpen) return null;

    const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
    const trendColor = stats.trend === 'up' ? TOKENS.brand : stats.trend === 'down' ? TOKENS.amber : TOKENS.textMuted;

    const modalContent = (
        <div
            className="fixed inset-0 z-[99999] flex flex-col bg-[#F8FAFC] motion-safe:animate-[fadeIn_0.15s_ease-out]"
            style={{ fontFamily: FONT_STACK }}
            role="dialog"
            aria-modal="true"
            aria-label="ປະຫວັດການຫັກຍອດຂາຍ"
        >
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                .jsl-focus:focus-visible {
                    outline: 2px solid ${TOKENS.brand};
                    outline-offset: 2px;
                }
            `}</style>

            {/* ERP Corporate Header — Clean White, structured border, bold typography */}
            <div className="bg-white text-slate-900 px-4 sm:px-8 py-4 flex items-center justify-between gap-4 shrink-0 border-b border-slate-300 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={onClose}
                        className="jsl-focus p-2.5 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors text-slate-600 hover:text-slate-900 shrink-0 border border-slate-200"
                        aria-label="ປິດໜ້າຕ່າງ"
                    >
                        <X size={24} />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 truncate tracking-tight">
                                ປະຫວັດການຫັກຍອດຂາຍ
                            </h1>
                            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-50 border border-sky-200">
                                <span className="relative flex h-2 w-2">
                                    {!loading && logs.length > 0 && (
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-500 opacity-75" />
                                    )}
                                    <span className={`relative inline-flex rounded-full h-2 w-2 ${loading ? 'bg-amber-500' : 'bg-sky-600'}`} />
                                </span>
                                <span className="text-xs font-bold text-sky-800 tracking-wide">
                                    {loading ? 'ກຳລັງອັບເດດ...' : 'ຂໍ້ມູນລ່າສຸດ'}
                                </span>
                            </span>
                        </div>
                        <p className="text-sm text-slate-600 font-medium truncate mt-0.5">
                            ສາຂາ: <span className="text-slate-900 font-bold px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 ml-1" style={{ fontFamily: MONO_STACK }}>{branchId}</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="flex items-center bg-slate-100 border border-slate-300 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`jsl-focus flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'table'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            aria-pressed={viewMode === 'table'}
                        >
                            <Table2 size={18} /> <span className="hidden sm:inline">ຕາຕະລາງ</span>
                        </button>
                        <button
                            onClick={() => setViewMode('analytics')}
                            className={`jsl-focus flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'analytics'
                                ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
                                : 'text-slate-600 hover:text-slate-900'
                                }`}
                            aria-pressed={viewMode === 'analytics'}
                        >
                            <BarChart3 size={18} /> <span className="hidden sm:inline">ວິເຄາະຂໍ້ມູນ</span>
                        </button>
                    </div>

                    <button
                        onClick={exportToExcel}
                        disabled={logs.length === 0}
                        className="jsl-focus flex items-center gap-2 px-4 py-2.5 bg-sky-700 hover:bg-sky-800 active:bg-sky-900 border border-sky-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-bold text-white transition-colors shadow-sm shrink-0"
                    >
                        <Download size={18} /> <span className="hidden sm:inline">Export Excel</span>
                    </button>
                </div>
            </div>

            {/* KPI Executive Summary Card — High contrast, extra-large digits */}
            <div className="bg-slate-100 border-b border-slate-300 px-4 sm:px-8 py-4 shrink-0">
                <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-white px-5 py-4 rounded-xl border border-slate-300 shadow-sm">
                        <div className="text-sm font-bold text-slate-600 uppercase tracking-wider">ຈຳນວນລາຍການ</div>
                        <div className="text-3xl font-extrabold text-slate-900 tabular-nums mt-1" style={{ fontFamily: MONO_STACK }}>
                            {stats.totalTx.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white px-5 py-4 rounded-xl border border-slate-300 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-sm font-bold text-slate-600 uppercase tracking-wider">ຍອດຫັກລວມ (ຊັ້ນ)</div>
                            {logs.length > 0 && (
                                <TrendIcon size={18} style={{ color: trendColor }} strokeWidth={2.5} />
                            )}
                        </div>
                        <div className="text-3xl font-extrabold tabular-nums mt-1" style={{ fontFamily: MONO_STACK, color: TOKENS.amber }}>
                            -{stats.totalQty.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white px-5 py-4 rounded-xl border border-slate-300 shadow-sm">
                        <div className="text-sm font-bold text-slate-600 uppercase tracking-wider">ສິນຄ້າທີ່ກ່ຽວຂ້ອງ</div>
                        <div className="text-3xl font-extrabold text-slate-900 tabular-nums mt-1" style={{ fontFamily: MONO_STACK }}>
                            {stats.uniqueItems.toLocaleString()}
                        </div>
                    </div>
                    <div className="bg-white px-5 py-4 rounded-xl border border-slate-300 shadow-sm flex flex-col justify-between h-full">
                        <div className="text-sm font-bold text-slate-600 uppercase tracking-wider">ຊ່ວງເວລາທີ່ຄົ້ນຫາ</div>
                        <div className="text-[13px] font-bold text-slate-900 mt-2 leading-relaxed" style={{ fontFamily: MONO_STACK }}>
                            {loading ? 'ກຳລັງໂຫຼດ...' : activeFilterDisplay}
                        </div>
                    </div>
                </div>
            </div>

            {/* Toolbar — Clean Search with comfortable touch target */}
            {viewMode === 'table' && (
                <div className="bg-white border-b border-slate-300 px-4 sm:px-8 py-3.5 shrink-0">
                    <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
                        {/* Left: Search input */}
                        <div className="relative flex-1 min-w-[280px] max-w-md">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={20} />
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="ຄົ້ນຫາບາໂຄດ ຫຼື ຊື່ສິນຄ້າ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="jsl-focus w-full pl-12 pr-10 py-2.5 rounded-lg border-2 border-slate-300 bg-slate-50 text-base font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-sky-600 focus:bg-white transition-colors"
                                aria-label="ຄົ້ນຫາບາໂຄດ ຫຼື ຊື່ສິນຄ້າ"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="jsl-focus absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200"
                                    aria-label="ລ້າງການຄົ້ນຫາ"
                                >
                                    <X size={18} />
                                </button>
                            )}
                        </div>

                        {/* Right: Toggle Filter Drawer Button */}
                        <button
                            onClick={() => {
                                if (!showFilterPanel) {
                                    setTempFilterType(filterType);
                                    setTempStartDate(startDate);
                                    setTempStartTime(startTime);
                                    setTempEndDate(endDate);
                                    setTempEndTime(endTime);
                                }
                                setShowFilterPanel(!showFilterPanel);
                            }}
                            className={`jsl-focus flex items-center gap-2 px-4.5 py-2.5 rounded-lg text-sm font-bold border transition-all ${showFilterPanel
                                    ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-inner'
                                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
                                }`}
                        >
                            <Filter size={18} />
                            <span>ຕົວເລືອກການຊິງຄ໌ (Filters)</span>
                            {filterType !== 'latest' && (
                                <span className="bg-sky-600 w-2 h-2 rounded-full" />
                            )}
                        </button>
                    </div>

                    {/* Collapsible Filter Panel */}
                    {showFilterPanel && (
                        <div className="max-w-7xl mx-auto mt-4 p-5 bg-slate-50 border border-slate-300 rounded-xl transition-all duration-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Column 1: Presets */}
                                <div className="space-y-2">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ຮູບແບບການກັ່ນຕອງ</label>
                                    <div className="flex flex-col gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setTempFilterType('latest')}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${tempFilterType === 'latest'
                                                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                                }`}
                                        >
                                            ⭐ ຊິງຄ໌ລ່າສຸດ (Latest Sync)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTempFilterType('all')}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${tempFilterType === 'all'
                                                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                                }`}
                                        >
                                            📅 ປະຫວັດທັງໝົດ (All History)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setTempFilterType('custom')}
                                            className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-bold transition-all border ${tempFilterType === 'custom'
                                                    ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                                                }`}
                                        >
                                            ⏱️ ກຳນົດຊ່ວງເວລາ (Custom Range)
                                        </button>
                                    </div>
                                </div>

                                {/* Column 2: Start Date & Time */}
                                <div className={`space-y-4 transition-opacity duration-200 ${tempFilterType === 'custom' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Calendar size={14} /> ເລີ່ມວັນທີ
                                        </label>
                                        <input
                                            type="date"
                                            value={tempStartDate}
                                            onChange={(e) => setTempStartDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ເລີ່ມເວລາ</label>
                                        <input
                                            type="time"
                                            value={tempStartTime}
                                            onChange={(e) => setTempStartTime(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-none focus:border-sky-500"
                                        />
                                    </div>
                                </div>

                                {/* Column 3: End Date & Time */}
                                <div className={`space-y-4 transition-opacity duration-200 ${tempFilterType === 'custom' ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                                            <Calendar size={14} /> ສິ້ນສຸດວັນທີ
                                        </label>
                                        <input
                                            type="date"
                                            value={tempEndDate}
                                            onChange={(e) => setTempEndDate(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-none focus:border-sky-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">ສິ້ນສຸດເວລາ</label>
                                        <input
                                            type="time"
                                            value={tempEndTime}
                                            onChange={(e) => setTempEndTime(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-bold text-slate-900 bg-white focus:outline-none focus:border-sky-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-300">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setTempFilterType('latest');
                                        setTempStartDate(new Date().toLocaleDateString('en-CA'));
                                        setTempStartTime('00:00');
                                        setTempEndDate(new Date().toLocaleDateString('en-CA'));
                                        setTempEndTime('23:59');

                                        setFilterType('latest');
                                        setStartDate(new Date().toLocaleDateString('en-CA'));
                                        setStartTime('00:00');
                                        setEndDate(new Date().toLocaleDateString('en-CA'));
                                        setEndTime('23:59');
                                        setShowFilterPanel(false);
                                    }}
                                    className="px-4 py-2 hover:bg-slate-200 active:bg-slate-300 rounded-lg text-sm font-bold text-slate-600 transition-colors"
                                >
                                    ລ້າງຄ່າ (Reset)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilterType(tempFilterType);
                                        setStartDate(tempStartDate);
                                        setStartTime(tempStartTime);
                                        setEndDate(tempEndDate);
                                        setEndTime(tempEndTime);
                                        setShowFilterPanel(false);
                                    }}
                                    className="px-5 py-2.5 bg-sky-700 hover:bg-sky-800 active:bg-sky-900 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
                                >
                                    ດຶງຂໍ້ມູນ (Apply Filter)
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-auto bg-slate-50">
                <div className="max-w-7xl mx-auto py-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center text-slate-600 gap-4 py-28">
                            <Loader2 size={36} className="animate-spin text-sky-600" />
                            <p className="text-lg font-bold text-slate-800">ກຳລັງໂຫຼດຂໍ້ມູນ...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-600 gap-3 py-28 px-6 text-center">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-sky-100 text-sky-700">
                                <PackageSearch size={30} strokeWidth={2} />
                            </div>
                            <p className="text-lg font-bold text-slate-900">ຍັງບໍ່ມີປະຫວັດການຫັກຍອດຂາຍ</p>
                            <p className="text-base text-slate-500 max-w-sm">ລາຍການຈະປາກົດຢູ່ນີ້ທັນທີທີ່ສາຂານີ້ມີການ sync ຍອດຂາຍຈາກ Odoo</p>
                        </div>
                    ) : viewMode === 'analytics' ? (
                        <div className="px-4 sm:px-8 space-y-6">
                            {/* Sales trend chart */}
                            <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-extrabold text-slate-900 mb-1">ແນວໂນ້ມຍອດຂາຍ</h3>
                                <p className="text-sm font-medium text-slate-500 mb-6">ຈຳນວນທີ່ຂາຍອອກລວມຕໍ່ວັນ</p>
                                <ResponsiveContainer width="100%" height={300}>
                                    <LineChart data={trendData} margin={{ top: 8, right: 24, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.borderLight} vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 13, fill: TOKENS.textSecondary, fontFamily: FONT_STACK, fontWeight: 600 }}
                                            tickLine={false}
                                            axisLine={{ stroke: TOKENS.border }}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 13, fill: TOKENS.textSecondary, fontFamily: MONO_STACK, fontWeight: 600 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontFamily: FONT_STACK, fontSize: 14, borderRadius: 8, border: `1px solid ${TOKENS.border}`, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 800, color: TOKENS.textPrimary }}
                                            formatter={(value) => [value, 'ຈຳນວນທີ່ຂາຍ']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="qty"
                                            stroke={TOKENS.brand}
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: TOKENS.brand }}
                                            activeDot={{ r: 6 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top selling items chart */}
                            <div className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm">
                                <h3 className="text-lg font-extrabold text-slate-900 mb-1">ສິນຄ້າຂາຍດີທີ່ສຸດ</h3>
                                <p className="text-sm font-medium text-slate-500 mb-6">Top {topItems.length} ຕາມຈຳນວນທີ່ຂາຍອອກ</p>
                                <ResponsiveContainer width="100%" height={Math.max(260, topItems.length * 48)}>
                                    <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 32, left: 16, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={TOKENS.borderLight} horizontal={false} />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 13, fill: TOKENS.textSecondary, fontFamily: MONO_STACK, fontWeight: 600 }}
                                            tickLine={false}
                                            axisLine={{ stroke: TOKENS.border }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="shortName"
                                            width={180}
                                            tick={{ fontSize: 13, fill: TOKENS.textPrimary, fontFamily: FONT_STACK, fontWeight: 700 }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontFamily: FONT_STACK, fontSize: 14, borderRadius: 8, border: `1px solid ${TOKENS.border}`, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                            labelStyle={{ fontWeight: 800, color: TOKENS.textPrimary }}
                                            formatter={(value) => [value, 'ຈຳນວນທີ່ຂາຍ']}
                                        />
                                        <Bar dataKey="qty" fill={TOKENS.brand} radius={[0, 6, 6, 0]} barSize={24} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-slate-600 gap-3 py-28 px-6 text-center">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-slate-200">
                                <PackageSearch size={30} strokeWidth={2} className="text-slate-500" />
                            </div>
                            <p className="text-lg font-bold text-slate-900">ບໍ່ພົບຂໍ້ມູນທີ່ຄົ້ນຫາ</p>
                            <p className="text-base text-slate-500">ລອງຄົ້ນຫາດ້ວຍບາໂຄດ ຫຼື ຊື່ສິນຄ້າອື່ນ</p>
                        </div>
                    ) : (
                        /* Classic ERP Table — High readability, crisp dividers, large font */
                        <div className="bg-white border-y sm:border sm:rounded-xl border-slate-300 shadow-sm mx-0 sm:mx-8 overflow-hidden">
                            <table className="w-full text-left border-collapse text-base">
                                <thead className="bg-slate-100 sticky top-0 z-10 border-b-2 border-slate-300">
                                    <tr>
                                        <th className="w-1.5 p-0" aria-hidden="true"></th>
                                        <th className="px-5 py-3.5 font-bold text-sm uppercase tracking-wider text-slate-700 whitespace-nowrap">ວັນທີ-ເວລາ</th>
                                        <th className="px-5 py-3.5 font-bold text-sm uppercase tracking-wider text-slate-700 whitespace-nowrap">ບາໂຄດ</th>
                                        <th className="px-5 py-3.5 font-bold text-sm uppercase tracking-wider text-slate-700">ຊື່ສິນຄ້າ</th>
                                        <th className="px-5 py-3.5 font-bold text-sm uppercase tracking-wider text-slate-700 text-right">ຂາຍອອກ</th>
                                        <th className="px-5 py-3.5 font-bold text-sm uppercase tracking-wider text-slate-700 text-right">ສະຕັອກ (ກ່ອນ → ຫຼັງ)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {filteredLogs.map((log, i) => {
                                        const { barcode: odooBarcode, name: cleanName } = splitProduct(log.item_name);
                                        const isFailed = String(log.status || '').toLowerCase().includes('fail');
                                        return (
                                            <tr
                                                key={log.id}
                                                className={`hover:bg-sky-50/80 transition-colors ${i % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}`}
                                            >
                                                <td className="w-1.5 p-0">
                                                    <div
                                                        className="w-1.5 h-full min-h-[3.5rem]"
                                                        style={{ backgroundColor: isFailed ? TOKENS.danger : TOKENS.brand, opacity: isFailed ? 1 : 0.6 }}
                                                        aria-hidden="true"
                                                    />
                                                </td>
                                                <td className="px-5 py-4 text-slate-600 whitespace-nowrap text-[15px] font-medium" style={{ fontFamily: MONO_STACK }}>
                                                    {log.odoo_sync_logs?.sync_completed_at ? new Date(log.odoo_sync_logs.sync_completed_at).toLocaleString('lo-LA') : '-'}
                                                </td>
                                                <td className="px-5 py-4 font-bold text-slate-900 whitespace-nowrap text-[15px]" style={{ fontFamily: MONO_STACK }}>
                                                    {log.barcode_no}
                                                </td>
                                                <td className="px-5 py-4 max-w-md">
                                                    <div className="text-slate-900 font-bold text-[16px]">{cleanName}</div>
                                                    {odooBarcode !== '-' && (
                                                        <div className="text-sm text-slate-500 font-medium mt-0.5" style={{ fontFamily: MONO_STACK }}>Odoo: {odooBarcode}</div>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right whitespace-nowrap">
                                                    <span
                                                        className="font-extrabold tabular-nums text-lg"
                                                        style={{ fontFamily: MONO_STACK, color: isFailed ? TOKENS.danger : TOKENS.amber }}
                                                    >
                                                        -{log.qty_sold}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right whitespace-nowrap text-[15px]">
                                                    <span className="text-slate-500 font-medium tabular-nums" style={{ fontFamily: MONO_STACK }}>{log.old_store_qty}</span>
                                                    <span className="mx-2 text-slate-400 font-bold">→</span>
                                                    <span className="font-extrabold text-slate-900 tabular-nums text-[16px]" style={{ fontFamily: MONO_STACK }}>{log.new_store_qty}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer count */}
            {viewMode === 'table' && !loading && filteredLogs.length > 0 && (
                <div className="bg-white border-t border-slate-300 px-4 sm:px-8 py-3 text-sm font-bold text-slate-600 shrink-0 flex items-center justify-between shadow-sm">
                    <span>ສະແດງ {filteredLogs.length.toLocaleString()} ຈາກທັງໝົດ {logs.length.toLocaleString()} ລາຍການ</span>
                    <span className="hidden sm:flex items-center gap-2 text-slate-500 font-medium">
                        <kbd className="px-2 py-0.5 rounded border border-slate-300 bg-slate-100 text-xs font-bold text-slate-700">Esc</kbd>
                        ເພື່ອປິດ
                    </span>
                </div>
            )}
        </div>
    );

    return createPortal(modalContent, document.body);
}