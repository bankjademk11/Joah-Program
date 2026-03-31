import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Clock, Package, User, Check, RefreshCw, FileSpreadsheet, ChevronDown, Undo2, Ban } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import ExcelJS from 'exceljs';

const StoreRequestManager = ({ onClose, currentUser }) => {
    const [requests, setRequests] = useState([]);
    const [groupedRequests, setGroupedRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Group expansion state for History section
    const [expandedGroups, setExpandedGroups] = useState({});

    // Determine if this user can see ALL branches (HQ/Admin) or only their own
    // Matches App.jsx convention: role === 'HQ' means admin/HQ access
    const isHQOrAdmin = currentUser?.role === 'HQ';
    const managedBranch = isHQOrAdmin ? null : currentUser?.branch_id; // null = see all branches

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

    // 🆕 Helper to Group Requests
    const groupRequests = (data) => {
        const groups = {};

        data.forEach(req => {
            // Use batch_id if available, otherwise fallback to ID (single item group)
            const groupId = req.batch_id || `legacy_${req.id}`;

            if (!groups[groupId]) {
                groups[groupId] = {
                    batch_id: groupId,
                    created_at: req.created_at,
                    request_by: req.request_by,
                    status: req.status, // Assuming all in batch have same status initially
                    items: []
                };
            }
            groups[groupId].items.push(req);
        });

        // Convert to array and sort by date descending
        return Object.values(groups).sort((a, b) =>
            new Date(b.created_at) - new Date(a.created_at)
        );
    };

    const fetchRequests = async () => {
        setIsLoading(true);
        try {
            let query = supabase
                .from('store_requests')
                .select('*')
                .order('created_at', { ascending: false });

            // 🔐 Non-HQ staff can only see their own branch's requests
            if (managedBranch) {
                query = query.eq('branch_id', managedBranch);
            }

            // Apply Date Filter if selected
            if (startDate && endDate) {
                query = query
                    .gte('created_at', `${startDate}T00:00:00`)
                    .lte('created_at', `${endDate}T23:59:59`);
            } else {
                query = query.limit(200);
            }

            const { data, error } = await query;

            if (error) throw error;

            // Fetch inventory data for each request — filtered by the request's branch_id
            const requestsWithInventory = await Promise.all(
                (data || []).map(async (request) => {
                    try {
                        // Build query — filter by branch_id if the request carries one
                        let invQuery = supabase
                            .from('location_inventory')
                            .select('qty, rack_location, branch_id')
                            .eq('barcode_no', request.barcode);

                        // Use the branch_id recorded on the request (set when staff searched)
                        if (request.branch_id) {
                            invQuery = invQuery.eq('branch_id', request.branch_id);
                        }

                        const { data: inventoryData } = await invQuery;

                        // ✅ รวม qty จากทุก Rack + แสดง Rack ที่มีของเท่านั้น
                        const totalQty = (inventoryData || []).reduce((sum, row) => sum + (row.qty || 0), 0);
                        const activeRacks = (inventoryData || [])
                            .filter(row => (row.qty || 0) > 0)
                            .map(row => row.rack_location)
                            .filter(Boolean);
                        const rackDisplay = activeRacks.length > 0
                            ? activeRacks.join(', ')
                            : (inventoryData?.[0]?.rack_location || 'N/A');

                        return {
                            ...request,
                            available_qty: totalQty,
                            rack_location: rackDisplay,
                            rack_details: (inventoryData || []).map(r => ({ rack: r.rack_location || 'N/A', qty: r.qty || 0 }))
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

            setRequests(requestsWithInventory); // Keep raw for export if needed
            setGroupedRequests(groupRequests(requestsWithInventory)); // 🆕 Set Grouped Data
        } catch (err) {
            console.error('Error fetching:', err);
            toast.error('Failed to load requests');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (id, productName, barcode, qty, branchId) => {
        if (!window.confirm(`ຢືນຢັນການຮັບ ${productName} ຈຳນວນ ${qty}?`)) return;

        try {
            // 1. Fetch current inventory using barcode and branch_id, selecting the ID 
            let invQuery = supabase
                .from('location_inventory')
                .select('id, qty, rack_location')
                .eq('barcode_no', barcode)
                .order('qty', { ascending: false }); // Take the one with the most QTY to deduct from

            if (branchId) {
                invQuery = invQuery.eq('branch_id', branchId);
            }

            // We only pick ONE specific rack to deduct from
            const { data: invRows, error: invErr } = await invQuery.limit(1);

            if (invErr) throw invErr;
            if (!invRows || invRows.length === 0) throw new Error('ບໍ່ພົບຂໍ້ມູນສິນຄ້າໃນສາງ (ອາດຈະຜິດສາຂາ)');
            
            const inv = invRows[0];
            const newQty = (inv.qty || 0) - qty;

            // 2. Transaction-ish update - UPDATE ONLY BY ID, NOT BY BARCODE
            const { error: invUpdateErr } = await supabase
                .from('location_inventory')
                .update({ qty: newQty })
                .eq('id', inv.id);

            if (invUpdateErr) throw invUpdateErr;

            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'accepted',
                    accepted_by: currentUser?.id
                        ? `${currentUser.name} (${currentUser.id})`
                        : (currentUser?.name || 'Admin'),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            toast.success(`✅ ຮັບຊາບ ແລະ ຫັກສາງ ${productName} ແລ້ວ (Rack: ${inv.rack_location || '-'})`);
            fetchRequests();
        } catch (err) {
            toast.error('ເກີດຂໍ้ຜິດພາດ: ' + err.message);
        }
    };

    const handleAcceptBatch = async (batchId, items) => {
        const pendingItems = items.filter(item => item.status === 'pending');
        if (pendingItems.length === 0) return;

        if (!window.confirm(`ຢືນຢັນການຮັບທັງໝົດ ${pendingItems.length} ລາຍການ? (ຈະສັ່ງຫັກສາງຈິງ)`)) return;

        try {
            setIsLoading(true);

            // For batch, we iterate and update inventory exactly by ID
            for (const item of pendingItems) {
                let invQuery = supabase
                    .from('location_inventory')
                    .select('id, qty')
                    .eq('barcode_no', item.barcode)
                    .order('qty', { ascending: false });

                if (item.branch_id) {
                    invQuery = invQuery.eq('branch_id', item.branch_id);
                }

                const { data: invRows } = await invQuery.limit(1);

                if (invRows && invRows.length > 0) {
                    const inv = invRows[0];
                    await supabase
                        .from('location_inventory')
                        .update({ qty: (inv.qty || 0) - item.qty })
                        .eq('id', inv.id); // Deduct ONLY from this specific row ID
                }
            }

            const itemIdsToUpdate = pendingItems.map(item => item.id);
            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'accepted',
                    accepted_by: currentUser?.id
                        ? `${currentUser.name} (${currentUser.id})`
                        : (currentUser?.name || 'Admin'),
                    updated_at: new Date().toISOString()
                })
                .in('id', itemIdsToUpdate);

            if (error) throw error;
            toast.success(`✅ ຮັບຊາບ ແລະ ຫັກສາງ ${pendingItems.length} ລາຍການແລ້ວ`);
            fetchRequests();
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancelAccept = async (group) => {
        if (!window.confirm(`ຕ້ອງການຍົກເລີກການຮັບບິນນີ້? (ຈະເພີ່ມສິນຄ້າກັບຄືນເຂົ້າສາງ)`)) return;

        try {
            setIsLoading(true);

            // 1. Restore Inventory - ✅ คืนเฉพาะ Rack ที่มี qty สูงสุด (Rack เดียวกับที่หักไป)
            for (const item of group.items) {
                let invQuery = supabase
                    .from('location_inventory')
                    .select('id, qty, rack_location')
                    .eq('barcode_no', item.barcode)
                    .order('qty', { ascending: false }); // เรียงตาม qty มากสุด เหมือน handleAccept

                if (item.branch_id) {
                    invQuery = invQuery.eq('branch_id', item.branch_id);
                }

                const { data: invRows } = await invQuery.limit(1);

                if (invRows && invRows.length > 0) {
                    const inv = invRows[0];
                    await supabase
                        .from('location_inventory')
                        .update({ qty: (inv.qty || 0) + item.qty })
                        .eq('id', inv.id); // ✅ คืนเฉพาะ Row ID นี้เท่านั้น ไม่ไปยุ่ง Rack อื่น
                }
            }

            // 2. Set status back to pending
            const itemIds = group.items.map(i => i.id);
            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'pending',
                    accepted_by: null,
                    updated_at: new Date().toISOString()
                })
                .in('id', itemIds);

            if (error) throw error;
            toast.success('🔄 ຍົກເລີກການຮັບ ແລະ ຄືນສາງສຳເລັດ');
            fetchRequests();
        } catch (err) {
            toast.error('Error canceling: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRejectBatch = async (batchId, items) => {
        const pendingItems = items.filter(item => item.status === 'pending');
        if (pendingItems.length === 0) return;

        if (!window.confirm(`ຢືນຢັນການປະຕິເສດ ${pendingItems.length} ລາຍການ?`)) return;

        try {
            setIsLoading(true);
            const itemIds = pendingItems.map(i => i.id);
            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'rejected',
                    accepted_by: currentUser?.id
                        ? `${currentUser.name} (${currentUser.id})`
                        : (currentUser?.name || 'Admin'),
                    updated_at: new Date().toISOString()
                })
                .in('id', itemIds);

            if (error) throw error;
            toast.error(`❌ ປະຕິເສດ ${pendingItems.length} ລາຍການແລ້ວ`);
            fetchRequests();
        } catch (err) {
            toast.error('Error rejecting: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async (id, productName) => {
        if (!window.confirm(`ຢືນຢັນການປະຕິເສດ ${productName}?`)) return;

        try {
            const { error } = await supabase
                .from('store_requests')
                .update({
                    status: 'rejected',
                    accepted_by: currentUser?.id
                        ? `${currentUser.name} (${currentUser.id})`
                        : (currentUser?.name || 'Admin'),
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            toast.error(`❌ ປະຕິເສດ ${productName} ແລ້ວ`);
            fetchRequests();
        } catch (err) {
            toast.error('Error rejecting: ' + err.message);
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
                { header: 'Request Time', key: 'request_time', width: 20 },
                { header: 'Action Time', key: 'action_time', width: 20 }
            ];

            // 4. Style Header
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF2563EB' } // Blue header
            };

            // 5. Add Rows and Apply Styles
            // Sort data to ensure batches are together
            dataToExport.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            let currentBatch = null;
            let isAlternateColor = false;

            dataToExport.forEach(req => {
                const reqBatch = req.batch_id || new Date(req.created_at).getTime();
                if (currentBatch !== reqBatch) {
                    currentBatch = reqBatch;
                    isAlternateColor = !isAlternateColor;
                }

                const requestDate = new Date(req.created_at);
                const actionDate = req.updated_at ? new Date(req.updated_at) : null;

                const row = worksheet.addRow({
                    id: req.id,
                    product_name: req.product_name,
                    barcode: req.barcode,
                    qty: req.qty,
                    status: req.status.toUpperCase(),
                    request_by: req.request_by,
                    accepted_by: req.accepted_by || '-',
                    request_time: requestDate.toLocaleString('en-GB'),
                    action_time: actionDate ? actionDate.toLocaleString('en-GB') : '-'
                });

                // Apply borders and alternating colors for all cells FIRST
                row.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: isAlternateColor ? { argb: 'FFDBEAFE' } : { argb: 'FFDCFCE7' } // Light Blue vs Light Green
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
                        left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
                        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
                        right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
                    };
                });

                // Override Color coding specifically for status column
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

    return (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col relative">

                {/* Header Section */}
                <div className="px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between z-10 sticky top-0">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Store Request Manager</h2>
                        <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">ຈັດການຄຳຂໍເບີກສິນຄ້າ</p>
                        {/* Branch scope indicator */}
                        <div className="mt-1">
                            {isHQOrAdmin
                                ? <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300 uppercase tracking-widest">🌐 ທຸກສາຂາ (HQ)</span>
                                : <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 uppercase tracking-widest">📍 {managedBranch}</span>
                            }
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/30 transition-all flex items-center justify-center"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="px-8 py-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm sticky top-[90px] z-[5] border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0"
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="bg-white dark:bg-slate-900 border-none rounded-xl px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-0"
                            />
                            <button
                                onClick={fetchRequests}
                                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/30 transition-all"
                            >
                                <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>
                    </div>

                    {/* Export Dropdown */}
                    <div className="relative" ref={exportMenuRef}>
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
                                    </button>
                                    <button
                                        onClick={() => handleExport('all')}
                                        className="w-full text-left px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm font-medium transition-colors mb-1"
                                    >
                                        🗂️ ປະຫວັດທັງໝົດ
                                    </button>
                                    <button
                                        onClick={() => handleExport('pending')}
                                        className="w-full text-left px-3 py-3 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-sm font-medium transition-colors"
                                    >
                                        ⏳ ລາຍການຄ້າງ (Pending)
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-slate-900 space-y-6">
                    {/* Active Requests (Pending) */}
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white uppercase tracking-wider">
                                ລໍຖ້າການຢືນຢັນ ({groupedRequests.filter(g => g.items.some(i => i.status === 'pending')).length})
                            </h3>
                        </div>

                        {groupedRequests.filter(g => g.items.some(i => i.status === 'pending')).length === 0 ? (
                            <div className="p-12 rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-slate-300 gap-4 mb-8">
                                <CheckCircle size={48} />
                                <span className="font-medium">ບໍ່ມີລາຍການຄ້າງ (All clear!)</span>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {groupedRequests.filter(g => g.items.some(i => i.status === 'pending')).map((group) => {
                                    const pendingCount = group.items.filter(i => i.status === 'pending').length;
                                    return (
                                        <div key={group.batch_id} className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-lg border border-slate-100 dark:border-slate-700 overflow-hidden ring-2 ring-blue-500/10">
                                            {/* Batch Header */}
                                            <div className="bg-white dark:bg-slate-800 p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
                                                        <User size={24} />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                                            {group.request_by || 'Unknown User'}
                                                            <span className="px-2 py-0.5 rounded text-[10px] bg-rose-100 text-rose-600 uppercase tracking-widest font-bold">New Order</span>
                                                        </h3>
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-1">
                                                            <Clock size={12} />
                                                            {new Date(group.created_at).toLocaleString('en-GB')}
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            {group.items.length} ລາຍການ (ທັງໝົດ: {group.items.reduce((sum, i) => sum + (i.qty || 0), 0)})
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    {/* REJECT ALL */}
                                                    <button
                                                        onClick={() => handleRejectBatch(group.batch_id, group.items)}
                                                        className="group/btn flex items-center gap-2 px-5 py-2.5 rounded-full border-2 border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-rose-500 dark:text-rose-400 font-bold text-sm hover:bg-rose-500 hover:text-white hover:border-rose-500 dark:hover:bg-rose-600 dark:hover:border-rose-600 transition-all duration-200 active:scale-95 shadow-sm"
                                                        title="Reject All"
                                                    >
                                                        <Ban size={16} className="transition-transform group-hover/btn:rotate-12 duration-200" />
                                                        <span>ປະຕິເສດ</span>
                                                    </button>

                                                    {/* ACCEPT ALL */}
                                                    <button
                                                        onClick={() => handleAcceptBatch(group.batch_id, group.items)}
                                                        className="group/btn flex items-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all duration-200 active:scale-95"
                                                    >
                                                        <CheckCircle size={16} className="transition-transform group-hover/btn:scale-110 duration-200" />
                                                        <span>ຮັບ ({pendingCount})</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Items List */}
                                            <div className="max-h-[400px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800">
                                                {group.items.map((item) => (
                                                    <div key={item.id} className="p-4 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                        {/* Qty Badge */}
                                                        <div className="flex-shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/20 text-white">
                                                            <span className="text-[9px] font-bold uppercase opacity-70 leading-none">QTY</span>
                                                            <span className="text-lg font-black leading-tight">{item.qty}</span>
                                                        </div>

                                                        {/* Info */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm leading-tight truncate">{item.product_name}</h4>
                                                            <span className="text-[10px] font-mono text-slate-400">{item.barcode}</span>

                                                            {/* Rack Breakdown */}
                                                            {item.rack_details && item.rack_details.length > 1 ? (
                                                                <div className="mt-2">
                                                                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                                        {item.rack_details.map((r, i) => (
                                                                            <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${r.qty > 0
                                                                                ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                                                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 line-through'
                                                                            }`}>
                                                                                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.qty > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                                                                <span>{r.rack}</span>
                                                                                <span className="opacity-70">·</span>
                                                                                <span>{r.qty}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 w-fit">
                                                                        <span className="text-[10px] font-black text-blue-700 dark:text-blue-300">ລວມທັງໝົດ</span>
                                                                        <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">{item.available_qty} ຫນ່ວຍ</span>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 mt-1.5">
                                                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${item.available_qty > 0
                                                                        ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300'
                                                                        : 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700 text-rose-600 dark:text-rose-400'
                                                                    }`}>
                                                                        <div className={`w-1.5 h-1.5 rounded-full ${item.available_qty > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                                        <span>Stock: {item.available_qty}</span>
                                                                    </div>
                                                                    {item.rack_location && item.rack_location !== 'N/A' && (
                                                                        <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                                                            📍 {item.rack_location}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {item.status === 'accepted' ? (
                                                            <span className="text-emerald-500"><CheckCircle size={16} /></span>
                                                        ) : item.status === 'rejected' ? (
                                                            <span className="text-rose-500"><Ban size={16} /></span>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5">
                                                                {/* Item-level REJECT */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleReject(item.id, item.product_name);
                                                                    }}
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-rose-200 dark:border-rose-800 text-rose-500 dark:text-rose-400 text-[11px] font-bold hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all duration-150 active:scale-95"
                                                                    title="Reject"
                                                                >
                                                                    <Ban size={11} />
                                                                    ປະຕິເສດ
                                                                </button>
                                                                {/* Item-level ACCEPT */}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleAccept(item.id, item.product_name, item.barcode, item.qty, item.branch_id);
                                                                    }}
                                                                    className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white text-[11px] font-bold shadow shadow-emerald-500/30 transition-all duration-150 active:scale-95"
                                                                    title="Accept"
                                                                >
                                                                    <Check size={11} />
                                                                    ຮັບ
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* History Section (Previously Accepted) */}
                    <div className="opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-3 mb-6 mt-8 border-t border-slate-200 dark:border-slate-800 pt-8">
                            <h3 className="text-lg font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                ປະຫວັດ (History)
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {groupedRequests.filter(g => !g.items.some(i => i.status === 'pending')).slice(0, 10).map((group) => (
                                <div key={group.batch_id} className="bg-white dark:bg-slate-800 rounded-3xl overflow-hidden border border-slate-100 dark:border-slate-700">
                                    <div
                                        className="p-4 flex items-center justify-between group/history cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                                        onClick={() => setExpandedGroups(prev => ({ ...prev, [group.batch_id]: !prev[group.batch_id] }))}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500">
                                                <CheckCircle size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-700 dark:text-slate-300 text-sm flex items-center gap-2">
                                                    ບິນດຳເນີນການແລ້ວ
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${group.items[0].status === 'accepted' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                                                        {group.items[0].status === 'accepted' ? 'Accepted' : 'Rejected'}
                                                    </span>
                                                </h4>
                                                <p className="text-xs text-slate-400">{new Date(group.created_at).toLocaleString('en-GB')}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right flex items-center gap-6">
                                                <div>
                                                    <div className="text-sm font-black text-slate-800 dark:text-white">{group.items.length} Items</div>
                                                    <div className="text-[10px] text-slate-400 font-bold uppercase">{group.request_by}</div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleCancelAccept(group);
                                                    }}
                                                    className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-xl transition-all opacity-0 group-hover/history:opacity-100"
                                                    title="ຍົກເລີກການຮັບ (ຄືນສາງ)"
                                                >
                                                    <Undo2 size={18} />
                                                </button>
                                            </div>
                                            <ChevronDown size={20} className={`text-slate-400 transition-transform ${expandedGroups[group.batch_id] ? 'rotate-180' : ''}`} />
                                        </div>
                                    </div>

                                    {/* Expanded History Details */}
                                    {expandedGroups[group.batch_id] && (
                                        <div className="bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-700 p-4">
                                            <div className="space-y-2">
                                                {group.items.map(item => (
                                                    <div key={`hist-${item.id}`} className="flex items-center justify-between py-2 border-b border-slate-200/50 dark:border-slate-800/50 last:border-0">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-400">
                                                                {item.qty}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.product_name}</p>
                                                                <p className="text-[10px] font-mono text-slate-500">{item.barcode}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                                By: {item.accepted_by || '-'}
                                                            </p>
                                                            {item.status === 'accepted' ? (
                                                                <span className="text-[10px] text-emerald-500 font-bold">✓ Accepted</span>
                                                            ) : (
                                                                <span className="text-[10px] text-rose-500 font-bold">✗ Rejected</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
