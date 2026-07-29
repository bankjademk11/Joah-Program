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
  User
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';

export default function StockCountLak8({ onBack, masterData = [], currentUser }) {
  // ─── States ────────────────────────────────────────────────────────
  const [scanMode, setScanMode] = useState('count'); // 'manual' | 'count' | 'search'
  const [manualQty, setManualQty] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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

  // Derived filtered items for search
  const filteredItems = searchTerm
    ? items.filter(item => {
      const term = searchTerm.toLowerCase();
      return item.barcode?.toLowerCase().includes(term) || item.name?.toLowerCase().includes(term);
    })
    : items;

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
      const { data, error } = await supabase
        .from('stock_count_lak8')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const formatted = data.map(item => ({
          id: item.id,
          barcode: item.barcode,
          name: getProductName(item.barcode) || `ສິນຄ້າບາໂຄດ ${item.barcode}`,
          qty: Number(item.qty) || 0,
          createdBy: item.created_by || 'Unknown',
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
    fetchLak8Stock();

    // ⚡ SUPABASE REALTIME SUBSCRIPTION - IMPROVED
    const channel = supabase
      .channel('stock_count_lak8_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_count_lak8' },
        (payload) => {
          console.log('[Supabase Realtime Event Received]', payload);

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
  }, []);

  // ─── HARDWARE VOLUME BUTTON TRIGGER ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'F1', 'F2', 'F12'].includes(e.key) || e.code?.includes('Volume')) {
        e.preventDefault();

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
  }, []);

  // Auto focus ONLY when camera is OFF
  useEffect(() => {
    if (!isCameraActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCameraActive, scanMode]);

  // ─── CAMERA SCANNER WITH STRICT 13-DIGIT FORMAT & DEBOUNCE ──────
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

                    const existing = (itemsRef.current || []).find(i => String(i.barcode).trim() === cleanCode);
                    const targetQty = (existing ? Number(existing.qty) || 0 : 0) + 1;

                    setDebugLog({
                      lastTrigger: new Date().toLocaleTimeString('lo-LA'),
                      triggerType: 'CAMERA 📷',
                      lastCode: cleanCode,
                      status: `COUNT: ${cleanCode} ➔ ${targetQty} QTY`
                    });

                    isProcessingRef.current = true;
                    processScanCode(cleanCode, false).finally(() => {
                      isProcessingRef.current = false;
                    });
                  },
                  () => { }
                ).catch(err => {
                  console.error('Camera start error:', err);
                  setDebugLog(prev => ({ ...prev, status: 'CAM ERROR: ' + (err.message || err) }));
                });
              });
            }, 200);
          })
          .catch((err) => {
            console.error('Camera permission denied:', err);
            alert('ກະລຸນາອະນຸຍາດການໃຊ້ກ້ອງ (Camera Permission) ໃນເບຣົາເຊີຂອງທ່ານ!');
            setIsCameraActive(false);
            setCameraPermState('idle');
          });
      }
    }

    return () => {
      isMounted = false;

      const stopAndClear = (scanner) => {
        if (!scanner) return;
        scanner.stop()
          .then(() => scanner.clear())
          .catch((err) => {
            console.warn('[Lak8 Camera] stop() failed, stream may still be active:', err);
          });
      };

      if (html5Scanner) {
        if (html5Scanner.isScanning) {
          stopAndClear(html5Scanner);
        } else if (startPromise) {
          startPromise
            .then(() => stopAndClear(html5Scanner))
            .catch(() => { });
        }
      }
    };
  }, [isCameraActive]);

  // Helper search master name
  const getProductName = (barcode) => {
    if (!masterData || masterData.length === 0) return null;
    const found = masterData.find(m => m.barcode === barcode || m.item_code === barcode);
    return found?.name || found?.item_name || null;
  };

  // ─── 2. PROCESS SCAN & UPSERT TO SUPABASE (IMPROVED WITH RPC) ─────
  const processScanCode = async (codeToScan, clearInput = true) => {
    const code = codeToScan.trim();
    if (!code) return;

    if (!/^\d{13}$/.test(code)) {
      if (clearInput) {
        showToast({
          type: 'error',
          title: 'ເລກບາໂຄດບໍ່ຖືກຕ້ອງ! ❌',
          message: 'ລະບົບຮອງຮັບສະເພາະບາໂຄດຕົວເລກ 13 ຫຼັກເທົ່ານັ້ນ (EAN-13)'
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
        user_id: empId
      });

      if (error) throw error;

      const currentList = itemsRef.current || [];
      const existingItem = currentList.find(item => String(item.barcode).trim() === code);
      const prevQty = existingItem ? Number(existingItem.qty) || 0 : 0;
      const newQty = prevQty + addAmount;
      const productName = getProductName(code) || `ສິນຄ້າບາໂຄດ ${code}`;

      showToast({
        type: existingItem ? 'success' : 'info',
        title: existingItem ? 'ເພີ່ມ QTY ສຳເລັດ! ➕' : 'ພົບເລກບາໂຄດໃໝ່! ✨',
        message: `${productName}`,
        barcode: code,
        prevQty: prevQty,
        newQty: newQty
      });

    } catch (err) {
      console.error('[Lak8 Upsert Error]', err);
      showToast({
        type: 'error',
        title: 'ຂໍ້ຜິດພາດ!',
        message: err.message || 'ບໍ່ສາມາດບັນທຶກຂໍ້ມູນໄດ້'
      });
    } finally {
      setIsSubmittingBarcode(false);
      if (clearInput) {
        setBarcodeInput('');
      }
    }
  };

  const handleBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    if (!isSubmittingBarcode && barcodeInput.trim()) {
      processScanCode(barcodeInput);
    }
  };

  // ─── 3. UPDATE ITEM QTY ──────────────────────────────────────────
  const updateItemQty = async (id, barcode, targetQty) => {
    const nextQty = Math.max(1, targetQty);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    setIsUpdatingQty(prev => ({ ...prev, [barcode]: true }));

    try {
      const { error } = await supabase
        .from('stock_count_lak8')
        .update({ qty: nextQty, created_by: empId, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setItems(items.map(item => item.id === id ? { ...item, qty: nextQty, timestamp: new Date().toLocaleTimeString('lo-LA') } : item));
    } catch (err) {
      console.error('[Lak8 Update Error]', err);
      showToast({
        type: 'error',
        title: 'ຂໍ້ຜິດພາດ!',
        message: 'ບໍ່ສາມາດອັปເດតຈຳນວນໄດ້'
      });
    } finally {
      setIsUpdatingQty(prev => ({ ...prev, [barcode]: false }));
    }
  };

  // ─── 4. REMOVE ITEM ──────────────────────────────────────────────
  const removeItem = async (id, barcode) => {
    if (!confirm('ທ່ານຕ້ອງການລຶບລາຍການນີ້ຫຼືບໍ່?')) return;

    setIsDeletingBarcode(prev => ({ ...prev, [barcode]: true }));

    try {
      const { error } = await supabase
        .from('stock_count_lak8')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setItems(items.filter(item => item.id !== id));
      showToast({
        type: 'success',
        title: 'ລຶບສຳເລັດ! ✓',
        message: 'ລາຍການຖືກລຶບອອກແລ້ວ'
      });
    } catch (err) {
      console.error('[Lak8 Delete Error]', err);
      showToast({
        type: 'error',
        title: 'ຂໍ້ຜິດພາດ!',
        message: 'ບໍ່ສາມາດລຶບລາຍການໄດ້'
      });
    } finally {
      setIsDeletingBarcode(prev => ({ ...prev, [barcode]: false }));
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100 pb-20 select-none"
      style={{ fontFamily: "'Noto Sans Lao', 'Inter', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700;800;900&display=swap');
        .font-lao { fontFamily: 'Noto Sans Lao', sans-serif; }
        .text-input-focus {
          color: #1e293b;
          background-color: #ffffff;
        }
      `}</style>

      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-sm animate-in slide-in-from-top-4 duration-300">
          <div className={`p-4 rounded-2xl shadow-2xl backdrop-blur-lg border-2 flex items-start gap-3 ${toast.type === 'error'
            ? 'bg-red-500/95 border-red-300 text-white'
            : toast.type === 'info'
              ? 'bg-amber-500/95 border-amber-300 text-white'
              : 'bg-emerald-500/95 border-emerald-300 text-white'
            }`}>
            <div className="shrink-0 pt-0.5">
              {toast.type === 'error' ? (
                <AlertCircle size={24} className="text-white" />
              ) : (
                <CheckCircle2 size={24} className="text-white animate-bounce" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-black text-sm leading-tight">{toast.title}</h4>
              <p className="text-xs text-white/95 font-medium mt-1">{toast.message}</p>
              {toast.barcode && (
                <div className="flex items-center gap-2 mt-2 text-xs font-mono font-bold bg-black/20 px-2.5 py-1 rounded-lg w-fit">
                  <span className="text-white">{toast.barcode}</span>
                  <span className="text-white/70">→</span>
                  <span className="text-yellow-200">{toast.prevQty} → {toast.newQty}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg text-white/80 shrink-0"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-30 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                📦 ລະບົບນັບສິນຄ້າ Lak 8
              </h1>
              <p className="text-xs text-white/80 font-medium mt-0.5">
                Stock Count System — Warehouse Management
              </p>
            </div>
          </div>

          <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl flex items-center gap-2 border border-white/30">
            <Package size={18} className="text-yellow-200" />
            <span className="text-sm font-black font-mono">ລວມ {totalQtySum} QTY</span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <div className="max-w-5xl mx-auto px-3 sm:px-4 py-6 space-y-6">

        {/* SCAN MODE SELECTOR */}
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
              {scanMode === 'manual' && (
                <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-indigo-600 animate-pulse" />
              )}
              <span className="text-base font-black leading-tight text-center">
                ✏️ ພິມຈຳນວນ
              </span>
              <span className="text-xs opacity-75">ສະແກນ + ປ້ອນຈຳນວນ</span>
            </button>

            <button
              onClick={() => setScanMode('count')}
              className={`p-4 rounded-xl border-3 font-bold text-sm flex flex-col items-center justify-center gap-2 transition-all cursor-pointer relative overflow-hidden ${scanMode === 'count'
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-lg'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
            >
              {scanMode === 'count' && (
                <span className="absolute top-2 right-2 w-3 h-3 rounded-full bg-emerald-600 animate-pulse" />
              )}
              <span className="text-base font-black leading-tight text-center">
                🔢 Count ກົງ
              </span>
              <span className="text-xs opacity-75">ສະແກນ +1 ທີລະຄັ້ງ</span>
            </button>
          </div>

          {scanMode === 'manual' && (
            <div className="pt-2 flex items-center gap-3 animate-in fade-in duration-200 bg-indigo-50 p-3 rounded-xl border border-indigo-200">
              <span className="text-sm font-bold text-slate-700 shrink-0">ຕັ້ງຄ່າ QTY:</span>
              <div className="flex items-center border-2 border-slate-300 rounded-lg overflow-hidden bg-white">
                <button
                  onClick={() => setManualQty(Math.max(1, manualQty - 1))}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
                >
                  −
                </button>
                <input
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(Math.max(1, Number(e.target.value)))}
                  className="w-20 text-center font-black text-lg bg-white border-none focus:outline-none text-slate-900"
                />
                <button
                  onClick={() => setManualQty(manualQty + 1)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* SCAN INPUT FIELD */}
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
                  className="w-full bg-white border-2 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-xl py-3 px-4 pl-11 text-base font-bold font-mono text-slate-900 placeholder-slate-500 focus:outline-none transition-all disabled:opacity-60 disabled:bg-slate-100"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isCameraActive) {
                    setIsCameraActive(false);
                    setCameraPermState('idle');
                  } else {
                    setCameraPermState('asking');
                  }
                }}
                disabled={isSubmittingBarcode}
                className={`flex-1 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all border-2 disabled:opacity-60 ${isCameraActive
                  ? 'bg-red-500 text-white border-red-600 hover:bg-red-600'
                  : 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600 shadow-lg'
                  }`}
              >
                <Camera size={18} />
                <span>{isCameraActive ? 'ປິດກ້ອງ' : 'ເປີດກ້ອງ'}</span>
              </button>

              <button
                type="submit"
                disabled={isSubmittingBarcode || !barcodeInput.trim()}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmittingBarcode ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>ກຳລັງບັນທຶກ...</span>
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    <span>ຢືນຢັນ</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* PERMISSION PROMPT SCREEN */}
          {cameraPermState === 'asking' && !isCameraActive && (
            <div className="mt-4 bg-gradient-to-br from-slate-900 to-slate-800 border-2 border-emerald-500 rounded-2xl p-5 text-white space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border-2 border-emerald-500/50">
                  <Camera size={28} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-base">ຂໍອະນຸຍາດໃຊ້ກ້ອງ</h3>
                  <p className="text-xs text-slate-300 mt-1">ລະບົບຕ້ອງການເຂົ້າໃຊ້ກ້ອງ ເພື່ອສະແກນບາໂຄດສິນຄ້າ</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => setCameraPermState('idle')}
                  className="py-3 bg-slate-700 hover:bg-slate-600 active:scale-95 text-white font-bold text-sm rounded-lg transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  onClick={() => {
                    setCameraPermState('granted');
                    setIsCameraActive(true);
                  }}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg"
                >
                  <Camera size={16} />
                  ອະນຸຍາດ
                </button>
              </div>
            </div>
          )}

          {/* CAMERA PREVIEW CONTAINER */}
          {isCameraActive && (
            <div className="mt-4 p-4 bg-slate-900 rounded-2xl text-white space-y-3 border-2 border-slate-700 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>ກ້ອງສະແກນບາໂຄດກຳລັງທຳງານ...</span>
                </div>
                <button
                  onClick={() => setIsCameraActive(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 transition-colors"
                >
                  ✕ ປິດ
                </button>
              </div>

              <div
                id="lak8-reader"
                className="w-full overflow-hidden rounded-xl bg-black min-h-[240px]"
              />
            </div>
          )}
        </div>

        {/* ITEMS LIST */}
        <div className="bg-white rounded-2xl shadow-md border-2 border-slate-200 overflow-hidden">
          {/* LIST HEADER */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 px-5 py-4 border-b-2 border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Package size={24} className="text-indigo-600" />
              <div>
                <h2 className="text-lg font-black text-slate-900">
                  ລາຍການສິນຄ້າ
                </h2>
                <p className="text-xs text-slate-600 font-medium">{items.length} ລາຍການ</p>
              </div>
            </div>

            <button
              onClick={() => fetchLak8Stock()}
              disabled={isLoading}
              className="text-sm font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 border-2 border-slate-300 px-4 py-2 rounded-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              ໂຫຼດໃໝ່
            </button>
          </div>

          {/* SEARCH BOX */}
          <div className="px-5 py-4 border-b-2 border-slate-200 bg-slate-50">
            <div className="relative">
              <ScanLine size={18} className="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                placeholder="ຄົ້ນຫາບາໂຄດ ຫຼື ຊື່ສິນຄ້າ..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border-2 border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 rounded-lg py-2.5 px-4 pl-11 text-sm font-bold text-slate-900 placeholder-slate-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* ITEMS CONTAINER */}
          <div className="max-h-[600px] overflow-y-auto divide-y-2 divide-slate-200">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500 space-y-3 px-5">
                <RefreshCw size={40} className="mx-auto animate-spin text-indigo-600" />
                <p className="font-bold text-sm text-slate-700">ກຳລັງໂຫຼດຂໍ້ມູນ...</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 space-y-3 px-5">
                <Package size={48} className="mx-auto opacity-30" />
                <p className="font-bold text-sm text-slate-600">ບໍ່ພົບລາຍການ</p>
                <p className="text-xs text-slate-500">ລອງຄົ້ນຫາໃໝ່ ຫຼື ຍິງບາໂຄດເພື່ອເພີ່ມສິນຄ້າ</p>
              </div>
            ) : (
              filteredItems.slice(0, 100).map((item, index) => (
                <div
                  key={item.id}
                  className={`px-5 py-4 flex items-center justify-between gap-4 hover:bg-blue-50 transition-colors ${index === 0 && !searchTerm ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''
                    }`}
                >
                  {/* LEFT: Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono font-black text-xs bg-slate-900 text-amber-300 px-2.5 py-1 rounded-lg shrink-0">
                        {item.barcode}
                      </span>
                      <p className="font-black text-sm text-slate-900 truncate">
                        {item.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600 font-medium">
                      <div className="flex items-center gap-1">
                        <Clock size={14} className="text-slate-400" />
                        <span>{item.timestamp}</span>
                      </div>
                      {item.createdBy && (
                        <div className="flex items-center gap-1">
                          <User size={14} className="text-slate-400" />
                          <span>{item.createdBy}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT: QTY Controls */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* QTY Adjuster */}
                    <div className="flex items-center bg-slate-100 rounded-lg border-2 border-slate-300 overflow-hidden">
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty - 1)}
                        disabled={isUpdatingQty[item.barcode] || item.qty <= 1}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-red-100 text-slate-900 hover:text-red-700 font-black text-lg transition-colors disabled:opacity-50 cursor-pointer"
                        title="ຫຼຸດ"
                      >
                        −
                      </button>
                      <div className="px-3 py-1 bg-white min-w-[50px] text-center">
                        {isUpdatingQty[item.barcode] ? (
                          <Loader size={16} className="animate-spin mx-auto text-indigo-600" />
                        ) : (
                          <span className="font-black text-lg text-indigo-600">{item.qty}</span>
                        )}
                      </div>
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty + 1)}
                        disabled={isUpdatingQty[item.barcode]}
                        className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-emerald-100 text-slate-900 hover:text-emerald-700 font-black text-lg transition-colors disabled:opacity-50 cursor-pointer"
                        title="ເພີ່ມ"
                      >
                        +
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => removeItem(item.id, item.barcode)}
                      disabled={isDeletingBarcode[item.barcode]}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="ລຶບ"
                    >
                      {isDeletingBarcode[item.barcode] ? (
                        <Loader size={18} className="animate-spin" />
                      ) : (
                        <Trash2 size={18} />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
