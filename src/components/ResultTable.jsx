import { useState, useRef } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    CloudUpload, FileSpreadsheet, Info, History, Clock
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../utils/supabaseClient';
import { syncLocationResultsToSupabase } from '../utils/supabaseSync';

const ResultTable = ({
    results, rawFile, locationSheetName, filterStatus,
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
        const rect = e.currentTarget.getBoundingClientRect();
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredRowInfo({
                row,
                x: rect.left + rect.width / 2,
                y: rect.top
            });
        }, 800);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredRowInfo(null);
    };

    const getStatusHint = (status) => {
        switch (status) {
            case 'passed':
                return {
                    title: 'ຂໍ້ມູນຖືກຕ້ອງສົມບູນ',
                    reason: 'ຈຳນວນສິນຄ້າ ແລະ ສະຖານທີ່ ກົງກັບຖານຂໍ້ມູນ Master ຢ່າງສົມບູນ 100%.',
                    action: 'ບໍ່ຈຳເປັນຕ້ອງແກ້ໄຂຫຍັງ. ລະບົບຢືນຢັນວ່າຂໍ້ມູນນີ້ປົກກະຕິ!',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-500',
                    icon: <CheckCircle size={14} />
                };
            case 'mismatch':
                return {
                    title: 'ຈຳນວນບໍ່ກົງກັນ',
                    reason: 'ຈຳນວນທີ່ນັບໄດ້ໃນສະຖານທີ່ນີ້ ບໍ່ກົງກັບຈຳນວນທີ່ມີໃນລະບົບ Master Data.',
                    action: 'ກະລຸນາກວດສອບຄືນ ຫຼື ກົດປຸ່ມ "Edit" ສີແດງເພື່ອອັບເດດຈຳນວນໃຫ້ກົງກັນ.',
                    color: 'text-rose-500',
                    bg: 'bg-rose-500',
                    icon: <AlertTriangle size={14} />
                };
            default:
                return {
                    title: 'ບໍ່ພົບຂໍ້ມູນໃນລະບົບ',
                    reason: 'ບາໂຄດນີ້ບໍ່ມີຢູ່ໃນລະບົບ Master Database ເຮັດໃຫ້ບໍ່ສາມາດກວດສອບຈຳນວນໄດ້.',
                    action: 'ລອງກວດສອບບາໂຄດຄືນ ຫຼື ເພີ່ມຂໍ້ມູນສິນຄ້ານີ້ເຂົ້າໃນລະບົບກ່ອນ.',
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
        if (dbSource === 'supabase' && !employeeName.trim()) {
            alert('ກະລຸນາໃສ່ຊື່ພະນັກງານກ່ອນບັນທຶກ');
            return;
        }

        setIsUpdating(true);
        const now = new Date().toISOString();
        const oldVal = selectedRow.masterQty || 0;

        // Save name to localStorage for convenience
        localStorage.setItem('joah_employee_name', employeeName);

        // 1. Update Frontend immediately (as requested)
        if (onUpdateRowQty) {
            onUpdateRowQty(selectedRow.rowIndex, {
                masterQty: Number(editQty),
                updatedAt: now,
                updatedBy: employeeName
            });
        }

        // 2. If it's Cloud Mode, also save to DB
        try {
            if (dbSource === 'supabase') {
                // 1. Update Master Data
                const { error: masterError } = await supabase
                    .from('master_data')
                    .update({
                        qty: Number(editQty),
                        updated_at: now,
                        updated_by: employeeName
                    })
                    .eq('barcode', selectedRow.barcode);

                if (masterError) throw masterError;

                // 2. Insert into History Table
                const { error: historyError } = await supabase
                    .from('inventory_history')
                    .insert({
                        barcode: selectedRow.barcode,
                        item_name: selectedRow.masterItemName || selectedRow.itemName,
                        old_qty: oldVal,
                        new_qty: Number(editQty),
                        updated_by: employeeName,
                        updated_at: now
                    });

                if (historyError) console.error('History Log Error:', historyError);
            }
            setSelectedRow(null);
            alert('ອັບເດດຂໍ້ມູນສຳເລັດ!');
        } catch (err) {
            alert('Cloud Save Error: ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveToCloud = async () => {
        setIsSavingToCloud(true);
        try {
            const result = await syncLocationResultsToSupabase(results);
            if (result.success) {
                alert('✨ ບັນທຶກຜົນການກວດສອບລົງ Cloud (location_inventory) ສຳເລັດແລ້ວ!');
            } else {
                alert('❌ ບັນທຶກບໍ່ສຳເລັດ: ' + result.error);
            }
        } catch (e) {
            alert('❌ Error: ' + e.message);
        } finally {
            setIsSavingToCloud(false);
        }
    };

    const handleExportWithColor = async () => {
        if (!rawFile || !locationSheetName) return;
        setIsExporting(true);
        try {
            const workbook = new ExcelJS.Workbook();
            const originalWb = new ExcelJS.Workbook();
            await originalWb.xlsx.load(await rawFile.arrayBuffer());

            originalWb.eachSheet((oldSheet) => {
                const newSheet = workbook.addWorksheet(oldSheet.name);
                oldSheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
                    const newRow = newSheet.getRow(rowNumber);

                    for (let colNumber = 1; colNumber <= 10; colNumber++) {
                        const cell = row.getCell(colNumber);
                        let val = cell.value;

                        if (val && typeof val === 'object') {
                            val = val.result !== undefined ? val.result : val.text;
                        }

                        if (rowNumber > 1) {
                            const isDataSheetTarget = (oldSheet.name === 'DATA' || oldSheet.name === 'Data') && (colNumber === 3 || colNumber === 4);

                            if (val === null || val === undefined || String(val).trim() === '' || val === 0 || val === '0') {
                                if (isDataSheetTarget) {
                                    val = 'ບໍ່ມີຂໍ້ມູນ';
                                }
                            }
                        }

                        newRow.getCell(colNumber).value = val;
                    }
                    if (rowNumber === 1) newRow.font = { bold: true };
                });
            });

            const worksheet = workbook.getWorksheet(locationSheetName);
            if (!worksheet) throw new Error(`Sheet ${locationSheetName} not found`);

            const qtyCol = 7;     // Column G
            const statusCol = 8;  // Column H
            const remarkCol = 9;  // Column I
            const dateCol = 10;   // Column J
            const userCol = 11;   // Column K

            // Fix Header Names in Lao (Since the original file might have wrong names)
            const headerRow = worksheet.getRow(1);
            headerRow.getCell(qtyCol).value = 'ຈຳນວນ (QTY Cloud)';
            headerRow.getCell(statusCol).value = 'ສະຖານະກວດສອບ';
            headerRow.getCell(remarkCol).value = 'ໝາຍເຫດ (Remarks)';
            headerRow.getCell(dateCol).value = 'ວັນທີແກ້ໄຂ';
            headerRow.getCell(userCol).value = 'ຜູ້ແກ້ໄຂ (User)';

            // Apply Header Styling
            [qtyCol, statusCol, remarkCol, dateCol, userCol].forEach(colIndex => {
                const cell = headerRow.getCell(colIndex);
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF334155' } // Deep Slate
                };
                cell.alignment = { horizontal: 'center' };
            });

            results.forEach((res) => {
                const excelRowNumber = res.rowIndex + 1;
                if (excelRowNumber <= 1) return;
                const row = worksheet.getRow(excelRowNumber);

                // 1. Set QTY (from Supabase) in Column G
                row.getCell(qtyCol).value = res.masterQty || 0;

                // 2. Set Status Value in Column H
                const statusCell = row.getCell(statusCol);
                statusCell.value = res.status === 'passed' ? 'ຖືກຕ້ອງ' :
                    res.status === 'mismatch' ? 'ບໍ່ກົງກັນ' : 'ບໍ່ຄົບຖ້ວນ';

                // 3. Set Remark (Reason) in Column I - In Lao
                const remarkCell = row.getCell(remarkCol);
                remarkCell.value = res.status === 'passed' ? 'ຂໍ້ມູນຖືກຕ້ອງ' : (res.reason || 'ກວດສອບພົບຂໍ້ຜິດພາດ');

                // 4. Set Update Info in Column J & K
                row.getCell(dateCol).value = res.updatedAt ? new Date(res.updatedAt).toLocaleString('lo-LA') : '-';
                row.getCell(userCol).value = res.updatedBy || '-';

                // Color Logic for Status Cell
                let bgColor = null;
                if (res.status === 'passed') bgColor = 'CCE3F6E3'; // Soft Green
                if (res.status === 'mismatch') bgColor = 'CCF9DADA'; // Soft Red
                if (res.status === 'missing' || res.status === 'incomplete') bgColor = 'CCD1E9F6'; // Soft Blue

                if (bgColor) {
                    statusCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: bgColor }
                    };
                    statusCell.font = { bold: true };
                }

                // Color for Rack Location (Column D / 4)
                const rackCell = row.getCell(4);
                if (res.color === 'red') {
                    rackCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCF9DADA' } };
                } else if (res.color === 'blue') {
                    rackCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'CCD1E9F6' } };
                }

                const cat1Cell = row.getCell(5);
                const cat2Cell = row.getCell(6);

                const handleEmptyCell = (cell) => {
                    const val = cell.value;
                    if (val === null || val === undefined || val === '' || val === 0 || val === '0') {
                        cell.value = 'Empty';
                        cell.font = { color: { argb: 'FF0EA5E9' }, bold: true, italic: true };
                    }
                };
                handleEmptyCell(cat1Cell);
                handleEmptyCell(cat2Cell);
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Report_${rawFile.name || 'Validation'}.xlsx`;
            a.click();
        } catch (error) {
            console.error('Export Error:', error);
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
                            <th className="px-6 py-5 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] border-b border-slate-100 dark:border-slate-800" style={{ width: '100px' }}>QTY</th>
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
                                onClick={() => { setSelectedRow(row); setEditQty(row.masterQty || 0); }}
                                onMouseEnter={(e) => handleMouseEnter(e, row)}
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
                                    <span className="text-lg font-black text-slate-800 dark:text-white">{row.masterQty || 0}</span>
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
                                            Update System QTY
                                        </label>
                                        <input
                                            type="number"
                                            className="w-full h-12 bg-white dark:bg-white/5 border-2 border-slate-200 dark:border-white/5 rounded-2xl px-5 text-slate-900 dark:text-white font-black text-lg focus:outline-none focus:border-joah-orange transition-all duration-300 shadow-inner"
                                            value={editQty}
                                            onChange={(e) => setEditQty(e.target.value)}
                                            placeholder="QTY..."
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mb-2 block">
                                            Employee (ຜູ້ແກ້ໄຂ)
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
                                    disabled={isUpdating || (dbSource !== 'supabase' && dbSource !== 'local')}
                                    className="w-full h-12 bg-joah-orange hover:bg-slate-900 dark:hover:bg-white dark:hover:text-joah-orange text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
                                >
                                    {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
                                    <span>Save Changes</span>
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
                                        <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-orange-100/50 dark:border-orange-500/10 space-y-1">
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
                                            <p className="text-md font-black text-slate-800 dark:text-white">Master Data</p>
                                        </div>
                                        <div className="p-3 bg-white/50 dark:bg-slate-900/50 rounded-xl border border-sky-100/50 dark:border-sky-500/10 space-y-1">
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>Target 1:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.masterCategory1 || '-'}</span>
                                            </p>
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex justify-between">
                                                <span>Target 2:</span> <span className="font-black text-slate-800 dark:text-slate-200">{selectedRow.masterCategory2 || '-'}</span>
                                            </p>
                                        </div>
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
                    className="fixed z-[999] pointer-events-none animate-fade-in-up"
                    style={{
                        left: `${hoveredRowInfo.x}px`,
                        top: `${hoveredRowInfo.y - 10}px`,
                        transform: 'translate(-50%, -100%)'
                    }}
                >
                    <div className="w-[280px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_20px_40px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className={`p-4 flex items-center gap-3 border-b border-slate-50 dark:border-slate-800/50 ${getStatusHint(hoveredRowInfo.row.status).bg}/10`}>
                            <div className={`p-2 rounded-xl text-white ${getStatusHint(hoveredRowInfo.row.status).bg} shadow-sm`}>
                                {getStatusHint(hoveredRowInfo.row.status).icon}
                            </div>
                            <h4 className={`font-black text-sm uppercase tracking-tight ${getStatusHint(hoveredRowInfo.row.status).color}`}>
                                {getStatusHint(hoveredRowInfo.row.status).title}
                            </h4>
                        </div>
                        <div className="p-5 space-y-3">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ສາເຫດທີ່ຜິດ:</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-relaxed">
                                    {getStatusHint(hoveredRowInfo.row.status).reason}
                                </p>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800/50">
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">ວິທີແກ້ໄຂ:</p>
                                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {getStatusHint(hoveredRowInfo.row.status).action}
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
