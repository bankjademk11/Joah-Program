import { TrendingUp, CheckCircle, XCircle, AlertCircle, Sparkles, AlertTriangle, RefreshCw, PackageOpen, Eye, EyeOff, Layers } from 'lucide-react';
import { useState } from 'react';

const StoreDashboard = ({ stats, activeFilter, onFilterChange, hideZeroQty, onHideZeroQtyChange }) => {
    const [isZeroMode, setIsZeroMode] = useState(true);

    const cards = [
        {
            id: 'all',
            title: 'ທັງໝົດ',
            subtitle: 'Total Items',
            value: stats.total,
            icon: Layers,
            gradient: 'from-slate-800 to-slate-900',
            glow: 'shadow-slate-800/30',
            iconBg: 'bg-gradient-to-br from-slate-700 to-slate-900',
            ring: 'ring-slate-800/40'
        },
        {
            id: 'passed',
            title: 'ຖືກຕ້ອງ',
            subtitle: 'Matched',
            value: stats.passed,
            icon: CheckCircle,
            gradient: 'from-emerald-500 to-emerald-700',
            glow: 'shadow-emerald-600/40',
            iconBg: 'bg-gradient-to-br from-emerald-400 to-emerald-600',
            ring: 'ring-emerald-500/40'
        },
        {
            id: 'mismatch',
            title: 'ບໍ່ກົງກັນ',
            subtitle: 'Mismatch',
            value: stats.mismatch,
            icon: AlertTriangle,
            gradient: 'from-rose-500 to-rose-700',
            glow: 'shadow-rose-600/40',
            iconBg: 'bg-gradient-to-br from-rose-400 to-rose-600',
            ring: 'ring-rose-500/40'
        },
        {
            id: 'incomplete',
            title: 'ຂໍ້ມູນບໍ່ຄົບ',
            subtitle: 'Incomplete',
            value: stats.incomplete,
            icon: AlertCircle,
            gradient: 'from-amber-500 to-amber-700',
            glow: 'shadow-amber-600/40',
            iconBg: 'bg-gradient-to-br from-amber-400 to-amber-600',
            ring: 'ring-amber-500/40'
        },
        {
            id: 'missing',
            title: 'ສິນຄ້າເປັນ 0',
            subtitle: 'Zero Quantity',
            value: stats.missing,
            icon: XCircle,
            gradient: 'from-orange-500 to-red-700',
            glow: 'shadow-red-600/40',
            iconBg: 'bg-gradient-to-br from-orange-400 to-red-600',
            ring: 'ring-red-500/40'
        },
    ];

    const percentage = (value) => stats.total > 0 ? ((value / stats.total) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-10 animate-fade-in-up">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-2">
                <div className="flex items-center gap-5">
                    <div className="p-4 rounded-[2rem] bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-2xl shadow-emerald-500/40 transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                        <Sparkles size={28} strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-black uppercase tracking-wider border border-emerald-500/20">Executive Suite</span>
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Real-time Data Sync</span>
                            </div>
                        </div>
                        <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">ສະຖິຕິການກວດສອບ</h3>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Advanced Inventory Performance Analytics</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Zero Qty Toggle (Premium Style) */}
                    {onHideZeroQtyChange && (
                        <button
                            onClick={() => onHideZeroQtyChange(!hideZeroQty)}
                            className={`flex items-center gap-3 px-6 py-4 rounded-[1.75rem] border-2 transition-all duration-300 hover:scale-105 active:scale-95 ${hideZeroQty
                                    ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400 shadow-xl shadow-rose-500/10'
                                    : 'bg-white border-slate-100 text-slate-500 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 shadow-sm'
                                }`}
                        >
                            <div className={`p-2 rounded-xl ${hideZeroQty ? 'bg-rose-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                                {hideZeroQty ? <EyeOff size={18} /> : <Eye size={18} />}
                            </div>
                            <div className="text-left">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Status</p>
                                <p className="text-xs font-black uppercase tracking-wider">{hideZeroQty ? 'Hiding 0 Qty' : 'Showing 0 Qty'}</p>
                            </div>
                        </button>
                    )}
                </div>
            </div>

            {/* Premium Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    const isActive = activeFilter === card.id;

                    return (
                        <div
                            key={card.id}
                            className={`group relative overflow-hidden rounded-[2.5rem] transition-all duration-700 cursor-pointer
                                ${isActive
                                    ? `bg-gradient-to-br ${card.gradient} shadow-2xl ${card.glow} scale-[1.05] -translate-y-2 ring-4 ring-emerald-500/10 dark:ring-white/5`
                                    : 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-3xl border-2 border-slate-100 dark:border-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-2xl hover:shadow-slate-200/50 dark:hover:shadow-black/40 hover:-translate-y-2'
                                }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                            onClick={() => onFilterChange(card.id)}
                        >
                            {/* Animated Background Blob for Active */}
                            {isActive && (
                                <div className="absolute inset-0 overflow-hidden">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-[80px] rounded-full animate-pulse-slow"></div>
                                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 blur-[60px] rounded-full"></div>
                                </div>
                            )}

                            <div className="relative p-8 h-full flex flex-col justify-between">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-8">
                                    <div className={`p-4 rounded-[1.75rem] transition-all duration-500 ${isActive ? 'bg-white/20 text-white rotate-6' : `${card.iconBg} text-white shadow-xl ${card.glow} group-hover:-rotate-12`}`}>
                                        <Icon size={24} strokeWidth={2.5} />
                                    </div>
                                    {card.isToggle && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setIsZeroMode(!isZeroMode);
                                                if (isActive) onFilterChange(isZeroMode ? 'hasQty' : 'zero');
                                            }}
                                            className={`p-3 rounded-2xl border transition-all duration-300 ${isActive ? 'bg-white/10 border-white/20 text-white hover:rotate-180' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 group-hover:bg-slate-200 dark:group-hover:bg-slate-700'}`}
                                            title="ສັບປ່ຽນ"
                                        >
                                            <RefreshCw size={16} className={isActive ? 'animate-spin-slow' : ''} />
                                        </button>
                                    )}
                                </div>

                                {/* Value & Title */}
                                <div>
                                    <div className="flex items-baseline gap-3 mb-2">
                                        <span className={`text-5xl font-black tracking-tighter tabular-nums ${isActive ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                            {card.value.toLocaleString()}
                                        </span>
                                        {card.id !== 'all' && stats.total > 0 && (
                                            <div className="flex flex-col">
                                                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-white/60' : 'text-slate-400'}`}>Target</span>
                                                <span className={`text-xs font-black ${isActive ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'}`}>
                                                    {percentage(card.value)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="relative">
                                        <p className={`text-[11px] font-black uppercase tracking-[0.25em] mb-1 leading-none ${isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {card.subtitle}
                                        </p>
                                        <h4 className={`text-base font-black ${isActive ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                                            {card.title}
                                        </h4>
                                    </div>
                                </div>

                                {/* Modern Progress Bar */}
                                <div className="mt-8 space-y-2">
                                    <div className={`h-2.5 w-full rounded-full overflow-hidden ${isActive ? 'bg-black/20' : 'bg-slate-100 dark:bg-slate-800 border-inner shadow-inner'}`}>
                                        <div
                                            className={`h-full rounded-full transition-all duration-[1.5s] ease-out-expo ${isActive ? 'bg-white shadow-[0_0_12px_rgba(255,255,255,0.5)]' : `bg-gradient-to-r ${card.gradient}`}`}
                                            style={{ width: `${percentage(card.value)}%` }}
                                        />
                                    </div>
                                    {isActive && (
                                        <div className="flex justify-between items-center px-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-50"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-30"></div>
                                            <div className="w-1.5 h-1.5 rounded-full bg-white opacity-10"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Selection Effect Ring */}
                            {isActive && (
                                <div className={`absolute inset-0 border-4 border-white/20 rounded-[2.5rem] pointer-events-none`}></div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StoreDashboard;
