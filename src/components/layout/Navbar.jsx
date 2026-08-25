import { History, RotateCw, Sun, Moon, X, ShieldCheck, Database, Menu, Home, Mail, LogOut, LayoutGrid, Gift } from 'lucide-react';
import LowStockBell from '../ui/LowStockBell';
import GachaModal from '../ui/GachaModal';
import joahLogo from '../../assets/favicon-full-transparent.png';
import laosFlag from '../../assets/Laos.png';
import englishFlag from '../../assets/EnglishFlang.png';
import { supabase } from '../../utils/supabaseClient';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import notificationSound from '../../assets/notification_compact.mp3';

const STORE_STEPS = ['store-inventory-mockup', 'store-request', 'store-request-by-rack'];

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
    onOpenStoreInbox,
    onLogout,
    onOpenAppLauncher
}) => {
    const [pendingCount, setPendingCount] = useState(0);
    const prevPendingCountRef = useRef(0);
    const isFirstLoadRef = useRef(true);
    const lastSoundTimeRef = useRef(0);
    const shouldPlaySoundRef = useRef(false);
    const [soundTrigger, setSoundTrigger] = useState(0);

    // ── 🎁 Gacha Box Modal State ─────────────────────────────────────────────
    const [showGachaModal, setShowGachaModal] = useState(false);

    // ── 🔄 Auto Update Detection ──────────────────────────────────────────────
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateCountdown, setUpdateCountdown] = useState(30);
    const initialHashRef = useRef(null);

    // Check if app has been updated by comparing index.html script hashes
    const checkForUpdate = useCallback(async () => {
        try {
            const res = await fetch('/', { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } });
            const html = await res.text();
            // Extract all script src hashes from index.html
            const matches = html.match(/src=\"\/assets\/[^"]+\.js\"/g) || [];
            const hash = matches.sort().join('|');
            if (!hash) return;
            if (!initialHashRef.current) {
                initialHashRef.current = hash; // Store first hash on mount
            } else if (hash !== initialHashRef.current) {
                setUpdateAvailable(true); // 🆕 New deploy detected!
            }
        } catch (e) {
            // Silently ignore network errors
        }
    }, []);

    // Poll every 5 minutes
    useEffect(() => {
        checkForUpdate(); // Initial check on mount
        const interval = setInterval(checkForUpdate, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [checkForUpdate]);

    // Countdown timer when update is available
    useEffect(() => {
        if (!updateAvailable) return;
        setUpdateCountdown(30);
        const timer = setInterval(() => {
            setUpdateCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    window.location.reload();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [updateAvailable]);

    // Play sound when relevant change occurs (with 10s cooldown)
    useEffect(() => {
        if (soundTrigger === 0) return; // Don't play on initial load

        const now = Date.now();
        const canPlaySound = now - lastSoundTimeRef.current > 10000; // 10s cooldown

        if (['upload', 'results', 'store-inventory-mockup', 'store-request', 'store-request-by-rack', 'hq-dashboard'].includes(step) &&
            !isFirstLoadRef.current &&
            shouldPlaySoundRef.current &&
            canPlaySound) {
            try {
                const audio = new Audio(notificationSound);
                audio.volume = 0.8;
                audio.play().catch(e => console.error("Audio play failed", e));
                lastSoundTimeRef.current = now;
            } catch (error) {
                console.error("Audio error:", error);
            }
        }

        // Reset sound flag
        shouldPlaySoundRef.current = false;
    }, [soundTrigger, step]);

    // Keep track of counts
    useEffect(() => {
        prevPendingCountRef.current = pendingCount;
        if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
        }
    }, [pendingCount]);


    const isStoreMode = STORE_STEPS.includes(step);

    const fetchPendingCount = useCallback(async () => {
        try {
            const isHQ = currentUser?.role === 'HQ';
            const userBranch = currentUser?.branch_id;
            const userName = currentUser?.name || 'Store Staff';
            const userId = currentUser?.id;

            let query = supabase
                .from('store_requests')
                .select('*', { count: 'exact', head: true });

            if (isStoreMode) {
                // Store pages: count accepted requests waiting for store confirmation for THIS user
                query = query.eq('status', 'accepted').is('store_confirmed_at', null)
                    .gte('created_at', '2026-08-01T00:00:00.000Z');

                if (userId) {
                    query = query.or(`request_by.ilike.%${userName}%,request_by.ilike.%${userId}%`);
                } else {
                    query = query.ilike('request_by', `%${userName}%`);
                }

                // Keep branch filter as a safety boundary
                if (userBranch) query = query.eq('branch_id', userBranch);
            } else {
                // Inventory/HQ page: count pending requests
                query = query.eq('status', 'pending');
                if (!isHQ && userBranch) query = query.eq('branch_id', userBranch);
            }

            const { count, error } = await query;
            if (!error) setPendingCount(count || 0);
        } catch (err) {
            console.error(err);
        }
    }, [currentUser, isStoreMode]);

    useEffect(() => {
        fetchPendingCount();

        const debounceTimer = { current: null };

        const subscription = supabase
            .channel('store_requests_count')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'store_requests' }, (payload) => {
                const { eventType, new: newData, old: oldData } = payload;
                const isWarehouseStaff = currentUser?.role === 'HQ' || currentUser?.workplace === 'back';
                const userBranch = currentUser?.branch_id;

                let isRelevant = false;

                if (isWarehouseStaff) {
                    // Warehouse/HQ cares about NEW pending requests coming in
                    if (eventType === 'INSERT' && newData.status === 'pending') {
                        if (!userBranch || newData.branch_id === userBranch) isRelevant = true;
                    }
                } else {
                    // Store ('front') cares about their requests being ACCEPTED by HQ
                    const userName = currentUser?.name;
                    const userId = currentUser?.id;

                    if (eventType === 'UPDATE' && newData.status === 'accepted') {
                        // Match by ID in the string or just the name
                        const reqBy = newData.request_by || '';
                        const matchesUser = (userId && reqBy.includes(`(${userId})`)) || (userName && reqBy.includes(userName));

                        if (matchesUser) isRelevant = true;
                    }
                }

                if (isRelevant) {
                    console.log('🔔 Relevant notification event:', eventType, newData);
                    shouldPlaySoundRef.current = true;
                    setSoundTrigger(prev => prev + 1); // <--- Trigger the sound effect
                    if (debounceTimer.current) clearTimeout(debounceTimer.current);
                    debounceTimer.current = setTimeout(fetchPendingCount, 1000);
                } else {
                    if (debounceTimer.current) clearTimeout(debounceTimer.current);
                    debounceTimer.current = setTimeout(fetchPendingCount, 1000);
                }
            })
            .subscribe();

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            subscription.unsubscribe();
        };
    }, [fetchPendingCount]);

    // Language toggle
    const { language, toggleLanguage, t } = useLanguage();

    return (
        <nav className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-black/30">

            {/* ── 🆕 App Update Banner ─────────────────────────────────────── */}
            {updateAvailable && (
                <div className="w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-white px-4 py-2.5 flex items-center justify-between gap-3 animate-pulse">
                    <div className="flex items-center gap-2.5 text-sm font-bold">
                        <span className="text-lg">🚀</span>
                        <span>ມີການອັບເດດໃໝ່ຂອງລະບົບ! ກຳລັງໂຫຼດໃໝ່ອັດຕະໂນມັດໃນ</span>
                        <span className="bg-white/20 rounded-full px-3 py-0.5 font-mono text-lg min-w-[2.5rem] text-center">
                            {updateCountdown}
                        </span>
                        <span>ວິນາທີ...</span>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="shrink-0 bg-white text-emerald-600 font-black text-sm px-4 py-1.5 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
                    >
                        ອັບເດດດຽວນີ້ ⚡
                    </button>
                </div>
            )}

            <div className="w-full">
                <div className="flex items-center justify-between h-14 sm:h-20 lg:h-28 px-3 sm:px-6 lg:px-12 gap-2">

                    {/* === LEFT: Brand Section with LED Border === */}
                    <div className="relative rounded-[1.25rem] sm:rounded-[1.75rem] p-[2px] sm:p-[2.5px] led-border-glow overflow-hidden shrink-0">
                        {/* Spinning gradient layer */}
                        <div className="led-spinner absolute inset-[-50%] z-0"></div>
                        {/* Inner content */}
                        <div className="relative z-10 flex items-center gap-2.5 sm:gap-6 bg-white dark:bg-slate-950 rounded-[1.15rem] sm:rounded-[1.6rem] px-2.5 sm:px-6 py-1.5 sm:py-3">
                            {/* Logo Image */}
                            <div className="relative">
                                <div className="w-9 h-9 sm:w-14 sm:h-14 lg:w-20 lg:h-20 rounded-xl sm:rounded-2xl overflow-hidden bg-white dark:bg-slate-800 transition-all duration-500">
                                    <img
                                        src={joahLogo}
                                        alt="JOAH Logo"
                                        className="w-full h-full object-contain p-0.5 sm:p-1"
                                    />
                                </div>
                                {/* Online dot */}
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-950 flex items-center justify-center">
                                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-white rounded-full animate-ping"></div>
                                </div>
                            </div>

                            {/* Brand Text */}
                            <div className="flex flex-col min-w-0">
                                <div className="flex items-baseline gap-1 sm:gap-3">
                                    <h1 className="text-base sm:text-xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-none">
                                        JOAH
                                    </h1>
                                    <span className="text-base sm:text-xl lg:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-joah-orange via-orange-500 to-amber-500 leading-none">
                                        INVENTORY
                                    </span>
                                </div>
                                {/* Subtitle — hidden on mobile */}
                                <div className="hidden sm:flex items-center gap-2 lg:gap-4 mt-1 lg:mt-1.5 flex-wrap">
                                    <p className="text-[9px] lg:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] lg:tracking-[0.25em]">
                                        {t('navbar.title')}
                                    </p>
                                    <div className="h-3 w-px bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>
                                    {/* Mode Badge — hidden on sm, show on lg */}
                                    <div className={`hidden lg:flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${dbSource === 'supabase'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                        }`}>
                                        {dbSource === 'supabase' ? <ShieldCheck size={12} /> : <Database size={12} />}
                                        <span>{dbSource === 'supabase' ? t('navbar.cloudMode') : t('navbar.localMode')}</span>
                                    </div>
                                    <div className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[9px] font-black text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 hidden lg:block">
                                        v3.0
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* === RIGHT: Actions Section === */}
                    <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4">
                        {/* Notifications */}
                        {['results', 'store-inventory-mockup', 'store-request', 'store-request-by-rack'].includes(step) && (
                            <div
                                className="relative group cursor-pointer"
                                onClick={isStoreMode ? onOpenStoreInbox : onOpenRequests}
                                title={isStoreMode ? 'ຂອງທີ່ສາງອະນຸມັດ · ລໍຖ້າຢືນຢັນ' : 'ຈັດການ Store Requests'}
                            >
                                <div className={`p-2 sm:p-3 rounded-full transition-all relative ${pendingCount > 0
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 ring-4 ring-emerald-500/30 animate-pulse'
                                    : isStoreMode
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40'
                                        : 'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-500/10 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                                    }`}>
                                    <Mail size={20} className={`sm:w-6 sm:h-6 ${pendingCount > 0 ? 'animate-bounce' : ''}`} />
                                </div>
                                {pendingCount > 0 && (
                                    <div className={`absolute -top-1 -right-1 min-w-[20px] h-[20px] sm:w-6 sm:h-6 text-white text-[10px] sm:text-[11px] font-black rounded-full flex items-center justify-center px-1 border-2 border-white dark:border-slate-950 shadow-md ${isStoreMode ? 'bg-emerald-600' : 'bg-rose-500'
                                        }`}>
                                        {pendingCount > 99 ? '99+' : pendingCount}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Low Stock Bell — only on store pages */}
                        {['store-inventory-mockup'].includes(step) && (
                            <LowStockBell />
                        )}

                        {/* User Profile Badge — hidden on mobile */}
                        {currentUser && (
                            <div className="hidden lg:flex flex-col items-end mr-1">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-black uppercase tracking-tighter ${currentUser.workplace === 'back'
                                        ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                        : 'bg-joah-orange text-white'
                                        }`}>
                                        {currentUser.workplace === 'back' ? 'BACK' : 'FRONT'}
                                    </span>
                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('navbar.loggedInAs')}</p>
                                </div>
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[160px]">{currentUser.name}</p>
                                {currentUser.branch_id && (
                                    <div className="flex items-center gap-1 mt-0.5">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                        <span className="text-[10px] font-black text-cyan-600 dark:text-cyan-400 tracking-wide">{currentUser.branch_id}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Action Buttons Container - Hide some children on mobile to save space, but keep the container visible for Dark Mode */}
                        <div className="flex items-center gap-0.5 sm:gap-1 p-1 sm:p-2 bg-slate-50 dark:bg-slate-900 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-slate-800">
                            {/* History Button - hidden on upload and for front workers */}
                            {step !== 'upload' && currentUser?.workplace !== 'front' && (
                                <button
                                    onClick={onShowHistory}
                                    className="hidden sm:flex w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 items-center justify-center rounded-lg sm:rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 hover:shadow-lg transition-all duration-300"
                                    title="ປະຫວັດການແກ້ໄຂ (Audit Log)"
                                >
                                    <History size={18} className="sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px]" />
                                </button>
                            )}

                            {/* Refresh Button */}
                            {step === 'results' && (
                                <button
                                    onClick={onRefresh}
                                    disabled={isProcessing}
                                    className="w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="ໂຍນຂໍ້ມູນໃໝ່ (Refresh)"
                                >
                                    <RotateCw size={18} className={`sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px] ${isProcessing ? 'animate-spin' : ''}`} />
                                </button>
                            )}

                            {/* Divider */}
                            <div className="w-px h-5 sm:h-8 bg-slate-200 dark:bg-slate-700 mx-0.5 sm:mx-1"></div>

                            {/* Language Toggle - Hidden on mobile to save space */}
                            {/* Language Toggle */}
                            <button
                                onClick={toggleLanguage}
                                className="hidden sm:flex w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 items-center justify-center rounded-lg sm:rounded-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-lg transition-all duration-300 group"
                                title={language === 'lo' ? 'Switch to English' : 'ປ່ຽນເປັນພາສາລາວ'}
                            >
                                <div className="relative w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-md sm:rounded-lg overflow-hidden ring-2 ring-slate-200 dark:ring-slate-700 group-hover:ring-joah-orange group-hover:scale-110 transition-all duration-300">
                                    <img
                                        src={language === 'lo' ? laosFlag : englishFlag}
                                        alt={language === 'lo' ? 'Lao' : 'English'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </button>

                            {/* Gacha Gift Box Button — Dev Only (K2601097) */}
                            {currentUser?.id === 'K2601097' && (
                                <button
                                    onClick={() => setShowGachaModal(true)}
                                    className="w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-lg transition-all duration-300"
                                    title="สุ่มกาชาสุ่มไอเทมมินิเกม MMO RPG (Gacha Box)"
                                >
                                    <Gift size={18} className="sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px]" />
                                </button>
                            )}

                            {/* Theme Toggle */}
                            <button
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="w-9 h-9 sm:w-12 sm:h-12 lg:w-14 lg:h-14 flex items-center justify-center rounded-lg sm:rounded-xl text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-amber-500 dark:hover:text-amber-400 hover:shadow-lg transition-all duration-300"
                                title="ປ່ຽນໂໝດສີ (Toggle Theme)"
                            >
                                {isDarkMode ? <Sun size={18} className="sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px]" /> : <Moon size={18} className="sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px]" />}
                            </button>
                        </div>

                        {/* Gacha Modal */}
                        <GachaModal
                            isOpen={showGachaModal}
                            onClose={() => setShowGachaModal(false)}
                        />

                        {/* App Launcher Button (Only for HQ) */}
                        <div className="flex items-center gap-2">
                            {currentUser?.role === 'HQ' && (
                                <button
                                    onClick={onOpenAppLauncher}
                                    className="h-9 w-9 sm:h-12 sm:w-12 lg:h-14 lg:w-14 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-joah-orange hover:text-white hover:border-joah-orange dark:hover:bg-joah-orange shadow-sm hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all duration-300 shrink-0 group"
                                    title="ລວມແອັບ (App Launcher)"
                                >
                                    <LayoutGrid size={20} className="sm:w-6 sm:h-6 group-hover:animate-pulse" />
                                </button>
                            )}

                            {/* Reset/Home Button */}
                            {step !== 'upload' && (
                                <button
                                    onClick={onReset}
                                    className="h-9 sm:h-12 lg:h-14 px-3 sm:px-5 lg:px-6 flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl bg-gradient-to-r from-rose-500 to-rose-600 text-white font-bold text-[10px] sm:text-sm uppercase tracking-widest hover:from-rose-600 hover:to-rose-700 shadow-lg sm:shadow-xl shadow-rose-500/30 hover:shadow-rose-500/50 hover:scale-105 transition-all duration-300 shrink-0"
                                >
                                    <Home size={16} className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="inline">HOME</span>
                                </button>
                            )}
                        </div>

                        {/* Logout Button */}
                        {currentUser && (
                            <button
                                onClick={onLogout}
                                className="h-9 sm:h-12 lg:h-14 px-3 sm:px-4 flex items-center justify-center rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:border-rose-200 dark:hover:border-rose-800 transition-all duration-300 shadow-sm shrink-0"
                                title="ອອກຈາກລະບົບ (Logout)"
                            >
                                <LogOut size={16} className="sm:w-[18px] sm:h-[18px] lg:w-5 lg:h-5" />
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
    );
};

export default Navbar;
