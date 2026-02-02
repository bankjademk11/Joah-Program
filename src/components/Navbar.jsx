import { History, RotateCw, Sun, Moon, X, ShieldCheck, Database, Menu, Home, Mail } from 'lucide-react';
import joahLogo from '../assets/Joah.jpeg';
import { supabase } from '../utils/supabaseClient';
import { useState, useEffect } from 'react';

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
    onOpenRequests
}) => {
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        // Initial fetch
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
    }, []);

    const fetchPendingCount = async () => {
        try {
            const { count, error } = await supabase
                .from('store_requests')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'pending');

            if (!error) {
                setPendingCount(count || 0);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <nav className="sticky top-0 z-50 bg-white dark:bg-slate-950 border-b-2 border-slate-100 dark:border-slate-800 shadow-xl shadow-slate-200/30 dark:shadow-black/30">
            <div className="max-w-[1800px] mx-auto">
                <div className="flex items-center justify-between h-28 px-8">

                    {/* === LEFT: Brand Section === */}
                    <div className="flex items-center gap-6 cursor-pointer group" onClick={onReset}>
                        {/* Logo Image */}
                        <div className="relative">
                            <div className="w-24 h-24 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 group-hover:scale-105 transition-all duration-500">
                                <img
                                    src={joahLogo}
                                    alt="JOAH Logo"
                                    className="w-full h-full object-contain p-1"
                                />
                            </div>
                            {/* Online Status Indicator */}
                            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-white dark:border-slate-950 flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                            </div>
                        </div>

                        {/* Brand Text */}
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-3">
                                <h1 className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                                    JOAH
                                </h1>
                                <span className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-joah-orange via-orange-500 to-amber-500">
                                    TOOLS
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                                <p className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.25em]">
                                    Warehouse Validator
                                </p>
                                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                                {/* Mode Badge */}
                                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${dbSource === 'supabase'
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                    {dbSource === 'supabase' ? <ShieldCheck size={14} /> : <Database size={14} />}
                                    <span>{dbSource === 'supabase' ? 'Cloud Mode' : 'Local Mode'}</span>
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
                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Logged in as</p>
                                <p className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[200px]">{currentUser.name}</p>
                            </div>
                        )}

                        {/* Action Buttons Container */}
                        <div className="flex items-center gap-1 p-2 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
                            {/* History Button - Hidden on Upload page */}
                            {step !== 'upload' && (
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

                            {/* Divider */}
                            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>

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
                                title="ກັບຄືນໜ້າຫຼັກ (Reset)"
                            >
                                <Home size={20} />
                                <span className="hidden md:inline">Home</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
