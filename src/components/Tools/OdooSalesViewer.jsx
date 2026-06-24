import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { authenticate, fetchBranchProductSales, fetchDetailedProductSales, fetchOrderStateAudit, fetchAbnormalOrders, fetchDailySales } from '../../services/odooApi';
import { Search, Calendar, MapPin, Package, ArrowLeft, RefreshCw, AlertCircle, Download, TrendingUp, ShoppingCart, ShieldAlert, ClipboardList, CalendarDays, Activity } from 'lucide-react';
import JoahLogo from '../../assets/Joah.jpeg';
import dataImageBG from '../../assets/dataImageBG.png';
import ExcelJS from 'exceljs';

export default function OdooSalesViewer({ onBack, userBranch, isAdmin }) {
    const [sales, setSales] = useState([]);
    const [detailedSales, setDetailedSales] = useState([]);
    const [auditStates, setAuditStates] = useState([]);
    const [abnormalOrders, setAbnormalOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('summary');
    const [joahOnly, setJoahOnly] = useState(true);
    const [weeklySales, setWeeklySales] = useState([]);

    const todayStr = new Date().toISOString().split('T')[0];
    const [dateStart, setDateStart] = useState(`${todayStr}T00:00`);
    const [dateEnd, setDateEnd] = useState(`${todayStr}T23:59`);

    const branches = [
        { id: 173, name: 'ໂພນສີນວນ' },
        { id: 248, name: 'ສີວິໄລ' },
        { id: 249, name: 'ຕະຫຼາດລາວ' },
        { id: 8,   name: 'ວັງຊາຍ' },
        { id: 273, name: 'ເມກ້າມໍ' },
    ];

    const [selectedBranchId, setSelectedBranchId] = useState(
        branches.find(b => b.name === userBranch)?.id || 273
    );

    const selectedBranchName = branches.find(b => b.id === selectedBranchId)?.name || '';

    const loadSales = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await authenticate(
                import.meta.env.VITE_ODOO_DB,
                import.meta.env.VITE_ODOO_USER,
                import.meta.env.VITE_ODOO_PASSWORD
            );

            const toUTC = (dateStr, isEnd) => {
                if (!dateStr) return null;
                const d = new Date(`${dateStr}:00`);
                if (isEnd) d.setSeconds(59);
                return d.toISOString().replace('T', ' ').substring(0, 19);
            };

            const startDateTime = toUTC(dateStart, false);
            const endDateTime = toUTC(dateEnd, true);

            if (activeTab === 'summary') {
                const data = await fetchBranchProductSales(selectedBranchId, startDateTime, endDateTime, joahOnly);
                setSales(data.sort((a, b) => b.qty - a.qty));
            } else if (activeTab === 'history') {
                const data = await fetchDetailedProductSales(selectedBranchId, startDateTime, endDateTime, joahOnly);
                setDetailedSales(data);
            } else if (activeTab === 'audit') {
                const [stateData, abnormalData] = await Promise.all([
                    fetchOrderStateAudit(selectedBranchId, startDateTime, endDateTime),
                    fetchAbnormalOrders(selectedBranchId, startDateTime, endDateTime),
                ]);
                setAuditStates(stateData);
                setAbnormalOrders(abnormalData);
            } else if (activeTab === 'weekly') {
                const endObj = new Date();
                const startObj = new Date();
                startObj.setDate(endObj.getDate() - 13);
                
                const formatForPicker = (d) => d.toISOString().substring(0,16);
                const startUTC = toUTC(formatForPicker(startObj), false);
                const endUTC = toUTC(formatForPicker(endObj), true);

                const data = await fetchDailySales(selectedBranchId, startUTC, endUTC, joahOnly);
                setWeeklySales(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, dateStart, dateEnd, activeTab, joahOnly]);

    useEffect(() => { loadSales(); }, [loadSales]);

    const filteredSales = sales.filter(item => {
        if (!searchTerm) return true;
        const name = item.product_id[1]?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase());
    });

    const filteredDetailedSales = detailedSales.filter(item => {
        if (!searchTerm) return true;
        const name = item.product_id[1]?.toLowerCase() || '';
        const orderName = item.order_id?.[1]?.toLowerCase() || '';
        return name.includes(searchTerm.toLowerCase()) || orderName.includes(searchTerm.toLowerCase());
    });

    const totalQty = filteredSales.reduce((sum, i) => sum + (i.qty || 0), 0);
    const totalRevenue = filteredSales.reduce((sum, i) => sum + (i.price_subtotal_incl || 0), 0);
    const totalDetailedRevenue = filteredDetailedSales.reduce((sum, i) => sum + (i.price_subtotal_incl || 0), 0);
    const totalDetailedQty = filteredDetailedSales.reduce((sum, i) => sum + (i.qty || 0), 0);

    const activeRefunds = activeTab === 'summary' 
        ? filteredSales.filter(i => (i.qty || 0) < 0 || (i.price_subtotal_incl || 0) < 0)
        : filteredDetailedSales.filter(i => (i.qty || 0) < 0 || (i.price_subtotal_incl || 0) < 0);
    
    const activeRefundCount = activeRefunds.length;
    const activeRefundAmount = activeRefunds.reduce((sum, i) => sum + (i.price_subtotal_incl || 0), 0);
    
    const uniqueRefundBills = activeTab === 'history' 
        ? new Set(activeRefunds.map(i => i.order_id?.[0]).filter(Boolean)).size
        : 0;

    const formatNumber = (num) => num ? Number(num).toLocaleString('lo-LA') : '0';

    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        const utcDate = new Date(dateString.replace(' ', 'T') + 'Z');
        return utcDate.toLocaleString('lo-LA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    };

    const splitProduct = (productStr) => {
        if (!productStr) return { barcode: '-', name: '-' };
        const match = productStr.match(/^\[(.*?)\]\s*(.*)$/);
        return match ? { barcode: match[1], name: match[2] } : { barcode: '-', name: productStr };
    };

    const handleExport = async () => {
        const branchName = selectedBranchName;
        const reportDate = `${dateStart.replace('T', ' ')} ຫາ ${dateEnd.replace('T', ' ')}`;

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet(branchName);

        const FONT = { name: 'Phetsarath OT', size: 11 };
        const FONT_BOLD = { name: 'Phetsarath OT', size: 11, bold: true };
        const FONT_TITLE = { name: 'Phetsarath OT', size: 16, bold: true, color: { argb: 'FFE05C00' } };
        const BORDER = { style: 'thin', color: { argb: 'FF888888' } };
        const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

        try {
            const imgResp = await fetch(JoahLogo);
            const imgBuf = await imgResp.arrayBuffer();
            const imgId = workbook.addImage({ buffer: imgBuf, extension: 'jpeg' });
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 4 } });
        } catch (e) { /* image optional */ }

        ws.getRow(1).height = 25;
        ws.getRow(2).height = 20;
        ws.getRow(3).height = 20;
        ws.getRow(4).height = 20;

        const titleCell = ws.getCell('C1');
        titleCell.value = 'JOAH - ລາຍງານຍອດຂາຍ';
        titleCell.font = FONT_TITLE;
        titleCell.alignment = { vertical: 'middle' };

        ws.getCell('C2').value = `ສາຂາ: ${branchName}`;
        ws.getCell('C2').font = { ...FONT_BOLD, size: 12 };
        ws.getCell('C3').value = `ໄລຍະເວລາ: ${reportDate}`;
        ws.getCell('C3').font = FONT;
        ws.getCell('C4').value = `ຍອດລວມ: ₭ ${formatNumber(activeTab === 'summary' ? totalRevenue : totalDetailedRevenue)}`;
        ws.getCell('C4').font = { ...FONT_BOLD, color: { argb: 'FF059669' } };

        let headers, colWidths;
        if (activeTab === 'summary') {
            headers = ['#', 'ບາໂຄດ (Barcode)', 'ຊື່ສິນຄ້າ (Product Name)', 'ຈຳນວນຂາຍ (Qty)', 'ຍອດຂາຍ (LAK)'];
            colWidths = [6, 20, 55, 16, 20];
        } else {
            headers = ['#', 'ເວລາ (Time)', 'ເລກບິນ (Receipt)', 'ບາໂຄດ', 'ຊື່ສິນຄ້າ (Product Name)', 'ຈຳນວນ (Qty)', 'ຍອດ (LAK)'];
            colWidths = [6, 22, 28, 18, 55, 12, 20];
        }
        ws.columns = colWidths.map(w => ({ width: w }));

        const headerRow = ws.getRow(6);
        headerRow.height = 22;
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { ...FONT_BOLD, color: { argb: 'FFFFFFFF' } };
            cell.fill = HEADER_FILL;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = ALL_BORDERS;
        });

        const dataList = activeTab === 'summary' ? filteredSales : filteredDetailedSales;
        dataList.forEach((item, idx) => {
            const { barcode, name } = splitProduct(item.product_id[1]);
            const rowIdx = idx + 7;
            const r = ws.getRow(rowIdx);
            r.height = 18;
            let values;
            if (activeTab === 'summary') {
                values = [idx + 1, barcode, name, item.qty || 0, item.price_subtotal_incl || 0];
            } else {
                values = [idx + 1, formatDateTime(item.create_date), item.order_id?.[1] || '', barcode, name, item.qty || 0, item.price_subtotal_incl || 0];
            }
            values.forEach((v, ci) => {
                const cell = r.getCell(ci + 1);
                cell.value = v;
                cell.font = FONT;
                cell.border = ALL_BORDERS;
                cell.alignment = { vertical: 'middle', horizontal: typeof v === 'number' ? 'right' : 'left' };
            });
        });

        const totalRowIdx = dataList.length + 7;
        const tr = ws.getRow(totalRowIdx);
        tr.height = 22;
        const qtyCol = activeTab === 'summary' ? 4 : 6;
        const amtCol = activeTab === 'summary' ? 5 : 7;
        const totalQtyVal = activeTab === 'summary' ? totalQty : totalDetailedQty;
        const totalAmt = activeTab === 'summary' ? totalRevenue : totalDetailedRevenue;
        const labelCell = tr.getCell(activeTab === 'summary' ? 3 : 5);
        labelCell.value = 'ລວມທັງໝົດ (TOTAL)';
        labelCell.font = { ...FONT_BOLD, color: { argb: 'FFE05C00' } };
        labelCell.fill = TOTAL_FILL;
        tr.getCell(qtyCol).value = totalQtyVal;
        tr.getCell(amtCol).value = totalAmt;
        [1, 2, 3, 4, 5, 6, 7].slice(0, headers.length).forEach(ci => {
            const cell = tr.getCell(ci);
            cell.font = FONT_BOLD;
            cell.fill = TOTAL_FILL;
            cell.border = ALL_BORDERS;
        });

        const buf = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `JOAH_Sales_${branchName}_${todayStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return createPortal(
        <div 
            className="fixed inset-0 z-[100] w-screen h-screen flex flex-col p-4 md:p-6 animate-fade-in-up overflow-hidden bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:bg-black/60 before:backdrop-blur-sm"
            style={{ backgroundImage: `url(${dataImageBG})` }}
        >
            <div className="relative flex flex-col h-full w-full max-w-7xl mx-auto z-10">

                {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500 hover:text-joah-orange hover:bg-orange-50 transition-all border border-slate-200 dark:border-slate-700">
                        <ArrowLeft size={20} />
                    </button>
                    <img src={JoahLogo} alt="Joah" className="h-10 w-auto rounded-lg object-contain shadow-sm" />
                    <div>
                        <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
                            <span className="text-joah-orange">Odoo</span> Sales Viewer
                        </h1>
                        <p className="text-xs text-slate-200 font-medium drop-shadow-sm">ສາຂາ: <span className="font-black text-joah-orange">{selectedBranchName}</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-3 py-2 shadow-sm">
                        <MapPin size={16} className="text-white/80 mr-2" />
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-white outline-none cursor-pointer [&>option]:text-slate-800"
                            disabled={!isAdmin && userBranch !== 'ເມກ້າມໍ'}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={loading || activeTab === 'weekly'}
                        className="flex items-center gap-2 bg-emerald-600/90 backdrop-blur hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:shadow-[0_0_15px_rgba(5,150,105,0.5)] border border-emerald-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>

                    <button
                        onClick={loadSales}
                        className="flex items-center gap-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white px-4 py-2.5 rounded-xl font-bold text-sm border border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        ຣີເຟຣຊ
                    </button>
                </div>
            </div>

            {/* Tabs Moved to Top */}
            <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl w-full max-w-xl mb-6 shadow-lg border border-white/20 overflow-x-auto">
                {['summary', 'history', 'audit', 'weekly'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2.5 px-4 whitespace-nowrap text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-joah-orange text-white shadow-lg shadow-orange-500/40 scale-[1.02]' : 'text-slate-300 hover:bg-white/10 hover:text-white'}`}>
                        {tab === 'summary' ? 'ສະຫຼຸບ' : tab === 'history' ? 'ປະຫວັດ' : tab === 'audit' ? <><ShieldAlert size={16} /> Audit</> : <><CalendarDays size={16} /> 2 ອາທິດ</>}
                    </button>
                ))}
            </div>

            {/* Weekly View Tab */}
            {activeTab === 'weekly' && (
                <div className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-6 rounded-3xl border border-white/30 shadow-2xl mb-6 animate-fade-in-up">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                        <CalendarDays className="text-joah-orange" />
                        ຍອດຂາຍຍ້ອນຫຼັງ 14 ມື້ (ຈັນ-ອາທິດ)
                    </h3>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {Array.from({length: 14}).map((_, i) => {
                            const d = new Date();
                            d.setDate(d.getDate() - (13 - i));
                            
                            const dayNames = ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'];
                            const enDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                            const enDayName = enDayNames[d.getDay()];
                            
                            const odooDateMatch = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
                            const dayData = weeklySales.find(w => w['create_date:day'] === odooDateMatch);
                            
                            const totalAmount = dayData?.price_subtotal_incl || 0;
                            const isToday = i === 13;
                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                            return (
                                <div key={i} className={`rounded-2xl border-2 p-3 flex flex-col justify-between transition-all hover:-translate-y-1 ${
                                    isToday 
                                        ? 'border-joah-orange bg-orange-50 dark:bg-orange-900/20 shadow-md' 
                                        : isWeekend 
                                            ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50' 
                                            : 'border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800'
                                }`}>
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                isWeekend ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                            }`}>
                                                {enDayName}
                                            </span>
                                            {isToday && <span className="text-[10px] font-black text-joah-orange bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded-full animate-pulse">ມື້ນີ້</span>}
                                        </div>
                                        <p className="text-2xl font-black text-slate-800 dark:text-white leading-none tracking-tight">
                                            {d.getDate()}
                                        </p>
                                        <p className="text-[11px] font-medium text-slate-400 mt-1 uppercase">
                                            {d.toLocaleDateString('en-GB', { month: 'short' })}
                                        </p>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] text-slate-500 font-bold mb-0.5">ຍອດຂາຍ (₭)</p>
                                        <p className={`text-sm font-black truncate ${totalAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                            {totalAmount > 0 ? formatNumber(totalAmount) : '-'}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filters Row (Only for Summary/History) */}
            {activeTab !== 'weekly' && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12} /> ຕັ້ງແຕ່ (From)</label>
                        <input type="datetime-local" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12} /> ເຖິງ (To)</label>
                        <input type="datetime-local" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                            className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Search size={12} /> ຄົ້ນຫາສິນຄ້າ</label>
                        <div className="relative">
                            <input type="text" placeholder="ພິມຊື່ສິນຄ້າ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl p-2.5 pl-10 text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        </div>
                    </div>
                    <div className="flex flex-col justify-end">
                        <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-2.5 rounded-xl hover:border-joah-orange transition-all">
                            <input type="checkbox" checked={joahOnly} onChange={(e) => setJoahOnly(e.target.checked)} className="w-4 h-4 text-joah-orange rounded focus:ring-joah-orange" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">ສະເພາະແບຣນ Joah<br/><span className="text-xs text-slate-400">ຕັດສິນຄ້າອື່ນອອກ</span></span>
                        </label>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {activeTab !== 'weekly' && !loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <div className="bg-gradient-to-br from-emerald-500/90 to-emerald-600/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-[0_8px_30px_rgb(5,150,105,0.2)] border border-emerald-400/30">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <ShoppingCart size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">ຈຳນວນຂາຍລວມ</span>
                        </div>
                        <p className="text-3xl font-black">
                            {formatNumber(activeTab === 'summary' ? totalQty : totalDetailedQty)}
                        </p>
                        <p className="text-xs opacity-70 mt-1">ລາຍການ ({activeTab === 'summary' ? filteredSales.length : filteredDetailedSales.length} ສິນຄ້າ)</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500/90 to-joah-orange/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-[0_8px_30px_rgb(234,88,12,0.2)] border border-orange-400/30">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <TrendingUp size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">ຍອດເງິນລວມ</span>
                        </div>
                        <p className="text-2xl font-black">
                            ₭ {formatNumber(activeTab === 'summary' ? totalRevenue : totalDetailedRevenue)}
                        </p>
                        <p className="text-xs opacity-70 mt-1">ສາຂາ {selectedBranchName}</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500/90 to-rose-600/90 backdrop-blur-md rounded-2xl p-4 text-white shadow-[0_8px_30px_rgb(225,29,72,0.2)] border border-red-400/30 relative overflow-hidden">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <AlertCircle size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">ຍອດສົ່ງຄືນ (Refund)</span>
                        </div>
                        <p className="text-2xl font-black">
                            {activeRefundAmount < 0 ? '-' : ''}₭ {formatNumber(Math.abs(activeRefundAmount))}
                        </p>
                        <p className="text-xs opacity-90 mt-1 font-medium">
                            {activeTab === 'history' ? `ພົບ ${uniqueRefundBills} ບິນ (${activeRefundCount} ລາຍການ)` : `ພົບ ${activeRefundCount} ລາຍການ`}
                        </p>
                        <AlertCircle className="absolute -bottom-4 -right-4 w-24 h-24 text-white opacity-10" />
                    </div>
                </div>
            )}

            {/* Tabs were moved to top */}
            {/* Error */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                    <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={18} />
                    <div>
                        <h4 className="font-bold text-red-800 dark:text-red-400 text-sm">ເກີດຂໍ້ຜິດພາດໃນການດຶງຂໍ້ມູນ Odoo</h4>
                        <p className="text-xs text-red-600 mt-1">{error}</p>
                    </div>
                </div>
            )}

            {/* Table */}
            {activeTab !== 'weekly' && (
                <div className="flex-1 bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in-up">
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
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-12">#</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-36">ບາໂຄດ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ຊື່ສິນຄ້າ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຈຳນວນຂາຍ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຍອດຂາຍ (₭)</th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ເວລາ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ເລກບິນ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider w-36">ບາໂຄດ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider">ຊື່ສິນຄ້າ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຈຳນວນ</th>
                                    <th className="p-4 text-xs font-black text-slate-500 uppercase tracking-wider text-right">ຍອດລວມ (₭)</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                            {((activeTab === 'summary' && filteredSales.length === 0) || (activeTab === 'history' && filteredDetailedSales.length === 0)) && !loading && !error ? (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-slate-400">
                                        <Package size={48} className="mx-auto opacity-20 mb-3" />
                                        <p className="font-medium text-sm">ບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງເວລານີ້</p>
                                    </td>
                                </tr>
                            ) : activeTab === 'summary' ? (
                                filteredSales.map((item, index) => {
                                    const { barcode, name } = splitProduct(item.product_id[1]);
                                    return (
                                        <tr key={item.product_id[0]} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-4 text-sm text-slate-400 font-medium">{index + 1}</td>
                                            <td className="p-4"><span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{barcode}</span></td>
                                            <td className="p-4"><p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-joah-orange transition-colors">{name}</p></td>
                                            <td className="p-4 text-right"><span className="inline-flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-3 py-1 rounded-lg text-base font-black">{formatNumber(item.qty)}</span></td>
                                            <td className="p-4 text-right"><p className="text-sm font-bold text-slate-600 dark:text-slate-400">₭ {formatNumber(item.price_subtotal_incl)}</p></td>
                                        </tr>
                                    );
                                })
                            ) : (
                                filteredDetailedSales.map((item, index) => {
                                    const { barcode, name } = splitProduct(item.product_id[1]);
                                    const isRefund = item.qty < 0 || item.price_subtotal_incl < 0;
                                    return (
                                        <tr key={item.id || index} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group ${isRefund ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                                            <td className="p-4 text-sm font-bold text-slate-500 whitespace-nowrap">{formatDateTime(item.create_date)}</td>
                                            <td className="p-4 text-xs font-bold text-slate-400 uppercase">
                                                {item.order_id?.[1]}
                                                {isRefund && <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">REFUND</span>}
                                            </td>
                                            <td className="p-4"><span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{barcode}</span></td>
                                            <td className="p-4"><p className={`text-sm font-bold transition-colors ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-joah-orange'}`}>{name}</p></td>
                                            <td className="p-4 text-right"><span className={`inline-flex items-center justify-center px-2 py-1 rounded text-sm font-black ${isRefund ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>{formatNumber(item.qty)}</span></td>
                                            <td className="p-4 text-right"><p className={`text-sm font-bold ${isRefund ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>₭ {formatNumber(item.price_subtotal_incl)}</p></td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Audit Tab Content */}
                {activeTab === 'audit' && !loading && (
                    <div className="flex-1 overflow-auto p-5 space-y-5">
                        {/* State Breakdown */}
                        <div>
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                <ClipboardList size={16} className="text-joah-orange" />
                                ສະຖານະບິນທັງໝົດ (All Order States)
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {auditStates.map((s, i) => {
                                    const stateLabel = { paid: '✅ Paid', done: '✅ Done', invoiced: '✅ Invoiced', cancel: '❌ Cancelled', draft: '📝 Draft' };
                                    const isNormal = ['paid', 'done', 'invoiced'].includes(s.state);
                                    return (
                                        <div key={i} className={`rounded-xl p-3 border-2 ${isNormal ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-800' : 'border-red-300 bg-red-50 dark:bg-red-900/15 dark:border-red-800 animate-pulse'}`}>
                                            <p className={`text-xs font-black uppercase tracking-wide ${isNormal ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {stateLabel[s.state] || `⚠️ ${s.state}`}
                                            </p>
                                            <p className="text-lg font-black text-slate-800 dark:text-white mt-1">{s.state_count || s.__count || 0} ບິນ</p>
                                            <p className={`text-xs font-bold mt-0.5 ${isNormal ? 'text-emerald-700' : 'text-red-700'}`}>₭ {formatNumber(s.amount_total || 0)}</p>
                                        </div>
                                    );
                                })}
                                {auditStates.length === 0 && <p className="text-sm text-slate-400 col-span-4">ບໍ່ມີຂໍ້ມູນ</p>}
                            </div>
                        </div>

                        {/* Abnormal Orders */}
                        {abnormalOrders.length > 0 && (
                            <div>
                                <h3 className="text-sm font-black text-red-600 mb-3 flex items-center gap-2">
                                    <ShieldAlert size={16} />
                                    ບິນຜິດປົກກະຕິ ({abnormalOrders.length} ລາຍການ) — ບໍ່ແມ່ນ paid/done/invoiced
                                </h3>
                                <div className="border border-red-200 dark:border-red-800 rounded-xl overflow-hidden">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-red-50 dark:bg-red-900/20">
                                            <tr>
                                                <th className="p-3 text-xs font-black text-red-500 uppercase">ເວລາ</th>
                                                <th className="p-3 text-xs font-black text-red-500 uppercase">ເລກບິນ</th>
                                                <th className="p-3 text-xs font-black text-red-500 uppercase">ສະຖານະ</th>
                                                <th className="p-3 text-xs font-black text-red-500 uppercase">ພະນັກງານ</th>
                                                <th className="p-3 text-xs font-black text-red-500 uppercase text-right">ຍອດ (₭)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-red-100 dark:divide-red-900/30">
                                            {abnormalOrders.map((order, i) => (
                                                <tr key={order.id || i} className="hover:bg-red-50/50 dark:hover:bg-red-900/10">
                                                    <td className="p-3 text-sm font-medium text-slate-600 whitespace-nowrap">{formatDateTime(order.date_order)}</td>
                                                    <td className="p-3 text-xs font-bold font-mono text-slate-500">{order.pos_reference || order.name}</td>
                                                    <td className="p-3">
                                                        <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-black bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                                                            {order.state?.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-xs font-medium text-slate-500">{order.user_id?.[1] || '-'}</td>
                                                    <td className="p-3 text-right text-sm font-black text-red-600">₭ {formatNumber(order.amount_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {abnormalOrders.length === 0 && auditStates.length > 0 && (
                            <div className="text-center py-8">
                                <ShieldAlert size={48} className="mx-auto text-emerald-400 opacity-40 mb-3" />
                                <p className="text-sm font-bold text-emerald-600">✅ ບໍ່ພົບບິນຜິດປົກກະຕິ — ທຸກບິນຢູ່ໃນສະຖານະປົກກະຕິ</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Footer */}
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-500">
                        ພົບຂໍ້ມູນ: <span className="text-slate-800 dark:text-slate-200">{activeTab === 'summary' ? filteredSales.length : filteredDetailedSales.length}</span> ລາຍການ
                    </p>
                    <p className="text-xs font-black text-joah-orange">
                        ຍອດລວມ: ₭ {formatNumber(activeTab === 'summary' ? totalRevenue : totalDetailedRevenue)}
                    </p>
                </div>
                </div>
            )}
            </div>
        </div>,
        document.body
    );
}
