import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, Plus, Minus, Send, RotateCw, CheckCircle, Clock, ShoppingCart, Trash2, List, ChevronDown, FileSpreadsheet, ScanLine, X, Camera } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { useLanguage } from '../../../contexts/LanguageContext';
import ExcelJS from 'exceljs';
import soundOK from '../../../assets/RequestOK.mp3';
import soundError from '../../../assets/RequestEror.mp3';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal'; // Import shared component

const StoreRequest = ({ onBack, currentUser, activeBranch }) => {

    const { t } = useLanguage();
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState(null);
    const [qty, setQty] = useState(1);
    const [cart, setCart] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [requestStats, setRequestStats] = useState({ pending: 0, accepted: 0 });
    const [expandedBatchId, setExpandedBatchId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [mobileTab, setMobileTab] = useState('search'); // 'search' | 'cart' | 'history'

    const toast = useToast();
    const barcodeInputRef = useRef(null);
    const exportMenuRef = useRef(null);
    const audioOK = useRef(new Audio(soundOK));
    const audioError = useRef(new Audio(soundError));

    const playOK = () => {
        try { audioOK.current.currentTime = 0; audioOK.current.play(); } catch (_) {}
    };
    const playError = () => {
        try { audioError.current.currentTime = 0; audioError.current.play(); } catch (_) {}
    };

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        fetchRecentRequests();

        const channel = supabase
            .channel('store_requests_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'store_requests' },
                (payload) => {
                    // 🔔 Play sound when HQ accepts or rejects a request
                    if (payload.eventType === 'UPDATE') {
                        const oldStatus = payload.old?.status;
                        const newStatus = payload.new?.status;
                        const reqBranch = payload.new?.branch_id;
                        const myBranch = activeBranch || currentUser?.branch_id;

                        // Only notify if this request belongs to this branch
                        const isMine = !myBranch || reqBranch === myBranch;

                        if (isMine) {
                            // Note: Supabase omits paylod.old non-PK fields by default (unless REPLICA IDENTITY FULL is set).
                            // So oldStatus is usually undefined. We just trigger based on newStatus.
                            if (newStatus === 'accepted' && oldStatus !== 'accepted') {
                                playOK();
                                toast.success('✅ Request ຖືກຍອມຮັບແລ້ວ!');
                            } else if (newStatus === 'rejected' && oldStatus !== 'rejected') {
                                playError();
                                toast.error('❌ Request ຖືກປະຕິເສດ');
                            }
                        }
                    }
                    fetchRecentRequests();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser?.branch_id, activeBranch]);

    // Focus barcode input
    useEffect(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, [product]);

    // Handle clicking outside of export menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchRecentRequests = async () => {
        try {
            const userBranch = activeBranch || currentUser?.branch_id;
            let query = supabase.from('store_requests').select('*').order('created_at', { ascending: false }).limit(100);
            if (userBranch) query = query.eq('branch_id', userBranch);
            const { data, error } = await query;
            if (error) throw error;
            setRecentRequests(data || []);
            const pending = (data || []).filter(r => r.status === 'pending').length;
            const accepted = (data || []).filter(r => r.status === 'accepted').length;
            setRequestStats({ pending, accepted });
        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    };

    const doSearch = useCallback(async (barcodeValue) => {
        if (!barcodeValue?.trim()) return;
        setIsLoading(true);
        const userBranch = activeBranch || currentUser?.branch_id;
        try {
            // ✅ ดึงทุก rack ที่มี barcode นี้แล้วรวม qty ทั้งหมด
            let query = supabase.from('location_inventory')
                .select('barcode_no, item_name, qty, rack_location, branch_id')
                .eq('barcode_no', barcodeValue.trim());
            if (userBranch) query = query.eq('branch_id', userBranch);
            const { data, error } = await query;
            if (error) throw error;
            if (data && data.length > 0) {
                // รวม qty จากทุก rack
                const totalQty = data.reduce((sum, row) => sum + (row.qty || 0), 0);
                // รวม rack location ทั้งหมดที่มี qty > 0
                const activeRacks = data
                    .filter(row => (row.qty || 0) > 0)
                    .map(row => row.rack_location)
                    .filter(Boolean);
                const rackDisplay = activeRacks.length > 0 ? activeRacks.join(', ') : data[0].rack_location || 'N/A';
                const firstRow = data[0];
                setProduct({
                    barcode: firstRow.barcode_no,
                    item_name: firstRow.item_name,
                    product_name_la: firstRow.item_name,
                    available_qty: totalQty,
                    rack_location: rackDisplay,
                    branch_id: firstRow.branch_id
                });
                setQty(1);
                if (totalQty > 0) {
                    toast.success(`ພົບສິນຄ້າ! ສາງ ${userBranch || ''}: ${totalQty} ຫນ່ວຍ (${data.length} Rack)`);
                } else {
                    toast.warning(`ພົບສິນຄ້າ, ແຕ່ສາງ ${userBranch || ''} ໝົດທຸກ Rack ແລ້ວ`);
                }
            } else {
                setProduct(null);
                toast.error(t('storeRequest.itemNotFound') + (userBranch ? ` (${userBranch})` : ''));
            }
        } catch (err) {
            toast.error('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.branch_id, activeBranch]);

    const handleSearch = async (e) => {
        e.preventDefault();
        await doSearch(barcode);
    };

    const handleScanDetected = (scannedBarcode) => {
        setBarcode(scannedBarcode);
        toast.success(`📷 ສະແກນໄດ້: ${scannedBarcode}`);
        // Auto search after scan
        doSearch(scannedBarcode);
        // Switch to search tab on mobile
        setMobileTab('search');
    };

    const handleAddToCart = () => {
        if (!product) return;
        if (cart.length >= 5) {
            toast.error('ຂໍອະໄພ! ສາມາດຂໍໄດ້ສູງສຸດ 5 ລາຍການຕໍ່ຄັ້ງ');
            return;
        }
        const newItem = {
            id: Date.now(),
            barcode: product.barcode,
            product_name: product.item_name,
            product_name_la: product.product_name_la,
            qty: qty,
            available_qty: product.available_qty,
            rack_location: product.rack_location,
            branch_id: product.branch_id
        };
        setCart(prev => [newItem, ...prev]);
        toast.success(`ເພີ່ມ ${product.item_name} ແລ້ວ!`);
        setProduct(null);
        setBarcode('');
        setQty(1);
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const handleSubmitCart = async () => {
        if (cart.length === 0) return;
        setIsSending(true);
        const date = new Date();
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const batchId = `REQ${yy}${mm}${dd}-${randomStr}`;
        try {
            // 📸 Snapshot stock ณ ตอนนี้จาก location_inventory ก่อน insert
            const barcodes = cart.map(item => item.barcode).filter(Boolean);
            const branchId = activeBranch || currentUser?.branch_id || null;
            let stockSnapshot = {}; // barcode -> total qty

            if (barcodes.length > 0 && branchId) {
                const { data: stockData } = await supabase
                    .from('location_inventory')
                    .select('barcode_no, qty')
                    .eq('branch_id', branchId)
                    .in('barcode_no', barcodes);
                (stockData || []).forEach(s => {
                    stockSnapshot[s.barcode_no] = (stockSnapshot[s.barcode_no] || 0) + (s.qty || 0);
                });
            }

            const requests = cart.map(item => ({
                barcode: item.barcode,
                product_name: item.product_name,
                qty: item.qty,
                status: 'pending',
                request_by: currentUser?.id ? `${currentUser.name} (${currentUser.id})` : (currentUser?.name || 'Store Staff'),
                branch_id: item.branch_id || branchId,
                batch_id: batchId,
                stock_at_request: stockSnapshot[item.barcode] ?? null, // 📸 snapshot ณ เวลานี้
            }));
            const { error } = await supabase.from('store_requests').insert(requests);
            if (error) throw error;
            toast.success(t('storeRequest.requestSent'));
            setCart([]);
            setMobileTab('history');
            fetchRecentRequests();
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleExport = async (type = 'current') => {
        try {
            toast.info('Generating Excel...');
            setShowExportMenu(false);
            let dataToExport = [];
            let fileName = `My_Requests_${new Date().toLocaleDateString()}`;
            if (type === 'current') dataToExport = filteredRequests;
            else if (type === 'pending') { dataToExport = recentRequests.filter(r => r.status === 'pending'); fileName = `My_Pending_Requests`; }
            else if (type === 'today') { dataToExport = recentRequests.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()); fileName = `My_Requests_Today`; }
            if (dataToExport.length === 0) { toast.info('No data for this template'); return; }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Requests');
            worksheet.columns = [
                { header: 'Doc No.', key: 'docNo', width: 22 },
                { header: 'Date', key: 'date', width: 15 }, { header: 'Time', key: 'time', width: 15 },
                { header: 'Requester', key: 'requester', width: 20 }, { header: 'Product', key: 'product', width: 40 },
                { header: 'Barcode', key: 'barcode', width: 20 }, { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Status', key: 'status', width: 15 }
            ];
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            dataToExport.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            let currentBatch = null; let isAlternateColor = false;
            dataToExport.forEach(req => {
                const reqBatch = req.batch_id || new Date(req.created_at).getTime();
                if (currentBatch !== reqBatch) { currentBatch = reqBatch; isAlternateColor = !isAlternateColor; }
                const dt = new Date(req.created_at);
                const row = worksheet.addRow({ docNo: req.batch_id?.startsWith('REQ') ? req.batch_id : 'N/A', date: dt.toLocaleDateString(), time: dt.toLocaleTimeString(), requester: req.request_by, product: req.product_name, barcode: req.barcode, qty: req.qty, status: req.status.toUpperCase() });
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isAlternateColor ? { argb: 'FFDBEAFE' } : { argb: 'FFDCFCE7' } };
                    cell.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } }, left: { style: 'thin', color: { argb: 'FF9CA3AF' } }, bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }, right: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
                });
            });
            const buffer = await workbook.xlsx.writeBuffer();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(new Blob([buffer]));
            a.download = `${fileName}.xlsx`; a.click();
            toast.success('Export Success!');
        } catch (err) { toast.error('Export Error: ' + err.message); }
    };

    const groupHistory = (data) => {
        const groups = {};
        data.forEach(req => {
            const batchId = req.batch_id || `legacy_${new Date(req.created_at).getTime()}`;
            if (!groups[batchId]) groups[batchId] = { batch_id: batchId, created_at: req.created_at, request_by: req.request_by, status: req.status, items: [] };
            groups[batchId].items.push(req);
            if (req.status === 'pending') groups[batchId].status = 'pending';
        });
        return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    const filteredRequests = recentRequests.filter(req => filter === 'all' || req.status === filter);
    const groupedHistory = groupHistory(filteredRequests);

    // ===================== SEARCH PANEL =====================
    const SearchPanel = () => (
        <div className="glass-card p-5 sm:p-8 rounded-[2rem] flex flex-col gap-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <ShoppingCart size={150} />
            </div>
            <form onSubmit={handleSearch} className="relative z-10">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    {t('storeRequest.scanBarcode')}
                </label>
                <div className="flex gap-2">
                    <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder={t('storeRequest.searchPlaceholder')}
                        className="flex-1 text-xl sm:text-2xl font-bold bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 placeholder:text-slate-300 min-w-0"
                        autoFocus={window.innerWidth > 768}
                    />
                    {/* Search Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 sm:px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex-shrink-0 flex items-center"
                    >
                        {isLoading ? <RotateCw size={22} className="animate-spin" /> : <Search size={22} />}
                    </button>
                </div>
            </form>

            {/* 📸 Big Centered Camera Scan Button */}
            <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="relative z-10 w-full py-4 bg-gradient-to-r from-joah-orange via-orange-500 to-amber-500 hover:from-orange-500 hover:via-orange-400 hover:to-amber-400 active:scale-[0.98] text-white rounded-2xl shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-3 font-black text-base"
            >
                <ScanLine size={24} />
                ສະແກນບາໂຄ້ດດ້ວຍກ້ອງ
            </button>

            {product && (
                <div className="animate-scale-in bg-white dark:bg-slate-800/50 rounded-3xl p-5 border-2 border-blue-100 dark:border-blue-500/30 relative z-10">
                    <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mb-1">{product.product_name_la}</h3>
                    <div className={`flex items-center gap-3 mb-5 p-4 rounded-2xl ${product.available_qty > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${product.available_qty > 0 ? 'bg-emerald-500' : 'bg-rose-500'} text-white font-black`}>
                            {product.available_qty > 0 ? '✓' : '✕'}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-black uppercase tracking-wider">{product.available_qty > 0 ? t('storeRequest.available') : t('storeRequest.outOfStock')}</p>
                            <p className="text-lg font-black">{product.available_qty} {t('storeRequest.qty')}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 mb-5">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"><Minus size={20} /></button>
                        <div className="text-center flex-1 px-2">
                            <span className="text-xs font-bold text-slate-400 uppercase mb-1 block">QTY</span>
                            <input
                                type="number" min="1" value={qty}
                                onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val >= 1) setQty(val); else if (e.target.value === '') setQty(''); }}
                                onBlur={() => { if (!qty || qty < 1) setQty(1); }}
                                className="w-full text-3xl font-black text-blue-600 dark:text-blue-400 text-center bg-transparent outline-none border-b-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <button onClick={() => setQty((prev) => (Number(prev) || 1) + 1)} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors"><Plus size={20} /></button>
                    </div>
                    {product.available_qty <= 0 ? (
                        <div className="w-full py-4 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex flex-col items-center justify-center border-2 border-rose-200 dark:border-rose-700">
                            <span className="text-rose-600 dark:text-rose-400 font-black text-lg">🚫 Out of Stock</span>
                            <span className="text-rose-400 text-xs font-bold uppercase tracking-widest">ບໍ່ສາມາດ Request ໄດ້</span>
                        </div>
                    ) : (
                        <button onClick={handleAddToCart} className="w-full py-4 bg-gradient-to-r from-joah-orange to-orange-600 hover:from-orange-500 hover:to-orange-500 text-white rounded-2xl font-black text-lg tracking-wide shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3">
                            <Plus size={24} /><span>{t('storeRequest.addToRequest')}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // ===================== CART PANEL =====================
    const CartPanel = () => (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col h-full min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <List className="text-joah-orange" />
                    <h3 className="font-black text-slate-800 dark:text-white">{t('storeRequest.requestList')} ({cart.length}/5)</h3>
                </div>
                <div className="flex items-center gap-2">
                    {cart.length >= 5 && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg animate-pulse">ເຕັມແລ້ວ</span>}
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-bold text-rose-500 hover:text-rose-600">{t('storeRequest.remove')}</button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 mb-4">
                {cart.length === 0
                    ? <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2 py-10"><ShoppingCart size={48} /><span className="text-sm font-medium">{t('storeRequest.noItemsDesc')}</span></div>
                    : cart.map(item => (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between group border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                            <div className="flex-1 min-w-0 mr-3">
                                <h4 className="font-bold text-slate-800 dark:text-white truncate text-sm">{item.product_name}</h4>
                                <p className="text-xs text-slate-500 font-mono flex items-center gap-1">{item.barcode} <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded-md">{item.rack_location}</span></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-black text-lg text-blue-600 dark:text-blue-400">x{item.qty}</span>
                                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))
                }
            </div>
            <button
                onClick={handleSubmitCart}
                disabled={cart.length === 0 || cart.length > 5 || isSending}
                className={`w-full py-4 text-white rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${cart.length > 5 ? 'bg-rose-500' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
            >
                {isSending ? <RotateCw className="animate-spin" /> : <Send />}
                <span>{cart.length > 5 ? 'ເກີນ 5 ລາຍການ' : `${t('storeRequest.submitRequest')} (${cart.length})`}</span>
            </button>
        </div>
    );

    // ===================== HISTORY PANEL =====================
    const HistoryPanel = () => (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t('storeRequest.history')}</h3>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={exportMenuRef}>
                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-emerald-500"><FileSpreadsheet size={16} /></button>
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                                <div className="p-1">
                                    <button onClick={() => handleExport('current')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-lg">{t('storeRequest.exportSelected')}</button>
                                    <button onClick={() => handleExport('today')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-lg">{t('storeRequest.exportToday')}</button>
                                    <button onClick={() => handleExport('pending')} className="w-full text-left px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg">{t('storeRequest.exportPending')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <RotateCw size={14} className="text-slate-400 cursor-pointer hover:rotate-180 transition-all" onClick={fetchRecentRequests} />
                </div>
            </div>
            {/* Status Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-4">
                {['all', 'pending', 'accepted', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === f ? f === 'rejected' ? 'bg-rose-500 text-white shadow-sm' : f === 'accepted' ? 'bg-emerald-500 text-white shadow-sm' : f === 'pending' ? 'bg-orange-400 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {f === 'all' ? t('storeRequest.tabAll') : f === 'pending' ? t('storeRequest.tabPending') : f === 'accepted' ? t('storeRequest.tabAccepted') : t('storeRequest.tabRejected')}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {groupedHistory.length === 0
                    ? <div className="flex flex-col items-center justify-center text-slate-300 gap-1 opacity-60 py-10"><Clock size={24} /><span className="text-xs font-medium">{t('storeRequest.noHistory')}</span></div>
                    : groupedHistory.map(batch => {
                        const statusMap = {
                            accepted: { label: t('storeRequest.tabAccepted'), cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
                            rejected: { label: t('storeRequest.tabRejected'), cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
                            pending: { label: t('storeRequest.tabPending'), cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
                        };
                        const statusInfo = statusMap[batch.status] || { label: batch.status, cls: 'bg-slate-100 text-slate-500' };
                        return (
                            <div key={batch.batch_id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden text-xs">
                                <div onClick={() => setExpandedBatchId(expandedBatchId === batch.batch_id ? null : batch.batch_id)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">
                                                ເລກບິນ (Doc): <span className="font-mono text-slate-500">{batch.batch_id.startsWith('legacy') ? 'N/A' : batch.batch_id}</span>
                                            </span>
                                        </span>
                                        <span className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-1 text-[11px]">
                                            <span className="text-slate-500">{batch.request_by || 'Staff'}</span>
                                            <span>•</span>
                                            {new Date(batch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><ShoppingCart size={10} /> {batch.items.length} {t('storeRequest.items')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.cls}`}>{statusInfo.label}</span>
                                        <ChevronDown size={14} className={`transition-transform text-slate-400 ${expandedBatchId === batch.batch_id ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                                {expandedBatchId === batch.batch_id && (
                                    <div className="bg-white dark:bg-slate-950/30 p-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                        {batch.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                <div className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">
                                                    {item.product_name}<br />
                                                    <span className="text-[9px] text-slate-400">{item.barcode}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-600 dark:text-slate-400">x{item.qty}</span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' : item.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                                                        {item.status === 'accepted' ? t('storeRequest.tabAccepted') : item.status === 'rejected' ? t('storeRequest.tabRejected') : t('storeRequest.tabPending')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );

    return (
        <>
            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onDetected={handleScanDetected}
                    onClose={() => setShowScanner(false)}
                />
            )}

            <div className="w-full max-w-6xl mx-auto p-3 sm:p-6 animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onBack} className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-700 flex-shrink-0">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight truncate">{t('storeRequest.title')}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('storeRequest.subtitle')}</p>
                    </div>
                    {/* Mobile stats */}
                    <div className="flex gap-2 md:hidden">
                        {requestStats.pending > 0 && (
                            <span className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-xl text-xs font-black">⏳ {requestStats.pending}</span>
                        )}
                        {requestStats.accepted > 0 && (
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-xl text-xs font-black">✅ {requestStats.accepted}</span>
                        )}
                    </div>
                </div>

                {/* ===== MOBILE TAB LAYOUT ===== */}
                <div className="md:hidden">
                    {/* Tab Buttons */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-4">
                        {[
                            { key: 'search', icon: Search, label: 'ຄົ້ນຫາ' },
                            { key: 'cart', icon: ShoppingCart, label: `ລາຍການ (${cart.length})` },
                            { key: 'history', icon: Clock, label: 'ປະຫວັດ' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setMobileTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${mobileTab === tab.key ? 'bg-white dark:bg-slate-700 text-joah-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {mobileTab === 'search' && <SearchPanel />}
                    {mobileTab === 'cart' && (
                        <div style={{ minHeight: '60vh' }}>
                            <CartPanel />
                        </div>
                    )}
                    {mobileTab === 'history' && <HistoryPanel />}
                </div>

                {/* ===== DESKTOP LAYOUT ===== */}
                <div className="hidden md:flex gap-6 h-[calc(100vh-130px)]">
                    {/* Left Column */}
                    <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                        <SearchPanel />
                    </div>
                    {/* Right Column */}
                    <div className="w-96 flex flex-col gap-6 h-full overflow-hidden">
                        <div className="flex-1 min-h-[300px] overflow-hidden flex flex-col">
                            <CartPanel />
                        </div>
                        <div className="flex-1 min-h-[350px] overflow-hidden flex flex-col">
                            <HistoryPanel />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StoreRequest;
