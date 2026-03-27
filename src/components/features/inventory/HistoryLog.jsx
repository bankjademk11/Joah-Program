import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../../utils/supabaseClient';
import { X, Search, Clock, ArrowUpDown, User, Calendar, Loader2, ChevronLeft, ChevronRight, Filter, FileSpreadsheet, PlusCircle, Edit3, ChevronDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import { useLanguage } from '../../../contexts/LanguageContext';

const HistoryLog = ({ onClose, currentUser, activeBranch }) => {
    const { t } = useLanguage();
    const [historyData, setHistoryData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [actionFilter, setActionFilter] = useState('all'); // 'all', 'added', 'edited'
    const [showExportMenu, setShowExportMenu] = useState(false);

    // Refs for click outside
    const exportMenuRef = useRef(null);

    const itemsPerPage = 50;

    // Handle click outside to close dropdowns
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
        const fetchAllHistory = async () => {
            setIsLoading(true);
            try {
                let branchToFilter = currentUser?.branch_id;
                const isAdmin = currentUser?.role === 'HQ';
                
                if (isAdmin && activeBranch) {
                    branchToFilter = activeBranch === 'All Branches' ? null : activeBranch;
                }

                // 1. Fetch Edit History (filtered by branch if available)
                let editQuery = supabase
                    .from('inventory_history')
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(500);
                if (branchToFilter) editQuery = editQuery.eq('branch_id', branchToFilter);
                const { data: editData, error: editError } = await editQuery;
                if (editError) throw editError;

                // 2. Fetch Added Items History (filtered by branch if available)
                let addQuery = supabase
                    .from('added_items_log')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(500);
                if (branchToFilter) addQuery = addQuery.eq('branch_id', branchToFilter);
                const { data: addData, error: addError } = await addQuery;
                if (addError) {
                    console.warn("Added items log table might not exist yet:", addError);
                }

                // 3. Normalize and Merge Data
                const formattedEdits = (editData || []).map(item => {
                    // Priority: details (Smart Log) -> change_reason -> reason
                    let reasonDisplay = item.details || item.change_reason || item.reason;
                    const changeVal = item.new_qty - item.old_qty;

                    // 1. If reason is missing/empty
                    if (!reasonDisplay) {
                        // If Qty didn't change, it must be a Data/Location update
                        if (changeVal === 0) reasonDisplay = 'ແກ້ໄຂຂໍ້ມູນ/ໂລເຄຊັ້ນ';
                        else reasonDisplay = 'ແກ້ໄຂຈຳນວນ';
                    }

                    // 2. Translate common English phrases
                    if (reasonDisplay === 'Manual Qty Update') {
                        if (changeVal === 0) reasonDisplay = 'ແກ້ໄຂຂໍ້ມູນ (Manual)';
                        else reasonDisplay = 'ແກ້ໄຂຈຳນວນ (Manual)';
                    }
                    if (reasonDisplay === 'qty update') reasonDisplay = 'ປັບປຸງຈຳນວນ';
                    if (reasonDisplay === 'No key changes detected') reasonDisplay = 'ກົດບັນທຶກ (ບໍ່ມີການປ່ຽນແປງ)';

                    // 3. Translate Partial Phrases (Smart Replace)
                    if (String(reasonDisplay).includes('Moved to')) reasonDisplay = String(reasonDisplay).replace('Moved to', 'ຍ້າຍໄປ');
                    if (String(reasonDisplay).includes('ຍ້າຍ:')) reasonDisplay = reasonDisplay; // Keep original Lao log from ResultTable
                    if (String(reasonDisplay).includes('Direct Addition')) reasonDisplay = 'ເພີ່ມເຂົ້າລະບົບໂດຍກົງ';

                    return {
                        ...item,
                        type: 'edited',
                        timestamp: item.updated_at,
                        user: item.updated_by,
                        change_qty: changeVal,
                        details: reasonDisplay
                    };
                });

                const formattedAdds = (addData || []).map(item => {
                    // Cross-reference: find the matching inventory_history entry
                    // to get the REAL reason (added_items_log doesn't store it)
                    const addedTime = new Date(item.created_at).getTime();
                    const matchingHistory = (editData || []).find(e =>
                        e.barcode === item.barcode &&
                        e.old_qty === 0 &&
                        Math.abs(new Date(e.updated_at).getTime() - addedTime) < 120000 // within 2 minutes
                    );

                    const realReason = matchingHistory?.change_reason ||
                        matchingHistory?.details ||
                        item.reason || item.remarks ||
                        'ເພີ່ມສິນຄ້າໃໝ່ຜ່ານ Dashboard';

                    return {
                        ...item,
                        type: 'added',
                        timestamp: item.created_at,
                        user: item.added_by,
                        old_qty: 0,
                        new_qty: item.qty,
                        change_qty: item.qty,
                        details: realReason
                    };
                });

                // Combine and Sort
                const combined = [...formattedEdits, ...formattedAdds].sort((a, b) =>
                    new Date(b.timestamp) - new Date(a.timestamp)
                );

                setHistoryData(combined);
            } catch (err) {
                console.error('Error fetching history:', err);
                // alert('Error fetching history: ' + err.message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllHistory();
    }, [currentUser, activeBranch]);

    // Reset page on search/filter
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, startDate, endDate, actionFilter]);

    // Filtering Logic
    const filteredData = historyData.filter(log => {
        // Text Search
        const matchesSearch = (log.user || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.barcode || '').includes(searchTerm);

        // Date Filter
        const logDate = new Date(log.timestamp).setHours(0, 0, 0, 0);
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const end = endDate ? new Date(endDate).setHours(0, 0, 0, 0) : null;
        const matchesDate = (!start || logDate >= start) && (!end || logDate <= end);

        // Type Action Filter
        const matchesType = actionFilter === 'all' || log.type === actionFilter;

        return matchesSearch && matchesDate && matchesType;
    });

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentItems = filteredData.slice(startIndex, startIndex + itemsPerPage);

    // --- Export Logic (ExcelJS) ---
    const handleExport = async (template = 'all') => {
        try {
            setShowExportMenu(false);
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('History Log');

            // Determine data source based on template
            let dataToExport = [...filteredData]; // Default: whatever is currently filtered

            if (template === 'added') {
                dataToExport = historyData.filter(d => d.type === 'added');
            } else if (template === 'edited') {
                dataToExport = historyData.filter(d => d.type === 'edited');
            } else if (template === 'changes') {
                // Combined: Rack Movement + Category Changes
                dataToExport = historyData.filter(d => {
                    const isEdited = d.type === 'edited';
                    if (!isEdited) return false;

                    // Normalize helper: Treat null, undefined, "" as equivalent
                    const norm = (val) => (val === null || val === undefined) ? '' : String(val).trim();

                    // Check actual value changes
                    const rackChanged = norm(d.old_rack) !== norm(d.new_rack);
                    const cat1Changed = norm(d.old_category_1) !== norm(d.new_category_1);
                    const cat2Changed = norm(d.old_category_2) !== norm(d.new_category_2);

                    if (rackChanged || cat1Changed || cat2Changed) return true;

                    // Fallback: Check details text ONLY if it clearly indicates movement/category change
                    // Avoiding generic 'Category' which might appear in other contexts if not careful
                    const details = String(d.details || '');
                    const isMovement = details.includes('ຍ້າຍ') || (details.includes('Rack') && !details.includes('Qty'));
                    const isCatChange = details.includes('ໝວດໝູ່') || (details.includes('Category') && !details.includes('Qty'));

                    return isMovement || isCatChange;
                });
            }

            if (dataToExport.length === 0) {
                alert('No data to export for this selection');
                return;
            }

            // Columns
            sheet.columns = [
                { header: 'ບາໂຄ້ດ', key: 'barcode', width: 15 },
                { header: 'ປະເພດ', key: 'type', width: 15 },
                { header: 'ຜູ້ດຳເນີນການ', key: 'user', width: 25 },
                { header: 'ເວລາ', key: 'time', width: 20 },
                { header: 'ຊື່ສິນຄ້າ', key: 'item', width: 40 },
                { header: 'ພິກັດເກົ່າ (Old Rack)', key: 'old_rack', width: 15 },
                { header: 'ພິກັດໃໝ່ (New Rack)', key: 'new_rack', width: 15 },
                { header: 'Category 1 ເກົ່າ', key: 'old_cat1', width: 18 },
                { header: 'Category 1 ໃໝ່', key: 'new_cat1', width: 18 },
                { header: 'Category 2 ເກົ່າ', key: 'old_cat2', width: 18 },
                { header: 'Category 2 ໃໝ່', key: 'new_cat2', width: 18 },
                { header: 'ຈຳນວນເກົ່າ', key: 'old', width: 10 },
                { header: 'ຈຳນວນໃຫມ່', key: 'new', width: 10 },
                { header: 'ປ່ຽນເເປງ', key: 'change', width: 10 },
                { header: 'ລາຍລະອຽດ/ເຫດຜົນ', key: 'details', width: 30 },
            ];

            // Style Header
            const headerRow = sheet.getRow(1);
            headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            headerRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4F46E5' } // Indigo color
            };

            // Add Rows
            dataToExport.forEach(log => {
                const row = sheet.addRow({
                    time: new Date(log.timestamp).toLocaleString('lo-LA'),
                    type: log.type === 'added' ? 'ເພີ່ມສິນຄ້າໃໝ່' : 'ແກ້ໄຂຈຳນວນ',
                    user: log.user,
                    barcode: log.barcode,
                    item: log.item_name,
                    old_rack: log.old_rack || '-',  // ✅ New
                    new_rack: log.new_rack || '-',  // ✅ New
                    old_cat1: log.old_category_1 || '-',  // ✅ New
                    new_cat1: log.new_category_1 || '-',  // ✅ New
                    old_cat2: log.old_category_2 || '-',  // ✅ New
                    new_cat2: log.new_category_2 || '-',  // ✅ New
                    old: log.old_qty,
                    new: log.new_qty,
                    change: log.change_qty > 0 ? `+${log.change_qty}` : log.change_qty,
                    details: log.details
                });

                // Conditional Coloring
                const typeCell = row.getCell('type');
                if (log.type === 'added') {
                    typeCell.font = { color: { argb: 'FF16A34A' }, bold: true, name: 'Phetsarath OT' }; // Green
                } else {
                    typeCell.font = { color: { argb: 'FFF59E0B' }, bold: true, name: 'Phetsarath OT' }; // Amber
                }
            });

            // --- Apply Font 'Phetsarath OT' to All Cells ---
            sheet.eachRow((row) => {
                row.eachCell((cell) => {
                    const currentFont = cell.font || {};
                    cell.font = {
                        ...currentFont,
                        name: 'Phetsarath OT',
                        size: currentFont.size || 11
                    };
                });
            });
            // -----------------------------------------------

            // Download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `History_Log_${template}_${new Date().toISOString().split('T')[0]}.xlsx`;
            anchor.click();
            window.URL.revokeObjectURL(url);

        } catch (error) {
            console.error('Export error:', error);
            alert('Export failed: ' + error.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-slate-900/60 animate-fade-in">
            <div className="glass-card-dark w-full max-w-6xl h-[90vh] rounded-[2.5rem] p-8 border border-slate-700/50 shadow-2xl flex flex-col relative bg-white dark:bg-slate-900 text-slate-900 dark:text-white">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">ປະຫວັດການເຄື່ອນໄຫວ (System Audit)</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Full System Logs (Adds & Edits)</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col xl:flex-row items-center gap-4 mb-6 flex-shrink-0">
                    {/* Search */}
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder={t('history.searchPlaceholder')}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold transition-all placeholder:font-normal"
                        />
                    </div>

                    {/* Filters & Actions Group */}
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">

                        {/* Action Filter */}
                        <div className="relative">
                            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                            <select
                                value={actionFilter}
                                onChange={(e) => setActionFilter(e.target.value)}
                                className="appearance-none pl-10 pr-10 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer min-w-[160px]"
                            >
                                <option value="all">{t('history.filterAll')}</option>
                                <option value="added">{t('history.filterAdded')}</option>
                                <option value="edited">{t('history.filterEdited')}</option>
                                <option value="changes">{t('history.filterChanges')}</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>

                        {/* Date Range */}
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-36 px-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <span className="text-slate-300">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-36 px-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                        </div>

                        <div className="w-px h-10 bg-slate-200 dark:bg-slate-800 mx-1"></div>

                        {/* Export Button */}
                        <div className="relative" ref={exportMenuRef}>
                            <button
                                onClick={() => setShowExportMenu(!showExportMenu)}
                                className="flex items-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-500/20 active:scale-95 transition-all text-sm"
                            >
                                <FileSpreadsheet size={18} />
                                <span>Export</span>
                                <ChevronDown size={14} />
                            </button>

                            {showExportMenu && (
                                <div className="absolute right-0 top-full mt-3 w-72 bg-white dark:bg-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100 dark:border-slate-700 overflow-hidden z-[999] animate-scale-in origin-top-right">
                                    <div className="p-3 space-y-1">
                                        <div className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 dark:border-slate-800/50 mb-2">
                                            {t('history.selectTemplate')}
                                        </div>

                                        <button
                                            onClick={() => handleExport('all')}
                                            className="w-full text-left px-4 py-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700/50 group transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-slate-400 group-hover:text-joah-orange transition-colors">
                                                    <FileSpreadsheet size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{t('history.currentView')}</p>
                                                    <span className="text-[10px] text-slate-400 font-medium">{t('history.currentViewDesc')}</span>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleExport('added')}
                                            className="w-full text-left px-4 py-4 rounded-2xl hover:bg-emerald-50 dark:hover:bg-emerald-500/5 group transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <PlusCircle size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{t('history.addedOnly')}</p>
                                                    <span className="text-[10px] text-slate-400 font-medium">{t('history.addedOnlyDesc')}</span>
                                                </div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleExport('edited')}
                                            className="w-full text-left px-4 py-4 rounded-2xl hover:bg-amber-50 dark:hover:bg-amber-500/5 group transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center text-amber-500">
                                                    <Edit3 size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{t('history.editedOnly')}</p>
                                                    <span className="text-[10px] text-slate-400 font-medium">{t('history.editedOnlyDesc')}</span>
                                                </div>
                                            </div>
                                        </button>


                                        <button
                                            onClick={() => handleExport('changes')}
                                            className="w-full text-left px-4 py-4 rounded-2xl hover:bg-purple-50 dark:hover:bg-purple-500/5 group transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-500/10 flex items-center justify-center text-purple-500">
                                                    <ArrowUpDown size={18} />
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-purple-700 dark:text-purple-400">{t('history.changesOnly')}</p>
                                                    <span className="text-[10px] text-slate-400 font-medium">{t('history.changesOnlyDesc')}</span>
                                                </div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto custom-scrollbar rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                            <tr>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800">{t('history.timeAction')}</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800">{t('history.user')}</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800 w-1/3">{t('history.itemDetail')}</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">{t('history.change')}</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <Loader2 className="animate-spin" size={32} />
                                            <span className="text-xs font-bold uppercase">{t('common.loading')}</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                currentItems.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors group">
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    {row.type === 'added' ? (
                                                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                            <PlusCircle size={10} strokeWidth={3} /> {t('history.added')}
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                                            <Edit3 size={10} strokeWidth={3} /> {t('history.edited')}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(row.timestamp).toLocaleDateString('lo-LA')}</span>
                                                <span className="text-xs text-slate-400 font-mono">{new Date(row.timestamp).toLocaleTimeString('lo-LA')}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-xl flex items-center justify-center ${row.type === 'added' ? 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/20' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                                                    }`}>
                                                    <User size={16} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.user || 'Unknown'}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">ຜູ້ທຳລາຍການ</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-black text-slate-800 dark:text-white font-mono tracking-tight">{row.barcode}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]" title={row.item_name}>{row.item_name || '-'}</span>
                                                {row.details && (
                                                    <span className="text-[10px] text-slate-400 italic mt-0.5">"{row.details}"</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-xl border ${row.type === 'added'
                                                ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800/50'
                                                : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                                }`}>
                                                {row.type === 'edited' && (
                                                    <>
                                                        <span className="text-sm font-mono text-slate-500 line-through opacity-50">{row.old_qty}</span>
                                                        <ArrowUpDown size={14} className="rotate-90 text-slate-400" />
                                                    </>
                                                )}
                                                <span className={`text-xl font-black font-mono ${row.type === 'added' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                                                    {row.new_qty}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-300 dark:text-slate-700">
                                            <Search size={48} strokeWidth={1} className="mb-4 opacity-50" />
                                            <p className="text-lg font-black">ບໍ່ພົບຂໍ້ມູນໃນປະຫວັດ</p>
                                            <p className="text-sm font-medium opacity-70">ກະລຸນາລອງຄົ້ນຫາໃໝ່ ຫຼື ປ່ຽນເງື່ອນໄຂຕົວລັບ (Filter).</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Showing <span className="text-slate-900 dark:text-white">{Math.min(startIndex + 1, filteredData.length)}-{Math.min(startIndex + itemsPerPage, filteredData.length)}</span> of <span className="text-slate-900 dark:text-white">{filteredData.length}</span> logs</p>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30">
                            <ChevronLeft size={20} />
                        </button>
                        <div className="flex items-center px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-black text-slate-900 dark:text-white">
                            {currentPage} / {totalPages || 1}
                        </div>
                        <button onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages || totalPages === 0} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-30">
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HistoryLog;
