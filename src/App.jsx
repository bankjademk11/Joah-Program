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
import { fetchMasterFromSupabase, syncMasterDataToSupabase, syncLocationResultsToSupabase, fetchLocationFromSupabase, fetchOdooFromSupabase } from './utils/supabaseSync';
import HistoryLog from './components/features/inventory/HistoryLog';
import { RefreshCw, Database, UploadCloud, Upload, LayoutDashboard, Database as DBIcon, Play, Moon, Sun, X, RotateCw, Sparkles, ShieldCheck, History, Trash2, CheckCircle, Wifi, WifiOff, Bell, ClipboardCheck, FileArchive, BarChart3, ChevronDown } from 'lucide-react';
import joahLogo from './assets/Joah.jpeg';
import databaseUrl from './assets/DataBaseJoah.xlsx';
import imgImportFile from './assets/ImportFile.png';
import imgCloudDB from './assets/CloudRecordDatabase.png';
import imgOdoo from './assets/OdooImage.png';
import imgExcelResize from './assets/ExelResize.png';
import imgStoreClosing from './assets/RequestfromWarehouse.png';
import imgHQCenter from './assets/JoahHQcentercompressed.png';

import Login from './components/features/auth/Login';
import OdooMonitor from './components/features/admin/OdooMonitor';
import StoreRequest from './components/features/store/StoreRequest';
import StoreRequestManager from './components/features/store/StoreRequestManager';
import { ToastProvider, useToast } from './components/ui/ToastProvider';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import MasterAudit from './components/features/admin/MasterAudit';
import ProductManager from './components/features/admin/ProductManager';
import HQCommandCenter from './components/features/admin/HQCommandCenter';
import Footer from './components/layout/Footer';
import RubikNetworkParticles from './components/ui/RubikNetworkParticles';
import LoadingOverlay from './components/ui/LoadingOverlay';
import StoreClosingChecklist from './components/features/store/StoreClosingChecklist';
import ExcelCompressor from './components/Tools/excel-compressor';
import ReloadPrompt from './components/ui/ReloadPrompt';
import {
  CloudDatabaseIcon,
  ProductBoxIcon,
  AuditDatabaseIcon,
  SyncOdooIcon,
  StoreRequestIcon
} from './components/ui/AnimatedIcons';


function AppContent() {
  const { t } = useLanguage();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const [step, setStep] = useState('upload');
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
  const [preFilledBarcode, setPreFilledBarcode] = useState(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [locationFilter, setLocationFilter] = useState(''); // New Location Filter State
  const [hideZeroQty, setHideZeroQty] = useState(false); // Filter to hide items with 0 Qty
  const [importBranch, setImportBranch] = useState(''); // Branch target for import/sync
  const [adminViewBranch, setAdminViewBranch] = useState(''); // Branch Admin เลือกดูใน Cloud
  const [autoSyncMaster, setAutoSyncMaster] = useState(false); // Checkbox for Master Data Sync

  // --- Realtime State ---
  const [realtimeStatus, setRealtimeStatus] = useState('disconnected'); // 'connected', 'disconnected', 'connecting'
  const [pendingChanges, setPendingChanges] = useState(0);
  const [lastChangeBy, setLastChangeBy] = useState('');
  const [showRealtimeBanner, setShowRealtimeBanner] = useState(false);
  const debounceTimerRef = useRef(null);
  const isRefreshingRef = useRef(false);

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
      const branch = storedBranch || 'ຕະຫຼາດລາວ';
      setUser({
        id: storedId,
        name: storedName,
        role: storedRole || 'staff',
        workplace: storedWorkplace || 'front',
        branch_id: branch
      });
      setImportBranch(branch);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('joah_employee_id');
    localStorage.removeItem('joah_employee_name');
    localStorage.removeItem('joah_employee_role');
    localStorage.removeItem('joah_employee_workplace');
    localStorage.removeItem('joah_branch_id');
    setIsLoggedIn(false);
    setUser(null);
    setStep('upload');
    setPreFilledBarcode(null);
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
    setIsLoggedIn(true);
  };



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
      const branchToLoad = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;

      if (activeSource === 'supabase') {
        const masterBranch = branchToLoad;

        // 🧹 AUTO CLEANUP: Clear locations for items with qty=0 before fetching data
        try {
          await supabase
            .from('location_inventory')
            .update({ rack_location: null })
            .eq('branch_id', branchToLoad)
            .eq('qty', 0)
            .not('rack_location', 'is', null);
          console.log(`✅ Auto-cleanup: Cleared locations for qty=0 items in branch ${branchToLoad}`);
        } catch (cleanupErr) {
          console.warn('⚠️ Auto-cleanup failed (non-critical):', cleanupErr);
        }

        const [cloudMaster, cloudLocation, cloudOdoo] = await Promise.all([
          fetchMasterFromSupabase(masterBranch),
          fetchLocationFromSupabase(branchToLoad),
          fetchOdooFromSupabase(branchToLoad)
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

      } else {
        if (!workbook) throw new Error("ກະລຸນາເລືອກໄຟລ໌ Excel ກ່ອນ.");

        // Use the dataSheet selected by user in SheetMapper, fallback to 'DATA'
        const resolvedDataSheet = dataSheet || 'DATA';
        console.log('📂 Excel Mode — Reading sheets:');
        console.log('  📊 DATA sheet:', resolvedDataSheet);
        console.log('  📍 Location sheet:', locationSheet);
        console.log('  📋 All sheets in file:', workbook.SheetNames);

        dataRows = sheetToJSON(workbook, resolvedDataSheet);
        locationRows = sheetToJSON(workbook, locationSheet);

        console.log(`  ✅ DATA rows loaded: ${dataRows.length}`);
        console.log(`  ✅ Location rows loaded: ${locationRows.length}`);

        if (dataRows.length === 0) {
          console.warn(`  ⚠️ Sheet "${resolvedDataSheet}" is EMPTY or NOT FOUND. Available: ${workbook.SheetNames.join(', ')}`);
        }

        const cloudOdoo = await fetchOdooFromSupabase(user?.branch_id);
        odooRows = (cloudOdoo || []).map(o => ({
          barcode: o.barcode,
          qty: o.qty_odoo
        }));
      }

      const { results, stats } = validateData(locationRows, dataRows, odooRows, branchToLoad);
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
  const refreshFromCloud = useCallback(async (options = { skipMaster: true, silent: false }) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    // Only show loading overlay if NOT silent
    if (!options.silent) {
      setIsProcessing(true);
      setLoadingProgress(0); // Reset progress if showing overlay
    }
    try {
      console.log(`🔄 Refreshing cloud data (skipMaster: ${options.skipMaster})...`);

      // Fetch dynamic data always
      const fetchTasks = [
        fetchLocationFromSupabase(user?.branch_id),
        fetchOdooFromSupabase(user?.branch_id)
      ];

      // Only fetch master if explicitly asked or if we don't have it yet
      const shouldFetchMaster = !options.skipMaster || masterData.length === 0;
      if (shouldFetchMaster) {
        fetchTasks.push(fetchMasterFromSupabase(user?.branch_id));
      }

      const results = await Promise.all(fetchTasks);
      const cloudLocation = results[0];
      const cloudOdoo = results[1];
      const cloudMaster = shouldFetchMaster ? results[2] : null;

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

      const locationRows = (cloudLocation || []).map(l => ({
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

      // Calculate branchToLoad using the same logic as handleValidate
      const branchToLoad = (isAdmin || isPSNUser) ? (adminViewBranch || user?.branch_id) : user?.branch_id;

      const { results: validatedResults, stats: validatedStats } = validateData(locationRows, activeMasterData, odooRows, branchToLoad);
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
  }, [masterData]);

  // --- Supabase Realtime Subscription ---
  useEffect(() => {
    // Only subscribe when on results page AND using Supabase
    if (step !== 'results' || dbSource !== 'supabase') {
      setRealtimeStatus('disconnected');
      return;
    }

    setRealtimeStatus('connecting');
    console.log('🔌 Setting up Realtime subscription...');

    const channel = supabase
      .channel('realtime-location-inventory')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'location_inventory' },
        (payload) => {
          console.log('📡 Realtime change detected:', payload.eventType, payload);

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
  }, [step, dbSource, user?.name, refreshFromCloud]);

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

      <div className="min-h-screen flex flex-col transition-colors duration-500 bg-dots">
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
              // Manual refresh button from Navbar clears EVERYTHING and reloads all
              // Silent mode defaults to true unless specified
              refreshFromCloud({
                skipMaster: false,
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
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-4 md:px-8 py-8 items-center justify-center">
          {step === 'upload' && (
            <div className="max-w-5xl w-full animate-fade-in-up flex flex-col items-center relative">
              {/* Rubik Network Particles Background */}
              <div className="absolute inset-0 -inset-x-[50vw] -inset-y-32 overflow-hidden" style={{ zIndex: 0 }}>
                <RubikNetworkParticles />
              </div>
              <div className="relative w-full" style={{ zIndex: 1 }}>
                <div className="text-center mb-10 max-w-2xl mx-auto">
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

                <div className="flex flex-wrap justify-center gap-6 w-full max-w-7xl mx-auto transition-all duration-500">
                  {/* File Upload + Branch Selector (admin only) */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-orange-400 hover:shadow-orange-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-slate-100 dark:bg-slate-800 relative">
                        <img src={imgImportFile} alt="Import File" className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700" />
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5 text-center">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ເລືອກໄຟລ໌ໜ້າວຽກ</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">XLSX / CSV File</p>
                        </div>
                        {/* Branch Selector */}
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
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                          </select>
                        </div>
                        {/* Auto Sync Master Checkbox */}
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
                        {/* Hidden FileUpload — triggered by button below */}
                        <div className="hidden">
                          <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
                        </div>
                        {/* Upload button — same style as other cards */}
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

                  {/* Store Request Card (For Front Store, or HQ, when not in Admin Menu) */}
                  {!showAdminMenu && (user?.workplace !== 'back' || isAdmin) && (
                    <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-blue-500 hover:shadow-blue-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                        <StoreRequestIcon className="w-8 h-8 text-current" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">{t('home.storeRequest')}</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{t('home.storeRequestSub')}</p>
                      </div>
                      
                      {/* Branch Selector array for Store Request */}
                      {(isAdmin || isPSNUser) && (
                        <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                          <select
                            value={adminViewBranch || (isPSNUser && !isAdmin ? 'ໂພນສີນວນ' : '')}
                            onChange={(e) => setAdminViewBranch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 h-8 px-2 rounded-lg bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-500/30 text-slate-800 dark:text-white font-black text-xs outline-none cursor-pointer"
                          >
                            {isAdmin && <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>}
                            {isAdmin && <option value="ສີວິໄລ">ສີວິໄລ</option>}
                            {isAdmin && <option value="ວັງຊາຍ">ວັງຊາຍ</option>}
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                          </select>
                        </div>
                      )}

                      <button
                        onClick={() => setStep('store-request')}
                        className="w-full btn-primary mt-2 group py-4 bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                      >
                        <Play size={18} />
                        <span>{t('home.enterStore')}</span>
                      </button>
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
                    </>
                  )}

                  {/* Admin only: HQ Command Center */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] overflow-hidden flex flex-col items-center text-center gap-0 group hover:border-amber-500 hover:shadow-amber-500/10 transition-all duration-500 w-full sm:w-[340px]">
                      {/* Image Banner */}
                      <div className="w-full h-44 overflow-hidden bg-gradient-to-br from-blue-100 to-sky-200 relative">
                        <img
                          src={imgHQCenter}
                          alt="HQ Command Center"
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                        />
                        {/* Overlay gradient at bottom */}
                        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-white/80 dark:from-slate-900/80 to-transparent" />
                      </div>
                      {/* Content */}
                      <div className="px-8 pb-8 pt-5 flex flex-col items-center gap-5 w-full">
                        <div className="space-y-1.5">
                          <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">HQ Command Center</h3>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Analytics &amp; Monitoring</p>
                        </div>
                        <button
                          onClick={() => setStep('hq-dashboard')}
                          className="w-full btn-primary mt-1 group py-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/30"
                        >
                          <BarChart3 size={18} />
                          <span>Open Dashboard</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Admin only: Product Management (Unlocked) */}
                  {showAdminMenu && (
                    <div className="glass-card rounded-[2.5rem] p-8 md:p-10 flex flex-col items-center justify-center text-center gap-6 relative overflow-hidden group w-full sm:w-[340px] hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all duration-500 cursor-pointer" onClick={() => setStep('product-manager')}>
                      <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner group-hover:scale-110 transition-transform duration-500 mb-2">
                        <ProductBoxIcon className="w-8 h-8 text-current" />
                      </div>
                      <div className="space-y-2 mb-2">
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ຈັດການສິນຄ້າ</h3>
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] group-hover:text-emerald-500 transition-colors">Product Management</p>
                      </div>

                      {isAdmin && (
                        <div className="w-full relative z-20 mt-2 mb-4" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={adminViewBranch || user?.branch_id || 'ຕະຫຼາດລາວ'}
                            onChange={(e) => setAdminViewBranch(e.target.value)}
                            className="w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-emerald-100 dark:border-emerald-900/50 text-sm font-bold text-slate-700 dark:text-slate-300 outline-none focus:border-emerald-500 appearance-none shadow-sm cursor-pointer"
                          >
                            <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                            <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                            <option value="ສີວິໄລ">ສີວິໄລ</option>
                            <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                          </select>
                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 pointer-events-none" size={16} />
                        </div>
                      )}

                      <button className="w-full btn-primary mt-auto py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-500/30 flex items-center justify-center gap-2 text-white rounded-2xl z-20" onClick={(e) => { e.stopPropagation(); setStep('product-manager'); }}>
                        <LayoutDashboard size={18} />
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

          {step === 'store-closing' && (
            <StoreClosingChecklist onBack={() => setStep('upload')} />
          )}

          {step === 'excel-compressor' && (
            <ExcelCompressor onBack={() => setStep('upload')} />
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
                onRefresh={() => {
                  if (dbSource === 'supabase') {
                    // Smart refresh from table only updates counts
                    refreshFromCloud({ skipMaster: true });
                  } else {
                    handleValidate({ locationSheet: locationSheetName });
                    setRefreshTrigger(Date.now());
                  }
                }}
                refreshTrigger={refreshTrigger}
                onUpdateRowQty={handleUpdateResultRowQty}
                currentUser={user}
                currentBranch={(isAdmin || isPSNUser) ? (adminViewBranch || (isPSNUser ? 'ໂພນສີນວນ A' : user?.branch_id)) : user?.branch_id}
                onAddNewProduct={handleGotoProductManager}
              />
            </div>
          )}
        </main>

        <Footer />

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
      </div >
    </ToastProvider >
  );
}

function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
