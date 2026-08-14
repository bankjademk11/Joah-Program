import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Barcode,
  Plus,
  Minus,
  Trash2,
  Camera,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  Layers,
  RefreshCw,
  X,
  Volume2,
  Check,
  ScanLine,
  Loader,
  Package,
  Clock,
  User,
  Download,
  Upload,
  FileSpreadsheet,
  Building2,
  Calendar,
  Filter,
  LogOut
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import joahLogo from '../../../assets/Joah.jpeg';
import technoHubLogo from '../../../assets/technohublogo.png';

export default function StockCountLak8({ onBack, masterData = [], currentUser }) {
  // ─── States ────────────────────────────────────────────────────────
  const [scanMode, setScanMode] = useState('count'); // 'manual' | 'count' | 'search'
  const [manualQty, setManualQty] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // New Branch & Date States
  const [selectedBranch, setSelectedBranch] = useState(localStorage.getItem('lak8_branch') || '');
  const [selectedDate, setSelectedDate] = useState(localStorage.getItem('lak8_date') || new Date().toISOString().split('T')[0]);
  const [lak8OwnerBranch, setLak8OwnerBranch] = useState(localStorage.getItem('lak8_owner_branch') || '');
  const [docNos, setDocNos] = useState(JSON.parse(localStorage.getItem('lak8_doc_nos') || '[]'));
  const [hasDocNo, setHasDocNo] = useState(docNos.length > 0);
  const [sessionStatus, setSessionStatus] = useState(localStorage.getItem(`lak8_status_${localStorage.getItem('lak8_branch')}_${localStorage.getItem('lak8_date')}_${localStorage.getItem('lak8_owner_branch')}`) || 'in_progress');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(!localStorage.getItem('lak8_branch'));
  const [selectedBrand, setSelectedBrand] = useState(localStorage.getItem('lak8_brand') || null); // null | 'joah' | 'technohub'

  // Event Log States
  const [events, setEvents] = useState([]);
  const [eventTitle, setEventTitle] = useState('');
  const [eventQty, setEventQty] = useState(1);
  const [eventImage, setEventImage] = useState(null);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);

  // Filter for GM
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFilterMode, setIsFilterMode] = useState(false);

  const branches = ['VX', 'SVL', 'TLL', 'PTX', 'PSN', 'LAK8'];

  // Floating Toast Notification State
  const [toast, setToast] = useState(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermState, setCameraPermState] = useState('idle');
  const [debugLog, setDebugLog] = useState({
    lastTrigger: null,
    triggerType: 'NONE',
    lastCode: '-',
    status: 'READY'
  });

  // ─── Excel Import/Export States ───────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [excelData, setExcelData] = useState([]);
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [columnMapping, setColumnMapping] = useState({ barcode: '', qty: '' });
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  // ─── Loading states for async operations ──────────────────────
  const [isSubmittingBarcode, setIsSubmittingBarcode] = useState(false);
  const [isUpdatingQty, setIsUpdatingQty] = useState({});
  const [isDeletingBarcode, setIsDeletingBarcode] = useState({});

  const inputRef = useRef(null);
  const lastScannedBarcodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const itemsRef = useRef(items);
  const scanModeRef = useRef('count');
  const manualQtyRef = useRef(1);
  const barcodeInputRef = useRef('');
  const isProcessingRef = useRef(false);
  const fetchDebounceRef = useRef(null); // ⏱️ Debounce rapid-scan fetches

  // Keep refs in sync with state
  useEffect(() => { scanModeRef.current = scanMode; }, [scanMode]);
  useEffect(() => { manualQtyRef.current = manualQty; }, [manualQty]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { barcodeInputRef.current = barcodeInput; }, [barcodeInput]);

  // Derived filtered items for search & view
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(item =>
        item.barcode?.toLowerCase().includes(term) || item.name?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [items, searchTerm]);

  // ─── Memoized total QTY sum ──
  const totalQtySum = useMemo(() => {
    return items.reduce((acc, curr) => acc + (Number(curr.qty) || 0), 0);
  }, [items]);

  // Trigger floating toast with auto dismiss
  const showToast = (toastData) => {
    setToast(toastData);
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ─── 1. FETCH REALTIME DATA FROM SUPABASE ─────────────────────────
  const fetchLak8Stock = async (silent = false, overrideBranch = null, overrideDate = null, overrideOwner = null) => {
    try {
      if (!silent) setIsLoading(true);

      // Use override values (passed from handleConfirmSetup to avoid stale closure),
      // or fall back to filter mode / current session state
      const targetBranch = overrideBranch ?? (isFilterMode ? filterBranch : selectedBranch);
      const targetDate   = overrideDate   ?? (isFilterMode ? filterDate   : selectedDate);
      const targetOwner  = overrideOwner  ?? (isFilterMode ? null         : lak8OwnerBranch);

      let query = supabase.from('stock_count_lak8').select('*');

      if (targetBranch) query = query.eq('branch', targetBranch);
      if (targetDate)   query = query.eq('count_date', targetDate);

      // ✅ KEY FIX: filter by owner_branch when branch=LAK8
      // Without this, selecting LAK8+VX fetches ALL LAK8 rows (TLL, PTX, etc.)
      if (targetBranch === 'LAK8' && targetOwner) {
        query = query.eq('owner_branch', targetOwner);
      }

      // 🏷️ Brand Filter: If joah, include 'joah' and null (legacy records); if technohub, match 'technohub'
      const currentBrand = selectedBrand || 'joah';
      if (currentBrand === 'technohub') {
        query = query.eq('brand', 'technohub');
      } else {
        query = query.or('brand.eq.joah,brand.is.null');
      }

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // ⚡ Auto-sync Doc Nos across staff: If any item in this session has doc_nos, sync it to current staff
        const itemWithDoc = data.find(item => Array.isArray(item.doc_nos) && item.doc_nos.length > 0);
        if (itemWithDoc && itemWithDoc.doc_nos?.length > 0) {
          const sharedDocs = itemWithDoc.doc_nos;
          setDocNos(prev => {
            if (!prev || prev.length === 0) {
              localStorage.setItem('lak8_doc_nos', JSON.stringify(sharedDocs));
              setHasDocNo(true);
              return sharedDocs;
            }
            return prev;
          });
        }

        const formatted = data.map(item => ({
          id: item.id,
          barcode: item.barcode,
          name: getProductName(item.barcode) || `ສິນຄ້າບາໂຄດ ${item.barcode}`,
          qty: Number(item.qty) || 0,
          createdBy: item.created_by || 'Unknown',
          branch: item.branch,
          owner_branch: item.owner_branch,
          doc_nos: item.doc_nos,
          countDate: item.count_date,
          timestamp: new Date(item.updated_at || item.created_at).toLocaleTimeString('lo-LA')
        }));
        setItems(formatted);
        itemsRef.current = formatted;
      }
    } catch (err) {
      console.error('[Lak8 Fetch Error]', err);
      showToast({
        type: 'error',
        title: 'ຂໍ້ຜິດພາດ!',
        message: 'ບໍ່ສາມາດໂຫຼດຂໍ້ມູນໄດ້'
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const fetchLak8Events = async () => {
    try {
      const targetBranch = isFilterMode ? filterBranch : selectedBranch;
      const targetDate = isFilterMode ? filterDate : selectedDate;
      const targetOwner = isFilterMode ? null : lak8OwnerBranch;

      let query = supabase.from('stock_count_lak8_events').select('*');
      if (targetBranch) query = query.eq('branch', targetBranch);
      if (targetDate) query = query.eq('count_date', targetDate);
      if (targetOwner) query = query.eq('owner_branch', targetOwner);

      const { data, error } = await query.order('created_at', { ascending: false });
      if (!error && data) {
        setEvents(data);
      }
    } catch (err) {
      console.log('[Event fetch notice]', err.message);
    }
  };

  const fetchLak8Status = async () => {
    try {
      const targetBranch = isFilterMode ? filterBranch : selectedBranch;
      const targetDate = isFilterMode ? filterDate : selectedDate;
      const targetOwner = isFilterMode ? null : (selectedBranch === 'LAK8' ? lak8OwnerBranch : null);
      if (!targetBranch || !targetDate) return;

      let query = supabase.from('stock_count_lak8_status').select('status');
      query = query.eq('branch', targetBranch).eq('count_date', targetDate);
      if (targetBranch === 'LAK8' && targetOwner) {
        query = query.eq('owner_branch', targetOwner);
      } else {
        query = query.is('owner_branch', null);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data?.status) {
        setSessionStatus(data.status);
      }
    } catch (err) {
      console.log('[Status fetch notice]', err.message);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('ຂະໜາດຮູບພາບໃຫຍ່ເກີນໄປ (ສູງສຸດ 5MB)');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setEventImage(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      alert('ກະລຸນາປ້ອນຫົວຂໍ້/ລາຍລະອຽດເຫດການ!');
      return;
    }

    setIsSubmittingEvent(true);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    try {
      const newEvent = {
        branch: selectedBranch,
        owner_branch: selectedBranch === 'LAK8' ? lak8OwnerBranch : null,
        count_date: selectedDate,
        title: eventTitle.trim(),
        qty: Math.max(1, Number(eventQty) || 1),
        image_url: eventImage,
        created_by: empId,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('stock_count_lak8_events')
        .insert([newEvent])
        .select();

      if (error) {
        // Fallback to local state if table does not exist in DB yet
        console.warn('Events table might not exist yet, saving locally:', error.message);
        setEvents(prev => [{ ...newEvent, id: Date.now() }, ...prev]);
      } else if (data) {
        setEvents(prev => [data[0], ...prev]);
      }

      setEventTitle('');
      setEventQty(1);
      setEventImage(null);
      showToast({
        type: 'success',
        title: 'ບັນທຶກເຫດການສຳເລັດ! 📝',
        message: `ບັນທຶກ "${eventTitle}" เรียบร้อยแล้ว`
      });
    } catch (err) {
      console.error('[Event Insert Error]', err);
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  useEffect(() => {
    if (selectedBranch && selectedDate) {
      fetchLak8Stock();
      fetchLak8Events();
      fetchLak8Status();
    }
  }, [selectedBranch, selectedDate, lak8OwnerBranch, isFilterMode, filterBranch, filterDate]);

  const handleDeleteEvent = async (eventId) => {
    if (!window.confirm('\u0e97\u0ec8\u0eb2\u0e99\u0e95\u0ec9\u0ead\u0e87\u0e81\u0eb2\u0e99\u0ea5\u0eb6\u0e9a\u0ec0\u0eab\u0e94\u0e81\u0eb2\u0e99\u0e99\u0eb5\u0ec9\u0ec1\u0e97\u0ec9\u0e9a\u0ecd?')) return;
    try {
      const { error } = await supabase
        .from('stock_count_lak8_events')
        .delete()
        .eq('id', eventId);
      if (error) throw error;
      setEvents(prev => prev.filter(e => e.id !== eventId));
      showToast({ type: 'success', title: '\u0ea5\u0eb6\u0e9a\u0eaa\u0eb3\u0ec0\u0ea5\u0eb1\u0e94', message: '\u0ea5\u0eb2\u0e8d\u0e81\u0eb2\u0e99\u0ec0\u0eab\u0e94\u0e81\u0eb2\u0e99\u0e96\u0eb7\u0e81\u0ea5\u0eb6\u0e9a\u0ead\u0ead\u0e81\u0ec1\u0ea5\u0ec9\u0ea7' });
    } catch (err) {
      showToast({ type: 'error', title: '\u0e9c\u0eb4\u0e94\u0e9e\u0eb2\u0e94!', message: '\u0e9a\u0ecd\u0ec8\u0eaa\u0eb2\u0ea1\u0eb2\u0e96\u0ea5\u0eb6\u0e9a\u0ec4\u0e94\u0ec9' });
    }
  };


  useEffect(() => {
    const targetBranch = isFilterMode ? filterBranch : selectedBranch;
    const targetDate = isFilterMode ? filterDate : selectedDate;

    if (!targetBranch || !targetDate) return;

    // ⚡ CHANNEL 1: Stock Realtime with SERVER-SIDE branch filter (most reliable)
    const stockChannel = supabase
      .channel(`lak8_stock_rt_${targetBranch}_${targetDate}_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stock_count_lak8',
          filter: `branch=eq.${targetBranch}`   // ✅ Server-side filter — avoids stale closure bugs
        },
        (payload) => {
          // Client-side date check only (lightweight)
          const itemDate = payload.new?.count_date || payload.old?.count_date;
          if (targetDate && itemDate && itemDate !== targetDate) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new;
            setItems(prev => {
              const filtered = prev.filter(i => i.id !== newData.id);
              const formattedItem = {
                id: newData.id,
                barcode: newData.barcode,
                name: getProductName(newData.barcode) || `ສິນຄ້າບາໂຄດ ${newData.barcode}`,
                qty: Number(newData.qty) || 0,
                createdBy: newData.created_by || 'Unknown',
                branch: newData.branch,
                owner_branch: newData.owner_branch,
                doc_nos: newData.doc_nos,
                countDate: newData.count_date,
                timestamp: new Date(newData.updated_at || newData.created_at).toLocaleTimeString('lo-LA')
              };
              return [formattedItem, ...filtered];
            });
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== payload.old.id));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Realtime] Stock channel CONNECTED ✅ (${targetBranch}/${targetDate})`);
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[Realtime] Stock channel ERROR ❌', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[Realtime] Stock channel TIMED OUT ⚠️');
        }
      });

    // ⏱️ POLLING FALLBACK: every 30s silent refresh in case WebSocket drops
    const pollingInterval = setInterval(() => {
      fetchLak8Stock(true);
    }, 30000);

    // ⚡ CHANNEL 2: Status Realtime (optional — isolated from stock channel)
    let statusChannel = null;
    try {
      statusChannel = supabase
        .channel(`lak8_status_rt_${targetBranch}_${targetDate}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'stock_count_lak8_status' },
          (payload) => {
            const item = payload.new || payload.old;
            if (item?.branch === targetBranch && item?.count_date === targetDate) {
              const targetOwner = selectedBranch === 'LAK8' ? lak8OwnerBranch : null;
              const isMatchOwner = targetBranch === 'LAK8' ? item?.owner_branch === targetOwner : true;
              if (isMatchOwner && payload.new?.status) {
                setSessionStatus(payload.new.status);
              }
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[Realtime] Status channel skipped:', err.message);
    }

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(stockChannel);
      if (statusChannel) supabase.removeChannel(statusChannel);
    };
  }, [selectedBranch, selectedDate, isFilterMode, filterBranch, filterDate]);

  const toggleSessionStatus = async () => {
    const isConfirm = window.confirm(
      sessionStatus === 'completed'
        ? 'ທ່ານຕ້ອງການປ່ຽນສະຖານະກັບມາເປັນ "ກຳລັງນັບ" ແທ້ບໍ?'
        : 'ທ່ານຕ້ອງການປ່ຽນສະຖານະເປັນ "ນັບສຳເລັດແລ້ວ" ແທ້ບໍ?'
    );
    if (!isConfirm) return;

    const nextStatus = sessionStatus === 'completed' ? 'in_progress' : 'completed';
    setSessionStatus(nextStatus);
    const statusKey = `lak8_status_${selectedBranch}_${selectedDate}_${lak8OwnerBranch}`;
    localStorage.setItem(statusKey, nextStatus);

    try {
      await supabase
        .from('stock_count_lak8_status')
        .upsert(
          [
            {
              branch: selectedBranch,
              owner_branch: selectedBranch === 'LAK8' ? lak8OwnerBranch : null,
              count_date: selectedDate,
              status: nextStatus,
              updated_at: new Date().toISOString()
            }
          ],
          { onConflict: 'branch,count_date,owner_branch' }
        );
    } catch (err) {
      console.warn('Status upsert notice:', err.message);
    }

    showToast({
      type: nextStatus === 'completed' ? 'success' : 'info',
      title: nextStatus === 'completed' ? 'ສຳເລັດແລ້ວ! 🎉' : 'ກຳລັງນັບ... ⏳',
      message: `ສະຖານະຖືກປ່ຽນເປັນ ${nextStatus === 'completed' ? 'ນັບສຳເລັດແລ້ວ' : 'ກຳລັງດຳເນີນການນັບ'}`
    });
  };

  // ─── Setup Session ────────────────────────────────────────────────
  const handleConfirmSetup = () => {
    if (!selectedBranch || !selectedDate) {
      alert('ກະລຸນາເລືອກສາຂາ ແລະ ວັນທີກ່ອນ!');
      return;
    }
    if (selectedBranch === 'LAK8' && !lak8OwnerBranch) {
      alert('ກະລຸນາເລືອກສາຂາເຈົ້າຂອງຂອງສຳລັບ LAK8!');
      return;
    }

    const validDocNos = hasDocNo ? docNos.filter(d => d.trim() !== '') : [];

    localStorage.setItem('lak8_branch', selectedBranch);
    localStorage.setItem('lak8_date', selectedDate);
    localStorage.setItem('lak8_owner_branch', lak8OwnerBranch);
    localStorage.setItem('lak8_doc_nos', JSON.stringify(validDocNos));

    const statusKey = `lak8_status_${selectedBranch}_${selectedDate}_${lak8OwnerBranch}`;
    const savedStatus = localStorage.getItem(statusKey) || 'in_progress';
    setSessionStatus(savedStatus);
    setDocNos(validDocNos);

    setShowSetupModal(false);
    // ✅ Pass values directly — React setState is async so closure still has old values
    fetchLak8Stock(false, selectedBranch, selectedDate, lak8OwnerBranch);
  };

  const handleLogoutSession = () => {
    if (window.confirm('ທ່ານຕ້ອງການອອກຈາກເຊດຊັນການນັບນີ້ບໍ?')) {
      localStorage.removeItem('lak8_branch');
      localStorage.removeItem('lak8_date');
      localStorage.removeItem('lak8_owner_branch');
      localStorage.removeItem('lak8_doc_nos');
      setSelectedBranch('');
      setLak8OwnerBranch('');
      setDocNos([]);
      setHasDocNo(false);
      setShowSetupModal(true);
    }
  };

  // ─── HARDWARE VOLUME BUTTON TRIGGER ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'F1', 'F2', 'F12'].includes(e.key) || e.code?.includes('Volume')) {
        e.preventDefault();
        if (showSetupModal) return;

        setDebugLog(prev => ({
          ...prev,
          lastTrigger: new Date().toLocaleTimeString('lo-LA'),
          triggerType: 'VOLUME_KEY 🔘',
          status: 'TRIGGER FIRED'
        }));

        const currentInput = barcodeInputRef.current;
        if (currentInput && currentInput.trim()) {
          processScanCode(currentInput.trim());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSetupModal]);

  // Auto focus ONLY when camera is OFF
  useEffect(() => {
    if (!isCameraActive && inputRef.current && !showSetupModal) {
      inputRef.current.focus();
    }
  }, [isCameraActive, scanMode, showSetupModal]);

  // ─── CAMERA SCANNER ──────────────────────────────────────────────
  useEffect(() => {
    let html5Scanner = null;
    let isMounted = true;
    let startPromise = null;

    if (isCameraActive) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            stream.getTracks().forEach(track => track.stop());
            if (!isMounted) return;

            setTimeout(() => {
              if (!isMounted) return;
              import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
                if (!isMounted) return;

                const element = document.getElementById('lak8-reader');
                if (!element) return;

                const formatsToSupport = [
                  Html5QrcodeSupportedFormats.EAN_13,
                  Html5QrcodeSupportedFormats.CODE_128
                ];

                html5Scanner = new Html5Qrcode('lak8-reader', { formatsToSupport, verbose: false });

                startPromise = html5Scanner.start(
                  { facingMode: 'environment' },
                  {
                    fps: 15,
                    qrbox: { width: 260, height: 140 },
                    experimentalFeatures: {
                      useBarCodeDetectorIfSupported: true
                    }
                  },
                  (decodedText) => {
                    if (isProcessingRef.current) return;

                    const now = Date.now();
                    const cleanCode = decodedText.trim();

                    if (!/^\d{13}$/.test(cleanCode)) return;

                    if (
                      lastScannedBarcodeRef.current === cleanCode &&
                      (now - lastScanTimeRef.current) < 2500
                    ) return;

                    lastScannedBarcodeRef.current = cleanCode;
                    lastScanTimeRef.current = now;

                    try {
                      const ctx = new (window.AudioContext || window.webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(1000, ctx.currentTime);
                      osc.connect(ctx.destination);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.12);
                    } catch (e) { }

                    const currentMode = scanModeRef.current;

                    if (currentMode === 'manual') {
                      setBarcodeInput(cleanCode);
                      setIsCameraActive(false);
                      setCameraPermState('idle');
                      showToast({ type: 'info', title: 'ສະແກນສຳເລັດ ✅', message: 'ກະລຸນາຕັ້ງຈຳນວນ ແລ້ວກົດ ຕົກລົງ' });
                      return;
                    }

                    if (currentMode === 'search') {
                      setSearchTerm(cleanCode);
                      setIsCameraActive(false);
                      setCameraPermState('idle');
                      setScanMode('count');
                      return;
                    }

                    isProcessingRef.current = true;
                    processScanCode(cleanCode, false).finally(() => {
                      isProcessingRef.current = false;
                    });
                  },
                  () => { }
                ).catch(err => {
                  console.error('Camera start error:', err);
                });
              });
            }, 200);
          })
          .catch((err) => {
            alert('ກະລຸນາອະນຸຍາດການໃຊ້ກ້ອງ!');
            setIsCameraActive(false);
          });
      }
    }

    return () => {
      isMounted = false;
      if (html5Scanner && html5Scanner.isScanning) {
        html5Scanner.stop().then(() => html5Scanner.clear()).catch(() => { });
      }
    };
  }, [isCameraActive]);

  const getProductName = (barcode) => {
    if (!masterData || masterData.length === 0) return null;
    const found = masterData.find(m => m.barcode === barcode || m.item_code === barcode);
    return found?.name || found?.item_name || null;
  };

  // ─── 2. PROCESS SCAN & UPSERT ─────────────────────────────────────
  const processScanCode = async (codeToScan, clearInput = true) => {
    const code = codeToScan.trim();
    if (!code) return;

    if (!/^\d{13}$/.test(code)) {
      if (clearInput) {
        showToast({
          type: 'error',
          title: 'ເລກບາໂຄດບໍ່ຖືກຕ້ອງ! ❌',
          message: 'ລະບົບຮອງຮັບສະເພາະບາໂຄດຕົວເລກ 13 ຫຼັກເທົ່ານັ້ນ'
        });
      }
      return;
    }

    setIsSubmittingBarcode(true);
    const addAmount = scanModeRef.current === 'count' ? 1 : Math.max(1, Number(manualQtyRef.current) || 1);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    try {
      const { error } = await supabase.rpc('increment_stock_lak8_v2', {
        target_barcode: code,
        amount: addAmount,
        user_id: empId,
        target_branch: selectedBranch,
        target_date: selectedDate,
        p_owner_branch: selectedBranch === 'LAK8' ? lak8OwnerBranch : null,
        p_doc_nos: selectedBranch === 'LAK8' && docNos.length > 0 ? docNos : null,
        p_brand: selectedBrand || 'joah'
      });

      if (error) throw error;

      // ⚡ Debounced fetch: wait 1.5s after last scan before refreshing list
      // This prevents spamming Supabase with a request per scan during rapid counting
      if (fetchDebounceRef.current) clearTimeout(fetchDebounceRef.current);
      fetchDebounceRef.current = setTimeout(() => {
        fetchLak8Stock(true);
      }, 1500);

      if (clearInput) {
        setBarcodeInput('');
        if (inputRef.current) inputRef.current.focus();
      }

      showToast({
        type: 'success',
        title: 'ບັນທຶກສຳເລັດ! ➕',
        message: `ບາໂຄດ ${code} ເພີ່ມ ${addAmount} QTY`
      });

    } catch (err) {
      console.error('[Scan Error]', err);
      showToast({ type: 'error', title: 'ເກີດຂໍ້ຜິດພາດ!', message: 'ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້' });
    } finally {
      setIsSubmittingBarcode(false);
    }
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    processScanCode(barcodeInput);
  };

  const updateItemQty = async (id, currentQty, delta) => {
    const newQty = Math.max(0, currentQty + delta);
    if (newQty === currentQty) return;

    setIsUpdatingQty(prev => ({ ...prev, [id]: true }));
    try {
      const { error } = await supabase
        .from('stock_count_lak8')
        .update({ qty: newQty, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      fetchLak8Stock(true);
    } catch (err) {
      showToast({ type: 'error', title: 'ຜິດພາດ!', message: 'ບໍ່ສາມາດປ່ຽນຈຳນວນໄດ້' });
    } finally {
      setIsUpdatingQty(prev => ({ ...prev, [id]: false }));
    }
  };

  const deleteItem = async (id) => {
    if (!window.confirm('ຢືນຢັນການລຶບລາຍການນີ້?')) return;
    setIsDeletingBarcode(prev => ({ ...prev, [id]: true }));
    try {
      const { error } = await supabase.from('stock_count_lak8').delete().eq('id', id);
      if (error) throw error;
      fetchLak8Stock(true);
      showToast({ type: 'success', title: 'ລຶບສຳເລັດ', message: 'ລາຍການຖືກລຶບອອກແລ້ວ' });
    } catch (err) {
      showToast({ type: 'error', title: 'ຜິດພາດ!', message: 'ບໍ່ສາມາດລຶບໄດ້' });
    } finally {
      setIsDeletingBarcode(prev => ({ ...prev, [id]: false }));
    }
  };

  // ─── ELEGANT EXCEL EXPORT WITH EXCELJS ─────────────────────────────
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Joah Warehouse Validator';
      workbook.created = new Date();

      const fontPhetsarath = { name: 'Phetsarath OT', size: 11 };
      const fontHeader = { name: 'Phetsarath OT', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      const thinBorder = {
        top: { style: 'thin', color: { argb: 'FF000000' } },
        left: { style: 'thin', color: { argb: 'FF000000' } },
        bottom: { style: 'thin', color: { argb: 'FF000000' } },
        right: { style: 'thin', color: { argb: 'FF000000' } }
      };
      const headerFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF334155' } // Slate 700
      };
      const centerAlignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      // ─── Sheet 1: Stock Count ──────────────────────────────────────
      const sheet1 = workbook.addWorksheet('Stock Count');

      const currentOwner = selectedBranch === 'LAK8' ? (lak8OwnerBranch || '-') : '-';
      const docStr = docNos && docNos.length > 0 ? docNos.join(', ') : '-';
      const totalQty = items.reduce((acc, i) => acc + (Number(i.qty) || 0), 0);

      // Determine Brand Display Name dynamically based on selectedBrand state
      const brandName = selectedBrand === 'technohub' ? 'Techno Hub' : 'JOAH';
      const brandPrefix = selectedBrand === 'technohub' ? 'TechnoHub' : 'JOAH';

      sheet1.mergeCells('A1:J1');
      const titleCell = sheet1.getCell('A1');
      titleCell.value = `📦 ບົດລາຍງານການນັບສະຕັອກ ${brandName} (Stock Count Report ${brandName})`;
      titleCell.font = { name: 'Phetsarath OT', size: 16, bold: true, color: { argb: 'FF1E293B' } };
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet1.mergeCells('A2:J2');
      const infoCell = sheet1.getCell('A2');
      infoCell.value = `ສາຂາ: ${selectedBranch || 'All'} | ສາຂາເຈົ້າຂອງ: ${currentOwner} | ວັນທີ: ${selectedDate} | ເລກບິນ: ${docStr} | ລວມ: ${items.length} ລາຍການ (${totalQty} QTY)`;
      infoCell.font = { name: 'Phetsarath OT', size: 11, italic: true, color: { argb: 'FF475569' } };
      infoCell.alignment = { horizontal: 'center', vertical: 'middle' };

      sheet1.addRow([]); // Blank row 3

      const headers = [
        'ລຳດັບ (#)',
        'ເລກບາໂຄດ (Barcode)',
        'ຊື່ສິນຄ້າ (Product Name)',
        'ຈຳນວນ (QTY)',
        'ສາຂາຫຼັກ (Branch)',
        'ສາຂາເຈົ້າຂອງ (Owner Branch)',
        'ເລກທີບິນ (Doc Nos)',
        'ວັນທີນັບ (Count Date)',
        'ຜູ້ບັນທຶກ (Staff)',
        'ເວລາ (Time)'
      ];
      const headerRow = sheet1.addRow(headers);
      headerRow.height = 28;
      headerRow.eachCell((cell) => {
        cell.font = fontHeader;
        cell.fill = headerFill;
        cell.alignment = centerAlignment;
        cell.border = thinBorder;
      });

      items.forEach((item, index) => {
        const docs = Array.isArray(item.doc_nos) ? item.doc_nos.join(', ') : (item.doc_nos || '-');
        const row = sheet1.addRow([
          index + 1,
          item.barcode,
          item.name,
          item.qty,
          item.branch,
          item.owner_branch || '-',
          docs,
          item.countDate,
          item.createdBy,
          item.timestamp
        ]);
        row.height = 22;
        row.eachCell((cell) => {
          cell.font = fontPhetsarath;
          cell.alignment = centerAlignment;
          cell.border = thinBorder;
        });
      });

      const footerRow = sheet1.addRow([
        'ລວມທັງໝົດ',
        '',
        `ຍອດລວມ ${items.length} ລາຍການ`,
        totalQty,
        '',
        '',
        '',
        '',
        '',
        ''
      ]);
      footerRow.height = 24;
      footerRow.eachCell((cell) => {
        cell.font = { name: 'Phetsarath OT', size: 11, bold: true };
        cell.alignment = centerAlignment;
        cell.border = thinBorder;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      });

      sheet1.columns = [
        { width: 10 }, // #
        { width: 20 }, // Barcode
        { width: 35 }, // Name
        { width: 14 }, // Qty
        { width: 14 }, // Branch
        { width: 18 }, // Owner Branch
        { width: 25 }, // Doc Nos
        { width: 15 }, // Count Date
        { width: 16 }, // Staff
        { width: 15 }  // Time
      ];

      // ─── Sheet 2: Event Logs (if events exist) ─────────────────────
      if (events && events.length > 0) {
        const sheet2 = workbook.addWorksheet('Event Logs');

        sheet2.mergeCells('A1:I1');
        const eventTitleCell = sheet2.getCell('A1');
        eventTitleCell.value = `📝 ບົດລາຍງານເຫດການ & ອຸປະກອນ (Event Logs)`;
        eventTitleCell.font = { name: 'Phetsarath OT', size: 16, bold: true, color: { argb: 'FF581C87' } };
        eventTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet2.mergeCells('A2:I2');
        const eventInfoCell = sheet2.getCell('A2');
        eventInfoCell.value = `ສາຂາ: ${selectedBranch || 'All'} | ວັນທີ: ${selectedDate} | ລວມເຫດການ: ${events.length} ລາຍການ`;
        eventInfoCell.font = { name: 'Phetsarath OT', size: 11, italic: true, color: { argb: 'FF6B21A8' } };
        eventInfoCell.alignment = { horizontal: 'center', vertical: 'middle' };

        sheet2.addRow([]);

        const eventHeaders = [
          'ລຳດັບ (#)',
          'ຫົວຂໍ້ / ລາຍລະອຽດ (Event Title)',
          'ຈຳນວນ (QTY)',
          'ຮູບພາບປະກອບ (Image)',
          'ສາຂາຫຼັກ (Branch)',
          'ສາຂາເຈົ້າຂອງ (Owner Branch)',
          'ວັນທີ (Date)',
          'ຜູ້ບັນທຶກ (Staff)',
          'ເວລາບັນທຶກ (Time)'
        ];
        const eventHeaderRow = sheet2.addRow(eventHeaders);
        eventHeaderRow.height = 28;
        eventHeaderRow.eachCell((cell) => {
          cell.font = fontHeader;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B21A8' } };
          cell.alignment = centerAlignment;
          cell.border = thinBorder;
        });

        events.forEach((evt, idx) => {
          const hasImage = Boolean(evt.image_url);
          const row = sheet2.addRow([
            idx + 1,
            evt.title,
            evt.qty || 1,
            hasImage ? '' : 'ບໍ່ມີຮູບ',
            evt.branch,
            evt.owner_branch || '-',
            evt.count_date,
            evt.created_by || 'Staff',
            new Date(evt.created_at).toLocaleTimeString('lo-LA')
          ]);

          row.height = hasImage ? 60 : 24;

          row.eachCell((cell) => {
            cell.font = fontPhetsarath;
            cell.alignment = centerAlignment;
            cell.border = thinBorder;
          });

          // ⚡ EMBED ACTUAL IMAGE INTO EXCEL CELL
          if (hasImage && evt.image_url.startsWith('data:image')) {
            try {
              const base64Data = evt.image_url.split(',')[1];
              const ext = evt.image_url.includes('png') ? 'png' : 'jpeg';
              const imageId = workbook.addImage({
                base64: base64Data,
                extension: ext
              });
              sheet2.addImage(imageId, {
                tl: { col: 3, row: row.number - 1 },
                ext: { width: 55, height: 55 }
              });
            } catch (imgErr) {
              console.error('Failed to embed image into Excel cell:', imgErr);
            }
          }
        });

        sheet2.columns = [
          { width: 10 }, // #
          { width: 35 }, // Title
          { width: 12 }, // Qty
          { width: 22 }, // Image
          { width: 14 }, // Branch
          { width: 18 }, // Owner Branch
          { width: 15 }, // Date
          { width: 16 }, // Staff
          { width: 15 }  // Time
        ];
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `StockCount_${brandPrefix}_${selectedBranch}_${selectedDate}.xlsx`);

      showToast({ type: 'success', title: 'ສົ່ງອອກສຳເລັດ! 📊', message: 'ໄຟລ໌ Excel ຖືກດາວໂຫຼດຮຽບຮ້ອຍແລ້ວ' });
    } catch (err) {
      console.error('[Excel Export Error]', err);
      showToast({ type: 'error', title: 'ເກີດຂໍ້ຜິດພາດ!', message: 'ບໍ່ສາມາດສົ່ງອອກໄຟລ໌ Excel ໄດ້' });
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (data.length > 0) {
          const headers = data[0];
          setExcelHeaders(headers);
          setExcelData(data.slice(1));
          setColumnMapping({
            barcode: headers.find(h => /barcode|code/i.test(h)) || '',
            qty: headers.find(h => /qty|quantity|จำนวน/i.test(h)) || ''
          });
          setShowImportModal(true);
        }
      } catch (err) { alert('Error reading file'); }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleImportData = async () => {
    if (!columnMapping.barcode || !columnMapping.qty) return;
    setIsImporting(true);
    const bIdx = excelHeaders.indexOf(columnMapping.barcode);
    const qIdx = excelHeaders.indexOf(columnMapping.qty);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';
    setImportProgress({ current: 0, total: excelData.length });

    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i];
      const bc = String(row[bIdx] || '').trim();
      const q = Number(row[qIdx]) || 0;
      if (bc && q > 0) {
        await supabase.rpc('increment_stock_lak8_v2', {
          target_barcode: bc,
          amount: q,
          user_id: empId,
          target_branch: selectedBranch,
          target_date: selectedDate,
          p_owner_branch: selectedBranch === 'LAK8' ? lak8OwnerBranch : null,
          p_doc_nos: selectedBranch === 'LAK8' && docNos.length > 0 ? docNos : null
        });
      }
      setImportProgress(p => ({ ...p, current: i + 1 }));
    }
    setIsImporting(false);
    setShowImportModal(false);
    fetchLak8Stock();
    showToast({ type: 'success', title: 'ນຳເຂົ້າສຳເລັດ', message: `ນຳເຂົ້າຂໍ້ມູນຮຽບຮ້ອຍແລ້ວ` });
  };

  // ─── Brand Selector (shown before setup modal if brand not yet chosen) ────
  if (!selectedBrand) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 relative overflow-hidden">
        {/* Animated background circles */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 -left-20 w-96 h-96 rounded-full bg-indigo-600/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Back button */}
        <button
          onClick={onBack}
          className="absolute top-5 left-5 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span className="text-sm font-semibold">ກັບຄືນ</span>
        </button>

        {/* Header */}
        <div className="relative z-10 text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-slate-300 text-xs font-bold tracking-widest uppercase mb-4">
            <Package size={14} />
            ນັບສິນຄ້າ Stock Count
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">ເລືອກປະເພດສິນຄ້າ</h1>
          <p className="text-slate-400 text-base">ທ່ານຕ້ອງການນັບສິນຄ້າຂອງໃຜ?</p>
        </div>

        {/* Brand Cards */}
        <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">

          {/* Joah Card */}
          <button
            onClick={() => {
              localStorage.setItem('lak8_brand', 'joah');
              setSelectedBrand('joah');
            }}
            className="group relative flex flex-col items-center justify-center gap-5 p-8 rounded-3xl bg-white/5 border-2 border-white/10 hover:border-orange-400/60 hover:bg-orange-500/10 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-orange-500/20 cursor-pointer"
          >
            <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 group-hover:border-orange-400/50 transition-all duration-300">
              <img src={joahLogo} alt="Joah" className="w-full h-full object-cover" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-black tracking-wide">JOAH</p>
              <p className="text-slate-400 text-sm mt-1">Joy of a Home</p>
            </div>
            <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-orange-500/20 border border-orange-400/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft size={14} className="text-orange-400 rotate-180" />
            </div>
          </button>

          {/* TechnoHub Card */}
          <button
            onClick={() => {
              localStorage.setItem('lak8_brand', 'technohub');
              setSelectedBrand('technohub');
            }}
            className="group relative flex flex-col items-center justify-center gap-5 p-8 rounded-3xl bg-white/5 border-2 border-white/10 hover:border-blue-400/60 hover:bg-blue-500/10 transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-blue-500/20 cursor-pointer"
          >
            <div className="w-28 h-28 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 group-hover:border-blue-400/50 transition-all duration-300 bg-white flex items-center justify-center p-2">
              <img src={technoHubLogo} alt="TechnoHub" className="w-full h-full object-contain" />
            </div>
            <div className="text-center">
              <p className="text-white text-xl font-black tracking-wide">TECHNOHUB</p>
              <p className="text-slate-400 text-sm mt-1">Technology Products</p>
            </div>
            <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowLeft size={14} className="text-blue-400 rotate-180" />
            </div>
          </button>
        </div>

        <p className="relative z-10 mt-8 text-slate-600 text-xs">Stock Count System · Lak 8 Warehouse</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* SETUP MODAL (FIRST ENTRY) */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-100">
            {/* Top Brand Banner Header */}
            <div className={`py-3 px-6 flex items-center justify-between border-b ${selectedBrand === 'technohub'
                ? 'bg-gradient-to-r from-sky-600 to-blue-700 text-white'
                : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
              }`}>
              <div className="flex items-center gap-2">
                <img
                  src={selectedBrand === 'technohub' ? technoHubLogo : joahLogo}
                  alt={selectedBrand}
                  className={`w-6 h-6 rounded-md object-contain ${selectedBrand === 'technohub' ? 'bg-white p-0.5' : ''}`}
                />
                <span className="text-xs font-black uppercase tracking-widest">
                  {selectedBrand === 'technohub' ? 'TECHNOHUB TEMPLATE' : 'JOAH TEMPLATE'}
                </span>
              </div>
              <button
                onClick={() => {
                  localStorage.removeItem('lak8_brand');
                  setSelectedBrand(null);
                }}
                className="text-xs font-bold text-white/80 hover:text-white underline underline-offset-2 cursor-pointer flex items-center gap-1"
              >
                ← ຍ້ອນກັບ
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 border shadow-sm ${selectedBrand === 'technohub'
                    ? 'bg-sky-50 border-sky-100 text-sky-600'
                    : 'bg-indigo-50 border-indigo-100 text-indigo-600'
                  }`}>
                  {selectedBrand === 'technohub' ? (
                    <img src={technoHubLogo} alt="TechnoHub" className="w-14 h-14 object-contain" />
                  ) : (
                    <Building2 size={40} />
                  )}
                </div>
                <h2 className="text-2xl font-black text-slate-800">
                  {selectedBrand === 'technohub' ? 'ເລີ່ມຕົ້ນນັບສິນຄ້າ TechnoHub' : 'ເລີ່ມຕົ້ນການນັບສິນຄ້າ Joah'}
                </h2>
                <p className="text-slate-500 font-medium text-sm">ກະລຸນາເລືອກສາຂາ ແລະ ວັນທີທີ່ທ່ານຈະນັບ</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 block">ສາຂາ (Branch)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {branches.map(b => (
                      <button
                        key={b}
                        onClick={() => setSelectedBranch(b)}
                        className={`py-3 rounded-xl font-bold border-2 transition-all ${selectedBranch === b
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {selectedBranch === 'LAK8' && (
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div>
                      <label className="text-xs font-black uppercase tracking-wider text-indigo-400 mb-1.5 block">
                        ສາຂາເຈົ້າຂອງສິນຄ້າ (Owner Branch)
                      </label>
                      <div className="grid grid-cols-5 gap-1.5">
                        {['VX', 'SVL', 'TLL', 'PTX', 'PSN'].map(b => (
                          <button
                            key={b}
                            onClick={() => setLak8OwnerBranch(b)}
                            className={`py-2 rounded-lg font-bold text-xs border transition-all ${lak8OwnerBranch === b
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-indigo-200 bg-white hover:border-indigo-300 text-indigo-600'}`}
                          >
                            {b}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <label className="text-xs font-black uppercase tracking-wider text-indigo-400">
                          ມີເລກບິນ (Doc No) ບໍ່?
                        </label>
                        <button
                          onClick={() => {
                            setHasDocNo(!hasDocNo);
                            if (!hasDocNo && docNos.length === 0) setDocNos(['']);
                          }}
                          className={`w-10 h-5 rounded-full relative transition-colors ${hasDocNo ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${hasDocNo ? 'translate-x-5' : ''}`}></span>
                        </button>
                      </div>

                      {hasDocNo && (
                        <div className="space-y-2 mt-2">
                          {docNos.map((doc, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={doc}
                                onChange={(e) => {
                                  const newDocs = [...docNos];
                                  newDocs[idx] = e.target.value;
                                  setDocNos(newDocs);
                                }}
                                placeholder={`Doc No. ${idx + 1}`}
                                className="flex-1 px-3 py-2 border border-indigo-200 rounded-lg text-sm font-bold focus:border-indigo-500 outline-none"
                              />
                              <button
                                onClick={() => {
                                  if (docNos.length > 1) {
                                    setDocNos(docNos.filter((_, i) => i !== idx));
                                  }
                                }}
                                className="p-2 text-rose-400 hover:bg-rose-50 rounded-lg"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ))}
                          {docNos.length < 20 && (
                            <button
                              onClick={() => setDocNos([...docNos, ''])}
                              className="w-full py-2 border border-dashed border-indigo-300 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 text-sm flex items-center justify-center gap-1"
                            >
                              <Plus size={16} /> ເພີ່ມບິນ (ສູງສຸດ 20)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 block">ວັນທີ (Date)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-slate-400" size={20} />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl font-bold focus:border-indigo-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={handleConfirmSetup}
                disabled={!selectedBranch || !selectedDate || (selectedBranch === 'LAK8' && !lak8OwnerBranch)}
                className={`w-full text-white py-4 rounded-2xl font-black text-lg shadow-xl disabled:opacity-50 transition-all active:scale-95 cursor-pointer ${selectedBrand === 'technohub'
                    ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
              >
                ຢືນຢັນການເລີ່ມຕົ້ນ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`rounded-2xl p-4 shadow-2xl border-2 flex items-start gap-4 backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
            toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' :
              'bg-blue-500/90 border-blue-400 text-white'
            }`}>
            <div className="bg-white/20 p-2 rounded-xl shrink-0">
              {toast.type === 'success' ? <CheckCircle2 size={24} /> :
                toast.type === 'error' ? <AlertCircle size={24} /> :
                  <Sparkles size={24} />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-base leading-tight">{toast.title}</h3>
              <p className="text-sm font-medium opacity-90 mt-0.5">{toast.message}</p>
            </div>
            <button onClick={() => setToast(null)} className="p-1 hover:bg-white/20 rounded-lg text-white/80 shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold">Import Excel</h3>
              <button onClick={() => !isImporting && setShowImportModal(false)}><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100 mb-2">
                <p className="text-xs font-bold text-indigo-700">ກຳລັງນຳເຂົ້າສູ່:</p>
                <p className="text-sm font-black text-indigo-900">{selectedBranch} | {selectedDate}</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Barcode Column</label>
                <select className="w-full border rounded-lg p-2 text-sm" value={columnMapping.barcode} onChange={e => setColumnMapping(p => ({ ...p, barcode: e.target.value }))}>
                  <option value="">Select...</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500">Qty Column</label>
                <select className="w-full border rounded-lg p-2 text-sm" value={columnMapping.qty} onChange={e => setColumnMapping(p => ({ ...p, qty: e.target.value }))}>
                  <option value="">Select...</option>
                  {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              {isImporting && (
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-blue-600 h-full" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} />
                </div>
              )}
              <button disabled={isImporting || !columnMapping.barcode || !columnMapping.qty} onClick={handleImportData} className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold disabled:opacity-50">
                {isImporting ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className={`sticky top-0 z-30 text-white shadow-lg transition-all duration-300 ${selectedBrand === 'technohub'
          ? 'bg-gradient-to-r from-slate-900 via-sky-900 to-blue-950 border-b border-sky-500/30'
          : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600'
        }`}>
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 cursor-pointer">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">📦DC TO STORE DELIVERY CHECK</h1>
                {/* Brand badge with switch button */}
                <button
                  onClick={() => {
                    localStorage.removeItem('lak8_brand');
                    setSelectedBrand(null);
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 bg-white/20 hover:bg-white/30 rounded-lg border border-white/30 transition-all cursor-pointer"
                  title="ຍ້ອນກັບ"
                >
                  {selectedBrand === 'joah' ? (
                    <img src={joahLogo} alt="Joah" className="w-5 h-5 rounded object-cover" />
                  ) : (
                    <img src={technoHubLogo} alt="TechnoHub" className="w-5 h-5 rounded bg-white object-contain p-0.5" />
                  )}
                  <span className="text-[10px] font-bold uppercase">{selectedBrand === 'joah' ? 'Joah' : 'TechnoHub'}</span>
                  <X size={10} className="opacity-60" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border border-white/20">
                  {selectedBranch || '...'}
                </span>
                <span className="text-[10px] text-white/80 font-medium">
                  {selectedDate || '...'}
                </span>

                {/* Status Toggle Button */}
                <button
                  onClick={toggleSessionStatus}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 transition-all shadow-sm cursor-pointer ${sessionStatus === 'completed'
                      ? 'bg-emerald-400 text-emerald-950 border border-emerald-300'
                      : 'bg-amber-400 text-amber-950 border border-amber-300'
                    }`}
                  title="ກົດເພື່ອປ່ຽນສະຖານະ"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${sessionStatus === 'completed' ? 'bg-emerald-950' : 'bg-amber-950 animate-ping'}`}></span>
                  {sessionStatus === 'completed' ? 'ນັບສຳເລັດແລ້ວ' : 'ກຳລັງນັບ...'}
                </button>

                {/* Session Details Button */}
                <button
                  onClick={() => setShowDetailModal(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/20"
                  title="ເບິ່ງລາຍລະອຽດ"
                >
                  ℹ️ ລາຍລະອຽດ
                </button>

                {/* Event Modal Button */}
                <button
                  onClick={() => setShowEventModal(true)}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border border-white/20"
                  title="ບັນທຶກເຫດການ"
                >
                  📝 ເຫດການ {events.length > 0 && <span className="bg-purple-300 text-purple-950 px-1 rounded-full text-[9px] font-black">{events.length}</span>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFilterMode(!isFilterMode)}
              className={`p-2 rounded-lg transition-colors ${isFilterMode ? 'bg-yellow-400 text-indigo-900' : 'bg-white/10 hover:bg-white/20'}`}
              title="Filter for GM"
            >
              <Filter size={18} />
            </button>

            <div className="flex items-center bg-white/10 rounded-lg p-1">
              <button onClick={handleExportExcel} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Export Excel">
                <Download size={18} />
              </button>
              <label className="p-2 hover:bg-white/20 rounded-lg transition-colors cursor-pointer" title="Import Excel">
                <Upload size={18} />
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <button onClick={handleLogoutSession} className="p-2 bg-red-500/30 hover:bg-red-500/50 rounded-lg transition-colors" title="Change Branch">
              <LogOut size={18} />
            </button>

            <div className="bg-white/20 backdrop-blur-md px-3 py-2 rounded-xl flex items-center gap-2 border border-white/30 hidden sm:flex">
              <Package size={18} className="text-yellow-200" />
              <span className="text-sm font-black font-mono">ລວມ {totalQtySum}</span>
            </div>
          </div>
        </div>
      </header>

      {/* GM FILTER BAR */}
      {isFilterMode && (
        <div className="bg-yellow-50 border-b border-yellow-200 p-3 animate-in slide-in-from-top duration-300">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-yellow-700 uppercase">GM Filter:</span>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="bg-white border-2 border-yellow-200 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:border-yellow-400"
              >
                <option value="">ທຸກສາຂາ</option>
                {branches.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-white border-2 border-yellow-200 rounded-lg px-2 py-1 text-sm font-bold outline-none focus:border-yellow-400"
              />
            </div>
            <div className="ml-auto text-xs font-bold text-yellow-800">
              ກຳລັງເບິ່ງຂໍ້ມູນຂອງ: {filterBranch || 'ທຸກສາຂາ'} | {filterDate}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">

        {/* Only show scanner if NOT in filter mode (Staff mode) */}
        {!isFilterMode ? (
          <div className="bg-white rounded-2xl p-5 shadow-md border-2 border-slate-200 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-600 flex items-center gap-2">
              <ScanLine size={18} className="text-indigo-600" />
              ເລືອກໂຫມດການສະແກນ
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setScanMode('manual')}
                className={`p-4 rounded-xl border-3 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${scanMode === 'manual'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-lg'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
              >
                <span className="text-base font-black leading-tight text-center">✏️ ພິມຈຳນວນ</span>
                <span className="text-xs opacity-75">ສະແກນ + ປ້ອນຈຳນວນ</span>
              </button>

              <button
                onClick={() => setScanMode('count')}
                className={`p-4 rounded-xl border-3 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${scanMode === 'count'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-lg'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                  }`}
              >
                <span className="text-base font-black leading-tight text-center">🔢 Count ກົງ</span>
                <span className="text-xs opacity-75">ສະແກນ +1 ທີລະຄັ້ງ</span>
              </button>
            </div>

            {scanMode === 'manual' && (
              <div className="pt-2 flex items-center gap-3 animate-in fade-in duration-200 bg-indigo-50 p-3 rounded-xl border border-indigo-200">
                <span className="text-sm font-bold text-slate-700 shrink-0">ຕັ້ງຄ່າ QTY:</span>
                <div className="flex items-center border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
                  <button onClick={() => setManualQty(Math.max(1, manualQty - 1))} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors">−</button>
                  <input type="number" value={manualQty} onChange={(e) => setManualQty(Math.max(1, Number(e.target.value)))} className="w-20 text-center font-black text-lg bg-white border-none focus:outline-none text-slate-900" />
                  <button onClick={() => setManualQty(manualQty + 1)} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors">+</button>
                </div>
              </div>
            )}

            <form onSubmit={handleBarcodeSubmit} className="space-y-3">
              <div className="relative">
                <label className="text-xs font-bold text-slate-600 block mb-2">ເລກບາໂຄດ (EAN-13)</label>
                <div className="relative flex items-center">
                  <Barcode size={20} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    readOnly={isCameraActive || isSubmittingBarcode}
                    inputMode={isCameraActive ? 'none' : 'numeric'}
                    placeholder={isCameraActive ? "ກ້ອງສະແກນກຳລັງທຳງານ..." : "ສະແກນ ຫຼື ພິມເລກບາໂຄດ..."}
                    className="w-full bg-white border-2 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl py-3 px-4 pl-11 text-base font-bold font-mono text-slate-900 placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCameraActive(!isCameraActive)}
                  disabled={isSubmittingBarcode}
                  className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border-2 ${isCameraActive ? 'bg-red-500 text-white border-red-600' : 'bg-emerald-500 text-white border-emerald-600 shadow-lg'}`}
                >
                  <Camera size={18} />
                  <span>{isCameraActive ? 'ປິດກ້ອງ' : 'ເປີດກ້ອງ'}</span>
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingBarcode || !barcodeInput.trim()}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isSubmittingBarcode ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
                  <span>{isSubmittingBarcode ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນ'}</span>
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-yellow-100/50 border-2 border-yellow-200 rounded-2xl p-6 text-center">
            <div className="w-16 h-16 bg-yellow-200 text-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Filter size={32} />
            </div>
            <h3 className="text-xl font-black text-yellow-800">ໂຫມດເບິ່ງຂໍ້ມູນ (GM Mode)</h3>
            <p className="text-yellow-700 font-medium mt-1">ທ່ານກຳລັງເບິ່ງລາຍການທີ່ນັບແລ້ວ ໂດຍສາມາດເລືອກສາຂາ ແລະ ວັນທີໄດ້ຢູ່ດ້ານເທິງ</p>
          </div>
        )}

        {/* CAMERA VIEWPORT */}
        {isCameraActive && (
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-emerald-500 relative aspect-video">
            <div id="lak8-reader" className="w-full h-full"></div>
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 flex items-center justify-center">
              <div className="w-64 h-32 border-2 border-emerald-400 rounded-lg relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 -translate-x-1 -translate-y-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 translate-x-1 -translate-y-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 -translate-x-1 translate-y-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 translate-x-1 translate-y-1"></div>
                <div className="absolute top-1/2 left-0 w-full h-0.5 bg-emerald-400/50 animate-pulse"></div>
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-full text-white text-[10px] font-bold flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
              ວາງບາໂຄດໃຫ້ກົງກັບກອບ
            </div>
          </div>
        )}

        {/* LIST SECTION */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Layers size={20} className="text-indigo-600" />
                ລາຍການທີ່ນັບແລ້ວ
              </h2>
              <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                {filteredItems.length} ລາຍການ
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="ຄົ້ນຫາ..."
                  className="pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold focus:outline-none focus:border-indigo-500 w-32 sm:w-48 transition-all"
                />
                <ScanLine size={14} className="absolute left-2.5 top-2 text-slate-400" />
              </div>
              <button onClick={() => fetchLak8Stock(true)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
              <p className="text-slate-500 font-bold animate-pulse">ກຳລັງໂຫຼດຂໍ້ມູນ...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-200 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center mx-auto">
                <Barcode size={32} />
              </div>
              <h3 className="font-black text-slate-400">ຍັງບໍ່ມີຂໍ້ມູນການນັບ</h3>
              <p className="text-slate-400 text-sm font-medium">
                {searchTerm ? 'ບໍ່ພົບລາຍການທີ່ຄົ້ນຫາ' : 'ເລີ່ມສະແກນບາໂຄດເພື່ອບັນທຶກຂໍ້ມູນ'}
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredItems.map((item) => (
                <div key={item.id} className="group bg-white rounded-2xl p-4 shadow-sm border border-slate-200 hover:border-indigo-300 transition-all flex items-center gap-4 relative overflow-hidden">
                  <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors shrink-0">
                    <Barcode size={24} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-800 truncate leading-tight">{item.name}</h3>
                      <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black px-1.5 py-0.5 rounded uppercase shrink-0">
                        {item.branch}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs font-mono font-bold text-slate-400">{item.barcode}</p>
                      {item.branch === 'LAK8' && item.owner_branch && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 rounded-sm font-bold border border-purple-200">
                          👉 {item.owner_branch}
                        </span>
                      )}
                    </div>
                    {item.branch === 'LAK8' && item.doc_nos && item.doc_nos.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.doc_nos.map((doc, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-100 text-slate-500 px-1 rounded border border-slate-200 font-mono">
                            {doc}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <Clock size={10} /> {item.timestamp}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                        <User size={10} /> {item.createdBy}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => updateItemQty(item.id, item.qty, -1)}
                      disabled={isUpdatingQty[item.id] || isFilterMode}
                      className="w-8 h-8 flex items-center justify-center bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-lg transition-all shadow-sm active:scale-90 disabled:opacity-50"
                    >
                      <Minus size={16} />
                    </button>
                    <div className="w-10 text-center">
                      {isUpdatingQty[item.id] ? (
                        <Loader size={14} className="animate-spin mx-auto text-indigo-600" />
                      ) : (
                        <span className="text-base font-black font-mono text-slate-900">{item.qty}</span>
                      )}
                    </div>
                    <button
                      onClick={() => updateItemQty(item.id, item.qty, 1)}
                      disabled={isUpdatingQty[item.id] || isFilterMode}
                      className="w-8 h-8 flex items-center justify-center bg-white hover:bg-emerald-50 text-slate-600 hover:text-emerald-600 rounded-lg transition-all shadow-sm active:scale-90 disabled:opacity-50"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    disabled={isDeletingBarcode[item.id] || isFilterMode}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {isDeletingBarcode[item.id] ? <Loader size={16} className="animate-spin" /> : <Trash2 size={18} />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SESSION DETAIL MODAL */}
      {showDetailModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-lg">
                    📊
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-slate-800">ລາຍລະອຽດເຊັດຊັນການນັບ</h3>
                    <p className="text-xs text-slate-400 font-medium">ຂໍ້ມູນສະຫຼຸບ ແລະ ສະຖານະປະຈຸບັນ</p>
                  </div>
                </div>
                <button onClick={() => setShowDetailModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">ສະຖານະ (Status)</span>
                  <button
                    onClick={toggleSessionStatus}
                    className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm ${sessionStatus === 'completed'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-amber-500 text-white'
                      }`}
                  >
                    <span>{sessionStatus === 'completed' ? '✅ ນັບສຳເລັດແລ້ວ (Completed)' : '⏳ ກຳລັງນັບ... (In Progress)'}</span>
                  </button>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">ສາຂາຫຼັກ (Main Branch)</span>
                  <span className="font-black text-slate-800">{selectedBranch}</span>
                </div>

                {selectedBranch === 'LAK8' && (
                  <div className="flex justify-between items-center bg-indigo-50/70 p-3 rounded-xl border border-indigo-100">
                    <span className="font-bold text-indigo-600 text-xs">ສາຂາເຈົ້າຂອງສິນຄ້າ (Owner Branch)</span>
                    <span className="font-black text-indigo-900 bg-indigo-200 px-2 py-0.5 rounded-lg text-xs">{lak8OwnerBranch || 'ຍັງບໍ່ໄດ້ລະບຸ'}</span>
                  </div>
                )}

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">ວັນທີນັບ (Date)</span>
                  <span className="font-bold text-slate-800 font-mono">{selectedDate}</span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-2">
                  <span className="font-bold text-slate-500 text-xs block">ລາຍການບິນທີ່ກ່ຽວຂ້ອງ (Doc Nos)</span>
                  {docNos && docNos.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {docNos.map((doc, idx) => (
                        <span key={idx} className="bg-white border border-indigo-200 text-indigo-700 text-xs font-bold font-mono px-2.5 py-1 rounded-lg shadow-sm">
                          📄 {doc}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">ບໍ່ມີຂໍ້ມູນເລກບິນ</p>
                  )}
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="font-bold text-slate-500 text-xs">ຈຳນວນລວມ (Total Qty / Items)</span>
                  <span className="font-black text-indigo-600 font-mono text-base">{totalQtySum} Qty ({filteredItems.length} ລາຍການ)</span>
                </div>

                <div className="bg-purple-50/70 p-3 rounded-xl border border-purple-100 space-y-2">
                  <span className="font-bold text-purple-700 text-xs block">ເຫດການ/ອຸປະກອນທີ່ບັນທຶກ ({events.length})</span>
                  {events && events.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {events.map((evt, idx) => (
                        <div key={idx} className="bg-white p-2 rounded-lg border border-purple-100 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700 truncate">{evt.title}</span>
                          <span className="font-black text-purple-600 font-mono shrink-0 ml-2">x{evt.qty}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">ບໍ່ມີເຫດການທີ່ຖືກບັນທຶກ</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-2xl transition-all"
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED EVENT MODAL */}
      {showEventModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center font-bold text-lg">
                  📝
                </div>
                <div>
                  <h3 className="font-black text-lg text-slate-800">ບັນທຶກເຫດການ / ອຸປະກອນ (Event Log)</h3>
                  <p className="text-xs text-slate-400 font-medium">ບັນທຶກຂໍ້ມູນອຸປະກອນ ຫຼື ເຫດການປະຈຳວັນ</p>
                </div>
              </div>
              <button onClick={() => setShowEventModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              {!isFilterMode && (
                <form onSubmit={handleSaveEvent} className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-3">
                  <h4 className="font-black text-xs uppercase tracking-wider text-purple-800">+ ເພີ່ມເຫດການໃໝ່</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-bold text-slate-500 mb-1 block">ລາຍລະອຽດເຫດການ / ອຸປະກອນ</label>
                      <input
                        type="text"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="ເຊັ່ນ: ສົ່ງກ່ອງ, ອຸປະກອນຊຳຣຸດ..."
                        className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-purple-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">ຈຳນວນ (Qty)</label>
                      <input
                        type="number"
                        min="1"
                        value={eventQty}
                        onChange={(e) => setEventQty(e.target.value)}
                        className="w-full bg-white border border-purple-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-purple-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3">
                      <label className="px-3 py-2 bg-white border border-purple-200 hover:bg-purple-100 rounded-xl text-xs font-bold text-purple-700 cursor-pointer flex items-center gap-2 transition-all">
                        <Camera size={16} />
                        <span>{eventImage ? 'ປ່ຽນຮູບ' : 'ແນບຮູບພາບ'}</span>
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                      {eventImage && (
                        <div className="relative group">
                          <img src={eventImage} alt="Event Preview" className="w-10 h-10 object-cover rounded-lg border border-purple-300" />
                          <button
                            type="button"
                            onClick={() => setEventImage(null)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmittingEvent || !eventTitle.trim()}
                      className="w-full sm:w-auto px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingEvent ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
                      <span>ບັນທຶກເຫດການ</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400">ລາຍການທີ່ບັນທຶກແລ້ວ ({events.length})</h4>
                {events.length === 0 ? (
                  <p className="text-xs text-slate-400 italic text-center py-6">ບໍ່ມີເຫດການທີ່ຖືກບັນທຶກໃນມື້ນີ້</p>
                ) : (
                  <div className="space-y-2">
                    {events.map((evt, idx) => (
                      <div key={evt.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex gap-3 items-start group">
                        {evt.image_url ? (
                          <button
                            type="button"
                            onClick={() => setLightboxImage(evt.image_url)}
                            className="w-14 h-14 shrink-0 rounded-xl border border-slate-300 overflow-hidden cursor-zoom-in hover:ring-2 hover:ring-purple-400 transition-all"
                            title="ກົດເພື່ອດູຮູບใຫຍ່"
                          >
                            <img src={evt.image_url} alt="Event" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-xl shrink-0 font-bold">
                            📦
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-sm text-slate-800 truncate">{evt.title}</h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="bg-purple-100 text-purple-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                                x{evt.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteEvent(evt.id)}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded-lg"
                                title="ລຶບເຫດການ"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-3">
                            <span>👤 {evt.created_by || 'Staff'}</span>
                            <span>🕒 {new Date(evt.created_at).toLocaleTimeString('lo-LA')}</span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 shrink-0">
              <button
                onClick={() => setShowEventModal(false)}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-2xl transition-all cursor-pointer"
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        </div>
      )}
      {/* LIGHTBOX */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-sm cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] w-full p-4" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute -top-1 -right-1 z-10 bg-white/20 hover:bg-white/40 text-white rounded-full p-2 transition-all"
            >
              <X size={22} />
            </button>
            <img
              src={lightboxImage}
              alt="Event Full"
              className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
}
