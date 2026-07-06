import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../utils/supabaseClient';
import { X, Search, Download, PackageSearch, Loader2, BarChart3, Table2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
    ResponsiveContainer,
    LineChart, Line,
    BarChart, Bar,
    XAxis, YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';

// Loads Noto Sans Lao (proper Lao glyph support) + Inter (latin/numbers) once per page.
// For a permanent setup, move this @import into your global CSS / tailwind entry file instead.
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

    useEffect(() => {
        if (isOpen && branchId) {
            fetchLogs();
        }
    }, [isOpen, branchId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('odoo_sync_details')
                .select(`
                    *,
                    odoo_sync_logs!inner(sync_completed_at, branch_id)
                `)
                .eq('odoo_sync_logs.branch_id', branchId)
                .order('id', { ascending: false })
                .limit(1000);

            if (error) throw error;
            setLogs(data || []);
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
        return {
            totalTx: logs.length,
            totalQty,
            uniqueItems,
            lastSync: lastSync ? new Date(lastSync).toLocaleString('lo-LA') : '-'
        };
    }, [logs]);

    // Trend: total qty sold grouped by day, in chronological order
    const trendData = useMemo(() => {
        const byDay = {};
        logs.forEach(log => {
            const raw = log.odoo_sync_logs?.sync_completed_at;
            if (!raw) return;
            const d = new Date(raw);
            const key = d.toLocaleDateString('en-CA'); // YYYY-MM-DD, sorts naturally
            const label = d.toLocaleDateString('lo-LA', { day: '2-digit', month: '2-digit' });
            if (!byDay[key]) byDay[key] = { key, label, qty: 0, tx: 0 };
            byDay[key].qty += Number(log.qty_sold) || 0;
            byDay[key].tx += 1;
        });
        return Object.values(byDay).sort((a, b) => a.key.localeCompare(b.key));
    }, [logs]);

    // Top selling items by total quantity sold
    const topItems = useMemo(() => {
        const byItem = {};
        logs.forEach(log => {
            const { name } = splitProduct(log.item_name);
            const key = name || 'ไม่ระบุ';
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
            .reverse(); // reverse so largest bar renders at top in horizontal BarChart
    }, [logs]);

    if (!isOpen) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[99999] flex flex-col bg-[#F7F8F9] dark:bg-[#0B0F14]"
            style={{ fontFamily: FONT_STACK }}
        >

            {/* Top bar — dense, dark, functional */}
            <div className="bg-[#0B0F14] text-white px-4 sm:px-8 py-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-300 hover:text-white shrink-0"
                        aria-label="ປິດ"
                    >
                        <X size={24} />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl font-bold text-white truncate tracking-tight">
                            ປະຫວັດການຫັກຍອດຂາຍ
                        </h1>
                        <p className="text-sm text-slate-400 font-medium truncate">
                            ສາຂາ <span className="text-slate-100 font-semibold" style={{ fontFamily: MONO_STACK }}>{branchId}</span>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-white/10 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setViewMode('table')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'table' ? 'bg-white text-[#0B0F14]' : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            <Table2 size={16} /> <span className="hidden sm:inline">ຕາຕະລາງ</span>
                        </button>
                        <button
                            onClick={() => setViewMode('analytics')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${viewMode === 'analytics' ? 'bg-white text-[#0B0F14]' : 'text-slate-300 hover:text-white'
                                }`}
                        >
                            <BarChart3 size={16} /> <span className="hidden sm:inline">ວິເຄາະຂໍ້ມູນ</span>
                        </button>
                    </div>

                    <button
                        onClick={exportToExcel}
                        disabled={logs.length === 0}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-colors shrink-0"
                    >
                        <Download size={18} /> <span className="hidden sm:inline">Export Excel</span>
                    </button>
                </div>
            </div>

            {/* KPI strip */}
            <div className="bg-white dark:bg-[#12181F] border-b border-[#E2E4E7] dark:border-[#232B33] px-4 sm:px-8 py-4 shrink-0">
                <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-px bg-[#E2E4E7] dark:bg-[#232B33] rounded-lg overflow-hidden border border-[#E2E4E7] dark:border-[#232B33]">
                    <div className="bg-white dark:bg-[#12181F] px-5 py-3.5">
                        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-slate-500 uppercase tracking-wider">ຈຳນວນລາຍການ</div>
                        <div className="text-2xl font-bold text-[#16191C] dark:text-white tabular-nums mt-0.5" style={{ fontFamily: MONO_STACK }}>{stats.totalTx.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12181F] px-5 py-3.5">
                        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-slate-500 uppercase tracking-wider">ຍອດຫັກລວມ</div>
                        <div className="text-2xl font-bold text-[#B3261E] dark:text-red-400 tabular-nums mt-0.5" style={{ fontFamily: MONO_STACK }}>-{stats.totalQty.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12181F] px-5 py-3.5">
                        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-slate-500 uppercase tracking-wider">ສິນຄ້າທີ່ກ່ຽວຂ້ອງ</div>
                        <div className="text-2xl font-bold text-[#16191C] dark:text-white tabular-nums mt-0.5" style={{ fontFamily: MONO_STACK }}>{stats.uniqueItems.toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-[#12181F] px-5 py-3.5">
                        <div className="text-xs font-semibold text-[#5F6B7A] dark:text-slate-500 uppercase tracking-wider">Sync ລ່າສຸດ</div>
                        <div className="text-base font-bold text-[#16191C] dark:text-white truncate mt-0.5">{stats.lastSync}</div>
                    </div>
                </div>
            </div>

            {/* Toolbar — table view only */}
            {viewMode === 'table' && (
                <div className="bg-white dark:bg-[#12181F] border-b border-[#E2E4E7] dark:border-[#232B33] px-4 sm:px-8 py-3 shrink-0">
                    <div className="max-w-7xl mx-auto relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8B98A5]" size={19} />
                        <input
                            type="text"
                            placeholder="ຄົ້ນຫາບາໂຄດ ຫຼື ຊື່ສິນຄ້າ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-96 pl-11 pr-4 py-3 rounded-lg border border-[#E2E4E7] dark:border-[#232B33] bg-[#F7F8F9] dark:bg-[#0B0F14] text-base text-[#16191C] dark:text-white placeholder:text-[#8B98A5] focus:outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20 transition-colors"
                        />
                    </div>
                </div>
            )}

            {/* Content area */}
            <div className="flex-1 overflow-auto">
                <div className="max-w-7xl mx-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center text-[#5F6B7A] dark:text-slate-500 gap-4 py-28">
                            <Loader2 size={32} className="animate-spin" />
                            <p className="text-base font-semibold">ກຳລັງໂຫຼດຂໍ້ມູນ...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-[#5F6B7A] dark:text-slate-500 gap-4 py-28">
                            <PackageSearch size={40} strokeWidth={1.5} className="opacity-40" />
                            <p className="text-base font-semibold">ຍັງບໍ່ມີປະຫວັດການຫັກຍອດຂາຍໃນສາຂານີ້</p>
                        </div>
                    ) : viewMode === 'analytics' ? (
                        <div className="p-4 sm:p-8 space-y-6">
                            {/* Sales trend over time */}
                            <div className="bg-white dark:bg-[#12181F] border border-[#E2E4E7] dark:border-[#232B33] rounded-lg p-5 sm:p-6">
                                <h3 className="text-base font-bold text-[#16191C] dark:text-white mb-1">ແນວໂນ້ມຍອດຂາຍ</h3>
                                <p className="text-sm text-[#5F6B7A] dark:text-slate-500 mb-4">ຈຳນວນທີ່ຂາຍອອກລວມຕໍ່ວັນ</p>
                                <ResponsiveContainer width="100%" height={280}>
                                    <LineChart data={trendData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E4E7" vertical={false} />
                                        <XAxis
                                            dataKey="label"
                                            tick={{ fontSize: 12, fill: '#5F6B7A', fontFamily: FONT_STACK }}
                                            tickLine={false}
                                            axisLine={{ stroke: '#E2E4E7' }}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 12, fill: '#5F6B7A', fontFamily: MONO_STACK }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontFamily: FONT_STACK, fontSize: 13, borderRadius: 8, border: '1px solid #E2E4E7' }}
                                            labelStyle={{ fontWeight: 700, color: '#16191C' }}
                                            formatter={(value) => [value, 'ຈຳນວນທີ່ຂາຍ']}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="qty"
                                            stroke="#0F766E"
                                            strokeWidth={2.5}
                                            dot={{ r: 3, fill: '#0F766E' }}
                                            activeDot={{ r: 5 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Top selling items */}
                            <div className="bg-white dark:bg-[#12181F] border border-[#E2E4E7] dark:border-[#232B33] rounded-lg p-5 sm:p-6">
                                <h3 className="text-base font-bold text-[#16191C] dark:text-white mb-1">ສິນຄ້າຂາຍດີທີ່ສຸດ</h3>
                                <p className="text-sm text-[#5F6B7A] dark:text-slate-500 mb-4">Top {topItems.length} ຕາມຈຳນວນທີ່ຂາຍອອກ</p>
                                <ResponsiveContainer width="100%" height={Math.max(240, topItems.length * 42)}>
                                    <BarChart data={topItems} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E4E7" horizontal={false} />
                                        <XAxis
                                            type="number"
                                            tick={{ fontSize: 12, fill: '#5F6B7A', fontFamily: MONO_STACK }}
                                            tickLine={false}
                                            axisLine={{ stroke: '#E2E4E7' }}
                                        />
                                        <YAxis
                                            type="category"
                                            dataKey="shortName"
                                            width={160}
                                            tick={{ fontSize: 12, fill: '#16191C', fontFamily: FONT_STACK }}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip
                                            contentStyle={{ fontFamily: FONT_STACK, fontSize: 13, borderRadius: 8, border: '1px solid #E2E4E7' }}
                                            labelStyle={{ fontWeight: 700, color: '#16191C' }}
                                            formatter={(value) => [value, 'ຈຳນວນທີ່ຂາຍ']}
                                        />
                                        <Bar dataKey="qty" fill="#0F766E" radius={[0, 4, 4, 0]} barSize={20} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-[#5F6B7A] dark:text-slate-500 gap-4 py-28">
                            <PackageSearch size={40} strokeWidth={1.5} className="opacity-40" />
                            <p className="text-base font-semibold">ບໍ່ພົບຂໍ້ມູນທີ່ຄົ້ນຫາ</p>
                        </div>
                    ) : (
                        <table className="w-full text-left border-collapse text-[15px]">
                            <thead className="bg-white dark:bg-[#12181F] sticky top-0 z-10 border-b-2 border-[#E2E4E7] dark:border-[#232B33]">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold text-[13px] uppercase tracking-wider text-[#5F6B7A] dark:text-slate-500 whitespace-nowrap">ວັນທີ-ເວລາ</th>
                                    <th className="px-5 py-3.5 font-semibold text-[13px] uppercase tracking-wider text-[#5F6B7A] dark:text-slate-500 whitespace-nowrap">ບາໂຄດ</th>
                                    <th className="px-5 py-3.5 font-semibold text-[13px] uppercase tracking-wider text-[#5F6B7A] dark:text-slate-500">ຊື່ສິນຄ້າ</th>
                                    <th className="px-5 py-3.5 font-semibold text-[13px] uppercase tracking-wider text-[#5F6B7A] dark:text-slate-500 text-right">ຂາຍອອກ</th>
                                    <th className="px-5 py-3.5 font-semibold text-[13px] uppercase tracking-wider text-[#5F6B7A] dark:text-slate-500 text-right">ສະຕັອກ (ກ່ອນ → ຫຼັງ)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredLogs.map((log, i) => {
                                    const { barcode: odooBarcode, name: cleanName } = splitProduct(log.item_name);
                                    return (
                                        <tr
                                            key={log.id}
                                            className={`border-b border-[#EEF0F2] dark:border-[#1B222A] hover:bg-teal-50/60 dark:hover:bg-teal-500/5 transition-colors ${i % 2 === 1 ? 'bg-[#FAFBFB] dark:bg-white/[0.02]' : 'bg-white dark:bg-transparent'
                                                }`}
                                        >
                                            <td className="px-5 py-4 text-[#5F6B7A] dark:text-slate-400 whitespace-nowrap text-sm" style={{ fontFamily: MONO_STACK }}>
                                                {log.odoo_sync_logs?.sync_completed_at ? new Date(log.odoo_sync_logs.sync_completed_at).toLocaleString('lo-LA') : '-'}
                                            </td>
                                            <td className="px-5 py-4 font-semibold text-[#16191C] dark:text-slate-200 whitespace-nowrap" style={{ fontFamily: MONO_STACK }}>
                                                {log.barcode_no}
                                            </td>
                                            <td className="px-5 py-4 max-w-xs">
                                                <div className="text-[#16191C] dark:text-slate-200 font-medium truncate">{cleanName}</div>
                                                {odooBarcode !== '-' && (
                                                    <div className="text-[13px] text-[#8B98A5] mt-0.5" style={{ fontFamily: MONO_STACK }}>Odoo: {odooBarcode}</div>
                                                )}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <span className="font-bold text-[#B3261E] dark:text-red-400 tabular-nums text-base" style={{ fontFamily: MONO_STACK }}>
                                                    -{log.qty_sold}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right whitespace-nowrap">
                                                <span className="text-[#8B98A5] tabular-nums" style={{ fontFamily: MONO_STACK }}>{log.old_store_qty}</span>
                                                <span className="mx-2 text-[#C9CFD4]">→</span>
                                                <span className="font-bold text-[#16191C] dark:text-white tabular-nums text-base" style={{ fontFamily: MONO_STACK }}>{log.new_store_qty}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Footer count — table view only */}
            {viewMode === 'table' && !loading && filteredLogs.length > 0 && (
                <div className="bg-white dark:bg-[#12181F] border-t border-[#E2E4E7] dark:border-[#232B33] px-4 sm:px-8 py-2.5 text-sm font-medium text-[#5F6B7A] dark:text-slate-500 shrink-0">
                    ສະແດງ {filteredLogs.length.toLocaleString()} ຈາກທັງໝົດ {logs.length.toLocaleString()} ລາຍການ
                </div>
            )}
        </div>
    );

    return createPortal(modalContent, document.body);
}