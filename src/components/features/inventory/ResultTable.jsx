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
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';
import LanguageWarningModal from '../../ui/LanguageWarningModal';
import { CATEGORY_RACK_RULES, getRackSuggestions, BRANCH_RACK_RULES, getBranchCategories, resolveBranchId } from '../../../utils/rackUtils';
import barcodeNotCorrectSound from '../../../assets/Sound/Barcodenotcorrect.wav';

const ResultTable = ({
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
    const [showLanguageWarning, setShowLanguageWarning] = useState(false);
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
                success(`ອັບເດດ ${row.barcode} ສຳເລັດ!`);
            } else {
                success(`ບໍ່ພົບການປ່ຽນແປງສຳລັບ ${row.barcode} ໃນฐานข้อมูล`);
            }
        } catch (err) {
            showError('ດຶງຂໍ້ມູນเฉพาะจุดผิດພາດ: ' + err.message);
        } finally {
            setRefreshingRowId(null);
        }
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

    // ── 🆕 Realtime Listener for Massive Imports ──
    useEffect(() => {
        console.log('📡 [SYNC] Setting up Realtime listener on app_sync_signals...');
        const channel = supabase.channel('app_sync_signals_inv')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_sync_signals' }, (payload) => {
                console.log('📡 [SYNC] Signal received:', payload);
                if (payload.new && payload.new.signal_name === 'massive_import_done') {
                    console.log('📡 [SYNC] Auto-refresh triggered!');
                    success('มีการนำเข้าข้อมูลขนาดใหญ่ ระบบกำลังรีเฟรชข้อมูลล่าสุด...');
                    setIsRefreshing(true);
                    if (onRefresh) onRefresh({ silent: false, delta: true });
                    setTimeout(() => setIsRefreshing(false), 1500); // Visual feedback
                }
            })
            .subscribe((status, err) => {
                console.log('📡 [SYNC] Channel status:', status, err || '');
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [onRefresh]);

    const itemsPerPage = 50;
    const rowRefs = useRef({}); // Store refs for each barcode row

    // Combine real results with optimistically added items
    // Use Set to prevent duplicates if refresh happens but optimistic state is not cleared yet
    // Filter duplicates by checking barcode + rackLocation
    const combinedResults = useMemo(() => {
        // Use both barcode+location AND real DB IDs as dedup keys
        const existingKeys = new Set(results.map(r => `${r.barcode}-${r.rackLocation}`));
        const existingIds = new Set(results.map(r => r.id).filter(Boolean));
        const newItems = optimisticItems.filter(item => {
            // Remove optimistic item if DB already has a matching real record
            if (item.id && existingIds.has(item.id)) return false;
            // Remove if barcode+location already exists in real results
            if (existingKeys.has(`${item.barcode}-${item.rackLocation}`)) return false;
            return true;
        });
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
            let query = supabase
                .from('inventory_history')
                .select('*')
                .eq('barcode', barcode)
                .order('updated_at', { ascending: false });

            // Ensure we strictly fetch history for the currently viewed branch only
            if (currentBranch) {
                query = query.eq('branch_id', currentBranch);
            }

            const { data, error } = await query;
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
                    itemName: row.itemName || row.masterItemName,
                    oldQty: oldQty,
                    newQty: newQty,
                    oldRack: row.rackLocation,
                    newRack: row.rackLocation,
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

    const handleUpdateMasterQty = async (reasonOverride) => {
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
                manualReason: reasonOverride || editReason // Store the user's manual reason separately
            });
        }

        try {
            if (dbSource === 'supabase') {
                if (!selectedRow.id) throw new Error("ບໍ່ພົບ Record ID ໃນຖານຂໍ້ມູນ.");

                // Validate Reason if changes detected
                const hasRackChangedCheck = editLocation !== selectedRow.rackLocation;
                const hasCatChangedCheck = (editCat1 !== selectedRow.category1) || (editCat2 !== selectedRow.category2);
                const hasQtyChangedCheck = newQtyValue !== (selectedRow.qty || 0);

                const effectiveEditReason = reasonOverride || editReason;

                if ((hasRackChangedCheck || hasCatChangedCheck || hasQtyChangedCheck) && !effectiveEditReason.trim()) {
                    showError(t('results.reasonRequired'));
                    setIsUpdating(false);
                    return;
                }

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
                if (effectiveEditReason.trim()) {
                    detailedReason += `: ${effectiveEditReason.trim()}`;
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
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: oldQtyValue,
                    newQty: newQtyValue,
                    oldRack: selectedRow.rackLocation || null,
                    newRack: editLocation || null,
                    oldCat1: selectedRow.category1 || null,  // ✅ Category tracking
                    newCat1: editCat1 || null,               // ✅ Category tracking
                    oldCat2: selectedRow.category2 || null,  // ✅ Category tracking
                    newCat2: editCat2 || null,               // ✅ Category tracking
                    updatedBy: activeUser,
                    reason: detailedReason,
                    branchId: currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id')
                });
            }
            success(t('results.saveSuccess'));
            // Clear optimistic items — DB refresh is source of truth now
            setOptimisticItems([]);
            if (onRefresh) onRefresh({ silent: true, delta: true });
            setSelectedRow(null);
            setEditReason(''); // Reset reason
            setMergeAmount(''); // Reset merge amount after save
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
            ? `${currentUser.name} (${currentUser.id})`
            : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');
        const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');

        setIsUpdating(true);
        try {
            if (dbSource === 'supabase') {
                // 1. Insert clone row (does NOT touch original row qty)
                const clonePayload = {
                    barcode_no: selectedRow.barcode,
                    item_name: selectedRow.itemName || selectedRow.masterItemName,
                    rack_location: newRackLocation,
                    category_1_actual: selectedRow.category1 || '',
                    category_2_actual: selectedRow.category2 || '',
                    qty: cloneQtyNum,
                    remarks: `Clone from ${selectedRow.rackLocation || 'N/A'}: ${cloneReason}`,
                    uploaded_by: activeUser
                };
                const result = await addLocationRecord(clonePayload, branchToSave);
                if (!result.success) throw new Error(result.error);

                // 2. Log History for the new cloned record
                await logInventoryHistory({
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: 0,
                    newQty: cloneQtyNum,
                    oldRack: null,
                    newRack: newRackLocation,
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
                rowIndex: results.length + (typeof optimisticItems !== 'undefined' ? optimisticItems.length : 0) + 1
            };
            setOptimisticItems(prev => [newOptimisticItem, ...prev]);

            success('ໂຄລນ SKU ສຳເລັດ! ✅');
            if (onRefresh) onRefresh({ silent: true, delta: true });
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
        const activeUser = currentUser ? `${currentUser.name} (${currentUser.id})` : (localStorage.getItem('joah_employee_name') || 'Unknown Staff');

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
                    .from('location_inventory')
                    .update({
                        qty: remainingQty,
                        remarks: `Split ${splitQtyNum} to ${newRackLocation} by ${activeUser}`,
                        uploaded_by: activeUser
                    })
                    .eq('id', selectedRow.id);
                if (updateError) throw updateError;

                // 2. Insert new record logic using logic from addLocationRecord
                const newPayload = {
                    barcode_no: selectedRow.barcode,
                    item_name: selectedRow.itemName || selectedRow.masterItemName,
                    rack_location: newRackLocation,
                    category_1_actual: selectedRow.category1 || '',
                    category_2_actual: selectedRow.category2 || '',
                    qty: splitQtyNum,
                    remarks: `Split from ${selectedRow.rackLocation}: ${splitReason}`,
                    uploaded_by: activeUser
                };
                
                const result = await addLocationRecord(newPayload, branchToSave);
                if (!result.success) throw new Error(result.error);
                
                // 3. Log History for Old Record Deduct
                await logInventoryHistory({
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: oldQtyNum,
                    newQty: remainingQty,
                    oldRack: selectedRow.rackLocation,
                    newRack: selectedRow.rackLocation,
                    updatedBy: activeUser,
                    reason: `ແບ່ງເຄື່ອງອອກໄປ Rack ${newRackLocation} ຈຳນວນ ${splitQtyNum} : ${splitReason}`,
                    branchId: branchToSave
                });
                
                // 4. Log History for New Record Add
                await logInventoryHistory({
                    barcode: selectedRow.barcode,
                    itemName: selectedRow.itemName || selectedRow.masterItemName,
                    oldQty: 0,
                    newQty: splitQtyNum,
                    oldRack: null, // New rack insertion
                    newRack: newRackLocation,
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

            success('ແຍກ SKU ສຳເລັດ! ✅');
            if (onRefresh) onRefresh({ silent: true, delta: true });
            setSelectedRow(null);
            setEditReason('');
            setMergeAmount('');
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

            // Ensure we preserve the specified rack_location even if QTY is 0
            const finalPayload = {
                ...quickAddForm,
                rack_location: quickAddForm.rack_location,

                uploaded_by: activeUser
            };

            const branchToSave = currentBranch || currentUser?.branch_id || localStorage.getItem('joah_branch_id');
            const result = await addLocationRecord(finalPayload, branchToSave);
            if (result.success) {
                // Log History for New Item
                await logInventoryHistory({
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    oldQty: 0,
                    newQty: quickAddForm.qty,
                    updatedBy: activeUser,
                    reason: quickAddForm.remarks || 'Direct Addition to Inventory',
                    branchId: branchToSave
                });

                // --- NEW: Log to dedicated "Added Items" Log (For Tracking New Insertions) ---
                const { error: logError } = await supabase.from('added_items_log').insert({
                    barcode: quickAddForm.barcode_no,
                    item_name: quickAddForm.item_name,
                    qty: quickAddForm.qty,
                    added_by: activeUser,
                    location: finalPayload.rack_location,
                    remarks: quickAddForm.remarks || 'Direct Addition to Inventory',
                    branch_id: branchToSave
                });
                if (logError) console.error("Failed to log added item:", logError);
                // --------------------------------------------------------------------------

                // ── 🆕 Deduct DC stock if "New Stock In" OR "First-time product data recording" ─────────────
                const remarkStr = quickAddForm.remarks || '';
                const isNewStockRemark = remarkStr.includes('New Stock In') || 
                                         remarkStr.includes('ສິນຄ້າເຂົ້າໃໝ່') || 
                                         remarkStr.includes('First-time product data recording') || 
                                         remarkStr.includes('ການບັນທຶກຂໍ້ມູນສິນຄ້າໜ້າຮ້ານຄັ້ງທຳອິດ');

                if (isNewStockRemark && Number(quickAddForm.qty) > 0) {
                    try {
                        const deductAmt = Number(quickAddForm.qty);
                        const { data: dcData } = await supabase
                            .from('table_dc_stock')
                            .select('qty')
                            .eq('barcode', quickAddForm.barcode_no)
                            .eq('branch_id', branchToSave)
                            .maybeSingle();
                        
                        if (dcData) {
                            const newDcQty = Math.max(0, (dcData.qty || 0) - deductAmt);
                            await supabase
                                .from('table_dc_stock')
                                .update({ qty: newDcQty, updated_at: new Date().toISOString() })
                                .eq('barcode', quickAddForm.barcode_no)
                                .eq('branch_id', branchToSave);
                        }
                    } catch (dcErr) {
                        console.error("Failed to deduct from DC Stock", dcErr);
                    }
                }

                // Optimistic UI Update: Add to local state immediately
                const newOptimisticItem = {
                    id: `temp-${Date.now()}`, // Temporary ID
                    barcode: quickAddForm.barcode_no,
                    itemName: quickAddForm.item_name,
                    qty: Number(quickAddForm.qty),
                    rackLocation: finalPayload.rack_location, // Use specified location
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
                        'Last Update', 'Employee ID', 'Verifier', 'Manual Change Reason'
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
                            sanitize(vId),
                            sanitize(vName),
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
                            { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 30 }
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
                        headers = ['Barcode No.', 'Item Name', 'Rack Location', 'Actual QTY', 'Employee ID', 'Verifier'];
                    } else {
                        headers = [
                            'Barcode No.', 'Item Name', 'Rack Location', 'Category-1', 'Category-2',
                            'Actual QTY', 'System QTY', 'Status', 'Status Reason',
                            'Last Update', 'Employee ID', 'Verifier', 'Manual Change Reason'
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
                                    sanitize(vId),
                                    sanitize(vName)
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
                                    sanitize(vId),
                                    sanitize(vName),
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
                            sheet.columns = [{ width: 15 }, { width: 35 }, { width: 15 }, { width: 12 }, { width: 15 }, { width: 20 }];
                        } else {
                            sheet.columns = [
                                { width: 15 }, { width: 30 }, { width: 15 }, { width: 15 }, { width: 15 },
                                { width: 12 }, { width: 12 }, { width: 12 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 20 }, { width: 30 }
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
            <LanguageWarningModal 
                isOpen={showLanguageWarning} 
                onClose={() => setShowLanguageWarning(false)} 
            />

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
                                className={`input-field pl-14 pr-12 font-bold ${
                                    searchTerm.length > 0 && filteredResults.length > 0 && !filteredResults.some(r => r.barcode === searchTerm)
                                        ? 'border-red-500 ring-2 ring-red-500/50 animate-pulse'
                                        : ''
                                }`}
                                value={searchTerm}
                                onChange={(e) => { 
                                    setSearchTerm(e.target.value.replace(/\s+/g, '')); 
                                    setCurrentPage(1); 
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === ' ') e.preventDefault();
                                    if (e.key === 'Enter' && searchTerm.length >= 5) {
                                        // 💡 NEW LOGIC: Check for Thai/Lao characters or no numbers (Language forgot to switch)
                                        const hasThaiLao = /[\u0E00-\u0E7F\u0E80-\u0EFF]/.test(searchTerm);
                                        const hasNoNumbers = !/\d/.test(searchTerm);
                                        
                                        if (hasThaiLao || hasNoNumbers) {
                                            const audio = new Audio(barcodeNotCorrectSound);
                                            audio.play().catch(err => console.error("Error playing sound:", err));
                                            setShowLanguageWarning(true);
                                            return;
                                        }

                                        // 💡 NEW LOGIC: Check if exact barcode exists in filtered results
                                        const exactMatch = filteredResults.find(r => r.barcode === searchTerm);
                                        
                                        // If no exact match is found, prompt to Quick Add
                                        if (!exactMatch) {
                                            if (dbSource !== 'supabase') {
                                                alert('⚠️ Please connect to Cloud first.');
                                                return;
                                            }

                                            if (window.confirm(`ສິນຄ້ານີ້ບໍ່ມີໃນ Inventory ຫຼື ຍັງບໍ່ໄດ້ສະແກນໃນໂລເຄຊັ້ນນີ້, ຕ້ອງການເພີ່ມໃໝ່ເລີຍບໍ່? (Barcode: ${searchTerm})`)) {
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
                                    }
                                }}
                            />
                            <button
                                onClick={() => setShowScanner(true)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-xl text-slate-400 hover:text-joah-orange hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-all"
                                title="Scan Barcode"
                            >
                                <ScanLine size={18} />
                            </button>
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
                                        <button
                                            onClick={() => handleExportWithColor('auto-fix')}
                                            className="w-full p-4 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all flex items-center gap-4 group text-left"
                                        >
                                            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-110 transition-transform">
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
                            <button onClick={handleManualRefresh} disabled={isRefreshing || cooldownRemaining > 0} className={`btn-secondary py-3 text-[10px] min-w-[120px] font-bold ${cooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <RotateCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                                <span>{isRefreshing ? t('results.loading') : cooldownRemaining > 0 ? `ລໍຖ້າ ${Math.floor(cooldownRemaining / 60)}:${(cooldownRemaining % 60).toString().padStart(2, '0')}` : t('navbar.refresh')}</span>
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
                                    <th className="px-6 py-6 text-[11px] font-black text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 hidden lg:table-cell">{t('results.category1')} & {t('results.category2')}</th>
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
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                        {t('results.shopQty')}<br/><span className="opacity-50">{t('results.shopQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                        {t('results.dcQty')}<br/><span className="opacity-50">{t('results.dcQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                        {t('results.salesQty')}<br/><span className="opacity-50">{t('results.salesQtySub')}</span>
                                    </th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                        {t('results.scrapQty')}<br/><span className="opacity-50">{t('results.scrapQtySub')}</span>
                                    </th>
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
                                            <td className="px-6 py-6 hidden lg:table-cell"><div className="space-y-2"><div className="h-3 w-20 bg-slate-200 dark:bg-slate-800 rounded"></div><div className="h-3 w-16 bg-slate-200 dark:bg-slate-800 rounded"></div></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-16 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-full mx-auto"></div></td>
                                            <td className="px-6 py-6"><div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded mx-auto"></div></td>
                                            <td className="px-8 py-6 text-right"><div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : currentResults.length > 0 ? (
                                    <>
                                        {/* INJECT PARTIAL MATCH WARNING ROW */}
                                        {searchTerm.length > 0 && !filteredResults.some(r => r.barcode === searchTerm) && (
                                            <tr className="bg-amber-50/50 dark:bg-amber-900/10 border-b-2 border-amber-200 dark:border-amber-800/50 relative z-20">
                                                <td colSpan="12" className="px-8 py-4">
                                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                                        <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
                                                            <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-full">
                                                                <AlertTriangle size={20} strokeWidth={2.5} />
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-black uppercase tracking-wider">ບໍ່ພົບບາໂຄດທີ່ກົງກັນ 100%</p>
                                                                <p className="text-xs font-bold opacity-80 mt-0.5">ບາໂຄດ <span className="font-mono bg-amber-200 dark:bg-amber-800/50 px-1 rounded text-black dark:text-white">{searchTerm}</span> ຍັງບໍ່ມີໃນລະບົບ (ລຸ່ມນີ້ແມ່ນບາໂຄດທີ່ຄ້າຍຄືກັນ)</p>
                                                            </div>
                                                        </div>
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
                                                            className="btn-primary py-2.5 px-6 rounded-xl shadow-lg shadow-joah-orange/20 whitespace-nowrap group hover:scale-105 active:scale-95 transition-all text-xs flex items-center gap-2"
                                                        >
                                                            <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                                                            <span className="font-black">ເພີ່ມສິນຄ້ານີ້ເລີຍ</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                        {currentResults.map((row) => (
                                            <tr
                                                key={row.rowIndex}
                                            ref={el => rowRefs.current[row.barcode] = el}
                                            className={`group transition-all duration-500 ${searchTerm === row.barcode ? 'bg-joah-orange/10 ring-2 ring-joah-orange shadow-lg shadow-joah-orange/20 z-10 relative' : 'hover:bg-joah-orange/[0.03] dark:hover:bg-joah-orange/[0.05]'}`}
                                        >
                                            <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-700">#{row.rowIndex}</td>
                                            <td className="px-6 py-6">
                                                <div className="flex flex-col gap-2 min-w-[220px] py-1">
                                                    <div className="flex items-center">
                                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-black font-mono tracking-wider shadow-sm">{row.barcode}</span>
                                                    </div>
                                                    <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 line-clamp-2 max-w-[280px] leading-relaxed" title={row.itemName || row.masterItemName}>{row.itemName || row.masterItemName || <span className="opacity-50 italic">Unnamed Item</span>}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6">
                                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-joah-orange/50 transition-all font-mono whitespace-nowrap">
                                                    <MapPin size={13} className="text-joah-orange shrink-0" />
                                                    <span className="text-[13px] font-black text-slate-700 dark:text-slate-200 tracking-wide uppercase whitespace-nowrap">{row.rackLocation}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-6 hidden lg:table-cell">
                                                <div className="flex flex-col gap-2 max-w-[180px]">
                                                    <div className="inline-flex w-fit items-center px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/30 shadow-sm">
                                                        <span className="text-[10px] font-extrabold uppercase tracking-widest truncate">{row.category1 || '-'}</span>
                                                    </div>
                                                    <div className="inline-flex w-fit items-center px-2 py-1 rounded-md bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/50 shadow-sm">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest truncate">{row.category2 || '-'}</span>
                                                    </div>
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
                                            <td className="px-6 py-6 text-center">
                                                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 leading-none">{row.shopQty || 0}</span>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{row.dcQty || 0}</span>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <span className="text-xl font-black text-amber-600 dark:text-amber-500 leading-none">{row.salesQty || 0}</span>
                                            </td>
                                            <td className="px-6 py-6 text-center">
                                                <span className="text-xl font-bold text-slate-300 dark:text-slate-600">-</span>
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
                                                    <button onClick={() => {
                                                        const sourceInfo = row.hasOwnProperty('id') ? "Source: location_inventory (Scanned from warehouse)" : "Source: master_data (No scan record)";
                                                        const debugStr = `🔍 DEBUG INFO:\n${sourceInfo}\n\nRAW DATA:\n${JSON.stringify(row, null, 2)}`;
                                                        navigator.clipboard.writeText(debugStr).then(() => {
                                                            alert(`✅ ຂໍ້ມູນຖືກ Copy ແລ້ວ!\n\n${debugStr}`);
                                                        }).catch(() => {
                                                            prompt("Copy ຂໍ້ມູນຢູ່ດ້ານລຸ່ມນີ້:", debugStr);
                                                        });
                                                        console.log("DEBUG ROW:", row);
                                                    }} className="p-2 px-3 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold hover:bg-purple-100 hover:scale-105 transition-all flex items-center gap-1 text-[10px]" title="Debug & Copy data">
                                                        <Database size={14} /> DEBUG
                                                    </button>
                                                    <button onClick={() => setDiagnosticRow(row)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-joah-orange transition-all" title="View Diagnostics">
                                                        <Info size={18} />
                                                    </button>
                                                    {dbSource === 'supabase' && (
                                                        <button onClick={() => fetchHistory(row.barcode)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-indigo-500 transition-all" title="View History">
                                                            <History size={18} />
                                                        </button>
                                                    )}
                                                    <button onClick={() => refreshSingleRow(row)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-emerald-500 transition-all" title="Refresh Item">
                                                        <RotateCw size={18} className={refreshingRowId === (row.id || row.barcode) ? 'animate-spin text-emerald-500' : ''} />
                                                    </button>
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
                                        ))}
                                    </>
                                ) : (
                                    <tr>
                                        <td colSpan="7" className="py-24 text-center">
                                            <div className="flex flex-col items-center gap-6 text-slate-300 dark:text-slate-700 animate-fade-in">
                                                <div className="w-20 h-20 rounded-full bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center text-slate-300 shadow-inner">
                                                    <Package size={40} strokeWidth={1.5} />
                                                </div>
                                                <div className="space-y-2">
                                                    <p className="text-lg font-black text-slate-800 dark:text-white">ບໍ່ພົບຂໍ້ມູນໃນລາຍການ</p>
                                                    {searchTerm.length > 0 ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <p className="text-sm font-bold text-slate-400">ບໍ່ພົບຜົນການຄົ້ນຫາສຳລັບ: <span className="text-joah-orange font-mono underline decoration-2 underline-offset-4">{searchTerm}</span></p>
                                                            {filteredResults.length > 0 && (
                                                                <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-center max-w-sm">
                                                                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">
                                                                        ⚠️ ພົບບາໂຄດທີ່ຄ້າຍຄືກັນ ແຕ່ບໍ່ກົງກັນ 100%
                                                                    </p>
                                                                    <p className="text-[10px] text-amber-600 dark:text-amber-500">
                                                                        ຖ້ານີ້ແມ່ນສິນຄ້າໃໝ່ ຫຼື ສິນຄ້າທີ່ຍັງບໍ່ເຄີຍສະແກນ, ກະລຸນາເພີ່ມເຂົ້າລະບົບ.
                                                                    </p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm font-bold text-slate-400 tracking-widest uppercase">ກະລຸນາລອງຄົ້ນຫາຄືນໃໝ່</p>
                                                    )}
                                                </div>
                                                {searchTerm.length >= 5 && (
                                                    <button
                                                        onClick={() => {
                                                            // Block if barcode has Lao/Thai chars or no numbers
                                                            const hasThaiLao = /[\u0E00-\u0E7F\u0E80-\u0EFF]/.test(searchTerm);
                                                            const hasNoNumbers = !/\d/.test(searchTerm);
                                                            if (hasThaiLao || hasNoNumbers) {
                                                                const audio = new Audio(barcodeNotCorrectSound);
                                                                audio.play().catch(() => {});
                                                                setShowLanguageWarning(true);
                                                                return;
                                                            }
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
                    handleSplit={handleSplitMasterQty}
                    handleClone={handleCloneMasterQty}
                    results={results}
                    allResults={allResults}
                    mergeAmount={mergeAmount}
                    setMergeAmount={setMergeAmount}
                    t={t}
                    currentBranch={currentBranch}
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

export default ResultTable;
