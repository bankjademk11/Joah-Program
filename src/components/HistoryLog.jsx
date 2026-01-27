import { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { X, Search, Clock, ArrowUpDown, User, Calendar, Loader2 } from 'lucide-react';

const HistoryLog = ({ onClose }) => {
    const [historyData, setHistoryData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const fetchAllHistory = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .from('inventory_history')
                    .select('*')
                    .order('updated_at', { ascending: false })
                    .limit(500); // Increased limit for better history view

                if (error) throw error;
                setHistoryData(data || []);
            } catch (err) {
                console.error('Error fetching history:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllHistory();
    }, []);

    const filteredData = historyData.filter(log => {
        const matchesSearch = (log.updated_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (log.barcode || '').includes(searchTerm);

        const logDate = new Date(log.updated_at).setHours(0, 0, 0, 0);
        const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
        const end = endDate ? new Date(endDate).setHours(0, 0, 0, 0) : null;

        const matchesDate = (!start || logDate >= start) && (!end || logDate <= end);

        return matchesSearch && matchesDate;
    });

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xl bg-slate-900/60 animate-fade-in">
            <div className="glass-card-dark w-full max-w-5xl h-[85vh] rounded-[2.5rem] p-8 border border-slate-700/50 shadow-2xl flex flex-col relative overflow-hidden bg-white dark:bg-slate-900 text-slate-900 dark:text-white">

                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3.5 rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                            <Clock size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black tracking-tight">ປະຫວັດການແກ້ໄຂທັງໝົດ</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Full System Audit Log</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
                        <X size={24} />
                    </button>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row items-center gap-4 mb-6 flex-shrink-0">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="🔍 ຄົ້ນຫາ: ຊື່ສິນຄ້າ, ບາໂຄ້ດ ຫຼື ຜູ້ກວດ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 outline-none text-sm font-bold transition-all placeholder:font-normal"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative group flex-1 md:flex-none">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Calendar size={16} /></div>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full md:w-40 pl-10 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <span className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase">From</span>
                        </div>
                        <span className="text-slate-300">–</span>
                        <div className="relative group flex-1 md:flex-none">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"><Calendar size={16} /></div>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full md:w-40 pl-10 pr-4 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 outline-none focus:ring-2 focus:ring-indigo-500/50"
                            />
                            <span className="absolute -top-2 left-3 px-1 bg-white dark:bg-slate-900 text-[9px] font-black text-slate-400 uppercase">To</span>
                        </div>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-auto custom-scrollbar rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                            <tr>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800">Time</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800">User</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800 w-1/3">Item Detail</th>
                                <th className="p-5 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-200 dark:border-slate-800 text-center">Change</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {isLoading ? (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3 text-slate-400">
                                            <Loader2 className="animate-spin" size={32} />
                                            <span className="text-xs font-bold uppercase">Loading Data...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredData.length > 0 ? (
                                filteredData.map((row) => (
                                    <tr key={row.id} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                                        <td className="p-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{new Date(row.updated_at).toLocaleDateString('lo-LA')}</span>
                                                <span className="text-xs text-slate-400 font-mono">{new Date(row.updated_at).toLocaleTimeString('lo-LA')}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                    <User size={12} />
                                                </div>
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{row.updated_by || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="p-5">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="text-xs font-black text-slate-800 dark:text-white font-mono tracking-tight">{row.barcode}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{row.item_name || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-5 text-center">
                                            <div className="inline-flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                <span className="text-sm font-mono text-slate-500 line-through opacity-50">{row.old_qty}</span>
                                                <ArrowUpDown size={14} className="rotate-90 text-indigo-500" />
                                                <span className="text-lg font-black font-mono text-indigo-600 dark:text-indigo-400">{row.new_qty}</span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="py-20 text-center text-slate-400 font-medium">No history logs found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default HistoryLog;
