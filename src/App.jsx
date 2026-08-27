import { useState, useEffect, useRef, useCallback } from 'react';
import FileUpload from './components/features/admin/FileUpload';
import SheetMapper from './components/features/admin/SheetMapper';
import Dashboard from './components/features/inventory/Dashboard';
import ResultTable from './components/features/inventory/ResultTable';
import Navbar from './components/layout/Navbar';
import {
  readExcelFile,
  readExcelFromUrl,
  getSheetNames,
  sheetToJSON,
  validateData,
  suggestSheetMapping
} from './utils/excelProcessor';
import { supabase } from './utils/supabaseClient';
import { fetchMasterFromSupabase, syncMasterDataToSupabase, syncLocationResultsToSupabase, fetchLocationFromSupabase, fetchOdooFromSupabase, logStoreInventoryHistory, fetchDcFromSupabase, fetchStoreInventoryFromSupabase } from './utils/supabaseSync';
import HistoryLog from './components/features/inventory/HistoryLog';
import { RefreshCw, Database, UploadCloud, Upload, LayoutDashboard, Database as DBIcon, Play, Moon, Sun, X, RotateCw, Sparkles, ShieldCheck, History, Trash2, CheckCircle, Wifi, WifiOff, Bell, ClipboardCheck, FileArchive, BarChart3, ChevronDown, TrendingUp, TrendingDown, Bot, Box, Tag } from 'lucide-react';
import joahLogo from './assets/Joah.jpeg';
import databaseUrl from './assets/DataBaseJoah.xlsx';
import imgImportFile from './assets/ImportFile.png';
import imgCloudDB from './assets/CloudRecordDatabase.png';
import imgOdoo from './assets/OdooImage.png';
import imgExcelResize from './assets/ExelResize.png';
import imgStoreClosing from './assets/RequestfromWarehouse.png';
import imgStoreRequest from './assets/StoreRequest.png';
import imgHQCenter from './assets/JoahHQcentercompressed.png';
import imgStoreInventory from './assets/StoreInventory.png';
import imgCheckPrice from './assets/Icons_AppJoah/checkpirce.webp';

import Login from './components/features/auth/Login';
import OdooMonitor from './components/features/admin/OdooMonitor';
import StoreRequest from './components/features/store/StoreRequest';
import StoreRequestManager from './components/features/store/StoreRequestManager';
import StoreInventoryMockup from './components/features/store/StoreInventoryMockup';
import StoreInventory from './components/features/store/StoreInventory';
import StoreInboxPanel from './components/features/store/StoreInboxPanel';
import StoreQuickAddPanel from './components/features/store/StoreQuickAddPanel';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { LowStockProvider } from './contexts/LowStockContext';
import MasterAudit from './components/features/admin/MasterAudit';
import ProductManager from './components/features/admin/ProductManager';
import HQCommandCenter from './components/features/admin/HQCommandCenter';
import Footer from './components/layout/Footer';
import LandingPage from './components/layout/LandingPage';
import AppLauncher from './components/layout/AppLauncher';
import RubikNetworkParticles from './components/ui/RubikNetworkParticles';
import LoadingOverlay from './components/ui/LoadingOverlay';
import StoreClosingChecklist from './components/features/store/StoreClosingChecklist';
import ExcelCompressor from './components/Tools/excel-compressor';
import SalesAggregator from './components/Tools/SalesAggregator';
import DcStockImporter from './components/Tools/DcStockImporter';
import OdooSalesViewer from './components/Tools/OdooSalesViewer';
import OdooStockAdjustmentView from './components/Tools/OdooStockAdjustmentView';
import TestTaladlaoImporter from './components/Tools/TestTaladlaoImporter';
import OdooSyncEngine from './components/Tools/OdooSyncEngine';
import OdooTransferViewer from './components/features/odoo/OdooTransferViewer';
import StockCountLak8 from './components/features/inventory/StockCountLak8';
import CheckPrice from './components/Tools/CheckPrice';
import InventoryOverviewDashboard from './components/features/odoo/InventoryOverviewDashboard';
import ReloadPrompt from './components/ui/ReloadPrompt';
import {
  CloudDatabaseIcon,
  ProductBoxIcon,
  AuditDatabaseIcon,
  SyncOdooIcon,
  StoreRequestIcon
} from './components/ui/AnimatedIcons';
import DemoPlan from './components/Sanbox/DemoPlan';


import AIChatBotFull from './components/ui/AIChatBotFull';
import JoiWidget from './components/ui/JoiWidget';
import BigDigitalClock from './components/ui/BigDigitalClock';
import RefillAlertModal from './components/ui/RefillAlertModal';

function AppContent() {
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const [step, setStep] = useState(() => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/checkprice')) return 'check-price';
    if (path.startsWith('/landing')) return 'landing';
    return 'upload';
  });

  // Sync URL when step changes so user can bookmark or copy link
  useEffect(() => {
    const newPath = step === 'check-price' ? '/checkprice' : step === 'landing' ? '/landing' : '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  }, [step]);

  const [workbook, setWorkbook] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [locationSheetName, setLocationSheetName] = useState('');
  const [suggestions, setSuggestions] = useState({});
  const [validationResults, setValidationResults] = useState([]);
  const [masterData, setMasterData] = useState([]);
  const [stats, setStats] = useState({ total: 0, passed: 0, mismatch: 0, missing: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0); // For LoadingOverlay percentage
  const [loadingOverlayMessage, setLoadingOverlayMessage] = useState(null); // Custom message
  const [showProgressBar, setShowProgressBar] = useState(true); // Toggle progress bar visibility
  const [filterStatus, setFilterStatus] = useState('all');
  const [dbSource, setDbSource] = useState('excel');
  const [dataSourceLabel, setDataSourceLabel] = useState('Local Mode (Excel)');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [loadedFileName, setLoadedFileName] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showStoreRequestManager, setShowStoreRequestManager] = useState(false);
  const [showStoreInbox, setShowStoreInbox] = useState(false);
  const [showAppLauncher, setShowAppLauncher] = useState(false);
  const [preFilledBarcode, setPreFilledBarcode] = useState(null);
  // Inbox → QuickAdd flow (for new products received from store_requests)
  const [inboxQuickAddData, setInboxQuickAddData] = useState(null); // { barcode_no, item_name, qty, _inboxItemId, _inboxBatchId }
  const [inboxQuickAddForm, setInboxQuickAddForm] = useState({ barcode_no: '', item_name: '', qty: 0, max_qty: 0, rack_location: '', category_1_actual: '', category_2_actual: '', product_tag: '', remarks: '' });
  const [isInboxQuickAddFoundInMaster, setIsInboxQuickAddFoundInMaster] = useState(false);
  const [isSavingInboxQuickAdd, setIsSavingInboxQuickAdd] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [locationFilter, setLocationFilter] = useState(''); // New Location Filter State
  const [hideZeroQty, setHideZeroQty] = useState(false); // Filter to hide items with 0 Qty
  const [importBranch, setImportBranch] = useState(''); // Branch target for import/sync
  const [adminViewBranch, setAdminViewBranch] = useState('ຕະຫຼາດລາວ'); // Branch Admin เลือกดูใน Cloud (Default to TLL)
  const [autoSyncMaster, setAutoSyncMaster] = useState(false); // Checkbox for Master Data Sync

  // --- Realtime State ---
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected'); // 'connected', 'disconnected', 'connecting'
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastChangeBy, setLastChangeBy] = useState('');
  const [showRealtimeBanner, setShowRealtimeBanner] = useState(false);
  const debounceTimerRef = useRef(null);
  const isRefreshingRef = useRef(false);

  // 🚀 Delta Sync State
  const [rawLocationRows, setRawLocationRows] = useState([]);
  const [lastLocationSyncTime, setLastLocationSyncTime] = useState(null);

  const isPSNUser = user?.branch_id?.startsWith('ໂພນສີນວນ');
  const isAdmin = user?.role === 'HQ'; // เฉพาะ HQ เท่านั้นที่เข้า Admin menu ได้
  const filteredResults = validationResults.filter(r => {
    const matchesLocation = locationFilter ? r.rackLocation === locationFilter : true;
    const matchesHideZero = hideZeroQty ? Number(r.qty) !== 0 : true;
    return matchesLocation && matchesHideZero;
  });

  // Recalculate Stats based on Filtered Results (Dynamic Dashboard)
  const dashboardStats = {
    total: filteredResults.length,
    passed: filteredResults.filter(r => r.status === 'passed').length,
    mismatch: filteredResults.filter(r => r.status === 'mismatch').length,
    missing: filteredResults.filter(r => r.status === 'missing').length,
    zeroQty: filteredResults.filter(r => Number(r.qty) === 0).length,
    hasQty: filteredResults.filter(r => Number(r.qty) > 0).length
  };

  // 🔄 Auto-Login from LocalStorage
  useEffect(() => {
    const storedId = localStorage.getItem('joah_employee_id');
    const storedName = localStorage.getItem('joah_employee_name');
    const storedRole = localStorage.getItem('joah_employee_role');
    const storedWorkplace = localStorage.getItem('joah_employee_workplace');
    const storedBranch = localStorage.getItem('joah_branch_id');

    if (storedId && storedName) {
      const CASHIER_EMPLOYEE_IDS = ['K2603252', 'K2603244', 'K2603249', 'K2603253', 'K2603251', 'K2605364', 'TEMP0001'];
      const isCashier = storedRole === 'cashier' || CASHIER_EMPLOYEE_IDS.includes(String(storedId).toUpperCase());

      // 🔒 Cashier security: Do NOT auto-login on refresh. Force login prompt.
      if (isCashier) {
        localStorage.removeItem('joah_employee_id');
        localStorage.removeItem('joah_employee_name');
        localStorage.removeItem('joah_employee_role');
        localStorage.removeItem('joah_employee_workplace');
        localStorage.removeItem('joah_branch_id');
        setIsLoggedIn(false);
        setUser(null);
        return;
      }

      const branch = storedBranch || 'ຕະຫຼາດລາວ';
      const currentUserObj = {
        id: storedId,
        name: storedName,
        role: storedRole || 'staff',
        workplace: storedWorkplace || 'front',
        branch_id: branch
      };
      setUser(currentUserObj);
      setImportBranch(branch);
      setAdminViewBranch(branch);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    // 1. Clear LocalStorage
    localStorage.removeItem('joah_employee_id');
    localStorage.removeItem('joah_employee_name');
    localStorage.removeItem('joah_employee_role');
    localStorage.removeItem('joah_employee_workplace');
    localStorage.removeItem('joah_branch_id');

    // 2. Clear All Related States to prevent UI leakage
    setIsLoggedIn(false);
    setUser(null);
    setStep('upload');
    setWorkbook(null);
    setRawFile(null);
    setSheetNames([]);
    setLocationSheetName('');
    setSuggestions({});
    setValidationResults([]);
    setMasterData([]);
    setStats({ total: 0, passed: 0, mismatch: 0, missing: 0 });
    setIsProcessing(false);
    setLoadingProgress(0);
    setLoadingOverlayMessage(null);
    setShowProgressBar(true);
    setFilterStatus('all');
    setDbSource('excel');
    setDataSourceLabel('Local Mode (Excel)');
    setRefreshTrigger(0);
    setLoadedFileName('');
    setShowHistory(false);
    setShowStoreRequestManager(false);
    setShowStoreInbox(false);
    setShowAppLauncher(false);
    setPreFilledBarcode(null);
    setShowAdminMenu(false); // <--- Bug Fix: Close admin menu
    setLocationFilter('');
    setHideZeroQty(false);
    setImportBranch('');
    setAdminViewBranch(''); // <--- Bug Fix: Clear admin view branch
    setAutoSyncMaster(false);
    setRealtimeStatus('disconnected');
    setPendingChanges(0);
    setLastChangeBy('');
    setRawLocationRows([]); // 🚀 Clear Delta Sync State
    setLastLocationSyncTime(null);
  };

  const handleReset = () => {
    setStep('upload');
    setValidationResults([]);
    setDbSource('excel');
    setDataSourceLabel('Local Mode (Excel)');
  };



  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleLogin = (userInfo) => {
    setUser(userInfo);
    const loginBranch = userInfo.branch_id || 'ຕະຫຼາດລາວ';
    setImportBranch(loginBranch);
    setAdminViewBranch(loginBranch);
    setIsLoggedIn(true);

    const CASHIER_EMPLOYEE_IDS = ['K2603252', 'K2603244', 'K2603249', 'K2603253', 'K2603251', 'K2605364', 'TEMP0001'];
    if (userInfo.role === 'cashier' || (userInfo.id && CASHIER_EMPLOYEE_IDS.includes(String(userInfo.id).toUpperCase()))) {
      setStep('check-price');
    }
  };

  // 🔒 Lock Cashier users to Check Price Terminal
  useEffect(() => {
    const CASHIER_EMPLOYEE_IDS = ['K2603252', 'K2603244', 'K2603249', 'K2603253', 'K2603251', 'K2605364', 'TEMP0001'];
    const isCashier = user?.role === 'cashier' || 
      (user?.id && CASHIER_EMPLOYEE_IDS.includes(String(user.id).toUpperCase()));
    if (isLoggedIn && isCashier && step !== 'check-price') {
      setStep('check-price');
    }
  }, [isLoggedIn, user, step]);



  const handleGotoProductManager = (barcode) => {
    setPreFilledBarcode(barcode);
    setStep('product-manager');
  };

  const handleFileSelect = async (file) => {
    setIsProcessing(true);
    setRawFile(file);
    setDbSource('excel');
    setDataSourceLabel('Local Mode (Excel)');
    try {
      const wb = await readExcelFile(file);
      processWorkbook(wb);
    } catch (error) {
      alert('ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processWorkbook = (wb) => {
    const names = getSheetNames(wb);
    const suggested = suggestSheetMapping(names);
    setWorkbook(wb);
    setSheetNames(names);
    setSuggestions(suggested);
    if (suggested.location) setLocationSheetName(suggested.location);
    setStep('mapping');
  };

  const handleDatabaseLoad = async () => {
    setIsProcessing(true);
    setLoadingProgress(0);

    // Simulate progress bar animation (0% -> 90%) over ~3.5s
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 90) return prev;
        // Slow down as it gets higher
        const increment = prev < 50 ? 5 : prev < 80 ? 2 : 1;
        return prev + increment;
      });
    }, 100);

    // Add artificial delay to show the mascot (min 4 seconds)
    const mascotDelay = new Promise(resolve => setTimeout(resolve, 4000));

    try {
      // literal branch for locations and odoo.
      const branchToLoad = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;
      // normalized branch for master data
      const masterBranch = branchToLoad;

      const [[cloudMaster, cloudLocation, cloudOdoo]] = await Promise.all([
        Promise.all([
          fetchMasterFromSupabase(masterBranch),
          fetchLocationFromSupabase(branchToLoad),
          fetchOdooFromSupabase(branchToLoad)
        ]),
        mascotDelay
      ]);

      // Complete the progress bar (100%)
      clearInterval(progressInterval);
      setLoadingProgress(100);

      // Small delay to let user see 100%
      await new Promise(resolve => setTimeout(resolve, 500));

      if ((cloudMaster && cloudMaster.length > 0) || (cloudLocation && cloudLocation.length > 0)) {
        setDbSource('supabase');
        setDataSourceLabel('Cloud Mode (Supabase)');
        await handleValidate({
          locationSheet: 'Cloud Database',
          pSource: 'supabase'
        });
        return;
      } else {
        setDbSource('excel');
        setDataSourceLabel('Pre-built Mode (Local Assets)');

        const isError = cloudMaster === null || cloudLocation === null;
        if (isError) {
          alert('❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບ Cloud ໄດ້. ກະລຸນາກວດສອບ Internet ຫຼື Supabase Connection.');
        } else {
          alert('ℹ️ ຍັງບໍ່ມີຂໍ້ມູນໃນ Cloud (ທັງ Master ແລະ Inventory). ກະລຸນາ Sync ຂໍ້ມູນກ່ອນ ຫຼື ໃຊ້ຂໍ້ມູນຈາກໄຟລ໌ສ່ວນຕົວແທນ.');
        }
      }

      const wb = await readExcelFromUrl(databaseUrl);
      const names = getSheetNames(wb);
      const suggested = suggestSheetMapping(names);
      setRawFile(new File([], "DataBaseJoah.xlsx"));
      setLoadedFileName('DataBaseJoah.xlsx');
      setWorkbook(wb);
      setSheetNames(names);
      setSuggestions(suggested);
      if (suggested.location) setLocationSheetName(suggested.location);
      setStep('mapping');
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
      setLoadingProgress(0);
      clearInterval(progressInterval); // Ensure interval is cleared on error
    }
  };

  const handleValidate = async ({ locationSheet, dataSheet, pSource }) => {
    setIsProcessing(true);
    const activeSource = pSource || dbSource;
    setLocationSheetName(locationSheet || 'Cloud Database');
    try {
      let dataRows = [];
      let locationRows = [];
      let odooRows = [];
      let dcRows = [];
      let storeRows = [];
      const branchToLoad = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;

      if (activeSource === 'supabase') {
        const masterBranch = branchToLoad;

        const [cloudMaster, cloudLocation, cloudOdoo, cloudDc, cloudStore] = await Promise.all([
          fetchMasterFromSupabase(masterBranch),
          fetchLocationFromSupabase(branchToLoad),
          fetchOdooFromSupabase(branchToLoad),
          fetchDcFromSupabase(branchToLoad),
          fetchStoreInventoryFromSupabase(branchToLoad)
        ]);

        if (!cloudMaster || cloudMaster.length === 0) {
          console.warn("ບໍ່ພົບຂໍ້ມູນ Master Data ໃນ Cloud.");
        }

        dataRows = (cloudMaster || []).map(d => ({
          'CATEGORIES 1': d.category_1,
          'CATEGORIES 2': d.category_2,
          'Barcode': d.barcode,
          'product_name_la': d.product_name_la,
          'item_name': d.item_name,
          'Item Name': d.product_name_la || d.item_name,
          'Qty': d.qty,
          'updated_at': d.updated_at,
          'updated_by': d.updated_by
        }));

        locationRows = (cloudLocation || []).map(l => ({
          id: l.id,
          branch_id: l.branch_id,
          'Barcode': l.barcode_no,
          'Rack Location': l.rack_location,
          'Category-1': l.category_1_actual,
          'Category-2': l.category_2_actual,
          'QTY': l.qty,
          'Item Name': l.item_name,
          'uploaded_by': l.uploaded_by,
          'created_at': l.created_at
        }));

        odooRows = (cloudOdoo || []).map(o => ({
          barcode: o.barcode,
          qty: o.qty_odoo
        }));

        dcRows = cloudDc || [];
        storeRows = cloudStore || [];

      } else {
        if (!workbook) throw new Error("ກະລຸນາເລືອກໄຟລ໌ Excel ກ່ອນ.");

        const resolvedDataSheet = dataSheet || 'DATA';
        dataRows = sheetToJSON(workbook, resolvedDataSheet);
        locationRows = sheetToJSON(workbook, locationSheet);

        const [cloudOdoo, cloudDc, cloudStore] = await Promise.all([
          fetchOdooFromSupabase(user?.branch_id),
          fetchDcFromSupabase(user?.branch_id),
          fetchStoreInventoryFromSupabase(user?.branch_id)
        ]);

        odooRows = (cloudOdoo || []).map(o => ({
          barcode: o.barcode,
          qty: o.qty_odoo
        }));
        dcRows = cloudDc || [];
        storeRows = cloudStore || [];
      }

      const { results, stats } = validateData(locationRows, dataRows, odooRows, branchToLoad, dcRows, storeRows);
      setValidationResults(results);
      setMasterData(dataRows);
      setStats(stats);
      setStep('results');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateResultRowQty = (rowIndex, newData) => {
    setValidationResults(prev => prev.map(row => row.rowIndex === rowIndex ? { ...row, ...newData } : row));
  };

  const handleSyncToCloud = async () => {
    if (!workbook) return;

    const targetBranch = importBranch || user?.branch_id;
    if (!targetBranch) {
      alert('⚠️ ກະລຸນາເລືອກສາຂາກ່ອນ Sync');
      return;
    }

    const confirmed = window.confirm(`ຈະ Sync Master Data ໄປທີ່ສາຂາ: "${targetBranch}" ແມ່ນບໍ?`);
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      // Smart detect DATA sheet name instead of hardcoding 'DATA'
      const suggested = suggestSheetMapping(workbook.SheetNames);
      const dataSheetName = suggested.dataSheet || 'DATA';
      console.log('📂 Sync Master Data — Using sheet:', dataSheetName, '| Available:', workbook.SheetNames);
      const dataRows = sheetToJSON(workbook, dataSheetName);
      if (dataRows.length === 0) {
        alert(`⚠️ Sheet "${dataSheetName}" is empty or not found.\n\nAvailable sheets: ${workbook.SheetNames.join(', ')}`);
        setIsProcessing(false);
        return;
      }
      const result = await syncMasterDataToSupabase(dataRows, targetBranch);
      if (result.success) alert(`✅ Synced ${result.synced} items to "${targetBranch}"!`);
      else alert('❌ Sync Failed: ' + result.error);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Dedicated Cloud Refresh (Smart & Optimized) ---
  const refreshFromCloud = useCallback(async (options = { skipMaster: true, silent: false, delta: false }) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    // Only show loading overlay if NOT silent
    if (!options.silent) {
      setIsProcessing(true);
      setLoadingProgress(0); // Reset progress if showing overlay
    }
    try {
      console.log(`🔄 Refreshing cloud data (skipMaster: ${options.skipMaster}, delta: ${options.delta})...`);

      // Calculate branchToLoad FIRST
      const branchToLoad = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;

      // 🚀 DELTA SYNC LOGIC
      // If delta=true AND we have previously synced data, pass lastLocationSyncTime
      const isDeltaSync = options.delta && lastLocationSyncTime && rawLocationRows.length > 0;

      // Fetch dynamic data always using branchToLoad
      const fetchTasks = [
        fetchLocationFromSupabase(branchToLoad, isDeltaSync ? lastLocationSyncTime : null),
        fetchOdooFromSupabase(branchToLoad),
        fetchDcFromSupabase(branchToLoad),
        fetchStoreInventoryFromSupabase(branchToLoad)
      ];

      // Only fetch master if explicitly asked or if we don't have it yet
      const shouldFetchMaster = !options.skipMaster || masterData.length === 0;
      if (shouldFetchMaster) {
        // master uses the same branch logic
        fetchTasks.push(fetchMasterFromSupabase(branchToLoad));
      }

      const results = await Promise.all(fetchTasks);
      const cloudLocation = results[0]; // Full data OR Delta data
      const cloudOdoo = results[1];
      const cloudDc = results[2];
      const cloudStore = results[3];
      const cloudMaster = shouldFetchMaster ? results[4] : null;

      // Update master data state if we fetched it
      let activeMasterData = masterData;
      if (shouldFetchMaster && cloudMaster) {
        const mappedMaster = cloudMaster.map(d => ({
          'CATEGORIES 1': d.category_1,
          'CATEGORIES 2': d.category_2,
          'Barcode': d.barcode,
          'product_name_la': d.product_name_la,
          'item_name': d.item_name,
          'Item Name': d.product_name_la || d.item_name,
          'Qty': d.qty,
          'updated_at': d.updated_at,
          'updated_by': d.updated_by
        }));
        setMasterData(mappedMaster);
        activeMasterData = mappedMaster;
      }

      // 🧩 Merge Data if Delta Sync
      let finalLocationData = cloudLocation || [];
      if (isDeltaSync) {
        const deltaRows = cloudLocation || [];
        const numUpdates = deltaRows.length;

        // 🧪 DEBUG: Calculate approximate size in KB
        const approxBytes = new TextEncoder().encode(JSON.stringify(deltaRows)).length;
        const approxKB = (approxBytes / 1024).toFixed(2);

        console.table(deltaRows); // 🧪 DEBUG: Show full payload in console
        console.log(`🧩 Delta Sync: Received ${numUpdates} updated row(s), Size: ~${approxKB} KB`);

        // 🧪 DEBUG: Build detailed message text
        let detailString = '';
        if (numUpdates > 0 && numUpdates <= 20) {
          detailString = '\n\n📋 ລາຍລະອຽດ:\n' + deltaRows.map(r => `• ${r.barcode_no} (ສາຂາ: ${r.branch_id || 'N/A'})`).join('\n');
        } else if (numUpdates > 20) {
          detailString = '\n\n📋 ລາຍລະອຽດ: ຫຼາຍກວ່າ 20 ລາຍການ... (ສາມາດເບິ່ງເພີ່ມເຕີມໃນ Console F12)';
        }

        // Show an explicit alert to the user so they can verify the efficiency
        alert(`🚨 [DEBUG] Delta Sync\n\nໂໝດ: ປະຢັດ Egress Data 🚀\nພົບການປ່ຽນແປງ: ${numUpdates} ແຖວ\nໃຊ້ Data ໄປພຽງ: ~${approxKB} KB${detailString}`);

        const deltaMap = new Map(deltaRows.map(row => [row.id, row]));

        // Replace updated rows
        finalLocationData = rawLocationRows.map(row => deltaMap.has(row.id) ? deltaMap.get(row.id) : row);
        const existingIds = new Set(rawLocationRows.map(row => row.id));

        // Append newly inserted rows
        deltaRows.forEach(row => {
          if (!existingIds.has(row.id)) finalLocationData.push(row);
        });
      }

      setRawLocationRows(finalLocationData);
      setLastLocationSyncTime(new Date().toISOString());

      const locationRows = finalLocationData.map(l => ({
        id: l.id,
        branch_id: l.branch_id,
        'Barcode': l.barcode_no,
        'Rack Location': l.rack_location,
        'Category-1': l.category_1_actual,
        'Category-2': l.category_2_actual,
        'QTY': l.qty,
        'Item Name': l.item_name,
        'uploaded_by': l.uploaded_by,
        'created_at': l.created_at
      }));

      const odooRows = (cloudOdoo || []).map(o => ({
        barcode: o.barcode,
        qty: o.qty_odoo
      }));

      const { results: validatedResults, stats: validatedStats } = validateData(locationRows, activeMasterData, odooRows, branchToLoad, cloudDc || [], cloudStore || []);
      setValidationResults(validatedResults);
      setStats(validatedStats);
      setRefreshTrigger(Date.now());

      setPendingChanges(0);
      setShowRealtimeBanner(false);
    } catch (err) {
      console.error('Refresh from cloud error:', err);
    } finally {
      if (!options.silent) {
        setIsProcessing(false);
        setLoadingProgress(0);
        setLoadingOverlayMessage(null); // Reset to default
        setShowProgressBar(true); // Reset to default
      }
      isRefreshingRef.current = false;
    }
  }, [masterData, user, adminViewBranch, isAdmin, isPSNUser, lastLocationSyncTime, rawLocationRows]);

  // Keep refreshFromCloud ref updated to avoid re-subscribing loop
  const refreshFromCloudRef = useRef(refreshFromCloud);
  useEffect(() => { refreshFromCloudRef.current = refreshFromCloud; }, [refreshFromCloud]);

  // --- Supabase Realtime Subscription ---
  useEffect(() => {
    // Only subscribe when on results page AND using Supabase
    if (step !== 'results' || dbSource !== 'supabase') {
      setRealtimeStatus('disconnected');
      return;
    }

    setRealtimeStatus('connecting');
    const targetBranch = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;
    const branchFilter = (targetBranch && targetBranch !== 'All Branches') ? `branch_id=eq.${targetBranch}` : undefined;
    console.log(`🔌 Setting up Realtime subscription (Branch filter: ${branchFilter || 'All'})...`);

    const channelConfig = (table) => {
      const cfg = { event: '*', schema: 'public', table };
      if (branchFilter) cfg.filter = branchFilter;
      return cfg;
    };

    const channel = supabase
      .channel(`realtime-location-inventory_${targetBranch || 'all'}`)
      .on(
        'postgres_changes',
        channelConfig('location_inventory'),
        (payload) => {
          console.log('📡 Realtime change detected:', payload.eventType, payload);

          // 🚨 BRANCH FILTER SAFETY CHECK: Prevent changes from other branches from bleeding in!
          const payloadBranch = payload.new?.branch_id || payload.old?.branch_id;
          if (targetBranch !== 'All Branches' && payloadBranch && payloadBranch !== targetBranch) {
            console.log(`🛡️ Realtime ignored: Item is from ${payloadBranch}, but we are viewing ${targetBranch}`);
            return; // Skip this update!
          }

          // Show notification banner
          const changedBy = payload.new?.uploaded_by || payload.old?.uploaded_by || 'Unknown';
          const currentUserName = user?.name || localStorage.getItem('joah_employee_name') || '';

          // Only show banner if change was made by someone else
          if (changedBy !== currentUserName) {
            setLastChangeBy(changedBy);
            setPendingChanges(prev => prev + 1);
            setShowRealtimeBanner(true);

            // Auto-hide banner after 3 seconds
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = setTimeout(() => {
              setShowRealtimeBanner(false);
              setPendingChanges(0);
            }, 3000);

            // Delta update validation results
            setValidationResults(prev => {
              const targetBarcode = payload.new?.barcode_no || payload.old?.barcode_no;
              if (!targetBarcode) return prev;

              const existingIndex = prev.findIndex(r => r.barcode === targetBarcode);
              if (existingIndex !== -1) {
                if (payload.eventType === 'DELETE') {
                  return prev.filter(r => r.barcode !== targetBarcode);
                }
                const updatedRow = prev[existingIndex];
                const newData = payload.new;
                const newResults = [...prev];
                newResults[existingIndex] = {
                  ...updatedRow,
                  qty: newData.qty,
                  rackLocation: newData.rack_location,
                  category1: newData.category_1_actual,
                  category2: newData.category_2_actual,
                  uploadedBy: changedBy,
                  updatedAt: new Date().toISOString()
                };
                return newResults;
              } else if (payload.eventType === 'INSERT') {
                const newData = payload.new;
                return [
                  {
                    id: newData.id,
                    barcode: newData.barcode_no,
                    qty: newData.qty,
                    rackLocation: newData.rack_location,
                    category1: newData.category_1_actual,
                    category2: newData.category_2_actual,
                    itemName: newData.item_name,
                    uploadedBy: changedBy,
                    updatedAt: new Date().toISOString(),
                    status: 'passed',
                    rowIndex: prev.length + 1
                  },
                  ...prev
                ];
              }
              return prev;
            });
          }
        }
      )
      // 🚨 SUBSCRIBE TO table_dc_stock for Realtime DC Qty updates
      .on(
        'postgres_changes',
        channelConfig('table_dc_stock'),
        (payload) => {
          console.log('📡 Realtime DC Stock change:', payload);
          const payloadBranch = payload.new?.branch_id || payload.old?.branch_id;
          if (targetBranch !== 'All Branches' && payloadBranch && payloadBranch !== targetBranch) return;

          setValidationResults(prev => {
            const targetBarcode = payload.new?.barcode || payload.old?.barcode;
            if (!targetBarcode) return prev;
            return prev.map(r => {
              if (r.barcode === targetBarcode) {
                return { ...r, dcQty: payload.eventType === 'DELETE' ? 0 : (payload.new?.qty || 0) };
              }
              return r;
            });
          });
        }
      )
      // 🚨 SUBSCRIBE TO store_inventory for Realtime Shop Qty updates
      .on(
        'postgres_changes',
        channelConfig('store_inventory'),
        (payload) => {
          console.log('📡 Realtime Store Inventory change:', payload);
          const payloadBranch = payload.new?.branch_id || payload.old?.branch_id;
          if (targetBranch !== 'All Branches' && payloadBranch && payloadBranch !== targetBranch) return;

          setValidationResults(prev => {
            const targetBarcode = payload.new?.barcode_no || payload.old?.barcode_no;
            if (!targetBarcode) return prev;
            return prev.map(r => {
              if (r.barcode === targetBarcode) {
                return {
                  ...r,
                  shopQty: payload.eventType === 'DELETE' ? 0 : (payload.new?.store_qty || 0),
                  salesQty: payload.eventType === 'DELETE' ? 0 : (payload.new?.sales_qty || 0)
                };
              }
              return r;
            });
          });
        }
      )
      .subscribe((status) => {
        console.log('📡 Realtime status:', status);
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        }
      });

    return () => {
      console.log('🔌 Cleaning up Realtime subscription...');
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      supabase.removeChannel(channel);
      setRealtimeStatus('disconnected');
    };
  }, [step, dbSource, user?.branch_id, adminViewBranch]);

  const [locationSynced, setLocationSynced] = useState(false);

  const handleSyncLocationToCloud = async () => {
    if (validationResults.length === 0) return;

    const targetBranch = importBranch || user?.branch_id;
    if (!targetBranch) {
      alert('⚠️ กะลุนาเลือกสาขาก่อน Sync');
      return;
    }

    const confirmed = window.confirm(`Sync Location ໄປທີ່ສາຂາ: "${targetBranch}"\n\n${validationResults.length} ລາຍການ ຈະຖືກ Sync ໄປ Cloud.\n\n⚠️ ຂໍ້ມູນເກົ່າຂອງສາຂານີ້ຈະຖືກແທນທີ່.`);
    if (!confirmed) return;

    // 🔍 DEBUG LOG — ตรวจสอบก่อน Sync
    console.log('🚀 [Sync Location] targetBranch:', targetBranch);
    console.log('🚀 [Sync Location] importBranch state:', importBranch);
    console.log('🚀 [Sync Location] user.branch_id:', user?.branch_id);
    console.log('🚀 [Sync Location] records count:', validationResults.length);
    console.log('🚀 [Sync Master?]', autoSyncMaster);

    setIsProcessing(true);
    try {
      // 1. Sync Location 
      const result = await syncLocationResultsToSupabase(validationResults, targetBranch);

      if (result.success) {
        setLocationSynced(true);
        let msg = `✅ Sync Location ສຳເລັດ! ${result.synced} ລາຍການ ຖືກບັນທຶກເຂົ້າ Cloud ແລ້ວ\n`;

        // 2. Sync Master Data if selected
        if (autoSyncMaster) {
          const masterResult = await syncMasterDataToSupabase(masterData, targetBranch);
          if (masterResult.success) {
            msg += `✅ Sync Master Data ສຳເລັດ! ${masterResult.synced} ລາຍການ (Global ສີວິໄລ)\n`;
          } else {
            msg += `❌ Sync Master Data ລົ້ມເຫຼວ: ${masterResult.error}\n`;
          }
        }

        alert(msg);
      } else {
        alert('❌ Sync Location ລົ້ມເຫຼວ: ' + result.error);
      }
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

    // Public landing route: render before the authentication gate.
  if (step === 'landing') {
    return <LandingPage onBack={() => setStep('upload')} />;
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (

    <ToastProvider>
      {/* 🔄 PWA Auto-Update Prompt — แจ้งเตือนเมื่อมีเวอร์ชันใหม่ */}
      <ReloadPrompt />

      {/* 🐘 Elephant Mascot Loading Overlay with Progress */}
      <LoadingOverlay
        isVisible={isProcessing}
        message={loadingOverlayMessage || (loadingProgress < 100 ? 'ກຳລັງເຊື່ອມຕໍ່ຖານຂໍ້ມູນ Cloud' : 'ເຊື່ອມຕໍ່ສຳເລັດ!')}
        subtitle="JOAH Data Sync"
        progress={loadingProgress}
        showProgressBar={showProgressBar}
      />

      

      <div className="min-h-screen flex flex-col transition-colors duration-500 bg-dots overflow-x-hidden">
        {/* Navigation */}
        <Navbar
          step={step}
          dbSource={dbSource}
          dataSourceLabel={dataSourceLabel}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          isProcessing={isProcessing}
          onRefresh={(options) => {
            if (dbSource === 'supabase') {
              // 🚀 DELTA SYNC UPGRADE: Use partial fetching for Location, and skip Master Data to save Egress.
              refreshFromCloud({
                skipMaster: true,
                delta: true,
                silent: options?.silent ?? true,
                loadingText: options?.loadingText,
                showProgress: options?.showProgress
              });
            } else {
              handleValidate({ locationSheet: locationSheetName });
              setRefreshTrigger(Date.now());
            }
          }}
          onShowHistory={() => setShowHistory(true)}
          onReset={handleReset}
          currentUser={user}
          onOpenRequests={() => setShowStoreRequestManager(true)}
          onOpenStoreInbox={() => setShowStoreInbox(true)}
          onLogout={handleLogout}
          onOpenAppLauncher={() => setShowAppLauncher(true)}
        />
        <AppLauncher 
          isOpen={showAppLauncher} 
          onClose={() => setShowAppLauncher(false)} 
          onNavigate={(newStep) => setStep(newStep)} 
          user={user}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-4 md:px-8 py-8 items-center justify-center">
          {step === 'upload' && (
            <div className="max-w-7xl w-full animate-fade-in-up flex flex-col items-center relative">
              {/* Rubik Network Particles Background */}
              <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
                <RubikNetworkParticles />
              </div>
              <div className="relative w-full" style={{ zIndex: 1 }}>

                {/* Header Layout: Clock (Left) - Title (Center) - Empty (Right) */}
                <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between w-full mb-10 gap-6 lg:gap-0">

                  {/* 🕒 Big Digital Clock (Desktop Only) */}
                  <div className="hidden lg:flex w-[280px] justify-start shrink-0 transform -translate-x-[10%]">
                    <BigDigitalClock />
                  </div>

                  {/* 🏷️ Main Title (Centered) */}
                  <div className="text-center max-w-2xl mx-auto shrink-0 flex flex-col items-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-joah-orange border border-orange-100 dark:border-orange-500/20 mb-6">
                      <Sparkles size={14} className="animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Inventory Excellence</span>
                    </div>
                    <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
                      {t('home.title')} <br /><span className="text-joah-orange">{t('home.subtitle')}</span>
                    </h1>
                    <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                      {t('home.description')}
                    </p>

                    {/* Admin Toggle Button (Only for HQ role) */}
                    {isAdmin && (
                      <div className="mt-8">
                        <button
                          onClick={() => setShowAdminMenu(!showAdminMenu)}
                          className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 ${showAdminMenu
                            ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          <ShieldCheck size={18} />
                          <span>{showAdminMenu ? t('home.closeAdmin') : t('home.adminToggle')}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Empty spacer to keep the title centered */}
                  <div className="hidden lg:block w-[280px] shrink-0"></div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-5xl mx-auto transition-all duration-500">
                  {/* File Upload + Branch Selector (admin only) - DISABLED & MOVED TO BOTTOM TEMPORARILY
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-orange-400 hover:shadow-orange-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      <div className="w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                        <img src={imgImportFile} alt="Import File" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ເລືອກໄຟລ໌ໜ້າວຽກ</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">XLSX / CSV File</p>
                        </div>
                        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                          <span className="text-[10px] font-black text-amber-600 dark:text-amber-400 shrink-0">Import ໃຫ້:</span>
                          <select
                            value={importBranch}
                            onChange={(e) => setImportBranch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-white font-black text-xs outline-none cursor-pointer"
                          >
                            <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                            <option value="ສີວິໄລ">ສີວິໄລ</option>
                            <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                            <option value="ເມກ້າມໍ">ເມກ້າມໍ</option>
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                          </select>
                        </div>
                        <div className="w-full mt-[-8px]">
                          <label className="flex items-center gap-2 cursor-pointer p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <input
                              type="checkbox"
                              checked={autoSyncMaster}
                              onChange={(e) => setAutoSyncMaster(e.target.checked)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 rounded text-joah-orange focus:ring-joah-orange border-slate-300 dark:border-slate-600 dark:bg-slate-900 cursor-pointer"
                            />
                            <span className="text-[11px] font-black tracking-wider text-slate-600 dark:text-slate-300 uppercase">
                              ອັບເດດ Master Data ໃໝ່
                            </span>
                          </label>
                        </div>
                        <div className="hidden">
                          <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                        </div>
                        <button
                          onClick={() => !isProcessing && document.getElementById('file-input').click()}
                          disabled={isProcessing}
                          className="w-full btn-primary mt-1 group py-4 bg-joah-orange hover:bg-orange-600 shadow-orange-500/30"
                        >
                          {isProcessing ? <RefreshCw className="animate-spin" size={18} /> : <Upload size={18} />}
                          <span>ເລືອກໄຟລ໌ / Upload</span>
                        </button>
                      </div>
                    </div>
                  )}
                  */}

                  {/* Cloud Database */}

                  {/* Cloud Database */}
                  {(isAdmin || (user?.workplace !== 'front' && user?.branch_id)) && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-joah-orange hover:shadow-orange-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                        <img src={imgCloudDB} alt="Cloud Database" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('home.cloudDatabase')}</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t('home.cloudDatabaseSub')}</p>
                        </div>
                        {/* Branch Selector */}
                        {(isAdmin || isPSNUser) && (
                          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                            <select
                              value={adminViewBranch || (isPSNUser && !isAdmin ? 'ໂພນສີນວນ' : '')}
                              onChange={(e) => setAdminViewBranch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-500/40 text-slate-800 dark:text-white font-black text-xs outline-none cursor-pointer"
                            >
                              {isAdmin && <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>}
                              {isAdmin && <option value="ສີວິໄລ">ສີວິໄລ</option>}
                              {isAdmin && <option value="ວັງຊາຍ">ວັງຊາຍ</option>}
                              {isAdmin && <option value="ເມກ້າມໍ">ເມກ້າມໍ</option>}
                              <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                            </select>
                          </div>
                        )}
                        <button onClick={handleDatabaseLoad} disabled={isProcessing} className="w-full btn-primary group py-4">
                          {isProcessing ? <RefreshCw className="animate-spin" /> : <Database size={18} />}
                          <span>{t('home.continueWithCloud')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Store Closing Checklist */}
                  {!showAdminMenu && user?.workplace !== 'front' && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-yellow-500 hover:shadow-yellow-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-yellow-50 dark:bg-slate-800 relative">
                        <img src={imgStoreClosing} alt="Store Closing Checklist" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('home.storeClosing')}</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t('home.storeClosingSub')}</p>
                        </div>
                        <button onClick={() => setStep('store-closing')}
                          className="w-full btn-primary mt-1 group py-4 bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/30 text-zinc-900 border-none">
                          <ClipboardCheck size={18} />
                          <span>Open Checklist</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Store Inventory */}
                  {!showAdminMenu && (user?.workplace !== 'back' || isAdmin) && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-emerald-50 dark:bg-slate-800 relative">
                        <img src={imgStoreInventory} alt="Store Inventory" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ຂໍ້ມູນຊັ້ນວ່າງເຄື່ອງໜ້າຮ້ານ</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Store Inventory</p>
                        </div>

                        {/* Branch Selector */}
                        {(() => {
                          const branches = isAdmin
                            ? ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ', 'ເມກ້າມໍ', 'ເມກ້າມໍtest']
                            : [user?.branch_id].filter(Boolean);

                          if (branches.length <= 1) return null;

                          return (
                            <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                              <select
                                value={adminViewBranch || user?.branch_id || ''}
                                onChange={(e) => setAdminViewBranch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/30 text-slate-800 dark:text-white font-black text-xs outline-none cursor-pointer"
                              >
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                          );
                        })()}

                        <button
                          onClick={() => setStep('store-inventory-mockup')}
                          className="w-full btn-primary mt-1 group py-4 bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 border-none"
                        >
                          <Database size={18} />
                          <span>ເຂົ້າເບິ່ງຂໍ້ມູນໜ້າຮ້ານ</span>
                        </button>
                      </div>
                    </div>
                  )}


                  {/* Admin only: Odoo Sync + Excel Compressor */}
                  {showAdminMenu && (
                    <>
                      {/* Odoo Stock Sync */}
                      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-purple-500 hover:shadow-purple-500/10 transition-all duration-500 w-full sm:w-[340px]">
                        <div className="w-full h-44 overflow-hidden bg-purple-50 dark:bg-slate-800 relative">
                          <img src={imgOdoo} alt="Odoo Stock Sync" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                        </div>
                        <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                          <div className="space-y-1.5 text-center">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Odoo Stock Sync</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Manage ERP Data</p>
                          </div>
                          <button onClick={() => setStep('odoo-monitor')} disabled={isProcessing}
                            className="w-full btn-primary mt-1 group py-4 bg-purple-600 hover:bg-purple-700 shadow-purple-500/30">
                            <LayoutDashboard size={18} />
                            <span>Open Monitor</span>
                          </button>
                        </div>
                      </div>

                      {/* Excel Compressor */}
                      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all duration-500 w-full sm:w-[340px]">
                        <div className="w-full h-44 overflow-hidden bg-emerald-50 dark:bg-slate-800 relative">
                          <img src={imgExcelResize} alt="Excel Compressor" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                        </div>
                        <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                          <div className="space-y-1.5 text-center">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Excel Compressor</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Compress &amp; Clean Files</p>
                          </div>
                          <button onClick={() => setStep('excel-compressor')}
                            className="w-full btn-primary mt-1 group py-4 bg-slate-700 hover:bg-slate-800 shadow-slate-500/30 text-white border-none">
                            <FileArchive size={18} />
                            <span>Open Tool</span>
                          </button>
                        </div>
                      </div>

                      {/* Sales Aggregator */}
                      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-blue-500 hover:shadow-blue-500/10 transition-all duration-500 w-full sm:w-[340px]">
                        <div className="w-full h-44 overflow-hidden bg-blue-50 dark:bg-slate-800 relative flex items-center justify-center">
                          <div className="p-8 rounded-[2rem] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:rotate-6 group-hover:scale-110 transition-all duration-700">
                            <TrendingUp size={64} strokeWidth={2.5} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                        </div>
                        <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                          <div className="space-y-1.5 text-center">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Sales Aggregator</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Odoo Sales Summary</p>
                          </div>
                          <button onClick={() => setStep('sales-aggregator')}
                            className="w-full btn-primary mt-1 group py-4 bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 text-white border-none">
                            <BarChart3 size={18} />
                            <span>Open Tool</span>
                          </button>
                        </div>
                      </div>

                      {/* Odoo Sales Viewer */}
                      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-orange-500 hover:shadow-orange-500/10 transition-all duration-500 w-full sm:w-[340px]">
                        <div className="w-full h-44 overflow-hidden bg-orange-50 dark:bg-slate-800 relative flex items-center justify-center">
                          <div className="p-8 rounded-[2rem] bg-orange-100 dark:bg-orange-900/30 text-joah-orange group-hover:rotate-6 group-hover:scale-110 transition-all duration-700">
                            <Sparkles size={64} strokeWidth={2.5} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                        </div>
                        <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                          <div className="space-y-1.5 text-center">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Odoo Sales Viewer</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Odoo Live Items Sold</p>
                          </div>
                          <button onClick={() => setStep('odoo-sales-viewer')}
                            className="w-full btn-primary mt-1 group py-4 bg-joah-orange hover:bg-orange-600 shadow-orange-500/30 text-white border-none">
                            <LayoutDashboard size={18} />
                            <span>Open Tool</span>
                          </button>
                        </div>
                      </div>

                      {/* DC Stock Importer */}
                      <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-indigo-500 hover:shadow-indigo-500/10 transition-all duration-500 w-full sm:w-[340px]">
                        <div className="w-full h-44 overflow-hidden bg-indigo-50 dark:bg-slate-800 relative flex items-center justify-center">
                          <div className="p-8 rounded-[2rem] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 group-hover:rotate-6 group-hover:scale-110 transition-all duration-700">
                            <TrendingDown size={64} strokeWidth={2.5} />
                          </div>
                          <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                        </div>
                        <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                          <div className="space-y-1.5 text-center">
                            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">DC Stock Importer</h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Odoo Warehouse Stock</p>
                          </div>
                          <button onClick={() => setStep('dc-stock-importer')}
                            className="w-full btn-primary mt-1 group py-4 bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30 text-white border-none">
                            <TrendingDown size={18} />
                            <span>Open Tool</span>
                          </button>
                        </div>
                      </div>

                       {/* Test Taladlao Importer */}
                       <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all duration-500 w-full sm:w-[340px]">
                         <div className="w-full h-44 overflow-hidden bg-emerald-50 dark:bg-slate-800 relative flex items-center justify-center">
                           <div className="p-8 rounded-[2rem] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 group-hover:rotate-6 group-hover:scale-110 transition-all duration-700">
                             <Database size={64} strokeWidth={2.5} />
                           </div>
                           <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                         </div>
                         <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                           <div className="space-y-1.5 text-center">
                             <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 rounded-full">🧪 TEST MODE</span>
                             <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Test Store Importer</h3>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Sandbox — test_taladlao_store</p>
                           </div>
                           <button onClick={() => setStep('test-taladlao-importer')}
                             className="w-full btn-primary mt-1 group py-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30 text-white border-none">
                             <Database size={18} />
                             <span>Open Tool</span>
                           </button>
                         </div>
                       </div>

                       {/* Odoo Sync Engine */}
                       <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-teal-500 hover:shadow-teal-500/10 transition-all duration-500 w-full sm:w-[340px]">
                         <div className="w-full h-44 overflow-hidden bg-teal-50 dark:bg-slate-800 relative flex items-center justify-center">
                           <div className="p-8 rounded-[2rem] bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 group-hover:rotate-6 group-hover:scale-110 transition-all duration-700">
                             <RefreshCw size={64} strokeWidth={2.5} />
                           </div>
                           <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                         </div>
                         <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                           <div className="space-y-1.5 text-center">
                             <span className="text-[10px] font-black uppercase tracking-widest text-teal-600 bg-teal-50 dark:bg-teal-900/30 px-3 py-1 rounded-full">⚙️ AUTOMATION</span>
                             <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Odoo Sync Engine</h3>
                             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Automated Stock Deduction</p>
                           </div>
                           <button onClick={() => setStep('odoo-sync-engine')}
                             className="w-full btn-primary mt-1 group py-4 bg-teal-500 hover:bg-teal-600 shadow-teal-500/30 text-white border-none">
                             <Play size={18} />
                             <span>Run Sync</span>
                           </button>
                         </div>
                       </div>

                    </>
                  )}

                  {/* Admin only: HQ Command Center */}
                  {showAdminMenu && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col w-full sm:w-[340px] shadow-sm hover:shadow-md transition-shadow">
                      {/* Image Banner */}
                      <div className="w-full h-32 overflow-hidden bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800">
                        <img
                          src={imgHQCenter}
                          alt="HQ Command Center"
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      {/* Content */}
                      <div className="p-6 flex flex-col gap-4 w-full">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">HQ Command Center</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Analytics &amp; Monitoring</p>
                        </div>
                        <button
                          onClick={() => setStep('hq-dashboard')}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                          <BarChart3 size={16} />
                          <span>Open Dashboard</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin only: Joi AI Chat Full-page (Restored) */}
                  {showAdminMenu && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col w-full sm:w-[340px] shadow-sm hover:shadow-md transition-shadow">
                      {/* Banner */}
                      <div className="w-full h-32 bg-slate-100 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-800 flex items-center justify-center text-slate-400">
                        <Bot size={40} strokeWidth={1.5} />
                      </div>
                      {/* Content */}
                      <div className="p-6 flex flex-col gap-4 w-full">
                        <div className="space-y-1">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Joi AI Chat</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Smart Assistant Full-Page</p>
                        </div>
                        <button onClick={() => setStep('ai-chat')}
                          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors">
                          <Sparkles size={16} />
                          <span>Open AI Chat</span>
                        </button>
                      </div>
                    </div>
                  )}



                  {/* Admin only: Product Management (Unlocked) */}
                  {showAdminMenu && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col gap-4 w-full sm:w-[340px] shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStep('product-manager')}>
                      <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                        <ProductBoxIcon className="w-6 h-6 text-current" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">ຈັດການສິນຄ້າ</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Product Management</p>
                      </div>

                      {isAdmin && (
                        <div className="w-full relative" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={adminViewBranch || user?.branch_id || 'ຕະຫຼາດລາວ'}
                            onChange={(e) => setAdminViewBranch(e.target.value)}
                            className="w-full h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 outline-none focus:border-slate-400 appearance-none"
                          >
                            <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                            <option value="ສີວິໄລ">ສີວິໄລ</option>
                            <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                            <option value="ເມກ້າມໍ">ເມກ້າມໍ</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                        </div>
                      )}

                      <button className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-sm font-medium rounded-lg flex items-center justify-center gap-2 transition-colors mt-auto" onClick={(e) => { e.stopPropagation(); setStep('product-manager'); }}>
                        <LayoutDashboard size={16} />
                        <span>ກົດເຂົ້າໃຊ້ງານ</span>
                      </button>
                    </div>
                  )}

                  {/* Admin only: Master Data Audit (Unlocked) */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden group w-full sm:w-[340px] hover:border-sky-500 hover:shadow-sky-500/10 transition-all duration-500 cursor-pointer" onClick={() => setStep('master-audit')}>
                      <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-inner group-hover:scale-110 transition-transform duration-500 mb-2">
                        <AuditDatabaseIcon className="w-8 h-8 text-current" />
                      </div>
                      <div className="space-y-2 mb-2">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດສອບຖານຂໍ້ມູນ</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] group-hover:text-sky-500 transition-colors">Master Data Audit</p>
                      </div>

                      {isAdmin && (
                        <div className="w-full relative z-20 mt-2 mb-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={adminViewBranch || user?.branch_id || 'ຕະຫຼາດລາວ'}
                            onChange={(e) => setAdminViewBranch(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-sky-100 dark:border-sky-900/50 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-sky-500 appearance-none shadow-sm cursor-pointer"
                          >
                            <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                            <option value="ສີວິໄລ">ສີວິໄລ</option>
                            <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                            <option value="ເມກ້າມໍ">ເມກ້າມໍ</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-500 pointer-events-none" size={16} />
                        </div>
                      )}

                      <button className="w-full btn-primary mt-auto py-4 bg-gradient-to-r from-blue-500 to-sky-500 hover:from-blue-600 hover:to-sky-600 shadow-blue-500/30 flex items-center justify-center gap-2 text-white rounded-2xl z-20" onClick={(e) => { e.stopPropagation(); setStep('master-audit'); }}>
                        <Database size={18} />
                        <span>ກົດເຂົ້າໃຊ້ງານ</span>
                      </button>
                    </div>
                  )}

                  {/* Stock Count Lak 8 Card Button */}
                  <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden group w-full sm:w-[340px] hover:border-pink-500 hover:shadow-pink-500/10 transition-all duration-500 cursor-pointer" onClick={() => setStep('stock-count-lak8')}>
                    <div className="w-16 h-16 rounded-3xl bg-pink-50 dark:bg-pink-500/10 flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-inner group-hover:scale-110 transition-transform duration-500 mb-2 font-mono font-black text-xl">
                      📦
                    </div>
                    <div className="space-y-2 mb-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດການຈັດສົ່ງ DC ຫາຮ້ານ</h3>
                      <p className="text-[10px] text-pink-500 font-black uppercase tracking-[0.15em]">DC TO STORE DELIVERY CHECK</p>
                    </div>
                    <button className="w-full btn-primary mt-auto py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-pink-500/30 flex items-center justify-center gap-2 text-white rounded-2xl z-20" onClick={(e) => { e.stopPropagation(); setStep('stock-count-lak8'); }}>
                      <Box size={18} />
                      <span>ກົດເຂົ້າໃຊ້ງານ</span>
                    </button>
                  </div>

                  {/* Check Price Card */}
                  <div
                    className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-cyan-500 hover:shadow-cyan-500/10 transition-all duration-500 cursor-pointer w-full sm:w-[340px]"
                    onClick={() => setStep('check-price')}
                  >
                    {/* Image Banner */}
                    <div className="w-full h-44 overflow-hidden bg-cyan-50 dark:bg-slate-800 relative">
                      <img src={imgCheckPrice} alt="Check Price" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                    </div>
                    {/* Content */}
                    <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                      <div className="space-y-1.5 text-center">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດສອບລາຄາ</h3>
                        <p className="text-[10px] text-cyan-500 font-black uppercase tracking-[0.2em]">Price Checker Terminal</p>
                      </div>
                      <button
                        className="w-full btn-primary mt-auto py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30 flex items-center justify-center gap-2 text-white rounded-2xl z-20"
                        onClick={(e) => { e.stopPropagation(); setStep('check-price'); }}
                      >
                        <Tag size={18} />
                        <span>ເປີດໃຊ້ງານ</span>
                      </button>
                    </div>
                  </div>

                  {/* Store Request Card (For Front Store, or HQ, when not in Admin Menu) */}
                  {!showAdminMenu && (user?.workplace !== 'back' || isAdmin) && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-blue-500 hover:shadow-blue-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-blue-50 dark:bg-slate-800 relative">
                        <img src={imgStoreRequest} alt="Store Request" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('home.storeRequest')}</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t('home.storeRequestSub')}</p>
                        </div>

                        {/* Branch Selector array for Store Request */}
                        {(() => {
                          const branches = isAdmin
                            ? ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ', 'ເມກ້າມໍ']
                            : [user?.branch_id].filter(Boolean);

                          if (branches.length <= 1) return null;

                          return (
                            <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                              <select
                                value={adminViewBranch || user?.branch_id || ''}
                                onChange={(e) => setAdminViewBranch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-slate-800 dark:text-white font-black text-xs outline-none cursor-pointer"
                              >
                                {branches.map(b => <option key={b} value={b}>{b}</option>)}
                              </select>
                            </div>
                          );
                        })()}

                        <button
                          onClick={() => setStep('store-request')}
                          className="w-full btn-primary mt-1 group py-4 bg-blue-600 hover:bg-blue-700 shadow-blue-500/30 border-none"
                        >
                          <Play size={18} />
                          <span>{t('home.enterStore')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* File Upload (Disabled & Moved to Bottom) */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col grayscale opacity-50 pointer-events-none transition-all duration-500 w-full sm:w-[340px] border-slate-200 dark:border-slate-800">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                        <img src={imgImportFile} alt="Import File" className="w-full h-full object-cover object-center" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-400 dark:text-slate-500 tracking-tight">ເລືອກໄຟລ໌ໜ້າວຽກ</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">XLSX / CSV File (Maintenance)</p>
                        </div>

                        {/* Status Badge */}
                        <div className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">ປິດໃຊ້ງານຊົ່ວຄາວ</span>
                        </div>

                        <button disabled className="w-full py-4 bg-slate-300 dark:bg-slate-700 text-slate-500 rounded-2xl font-black text-sm uppercase flex items-center justify-center gap-2">
                          <X size={18} />
                          <span>Maintenance</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sandbox: DemoPlan */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden group w-full sm:w-[340px] hover:border-purple-500 hover:shadow-purple-500/10 transition-all duration-500 cursor-pointer" onClick={() => setStep('demo-plan')}>
                      <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner group-hover:scale-110 transition-transform duration-500 mb-2">
                        <Box className="w-8 h-8 text-current" />
                      </div>
                      <div className="space-y-2 mb-2">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">3D Store Planner</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] group-hover:text-purple-500 transition-colors">Sandbox Demo</p>
                      </div>

                      <button className="w-full btn-primary mt-auto py-4 bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-600 hover:to-fuchsia-600 shadow-purple-500/30 flex items-center justify-center gap-2 text-white rounded-2xl z-20" onClick={(e) => { e.stopPropagation(); setStep('demo-plan'); }}>
                        <Play size={18} />
                        <span>ທົດລອງໃຊ້ງານ</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="max-w-md w-full animate-fade-in-up">
              <div className="glass-card rounded-[2.5rem] shadow-2xl p-10 border-white/50">
                <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດສອບຂໍ້ມູນ</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuration</p>
                  </div>
                  {/* ให้เฉพาะ HQ (isAdmin) มีสิทธิ์อัปเดต Master Data จาก Excel ขึ้น Cloud */}
                  {dbSource === 'excel' && isAdmin && (
                    <button
                      onClick={handleSyncToCloud}
                      disabled={isProcessing}
                      className="flex flex-col items-center gap-1 group hover:scale-110 transition-transform"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/30">
                        <Database width={18} />
                      </div>
                      <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter">Sync Cloud</span>
                    </button>
                  )}
                </div>
                <SheetMapper sheetNames={sheetNames} suggestions={suggestions} onConfirm={handleValidate} />
              </div>
            </div>
          )}

          {step === 'odoo-monitor' && (
            <OdooMonitor onBack={() => setStep('upload')} />
          )}

          {step === 'store-inventory-mockup' && (
            <StoreInventoryMockup
              onBack={() => setStep('upload')}
              currentUser={user}
              isAdmin={isAdmin}
              initialBranch={adminViewBranch || user?.branch_id || ''}
            />
          )}

          {step === 'store-closing' && (
            <StoreClosingChecklist onBack={() => setStep('upload')} />
          )}

          {step === 'excel-compressor' && (
            <ExcelCompressor onBack={() => setStep('upload')} />
          )}

          {step === 'sales-aggregator' && (
            <SalesAggregator onBack={() => setStep('upload')} />
          )}

          {step === 'demo-plan' && (
            <div className="fixed inset-0 z-[9999] bg-white">
               <button 
                onClick={() => setStep('upload')}
                className="absolute top-4 left-4 z-[10000] p-3 bg-white/90 shadow-lg rounded-xl text-slate-700 hover:bg-slate-100 font-bold border border-slate-200"
               >
                 ← ກັບຄືນ
               </button>
               <DemoPlan />
            </div>
          )}

          {step === 'odoo-sales-viewer' && (
            <OdooSalesViewer onBack={() => setStep('upload')} userBranch={user?.branch_id} isAdmin={isAdmin} />
          )}

          {step === 'odoo-stock-adjustment' && (
            <OdooStockAdjustmentView onBack={() => setStep('upload')} userBranch={user?.branch_id} isAdmin={isAdmin} />
          )}

          {step === 'dc-stock-importer' && (
            <DcStockImporter onBack={() => setStep('upload')} />
          )}

          {step === 'test-taladlao-importer' && (
            <TestTaladlaoImporter onBack={() => setStep('upload')} />
          )}

          {step === 'odoo-sync-engine' && (
            <OdooSyncEngine onBack={() => setStep('upload')} userBranch={user?.branch_id} isAdmin={isAdmin} />
          )}

          {step === 'hq-dashboard' && isAdmin && (
            <HQCommandCenter onBack={() => setStep('upload')} />
          )}

          {step === 'hq-dashboard' && !isAdmin && (
            // ถ้าไม่ใช่ HQ แล้วเข้ามา ให้ redirect กลับ
            <>{setStep('upload')}</>
          )}

          {step === 'store-request' && (
            <StoreRequest onBack={() => setStep('upload')} currentUser={user} activeBranch={adminViewBranch} />
          )}


          {step === 'product-manager' && (
            <ProductManager
              onBack={() => { setStep('upload'); setPreFilledBarcode(null); }}
              currentUser={user}
              activeBranch={isAdmin ? (adminViewBranch || user?.branch_id) : user?.branch_id}
              initialBarcode={preFilledBarcode}
              isAdmin={isAdmin}
            />
          )}

          {step === 'master-audit' && (
            <MasterAudit
              onBack={() => setStep('upload')}
              currentUser={user}
              activeBranch={isAdmin ? (adminViewBranch || user?.branch_id) : user?.branch_id}
              isAdmin={isAdmin}
            />
          )}

          {step === 'ai-chat' && (
            <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-slate-950 flex flex-col animate-fade-in">
              <AIChatBotFull
                onBack={() => setStep('upload')}
                currentUser={user}
              />
            </div>
          )}

          {step === 'odoo-transfers' && (
            <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col animate-fade-in overflow-y-auto">
              <OdooTransferViewer
                onBack={() => setStep('upload')}
                currentUser={user}
              />
            </div>
          )}

          {step === 'stock-count-lak8' && (
            <div className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-fade-in overflow-y-auto">
              <StockCountLak8
                onBack={() => setStep('upload')}
                masterData={masterData}
                currentUser={user}
              />
            </div>
          )}

          {step === 'check-price' && (
            <CheckPrice
              onBack={() => setStep('upload')}
            />
          )}

          {step === 'odoo-inventory-overview' && (
            <div className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col animate-fade-in overflow-y-auto">
              <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors flex items-center gap-2"
                >
                  ← ກັບຄືນ (Back)
                </button>
              </div>
              <InventoryOverviewDashboard mockData={null} />
            </div>
          )}



          {step === 'results' && (
            <div className="w-full h-full space-y-8 animate-fade-in-up">


              <Dashboard
                stats={dashboardStats}
                activeFilter={filterStatus}
                onFilterChange={setFilterStatus}
                hideZeroQty={hideZeroQty}
                onHideZeroQtyChange={setHideZeroQty}
              />

              {/* Realtime Status & Notification Banner */}
              {dbSource === 'supabase' && (
                <div className="flex flex-col gap-3">
                  {/* Connection Status Pill */}
                  <div className="flex items-center justify-between">
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider border transition-all ${realtimeStatus === 'connected'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                      : realtimeStatus === 'connecting'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                      }`}>
                      {realtimeStatus === 'connected' ? (
                        <><Wifi size={14} /><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /><span>Realtime Connected</span></>
                      ) : realtimeStatus === 'connecting' ? (
                        <><RefreshCw size={14} className="animate-spin" /><span>Connecting...</span></>
                      ) : (
                        <><WifiOff size={14} /><span>Offline</span></>
                      )}
                    </div>
                  </div>

                  {/* Pending Changes Banner */}
                  {showRealtimeBanner && pendingChanges > 0 && (
                    <div className="glass-card rounded-2xl p-4 border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 shadow-lg shadow-emerald-500/10 animate-fade-in">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle size={20} />
                          </div>
                          <div>
                            <p className="text-sm font-black text-emerald-800 dark:text-emerald-200">
                              ອັບເດດຂໍ້ມູນລ່າສຸດສຳເລັດ!
                            </p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {lastChangeBy} ໄດ້ແກ້ໄຂ {pendingChanges} ລາຍການ — ໜ້າຈໍຖືກອັບເດດໃຫ້ເປັນປັດຈຸບັນແລ້ວ.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sync Location to Cloud Button */}
              {dbSource === 'excel' && validationResults.length > 0 && (
                <div className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-xl">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-2xl ${locationSynced ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : 'bg-orange-100 dark:bg-orange-900/30 text-joah-orange'} transition-all`}>
                        {locationSynced ? <CheckCircle size={24} /> : <UploadCloud size={24} />}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-slate-800 dark:text-white">
                          {locationSynced ? 'ຂໍ້ມູນຖືກ Sync ແລ້ວ!' : 'ຂໍ້ມູນ Location ຍັງບໍ່ທັນ Sync ໄປ Cloud'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                          {locationSynced
                            ? `${validationResults.length} ລາຍການ ຖືກບັນທຶກເຂົ້າ Supabase ແລ້ວ`
                            : `${validationResults.length} ລາຍການ ພ້ອມ Sync ໄປ location_inventory`
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleSyncLocationToCloud}
                      disabled={isProcessing || locationSynced}
                      className={`px-8 py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all flex items-center gap-2.5 shadow-lg ${locationSynced
                        ? 'bg-emerald-500 text-white cursor-default'
                        : 'bg-joah-orange hover:bg-orange-600 text-white shadow-orange-500/30 active:scale-95'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      {locationSynced ? <CheckCircle size={18} /> : <UploadCloud size={18} />}
                      <span>{locationSynced ? 'Synced ແລ້ວ!' : 'Sync Location ໄປ Cloud'}</span>
                    </button>
                  </div>
                </div>
              )}

              <ResultTable
                results={filteredResults}
                allResults={validationResults} // Pass all results for generating filter options
                locationFilter={locationFilter}
                onLocationFilterChange={setLocationFilter}
                masterData={masterData}
                rawFile={rawFile}
                locationSheetName={locationSheetName}
                filterStatus={filterStatus}
                onFilterChange={setFilterStatus}
                dbSource={dbSource}
                onRefresh={(options) => {
                  if (dbSource === 'supabase') {
                    // Smart refresh from table only updates counts via Delta Sync 🚀
                    refreshFromCloud({ skipMaster: true, delta: true, silent: options?.silent });
                  } else {
                    handleValidate({ locationSheet: locationSheetName });
                    setRefreshTrigger(Date.now());
                  }
                }}
                refreshTrigger={refreshTrigger}
                onUpdateRowQty={handleUpdateResultRowQty}
                currentUser={user}
                currentBranch={(isAdmin || isPSNUser) ? (adminViewBranch || (isPSNUser ? 'ໂພນສີນວນ' : user?.branch_id)) : user?.branch_id}
                onAddNewProduct={handleGotoProductManager}
              />
            </div>
          )}
        </main>

        <Footer onNavigateLanding={() => setStep('landing')} />

        {/* History Modal */}
        {showHistory && <HistoryLog onClose={() => setShowHistory(false)} currentUser={user} activeBranch={adminViewBranch} />}

        {/* Store Request Manager Modal */}
        {
          showStoreRequestManager && (
            <StoreRequestManager
              onClose={() => setShowStoreRequestManager(false)}
              currentUser={user}
            />
          )
        }

        {/* Store Inbox Panel (For Store Staff) */}
        {
          showStoreInbox && (
            <StoreInboxPanel
              onClose={() => setShowStoreInbox(false)}
              currentUser={user}
              activeBranch={adminViewBranch}
              onOpenQuickAdd={(prefill) => {
                setInboxQuickAddData(prefill);
                setInboxQuickAddForm({
                  barcode_no: prefill.barcode_no || '',
                  item_name: prefill.item_name || '',
                  qty: prefill.qty || 0,
                  max_qty: 0,
                  rack_location: '',
                  category_1_actual: '',
                  category_2_actual: '',
                  product_tag: '',
                  remarks: prefill.remarks || 'ຮັບສິນຄ້າຈາກສາງ (Inbox)',
                });
                setIsInboxQuickAddFoundInMaster(false);
              }}
            />
          )
        }
        {/* Inbox → QuickAdd Panel: new product not yet in store_inventory */}
        <StoreQuickAddPanel
          isOpen={!!inboxQuickAddData}
          onClose={() => {
            setInboxQuickAddData(null);
            setInboxQuickAddForm({ barcode_no: '', item_name: '', qty: 0, max_qty: 0, rack_location: '', category_1_actual: '', category_2_actual: '', product_tag: '', remarks: '' });
          }}
          quickAddForm={inboxQuickAddForm}
          setQuickAddForm={setInboxQuickAddForm}
          isFoundInMaster={isInboxQuickAddFoundInMaster}
          setIsFoundInMaster={setIsInboxQuickAddFoundInMaster}
          isSaving={isSavingInboxQuickAdd}
          masterData={masterData}
          results={[]} allResults={validationResults}
          t={t}
          currentBranch={adminViewBranch || user?.branch_id}
          onSave={async () => {
            if (!inboxQuickAddData) return;
            setIsSavingInboxQuickAdd(true);
            try {
              const { supabase: sb } = await import('./utils/supabaseClient');
              const branchToSave = adminViewBranch || user?.branch_id || '';
              const activeUser = user ? `${user.name} (${user.id})` : 'Store Staff';

              // 1. SAFE CHECK: Look up existing record first to prevent duplicate rows & data loss
              let lookupQ = sb
                .from('store_inventory')
                .select('id, store_qty, shelf_location, product_tag, max_qty')
                .eq('barcode_no', inboxQuickAddForm.barcode_no.trim());
              if (branchToSave) lookupQ = lookupQ.eq('branch_id', branchToSave);
              const { data: existingRows } = await lookupQ.limit(1);
              const existingRow = existingRows?.[0] || null;

              const incomingQty = Number(inboxQuickAddForm.qty) || 0;
              let oldQty = 0;
              let newQty = incomingQty;
              // Preserve existing values if user left fields blank
              let shelfToSave = inboxQuickAddForm.rack_location || '';
              let tagToSave = inboxQuickAddForm.product_tag || null;
              let maxQtyToSave = Number(inboxQuickAddForm.max_qty) || null;

              if (existingRow) {
                // Row already exists — ADD qty, preserve original values if user left them blank
                oldQty = existingRow.store_qty || 0;
                newQty = oldQty + incomingQty;
                if (!shelfToSave) shelfToSave = existingRow.shelf_location || '';
                if (!tagToSave) tagToSave = existingRow.product_tag || null;        // ← fix: preserve tag
                if (!maxQtyToSave) maxQtyToSave = existingRow.max_qty || null;

                const { error: updateErr } = await sb
                  .from('store_inventory')
                  .update({ store_qty: newQty, updated_by: activeUser, shelf_location: shelfToSave, product_tag: tagToSave })
                  .eq('id', existingRow.id);
                if (updateErr) throw updateErr;
              } else {
                // New record — safe to insert
                const payload = {
                  barcode_no: inboxQuickAddForm.barcode_no,
                  item_name: inboxQuickAddForm.item_name,
                  shelf_location: shelfToSave,
                  category_1_actual: inboxQuickAddForm.category_1_actual || '',
                  category_2_actual: inboxQuickAddForm.category_2_actual || '',
                  store_qty: newQty,
                  max_qty: maxQtyToSave,
                  product_tag: tagToSave,
                  updated_by: activeUser,
                  branch_id: branchToSave,
                };
                const { error: insertErr } = await sb.from('store_inventory').insert([payload]);
                if (insertErr) throw insertErr;
              }

              // 2. Log to store_inventory_history
              const nowMs = Date.now();
              const batchStartMs = inboxQuickAddData._batchStartedAt || null;
              const batchTotalSecs = batchStartMs ? Math.floor((nowMs - batchStartMs) / 1000) : null;

              await logStoreInventoryHistory({
                actionType: existingRow ? 'received' : 'added',
                barcode: inboxQuickAddForm.barcode_no,
                itemName: inboxQuickAddForm.item_name,
                oldQty,
                newQty,
                oldLocation: existingRow?.shelf_location || null,
                newLocation: shelfToSave,
                oldTag: existingRow?.product_tag || null,
                newTag: tagToSave,
                oldMaxQty: existingRow?.max_qty || null,
                newMaxQty: maxQtyToSave,
                reason: inboxQuickAddForm.remarks || 'ຮັບສິນຄ້າຈາກສາງ (Inbox)',
                branchId: branchToSave,
                updatedBy: activeUser,
                // ── Batch/Bill fields from Inbox ──
                billId: inboxQuickAddData._inboxBatchId || null,
                batchStartedAt: batchStartMs ? new Date(batchStartMs).toISOString() : null,
                batchEndedAt: new Date(nowMs).toISOString(),
                batchTotalSeconds: batchTotalSecs,
              });

              // 3. Mark store_request as confirmed
              if (inboxQuickAddData._inboxItemId) {
                const { error: confirmErr } = await sb
                  .from('store_requests')
                  .update({ store_confirmed_at: new Date().toISOString(), store_confirmed_by: user?.name || 'Store Staff' })
                  .eq('id', inboxQuickAddData._inboxItemId);
                if (confirmErr) throw confirmErr;
              }
              setInboxQuickAddData(null);
              setInboxQuickAddForm({ barcode_no: '', item_name: '', qty: 0, max_qty: 0, rack_location: '', category_1_actual: '', category_2_actual: '', product_tag: '', remarks: '' });
            } catch (err) {
              console.error('Inbox QuickAdd Save Error:', err);
            } finally {
              setIsSavingInboxQuickAdd(false);
            }
          }}
        />
      </div>
      {user && <JoiWidget currentUser={user} />}
      <RefillAlertModal />
    </ToastProvider>
  );
}

function App() {
  return (
    <LanguageProvider>
      <LowStockProvider>
        <AppContent />
      </LowStockProvider>
    </LanguageProvider>
  );
}

export default App;
