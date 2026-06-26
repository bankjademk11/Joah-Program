import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { authenticate, fetchDetailedProductSales, fetchProductBarcodes } from '../../services/odooApi';
import { ArrowLeft, RefreshCw, Users, Package, TrendingUp, Search, AlertCircle, ShoppingBag } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatKip = (n) => {
    if (!n && n !== 0) return '0';
    return Math.round(n).toLocaleString('en-US');
};

const splitProduct = (raw = '') => {
    if (!raw) return { barcode: '-', name: raw };
    const match = raw.match(/^\[([^\]]+)\]\s*(.*)$/);
    if (match) return { barcode: match[1], name: match[2] };
    return { barcode: '-', name: raw };
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function DayDetailViewer({ dateObj, branchId, branchName, dayData, joahOnly = true, onBack }) {
    const [items, setItems] = useState([]);
    const [trueBarcodes, setTrueBarcodes] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [search, setSearch] = useState('');

    const { startUTC, endUTC, dayLabel, formattedDate } = useCallback(() => {
        const d = new Date(dateObj);
        // midnight Vientiane = 17:00 prev day UTC
        const start = new Date(d);
        start.setHours(0, 0, 0, 0);
        const startUTC = new Date(start.getTime());

        const end = new Date(d);
        end.setHours(23, 59, 59, 999);
        const endUTC = new Date(end.getTime());

        const fmt = (dt) => dt.toISOString().replace('T', ' ').slice(0, 19);
        const dayLabel = d.toLocaleDateString('en-GB', { weekday: 'long' });
        const formattedDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        return { startUTC: fmt(startUTC), endUTC: fmt(endUTC), dayLabel, formattedDate };
    }, [dateObj])();

    // Fetch detailed items for this day
    const fetchItems = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await authenticate(
                import.meta.env.VITE_ODOO_DB,
                import.meta.env.VITE_ODOO_USER,
                import.meta.env.VITE_ODOO_PASSWORD
            );
            const data = await fetchDetailedProductSales(branchId, startUTC, endUTC, joahOnly);
            
            // Extract unique product IDs to fetch their true 13-digit barcodes
            const uniqueProductIds = [...new Set(data.map(i => i.product_id?.[0]).filter(Boolean))];
            let barcodeMap = {};
            if (uniqueProductIds.length > 0) {
                barcodeMap = await fetchProductBarcodes(uniqueProductIds);
            }
            
            setTrueBarcodes(barcodeMap);
            setItems(data);
        } catch (e) {
            setError(e.message || 'Connection failed. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [branchId, startUTC, endUTC, joahOnly]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // Derived stats from fetched items
    const totalRevenue = items.reduce((s, i) => s + (i.price_subtotal_incl || 0), 0);
    const totalQty = items.reduce((s, i) => s + (i.qty || 0), 0);
    const uniqueOrders = new Set(items.map(i => i.order_id?.[0]).filter(Boolean)).size;

    // Filtered list
    const filtered = items.filter(i => {
        const { name } = splitProduct(i.product_id?.[1] || '');
        const pId = i.product_id?.[0];
        const barcode = trueBarcodes[pId] || splitProduct(i.product_id?.[1] || '').barcode;
        
        const q = search.toLowerCase();
        return !q || barcode.toLowerCase().includes(q) || name.toLowerCase().includes(q);
    });

    // Group by product for summary
    const grouped = {};
    filtered.forEach(i => {
        const key = i.product_id?.[0];
        if (!key) return;
        if (!grouped[key]) {
            const { name } = splitProduct(i.product_id?.[1] || '');
            const barcode = trueBarcodes[key] || splitProduct(i.product_id?.[1] || '').barcode;
            grouped[key] = { barcode, name, qty: 0, revenue: 0 };
        }
        grouped[key].qty += i.qty || 0;
        grouped[key].revenue += i.price_subtotal_incl || 0;
    });
    const groupedList = Object.values(grouped).sort((a, b) => b.revenue - a.revenue);

    // ✅ Always use computed values from the actual fetched items so card and table are ALWAYS in sync
    const summaryRevenue = totalRevenue;
    const summaryCustomers = uniqueOrders;
    const summarySkus = groupedList.length;

    return createPortal(
        <div className="fixed inset-0 z-[200] overflow-hidden bg-slate-900 text-slate-200 font-sans animate-fade-in-up flex flex-col">
            
            {/* Background pattern (subtle grid) */}
            <div className="absolute inset-0 pointer-events-none opacity-5" style={{
                backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)',
                backgroundSize: '32px 32px'
            }} />

            <div className="relative z-10 flex flex-col h-full max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8">

                {/* ── HEADER ─────────────────────────────────────────── */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onBack}
                            className="flex items-center justify-center p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-slate-700 shadow-sm"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <span>{branchName}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-600"></span>
                                <span>Daily Analytics</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
                                {dayLabel}, <span className="text-slate-300 font-medium">{formattedDate}</span>
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="text-right hidden sm:block mr-2">
                            <div className="text-xs font-medium text-slate-400 uppercase">Status</div>
                            <div className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5 justify-end">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                Synced
                            </div>
                        </div>
                        <button
                            onClick={fetchItems}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition-all border border-slate-700 shadow-sm"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                            {loading ? 'Updating...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {/* ── STAT CARDS ──────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    {/* Revenue */}
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <TrendingUp size={64} />
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-joah-orange">
                            <div className="p-1.5 bg-orange-500/10 rounded-md">
                                <TrendingUp size={16} />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
                        </div>
                        <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                            ₭ {formatKip(summaryRevenue)}
                        </div>
                    </div>

                    {/* Customers */}
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Users size={64} />
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                            <div className="p-1.5 bg-blue-400/10 rounded-md">
                                <Users size={16} />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider">Customers / Bills</span>
                        </div>
                        <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                            {formatKip(summaryCustomers)} <span className="text-lg font-medium text-slate-400">bills</span>
                        </div>
                    </div>

                    {/* SKU */}
                    <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 shadow-lg relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <ShoppingBag size={64} />
                        </div>
                        <div className="flex items-center gap-2 mb-2 text-purple-400">
                            <div className="p-1.5 bg-purple-400/10 rounded-md">
                                <Package size={16} />
                            </div>
                            <span className="text-xs font-semibold uppercase tracking-wider">SKU Lines</span>
                        </div>
                        <div className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                            {formatKip(summarySkus)} <span className="text-lg font-medium text-slate-400">items</span>
                        </div>
                    </div>
                </div>

                {/* ── SEARCH BAR ──────────────────────────────────────── */}
                <div className="relative mb-4">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search product name or barcode..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full py-3.5 pl-11 pr-4 bg-slate-800/50 border border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-600 focus:border-slate-500 transition-all text-white placeholder-slate-400 shadow-inner"
                    />
                    {search && (
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-1 bg-slate-700 text-slate-300 rounded-md">
                            {groupedList.length} results
                        </span>
                    )}
                </div>

                {/* ── TABLE ───────────────────────────────────────────── */}
                <div className="flex-1 overflow-hidden flex flex-col bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl">

                    {/* Table header */}
                    <div className="grid grid-cols-12 px-5 py-3.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700/50 bg-slate-800/80 shrink-0">
                        <div className="col-span-1 text-center">#</div>
                        <div className="col-span-3 lg:col-span-2">Barcode</div>
                        <div className="col-span-4 lg:col-span-5">Product Name</div>
                        <div className="col-span-2 text-center">Qty</div>
                        <div className="col-span-2 text-right">Revenue (₭)</div>
                    </div>

                    {/* Loading state */}
                    {loading && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-slate-800/20">
                            <div className="w-10 h-10 border-4 border-slate-600 border-t-joah-orange rounded-full animate-spin"></div>
                            <div className="text-sm font-medium text-slate-400">Loading daily transactions...</div>
                        </div>
                    )}

                    {/* Error state */}
                    {!loading && error && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-slate-800/20">
                            <div className="p-3 bg-red-500/10 rounded-full text-red-400">
                                <AlertCircle size={32} />
                            </div>
                            <div className="text-sm font-semibold text-slate-300">{error}</div>
                            <button onClick={fetchItems} className="px-4 py-2 mt-2 text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-all">
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Data table */}
                    {!loading && !error && (
                        <div className="flex-1 overflow-y-auto hide-scrollbar">
                            {groupedList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 gap-3">
                                    <ShoppingBag size={48} className="text-slate-600" />
                                    <div className="text-sm font-medium text-slate-400">
                                        No sales records found for this criteria.
                                    </div>
                                </div>
                            ) : (
                                groupedList.map((item, idx) => {
                                    const isRefund = item.qty < 0 || item.revenue < 0;
                                    return (
                                        <div
                                            key={idx}
                                            className={`grid grid-cols-12 px-5 py-3.5 items-center transition-all border-b border-slate-700/30 hover:bg-slate-700/30 ${isRefund ? 'bg-red-900/10' : ''}`}
                                        >
                                            <div className="col-span-1 text-center text-xs font-medium text-slate-500">
                                                {idx + 1}
                                            </div>
                                            <div className="col-span-3 lg:col-span-2">
                                                <span className="text-xs font-mono px-2 py-1 bg-slate-900/50 text-slate-300 rounded border border-slate-700/50">
                                                    {item.barcode}
                                                </span>
                                            </div>
                                            <div className="col-span-4 lg:col-span-5 flex items-center pr-2">
                                                <p className={`text-sm font-medium truncate ${isRefund ? 'text-red-400' : 'text-slate-200'}`}>
                                                    {item.name}
                                                </p>
                                                {isRefund && (
                                                    <span className="ml-2 shrink-0 text-[10px] font-bold px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-md uppercase tracking-wider">
                                                        Refund
                                                    </span>
                                                )}
                                            </div>
                                            <div className="col-span-2 flex items-center justify-center">
                                                <span className={`text-sm font-bold ${isRefund ? 'text-red-400' : 'text-white'}`}>
                                                    {item.qty > 0 ? '+' : ''}{formatKip(item.qty)}
                                                </span>
                                            </div>
                                            <div className="col-span-2 flex items-center justify-end">
                                                <span className={`text-sm font-bold ${isRefund ? 'text-red-400' : 'text-white'}`}>
                                                    {formatKip(item.revenue)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    {!loading && !error && groupedList.length > 0 && (
                        <div className="grid grid-cols-12 px-5 py-4 shrink-0 bg-slate-800/90 border-t border-slate-700">
                            <div className="col-span-8 flex items-center">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                    Total ({groupedList.length} unique products)
                                </span>
                            </div>
                            <div className="col-span-2 text-center">
                                <span className="text-sm font-bold text-white">
                                    {formatKip(totalQty)}
                                </span>
                            </div>
                            <div className="col-span-2 text-right">
                                <span className="text-sm font-bold text-white">
                                    {formatKip(totalRevenue)}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>,
        document.body
    );
}
