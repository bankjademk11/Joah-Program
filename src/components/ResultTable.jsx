import { useState, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    CloudUpload, FileSpreadsheet, Info, History, Clock
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../utils/supabaseClient';
import { syncLocationResultsToSupabase, syncMasterDataToSupabase } from '../utils/supabaseSync';
import { readExcelFromUrl, sheetToJSON } from '../utils/excelProcessor';
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
    const itemsPerPage = 50;

    const filteredResults = results.filter((row) => {
        const matchesSearch =
            row.barcode.toLowerCase().includes(searchTerm.toLowerCase()) ||
            row.rackLocation.toLowerCase().includes(searchTerm.toLowerCase());
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
            setHoveredRowInfo({
                row,
                x,
                y
            });
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
                    detailAction = `ວິທີແກ້ໄຂ: ທ່ານຕ້ອງແກ້ໄຂໃຫ້ກົງຄື: Cat1: ${masterCategory1} ແລະ Cat2: ${masterCategory2}`;
                } else if (c1Wrong) {
                    detailReason = `ສາເหດ: ຂໍ້ມູນ Cat1 ໃນໜ້າຮ້ານແມ່ນ [${category1 || 'ວ່າງ'}], ແຕ່ຂໍ້ມູນໃນລະບົບແມ່ນ [${masterCategory1}].`;
                    detailAction = `ວິທີແກ້ໄຂ: ທ່ານຕ້ອງປ່ຽນ Cat1 ໃຫ້ກົງກັບ Master ນັ້ນກໍ່ຄື: "${masterCategory1}"`;
                } else {
                    detailReason = `ສາເຫด: ຂໍ້ມູນ Cat2 ໃນໜ້າຮ້ານແມ່ນ [${category2 || 'ວ່າງ'}], ແຕ່ຂໍ້ມູນໃນລະບົບແມ່ນ [${masterCategory2}].`;
                    detailAction = `ວິທີແກ້ໄຂ: ທ່ານຕ້ອງປ່ຽນ Cat2 ໃຫ້ກົງກັບ Master ນັ້ນກໍ່ຄື: "${masterCategory2}"`;
                }

                return {
                    title: 'ຂໍ້ມູນບໍ່ກົງກັນ',
                    reason: detailReason,
                    action: detailAction,
                    color: 'text-rose-500',
                    bg: 'bg-rose-500',
                    icon: <AlertTriangle size={14} />
                };
            case 'missing':
                return {
                    title: 'ບໍ່ພົບໃນລະບົບ',
                    reason: `ບາໂຄ້ດ [${row.barcode}] ນີ້ ບໍ່ມີຢູ່ໃນຖານຂໍ້ມູນ Master ອ້າງອີງ.`,
                    action: 'ກະລຸນາກວດສອບບາໂຄ້ດຄືນ ຫຼື ເພີ່ມສິນຄ້ານີ້ເຂົ້າໃນລະບົບ Master ກ່ອນ.',
                    color: 'text-sky-500',
                    bg: 'bg-sky-500',
                    icon: <Search size={14} />
                };
            default:
                return {
                    title: 'ຂໍ້ມູນບໍ່ສົມບູນ',
                    reason: 'ພົบบາโຄ້ดในระบบ แต่ข้อมูลใน Master ยังไม่ครบถ้วน.',
                    action: 'ກະລຸນາໄປອັບເດດຂໍ້ມູນໝວດໝູ່ໃນຖານຂໍ້ມູນ Master ໃຫ້ຄົບຖ້ວນ.',
                    color: 'text-amber-500',
                    bg: 'bg-amber-500',
                    icon: <Info size={14} />
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

        // Name required for cloud sync traceability
        if (dbSource === 'supabase' && !employeeName.trim()) {
            alert('ກະລຸນາໃສ່ຊື່ພະນັກງານກ່ອນບັນທຶກ');
            return;
        }

        setIsUpdating(true);
        const now = new Date().toISOString();
        const newQtyValue = Number(editQty);
        const oldQtyValue = selectedRow.qty || 0;

        console.log(`[DEBUG] 🛠️ Starting Update for Barcode: ${selectedRow.barcode}`);
        console.log(`[DEBUG] 📍 Row Index: ${selectedRow.rowIndex}, Database ID: ${selectedRow.id || 'N/A'}`);
        console.log(`[DEBUG] 📊 Change: ${oldQtyValue} -> ${newQtyValue}`);

        // Persistent employee name
        localStorage.setItem('joah_employee_name', employeeName);

        // 1. Update Frontend immediately (Updates Actual Count in Table)
        if (onUpdateRowQty) {
            onUpdateRowQty(selectedRow.rowIndex, {
                qty: newQtyValue,
                updatedAt: now,
                updatedBy: employeeName
            });
            console.log(`[DEBUG] ✅ UI Updated Real-time`);
        }

        // 2. Sync to Cloud if in Supabase mode
        try {
            if (dbSource === 'supabase') {
                if (!selectedRow.id) {
                    console.error('[DEBUG] ❌ Cannot sync to cloud: Missing Record ID');
                    throw new Error("ບໍ່ພົບ Record ID ໃນຖານຂໍ້ມູນ. ກະລຸນາລອງ Refresh ຂໍ້ມູນໃໝ່.");
                }

                console.log(`[DEBUG] ☁️ Sending update to Supabase table 'location_inventory'...`);

                const { data, error: locError } = await supabase
                    .from('location_inventory')
                    .update({
                        qty: newQtyValue,
                        remarks: `Updated manually by ${employeeName} at ${now}`
                    })
                    .eq('id', selectedRow.id)
                    .select();

                if (locError) {
                    console.error('[DEBUG] ❌ Supabase DB Error:', locError);
                    throw locError;
                }

                console.log(`[DEBUG] 🚀 Cloud Sync Successful! Data returned:`, data);
            }

            setSelectedRow(null);
            alert('✨ ອັບເດດຈຳນວນນັບສຳເລັດແລ້ວ!');
        } catch (err) {
            console.error('[DEBUG] ❌ Final Catch Error:', err);
            alert('❌ ບໍ່ສາມາດບັນທຶກได้: ' + err.message);
        } finally {
            setIsUpdating(false);
            console.log(`[DEBUG] 🏁 Update Process Finished.`);
        }
    };

    const handleSaveToCloud = async () => {
        setIsSavingToCloud(true);
        try {
            console.log('🚀 Starting Unified Cloud Sync...');

            // 1. If we have the raw file, Sync Master Data first
            if (rawFile && dbSource === 'excel') {
                console.log('📦 Syncing Master Data from DATA sheet...');
                const wb = await readExcelFile(rawFile);
                const dataRows = sheetToJSON(wb, 'DATA');
                if (dataRows && dataRows.length > 0) {
                    const masterResult = await syncMasterDataToSupabase(dataRows);
                    if (!masterResult.success) {
                        throw new Error('Master Sync Failed: ' + masterResult.error);
                    }
                    console.log('✅ Master Data Synced');
                }
            }

            // 2. Sync Location counting results
            const result = await syncLocationResultsToSupabase(results);

            if (result.success) {
                const msg = `✨ ບັນທຶກທັງຂໍ້ມູນ Master ແລະ ຜົນການກວດສອບລົງ Cloud ສຳເລັດແລ้ວ!\n🚛Synced: ${result.synced} items.`;
                alert(msg);
            } else {
                alert('❌ ບັນທຶກບໍ່ສຳເລັດ: ' + result.error);
            }
        } catch (e) {
            console.error('Unified Sync Error:', e);
            alert('❌ Error: ' + e.message);
        } finally {
            setIsSavingToCloud(false);
        }
    };

    const handleExportWithColor = async () => {
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            
            if (dbSource === 'supabase') {
                // Cloud Mode: Build a new workbook from scratch
                const locationSheet = workbook.addWorksheet('Location');
                const dataSheet = workbook.addWorksheet('DATA');

                // Populate Location Sheet Headers
                locationSheet.getRow(1).values = [
                    'Barcode', 'Rack Location', 'Category-1', 'Category-2', 'QTY', 'Item Name',
                    'QTY (Cloud)', 'Status', 'Remarks', 'Last Updated', 'Updated By'
                ];
                
                // Populate Location Sheet Rows
                results.forEach(res => {
                    const row = locationSheet.addRow([
                        res.barcode,
                        res.rackLocation,
                        res.category1,
                        res.category2,
                        res.qty,
                        res.masterItemName,
                        res.masterQty || 0,
                        res.status === 'passed' ? 'ຖືກຕ້ອງ' : res.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : 'ບໍ່ຄົບຖ້ວນ',
                        res.status === 'passed' ? 'ຂໍ້ມູນຖືກຕ້ອງ' : (res.reason || 'ກວດສອບພົບຂໍ້ຜິດພາດ'),
                        res.updatedAt ? new Date(res.updatedAt).toLocaleString('lo-LA') : '-',
                        res.updatedBy || '-'
                    ]);

                    // Apply coloring to the status cell in Location sheet
                    const statusCell = row.getCell(8);
                    let bgColor = null;
                    if (res.status === 'passed') bgColor = 'CCE3F6E3';
                    if (res.status === 'mismatch') bgColor = 'CCF9DADA';
                    if (res.status === 'missing' || res.status === 'incomplete') bgColor = 'CCD1E9F6';
                    if (bgColor) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                    }
                });
                
                // Populate DATA Sheet
                if (masterData && masterData.length > 0) {
                    const headers = Object.keys(masterData[0]);
                    dataSheet.getRow(1).values = headers;
                    masterData.forEach(row => {
                        const values = headers.map(header => row[header]);
                        dataSheet.addRow(values);
                    });
                }

            } else {
                // Excel Mode: Use existing logic with rawFile
                if (!rawFile || !locationSheetName) {
                    alert("ບໍ່ພົບໄຟລ໌ຕົ້ນສະບັບ ຫຼື ຊື່ຊີດ");
                    setIsExporting(false);
                    return;
                }

                const originalWb = new ExcelJS.Workbook();
                await originalWb.xlsx.load(await rawFile.arrayBuffer());

                originalWb.eachSheet((oldSheet, sheetId) => {
                    const newSheet = workbook.addWorksheet(oldSheet.name);
                    oldSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                        const newRow = newSheet.getRow(rowNumber);
                        // Simple 1-to-1 copy
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            newRow.getCell(colNumber).value = cell.value;
                        });
                    });
                });
                
                const worksheet = workbook.getWorksheet(locationSheetName);
                if (!worksheet) throw new Error(`Sheet "${locationSheetName}" not found`);

                const qtyCol = 7;
                const statusCol = 8;
                const remarkCol = 9;
                const dateCol = 10;
                const userCol = 11;

                const headerRow = worksheet.getRow(1);
                headerRow.getCell(qtyCol).value = 'ຈຳນວນ (QTY Cloud)';
                headerRow.getCell(statusCol).value = 'ສະຖານະກວດສອບ';
                headerRow.getCell(remarkCol).value = 'ໝາຍເຫດ (Remarks)';
                headerRow.getCell(dateCol).value = 'ວັນທີແກ້ໄຂ';
                headerRow.getCell(userCol).value = 'ຜູ້ແກ້ໄຂ (User)';

                [qtyCol, statusCol, remarkCol, dateCol, userCol].forEach(colIndex => {
                    const cell = headerRow.getCell(colIndex);
                    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
                    cell.alignment = { horizontal: 'center' };
                });

                results.forEach((res) => {
                    const excelRowNumber = res.rowIndex + 1;
                    if (excelRowNumber <= 1) return;

                    const row = worksheet.getRow(excelRowNumber);
                    if (!row) return;

                    row.getCell(qtyCol).value = res.masterQty || 0;
                    const statusCell = row.getCell(statusCol);
                    statusCell.value = res.status === 'passed' ? 'ຖືກຕ້ອງ' : res.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : 'ບໍ່ຄົບຖ້ວນ';
                    row.getCell(remarkCol).value = res.status === 'passed' ? 'ຂໍ້ມູນຖືກຕ້ອງ' : (res.reason || 'ກວດສອບພົບຂໍ້ຜິດພາດ');
                    row.getCell(dateCol).value = res.updatedAt ? new Date(res.updatedAt).toLocaleString('lo-LA') : '-';
                    row.getCell(userCol).value = res.updatedBy || '-';

                    let bgColor = null;
                    if (res.status === 'passed') bgColor = 'CCE3F6E3';
                    if (res.status === 'mismatch') bgColor = 'CCF9DADA';
                    if (res.status === 'missing' || res.status === 'incomplete') bgColor = 'CCD1E9F6';

                    if (bgColor) {
                        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                    }
                });
            }

            // Generate and download the file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${dbSource === 'supabase' ? 'CloudData' : (rawFile ? rawFile.name : 'Validation')}.xlsx`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export Error:', error);
            alert('Export failed: ' + error.message);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden animate-slide-up transition-colors">
            {/* Table Header */}
            <div className="p-8 md:p-10 border-b border-slate-50 dark:border-slate-800">
                <div className="flex flex-col lg:flex-row gap-8 lg:items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 text-joah-orange flex items-center justify-center">
                                <FileSpreadsheet size={24} />
                            </div>
                            <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">ລາຍການຂໍ້ມູນ</h2>
                        </div>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 font-bold flex items-center gap-2">
                            <Info size={14} className="text-slate-300 dark:text-slate-700" />
                            ກວດພົບທັງໝົດ <span className="text-joah-orange">{filteredResults.length}</span> ລາຍການໃນ {locationSheetName}
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-4">
                        <div className="relative group min-w-[280px]">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-joah-orange transition-colors" size={18} />
                            <input
                                type="text"
                                placeholder="ຄົ້ນຫາບາໂຄ້ດ ຫຼື ຕຳແໜ່ງ..."
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="w-full h-14 pl-14 pr-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent focus:bg-white dark:focus:bg-slate-800 focus:border-joah-orange focus:outline-none transition-all duration-300 font-bold text-slate-700 dark:text-white"
                            />
                        </div>

                        <div className="relative min-w-[160px]">
                            <Filter className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" size={18} />
                            <select
                                value={filterStatus}
                                onChange={(e) => { onFilterChange(e.target.value); setCurrentPage(1); }}
                                className="w-full h-14 pl-14 pr-10 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-transparent appearance-none focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 focus:outline-none transition-all duration-300 font-bold text-slate-700 dark:text-white"
                            >
                                <option value="all">ທັງໝົດ</option>
                                <option value="passed">ຖືກຕ້ອງ</option>
                                <option value="mismatch">ບໍ່ກົງກັນ</option>
                                <option value="missing">ບໍ່ຄົບທ້ວນ</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" size={16} />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handleSaveToCloud}
                                disabled={isSavingToCloud}
                                className="btn-secondary h-14 !px-6 border-2 border-emerald-50 dark:border-emerald-500/10 bg-emerald-50/30 dark:bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 transition-all duration-300"
                            >
                                {isSavingToCloud ? <Loader2 className="animate-spin" size={20} /> : <CloudUpload size={20} />}
                                <span className="hidden xl:inline text-sm">Save to Cloud</span>
                            </button>

                            <button
                                onClick={handleExportWithColor}
                                disabled={isExporting}
                                className="btn-primary h-14 !px-8 shadow-xl shadow-orange-500/20"
                            >
                                {isExporting ? <Loader2 className="animate-spin" size={20} /> : <Download size={20} />}
                                <span className="hidden xl:inline text-sm">Export Report</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 dark:bg-slate-800/20">
                            <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800" style={{ width: '80px' }}>ID</th>
                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Barcode / Item</th>
                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800">Location</th>
                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800" style={{ width: '120px' }}>QTY (Actual / Sys)</th>
                            <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800 hidden xl:table-cell">Categories</th>
                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800" style={{ width: '160px' }}>Status</th>
                            <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800" style={{ width: '100px' }}>Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                        {currentResults.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="py-32 text-center text-slate-300 dark:text-slate-700">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 rounded-3xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                            <Search size={32} />
                                        </div>
                                        <p className="text-slate-400 dark:text-slate-600 font-bold">ບໍ່ພົບຂໍ້ມູນທີ່ທ່ານຄົ້ນຫາ</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            currentResults.map((row) => <tr
                                key={row.rowIndex}
                                className="group hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-all duration-200 cursor-pointer"
                                onClick={() => { setSelectedRow(row); setEditQty(row.qty || 0); }}
                                onMouseEnter={(e) => handleMouseEnter(e, row)}
                                onMouseMove={handleMouseMove}
                                onMouseLeave={handleMouseLeave}
                            >
                                <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-700">#{row.rowIndex}</td>
                                <td className="px-6 py-6">
                                    <div className="space-y-1">
                                        <div className="font-mono text-sm font-black text-slate-800 dark:text-white leading-none">{row.barcode}</div>
                                        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[200px]">
                                            {row.masterItemName || 'ລໍຖ້າການລະບຸຊື່ສິນຄ້າ'}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-6">
                                    <span className={`inline-flex px-3 py-1.5 rounded-xl text-xs font-black tracking-tight
                                                ${row.color === 'red' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-500/20' :
                                            row.color === 'blue' ? 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-100 dark:border-sky-500/20' :
                                                'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                        {row.rackLocation}
                                    </span>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className="flex flex-col items-center gap-0.5">
                                        <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{row.qty || 0}</span>
                                        <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter mt-1 p-1 bg-slate-50 dark:bg-slate-800 rounded-md">
                                            <Database size={8} className="text-sky-500" />
                                            <span>Master: <b className="text-slate-700 dark:text-slate-300">{row.masterQty || 0}</b></span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-6 hidden xl:table-cell">
                                    <div className="flex flex-col gap-1">
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-2">
                                            C1: {(!row.category1 || row.category1 === '0') ? <span className="text-sky-500 italic">Empty</span> : <span className="text-slate-700 dark:text-slate-300">{row.category1}</span>}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-2">
                                            C2: {(!row.category2 || row.category2 === '0') ? <span className="text-sky-500 italic">Empty</span> : <span className="text-slate-700 dark:text-slate-300">{row.category2}</span>}
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-center">
                                    <div className={`status-badge mx-auto ${row.status === 'passed' ? 'badge-success' : row.status === 'mismatch' ? 'badge-error' : 'badge-warning'}`}>
                                        {row.status === 'passed' ? <CheckCircle size={12} /> : row.status === 'mismatch' ? <X size={12} /> : <AlertTriangle size={12} />}
                                        <span>
                                            {row.status === 'passed' ? 'ຖືກຕ້ອງ' : row.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : 'ບໍ່ຄົບ'}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <button className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-joah-orange hover:border-joah-orange hover:shadow-lg transition-all flex items-center justify-center">
                                        <Edit2 size={16} />
                                    </button>
                                </td>
                            </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="px-10 py-8 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-center gap-6 transition-colors">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest">Showing</span>
                        <span className="px-4 py-2 bg-white dark:bg-slate-800 rounded-xl text-xs font-black text-slate-700 dark:text-slate-300 shadow-sm transition-colors">
                            {startIndex + 1} - {Math.min(endIndex, filteredResults.length)} <span className="mx-2 text-slate-200 dark:text-slate-700">/</span> {filteredResults.length}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { setCurrentPage((p) => Math.max(1, p - 1)); }}
                            disabled={currentPage === 1}
                            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:border-joah-orange dark:hover:border-joah-orange hover:text-joah-orange disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>

                        <div className="px-6 h-12 bg-joah-orange rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                            <span className="text-white font-black text-sm">{currentPage} <span className="mx-2 opacity-50">of</span> {totalPages}</span>
                        </div>

                        <button
                            onClick={() => { setCurrentPage((p) => Math.min(totalPages, p + 1)); }}
                            disabled={currentPage === totalPages}
                            className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:border-joah-orange dark:hover:border-joah-orange hover:text-joah-orange disabled:opacity-30 disabled:pointer-events-none transition-all shadow-sm"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Detail Modal - Reverted to Stable Centered Version */}
            {selectedRow && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedRow(null)}></div>

                    <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl overflow-y-auto animate-slide-up border border-white dark:border-slate-800 transition-colors custom-scrollbar">
                        <div className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md p-8 md:p-10 border-b border-slate-50 dark:border-slate-800 flex justify-between items-center transition-colors">
                            <div>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ປຽບທຽບຂໍ້ມູນ</h3>
                                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Details Verification</p>
                            </div>
                            <button
                                onClick={() => setSelectedRow(null)}
                                className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 hover:text-rose-500 transition-all flex items-center justify-center"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-8 space-y-8">
                            {/* Product Header Card */}
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex items-center gap-6 transition-colors">
                                <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center text-joah-orange shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
                                    <Database size={28} />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Product Reference</p>
                                    <h4 className="text-lg font-black text-slate-800 dark:text-white leading-tight transition-colors">
                                        {selectedRow.masterItemName || selectedRow.itemName || 'ລໍຖ້າການລະບຸຊື່ສິນຄ້າ'}
                                    </h4>
                                    <div className="font-mono text-xs text-slate-400 dark:text-slate-500 font-bold transition-colors">{selectedRow.barcode}</div>
                                </div>
                            </div>

                            {/* SMART Editor Section - Stayed at the top for convenience */}
                            <div className="p-8 bg-slate-100 dark:bg-slate-950 rounded-[2.5rem] shadow-sm border border-slate-200 dark:border-slate-800 transition-all duration-300">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                                            Update Counted QTY (ແກ້ໄຂຈຳນວນນັບໜ້າຮ້ານ)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full h-12 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/5 rounded-2xl px-5 text-slate-900 dark:text-white font-black text-lg focus:outline-none focus:border-joah-orange transition-all duration-300 shadow-inner"
                                                value={editQty}
                                                onChange={(e) => setEditQty(e.target.value)}
                                                placeholder="Enter correct actual count..."
                                            />
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                                                <Edit2 size={16} />
                                            </div>
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 mt-2 italic px-1">
                                            * ການແກ້ໄຂນີ້ຈະປ່ຽນຕົວເລກ "ຈຳນວນນັບຈິງ" ເທົ່ານັ້ນ, ຂໍ້ມູນ Master ຈະຄືເກົ່າ.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                                            Verifier (ຜູ້ກວດກາ)
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full h-12 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/5 rounded-2xl px-5 text-slate-900 dark:text-white font-black text-sm focus:outline-none focus:border-sky-500 transition-all duration-300 shadow-inner"
                                            value={employeeName}
                                            onChange={(e) => setEmployeeName(e.target.value)}
                                            placeholder="ໃສ່ຊື່ຂອງທ່ານ..."
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleUpdateMasterQty}
                                    disabled={isUpdating}
                                    className="w-full h-12 bg-joah-orange hover:bg-slate-900 dark:hover:bg-white dark:hover:text-joah-orange text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
                                    <span>Update Floor Count</span>
                                </button>
                            </div>

                            {/* Comparison Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Actual Info */}
                                <div className="p-6 bg-orange-50/50 dark:bg-orange-500/5 rounded-[2rem] border border-orange-100 dark:border-orange-500/10 relative group overflow-hidden transition-colors">
                                    <h5 className="text-[10px] font-black text-joah-orange dark:text-orange-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <MapPin size={12} /> ຂໍ້ມູນໜ້າຮ້ານ
                                    </h5>
                                    <div className="space-y-3 relative z-10">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Location</p>
                                            <p className="text-md font-black text-slate-800 dark:text-white">{selectedRow.rackLocation}</p>
                                        </div>
                                        <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-orange-100/50 dark:border-orange-500/10 space-y-2">
                                            <div className="flex justify-between items-center border-b border-orange-100/30 pb-2 mb-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">ຈຳນວນທີ່ນັບໄດ້:</span>
                                                <span className="text-lg font-black text-joah-orange">{selectedRow.qty || 0}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>CAT 1:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.category1 || '-'}</span>
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>CAT 2:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.category2 || '-'}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Master Info */}
                                <div className="p-6 bg-sky-50/50 dark:bg-sky-500/5 rounded-[2rem] border border-sky-100 dark:border-sky-500/10 relative group overflow-hidden transition-colors">
                                    <h5 className="text-[10px] font-black text-sky-500 dark:text-sky-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Database size={12} /> ຂໍ້ມູນລະບົບ
                                    </h5>
                                    <div className="space-y-3 relative z-10">
                                        <div>
                                            <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Records</p>
                                            <p className="text-md font-black text-slate-800 dark:text-white">Full Master Version</p>
                                        </div>
                                        <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-sky-100/50 dark:border-sky-500/10 space-y-2">
                                            <div className="flex justify-between items-center border-b border-sky-100/30 pb-2 mb-1">
                                                <span className="text-[10px] font-black text-slate-500 uppercase">ຈຳນວນໃນ Master:</span>
                                                <span className="text-lg font-black text-sky-500">{selectedRow.masterQty || 0}</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>Target 1:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.masterCategory1 || '-'}</span>
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>Target 2:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.masterCategory2 || '-'}</span>
                                            </p>
                                        </div>
                                        <p className="text-[8px] font-black text-sky-500 uppercase mt-2 text-center">--- Read Only Data ---</p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-4">
                                <div className="flex-1">
                                    <p className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">Last Update</p>
                                    <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">{selectedRow.updatedAt ? new Date(selectedRow.updatedAt).toLocaleString('lo-LA') : 'ບໍ່ມີຂໍ້ມູນ'}</p>
                                </div>
                                <div className="flex-1 text-right">
                                    <button
                                        onClick={() => fetchHistory(selectedRow.barcode)}
                                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all group border border-slate-200 dark:border-transparent"
                                    >
                                        <History size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">History</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* History Overlay (Slide-up inside modal) */}
                        {showHistory && (
                            <div className="absolute inset-0 z-[30] bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 animate-slide-up flex flex-col">
                                <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-900 dark:bg-joah-orange rounded-lg text-white">
                                            <History size={16} />
                                        </div>
                                        <h4 className="font-black text-slate-800 dark:text-white uppercase tracking-widest text-sm">Update History</h4>
                                    </div>
                                    <button
                                        onClick={() => setShowHistory(false)}
                                        className="w-10 h-10 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 text-slate-400 hover:text-rose-500 transition-all flex items-center justify-center"
                                    >
                                        <X size={20} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                                    {isLoadingHistory ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                                            <Loader2 className="animate-spin" size={32} />
                                            <p className="text-xs font-black uppercase tracking-widest">Loading Records...</p>
                                        </div>
                                    ) : historyData.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[2rem]">
                                            <Clock size={32} />
                                            <p className="text-xs font-black uppercase tracking-widest">No history found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {historyData.map((item, idx) => (
                                                <div key={item.id} className="p-5 bg-slate-50 dark:bg-slate-800/40 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-joah-orange/30 transition-all">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-slate-800 dark:text-white">{item.updated_by}</span>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-[10px] font-bold text-slate-400">{new Date(item.updated_at).toLocaleString('lo-LA')}</span>
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                                                            Changed from <span className="text-slate-400 line-through">{item.old_qty}</span> to <span className="text-joah-orange font-black text-xs">{item.new_qty}</span>
                                                        </p>
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 flex items-center justify-center text-joah-orange shadow-sm opacity-0 group-hover:opacity-100 transition-all">
                                                        <CheckCircle size={14} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Smart Hover Tooltip */}
            {hoveredRowInfo && (
                <div
                    className="fixed z-[999] pointer-events-none animate-in fade-in zoom-in duration-200"
                    style={{
                        left: `${hoveredRowInfo.x + 20}px`,
                        top: `${hoveredRowInfo.y + 20}px`,
                    }}
                >
                    <div className="w-[320px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className={`p-4 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800/50 ${getStatusHint(hoveredRowInfo.row).bg}/10`}>
                            <div className={`p-2 rounded-xl text-white ${getStatusHint(hoveredRowInfo.row).bg} shadow-sm`}>
                                {getStatusHint(hoveredRowInfo.row).icon}
                            </div>
                            <h4 className={`font-black text-sm uppercase tracking-tight ${getStatusHint(hoveredRowInfo.row).color}`}>
                                {getStatusHint(hoveredRowInfo.row).title}
                            </h4>
                        </div>
                        <div className="p-5 space-y-3">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">ລາຍລະອຽດສາເຫດ:</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                                    {getStatusHint(hoveredRowInfo.row).reason}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ສິ່ງທີ່ຕ້ອງເຮັດ:</p>
                                <p className="text-[11px] font-heavy text-rose-600 dark:text-rose-400 leading-relaxed font-bold">
                                    {getStatusHint(hoveredRowInfo.row).action}
                                </p>
                            </div>
                        </div>
                        <div className="bg-slate-50/50 dark:bg-slate-800/50 px-5 py-3 flex items-center justify-between border-t border-slate-50 dark:border-slate-800">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Smart Support</span>
                            <div className="flex gap-1">
                                <span className="w-1 h-1 rounded-full bg-joah-orange"></span>
                                <span className="w-1 h-1 rounded-full bg-joah-orange/50"></span>
                                <span className="w-1 h-1 rounded-full bg-joah-orange/20"></span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResultTable;
