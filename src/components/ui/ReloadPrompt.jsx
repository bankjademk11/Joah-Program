import { useRegisterSW } from 'virtual:pwa-register/react';
import { useEffect, useState } from 'react';
import { RefreshCw, Sparkles, CheckCircle, Download, Wifi, Shield, Package } from 'lucide-react';
import joahLogo from '../../assets/Joah.jpeg';

/**
 * ReloadPrompt Component (v3 - Cyberpunk Premium Edition)
 * - Phase 1: High-end glassmorphism overlay with glowing JOAH logo
 * - Phase 2: 5s countdown
 * - Phase 3: Sci-Fi glowing ring terminal loading UX
 */
const ReloadPrompt = () => {
    const {
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('✅ Service Worker registered:', r);
            if (r) {
                setInterval(() => { r.update(); }, 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.warn('⚠️ Service Worker registration failed:', error);
        },
    });

    const [phase, setPhase] = useState('notify');
    const [countdown, setCountdown] = useState(5);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [loadingStep, setLoadingStep] = useState(0);

    const loadingSteps = [
        { icon: <Download size={20} />, text: 'ກຳລັງດາວໂຫຼດໄຟລ໌ລະບົບໃໝ່...' },
        { icon: <Shield size={20} />, text: 'ກວດສອບຄວາມປອດໄພ & ຂໍ້ມູນ...' },
        { icon: <Package size={20} />, text: 'ຕິດຕັ້ງການອັບເດດ...' },
        { icon: <Wifi size={20} />, text: 'ເຊື່ອມຕໍ່ Cloud Database...' },
        { icon: <CheckCircle size={20} />, text: 'ສຳເລັດ! ກຳລັງເປີດລະບົບ...' },
    ];

    useEffect(() => {
        if (!needRefresh || phase !== 'notify') return;
        if (countdown <= 0) { setPhase('loading'); return; }
        const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [needRefresh, phase, countdown]);

    useEffect(() => {
        if (phase !== 'loading') return;
        const totalMs = 20000; // Real 20 second delay for actual updates
        const intervalMs = 80;
        const increment = (intervalMs / totalMs) * 100;
        const progressTimer = setInterval(() => {
            setLoadingProgress(prev => {
                const next = prev + increment;
                if (next >= 100) { 
                    clearInterval(progressTimer); 
                    setTimeout(() => updateServiceWorker(true), 300); // REAL RELOAD TRIGGER
                    return 100; 
                }
                return next;
            });
        }, intervalMs);
        const stepTimings = [0, 4000, 8000, 13000, 17000];
        const stepTimers = stepTimings.map((delay, idx) => setTimeout(() => setLoadingStep(idx), delay));
        return () => { clearInterval(progressTimer); stepTimers.forEach(clearTimeout); };
    }, [phase]);

    if (!needRefresh) return null;

    if (phase === 'notify') return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-fade-in font-joah">
            <div className="relative w-full max-w-md mx-4 animate-slide-up" style={{ animationDuration: '0.4s' }}>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-orange-500/30 blur-[80px] rounded-full pointer-events-none" />
                
                <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.1)] overflow-hidden border border-white/40 dark:border-slate-700/50">
                    <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-joah-orange" />
                    
                    <div className="p-10 flex flex-col items-center text-center">
                        <div className="relative w-28 h-28 mb-8 group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                            <div className="relative w-full h-full bg-white dark:bg-slate-800 rounded-[2rem] p-1.5 shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transform group-hover:scale-105 transition-transform duration-500">
                                <img src={joahLogo} alt="JOAH" className="w-full h-full object-cover rounded-3xl" />
                            </div>
                            <div className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center animate-bounce">
                                <Sparkles size={14} className="text-white" />
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">ອັບເດດລະບົບໃໝ່</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-[15px] leading-relaxed mb-8 px-4">
                            ພົບການອັບເດດເວີຊັນລ່າສຸດ ເພື່ອປະສິດທິພາບການເຮັດວຽກທີ່ດີຂຶ້ນຂອງ Joah Warehouse.
                        </p>

                        <div className="w-full relative">
                            <button onClick={() => setCountdown(0)} className="relative w-full overflow-hidden flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all group">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <RefreshCw size={22} className="relative z-10 group-hover:rotate-180 transition-transform duration-700" />
                                <span className="relative z-10">ອັບເດດດຽວນີ້ ({countdown} ວິ)</span>
                            </button>
                            <div className="absolute bottom-0 left-0 h-1 bg-white/20 dark:bg-black/20 rounded-b-2xl w-full overflow-hidden pointer-events-none">
                                <div className="h-full bg-orange-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - countdown / 5) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 font-joah animate-fade-in overflow-hidden">
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }} />
            
            <div className="relative w-full max-w-md mx-4 flex flex-col items-center">
                <div className="relative w-32 h-32 mb-12">
                    <div className="absolute inset-[-20%] rounded-full border border-dashed border-orange-500/40 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-[-40%] rounded-full border border-orange-500/10 animate-[spin_15s_linear_infinite_reverse]" />
                    <div className="relative w-full h-full bg-slate-900 rounded-[2.5rem] p-2 shadow-[0_0_50px_rgba(249,115,22,0.3)] border border-orange-500/30 overflow-hidden flex items-center justify-center">
                        <img src={joahLogo} alt="JOAH" className="w-full h-full object-cover rounded-[2rem] opacity-90 mix-blend-screen" />
                        <div className="absolute inset-0 bg-orange-500/20 animate-pulse mix-blend-overlay" />
                    </div>
                </div>

                <div className="text-center mb-12 w-full px-8">
                    <h2 className="text-2xl font-black text-white mb-2 tracking-wide uppercase">System Updating</h2>
                    <p className="text-orange-400/80 font-bold text-sm tracking-widest mb-8">JOAH WAREHOUSE V2.0</p>
                    
                    <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-300 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.8)] transition-all ease-linear" style={{ width: `${loadingProgress}%`, transitionDuration: '80ms' }} />
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase text-slate-500">
                        <span>Loading Core...</span>
                        <span className="text-orange-400">{Math.round(loadingProgress)}%</span>
                    </div>
                </div>

                <div className="w-full max-w-sm bg-slate-900/50 rounded-2xl border border-slate-800 p-5 font-mono text-xs overflow-hidden backdrop-blur-md">
                    {loadingSteps.map((step, idx) => {
                        const isPast = idx < loadingStep;
                        const isCurrent = idx === loadingStep;
                        const isFuture = idx > loadingStep;
                        if (isFuture) return null; 
                        
                        return (
                            <div key={idx} className={`flex items-start gap-3 mb-3 last:mb-0 animate-slide-up ${isPast ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="mt-0.5 flex-shrink-0">
                                    {isPast ? <span className="text-emerald-500">✓</span> : <span className="text-orange-500 animate-pulse">&gt;</span>}
                                </div>
                                <div className="flex-1">
                                    <span className={`${isPast ? 'text-slate-500' : 'text-orange-100'}`}>{step.text}</span>
                                    {isCurrent && <span className="inline-block w-1.5 h-3 ml-1 bg-orange-500 animate-pulse" />}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ReloadPrompt;
