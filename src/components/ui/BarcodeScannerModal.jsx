import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Camera, X, ScanLine, RotateCw } from 'lucide-react';

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

    const modalContent = (
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
    
    // 💡 Render via React Portal so the camera modal escapes parent styles
    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
};

export default BarcodeScannerModal;
