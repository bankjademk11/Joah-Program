import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { TrendingUp, TrendingDown, Info, ChevronLeft, ChevronRight } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-4 border border-slate-200 dark:border-slate-700 shadow-xl rounded-xl min-w-[200px]">
                <p className="font-bold text-slate-800 dark:text-slate-100 mb-3 border-b border-slate-100 dark:border-slate-700 pb-2">ວັນທີ {label}</p>

                <div className="flex items-center justify-between gap-4 text-sm mb-2">
                    <span className="font-medium text-emerald-500 flex items-center gap-1.5"><TrendingUp size={14} /> ຍອດຂາຍ:</span>
                    <div className="text-right">
                        <span className="font-black text-emerald-600 dark:text-emerald-400 block">
                            {new Intl.NumberFormat('lo-LA').format(data.sales)} ₭
                        </span>
                        {data.compareSales !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400 block">
                                ທຽບ: {new Intl.NumberFormat('lo-LA').format(data.compareSales)} ₭
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm mb-2">
                    <span className="font-medium text-sky-500">ລູກຄ້າ (ບິນ):</span>
                    <div className="text-right">
                        <span className="font-black text-sky-600 dark:text-sky-400 block">
                            {new Intl.NumberFormat('lo-LA').format(data.customers)}
                        </span>
                        {data.compareCustomers !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400 block">
                                ທຽບ: {new Intl.NumberFormat('lo-LA').format(data.compareCustomers)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="font-medium text-purple-500">ສິນຄ້າ (SKUs):</span>
                    <div className="text-right">
                        <span className="font-black text-purple-600 dark:text-purple-400 block">
                            {new Intl.NumberFormat('lo-LA').format(data.skus)}
                        </span>
                        {data.compareSkus !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400 block">
                                ທຽບ: {new Intl.NumberFormat('lo-LA').format(data.compareSkus)}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export default function SalesChartDashboard({ weeklySales, branches, selectedBranchId, weekOffset, setWeekOffset, isCompareMode, setIsCompareMode, compareMonthOffset, setCompareMonthOffset, compareWeeklySales }) {

    // Process Data for the Chart (Month-to-Date / Full Month)
    const chartData = useMemo(() => {
        const data = [];
        const branchesToRender = selectedBranchId === 'ALL' ? branches : branches.filter(b => b.id === selectedBranchId);

        const today = new Date();
        const targetMonth = new Date(today);
        targetMonth.setMonth(today.getMonth() - weekOffset);

        const compareTargetMonth = new Date(today);
        compareTargetMonth.setMonth(today.getMonth() - compareMonthOffset);

        const daysInTargetMonth = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate();
        const daysInCompareMonth = new Date(compareTargetMonth.getFullYear(), compareTargetMonth.getMonth() + 1, 0).getDate();

        // Loop limit should cover the maximum days between both months if in compare mode
        let loopLimit = weekOffset === 0 ? today.getDate() : daysInTargetMonth;
        if (isCompareMode) {
            const compareLoopLimit = compareMonthOffset === 0 ? today.getDate() : daysInCompareMonth;
            loopLimit = Math.max(loopLimit, compareLoopLimit);
        }

        for (let i = 0; i < loopLimit; i++) {
            const startPeriod = new Date(targetMonth);
            startPeriod.setDate(1); // Start on the 1st
            const d = new Date(startPeriod);
            d.setDate(startPeriod.getDate() + i);
            const odooDateMatch = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;

            // Compare dates
            const cStartPeriod = new Date(compareTargetMonth);
            cStartPeriod.setDate(1);
            const cD = new Date(cStartPeriod);
            cD.setDate(cStartPeriod.getDate() + i);
            const cOdooDateMatch = `${cD.getDate().toString().padStart(2, '0')} ${cD.toLocaleDateString('en-GB', { month: 'short' })} ${cD.getFullYear()}`;

            const displayDay = (i + 1).toString();

            let totalSales = 0;
            let totalCustomers = 0;
            let totalSkus = 0;

            let cTotalSales = 0;
            let cTotalCustomers = 0;
            let cTotalSkus = 0;

            branchesToRender.forEach(branch => {
                const currentBranchSales = weeklySales[branch.id] || [];
                const dayData = currentBranchSales.find(w => w['create_date:day'] === odooDateMatch);
                totalSales += dayData?.price_subtotal_incl || 0;
                totalCustomers += dayData?.order_count || 0;
                totalSkus += dayData?.sku_count || 0;

                if (isCompareMode) {
                    const compareBranchSales = compareWeeklySales[branch.id] || [];
                    const cDayData = compareBranchSales.find(w => w['create_date:day'] === cOdooDateMatch);
                    cTotalSales += cDayData?.price_subtotal_incl || 0;
                    cTotalCustomers += cDayData?.order_count || 0;
                    cTotalSkus += cDayData?.sku_count || 0;
                }
            });

            const dataPoint = {
                day: displayDay,
                sales: totalSales,
                customers: totalCustomers,
                skus: totalSkus,
            };

            if (isCompareMode) {
                dataPoint.compareSales = cTotalSales;
                dataPoint.compareCustomers = cTotalCustomers;
                dataPoint.compareSkus = cTotalSkus;
            }

            data.push(dataPoint);
        }
        return data;
    }, [weeklySales, compareWeeklySales, branches, selectedBranchId, weekOffset, isCompareMode, compareMonthOffset]);

    const formatYAxis = (tickItem) => {
        if (tickItem >= 1000000) {
            return (tickItem / 1000000).toFixed(1) + 'M';
        } else if (tickItem >= 1000) {
            return (tickItem / 1000).toFixed(0) + 'K';
        }
        return tickItem;
    };

    const targetMonthDate = new Date();
    targetMonthDate.setMonth(targetMonthDate.getMonth() - weekOffset);
    const targetMonthName = targetMonthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    const compareMonthDate = new Date();
    compareMonthDate.setMonth(compareMonthDate.getMonth() - compareMonthOffset);
    const compareMonthName = compareMonthDate.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

    // Calculate Summary Averages for Comparison
    const totalSales = chartData.reduce((acc, curr) => acc + (curr.sales || 0), 0);
    const totalCompareSales = chartData.reduce((acc, curr) => acc + (curr.compareSales || 0), 0);
    const percentDiff = totalCompareSales === 0 ? (totalSales > 0 ? 100 : 0) : ((totalSales - totalCompareSales) / totalCompareSales) * 100;

    return (
        <div className="flex-1 flex flex-col bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-4 sm:p-6 rounded-3xl border border-white/30 shadow-2xl mb-6 animate-fade-in-up">

            <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        📊 Dashboard ແຜນພູມຍອດຂາຍ
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">ສະແດງແນວໂນ້ມຍອດຂາຍປະຈຳເດືອນນີ້ (PowerBI Style)</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                    <label className="flex items-center gap-2 cursor-pointer bg-slate-50 dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-400 transition-colors">
                        <input type="checkbox" checked={isCompareMode} onChange={(e) => setIsCompareMode(e.target.checked)} className="w-3.5 h-3.5 text-sky-500 rounded focus:ring-sky-500" />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">ປຽບທຽບເດືອນ</span>
                    </label>
                    <div className="bg-orange-50 dark:bg-orange-900/20 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800/50 flex items-center gap-2">
                        <span className="text-[10px] font-bold text-orange-400 uppercase">ເດືອນຫຼັກ:</span>
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 w-16 text-center">{targetMonthName}</span>
                        <div className="flex items-center gap-1 border-l border-orange-200 pl-2">
                            <button onClick={() => setWeekOffset(prev => prev + 1)} className="p-1 hover:bg-orange-200 rounded text-orange-600"><ChevronLeft size={14} /></button>
                            <button onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0} className="p-1 hover:bg-orange-200 rounded text-orange-600 disabled:opacity-30"><ChevronRight size={14} /></button>
                        </div>
                    </div>
                    {isCompareMode && (
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">ທຽບກັບ:</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 w-16 text-center">{compareMonthName}</span>
                            <div className="flex items-center gap-1 border-l border-slate-300 pl-2">
                                <button onClick={() => setCompareMonthOffset(prev => prev + 1)} className="p-1 hover:bg-slate-200 rounded text-slate-600"><ChevronLeft size={14} /></button>
                                <button onClick={() => setCompareMonthOffset(prev => Math.max(0, prev - 1))} disabled={compareMonthOffset === 0} className="p-1 hover:bg-slate-200 rounded text-slate-600 disabled:opacity-30"><ChevronRight size={14} /></button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {isCompareMode && (
                <div className="mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-400">ຍອດຂາຍລວມທຽບກັນ</p>
                        <p className="text-sm font-black text-slate-800 dark:text-slate-200 mt-1">
                            {targetMonthName}: <span className="text-emerald-600">₭ {formatYAxis(totalSales)}</span> vs {compareMonthName}: <span className="text-slate-500">₭ {formatYAxis(totalCompareSales)}</span>
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={`text-lg font-black flex items-center justify-end gap-1 ${percentDiff >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {percentDiff >= 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                            {Math.abs(percentDiff).toFixed(1)}%
                        </p>
                        <p className="text-[10px] font-bold text-slate-500">ອັດຕາການເຕີບໂຕ (Growth)</p>
                    </div>
                </div>
            )}

            {/* Main Area Chart for Sales */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 mb-6 relative">
                <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4 absolute z-10">ແນວໂນ້ມຍອດຂາຍ (₭)</h4>
                <div className="h-[300px] sm:h-[400px] w-full mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorCompareSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={formatYAxis} dx={-10} />
                            <Tooltip content={<CustomTooltip />} />
                            {isCompareMode && (
                                <Area type="monotone" dataKey="compareSales" name={`ຍອດຂາຍ (${compareMonthName})`} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth={2} fillOpacity={1} fill="url(#colorCompareSales)" activeDot={{ r: 4, fill: '#94a3b8', stroke: '#fff' }} />
                            )}
                            <Area type="monotone" dataKey="sales" name={`ຍອດຂາຍ (${targetMonthName})`} stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" activeDot={{ r: 6, fill: '#10b981', stroke: '#fff', strokeWidth: 2 }} />
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
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(14, 165, 233, 0.1)' }} />
                            <Legend wrapperStyle={{ fontSize: '10px' }} />

                            {isCompareMode && <Bar dataKey="compareCustomers" name={`ລູກຄ້າ (${compareMonthName})`} fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />}
                            <Bar dataKey="customers" name={`ລູກຄ້າ (${targetMonthName})`} fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={30} />

                            {isCompareMode && <Bar dataKey="compareSkus" name={`ສິນຄ້າ (${compareMonthName})`} fill="#cbd5e1" radius={[4, 4, 0, 0]} maxBarSize={30} />}
                            <Bar dataKey="skus" name={`ສິນຄ້າ (${targetMonthName})`} fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

        </div>
    );
}
