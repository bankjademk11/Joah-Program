import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabaseClient';
import { ScanLine, Search, AlertCircle, RefreshCw, ChevronLeft, CheckCircle2, Camera } from 'lucide-react';
import bgImage from '../../assets/Icons_AppJoah/web_background.jpg';
import joahLogo from '../../assets/Joah.jpeg';
import BarcodeScannerModal from '../ui/BarcodeScannerModal';
import sfxOK from '../../assets/RequestOK.mp3';
import sfxError from '../../assets/RequestEror.mp3';

const CheckPrice = ({ onBack }) => {
    const [scanState, setScanState] = useState('idle'); // idle, loading, success, error
    const [productData, setProductData] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [manualInput, setManualInput] = useState('');
    const [showScanner, setShowScanner] = useState(false);
    const manualInputRef = useRef(null);
    const timerRef = useRef(null);
    const scanBufferRef = useRef('');
    const scanTimeoutRef = useRef(null);

    // Focus the hidden manual input so scanner fires into it
    useEffect(() => {
        if (manualInputRef.current) manualInputRef.current.focus();
    }, [scanState]);

    // Global keydown listener — barcode scanners type very fast and finish with Enter
    useEffect(() => {
        const handleKeyDown = (e) => {
            // If focused on the manual visible input, let it handle normally
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

    const handleScan = async (barcode) => {
        if (!barcode) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        setScanState('loading');
        setProductData(null);
        setErrorMessage('');

        try {
            const { data, error } = await supabase
                .from('price_checker')
                .select('barcode, product_name, price, updated_at')
                .eq('barcode', barcode)
                .single();

            if (error || !data) throw new Error('ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ');

            setProductData(data);
            setScanState('success');
            new Audio(sfxOK).play().catch(() => {});
        } catch (err) {
            setErrorMessage('ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ');
            setScanState('error');
            new Audio(sfxError).play().catch(() => {});
        }

        timerRef.current = setTimeout(resetState, 9000);
    };

    const resetState = () => {
        setScanState('idle');
        setProductData(null);
        setErrorMessage('');
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

    const formatPrice = (price) =>
        new Intl.NumberFormat('lo-LA', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);

    return (
        <div
            className="fixed inset-0 z-[1000] flex flex-col overflow-hidden"
            style={{ fontFamily: "'Noto Sans Lao', 'Noto Sans', sans-serif" }}
        >
            {/* Google Font */}
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Lao:wdth,wght@100,100..900&display=swap" rel="stylesheet" />

            {/* Background */}
            <div className="absolute inset-0 z-0">
                <img src={bgImage} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-950/75" />
            </div>

            {/* ── HEADER ── */}
            <header className="relative z-10 flex flex-col items-center pt-4 pb-3 gap-3">
                {/* Back button — top left */}
                <div className="w-full px-4 flex items-center">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ChevronLeft size={20} />
                        <span className="text-sm font-semibold">ກັບຄືນ</span>
                    </button>
                </div>

                {/* Large store sign banner */}
                <div className="flex flex-col items-center gap-2">
                    <img
                        src={joahLogo}
                        alt="Joah"
                        className="h-16 sm:h-24 w-auto object-contain drop-shadow-2xl"
                    />
                    <div className="flex items-center gap-3">
                        <div className="h-px w-10 bg-white/20" />
                        <p className="text-slate-400 text-[10px] font-semibold tracking-[0.25em] uppercase">Price Checker Terminal</p>
                        <div className="h-px w-10 bg-white/20" />
                    </div>
                </div>
            </header>

            {/* ── MAIN AREA ── */}
            <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-4 gap-5 overflow-y-auto">

                {/* IDLE */}
                {scanState === 'idle' && (
                    <div className="flex flex-col items-center gap-5 w-full animate-in fade-in duration-300">
                        {/* Scanner illustration — smaller on mobile */}
                        <div className="relative flex items-center justify-center w-40 h-40 sm:w-56 sm:h-56">
                            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                            <div className="absolute inset-3 rounded-full border border-blue-500/40 animate-ping" style={{ animationDuration: '2.5s' }} />
                            <div className="absolute inset-6 rounded-full bg-slate-900/70 backdrop-blur-xl border border-white/10 flex items-center justify-center">
                                <ScanLine size={48} className="text-blue-400" strokeWidth={1.5} />
                            </div>
                            <div
                                className="absolute left-6 right-6 h-px bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)]"
                                style={{ animation: 'laserScan 2s ease-in-out infinite' }}
                            />
                        </div>

                        {/* Text */}
                        <div className="text-center space-y-1">
                            <h1 className="text-2xl sm:text-4xl font-bold text-white">ກະລຸນາສະແກນບາໂຄ້ດ</h1>
                            <p className="text-slate-400 text-sm sm:text-base">Please scan the barcode below</p>
                        </div>

                        {/* Manual input + camera icon — full width on mobile */}
                        <form onSubmit={handleManualSubmit} className="flex gap-2 w-full max-w-sm">
                            <input
                                ref={manualInputRef}
                                type="text"
                                placeholder="ຫຼື ພິມບາໂຄ້ດ..."
                                value={manualInput}
                                onChange={(e) => setManualInput(e.target.value)}
                                className="flex-1 min-w-0 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-blue-400 text-sm backdrop-blur-sm"
                            />
                            <button
                                type="submit"
                                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors shrink-0"
                            >
                                <Search size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowScanner(true)}
                                title="ສະແກນດ້ວຍກ້ອງ"
                                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white transition-colors shrink-0"
                            >
                                <Camera size={18} />
                            </button>
                        </form>
                    </div>
                )}

                {/* LOADING */}
                {scanState === 'loading' && (
                    <div className="flex flex-col items-center gap-6 animate-in fade-in duration-200">
                        <div className="w-16 h-16 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin" />
                        <p className="text-white text-xl font-semibold">ກຳລັງຄົ້ນຫາ...</p>
                    </div>
                )}

                {/* SUCCESS */}
                {scanState === 'success' && productData && (
                    <div className="w-full max-w-lg flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-6 duration-400">
                        <div className="w-full rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-white/10 overflow-hidden shadow-2xl">
                            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 to-cyan-500" />
                            <div className="px-5 py-6 sm:px-8 sm:py-10 flex flex-col items-center text-center gap-4">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                                    <CheckCircle2 size={26} className="text-emerald-400" />
                                </div>
                                <p className="font-mono text-slate-500 text-xs tracking-widest">{productData.barcode}</p>
                                <h2 className="text-xl sm:text-3xl font-bold text-white leading-snug">
                                    {productData.product_name}
                                </h2>
                                <div className="w-full h-px bg-white/10" />
                                <div className="flex flex-col items-center gap-1">
                                    <p className="text-slate-400 text-xs font-medium uppercase tracking-widest">ລາຄາ / Price</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl sm:text-7xl font-bold text-emerald-400 tabular-nums leading-none">
                                            {formatPrice(productData.price)}
                                        </span>
                                        <span className="text-2xl sm:text-3xl text-emerald-600 font-semibold">₭</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={resetState}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors border border-white/10"
                        >
                            <RefreshCw size={16} />
                            ສະແກນໃໝ່
                        </button>
                    </div>
                )}

                {/* ERROR */}
                {scanState === 'error' && (
                    <div className="w-full max-w-md flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
                        <div className="w-full rounded-3xl bg-slate-900/80 backdrop-blur-2xl border border-rose-500/20 overflow-hidden shadow-2xl">
                            <div className="h-1.5 w-full bg-rose-500" />
                            <div className="px-8 py-10 flex flex-col items-center gap-5 text-center">
                                <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
                                    <AlertCircle size={32} className="text-rose-400" />
                                </div>
                                <h2 className="text-2xl font-bold text-white">ບໍ່ພົບຂໍ້ມູນ</h2>
                                <p className="text-rose-300/80">{errorMessage}</p>
                            </div>
                        </div>
                        <button
                            onClick={resetState}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors border border-white/10"
                        >
                            <RefreshCw size={16} />
                            ລອງໃໝ່
                        </button>
                    </div>
                )}

            </main>

            {/* ── FOOTER ── */}
            <footer className="relative z-10 py-4 text-center border-t border-white/5 bg-slate-900/40 backdrop-blur-md">
                <p className="text-slate-600 text-xs tracking-widest uppercase">Joy of a Home · Price Terminal</p>
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

            {/* Laser animation */}
            <style>{`
                @keyframes laserScan {
                    0%   { top: 35%; opacity: 0; }
                    10%  { opacity: 1; }
                    50%  { top: 65%; opacity: 1; }
                    90%  { opacity: 1; }
                    100% { top: 35%; opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default CheckPrice;
