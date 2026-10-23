import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { fetchProductNamesByBarcodes, fetchDetailedProductSales, fetchProductBarcodes } from '../../services/odooApi';
import { Search, RefreshCw, Package, Layers, AlertTriangle, ShoppingBag, CheckCircle, Download, Calendar, ShieldCheck, Sparkles, ArrowUpDown } from 'lucide-react';
import ExcelJS from 'exceljs';

// Event booth stock is stored in location_inventory under this branch + rack.
const EVENT_BRANCH = 'ເມກ້າມໍ';
const EVENT_RACK = 'kolao-sq';
const EVENT_COMPANY_ID = 273; // PTX (Joah EVENT register lives under PTX company)

export default function EventStockView() {
    const [rows, setRows] = useState([]);
    const [salesLines, setSalesLines] = useState([]);
    const [trueBarcodes, setTrueBarcodes] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [nameWarning, setNameWarning] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SOLD' | 'UNSOLD' | 'SOLD_OUT' | 'OVER_SOLD'
    const [sortField, setSortField] = useState('stock_qty'); // 'stock_qty' | 'sold_qty' | 'remaining_qty' | 'item_name'
    const [sortAsc, setSortAsc] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    // Default: From 21 Oct 2026 until current date
    const todayStr = new Date().toISOString().split('T')[0];
    const [dateStart, setDateStart] = useState('2026-10-21T00:00');
    const [dateEnd, setDateEnd] = useState(`${todayStr}T23:59`);

    const splitProduct = (str) => {
        if (!str) return { barcode: '', name: '' };
        const match = str.match(/^\[(.*?)\]\s*(.*)$/);
        return match ? { barcode: match[1], name: match[2] } : { barcode: '', name: str };
    };

    const toUTC = (dateStr, isEnd) => {
        if (!dateStr) return null;
        const d = new Date(`${dateStr}:00`);
        if (isEnd) d.setSeconds(59);
        return d.toISOString().replace('T', ' ').substring(0, 19);
    };

    const loadData = async () => {
        setLoading(true);
        setError(null);
        setNameWarning(null);
        try {
            // ── 1. Fetch Event Stock from Supabase (location_inventory) ──
            const { data: locData, error: dbErr } = await supabase
                .from('location_inventory')
                .select('id, barcode_no, item_name, qty, rack_location, updated_at')
                .eq('branch_id', EVENT_BRANCH)
                .eq('rack_location', EVENT_RACK)
                .range(0, 4999);
            if (dbErr) throw dbErr;

            // Merge duplicate rows of the same barcode
            const byBarcode = {};
            (locData || []).forEach(r => {
                const bc = (r.barcode_no || '').trim();
                if (!bc) return;
                if (!byBarcode[bc]) {
                    byBarcode[bc] = { barcode: bc, name: (r.item_name || '').trim(), qty: 0, updated_at: r.updated_at };
                }
                byBarcode[bc].qty += Number(r.qty) || 0;
                if (!byBarcode[bc].name && r.item_name) byBarcode[bc].name = r.item_name.trim();
                if (r.updated_at > byBarcode[bc].updated_at) byBarcode[bc].updated_at = r.updated_at;
            });

            // Fill missing item names using Odoo read-only lookup
            const missing = Object.values(byBarcode).filter(r => !r.name).map(r => r.barcode);
            if (missing.length > 0) {
                try {
                    const nameMap = await fetchProductNamesByBarcodes(missing);
                    missing.forEach(bc => { if (nameMap[bc]) byBarcode[bc].name = nameMap[bc]; });
                } catch (e) {
                    console.warn('Odoo name lookup failed:', e);
                    setNameWarning('ດຶງຊື່ສິນຄ້າຈາກ Odoo ບໍ່ໄດ້ — ສະແດງສະເພາະ Barcode');
                }
            }

            setRows(Object.values(byBarcode));

            // ── 2. Fetch Sales from POS "Joah EVENT" since dateStart until dateEnd ──
            const startUTC = toUTC(dateStart, false);
            const endUTC = toUTC(dateEnd, true);

            let odooSales = [];
            try {
                // filterJoahOnly = false so all lines rung on Joah EVENT POS are included
                odooSales = await fetchDetailedProductSales(EVENT_COMPANY_ID, startUTC, endUTC, false, 'event');
            } catch (err) {
                console.warn('Failed to fetch Joah EVENT sales from Odoo:', err);
            }

            setSalesLines(odooSales || []);

            // ── 3. Resolve true EAN13 barcodes for Odoo sale lines ──
            const prodIds = [...new Set((odooSales || []).map(i => i.product_id?.[0]).filter(Boolean))];
            if (prodIds.length > 0) {
                try {
                    const barcodeMap = await fetchProductBarcodes(prodIds);
                    setTrueBarcodes(prev => ({ ...prev, ...barcodeMap }));
                } catch (bErr) {
                    console.warn('Barcode fetch error:', bErr);
                }
            }

        } catch (err) {
            console.error('Event stock load error:', err);
            setError(err.message || 'Failed to load event data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, [dateStart, dateEnd]);

    // ── Group sales by resolved barcode ──
    const salesByBarcode = useMemo(() => {
        const map = {};
        salesLines.forEach(line => {
            const pId = line.product_id?.[0];
            const rawName = line.product_id?.[1] || '';
            const { barcode: odooRef, name: cleanName } = splitProduct(rawName);
            const resolvedBarcode = trueBarcodes[pId] || odooRef || '';

            if (!resolvedBarcode) return;
            if (!map[resolvedBarcode]) {
                map[resolvedBarcode] = {
                    barcode: resolvedBarcode,
                    name: cleanName,
                    sold_qty: 0,
                    revenue: 0,
                };
            }
            map[resolvedBarcode].sold_qty += Number(line.qty) || 0;
            map[resolvedBarcode].revenue += Number(line.price_subtotal_incl) || 0;
        });
        return map;
    }, [salesLines, trueBarcodes]);

    // ── Base merged list (all items with simulated balance) ──
    const allMergedItems = useMemo(() => {
        const allBarcodes = new Set([
            ...rows.map(s => s.barcode),
            ...Object.keys(salesByBarcode)
        ]);

        const list = [];
        allBarcodes.forEach(bc => {
            if (!bc) return;
            const stock = rows.find(s => s.barcode === bc);
            const sale = salesByBarcode[bc];

            const stockQty = stock ? stock.qty : 0;
            const soldQty = sale ? sale.sold_qty : 0;
            const remainingQty = stockQty - soldQty; // Visual deduction
            const revenue = sale ? sale.revenue : 0;
            const itemName = stock?.name || sale?.name || `Barcode: ${bc}`;

            let status = 'IN_STOCK';
            if (stockQty > 0 && soldQty === 0) status = 'UNSOLD';
            else if (stockQty > 0 && remainingQty > 0) status = 'PARTIAL_SOLD';
            else if (stockQty > 0 && remainingQty === 0) status = 'SOLD_OUT';
            else if (stockQty > 0 && remainingQty < 0) status = 'OVER_SOLD';
            else if (stockQty === 0 && soldQty > 0) status = 'NO_INITIAL_STOCK';

            list.push({
                barcode: bc,
                item_name: itemName,
                stock_qty: stockQty,
                sold_qty: soldQty,
                remaining_qty: remainingQty,
                revenue,
                status,
                updated_at: stock?.updated_at
            });
        });
        return list;
    }, [rows, salesByBarcode]);

    // ── Filtered & sorted for UI table view ──
    const mergedList = useMemo(() => {
        let filtered = allMergedItems.filter(item => {
            if (statusFilter === 'SOLD' && item.sold_qty <= 0) return false;
            if (statusFilter === 'UNSOLD' && item.status !== 'UNSOLD') return false;
            if (statusFilter === 'SOLD_OUT' && item.status !== 'SOLD_OUT') return false;
            if (statusFilter === 'OVER_SOLD' && item.status !== 'OVER_SOLD' && item.status !== 'NO_INITIAL_STOCK') return false;

            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                return item.barcode.toLowerCase().includes(term) ||
                    item.item_name.toLowerCase().includes(term);
            }
            return true;
        });

        filtered.sort((a, b) => {
            let valA = a[sortField];
            let valB = b[sortField];
            if (typeof valA === 'string') {
                return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            return sortAsc ? (valA - valB) : (valB - valA);
        });

        return filtered;
    }, [allMergedItems, statusFilter, searchTerm, sortField, sortAsc]);

    // ── Summary Metrics ──
    const summary = useMemo(() => {
        let totalInitialQty = 0;
        let totalInitialSKU = rows.length;
        rows.forEach(s => totalInitialQty += s.qty);

        let totalSoldQty = 0;
        let totalRevenue = 0;
        let totalSoldSKU = Object.keys(salesByBarcode).length;
        Object.values(salesByBarcode).forEach(s => {
            totalSoldQty += s.sold_qty;
            totalRevenue += s.revenue;
        });

        const totalRemainingQty = totalInitialQty - totalSoldQty;

        return {
            totalInitialQty,
            totalInitialSKU,
            totalSoldQty,
            totalSoldSKU,
            totalRemainingQty,
            totalRevenue
        };
    }, [rows, salesByBarcode]);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    // ── Helper to create a worksheet with Phetsarath OT font ──
    const addReconcileSheet = (workbook, sheetName, items, headerBgHex, tabColorHex) => {
        const ws = workbook.addWorksheet(sheetName, {
            properties: { tabColor: { argb: tabColorHex } },
            views: [{ state: 'frozen', ySplit: 1 }]
        });

        ws.columns = [
            { header: '#', key: 'idx', width: 6 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'ຊື່ສິນຄ້າ (Item Name)', key: 'item_name', width: 42 },
            { header: 'ສະຕັອກຕົ້ນທາງ (kolao-sq)', key: 'stock_qty', width: 22 },
            { header: 'ຍອດຂາຍ (Joah EVENT)', key: 'sold_qty', width: 22 },
            { header: 'ຄົງເຫຼືອຈຳລອງ (Remaining)', key: 'remaining_qty', width: 24 },
            { header: 'ຍອດເງິນຂາຍ (KIP)', key: 'revenue', width: 20 },
            { header: 'ສະຖານະ (Status)', key: 'status', width: 22 }
        ];

        const headerRow = ws.getRow(1);
        headerRow.height = 26;
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgHex } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

        let totalStock = 0;
        let totalSold = 0;
        let totalRemaining = 0;
        let totalRevenue = 0;

        items.forEach((item, i) => {
            totalStock += item.stock_qty;
            totalSold += item.sold_qty;
            totalRemaining += item.remaining_qty;
            totalRevenue += item.revenue;

            const statusText = item.status === 'OVER_SOLD' ? 'ຂາຍເກີນສະຕັອກ ⚠️' :
                item.status === 'SOLD_OUT' ? 'ຂາຍໝົດພໍດີ' :
                    item.status === 'UNSOLD' ? 'ຍັງບໍ່ໄດ້ຂາຍ' :
                        item.status === 'PARTIAL_SOLD' ? 'ຂາຍບາງສ່ວນ' :
                            item.status === 'NO_INITIAL_STOCK' ? 'ບໍ່ມີໃນສະຕັອກຕົ້ນທາງ ⚠️' : 'ມີສະຕັອກ';

            const r = ws.addRow({
                idx: i + 1,
                barcode: item.barcode,
                item_name: item.item_name,
                stock_qty: item.stock_qty,
                sold_qty: item.sold_qty,
                remaining_qty: item.remaining_qty,
                revenue: item.revenue,
                status: statusText
            });

            r.height = 21;
            r.alignment = { vertical: 'middle' };
            r.getCell('idx').alignment = { horizontal: 'center', vertical: 'middle' };
            r.getCell('barcode').alignment = { horizontal: 'center', vertical: 'middle' };
            r.getCell('item_name').alignment = { horizontal: 'left', vertical: 'middle' };
            r.getCell('stock_qty').alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell('stock_qty').numFmt = '#,##0';
            r.getCell('sold_qty').alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell('sold_qty').numFmt = '#,##0';
            r.getCell('remaining_qty').alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell('remaining_qty').numFmt = '#,##0';
            r.getCell('revenue').alignment = { horizontal: 'right', vertical: 'middle' };
            r.getCell('revenue').numFmt = '#,##0';
            r.getCell('status').alignment = { horizontal: 'center', vertical: 'middle' };

            // Soft highlight for over sold
            if (item.remaining_qty < 0 || item.status === 'OVER_SOLD' || item.status === 'NO_INITIAL_STOCK') {
                r.getCell('remaining_qty').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                r.getCell('remaining_qty').font = { name: 'Phetsarath OT', color: { argb: 'FFE11D48' }, bold: true };
                r.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } };
                r.getCell('status').font = { name: 'Phetsarath OT', color: { argb: 'FFE11D48' }, bold: true };
            }
        });

        // Summary Total Row
        const totalRow = ws.addRow({
            idx: '',
            barcode: '',
            item_name: `ລວມທັງໝົດ (${items.length} ລາຍການ)`,
            stock_qty: totalStock,
            sold_qty: totalSold,
            remaining_qty: totalRemaining,
            revenue: totalRevenue,
            status: ''
        });
        totalRow.height = 24;
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        totalRow.alignment = { vertical: 'middle' };
        totalRow.getCell('item_name').alignment = { horizontal: 'center', vertical: 'middle' };
        totalRow.getCell('stock_qty').alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell('stock_qty').numFmt = '#,##0';
        totalRow.getCell('sold_qty').alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell('sold_qty').numFmt = '#,##0';
        totalRow.getCell('remaining_qty').alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell('remaining_qty').numFmt = '#,##0';
        totalRow.getCell('revenue').alignment = { horizontal: 'right', vertical: 'middle' };
        totalRow.getCell('revenue').numFmt = '#,##0';

        // Apply Phetsarath OT font and clean borders across EVERY single cell
        for (let r = 1; r <= ws.rowCount; r++) {
            const row = ws.getRow(r);
            const isHeader = r === 1;
            const isTotal = r === ws.rowCount;
            for (let c = 1; c <= 8; c++) {
                const cell = row.getCell(c);
                const existingColor = cell.font?.color;
                const existingBold = cell.font?.bold;
                cell.font = {
                    name: 'Phetsarath OT',
                    size: isHeader ? 11 : isTotal ? 11 : 10,
                    bold: isHeader || isTotal || Boolean(existingBold),
                    color: isHeader ? { argb: 'FFFFFFFF' } : (existingColor || { argb: 'FF0F172A' })
                };
                cell.border = {
                    top: { style: isTotal ? 'medium' : 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: isTotal ? 'double' : 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            }
        }
    };

    // ── Export to Excel with Multi-Sheets (ທັງໝົດ, ມີຍອດຂາຍ, ຍັງບໍ່ໄດ້ຂາຍ, ຂາຍໝົດ, ຂາຍເກີນ ⚠️) ──
    const handleExportExcel = async () => {
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Joah Warehouse Validator';
            workbook.created = new Date();

            // 1. ທັງໝົດ (All items)
            const allItems = [...allMergedItems].sort((a, b) => (b.stock_qty - a.stock_qty) || (b.sold_qty - a.sold_qty));
            addReconcileSheet(workbook, 'ທັງໝົດ', allItems, 'FFEA580C', 'FFEA580C'); // Orange

            // 2. ມີຍອດຂາຍ (Sold > 0)
            const soldItems = allMergedItems.filter(item => item.sold_qty > 0).sort((a, b) => b.sold_qty - a.sold_qty);
            addReconcileSheet(workbook, 'ມີຍອດຂາຍ', soldItems, 'FF059669', 'FF059669'); // Emerald

            // 3. ຍັງບໍ່ໄດ້ຂາຍ (Unsold)
            const unsoldItems = allMergedItems.filter(item => item.status === 'UNSOLD').sort((a, b) => b.stock_qty - a.stock_qty);
            addReconcileSheet(workbook, 'ຍັງບໍ່ໄດ້ຂາຍ', unsoldItems, 'FF2563EB', 'FF2563EB'); // Blue

            // 4. ຂາຍໝົດ (Sold out)
            const soldOutItems = allMergedItems.filter(item => item.status === 'SOLD_OUT').sort((a, b) => b.sold_qty - a.sold_qty);
            addReconcileSheet(workbook, 'ຂາຍໝົດ', soldOutItems, 'FF475569', 'FF475569'); // Slate

            // 5. ຂາຍເກີນ ⚠️ (Over sold / No initial stock)
            const overSoldItems = allMergedItems.filter(item => item.status === 'OVER_SOLD' || item.status === 'NO_INITIAL_STOCK' || item.remaining_qty < 0).sort((a, b) => a.remaining_qty - b.remaining_qty);
            addReconcileSheet(workbook, 'ຂາຍເກີນ ⚠️', overSoldItems, 'FFDC2626', 'FFDC2626'); // Red

            const buf = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const sDate = dateStart ? dateStart.split('T')[0] : '2026-10-21';
            const eDate = dateEnd ? dateEnd.split('T')[0] : todayStr;
            a.download = `Event_Stock_Reconcile_${sDate}_to_${eDate}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export Excel failed:', e);
            alert('Export failed: ' + e.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex-1 min-h-0 flex flex-col bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-6 rounded-3xl border border-white/30 shadow-2xl mb-4 animate-fade-in-up overflow-hidden">
            {/* Header (fixed at top) */}
            <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-tr from-amber-500 to-orange-500 rounded-2xl text-white shadow-lg shadow-orange-500/30">
                        <Package size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white">
                                🎪 ສົມທຽບສະຕັອກ & ຈຳລອງການຂາຍ Event
                            </h2>
                            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                                <ShieldCheck size={12} /> ໂໝດຈຳລອງ (ບໍ່ຫັກສະຕັອກຈິງ)
                            </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            ສະຕັອກຕົ້ນທາງ: <span className="font-bold text-slate-700 dark:text-slate-200">location_inventory</span> ({EVENT_BRANCH} · ລັອກ <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded font-mono font-bold text-orange-600">{EVENT_RACK}</code>) ທຽບຍອດຂາຍ POS <span className="font-bold text-emerald-600">Joah EVENT</span>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Date filter pickers */}
                    <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs">
                        <Calendar size={13} className="text-slate-400" />
                        <span className="text-slate-500 font-bold">ຂາຍຕັ້ງແຕ່:</span>
                        <input
                            type="datetime-local"
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none text-xs"
                        />
                        <span className="text-slate-400">ຫາ</span>
                        <input
                            type="datetime-local"
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            className="bg-transparent font-bold text-slate-700 dark:text-slate-200 outline-none text-xs"
                        />
                    </div>

                    <button
                        onClick={handleExportExcel}
                        disabled={loading || isExporting || allMergedItems.length === 0}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        {isExporting ? (
                            <RefreshCw size={14} className="animate-spin" />
                        ) : (
                            <Download size={14} />
                        )}
                        <span>{isExporting ? 'ກຳລັງ Export...' : 'Export Excel'}</span>
                    </button>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold border border-slate-200 dark:border-slate-700 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin text-orange-500' : ''} />
                        <span>ຣີເຟຣຊ</span>
                    </button>
                </div>
            </div>

            {/* Safety Banner */}
            <div className="shrink-0 my-3 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>
                        <b>ລະບົບຈຳລອງສະຕັອກ (Read-Only Simulation):</b> ຄຳນວນສະເພາະຕົວເລກ (ສະຕັອກຕົ້ນທາງ <b>843 ຊິ້ນ</b> ລົບ ຍອດຂາຍຈາກ POS Joah EVENT ຕັ້ງແຕ່ວັນທີ 21 ເປັນຕົ້ນມາ) <b>ໂດຍບໍ່ມີການຫັກ ຫຼື ແກ້ໄຂ Database ໃດໆ</b>
                    </span>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                {/* 1. Initial Stock */}
                <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-3">
                    <div className="flex items-center justify-between text-blue-600 dark:text-blue-400 mb-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">ສິນຄ້າທີ່ຂົນໄປ (Initial)</span>
                        <Package size={15} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-slate-800 dark:text-white">
                            {summary.totalInitialQty.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-400">ຊິ້ນ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        {summary.totalInitialSKU} SKU (ໃນ kolao-sq)
                    </p>
                </div>

                {/* 2. Total Sold */}
                <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-3">
                    <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">ຂາຍແລ້ວ (Sold ຈາກ 21)</span>
                        <ShoppingBag size={15} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                            {summary.totalSoldQty.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-400">ຊິ້ນ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        ຂາຍໄດ້ {summary.totalSoldSKU} SKU · {Number(summary.totalRevenue).toLocaleString()} ₭
                    </p>
                </div>

                {/* 3. Remaining */}
                <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-3">
                    <div className="flex items-center justify-between text-amber-600 dark:text-amber-400 mb-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">ຄົງເຫຼືອຈຳລອງ (Remaining)</span>
                        <CheckCircle size={15} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                            {summary.totalRemainingQty.toLocaleString()}
                        </span>
                        <span className="text-xs font-bold text-slate-400">ຊິ້ນ</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        ຈຳນວນທີ່ຄາດວ່າເຫຼືອຕົວຈິງ (Stock - Sold)
                    </p>
                </div>

                {/* 4. Sell-Through Rate */}
                <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border border-purple-200/80 dark:border-purple-900/40 rounded-2xl p-3">
                    <div className="flex items-center justify-between text-purple-600 dark:text-purple-400 mb-0.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider">ອັດຕາການຂາຍ (Sell-Through)</span>
                        <Sparkles size={15} />
                    </div>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-black text-purple-600 dark:text-purple-400">
                            {summary.totalInitialQty > 0
                                ? ((summary.totalSoldQty / summary.totalInitialQty) * 100).toFixed(1)
                                : '0.0'}%
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                        ເປີເຊັນຂາຍອອກທຽບກັບສິນຄ້າທີ່ຂົນໄປ
                    </p>
                </div>
            </div>

            {(error || nameWarning) && (
                <div className="shrink-0 mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle size={15} className="shrink-0" />
                    <span>{error || nameWarning}</span>
                </div>
            )}

            {/* Search & Filter Buttons */}
            <div className="shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 mb-3">
                <div className="relative flex-1 max-w-md">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        id="event-stock-search"
                        type="text"
                        placeholder="ຄົ້ນຫາ Barcode ຫຼື ຊື່ສິນຄ້າ..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-1.5 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:border-orange-500 transition-all"
                    />
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                        { key: 'ALL', label: 'ທັງໝົດ' },
                        { key: 'SOLD', label: 'ມີຍອດຂາຍ' },
                        { key: 'UNSOLD', label: 'ຍັງບໍ່ໄດ້ຂາຍ' },
                        { key: 'SOLD_OUT', label: 'ຂາຍໝົດ' },
                        { key: 'OVER_SOLD', label: 'ຂາຍເກີນ ⚠️' }
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStatusFilter(f.key)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${statusFilter === f.key
                                    ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table (Scrollable Body with sticky header) */}
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-inner">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] font-black uppercase tracking-wider shadow-sm">
                        <tr>
                            <th className="py-2.5 px-3 text-center w-12 bg-slate-100 dark:bg-slate-800">#</th>
                            <th className="py-2.5 px-3 bg-slate-100 dark:bg-slate-800">Barcode</th>
                            <th className="py-2.5 px-4 bg-slate-100 dark:bg-slate-800 cursor-pointer select-none" onClick={() => toggleSort('item_name')}>
                                <div className="flex items-center gap-1">
                                    <span>ຊື່ສິນຄ້າ</span>
                                    <ArrowUpDown size={11} className="text-slate-400" />
                                </div>
                            </th>
                            <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800 cursor-pointer select-none" onClick={() => toggleSort('stock_qty')}>
                                <div className="flex items-center justify-end gap-1">
                                    <span>ສະຕັອກຕົ້ນທາງ (kolao-sq)</span>
                                    <ArrowUpDown size={11} className="text-slate-400" />
                                </div>
                            </th>
                            <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800 cursor-pointer select-none" onClick={() => toggleSort('sold_qty')}>
                                <div className="flex items-center justify-end gap-1">
                                    <span>ຂາຍແລ້ວ (Joah EVENT)</span>
                                    <ArrowUpDown size={11} className="text-slate-400" />
                                </div>
                            </th>
                            <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800 cursor-pointer select-none" onClick={() => toggleSort('remaining_qty')}>
                                <div className="flex items-center justify-end gap-1">
                                    <span>ຄົງເຫຼືອຈຳລອງ</span>
                                    <ArrowUpDown size={11} className="text-slate-400" />
                                </div>
                            </th>
                            <th className="py-2.5 px-3 text-right bg-slate-100 dark:bg-slate-800">ຍອດເງິນ (KIP)</th>
                            <th className="py-2.5 px-3 text-center bg-slate-100 dark:bg-slate-800">ສະຖານະ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                        {loading ? (
                            <tr><td colSpan={8} className="py-16 text-center text-slate-400">
                                <RefreshCw size={22} className="animate-spin text-orange-500 mx-auto mb-2" />
                                ກຳລັງດຶງຂໍ້ມູນສະຕັອກ ແລະ ຍອດຂາຍ Joah EVENT...
                            </td></tr>
                        ) : mergedList.length === 0 ? (
                            <tr><td colSpan={8} className="py-16 text-center text-slate-400">ບໍ່ພົບຂໍ້ມູນ</td></tr>
                        ) : mergedList.map((r, i) => {
                            const isOverSold = r.remaining_qty < 0;
                            const isSoldOut = r.stock_qty > 0 && r.remaining_qty === 0;
                            const isUnsold = r.stock_qty > 0 && r.sold_qty === 0;

                            return (
                                <tr key={r.barcode} className={`hover:bg-orange-50/50 dark:hover:bg-slate-800/50 transition-colors ${isOverSold ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                                    }`}>
                                    <td className="py-2.5 px-3 text-center text-xs text-slate-400">{i + 1}</td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-200">{r.barcode}</td>
                                    <td className="py-2.5 px-4 font-semibold text-slate-800 dark:text-slate-100">
                                        {r.item_name || <span className="text-slate-400 italic font-normal">— ບໍ່ມີຊື່ —</span>}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black text-slate-800 dark:text-white">
                                        {r.stock_qty.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-black text-emerald-600 dark:text-emerald-400">
                                        {r.sold_qty > 0 ? r.sold_qty.toLocaleString() : '-'}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-black ${isOverSold
                                            ? 'text-rose-600 dark:text-rose-400'
                                            : isSoldOut
                                                ? 'text-slate-400'
                                                : 'text-amber-600 dark:text-amber-400'
                                        }`}>
                                        {r.remaining_qty.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-semibold text-slate-600 dark:text-slate-300">
                                        {r.revenue > 0 ? Number(r.revenue).toLocaleString() : '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                        {isOverSold ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-200">
                                                ຂາຍເກີນສະຕັອກ
                                            </span>
                                        ) : isSoldOut ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200">
                                                ຂາຍໝົດພໍດີ
                                            </span>
                                        ) : isUnsold ? (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                                                ຍັງບໍ່ໄດ້ຂາຍ
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                                                ຂາຍບາງສ່ວນ
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Bottom summary bar */}
            <div className="shrink-0 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2.5 px-1 gap-2">
                <span>
                    ສະແດງທັງໝົດ <span className="font-bold text-slate-700 dark:text-slate-200">{mergedList.length}</span> ລາຍການ
                </span>
                <span className="font-mono text-[11px]">
                    rack_location: {EVENT_RACK} · branch_id: {EVENT_BRANCH} · POS: Joah EVENT
                </span>
            </div>
        </div>
    );
}


