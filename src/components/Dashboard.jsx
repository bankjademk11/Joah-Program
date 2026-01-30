import { TrendingUp, CheckCircle, XCircle, AlertCircle, Sparkles, AlertTriangle, RefreshCw, PackageOpen } from 'lucide-react';
import { useState } from 'react';

const Dashboard = ({ stats, activeFilter, onFilterChange }) => {
    const [isZeroMode, setIsZeroMode] = useState(true);

    const cards = [
        {
            id: 'all',
            title: 'ທັງໝົດ',
            subtitle: 'Total Items',
            value: stats.total,
            icon: TrendingUp,
            gradient: 'from-violet-500 to-indigo-600',
            glow: 'shadow-violet-500/25',
            iconBg: 'bg-gradient-to-br from-violet-400 to-indigo-500',
            ring: 'ring-violet-500/30'
        },
        {
            id: 'passed',
            title: 'ຖືກຕ້ອງ',
            subtitle: 'Matched',
            value: stats.passed,
            icon: CheckCircle,
            gradient: 'from-emerald-500 to-teal-600',
            glow: 'shadow-emerald-500/25',
            iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500',
            ring: 'ring-emerald-500/30'
        },
        {
            id: 'mismatch',
            title: 'ບໍ່ກົງກັນ',
            subtitle: 'Mismatch',
            value: stats.mismatch,
            icon: XCircle,
            gradient: 'from-rose-500 to-pink-600',
            glow: 'shadow-rose-500/25',
            iconBg: 'bg-gradient-to-br from-rose-400 to-pink-500',
            ring: 'ring-rose-500/30'
        },
        {
            id: 'missing',
            title: 'ຂໍ້ມູນບໍ່ຄົບ',
            subtitle: 'Incomplete',
            value: stats.missing,
            icon: AlertCircle,
            gradient: 'from-amber-500 to-orange-600',
            glow: 'shadow-amber-500/25',
            iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500',
            ring: 'ring-amber-500/30'
        },
        {
            id: isZeroMode ? 'zero' : 'hasQty',
            title: isZeroMode ? 'ສິນຄ້າເປັນ 0' : 'ສິນຄ້າມີຈໍານວນ',
            subtitle: isZeroMode ? 'Zero Quantity' : 'In Stock Items',
            value: isZeroMode ? (stats.zeroQty || 0) : (stats.hasQty || 0),
            icon: isZeroMode ? AlertTriangle : PackageOpen,
            gradient: isZeroMode ? 'from-orange-500 to-red-600' : 'from-sky-500 to-blue-600',
            glow: isZeroMode ? 'shadow-orange-500/25' : 'shadow-sky-500/25',
            iconBg: isZeroMode ? 'bg-gradient-to-br from-orange-400 to-red-500' : 'bg-gradient-to-br from-sky-400 to-blue-500',
            ring: isZeroMode ? 'ring-orange-500/30' : 'ring-sky-500/30',
            isToggle: true
        },
    ];

    const percentage = (value) => stats.total > 0 ? ((value / stats.total) * 100).toFixed(1) : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-gradient-to-br from-joah-orange to-orange-600 text-white shadow-lg shadow-orange-500/30">
                        <Sparkles size={20} />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 dark:text-white">ສະຖິຕິການກວດສອບ</h3>
                        <p className="text-xs font-medium text-slate-400 dark:text-slate-500">Validation Statistics</p>
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Live Data</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6">
                {cards.map((card, index) => {
                    const Icon = card.icon;
                    const isActive = activeFilter === card.id;

                    return (
                        <div
                            key={card.id}
                            className={`group relative overflow-hidden rounded-[1.75rem] transition-all duration-500 cursor-pointer
                                ${isActive
                                    ? `bg-gradient-to-br ${card.gradient} shadow-2xl ${card.glow} scale-[1.03] ring-2 ring-white/50 dark:ring-white/20 ring-offset-4 ring-offset-transparent`
                                    : 'bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-xl hover:-translate-y-1'
                                }`}
                            style={{ animationDelay: `${index * 80}ms` }}
                            onClick={() => onFilterChange(card.id)}
                        >
                            {/* Background Pattern */}
                            <div className={`absolute inset-0 opacity-10 bg-grid ${isActive ? 'opacity-20' : ''}`}></div>

                            {/* Glow Effect for Active */}
                            {isActive && (
                                <div className="absolute -top-20 -right-20 w-40 h-40 rounded-full bg-white/30 blur-3xl"></div>
                            )}

                            <div className="relative p-6">
                                {/* Header */}
                                <div className="flex items-start justify-between mb-6">
                                    <div>
                                        <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isActive ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'}`}>
                                            {card.subtitle}
                                        </p>
                                        <h4 className={`text-sm font-black ${isActive ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {card.title}
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-3 rounded-2xl transition-all duration-300 ${isActive ? 'bg-white/20 text-white' : `${card.iconBg} text-white shadow-lg ${card.glow}`} group-hover:scale-110`}>
                                            <Icon size={20} strokeWidth={2.5} />
                                        </div>
                                        {card.isToggle && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsZeroMode(!isZeroMode);
                                                    if (isActive) onFilterChange(isZeroMode ? 'hasQty' : 'zero');
                                                }}
                                                className={`p-2 rounded-xl border border-white/20 hover:bg-white/10 transition-all ${isActive ? 'text-white' : 'text-slate-400 opacity-0 group-hover:opacity-100'}`}
                                                title="สลับโหมด"
                                            >
                                                <RefreshCw size={14} className={isActive ? 'animate-spin-slow' : ''} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Value */}
                                <div className="flex items-baseline gap-3 mb-4">
                                    <span className={`text-4xl sm:text-5xl font-black tracking-tight tabular-nums ${isActive ? 'text-white' : 'text-slate-800 dark:text-white'}`}>
                                        {card.value.toLocaleString()}
                                    </span>
                                    {card.id !== 'all' && stats.total > 0 && (
                                        <span className={`text-sm font-black px-2.5 py-1 rounded-xl ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                            {percentage(card.value)}%
                                        </span>
                                    )}
                                </div>

                                {/* Progress Bar */}
                                <div className="relative">
                                    <div className={`h-2 w-full rounded-full overflow-hidden ${isActive ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ease-out delay-300 ${isActive ? 'bg-white' : `bg-gradient-to-r ${card.gradient}`}`}
                                            style={{ width: `${percentage(card.value)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Active Indicator */}
                                {isActive && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-white/0 via-white to-white/0"></div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default Dashboard;
