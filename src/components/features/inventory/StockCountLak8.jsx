import React, { useState, useEffect, useRef } from 'react';
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
  Check
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';

export default function StockCountLak8({ onBack, masterData = [], currentUser }) {
  // ─── States ────────────────────────────────────────────────────────
  const [scanMode, setScanMode] = useState('count'); // 'manual' | 'count'
  const [manualQty, setManualQty] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Floating Toast Notification State
  const [toast, setToast] = useState(null); // { type, title, message, barcode, prevQty, newQty }

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraPermState, setCameraPermState] = useState('idle'); // 'idle' | 'asking' | 'granted' | 'denied'
  const [debugLog, setDebugLog] = useState({
    lastTrigger: null,
    triggerType: 'NONE',
    lastCode: '-',
    status: 'READY'
  });

  const inputRef = useRef(null);
  const lastScannedBarcodeRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const itemsRef = useRef(items);

  // Synchronize itemsRef whenever items state changes
  useEffect(() => {
    itemsRef.current = items;
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
  const fetchLak8Stock = async () => {
    try {
      setIsLoading(true);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLak8Stock();

    // ⚡ SUPABASE REALTIME SUBSCRIPTION
    const channel = supabase
      .channel('stock_count_lak8_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_count_lak8' },
        (payload) => {
          console.log('[Supabase Realtime Event Received]', payload);
          fetchLak8Stock();
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

        if (barcodeInput.trim()) {
          processScanCode(barcodeInput.trim());
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeInput, scanMode, manualQty]);

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

    if (isCameraActive) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            stream.getTracks().forEach(track => track.stop());

            setTimeout(() => {
              if (!isMounted) return;
              import('html5-qrcode').then(({ Html5Qrcode, Html5QrcodeSupportedFormats }) => {
                const element = document.getElementById('lak8-reader');
                if (!element) return;

                // 🎯 STRICT 13-DIGIT EAN-13 FORMAT ONLY
                const formatsToSupport = [
                  Html5QrcodeSupportedFormats.EAN_13,
                  Html5QrcodeSupportedFormats.CODE_128
                ];

                html5Scanner = new Html5Qrcode('lak8-reader', { formatsToSupport, verbose: false });
                html5Scanner.start(
                  { facingMode: 'environment' },
                  { 
                    fps: 15, 
                    qrbox: { width: 260, height: 140 },
                    experimentalFeatures: {
                      useBarCodeDetectorIfSupported: true
                    }
                  },
                  (decodedText) => {
                    const now = Date.now();
                    const cleanCode = decodedText.trim();

                    // 🎯 STRICT REQUIREMENT: MUST BE EXACTLY 13 NUMERIC DIGITS!
                    if (!/^\d{13}$/.test(cleanCode)) {
                      return; // Reject anything that is not exactly 13 digits
                    }

                    // SMART THROTTLE: Lock duplicate scans within 1.8 seconds
                    if (
                      lastScannedBarcodeRef.current === cleanCode && 
                      (now - lastScanTimeRef.current) < 1800
                    ) {
                      return; // Throttle scan
                    }

                    lastScannedBarcodeRef.current = cleanCode;
                    lastScanTimeRef.current = now;

                    const addAmt = scanMode === 'count' ? 1 : Math.max(1, Number(manualQty) || 1);
                    const existing = (itemsRef.current || []).find(i => String(i.barcode).trim() === cleanCode);
                    const targetQty = (existing ? Number(existing.qty) || 0 : 0) + addAmt;

                    setDebugLog({
                      lastTrigger: new Date().toLocaleTimeString('lo-LA'),
                      triggerType: 'CAMERA 📷',
                      lastCode: cleanCode,
                      status: `AUTO COUNT (13 Digits): ${cleanCode} ➔ ${targetQty} QTY`
                    });

                    // Audio Beep
                    try {
                      const ctx = new (window.AudioContext || window.webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(1000, ctx.currentTime);
                      osc.connect(ctx.destination);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.12);
                    } catch (e) {}

                    // Process scan code without populating input field to avoid keyboard popup
                    processScanCode(cleanCode, false);
                  },
                  () => {}
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
      if (html5Scanner && html5Scanner.isScanning) {
        html5Scanner.stop().then(() => html5Scanner.clear()).catch(() => {});
      }
    };
  }, [isCameraActive, scanMode, manualQty]);

  // Helper search master name
  const getProductName = (barcode) => {
    if (!masterData || masterData.length === 0) return null;
    const found = masterData.find(m => m.barcode === barcode || m.item_code === barcode);
    return found ? (found.product_name_la || found.item_name || found.product_name) : null;
  };

  // ─── 2. PROCESS SCAN & UPSERT TO SUPABASE ─────────────────────────
  const processScanCode = async (codeToScan, clearInput = true) => {
    const code = codeToScan.trim();
    if (!code) return;

    // 🎯 STRICT REQUIREMENT: MUST BE EXACTLY 13 NUMERIC DIGITS!
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

    const addAmount = scanMode === 'count' ? 1 : Math.max(1, Number(manualQty) || 1);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    // ALWAYS read from itemsRef.current to avoid stale React state closures
    const currentList = itemsRef.current || [];
    const existingItem = currentList.find(item => String(item.barcode).trim() === code);
    let prevQty = 0;
    let newQty = addAmount;

    if (existingItem) {
      prevQty = Number(existingItem.qty) || 0;
      newQty = prevQty + addAmount;
    }

    const productName = getProductName(code) || `ສິນຄ້າບາໂຄດ ${code}`;
    const nowStr = new Date().toLocaleTimeString('lo-LA');

    const newItemObj = {
      id: existingItem?.id || Date.now(),
      barcode: code,
      name: productName,
      qty: newQty,
      createdBy: empId,
      timestamp: nowStr
    };

    // Update items state AND itemsRef.current immediately
    setItems(prevItems => {
      const filtered = prevItems.filter(i => String(i.barcode).trim() !== code);
      const updated = [newItemObj, ...filtered];
      itemsRef.current = updated;
      return updated;
    });

    try {
      const { data, error } = await supabase
        .from('stock_count_lak8')
        .upsert(
          {
            barcode: code,
            qty: newQty,
            created_by: empId,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'barcode' }
        )
        .select();

      if (error) throw error;

      if (data?.[0]?.id && newItemObj.id !== data[0].id) {
        setItems(prevItems => {
          const updated = prevItems.map(i => i.barcode === code ? { ...i, id: data[0].id } : i);
          itemsRef.current = updated;
          return updated;
        });
      }

      // Floating Toast notification
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
        message: err.message
      });
    }

    if (clearInput) {
      setBarcodeInput('');
    }
  };

  const handleBarcodeSubmit = (e) => {
    if (e) e.preventDefault();
    processScanCode(barcodeInput);
  };

  const updateItemQty = async (id, barcode, targetQty) => {
    const nextQty = Math.max(1, targetQty);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    try {
      const { error } = await supabase
        .from('stock_count_lak8')
        .update({ qty: nextQty, created_by: empId, updated_at: new Date().toISOString() })
        .eq('barcode', barcode);

      if (error) throw error;

      setItems(items.map(item => item.barcode === barcode ? { ...item, qty: nextQty, timestamp: new Date().toLocaleTimeString('lo-LA') } : item));
    } catch (err) {
      console.error('[Lak8 Update Error]', err);
    }
  };

  const removeItem = async (barcode) => {
    if (!confirm('ທ່ານຕ້ອງການລຶບລາຍການນີ້ຫຼືບໍ່?')) return;
    try {
      const { error } = await supabase
        .from('stock_count_lak8')
        .delete()
        .eq('barcode', barcode);

      if (error) throw error;

      setItems(items.filter(item => item.barcode !== barcode));
    } catch (err) {
      console.error('[Lak8 Delete Error]', err);
    }
  };

  const totalQtySum = items.reduce((acc, curr) => acc + curr.qty, 0);

  return (
    <div 
      className="min-h-screen bg-slate-100 pb-12 select-none relative"
      style={{ fontFamily: "'Noto Sans Lao', 'Inter', sans-serif" }}
    >
      {/* Google Fonts Noto Sans Lao */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700;800;900&display=swap');
        .font-lao { fontFamily: 'Noto Sans Lao', sans-serif; }
      `}</style>
      
      {/* FLOATING TOAST NOTIFICATION (เด้งลอยสไตล์ Mobile App) */}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md animate-in slide-in-from-top-4 duration-200">
          <div className={`p-4 rounded-2xl shadow-xl backdrop-blur-md border flex items-center justify-between text-white ${
            toast.type === 'error'
              ? 'bg-rose-600/95 border-rose-400'
              : toast.type === 'info'
              ? 'bg-amber-600/95 border-amber-400'
              : 'bg-emerald-600/95 border-emerald-400'
          }`}>
            <div className="flex items-center gap-3">
              {toast.type === 'error' ? (
                <AlertCircle size={26} className="shrink-0" />
              ) : (
                <CheckCircle2 size={26} className="shrink-0 animate-bounce" />
              )}
              <div>
                <h4 className="font-black text-sm leading-tight">{toast.title}</h4>
                <p className="text-xs text-white/90 font-medium truncate max-w-[200px] sm:max-w-[260px]">{toast.message}</p>
                {toast.barcode && (
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono font-bold bg-black/20 px-2 py-0.5 rounded-md">
                    <span>{toast.barcode}</span>
                    <span>➔</span>
                    <span className="text-amber-200">{toast.prevQty} ➔ {toast.newQty} QTY</span>
                  </div>
                )}
              </div>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="p-1 hover:bg-white/20 rounded-lg text-white/80"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 1. TOP HEADER */}
      <header className="bg-[#b81d6d] text-white py-3.5 px-4 sticky top-0 z-30 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-1.5 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight leading-none">
              ລະບົບນັບສິນຄ້າສາງລັກ8
            </h1>
            <p className="text-[11px] text-pink-200 font-medium mt-0.5">
              Stock Count System — Lak 8 Warehouse
            </p>
          </div>
        </div>

        <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-xl flex items-center gap-2 border border-white/20">
          <Layers size={16} className="text-pink-200" />
          <span className="text-xs font-bold font-mono">ລວມ {totalQtySum} QTY</span>
        </div>
      </header>

      {/* 2. CONTROLS & CAMERA AREA */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
        
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            ເລືອກໂຫມດການນັບ (Counting Mode)
          </h2>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setScanMode('manual')}
              className={`p-3.5 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden ${
                scanMode === 'manual'
                  ? 'border-[#b81d6d] bg-pink-50 text-[#b81d6d] shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {scanMode === 'manual' && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#b81d6d]" />
              )}
              <span className="text-sm sm:text-base font-black leading-tight text-center">
                ເພີ່ມສິນຄ້າແບບພິມຈຳນວນ
              </span>
            </button>

            <button
              onClick={() => setScanMode('count')}
              className={`p-3.5 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all cursor-pointer relative overflow-hidden ${
                scanMode === 'count'
                  ? 'border-[#b81d6d] bg-pink-50 text-[#b81d6d] shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {scanMode === 'count' && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#b81d6d]" />
              )}
              <span className="text-sm sm:text-base font-black leading-tight text-center">
                ເພີ່ມສິນຄ້າແບບ Count สะແກນ 1ຄັ້ງ
              </span>
            </button>
          </div>

          {scanMode === 'manual' && (
            <div className="pt-2 flex items-center gap-2 animate-in fade-in duration-200">
              <span className="text-xs font-bold text-slate-500 shrink-0">ກຳນົດ QTY ຕໍ່ການສະແກນ:</span>
              <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-50">
                <button 
                  onClick={() => setManualQty(Math.max(1, manualQty - 1))}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700"
                >
                  -
                </button>
                <input
                  type="number"
                  value={manualQty}
                  onChange={(e) => setManualQty(Math.max(1, Number(e.target.value)))}
                  className="w-16 text-center font-bold text-sm bg-transparent border-none focus:outline-none"
                />
                <button 
                  onClick={() => setManualQty(manualQty + 1)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold text-slate-700"
                >
                  +
                </button>
              </div>
            </div>
          )}

          {/* SCAN INPUT FIELD */}
          <form onSubmit={handleBarcodeSubmit} className="pt-1 flex gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                readOnly={isCameraActive} // ขณะเปิดกล้อง ห้ามแป้นพิมพ์เด้ง!
                inputMode={isCameraActive ? 'none' : 'text'}
                placeholder={isCameraActive ? "ກ້ອງສະແກນກຳລັງທຳງານ..." : "ສະແກນ ຫຼື ພິມເລກບາໂຄດ..."}
                className="w-full bg-slate-50 border-2 border-slate-300 focus:border-[#b81d6d] focus:bg-white rounded-xl py-2.5 px-3 pl-9 text-sm font-bold font-mono text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
              />
              <Barcode size={18} className="absolute left-2.5 top-3 text-slate-400" />
            </div>

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
              className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
                isCameraActive 
                  ? 'bg-rose-500 text-white border-rose-600' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-sm'
              }`}
            >
              <Camera size={16} />
              <span className="hidden sm:inline">{isCameraActive ? 'ປິດກ້ອງ' : 'ກ້ອງສະແກນ'}</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2.5 bg-[#b81d6d] hover:bg-[#a0185e] text-white font-bold text-xs rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              ຕົກລົງ
            </button>
          </form>

          {/* PERMISSION PROMPT SCREEN */}
          {cameraPermState === 'asking' && !isCameraActive && (
            <div className="mt-3 bg-slate-800 border-2 border-emerald-500/60 rounded-2xl p-5 text-white space-y-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/40">
                  <Camera size={26} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">ຂໍອະນຸຍາດໃຊ້ກ້ອງ</h3>
                  <p className="text-xs text-slate-300 mt-0.5">ລະບົບຕ້ອງການເຂົ້າໃຊ້ກ້ອງ ເພື່ອສະແກນບາໂຄດສິນຄ້າ</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setCameraPermState('idle')}
                  className="py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold text-sm rounded-xl transition-all cursor-pointer"
                >
                  ຍົກເລີກ
                </button>
                <button
                  onClick={() => {
                    setCameraPermState('granted');
                    setIsCameraActive(true);
                  }}
                  className="py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30"
                >
                  <Camera size={16} />
                  ອະນຸຍາດ ແລ້ວເປີດກ້ອງ
                </button>
              </div>
            </div>
          )}

          {/* CAMERA PREVIEW CONTAINER */}
          {isCameraActive && (
            <div className="mt-3 p-3 bg-slate-900 rounded-2xl text-white space-y-2 border border-slate-700 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>ກ້ອງສະແກນບາໂຄດກຳລັງທຳງານ (Auto Count Active)</span>
                </div>
                <button 
                  onClick={() => setIsCameraActive(false)}
                  className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800"
                >
                  ✕ ປິດ
                </button>
              </div>

              <div 
                id="lak8-reader" 
                className="w-full overflow-hidden rounded-xl bg-black min-h-[220px]"
              />

              {/* DEBUG HUD */}
              <div className="bg-slate-800/90 border border-slate-700 p-2 rounded-xl text-[11px] font-mono space-y-0.5">
                <div className="flex justify-between items-center text-amber-400 font-bold border-b border-slate-700/60 pb-1">
                  <span>CAMERA HARDWARE STATUS</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded">
                    VOL KEYS READY 🔘
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-slate-300 pt-0.5">
                  <div><span className="text-slate-500">Trigger:</span> <span className="text-emerald-400 font-bold">{debugLog.triggerType}</span></div>
                  <div><span className="text-slate-500">Last Code:</span> <span className="text-cyan-300 font-bold">{debugLog.lastCode}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. ITEM LIST TABLE (HIGH CONTRAST DESIGN) */}
        <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border-2 border-slate-200 text-slate-900 space-y-3">
          
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Barcode size={22} className="text-[#b81d6d]" />
              <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                ລາຍການສິນຄ້າທີ່ສະແກນແລ້ວ ({items.length} ລາຍການ)
              </h2>
            </div>

            <button
              onClick={() => fetchLak8Stock()}
              className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> ໂຫຼດໃໝ່
            </button>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <RefreshCw size={36} className="mx-auto animate-spin text-[#b81d6d]" />
                <p className="font-bold text-sm text-slate-700">ກຳລັງໂຫຼດຂໍ້ມູນຈາກ Supabase...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <Barcode size={48} className="mx-auto opacity-30" />
                <p className="font-bold text-sm text-slate-600">ຍັງບໍ່ມີລາຍການທີ່ສະແກນ</p>
                <p className="text-xs text-slate-400">ຍິງບາໂຄດເພື່ອເລີ່ມນັບສິນຄ້າສາງລັກ 8 ໄດ້ເລີຍ</p>
              </div>
            ) : (
              items.slice(0, 50).map((item, index) => (
                <div
                  key={item.id || item.barcode}
                  className={`bg-slate-50 text-slate-900 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 border-2 ${
                    index === 0 ? 'border-[#b81d6d] bg-pink-50/70 shadow-sm' : 'border-slate-200'
                  }`}
                >
                  {/* Left info: Barcode & Product Name */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-xs bg-slate-900 text-amber-300 px-2 py-0.5 rounded shrink-0">
                        {item.barcode}
                      </span>
                      <p className="font-black text-xs sm:text-sm text-slate-900 truncate">
                        {item.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] font-bold text-slate-500 mt-1">
                      <span>ເວລາ: {item.timestamp}</span>
                      {item.createdBy && <span>ໂດຍ: {item.createdBy}</span>}
                    </div>
                  </div>

                  {/* Right controls: QTY & buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-white rounded-lg p-0.5 border-2 border-slate-300 shadow-2xs">
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty - 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-rose-100 text-slate-900 hover:text-rose-700 font-black rounded text-sm active:scale-95 cursor-pointer"
                        title="ຫຼຸດ 1"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono font-black text-base text-[#b81d6d] min-w-[32px] text-center">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty + 1)}
                        className="w-7 h-7 flex items-center justify-center bg-slate-200 hover:bg-emerald-100 text-slate-900 hover:text-emerald-700 font-black rounded text-sm active:scale-95 cursor-pointer"
                        title="ເພີ່ມ 1"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.barcode)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="ລຶບ"
                    >
                      <Trash2 size={16} />
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
