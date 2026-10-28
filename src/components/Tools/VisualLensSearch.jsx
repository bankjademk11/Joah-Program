import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Camera, Upload, X, CheckCircle2,
  Copy, Scan, Layers, ExternalLink, SwitchCamera, RefreshCw, Tag,
  Code2, Sparkles, ChevronLeft, ChevronRight
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { getProductImageUrl, handleImageError } from '../../utils/productImageUtils';
import VisualLensHeroImg from '../../assets/Icons_AppJoah/VisualLensSearch_card_image.webp';

const DEFAULT_AI_API_URL = 'https://bankjademk11--joah-lens-search-fastapi-app.us-east.modal.run';

// Aggressively purge any stale legacy tunnel URLs immediately
try {
  const saved = typeof window !== 'undefined' ? localStorage.getItem('joah_lens_api_url') : null;
  if (saved && (!saved.includes('modal.run') && !saved.includes('hf.space'))) {
    localStorage.removeItem('joah_lens_api_url');
  }
} catch {}

export function getAiApiUrl() {
  try {
    const custom = typeof window !== 'undefined' ? localStorage.getItem('joah_lens_api_url') : null;
    if (custom && (!custom.includes('modal.run') && !custom.includes('hf.space'))) {
      localStorage.removeItem('joah_lens_api_url');
      return DEFAULT_AI_API_URL;
    }
    return custom || DEFAULT_AI_API_URL;
  } catch {
    return DEFAULT_AI_API_URL;
  }
}
const PAGE_SIZE = 20;

const formatPrice = (price) => {
  if (price === undefined || price === null) return null;
  return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
};

async function searchByImageAPI(imageDataUrl, tta = false, topk = 10, removeBg = true) {
  const apiUrl = getAiApiUrl();
  const res = await fetch(`${apiUrl}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl, tta, topk, remove_bg: removeBg }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `ເກີດຂໍ້ຜິດພາດ (${res.status})`);
  }
  return res.json();
}

export default function VisualLensSearch({ onBack, onSelectProduct, branchId = 'ໂພນຕ້ອງ', user }) {
  const isHQ = user?.role === 'HQ' || user?.role === 'admin' || user?.role === 'ADMIN' || user?.branch_id === 'HQ';

  const [imagePreview, setImagePreview] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [showCutout, setShowCutout] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchDone, setSearchDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [highAccuracy, setHighAccuracy] = useState(false);
  const [resultLimit, setResultLimit] = useState(isHQ ? 100 : 10);
  const [currentPage, setCurrentPage] = useState(1);
  const [serviceOnline, setServiceOnline] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [copiedBarcode, setCopiedBarcode] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);

  const resultsTopRef = useRef(null);

  const totalPages = Math.ceil(searchResults.length / PAGE_SIZE);
  const paginatedResults = useMemo(() => {
    if (searchResults.length <= PAGE_SIZE) return searchResults;
    const start = (currentPage - 1) * PAGE_SIZE;
    return searchResults.slice(start, start + PAGE_SIZE);
  }, [searchResults, currentPage]);

  useEffect(() => {
    if (isHQ) setResultLimit(100);
  }, [isHQ]);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    checkService();
    return () => stopCamera();
  }, []);


  // Modal scales to zero when idle; a cold start takes ~10-35s (see Modal logs),
  // so retry a few times with a generous timeout before showing "offline".
  async function checkService() {
    const apiUrl = getAiApiUrl();
    setServiceOnline(null);
    const MAX_ATTEMPTS = 3;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await fetch(`${apiUrl}/`, { method: 'GET', cache: 'no-store', signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
          setServiceOnline(true);
          return;
        }
      } catch (err) {
        clearTimeout(timer);
        console.warn(`[VisualLensSearch] Health check ${attempt}/${MAX_ATTEMPTS} failed for:`, apiUrl, err);
      }
      if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 3000));
    }
    setServiceOnline(false);
  }

  const startCamera = async (facing = cameraFacing) => {
    try {
      stopCamera();
      setCameraActive(true);
      setErrorMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setErrorMsg('ບໍ່ສາມາດເຂົ້າໃຊ້ກ້ອງໄດ້ — ກວດສອບການອະນຸຍາດກ້ອງຂອງອຸປະກອນ');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const flipCamera = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(next);
    if (cameraActive) startCamera(next);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setImagePreview(dataUrl);
    stopCamera();
    runSearch(dataUrl);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      runSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const runSearch = async (imgDataUrl, customTopK = null) => {
    setIsSearching(true);
    setSearchResults([]);
    setSearchDone(false);
    setErrorMsg('');
    setCurrentPage(1);
    setProcessedImage(null);
    setShowCutout(true);

    try {
      // HQ has no limit (defaults to 100 or custom selection), standard branch users capped at 10
      const topkToFetch = customTopK !== null ? customTopK : (isHQ ? resultLimit : 10);
      const apiResponse = await searchByImageAPI(imgDataUrl, highAccuracy, topkToFetch, true);
      const apiResults = apiResponse?.results || [];

      if (apiResponse?.processed_image) {
        setProcessedImage(apiResponse.processed_image);
      }

      if (!apiResults || apiResults.length === 0) {
        setSearchDone(true);
        setSearchResults([]);
        return;
      }

      const barcodes = apiResults.map(r => r.barcode);

      // Batch queries in chunks of 60 to safely handle large result sets without PostgREST URL limit issues
      const chunkSize = 60;
      const barcodeChunks = [];
      for (let i = 0; i < barcodes.length; i += chunkSize) {
        barcodeChunks.push(barcodes.slice(i, i + chunkSize));
      }

      const [productsResChunks, priceResChunks] = await Promise.all([
        Promise.all(
          barcodeChunks.map(chunk =>
            supabase
              .from('master_data')
              .select('barcode, item_name, product_name_la, category_1, category_2')
              .in('barcode', chunk)
          )
        ),
        Promise.all(
          barcodeChunks.map(chunk =>
            supabase
              .from('price_checker')
              .select('barcode, price, product_name')
              .in('barcode', chunk)
          )
        )
      ]);

      const productMap = {};
      productsResChunks.forEach(res => {
        (res.data || []).forEach(p => { productMap[p.barcode] = p; });
      });

      const priceMap = {};
      priceResChunks.forEach(res => {
        (res.data || []).forEach(p => {
          if (p.barcode && p.price !== undefined && p.price !== null) {
            priceMap[p.barcode] = p.price;
          }
        });
      });

      const results = apiResults.map(r => {
        const p = productMap[r.barcode] || {};
        const pct = Math.min(Math.max(Math.round(r.similarity * 100), 5), 99);
        const price = priceMap[r.barcode];
        return {
          barcode: r.barcode,
          item_name: p.item_name || r.barcode,
          product_name_la: p.product_name_la || '',
          category_1: p.category_1 || '',
          category_2: p.category_2 || '',
          price: price !== undefined ? price : null,
          confidence: pct,
          image_url: r.image_url || getProductImageUrl(r.barcode),
          inMasterData: !!p.barcode,
        };
      });

      setSearchResults(results);
      setSearchDone(true);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const copyBarcode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedBarcode(code);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  const resetSearch = () => {
    setImagePreview(null);
    setProcessedImage(null);
    setShowCutout(true);
    setSearchResults([]);
    setSearchDone(false);
    setErrorMsg('');
    setCurrentPage(1);
  };


  // ── Main UI ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">

      {/* Header */}
      <header className="px-4 sm:px-6 py-3 bg-slate-900 border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-slate-800 transition text-slate-400 hover:text-white shrink-0"
            >
              <X size={18} />
            </button>
          )}
          <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
            <Scan size={16} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-white leading-tight truncate">ຄົ້ນຫາດ້ວຍຮູບ</h1>
              {isHQ && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm border border-violet-400/40 tracking-wide">
                  <Sparkles size={10} /> HQ Unlimited
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 truncate">
              Joah Lens · {isHQ ? 'ສຳນັກງານໃຫຍ່ (HQ) · ບໍ່ຈຳກັດການເບິ່ງ' : branchId}
            </p>
          </div>
        </div>

        {/* Service indicator */}
        <button
          type="button"
          onClick={() => {
            const current = getAiApiUrl();
            const input = window.prompt("ປ່ຽນ Server URL ສຳລັບ AI Lens Search (Colab / HF):\n\nURL ປະຈຸບັນ:", current);
            if (input !== null) {
              const trimmed = input.trim();
              if (trimmed) {
                localStorage.setItem('joah_lens_api_url', trimmed);
              } else {
                localStorage.removeItem('joah_lens_api_url');
              }
              setServiceOnline(null);
              checkService();
            }
          }}
          title="ຄລິກເພື່ອປ່ຽນ Server URL (ເຊັ່ນ URL ຈາກ Google Colab)"
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition hover:opacity-90 active:scale-95 ${serviceOnline === true ? 'border-emerald-800 bg-emerald-950 text-emerald-400' :
          serviceOnline === false ? 'border-red-800 bg-red-950 text-red-400' :
            'border-slate-700 bg-slate-800 text-slate-500'
          }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${serviceOnline === true ? 'bg-emerald-400' : serviceOnline === false ? 'bg-red-400' : 'bg-slate-500 animate-pulse'
            }`} />
          {serviceOnline === true ? 'ພ້ອມໃຊ້ງານ' : serviceOnline === false ? 'ບໍ່ສາມາດເຊື່ອມຕໍ່ໄດ້' : 'ກຳລັງກວດສອບ...'}
        </button>
      </header>

      {/* Error banner */}
      {errorMsg && (
        <div className="mx-4 sm:mx-6 mt-4 px-4 py-3 rounded-xl bg-red-950 border border-red-800 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="ml-auto text-red-500 hover:text-red-300">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-5">

          {/* ── Left: Input ─────────────────────────────────────────────── */}
          <div className="md:col-span-5 space-y-4">

            {/* Camera / Preview area */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">

              {/* Camera active */}
              {cameraActive ? (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay playsInline muted
                    className="w-full aspect-[4/3] object-cover bg-black block"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  {/* Reticle */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-44 h-44 relative">
                      <span className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white rounded-tl-lg" />
                      <span className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white rounded-tr-lg" />
                      <span className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white rounded-bl-lg" />
                      <span className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white rounded-br-lg" />
                    </div>
                  </div>
                  {/* Camera controls */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-3">
                    <button
                      onClick={stopCamera}
                      className="p-2.5 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 transition"
                    >
                      <X size={18} />
                    </button>
                    <button
                      onClick={capturePhoto}
                      className="w-14 h-14 rounded-full bg-white flex items-center justify-center shadow-lg hover:bg-slate-100 transition"
                    >
                      <Camera size={22} className="text-slate-900" />
                    </button>
                    <button
                      onClick={flipCamera}
                      className="p-2.5 rounded-full bg-black/60 text-white border border-white/20 hover:bg-black/80 transition"
                    >
                      <SwitchCamera size={18} />
                    </button>
                  </div>
                </div>

              ) : imagePreview ? (
                /* Preview captured/uploaded image */
                <div className="relative">
                  <img
                    src={showCutout && processedImage ? processedImage : imagePreview}
                    alt="ຮູບທີ່ເລືອກ"
                    className="w-full aspect-[4/3] object-contain bg-slate-950 block transition-all"
                  />

                  {/* Cutout / Original switcher */}
                  {processedImage && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg">
                      <button
                        type="button"
                        onClick={() => setShowCutout(false)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${!showCutout
                            ? 'bg-slate-700 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200'
                          }`}
                      >
                        ຕົ້ນສະບັບ
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCutout(true)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${showCutout
                            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/40'
                            : 'text-violet-400 hover:text-violet-300'
                          }`}
                      >
                        <Sparkles size={11} />
                        <span>AI ຕັດພື້ນຫຼັງ</span>
                      </button>
                    </div>
                  )}

                  <button
                    onClick={resetSearch}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white hover:bg-black/80 transition"
                  >
                    <X size={14} />
                  </button>
                </div>

              ) : (
                /* Empty placeholder with Hero Art */
                <div className="relative aspect-[4/3] flex flex-col justify-end overflow-hidden group">
                  <img
                    src={VisualLensHeroImg}
                    alt="Visual Lens Preview"
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 group-hover:opacity-75 transition-all duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" />

                  <div className="relative z-10 p-5 space-y-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/20 border border-violet-400/30 text-violet-300 text-[10px] font-semibold backdrop-blur-md">
                      <Scan size={12} />
                      AI Visual Recognition
                    </div>
                    <p className="text-sm font-bold text-white">ຖ່າຍ ຫຼື ເລືອກຮູບສິນຄ້າ</p>
                    <p className="text-xs text-slate-400">ລະບົບຈະຄົ້ນຫາ ແລະ Match ສິນຄ້າໃນຖານຂໍ້ມູນໃຫ້ອັດຕະໂນມັດ</p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!cameraActive && (
                <div className="p-3 border-t border-slate-800 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => startCamera()}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition disabled:opacity-40"
                  >
                    <Camera size={16} />
                    ເປີດກ້ອງ
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-medium text-white transition disabled:opacity-40"
                  >
                    <Upload size={16} />
                    ເລືອກຮູບ
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}
            </div>

            {/* High accuracy toggle */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">ຄົ້ນຫາລະອຽດສູງ</p>
                <p className="text-xs text-slate-500 mt-0.5">ຊ້າລົງ ແຕ່ຜົນລັດທ໌ແມ່ນຍຳຂຶ້ນ</p>
              </div>
              <button
                onClick={() => setHighAccuracy(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${highAccuracy ? 'bg-violet-600' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${highAccuracy ? 'translate-x-5' : ''}`} />
              </button>
            </div>

            {/* Auto background removal status badge */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-200">ຕັດພື້ນຫຼັງອັດຕະໂນມັດ</p>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-950/90 text-emerald-400 border border-emerald-800/60">
                      Auto ON
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">AI ຕັດພື້ນຫຼັງ ແລະ ໂຟກັສສະເພາະຕົວສິນຄ້າເພື່ອຄວາມແມ່ນຍຳ</p>
                </div>
              </div>
            </div>

            {/* HQ Unlimited View Controls */}
            {isHQ && (
              <div className="bg-gradient-to-br from-violet-950/40 to-slate-900 border border-violet-800/50 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-violet-300 font-bold text-xs">
                    <Sparkles size={13} className="text-violet-400" />
                    <span>ໂໝດ HQ (ບໍ່ຈຳກັດການເບິ່ງ)</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                    Unlimited Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  ສະແດງສິນຄ້າທີ່ກົງກັນໄດ້ສູງສຸດ (ສາຂາທົ່ວໄປຈຳກັດ 10 ອັນ):
                </p>
                <div className="grid grid-cols-5 gap-1 pt-1">
                  {[10, 30, 50, 100, 200].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setResultLimit(n);
                        if (imagePreview) runSearch(imagePreview, n);
                      }}
                      className={`py-1.5 rounded-xl text-xs font-bold transition-all text-center cursor-pointer ${resultLimit === n
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30 scale-[1.02]'
                          : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                        }`}
                    >
                      {n === 100 ? '100★' : n === 200 ? '200' : n}
                    </button>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ── Right: Results ───────────────────────────────────────────── */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div ref={resultsTopRef} />

            {/* Results header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-300">ຜົນການຄົ້ນຫາ</h2>
                {isHQ && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-950/80 text-violet-300 border border-violet-800/60">
                    HQ: Top {resultLimit}
                  </span>
                )}
              </div>
              {searchResults.length > 0 && (
                <span className="text-xs font-medium text-slate-500">
                  {searchResults.length} ລາຍການ
                  {totalPages > 1 && ` · ໜ້າ ${currentPage}/${totalPages}`}
                </span>
              )}
            </div>

            {/* Searching state */}
            {isSearching && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-sm">
                <RefreshCw size={15} className="animate-spin shrink-0" />
                ກຳລັງຄົ້ນຫາ...
              </div>
            )}

            {/* No results */}
            {!isSearching && searchDone && searchResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                  <Scan size={22} className="text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-400">ບໍ່ພົບສິນຄ້າທີ່ໃກ້ຄຽງ</p>
                <p className="text-xs text-slate-600 mt-1">ລອງຖ່າຍໃໝ່ ຫຼື ໃຊ້ໂໝດລະອຽດສູງ</p>
              </div>
            )}

            {/* Empty initial state */}
            {!isSearching && !searchDone && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-4">
                  <Scan size={22} className="text-slate-600" />
                </div>
                <p className="text-sm text-slate-500">ຖ່າຍ ຫຼື ເລືອກຮູບສິນຄ້າເພື່ອເລີ່ມຕົ້ນ</p>
              </div>
            )}

            {/* Result cards */}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {paginatedResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-3.5 flex gap-3.5 transition cursor-pointer"
                    onClick={() => onSelectProduct?.(item)}
                  >
                    {/* Product thumbnail (Click to zoom) */}
                    <div
                      className="shrink-0 w-16 h-16 rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500 overflow-hidden flex items-center justify-center relative cursor-zoom-in group/img transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedImage(item);
                      }}
                      title="ກົດເພື່ອເບິ່ງຮູບໃຫຍ່"
                    >
                      <img
                        src={item.image_url}
                        alt={item.barcode}
                        onError={(e) => handleImageError(e, item.barcode)}
                        className="w-full h-full object-contain p-1 group-hover/img:scale-110 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center transition-opacity">
                        <Scan size={16} className="text-white drop-shadow" />
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white text-sm leading-snug truncate">{item.item_name}</p>
                        {/* Confidence badge */}
                        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${item.confidence >= 80
                          ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800'
                          : item.confidence >= 60
                            ? 'bg-amber-900/60 text-amber-400 border border-amber-800'
                            : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}>
                          {item.confidence}%
                        </span>
                      </div>

                      {item.product_name_la && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">{item.product_name_la}</p>
                      )}

                      {/* Price & Category row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {/* Price Tag */}
                        {item.price !== null && item.price !== undefined ? (
                          <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Tag size={11} className="text-amber-400" />
                            {formatPrice(item.price)} ₭
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">
                            ບໍ່ມີລາຄາ
                          </span>
                        )}

                        {/* Category chip */}
                        {item.category_1 && (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                            <Layers size={9} />
                            {item.category_1}
                          </span>
                        )}
                        {/* Not in system warning */}
                        {!item.inMasterData && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-950 text-amber-400 border border-amber-900">
                            ບໍ່ຢູ່ໃນລະບົບ
                          </span>
                        )}
                      </div>

                      {/* Barcode row */}
                      <div className="flex items-center gap-1.5 mt-2">
                        <span className="text-[11px] font-mono text-slate-500">{item.barcode}</span>
                        <button
                          onClick={e => { e.stopPropagation(); copyBarcode(item.barcode); }}
                          className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition"
                        >
                          {copiedBarcode === item.barcode
                            ? <CheckCircle2 size={12} className="text-emerald-400" />
                            : <Copy size={12} />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Select arrow */}
                    <div className="shrink-0 flex items-center">
                      <button
                        onClick={e => { e.stopPropagation(); onSelectProduct?.(item); }}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-violet-400 hover:bg-violet-900/30 transition"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination Controls (when more than 20 items) */}
            {totalPages > 1 && (
              <div className="mt-2 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-900 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
                <div className="text-xs text-slate-400 flex items-center gap-1.5">
                  <span>ສະແດງ</span>
                  <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700">
                    {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, searchResults.length)}
                  </span>
                  <span>ຈາກ</span>
                  <span className="font-bold text-violet-400">{searchResults.length}</span>
                  <span>ລາຍການ</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Previous page button */}
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      resultsTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${currentPage === 1
                        ? 'opacity-35 cursor-not-allowed bg-slate-800/40 text-slate-500 border border-slate-800'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 active:scale-95 shadow-sm'
                      }`}
                  >
                    <ChevronLeft size={14} />
                    <span>ກ່ອນໜ້າ</span>
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                      const isNearby =
                        page === 1 ||
                        page === totalPages ||
                        Math.abs(page - currentPage) <= 1;

                      if (!isNearby) {
                        if (page === currentPage - 2 || page === currentPage + 2) {
                          return (
                            <span key={page} className="px-1 text-slate-600 text-xs select-none">
                              •••
                            </span>
                          );
                        }
                        return null;
                      }

                      return (
                        <button
                          key={page}
                          type="button"
                          onClick={() => {
                            setCurrentPage(page);
                            resultsTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className={`min-w-8 h-8 rounded-xl text-xs font-bold transition flex items-center justify-center cursor-pointer ${currentPage === page
                              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/40 ring-1 ring-violet-400/50'
                              : 'bg-slate-800/80 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/60'
                            }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next page button */}
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      resultsTopRef.current?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${currentPage === totalPages
                        ? 'opacity-35 cursor-not-allowed bg-slate-800/40 text-slate-500 border border-slate-800'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30 active:scale-95 border border-violet-500/50'
                      }`}
                  >
                    <span>ຕໍ່ໄປ</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Developer Credits Footer ────────────────────────── */}
        <div className="max-w-5xl mx-auto mt-8 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-bold text-slate-400 flex items-center gap-1.5">
              <Code2 size={13} className="text-violet-400" />
              Developer by:
            </span>
            <span className="text-slate-300 font-medium">Mr.SANTISOUK LAXAYPHONE</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-300 font-medium">Mr.SOMPHONE XAYYACHIT</span>
            <span className="text-slate-600 hidden sm:inline">•</span>
            <span className="text-slate-300 font-medium">Ms.INTHIDALINH VONGSOUTHI</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-600/15 border border-violet-500/30 text-violet-300 font-bold text-[11px] tracking-wider shrink-0">
            <Sparkles size={11} className="text-violet-400" />
            <span>Team IT JOAH</span>
          </div>
        </div>
      </div>

      {/* ── Large Image Preview Modal ───────────────────────── */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setZoomedImage(null)}
        >
          <div
            className="relative bg-slate-900 border border-slate-750 rounded-2xl max-w-lg w-full p-5 shadow-2xl flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="ປິດ"
            >
              <X size={18} />
            </button>

            {/* Product Image Large */}
            <div className="w-full max-h-[380px] bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4 overflow-hidden">
              <img
                src={zoomedImage.image_url}
                alt={zoomedImage.item_name}
                onError={(e) => handleImageError(e, zoomedImage.barcode)}
                className="max-h-[340px] w-auto max-w-full object-contain drop-shadow-lg"
              />
            </div>

            {/* Product Details Header in Modal */}
            <div className="w-full text-left">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-base font-bold text-white leading-snug">
                  {zoomedImage.item_name}
                </h3>
                <span className={`shrink-0 text-xs font-bold px-2.5 py-0.5 rounded-md ${zoomedImage.confidence >= 80
                    ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-800'
                    : zoomedImage.confidence >= 60
                      ? 'bg-amber-900/60 text-amber-400 border border-amber-800'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}>
                  ຄວາມຖືກຕ້ອງ {zoomedImage.confidence}%
                </span>
              </div>

              {zoomedImage.product_name_la && (
                <p className="text-sm text-slate-400 mt-1">{zoomedImage.product_name_la}</p>
              )}

              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-slate-800">
                {zoomedImage.price !== null && zoomedImage.price !== undefined ? (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <Tag size={13} className="text-amber-400" />
                    {formatPrice(zoomedImage.price)} ₭
                  </span>
                ) : null}

                <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-lg">
                  <span className="text-xs font-mono text-slate-300">{zoomedImage.barcode}</span>
                  <button
                    onClick={() => copyBarcode(zoomedImage.barcode)}
                    className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition"
                    title="Copy Barcode"
                  >
                    {copiedBarcode === zoomedImage.barcode ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>

                {zoomedImage.category_1 && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 flex items-center gap-1">
                    <Layers size={11} /> {zoomedImage.category_1}
                  </span>
                )}
              </div>
            </div>

            {/* Select product button inside modal */}
            {onSelectProduct && (
              <button
                onClick={() => {
                  onSelectProduct(zoomedImage);
                  setZoomedImage(null);
                }}
                className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition flex items-center justify-center gap-2 mt-1"
              >
                <ExternalLink size={16} /> ເລືອກສິນຄ້ານີ້
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
