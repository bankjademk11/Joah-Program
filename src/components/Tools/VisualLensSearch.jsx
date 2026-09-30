import React, { useState, useEffect, useRef } from 'react';
import {
  Camera, Upload, X, CheckCircle2, AlertCircle,
  Copy, Scan, Layers, ExternalLink, SwitchCamera, RefreshCw, Tag
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { getProductImageUrl, handleImageError } from '../../utils/productImageUtils';
import VisualLensHeroImg from '../../assets/Icons_AppJoah/VisualLensSearch_card_image.webp';

const AI_API_URL = 'https://bankjademk11-joah-lens-search.hf.space';

const formatPrice = (price) => {
  if (price === undefined || price === null) return null;
  return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
};

async function searchByImageAPI(imageDataUrl, tta = false, topk = 10) {
  const res = await fetch(`${AI_API_URL}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageDataUrl, tta, topk }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `ເກີດຂໍ້ຜິດພາດ (${res.status})`);
  }
  return res.json();
}

export default function VisualLensSearch({ onBack, onSelectProduct, branchId = 'ໂພນຕ້ອງ', user }) {
  const isHQ = user?.role === 'HQ';

  const [imagePreview, setImagePreview]       = useState(null);
  const [isSearching, setIsSearching]         = useState(false);
  const [searchResults, setSearchResults]     = useState([]);
  const [searchDone, setSearchDone]           = useState(false);
  const [errorMsg, setErrorMsg]               = useState('');
  const [highAccuracy, setHighAccuracy]       = useState(false);
  const [serviceOnline, setServiceOnline]     = useState(null);
  const [cameraActive, setCameraActive]       = useState(false);
  const [cameraFacing, setCameraFacing]       = useState('environment');
  const [copiedBarcode, setCopiedBarcode]     = useState(null);

  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef   = useRef(null);

  useEffect(() => {
    if (!isHQ) return;
    checkService();
    return () => stopCamera();
  }, [isHQ]);

  async function checkService() {
    try {
      const res = await fetch(`${AI_API_URL}/`, { method: 'GET' });
      setServiceOnline(res.ok);
    } catch {
      setServiceOnline(false);
    }
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
    canvas.width  = videoRef.current.videoWidth  || 640;
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

  const runSearch = async (imgDataUrl) => {
    setIsSearching(true);
    setSearchResults([]);
    setSearchDone(false);
    setErrorMsg('');

    try {
      const { results: apiResults } = await searchByImageAPI(imgDataUrl, highAccuracy, 10);

      if (!apiResults || apiResults.length === 0) {
        setSearchDone(true);
        setSearchResults([]);
        return;
      }

      const barcodes = apiResults.map(r => r.barcode);
      const [productsRes, priceRes] = await Promise.all([
        supabase
          .from('master_data')
          .select('barcode, item_name, product_name_la, category_1, category_2')
          .in('barcode', barcodes),
        supabase
          .from('price_checker')
          .select('barcode, price, product_name')
          .in('barcode', barcodes)
      ]);

      const productMap = {};
      (productsRes.data || []).forEach(p => { productMap[p.barcode] = p; });

      const priceMap = {};
      (priceRes.data || []).forEach(p => { 
        if (p.barcode && p.price !== undefined && p.price !== null) {
          priceMap[p.barcode] = p.price;
        }
      });

      const results = apiResults.map(r => {
        const p   = productMap[r.barcode] || {};
        const pct = Math.min(Math.max(Math.round(r.similarity * 100), 5), 99);
        const price = priceMap[r.barcode];
        return {
          barcode:        r.barcode,
          item_name:      p.item_name || r.barcode,
          product_name_la: p.product_name_la || '',
          category_1:     p.category_1 || '',
          category_2:     p.category_2 || '',
          price:          price !== undefined ? price : null,
          confidence:     pct,
          image_url:      r.image_url || getProductImageUrl(r.barcode),
          inMasterData:   !!p.barcode,
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
    setSearchResults([]);
    setSearchDone(false);
    setErrorMsg('');
  };

  // ── Access denied ──────────────────────────────────────────────────────────
  if (!isHQ) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
          <AlertCircle size={26} className="text-slate-400" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">ບໍ່ມີສິດເຂົ້າໃຊ້</h2>
        <p className="text-sm text-slate-400 max-w-xs mb-6 leading-relaxed">
          ຟັງຊັນຄົ້ນຫາດ້ວຍຮູບພາບໃຊ້ໄດ້ສະເພາະພະນັກງານ HQ ເທົ່ານັ້ນ
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium transition"
          >
            ກັບຄືນ
          </button>
        )}
      </div>
    );
  }

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
            <h1 className="text-sm font-semibold text-white leading-tight truncate">ຄົ້ນຫາດ້ວຍຮູບ</h1>
            <p className="text-[11px] text-slate-500 truncate">Joah Lens · {branchId}</p>
          </div>
        </div>

        {/* Service indicator */}
        <div className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${
          serviceOnline === true  ? 'border-emerald-800 bg-emerald-950 text-emerald-400' :
          serviceOnline === false ? 'border-red-800 bg-red-950 text-red-400' :
          'border-slate-700 bg-slate-800 text-slate-500'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            serviceOnline === true ? 'bg-emerald-400' : serviceOnline === false ? 'bg-red-400' : 'bg-slate-500 animate-pulse'
          }`} />
          {serviceOnline === true ? 'ພ້ອມໃຊ້ງານ' : serviceOnline === false ? 'ບໍ່ສາມາດເຊື່ອມຕໍ່ໄດ້' : 'ກຳລັງກວດສອບ...'}
        </div>
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
                    src={imagePreview}
                    alt="ຮູບທີ່ເລືອກ"
                    className="w-full aspect-[4/3] object-contain bg-slate-950 block"
                  />
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
                    disabled={serviceOnline === false}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-white transition disabled:opacity-40"
                  >
                    <Camera size={16} />
                    ເປີດກ້ອງ
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={serviceOnline === false}
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

          </div>

          {/* ── Right: Results ───────────────────────────────────────────── */}
          <div className="md:col-span-7 flex flex-col gap-4">

            {/* Results header */}
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">ຜົນການຄົ້ນຫາ</h2>
              {searchResults.length > 0 && (
                <span className="text-xs font-medium text-slate-500">{searchResults.length} ລາຍການ</span>
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
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    className="group bg-slate-900 border border-slate-800 hover:border-slate-600 rounded-xl p-3.5 flex gap-3.5 transition cursor-pointer"
                    onClick={() => onSelectProduct?.(item)}
                  >
                    {/* Product thumbnail */}
                    <div className="shrink-0 w-14 h-14 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">
                      <img
                        src={item.image_url}
                        alt={item.barcode}
                        onError={(e) => handleImageError(e, item.barcode)}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-white text-sm leading-snug truncate">{item.item_name}</p>
                        {/* Confidence badge */}
                        <span className={`shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          item.confidence >= 80
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

          </div>
        </div>
      </div>
    </div>
  );
}
