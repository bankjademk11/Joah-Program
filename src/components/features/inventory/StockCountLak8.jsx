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
  RefreshCw
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';

export default function StockCountLak8({ onBack, masterData = [], currentUser }) {
  // ─── States ────────────────────────────────────────────────────────
  const [scanMode, setScanMode] = useState('count'); // 'manual' | 'count'
  const [manualQty, setManualQty] = useState(1);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notification state (ກ່ອງແຈ້ງເຕືອນ Notication System)
  const [notification, setNotification] = useState({
    type: 'success',
    title: 'ພ້ອມຮັບການສະແກນ',
    message: 'ເລືອກໂຫມດການນັບ ແລ້ວເລີ່ມສະແກນບາໂຄດໄດ້ເລີຍ',
    updatedBarcode: null,
    prevQty: 0,
    newQty: 0
  });

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [debugLog, setDebugLog] = useState({
    lastTrigger: null,
    triggerType: 'NONE',
    lastCode: '-',
    status: 'READY'
  });
  const inputRef = useRef(null);

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
      }
    } catch (err) {
      console.error('[Lak8 Fetch Error]', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLak8Stock();
  }, []);

  // ดักจับปุ่มเพิ่ม/ลดเสียงข้างมือถือ (Volume Up / Down Physical Keys) ทำหน้าที่เป็นปุ่มยิงสแกน!
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['AudioVolumeUp', 'AudioVolumeDown', 'VolumeUp', 'VolumeDown', 'F1', 'F2', 'F12'].includes(e.key) || e.code?.includes('Volume')) {
        e.preventDefault();
        
        console.log('[Lak8 Hardware Trigger] Volume key pressed!', e.key);
        setDebugLog(prev => ({
          ...prev,
          lastTrigger: new Date().toLocaleTimeString('lo-LA'),
          triggerType: 'VOLUME_KEY 🔘',
          status: 'HARDWARE TRIGGER FIRED!'
        }));

        if (barcodeInput.trim()) {
          processScanCode(barcodeInput.trim());
        } else if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [barcodeInput, scanMode, manualQty]);

  // Camera Barcode Scanner integration (html5-qrcode)
  useEffect(() => {
    let html5Scanner = null;
    let isMounted = true;

    if (isCameraActive) {
      // 1. Explicitly request camera permission first so browser shows popup
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then((stream) => {
            // Stop preview stream immediately so html5qrcode can take control
            stream.getTracks().forEach(track => track.stop());

            // 2. Delay slightly so DOM element #lak8-reader is rendered
            setTimeout(() => {
              if (!isMounted) return;
              import('html5-qrcode').then(({ Html5Qrcode }) => {
                const element = document.getElementById('lak8-reader');
                if (!element) return;

                html5Scanner = new Html5Qrcode('lak8-reader');
                html5Scanner.start(
                  { facingMode: 'environment' },
                  { fps: 15, qrbox: { width: 260, height: 140 } },
                  (decodedText) => {
                    setBarcodeInput(decodedText);
                    setDebugLog({
                      lastTrigger: new Date().toLocaleTimeString('lo-LA'),
                      triggerType: 'CAMERA 📷',
                      lastCode: decodedText,
                      status: `SUCCESS!`
                    });

                    // Audio Beep
                    try {
                      const ctx = new (window.AudioContext || window.webkitAudioContext)();
                      const osc = ctx.createOscillator();
                      osc.type = 'sine';
                      osc.frequency.setValueAtTime(1000, ctx.currentTime);
                      osc.connect(ctx.destination);
                      osc.start();
                      osc.stop(ctx.currentTime + 0.15);
                    } catch (e) {}

                    processScanCode(decodedText);
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
  const processScanCode = async (codeToScan) => {
    const code = codeToScan.trim();
    if (!code) return;

    const addAmount = scanMode === 'count' ? 1 : Math.max(1, Number(manualQty) || 1);
    const empId = currentUser?.employee_id || currentUser?.name || 'Staff';

    const existingItem = items.find(item => item.barcode === code);
    let prevQty = 0;
    let newQty = addAmount;

    if (existingItem) {
      prevQty = existingItem.qty;
      newQty = prevQty + addAmount;
    }

    try {
      // Upsert to Supabase stock_count_lak8 table
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

      // Re-fetch or update local state
      const productName = getProductName(code) || `ສິນຄ້າບາໂຄດ ${code}`;
      const nowStr = new Date().toLocaleTimeString('lo-LA');

      setItems(prevItems => {
        const filtered = prevItems.filter(i => i.barcode !== code);
        const newItemObj = {
          id: data?.[0]?.id || Date.now(),
          barcode: code,
          name: productName,
          qty: newQty,
          createdBy: empId,
          timestamp: nowStr
        };
        return [newItemObj, ...filtered];
      });

      setNotification({
        type: existingItem ? 'success' : 'info',
        title: existingItem ? 'ເພີ່ມຈຳນວນ QTY ສຳເລັດ! ➕' : 'ພົບເລກບາໂຄດໃໝ່! ✨',
        message: `ບາໂຄດ ${code} (${empId})`,
        updatedBarcode: code,
        prevQty: prevQty,
        newQty: newQty
      });

    } catch (err) {
      console.error('[Lak8 Upsert Error]', err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูลลง Supabase: ' + err.message);
    }

    setBarcodeInput('');
    if (inputRef.current) inputRef.current.focus();
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
      className="min-h-screen bg-slate-100 pb-12 select-none"
      style={{ fontFamily: "'Noto Sans Lao', 'Inter', sans-serif" }}
    >
      {/* Google Fonts Noto Sans Lao */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@400;500;600;700;800;900&display=swap');
        
        .font-lao {
          font-family: 'Noto Sans Lao', sans-serif;
        }
      `}</style>
      
      {/* 1. TOP HEADER (ສີບົວເຂັ້ມ ຕາມ Mockup) */}
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
          <span className="text-xs font-bold">ລວມ {totalQtySum} QTY</span>
        </div>
      </header>

      {/* 2. CONTROLS & NOTIFICATION AREA (ตรงตาม Mockup เป๊ะๆ) */}
      <div className="max-w-4xl mx-auto p-3 sm:p-4 space-y-4">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          
          {/* LEFT SIDE: 2 ปุ่มแบบใน Mockup */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              ເລືອກໂຫມດການນັບ (Counting Mode)
            </h2>

            <div className="grid grid-cols-2 gap-2.5">
              {/* ปุ่มที่ 1: ເພີ່ມສິນຄ້າແບບພິມຈຳນວນ */}
              <button
                onClick={() => setScanMode('manual')}
                className={`p-3 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer relative overflow-hidden ${
                  scanMode === 'manual'
                    ? 'border-[#b81d6d] bg-pink-50 text-[#b81d6d] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {scanMode === 'manual' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#b81d6d]" />
                )}
                <span className="text-sm sm:text-base font-black leading-tight text-center">
                  ເພີ່ມສິນຄ້າແບບພິມຈຳນວນ
                </span>
              </button>

              {/* ปุ่มที่ 2: ເພີ່ມສິນຄ້າແບບ Count ສະແກນ 1 ຄັ້ງ */}
              <button
                onClick={() => setScanMode('count')}
                className={`p-3 rounded-2xl border-2 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer relative overflow-hidden ${
                  scanMode === 'count'
                    ? 'border-[#b81d6d] bg-pink-50 text-[#b81d6d] shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {scanMode === 'count' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#b81d6d]" />
                )}
                <span className="text-sm sm:text-base font-black leading-tight text-center">
                  ເພີ່ມສິນຄ້າແບບ Count ສະແກນ 1ຄັ້ງ
                </span>
              </button>
            </div>

            {/* ถ้าเป็นโหมด Manual ให้กำหนด QTY */}
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

            {/* SCAN INPUT FIELD & CAMERA BUTTON */}
            <form onSubmit={handleBarcodeSubmit} className="pt-1 flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="ສະແກນ ຫຼື ພິມເລກບາໂຄດຢູ່ທີ່ນີ້..."
                  className="w-full bg-slate-50 border-2 border-slate-300 focus:border-[#b81d6d] focus:bg-white rounded-xl py-2.5 px-3 pl-9 text-sm font-bold text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                />
                <Barcode size={18} className="absolute left-2.5 top-3 text-slate-400" />
              </div>

              {/* ปุ่มเปิดกล้องสแกนมือถือ */}
              <button
                type="button"
                onClick={() => setIsCameraActive(!isCameraActive)}
                className={`px-3 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all border ${
                  isCameraActive 
                    ? 'bg-rose-500 text-white border-rose-600' 
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-sm'
                }`}
                title="ເປີດກ້ອງສະແກນມືຖື"
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

            {/* CAMERA PREVIEW CONTAINER (กล้องสแกนสำหรับมือถือ) */}
            {isCameraActive && (
              <div className="mt-3 p-3 bg-slate-900 rounded-2xl text-white space-y-2 border border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>ກ້ອງສະແກນບາໂຄດກຳລັງທຳງານ...</span>
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

                {/* DEBUG STATUS MONITOR (หน้าจอ Debug ยิงบาร์โค้ดสด) */}
                <div className="bg-slate-800/90 border border-slate-700 p-2.5 rounded-xl text-[11px] font-mono space-y-1">
                  <div className="flex justify-between items-center text-amber-400 font-bold border-b border-slate-700/60 pb-1">
                    <span>DEBUG HARDWARE TRIGGER MONITOR</span>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded">
                      VOL UP/DOWN ACTIVE 🔘
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-slate-300 pt-0.5">
                    <div><span className="text-slate-500">Trigger:</span> <span className="text-emerald-400 font-bold">{debugLog.triggerType}</span></div>
                    <div><span className="text-slate-500">Time:</span> {debugLog.lastTrigger || '-'}</div>
                    <div><span className="text-slate-500">Last Code:</span> <span className="text-cyan-300 font-bold">{debugLog.lastCode}</span></div>
                    <div><span className="text-slate-500">Status:</span> <span className="text-pink-400 font-bold">{debugLog.status}</span></div>
                  </div>
                </div>

                {/* Soft Trigger Button เผื่อปุ่มปรับเสียงข้างเครื่องมือถือพนักงานเสีย */}
                <button
                  type="button"
                  onClick={() => {
                    setDebugLog({
                      lastTrigger: new Date().toLocaleTimeString('lo-LA'),
                      triggerType: 'SCREEN_TRIGGER 🎯',
                      lastCode: barcodeInput || 'WAITING SCAN',
                      status: 'SCREEN TRIGGER CLICKED'
                    });
                    if (barcodeInput.trim()) {
                      handleBarcodeSubmit();
                    } else if (inputRef.current) {
                      inputRef.current.focus();
                    }
                  }}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:scale-[0.98] text-white font-black text-sm rounded-xl shadow-lg flex items-center justify-center gap-2 border border-amber-400 cursor-pointer transition-all"
                >
                  <span>🎯 ປຸ່ມຍິງສະແກນສຳຮອງ (Soft Trigger Scan)</span>
                </button>

                <p className="text-[11px] text-slate-300 text-center font-medium">
                  💡 ຄຳແນະນຳ: ກົດປຸ່ມ <span className="text-amber-300 font-bold">ເພີ່ມ/ຫຼຸດສຽງ ຂ້າງມືຖື</span> ຫຼື ກົດປຸ່ມ <span className="text-amber-400 font-bold">ຍິງສະແກນສຳຮອງ</span> ເພື່ອຍິງສະແກນໄດ້ທັນທີ!
                </p>
              </div>
            )}
          </div>

          {/* RIGHT SIDE: NOTIFICATION SYSTEM (กล่องขอบไม้ Notication system ใน Mockup) */}
          <div className="bg-[#dca664]/20 border-2 border-[#b87d3b] rounded-2xl p-4 shadow-sm relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-[#b87d3b]/30 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-black text-amber-900 text-sm tracking-wide">
                  Notification system
                </span>
              </div>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                LIVE STATUS
              </span>
            </div>

            <div className="flex-1 flex flex-col justify-center py-2 space-y-1">
              <div className="flex items-start gap-2.5">
                {notification.type === 'success' ? (
                  <CheckCircle2 size={24} className="text-emerald-600 shrink-0 mt-0.5 animate-bounce" />
                ) : (
                  <Sparkles size={24} className="text-amber-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="font-black text-slate-800 text-base leading-snug">
                    {notification.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-600">
                    {notification.message}
                  </p>
                </div>
              </div>

              {notification.updatedBarcode && (
                <div className="mt-3 bg-white/80 backdrop-blur-sm border border-amber-300 rounded-xl p-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">QTY ອັບເດດ:</span>
                  <div className="flex items-center gap-2 text-sm font-black">
                    <span className="text-slate-400 line-through">{notification.prevQty}</span>
                    <span className="text-amber-600">➔</span>
                    <span className="text-emerald-600 text-base bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-300">
                      {notification.newQty} QTY
                    </span>
                  </div>
                </div>
              )}
            </div>

            <p className="text-[10px] text-amber-800/70 font-medium text-right mt-1">
              ພ້ອມອັບເດດເຂົ້າ Supabase ອັດໂນມັດ
            </p>
          </div>

        </div>

        {/* 3. ITEM LIST TABLE (พื้นที่สีชมพู/แดง แสดงบาร์โค้ด + QTY ตัวใหญ่) */}
        <div className="bg-[#b81d6d] rounded-3xl p-4 sm:p-5 shadow-lg text-white space-y-4">
          
          <div className="flex items-center justify-between border-b border-pink-400/40 pb-3">
            <div className="flex items-center gap-2">
              <Barcode size={22} className="text-pink-200" />
              <h2 className="text-lg font-black tracking-tight">
                ລາຍການສິນຄ້າທີ່ສະແກນແລ້ວ ({items.length} ລາຍການ)
              </h2>
            </div>

            <button
              onClick={() => {
                if (confirm('ທ່ານຕ້ອງການລ້າງລາຍການທັງໝົດຫຼືບໍ່?')) {
                  setItems([]);
                }
              }}
              className="text-xs font-bold bg-white/10 hover:bg-white/20 text-pink-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
            >
              <RotateCcw size={14} /> ຣີເຊັດ
            </button>
          </div>

          {/* List items */}
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {items.length === 0 ? (
              <div className="py-12 text-center text-pink-200/70 space-y-2">
                <Barcode size={48} className="mx-auto opacity-40" />
                <p className="font-bold text-sm">ຍັງບໍ່ມີລາຍການທີ່ສະແກນ</p>
                <p className="text-xs">ຍິງບາໂຄດເພື່ອເລີ່ມນັບສິນຄ້າສາງລັກ 8 ໄດ້ເລີຍ</p>
              </div>
            ) : (
              items.map((item, index) => (
                <div
                  key={item.id}
                  className={`bg-white text-slate-800 rounded-2xl p-3.5 sm:p-4 shadow-md flex items-center justify-between gap-3 transition-all hover:scale-[1.01] ${
                    index === 0 ? 'ring-4 ring-pink-300' : ''
                  }`}
                >
                  {/* Left: Barcode Box */}
                  <div className="flex items-center gap-3 sm:gap-4 overflow-hidden">
                    <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl shrink-0 text-center flex flex-col items-center justify-center">
                      <Barcode size={36} className="text-slate-800" />
                      <span className="text-[9px] font-bold text-slate-500 max-w-[90px] truncate">
                        {item.barcode}
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="font-black text-sm sm:text-base text-slate-800 leading-snug truncate">
                        {item.name}
                      </p>
                      <p className="text-xs font-bold text-amber-600 mt-0.5">
                        ບາໂຄດ: {item.barcode}
                      </p>
                      <span className="inline-block text-[10px] text-slate-400 font-medium mt-1">
                        ສະແກນລ່າສຸດ: {item.timestamp}
                      </span>
                    </div>
                  </div>

                  {/* Right: Big QTY Readout (ตัวหนังสือ QTY ขนาดใหญ่ตรงตาม Mockup) */}
                  <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-2xl sm:text-4xl font-black text-slate-900 leading-none">
                        {item.qty}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-[#b81d6d] ml-1">
                        QTY
                      </span>
                      {item.createdBy && (
                        <p className="text-[9px] font-bold text-cyan-600 font-mono mt-0.5">
                          ໂດຍ: {item.createdBy}
                        </p>
                      )}
                    </div>

                    {/* Quick Adjust Buttons */}
                    <div className="flex flex-col gap-1 border-l border-slate-200 pl-2 sm:pl-3">
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty + 1)}
                        className="p-1.5 bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="ເພີ່ມ 1"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        onClick={() => updateItemQty(item.id, item.barcode, item.qty - 1)}
                        className="p-1.5 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 rounded-lg transition-all active:scale-95 cursor-pointer"
                        title="ຫຼຸດ 1"
                      >
                        <Minus size={14} />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.barcode)}
                      className="p-2 text-slate-300 hover:text-rose-500 rounded-lg transition-colors cursor-pointer ml-1"
                      title="ລຶບລາຍການນີ້"
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
