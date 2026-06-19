import React, { useState, useEffect, useCallback } from 'react';
import { authenticate, fetchBranchProductSales, fetchDetailedProductSales } from '../../services/odooApi';
import { Search, Calendar, MapPin, Package, ArrowLeft, RefreshCw, AlertCircle, Download, TrendingUp, ShoppingCart } from 'lucide-react';
import JoahLogo from '../../assets/Joah.jpeg';
import ExcelJS from 'exceljs';

export default function OdooSalesViewer({ onBack, userBranch, isAdmin }) {
    const [sales, setSales] = useState([]);
    const [detailedSales, setDetailedSales] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('summary');

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

            const startDateTime = dateStart ? `${dateStart.replace('T', ' ')}:00` : null;
            const endDateTime = dateEnd ? `${dateEnd.replace('T', ' ')}:59` : null;

            if (activeTab === 'summary') {
                const data = await fetchBranchProductSales(selectedBranchId, startDateTime, endDateTime);
                setSales(data.sort((a, b) => b.qty - a.qty));
            } else {
                const data = await fetchDetailedProductSales(selectedBranchId, startDateTime, endDateTime);
                setDetailedSales(data);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedBranchId, dateStart, dateEnd, activeTab]);

    useEffect(() => { loadSales(); }, [loadSales]);

    // ── Filtered Data ──────────────────────────────────────────
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

    // ── Summary Totals ─────────────────────────────────────────
    const totalQty = filteredSales.reduce((sum, i) => sum + (i.qty || 0), 0);
    const totalRevenue = filteredSales.reduce((sum, i) => sum + (i.price_subtotal_incl || 0), 0);
    const totalDetailedRevenue = filteredDetailedSales.reduce((sum, i) => sum + (i.price_subtotal_incl || 0), 0);
    const totalDetailedQty = filteredDetailedSales.reduce((sum, i) => sum + (i.qty || 0), 0);

    // ── Helpers ────────────────────────────────────────────────
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

    // ── Export to Excel (ExcelJS) ──────────────────────────────
    const handleExport = async () => {
        const branchName = selectedBranchName;
        const reportDate = `${dateStart.replace('T', ' ')} ຫາ ${dateEnd.replace('T', ' ')}`;

        const workbook = new ExcelJS.Workbook();
        const ws = workbook.addWorksheet(branchName);

        // ── ฟอนต์และ Border helper ─────────────────────────────
        const FONT = { name: 'Phetsarath OT', size: 11 };
        const FONT_BOLD = { name: 'Phetsarath OT', size: 11, bold: true };
        const FONT_TITLE = { name: 'Phetsarath OT', size: 16, bold: true, color: { argb: 'FFE05C00' } };
        const BORDER = { style: 'thin', color: { argb: 'FF888888' } };
        const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
        const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
        const TOTAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7ED' } };

        // ── Logo Image ─────────────────────────────────────────
        try {
            const imgResp = await fetch(JoahLogo);
            const imgBuf = await imgResp.arrayBuffer();
            const imgId = workbook.addImage({ buffer: imgBuf, extension: 'jpeg' });
            ws.addImage(imgId, { tl: { col: 0, row: 0 }, br: { col: 2, row: 4 } });
        } catch (e) { /* image optional */ }

        // ── Header Info (rows 1-4 reserved for logo) ───────────
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

        // ── Column Headers (Row 6) ──────────────────────────────
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

        // ── Data Rows ───────────────────────────────────────────
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

        // ── Total Row ───────────────────────────────────────────
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

        // ── Save ────────────────────────────────────────────────
        const buf = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `JOAH_Sales_${branchName}_${todayStr}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── UNUSED legacy rows placeholder ─────────────────────────
    const _legacyRows = () => {
        let rows = [];
        if (activeTab === 'summary') {
            rows = filteredSales.map((item, idx) => {
                const { barcode, name } = splitProduct(item.product_id[1]);
                return {
                    'ລຳດັບ': idx + 1,
                    'ບາໂຄດ (Barcode)': barcode,
                    'ຊື່ສິນຄ້າ (Product Name)': name,
                    'ຈຳນວນທີ່ຂາຍ (Qty Sold)': item.qty || 0,
                    'ຍອດຂາຍລວມ (Total LAK)': item.price_subtotal_incl || 0,
                };
            });
            rows.push({
                'ລຳດັບ': '',
                'ບາໂຄດ (Barcode)': '',
                'ຊື່ສິນຄ້າ (Product Name)': 'ລວມທັງໝົດ (TOTAL)',
                'ຈຳນວນທີ່ຂາຍ (Qty Sold)': totalQty,
                'ຍອດຂາຍລວມ (Total LAK)': totalRevenue,
            });
        } else {
            rows = filteredDetailedSales.map((item, idx) => {
                const { barcode, name } = splitProduct(item.product_id[1]);
                return {
                    'ລຳດັບ': idx + 1,
                    'ເວລາ (Time)': formatDateTime(item.create_date),
                    'ເລກບິນ (Receipt)': item.order_id?.[1] || '',
                    'ບາໂຄດ (Barcode)': barcode,
                    'ຊື່ສິນຄ້າ (Product Name)': name,
                    'ຈຳນວນ (Qty)': item.qty || 0,
                    'ຍອດລວມ (Total LAK)': item.price_subtotal_incl || 0,
                };
            });
        }

        const ws = XLSX.utils.aoa_to_sheet([]);

        // Header rows with branch info
        XLSX.utils.sheet_add_aoa(ws, [
            ['JOAH - ລາຍງານຍອດຂາຍ'],
            [`ສາຂາ: ${branchName}`],
            [`ໄລຍະເວລາ: ${reportDate}`],
            [], // spacer
        ], { origin: 'A1' });

        // Data rows
        XLSX.utils.sheet_add_json(ws, rows, { origin: 'A5', skipHeader: false });

        // Column widths
        ws['!cols'] = [{ wch: 8 }, { wch: 18 }, { wch: 60 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 22 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, branchName);

        const fileName = `JOAH_Sales_${branchName}_${todayStr}.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-6xl mx-auto p-4 md:p-6 animate-fade-in-up">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500 hover:text-joah-orange hover:bg-orange-50 transition-all border border-slate-200 dark:border-slate-700">
                        <ArrowLeft size={20} />
                    </button>
                    <img src={JoahLogo} alt="Joah" className="h-10 w-auto rounded-lg object-contain shadow-sm" />
                    <div>
                        <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <span className="text-joah-orange">Odoo</span> Sales Viewer
                        </h1>
                        <p className="text-xs text-slate-500 font-medium">ສາຂາ: <span className="font-black text-joah-orange">{selectedBranchName}</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 shadow-sm">
                        <MapPin size={16} className="text-slate-400 mr-2" />
                        <select
                            value={selectedBranchId}
                            onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                            className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer"
                            disabled={!isAdmin && userBranch !== 'ເມກ້າມໍ'}
                        >
                            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={loading}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50"
                    >
                        <Download size={16} />
                        Export Excel
                    </button>

                    <button
                        onClick={loadSales}
                        className="flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        ຣີເຟຣຊ
                    </button>
                </div>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
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
            </div>

            {/* Summary Cards */}
            {!loading && !error && (
                <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <ShoppingCart size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">ຈຳນວນຂາຍລວມ</span>
                        </div>
                        <p className="text-3xl font-black">
                            {formatNumber(activeTab === 'summary' ? totalQty : totalDetailedQty)}
                        </p>
                        <p className="text-xs opacity-70 mt-1">ລາຍການ ({activeTab === 'summary' ? filteredSales.length : filteredDetailedSales.length} ສິນຄ້າ)</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-500 to-joah-orange rounded-2xl p-4 text-white shadow-lg">
                        <div className="flex items-center gap-2 mb-1 opacity-80">
                            <TrendingUp size={16} />
                            <span className="text-xs font-bold uppercase tracking-wide">ຍອດເງິນລວມ</span>
                        </div>
                        <p className="text-2xl font-black">
                            ₭ {formatNumber(activeTab === 'summary' ? totalRevenue : totalDetailedRevenue)}
                        </p>
                        <p className="text-xs opacity-70 mt-1">ສາຂາ {selectedBranchName}</p>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl w-full max-w-sm mb-4 shadow-inner">
                {['summary', 'history'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-joah-orange shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                        {tab === 'summary' ? 'ສະຫຼຸບ (Summary)' : 'ປະຫວັດ (History)'}
                    </button>
                ))}
            </div>

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
            <div className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col relative">
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
                                    return (
                                        <tr key={item.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-4 text-sm font-bold text-slate-500 whitespace-nowrap">{formatDateTime(item.create_date)}</td>
                                            <td className="p-4 text-xs font-bold text-slate-400 uppercase">{item.order_id?.[1]}</td>
                                            <td className="p-4"><span className="text-xs font-bold font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{barcode}</span></td>
                                            <td className="p-4"><p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-joah-orange transition-colors">{name}</p></td>
                                            <td className="p-4 text-right"><span className="inline-flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 px-2 py-1 rounded text-sm font-black">{formatNumber(item.qty)}</span></td>
                                            <td className="p-4 text-right"><p className="text-sm font-bold text-slate-600 dark:text-slate-400">₭ {formatNumber(item.price_subtotal_incl)}</p></td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

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
        </div>
    );
}
