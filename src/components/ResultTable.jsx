import { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    CloudUpload, FileSpreadsheet, Info, History, Clock,
    ArrowUpDown, FilterX, HelpCircle, Package, Calendar, User, RotateCw
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../utils/supabaseClient';
import { syncLocationResultsToSupabase, syncMasterDataToSupabase, fetchMasterFromSupabase } from '../utils/supabaseSync';
import { readExcelFromUrl, sheetToJSON, readExcelFile } from '../utils/excelProcessor';
import databaseUrl from '../assets/DataBaseJoah.xlsx';

const ResultTable = ({
    results, masterData, rawFile, locationSheetName, filterStatus,
    onFilterChange, dbSource, onRefresh, onUpdateRowQty
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isSavingToCloud, setIsSavingToCloud] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editQty, setEditQty] = useState('');
    const [employeeName, setEmployeeName] = useState(localStorage.getItem('joah_employee_name') || '');
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hoveredRowInfo, setHoveredRowInfo] = useState(null);
    const hoverTimeoutRef = useRef(null);

    const itemsPerPage = 8;

    const filteredResults = results.filter(row => {
        const matchesSearch =
            row.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.rackLocation.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.masterItemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (row.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter =
            filterStatus === 'all' || row.status === filterStatus || (filterStatus === 'missing' && row.status === 'incomplete');
        return matchesSearch && matchesFilter;
    });

    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentResults = filteredResults.slice(startIndex, endIndex);

    const handleMouseEnter = (e, row) => {
        const x = e.clientX;
        const y = e.clientY;
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredRowInfo({ row, x, y });
        }, 600);
    };

    const handleMouseMove = (e) => {
        if (hoveredRowInfo) {
            setHoveredRowInfo(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredRowInfo(null);
    };

    const getStatusHint = (row) => {
        if (!row) return null;
        const { status, category1, category2, masterCategory1, masterCategory2 } = row;

        switch (status) {
            case 'passed':
                return {
                    title: 'ຂໍ້ມູນຖືກຕ້ອງສົມບູນ',
                    reason: 'ທຸກຢ່າງກົງກັນ 100% ທັງໝວດໝູ່ ແລະ ສະຖານທີ່.',
                    action: 'ຂໍ້ມູນນີ້ສົມບູນແລ້ວ, ບໍ່ຕ້ອງມີການແກ້ໄຂເພີ່ມເຕີມ.',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-500',
                    icon: <CheckCircle size={14} />
                };
            case 'mismatch':
                const c1Wrong = String(category1 || '').trim() !== String(masterCategory1 || '').trim();
                const c2Wrong = String(category2 || '').trim() !== String(masterCategory2 || '').trim();
                let detailReason = "";
                let detailAction = "";
                if (c1Wrong && c2Wrong) {
                    detailReason = `ສາເຫດ: ຂໍ້ມູນ Cat1 (${category1 || 'ວ່າງ'}) ແລະ Cat2 (${category2 || 'ວ່າງ'}) ບໍ່ກົງກັບໃນລະບົບ.`;
                    detailAction = `ວິທີແກ้ໄຂ: ທ່ານຕ້ອງແກ້ໄຂໃຫ້ກົງຄື: Cat1: ${masterCategory1} ແລະ Cat2: ${masterCategory2}`;
                } else if (c1Wrong) {
                    detailReason = `ສາເຫດ: ຂໍ້ມູນ Cat1 ໃນໜ້າຮ້ານແມ່ນ [${category1 || 'ວ່າງ'}], ແຕ່ຂໍ້ມູນໃນລະບົບແມ່ນ [${masterCategory1}].`;
                    detailAction = `ວິທີແກ้ໄຂ: ທ່ານຕ້ອງປ່ຽນ Cat1 ໃຫ້ກົງກັບ Master ນັ້ນກໍ່ຄື: "${masterCategory1}"`;
                } else {
                    detailReason = `ສາເຫດ: ຂໍ້ມູນ Cat2 ໃນໜ້າຮ້ານແມ່ນ [${category2 || 'ວ່າງ'}], ແຕ່ຂໍ້ມູນໃນລະບົບແມ່ນ [${masterCategory2}].`;
                    detailAction = `ວິທີແກ้ໄຂ: ທ່ານຕ້ອງປ່ຽນ Cat2 ໃຫ້ກົງກັບ Master ນັ້ນກໍ່ຄື: "${masterCategory2}"`;
                }
                return {
                    title: 'ຂໍ້ມູນບໍ່ກົງກັນ', reason: detailReason, action: detailAction,
                    color: 'text-rose-500', bg: 'bg-rose-500', icon: <AlertTriangle size={14} />
                };
            case 'missing':
                return {
                    title: 'ບໍ່ພົບໃນລະບົບ',
                    reason: `ບາໂຄ້ດ [${row.barcode}] ນີ້ ບໍ່ມີຢູ່ໃນຖານຂໍ້ມູນ Master ອ້າງອີງ.`,
                    action: 'ກະລຸນາກວດສອບບາໂຄ້ດຄືນ ຫຼື ເພີ່ມສິນຄ້ານີ້ເຂົ້າໃນລະບົບ Master ກ່ອນ.',
                    color: 'text-sky-500', bg: 'bg-sky-500', icon: <Search size={14} />
                };
            default:
                return {
                    title: 'ຂໍ້ມູນບໍ່ສົມບູນ',
                    reason: 'ພົบบາโຄ้ดในระบบ แต่ข้อมูลใน Master ยังไม่ครบถ้วน.',
                    action: 'ກະລຸນາໄປອັບເດດຂໍ້ມູນໝວດໝູ່ໃນຖານຂໍ້ມູນ Master ໃຫ້ຄົບຖ້ວນ.',
                    color: 'text-amber-500', bg: 'bg-amber-500', icon: <Info size={14} />
                };
        }
    };

    const fetchHistory = async (barcode) => {
        setIsLoadingHistory(true);
        setShowHistory(true);
        try {
            const { data, error } = await supabase
                .from('inventory_history')
                .select('*')
                .eq('barcode', barcode)
                .order('updated_at', { ascending: false });
            if (error) throw error;
            setHistoryData(data || []);
        } catch (err) {
            console.error('History Fetch Error:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const handleUpdateMasterQty = async () => {
        if (!selectedRow || editQty === '') return;
        if (dbSource === 'supabase' && !employeeName.trim()) {
            alert('ກະລຸນາໃສ່ຊື່ພະນັກງານກ່ອນບັນທຶກ');
            return;
        }

        setIsUpdating(true);
        const now = new Date().toISOString();
        const newQtyValue = Number(editQty);
        const oldQtyValue = selectedRow.qty || 0;

        console.log(`[DEBUG] 🛠️ Starting Update for Barcode: ${selectedRow.barcode}`);
        localStorage.setItem('joah_employee_name', employeeName);

        if (onUpdateRowQty) {
            onUpdateRowQty(selectedRow.rowIndex, {
                qty: newQtyValue, updatedAt: now, updatedBy: employeeName
            });
        }

        try {
            if (dbSource === 'supabase') {
                if (!selectedRow.id) throw new Error("ບໍ່ພົບ Record ID ໃນຖານຂໍ້ມູນ.");

                // 1. Update Main Inventory
                const { error: locError } = await supabase
                    .from('location_inventory')
                    .update({ qty: newQtyValue, remarks: `Updated by ${employeeName} at ${now}` })
                    .eq('id', selectedRow.id);
                if (locError) throw locError;

                // 2. Insert into History Log
                const { error: histError } = await supabase
                    .from('inventory_history')
                    .insert([{
                        barcode: selectedRow.barcode,
                        item_name: selectedRow.masterItemName || selectedRow.itemName,
                        old_qty: oldQtyValue,
                        new_qty: newQtyValue,
                        updated_by: employeeName
                    }]);

                if (histError) console.error("Failed to save history:", histError);
            }
            setSelectedRow(null);
        } catch (err) {
            alert('❌ ບໍ່ສາມາດບັນທຶກໄດ້: ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleExportWithColor = async () => {
        setIsExporting(true);

        // Helper function to sanitize cell values for Excel
        const sanitize = (value) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
                // Remove control characters that Excel can't handle
                return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            }
            return value;
        };

        try {
            const workbook = new ExcelJS.Workbook();
            if (dbSource === 'supabase') {
                const locationSheet = workbook.addWorksheet('Location Inventory');
                const dataSheet = workbook.addWorksheet('Master Data Reference');

                // 1. Headers
                const headers = [
                    'Barcode No.', 'Item Name', 'Rack Location', 'Category-1', 'Category-2',
                    'Actual QTY', 'System QTY', 'Status', 'Remarks',
                    'Verifier', 'Last Update'
                ];
                const hRow = locationSheet.addRow(headers);

                // Style Header Row (Safer approach: apply to each cell)
                hRow.eachCell((cell) => {
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA580C' } };
                });

                // 2. Add Data Rows
                results.forEach(res => {
                    const rowData = [
                        sanitize(res.barcode),
                        sanitize(res.masterItemName || res.itemName || ''),
                        sanitize(res.rackLocation || ''),
                        sanitize(res.category1 || ''),
                        sanitize(res.category2 || ''),
                        isNaN(Number(res.qty)) ? 0 : Number(res.qty),
                        isNaN(Number(res.masterQty)) ? 0 : Number(res.masterQty),
                        sanitize(res.status === 'passed' ? 'Passed' : res.status === 'mismatch' ? 'Mismatch' : 'Missing'),
                        sanitize(res.status === 'passed' ? 'Complete' : (res.reason || '-')),
                        sanitize(res.updatedBy || ''),
                        res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : ''
                    ];
                    const row = locationSheet.addRow(rowData);

                    // Style Status Cell (Column 8)
                    const statusCell = row.getCell(8);
                    let bgColor = '';
                    if (res.status === 'passed') bgColor = 'FFDCFCE7';
                    else if (res.status === 'mismatch') bgColor = 'FFFEE2E2';
                    else if (res.status === 'missing') bgColor = 'FFE0F2FE';

                    if (bgColor) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                    }
                });

                // 3. Cloud Master Data
                const cloudMaster = await fetchMasterFromSupabase();
                if (cloudMaster && cloudMaster.length > 0) {
                    const mhRow = dataSheet.addRow(['Barcode', 'Item Name', 'Category 1', 'Category 2', 'Qty']);
                    mhRow.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                    });

                    cloudMaster.forEach(mRow => {
                        dataSheet.addRow([
                            sanitize(mRow.barcode || ''),
                            sanitize(mRow.item_name || mRow.product_name_la || ''),
                            sanitize(mRow.category_1 || ''),
                            sanitize(mRow.category_2 || ''),
                            isNaN(Number(mRow.qty)) ? 0 : Number(mRow.qty)
                        ]);
                    });
                }

                // Final touches: Set Column Widths
                locationSheet.columns = [
                    { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                    { width: 12 }, { width: 12 }, { width: 12 }, { width: 20 }, { width: 15 }, { width: 20 }
                ];
                dataSheet.columns = [
                    { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 12 }
                ];
            } else {
                if (!rawFile || !locationSheetName) return;

                // Directly load the original file buffer into the workbook
                // This preserves all original styles, macros, and structure
                const arrayBuffer = await rawFile.arrayBuffer();
                await workbook.xlsx.load(arrayBuffer);

                const worksheet = workbook.getWorksheet(locationSheetName);
                if (worksheet) {
                    const cols = { qty: 7, sys: 8, status: 9, remark: 10, date: 11, user: 12 };
                    const header = worksheet.getRow(1);
                    header.getCell(cols.qty).value = 'Actual QTY';
                    header.getCell(cols.sys).value = 'System QTY';
                    header.getCell(cols.status).value = 'Status';
                    header.getCell(cols.remark).value = 'Remarks';
                    header.getCell(cols.date).value = 'Update Date';
                    header.getCell(cols.user).value = 'Verifier';

                    // Apply bold style to header cells we modified to ensure consistency
                    [cols.qty, cols.sys, cols.status, cols.remark, cols.date, cols.user].forEach(col => {
                        header.getCell(col).font = { bold: true };
                    });

                    results.forEach(res => {
                        const excelRowNumber = res.rowIndex + 1;
                        const row = worksheet.getRow(excelRowNumber);
                        if (!row) return;
                        row.getCell(cols.qty).value = Number(res.qty || 0);
                        row.getCell(cols.sys).value = Number(res.masterQty || 0);
                        row.getCell(cols.status).value = res.status === 'passed' ? 'Passed' : res.status === 'mismatch' ? 'Mismatch' : 'Missing';
                        row.getCell(cols.remark).value = sanitize(res.status === 'passed' ? 'Complete' : (res.reason || '-'));
                        row.getCell(cols.date).value = res.updatedAt ? new Date(res.updatedAt).toLocaleDateString() : '';
                        row.getCell(cols.user).value = sanitize(res.updatedBy || '');
                    });
                }
            }
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Warehouse_Validation_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
        } catch (e) {
            console.error('Export Error:', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Action Bar */}
            <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 flex flex-col xl:flex-row gap-6 items-center border-white/50">
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="relative group">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-joah-orange transition-colors" size={18} />
                        <input
                            type="text" placeholder="ຄົ້ນຫາບາໂຄ້ດ, ສິນຄ້າ ຫຼື ຕຳແໜ່ງ..."
                            className="input-field pl-14 font-bold"
                            value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div className="relative">
                        <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={18} />
                        <select
                            className="input-field pl-14 appearance-none font-bold"
                            value={filterStatus} onChange={(e) => { onFilterChange(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all">ທັງໝົດ (All Status)</option>
                            <option value="passed">✅ ຖືກຕ້ອງ (Passed)</option>
                            <option value="mismatch">❌ ບໍ່ກົງກັນ (Mismatch)</option>
                            <option value="missing">❓ ຂໍ້ມູນບໍ່ຄົບ (Missing)</option>
                        </select>
                        <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-100 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-8">
                    <button onClick={handleExportWithColor} disabled={isExporting} className="btn-success shadow-emerald-500/20 py-3 uppercase text-[10px] tracking-widest min-w-[160px]">
                        {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                        <span>Export Report</span>
                    </button>
                    {onRefresh && (
                        <button onClick={onRefresh} className="btn-secondary py-3 uppercase text-[10px] tracking-widest min-w-[120px]">
                            <RotateCw size={16} />
                            <span>Refresh</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Table Area (Premium Modern Style) */}
            <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-visible">
                <div className="overflow-x-auto custom-scrollbar rounded-[2.5rem]">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                                <th className="px-8 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">#</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Barcode / Product</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Rack Location</th>
                                <th className="px-6 py-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Count / System</th>
                                <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">Categories</th>
                                <th className="px-6 py-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Status</th>
                                <th className="px-8 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {currentResults.length > 0 ? currentResults.map((row) => (
                                <tr key={row.rowIndex} onMouseEnter={(e) => handleMouseEnter(e, row)} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} className="group hover:bg-joah-orange/[0.03] dark:hover:bg-joah-orange/[0.05] transition-all duration-300">
                                    <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-700">#{row.rowIndex}</td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1.5 min-w-[200px]">
                                            <span className="text-sm font-black text-slate-800 dark:text-white font-mono tracking-tight">{row.barcode}</span>
                                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[240px]" title={row.masterItemName || row.itemName}>{row.masterItemName || row.itemName || <span className="opacity-50 italic">Unnamed Item</span>}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 group-hover:border-joah-orange/30 transition-colors">
                                            <MapPin size={12} className="text-joah-orange/50" />
                                            <span className="text-xs font-black tracking-tighter uppercase">{row.rackLocation}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{row.qty || 0}</span>
                                            <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2 p-1 px-2 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
                                                <Database size={8} className="text-sky-500" />
                                                <span>Sys: <b className="text-slate-700 dark:text-slate-300">{row.masterQty || 0}</b></span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 hidden lg:table-cell">
                                        <div className="flex flex-col gap-1 max-w-[150px]">
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter truncate">{row.category1 || '-'}</span>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter opacity-50 truncate">{row.category2 || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 text-center">
                                        <span className={`status-badge ${row.status === 'passed' ? 'badge-success' : row.status === 'mismatch' ? 'badge-error' : 'badge-warning'}`}>
                                            {getStatusHint(row).icon}
                                            {row.status === 'passed' ? 'Matched' : row.status === 'mismatch' ? 'Mismatch' : 'Missing'}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {dbSource === 'supabase' && (
                                                <button onClick={() => fetchHistory(row.barcode)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all" title="View History">
                                                    <History size={18} />
                                                </button>
                                            )}
                                            <button onClick={() => { setSelectedRow(row); setEditQty(row.qty || 0); }} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-joah-orange transition-all" title="Edit Quantity">
                                                <Edit2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="7" className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-300 dark:text-slate-700">
                                            <Package size={64} strokeWidth={1} className="animate-float" />
                                            <p className="text-sm font-black uppercase tracking-[0.3em]">No Records Found</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">Showing <span className="text-slate-700 dark:text-slate-300">{startIndex + 1}-{Math.min(endIndex, filteredResults.length)}</span> of <span className="text-slate-700 dark:text-slate-300">{filteredResults.length}</span> items</p>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="btn-secondary !p-3 !rounded-xl disabled:opacity-30"><ChevronLeft size={18} /></button>
                        <div className="flex items-center px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-white">{currentPage} / {totalPages || 1}</div>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="btn-secondary !p-3 !rounded-xl disabled:opacity-30"><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            {selectedRow && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 relative z-10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-joah-orange text-white shadow-lg shadow-orange-500/20"><Edit2 size={20} /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">ແກ້ໄຂຈຳນວນ</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Manual Adjustment</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedRow(null)} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <div className="space-y-6 relative z-10">
                            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                                <div className="flex justify-between items-start text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    <span>Item Info</span>
                                    <span className="text-joah-orange">#{selectedRow.rowIndex}</span>
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-base font-black text-slate-800 dark:text-white font-mono tracking-tight">{selectedRow.barcode}</p>
                                    <p className="text-xs font-bold text-slate-500 truncate">{selectedRow.masterItemName || selectedRow.itemName}</p>
                                </div>
                                <div className="pt-3 grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700/50">
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Count</p>
                                        <div className="flex items-center gap-1.5"><Database size={10} className="text-sky-500" /><span className="text-sm font-black text-slate-700 dark:text-slate-300">{selectedRow.masterQty || 0}</span></div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</p>
                                        <div className="flex items-center gap-1.5"><MapPin size={10} className="text-joah-orange" /><span className="text-sm font-black text-slate-700 dark:text-slate-300">{selectedRow.rackLocation}</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="relative group">
                                    <span className="floating-label group-focus-within:text-joah-orange">New Actual Qty</span>
                                    <input
                                        type="number"
                                        value={editQty}
                                        onChange={(e) => setEditQty(e.target.value)}
                                        className="input-field !text-xl text-center py-4 font-black caret-joah-orange text-joah-orange focus:text-joah-orange transition-all duration-300 focus:ring-4 focus:ring-joah-orange/10"
                                        autoFocus
                                    />
                                </div>
                                <div className="relative group mt-4">
                                    <span className="absolute -top-3 left-4 px-2 bg-white dark:bg-slate-900 text-[10px] font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-joah-orange z-10 transition-colors">Verifier Name</span>
                                    <div className="relative">
                                        <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors" size={16} />
                                        <input type="text" placeholder="ໃສ່ຊື່ເຈົ້າຂອງຜົນກວດ..." value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="input-field pl-12 py-3.5 text-sm font-bold" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6">
                                <button onClick={() => setSelectedRow(null)} disabled={isUpdating} className="btn-secondary bg-slate-800 text-white border-slate-700 hover:bg-slate-700 h-16 uppercase text-xs tracking-widest shadow-none disabled:opacity-50">Cancel</button>
                                <button onClick={handleUpdateMasterQty} disabled={isUpdating} className={`btn-primary h-16 uppercase text-xs tracking-widest shadow-orange-500/10 ${isUpdating ? 'opacity-70 cursor-wait' : ''}`}>
                                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    <span>{isUpdating ? 'Saving...' : 'Confirm Save'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in relative overflow-hidden flex flex-col max-h-[85vh]">
                        <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"><History size={20} /></div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">ປະຫວັດການແກ້ໄຂ</h3>
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Audit Log</p>
                                </div>
                            </div>
                            <button onClick={() => setShowHistory(false)} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"><X size={20} /></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                            {isLoadingHistory ? (
                                <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
                                    <Loader2 className="animate-spin" size={32} />
                                    <p className="text-xs font-black uppercase tracking-widest">Loading History...</p>
                                </div>
                            ) : historyData.length > 0 ? (
                                historyData.map((log) => (
                                    <div key={log.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                                        <div className="mt-1 p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                            <Clock size={16} />
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex justify-between items-start">
                                                <p className="text-sm font-black text-slate-700 dark:text-slate-200">{log.updated_by || 'Unknown'}</p>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(log.updated_at).toLocaleString('lo-LA')}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                                <span>Qty:</span>
                                                <span className="line-through opacity-70">{log.old_qty}</span>
                                                <ArrowUpDown size={12} className="rotate-90 text-indigo-500" />
                                                <span className="font-bold text-indigo-600 dark:text-indigo-300">{log.new_qty}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 opacity-60">
                                    <History size={48} strokeWidth={1} />
                                    <p className="text-xs font-black uppercase tracking-widest">No History Found</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Hover Tooltip */}
            {hoveredRowInfo && (
                <div className="fixed z-[999] pointer-events-none animate-scale-in origin-top-left" style={{ left: `${hoveredRowInfo.x + 20}px`, top: `${hoveredRowInfo.y + 20}px` }}>
                    <div className="w-[340px] glass-card dark:glass-card-dark rounded-[2rem] shadow-2xl overflow-hidden border-2 border-slate-100 dark:border-slate-800/80">
                        <div className={`p-5 flex items-center gap-4 border-b border-slate-100 dark:border-slate-800/50 ${getStatusHint(hoveredRowInfo.row).bg}/10`}>
                            <div className={`p-2.5 rounded-2xl text-white ${getStatusHint(hoveredRowInfo.row).bg} shadow-lg`}>{getStatusHint(hoveredRowInfo.row).icon}</div>
                            <div className="space-y-0.5">
                                <h5 className="text-sm font-black text-slate-800 dark:text-white leading-none tracking-tight">{getStatusHint(hoveredRowInfo.row).title}</h5>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Diagnostics</p>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">ສັງເກດເຫັນຂໍ້ຜິດພາດ:</p>
                                <p className="text-xs font-bold leading-relaxed text-slate-700 dark:text-slate-300">{getStatusHint(hoveredRowInfo.row).reason}</p>
                            </div>
                            <div className="space-y-1.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">ວິທີແກ້ໄຂ:</p>
                                <p className="text-xs font-black leading-relaxed text-slate-800 dark:text-white">{getStatusHint(hoveredRowInfo.row).action}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultTable;
