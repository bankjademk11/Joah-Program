import { TrendingUp, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const Dashboard = ({ stats, activeFilter, onFilterChange }) => {
    const cards = [
        {
            id: 'all',
            title: 'ທັງໝົດ',
            value: stats.total,
            icon: TrendingUp,
            colorClass: 'indigo',
            accent: 'bg-indigo-500',
            text: 'text-indigo-600 dark:text-indigo-400',
            bg: 'bg-indigo-50 dark:bg-indigo-500/10',
            border: 'border-indigo-100 dark:border-indigo-500/20'
        },
        {
            id: 'passed',
            title: 'ຖືກຕ້ອງ',
            value: stats.passed,
            icon: CheckCircle,
            colorClass: 'emerald',
            accent: 'bg-emerald-500',
            text: 'text-emerald-600 dark:text-emerald-400',
            bg: 'bg-emerald-50 dark:bg-emerald-500/10',
            border: 'border-emerald-100 dark:border-emerald-500/20'
        },
        {
            id: 'mismatch',
            title: 'ບໍ່ກົງກັນ',
            value: stats.mismatch,
            icon: XCircle,
            colorClass: 'rose',
            accent: 'bg-rose-500',
            text: 'text-rose-600 dark:text-rose-400',
            bg: 'bg-rose-50 dark:bg-rose-500/10',
            border: 'border-rose-100 dark:border-rose-500/20'
        },
        {
            id: 'missing',
            title: 'ຂໍ້ມູນບໍ່ຄົບ',
            value: stats.missing,
            icon: AlertCircle,
            colorClass: 'orange',
            accent: 'bg-joah-orange',
            text: 'text-joah-orange dark:text-orange-400',
            bg: 'bg-orange-50 dark:bg-orange-500/10',
            border: 'border-orange-100 dark:border-orange-500/20'
        },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 transition-colors">
            {cards.map((card, index) => {
                const Icon = card.icon;
                const isActive = activeFilter === card.id;

                return (
                    <div
                        key={card.id}
                        className={`relative overflow-hidden group p-6 rounded-[2rem] border-2 transition-all duration-500 cursor-pointer animate-slide-up
                            ${isActive
                                ? `bg-white dark:bg-slate-900 ${card.border} scale-[1.03] shadow-2xl shadow-${card.colorClass}-500/10`
                                : 'bg-white/60 dark:bg-slate-900/40 border-transparent hover:bg-white dark:hover:bg-slate-900 hover:border-slate-100 dark:hover:border-slate-800 hover:shadow-xl'}`}
                        style={{ animationDelay: `${index * 100}ms` }}
                        onClick={() => onFilterChange(card.id)}
                    >
                        {/* Background Decoration */}
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full transition-all duration-500 opacity-[0.05] group-hover:scale-150 ${card.accent}`}></div>

                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <span className={`text-xs font-black uppercase tracking-widest ${isActive ? card.text : 'text-slate-400 dark:text-slate-500'}`}>
                                {card.title}
                            </span>
                            <div className={`p-3 rounded-2xl transition-all duration-500 ${isActive ? card.bg + ' ' + card.text : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:scale-110'}`}>
                                <Icon size={20} />
                            </div>
                        </div>

                        <div className="flex items-baseline gap-3 relative z-10">
                            <span className="text-4xl font-black text-slate-800 dark:text-white tracking-tight">
                                {card.value.toLocaleString()}
                            </span>
                            {card.id !== 'all' && stats.total > 0 && (
                                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${card.bg} ${card.text}`}>
                                    {((card.value / stats.total) * 100).toFixed(1)}%
                                </span>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-6 relative z-10">
                            <div className={`h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden`}>
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${card.accent}`}
                                    style={{ width: `${(card.value / stats.total * 100) || 0}%` }}
                                />
                            </div>
                        </div>

                        {isActive && (
                            <div className={`absolute bottom-0 left-0 h-1 w-full ${card.accent} animate-fade-in`}></div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default Dashboard;
