import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { authenticate, fetchBranchProductSales, fetchDetailedProductSales, fetchOrderStateAudit, fetchAbnormalOrders, fetchDailySales } from '../../services/odooApi';
import { Search, Calendar, MapPin, Package, ArrowLeft, RefreshCw, AlertCircle, Download, TrendingUp, ShoppingCart, ShieldAlert, ClipboardList, CalendarDays, Activity, ChevronLeft, ChevronRight, Users, PieChart } from 'lucide-react';
import DayDetailViewer from './DayDetailViewer';
import SalesChartDashboard from './SalesChartDashboard';
import JoahLogo from '../../assets/Joah.jpeg';
import dataImageBG from '../../assets/dataImageBG.png';
import JoahLoadingGif from '../../assets/joah_web_small.gif';
import ExcelJS from 'exceljs';

const parseOdooDate = (dateStr) => {
    if (!dateStr) return null;
    const parts = dateStr.split(' ');
    if (parts.length < 3) return null;
    const day = parts[0];
    const monthStr = parts[1];
    const year = parts[2];
    const months = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    return new Date(parseInt(year, 10), months[monthStr], parseInt(day, 10));
};

const formatDateRangeLao = (start, end) => {
    const startDay = start.getDate();
    const startMonth = start.toLocaleDateString('lo-LA', { month: 'short' });
    const startYear = start.getFullYear();

    const endDay = end.getDate();
    const endMonth = end.toLocaleDateString('lo-LA', { month: 'short' });
    const endYear = end.getFullYear();

    if (startYear === endYear) {
        if (start.getMonth() === end.getMonth()) {
            return `${startDay}-${endDay} ${startMonth} ${startYear}`;
        }
        return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
    }
    return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
};

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
    const [weeklySales, setWeeklySales] = useState({});
    const [compareWeeklySales, setCompareWeeklySales] = useState({});
    const [weekOffset, setWeekOffset] = useState(0);
    const [isCompareMode, setIsCompareMode] = useState(false);
    const [compareMonthOffset, setCompareMonthOffset] = useState(1); // Default to previous month
    const [summaryMode, setSummaryMode] = useState('7days'); // '7days' or '14days'
    const [calendarMode, setCalendarMode] = useState('14'); // '30' = full month, '14' = last 14 days
    const [selectedDay, setSelectedDay] = useState(null); // { dateObj, branchId, branchName, dayData, joahOnly }

    const todayStr = new Date().toISOString().split('T')[0];
    const [dateStart, setDateStart] = useState(`${todayStr}T00:00`);
    const [dateEnd, setDateEnd] = useState(`${todayStr}T23:59`);

    const branches = [
        { id: 173, name: 'ໂພນສີນວນ', short: 'PSN' },
        { id: 248, name: 'ສີວິໄລ', short: 'SVL' },
        { id: 249, name: 'ຕະຫຼາດລາວ', short: 'TLL' },
        { id: 8, name: 'ວັງຊາຍ', short: 'VX' },
        { id: 273, name: 'ເມກ້າມໍ', short: 'MGM' },
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
            } else if (activeTab === 'weekly' || activeTab === 'dashboard') {
                +6
                const today = new Date();
                const pad = (n) => n.toString().padStart(2, '0');

                let startObj, endObj;

                if (activeTab === 'dashboard') {
                    // Dashboard: from the 1st of the target month to the end (or today)
                    startObj = new Date(today);
                    startObj.setMonth(today.getMonth() - weekOffset);
                    startObj.setDate(1); // Start on the 1st of the month
                    startObj.setHours(0, 0, 0, 0);

                    endObj = new Date(startObj);
                    endObj.setMonth(startObj.getMonth() + 1);
                    endObj.setDate(0); // Last day of the target month
                    endObj.setHours(23, 59, 59, 999);

                    if (weekOffset === 0) {
                        endObj = new Date(today);
                        endObj.setHours(23, 59, 59, 999);
                    }

                    // --- Compare Data Fetching ---
                    if (isCompareMode) {
                        const cStartObj = new Date(today);
                        cStartObj.setMonth(today.getMonth() - compareMonthOffset);
                        cStartObj.setDate(1);
                        cStartObj.setHours(0, 0, 0, 0);

                        const cEndObj = new Date(cStartObj);
                        cEndObj.setMonth(cStartObj.getMonth() + 1);
                        cEndObj.setDate(0);
                        cEndObj.setHours(23, 59, 59, 999);

                        if (compareMonthOffset === 0) {
                            cEndObj.setHours(23, 59, 59, 999);
                        }

                        const cStartStr = `${cStartObj.getFullYear()}-${pad(cStartObj.getMonth() + 1)}-${pad(cStartObj.getDate())}T00:00`;
                        const cEndStr = `${cEndObj.getFullYear()}-${pad(cEndObj.getMonth() + 1)}-${pad(cEndObj.getDate())}T23:59`;
                        const cStartUTC = toUTC(cStartStr, false);
                        const cEndUTC = toUTC(cEndStr, true);

                        if (selectedBranchId === 'ALL') {
                            const cPromises = branches.map(b => fetchDailySales(b.id, cStartUTC, cEndUTC, joahOnly));
                            const cResults = await Promise.all(cPromises);
                            const cMapped = {};
                            branches.forEach((b, idx) => { cMapped[b.id] = cResults[idx] || []; });
                            setCompareWeeklySales(cMapped);
                        } else {
                            const cData = await fetchDailySales(selectedBranchId, cStartUTC, cEndUTC, joahOnly);
                            setCompareWeeklySales({ [selectedBranchId]: cData || [] });
                        }
                    } else {
                        setCompareWeeklySales({});
                    }
                    // ---------------------------
                } else {
                    if (calendarMode === '14') {
                        const dayOfWeek = today.getDay();
                        const daysToSun = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                        const week2End = new Date(today);
                        week2End.setDate(today.getDate() + daysToSun - (weekOffset * 7));
                        week2End.setHours(23, 59, 59, 999);

                        const periodEnd = new Date(week2End);
                        const periodStart = new Date(periodEnd);
                        periodStart.setDate(periodEnd.getDate() - 13);
                        periodStart.setHours(0, 0, 0, 0);

                        startObj = periodStart;
                        endObj = periodEnd;

                        // 14-day mode: Week1 vs Week2 both come from weeklySales.
                        // No need to fetch previous month — clear compareWeeklySales.
                        setCompareWeeklySales({});
                    } else {
                        const monthStart = new Date(today);
                        monthStart.setMonth(today.getMonth() - weekOffset);
                        monthStart.setDate(1);
                        monthStart.setHours(0, 0, 0, 0);

                        const monthEnd = new Date(monthStart);
                        monthEnd.setMonth(monthStart.getMonth() + 1);
                        monthEnd.setDate(0);
                        monthEnd.setHours(23, 59, 59, 999);
                        if (weekOffset === 0) {
                            monthEnd.setTime(today.getTime());
                            monthEnd.setHours(23, 59, 59, 999);
                        }

                        startObj = monthStart;
                        endObj = monthEnd;

                        const cStartObj = new Date(monthStart);
                        cStartObj.setMonth(cStartObj.getMonth() - 1);
                        cStartObj.setDate(1);
                        cStartObj.setHours(0, 0, 0, 0);

                        const cEndObj = new Date(cStartObj);
                        cEndObj.setMonth(cStartObj.getMonth() + 1);
                        cEndObj.setDate(0);
                        cEndObj.setHours(23, 59, 59, 999);

                        const cStartStr = `${cStartObj.getFullYear()}-${pad(cStartObj.getMonth() + 1)}-${pad(cStartObj.getDate())}T00:00`;
                        const cEndStr = `${cEndObj.getFullYear()}-${pad(cEndObj.getMonth() + 1)}-${pad(cEndObj.getDate())}T23:59`;
                        const cStartUTC = toUTC(cStartStr, false);
                        const cEndUTC = toUTC(cEndStr, true);

                        if (selectedBranchId === 'ALL') {
                            const cPromises = branches.map(b => fetchDailySales(b.id, cStartUTC, cEndUTC, joahOnly));
                            const cResults = await Promise.all(cPromises);
                            const cMapped = {};
                            branches.forEach((b, idx) => { cMapped[b.id] = cResults[idx] || []; });
                            setCompareWeeklySales(cMapped);
                        } else {
                            const cData = await fetchDailySales(selectedBranchId, cStartUTC, cEndUTC, joahOnly);
                            setCompareWeeklySales({ [selectedBranchId]: cData || [] });
                        }
                    }
                }

                const startStr = `${startObj.getFullYear()}-${pad(startObj.getMonth() + 1)}-${pad(startObj.getDate())}T00:00`;
                const endStr = `${endObj.getFullYear()}-${pad(endObj.getMonth() + 1)}-${pad(endObj.getDate())}T23:59`;

                const startUTC = toUTC(startStr, false);
                const endUTC = toUTC(endStr, true);

                if (selectedBranchId === 'ALL') {
                    const promises = branches.map(b => fetchDailySales(b.id, startUTC, endUTC, joahOnly));
                    const results = await Promise.all(promises);
                    const mapped = {};
                    branches.forEach((b, idx) => { mapped[b.id] = results[idx] || []; });
                    setWeeklySales(mapped);
                } else {
                    const data = await fetchDailySales(selectedBranchId, startUTC, endUTC, joahOnly);
                    setWeeklySales({ [selectedBranchId]: data || [] });
                }
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, dateStart, dateEnd, activeTab, joahOnly, weekOffset, isCompareMode, compareMonthOffset, calendarMode]);

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

    // ── Render DayDetailViewer if a day is selected ──────────────────────────
    if (selectedDay) {
        return (
            <DayDetailViewer
                dateObj={selectedDay.dateObj}
                branchId={selectedDay.branchId}
                branchName={selectedDay.branchName}
                dayData={selectedDay.dayData}
                joahOnly={joahOnly}
                onBack={() => setSelectedDay(null)}
            />
        );
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] w-screen h-screen flex flex-col p-4 md:p-6 animate-fade-in-up overflow-y-auto md:overflow-hidden bg-cover bg-center bg-no-repeat before:absolute before:inset-0 before:bg-black/60 before:backdrop-blur-sm"
            style={{ backgroundImage: `url(${dataImageBG})` }}
        >
            <div className="relative flex flex-col min-h-full h-auto md:h-full w-full max-w-7xl mx-auto z-10 pb-10 md:pb-0">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500 hover:text-joah-orange hover:bg-orange-50 transition-all border border-slate-200 dark:border-slate-700">
                            <ArrowLeft size={20} />
                        </button>
                        <img src={JoahLogo} alt="Joah" className="h-10 w-auto rounded-lg object-contain shadow-sm" />
                        <div>
                            <h1 className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
                                <span className="text-joah-orange"></span> Sales Viewer
                            </h1>
                            <p className="text-xs text-slate-200 font-medium drop-shadow-sm">ສາຂາ: <span className="font-black text-joah-orange">{selectedBranchName}</span></p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className="flex items-center bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
                            <MapPin size={14} className="sm:w-4 sm:h-4 text-white/80 mr-1 sm:mr-2" />
                            <select
                                value={selectedBranchId}
                                onChange={(e) => setSelectedBranchId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                                className="bg-transparent text-xs sm:text-sm font-bold text-white outline-none cursor-pointer [&>option]:text-slate-800"
                                disabled={!isAdmin && userBranch !== 'ເມກ້າມໍ'}
                            >
                                {activeTab === 'weekly' && isAdmin && <option value="ALL">ລວມທຸກສາຂา (ALL)</option>}
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name} ({b.short})</option>)}
                            </select>
                        </div>

                        <button
                            onClick={handleExport}
                            disabled={loading || activeTab === 'weekly'}
                            className="flex items-center gap-1.5 sm:gap-2 bg-emerald-600/90 backdrop-blur hover:bg-emerald-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:shadow-[0_0_15px_rgba(5,150,105,0.5)] border border-emerald-500/50 hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                            <Download size={14} className="sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Export</span>
                        </button>

                        <button
                            onClick={loadSales}
                            className="flex items-center gap-1.5 sm:gap-2 bg-white/10 backdrop-blur hover:bg-white/20 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm border border-white/20 hover:shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:-translate-y-0.5 transition-all"
                        >
                            <RefreshCw size={14} className={`sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                            <span className="hidden sm:inline">ຣີເຟຣຊ</span>
                        </button>
                    </div>
                </div>

                {/* Tabs Moved to Top */}
                <div className="grid grid-cols-2 sm:flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl w-full max-w-2xl mb-6 shadow-lg border border-white/20 gap-1.5">
                    {['summary', 'history', 'audit', 'weekly', 'dashboard'].map(tab => (
                        <button key={tab} onClick={() => {
                            setActiveTab(tab);
                            setWeekOffset(0);
                            if ((tab === 'summary' || tab === 'history' || tab === 'audit') && selectedBranchId === 'ALL') {
                                setSelectedBranchId(branches.find(b => b.name === userBranch)?.id || 273);
                            }
                        }}
                            className={`flex-1 py-2 sm:py-2.5 px-2 sm:px-3 text-[10px] sm:text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === tab ? 'bg-joah-orange text-white shadow-lg shadow-orange-500/40 scale-[1.02]' : 'text-slate-200 hover:bg-white/10 hover:text-white'}`}>
                            {tab === 'summary' ? 'ສະຫຼຸບ' : tab === 'history' ? 'ປະຫວັດ' : tab === 'audit' ? <><ShieldAlert size={14} className="sm:w-4 sm:h-4" /> Audit</> : tab === 'weekly' ? <><CalendarDays size={14} className="sm:w-4 sm:h-4" /> 2 ອາທິດ</> : <><PieChart size={14} className="sm:w-4 sm:h-4" /> Dashboard</>}
                        </button>
                    ))}
                </div>

                {/* Weekly View Tab */}
                {activeTab === 'weekly' && (
                    <div className="flex-1 flex flex-col bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl p-6 rounded-3xl border border-white/30 shadow-2xl mb-6 animate-fade-in-up relative overflow-hidden min-h-[500px] md:min-h-0">
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                                <img src={JoahLoadingGif} alt="Loading..." className="w-32 h-32 sm:w-48 sm:h-48 object-contain mb-4 drop-shadow-xl" />
                                <p className="mt-2 font-bold text-slate-600 dark:text-slate-300 animate-pulse">
                                    ກຳລັງໂຫຼດຂໍ້ມູນ {selectedBranchId === 'ALL' ? 'ທຸກສາຂາ' : `ສາຂາ ${selectedBranchName}`}...
                                </p>
                            </div>
                        )}
                        {(() => {
                            const branchesToRender = selectedBranchId === 'ALL' ? branches : branches.filter(b => b.id === selectedBranchId);

                            // --- Calculate Totals ---
                            let currentSales = 0;
                            let currentCustomers = 0;
                            let currentSKUs = 0;

                            let compareSales = 0;
                            let compareCustomers = 0;
                            let compareSKUs = 0;

                            // Derive month name for labels FIRST
                            const _today = new Date();
                            let startObj, endObj, cStartObj, cEndObj;
                            let monthLabel, prevMonthLabel;

                            if (calendarMode === '14') {
                                const dayOfWeek = _today.getDay();
                                const daysToSun = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
                                const week2End = new Date(_today);
                                week2End.setDate(_today.getDate() + daysToSun - (weekOffset * 7));
                                week2End.setHours(23, 59, 59, 999);

                                // Week 2 = last 7 days of grid (current period in summary)
                                const week2Start = new Date(week2End);
                                week2Start.setDate(week2End.getDate() - 6);
                                week2Start.setHours(0, 0, 0, 0);

                                // Week 1 = first 7 days of grid (comparison period)
                                const week1End = new Date(week2Start);
                                week1End.setDate(week2Start.getDate() - 1);
                                week1End.setHours(23, 59, 59, 999);

                                const week1Start = new Date(week1End);
                                week1Start.setDate(week1End.getDate() - 6);
                                week1Start.setHours(0, 0, 0, 0);

                                startObj = week2Start;
                                endObj = week2End;
                                cStartObj = week1Start;
                                cEndObj = week1End;

                                monthLabel = formatDateRangeLao(week2Start, week2End);
                                prevMonthLabel = formatDateRangeLao(week1Start, week1End);
                            } else {
                                const _targetMonth = new Date(_today);
                                _targetMonth.setMonth(_today.getMonth() - weekOffset);
                                monthLabel = _targetMonth.toLocaleDateString('lo-LA', { month: 'long', year: 'numeric' });

                                const prevMonth = new Date(_targetMonth);
                                prevMonth.setMonth(prevMonth.getMonth() - 1);
                                prevMonthLabel = prevMonth.toLocaleDateString('lo-LA', { month: 'long', year: 'numeric' });

                                const _daysInMonthTarget = new Date(_targetMonth.getFullYear(), _targetMonth.getMonth() + 1, 0).getDate();
                                const _maxDays = weekOffset === 0 ? _today.getDate() : _daysInMonthTarget;

                                startObj = new Date(_targetMonth);
                                startObj.setDate(1);
                                startObj.setHours(0, 0, 0, 0);

                                endObj = new Date(_targetMonth);
                                endObj.setDate(_maxDays);
                                endObj.setHours(23, 59, 59, 999);

                                const prevMaxDays = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
                                const prevCompareMax = weekOffset === 0 ? Math.min(_today.getDate(), prevMaxDays) : prevMaxDays;

                                cStartObj = new Date(prevMonth);
                                cStartObj.setDate(1);
                                cStartObj.setHours(0, 0, 0, 0);

                                cEndObj = new Date(prevMonth);
                                cEndObj.setDate(prevCompareMax);
                                cEndObj.setHours(23, 59, 59, 999);
                            }

                            // Sum days — for 14-day mode: current = week2, compare = week1 (same fetched data)
                            branchesToRender.forEach(branch => {
                                const currentBranchSales = weeklySales[branch.id] || [];
                                // In 14-day mode, both current (week2) and compare (week1) come from weeklySales
                                const compareBranchSales = calendarMode === '14'
                                    ? weeklySales[branch.id] || []
                                    : compareWeeklySales[branch.id] || [];

                                currentBranchSales.forEach(day => {
                                    const d = parseOdooDate(day['create_date:day']);
                                    if (d && d >= startObj && d <= endObj) {
                                        currentSales += day?.price_subtotal_incl || 0;
                                        currentCustomers += day?.order_count || 0;
                                        currentSKUs += day?.sku_count || 0;
                                    }
                                });
                                compareBranchSales.forEach(day => {
                                    const d = parseOdooDate(day['create_date:day']);
                                    if (d && d >= cStartObj && d <= cEndObj) {
                                        compareSales += day?.price_subtotal_incl || 0;
                                        compareCustomers += day?.order_count || 0;
                                        compareSKUs += day?.sku_count || 0;
                                    }
                                });
                            });

                            const capSuffix = '';
                            const prevCapSuffix = '';

                            const growthPercentAll = compareSales === 0 ? (currentSales > 0 ? 100 : 0) : ((currentSales - compareSales) / compareSales) * 100;
                            const isPositiveGrowthAll = growthPercentAll >= 0;
                            const salesDifference = currentSales - compareSales;

                            return (
                                <>
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 relative z-0 shrink-0 gap-4">
                                        <h3 className="text-base sm:text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 shrink-0">
                                            <CalendarDays className="text-joah-orange" />
                                            ຍອດຂາຍ
                                            <span className="text-[10px] sm:text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">{monthLabel}</span>
                                        </h3>

                                        {/* 📊 SUMMARY BOX: Full Month vs Previous Month */}
                                        <div className="flex-1 w-full sm:max-w-[680px] px-2 sm:px-4 flex gap-2 sm:gap-4 justify-between sm:justify-center items-center bg-slate-50/80 dark:bg-slate-800/80 py-2 sm:py-2.5 rounded-xl border-2 border-slate-200 dark:border-slate-700 mx-auto shadow-inner relative group">

                                            {/* Month context badge */}
                                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-joah-orange to-orange-500 text-white rounded-full px-4 py-1 text-xs font-black whitespace-nowrap shadow-md shadow-orange-500/30 z-10 border-2 border-white dark:border-slate-800">
                                                {calendarMode === '14'
                                                    ? (weekOffset === 0
                                                        ? `ຍອດຂາຍ ${monthLabel} (ພວມດຳເນີນ)  ▶  ທຽບ ${prevMonthLabel}`
                                                        : `ສະຫຼຸບ ${monthLabel}  ▶  ທຽບ ${prevMonthLabel}`)
                                                    : (weekOffset === 0
                                                        ? `ຍອດຂາຍພວມດຳເນີນການ ${monthLabel}`
                                                        : `ສະຫຼຸບ ${monthLabel}  ▶  ທຽບ ${prevMonthLabel}`)
                                                }
                                            </div>

                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider mb-0.5">ຍອດຂາຍລວມ</p>
                                                <p className={`text-xs sm:text-base font-black leading-none ${weekOffset > 0 && !isPositiveGrowthAll ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {new Intl.NumberFormat('lo-LA').format(currentSales)} <span className="text-[9px] sm:text-[10px] opacity-70">₭</span>
                                                </p>
                                                {weekOffset > 0 && <p className="text-[8px] text-slate-400 mt-0.5">{prevMonthLabel}: {new Intl.NumberFormat('lo-LA').format(compareSales)} ₭</p>}
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-slate-700 h-10"></div>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider mb-0.5">ລູກຄ້າ</p>
                                                <p className={`text-xs sm:text-base font-black leading-none ${weekOffset > 0 && !isPositiveGrowthAll ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'}`}>
                                                    {new Intl.NumberFormat('lo-LA').format(currentCustomers)} <span className="text-[9px] sm:text-[10px] font-medium opacity-70">ບິນ</span>
                                                </p>
                                                <p className="text-[8px] text-slate-400 mt-0.5">{prevMonthLabel}: {new Intl.NumberFormat('lo-LA').format(compareCustomers)} ບິນ</p>
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-slate-700 h-10"></div>
                                            <div className="flex flex-col items-center justify-center">
                                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider mb-0.5">ສິນຄ້າ</p>
                                                <p className={`text-xs sm:text-base font-black leading-none ${weekOffset > 0 && !isPositiveGrowthAll ? 'text-rose-600 dark:text-rose-400' : 'text-violet-600 dark:text-violet-400'}`}>
                                                    {new Intl.NumberFormat('lo-LA').format(currentSKUs)} <span className="text-[9px] sm:text-[10px] font-medium opacity-70">ລາຍການ</span>
                                                </p>
                                                <p className="text-[8px] text-slate-400 mt-0.5">{prevMonthLabel}: {new Intl.NumberFormat('lo-LA').format(compareSKUs)} ລາຍການ</p>
                                            </div>
                                            <div className="w-px bg-slate-200 dark:bg-slate-700 h-10 hidden sm:block"></div>
                                            <div className="flex flex-col items-center justify-center hidden sm:flex">
                                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-black uppercase tracking-wider mb-0.5">
                                                    {calendarMode === '14' ? 'ການເຕີບໂຕ WoW' : 'ການເຕີບໂຕ MoM'}
                                                </p>
                                                {weekOffset === 0 && calendarMode !== '14' ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">⏳ ກຳລັງດຳເນີນ</span>
                                                        <p className="text-[9px] text-slate-500 font-bold">
                                                            {new Intl.NumberFormat('lo-LA').format(currentSales)} ₭
                                                        </p>
                                                        <p className="text-[8px] text-slate-400">ຈາກ {prevMonthLabel}: {new Intl.NumberFormat('lo-LA').format(compareSales)} ₭</p>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5">
                                                        <p className={`text-xs sm:text-base font-black ${isPositiveGrowthAll ? 'text-emerald-500' : 'text-rose-500'} flex items-center gap-1 leading-none`}>
                                                            {isPositiveGrowthAll ? '▲' : '▼'} {Math.abs(growthPercentAll).toFixed(1)}%
                                                        </p>
                                                        <span className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isPositiveGrowthAll ? 'bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30' : 'bg-rose-100/80 text-rose-700 dark:bg-rose-900/30'}`}>
                                                            {isPositiveGrowthAll ? '+' : ''}{new Intl.NumberFormat('lo-LA').format(salesDifference)} ₭
                                                        </span>
                                                    </div>
                                                )}
                                                <p className="text-[8px] text-slate-400 mt-0.5">{calendarMode === '14' ? '(Week-over-Week)' : '(Month-over-Month)'}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                            {/* 30d / 14d toggle */}
                                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700 shadow-inner">
                                                <button
                                                    onClick={() => setCalendarMode('30')}
                                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${calendarMode === '30'
                                                        ? 'bg-joah-orange text-white shadow-md'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                        }`}
                                                >30 ວັນ</button>
                                                <button
                                                    onClick={() => setCalendarMode('14')}
                                                    className={`px-3 py-1 text-xs font-black rounded-lg transition-all ${calendarMode === '14'
                                                        ? 'bg-sky-500 text-white shadow-md'
                                                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                                        }`}
                                                >14 ວັນ</button>
                                            </div>
                                            <button onClick={() => setWeekOffset(prev => prev + 1)} title="ເດືອນກ່ອນ" className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-joah-orange hover:text-white rounded-lg transition-colors text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm">
                                                <ChevronLeft size={18} />
                                            </button>
                                            <button onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))} disabled={weekOffset === 0} title="ເດືອນຖັດໄປ" className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-joah-orange hover:text-white rounded-lg transition-colors text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 disabled:hover:bg-slate-100 disabled:hover:text-slate-600 disabled:cursor-not-allowed">
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex-1 overflow-y-auto hide-scrollbar -mx-2 px-2 relative z-0">
                                        {branchesToRender.map((branch, branchIndex) => {
                                            const currentBranchSales = weeklySales[branch.id] || [];

                                            const amounts = [];
                                            let week1Total = 0;
                                            let week2Total = 0;
                                            let todayIndex = -1;

                                            // --- Compute the unified sliding window (same formula as summary & fetch) ---
                                            const _now = new Date();

                                            let loopDays, gridStartDate, monthAnchor;

                                            if (calendarMode === '14') {
                                                // True sliding window: each press of ◀ steps back 14 days
                                                const _dow = _now.getDay();
                                                const _daysToSun = _dow === 0 ? 0 : 7 - _dow;
                                                const _week2End = new Date(_now);
                                                _week2End.setDate(_now.getDate() + _daysToSun - (weekOffset * 7));
                                                _week2End.setHours(23, 59, 59, 999);

                                                gridStartDate = new Date(_week2End);
                                                gridStartDate.setDate(_week2End.getDate() - 13);
                                                gridStartDate.setHours(0, 0, 0, 0);

                                                loopDays = 14;
                                            } else {
                                                monthAnchor = new Date(_now);
                                                monthAnchor.setMonth(_now.getMonth() - weekOffset);
                                                monthAnchor.setDate(1);
                                                monthAnchor.setHours(0, 0, 0, 0);

                                                const _daysInMonth = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0).getDate();
                                                // Always show full month — future days will render as empty cards
                                                loopDays = _daysInMonth;
                                            }

                                            // Pre-calculate amounts for week1/week2 bar and today index
                                            for (let i = 0; i < loopDays; i++) {
                                                const d = new Date(calendarMode === '14' ? gridStartDate : monthAnchor);
                                                if (calendarMode === '14') {
                                                    d.setDate(gridStartDate.getDate() + i);
                                                } else {
                                                    d.setDate(1 + i);
                                                }

                                                const odooDateMatch = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
                                                const dayData = currentBranchSales.find(w => w['create_date:day'] === odooDateMatch);
                                                const amt = dayData?.price_subtotal_incl || 0;

                                                amounts.push(amt);
                                                if (i < 7) week1Total += amt;
                                                else if (i < 14) week2Total += amt;

                                                if (d.getDate() === _now.getDate() && d.getMonth() === _now.getMonth() && d.getFullYear() === _now.getFullYear()) {
                                                    todayIndex = i;
                                                }
                                            }

                                            const growthPercent = week1Total === 0 ? (week2Total > 0 ? 100 : 0) : ((week2Total - week1Total) / week1Total) * 100;
                                            const isPositiveGrowth = growthPercent >= 0;

                                            let todayVsLastWeekPercent = 0;
                                            let isTodayPositive = true;
                                            if (todayIndex >= 7) {
                                                const todayAmt = amounts[todayIndex];
                                                const lastWeekAmt = amounts[todayIndex - 7];
                                                todayVsLastWeekPercent = lastWeekAmt === 0 ? (todayAmt > 0 ? 100 : 0) : ((todayAmt - lastWeekAmt) / lastWeekAmt) * 100;
                                                isTodayPositive = todayVsLastWeekPercent >= 0;
                                            }

                                            return (
                                                <div key={branch.id} className={branchIndex > 0 ? "mt-8 border-t border-slate-200 dark:border-slate-700 pt-6 relative z-0" : "relative z-0"}>
                                                    {selectedBranchId === 'ALL' && (
                                                        <h4 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                                            <MapPin size={16} className="text-joah-orange" />
                                                            ສາຂາ: <span className="text-joah-orange">{branch.name}</span>
                                                        </h4>
                                                    )}
                                                    <div className={calendarMode === '14'
                                                        ? "grid grid-cols-7 gap-2 pb-4"
                                                        : "flex sm:grid sm:grid-cols-5 lg:grid-cols-10 gap-2 overflow-x-auto snap-x snap-mandatory pb-4 hide-scrollbar"
                                                    }>
                                                        {Array.from({ length: loopDays }).map((_, i) => {
                                                            const d = new Date(calendarMode === '14' ? gridStartDate : monthAnchor);
                                                            if (calendarMode === '14') {
                                                                d.setDate(gridStartDate.getDate() + i);
                                                            } else {
                                                                d.setDate(1 + i);
                                                            }

                                                            const today = new Date();
                                                            const dayNames = ['ອາທິດ', 'ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ'];
                                                            const enDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                                                            const enDayName = enDayNames[d.getDay()];

                                                            const odooDateMatch = `${d.getDate().toString().padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short', timeZone: 'Asia/Vientiane' })} ${d.getFullYear()}`;
                                                            const dayData = currentBranchSales.find(w => w['create_date:day'] === odooDateMatch);

                                                            const totalAmount = dayData?.price_subtotal_incl || 0;
                                                            const customerCount = dayData?.order_count || 0;
                                                            const skuCount = dayData?.sku_count || 0;
                                                            const isToday = d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
                                                            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                                                            const isFuture = weekOffset === 0 && d > today && !isToday;
                                                            const isPlaceholder = isFuture;

                                                            return (
                                                                <div
                                                                    key={i}
                                                                    onClick={() => !isPlaceholder && setSelectedDay({ dateObj: new Date(d), branchId: branch.id, branchName: branch.name, dayData })}
                                                                    className={`min-w-[100px] sm:min-w-0 shrink-0 snap-center rounded-xl border-2 p-2 flex flex-col justify-between transition-all ${isPlaceholder
                                                                        ? 'border-dashed border-slate-200 dark:border-slate-700/40 bg-slate-50/30 dark:bg-slate-800/10 opacity-35 cursor-default'
                                                                        : 'hover:-translate-y-1 cursor-pointer ' + (isToday
                                                                            ? 'border-joah-orange bg-orange-50 dark:bg-orange-900/20 shadow-md hover:shadow-orange-300/40'
                                                                            : isWeekend
                                                                                ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 hover:border-joah-orange/50'
                                                                                : 'border-slate-100 dark:border-slate-700/50 bg-white dark:bg-slate-800 hover:border-joah-orange/50')
                                                                        }`}>
                                                                    <div>
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${isWeekend ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                                                                                }`}>
                                                                                {enDayName}
                                                                            </span>
                                                                            {isToday && <span className="text-[9px] font-black text-joah-orange bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 rounded-full animate-pulse">ກຳລັງຂາຍ</span>}
                                                                        </div>
                                                                        <p className="text-lg font-black text-slate-800 dark:text-white leading-none tracking-tight">
                                                                            {d.getDate()}
                                                                        </p>
                                                                        <p className="text-[10px] font-medium text-slate-400 uppercase">
                                                                            {d.toLocaleDateString('en-GB', { month: 'short' })}
                                                                        </p>
                                                                    </div>
                                                                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-col gap-1">
                                                                        <div>
                                                                            <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">ຍອດ (₭)</p>
                                                                            <p className={`text-[11px] font-black truncate ${totalAmount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                                                {totalAmount > 0 ? formatNumber(totalAmount) : '-'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-100 dark:border-slate-700/50">
                                                                            <div>
                                                                                <p className="text-[8px] text-slate-400 font-bold uppercase">ລູກຄ້າ</p>
                                                                                <p className={`text-[10px] font-black flex items-center gap-0.5 ${customerCount > 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                                                    {customerCount > 0 ? <><Users size={9} className="shrink-0" />{customerCount}</> : '-'}
                                                                                </p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[8px] text-slate-400 font-bold uppercase">SKU</p>
                                                                                <p className={`text-[10px] font-black flex items-center gap-0.5 ${skuCount > 0 ? 'text-violet-600 dark:text-violet-400' : 'text-slate-300 dark:text-slate-600'}`}>
                                                                                    {skuCount > 0 ? <><Package size={9} className="shrink-0" />{skuCount}</> : '-'}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>

                                                    {calendarMode === '14' && (
                                                        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex sm:grid sm:grid-cols-4 lg:grid-cols-7 gap-3 overflow-x-auto snap-x snap-mandatory hide-scrollbar">
                                                            {Array.from({ length: 7 }).map((_, j) => {
                                                                const wk1 = amounts[j] ?? 0;        // Week 1: days 1-7 of month
                                                                const wk2 = amounts[j + 7] ?? 0;   // Week 2: days 8-14 of month

                                                                let status = 'FINISHED';
                                                                if (weekOffset === 0 && todayIndex !== -1) {
                                                                    if ((j + 7) > todayIndex) {
                                                                        status = 'FUTURE';
                                                                    } else if ((j + 7) === todayIndex) {
                                                                        const currentHour = new Date().getHours();
                                                                        if (currentHour < 21) {
                                                                            status = 'SELLING';
                                                                        }
                                                                    }
                                                                }

                                                                let percent = 0;
                                                                const diff = wk2 - wk1;
                                                                if (wk1 === 0) {
                                                                    percent = wk2 > 0 ? 100 : 0;
                                                                } else {
                                                                    percent = (diff / wk1) * 100;
                                                                }
                                                                const isPos = percent >= 0;

                                                                const dayNamesLao = ['ຈັນ', 'ອັງຄານ', 'ພຸດ', 'ພະຫັດ', 'ສຸກ', 'ເສົາ', 'ອາທິດ'];

                                                                return (
                                                                    <div key={j} className="min-w-[130px] sm:min-w-0 shrink-0 snap-center bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2 border border-slate-100 dark:border-slate-700 flex flex-col items-center justify-center text-center gap-1.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                                                                        <span className="text-[9px] font-black text-slate-400 tracking-wider">ທຽບວັນ{dayNamesLao[j]}</span>
                                                                        {status === 'FINISHED' ? (
                                                                            <div className="flex flex-col items-center gap-0.5">
                                                                                <span className={`text-[11px] font-black ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                                                                    {isPos ? '+' : ''}{formatNumber(diff)}
                                                                                </span>
                                                                                <div className={`px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1 ${isPos ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-red-100 text-red-600 dark:bg-red-900/30'}`}>
                                                                                    {isPos ? <TrendingUp size={10} /> : <TrendingUp size={10} className="rotate-180" />}
                                                                                    {isPos ? '+' : ''}{percent.toFixed(1)}%
                                                                                </div>
                                                                            </div>
                                                                        ) : status === 'SELLING' ? (
                                                                            <span className="text-[10px] font-bold text-joah-orange bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded-md animate-pulse">ກຳລັງຂາຍ...</span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-900/50 px-2 py-1 rounded-md">NULL</span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Dashboard Tab (Recharts) */}
                {activeTab === 'dashboard' && (
                    <SalesChartDashboard
                        weeklySales={weeklySales}
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        weekOffset={weekOffset}
                        setWeekOffset={setWeekOffset}
                        isCompareMode={isCompareMode}
                        setIsCompareMode={setIsCompareMode}
                        compareMonthOffset={compareMonthOffset}
                        setCompareMonthOffset={setCompareMonthOffset}
                        compareWeeklySales={compareWeeklySales}
                    />
                )}

                {/* Filters Row (Only for Summary/History/Audit) */}
                {(activeTab === 'summary' || activeTab === 'history' || activeTab === 'audit') && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-5">
                        <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12} /> ຕັ້ງແຕ່ (From)</label>
                            <input type="datetime-local" value={dateStart} onChange={(e) => setDateStart(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                        </div>
                        <div className="flex flex-col gap-1.5 col-span-1">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Calendar size={12} /> ເຖິງ (To)</label>
                            <input type="datetime-local" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)}
                                className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl p-2 sm:p-2.5 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                        </div>
                        <div className="flex flex-col gap-1.5 col-span-2 md:col-span-1">
                            <label className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Search size={12} /> ຄົ້ນຫາສິນຄ້າ</label>
                            <div className="relative">
                                <input type="text" placeholder="ພິມຊື່ສິນຄ້າ..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-lg sm:rounded-xl p-2 sm:p-2.5 pl-9 sm:pl-10 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-200 outline-none focus:border-joah-orange transition-all" />
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 sm:w-4 sm:h-4" />
                            </div>
                        </div>
                        <div className="flex flex-col justify-end col-span-2 md:col-span-1">
                            <label className="flex items-center gap-2 cursor-pointer bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 p-2 sm:p-2.5 rounded-lg sm:rounded-xl hover:border-joah-orange transition-all h-[38px] sm:h-[46px]">
                                <input type="checkbox" checked={joahOnly} onChange={(e) => setJoahOnly(e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-joah-orange rounded focus:ring-joah-orange" />
                                <span className="text-[11px] sm:text-sm font-bold text-slate-700 dark:text-slate-200 leading-tight">ສະເພາະແບຣນ Joah<br className="hidden sm:block" /><span className="text-[9px] sm:text-xs text-slate-400 sm:block ml-1 sm:ml-0">ຕັດສິນຄ້າອື່ນອອກ</span></span>
                            </label>
                        </div>
                    </div>
                )}

                {/* Summary Cards */}
                {(activeTab === 'summary' || activeTab === 'history' || activeTab === 'audit') && !loading && !error && (
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
                {(activeTab === 'summary' || activeTab === 'history' || activeTab === 'audit') && (
                    <div className="flex-1 bg-white/95 dark:bg-slate-900/90 backdrop-blur-2xl border border-white/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col relative animate-fade-in-up min-h-[500px] md:min-h-0">
                        {loading && (
                            <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center">
                                <img src={JoahLoadingGif} alt="Loading..." className="w-32 h-32 sm:w-48 sm:h-48 object-contain mb-4 drop-shadow-xl" />
                                <p className="mt-2 font-bold text-slate-600 dark:text-slate-300 animate-pulse">
                                    ກຳລັງໂຫຼດຂໍ້ມູນ {selectedBranchId === 'ALL' ? 'ທຸກສາຂາ' : `ສາຂາ ${selectedBranchName}`}...
                                </p>
                            </div>
                        )}

                        <div className="flex-1 overflow-auto p-0 md:p-0">

                            {/* --- DESKTOP TABLE VIEW --- */}
                            <table className="hidden md:table w-full text-left border-collapse">
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

                            {/* --- MOBILE CARD VIEW --- */}
                            <div className="md:hidden flex flex-col p-2 space-y-2">
                                {((activeTab === 'summary' && filteredSales.length === 0) || (activeTab === 'history' && filteredDetailedSales.length === 0)) && !loading && !error ? (
                                    <div className="p-12 text-center text-slate-400 bg-white/50 dark:bg-slate-800/50 rounded-xl">
                                        <Package size={40} className="mx-auto opacity-20 mb-3" />
                                        <p className="font-medium text-xs">ບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງເວລານີ້</p>
                                    </div>
                                ) : activeTab === 'summary' ? (
                                    filteredSales.map((item, index) => {
                                        const { barcode, name } = splitProduct(item.product_id[1]);
                                        return (
                                            <div key={item.product_id[0]} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-3 shadow-sm flex flex-col gap-2">
                                                <div className="flex justify-between items-start gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-bold text-slate-400 w-5">{index + 1}.</span>
                                                        <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{barcode}</span>
                                                    </div>
                                                    <span className="inline-flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 px-2 py-0.5 rounded-lg text-sm font-black whitespace-nowrap">
                                                        {formatNumber(item.qty)} ຊິ້ນ
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-2">{name}</p>
                                                <div className="flex justify-between items-center mt-1 border-t border-slate-100 dark:border-slate-700 pt-2">
                                                    <span className="text-[10px] font-bold text-slate-400">ຍອດຂາຍລວມ</span>
                                                    <span className="text-sm font-black text-slate-700 dark:text-slate-300">₭ {formatNumber(item.price_subtotal_incl)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    filteredDetailedSales.map((item, index) => {
                                        const { barcode, name } = splitProduct(item.product_id[1]);
                                        const isRefund = item.qty < 0 || item.price_subtotal_incl < 0;
                                        return (
                                            <div key={item.id || index} className={`bg-white dark:bg-slate-800 border ${isRefund ? 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10' : 'border-slate-100 dark:border-slate-700'} rounded-xl p-3 shadow-sm flex flex-col gap-2`}>
                                                <div className="flex justify-between items-center gap-2">
                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded-full">{formatDateTime(item.create_date)}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                                        {item.order_id?.[1]}
                                                        {isRefund && <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-100 text-red-600 dark:bg-red-900/30">REFUND</span>}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded">{barcode}</span>
                                                </div>
                                                <p className={`text-sm font-bold ${isRefund ? 'text-red-700 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'} line-clamp-2`}>{name}</p>
                                                <div className={`flex justify-between items-center mt-1 border-t ${isRefund ? 'border-red-100 dark:border-red-900/50' : 'border-slate-100 dark:border-slate-700'} pt-2`}>
                                                    <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-sm font-black ${isRefund ? 'bg-red-100 text-red-600 dark:bg-red-900/30' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
                                                        {formatNumber(item.qty)} ຊິ້ນ
                                                    </span>
                                                    <span className={`text-sm font-black ${isRefund ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'}`}>₭ {formatNumber(item.price_subtotal_incl)}</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

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
