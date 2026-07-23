import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Search, History, ShoppingCart, Package, Truck,
    AlertTriangle, CheckCircle2, FileSpreadsheet, User,
    Clock, ArrowDownRight, ArrowUpRight, RefreshCw, Calendar, Sparkles, Filter, Building2, Maximize2
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { supabase } from '../../utils/supabaseClient';
import { useLowStock } from '../../contexts/LowStockContext';

export default function SkuTimelineModal({ barcode, itemName, currentBranch: propsBranch, isOpen, onClose }) {
    const { viewingBranch } = useLowStock();
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all'); // 'all', 'sales', 'refill', 'wh_edit', 'request'
    const [events, setEvents] = useState([]);
    const [summary, setSummary] = useState({
        storeQty: 0,
        warehouseQty: 0,
        dcQty: 0,
        totalSold: 0,
        totalRefilled: 0,
        firstDate: null,
        lastDate: null,
    });

    // ✅ viewingBranch = สาขาที่ StoreResultTable ตั้งไว้ตอนโหลดข้อมูล (ไม่ใช่ login branch)
    // propsBranch = ถ้ามีการส่งมาโดยตรง (override) เท่านั้น
    const activeBranch = useMemo(() => {
        return viewingBranch || propsBranch || localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ';
    }, [propsBranch, viewingBranch]);

    const activeBarcode = useMemo(() => String(barcode || searchTerm || '').trim(), [barcode, searchTerm]);

    useEffect(() => {
        if (!isOpen || !activeBarcode) return;

        let isMounted = true;
        const fetchTimelineData = async () => {
            setIsLoading(true);
            try {
                const targetBc = activeBarcode;
                const branchFilter = activeBranch && activeBranch !== 'All Branches' ? activeBranch : null;

                // 1. Fetch Sales Logs from Odoo Sync Details (Branch filter via log_id)
                // ✅ Pattern from StoreSalesLogModal.jsx: fetch log IDs for this branch first
                const { data: branchLogs } = await supabase
                    .from('odoo_sync_logs')
                    .select('id, sync_completed_at')
                    .eq('branch_id', branchFilter || activeBranch)
                    .order('id', { ascending: false })
                    .limit(100);

                const branchLogIds = (branchLogs || []).map(l => l.id);
                const branchLogDateMap = {};
                (branchLogs || []).forEach(l => { branchLogDateMap[l.id] = l.sync_completed_at; });

                let salesQuery = supabase
                    .from('odoo_sync_details')
                    .select('id, barcode_no, item_name, qty_sold, log_id')
                    .eq('barcode_no', targetBc)
                    .order('id', { ascending: false })
                    .limit(200);

                if (branchLogIds.length > 0) {
                    salesQuery = salesQuery.in('log_id', branchLogIds);
                }

                // 2. Fetch Store Inventory History
                // ✅ store_inventory_history HAS branch_id (confirmed from HQCommandCenter)
                let storeHistoryQuery = supabase
                    .from('store_inventory_history')
                    .select('id, barcode_no, item_name, old_store_qty, new_store_qty, updated_by, updated_at, created_at, branch_id, action_type, change_reason')
                    .eq('barcode_no', targetBc)
                    .order('updated_at', { ascending: false })
                    .limit(100);

                if (branchFilter) {
                    storeHistoryQuery = storeHistoryQuery.eq('branch_id', branchFilter);
                }

                // 3. Fetch Warehouse Inventory History
                // ✅ inventory_history does NOT have branch_id (HQCommandCenter fetches all, no branch filter)
                let whHistoryQuery = supabase
                    .from('inventory_history')
                    .select('id, barcode, barcode_no, item_name, old_qty, new_qty, updated_by, updated_at, created_at, details, branch_id')
                    .or(`barcode.eq.${targetBc},barcode_no.eq.${targetBc}`)
                    .order('updated_at', { ascending: false })
                    .limit(100);
                // No branch_id filter — column may not exist; filter in JS below

                // 4. Fetch Store Requests
                // ✅ store_requests HAS branch_id (confirmed from HQCommandCenter)
                let requestsQuery = supabase
                    .from('store_requests')
                    .select('id, branch_id, status, created_at, updated_at, request_by, accepted_by, product_name, barcode, qty, batch_id, stock_at_request')
                    .eq('barcode', targetBc)
                    .order('created_at', { ascending: false })
                    .limit(100);

                if (branchFilter) {
                    requestsQuery = requestsQuery.eq('branch_id', branchFilter);
                }

                // 5. Fetch DC Log Imports
                // ✅ store_dc_log does NOT have branch_id — filter in JS below
                let dcHistoryQuery = supabase
                    .from('store_dc_log')
                    .select('id, barcode_no, item_name, imported_qty, imported_by, import_date, branch_id')
                    .or(`barcode_no.eq.${targetBc},barcode.eq.${targetBc}`)
                    .order('import_date', { ascending: false })
                    .limit(100);
                // No branch_id filter — column may not exist; filter in JS below

                // 6. Fetch Current Live Stock
                // ✅ store_inventory HAS branch_id (confirmed from DcStockImporter)
                let liveStoreQuery = supabase
                    .from('store_inventory')
                    .select('store_qty, max_qty, rack_location, branch_id')
                    .eq('barcode_no', targetBc);

                if (branchFilter) {
                    liveStoreQuery = liveStoreQuery.eq('branch_id', branchFilter);
                }

                let liveDcQuery = supabase
                    .from('table_dc_stock')
                    .select('qty, branch_id')
                    .eq('barcode', targetBc);

                if (branchFilter) {
                    liveDcQuery = liveDcQuery.eq('branch_id', branchFilter);
                }

                const [
                    { data: salesRaw, error: salesErr },
                    { data: storeData, error: storeErr },
                    { data: whDataRaw, error: whErr },
                    { data: reqData, error: reqErr },
                    { data: dcDataRaw, error: dcErr },
                    { data: liveStoreList },
                    { data: liveDcList }
                ] = await Promise.all([
                    salesQuery,
                    storeHistoryQuery,
                    whHistoryQuery,
                    requestsQuery,
                    dcHistoryQuery,
                    liveStoreQuery,
                    liveDcQuery
                ]);

                // Client-side branch filter for tables without branch_id column
                const salesData = (salesRaw || []).map(s => ({
                    ...s,
                    _syncTime: branchLogDateMap[s.log_id] || null,
                }));

                const whData = branchFilter
                    ? (whDataRaw || []).filter(r => !r.branch_id || r.branch_id === branchFilter)
                    : (whDataRaw || []);

                const dcData = branchFilter
                    ? (dcDataRaw || []).filter(r => !r.branch_id || r.branch_id === branchFilter)
                    : (dcDataRaw || []);

                if (salesErr) console.warn('Sales fetch warning:', salesErr);
                if (storeErr) console.warn('Store history fetch warning:', storeErr);
                if (whErr) console.warn('WH history fetch warning:', whErr);
                if (reqErr) console.warn('Request fetch warning:', reqErr);
                if (dcErr) console.warn('DC fetch warning:', dcErr);


                if (!isMounted) return;

                const liveStore = Array.isArray(liveStoreList) && liveStoreList.length > 0 ? liveStoreList[0] : null;
                const liveDc = Array.isArray(liveDcList) && liveDcList.length > 0 ? liveDcList[0] : null;

                const timeline = [];
                let totalSoldAcc = 0;
                let totalRefilledAcc = 0;

                // Process Sales Events (from odoo_sync_details)
                (salesData || []).forEach(s => {
                    const qty = Number(s.qty_sold || 0);
                    totalSoldAcc += qty;
                    const eventTime = s._syncTime || new Date().toISOString();
                    timeline.push({
                        id: `sale-${s.id}`,
                        timestamp: new Date(eventTime).getTime(),
                        timeStr: eventTime,
                        type: 'sale',
                        category: 'sales',
                        titleLao: '🛒 ຍອດຂາຍ POS (Odoo Sales)',
                        delta: -qty,
                        details: `ຂາຍອອກ: ${qty} ຊິ້ນ | ສາຂາ: ${activeBranch}`,
                        actor: 'POS System',
                        badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                        icon: ShoppingCart,
                    });
                });

                // Process Store Refill / History Events (from store_inventory_history)
                (storeData || []).forEach(sh => {
                    const oldQ = Number(sh.old_store_qty ?? sh.old_qty ?? 0);
                    const newQ = Number(sh.new_store_qty ?? sh.new_qty ?? 0);
                    const diff = newQ - oldQ;
                    if (diff > 0) totalRefilledAcc += diff;

                    const eventTime = sh.updated_at || sh.created_at;
                    timeline.push({
                        id: `store-${sh.id}`,
                        timestamp: new Date(eventTime).getTime(),
                        timeStr: eventTime,
                        type: diff >= 0 ? 'refill' : 'store_edit',
                        category: diff >= 0 ? 'refill' : 'wh_edit',
                        titleLao: diff >= 0 ? '📦 ເຕີມສິນຄ້າໜ້າຮ້ານ' : '✏️ ແກ້ໄຂສະຕ໋ອກໜ້າຮ້ານ',
                        delta: diff,
                        details: `ປ່ຽນຈາກ: ${oldQ} ➔ ${newQ} ຊິ້ນ (${diff >= 0 ? `+${diff}` : diff}) | ເຫດຜົນ: ${sh.change_reason || sh.reason || 'ເຕີມ/ແກ້ໄຂ'}`,
                        actor: sh.updated_by || 'ພະນັກງານ',
                        badgeColor: diff >= 0
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                        icon: Package,
                    });
                });

                // Process Warehouse History Events (from inventory_history)
                (whData || []).forEach(wh => {
                    const oldQ = Number(wh.old_qty || 0);
                    const newQ = Number(wh.new_qty || 0);
                    const diff = newQ - oldQ;
                    const eventTime = wh.updated_at || wh.created_at;
                    timeline.push({
                        id: `wh-${wh.id}`,
                        timestamp: new Date(eventTime).getTime(),
                        timeStr: eventTime,
                        type: 'wh_edit',
                        category: 'wh_edit',
                        titleLao: '🏭 ແກ້ໄຂສະຕ໋ອກຫຼັງສາງ',
                        delta: diff,
                        details: `ປັບຈາກ: ${oldQ} ➔ ${newQ} ຊິ້ນ | ເຫດຜົນ: ${wh.details || wh.change_reason || wh.reason || 'ປັບສະຕ໋ອກຫຼັງສາງ'}`,
                        actor: wh.updated_by || 'ພະນັກງານສາງ',
                        badgeColor: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
                        icon: History,
                    });
                });

                // Process Request Events (from store_requests)
                (reqData || []).forEach(r => {
                    const eventTime = r.created_at;
                    timeline.push({
                        id: `req-${r.id}`,
                        timestamp: new Date(eventTime).getTime(),
                        timeStr: eventTime,
                        type: 'request',
                        category: 'request',
                        titleLao: `📋 ໃບຂໍເບີກ Request DC (${r.status || 'Pending'})`,
                        delta: Number(r.qty || 0),
                        details: `ຈຳນວນຂໍເບີກ: ${r.qty} ຊິ້ນ | ບິນ: ${r.batch_id || r.doc_no || '-'} | ຢືນຢັນແລ້ວ: ${r.store_confirmed_at ? 'ແມ່ນ' : 'ຍັງບໍ່ຢືນຢັນ'}`,
                        actor: r.request_by || r.requested_by || 'ພະນັກງານໜ້າຮ້ານ',
                        badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
                        icon: FileSpreadsheet,
                    });
                });

                // Process DC Import Events (from store_dc_log)
                (dcData || []).forEach(dc => {
                    const eventTime = dc.import_date || dc.created_at;
                    const qty = Number(dc.imported_qty || dc.qty_dc || 0);
                    timeline.push({
                        id: `dc-${dc.id}`,
                        timestamp: new Date(eventTime).getTime(),
                        timeStr: eventTime,
                        type: 'dc_import',
                        category: 'wh_edit',
                        titleLao: '🚚 ນຳເຂົ້າສະຕ໋ອກ DC',
                        delta: qty,
                        details: `ນຳເຂົ້າ DC: +${qty} ຊິ້ນ | ສາຂາ: ${dc.branch_id || '-'}`,
                        actor: dc.imported_by || 'HQ Admin',
                        badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
                        icon: Truck,
                    });
                });

                // Sort timeline descending by timestamp
                timeline.sort((a, b) => b.timestamp - a.timestamp);

                setEvents(timeline);
                setSummary({
                    storeQty: Number(liveStore?.store_qty ?? 0),
                    warehouseQty: Number(liveDc?.qty ?? 0),
                    dcQty: Number(liveDc?.qty ?? 0),
                    totalSold: totalSoldAcc,
                    totalRefilled: totalRefilledAcc,
                    firstDate: timeline.length > 0 ? timeline[timeline.length - 1].timeStr : null,
                    lastDate: timeline.length > 0 ? timeline[0].timeStr : null,
                });

            } catch (err) {
                console.error('Error fetching SKU timeline:', err);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchTimelineData();

        return () => {
            isMounted = false;
        };
    }, [isOpen, activeBarcode, activeBranch]);

    // Lao Language Diagnostic Insights Generator
    const diagnosticInsight = useMemo(() => {
        if (events.length === 0) {
            return {
                severity: 'info',
                titleLao: 'ℹ️ ຍັງບໍ່ມີປະຫວັດການເຄື່ອນໄຫວສິນຄ້ານີ້ໃນສາຂານີ້',
                desc: `ບາໂຄ້ດນີ້ຍັງບໍ່ມີລາຍການຍິງຂາຍ POS ຫຼື ກົດເຕີມສິນຄ້າໜ້າຮ້ານໃນສາຂາ ${activeBranch}`
            };
        }

        const storeQ = summary.storeQty;
        const totalSales = summary.totalSold;
        const totalRefill = summary.totalRefilled;

        if (storeQ < 0) {
            if (totalRefill === 0 && totalSales > 0) {
                return {
                    severity: 'danger',
                    titleLao: '🚨 ສາເຫດສະຕ໋ອກຕິດລົບ: ຂາຍ POS ອອກໄປໂດຍຍັງບໍ່ໄດ້ກົດເຕີມ/ຮັບສິນຄ້າເຂົ້າໜ້າຮ້ານ',
                    desc: `ພົບຍອດຂາຍລວມ ${totalSales} ຊິ້ນ ແຕ່ໃນລະບົບບໍ່ມີປະຫວັດການກົດເຕີມໜ້າຮ້ານ (+0 ຊິ້ນ) ➔ ພະນັກງານນຳຂອງໄປວາງຂາຍໜ້າຮ້ານໂດຍລືມກົດຄີຮັບເຂົ້າໃນລະບົບ`
                };
            }
            if (totalSales > totalRefill && totalRefill > 0) {
                return {
                    severity: 'danger',
                    titleLao: '🚨 ສາເຫດສະຕ໋ອກຕິດລົບ: ຍອດຂາຍສູງກວ່າຈຳນວນທີ່ເຕີມຈາກຫຼັງສາງ',
                    desc: `ເຕີມເຂົ້າລະບົບລວມ ${totalRefill} ຊິ້ນ ແຕ່ຍິງຂາຍ POS ອອກໄປເຖິງ ${totalSales} ຊິ້ນ ➔ ອາດມີການຍິງບາໂຄ້ດຜິດໂຕຕອນຄິດເງິນ ຫຼື ເຕີມຂອງຈິງເກີນຈາກທີ່ລົງບັນທຶກໄວ້`
                };
            }
            return {
                severity: 'danger',
                titleLao: '🚨 ສາເຫດສະຕ໋ອກຕິດລົບ: ຍອດຂາຍເກີນສະຕ໋ອກ',
                desc: `ສະຕ໋ອກໜ້າຮ້ານເປັນ ${storeQ} ຊິ້ນ ກະລຸນາກວດສອບບາໂຄ້ດ ແລະ ທຳການນັບສະຕ໋ອກຈິງໜ້າຮ້ານ`
            };
        }

        return {
            severity: 'success',
            titleLao: '✅ ສະຖານະສະຕ໋ອກປົກກະຕິ',
            desc: `ສະຕ໋ອກໜ້າຮ້ານປັດຈຸບັນ: ${storeQ} ຊິ້ນ | ຂາຍລວມ: ${totalSales} ຊິ້ນ | ເຕີມລວມ: ${totalRefill} ຊິ້ນ`
        };
    }, [events.length, summary, activeBranch]);

    const filteredEvents = useMemo(() => {
        return events.filter(e => {
            if (filterType === 'all') return true;
            return e.category === filterType;
        });
    }, [events, filterType]);

    const exportTimelineToExcel = async () => {
        if (events.length === 0) return;

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet('SKU Movement Timeline');

        ws.columns = [
            { header: 'ວັນທີ-ເວລາ (Date-Time)', key: 'timeStr', width: 22 },
            { header: 'ປະເພດລາຍການ (Event Type)', key: 'title', width: 35 },
            { header: 'ຈຳນວນປ່ຽນແປງ (Delta)', key: 'delta', width: 18 },
            { header: 'ລາຍລະອຽດ (Details)', key: 'details', width: 45 },
            { header: 'ຜູ້ດຳເນີນການ (Actor)', key: 'actor', width: 22 },
        ];

        events.forEach(e => {
            ws.addRow({
                timeStr: new Date(e.timeStr).toLocaleString('lo-LA'),
                title: e.titleLao,
                delta: e.delta,
                details: e.details,
                actor: e.actor,
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(blob, `SKU_Timeline_${activeBranch}_${activeBarcode}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100000] w-screen h-screen bg-slate-950/90 backdrop-blur-md flex flex-col animate-in fade-in duration-200 p-0 sm:p-2 overflow-hidden">
            <div className="relative w-full h-full bg-white dark:bg-slate-900 sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
                
                {/* Header Bar (Full Screen Enterprise ERP Style) */}
                <div className="bg-slate-900 text-white p-4 shrink-0 border-b border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-500/20 text-blue-400 rounded-2xl border border-blue-500/30 shrink-0">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-extrabold text-lg sm:text-xl leading-tight flex items-center gap-2">
                                    <span>🔍 ປະຫວັດການເຄື່ອນໄຫວສິນຄ້າ (SKU 360° Timeline)</span>
                                </h3>
                                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1 flex-wrap">
                                    <span>ບາໂຄ້ດ: <strong className="text-blue-400 font-bold">{activeBarcode || 'N/A'}</strong></span>
                                    {itemName && <span>| ຊື່ສິນຄ້າ: <strong className="text-slate-200 font-sans">{itemName}</strong></span>}
                                    <span className="flex items-center gap-1 text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded border border-amber-800/40">
                                        <Building2 className="w-3 h-3" /> ສາຂາ: <strong>{activeBranch}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={exportTimelineToExcel}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                                title="Export Timeline Excel"
                            >
                                <FileSpreadsheet className="w-4 h-4" />
                                <span>Export Excel</span>
                            </button>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
                                title="ປິດໜ້າຕ່າງ"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Stock KPI Summary Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-3.5 pt-3 border-t border-slate-800 text-center text-xs">
                        <div className={`p-2.5 rounded-2xl border ${summary.storeQty < 0 ? 'bg-rose-950/50 border-rose-800/80 text-rose-300' : 'bg-slate-800/70 border-slate-700 text-slate-200'}`}>
                            <span className="text-[11px] block opacity-70 mb-0.5">ໜ້າຮ້ານ (Store)</span>
                            <span className="font-extrabold text-base sm:text-lg">{summary.storeQty} ຊິ້ນ</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700 text-slate-200">
                            <span className="text-[11px] block opacity-70 mb-0.5">ຫຼັງສາງ / DC</span>
                            <span className="font-extrabold text-base sm:text-lg text-cyan-400">{summary.warehouseQty} ຊິ້ນ</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700 text-slate-200">
                            <span className="text-[11px] block opacity-70 mb-0.5">ຍອດຂາຍລວມ (POS)</span>
                            <span className="font-extrabold text-base sm:text-lg text-rose-400">-{summary.totalSold} ຊິ້ນ</span>
                        </div>
                        <div className="p-2.5 rounded-2xl bg-slate-800/70 border border-slate-700 text-slate-200">
                            <span className="text-[11px] block opacity-70 mb-0.5">ຍອດເຕີມລວມ (Refill)</span>
                            <span className="font-extrabold text-base sm:text-lg text-emerald-400">+{summary.totalRefilled} ຊິ້ນ</span>
                        </div>
                    </div>
                </div>

                {/* Auto Diagnostic Insight Banner (Lao Language) */}
                <div className="p-3.5 shrink-0 bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
                    <div className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                        diagnosticInsight.severity === 'danger'
                            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/70 text-rose-900 dark:text-rose-200 shadow-sm'
                            : diagnosticInsight.severity === 'success'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/70 text-emerald-900 dark:text-emerald-200 shadow-sm'
                            : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/70 text-blue-900 dark:text-blue-200 shadow-sm'
                    }`}>
                        <div className="font-extrabold text-sm mb-1">{diagnosticInsight.titleLao}</div>
                        <div className="opacity-90">{diagnosticInsight.desc}</div>
                    </div>

                    {/* Filter Type Pills (Lao Language) */}
                    <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-0.5">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 flex items-center gap-1">
                            <Filter className="w-3.5 h-3.5" /> ຕົວຕອງ:
                        </span>
                        {[
                            { id: 'all', label: 'ທັງໝົດ' },
                            { id: 'sales', label: '🛒 ຍອດຂາຍ POS' },
                            { id: 'refill', label: '📦 ການເຕີມໜ້າຮ້ານ' },
                            { id: 'wh_edit', label: '🏭 ສາງ / DC' },
                            { id: 'request', label: '📋 ໃບຂໍເບີກ Request' },
                        ].map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilterType(f.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors ${
                                    filterType === f.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body Timeline Feed */}
                <div className="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1 bg-slate-50 dark:bg-slate-950/40">
                    {isLoading ? (
                        <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                            <span className="text-sm font-bold">ກຳລັງໂຫຼດຂໍ້ມູນປະຫວັດ SKU ຈາກ Cloud...</span>
                        </div>
                    ) : filteredEvents.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-sm font-bold">
                            ບໍ່ພົບປະຫວັດການເຄື່ອນໄຫວຂອງບາໂຄ້ດນີ້ໃນສາຂາ {activeBranch}
                        </div>
                    ) : (
                        filteredEvents.map((evt, idx) => {
                            const IconComp = evt.icon;
                            return (
                                <div
                                    key={evt.id || idx}
                                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-3.5">
                                            <div className={`p-2.5 rounded-2xl border shrink-0 ${evt.badgeColor}`}>
                                                <IconComp className="w-5 h-5" />
                                            </div>

                                            <div>
                                                <div className="font-extrabold text-sm sm:text-base text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                                    <span>{evt.titleLao}</span>
                                                </div>
                                                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1">
                                                    {evt.details}
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
                                                    <span className="flex items-center gap-1 font-mono">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        {new Date(evt.timeStr).toLocaleString('lo-LA')}
                                                    </span>
                                                    <span className="flex items-center gap-1 font-bold text-slate-500 dark:text-slate-400">
                                                        <User className="w-3.5 h-3.5" />
                                                        {evt.actor}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Delta Pill */}
                                        <div className={`shrink-0 px-3 py-1.5 rounded-xl text-sm font-black font-mono border ${
                                            evt.delta > 0
                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                                : evt.delta < 0
                                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20'
                                        }`}>
                                            {evt.delta > 0 ? `+${evt.delta}` : evt.delta}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer Action Bar */}
                <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>ສະແດງທັງໝົດ: {filteredEvents.length} ລາຍການ (ສາຂາ: {activeBranch})</span>
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-extrabold rounded-xl transition-colors"
                    >
                        ປິດໜ້າຕ່າງ
                    </button>
                </div>

            </div>
        </div>,
        document.body
    );
}
