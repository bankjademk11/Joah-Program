import { History, RotateCw, Sun, Moon, X, ShieldCheck, Database, Menu, Home, Mail, LogOut, Sparkles, RefreshCw, Download, Shield, Package, Wifi, CheckCircle } from 'lucide-react';
import joahLogo from '../../assets/Joah.jpeg';
import laosFlag from '../../assets/Laos.png';
import englishFlag from '../../assets/EnglishFlang.png';
import { supabase } from '../../utils/supabaseClient';
import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import notificationSound from '../../assets/notification_compact.mp3';

// 🧪 TEST component for previewing the Force Update screen
const TestReloadPrompt = ({ onClose }) => {
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
        if (phase !== 'notify') return;
        if (countdown <= 0) { setPhase('loading'); return; }
        const timer = setTimeout(() => setCountdown(prev => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [phase, countdown]);

    useEffect(() => {
        if (phase !== 'loading') return;
        const totalMs = 8000;
        const intervalMs = 80;
        const increment = (intervalMs / totalMs) * 100;
        const progressTimer = setInterval(() => {
            setLoadingProgress(prev => {
                const next = prev + increment;
                if (next >= 100) { clearInterval(progressTimer); setTimeout(onClose, 800); return 100; }
                return next;
            });
        }, intervalMs);
        const stepTimings = [0, 1500, 3000, 5000, 6500];
        const stepTimers = stepTimings.map((delay, idx) => setTimeout(() => setLoadingStep(idx), delay));
        return () => { clearInterval(progressTimer); stepTimers.forEach(clearTimeout); };
    }, [phase, onClose]);

    if (phase === 'notify') return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/40 backdrop-blur-xl animate-fade-in font-joah">
            <div className="relative w-full max-w-md mx-4 animate-slide-up" style={{ animationDuration: '0.4s' }}>
                {/* Glowing orb behind card */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-orange-500/30 blur-[80px] rounded-full pointer-events-none" />
                
                <div className="relative bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(249,115,22,0.1)] overflow-hidden border border-white/40 dark:border-slate-700/50">
                    <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-amber-400 to-joah-orange" />
                    
                    <div className="p-10 flex flex-col items-center text-center">
                        {/* Premium Logo Presentation */}
                        <div className="relative w-28 h-28 mb-8 group">
                            <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-amber-500 rounded-[2rem] blur-xl opacity-40 group-hover:opacity-60 transition-opacity duration-500" />
                            <div className="relative w-full h-full bg-white dark:bg-slate-800 rounded-[2rem] p-1.5 shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden transform group-hover:scale-105 transition-transform duration-500">
                                <img src={joahLogo} alt="JOAH" className="w-full h-full object-cover rounded-3xl" />
                            </div>
                            {/* Notification Badge */}
                            <div className="absolute -top-3 -right-3 w-8 h-8 bg-rose-500 rounded-full border-4 border-white dark:border-slate-900 flex items-center justify-center animate-bounce">
                                <Sparkles size={14} className="text-white" />
                            </div>
                        </div>

                        <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3 tracking-tight">
                            ອັບເດດລະບົບໃໝ່
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-[15px] leading-relaxed mb-8 px-4">
                            ພົບການອັບເດດເວີຊັນລ່າສຸດ ເພື່ອປະສິດທິພາບການເຮັດວຽກທີ່ດີຂຶ້ນຂອງ Joah Warehouse.
                        </p>

                        {/* Modern Action Area */}
                        <div className="w-full relative">
                            <button onClick={() => setCountdown(0)} className="relative w-full overflow-hidden flex items-center justify-center gap-3 py-5 px-6 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-lg font-black shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all group">
                                <div className="absolute inset-0 bg-gradient-to-r from-orange-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <RefreshCw size={22} className="relative z-10 group-hover:rotate-180 transition-transform duration-700" />
                                <span className="relative z-10">ອັບເດດດຽວນີ້ ({countdown} ວິ)</span>
                            </button>
                            
                            {/* Soft progress bar bottom of button */}
                            <div className="absolute bottom-0 left-0 h-1 bg-white/20 dark:bg-black/20 rounded-b-2xl w-full overflow-hidden pointer-events-none">
                                <div className="h-full bg-orange-500 transition-all duration-1000 ease-linear" style={{ width: `${(1 - countdown / 5) * 100}%` }} />
                            </div>
                        </div>

                        <button onClick={onClose} className="mt-6 text-xs text-slate-400 font-bold hover:text-slate-600 dark:hover:text-slate-300 uppercase tracking-widest transition-colors flex items-center gap-1">
                            <X size={14} /> Skip (Test Only)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-950 font-joah animate-fade-in overflow-hidden">
            {/* Sci-Fi Grid Background */}
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px', transform: 'perspective(500px) rotateX(60deg) translateY(-100px) translateZ(-200px)' }} />
            
            <div className="relative w-full max-w-md mx-4 flex flex-col items-center">
                {/* Futuristic Logo Core */}
                <div className="relative w-32 h-32 mb-12">
                    {/* Spinning Outer Ring */}
                    <div className="absolute inset-[-20%] rounded-full border border-dashed border-orange-500/40 animate-[spin_10s_linear_infinite]" />
                    <div className="absolute inset-[-40%] rounded-full border border-orange-500/10 animate-[spin_15s_linear_infinite_reverse]" />
                    
                    {/* Glowing Core Logo */}
                    <div className="relative w-full h-full bg-slate-900 rounded-[2.5rem] p-2 shadow-[0_0_50px_rgba(249,115,22,0.3)] border border-orange-500/30 overflow-hidden flex items-center justify-center">
                        <img src={joahLogo} alt="JOAH" className="w-full h-full object-cover rounded-[2rem] opacity-90 mix-blend-screen" />
                        <div className="absolute inset-0 bg-orange-500/20 animate-pulse mix-blend-overlay" />
                    </div>
                </div>

                <div className="text-center mb-12 w-full px-8">
                    <h2 className="text-2xl font-black text-white mb-2 tracking-wide uppercase">System Updating</h2>
                    <p className="text-orange-400/80 font-bold text-sm tracking-widest mb-8">JOAH WAREHOUSE V2.0</p>
                    
                    {/* Sleek Progress Bar */}
                    <div className="relative h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                        <div className="absolute top-0 left-0 h-full bg-gradient-to-r from-orange-600 via-orange-400 to-amber-300 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.8)] transition-all ease-linear" style={{ width: `${loadingProgress}%`, transitionDuration: '80ms' }} />
                    </div>
                    
                    <div className="flex justify-between items-center text-[10px] font-black tracking-widest uppercase text-slate-500">
                        <span>Loading Core...</span>
                        <span className="text-orange-400">{Math.round(loadingProgress)}%</span>
                    </div>
                </div>

                {/* Cyberpunk Steps Terminal */}
                <div className="w-full max-w-sm bg-slate-900/50 rounded-2xl border border-slate-800 p-5 font-mono text-xs overflow-hidden backdrop-blur-md">
                    {loadingSteps.map((step, idx) => {
                        const isPast = idx < loadingStep;
                        const isCurrent = idx === loadingStep;
                        const isFuture = idx > loadingStep;
                        
                        if (isFuture) return null; // Only show current and past steps like a real terminal
                        
                        return (
                            <div key={idx} className={`flex items-start gap-3 mb-3 last:mb-0 animate-slide-up ${isPast ? 'opacity-50' : 'opacity-100'}`}>
                                <div className="mt-0.5 flex-shrink-0">
                                    {isPast ? <span className="text-emerald-500">✓</span> : <span className="text-orange-500 animate-pulse">></span>}
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

const Navbar = ({
    step,
    dbSource,
    dataSourceLabel,
    isDarkMode,
    setIsDarkMode,
    isProcessing,
    onRefresh,
    onShowHistory,
    onReset,
    currentUser,
    onOpenRequests,
    onLogout
}) => {
    const [pendingCount, setPendingCount] = useState(0);
    const prevPendingCountRef = useRef(0);
    const isFirstLoadRef = useRef(true);
    const [showTestReload, setShowTestReload] = useState(false);

    // Play sound when pending count increases
    useEffect(() => {
        if (step === 'results' && !isFirstLoadRef.current && pendingCount > prevPendingCountRef.current) {
            try {
                const audio = new Audio(notificationSound);
                audio.volume = 1.0;
                audio.play().catch(e => console.error("Audio play failed", e));
            } catch (error) {
                console.error("Audio error:", error);
            }
        }
        prevPendingCountRef.current = pendingCount;
        if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
        }
    }, [pendingCount, step]);


    useEffect(() => {
        // Re-fetch when user changes (different branch)
        fetchPendingCount();

        // Subscribe to real-time changes
        const subscription = supabase
            .channel('store_requests_count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_requests' }, () => {
                fetchPendingCount();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [currentUser]); // Re-subscribe when user/branch changes

    const fetchPendingCount = async () => {
        try {
            const isHQ = currentUser?.role === 'HQ';
            const userBranch = currentUser?.branch_id;

            let query = supabase
                .from('store_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            // Non-HQ: only count requests from their own branch
            if (!isHQ && userBranch) {
                query = query.eq('branch_id', userBranch);
            }

            const { count, error } = await query;

            if (!error) {
                setPendingCount(count || 0);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Language toggle
    const { language, toggleLanguage, t } = useLanguage();

    return (
        <>
        <nav className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-black/30">
            <div className="w-full">
                <div className="flex items-center justify-between h-28 px-6 lg:px-12">

                    {/* === LEFT: Brand Section with LED Border === */}
                    <div className="relative rounded-[1.75rem] p-[2.5px] led-border-glow overflow-hidden">
                        {/* Spinning gradient layer */}
                        <div className="led-spinner absolute inset-[-50%] z-0"></div>
                        {/* Inner content */}
                        <div className="relative z-10 flex items-center gap-6 bg-white dark:bg-slate-950 rounded-[1.6rem] px-6 py-3">
                            {/* Logo Image */}
                            <div className="relative">
                                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 transition-all duration-500">
                                    <img
                                        src={joahLogo}
                                        alt="JOAH Logo"
                                        className="w-full h-full object-contain p-1"
                                    />
                                </div>
                                {/* Online Status Indicator */}
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-3 border-white dark:border-slate-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></div>
                                </div>
                            </div>

                            {/* Brand Text */}
                            <div className="flex flex-col">
                                <div className="flex items-baseline gap-3">
                                    <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                                        JOAH
                                    </h1>
                                    <span className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-joah-orange via-orange-500 to-amber-500">
                                        INVENTORY
                                    </span>
                                </div>
                                <div className="flex items-center gap-4 mt-1.5">
                                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                                        {t('navbar.title')}
                                    </p>
                                    <div className="h-3.5 w-px bg-slate-200 dark:bg-slate-700"></div>
                                    {/* Mode Badge */}
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${dbSource === 'supabase'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {dbSource === 'supabase' ? <ShieldCheck size={12} /> : <Database size={12} />}
                                        <span>{dbSource === 'supabase' ? t('navbar.cloudMode') : t('navbar.localMode')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === RIGHT: Actions Section === */}
                    <div className="flex items-center gap-4">
                        {/* Notifications - Only show in results step */}
                        {step === 'results' && (
                            <div className="relative group cursor-pointer mr-4" onClick={onOpenRequests}>
                                <div className="p-3 rounded-full bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-all">
                                    <Mail size={24} />
                                </div>
                                {pendingCount > 0 && (
                                    <div className="absolute -top-1 -right-1 w-6 h-6 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white dark:border-slate-950 animate-bounce">
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* User Profile Badge */}
                        {currentUser && (
                            <div className="hidden md:flex flex-col items-end mr-2">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter ${currentUser.workplace === 'back'
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'bg-joah-orange text-white'
                                        }`}>
                                        {currentUser.workplace === 'back' ? 'BACK' : 'FRONT'}
                                    </span>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('navbar.loggedInAs')}</p>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">{currentUser.name}</p>
                                {currentUser.branch_id && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-wide">{currentUser.branch_id}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action Buttons Container */}
                        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                            {/* History Button - Hidden on Upload page and for Front store workers */}
                            {step !== 'upload' && currentUser?.workplace !== 'front' && (
                                <button
                                    onClick={onShowHistory}
                                    className="w-14 h-14 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-lg transition-all duration-300"
                                    title="ປະຫວັດການແກ້ໄຂ (Audit Log)"
                                >
                                    <History size={22} />
                                </button>
                            )}

                            {/* Refresh Button - Only visible in results step */}
                            {step === 'results' && (
                                <button
                                    onClick={onRefresh}
                                    disabled={isProcessing}
                                    className="w-14 h-14 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="ໂຍນຂໍ້ມູນໃໝ່ (Refresh)"
                                >
                                    <RotateCw size={22} className={isProcessing ? 'animate-spin' : ''} />
                                </button>
                            )}


                            {/* 🧪 TEST: Force Update UI Preview - REMOVE BEFORE PRODUCTION */}
                            <button
                                onClick={() => setShowTestReload(true)}
                                className="w-14 h-14 flex items-center justify-center rounded-xl text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 hover:text-purple-600 hover:shadow-lg transition-all duration-300"
                                title="🧪 Test Reload Prompt UI"
                            >
                                <Sparkles size={22} />
                            </button>

                            {/* Divider */}
                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                            {/* Language Toggle */}
                            <button
                                onClick={toggleLanguage}
                                className="w-14 h-14 flex items-center justify-center rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 group relative overflow-hidden"
                                title={language === 'lo' ? 'Switch to English' : 'ປ່ຽນເປັນພາສາລາວ'}
                            >
                                <div className="relative w-8 h-8 rounded-lg overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-joah-orange group-hover:scale-110 transition-all duration-300">
                                    <img
                                        src={language === 'lo' ? laosFlag : englishFlag}
                                        alt={language === 'lo' ? 'Lao' : 'English'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </button>

                            {/* Theme Toggle */}
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="w-14 h-14 flex items-center justify-center rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-lg transition-all duration-300"
                                title="ປ່ຽນໂໝດສີ (Toggle Theme)"
                            >
                                {isDarkMode ? <Sun size={22} /> : <Moon size={22} />}
                            </button>


                        </div>

                        {/* Reset/Home Button - Visible only when not on upload step */}
                        {step !== 'upload' && (
                            <button
                                onClick={onReset}
                                className="h-14 px-6 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold text-sm uppercase tracking-widest hover:from-rose-600 hover:to-rose-700 shadow-xl shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-105 transition-all duration-300"
                            >
                                <Home size={20} />
                                <span>HOME</span>
                            </button>
                        )}

                        {/* Logout Button - Always Visible */}
                        {currentUser && (
                            <button
                                onClick={onLogout}
                                className="h-14 px-4 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:border-rose-200 dark:hover:border-rose-800 transition-all duration-300 shadow-sm"
                                title="ອອກຈາກລະບົບ (Logout)"
                            >
                                <LogOut size={20} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* LED Border Animation Styles */}
            <style>{`
                .led-border-glow {
                    position: relative;
                }
                .led-spinner {
                    background: conic-gradient(
                        #f97316, #f59e0b, #10b981, #06b6d4, #6366f1, #a855f7, #f97316
                    );
                    animation: led-spin 4s linear infinite;
                }
                @keyframes led-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </nav>
        
        {/* 🧪 TEST ReloadPrompt Modal - triggered by Sparkles button */}
        {showTestReload && (
            <TestReloadPrompt onClose={() => setShowTestReload(false)} />
        )}
        </>
    );
};

export default Navbar;
