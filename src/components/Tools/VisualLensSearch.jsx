/**
 * VisualLensSearch — Google Lens-style visual product search
 * 100% browser-side. No external API.
 * Uses TensorFlow.js + MobileNet to extract image embeddings,
 * then cosine similarity to find the closest product images in the bucket.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, Upload, Search, Sparkles, RefreshCw, X,
  ExternalLink, Tag, Layers, CheckCircle2, AlertCircle,
  Copy, Scan, Cpu, ZoomIn
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { getProductImageUrl, handleImageError } from '../../utils/productImageUtils';

// ─── TF.js lazy-loaded so it doesn't block the initial render ─────────────
let tfModule = null;
let mobilenetModule = null;
let loadedModel = null;

async function loadTFModel(onProgress) {
  if (loadedModel) return loadedModel;
  onProgress('ໂຫລດ TensorFlow.js...');
  if (!tfModule) {
    tfModule = await import('@tensorflow/tfjs');
    await tfModule.ready();
  }
  onProgress('ໂຫລດ MobileNet model (~8 MB ຄັ້ງທຳອິດ)...');
  if (!mobilenetModule) {
    mobilenetModule = await import('@tensorflow-models/mobilenet');
  }
  loadedModel = await mobilenetModule.load({ version: 2, alpha: 0.5 });
  onProgress('Model ພ້ອມໃຊ້ງານ ✓');
  return loadedModel;
}

// Extract 1024-dim embedding from an <img> or <canvas> element
async function extractEmbedding(model, imageEl) {
  const embedding = model.infer(imageEl, /* embedding= */ true);
  const data = await embedding.data();
  embedding.dispose();
  return Array.from(data);
}

// Cosine similarity between two vectors
function cosineSim(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// Load an image URL into an HTMLImageElement (with crossOrigin)
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function VisualLensSearch({ onBack, onSelectProduct, branchId = 'ໂພນຕ້ອງ' }) {
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchStatus, setSearchStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Bucket images + their cached embeddings
  const [allImages, setAllImages] = useState([]);
  const [isLoadingImages, setIsLoadingImages] = useState(true);
  const [embeddingCache, setEmbeddingCache] = useState({}); // barcode → vector
  const [modelReady, setModelReady] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState('');
  const [indexedCount, setIndexedCount] = useState(0);

  const [cameraActive, setCameraActive] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const modelRef = useRef(null);
  const cacheRef = useRef({}); // live ref so indexing loop can read latest

  // ── 1. Fetch bucket images list ──────────────────────────────────────────
  useEffect(() => {
    fetchBucketImages();
    return () => stopCamera();
  }, []);

  async function fetchBucketImages() {
    setIsLoadingImages(true);
    try {
      const { data, error } = await supabase.storage
        .from('product-images')
        .list('', { limit: 1000, sortBy: { column: 'name', order: 'asc' } });
      if (error) throw error;
      const valid = (data || [])
        .filter(f => f.name && !f.name.startsWith('.'))
        .map(f => ({
          fileName: f.name,
          barcode: f.name.replace(/\.[^/.]+$/, ''),
          size: f.metadata?.size || 0
        }));
      setAllImages(valid);
    } catch (err) {
      console.error('Bucket list error:', err);
    } finally {
      setIsLoadingImages(false);
    }
  }

  // ── 2. Load TF model + index bucket images ───────────────────────────────
  const initModelAndIndex = useCallback(async () => {
    if (modelLoading || modelReady) return;
    setModelLoading(true);
    setErrorMsg('');
    try {
      const model = await loadTFModel(msg => setIndexingProgress(msg));
      modelRef.current = model;
      setModelReady(true);

      // Pre-compute embeddings for images in bucket
      const images = allImages.slice(0, 150); // limit to 150 for client memory
      setIndexingProgress(`ກຳລັງວິເຄາະຮູບ 0 / ${images.length}...`);

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (cacheRef.current[img.barcode]) continue; // already done
        try {
          const el = await loadImage(getProductImageUrl(img.barcode));
          const vec = await extractEmbedding(model, el);
          cacheRef.current[img.barcode] = vec;
          setIndexedCount(i + 1);
          if ((i + 1) % 5 === 0 || i === images.length - 1) {
            setEmbeddingCache({ ...cacheRef.current });
            setIndexingProgress(`ວິເຄາະຮູບ ${i + 1} / ${images.length}...`);
          }
        } catch {
          // Image load failed (e.g. CORS or 404) — skip
        }
        // Yield to browser UI
        if (i % 3 === 0) await new Promise(r => setTimeout(r, 0));
      }

      setIndexingProgress(`ພ້ອມແລ້ວ! ວິເຄາະ ${Object.keys(cacheRef.current).length} ຮູບສຳເລັດ ✓`);
    } catch (err) {
      console.error('TF init error:', err);
      setErrorMsg('ໂຫຼດ AI model ບໍ່ໄດ້: ' + err.message);
    } finally {
      setModelLoading(false);
    }
  }, [allImages, modelLoading, modelReady]);

  // ── 3. Camera ────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      setCameraActive(true);
      setErrorMsg('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      setErrorMsg('ບໍ່ສາມາດເປີດກ້ອງ: ' + (err.message || 'ກວດສິດການເຂົ້າເຖິງ'));
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setImagePreview(dataUrl);
    setSelectedImage(dataUrl);
    stopCamera();
    performVisualSearch(dataUrl);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setImagePreview(dataUrl);
      setSelectedImage(dataUrl);
      performVisualSearch(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // ── 4. Core: Visual Similarity Search ────────────────────────────────────
  const performVisualSearch = async (imgDataUrl) => {
    setIsSearching(true);
    setSearchResults([]);
    setErrorMsg('');
    setSearchStatus('');

    try {
      // Ensure model is loaded
      let model = modelRef.current;
      if (!model) {
        setSearchStatus('ກຳລັງໂຫຼດ AI model...');
        model = await loadTFModel(msg => setSearchStatus(msg));
        modelRef.current = model;
        setModelReady(true);
      }

      setSearchStatus('ກຳລັງວິເຄາະຈຸດເດັ່ນຂອງຮູບ (Feature Extraction)...');

      // Extract embedding vector from user photo
      const queryImg = await loadImage(imgDataUrl);
      const queryVec = await extractEmbedding(model, queryImg);

      // Compare with all cached embeddings
      const cache = cacheRef.current;
      const cacheEntries = Object.entries(cache);

      if (cacheEntries.length === 0) {
        // Fallback: If cache empty, notify user to init
        setSearchStatus('ຍັງບໍ່ທັນມີດັດສະນີຮູບໃນລະບົບ (ກະລຸນາກົດ "ເລີ່ມ AI" ເພື່ອດຶງຮູບສິນຄ້າ)');
        return;
      }

      setSearchStatus('ກຳລັງປຽບທຽບຄວາມຄືກັນ (Cosine Similarity)...');
      const scores = cacheEntries
        .map(([barcode, vec]) => ({ barcode, score: cosineSim(queryVec, vec) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      if (scores.length === 0) {
        setSearchStatus('ບໍ່ພົບສິນຄ້າທີ່ມີຮູບຄ້າຍຄືກັນ');
        return;
      }

      setSearchStatus(`ພົບສິນຄ້າຄ້າຍຄືກັນ ${scores.length} ລາຍການ — ກຳລັງດຶງ master_data...`);

      // Fetch master_data info
      const barcodes = scores.map(s => s.barcode);
      const { data: products } = await supabase
        .from('master_data')
        .select('barcode, item_name, product_name_la, category_1, category_2')
        .in('barcode', barcodes);

      const productMap = {};
      (products || []).forEach(p => { productMap[p.barcode] = p; });

      const results = scores.map(s => {
        const p = productMap[s.barcode] || {};
        return {
          barcode: s.barcode,
          item_name: p.item_name || `ສິນຄ້າ ${s.barcode}`,
          product_name_la: p.product_name_la || '',
          category_1: p.category_1 || '',
          category_2: p.category_2 || '',
          confidence: Math.min(Math.max(Math.round(s.score * 100), 10), 99),
          matchReason: `ຄວາມຄືກັນຂອງຮູບ ${Math.round(s.score * 100)}%`,
          image_url: getProductImageUrl(s.barcode),
          inMasterData: !!p.barcode
        };
      });

      setSearchResults(results);
      setSearchStatus(`ພົບ ${results.length} ລາຍການທີ່ຄ້າຍຄືກັນທີ່ສຸດ`);
    } catch (err) {
      console.error('Visual search error:', err);
      setErrorMsg('ຄົ້ນຫາລົ້ມເຫຼວ: ' + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const copyBarcode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedBarcode(code);
    setTimeout(() => setCopiedBarcode(null), 2000);
  };

  const totalIndexed = Object.keys(embeddingCache).length;
  const indexingDone = modelReady && !modelLoading && totalIndexed > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="px-6 py-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-800 transition text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Scan size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white leading-tight">Visual Lens Search (Pure In-Browser AI)</h1>
            <p className="text-[11px] text-slate-400">ຄົ້ນຫາສິນຄ້າຈາກຮູບໂດຍກົງດ້ວຍ TensorFlow MobileNet (ບໍ່ຜ່ານ API ພາຍນອກ)</p>
          </div>
        </div>

        {/* Model status badge */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
          indexingDone
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : modelLoading
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-slate-800 border-slate-700 text-slate-400'
        }`}>
          <Cpu size={13} className={modelLoading ? 'animate-pulse' : ''} />
          {indexingDone
            ? `AI ພ້ອມ · ${totalIndexed} ຮູບ`
            : modelLoading
            ? indexingProgress || 'ກຳລັງໂຫຼດ...'
            : 'ກົດ "ເລີ່ມ AI" ກ່ອນຄົ້ນຫາ'}
        </div>
      </header>

      {/* Error display */}
      {errorMsg && (
        <div className="mx-6 mt-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-6">

          {/* LEFT COLUMN: Controls & Input */}
          <div className="md:col-span-5 space-y-4">

            {/* AI Model Starter Card */}
            {!indexingDone && (
              <div className="bg-gradient-to-br from-violet-900/40 to-indigo-900/30 border border-violet-500/30 rounded-3xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Cpu size={20} className="text-violet-300" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">Browser Visual AI Engine</p>
                    <p className="text-xs text-slate-400">ວິເຄາະລັກສະນະຮູບດ້ວຍ MobileNet ພາຍໃນເຄື່ອງ 100%</p>
                  </div>
                </div>

                {modelLoading ? (
                  <div className="space-y-2">
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 animate-pulse rounded-full" style={{ width: `${Math.min((indexedCount / Math.max(allImages.length, 1)) * 100, 100)}%` }} />
                    </div>
                    <p className="text-xs text-slate-400 text-center">{indexingProgress}</p>
                  </div>
                ) : (
                  <button
                    onClick={initModelAndIndex}
                    disabled={isLoadingImages || allImages.length === 0}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:opacity-90 transition disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-violet-500/20"
                  >
                    <Sparkles size={15} />
                    {isLoadingImages ? 'ກຳລັງດຶງລາຍການຮູບ...' : `ກົດເລີ່ມ AI ເພື່ອອ່ານຮູບທັງໝົດ (${allImages.length} ຮູບ)`}
                  </button>
                )}
              </div>
            )}

            {/* Camera / Upload Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              {cameraActive ? (
                <div className="relative">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full aspect-video object-cover bg-black" />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-violet-400/80 rounded-2xl animate-pulse" />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button onClick={stopCamera} className="px-4 py-2 rounded-xl bg-slate-900/80 text-slate-300 text-sm border border-slate-700 hover:border-slate-500 transition">
                      <X size={16} />
                    </button>
                    <button onClick={capturePhoto} className="px-6 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-500 transition shadow-lg shadow-violet-500/30">
                      <Camera size={18} />
                    </button>
                  </div>
                </div>
              ) : imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="query" className="w-full aspect-video object-contain bg-slate-950" />
                  <button
                    onClick={() => { setImagePreview(null); setSelectedImage(null); setSearchResults([]); setSearchStatus(''); }}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 hover:text-white border border-slate-700 transition"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center gap-4 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center border border-slate-700">
                    <ZoomIn size={28} className="text-violet-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-200 text-sm">ຖ່າຍ ຫຼື ອັບໂຫຼດຮູບສິນຄ້າທີ່ຕ້ອງການຫາ</p>
                    <p className="text-xs text-slate-500 mt-1">ລະບົບຈະຄິດໄລ່ vector ຮູບພາບ ແລ້ວທຽບກັບຮູບໃນ Storage</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!cameraActive && (
                <div className="p-4 border-t border-slate-800 grid grid-cols-2 gap-3">
                  <button
                    onClick={startCamera}
                    disabled={!indexingDone}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition disabled:opacity-40"
                  >
                    <Camera size={16} /> ເປີດກ້ອງຖ່າຍ
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!indexingDone}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-300 border border-violet-500/30 text-sm font-medium transition disabled:opacity-40"
                  >
                    <Upload size={16} /> ເລືອກຮູບ
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>
              )}
            </div>

            {/* Test Samples from Bucket */}
            {indexingDone && allImages.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4">
                <p className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-400" />
                  ທົດສອບຄົ້ນຫາດ້ວຍຮູບໃນລະບົບ:
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {allImages.slice(0, 8).map((img, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        const url = getProductImageUrl(img.barcode);
                        setImagePreview(url);
                        setSelectedImage(url);
                        performVisualSearch(url);
                      }}
                      className="aspect-square rounded-xl bg-slate-950 border border-slate-800 hover:border-violet-500 p-1 overflow-hidden transition group relative"
                    >
                      <img
                        src={getProductImageUrl(img.barcode)}
                        alt={img.barcode}
                        onError={(e) => handleImageError(e, img.barcode)}
                        className="w-full h-full object-contain group-hover:scale-105 transition"
                      />
                      <span className="absolute bottom-1 right-1 px-1 rounded bg-black/70 text-[9px] font-mono text-slate-300">
                        {img.barcode.slice(-4)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Results Section */}
          <div className="md:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Search size={18} className="text-violet-400" />
                ຜົນການຄົ້ນຫາດ້ວຍລັກສະນະຮູບ (Visual Match)
              </h2>
              {searchResults.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  {searchResults.length}
                </span>
              )}
            </div>

            {/* Status Display */}
            {(isSearching || searchStatus) && (
              <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm border ${
                isSearching
                  ? 'bg-violet-500/10 border-violet-500/20 text-violet-300'
                  : searchResults.length > 0
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {isSearching
                  ? <RefreshCw size={15} className="animate-spin shrink-0" />
                  : searchResults.length > 0
                  ? <CheckCircle2 size={15} className="shrink-0" />
                  : <AlertCircle size={15} className="shrink-0" />}
                {searchStatus}
              </div>
            )}

            {/* Empty view */}
            {!isSearching && searchResults.length === 0 && !searchStatus && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center mb-4 border border-slate-800">
                  <Scan size={36} className="text-slate-600" />
                </div>
                <p className="text-slate-400 text-sm font-medium">
                  {!indexingDone ? 'ກະລຸນາກົດ "ເລີ່ມ AI" ເພື່ອດຶงລັກສະນະຮູບກ່ອນ' : 'ຖ່າຍຮູບ ຫຼື ເລືອກຮູບເພື່ອຄົ້ນຫາ'}
                </p>
                <p className="text-slate-600 text-xs mt-1">ລະບົບຈະຄິດໄລ່ຄວາມຄ້າຍຄືກັນ 100% ຜ່ານ browser</p>
              </div>
            )}

            {/* Matching Results Cards */}
            <div className="space-y-3">
              {searchResults.map((item, idx) => (
                <div
                  key={idx}
                  className="group bg-slate-900 border border-slate-800 hover:border-violet-500/50 rounded-2xl p-4 flex gap-4 transition cursor-pointer"
                  onClick={() => onSelectProduct?.(item)}
                >
                  {/* Rank */}
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      idx === 0 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      idx === 1 ? 'bg-slate-500/20 text-slate-300' :
                      idx === 2 ? 'bg-orange-700/20 text-orange-400' :
                      'bg-slate-800 text-slate-500'
                    }`}>
                      #{idx + 1}
                    </span>
                    <div className={`w-2 h-2 rounded-full ${item.confidence >= 80 ? 'bg-emerald-400' : item.confidence >= 60 ? 'bg-amber-400' : 'bg-red-400'}`} />
                  </div>

                  {/* Product Image */}
                  <div className="shrink-0 w-16 h-16 rounded-xl bg-slate-950 border border-slate-700 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.barcode}
                      onError={(e) => handleImageError(e, item.barcode)}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{item.item_name}</p>
                    {item.product_name_la && (
                      <p className="text-xs text-slate-400 truncate">{item.product_name_la}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {item.category_1 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                          <Layers size={9} /> {item.category_1}
                        </span>
                      )}
                      {!item.inMasterData && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ບໍ່ມີໃນ master_data
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-violet-400 font-medium mt-1">{item.matchReason}</p>
                  </div>

                  {/* Similarity Badge & Barcode */}
                  <div className="shrink-0 flex flex-col items-end justify-between">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      item.confidence >= 80 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                      item.confidence >= 60 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {item.confidence}% Match
                    </span>
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={e => { e.stopPropagation(); copyBarcode(item.barcode); }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                        title="Copy barcode"
                      >
                        {copiedBarcode === item.barcode ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); onSelectProduct?.(item); }}
                        className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 text-violet-400 hover:text-violet-200 transition"
                        title="Select product"
                      >
                        <ExternalLink size={13} />
                      </button>
                    </div>
                    <p className="text-[9px] font-mono text-slate-600 mt-1">{item.barcode}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
