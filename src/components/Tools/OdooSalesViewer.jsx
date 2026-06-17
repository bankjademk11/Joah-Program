import React, { useState, useEffect } from 'react';
import { authenticate, fetchBranchProductSales, fetchDetailedProductSales } from '../../services/odooApi';
import { Search, Calendar, MapPin, Package, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';

export default function OdooSalesViewer({ onBack, userBranch, isAdmin }) {
    const [sales, setSales] = useState([]);
    const [detailedSales, setDetailedSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'history'

    const todayStr = new Date().toISOString().split('T')[0];
    const [dateStart, setDateStart] = useState(`${todayStr}T00:00`);
    const [dateEnd, setDateEnd] = useState(`${todayStr}T23:59`);

    // Available Branches based on roles
    const branches = [
        { id: 247, name: 'ໂພນສີນວນ' },
        { id: 248, name: 'ສີວິໄລ' },
        { id: 249, name: 'ຕະຫຼາດລາວ' },
        { id: 261, name: 'ວັງຊາຍ' },
        { id: 273, name: 'ເມກ້າມໍ' }, // Patuxai
    ];

    const [selectedBranchId, setSelectedBranchId] = useState(
        branches.find(b => b.name === userBranch)?.id || 273
    );

    const loadSales = async () => {
        setLoading(true);
        setError(null);
        try {
            // Auto-login ก่อนเสมอ เพื่อให้มี Session Cookie ที่ถูกต้องเสมอ
            await authenticate(
                import.meta.env.VITE_ODOO_DB,
                import.meta.env.VITE_ODOO_USER,
                import.meta.env.VITE_ODOO_PASSWORD
            );

            const startDateTime = dateStart ? `${dateStart.replace('T', ' ')}:00` : null;
            const endDateTime = dateEnd ? `${dateEnd.replace('T', ' ')}:59` : null;

            if (activeTab === 'summary') {
                const data = await fetchBranchProductSales(selectedBranchId, startDateTime, endDateTime);
                const sortedData = data.sort((a, b) => b.qty - a.qty);
                setSales(sortedData);
            } else {
                const data = await fetchDetailedProductSales(selectedBranchId, startDateTime, endDateTime);
                setDetailedSales(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSales();
    }, [selectedBranchId, dateStart, dateEnd, activeTab]);

    const filteredSales = sales.filter(item => {
        if (!searchTerm) return true;
        const name = item.product_id[1] ? item.product_id[1].toLowerCase() : '';
        return name.includes(searchTerm.toLowerCase());
    });

    const filteredDetailedSales = detailedSales.filter(item => {
        if (!searchTerm) return true;
        const name = item.product_id[1] ? item.product_id[1].toLowerCase() : '';
        const orderName = item.order_id && item.order_id[1] ? item.order_id[1].toLowerCase() : '';
        return name.includes(searchTerm.toLowerCase()) || orderName.includes(searchTerm.toLowerCase());
    });

    const formatNumber = (num) => {
        if (!num) return '0';
        return Number(num).toLocaleString('lo-LA');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        // Odoo datetime is usually 'YYYY-MM-DD HH:MM:SS' in UTC
        const utcDate = new Date(dateString.replace(' ', 'T') + 'Z');
        return utcDate.toLocaleString('lo-LA', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const splitProduct = (productStr) => {
        if (!productStr) return { barcode: '-', name: '-' };
        const match = productStr.match(/^\[(.*?)\]\s*(.*)$/);
        if (match) {
            return { barcode: match[1], name: match[2] };
        }
        return { barcode: '-', name: productStr };
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-6xl mx-auto p-4 md:p-6 animate-fade-in-up">
            
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack}
                        className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500 hover:text-joah-orange hover:bg-orange-50 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="text-joah-orange">Odoo</span> Sales Viewer
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">ສະແດງປະຫວັດການຂາຍສິນຄ້າຈາກ Odoo</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Branch Selector (Only if Admin or HQ) */}
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                        <MapPin size={16} className="text-slate-400 mr-2" />
                        <select 
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                            disabled={!isAdmin && userBranch !== 'ເມກ້າມໍ'}
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                            ))}
                        </select>
                    </div>

                    <button 
                        onClick={loadSales}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    >
                        <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        ຣີເຟຣຊ
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={12} /> ຕັ້ງແຕ່ (From)
                    </label>
                    <input 
                        type="datetime-local" 
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={12} /> ເຖິງ (To)
                    </label>
                    <input 
                        type="datetime-local" 
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange focus:ring-4 focus:ring-orange-500/10 transition-all"
                    />
                </div>
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Search size={12} /> ຄົ້ນຫາສິນຄ້າ {activeTab === 'history' && 'ຫຼື ເລກບິນ'}
                    </label>
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder={activeTab === 'summary' ? "ພິມຊື່ສິນຄ້າ..." : "ຊື່ສິນຄ້າ, ເລກບິນ..."}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange focus:ring-4 focus:ring-orange-500/10 transition-all"
                        />
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-full max-w-sm mb-6 shadow-inner">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${
                        activeTab === 'summary' 
                        ? 'bg-white dark:bg-slate-700 text-joah-orange shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    ສະຫຼຸບຍອດລວມ (Summary)
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex justify-center items-center gap-2 ${
                        activeTab === 'history' 
                        ? 'bg-white dark:bg-slate-700 text-joah-orange shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    ປະຫວັດການຂາຍ (History)
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="font-bold text-red-800 dark:text-red-400 text-sm">ເກີດຂໍ້ຜິດພາດໃນການດຶງຂໍ້ມູນ Odoo</h4>
                        <p className="text-xs text-red-600 dark:text-red-500 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
                
                {/* Loading State */}
                {loading && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                        <div className="w-12 h-12 border-4 border-slate-200 border-t-joah-orange rounded-full animate-spin"></div>
                        <p className="mt-4 font-bold text-slate-600 dark:text-slate-300 animate-pulse">ກຳລັງໂຫຼດຂໍ້ມູນຈາກ Odoo...</p>
                    </div>
                )}

                <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900/50 shadow-sm z-0">
                            {activeTab === 'summary' ? (
                                <tr>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-16">#</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-40">ບາໂຄດ (Barcode)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ຊື່ສິນຄ້າ (Product)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຈຳນວນທີ່ຂາຍ (Qty)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຍອດຂາຍລວມ (Total)</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ເວລາ (Time)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ເລກບິນ (Receipt)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-40">ບາໂຄດ (Barcode)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ຊື່ສິນຄ້າ (Product)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຈຳນວນ (Qty)</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຍອດລວມ (Total)</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {((activeTab === 'summary' && filteredSales.length === 0) || (activeTab === 'history' && filteredDetailedSales.length === 0)) && !loading && !error ? (
                                <tr>
                                    <td colSpan="5" className="p-12 text-center text-slate-400">
                                        <Package size={48} className="mx-auto opacity-20 mb-3" />
                                        <p className="font-medium text-sm">ບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງເວລານີ້</p>
                                    </td>
                                </tr>
                            ) : (
                                activeTab === 'summary' ? (
                                    filteredSales.map((item, index) => {
                                        const { barcode, name } = splitProduct(item.product_id[1]);
                                        return (
                                            <tr key={item.product_id[0]} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="p-4 text-sm text-slate-400 font-medium">
                                                    {index + 1}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                        {barcode}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-joah-orange transition-colors">
                                                        {name}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="inline-flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-lg text-base font-black">
                                                        {formatNumber(item.qty)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        ₭ {formatNumber(item.price_subtotal_incl)}
                                                    </p>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    filteredDetailedSales.map((item, index) => {
                                        const { barcode, name } = splitProduct(item.product_id[1]);
                                        return (
                                            <tr key={item.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                                <td className="p-4 text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                    {formatDateTime(item.create_date)}
                                                </td>
                                                <td className="p-4 text-xs font-bold text-slate-400 uppercase">
                                                    {item.order_id && item.order_id[1]}
                                                </td>
                                                <td className="p-4">
                                                    <span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                                        {barcode}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-joah-orange transition-colors">
                                                        {name}
                                                    </p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <span className="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-2 py-1 rounded text-sm font-black">
                                                        {formatNumber(item.qty)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">
                                                        ₭ {formatNumber(item.price_subtotal_incl)}
                                                    </p>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )
                            )}
                        </tbody>
                    </table>
                </div>
                
                {/* Footer summary */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-500">
                        ພົບຂໍ້ມູນທັງໝົດ: <span className="text-slate-800 dark:text-slate-200">{activeTab === 'summary' ? filteredSales.length : filteredDetailedSales.length}</span> ລາຍການ
                    </p>
                </div>

            </div>
        </div>
    );
}
