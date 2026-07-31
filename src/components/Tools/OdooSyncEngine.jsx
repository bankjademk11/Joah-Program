import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { authenticate, fetchSyncDeltaSales, fetchProductBarcodes } from '../../services/odooApi';
import { RefreshCw, Play, AlertCircle, CheckCircle, Database, History, Package, Download, Search, LayoutList, ArrowRight, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function OdooSyncEngine({ onBack, userBranch, isAdmin }) {
    const [activeTab, setActiveTab] = useState('engine'); // 'engine', 'details', 'stock'
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);

    // Data States
    const [logs, setLogs] = useState([]);
    const [detailedLogs, setDetailedLogs] = useState([]);
    const [selectedLogId, setSelectedLogId] = useState(null);
    const [storeStock, setStoreStock] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const BRANCHES = [
        { id: 173, name: 'ໂພນສີນວນ', short: 'PSN' },
        { id: 248, name: 'ສີວິໄລ', short: 'SVL' },
        { id: 249, name: 'ຕະຫຼາດລາວ', short: 'TLL' },
        { id: 8, name: 'ວັງຊາຍ', short: 'VX' },
        { id: 273, name: 'ປະຕູໄຊ', short: 'PTX' },
    ];

    const [selectedBranchId, setSelectedBranchId] = useState(
        isAdmin ? 249 : (BRANCHES.find(b => b.name === userBranch)?.id || 249)
    );
    const selectedBranch = BRANCHES.find(b => b.id === selectedBranchId) || BRANCHES[2];

    useEffect(() => {
        if (activeTab === 'engine') loadLogs();
        if (activeTab === 'details') loadDetailedLogs();
        if (activeTab === 'stock') loadStoreStock();
    }, [activeTab, selectedBranchId]);

    // -----------------------------------------
    // DATA FETCHING
    // -----------------------------------------
    const loadLogs = async () => {
        const { data, error } = await supabase
            .from('odoo_sync_logs')
            .select('*')
            .eq('branch_id', selectedBranch.name)
            .order('sync_started_at', { ascending: false })
            .limit(10);
        if (!error && data) setLogs(data);
    };

    const loadDetailedLogs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('odoo_sync_details')
            .select('*, odoo_sync_logs(sync_completed_at)')
            .order('id', { ascending: false })
            .limit(1000);
        if (!error && data) setDetailedLogs(data);
        setLoading(false);
    };

    const loadStoreStock = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('store_inventory')
            .select('*')
            .eq('branch_id', selectedBranch.name)
            .order('store_qty', { ascending: true }) // สินค้าที่เหลือน้อยสุดขึ้นก่อน
            .limit(1000);
        if (!error && data) setStoreStock(data);
        setLoading(false);
    };

    // -----------------------------------------
    // ENGINE LOGIC
    // -----------------------------------------
    const splitProduct = (productStr) => {
        if (!productStr) return { barcode: '-', name: '-' };
        const match = productStr.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) return { barcode: match[1], name: match[2] };
        return { barcode: '-', name: productStr };
    };

    const handleRunSync = async () => {
        if (!confirm(`ຢືນຢັນການເລີ່ມດຶງຍອດຂາຍຈາກ Odoo ມາຫັກສະຕັອກໃນຕາຕະລາງຈິງ (store_inventory: ${selectedBranch.name})?`)) return;

        setLoading(true);
        setStatus({ type: 'info', message: '1. ກຳລັງເຊື່ອມຕໍ່ Odoo...' });

        try {
            await authenticate(import.meta.env.VITE_ODOO_DB, import.meta.env.VITE_ODOO_USER, import.meta.env.VITE_ODOO_PASSWORD);

            let lastProcessedId = null;
            if (logs.length > 0 && logs[0].status === 'success' && logs[0].last_processed_id) {
                lastProcessedId = logs[0].last_processed_id;
                setStatus({ type: 'info', message: `2. ກຳລັງດຶງຍອດຂາຍຂອງ "ມື້ນີ້" ທີ່ ID > ${lastProcessedId}...` });
            } else {
                setStatus({ type: 'info', message: `2. ກຳລັງດຶງຍອດຂາຍຂອງ "ມື້ນີ້" (ຕັ້ງແຕ່ທ່ຽງຄືນ)...` });
            }

            console.log('🔍 === SYNC DEBUG INFO ===');
            console.log('🔍 Branch ID:', selectedBranch.id);
            console.log('🔍 Last Processed ID:', lastProcessedId);

            const odooSales = await fetchSyncDeltaSales(selectedBranch.id, lastProcessedId);

            console.log('🔍 Odoo Sales Result Count:', odooSales.length);
            if (odooSales.length > 0) {
                console.log('🔍 First 3 items:', odooSales.slice(0, 3));
                console.log('🔍 Last item (highest ID):', odooSales[odooSales.length - 1]);
            }
            console.log('🔍 === END DEBUG ===');

            if (odooSales.length === 0) {
                setStatus({ type: 'warning', message: `⚠️ ບໍ່ພົບຍອດຂາຍໃໝ່ (Up to date!) | ກະລຸນາກວດສອບ Console (F12)` });
                setLoading(false);
                return;
            }

            // Find the maximum ID in this batch to save for next time
            const newMaxId = Math.max(...odooSales.map(item => item.id));

            setStatus({ type: 'info', message: '3. ກຳລັງດຶງຂໍ້ມູນ Barcode EAN13 ຈາກ Odoo...' });

            // Extract unique product IDs to fetch their real EAN13 barcodes
            const productIds = [...new Set(odooSales.map(item => item.product_id[0]))];
            const barcodeMap = await fetchProductBarcodes(productIds);

            const salesSummary = {};
            let skippedNoBarcodeCount = 0;
            odooSales.forEach(item => {
                const productId = item.product_id[0];
                const realBarcode = barcodeMap[productId];
                const rawName = item.product_id[1];
                const { name } = splitProduct(rawName); // We still split to clean the name

                if (realBarcode) {
                    // Save the rawName so we keep the [OdooRef] in the DB
                    if (!salesSummary[realBarcode]) salesSummary[realBarcode] = { barcode: realBarcode, name: rawName, qty_sold: 0 };
                    salesSummary[realBarcode].qty_sold += item.qty;
                } else {
                    skippedNoBarcodeCount++;
                }
            });

            const uniqueBarcodes = Object.keys(salesSummary);

            console.log('🔍 === BARCODE DEBUG ===');
            console.log('🔍 Odoo items skipped (no EAN13 barcode):', skippedNoBarcodeCount);
            console.log('🔍 Unique EAN13 barcodes extracted:', uniqueBarcodes.length);
            console.log('🔍 Sample EAN13 barcodes from Odoo:', uniqueBarcodes.slice(0, 10));

            setStatus({ type: 'info', message: `4. ພົບຍອດຂາຍ ${uniqueBarcodes.length} SKU ກຳລັງດຶງຂໍ້ມູນຄັງ...` });

            const { data: storeItems, error: fetchErr } = await supabase
                .from('store_inventory')
                .select('*')
                .eq('branch_id', selectedBranch.name)
                .in('barcode_no', uniqueBarcodes);

            if (fetchErr) throw fetchErr;

            console.log('🔍 Store items matched:', storeItems?.length || 0);
            if (storeItems && storeItems.length > 0) {
                console.log('🔍 Sample store barcodes:', storeItems.slice(0, 5).map(s => s.barcode_no));
            }
            console.log('🔍 === END BARCODE DEBUG ===');

            setStatus({ type: 'info', message: '5. ກຳລັງຄຳນວນແລະອັບເດດສະຕັອກ (Cascade Deduct)...' });

            let totalQtyDeducted = 0;
            const syncDetails = [];
            const updatePromises = [];

            // Group store items by barcode
            const storeItemsByBarcode = {};
            (storeItems || []).forEach(item => {
                if (!storeItemsByBarcode[item.barcode_no]) {
                    storeItemsByBarcode[item.barcode_no] = [];
                }
                storeItemsByBarcode[item.barcode_no].push(item);
            });

            uniqueBarcodes.forEach(barcode => {
                const sold = salesSummary[barcode];
                let remainingToDeduct = sold.qty_sold;
                
                const rowsForBarcode = storeItemsByBarcode[barcode] || [];
                // Sort rows by store_qty DESC (largest rack first)
                rowsForBarcode.sort((a, b) => (b.store_qty || 0) - (a.store_qty || 0));

                let totalOldQty = rowsForBarcode.reduce((sum, r) => sum + (r.store_qty || 0), 0);

                if (rowsForBarcode.length > 0) {
                    for (let i = 0; i < rowsForBarcode.length; i++) {
                        if (remainingToDeduct <= 0) break;
                        
                        const row = rowsForBarcode[i];
                        const rowQty = row.store_qty || 0;
                        
                        // If it's the LAST row, and we still have to deduct, just let it go negative
                        const isLastRow = i === rowsForBarcode.length - 1;
                        
                        let deductFromThis = 0;
                        if (rowQty >= remainingToDeduct || isLastRow) {
                            deductFromThis = remainingToDeduct;
                        } else {
                            deductFromThis = rowQty;
                        }
                        
                        remainingToDeduct -= deductFromThis;
                        const newRowQty = rowQty - deductFromThis;
                        
                        updatePromises.push(
                            supabase.from('store_inventory').update({ 
                                store_qty: newRowQty, 
                                sales_qty: (row.sales_qty || 0) + deductFromThis,
                                last_updated: new Date().toISOString() 
                            }).eq('id', row.id)
                        );
                    }
                    totalQtyDeducted += sold.qty_sold;

                    syncDetails.push({
                        barcode_no: barcode,
                        item_name: sold.name,
                        qty_sold: sold.qty_sold,
                        old_store_qty: totalOldQty,
                        new_store_qty: totalOldQty - sold.qty_sold,
                        status: 'success'
                    });
                } else {
                    // Item not found in store test branch
                    syncDetails.push({
                        barcode_no: barcode,
                        item_name: sold.name,
                        qty_sold: sold.qty_sold,
                        old_store_qty: 0,
                        new_store_qty: 0,
                        status: 'not_found'
                    });
                }
            });

            await Promise.all(updatePromises);
            setStatus({ type: 'info', message: '6. ກຳລັງບັນທຶກປະຫວັດລົງ Database...' });

            const { data: logEntry, error: logErr } = await supabase
                .from('odoo_sync_logs')
                .insert([{
                    sync_started_at: new Date().toISOString(),
                    sync_completed_at: new Date().toISOString(),
                    total_items_sold: uniqueBarcodes.length,
                    total_qty_deducted: totalQtyDeducted,
                    status: 'success',
                    branch_id: selectedBranch.name,
                    last_processed_id: newMaxId
                }])
                .select();

            if (logErr) throw logErr;

            if (logEntry && logEntry[0] && syncDetails.length > 0) {
                const detailsToInsert = syncDetails.map(d => ({ ...d, log_id: logEntry[0].id }));
                await supabase.from('odoo_sync_details').insert(detailsToInsert);
            }

            setStatus({ type: 'success', message: `✅ ສຳເລັດ! ຫັກສະຕັອກໄປທັງໝົດ ${totalQtyDeducted} ຊິ້ນ` });
            loadLogs();

        } catch (error) {
            setStatus({ type: 'error', message: `❌ Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------
    // EXPORT TO EXCEL
    // -----------------------------------------
    const exportHistoryToExcel = () => {
        if (detailedLogs.length === 0) return;
        const exportData = detailedLogs.map(log => ({
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
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sync_History');
        XLSX.writeFile(workbook, `Odoo_Sync_History_${new Date().getTime()}.xlsx`);
    };

    // -----------------------------------------
    // CLEAR LOGS
    // -----------------------------------------
    const handleClearLogs = async () => {
        if (!confirm('⚠️ ຍືນຍັນການລຶບປະຫວັດ? (Clear all sync logs)')) return;
        if (!confirm('ແນ່ໃຈແລ້ວບໍ່? ຂໍ້ມູນປະຫວັດການຊິງຄ໌ທັງໝົດຈະຖືກລຶບຖິ້ມຢ່າງຖາວອນ!')) return;

        setLoading(true);
        setStatus({ type: 'info', message: 'ກຳລັງລຶບຂໍ້ມູນປະຫວັດ...' });

        try {
            // ต้องลบ details ก่อนเพราะมี Foreign Key เชื่อมกับ logs
            const { error: err1 } = await supabase.from('test_pos_sync_details').delete().neq('id', 0);
            if (err1) throw err1;

            const { error: err2 } = await supabase.from('test_pos_sync_logs').delete().neq('id', 0);
            if (err2) throw err2;

            setLogs([]);
            setDetailedLogs([]);
            setStatus({ type: 'success', message: '✅ ລ້າງປະຫວັດທັງໝົດສຳເລັດແລ້ວ! (ລົບ ID ເລີ່ມຕົ້ນໃໝ່)' });
        } catch (error) {
            setStatus({ type: 'error', message: `❌ Error: ${error.message}` });
        } finally {
            setLoading(false);
        }
    };

    // -----------------------------------------
    // RENDER HELPER
    // -----------------------------------------
    const filteredStock = storeStock.filter(item =>
        (item.item_name && item.item_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.barcode_no && item.barcode_no.includes(searchTerm))
    );

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-7xl mx-auto p-6 md:p-8 animate-fade-in-up">

            {/* Header & Tabs */}
            <div className="flex flex-col gap-6 mb-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-md text-slate-500 hover:text-teal-600 border border-slate-200 dark:border-slate-700 text-xl">
                            &larr;
                        </button>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-white flex items-center gap-3">
                                <RefreshCw size={36} className="text-teal-500" /> Automated Sync Center
                            </h1>
                            <p className="text-base text-slate-500 font-semibold mt-1">ລະບົບຄວບຄຸມແລະກວດສອບການຫັກສະຕັອກອັດຕະໂນມັດ</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select 
                            value={selectedBranchId} 
                            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                            className="px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-lg font-black text-teal-700 dark:text-teal-400 outline-none focus:border-teal-500 shadow-sm cursor-pointer"
                        >
                            {BRANCHES.map(b => (
                                <option key={b.id} value={b.id}>{b.name} ({b.short})</option>
                            ))}
                        </select>
                        <button onClick={handleClearLogs} disabled={loading} className="px-6 py-3 text-red-600 hover:bg-red-50 rounded-2xl flex items-center gap-3 text-base font-black border-2 border-red-200 bg-white shadow-md transition-all hover:-translate-y-0.5">
                            <Trash2 size={20} /> ລ້າງປະຫວັດ
                        </button>
                    </div>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-2 rounded-2xl w-full max-w-2xl shadow-inner">
                    <button onClick={() => setActiveTab('engine')} className={`flex-1 py-4 text-lg font-black rounded-xl transition-all flex justify-center items-center gap-3 ${activeTab === 'engine' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Play size={22} /> Sync Engine
                    </button>
                    <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-lg font-black rounded-xl transition-all flex justify-center items-center gap-3 ${activeTab === 'details' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <History size={22} /> History Log
                    </button>
                    <button onClick={() => setActiveTab('stock')} className={`flex-1 py-4 text-lg font-black rounded-xl transition-all flex justify-center items-center gap-3 ${activeTab === 'stock' ? 'bg-white dark:bg-slate-700 text-teal-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>
                        <Database size={22} /> Live Database
                    </button>
                </div>
            </div>

            {/* TAB 1: ENGINE */}
            {activeTab === 'engine' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="md:col-span-1 flex flex-col gap-6">
                        <div className="bg-gradient-to-br from-white to-teal-50/50 dark:bg-slate-800 rounded-3xl p-8 shadow-lg border border-teal-100 dark:border-slate-700 text-center flex flex-col items-center">
                            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-6">
                                <Database size={40} className="text-teal-600" />
                            </div>
                            <h3 className="font-black text-2xl text-slate-800 dark:text-white mb-3">Sync & Deduct</h3>
                            <p className="text-base text-slate-500 mb-8 leading-relaxed">ເລີ່ມດຶງຍອດຂາຍຈາກ Odoo ມາຫັກລົບໃນ Database ແບບ Real-time</p>

                            <button onClick={handleRunSync} disabled={loading} className={`w-full py-5 rounded-2xl font-black text-xl text-white flex justify-center items-center gap-3 shadow-xl transition-all ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 hover:-translate-y-1 hover:shadow-teal-500/40'}`}>
                                {loading ? <RefreshCw className="animate-spin" size={28} /> : <Play size={28} />}
                                {loading ? 'ກຳລັງປະມວນຜົນ...' : 'ເລີ່ມຫັກສະຕັອກດຽວນີ້!'}
                            </button>
                        </div>
                        {status && (
                            <div className={`p-6 rounded-2xl border-2 text-lg font-bold shadow-md ${status.type === 'error' ? 'bg-red-50 border-red-300 text-red-800' : status.type === 'success' ? 'bg-green-50 border-green-300 text-green-800' : 'bg-blue-50 border-blue-300 text-blue-800'}`}>
                                {status.message}
                            </div>
                        )}
                    </div>
                    <div className="md:col-span-2 bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:bg-slate-900/50 flex justify-between items-center">
                            <h3 className="font-black text-xl flex items-center gap-3"><LayoutList size={24} /> ຫົວບິນການຊິງຄ໌ລ່າສຸດ</h3>
                        </div>
                        <div className="flex-1 overflow-auto p-6 space-y-4">
                            {logs.map((log) => (
                                <div
                                    key={log.id}
                                    onClick={() => {
                                        setSelectedLogId(log.id);
                                        setActiveTab('details');
                                    }}
                                    className="flex justify-between items-center p-5 bg-slate-50 hover:bg-teal-50 cursor-pointer rounded-2xl border border-slate-100 shadow-sm transition-all hover:border-teal-200 hover:-translate-y-0.5"
                                >
                                    <div>
                                        <p className="font-black text-lg text-slate-800">{new Date(log.sync_completed_at || log.sync_started_at).toLocaleString('lo-LA')}</p>
                                        <p className="text-base text-slate-500 font-semibold mt-1">ດຶງໄປ <span className="text-teal-600 font-black">{log.total_items_sold}</span> SKU | ລົບໄປ <span className="text-red-500 font-black">{log.total_qty_deducted}</span> ຊິ້ນ</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {log.status === 'success' ? <span className="bg-green-100 text-green-700 px-5 py-2 rounded-full text-base font-black">✅ ສຳເລັດ</span> : <span className="bg-red-100 text-red-700 px-5 py-2 rounded-full text-base font-black">❌ ລົ້ມເຫຼວ</span>}
                                        <ArrowRight className="text-slate-400" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: HISTORY DETAILS */}
            {activeTab === 'details' && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50">
                        <div className="flex items-center gap-4">
                            <h3 className="font-black text-xl text-slate-700 flex items-center gap-3"><History size={24} /> ລາຍລະອຽດການຫັກ (Detailed Logs)</h3>
                            {selectedLogId && (
                                <button onClick={() => setSelectedLogId(null)} className="px-3 py-1 bg-red-100 text-red-600 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors">
                                    ຍົກເລີກການກັ່ນຕອງ &times;
                                </button>
                            )}
                        </div>
                        <button onClick={exportHistoryToExcel} className="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-6 py-3 rounded-xl text-base font-black flex items-center gap-3 transition-colors shadow-sm">
                            <Download size={20} /> Export Excel
                        </button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-base">
                            <thead className="bg-slate-100 sticky top-0 text-slate-600">
                                <tr>
                                    <th className="p-4 font-black text-base">ວັນທີ-ເວລາ</th>
                                    <th className="p-4 font-black text-base">Barcode ໜ້າຮ້ານ</th>
                                    <th className="p-4 font-black text-base">Barcode Odoo</th>
                                    <th className="p-4 font-black text-base">ຊື່ສິນຄ້າ</th>
                                    <th className="p-4 font-black text-base text-right">ຂາຍອອກ</th>
                                    <th className="p-4 font-black text-base text-center">ການປ່ຽນແປງ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {detailedLogs
                                    .filter(log => selectedLogId ? log.log_id === selectedLogId : true)
                                    .map(log => {
                                        const { barcode: odooBarcode, name: cleanName } = splitProduct(log.item_name);
                                        return (
                                            <tr key={log.id} className="hover:bg-slate-50">
                                                <td className="p-4 font-semibold text-slate-600">{log.odoo_sync_logs?.sync_completed_at ? new Date(log.odoo_sync_logs.sync_completed_at).toLocaleString('lo-LA') : ''}</td>
                                                <td className="p-4 font-mono text-sm text-indigo-600 font-black">{log.barcode_no}</td>
                                                <td className="p-4 font-mono text-sm text-orange-600 font-black">{odooBarcode !== '-' ? odooBarcode : 'N/A'}</td>
                                                <td className="p-4 font-bold text-slate-800">{cleanName}</td>
                                                <td className="p-4 text-right font-black text-red-500 text-lg">-{log.qty_sold}</td>
                                                <td className="p-4 text-center flex items-center justify-center gap-3">
                                                    <span className="bg-slate-100 px-4 py-2 rounded-lg font-black text-lg text-slate-500">{log.old_store_qty}</span>
                                                    <ArrowRight size={20} className="text-slate-400" />
                                                    <span className="bg-teal-50 text-teal-600 px-4 py-2 rounded-lg font-black text-lg">{log.new_store_qty}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* TAB 3: LIVE DATABASE */}
            {activeTab === 'stock' && (
                <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col flex-1 overflow-hidden">
                    <div className="p-6 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50">
                        <h3 className="font-black text-xl text-slate-700 flex items-center gap-3"><Database size={24} /> ຖານຂໍ້ມູນຈິງ (store_inventory: ເມກ້າມໍtest)</h3>
                        <div className="relative w-full sm:w-80">
                            <input
                                type="text"
                                placeholder="ຄົ້ນຫາບາໂຄດ ຫຼື ຊື່ສິນຄ້າ..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-base font-semibold outline-none focus:border-teal-500"
                            />
                            <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left text-base">
                            <thead className="bg-slate-100 sticky top-0 text-slate-600">
                                <tr>
                                    <th className="p-4 font-black w-16">#</th>
                                    <th className="p-4 font-black w-48">ບາໂຄດ</th>
                                    <th className="p-4 font-black">ຊື່ສິນຄ້າ</th>
                                    <th className="p-4 font-black text-right">ສະຕັອກຄົງເຫຼືອ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStock.map((item, index) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-4 text-slate-400 font-semibold">{index + 1}</td>
                                        <td className="p-4 font-mono text-sm font-bold">{item.barcode_no}</td>
                                        <td className="p-4 font-bold text-slate-800">{item.item_name}</td>
                                        <td className="p-4 text-right">
                                            <span className={`px-5 py-2 rounded-xl font-black text-lg ${(item.store_qty || 0) < 1000 ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-600'}`}>
                                                {item.store_qty || 0}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

        </div>
    );
}
