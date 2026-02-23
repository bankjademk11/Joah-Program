import { useState, useRef, useEffect, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    UploadCloud, FileSpreadsheet, Info, History, Clock,
    ArrowUpDown, FilterX, HelpCircle, Package, Calendar, User, RotateCw, Plus, Eye, ClipboardList
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../../utils/supabaseClient';
import { syncLocationResultsToSupabase, syncMasterDataToSupabase, fetchMasterFromSupabase, addLocationRecord, logInventoryHistory } from '../../../utils/supabaseSync';
import { readExcelFromUrl, sheetToJSON, readExcelFile } from '../../../utils/excelProcessor';
import databaseUrl from '../../../assets/DataBaseJoah.xlsx';
import { useToast } from '../../ui/ToastProvider';
import { useLanguage } from '../../../contexts/LanguageContext';
import DiagnosticPanel from './DiagnosticPanel';
import EditPanel from './EditPanel';
import QuickAddPanel from './QuickAddPanel';
import LocationInspector from './LocationInspector';
import AuditLogModal from '../../ui/AuditLogModal';
import { CATEGORY_RACK_RULES, getRackSuggestions } from '../../../utils/rackUtils';

const ResultTable = ({
    results, allResults = [], locationFilter, onLocationFilterChange, masterData, rawFile, locationSheetName, filterStatus,
    onFilterChange, dbSource, onRefresh, onUpdateRowQty, currentUser, onAddNewProduct, refreshTrigger
}) => {
    const { t } = useLanguage();
    const { success, error: showError } = useToast(); // Initialize Toast
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
    const [mergeAmount, setMergeAmount] = useState(''); // New state for pending merge amount
    const [employeeName, setEmployeeName] = useState(localStorage.getItem('joah_employee_name') || '');
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [diagnosticRow, setDiagnosticRow] = useState(null);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
    const [showLocationFilter, setShowLocationFilter] = useState(false);
    const [locationSearchTerm, setLocationSearchTerm] = useState('');
    const locationFilterRef = useRef(null);

    // --- Helper: Extract & Filter Locations ---
    const uniqueLocations = useMemo(() => {
        if (!allResults) return [];

        // 1. Get all unique locations
        const locs = Array.from(new Set(allResults.map(r => r.rackLocation).filter(Boolean)));

        // 2. Filter by search term inside dropdown
        return locs
            .filter(loc => loc.toLowerCase().includes(locationSearchTerm.toLowerCase()))
            .sort();
    }, [allResults, locationSearchTerm]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (locationFilterRef.current && !locationFilterRef.current.contains(event.target)) {
                setShowLocationFilter(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [isRefreshing, setIsRefreshing] = useState(false); // State for skeleton loading

    // Skeleton Loader Component
    const SkeletonLoader = () => (
        <div className="w-full space-y-4 animate-pulse px-2">
            {[...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                    <div className="flex-1 space-y-3">
                        <div className="flex gap-4">
                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4"></div>
                            <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-1/4"></div>
                        </div>
                        <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded-md w-1/2"></div>
                    </div>
                    <div className="w-24 h-10 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                </div>
            ))}
        </div>
    );

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        // Artificial delay for better UX (so the skeleton is seen)
        await new Promise(r => setTimeout(r, 600));

        if (onRefresh) {
            // Pass silent: true to avoid global LoadingOverlay / Elephant
            await onRefresh({ skipMaster: false, silent: true });
        }
        setIsRefreshing(false);
    };

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
    const [optimisticItems, setOptimisticItems] = useState([]); // Optimistic UI for added items



    // --- Smart Automation Rules (Mapdata.MD - NEW FORMAT with Section Numbers) ---
    // Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)


    const ALL_DISTINCT_ZONES = Array.from(new Set(Object.values(CATEGORY_RACK_RULES).flatMap(group => group.flatMap(rule => rule.zones))));

    // Auto-fill from Master Data when Barcode changes
    // Listen for external refresh trigger (Navbar Refresh)
    useEffect(() => {
        if (refreshTrigger) {
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 1000); // Show skeleton for at least 1s
        }
    }, [refreshTrigger]);

    const itemsPerPage = 50;
    const rowRefs = useRef({}); // Store refs for each barcode row

    // Combine real results with optimistically added items
    // Use Set to prevent duplicates if refresh happens but optimistic state is not cleared yet
    // Filter duplicates by checking barcode + rackLocation
    const combinedResults = useMemo(() => {
        const existingKeys = new Set(results.map(r => `${r.barcode}-${r.rackLocation}`));
        const newItems = optimisticItems.filter(item => !existingKeys.has(`${item.barcode}-${item.rackLocation}`));
        return [...newItems, ...results];
    }, [results, optimisticItems]);

    const filteredResults = combinedResults
        .filter(row => {
            const matchesSearch =
                (row.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.rackLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.masterItemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (row.itemName || '').toLowerCase().includes(searchTerm.toLowerCase());
            const matchesFilter =
                filterStatus === 'all' ||
                (filterStatus === 'odooDiff' && row.odooQty !== undefined && row.odooQty !== null && Number(row.qty) !== Number(row.odooQty)) ||
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
                    action: 'ກະລຸນາແກ້ໄຂຂໍ້ມູນ ຫຼື ຍ້າຍສິນຄ້າໄປວາງໃຫ້ຖືກຕ້ອງຕາມທີ່ລະບົບແນະນຳ.',
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

    const handleQuickUpdate = async (row, newQty, reason) => {
        const activeUser = currentUser ? `${currentUser.name} (${currentUser.id})` : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');
        const now = new Date().toISOString();
        const oldQty = row.qty || 0;

        // Update local state
        if (onUpdateRowQty) {
            onUpdateRowQty(row.rowIndex, {
                qty: newQty,
                updatedAt: now,
                updatedBy: activeUser,
                manualReason: reason
            });
        }

        try {
            if (dbSource === 'supabase') {
                if (!row.id) throw new Error("Missing ID");
                const { error } = await supabase
                    .from('location_inventory')
                    .update({
                        qty: newQty,
                        remarks: `Quick Merge from Diagnostic by ${activeUser}`,
                        uploaded_by: activeUser
                    })
                    .eq('id', row.id);
                if (error) throw error;

                await logInventoryHistory({
                    barcode: row.barcode,
                    itemName: row.masterItemName || row.itemName,
                    oldQty: oldQty,
                    newQty: newQty,
                    oldRack: row.rackLocation,
                    newRack: row.rackLocation,
                    updatedBy: activeUser,
                    reason: reason
                });
            }
            success(t('results.saveSuccess'));
        } catch (err) {
            showError("Update failed: " + err.message);
        }
    };

    const handleUpdateMasterQty = async () => {
        if (!selectedRow || editQty === '') return;
        const activeUser = currentUser ? `${currentUser.name} (${currentUser.id})` : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

        if (dbSource === 'supabase' && !activeUser) {
            showError('Error: User not identified. Please login again.');
            return;
        }

        setIsUpdating(true);
        const now = new Date().toISOString();
        // Calculate the final quantity: current edited qty + the pending merge amount
        const newQtyValue = Number(editQty) + (Number(mergeAmount) || 0);
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

                // Validate Reason if changes detected
                const hasRackChangedCheck = editLocation !== selectedRow.rackLocation;
                const hasCatChangedCheck = (editCat1 !== selectedRow.category1) || (editCat2 !== selectedRow.category2);
                const hasQtyChangedCheck = Number(editQty) !== (selectedRow.qty || 0);

                if ((hasRackChangedCheck || hasCatChangedCheck || hasQtyChangedCheck) && !editReason.trim()) {
                    showError(t('results.reasonRequired'));
                    setIsUpdating(false);
                    return;
                }

                const { error: locError } = await supabase
                    .from('location_inventory')
                    .update({
                        qty: newQtyValue,
                        rack_location: newQtyValue === 0 ? null : (editLocation || selectedRow.rackLocation),
                        category_1_actual: editCat1 || selectedRow.category1,
                        category_2_actual: editCat2 || selectedRow.category2,
                        remarks: `Updated by ${activeUser} at ${now}`,
                        uploaded_by: activeUser // Update uploader on edit
                    })
                    .eq('id', selectedRow.id);
                if (locError) throw locError;

                // Log History
                // Log History with detailed tracking
                const hasRackChanged = editLocation !== selectedRow.rackLocation;
                const hasCatChanged = (editCat1 !== selectedRow.category1) || (editCat2 !== selectedRow.category2);
                const hasQtyChanged = newQtyValue !== oldQtyValue;



                let detailedReason = '';
                if (hasRackChanged && hasCatChanged) {
                    detailedReason = 'ແກ້ໄຂຜັງ Rack ແລະ ໝວດໝູ່';
                } else if (hasRackChanged) {
                    detailedReason = `ຍ້າຍຈາກ ${selectedRow.rackLocation || 'N/A'} ໄປ ${editLocation || 'N/A'}`;
                } else if (hasCatChanged) {
                    detailedReason = 'ແກ້ໄຂໝວດໝູ່ສິນຄ້າ (Category Update)';
                } else if (hasQtyChanged) {
                    detailedReason = 'ປັບປຸງຈຳນວນສິນຄ້າ (Qty Update)';
                } else {
                    detailedReason = 'Manual Update';
                }

                // Append user manual reason
                if (editReason.trim()) {
                    detailedReason += `: ${editReason.trim()}`;
                }

                console.log('📝 [ResultTable] Logging history with:', {
                    barcode: selectedRow.barcode,
                    oldRack: selectedRow.rackLocation,
                    newRack: editLocation,
                    hasRackChanged,
                    hasCatChanged,
                    hasQtyChanged,
                    reason: detailedReason
                });

                await logInventoryHistory({
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.masterItemName || selectedRow.itemName,
                    oldQty: oldQtyValue,
                    newQty: newQtyValue,
                    oldRack: selectedRow.rackLocation || null,
                    newRack: editLocation || null,
                    oldCat1: selectedRow.category1 || null,  // ✅ Category tracking
                    newCat1: editCat1 || null,               // ✅ Category tracking
                    oldCat2: selectedRow.category2 || null,  // ✅ Category tracking
                    newCat2: editCat2 || null,               // ✅ Category tracking
                    updatedBy: activeUser,
                    reason: detailedReason
                });
            }
            success(t('results.saveSuccess'));
            setSelectedRow(null);
            setEditReason(''); // Reset reason
            setMergeAmount(''); // Reset merge amount after save
        } catch (err) {
            showError(t('results.saveError') + ': ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleQuickAddSave = async () => {
        if (!quickAddForm.barcode_no || !quickAddForm.rack_location || !quickAddForm.remarks) {
            alert(t('results.fillRequired'));
            return;
        }

        setIsSavingQuickAdd(true);
        try {
            const activeUser = currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

            // Logic: If Qty is 0, clear Location to NULL
            const finalPayload = {
                ...quickAddForm,
                rack_location: Number(quickAddForm.qty) === 0 ? null : quickAddForm.rack_location,
                uploaded_by: activeUser
            };

            const result = await addLocationRecord(finalPayload);
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
                    location: finalPayload.rack_location // Use the sanitized location
                });
                if (logError) console.error("Failed to log added item:", logError);
                // --------------------------------------------------------------------------

                // Optimistic UI Update: Add to local state immediately
                const newOptimisticItem = {
                    id: `temp-${Date.now()}`, // Temporary ID
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    qty: Number(quickAddForm.qty),
                    rackLocation: finalPayload.rack_location, // Use sanitized location (null if qty 0)
                    category1: quickAddForm.category_1_actual,
                    category2: quickAddForm.category_2_actual,
                    masterItemName: quickAddForm.item_name, // Assume same as entered
                    odooQty: 0, // New item usually 0 in Odoo initially
                    status: 'passed', // Temporarily mark as passed or new
                    rowIndex: results.length + optimisticItems.length + 1 // Approximate index
                };

                setOptimisticItems(prev => [newOptimisticItem, ...prev]);
                setSearchTerm(quickAddForm.barcode_no); // Auto-search new item

                success(t('results.saveSuccess')); // Standardized success message
                setShowQuickAdd(false);

                setShowQuickAdd(false);

                // Refresh background data with Loading Overlay (Show Elephant, No Progress Bar)
                if (onRefresh) {
                    await onRefresh({
                        skipMaster: false,
                        silent: false,
                        loadingText: 'ກຳລັງບັນທຶກຂໍ້ມູນລົງ Server...',
                        showProgress: false
                    });
                } else {
                    handleManualRefresh();
                }
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
                // Shared History Fetch for ALL templates (Audit, Standard, etc.)
                const reasonMap = {};
                const { data: histRows, error: histError } = await supabase
                    .from('inventory_history')
                    .select('barcode, change_reason, details, updated_at')
                    .order('updated_at', { ascending: false })
                    .limit(5000); // Increased limit for broader coverage

                if (!histError && histRows) {
                    histRows.forEach(row => {
                        const key = String(row.barcode || '').trim();
                        if (!reasonMap[key]) {
                            // Priority: details -> change_reason (same as HistoryLog.jsx line 60)
                            const reason = row.details || row.change_reason;
                            if (reason) reasonMap[key] = reason;
                        }
                    });
                } else if (histError) {
                    console.warn('History fetch skipped:', histError.message);
                }

                if (template === 'audit') {
                    // --- SPLIT SHEET LOGIC FOR AUDIT ---


                    // Step 2: Mismatch Sheet
                    const mismatchData = results.filter(res => res.status === 'mismatch');
                    const sheetMismatch = workbook.addWorksheet('Mismatch Focus');
                    const headersAudit = ['Barcode No.', 'Item Name', 'Rack Location', 'Status', 'Status Reason', 'User Reason', 'Last Update', 'Verifier'];

                    const hRow1 = sheetMismatch.addRow(headersAudit);
                    hRow1.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE11D48' } }; // Rose-600
                    });

                    mismatchData.forEach(res => {
                        const bKey = String(res.barcode || '').trim();
                        const rowData = [
                            sanitize(res.barcode),
                            sanitize(res.masterItemName || res.itemName || ''),
                            sanitize(res.rackLocation || ''),
                            'Mismatch',
                            sanitize(res.reason || ''),
                            sanitize(reasonMap[bKey] || ''),
                            res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                            sanitize(res.uploadedBy || res.updatedBy || '')
                        ];
                        const row = sheetMismatch.addRow(rowData);
                        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                    });
                    sheetMismatch.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 12 }, { width: 35 }, { width: 30 }, { width: 15 }, { width: 20 }];

                    // Step 3: Missing Sheet
                    const missingData = results.filter(res => res.status === 'missing');
                    const sheetMissing = workbook.addWorksheet('Missing Items');

                    const hRow2 = sheetMissing.addRow(headersAudit);
                    hRow2.eachCell((cell) => {
                        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } }; // Slate-600
                    });

                    missingData.forEach(res => {
                        const bKey = String(res.barcode || '').trim();
                        const rowData = [
                            sanitize(res.barcode),
                            sanitize(res.masterItemName || res.itemName || ''),
                            sanitize(res.rackLocation || ''),
                            'Missing',
                            sanitize(res.reason || 'Not found in inventory'),
                            sanitize(reasonMap[bKey] || ''),
                            res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                            sanitize(res.uploadedBy || res.updatedBy || '')
                        ];
                        const row = sheetMissing.addRow(rowData);
                        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
                    });
                    sheetMissing.columns = [{ width: 15 }, { width: 30 }, { width: 15 }, { width: 12 }, { width: 35 }, { width: 30 }, { width: 15 }, { width: 20 }];

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
                        headers = ['Barcode No.', 'Item Name', 'Rack Location', 'Actual QTY', 'Verifier', 'Employee ID'];
                    } else {
                        headers = [
                            'Barcode No.', 'Item Name', 'Rack Location', 'Category-1', 'Category-2',
                            'Actual QTY', 'System QTY', 'Status', 'Status Reason',
                            'Last Update', 'Verifier', 'Employee ID', 'Manual Change Reason'
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
                        // Parse Verifier String format "Name (ID)"
                        const rawVerifier = res.uploadedBy || res.updatedBy || '';
                        let vName = rawVerifier;
                        let vId = '';
                        // Extract ID if present in parentheses
                        const idMatch = rawVerifier.match(/^(.*?)\s*\((.*?)\)$/);
                        if (idMatch) {
                            vName = idMatch[1].trim();
                            vId = idMatch[2].trim();
                        }

                        let rowData;
                        if (template === 'simple') {
                            rowData = [
                                sanitize(res.barcode),
                                sanitize(res.masterItemName || res.itemName || ''),
                                sanitize(res.rackLocation || ''),
                                isNaN(Number(res.qty)) ? 0 : Number(res.qty),
                                sanitize(vName),
                                sanitize(vId)
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
                                sanitize(vName),
                                sanitize(vId),
                                sanitize(reasonMap[String(res.barcode || '').trim()] || res.manualReason || (res.editReason && res.editReason !== '' ? res.editReason : ''))
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
                        locationSheet.columns = [{ width: 15 }, { width: 35 }, { width: 15 }, { width: 12 }, { width: 20 }, { width: 15 }];
                    } else {
                        locationSheet.columns = [
                            { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                            { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 30 }
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
            <LocationInspector
                inspectedLocation={inspectedLocation}
                onClose={() => setInspectedLocation(null)}
                allResults={allResults}
            />

            <div className="space-y-6 animate-fade-in-up">
                {/* Action Bar */}
                <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 flex flex-col xl:flex-row gap-6 items-center border-white/50 relative z-50">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="relative group">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-joah-orange transition-colors" size={18} />
                            <input
                                type="text" placeholder="ຄົ້ນຫາບາໂຄ້ດ, ສິນຄ້າ ຫຼື ໂລເຄຊັ້ນ..."
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
                                <option value="all">{t('results.filterAll')}</option>
                                <option value="passed">{t('results.filterPassed')}</option>
                                <option value="mismatch">{t('results.filterMismatch')}</option>
                                <option value="missing">{t('results.filterIncomplete')}</option>
                                <option value="zero">{t('results.filterZero')}</option>
                                <option value="hasQty">{t('results.filterHasQty')}</option>
                                <option value="odooDiff">{t('results.filterOdooDiff')}</option>
                            </select>
                            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-3 w-full xl:w-auto border-t xl:border-t-0 xl:border-l border-slate-100 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-8">
                        <div className="relative">
                            <button
                                onClick={() => setShowExportDropdown(!showExportDropdown)}
                                disabled={isExporting}
                                className="btn-success shadow-emerald-500/20 py-3 text-[10px] min-w-[170px] flex items-center justify-center gap-3 font-bold"
                            >
                                {isExporting ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                                <span>{t('results.exportExcel')}</span>
                                <ChevronDown size={14} className={`transition-transform duration-300 ${showExportDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {/* Export Dropdown Menu */}
                            {showExportDropdown && (
                                <div className="absolute top-full right-0 mt-3 w-72 bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden z-[100] animate-fade-in-up">
                                    <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('results.exportTemplate')}</p>
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
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{t('results.stdReport')}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{t('results.stdReportDesc')}</p>
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
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{t('results.auditFocus')}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{t('results.auditFocusDesc')}</p>
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
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{t('results.simpleSum')}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{t('results.simpleSumDesc')}</p>
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
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{t('results.odooAdj')}</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">{t('results.odooAdjDesc')}</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {onRefresh && (
                            <button onClick={handleManualRefresh} disabled={isRefreshing} className="btn-secondary py-3 text-[10px] min-w-[120px] font-bold">
                                <RotateCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                                <span>{isRefreshing ? t('results.loading') : t('navbar.refresh')}</span>
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
                                    <th className="px-8 py-6 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">#</th>
                                    <th className="px-6 py-6 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{t('results.barcode')} / {t('results.itemName')}</th>
                                    <th className="px-6 py-6 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 relative group/loc">
                                        <div className="flex items-center gap-2">
                                            {t('results.location')}
                                            <div className="relative" ref={locationFilterRef}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setShowLocationFilter(!showLocationFilter);
                                                        // Auto focus search input logic could go here
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-all ${locationFilter || showLocationFilter ? 'bg-joah-orange text-white shadow-lg shadow-orange-500/30' : 'text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600'}`}
                                                >
                                                    <Filter size={14} strokeWidth={2.5} />
                                                </button>

                                                {/* Location Filter Dropdown */}
                                                {showLocationFilter && (
                                                    <div className="absolute top-full left-0 mt-2 w-72 max-h-[400px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 z-[120] animate-scale-in flex flex-col overflow-hidden">
                                                        <div className="p-3 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-10 space-y-2">
                                                            <div className="flex justify-between items-center px-1">
                                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter by Location</span>
                                                                {locationFilter && (
                                                                    <button
                                                                        onClick={() => {
                                                                            if (onLocationFilterChange) onLocationFilterChange('');
                                                                            setShowLocationFilter(false);
                                                                            setLocationSearchTerm('');
                                                                        }}
                                                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-600 flex items-center gap-1"
                                                                    >
                                                                        <X size={10} /> Clear
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="relative">
                                                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="Search location..."
                                                                    value={locationSearchTerm}
                                                                    onChange={(e) => setLocationSearchTerm(e.target.value)}
                                                                    className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-joah-orange/20 outline-none transition-all placeholder:font-medium"
                                                                    autoFocus
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        </div>
                                                        <div className="overflow-y-auto custom-scrollbar flex-1 p-2 space-y-1">
                                                            <button
                                                                onClick={() => {
                                                                    if (onLocationFilterChange) onLocationFilterChange('');
                                                                    setShowLocationFilter(false);
                                                                }}
                                                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${!locationFilter ? 'bg-joah-orange/10 text-joah-orange' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                            >
                                                                <span className="flex items-center gap-2">
                                                                    <Database size={14} className={!locationFilter ? 'text-joah-orange' : 'text-slate-400'} />
                                                                    Show All Locations
                                                                </span>
                                                                {!locationFilter && <CheckCircle size={14} />}
                                                            </button>

                                                            {uniqueLocations.length > 0 ? (
                                                                uniqueLocations.map(loc => {
                                                                    const count = allResults ? allResults.filter(r => r.rackLocation === loc).length : 0;
                                                                    const isActive = locationFilter === loc;
                                                                    return (
                                                                        <button
                                                                            key={loc}
                                                                            onClick={() => {
                                                                                if (onLocationFilterChange) onLocationFilterChange(loc);
                                                                                setShowLocationFilter(false);
                                                                            }}
                                                                            className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between group ${isActive ? 'bg-joah-orange/10 text-joah-orange' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                                        >
                                                                            <span className="flex items-center gap-2">
                                                                                <MapPin size={14} className={isActive ? 'text-joah-orange' : 'text-slate-300 group-hover:text-slate-500'} />
                                                                                {loc}
                                                                            </span>
                                                                            <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black min-w-[24px] text-center ${isActive ? 'bg-white/50 text-joah-orange' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                                                                {count}
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="text-center py-8 text-slate-400">
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">No locations found</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                    <th
                                        onClick={() => handleSort('qty')}
                                        className="px-6 py-6 text-center text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:text-joah-orange transition-colors group/head"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            {t('results.actualQty')} / {t('results.masterQty')}
                                            <div className={`transition-all duration-300 ${sortConfig.key === 'qty' ? 'text-joah-orange scale-110' : 'text-slate-300 group-hover/head:text-joah-orange/50'}`}>
                                                {sortConfig.key === 'qty' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronDown size={14} className="rotate-180" strokeWidth={3} />
                                                ) : <ArrowUpDown size={14} />}
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">{t('results.category1')} & {t('results.category2')}</th>
                                    <th className="px-6 py-6 text-center text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{t('results.status')}</th>
                                    <th className="px-6 py-6 text-center text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{t('results.odooQty')}</th>
                                    <th className="px-8 py-6 text-right text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">{t('results.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {isRefreshing ? (
                                    /* SKELETON LOADER ROWS */
                                    [...Array(5)].map((_, i) => (
                                        <tr key={`skeleton-${i}`} className="animate-pulse bg-white/5">
                                            <td className="px-8 py-6"><div className="h-4 w-8 bg-slate-200 dark:bg-slate-800 rounded"></div></td>
                                            <td className="px-6 py-6"><div className="space-y-2"><div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded"></div><div className="h-3 w-48 bg-slate-200 dark:bg-slate-800 rounded"></div></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6 hidden lg:table-cell"><div className="space-y-2"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div><div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-8 py-6 text-right"><div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : currentResults.length > 0 ? (
                                    currentResults.map((row) => (
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
                                                    <button onClick={() => {
                                                        setSelectedRow(row);
                                                        setEditQty(row.qty || 0);
                                                        setEditLocation(row.rackLocation || '');
                                                        setEditCat1(row.category1 || '');
                                                        setEditCat2(row.category2 || '');
                                                        setMergeAmount(''); // Reset merge amount when opening edit
                                                    }} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-joah-orange transition-all" title="Edit Quantity">
                                                        <Edit2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))) : (
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
                                                                remarks: ''
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



                {/* Diagnostic Side Panel */}
                <DiagnosticPanel
                    diagnosticRow={diagnosticRow}
                    onClose={() => setDiagnosticRow(null)}
                    onEdit={(row) => {
                        setSelectedRow(row);
                        setEditCat1(row.category1 || '');
                        setEditCat2(row.category2 || '');
                        setMergeAmount(''); // Reset merge amount when opening edit
                    }}
                    getStatusHint={getStatusHint}
                />


                {/* Edit Modal / Manual Adjustment Panel */}
                <EditPanel
                    selectedRow={selectedRow}
                    onClose={() => setSelectedRow(null)}
                    editQty={editQty}
                    setEditQty={setEditQty}
                    editLocation={editLocation}
                    setEditLocation={setEditLocation}
                    setInspectedLocation={setInspectedLocation}
                    editCat1={editCat1}
                    setEditCat1={setEditCat1}
                    editCat2={editCat2}
                    setEditCat2={setEditCat2}
                    editReason={editReason}
                    setEditReason={setEditReason}
                    currentUser={currentUser}
                    isUpdating={isUpdating}
                    handleUpdate={handleUpdateMasterQty}
                    results={results}
                    allResults={allResults}
                    mergeAmount={mergeAmount}
                    setMergeAmount={setMergeAmount}
                    t={t}
                />

                {/* Audit Log Modal (Portal) */}
                <AuditLogModal
                    isOpen={showHistory}
                    onClose={() => setShowHistory(false)}
                    isLoading={isLoadingHistory}
                    historyData={historyData}
                />

                <QuickAddPanel
                    isOpen={showQuickAdd}
                    onClose={() => setShowQuickAdd(false)}
                    quickAddForm={quickAddForm}
                    setQuickAddForm={setQuickAddForm}
                    isFoundInMaster={isFoundInMaster}
                    setIsFoundInMaster={setIsFoundInMaster}
                    isSaving={isSavingQuickAdd}
                    onSave={handleQuickAddSave}
                    masterData={masterData}
                    results={results}
                    allResults={allResults}
                    t={t}
                    setInspectedLocation={setInspectedLocation}
                    onAddNewProduct={onAddNewProduct}
                />
            </div>
        </>
    );
};

export default ResultTable;
