import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, Plus, Minus, Send, RotateCw, CheckCircle, Clock, ShoppingCart, Trash2, List, ChevronDown, FileSpreadsheet, ScanLine, X, Camera } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { useLanguage } from '../../../contexts/LanguageContext';
import ExcelJS from 'exceljs';
import soundOK from '../../../assets/RequestOK.mp3';
import soundError from '../../../assets/RequestEror.mp3';

// ===================== HYBRID SUPER SCANNER (Native + WASM Fallback) =====================
const BarcodeScannerModal = ({ onDetected, onClose }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null); // Used for WASM video decoding
    const streamRef = useRef(null);
    const fileInputRef = useRef(null);
    const mountedRef = useRef(true);
    const requestRef = useRef(null);

    const [status, setStatus] = useState('starting');
    const [detected, setDetected] = useState(false);
    const [lastScanned, setLastScanned] = useState('');
    const [torchOn, setTorchOn] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);
    const [engineType, setEngineType] = useState('...');

    useEffect(() => {
        mountedRef.current = true;
        let nativeDetector = null;
        let wasmReader = null;

        const initCameraAndScanner = async () => {
            try {
                // 1. ENGINE SETUP
                if ('BarcodeDetector' in window) {
                    try {
                        const formats = await window.BarcodeDetector.getSupportedFormats();
                        if (formats.length > 0) {
                            nativeDetector = new window.BarcodeDetector({
                                formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'qr_code', 'data_matrix']
                            });
                            if (mountedRef.current) setEngineType('Native AI');
                        }
                    } catch (e) {
                        console.warn("Native AI not ready, falling back...", e);
                    }
                }

                if (!nativeDetector) {
                    try {
                        // iOS WASM Fallback (zxing-wasm)
                        const zxingWasm = await import('zxing-wasm/reader');
                        // Pre-warm the WASM module
                        await zxingWasm.prepareZXingModule();
                        wasmReader = zxingWasm;
                        if (mountedRef.current) setEngineType('iOS WASM AI');
                    } catch (e) {
                        console.error("WASM load failed", e);
                    }
                }

                if (!mountedRef.current) return;

                // 2. CAMERA SETUP (Fix iOS Blurry & Overconstrained errors!)
                let stream = null;
                try {
                    // Try Best Quality with Continuous Focus (Works perfect on Android & Modern iOS WebKit)
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: { ideal: 'environment' },
                            width: { ideal: 1920 },
                            height: { ideal: 1080 },
                            advanced: [{ focusMode: 'continuous' }] // Force Auto-Focus
                        },
                        audio: false
                    });
                } catch (advancedErr) {
                    console.warn("Advanced constraints rejected by device/iOS, falling back to safe defaults...", advancedErr);
                    // Safe fallback for strict iOS Safari/Chrome!
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            facingMode: 'environment', // strict facing mode
                            width: { ideal: 1280 },
                            height: { ideal: 720 },
                        },
                        audio: false
                    });
                }

                if (!mountedRef.current) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    
                    // Safely wait for video to be ready on iOS
                    await new Promise((resolve) => {
                        videoRef.current.onloadedmetadata = () => {
                            videoRef.current.play().then(resolve).catch(resolve);
                        };
                    });
                }

                // Setup Torch (If available)
                try {
                    const track = stream.getVideoTracks()[0];
                    const caps = track.getCapabilities?.();
                    if (caps?.torch) setTorchSupported(true);
                } catch (_) {}

                if (mountedRef.current) setStatus('scanning');

                // 3. SCANNING LOOP
                const scanFrame = async () => {
                    if (!mountedRef.current || !videoRef.current || videoRef.current.readyState < 2) {
                        if (mountedRef.current) requestRef.current = setTimeout(scanFrame, 200);
                        return;
                    }

                    try {
                        let textResult = null;
                        
                        // Engine 1: Native Hardware AI (Fastest)
                        if (nativeDetector) {
                            const barcodes = await nativeDetector.detect(videoRef.current);
                            if (barcodes.length > 0) textResult = barcodes[0].rawValue;
                        } 
                        // Engine 2: WASM C++ Engine for iOS (Smooth & Accurate)
                        else if (wasmReader && canvasRef.current) {
                            const canvas = canvasRef.current;
                            const video = videoRef.current;
                            
                            // Prevent out-of-memory on iOS by downscaling the canvas for scanning
                            const scanWidth = 640;
                            const scanHeight = Math.floor(video.videoHeight * (scanWidth / video.videoWidth));
                            
                            if (canvas.width !== scanWidth || canvas.height !== scanHeight) {
                                canvas.width = scanWidth;
                                canvas.height = scanHeight;
                            }
                            
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            ctx.drawImage(video, 0, 0, scanWidth, scanHeight);
                            
                            // Extract image data for WASM
                            const imageData = ctx.getImageData(0, 0, scanWidth, scanHeight);
                            
                            try {
                                const barcodes = await wasmReader.readBarcodesFromImageData(imageData, {
                                    tryHarder: true,
                                    formats: ['EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'UPC_A', 'UPC_E', 'QR_CODE']
                                });
                                if (barcodes.length > 0) textResult = barcodes[0].text;
                            } catch (_) {}
                        }

                        if (textResult) {
                            handleSuccess(textResult);
                            return; // STOP LOOP
                        }
                    } catch (e) {
                        // Ignore scan frame failures
                    }

                    if (mountedRef.current) {
                        // Scan 3-4 times per second to prevent iOS heat/throttle
                        requestRef.current = setTimeout(scanFrame, 300);
                    }
                };

                // Start loop
                scanFrame();

            } catch (err) {
                console.error("Camera Error: ", err);
                if (err.name === 'NotAllowedError') alert('ກະລຸນາອະນຸຍາດໃຫ້ໃຊ້ກ້ອງຖ່າຍຮູບ (Please allow camera access in Settings)');
                if (mountedRef.current) setStatus('error');
            }
        };

        const handleSuccess = (text) => {
            if (!mountedRef.current) return;
            mountedRef.current = false;
            
            try { navigator.vibrate?.([100, 50, 100]); } catch (_) {}
            setDetected(true);
            setLastScanned(text);
            
            setTimeout(() => {
                stopCamera();
                onDetected(text);
                onClose();
            }, 600); // 0.6s success flash animation
        };

        initCameraAndScanner();

        return () => {
            mountedRef.current = false;
            stopCamera();
        };
    }, []);

    const stopCamera = () => {
        if (requestRef.current) clearTimeout(requestRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
    };

    const handleClose = () => {
        mountedRef.current = false;
        stopCamera();
        onClose();
    };

    const toggleTorch = async () => {
        try {
            const track = streamRef.current?.getVideoTracks?.()[0];
            if (!track) return;
            const newState = !torchOn;
            await track.applyConstraints({ advanced: [{ torch: newState }] });
            setTorchOn(newState);
        } catch (_) {}
    };

    // 📸 Fallback: scan from captured photo using API/WASM safely
    const handleFileScan = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        try {
            setStatus('scanning'); // Show scanning overlay
            let textResult = null;

            // Engine 1: Native API
            if ('BarcodeDetector' in window) {
                try {
                    const url = URL.createObjectURL(file);
                    const img = new Image();
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                        img.src = url;
                    });
                    const detector = new window.BarcodeDetector();
                    const barcodes = await detector.detect(img);
                    if (barcodes.length > 0) textResult = barcodes[0].rawValue;
                } catch (_) {}
            }

            // Engine 2: iOS WASM API
            if (!textResult) {
                const zxingWasm = await import('zxing-wasm/reader');
                await zxingWasm.prepareZXingModule();
                const barcodes = await zxingWasm.readBarcodesFromImageFile(file, {
                    tryHarder: true,
                    formats: ['EAN_13', 'EAN_8', 'CODE_128', 'CODE_39', 'UPC_A', 'UPC_E', 'QR_CODE']
                });
                if (barcodes.length > 0) textResult = barcodes[0].text;
            }

            if (textResult) {
                try { navigator.vibrate?.([100, 50, 100]); } catch (_) {}
                setDetected(true);
                setLastScanned(textResult);
                stopCamera();
                setTimeout(() => {
                    onDetected(textResult);
                    onClose();
                }, 600);
            } else {
                alert('ບໍ່ພົບບາໂຄ້ດໃນຮູບ ຫຼຼື ອ່ານຍາກກວ່າປົກກະຕິ ກະລຸນາລອງໃໝ່');
                setStatus('scanning');
            }
        } catch (err) {
            console.error(err);
            alert('ບໍ່ພົບບາໂຄ້ດໃນຮູບ ຫຼຼື ຮູບພາບບໍ່ຊັດເຈນ');
            setStatus('scanning');
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="fixed inset-0 z-[999] flex flex-col bg-black">
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleFileScan} style={{ display: 'none' }} />

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-md z-10 border-b border-white/10">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <Camera size={18} className="text-joah-orange" />
                        <span className="text-white font-black text-sm tracking-wide">AI SCANNER PRO</span>
                    </div>
                    <span className="text-joah-orange flex items-center gap-1 text-[10px] font-bold mt-1 uppercase tracking-widest">
                        <div className="w-1.5 h-1.5 rounded-full bg-joah-orange animate-pulse" />
                        {engineType} Active
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {torchSupported && (
                        <button onClick={toggleTorch} className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all shadow-xl ${torchOn ? 'bg-amber-400 text-black shadow-amber-500/50' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                            {torchOn ? '🔦' : '💡'}
                        </button>
                    )}
                    <button onClick={handleClose} className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Camera View Area */}
            <div className="flex-1 relative overflow-hidden bg-black/95">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" autoPlay muted playsInline />

                {/* Overlays */}
                {status === 'scanning' && !detected && (
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                        {/* Darken edges, focus center */}
                        <div className="absolute inset-0 bg-black/40" />

                        {/* Scanner Window */}
                        <div className="relative z-20 w-[85vw] max-w-[400px] h-[180px]">
                            {/* Clear sight window */}
                            <div className="absolute inset-0 border-[0.5px] border-white/10 backdrop-brightness-125 rounded-2xl" style={{ boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)' }} />
                            
                            {/* Target Corners */}
                            <div className="absolute -top-1 -left-1 w-12 h-12 border-t-[4px] border-l-[4px] border-joah-orange rounded-tl-2xl shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                            <div className="absolute -top-1 -right-1 w-12 h-12 border-t-[4px] border-r-[4px] border-joah-orange rounded-tr-2xl shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                            <div className="absolute -bottom-1 -left-1 w-12 h-12 border-b-[4px] border-l-[4px] border-joah-orange rounded-bl-2xl shadow-[0_0_15px_rgba(249,115,22,0.4)]" />
                            <div className="absolute -bottom-1 -right-1 w-12 h-12 border-b-[4px] border-r-[4px] border-joah-orange rounded-br-2xl shadow-[0_0_15px_rgba(249,115,22,0.4)]" />

                            {/* Sci-Fi Laser Scan Line */}
                            <div className="absolute inset-x-2 top-2 bottom-2 overflow-hidden rounded-xl">
                                <div className="absolute left-0 right-0 h-[4px] rounded-full"
                                    style={{
                                        background: 'linear-gradient(90deg, transparent 5%, #fff 40%, #f97316 50%, #fff 60%, transparent 95%)',
                                        boxShadow: '0 0 25px 8px rgba(249,115,22,0.6)',
                                        animation: 'scanline 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Status Tip */}
                        <div className="mt-12 bg-black/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-white/10 z-20">
                            <p className="text-white/90 text-sm font-bold flex items-center gap-2 tracking-wide">
                                <span>🎯 ຊີ້ກ້ອງໄປທີ່ບາໂຄ້ດ</span>
                            </p>
                        </div>
                    </div>
                )}

                {/* Ultimate Success Flash */}
                {detected && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
                        <div className="w-28 h-28 rounded-full bg-emerald-500 flex items-center justify-center shadow-[0_0_60px_rgba(16,185,129,0.5)] animate-bounce relative">
                            <div className="absolute inset-0 rounded-full border-4 border-emerald-400 animate-ping" />
                            <span className="text-white text-6xl font-black relative z-10">✓</span>
                        </div>
                        <p className="text-emerald-400 font-bold text-sm tracking-widest uppercase">ເຂົ້າລະຫັດສຳເລັດ!</p>
                        <p className="text-white font-black text-3xl px-8 py-4 border-2 border-emerald-500/30 rounded-3xl bg-emerald-500/10 shadow-2xl">{lastScanned}</p>
                    </div>
                )}

                {/* Loading State */}
                {status === 'starting' && (
                    <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center">
                        <div className="relative flex items-center justify-center">
                            <RotateCw size={40} className="animate-spin text-joah-orange" />
                            <div className="absolute inset-0 border-4 border-joah-orange/20 rounded-full" />
                        </div>
                        <p className="text-white font-black text-sm mt-6 mb-2 tracking-wider">INITIATING LENS...</p>
                        <p className="text-joah-orange/60 text-xs">ຖ້າດົນເກີນໄປ ໃຫ້ປິດແລ້ວເປີດໃໝ່</p>
                    </div>
                )}

                {/* Error State */}
                {status === 'error' && (
                    <div className="absolute inset-0 bg-black/90 z-20 flex flex-col items-center justify-center px-6">
                        <div className="bg-rose-900/40 border border-rose-500/30 rounded-3xl px-6 py-8 text-center max-w-[300px]">
                            <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <span className="text-rose-400 text-3xl">⚠️</span>
                            </div>
                            <p className="text-rose-400 font-black text-lg mb-2">ບໍ່ສາມາດເປີດກ້ອງໄດ້</p>
                            <p className="text-white/60 text-xs mb-6 leading-relaxed">
                                ກະລຸນາກວດສອບການອະນຸຍາດ Camera<br/>ໃນ Settings ຂອງ Browser ທ່ານ
                            </p>
                            <button onClick={handleClose} className="w-full py-3 bg-rose-600 hover:bg-rose-500 rounded-xl text-white font-black text-sm transition-all shadow-lg shadow-rose-600/30">
                                ປິດອອກ
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Actions */}
            <div className="bg-black px-5 py-6 pb-safe z-10 border-t border-white/10 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] -mt-4">
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-3 border border-slate-700"
                >
                    <div className="bg-slate-600 p-1.5 rounded-lg"><ScanLine size={18} /></div>
                    ສະແກນຈາກຮູບພາບ (Photo)
                </button>
            </div>

            <style>{`
                @keyframes scanline {
                    0%   { top: 5%; opacity: 0; }
                    15%  { opacity: 1; }
                    85%  { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                }
                .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 1.5rem); }
            `}</style>
        </div>
    );
};


const StoreRequest = ({ onBack, currentUser }) => {

    const { t } = useLanguage();
    const [barcode, setBarcode] = useState('');
    const [product, setProduct] = useState(null);
    const [qty, setQty] = useState(1);
    const [cart, setCart] = useState([]);
    const [recentRequests, setRecentRequests] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [requestStats, setRequestStats] = useState({ pending: 0, accepted: 0 });
    const [expandedBatchId, setExpandedBatchId] = useState(null);
    const [filter, setFilter] = useState('all');
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [mobileTab, setMobileTab] = useState('search'); // 'search' | 'cart' | 'history'

    const toast = useToast();
    const barcodeInputRef = useRef(null);
    const exportMenuRef = useRef(null);
    const audioOK = useRef(new Audio(soundOK));
    const audioError = useRef(new Audio(soundError));

    const playOK = () => {
        try { audioOK.current.currentTime = 0; audioOK.current.play(); } catch (_) {}
    };
    const playError = () => {
        try { audioError.current.currentTime = 0; audioError.current.play(); } catch (_) {}
    };

    // Initial Fetch & Realtime Subscription
    useEffect(() => {
        fetchRecentRequests();

        const channel = supabase
            .channel('store_requests_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'store_requests' },
                (payload) => {
                    // 🔔 Play sound when HQ accepts or rejects a request
                    if (payload.eventType === 'UPDATE') {
                        const oldStatus = payload.old?.status;
                        const newStatus = payload.new?.status;
                        const reqBranch = payload.new?.branch_id;
                        const myBranch = currentUser?.branch_id;

                        // Only notify if this request belongs to this branch
                        const isMine = !myBranch || reqBranch === myBranch;

                        if (isMine && oldStatus === 'pending') {
                            if (newStatus === 'accepted') {
                                playOK();
                                toast.success('✅ Request ຖືກຍອມຮັບແລ້ວ!');
                            } else if (newStatus === 'rejected') {
                                playError();
                                toast.error('❌ Request ຖືກປະຕິເສດ');
                            }
                        }
                    }
                    fetchRecentRequests();
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [currentUser?.branch_id]);

    // Focus barcode input
    useEffect(() => {
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    }, [product]);

    // Handle clicking outside of export menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
                setShowExportMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchRecentRequests = async () => {
        try {
            const userBranch = currentUser?.branch_id;
            let query = supabase.from('store_requests').select('*').order('created_at', { ascending: false }).limit(100);
            if (userBranch) query = query.eq('branch_id', userBranch);
            const { data, error } = await query;
            if (error) throw error;
            setRecentRequests(data || []);
            const pending = (data || []).filter(r => r.status === 'pending').length;
            const accepted = (data || []).filter(r => r.status === 'accepted').length;
            setRequestStats({ pending, accepted });
        } catch (err) {
            console.error('Error fetching requests:', err);
        }
    };

    const doSearch = useCallback(async (barcodeValue) => {
        if (!barcodeValue?.trim()) return;
        setIsLoading(true);
        const userBranch = currentUser?.branch_id;
        try {
            let query = supabase.from('location_inventory').select('*').eq('barcode_no', barcodeValue.trim());
            if (userBranch) query = query.eq('branch_id', userBranch);
            const { data, error } = await query.limit(1).maybeSingle();
            if (error) throw error;
            if (data) {
                setProduct({
                    barcode: data.barcode_no,
                    item_name: data.item_name,
                    product_name_la: data.item_name,
                    available_qty: data.qty || 0,
                    rack_location: data.rack_location || 'N/A',
                    branch_id: data.branch_id
                });
                setQty(1);
                if (data.qty > 0) {
                    toast.success(`ພົບສິນຄ້າ! ສາງ ${userBranch || ''}: ${data.qty} ຫນ່ວຍ`);
                } else {
                    toast.warning(`ພົບສິນຄ້າ, ແຕ່ສາງ ${userBranch || ''} ໝົດແລ້ວ`);
                }
            } else {
                setProduct(null);
                toast.error(t('storeRequest.itemNotFound') + (userBranch ? ` (${userBranch})` : ''));
            }
        } catch (err) {
            toast.error('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentUser?.branch_id]);

    const handleSearch = async (e) => {
        e.preventDefault();
        await doSearch(barcode);
    };

    const handleScanDetected = (scannedBarcode) => {
        setBarcode(scannedBarcode);
        toast.success(`📷 ສະແກນໄດ້: ${scannedBarcode}`);
        // Auto search after scan
        doSearch(scannedBarcode);
        // Switch to search tab on mobile
        setMobileTab('search');
    };

    const handleAddToCart = () => {
        if (!product) return;
        if (cart.length >= 5) {
            toast.error('ຂໍອະໄພ! ສາມາດຂໍໄດ້ສູງສຸດ 5 ລາຍການຕໍ່ຄັ້ງ');
            return;
        }
        const newItem = {
            id: Date.now(),
            barcode: product.barcode,
            product_name: product.item_name,
            product_name_la: product.product_name_la,
            qty: qty,
            available_qty: product.available_qty,
            rack_location: product.rack_location,
            branch_id: product.branch_id
        };
        setCart(prev => [newItem, ...prev]);
        toast.success(`ເພີ່ມ ${product.item_name} ແລ້ວ!`);
        setProduct(null);
        setBarcode('');
        setQty(1);
        if (barcodeInputRef.current) barcodeInputRef.current.focus();
    };

    const removeFromCart = (id) => setCart(prev => prev.filter(item => item.id !== id));

    const handleSubmitCart = async () => {
        if (cart.length === 0) return;
        setIsSending(true);
        const date = new Date();
        const yy = String(date.getFullYear()).slice(-2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
        const batchId = `REQ${yy}${mm}${dd}-${randomStr}`;
        try {
            // 📸 Snapshot stock ณ ตอนนี้จาก location_inventory ก่อน insert
            const barcodes = cart.map(item => item.barcode).filter(Boolean);
            const branchId = currentUser?.branch_id || null;
            let stockSnapshot = {}; // barcode -> total qty

            if (barcodes.length > 0 && branchId) {
                const { data: stockData } = await supabase
                    .from('location_inventory')
                    .select('barcode_no, qty')
                    .eq('branch_id', branchId)
                    .in('barcode_no', barcodes);
                (stockData || []).forEach(s => {
                    stockSnapshot[s.barcode_no] = (stockSnapshot[s.barcode_no] || 0) + (s.qty || 0);
                });
            }

            const requests = cart.map(item => ({
                barcode: item.barcode,
                product_name: item.product_name,
                qty: item.qty,
                status: 'pending',
                request_by: currentUser?.id ? `${currentUser.name} (${currentUser.id})` : (currentUser?.name || 'Store Staff'),
                branch_id: item.branch_id || branchId,
                batch_id: batchId,
                stock_at_request: stockSnapshot[item.barcode] ?? null, // 📸 snapshot ณ เวลานี้
            }));
            const { error } = await supabase.from('store_requests').insert(requests);
            if (error) throw error;
            toast.success(t('storeRequest.requestSent'));
            setCart([]);
            setMobileTab('history');
            fetchRecentRequests();
        } catch (err) {
            toast.error('Error: ' + err.message);
        } finally {
            setIsSending(false);
        }
    };

    const handleExport = async (type = 'current') => {
        try {
            toast.info('Generating Excel...');
            setShowExportMenu(false);
            let dataToExport = [];
            let fileName = `My_Requests_${new Date().toLocaleDateString()}`;
            if (type === 'current') dataToExport = filteredRequests;
            else if (type === 'pending') { dataToExport = recentRequests.filter(r => r.status === 'pending'); fileName = `My_Pending_Requests`; }
            else if (type === 'today') { dataToExport = recentRequests.filter(r => new Date(r.created_at).toDateString() === new Date().toDateString()); fileName = `My_Requests_Today`; }
            if (dataToExport.length === 0) { toast.info('No data for this template'); return; }
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Requests');
            worksheet.columns = [
                { header: 'Doc No.', key: 'docNo', width: 22 },
                { header: 'Date', key: 'date', width: 15 }, { header: 'Time', key: 'time', width: 15 },
                { header: 'Requester', key: 'requester', width: 20 }, { header: 'Product', key: 'product', width: 40 },
                { header: 'Barcode', key: 'barcode', width: 20 }, { header: 'Qty', key: 'qty', width: 10 },
                { header: 'Status', key: 'status', width: 15 }
            ];
            worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
            dataToExport.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            let currentBatch = null; let isAlternateColor = false;
            dataToExport.forEach(req => {
                const reqBatch = req.batch_id || new Date(req.created_at).getTime();
                if (currentBatch !== reqBatch) { currentBatch = reqBatch; isAlternateColor = !isAlternateColor; }
                const dt = new Date(req.created_at);
                const row = worksheet.addRow({ docNo: req.batch_id?.startsWith('REQ') ? req.batch_id : 'N/A', date: dt.toLocaleDateString(), time: dt.toLocaleTimeString(), requester: req.request_by, product: req.product_name, barcode: req.barcode, qty: req.qty, status: req.status.toUpperCase() });
                row.eachCell(cell => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: isAlternateColor ? { argb: 'FFDBEAFE' } : { argb: 'FFDCFCE7' } };
                    cell.border = { top: { style: 'thin', color: { argb: 'FF9CA3AF' } }, left: { style: 'thin', color: { argb: 'FF9CA3AF' } }, bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }, right: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
                });
            });
            const buffer = await workbook.xlsx.writeBuffer();
            const a = document.createElement('a');
            a.href = window.URL.createObjectURL(new Blob([buffer]));
            a.download = `${fileName}.xlsx`; a.click();
            toast.success('Export Success!');
        } catch (err) { toast.error('Export Error: ' + err.message); }
    };

    const groupHistory = (data) => {
        const groups = {};
        data.forEach(req => {
            const batchId = req.batch_id || `legacy_${new Date(req.created_at).getTime()}`;
            if (!groups[batchId]) groups[batchId] = { batch_id: batchId, created_at: req.created_at, request_by: req.request_by, status: req.status, items: [] };
            groups[batchId].items.push(req);
            if (req.status === 'pending') groups[batchId].status = 'pending';
        });
        return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    };

    const filteredRequests = recentRequests.filter(req => filter === 'all' || req.status === filter);
    const groupedHistory = groupHistory(filteredRequests);

    // ===================== SEARCH PANEL =====================
    const SearchPanel = () => (
        <div className="glass-card p-5 sm:p-8 rounded-[2rem] flex flex-col gap-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <ShoppingCart size={150} />
            </div>
            <form onSubmit={handleSearch} className="relative z-10">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">
                    {t('storeRequest.scanBarcode')}
                </label>
                <div className="flex gap-2">
                    <input
                        ref={barcodeInputRef}
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        placeholder={t('storeRequest.searchPlaceholder')}
                        className="flex-1 text-xl sm:text-2xl font-bold bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 sm:px-6 sm:py-4 placeholder:text-slate-300 min-w-0"
                        autoFocus={window.innerWidth > 768}
                    />
                    {/* Search Button */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-4 sm:px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-500/30 transition-all flex-shrink-0 flex items-center"
                    >
                        {isLoading ? <RotateCw size={22} className="animate-spin" /> : <Search size={22} />}
                    </button>
                </div>
            </form>

            {/* 📸 Big Centered Camera Scan Button */}
            <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="relative z-10 w-full py-4 bg-gradient-to-r from-joah-orange via-orange-500 to-amber-500 hover:from-orange-500 hover:via-orange-400 hover:to-amber-400 active:scale-[0.98] text-white rounded-2xl shadow-lg shadow-orange-500/30 transition-all flex items-center justify-center gap-3 font-black text-base"
            >
                <ScanLine size={24} />
                ສະແກນບາໂຄ້ດດ້ວຍກ້ອງ
            </button>

            {product && (
                <div className="animate-scale-in bg-white dark:bg-slate-800/50 rounded-3xl p-5 border-2 border-blue-100 dark:border-blue-500/30 relative z-10">
                    <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white mb-1">{product.product_name_la}</h3>
                    <div className={`flex items-center gap-3 mb-5 p-4 rounded-2xl ${product.available_qty > 0 ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${product.available_qty > 0 ? 'bg-emerald-500' : 'bg-rose-500'} text-white font-black`}>
                            {product.available_qty > 0 ? '✓' : '✕'}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-black uppercase tracking-wider">{product.available_qty > 0 ? t('storeRequest.available') : t('storeRequest.outOfStock')}</p>
                            <p className="text-lg font-black">{product.available_qty} {t('storeRequest.qty')}</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-2xl p-2 mb-5">
                        <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-600 flex items-center justify-center hover:bg-slate-100 transition-colors"><Minus size={20} /></button>
                        <div className="text-center flex-1 px-2">
                            <span className="text-xs font-bold text-slate-400 uppercase mb-1 block">QTY</span>
                            <input
                                type="number" min="1" value={qty}
                                onChange={(e) => { const val = parseInt(e.target.value, 10); if (!isNaN(val) && val >= 1) setQty(val); else if (e.target.value === '') setQty(''); }}
                                onBlur={() => { if (!qty || qty < 1) setQty(1); }}
                                className="w-full text-3xl font-black text-blue-600 dark:text-blue-400 text-center bg-transparent outline-none border-b-2 border-blue-200 dark:border-blue-800 focus:border-blue-500 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                        </div>
                        <button onClick={() => setQty((prev) => (Number(prev) || 1) + 1)} className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors"><Plus size={20} /></button>
                    </div>
                    {product.available_qty <= 0 ? (
                        <div className="w-full py-4 bg-rose-100 dark:bg-rose-900/30 rounded-2xl flex flex-col items-center justify-center border-2 border-rose-200 dark:border-rose-700">
                            <span className="text-rose-600 dark:text-rose-400 font-black text-lg">🚫 Out of Stock</span>
                            <span className="text-rose-400 text-xs font-bold uppercase tracking-widest">ບໍ່ສາມາດ Request ໄດ້</span>
                        </div>
                    ) : (
                        <button onClick={handleAddToCart} className="w-full py-4 bg-gradient-to-r from-joah-orange to-orange-600 hover:from-orange-500 hover:to-orange-500 text-white rounded-2xl font-black text-lg tracking-wide shadow-xl shadow-orange-500/30 transition-all flex items-center justify-center gap-3">
                            <Plus size={24} /><span>{t('storeRequest.addToRequest')}</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );

    // ===================== CART PANEL =====================
    const CartPanel = () => (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-5 shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col h-full min-h-[300px]">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <List className="text-joah-orange" />
                    <h3 className="font-black text-slate-800 dark:text-white">{t('storeRequest.requestList')} ({cart.length}/5)</h3>
                </div>
                <div className="flex items-center gap-2">
                    {cart.length >= 5 && <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-2 py-1 rounded-lg animate-pulse">ເຕັມແລ້ວ</span>}
                    {cart.length > 0 && <button onClick={() => setCart([])} className="text-xs font-bold text-rose-500 hover:text-rose-600">{t('storeRequest.remove')}</button>}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 mb-4">
                {cart.length === 0
                    ? <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2 py-10"><ShoppingCart size={48} /><span className="text-sm font-medium">{t('storeRequest.noItemsDesc')}</span></div>
                    : cart.map(item => (
                        <div key={item.id} className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl flex items-center justify-between group border border-transparent hover:border-slate-200 dark:hover:border-slate-700 transition-all">
                            <div className="flex-1 min-w-0 mr-3">
                                <h4 className="font-bold text-slate-800 dark:text-white truncate text-sm">{item.product_name}</h4>
                                <p className="text-xs text-slate-500 font-mono flex items-center gap-1">{item.barcode} <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 rounded-md">{item.rack_location}</span></p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-black text-lg text-blue-600 dark:text-blue-400">x{item.qty}</span>
                                <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 text-slate-400 hover:text-rose-500 transition-all shadow-sm"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    ))
                }
            </div>
            <button
                onClick={handleSubmitCart}
                disabled={cart.length === 0 || cart.length > 5 || isSending}
                className={`w-full py-4 text-white rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 ${cart.length > 5 ? 'bg-rose-500' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
            >
                {isSending ? <RotateCw className="animate-spin" /> : <Send />}
                <span>{cart.length > 5 ? 'ເກີນ 5 ລາຍການ' : `${t('storeRequest.submitRequest')} (${cart.length})`}</span>
            </button>
        </div>
    );

    // ===================== HISTORY PANEL =====================
    const HistoryPanel = () => (
        <div className="bg-white dark:bg-slate-800 rounded-[2rem] p-4 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between mb-3 px-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">{t('storeRequest.history')}</h3>
                <div className="flex items-center gap-2">
                    <div className="relative" ref={exportMenuRef}>
                        <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-emerald-500"><FileSpreadsheet size={16} /></button>
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden">
                                <div className="p-1">
                                    <button onClick={() => handleExport('current')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-lg">{t('storeRequest.exportSelected')}</button>
                                    <button onClick={() => handleExport('today')} className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 rounded-lg">{t('storeRequest.exportToday')}</button>
                                    <button onClick={() => handleExport('pending')} className="w-full text-left px-3 py-2 text-xs font-bold text-orange-600 hover:bg-orange-50 rounded-lg">{t('storeRequest.exportPending')}</button>
                                </div>
                            </div>
                        )}
                    </div>
                    <RotateCw size={14} className="text-slate-400 cursor-pointer hover:rotate-180 transition-all" onClick={fetchRecentRequests} />
                </div>
            </div>
            {/* Status Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl mb-4">
                {['all', 'pending', 'accepted', 'rejected'].map(f => (
                    <button key={f} onClick={() => setFilter(f)} className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${filter === f ? f === 'rejected' ? 'bg-rose-500 text-white shadow-sm' : f === 'accepted' ? 'bg-emerald-500 text-white shadow-sm' : f === 'pending' ? 'bg-orange-400 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
                        {f === 'all' ? t('storeRequest.tabAll') : f === 'pending' ? t('storeRequest.tabPending') : f === 'accepted' ? t('storeRequest.tabAccepted') : t('storeRequest.tabRejected')}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {groupedHistory.length === 0
                    ? <div className="flex flex-col items-center justify-center text-slate-300 gap-1 opacity-60 py-10"><Clock size={24} /><span className="text-xs font-medium">{t('storeRequest.noHistory')}</span></div>
                    : groupedHistory.map(batch => {
                        const statusMap = {
                            accepted: { label: t('storeRequest.tabAccepted'), cls: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' },
                            rejected: { label: t('storeRequest.tabRejected'), cls: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' },
                            pending: { label: t('storeRequest.tabPending'), cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' },
                        };
                        const statusInfo = statusMap[batch.status] || { label: batch.status, cls: 'bg-slate-100 text-slate-500' };
                        return (
                            <div key={batch.batch_id} className="bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden text-xs">
                                <div onClick={() => setExpandedBatchId(expandedBatchId === batch.batch_id ? null : batch.batch_id)} className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-slate-400">
                                                ເລກບິນ (Doc): <span className="font-mono text-slate-500">{batch.batch_id.startsWith('legacy') ? 'N/A' : batch.batch_id}</span>
                                            </span>
                                        </span>
                                        <span className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-1.5 mt-1 text-[11px]">
                                            <span className="text-slate-500">{batch.request_by || 'Staff'}</span>
                                            <span>•</span>
                                            {new Date(batch.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5"><ShoppingCart size={10} /> {batch.items.length} {t('storeRequest.items')}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${statusInfo.cls}`}>{statusInfo.label}</span>
                                        <ChevronDown size={14} className={`transition-transform text-slate-400 ${expandedBatchId === batch.batch_id ? 'rotate-180' : ''}`} />
                                    </div>
                                </div>
                                {expandedBatchId === batch.batch_id && (
                                    <div className="bg-white dark:bg-slate-950/30 p-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                                        {batch.items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                                <div className="flex-1 truncate font-medium text-slate-700 dark:text-slate-300">
                                                    {item.product_name}<br />
                                                    <span className="text-[9px] text-slate-400">{item.barcode}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-slate-600 dark:text-slate-400">x{item.qty}</span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${item.status === 'accepted' ? 'bg-emerald-100 text-emerald-600' : item.status === 'rejected' ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                                                        {item.status === 'accepted' ? t('storeRequest.tabAccepted') : item.status === 'rejected' ? t('storeRequest.tabRejected') : t('storeRequest.tabPending')}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                }
            </div>
        </div>
    );

    return (
        <>
            {/* Barcode Scanner Modal */}
            {showScanner && (
                <BarcodeScannerModal
                    onDetected={handleScanDetected}
                    onClose={() => setShowScanner(false)}
                />
            )}

            <div className="w-full max-w-6xl mx-auto p-3 sm:p-6 animate-fade-in-up">
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                    <button onClick={onBack} className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-700 flex-shrink-0">
                        <ArrowLeft size={22} />
                    </button>
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white tracking-tight truncate">{t('storeRequest.title')}</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('storeRequest.subtitle')}</p>
                    </div>
                    {/* Mobile stats */}
                    <div className="flex gap-2 md:hidden">
                        {requestStats.pending > 0 && (
                            <span className="px-3 py-1.5 bg-orange-100 text-orange-600 rounded-xl text-xs font-black">⏳ {requestStats.pending}</span>
                        )}
                        {requestStats.accepted > 0 && (
                            <span className="px-3 py-1.5 bg-emerald-100 text-emerald-600 rounded-xl text-xs font-black">✅ {requestStats.accepted}</span>
                        )}
                    </div>
                </div>

                {/* ===== MOBILE TAB LAYOUT ===== */}
                <div className="md:hidden">
                    {/* Tab Buttons */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-2xl p-1 mb-4">
                        {[
                            { key: 'search', icon: Search, label: 'ຄົ້ນຫາ' },
                            { key: 'cart', icon: ShoppingCart, label: `ລາຍການ (${cart.length})` },
                            { key: 'history', icon: Clock, label: 'ປະຫວັດ' }
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setMobileTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition-all ${mobileTab === tab.key ? 'bg-white dark:bg-slate-700 text-joah-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {mobileTab === 'search' && <SearchPanel />}
                    {mobileTab === 'cart' && (
                        <div style={{ minHeight: '60vh' }}>
                            <CartPanel />
                        </div>
                    )}
                    {mobileTab === 'history' && <HistoryPanel />}
                </div>

                {/* ===== DESKTOP LAYOUT ===== */}
                <div className="hidden md:flex gap-6 h-[calc(100vh-130px)]">
                    {/* Left Column */}
                    <div className="flex-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                        <SearchPanel />
                    </div>
                    {/* Right Column */}
                    <div className="w-96 flex flex-col gap-6 h-full overflow-hidden">
                        <div className="flex-1 min-h-[300px] overflow-hidden flex flex-col">
                            <CartPanel />
                        </div>
                        <div className="flex-1 min-h-[350px] overflow-hidden flex flex-col">
                            <HistoryPanel />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default StoreRequest;
