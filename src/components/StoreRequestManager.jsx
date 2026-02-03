import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Clock, Package, User, Check, RefreshCw, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useToast } from './ToastProvider';
import ExcelJS from 'exceljs';

const StoreRequestManager = ({ onClose, currentUser }) => {
    const [requests, setRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Date Filter State (Default to today)
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    // Export Dropdown State
    const [showExportMenu, setShowExportMenu] = useState(false);
    const exportMenuRef = useRef(null);

    const toast = useToast();

    // Close export menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        fetchRequests();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('store_request_manager')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_requests' }, () => {
                fetchRequests();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, []); // Only run on mount, manual refetch for date changes

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('store_requests')
                .select('*')
                .order('created_at', { ascending: false });

            // Apply Date Filter if selected
            if (startDate && endDate) {
                query = query
                    .gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${endDate}T23:59:59`);
            } else {
                // Default limit if no filter
                query = query.limit(100);
            }

            const { data, error } = await query;

            if (error) throw error;

            // 🆕 Fetch inventory data for each request
            const requestsWithInventory = await Promise.all(
                (data || []).map(async (request) => {
                    try {
                        const { data: inventoryData } = await supabase
                            .from('location_inventory')
                            .select('qty, rack_location')
                            .eq('barcode_no', request.barcode)
                            .maybeSingle();

                        return {
                            ...request,
                            available_qty: inventoryData?.qty || 0,
                            rack_location: inventoryData?.rack_location || 'N/A'
                        };
                    } catch (err) {
                        return {
                            ...request,
                            available_qty: 0,
                            rack_location: 'N/A'
                        };
                    }
                })
            );

            setRequests(requestsWithInventory);
        } catch (err) {
            console.error('Error fetching:', err);
            toast.error('Failed to load requests');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (id, productName) => {
        try {
            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'accepted',
                    accepted_by: currentUser?.name || 'Admin'
                })
                .eq('id', id);

            if (error) throw error;
            toast.success(`✅ ຮັບทราบການເບີກ ${productName} ແລ້ວ`);
            // List will update automatically via subscription
        } catch (err) {
            toast.error('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
        }
    };

    const handleExport = async (type = 'current') => {
        try {
            toast.info('Generating Excel...');
            setShowExportMenu(false);

            let dataToExport = [];
            let fileName = '';

            // 1. Fetch Data based on Template Type
            if (type === 'current') {
                dataToExport = [...requests];
                fileName = `Store_Requests_${startDate}_to_${endDate}`;
            } else if (type === 'all') {
                const { data, error } = await supabase
                    .from('store_requests')
                    .select('*')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                dataToExport = data || [];
                fileName = `Store_Requests_All_History`;
            } else if (type === 'pending') {
                const { data, error } = await supabase
                    .from('store_requests')
                    .select('*')
                    .eq('status', 'pending')
                    .order('created_at', { ascending: false });
                if (error) throw error;
                dataToExport = data || [];
                fileName = `Store_Requests_Pending_Only`;
            }

            if (dataToExport.length === 0) {
                toast.info('No data to export for this selection');
                return;
            }

            // 2. Create Workbook using ExcelJS
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Store Requests');

            // 3. Define Columns
            worksheet.columns = [
                { header: 'ID', key: 'id', width: 10 },
                { header: 'Product Name', key: 'product_name', width: 40 },
                { header: 'Barcode', key: 'barcode', width: 15 },
                { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Status', key: 'status', width: 15 },
                { header: 'Request By', key: 'request_by', width: 20 },
                { header: 'Accepted By', key: 'accepted_by', width: 20 },
                { header: 'Date', key: 'date', width: 15 },
                { header: 'Time', key: 'time', width: 15 }
            ];

            // 4. Style Header
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' } // Blue header
            };

            // 5. Add Rows and Apply Styles
            dataToExport.forEach(req => {
                const dateObj = new Date(req.created_at);
                const row = worksheet.addRow({
                    id: req.id,
                    product_name: req.product_name,
                    barcode: req.barcode,
                    qty: req.qty,
                    status: req.status.toUpperCase(),
                    request_by: req.request_by,
                    accepted_by: req.accepted_by || '-',
                    date: dateObj.toLocaleDateString('th-TH'),
                    time: dateObj.toLocaleTimeString('th-TH')
                });

                // Color coding based on status
                const statusCell = row.getCell('status');
                if (req.status === 'accepted') {
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFDCFCE7' } // Light Green
                    };
                    statusCell.font = { color: { argb: 'FF166534' }, bold: true }; // Dark Green Text
                } else if (req.status === 'pending') {
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFEDD5' } // Orange-ish
                    };
                    statusCell.font = { color: { argb: 'FF9A3412' }, bold: true }; // Dark Orange Text
                }

                row.getCell('qty').alignment = { horizontal: 'center' };
            });

            // 6. Download File
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `${fileName}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

            toast.success('Download Excel สำเร็จ! (พร้อมสี)');

        } catch (err) {
            console.error(err);
            toast.error('Export Error: ' + err.message);
        }
    };

    const pendingRequests = requests.filter(r => r.status === 'pending');
    const historyRequests = requests.filter(r => r.status !== 'pending');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-800"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                <Package size={24} strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Store Requests</h2>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">ຈັດການຄຳຂໍເບີກສິນຄ້າ</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Filter Bar */}
                    <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-2xl">
                        <div className="flex items-center gap-2 px-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">From</span>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 uppercase">To</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <button
                            onClick={fetchRequests}
                            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                            title="Filter Data"
                        >
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>

                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-2"></div>

                        {/* Export Dropdown */}
                        <div className="relative ml-auto" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-sm"
                            >
                                <FileSpreadsheet size={18} />
                                <span>Export (Excel)</span>
                                <ChevronDown size={14} />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden z-[110] animate-scale-in">
                                    <div className="p-2">
                                        <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest">ເລືອກຮູບແບບ (Template)</div>
                                        <button
                                            onClick={() => handleExport('current')}
                                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors mb-1"
                                        >
                                            📅 ລາຍການທີ່ເລືອກ (ຕາມວັນທີ)
                                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Filter by selected dates</span>
                                        </button>
                                        <button
                                            onClick={() => handleExport('all')}
                                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors mb-1"
                                        >
                                            🗂️ ປະຫວັດທັງໝົດ
                                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Export entire database</span>
                                        </button>
                                        <button
                                            onClick={() => handleExport('pending')}
                                            className="w-full text-left px-3 py-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm font-medium transition-colors"
                                        >
                                            ⏳ ລາຍການຄ້າງ (Pending)
                                            <span className="block text-[10px] text-slate-400 font-normal mt-0.5">Requests waiting for approval</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                    {/* Pending Section */}
                    <div className="mb-10">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                ລໍຖ້າການຢືນຢັນ ({pendingRequests.length})
                            </h3>
                        </div>

                        {pendingRequests.length === 0 ? (
                            <div className="p-12 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center text-slate-300 gap-4">
                                <CheckCircle size={48} />
                                <span className="font-medium">ບໍ່ມີລາຍການຄ້າງ (All clear!)</span>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {pendingRequests.map((req) => (
                                    <div key={req.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all group">
                                        <div className="flex items-start justify-between flex-wrap gap-4">
                                            <div className="flex items-start gap-6 flex-1">
                                                {/* Requested Qty Badge */}
                                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex flex-col items-center justify-center text-white shadow-lg">
                                                    <div className="text-3xl font-black">{req.qty}</div>
                                                    <div className="text-[9px] font-bold opacity-80 uppercase">ຂໍ</div>
                                                </div>

                                                <div className="flex-1">
                                                    <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-2">{req.product_name}</h4>

                                                    {/* Info Row */}
                                                    <div className="flex items-center gap-4 text-xs font-medium text-slate-400 mb-3">
                                                        <span className="flex items-center gap-1">
                                                            <User size={12} />
                                                            {req.request_by}
                                                        </span>
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            {new Date(req.created_at).toLocaleString()}
                                                        </span>
                                                        <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">
                                                            {req.barcode}
                                                        </span>
                                                    </div>

                                                    {/* 🆕 Stock & Location Info */}
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Available Stock */}
                                                        <div className={`p-3 rounded-xl border-2 ${req.available_qty >= req.qty
                                                                ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                                                                : req.available_qty > 0
                                                                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
                                                                    : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30'
                                                            }`}>
                                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                                ສາງມີ (Stock)
                                                            </div>
                                                            <div className={`text-2xl font-black ${req.available_qty >= req.qty
                                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                                    : req.available_qty > 0
                                                                        ? 'text-amber-600 dark:text-amber-400'
                                                                        : 'text-rose-600 dark:text-rose-400'
                                                                }`}>
                                                                {req.available_qty}
                                                                {req.available_qty >= req.qty && <span className="text-sm ml-1">✓</span>}
                                                                {req.available_qty > 0 && req.available_qty < req.qty && <span className="text-sm ml-1">⚠</span>}
                                                                {req.available_qty === 0 && <span className="text-sm ml-1">✕</span>}
                                                            </div>
                                                            {req.available_qty < req.qty && req.available_qty > 0 && (
                                                                <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                                    ບໍ່ພໍ! ຂາດ {req.qty - req.available_qty}
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Rack Location */}
                                                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700">
                                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                                                ຕຳແໜ່ງ (Location)
                                                            </div>
                                                            <div className="text-xl font-black text-slate-700 dark:text-slate-200 flex items-center gap-1">
                                                                📍 {req.rack_location || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => handleAccept(req.id, req.product_name)}
                                                disabled={req.available_qty === 0}
                                                className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 flex items-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400"
                                            >
                                                <Check size={20} strokeWidth={3} />
                                                <span>ACCEPT</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* History Section */}
                    <div>
                        <h3 className="text-sm font-black text-slate-400 uppercase tracking-wider mb-6">
                            History (Latest 100)
                        </h3>
                        <div className="space-y-2">
                            {historyRequests.slice(0, 50).map((req) => (
                                <div key={req.id} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm opacity-60 hover:opacity-100 transition-opacity">
                                    <div className="flex items-center gap-4">
                                        <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${req.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-600'
                                            }`}>
                                            {req.status}
                                        </span>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{req.product_name}</span>
                                            <span className="text-[10px] text-slate-400">Accepted by: {req.accepted_by || '-'}</span>
                                        </div>
                                        <span className="text-slate-400 font-bold">x{req.qty}</span>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="flex items-center gap-1 text-slate-500 text-xs">
                                            <User size={10} /> {req.request_by}
                                        </span>
                                        <span className="text-slate-400 text-[10px]">{new Date(req.created_at).toLocaleTimeString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StoreRequestManager;
