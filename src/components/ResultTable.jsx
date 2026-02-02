import { useState, useRef, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    CloudUpload, FileSpreadsheet, Info, History, Clock,
    ArrowUpDown, FilterX, HelpCircle, Package, Calendar, User, RotateCw, Plus, Eye, ClipboardList
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../utils/supabaseClient';
import { syncLocationResultsToSupabase, syncMasterDataToSupabase, fetchMasterFromSupabase, addLocationRecord, logInventoryHistory } from '../utils/supabaseSync';
import { readExcelFromUrl, sheetToJSON, readExcelFile } from '../utils/excelProcessor';
import databaseUrl from '../assets/DataBaseJoah.xlsx';

const ResultTable = ({
    results, masterData, rawFile, locationSheetName, filterStatus,
    onFilterChange, dbSource, onRefresh, onUpdateRowQty, currentUser, onAddNewProduct
}) => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [isSavingToCloud, setIsSavingToCloud] = useState(false);
    const [selectedRow, setSelectedRow] = useState(null);
    const [isUpdating, setIsUpdating] = useState(false);
    const [editQty, setEditQty] = useState('');
    const [editLocation, setEditLocation] = useState('');
    const [editCat1, setEditCat1] = useState('');
    const [editCat2, setEditCat2] = useState('');
    const [editReason, setEditReason] = useState('');
    const [employeeName, setEmployeeName] = useState(localStorage.getItem('joah_employee_name') || '');
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [diagnosticRow, setDiagnosticRow] = useState(null);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
    const [isFoundInMaster, setIsFoundInMaster] = useState(false); // New state to track if barcode exists in Master Data
    const [quickAddForm, setQuickAddForm] = useState({
        barcode_no: '',
        item_name: '',
        rack_location: '',
        category_1_actual: '',
        category_2_actual: '',
        qty: 0,
        remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
    });
    const [inspectedLocation, setInspectedLocation] = useState(null); // New state for location inspector
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // New sort state

    // --- Helper to render Location Contents Inspector ---
    const renderLocationInspector = () => {
        if (!inspectedLocation) return null;

        const itemsInLocation = results.filter(r => r.rackLocation === inspectedLocation);

        return (
            // Changed from centered modal to Right Side Floating Card
            // High Z-Index ensures it floats above everything else
            // Vertically centered to match the Edit Modal position
            <div className="fixed top-1/2 right-6 -translate-y-1/2 w-96 z-[9999] animate-slide-in-right pointer-events-none">
                {/* pointer-events-auto inside card so user can scroll/click close */}
                <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[75vh] pointer-events-auto relative overflow-hidden">
                    {/* Decorative Background Blob to match Edit Modal */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>

                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-[2rem] relative z-10">
                        <div>
                            <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                                <div className="p-2 bg-joah-orange text-white shadow-lg shadow-orange-500/20 rounded-xl">
                                    <MapPin size={18} />
                                </div>
                                {inspectedLocation}
                            </h3>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest pl-1">
                                {itemsInLocation.length} ITEMS FOUND
                            </p>
                        </div>
                        <button
                            onClick={() => setInspectedLocation(null)}
                            className="p-2 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 rounded-xl text-slate-400 transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-4 overflow-y-auto custom-scrollbar space-y-3 flex-1 min-h-0 relative z-10">
                        {itemsInLocation.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <Package size={40} className="mx-auto mb-3 opacity-40" />
                                <p className="font-bold text-sm">Empty Rack</p>
                                <p className="text-[10px]">No items found here.</p>
                            </div>
                        ) : (
                            itemsInLocation.map((item, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all group">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-[9px] font-black rounded-lg text-slate-500 font-mono">
                                            {item.barcode}
                                        </span>
                                        <span className="text-[9px] font-bold text-joah-orange bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg">
                                            {item.category2 || item.category1}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end gap-3">
                                        <h4 className="font-bold text-slate-700 dark:text-slate-200 text-xs line-clamp-2 leading-tight flex-1" title={item.itemName || item.masterItemName}>
                                            {item.itemName || item.masterItemName || 'Unknown Item'}
                                        </h4>
                                        <div className="text-right min-w-[3rem]">
                                            <span className="block text-base font-black text-slate-900 dark:text-white leading-none">
                                                {item.qty}
                                            </span>
                                            <span className="text-[8px] font-bold text-slate-400 uppercase">QTY</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // --- Smart Automation Rules (Mapdata.MD - NEW FORMAT with Section Numbers) ---
    // Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)
    const CATEGORY_RACK_RULES = {
        'KITCHEN': [
            { zones: ['G01', 'G02', 'G03', 'G04', 'G05', 'G06', 'G07', 'G08', 'H02', 'H03', 'H04'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນ G9', 'ໂລພື້ນ G10', 'ໂລພື້ນ G11'], maxLevel: 0, maxSections: 0 }
        ],
        'BEAUTY': [
            { zones: ['E01', 'E02', 'E03', 'E04'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນE 5', 'ໂລພື້ນE 7', 'ໂລພື້ນE 8'], maxLevel: 0, maxSections: 0 }
        ],
        'STATIONERY': [
            { zones: ['S01', 'S02', 'S03', 'S05', 'S06', 'S07', 'S08'], maxLevel: 5, maxSections: 4 },
            { zones: ['S10'], maxLevel: 4, maxSections: 4 }
        ],
        'TOYS': [
            { zones: ['S09'], maxLevel: 5, maxSections: 4 }
        ],
        'CLEANING/BATH': [
            { zones: ['A01', 'A02', 'A03', 'A05'], maxLevel: 5, maxSections: 4 },
            { zones: ['A04'], maxLevel: 6, maxSections: 4 }
        ],
        'INTERIOR': [
            { zones: ['B01'], maxLevel: 3, maxSections: 4 },
            { zones: ['B02', 'B03', 'B04'], maxLevel: 4, maxSections: 4 }
        ],
        'TOOL/DIGITAL': [
            { zones: ['F01', 'F02', 'F03', 'F04'], maxLevel: 5, maxSections: 5 }
        ],
        'STORAGE': [
            { zones: ['D01', 'D02', 'D03', 'D04', 'D05', 'D06'], maxLevel: 5, maxSections: 4 },
            { zones: ['ໂລພື້ນ D07', 'ໂລພື້ນ D08'], maxLevel: 0, maxSections: 0 }
        ],
        'FASHION': [
            { zones: ['C01', 'C02', 'C03', 'C04'], maxLevel: 5, maxSections: 4 }
        ],
        'SPORTS/LEISURE': [
            { zones: ['H01'], maxLevel: 5, maxSections: 4 }
        ]
    };

    const getRackSuggestions = (category) => {
        const rules = CATEGORY_RACK_RULES[String(category).toUpperCase()];
        if (!rules) return [];

        const suggestions = [];
        rules.forEach(rule => {
            rule.zones.forEach(zone => {
                if (rule.maxLevel === 0) {
                    // Floor storage - no level/section
                    suggestions.push(zone);
                } else {
                    // Generate ZONE-LEVEL-SECTION format (e.g., G01-L1-1, G01-L1-2)
                    for (let level = 1; level <= rule.maxLevel; level++) {
                        for (let section = 1; section <= rule.maxSections; section++) {
                            suggestions.push(`${zone}-L${level}-${section}`);
                        }
                    }
                }
            });
        });
        return suggestions;
    };

    const ALL_DISTINCT_ZONES = Array.from(new Set(Object.values(CATEGORY_RACK_RULES).flatMap(group => group.flatMap(rule => rule.zones))));

    // Auto-fill from Master Data when Barcode changes
    useEffect(() => {
        if (showQuickAdd && quickAddForm.barcode_no) {
            const barcode = String(quickAddForm.barcode_no).trim();
            const masterItem = masterData.find(m =>
                String(m.barcode || m.Barcode || m['Barcode No.'] || '').trim() === barcode
            );

            if (masterItem) {
                setIsFoundInMaster(true); // Found in Master Data
                const itemNameValue = masterItem.item_name || masterItem.product_name_la || masterItem['Product Name(LA)'] || masterItem['Item Name'] || '';
                const cat1Value = masterItem.category_1 || masterItem['CATEGORIES 1'] || masterItem['Category 1'] || '';
                const cat2Value = masterItem.category_2 || masterItem['CATEGORIES 2'] || masterItem['Category 2'] || '';

                setQuickAddForm(prev => ({
                    ...prev,
                    item_name: String(itemNameValue).trim(),
                    category_1_actual: String(cat1Value).trim(),
                    category_2_actual: String(cat2Value).trim()
                }));
            } else {
                setIsFoundInMaster(false); // NOT found in Master Data - Lock fields
                // BUG FIX: If not found in master, clear the fields so they don't 'ghost' from the previous item
                setQuickAddForm(prev => ({
                    ...prev,
                    item_name: '',
                    category_1_actual: '',
                    category_2_actual: '',
                    qty: 0,
                    rack_location: ''
                }));
            }
        }
    }, [quickAddForm.barcode_no, showQuickAdd, masterData]);

    const itemsPerPage = 50;
    const rowRefs = useRef({}); // Store refs for each barcode row

    const filteredResults = results
        .filter(row => {
            const matchesSearch =
                (row.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.rackLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.masterItemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter =
                filterStatus === 'all' ||
                row.status === filterStatus ||
                (filterStatus === 'missing' && row.status === 'incomplete') ||
                (filterStatus === 'zero' && parseFloat(row.qty) === 0) ||
                (filterStatus === 'hasQty' && parseFloat(row.qty) > 0);
            return matchesSearch && matchesFilter;
        })
        .sort((a, b) => {
            if (!sortConfig.key) return 0;
            let valA = a[sortConfig.key];
            let valB = b[sortConfig.key];

            if (sortConfig.key === 'qty') {
                valA = parseFloat(valA) || 0;
                valB = parseFloat(valB) || 0;
            } else {
                valA = String(valA || '').toLowerCase();
                valB = String(valB || '').toLowerCase();
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        setCurrentPage(1);
    };

    // Auto-scroll logic when searching for an exact barcode
    useEffect(() => {
        if (searchTerm && searchTerm.length >= 4) {
            const exactMatch = results.find(r => r.barcode === searchTerm);
            if (exactMatch && rowRefs.current[exactMatch.barcode]) {
                rowRefs.current[exactMatch.barcode].scrollIntoView({
                    behavior: 'smooth',
                    block: 'center'
                });
            }
        }
    }, [searchTerm, results]);

    const totalPages = Math.ceil(filteredResults.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentResults = filteredResults.slice(startIndex, endIndex);

    const getStatusHint = (row) => {
        if (!row) return null;
        const { status, category1, category2, masterCategory1, masterCategory2, reason } = row;

        switch (status) {
            case 'passed':
                return {
                    title: 'ຂໍ້ມູນຖືກຕ້ອງສົມບູນ',
                    reason: 'ທຸກຢ່າງກົງກັນ 100% ທັງໝວດໝູ່ ແລະ ສະຖານທີ່ວາງເຄື່ອງ.',
                    action: 'ຂໍ້ມູນນີ້ສົມບູນແລ້ວ, ບໍ່ຕ້ອງມີການແກ້ໄຂເພີ່ມເຕີມ.',
                    color: 'text-emerald-500',
                    bg: 'bg-emerald-500',
                    icon: <CheckCircle size={24} />
                };
            case 'mismatch':
                const isRackError = reason?.includes('ວາງຜິດ Rack');
                const isCat1Error = reason?.includes('Cat-1 ບໍ່ກົງ');
                const isCat2Error = reason?.includes('Cat-2 ບໍ່ກົງ');

                return {
                    title: 'ພົບຂໍ້ຜິດພາດ (Mismatch)',
                    reason: reason || 'ຂໍ້ມູນບໍ່ກົງກັບຖານຂໍ້ມູນ Master',
                    action: 'ກະລຸນາແກ້ໄຂຂໍ້ມູນ ຫຼື ຍ້າຍສินຄ້າໄປວາງໃຫ້ຖືກຕ້ອງຕາມທີ່ລະບົບແນະນຳ.',
                    fixSteps: [
                        isCat1Error && `ປ່ຽນ ໝວດໝູ່ 1 ເປັນ: "${masterCategory1}"`,
                        isCat2Error && `ປ່ຽນ ໝວດໝູ່ 2 ເປັນ: "${masterCategory2}"`,
                        isRackError && `ຍ້າຍສິນຄ້າໄປວາງຢູ່ Rack: ${reason.split('ຄວນແມ່ນ ')[1]?.split(')')[0] || 'ໂຊนທີ່ຖືກຕ້ອງ'}`
                    ].filter(Boolean),
                    color: 'text-rose-500',
                    bg: 'bg-rose-500',
                    icon: <AlertTriangle size={24} />
                };
            case 'missing':
                return {
                    title: 'ບໍ່ພົບໃນລະບົບ Master',
                    reason: `ບາໂຄ້ດ [${row.barcode}] ນີ້ ບໍ່ມີຢູ່ໃນຖານຂໍ້ມູນສິນຄ້າຫຼັກ.`,
                    action: 'ກະລຸນາກວດສອບບາໂຄ້ດຄືນ ຫຼື ເພີ່ມສິນຄ້ານີ້ເຂົ້າໃນລະບົບ "ຈັດການສິນຄ້າ" ກ່ອນ.',
                    color: 'text-sky-500',
                    bg: 'bg-sky-500',
                    icon: <Search size={24} />
                };
            default:
                return {
                    title: 'ຂໍ້ມູນ Master ບໍ່ສົມບູນ',
                    reason: 'ພົບບາໂຄ້ດໃນລະບົບ ແຕ່ຂໍ້ມູນໃນ Master ຍັງບໍ່ທັນຄົບຖ້ວນ.',
                    action: 'ກະລຸນາໄປທີ່ໜ້າ "ຈັດການສິນຄ້າ" ເພື່ອອັບເດດຂໍ້ມູນໝວດໝູ່ໃຫ້ຄົບຖ້ວນ.',
                    color: 'text-amber-500',
                    bg: 'bg-amber-500',
                    icon: <Info size={24} />
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
        const activeUser = currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

        if (dbSource === 'supabase' && !activeUser) {
            alert('Error: User not identified. Please login again.');
            return;
        }

        setIsUpdating(true);
        const now = new Date().toISOString();
        const newQtyValue = Number(editQty);
        const oldQtyValue = selectedRow.qty || 0;

        if (onUpdateRowQty) {
            onUpdateRowQty(selectedRow.rowIndex, {
                qty: newQtyValue,
                rackLocation: editLocation || selectedRow.rackLocation,
                category1: editCat1 || selectedRow.category1,
                category2: editCat2 || selectedRow.category2,
                updatedAt: now,
                updatedBy: activeUser,
                uploadedBy: activeUser,
                manualReason: editReason // Store the user's manual reason separately
            });
        }

        try {
            if (dbSource === 'supabase') {
                if (!selectedRow.id) throw new Error("ບໍ່ພົບ Record ID ໃນຖານຂໍ້ມູນ.");

                const { error: locError } = await supabase
                    .from('location_inventory')
                    .update({
                        qty: newQtyValue,
                        rack_location: editLocation || selectedRow.rackLocation,
                        category_1_actual: editCat1 || selectedRow.category1,
                        category_2_actual: editCat2 || selectedRow.category2,
                        remarks: `Updated by ${activeUser} at ${now}`,
                        uploaded_by: activeUser // Update uploader on edit
                    })
                    .eq('id', selectedRow.id);
                if (locError) throw locError;

                // Log History
                await logInventoryHistory({
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.masterItemName || selectedRow.itemName,
                    oldQty: oldQtyValue,
                    newQty: newQtyValue,
                    updatedBy: activeUser,
                    reason: editReason || (editLocation !== selectedRow.rackLocation ? `Moved to ${editLocation}` : 'Manual Qty Update')
                });
            }
            setSelectedRow(null);
            setEditReason(''); // Reset reason
        } catch (err) {
            alert('❌ ບໍ່ສາມາດບັນທຶກໄດ້: ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleQuickAddSave = async () => {
        if (!quickAddForm.barcode_no || !quickAddForm.rack_location) {
            alert('ກະລຸນາປ້ອນ ບາໂຄ້ດ ແລະ ສະຖານທີ່ວາງເຄື່ອງ');
            return;
        }

        setIsSavingQuickAdd(true);
        try {
            const activeUser = currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');
            const result = await addLocationRecord({ ...quickAddForm, uploaded_by: activeUser });
            if (result.success) {
                // Log History for New Item
                await logInventoryHistory({
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    oldQty: 0,
                    newQty: quickAddForm.qty,
                    updatedBy: activeUser,
                    reason: quickAddForm.remarks || 'Direct Addition to Inventory'
                });

                // --- NEW: Log to dedicated "Added Items" Log (For Tracking New Insertions) ---
                const { error: logError } = await supabase.from('added_items_log').insert({
                    barcode: quickAddForm.barcode_no,
                    item_name: quickAddForm.item_name,
                    qty: quickAddForm.qty,
                    added_by: activeUser,
                    location: quickAddForm.rack_location
                });
                if (logError) console.error("Failed to log added item:", logError);
                // --------------------------------------------------------------------------

                alert('✅ ເພີ່ມຂໍ້ມູນເຂົ້າ Inventory ສຳເລັດແລ້ວ!');
                setShowQuickAdd(false);
                onRefresh();
            } else {
                alert('❌ ເພີ່ມບໍ່ສຳເລັດ: ' + result.error);
            }
        } catch (error) {
            alert('Error: ' + error.message);
        } finally {
            setIsSavingQuickAdd(false);
        }
    };

    const handleExportWithColor = async (template = 'standard') => {
        setIsExporting(true);
        setShowExportDropdown(false);
        const sanitize = (value) => {
            if (value === null || value === undefined) return '';
            if (typeof value === 'string') {
                return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
            }
            return value;
        };

        try {
            const workbook = new ExcelJS.Workbook();
            const dataToExport = template === 'audit' ? results.filter(res => res.status !== 'passed') : [...results];

            if (dbSource === 'supabase') {
                if (template === 'audit') {
                    // --- SPLIT SHEET LOGIC FOR AUDIT ---

                    // 1. Mismatch Sheet
                    const mismatchData = results.filter(res => res.status === 'mismatch');
                    const sheetMismatch = workbook.addWorksheet('Mismatch Focus');
                    const headersAudit = ['Barcode No.', 'Item Name', 'Rack Location', 'Status', 'Status Reason', 'Last Update', 'Verifier'];

                    const hRow1 = sheetMismatch.addRow(headersAudit);
                    hRow1.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }; // Rose-600
                    });

                    mismatchData.forEach(res => {
                        const rowData = [
                            sanitize(res.barcode),
                            sanitize(res.masterItemName || res.itemName || ''),
                            sanitize(res.rackLocation || ''),
                            'Mismatch',
                            sanitize(res.reason || ''),
                            res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                            sanitize(res.uploadedBy || res.updatedBy || '')
                        ];
                        const row = sheetMismatch.addRow(rowData);
                        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Red-50
                    });
                    sheetMismatch.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 12 }, { width: 35 }, { width: 15 }, { width: 20 }];

                    // 2. Missing Sheet
                    const missingData = results.filter(res => res.status === 'missing');
                    const sheetMissing = workbook.addWorksheet('Missing Items');

                    const hRow2 = sheetMissing.addRow(headersAudit);
                    hRow2.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Slate-600
                    });

                    missingData.forEach(res => {
                        const rowData = [
                            sanitize(res.barcode),
                            sanitize(res.masterItemName || res.itemName || ''),
                            sanitize(res.rackLocation || ''),
                            'Missing',
                            sanitize(res.reason || 'Not found in inventory'),
                            res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                            sanitize(res.uploadedBy || res.updatedBy || '')
                        ];
                        const row = sheetMissing.addRow(rowData);
                        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Slate-100
                    });
                    sheetMissing.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 12 }, { width: 35 }, { width: 15 }, { width: 20 }];

                } else if (template === 'odoo-adjustment') {
                    // --- ODOO ADJUSTMENT SHEET LOGIC ---
                    const adjData = results.filter(res => {
                        const actual = Number(res.qty || 0);
                        const odoo = Number(res.odooQty || 0);
                        return (res.odooQty !== undefined && res.odooQty !== null) && (actual !== odoo);
                    });

                    const sheetAdj = workbook.addWorksheet('Odoo Adjustment');
                    const headersAdj = [
                        'Barcode', 'Product Name', 'Odoo Qty (System)', 'Actual Count', 'Diff (+/-)', 'Status', 'Note'
                    ];

                    const hRow = sheetAdj.addRow(headersAdj);
                    hRow.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7C3AED' } }; // Purple-600
                        cell.alignment = { horizontal: 'center' };
                    });

                    adjData.forEach(res => {
                        const actual = Number(res.qty || 0);
                        const odoo = Number(res.odooQty || 0);
                        const diff = actual - odoo;

                        const rowData = [
                            sanitize(res.barcode),
                            sanitize(res.masterItemName || res.itemName || ''),
                            isNaN(odoo) ? 0 : odoo,
                            isNaN(actual) ? 0 : actual,
                            isNaN(diff) ? 0 : diff,
                            sanitize(diff < 0 ? 'Loss (Missing)' : 'Gain (Found)'),
                            ''
                        ];

                        const row = sheetAdj.addRow(rowData);

                        // Set number format for numeric columns
                        row.getCell(3).numFmt = '0';
                        row.getCell(4).numFmt = '0';
                        row.getCell(5).numFmt = '0';

                        // Alignment
                        row.getCell(3).alignment = { horizontal: 'center' };
                        row.getCell(4).alignment = { horizontal: 'center' };
                        row.getCell(5).alignment = { horizontal: 'center' };

                        // Color for diff column
                        if (diff < 0) {
                            row.getCell(5).font = { bold: true, color: { argb: 'FFDC2626' } };
                        } else if (diff > 0) {
                            row.getCell(5).font = { bold: true, color: { argb: 'FF16A34A' } };
                        }
                    });

                    sheetAdj.columns = [
                        { width: 16 }, { width: 40 }, { width: 15 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 30 }
                    ];

                } else {
                    // --- STANDARD / SIMPLE LOGIC ---
                    const sheetName = template === 'simple' ? 'Inventory Summary' : 'Location Inventory';
                    const locationSheet = workbook.addWorksheet(sheetName);

                    if (template === 'standard') {
                        workbook.addWorksheet('Master Data Reference');
                    }

                    let headers;
                    if (template === 'simple') {
                        headers = ['Barcode No.', 'Item Name', 'Rack Location', 'Actual QTY', 'Verifier'];
                    } else {
                        headers = [
                            'Barcode No.', 'Item Name', 'Rack Location', 'Category-1', 'Category-2',
                            'Actual QTY', 'System QTY', 'Status', 'Status Reason',
                            'Last Update', 'Verifier', 'Manual Change Reason'
                        ];
                    }

                    const hRow = locationSheet.addRow(headers);
                    hRow.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        let headerColor = 'FFEA580C';
                        if (template === 'simple') headerColor = 'FF0284C7';
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
                    });

                    dataToExport.forEach(res => {
                        let rowData;
                        if (template === 'simple') {
                            rowData = [
                                sanitize(res.barcode),
                                sanitize(res.masterItemName || res.itemName || ''),
                                sanitize(res.rackLocation || ''),
                                isNaN(Number(res.qty)) ? 0 : Number(res.qty),
                                sanitize(res.uploadedBy || res.updatedBy || '')
                            ];
                        } else {
                            rowData = [
                                sanitize(res.barcode),
                                sanitize(res.masterItemName || res.itemName || ''),
                                sanitize(res.rackLocation || ''),
                                sanitize(res.category1 || ''),
                                sanitize(res.category2 || ''),
                                isNaN(Number(res.qty)) ? 0 : Number(res.qty),
                                isNaN(Number(res.masterQty)) ? 0 : Number(res.masterQty),
                                sanitize(res.status === 'passed' ? 'Passed' : res.status === 'mismatch' ? 'Mismatch' : 'Missing'),
                                sanitize(res.reason || ''),
                                res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                                sanitize(res.uploadedBy || res.updatedBy || ''),
                                sanitize(res.manualReason || (res.editReason && res.editReason !== '' ? res.editReason : ''))
                            ];
                        }
                        const row = locationSheet.addRow(rowData);

                        if (template !== 'simple') {
                            const statusCol = 8;
                            const statusCell = row.getCell(statusCol);
                            let bgColor = '';
                            if (res.status === 'passed') bgColor = 'FFDCFCE7';
                            else if (res.status === 'mismatch') bgColor = 'FFFEE2E2';
                            else if (res.status === 'missing') bgColor = 'FFE0F2FE';
                            if (bgColor) statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                        }
                    });

                    if (template === 'standard') {
                        const dataSheet = workbook.getWorksheet('Master Data Reference');
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
                            dataSheet.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 12 }];
                        }
                    }

                    if (template === 'simple') {
                        locationSheet.columns = [{ width: 15 }, { width: 35 }, { width: 15 }, { width: 12 }, { width: 20 }];
                    } else {
                        locationSheet.columns = [
                            { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                            { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 30 }
                        ];
                    }
                }
            } else {
                if (!rawFile || !locationSheetName) return;
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
                    [cols.qty, cols.sys, cols.status, cols.remark, cols.date, cols.user].forEach(col => {
                        header.getCell(col).font = { bold: true };
                    });
                    dataToExport.forEach(res => {
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

            // Set default font to Phetsarath OT for all cells
            workbook.eachSheet((sheet) => {
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
            });

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `JoahTools_${template.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
        } catch (e) {
            console.error('Export Error:', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            {renderLocationInspector()}
            <div className="space-y-6 animate-fade-in-up">
                {/* Action Bar */}
                <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 flex flex-col xl:flex-row gap-6 items-center border-white/50 relative z-50">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="relative group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-joah-orange transition-colors" size={18} />
                            <input
                                type="text" placeholder="ຄົ້ນຫາບາໂຄ້ດ, ສິນຄ້າ ຫຼື ຕຳແໜ່ງ..."
                                className="input-field pl-14 font-bold"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && filteredResults.length === 0 && searchTerm.length >= 5) {
                                        if (dbSource !== 'supabase') {
                                            alert('⚠️ Please connect to Cloud first.');
                                            return;
                                        }

                                        if (window.confirm(`ສິນຄ້ານີ້ບໍ່ມີໃນ Inventory, ຕ້ອງການເພີ່ມໃໝ່ເລີຍບໍ່? (Barcode: ${searchTerm})`)) {
                                            setQuickAddForm({
                                                barcode_no: searchTerm,
                                                item_name: '',
                                                rack_location: '',
                                                category_1_actual: '',
                                                category_2_actual: '',
                                                qty: 0,
                                                remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
                                            });
                                            setShowQuickAdd(true);
                                        }
                                    }
                                }}
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
                                <option value="zero">⚠️ ສິນຄ້າເປັນ 0 (Zero)</option>
                                <option value="hasQty">📦 ສິນຄ້າມີຈໍานວນ (In Stock)</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-100 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-8">
                        <div className="relative">
                            <button
                                onClick={() => setShowExportDropdown(!showExportDropdown)}
                                disabled={isExporting}
                                className="btn-success shadow-emerald-500/20 py-3 uppercase text-[10px] tracking-widest min-w-[170px] flex items-center justify-center gap-3"
                            >
                                {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                <span>Export Report</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${showExportDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Export Dropdown Menu */}
                            {showExportDropdown && (
                                <div className="absolute top-full right-0 mt-3 w-72 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden z-[100] animate-fade-in-up">
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Template</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={() => handleExportWithColor('standard')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-joah-orange/10 text-joah-orange group-hover:scale-110 transition-transform">
                                                <FileSpreadsheet size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Standard Report</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">Full Data + Master Reference</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleExportWithColor('audit')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-500 group-hover:scale-110 transition-transform">
                                                <AlertTriangle size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Audit Focus</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">Mismatch & Missing Items Only</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleExportWithColor('simple')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-500 group-hover:scale-110 transition-transform">
                                                <ClipboardList size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Simple Summary</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">Essential Inventory Columns</p>
                                            </div>
                                        </button>
                                        <button
                                            onClick={() => handleExportWithColor('odoo-adjustment')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-110 transition-transform">
                                                <RotateCw size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Odoo Adjustment</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">Diff Only (For Accounting)</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
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
                                    <th
                                        onClick={() => handleSort('qty')}
                                        className="px-6 py-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:text-joah-orange transition-colors group/head"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            Count / System
                                            <div className={`transition-all duration-300 ${sortConfig.key === 'qty' ? 'text-joah-orange scale-110' : 'text-slate-300 group-hover/head:text-joah-orange/50'}`}>
                                                {sortConfig.key === 'qty' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronDown size={14} className="rotate-180" strokeWidth={3} />
                                                ) : <ArrowUpDown size={14} />}
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">Categories</th>
                                    <th className="px-6 py-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Status</th>
                                    <th className="px-6 py-6 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">OD Qty</th>
                                    <th className="px-8 py-6 text-right text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {currentResults.length > 0 ? currentResults.map((row) => (
                                    <tr
                                        key={row.rowIndex}
                                        ref={el => rowRefs.current[row.barcode] = el}
                                        className={`group transition-all duration-500 ${searchTerm === row.barcode ? 'bg-joah-orange/10 ring-2 ring-joah-orange shadow-lg shadow-joah-orange/20 z-10 relative' : 'hover:bg-joah-orange/[0.03] dark:hover:bg-joah-orange/[0.05]'}`}
                                    >
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
                                            <button
                                                onClick={() => setDiagnosticRow(row)}
                                                className={`status-badge hover:scale-105 transition-transform ${row.status === 'passed' ? 'badge-success' : row.status === 'mismatch' ? 'badge-error' : 'badge-warning'}`}
                                            >
                                                {getStatusHint(row).icon}
                                                {row.status === 'passed' ? 'Matched' : row.status === 'mismatch' ? 'Mismatch' : 'Missing'}
                                            </button>
                                        </td>
                                        {/* Odoo Qty Column */}
                                        <td className="px-6 py-6 text-center">
                                            {row.odooQty !== undefined && row.odooQty !== null ? (
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-xl font-black ${Number(row.qty) !== Number(row.odooQty) ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {row.odooQty}
                                                    </span>
                                                    {Number(row.qty) !== Number(row.odooQty) && (
                                                        <span className="text-[9px] font-bold text-rose-400 uppercase tracking-widest bg-rose-50 dark:bg-rose-900/20 px-1.5 py-0.5 rounded">Diff</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600 font-bold">-</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => setDiagnosticRow(row)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-joah-orange transition-all" title="View Diagnostics">
                                                    <Info size={18} />
                                                </button>
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
                                        <td colSpan="7" className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-6 text-slate-300 dark:text-slate-700 animate-fade-in">
                                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 shadow-inner">
                                                    <Package size={40} strokeWidth={1.5} />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-lg font-black text-slate-800 dark:text-white">ບໍ່ພົບຂໍ້ມູນໃນລາຍການ</p>
                                                    {searchTerm.length > 0 ? (
                                                        <p className="text-sm font-bold text-slate-400">ບໍ່ພົບຜົນການຄົ້ນຫາສຳລັບ: <span className="text-joah-orange font-mono underline decoration-2 underline-offset-4">{searchTerm}</span></p>
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">ກະລຸນາລອງຄົ້ນຫາຄືນໃໝ່</p>
                                                    )}
                                                </div>
                                                {searchTerm.length >= 5 && (
                                                    <button
                                                        onClick={() => {
                                                            if (dbSource !== 'supabase') {
                                                                alert('⚠️ Please connect to Cloud first.');
                                                                return;
                                                            }
                                                            setQuickAddForm({
                                                                barcode_no: searchTerm,
                                                                item_name: '',
                                                                rack_location: '',
                                                                category_1_actual: '',
                                                                category_2_actual: '',
                                                                qty: 0,
                                                                remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
                                                            });
                                                            setShowQuickAdd(true);
                                                        }}
                                                        className="btn-primary py-4 px-10 rounded-2xl shadow-xl shadow-joah-orange/20 group transform hover:scale-105 active:scale-95 transition-all"
                                                    >
                                                        <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                                                        <span className="font-black">ເພີ່ມເຂົ້າ Inventory ໂດຍກົງ</span>
                                                    </button>
                                                )}
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



                {/* Diagnostic Modal */}
                {diagnosticRow && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-slate-950/60 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] overflow-hidden border-2 border-slate-100 dark:border-slate-800 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
                            <div className={`p-8 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 ${getStatusHint(diagnosticRow).bg}/10`}>
                                <div className="flex items-center gap-6">
                                    <div className={`p-4 rounded-3xl text-white ${getStatusHint(diagnosticRow).bg} shadow-xl`}>
                                        {getStatusHint(diagnosticRow).icon}
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">{getStatusHint(diagnosticRow).title}</h3>
                                        <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Validation Analysis Report</p>
                                    </div>
                                </div>
                                <button onClick={() => setDiagnosticRow(null)} className="p-4 hover:bg-white dark:hover:bg-slate-800 rounded-2xl transition-all shadow-inner">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
                                <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">ສາເຫດ (Root Cause)</p>
                                    <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{getStatusHint(diagnosticRow).reason}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <p className="px-2 text-xs font-black text-slate-400 uppercase tracking-widest text-center">ຂໍ້ມູນທີ່ກວດພົບ (Actual)</p>
                                        <div className="p-5 rounded-[2rem] bg-rose-50/30 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-900/30 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">ໝວດໝູ່ 1</p>
                                                <p className="text-base font-bold text-slate-700 dark:text-slate-300">{diagnosticRow.category1 || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">ໝວດໝູ່ 2</p>
                                                <p className="text-base font-bold text-slate-700 dark:text-slate-300">{diagnosticRow.category2 || '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">ບ່ອນວາງ (Rack)</p>
                                                <p className="text-base font-bold text-slate-700 dark:text-slate-300">{diagnosticRow.rackLocation}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="px-2 text-xs font-black text-emerald-500 uppercase tracking-widest text-center">ຂໍ້ມູນທີ່ຖືກຕ້ອງ (Master)</p>
                                        <div className="p-5 rounded-[2rem] bg-emerald-50/30 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-900/30 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">ໝວດໝູ່ 1</p>
                                                <p className="text-base font-bold text-slate-800 dark:text-white">{diagnosticRow.masterCategory1 || 'ຍັງບໍ່ມີຂໍ້ມູນ'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">ໝວດໝູ່ 2</p>
                                                <p className="text-base font-bold text-slate-800 dark:text-white">{diagnosticRow.masterCategory2 || 'ຍັງບໍ່ມີຂໍ້ມູນ'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">ໂຊນທີ່ຄວນຢູ່</p>
                                                <p className="text-base font-bold text-slate-800 dark:text-white">{diagnosticRow.status === 'passed' ? diagnosticRow.rackLocation : (diagnosticRow.reason?.includes('ຄວນແມ່ນ') ? diagnosticRow.reason.split('ຄວນແມ່ນ ')[1].split(')')[0] : '-')}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-8 rounded-[2rem] bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-xl shadow-indigo-500/20">
                                    <div className="flex items-center gap-3 mb-6">
                                        <HelpCircle size={20} />
                                        <p className="text-sm font-black uppercase tracking-widest">ວິທີແກ້ໄຂ (Solution Steps)</p>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-base font-medium opacity-90">{getStatusHint(diagnosticRow).action}</p>
                                        {getStatusHint(diagnosticRow).fixSteps?.length > 0 && (
                                            <div className="pt-4 space-y-3">
                                                {getStatusHint(diagnosticRow).fixSteps.map((step, idx) => (
                                                    <div key={idx} className="flex gap-4 items-center bg-white/10 p-4 rounded-2xl border border-white/10">
                                                        <div className="w-8 h-8 rounded-full bg-white text-indigo-600 flex items-center justify-center font-black flex-shrink-0">{idx + 1}</div>
                                                        <p className="text-sm font-bold">{step}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex justify-end gap-4">
                                <button onClick={() => setDiagnosticRow(null)} className="px-8 h-14 rounded-2xl font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all text-xs">ປິດໜ້າຕ່າງ</button>
                                {diagnosticRow.status !== 'passed' && (
                                    <button
                                        onClick={() => {
                                            setDiagnosticRow(null);
                                            setSelectedRow(diagnosticRow);
                                            setEditQty(diagnosticRow.qty);
                                        }}
                                        className="px-8 h-14 rounded-2xl bg-joah-orange text-white font-black uppercase tracking-widest hover:scale-105 transition-all text-xs shadow-lg shadow-orange-500/30 flex items-center gap-2"
                                    >
                                        <Edit2 size={16} />
                                        ແກ้ໄຂຂໍ້ມູນ
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {selectedRow && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>
                            <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-xl bg-joah-orange text-white shadow-lg shadow-orange-500/20"><Edit2 size={20} /></div>
                                    <div>
                                        <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">ແກ້ໄຂຂໍ້ມູນ</h3>
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Manual Adjustment</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedRow(null)}
                                    className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-sm"
                                >
                                    <X size={28} strokeWidth={2.5} />
                                </button>
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
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Location</p>
                                            <div className="flex items-center gap-1.5"><MapPin size={10} className="text-joah-orange" /><span className="text-sm font-black text-slate-700 dark:text-slate-300">{selectedRow.rackLocation}</span></div>
                                        </div>
                                    </div>
                                </div>

                                {/* 2-Column Grid for better space utilization */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative group md:col-span-2">
                                        <span className="floating-label group-focus-within:text-joah-orange">New Actual Qty</span>
                                        <input
                                            type="number"
                                            value={editQty}
                                            onChange={(e) => setEditQty(e.target.value)}
                                            className="input-field !text-xl text-center py-4 font-black caret-joah-orange text-joah-orange focus:text-joah-orange transition-all duration-300 focus:ring-4 focus:ring-joah-orange/10"
                                            autoFocus
                                        />
                                    </div>

                                    {/* Rack Location with Dropdown + Manual Input */}
                                    <div className="relative group md:col-span-2">
                                        <span className="floating-label group-focus-within:text-joah-orange">Rack Location (Auto-suggest or Custom)</span>
                                        <div className="flex gap-2">
                                            <select
                                                className="input-field !py-3 !px-3 font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 focus:border-joah-orange outline-none transition-all flex-1"
                                                value={editLocation}
                                                onChange={(e) => setEditLocation(e.target.value)}
                                                onFocus={(e) => {
                                                    if (!editLocation) setEditLocation(selectedRow.rackLocation);
                                                }}
                                            >
                                                <option value="">-- ເລືອກຕຳແໜ່ງ --</option>
                                                {getRackSuggestions(editCat1 || selectedRow.category1).map(loc => {
                                                    const count = results.filter(r => r.rackLocation === loc).length;
                                                    return (
                                                        <option key={loc} value={loc}>
                                                            {loc} {count > 0 ? `\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0 ${count} SKU` : ''}
                                                        </option>
                                                    );
                                                })}
                                                <option value="CUSTOM">-- ປ້ອນເອງ (Custom) --</option>
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => editLocation && setInspectedLocation(editLocation)}
                                                disabled={!editLocation}
                                                className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-joah-orange disabled:opacity-50 transition-colors"
                                                title="View items in this location"
                                            >
                                                <Eye size={20} />
                                            </button>
                                            <input
                                                type="text"
                                                value={editLocation}
                                                onChange={(e) => setEditLocation(e.target.value.toUpperCase())}
                                                onFocus={(e) => {
                                                    if (!editLocation) setEditLocation(selectedRow.rackLocation);
                                                }}
                                                className={`input-field py-3 font-bold uppercase w-1/3 transition-all ${editLocation !== selectedRow.rackLocation ? 'ring-2 ring-joah-orange bg-orange-50/10' : ''}`}
                                                placeholder={selectedRow.rackLocation}
                                            />
                                        </div>

                                        {/* Dynamic Reason for Custom/Changed Rack */}
                                        {editLocation !== selectedRow.rackLocation && (
                                            <div className="mt-4 p-4 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900/30 animate-fade-in-up">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Info size={14} className="text-joah-orange" />
                                                    <span className="text-[10px] font-black text-joah-orange uppercase tracking-widest">Reason for Rack Change</span>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={editReason}
                                                    onChange={(e) => setEditReason(e.target.value)}
                                                    placeholder="ບອກເຫດຜົນທີ່ປ່ຽນຕຳແໜ່ງ ຫຼືໃຊ້ Rack ນີ້"
                                                    className="w-full bg-transparent border-b border-orange-300 dark:border-orange-800 focus:border-joah-orange outline-none py-1 text-sm font-bold placeholder:text-slate-400"
                                                    autoFocus
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Category 1 Editor */}
                                    <div className="relative group">
                                        <span className="floating-label group-focus-within:text-joah-orange">Category 1</span>
                                        <select
                                            value={editCat1}
                                            onChange={(e) => setEditCat1(e.target.value)}
                                            onFocus={(e) => {
                                                if (!editCat1) setEditCat1(selectedRow.category1);
                                            }}
                                            className="input-field py-3.5 font-bold appearance-none"
                                        >
                                            <option value="">{selectedRow.category1 || 'Select Category'}</option>
                                            {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Category 2 Editor */}
                                    <div className="relative group">
                                        <span className="floating-label group-focus-within:text-joah-orange">Category 2</span>
                                        <input
                                            type="text"
                                            value={editCat2}
                                            onChange={(e) => setEditCat2(e.target.value)}
                                            onFocus={(e) => {
                                                if (!editCat2) setEditCat2(selectedRow.category2);
                                            }}
                                            className="input-field py-3.5 font-bold"
                                            placeholder={selectedRow.category2 || 'Category 2'}
                                        />
                                    </div>

                                    <div className="relative group mt-4 md:col-span-2">
                                        <span className="absolute -top-3 left-4 px-2 bg-white dark:bg-slate-900 text-[10px] font-bold uppercase tracking-widest text-slate-400 group-focus-within:text-joah-orange z-10 transition-colors">Verifier Name</span>
                                        <div className="relative">
                                            <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-joah-orange transition-colors" size={16} />
                                            <input
                                                type="text"
                                                value={currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown')}
                                                readOnly
                                                className="input-field pl-12 py-3.5 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                            />
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
                                                {log.change_reason && (
                                                    <div className="mt-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                                                        <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Reason</p>
                                                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.change_reason}</p>
                                                    </div>
                                                )}
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

                {/* Quick Add to Inventory Modal */}
                {showQuickAdd && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-md bg-slate-950/40 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] p-10 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in relative overflow-hidden">
                            <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-4">
                                    <div className="p-4 rounded-[1.25rem] bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
                                        <Plus size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ເພີ່ມຂໍ້ມູນເຂົ້າ Inventory ໂດຍກົງ</h3>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Add to location_inventory</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowQuickAdd(false)} className="p-3 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Warning Banner when NOT found in Master */}
                            {!isFoundInMaster && quickAddForm.barcode_no && (
                                <div className="mb-6 p-5 bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/30 rounded-2xl">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl">
                                            <AlertTriangle className="text-rose-600 dark:text-rose-400" size={24} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 mb-1.5">⚠️ ບໍ່ພົບໃນ Master Data</h4>
                                            <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-3">ບາໂຄ້ດນີ້ຍັງບໍ່ທັນຖືກເພີ່ມເຂົ້າໃນລະບົບຫຼັກ. <span className="underline">ກະລຸນາເພີ່ມຂໍ້ມູນໃນ "Product Manager" ກ່ອນ.</span></p>
                                            <button
                                                onClick={() => {
                                                    setShowQuickAdd(false);
                                                    if (onAddNewProduct) onAddNewProduct(quickAddForm.barcode_no);
                                                }}
                                                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-2"
                                            >
                                                <Plus size={14} />
                                                ໄປທີ່ Product Manager
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</label>
                                    <input
                                        type="text"
                                        value={quickAddForm.barcode_no}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setQuickAddForm(prev => ({ ...prev, barcode_no: val }));
                                        }}
                                        className="input-field py-4 font-mono font-bold focus:ring-4 focus:ring-joah-orange/10 transition-all"
                                        placeholder="ຍິງບາໂຄ້ດ ຫຼື ພິມຢູ່ທີ່ນີ້..."
                                        autoFocus
                                    />
                                    <div className="mt-1 flex justify-between items-center px-1">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Instant Detect Active</span>
                                        {masterData.find(m => String(m.barcode || m.Barcode || '').trim() === String(quickAddForm.barcode_no).trim()) && (
                                            <span className="text-[9px] font-black text-emerald-500 uppercase flex items-center gap-1 animate-pulse">
                                                <CheckCircle size={10} /> Found in Master
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Name {!isFoundInMaster && <span className="text-rose-500">(Locked - Add to Master First)</span>}</label>
                                    <input
                                        type="text"
                                        value={quickAddForm.item_name}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, item_name: e.target.value })}
                                        className="input-field py-4 font-bold disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        placeholder={isFoundInMaster ? "ຊື່ສິນຄ້າ..." : "🔒 ກະລຸນາເພີ່ມຂໍ້ມູນໃນ Product Manager ກ່ອນ"}
                                        disabled={!isFoundInMaster}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Rack Location (Auto-suggest)</label>
                                    <div className="flex gap-2">
                                        <select
                                            className="input-field !py-3 !px-3 font-bold bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-800 focus:border-joah-orange outline-none transition-all w-full"
                                            value={quickAddForm.rack_location}
                                            onChange={(e) => setQuickAddForm({ ...quickAddForm, rack_location: e.target.value })}
                                        >
                                            <option value="">-- ເລືອກຕຳແໜ່ງ --</option>
                                            {getRackSuggestions(quickAddForm.category_1_actual).map(loc => {
                                                const count = results.filter(r => r.rackLocation === loc).length;
                                                return (
                                                    <option key={loc} value={loc}>
                                                        {loc} {count > 0 ? `\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0 ${count} SKU` : ''}
                                                    </option>
                                                );
                                            })}
                                            <option value="CUSTOM">-- ປ້ອນເອງ (Custom) --</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => quickAddForm.rack_location && setInspectedLocation(quickAddForm.rack_location)}
                                            disabled={!quickAddForm.rack_location}
                                            className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-slate-500 hover:text-joah-orange disabled:opacity-50 transition-colors"
                                            title="View items in this location"
                                        >
                                            <Eye size={20} />
                                        </button>
                                        <input
                                            type="text"
                                            value={quickAddForm.rack_location}
                                            onChange={(e) => setQuickAddForm({ ...quickAddForm, rack_location: e.target.value })}
                                            className="input-field py-4 font-bold w-1/3"
                                            placeholder="G01-L1"
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium ml-1">ຕົວຢ່າງ: {getRackSuggestions(quickAddForm.category_1_actual)[0] || 'H01-L1'}</p>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qty</label>
                                    <input
                                        type="number"
                                        value={quickAddForm.qty}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, qty: Number(e.target.value) })}
                                        className="input-field py-4 font-black text-joah-orange"
                                    />
                                </div>
                                <div className="space-y-1.5 font-bold">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category 1</label>
                                    <select
                                        className="input-field py-4 font-bold appearance-none"
                                        value={quickAddForm.category_1_actual}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, category_1_actual: e.target.value })}
                                    >
                                        <option value="">Select Category</option>
                                        {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1.5 font-bold">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category 2 {!isFoundInMaster && <span className="text-rose-500">(Locked)</span>}</label>
                                    <input
                                        type="text"
                                        value={quickAddForm.category_2_actual}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, category_2_actual: e.target.value })}
                                        className="input-field py-4 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        placeholder={isFoundInMaster ? "" : "🔒 Locked"}
                                        disabled={!isFoundInMaster}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-10">
                                <button onClick={() => setShowQuickAdd(false)} className="flex-1 btn-secondary py-5 rounded-[1.25rem] font-black uppercase text-xs tracking-widest bg-slate-100 dark:bg-slate-800 border-none">Cancel</button>
                                <button
                                    onClick={handleQuickAddSave}
                                    disabled={isSavingQuickAdd}
                                    className="flex-[2] btn-primary py-5 rounded-[1.25rem] font-black uppercase text-xs tracking-widest shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 border-none"
                                >
                                    {isSavingQuickAdd ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                                    <span>{isSavingQuickAdd ? 'Saving...' : 'Add to Inventory'}</span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
};

export default ResultTable;
