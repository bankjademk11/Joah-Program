import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Info, ChevronLeft, ChevronRight } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl min-w-[200px]">
                <p className="font-bold text-slate-800 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">{label}</p>
                
                <div className="flex items-center justify-between gap-4 text-sm mb-2">
                    <span className="font-medium text-emerald-500 flex items-center gap-1.5"><TrendingUp size={14}/> ຍອດຂາຍ:</span>
                    <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {new Intl.NumberFormat('lo-LA').format(data.sales)} ₭
                    </span>
                </div>
                
                <div className="flex items-center justify-between gap-4 text-sm mb-2">
                    <span className="font-medium text-sky-500">ລູກຄ້າ (ບິນ):</span>
                    <span className="font-black text-sky-600 dark:text-sky-400">
                        {new Intl.NumberFormat('lo-LA').format(data.customers)}
                    </span>
                </div>
                
                <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-purple-500">ສິນຄ້າ (SKUs):</span>
                    <span className="font-black text-purple-600 dark:text-purple-400">
                        {new Intl.NumberFormat('lo-LA').format(data.skus)}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export default function SalesChartDashboard({ weeklySales, branches, selectedBranchId, weekOffset, setWeekOffset }) {
    
    // Process Data for the Chart (14 days)
    const chartData = useMemo(() => {
        const data = [];
        const branchesToRender = selectedBranchId === 'ALL' ? branches : branches.filter(b => b.id === selectedBranchId);
        
        for (let i = 0; i < 14; i++) {
            const today = new Date();
            const dayOfWeek = today.getDay();
            const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            
            const startOfLastWeek = new Date(today);
            startOfLastWeek.setDate(today.getDate() - diffToMonday - 7 - (weekOffset * 7));
            
            const d = new Date(startOfLastWeek);
            d.setDate(startOfLastWeek.getDate() + i);
            
            const odooDateMatch = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
            const displayDate = `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
            
            let totalSales = 0;
            let totalCustomers = 0;
            let totalSkus = 0;
            
            branchesToRender.forEach(branch => {
                const currentBranchSales = weeklySales[branch.id] || [];
                const dayData = currentBranchSales.find(w => w['create_date:day'] === odooDateMatch);
                totalSales += dayData?.price_subtotal_incl || 0;
                totalCustomers += dayData?.order_count || 0;
                totalSkus += dayData?.sku_count || 0;
            });
            
            data.push({
                date: displayDate,
                fullDate: odooDateMatch,
                sales: totalSales,
                customers: totalCustomers,
                skus: totalSkus,
                isWeek1: i < 7
            });
        }
        return data;
    }, [weeklySales, branches, selectedBranchId, weekOffset]);

    const formatYAxis = (tickItem) => {
        if (tickItem >= 1000000) {
            return (tickItem / 1000000).toFixed(1) + 'M';
        } else if (tickItem >= 1000) {
            return (tickItem / 1000).toFixed(0) + 'K';
        }
        return tickItem;
    };

    return (
        <div className="flex-1 flex flex-col bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-6 rounded-3xl border border-white/30 shadow-2xl mb-6 animate-fade-in-up">
            
            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        📊 Dashboard ແຜນພູມຍອດຂາຍ
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">ສະແດງແນວໂນ້ມຍອດຂາຍ 14 ມື້ (PowerBI Style)</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-center gap-2">
                        <Info size={14} className="text-orange-500" />
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                            ສາຂາ: {selectedBranchId === 'ALL' ? 'ລວມທຸກສາຂາ' : branches.find(b => b.id === selectedBranchId)?.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-joah-orange hover:text-white rounded-lg transition-colors text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
                            <ChevronLeft size={18} />
                        </button>
                        <button onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0} className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-joah-orange hover:text-white rounded-lg transition-colors text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 disabled:cursor-not-allowed">
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Area Chart for Sales */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 relative">
                <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 absolute z-10">ແນວໂນ້ມຍອດຂາຍ (₭)</h4>
                <div className="h-[300px] sm:h-[400px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} dx={-10} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area type="monotone" dataKey="sales" name="ຍອດຂາຍ" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Secondary Bar Chart for Customers */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 relative">
                <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 absolute z-10">ຈຳນວນລູກຄ້າ / ບິນ</h4>
                <div className="h-[200px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />
                            <Bar dataKey="customers" name="ຈຳນວນລູກຄ້າ (ບິນ)" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar dataKey="skus" name="ຈຳນວນສິນຄ້າ (SKUs)" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
