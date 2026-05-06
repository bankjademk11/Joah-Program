import { useState, useRef, useEffect, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Download,
    Loader2, X, AlertTriangle, Database, MapPin,
    Edit2, Save, Filter, ChevronDown, CheckCircle,
    UploadCloud, FileSpreadsheet, Info, History, Clock,
    ArrowUpDown, FilterX, HelpCircle, Package, Calendar, User, RotateCw, Plus, Eye, ClipboardList, Sparkles, ScanLine
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { supabase } from '../../../utils/supabaseClient';
import { syncLocationResultsToSupabase, syncMasterDataToSupabase, fetchMasterFromSupabase, logInventoryHistory, logStoreInventoryHistory } from '../../../utils/supabaseSync';
import { readExcelFromUrl, sheetToJSON, readExcelFile } from '../../../utils/excelProcessor';
import databaseUrl from '../../../assets/DataBaseJoah.xlsx';
import { useToast } from '../../ui/ToastProvider';
import { useLanguage } from '../../../contexts/LanguageContext';
import AuditLogModal from '../../ui/AuditLogModal';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';
import { CATEGORY_RACK_RULES, getRackSuggestions, BRANCH_RACK_RULES, getBranchCategories, resolveBranchId } from '../../../utils/rackUtils';

// Feature Components
import StoreEditPanel from './StoreEditPanel';
import DiagnosticPanel from '../inventory/DiagnosticPanel';
import StoreQuickAddPanel from './StoreQuickAddPanel';
import LocationInspector from '../inventory/LocationInspector';

const StoreResultTable = ({
    results, allResults = [], locationFilter, onLocationFilterChange, masterData, rawFile, locationSheetName, filterStatus,
    onFilterChange, dbSource, onRefresh, onUpdateRowQty, currentUser, currentBranch, onAddNewProduct, refreshTrigger
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
    const [editTag, setEditTag] = useState('');
    const [editMaxQty, setEditMaxQty] = useState('');
    const [mergeAmount, setMergeAmount] = useState(''); // New state for pending merge amount
    const [employeeName, setEmployeeName] = useState(localStorage.getItem('joah_employee_name') || '');
    const [showExportDropdown, setShowExportDropdown] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [diagnosticRow, setDiagnosticRow] = useState(null);
    const [showQuickAdd, setShowQuickAdd] = useState(false);
    const [isSavingQuickAdd, setIsSavingQuickAdd] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
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

    // --- Refresh Cooldown & Single Row Refresh Logic ---
    const [cooldownRemaining, setCooldownRemaining] = useState(0);
    const [refreshingRowId, setRefreshingRowId] = useState(null);

    useEffect(() => {
        if (cooldownRemaining > 0) {
            const timer = setInterval(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
            return () => clearInterval(timer);
        }
    }, [cooldownRemaining]);

    const handleManualRefresh = async () => {
        if (cooldownRemaining > 0) return;

        setIsRefreshing(true);
        await new Promise(r => setTimeout(r, 600)); // UX delay

        if (onRefresh) {
            await onRefresh({ skipMaster: true, silent: true }); // Avoid downloading Master if we can
        }

        setCooldownRemaining(3); // 3 seconds cooldown
        setIsRefreshing(false);
    };

    const refreshSingleRow = async (row) => {
        if (!row.barcode) return;
        setRefreshingRowId(row.id || row.barcode);
        try {
            await new Promise(r => setTimeout(r, 600)); // Add UX delay so the spin animation is clearly visible

            const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');
            let query = supabase.from('location_inventory').select('*').eq('barcode_no', row.barcode);

            if (row.rackLocation) {
                query = query.eq('rack_location', row.rackLocation);
            }
            if (branchToSave && branchToSave !== 'All Branches') {
                query = query.eq('branch_id', branchToSave);
            }

            const { data, error } = await query.limit(1).maybeSingle();
            if (error) throw error;

            if (data && onUpdateRowQty) {
                onUpdateRowQty(row.rowIndex, { qty: data.qty || 0 });
                toast.success(`ອັບເດດ ${row.barcode} ສຳເລັດ!`);
            } else {
                toast.info(`ບໍ່ພົບການປ່ຽນແປງສຳລັບ ${row.barcode} ໃນฐานข้อมูล`);
            }
        } catch (err) {
            toast.error('ດຶງຂໍ້ມູນเฉพาะจุดผิດພາດ: ' + err.message);
        } finally {
            setRefreshingRowId(null);
        }
    };

    const [isFoundInMaster, setIsFoundInMaster] = useState(false);
    const [quickAddForm, setQuickAddForm] = useState({
        barcode_no: '',
        item_name: '',
        rack_location: localStorage.getItem('joah_last_rack_location') || '',
        category_1_actual: '',
        category_2_actual: '',
        qty: 0,
        max_qty: 0,
        product_tag: '',
        remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
    });
    // Ref to always access latest quickAddForm inside async callbacks (fixes stale closure)
    const quickAddFormRef = useRef(quickAddForm);
    useEffect(() => { quickAddFormRef.current = quickAddForm; }, [quickAddForm]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' }); // New sort state
    const [optimisticItems, setOptimisticItems] = useState([]); // Optimistic UI for added items



    // --- Smart Automation Rules (Mapdata.MD - NEW FORMAT with Section Numbers) ---
    // Each location now has format: ZONE-LEVEL-SECTION (e.g., G01-L1-1, G01-L1-2, ...)


    const currentBranchRules = BRANCH_RACK_RULES[resolveBranchId(currentBranch)] || CATEGORY_RACK_RULES;
    const ALL_DISTINCT_ZONES = Array.from(new Set(Object.values(currentBranchRules).flatMap(group => group.flatMap(rule => rule.zones))));

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
                (row.itemName || row.masterItemName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
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
            // 1. Fetch Store History
            let storeQuery = supabase
                .from('store_inventory_history')
                .select('*')
                .eq('barcode_no', barcode);
            if (currentBranch) storeQuery = storeQuery.eq('branch_id', currentBranch);

            // 2. Fetch Warehouse History
            let whQuery = supabase
                .from('inventory_history')
                .select('*')
                .eq('barcode', barcode);
            if (currentBranch) whQuery = whQuery.eq('branch_id', currentBranch);

            const [storeRes, whRes] = await Promise.all([storeQuery, whQuery]);

            if (storeRes.error) console.error('Store History Error:', storeRes.error);
            if (whRes.error) console.error('Warehouse History Error:', whRes.error);

            // Combine and tag sources
            const storeData = (storeRes.data || []).map(log => ({ ...log, source: 'store' }));
            const whData = (whRes.data || []).map(log => ({ ...log, source: 'warehouse' }));

            // Sort by updated_at descending
            const combinedData = [...storeData, ...whData].sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

            setHistoryData(combinedData);
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
                    .from('store_inventory')
                    .update({
                        store_qty: newQty,
                        updated_by: activeUser
                    })
                    .eq('id', row.id);
                if (error) throw error;

                await logStoreInventoryHistory({
                    actionType: 'edited',
                    barcode: row.barcode,
                    itemName: row.itemName || row.masterItemName,
                    oldQty: oldQty,
                    newQty: newQty,
                    oldLocation: row.rackLocation,
                    newLocation: row.rackLocation,
                    updatedBy: activeUser,
                    reason: reason,
                    branchId: currentBranch || row.branch_id || currentUser?.branch_id || localStorage.getItem('joah_branch_id')
                });
            }
            success(t('results.saveSuccess'));
        } catch (err) {
            showError("Update failed: " + err.message);
        }
    };

    const handleUpdateMasterQty = async () => {
        if (!selectedRow || editQty === '') return;
        const activeUser = currentUser 
            ? (currentUser.id ? `${currentUser.name} (${currentUser.id})` : currentUser.name)
            : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

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
                const hasQtyChangedCheck = newQtyValue !== (selectedRow.qty || 0);

                if ((hasRackChangedCheck || hasCatChangedCheck || hasQtyChangedCheck) && !editReason.trim()) {
                    showError(t('results.reasonRequired'));
                    setIsUpdating(false);
                    return;
                }

                const updatePayload = {
                    store_qty: newQtyValue,
                    shelf_location: editLocation || selectedRow.rackLocation,
                    category_1_actual: editCat1 || selectedRow.category1,
                    category_2_actual: editCat2 || selectedRow.category2,
                    updated_by: activeUser
                };
                if (editTag !== '') updatePayload.product_tag = editTag;
                if (editMaxQty !== '') updatePayload.max_qty = Number(editMaxQty);

                const { error: locError } = await supabase
                    .from('store_inventory')
                    .update(updatePayload)
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

                await logStoreInventoryHistory({
                    actionType: 'edited',
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: oldQtyValue,
                    newQty: newQtyValue,
                    oldLocation: selectedRow.rackLocation || null,
                    newLocation: editLocation || null,
                    oldTag: selectedRow.productTag || null,
                    newTag: editTag || selectedRow.productTag || null,
                    oldMaxQty: selectedRow.maxQty || null,
                    newMaxQty: editMaxQty !== '' ? Number(editMaxQty) : (selectedRow.maxQty || null),
                    updatedBy: activeUser,
                    reason: detailedReason,
                    branchId: currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id')
                });
            }
            success(t('results.saveSuccess'));
            setSelectedRow(null);
            setEditReason('');
            setEditTag('');
            setEditMaxQty('');
            setMergeAmount('');
        } catch (err) {
            showError(t('results.saveError') + ': ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    // 🆕 Clone: เพิ่มแถวใหม่จาก SKU เดิมโดยไม่ตัดจำนวนต้นฉบับ
    const handleCloneMasterQty = async (cloneAmount, newRackLocation, cloneReason) => {
        if (!selectedRow || !cloneAmount || !newRackLocation) {
            showError('ກະລຸນາໃສ່ຈຳນວນ ແລະ ເລືອກ Rack ທີ່ຕ້ອງການ');
            return;
        }
        if (!cloneReason || !cloneReason.trim()) {
            showError('ກະລຸນາລະບຸເຫດຜົນ (Reason required)');
            return;
        }
        if (newRackLocation === selectedRow?.rackLocation) {
            showError('ບໍ່ສາມາດໂຄນໄປ Rack ເດີມໄດ້ (ຕ້ອງເລືອກ Rack ໃໝ່)');
            return;
        }
        const cloneQtyNum = Number(cloneAmount);
        if (cloneQtyNum <= 0) {
            showError('ຈຳນວນໂຄລນຕ້ອງຫຼາຍກວ່າ 0');
            return;
        }

        const activeUser = currentUser
            ? (currentUser.id ? `${currentUser.name} (${currentUser.id})` : currentUser.name)
            : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');
        const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');

        setIsUpdating(true);
        try {
            if (dbSource === 'supabase') {
                // 1. Insert clone row (does NOT touch original row qty)
                const clonePayload = {
                    barcode_no: selectedRow.barcode,
                    item_name: selectedRow.itemName || selectedRow.masterItemName,
                    shelf_location: newRackLocation,
                    category_1_actual: selectedRow.category1 || '',
                    category_2_actual: selectedRow.category2 || '',
                    store_qty: cloneQtyNum,
                    product_tag: selectedRow.productTag || null,
                    max_qty: selectedRow.maxQty || null,
                    updated_by: activeUser,
                    branch_id: branchToSave
                };
                const { error: cloneErr } = await supabase.from('store_inventory').insert([clonePayload]);
                if (cloneErr) throw cloneErr;

                // 2. Log History for the new cloned record
                await logStoreInventoryHistory({
                    actionType: 'added',
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: 0,
                    newQty: cloneQtyNum,
                    oldLocation: null,
                    newLocation: newRackLocation,
                    updatedBy: activeUser,
                    reason: `ໂຄລນ SKU ຈາກ Rack ${selectedRow.rackLocation || 'N/A'} ໄປ Rack ${newRackLocation} ຈຳນວນ ${cloneQtyNum} : ${cloneReason}`,
                    branchId: branchToSave
                });
            }

            // Optimistic UI: add clone as new item in local state
            const newOptimisticItem = {
                id: `temp-clone-${Date.now()}`,
                barcode: selectedRow.barcode,
                itemName: selectedRow.itemName || selectedRow.masterItemName,
                qty: cloneQtyNum,
                rackLocation: newRackLocation,
                category1: selectedRow.category1,
                category2: selectedRow.category2,
                masterItemName: selectedRow.masterItemName,
                odooQty: selectedRow.odooQty,
                status: selectedRow.status,
                rowIndex: results.length + optimisticItems.length + 1
            };
            setOptimisticItems(prev => [newOptimisticItem, ...prev]);

            success('ໂຄລນ SKU ສຳເລັດ! ✅');
            setSelectedRow(null);
            setEditReason('');
            setMergeAmount('');
        } catch (err) {
            showError(t('results.saveError') + ': ' + err.message);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSplitMasterQty = async (splitAmount, newRackLocation, splitReason) => {
        if (!selectedRow || !splitAmount || !newRackLocation) return;
        const activeUser = currentUser 
            ? (currentUser.id ? `${currentUser.name} (${currentUser.id})` : currentUser.name)
            : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

        if (dbSource === 'supabase' && !activeUser) {
            showError('Error: User not identified. Please login again.');
            return;
        }

        setIsUpdating(true);
        const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');

        try {
            const splitQtyNum = Number(splitAmount);
            const oldQtyNum = Number(selectedRow.qty || 0);

            if (splitQtyNum <= 0 || splitQtyNum > oldQtyNum) {
                throw new Error("ຈຳນວນແບ່ງຕ້ອງຫຼາຍກວ່າ 0 ແລະ ບໍ່ເກີນຈຳນວນທີ່ມີຢູ່. (Invalid split amount)");
            }
            if (!splitReason.trim()) {
                throw new Error("ກະລຸນາລະບຸເຫດຜົນ (Reason required)");
            }
            if (newRackLocation === selectedRow.rackLocation) {
                throw new Error("ບໍ່ສາມາດແບ່ງໄປ Rack ເດີມໄດ້ (Must select different Rack)");
            }

            const remainingQty = oldQtyNum - splitQtyNum;

            if (dbSource === 'supabase') {
                if (!selectedRow.id) throw new Error("ບໍ່ພົບ Record ID ໃນຖານຂໍ້ມູນ.");

                // 1. Update old record logic
                const { error: updateError } = await supabase
                    .from('store_inventory')
                    .update({
                        store_qty: remainingQty,
                        updated_by: activeUser
                    })
                    .eq('id', selectedRow.id);
                if (updateError) throw updateError;

                // 2. Insert new record logic
                const newPayload = {
                    barcode_no: selectedRow.barcode,
                    item_name: selectedRow.itemName || selectedRow.masterItemName,
                    shelf_location: newRackLocation,
                    category_1_actual: selectedRow.category1 || '',
                    category_2_actual: selectedRow.category2 || '',
                    store_qty: splitQtyNum,
                    product_tag: selectedRow.productTag || null,
                    max_qty: selectedRow.maxQty || null,
                    updated_by: activeUser,
                    branch_id: branchToSave
                };

                const { error: insertError } = await supabase.from('store_inventory').insert([newPayload]);
                if (insertError) throw insertError;

                // 3. Log History for Old Record Deduct
                await logStoreInventoryHistory({
                    actionType: 'edited',
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: oldQtyNum,
                    newQty: remainingQty,
                    oldLocation: selectedRow.rackLocation,
                    newLocation: selectedRow.rackLocation,
                    updatedBy: activeUser,
                    reason: `ແບ່ງເຄື່ອງອອກໄປ Rack ${newRackLocation} ຈຳນວນ ${splitQtyNum} : ${splitReason}`,
                    branchId: branchToSave
                });

                // 4. Log History for New Record Add
                await logStoreInventoryHistory({
                    actionType: 'added',
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: 0,
                    newQty: splitQtyNum,
                    oldLocation: null, // New rack insertion
                    newLocation: newRackLocation,
                    updatedBy: activeUser,
                    reason: `ຮັບເຄື່ອງມາແບ່ງຈາກ Rack ${selectedRow.rackLocation} ຈຳນວນ ${splitQtyNum} : ${splitReason}`,
                    branchId: branchToSave
                });
            }

            // Local state optimistic update
            if (onUpdateRowQty) {
                onUpdateRowQty(selectedRow.rowIndex, {
                    qty: remainingQty,
                    updatedBy: activeUser,
                    updatedAt: new Date().toISOString()
                });

                // Insert optimistic new item
                const newOptimisticItem = {
                    id: `temp-split-${Date.now()}`,
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    qty: splitQtyNum,
                    rackLocation: newRackLocation,
                    category1: selectedRow.category1,
                    category2: selectedRow.category2,
                    masterItemName: selectedRow.masterItemName,
                    odooQty: selectedRow.odooQty, // Not quite accurate for split, but close
                    status: selectedRow.status,
                    rowIndex: results.length + optimisticItems.length + 1
                };
                setOptimisticItems(prev => [newOptimisticItem, ...prev]);
            }

            success(t('results.saveSuccess'));
            setSelectedRow(null);

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
            const activeUser = currentUser
                ? (currentUser.id ? `${currentUser.name} (${currentUser.id})` : currentUser.name)
                : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

            const finalPayload = {
                ...quickAddForm,
                rack_location: quickAddForm.rack_location,
                uploaded_by: activeUser
            };

            const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');

            const payload = {
                barcode_no: quickAddForm.barcode_no,
                item_name: quickAddForm.item_name,
                shelf_location: quickAddForm.rack_location,
                category_1_actual: quickAddForm.category_1_actual || '',
                category_2_actual: quickAddForm.category_2_actual || '',
                store_qty: Number(quickAddForm.qty) || 0,
                max_qty: Number(quickAddForm.max_qty) || null,
                product_tag: quickAddForm.product_tag || null,
                updated_by: activeUser,
                branch_id: branchToSave,
            };

            const { error: insertErr } = await supabase.from('store_inventory').insert([payload]);

            if (!insertErr) {
                // ── Determine if this is from Inbox flow ─────────────
                const inboxBatchId = quickAddForm._inboxBatchId || null;
                const inboxItemId = quickAddForm._inboxItemId || null;

                // Log History for New Item — include billId if from Inbox
                await logStoreInventoryHistory({
                    actionType: 'added',
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    oldQty: 0,
                    newQty: Number(quickAddForm.qty),
                    oldLocation: null,
                    newLocation: quickAddForm.rack_location,
                    oldTag: null,
                    newTag: quickAddForm.product_tag,
                    oldMaxQty: null,
                    newMaxQty: Number(quickAddForm.max_qty) || null,
                    reason: quickAddForm.remarks || 'Direct Addition to Store Inventory',
                    branchId: branchToSave,
                    updatedBy: activeUser,
                    // ── Batch/Bill fields (only when from Inbox) ──
                    billId: inboxBatchId,
                    batchStartedAt: inboxBatchId ? new Date().toISOString() : null,
                    batchEndedAt: inboxBatchId ? new Date().toISOString() : null,
                    batchTotalSeconds: null,
                });

                // ── If from Inbox: mark the request as confirmed ──────
                if (inboxItemId) {
                    await supabase
                        .from('store_requests')
                        .update({
                            store_confirmed_at: new Date().toISOString(),
                            store_confirmed_by: activeUser
                        })
                        .eq('id', inboxItemId);
                }

                // Optimistic UI Update
                const newOptimisticItem = {
                    id: `temp-${Date.now()}`,
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    qty: Number(quickAddForm.qty),
                    rackLocation: finalPayload.rack_location,
                    category1: quickAddForm.category_1_actual,
                    category2: quickAddForm.category_2_actual,
                    masterItemName: quickAddForm.item_name,
                    odooQty: 0,
                    status: 'passed',
                    rowIndex: results.length + optimisticItems.length + 1
                };

                setOptimisticItems(prev => [newOptimisticItem, ...prev]);
                setSearchTerm(quickAddForm.barcode_no);

                // 💾 Persist last used rack so next item pre-fills it
                if (quickAddForm.rack_location) {
                    localStorage.setItem('joah_last_rack_location', quickAddForm.rack_location);
                }

                success(t('results.saveSuccess'));
                setShowQuickAdd(false);
            } else {
                alert('❌ ເພີ່ມບໍ່ສຳເລັດ: ' + insertErr.message);
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
                let histQuery = supabase
                    .from('inventory_history')
                    .select('barcode, change_reason, details, updated_at')
                    .order('updated_at', { ascending: false })
                    .limit(5000); // Increased limit for broader coverage

                if (currentBranch) {
                    histQuery = histQuery.eq('branch_id', currentBranch);
                }

                const { data: histRows, error: histError } = await histQuery;

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
                            sanitize(res.itemName || res.masterItemName || ''),
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
                            sanitize(res.itemName || res.masterItemName || ''),
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
                            sanitize(res.itemName || res.masterItemName || ''),
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

                } else if (template === 'auto-fix') {
                    // --- AUTO-FIX: เหมือน Standard Report เป๊ะ แต่ทุกอย่างเป็น Passed ---
                    // ⚠️ ไม่มีผลกับ Database! Preview เท่านั้น
                    const headersStd = [
                        'Barcode No.', 'Item Name', 'Rack Location', 'Category-1', 'Category-2',
                        'Actual QTY', 'System QTY', 'Status', 'Status Reason',
                        'Last Update', 'Verifier', 'Employee ID', 'Manual Change Reason'
                    ];

                    const fixRow = (res) => {
                        const rawVerifier = res.uploadedBy || res.updatedBy || '';
                        let vName = rawVerifier;
                        let vId = '';
                        const idMatch = rawVerifier.match(/^(.*?)\s*\((.*?)\)$/);
                        if (idMatch) { vName = idMatch[1].trim(); vId = idMatch[2].trim(); }

                        // Force all to Passed: ใช้ Master Category แทน actual ถ้ามี
                        const cat1 = res.masterCategory1 || res.category1 || '';
                        const cat2 = res.masterCategory2 || res.category2 || '';

                        return [
                            sanitize(res.barcode),
                            sanitize(res.itemName || res.masterItemName || ''),
                            sanitize(res.rackLocation || ''),
                            sanitize(cat1),
                            sanitize(cat2),
                            isNaN(Number(res.qty)) ? 0 : Number(res.qty),
                            isNaN(Number(res.masterQty)) ? 0 : Number(res.masterQty),
                            'Passed',  // ← Force ทุกอันเป็น Passed
                            '',        // ← ไม่มี Reason เพราะ Passed หมด
                            res.updatedAt ? new Date(res.updatedAt).toLocaleDateString() : '',
                            sanitize(vName),
                            sanitize(vId),
                            sanitize(reasonMap[String(res.barcode || '').trim()] || '')
                        ];
                    };

                    const addHeaderRow = (sheet) => {
                        const hRow = sheet.addRow(headersStd);
                        hRow.eachCell((cell) => {
                            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } }; // Emerald
                        });
                    };

                    const setStdColWidths = (sheet) => {
                        sheet.columns = [
                            { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                            { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 30 }
                        ];
                    };

                    // Sheet: All Data (Fixed)
                    const allSheet = workbook.addWorksheet('All Data (Auto-Fixed)');
                    addHeaderRow(allSheet);
                    results.forEach(res => {
                        const row = allSheet.addRow(fixRow(res));
                        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Green
                    });
                    setStdColWidths(allSheet);

                } else {
                    // --- STANDARD / SIMPLE LOGIC ---
                    const sheetName = template === 'simple' ? 'Inventory Summary' : 'Location Inventory';
                    // --- FUNCTION TO POPULATE A SHEET ---
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

                    const populateSheet = (sheet, dataList) => {
                        const hRow = sheet.addRow(headers);
                        hRow.eachCell((cell) => {
                            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                            let headerColor = 'FFEA580C';
                            if (template === 'simple') headerColor = 'FF0284C7';
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
                        });

                        dataList.forEach(res => {
                            const rawVerifier = res.uploadedBy || res.updatedBy || '';
                            let vName = rawVerifier;
                            let vId = '';
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
                                    sanitize(res.status === 'passed' ? 'Passed' : res.status === 'mismatch' ? 'Mismatch' : (res.status === 'missing' ? 'Missing' : 'Incomplete')),
                                    sanitize(res.reason || ''),
                                    res.updatedAt ? new String(new Date(res.updatedAt).toLocaleDateString()).toString() : '',
                                    sanitize(vName),
                                    sanitize(vId),
                                    sanitize(reasonMap[String(res.barcode || '').trim()] || res.manualReason || (res.editReason && res.editReason !== '' ? res.editReason : ''))
                                ];
                            }
                            const row = sheet.addRow(rowData);

                            if (template !== 'simple') {
                                const statusCol = 8;
                                const statusCell = row.getCell(statusCol);
                                let bgColor = '';
                                if (res.status === 'passed') bgColor = 'FFDCFCE7';
                                else if (res.status === 'mismatch') bgColor = 'FFFEE2E2';
                                else if (res.status === 'missing' || res.status === 'incomplete') bgColor = 'FFE0F2FE';
                                if (bgColor) statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
                            }
                        });

                        // Set Columns width
                        if (template === 'simple') {
                            sheet.columns = [{ width: 15 }, { width: 35 }, { width: 15 }, { width: 12 }, { width: 20 }, { width: 15 }];
                        } else {
                            sheet.columns = [
                                { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                                { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 15 }, { width: 30 }
                            ];
                        }
                    };

                    if (template === 'simple') {
                        // SIMPLE mode only has one sheet
                        const simpleSheet = workbook.addWorksheet('Inventory Summary');
                        populateSheet(simpleSheet, dataToExport);
                    } else if (template === 'standard') {
                        // STANDARD mode breaks data into multiple detailed sheets
                        const allSheet = workbook.addWorksheet('All Data');
                        const correctSheet = workbook.addWorksheet('Passed');
                        const mismatchSheet = workbook.addWorksheet('Mismatch');
                        const missingSheet = workbook.addWorksheet('Missing or Incomplete');
                        const zeroQtySheet = workbook.addWorksheet('Zero QTY');

                        populateSheet(allSheet, dataToExport);
                        populateSheet(correctSheet, dataToExport.filter(r => r.status === 'passed'));
                        populateSheet(mismatchSheet, dataToExport.filter(r => r.status === 'mismatch'));
                        populateSheet(missingSheet, dataToExport.filter(r => r.status === 'missing' || r.status === 'incomplete'));
                        populateSheet(zeroQtySheet, dataToExport.filter(r => Number(r.qty || 0) === 0));

                        // Fetch and populate Master Data Reference sheet
                        const dataSheet = workbook.addWorksheet('Master Data Reference');
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
            const branchStr = currentBranch ? `${currentBranch.toUpperCase()}_` : '';
            a.download = `JoahTools_${branchStr}${template.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`;
            a.click();
        } catch (e) {
            console.error('Export Error:', e);
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in-up">
                {/* Action Bar */}
                <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-[40px] rounded-[3rem] p-6 sm:p-8 flex flex-col xl:flex-row gap-8 items-center border-[1.5px] border-white/80 dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.15)] relative z-50">
                    <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                <Search className="text-slate-400 group-focus-within:text-emerald-500 transition-colors drop-shadow-sm" size={20} strokeWidth={2.5} />
                            </div>
                            <input
                                type="text" placeholder="ຄົ້ນຫາບາໂຄ້ດ, ສິນຄ້າ ຫຼື ໂລເຄຊັ້ນ..."
                                className="w-full bg-slate-50/60 dark:bg-slate-800/60 pl-16 pr-14 py-4 rounded-[2rem] text-sm font-black tracking-wide text-slate-700 dark:text-white border-2 border-slate-200/60 dark:border-slate-700/50 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all placeholder:text-slate-400/70 shadow-inner"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value.replace(/\s+/g, ''));
                                    setCurrentPage(1);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === ' ') e.preventDefault();
                                    if (e.key === 'Enter' && filteredResults.length === 0 && searchTerm.length >= 5) {
                                        if (dbSource !== 'supabase') {
                                            alert('⚠️ Please connect to Cloud first.');
                                            return;
                                        }

                                        if (window.confirm(`ສິນຄ້ານີ້ບໍ່ມີໃນ Store_Inventory, ຕ້ອງການເພີ່ມໃໝ່ເລີຍບໍ່? (Barcode: ${searchTerm})`)) {
                                            setQuickAddForm({
                                                barcode_no: searchTerm,
                                                item_name: '',
                                                rack_location: localStorage.getItem('joah_last_rack_location') || '',
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
                            <button
                                onClick={() => setShowScanner(true)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-white dark:bg-slate-700 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 shadow-sm border border-slate-200 dark:border-slate-600 hover:border-emerald-200 dark:hover:bg-emerald-900/30 transition-all hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
                                title="Scan Barcode"
                            >
                                <ScanLine size={18} strokeWidth={2.5} />
                            </button>
                        </div>
                        <div className="relative group">
                            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                                <Filter className="text-slate-400 group-focus-within:text-emerald-500 transition-colors drop-shadow-sm" size={20} strokeWidth={2.5} />
                            </div>
                            <select
                                className="w-full bg-slate-50/60 dark:bg-slate-800/60 pl-16 pr-14 py-4 rounded-[2rem] text-sm font-black tracking-wide text-slate-700 dark:text-white border-2 border-slate-200/60 dark:border-slate-700/50 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all appearance-none cursor-pointer shadow-inner"
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
                            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} strokeWidth={2.5} />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-4 w-full xl:w-auto xl:border-l-2 border-slate-100 dark:border-slate-800 pt-6 xl:pt-0 xl:pl-8">
                        <div className="relative">
                            <button
                                onClick={() => setShowExportDropdown(!showExportDropdown)}
                                disabled={isExporting}
                                className="bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 hover:from-emerald-400 hover:via-teal-400 hover:to-teal-400 text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.5)] transition-all hover:-translate-y-1 py-4 px-8 rounded-[2rem] text-xs flex items-center justify-center gap-3 font-black tracking-widest uppercase active:translate-y-0"
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
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
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

                                        <button
                                            onClick={() => handleExportWithColor('auto-fix')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 group-hover:scale-110 transition-transform">
                                                <Sparkles size={18} />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black text-slate-800 dark:text-white uppercase">Auto-Fix Preview</p>
                                                <p className="text-[9px] font-bold text-slate-400 mt-0.5">ແປງ Mismatch ທັງໝົດໃຫ້ຕົງ Master (Preview ເທົ່ານັ້ນ)</p>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        {onRefresh && (
                            <button onClick={handleManualRefresh} disabled={isRefreshing || cooldownRemaining > 0} className={`bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-slate-600 dark:text-slate-300 hover:text-emerald-600 py-4 px-8 rounded-[2rem] text-xs font-black shadow-sm hover:shadow-[0_10px_20px_-5px_rgba(16,185,129,0.15)] transition-all hover:-translate-y-1 flex items-center justify-center gap-3 uppercase tracking-widest active:translate-y-0 ${cooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <RotateCw size={18} strokeWidth={2.5} className={isRefreshing ? 'animate-spin' : ''} />
                                <span>{isRefreshing ? t('results.loading') : cooldownRemaining > 0 ? `ລໍຖ້າ ${Math.floor(cooldownRemaining / 60)}:${(cooldownRemaining % 60).toString().padStart(2, '0')}` : t('navbar.refresh')}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Table Area (Reverted to Classic Table for Mockup) */}
                <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-hidden mt-6">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1000px] whitespace-nowrap">
                            <thead>
                                <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                                    <th className="px-8 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">#</th>
                                    <th className="px-6 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.barcode')} / {t('results.itemName')}</th>
                                    <th className="px-6 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.location')}</th>
                                    <th className="px-6 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.category1')} & {t('results.category2')}</th>
                                    <th className="px-6 py-6 text-left text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.productTagCol')}</th>
                                    <th
                                        onClick={() => handleSort('qty')}
                                        className="px-6 py-6 text-center text-sm font-black text-emerald-600 dark:text-emerald-400 border-b-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group/head tracking-wider"
                                    >
                                        <div className="flex items-center justify-center gap-2">
                                            {t('results.shopQty')}
                                            <div className={`transition-all duration-300 ${sortConfig.key === 'qty' ? 'text-emerald-500 scale-110' : 'text-emerald-300 group-hover/head:text-emerald-500'}`}>
                                                {sortConfig.key === 'qty' ? (
                                                    sortConfig.direction === 'asc' ? <ChevronDown size={16} strokeWidth={3} /> : <ChevronDown size={16} className="rotate-180" strokeWidth={3} />
                                                ) : <ArrowUpDown size={16} strokeWidth={3} />}
                                            </div>
                                        </div>
                                    </th>
                                    <th className="px-6 py-6 text-center text-xs font-black text-sky-600 dark:text-sky-400 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700">
                                        {t('results.actualQty')}<br /><span className="text-[10px] opacity-80 font-bold">{t('results.masterQty')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700">
                                        {t('results.dcQty')}<br /><span className="text-[10px] opacity-70 font-bold">{t('results.dcQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700">
                                        {t('results.salesQty')}<br /><span className="text-[10px] opacity-70 font-bold">{t('results.salesQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700">
                                        {t('results.scrapQty')}<br /><span className="text-[10px] opacity-70 font-bold">{t('results.scrapQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.status')}</th>
                                    <th className="px-8 py-6 text-right text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">{t('results.actions')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {isRefreshing ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={`skeleton-${i}`} className="animate-pulse bg-white/5">
                                            <td colSpan="12" className="px-8 py-6 h-20 bg-slate-100/50"></td>
                                        </tr>
                                    ))
                                ) : currentResults.length > 0 ? (
                                    currentResults.map((row) => (
                                        <tr
                                            key={row.rowIndex}
                                            className="group transition-all duration-500 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.05]"
                                        >
                                            <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-700">#{row.rowIndex}</td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col gap-2 min-w-[220px] py-1">
                                                    <div className="flex items-center">
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-black font-mono tracking-wider shadow-sm">{row.barcode}</span>
                                                    </div>
                                                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 line-clamp-2 max-w-[280px] leading-relaxed">{row.itemName || row.masterItemName || <span className="opacity-50 italic">Unnamed Item</span>}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/50 transition-all font-mono whitespace-nowrap">
                                                    <MapPin size={13} className="text-emerald-500 shrink-0" />
                                                    <span className="text-[13px] font-black text-slate-700 dark:text-slate-200 tracking-wide uppercase whitespace-nowrap">{row.rackLocation}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col gap-2 max-w-[180px]">
                                                    <div className="inline-flex w-fit items-center px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/30 shadow-sm">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest truncate">{row.category1 || '-'}</span>
                                                    </div>
                                                    <div className="inline-flex w-fit items-center px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest truncate">{row.category2 || '-'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col items-stretch gap-2 w-28">
                                                    {row.productTag && (
                                                        <div className={`inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-1 rounded-md shadow-sm border ${row.productTag === 'hook' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border-violet-200 dark:border-violet-800/50' : 'bg-sky-50 dark:bg-sky-900/20 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-800/50'}`}>
                                                            <span>{row.productTag === 'hook' ? '🪝' : '📦'}</span>
                                                            <span className="text-[10px] font-extrabold uppercase tracking-widest">{row.productTag}</span>
                                                        </div>
                                                    )}
                                                    {row.maxQty && (
                                                        <div className="inline-flex w-full items-center justify-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest">{t('results.maxQtyLabel')} {row.maxQty}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-2xl font-black text-slate-800 dark:text-white leading-none">{row.qty || 0}</span>
                                                    <div className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-1">{t('results.shopQtySub')}</div>
                                                </div>
                                            </td>
                                            {/* ຈຳນວນ ຫຼັງສາງ */}
                                            <td className="px-6 py-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    <span className={`text-2xl font-black leading-none ${row.warehouseQty > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                                        {row.warehouseQty ?? 0}
                                                    </span>
                                                    <div className="text-[9px] font-black text-sky-400 uppercase tracking-widest mt-1">{t('results.masterQty')}</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-center"><span className="text-xl font-bold text-slate-300 dark:text-slate-600">-</span></td>
                                            <td className="px-6 py-6 text-center">
                                                <div className="flex flex-col items-center">
                                                    {row.salesQty != null ? (
                                                        <span className="text-2xl font-black text-orange-500 dark:text-orange-400 leading-none">{Math.round(row.salesQty).toLocaleString()}</span>
                                                    ) : (
                                                        <span className="text-xl font-bold text-slate-300 dark:text-slate-600">-</span>
                                                    )}
                                                    <div className="text-[9px] font-black text-orange-400 uppercase tracking-widest mt-1">Sales</div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 text-center"><span className="text-xl font-bold text-slate-300 dark:text-slate-600">-</span></td>
                                            <td className="px-6 py-6 text-center">
                                                <button className={`status-badge hover:scale-105 transition-transform ${row.status === 'passed' ? 'badge-success' : row.status === 'mismatch' ? 'badge-error' : 'badge-warning'}`}>
                                                    {row.status === 'passed' ? 'Matched' : row.status === 'mismatch' ? 'Mismatch' : 'Missing'}
                                                </button>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => setDiagnosticRow(row)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-all" title="View Diagnostics">
                                                        <Info size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setSelectedRow(row);
                                                            setEditQty(row.qty || 0);
                                                            setEditLocation(row.rackLocation || '');
                                                            setEditCat1(row.category1 || '');
                                                            setEditCat2(row.category2 || '');
                                                            setEditReason('');
                                                            setMergeAmount('');
                                                        }}
                                                        className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-all"
                                                        title="Edit Quantity"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))) : (
                                    <tr>
                                        <td colSpan="12" className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-6 text-slate-300 dark:text-slate-700 animate-fade-in">
                                                <Package size={40} className="w-20 h-20 text-slate-200" strokeWidth={1.5} />
                                                <p className="text-lg font-black text-slate-800 dark:text-white">ບໍ່ພົບຂໍ້ມູນໃນລາຍການ</p>
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

                {/* --- Modals for Store --- */}
                <StoreQuickAddPanel
                    isOpen={showQuickAdd}
                    onClose={() => {
                        setShowQuickAdd(false);
                        setQuickAddForm(prev => ({
                            barcode_no: '', item_name: '', rack_location: prev.rack_location || localStorage.getItem('joah_last_rack_location') || '',
                            category_1_actual: '', category_2_actual: '',
                            qty: 0, max_qty: 0, product_tag: '',
                            remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
                        }));
                    }}
                    quickAddForm={quickAddForm}
                    setQuickAddForm={setQuickAddForm}
                    isFoundInMaster={isFoundInMaster}
                    setIsFoundInMaster={setIsFoundInMaster}
                    isSaving={isSavingQuickAdd}
                    onSave={async () => {
                        setIsSavingQuickAdd(true);
                        try {
                            const latestForm = quickAddFormRef.current;
                            if (onAddNewProduct) {
                                await onAddNewProduct(latestForm);
                            }
                            setShowQuickAdd(false);
                            setQuickAddForm(prev => ({
                                barcode_no: '', item_name: '', rack_location: prev.rack_location || localStorage.getItem('joah_last_rack_location') || '',
                                category_1_actual: '', category_2_actual: '',
                                qty: 0, max_qty: 0, product_tag: '',
                                remarks: 'ເພີ່ມໃໝ່ຜ່ານຫນ້າ Dashboard'
                            }));
                            if (onRefresh) onRefresh();
                        } catch (err) {
                            showError('Error saving product: ' + err.message);
                        } finally {
                            setIsSavingQuickAdd(false);
                        }
                    }}
                    masterData={masterData}
                    results={results}
                    allResults={allResults}
                    t={t}
                    currentBranch={currentBranch}
                />

                <StoreEditPanel
                    selectedRow={selectedRow}
                    onClose={() => { setSelectedRow(null); setEditQty(''); setEditLocation(''); setEditReason(''); setEditTag(''); setEditMaxQty(''); }}
                    editQty={editQty} setEditQty={setEditQty}
                    editLocation={editLocation} setEditLocation={setEditLocation}
                    editCat1={editCat1} setEditCat1={setEditCat1}
                    editCat2={editCat2} setEditCat2={setEditCat2}
                    editReason={editReason} setEditReason={setEditReason}
                    editTag={editTag} setEditTag={setEditTag}
                    editMaxQty={editMaxQty} setEditMaxQty={setEditMaxQty}
                    currentUser={currentUser}
                    isUpdating={isUpdating}
                    handleUpdate={handleUpdateMasterQty}
                    handleSplit={() => { }}
                    handleClone={handleCloneMasterQty}
                    results={results}
                    allResults={allResults}
                    mergeAmount={mergeAmount}
                    setMergeAmount={setMergeAmount}
                    t={t}
                    currentBranch={currentBranch}
                />
            </div>

            {/* Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onDetected={(code) => {
                        setSearchTerm(code);
                        setCurrentPage(1);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}
        </>
    );
};

export default StoreResultTable;
