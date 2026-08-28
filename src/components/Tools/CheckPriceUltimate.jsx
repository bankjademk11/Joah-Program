import React, { useState, useEffect, useRef } from 'react';
import { 
    ScanLine, Search, AlertCircle, RefreshCw, ChevronLeft, CheckCircle2, 
    Camera, Package, Layers, ShieldCheck, DollarSign, Store, Eye, 
    Maximize2, X, Boxes, Truck, ShoppingCart, Info, Sparkles, Flame,
    Zap, Award, Terminal, Crosshair, Activity, Radio
} from 'lucide-react';
import joahLogo from '../../assets/Joah.jpeg';
import priceBackground from '../../assets/Priceweb-background.webp';
import BarcodeScannerModal from '../ui/BarcodeScannerModal';
import sfxOK from '../../assets/RequestOK.mp3';
import sfxError from '../../assets/RequestEror.mp3';
import { fetchProductUltimate } from '../../services/odooApi';
import { supabase } from '../../utils/supabaseClient';

const CheckPriceUltimate = ({ onBack, isOdooLoggedIn = false }) => {
    const [scanState, setScanState] = useState('idle'); // idle, loading, success, error
    const [productData, setProductData] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [manualInput, setManualInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const [showCostPrice, setShowCostPrice] = useState(false);
    const [zoomImage, setZoomImage] = useState(false);
    const [imageError, setImageError] = useState(false);

    const manualInputRef = useRef(null);
    const timerRef = useRef(null);
    const scanBufferRef = useRef('');
    const scanTimeoutRef = useRef(null);

    // Auto-focus manual input for hardware scanners
    useEffect(() => {
        if (manualInputRef.current && scanState === 'idle') {
            manualInputRef.current.focus();
        }
    }, [scanState]);

    // Global Key listener for Barcode Scanner guns
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (document.activeElement === manualInputRef.current) return;

            if (e.key === 'Enter') {
                const buf = scanBufferRef.current.trim();
                if (buf) {
                    handleScan(buf);
                    scanBufferRef.current = '';
                }
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            } else if (e.key.length === 1) {
                scanBufferRef.current += e.key;
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                scanTimeoutRef.current = setTimeout(() => {
                    scanBufferRef.current = '';
                }, 300);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleScan = async (code) => {
        if (!code || !code.trim()) return;
        const cleanCode = code.trim();
        
        if (timerRef.current) clearTimeout(timerRef.current);
        setScanState('loading');
        setProductData(null);
        setErrorMessage('');
        setImageError(false);

        try {
            // 1. Fetch live Odoo rich data
            const odooData = await fetchProductUltimate(cleanCode);

            // 2. Fetch Lao Name from Supabase price_checker or master_products table as priority for 100% accurate Lao translation
            let laoName = odooData?.product_name_la || '';
            
            try {
                const { data: supaData } = await supabase
                    .from('price_checker')
                    .select('product_name, barcode')
                    .or(`barcode.eq.${cleanCode},barcode.eq.${odooData?.barcode || cleanCode}`)
                    .limit(1)
                    .maybeSingle();

                if (supaData && supaData.product_name) {
                    laoName = supaData.product_name;
                }
            } catch (supaErr) {
                console.warn('Supabase lao name lookup error:', supaErr);
            }

            if (!odooData && !laoName) {
                throw new Error('ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ Odoo / Product Not Found');
            }

            const combinedData = {
                ...(odooData || {}),
                barcode: odooData?.barcode || cleanCode,
                displayLaoName: laoName || odooData?.product_name_la || odooData?.name || 'ສິນຄ້າບໍ່ມີຊື່ພາສາລາວ',
                englishName: odooData?.name || odooData?.product_name_eng || ''
            };

            setProductData(combinedData);
            setScanState('success');
            new Audio(sfxOK).play().catch(() => {});
        } catch (err) {
            console.error('CheckPriceUltimate scan error:', err);
            setErrorMessage(err.message || 'ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ');
            setScanState('error');
            new Audio(sfxError).play().catch(() => {});
        }

        // Auto reset after 15 seconds
        timerRef.current = setTimeout(resetState, 15000);
    };

    const resetState = () => {
        setScanState('idle');
        setProductData(null);
        setErrorMessage('');
        setShowCostPrice(false);
        setZoomImage(false);
        setImageError(false);
        scanBufferRef.current = '';
        if (timerRef.current) clearTimeout(timerRef.current);
        setTimeout(() => manualInputRef.current?.focus(), 100);
    };

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualInput.trim()) {
            handleScan(manualInput.trim());
            setManualInput('');
        }
    };

    const formatPrice = (price) => {
        if (price === undefined || price === null) return '0';
        return new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
    };

    const formatQty = (qty) => {
        if (qty === undefined || qty === null) return '0';
        return Number(qty).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    };

    const getProductImageUrl = (item) => {
        if (!item) return null;
        if (item.image_url) return item.image_url;
        if (item.image_512) return `data:image/png;base64,${item.image_512}`;
        if (item.image_1920) return `data:image/png;base64,${item.image_1920}`;
        if (item.image_128) return `data:image/png;base64,${item.image_128}`;
        if (item.barcode) return `https://avqdpddpomlapxcqxnmk.supabase.co/storage/v1/object/public/product-images/${item.barcode}.png`;
        if (item.id) return `/api/web/image?model=product.template&id=${item.id}&field=image_512`;
        return null;
    };

    const getZoomImageUrl = (item) => {
        if (!item) return null;
        if (item.image_url) return item.image_url;
        if (item.image_1920) return `data:image/png;base64,${item.image_1920}`;
        if (item.image_512) return `data:image/png;base64,${item.image_512}`;
        if (item.barcode) return `https://avqdpddpomlapxcqxnmk.supabase.co/storage/v1/object/public/product-images/${item.barcode}.png`;
        if (item.id) return `/api/web/image?model=product.template&id=${item.id}&field=image_1920`;
        return null;
    };

    const imageUrl = productData ? getProductImageUrl(productData) : null;
    const zoomUrl = productData ? (getZoomImageUrl(productData) || imageUrl) : null;

    return (
        <div
            className="fixed inset-0 z-[1000] flex flex-col overflow-hidden bg-[#05020c] text-slate-100 select-none font-lao"
            style={{ fontFamily: "'Noto Sans Lao', 'Outfit', sans-serif" }}
        >
            {/* Google Fonts: Noto Sans Lao with high weights */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wght@300;400;500;600;700;800;900&family=Outfit:wght@400;600;800;900&display=swap" rel="stylesheet" />

            {/* 🌌 High-Def Magic Rune Background Integration */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                {/* Wallpaper */}
                <img 
                    src={priceBackground} 
                    alt="Price Checker Realm" 
                    className="w-full h-full object-cover object-bottom filter saturate-125 brightness-95" 
                />
                
                {/* Deep Gradient Atmosphere Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-slate-950/70" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#05020c_90%)]" />

                {/* Ambient Rune Magic Glows */}
                <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/25 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '3.5s' }} />
                <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[250px] bg-fuchsia-600/15 rounded-full blur-[100px]" />
                
                {/* Subtle Magic Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px] pointer-events-none" />
            </div>

            {/* ── HEADER ── */}
            <header className="relative z-10 flex items-center justify-between px-4 py-3 sm:px-8 border-b border-purple-500/20 bg-slate-950/70 backdrop-blur-2xl shadow-[0_4px_30px_rgba(168,85,247,0.15)]">
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-950/50 hover:bg-purple-900/70 text-purple-200 hover:text-white transition-all text-xs font-bold border border-purple-500/30 hover:border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                >
                    <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform text-purple-400" />
                    <span className="font-semibold">ກັບຄືນ</span>
                </button>

                {/* Center Title */}
                <div className="flex items-center gap-3.5">
                    <div className="relative">
                        <img
                            src={joahLogo}
                            alt="Joah"
                            className="h-9 sm:h-10 w-auto object-contain rounded-lg border border-purple-400/40 shadow-[0_0_15px_rgba(192,132,252,0.4)]"
                        />
                        <div className="absolute -inset-0.5 rounded-lg bg-purple-500/30 blur-sm -z-10" />
                    </div>
                    <div className="flex flex-col text-left">
                        <div className="flex items-center gap-2">
                            <span className="text-base sm:text-lg font-black tracking-tight text-white [text-shadow:0_0_15px_rgba(192,132,252,0.6)]">
                                PRICE CHECKER
                            </span>
                            <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 text-white border border-purple-300/40 shadow-[0_0_15px_rgba(168,85,247,0.5)] animate-pulse">
                                ULTIMATE
                            </span>
                        </div>
                        <p className="text-[10px] text-purple-200/70 font-medium hidden sm:block">
                            ກວດສອບລາຄາ & ຂໍ້ມູນສິນຄ້າລະອຽດ (HQ Odoo Direct)
                        </p>
                    </div>
                </div>

                {/* Right Status Badge */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-950/70 border border-purple-400/40 text-purple-300 text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-400"></span>
                        </span>
                        <span className="hidden sm:inline">Odoo Live Connected</span>
                    </div>
                </div>
            </header>

            {/* ── MAIN CONTENT ── */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 overflow-y-auto custom-scrollbar">

                {/* 1. IDLE STATE: MAGIC RUNE PORTAL SCANNER */}
                {scanState === 'idle' && (
                    <div className="flex flex-col items-center gap-6 w-full max-w-xl animate-in fade-in zoom-in-95 duration-400">
                        
                        {/* Dimensional Hologram Scanner matching Wallpaper Rune Portal */}
                        <div className="relative flex items-center justify-center w-52 h-52 sm:w-64 sm:h-64">
                            {/* Outer Rune Magic Ring */}
                            <div className="absolute inset-0 rounded-full border-2 border-dashed border-purple-400/40 animate-[spin_25s_linear_infinite]" />
                            {/* Inner Arcane Ring */}
                            <div className="absolute inset-3 rounded-full border border-fuchsia-400/40 animate-[spin_14s_linear_infinite_reverse]" />
                            <div className="absolute inset-6 rounded-full border-2 border-purple-300/30 animate-ping" style={{ animationDuration: '3.5s' }} />
                            
                            {/* Core Crystal Disc */}
                            <div className="absolute inset-8 rounded-full bg-gradient-to-b from-purple-950/90 via-slate-950/90 to-black backdrop-blur-2xl border-2 border-purple-400/60 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(168,85,247,0.5)]">
                                <div className="p-3.5 rounded-2xl bg-purple-500/15 border border-purple-400/50 text-purple-300 mb-1 shadow-[0_0_25px_rgba(192,132,252,0.4)]">
                                    <ScanLine size={42} strokeWidth={1.75} className="animate-pulse text-purple-300" />
                                </div>
                                <span className="text-[11px] font-bold text-purple-200 tracking-wider uppercase [text-shadow:0_0_10px_rgba(192,132,252,0.9)]">
                                    ກຽມພ້ອມສະແກນ
                                </span>
                            </div>

                            {/* Neon Arcane Purple Laser Bar */}
                            <div
                                className="absolute left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent shadow-[0_0_20px_5px_rgba(217,70,239,1)]"
                                style={{ animation: 'arcaneLaser 2.2s ease-in-out infinite' }}
                            />
                        </div>

                        {/* Title & Instructions */}
                        <div className="text-center space-y-2">
                            <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-100 to-purple-300 tracking-tight leading-tight [text-shadow:0_0_30px_rgba(168,85,247,0.5)]">
                                ກະລຸນາສະແກນບາໂຄ້ດສິນຄ້າ
                            </h1>
                            <p className="text-purple-200/80 text-xs sm:text-sm font-medium max-w-md mx-auto drop-shadow-md">
                                ຍິງບາໂຄ້ດ ຫຼື ພິມລະຫັດສິນຄ້າເພື່ອດຶງຂໍ້ມູນລາຄາ, ຮູບພາບ ແລະ ສະຕັອກທັນທີ
                            </p>
                        </div>

                        {/* Search Input Bar */}
                        <form onSubmit={handleManualSubmit} className="flex gap-2 w-full max-w-md">
                            <div className="relative flex-1 group">
                                <input
                                    ref={manualInputRef}
                                    type="text"
                                    placeholder="ພິມບາໂຄ້ດ ຫຼື SKU ສິນຄ້າ..."
                                    value={manualInput}
                                    onChange={(e) => setManualInput(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3.5 rounded-xl bg-slate-950/80 border border-purple-500/40 text-purple-100 placeholder-purple-400/40 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 text-sm backdrop-blur-2xl transition-all shadow-[inset_0_0_20px_rgba(168,85,247,0.15)] group-hover:border-purple-400"
                                />
                                {manualInput && (
                                    <button
                                        type="button"
                                        onClick={() => setManualInput('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 hover:text-white"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                            <button
                                type="submit"
                                className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shrink-0 shadow-[0_0_25px_rgba(168,85,247,0.5)] active:scale-95 flex items-center gap-2 border border-purple-300/40"
                            >
                                <Search size={18} />
                                <span className="hidden sm:inline text-xs font-semibold">ຄົ້ນຫາ</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                title="ສະແກນດ້ວຍກ້ອງ Optical"
                                className="px-4 py-3.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-300 hover:text-white transition-all shrink-0 active:scale-95 shadow-[0_0_15px_rgba(168,85,247,0.25)] flex items-center justify-center"
                            >
                                <Camera size={20} />
                            </button>
                        </form>

                        {/* Badges */}
                        <div className="flex items-center gap-4 text-[11px] text-purple-300/70">
                            <span className="flex items-center gap-1.5"><ShieldCheck size={14} className="text-purple-400" /> ລະບົບປອດໄພ Read-Only</span>
                            <span className="w-1 h-1 rounded-full bg-purple-400/40" />
                            <span className="flex items-center gap-1.5"><Store size={14} className="text-fuchsia-400" /> Odoo Real-Time</span>
                        </div>
                    </div>
                )}

                {/* 2. LOADING STATE */}
                {scanState === 'loading' && (
                    <div className="flex flex-col items-center gap-5 animate-in fade-in duration-200">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-4 border-purple-500/20 border-t-purple-400 animate-spin" />
                            <div className="absolute inset-3 rounded-full border-4 border-fuchsia-500/20 border-b-fuchsia-300 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }} />
                            <Sparkles size={28} className="text-purple-300 animate-pulse" />
                        </div>
                        <div className="text-center space-y-1.5">
                            <p className="text-purple-200 text-lg font-black tracking-wide [text-shadow:0_0_20px_rgba(168,85,247,0.9)]">
                                ກຳລັງດຶງຂໍ້ມູນຈາກ Odoo...
                            </p>
                            <p className="text-purple-300/70 text-xs">ກຳລັງໂຫຼດຂໍ້ມູນສິນຄ້າ ແລະ ສະຕັອກຫຼ້າສຸດ</p>
                        </div>
                    </div>
                )}

                {/* 3. SUCCESS STATE: HIGH-AESTHETIC GLASS RUNE PRODUCT CARD WITH LAO FONT */}
                {scanState === 'success' && productData && (
                    <div className="w-full max-w-4xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-400">
                        
                        {/* Purple Arcane Glass Card */}
                        <div className="w-full rounded-2xl bg-slate-950/85 backdrop-blur-3xl border-2 border-purple-500/50 overflow-hidden shadow-[0_0_40px_rgba(168,85,247,0.35)] transition-all duration-500 divide-y divide-purple-500/20">
                            
                            {/* Card Top Banner */}
                            <div className="bg-gradient-to-r from-slate-950 via-purple-950/70 to-slate-950 px-5 sm:px-7 py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="px-3 py-0.5 rounded text-[11px] font-black tracking-wider uppercase border border-purple-400/50 bg-purple-500/25 text-purple-200 shadow-sm flex items-center gap-1.5">
                                        <Award size={13} /> {productData.product_brand_id?.display_name || 'JOAH'}
                                    </span>
                                    <span className="text-purple-200/90 text-xs tracking-wider truncate max-w-[200px] sm:max-w-md">
                                        {productData.categ_id ? (Array.isArray(productData.categ_id) ? productData.categ_id[1] : productData.categ_id?.display_name || productData.categ_id) : 'General Product'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 font-mono">
                                    <span className="text-purple-300 text-xs tracking-widest bg-purple-950/90 border border-purple-500/50 px-2.5 py-0.5 rounded">
                                        ID: {productData.default_code || productData.barcode || 'N/A'}
                                    </span>
                                </div>
                            </div>

                            {/* Middle Grid: Image Artifact Frame + Key Specs */}
                            <div className="p-5 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                
                                {/* Left Col: Product Image Frame (5 cols) */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center">
                                    <div className="relative group w-full max-w-[280px] aspect-square rounded-2xl bg-gradient-to-b from-purple-950/40 via-slate-950/90 to-black border-2 border-purple-500/50 overflow-hidden flex items-center justify-center shadow-[inset_0_0_30px_rgba(168,85,247,0.25)]">
                                        
                                        {/* Arcane Rune Corner Accents */}
                                        <div className="absolute top-1.5 left-1.5 w-3.5 h-3.5 border-t-2 border-l-2 border-purple-400 z-20 pointer-events-none" />
                                        <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 border-t-2 border-r-2 border-purple-400 z-20 pointer-events-none" />
                                        <div className="absolute bottom-1.5 left-1.5 w-3.5 h-3.5 border-b-2 border-l-2 border-purple-400 z-20 pointer-events-none" />
                                        <div className="absolute bottom-1.5 right-1.5 w-3.5 h-3.5 border-b-2 border-r-2 border-purple-400 z-20 pointer-events-none" />

                                        {imageUrl && !imageError ? (
                                            <>
                                                <img
                                                    src={imageUrl}
                                                    alt={productData.displayLaoName}
                                                    onError={() => setImageError(true)}
                                                    className="w-full h-full object-contain p-3 group-hover:scale-105 transition-transform duration-300 drop-shadow-[0_0_20px_rgba(192,132,252,0.5)]"
                                                />
                                                <button
                                                    onClick={() => setZoomImage(true)}
                                                    className="absolute bottom-2.5 right-2.5 p-2 rounded-xl bg-purple-950/90 hover:bg-purple-900 text-purple-200 backdrop-blur-md border border-purple-400/50 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    title="ຂະຫຍາຍຮູບສິນຄ້າ"
                                                >
                                                    <Maximize2 size={16} />
                                                </button>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center gap-2 text-purple-400/50 p-6 text-center font-mono">
                                                <Package size={52} strokeWidth={1} />
                                                <span className="text-xs">ບໍ່ມີຮູບພາບສິນຄ້າ (No Image)</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-3 flex items-center gap-2 font-mono text-xs text-purple-300/80">
                                        <span>Barcode: <strong className="text-purple-100 tracking-wider">{productData.barcode || '-'}</strong></span>
                                    </div>
                                </div>

                                {/* Right Col: Pricing & Crucial Specs (7 cols) */}
                                <div className="md:col-span-7 flex flex-col gap-4">
                                    {/* Lao Product Name (Bold & Crisp Noto Sans Lao) */}
                                    <div className="space-y-1">
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-relaxed tracking-normal [text-shadow:0_0_20px_rgba(255,255,255,0.3)]">
                                            {productData.displayLaoName}
                                        </h2>
                                        {productData.englishName && productData.englishName !== productData.displayLaoName && (
                                            <p className="text-xs text-purple-300/60 font-mono line-clamp-1">
                                                {productData.englishName}
                                            </p>
                                        )}
                                    </div>

                                    {/* Primary Retail Value Display */}
                                    <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/70 via-slate-900/90 to-purple-950/50 border border-purple-400/50 flex items-baseline justify-between shadow-[0_0_25px_rgba(168,85,247,0.25)] relative overflow-hidden">
                                        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-32 h-32 bg-purple-500/20 rounded-full blur-2xl pointer-events-none" />
                                        
                                        <div>
                                            <p className="text-[11px] font-black uppercase tracking-widest text-purple-300 font-mono flex items-center gap-1.5">
                                                <Zap size={14} className="text-purple-400 fill-purple-400" /> ລາຄາຂາຍ / RETAIL PRICE
                                            </p>
                                            <div className="flex items-baseline gap-2 mt-1">
                                                <span className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-fuchsia-200 to-white tracking-tight font-mono tabular-nums [text-shadow:0_0_30px_rgba(192,132,252,0.8)]">
                                                    {formatPrice(productData.list_price)}
                                                </span>
                                                <span className="text-xl sm:text-2xl text-purple-400 font-black">₭</span>
                                            </div>
                                        </div>
                                        <div className="text-right font-mono">
                                            <span className="text-[10px] text-purple-300/70 font-bold uppercase block">ຕໍ່ / PER</span>
                                            <p className="text-base font-black text-purple-200 uppercase">{productData.uom_name || 'Unit'}</p>
                                        </div>
                                    </div>

                                    {/* Key Stats Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 font-mono">
                                        {/* On Hand Stock */}
                                        <div className="p-3 rounded-xl bg-slate-950/90 border border-purple-500/40 flex flex-col shadow-inner">
                                            <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-wider flex items-center gap-1">
                                                <Boxes size={12} className="text-purple-400" /> ສະຕັອກຄົງເຫຼືອ
                                            </span>
                                            <span className={`text-lg font-black mt-0.5 ${productData.qty_available > 0 ? 'text-purple-200' : 'text-rose-400'}`}>
                                                {formatQty(productData.qty_available)} <span className="text-xs font-normal text-slate-400">{productData.uom_name || 'Unit'}</span>
                                            </span>
                                        </div>

                                        {/* Forecasted Virtual Stock */}
                                        <div className="p-3 rounded-xl bg-slate-950/90 border border-purple-500/40 flex flex-col shadow-inner">
                                            <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-wider flex items-center gap-1">
                                                <Layers size={12} className="text-indigo-400" /> ຄາດການ
                                            </span>
                                            <span className="text-lg font-black mt-0.5 text-indigo-300">
                                                {formatQty(productData.virtual_available)} <span className="text-xs font-normal text-slate-400">{productData.uom_name || 'Unit'}</span>
                                            </span>
                                        </div>

                                        {/* Packing Size */}
                                        <div className="p-3 rounded-xl bg-slate-950/90 border border-purple-500/40 flex flex-col col-span-2 sm:col-span-1 shadow-inner">
                                            <span className="text-[10px] font-bold text-purple-300/80 uppercase tracking-wider flex items-center gap-1">
                                                <Package size={12} className="text-amber-400" /> ຂະໜາດບັນຈຸ
                                            </span>
                                            <span className="text-lg font-black mt-0.5 text-amber-300">
                                                {productData.packing_size || '1x1'}
                                            </span>
                                        </div>
                                    </div>

                                </div>
                            </div>

                            {/* Logistics & Supplier Drawer */}
                            <div className="p-5 sm:p-6 bg-black/70 font-mono">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                                    <div className="space-y-1">
                                        <span className="text-purple-400/70 font-bold uppercase tracking-wider block text-[10px]">DC Min Stock</span>
                                        <span className="font-bold text-slate-200 text-sm">
                                            {productData.dc_min_stock ? `${productData.dc_min_stock} Unit` : '-'}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-purple-400/70 font-bold uppercase tracking-wider block text-[10px]">Min Order Qty</span>
                                        <span className="font-bold text-slate-200 text-sm">
                                            {productData.min_order_pcs ? `${productData.min_order_pcs} Pcs` : '-'}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-purple-400/70 font-bold uppercase tracking-wider block text-[10px]">POS Status</span>
                                        <span className={`inline-flex items-center gap-1 font-bold ${productData.available_in_pos ? 'text-purple-300' : 'text-slate-500'}`}>
                                            <Store size={14} /> {productData.available_in_pos ? 'Available in POS' : 'No POS'}
                                        </span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-purple-400/70 font-bold uppercase tracking-wider block text-[10px]">Vendor / Owner</span>
                                        <span className="font-bold text-slate-200 truncate block text-sm" title={productData.product_owner?.display_name || '-'}>
                                            {productData.product_owner?.display_name || productData.vendor_code || '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Cost Data Toggle */}
                                <div className="mt-4 pt-4 border-t border-purple-500/20 flex items-center justify-between">
                                    <button
                                        onClick={() => setShowCostPrice(!showCostPrice)}
                                        className="text-xs text-purple-400/80 hover:text-purple-200 flex items-center gap-1.5 transition-colors font-mono"
                                    >
                                        <Eye size={14} />
                                        <span>{showCostPrice ? 'ເຊື່ອງຕົ້ນທຶນ (Hide Cost)' : 'ສະແດງຕົ້ນທຶນ (Show Cost)'}</span>
                                    </button>

                                    {showCostPrice && (
                                        <div className="flex items-center gap-2 animate-in fade-in font-mono">
                                            <span className="text-xs text-purple-400/70">Standard Cost:</span>
                                            <span className="text-sm font-bold text-amber-400 [text-shadow:0_0_12px_rgba(251,191,36,0.6)]">
                                                {formatPrice(productData.standard_price)} ₭
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Reset / Next Scan Button */}
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={resetState}
                                className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-[0_0_30px_rgba(168,85,247,0.5)] active:scale-95 text-xs tracking-wider border border-purple-300/40"
                            >
                                <RefreshCw size={16} />
                                ສະແກນສິນຄ້າຕໍ່ໄປ (Scan Next)
                            </button>
                        </div>
                    </div>
                )}

                {/* 4. ERROR STATE */}
                {scanState === 'error' && (
                    <div className="w-full max-w-md flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-full rounded-2xl bg-slate-950/90 backdrop-blur-2xl border-2 border-rose-500/50 overflow-hidden shadow-[0_0_35px_rgba(244,63,94,0.35)]">
                            <div className="h-1.5 w-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,1)]" />
                            <div className="px-8 py-10 flex flex-col items-center gap-4 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center text-rose-400 mb-1 shadow-[0_0_20px_rgba(244,63,94,0.4)]">
                                    <AlertCircle size={36} />
                                </div>
                                <h2 className="text-2xl font-bold text-white">ບໍ່ພົບຂໍ້ມູນໃນ Odoo</h2>
                                <p className="text-slate-300 text-sm">{errorMessage}</p>
                                <p className="text-slate-500 text-xs mt-2">ກະລຸນາກວດສອບບາໂຄ້ດ ຫຼື ລອງໃໝ່ອີກຄັ້ງ</p>
                            </div>
                        </div>
                        <button
                            onClick={resetState}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 font-bold transition-all border border-purple-500/40 active:scale-95 text-xs tracking-wider"
                        >
                            <RefreshCw size={16} />
                            ລອງໃໝ່ອີກຄັ້ງ (Try Again)
                        </button>
                    </div>
                )}

            </main>

            {/* ── FOOTER ── */}
            <footer className="relative z-10 py-3 px-6 text-center border-t border-purple-500/20 bg-slate-950/80 backdrop-blur-md flex items-center justify-between text-xs text-purple-400/50 font-mono">
                <span>Joy of a Home · Price Checker Ultimate</span>
                <span className="hidden sm:inline">Odoo 17 Read-Only</span>
            </footer>

            {/* Camera Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onDetected={(barcode) => {
                        setShowScanner(false);
                        handleScan(barcode);
                    }}
                    onClose={() => setShowScanner(false)}
                />
            )}

            {/* Image Zoom Modal Lightbox */}
            {zoomImage && imageUrl && (
                <div 
                    className="fixed inset-0 z-[2000] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 animate-in fade-in"
                    onClick={() => setZoomImage(false)}
                >
                    <button 
                        onClick={() => setZoomImage(false)}
                        className="absolute top-6 right-6 p-3 rounded-full bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-400/50 transition-colors shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                    >
                        <X size={24} />
                    </button>
                    <img 
                        src={zoomUrl || imageUrl} 
                        alt={productData.displayLaoName}
                        className="max-w-[90vw] max-h-[85vh] object-contain rounded-2xl border-2 border-purple-400/50 shadow-[0_0_60px_rgba(168,85,247,0.4)]"
                    />
                </div>
            )}

            {/* Arcane Laser Animation */}
            <style>{`
                @keyframes arcaneLaser {
                    0%   { top: 20%; opacity: 0; }
                    15%  { opacity: 1; }
                    50%  { top: 80%; opacity: 1; }
                    85%  { opacity: 1; }
                    100% { top: 20%; opacity: 0; }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: rgba(5, 2, 12, 0.6);
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(168, 85, 247, 0.3);
                    border-radius: 9999px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(168, 85, 247, 0.6);
                }
            `}</style>
        </div>
    );
};

export default CheckPriceUltimate;
