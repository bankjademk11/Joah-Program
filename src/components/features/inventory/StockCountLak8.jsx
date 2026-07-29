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
  const [showSetupModal, setShowSetupModal] = useState(!localStorage.getItem('lak8_branch'));

  // Filter for GM
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFilterMode, setIsFilterMode] = useState(false);

  const branches = ['VX', 'SVL', 'TLL', 'MGM', 'PSN'];

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
  const fetchLak8Stock = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);

      // Use filter values if in filter mode, otherwise use current session values
      const targetBranch = isFilterMode ? filterBranch : selectedBranch;
      const targetDate = isFilterMode ? filterDate : selectedDate;

      let query = supabase.from('stock_count_lak8').select('*');

      if (targetBranch) query = query.eq('branch', targetBranch);
      if (targetDate) query = query.eq('count_date', targetDate);

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          barcode: item.barcode,
          name: getProductName(item.barcode) || `ສິນຄ້າບາໂຄດ ${item.barcode}`,
          qty: Number(item.qty) || 0,
          createdBy: item.created_by || 'Unknown',
          branch: item.branch,
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

  useEffect(() => {
    if (selectedBranch && selectedDate) {
      fetchLak8Stock();
    }
  }, [selectedBranch, selectedDate, isFilterMode, filterBranch, filterDate]);

  useEffect(() => {
    // ⚡ SUPABASE REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('stock_count_lak8_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_count_lak8' },
        (payload) => {
          // Only update if it matches current view criteria
          const targetBranch = isFilterMode ? filterBranch : selectedBranch;
          const targetDate = isFilterMode ? filterDate : selectedDate;

          const itemBranch = payload.new?.branch || payload.old?.branch;
          const itemDate = payload.new?.count_date || payload.old?.count_date;

          if (targetBranch && itemBranch !== targetBranch) return;
          if (targetDate && itemDate !== targetDate) return;

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedBranch, selectedDate, isFilterMode, filterBranch, filterDate]);

  // ─── Setup Session ────────────────────────────────────────────────
  const handleConfirmSetup = () => {
    if (!selectedBranch || !selectedDate) {
      alert('ກະລຸນາເລືອກສາຂາ ແລະ ວັນທີກ່ອນ!');
      return;
    }
    localStorage.setItem('lak8_branch', selectedBranch);
    localStorage.setItem('lak8_date', selectedDate);
    setShowSetupModal(false);
    fetchLak8Stock();
  };

  const handleLogoutSession = () => {
    if (window.confirm('ທ່ານຕ້ອງການອອກຈາກເຊດຊັນການນັບນີ້ບໍ?')) {
      localStorage.removeItem('lak8_branch');
      localStorage.removeItem('lak8_date');
      setSelectedBranch('');
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
      const { error } = await supabase.rpc('increment_stock', {
        target_barcode: code,
        amount: addAmount,
        user_id: empId,
        target_branch: selectedBranch,
        target_date: selectedDate
      });

      if (error) throw error;

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
      showToast({ type: 'success', title: 'ລຶບສຳເລັດ', message: 'ລາຍການຖືກລຶບອອກແລ້ວ' });
    } catch (err) {
      showToast({ type: 'error', title: 'ຜິດພາດ!', message: 'ບໍ່ສາມາດລຶບໄດ້' });
    } finally {
      setIsDeletingBarcode(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleExportExcel = () => {
    const exportData = items.map(item => ({
      'Barcode': item.barcode,
      'Product Name': item.name,
      'Quantity': item.qty,
      'Branch': item.branch,
      'Date': item.countDate,
      'Staff': item.createdBy,
      'Last Update': item.timestamp
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'StockCount');
    XLSX.writeFile(wb, `StockCount_Lak8_${selectedBranch}_${selectedDate}.xlsx`);
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
        await supabase.rpc('increment_stock', {
          target_barcode: bc,
          amount: q,
          user_id: empId,
          target_branch: selectedBranch,
          target_date: selectedDate
        });
      }
      setImportProgress(p => ({ ...p, current: i + 1 }));
    }
    setIsImporting(false);
    setShowImportModal(false);
    fetchLak8Stock();
    showToast({ type: 'success', title: 'ນຳເຂົ້າສຳເລັດ', message: `ນຳເຂົ້າຂໍ້ມູນຮຽບຮ້ອຍແລ້ວ` });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      {/* SETUP MODAL (FIRST ENTRY) */}
      {showSetupModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Building2 size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-800">ເລີ່ມຕົ້ນການນັບສິນຄ້າ</h2>
                <p className="text-slate-500 font-medium">ກະລຸນາເລືອກສາຂາ ແລະ ວັນທີທີ່ທ່ານຈະນັບ</p>
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
                disabled={!selectedBranch || !selectedDate}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-200 transition-all active:scale-95"
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
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 cursor-pointer">
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight">📦 Lak 8</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border border-white/20">
                  {selectedBranch || '...'}
                </span>
                <span className="text-[10px] text-white/80 font-medium">
                  {selectedDate || '...'}
                </span>
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
                    <p className="text-xs font-mono font-bold text-slate-400 mt-0.5">{item.barcode}</p>
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

      {/* FOOTER STATS */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-4 py-3 z-40 flex items-center justify-between sm:hidden">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase">Total Items</span>
          <span className="text-lg font-black text-indigo-600 leading-tight">{filteredItems.length}</span>
        </div>
        <div className="h-8 w-px bg-slate-200"></div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase">Total Qty</span>
          <span className="text-lg font-black text-indigo-600 leading-tight">{totalQtySum}</span>
        </div>
      </div>
    </div>
  );
}
