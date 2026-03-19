import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../utils/supabaseClient';
import ExcelJS from 'exceljs';
import {
    BarChart3, GitBranch, Edit3, PlusCircle,
    Loader2, ArrowLeft, Clock,
    AlertCircle, User, ChevronRight, ArrowLeftCircle, Search, RefreshCw,
    FileSpreadsheet, X, ChevronDown
} from 'lucide-react';

import imgSvl from '../../../assets/SVLJoah.png';
import imgTll from '../../../assets/TLLimage.png';

// ===================== CONSTANTS =====================
const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ'];

const BC = {
    'ຕະຫຼາດລາວ': { gr: 'bg-gradient-to-br from-orange-500 to-amber-500', grR: 'bg-gradient-to-r from-orange-500 to-amber-500', card: 'bg-orange-50 dark:bg-orange-900/20', bdr: 'border-orange-200 dark:border-orange-700', txt: 'text-orange-600 dark:text-orange-400' },
    'ສີວິໄລ': { gr: 'bg-gradient-to-br from-blue-500 to-indigo-600', grR: 'bg-gradient-to-r from-blue-500 to-indigo-600', card: 'bg-blue-50 dark:bg-blue-900/20', bdr: 'border-blue-200 dark:border-blue-700', txt: 'text-blue-600 dark:text-blue-400' },
    'ໂພນສີນວນ': { gr: 'bg-gradient-to-br from-emerald-500 to-teal-600', grR: 'bg-gradient-to-r from-emerald-500 to-teal-600', card: 'bg-emerald-50 dark:bg-emerald-900/20', bdr: 'border-emerald-200 dark:border-emerald-700', txt: 'text-emerald-600 dark:text-emerald-400' },
    'ວັງຊາຍ': { gr: 'bg-gradient-to-br from-purple-500 to-violet-600', grR: 'bg-gradient-to-r from-purple-500 to-violet-600', card: 'bg-purple-50 dark:bg-purple-900/20', bdr: 'border-purple-200 dark:border-purple-700', txt: 'text-purple-600 dark:text-purple-400' },
};

const TABS = [
    { id: 'requests', label: 'ລາຍງານ Request', icon: GitBranch, color: 'from-orange-500 to-amber-500' },
    { id: 'edits', label: 'ການແກ້ໄຂສິນຄ້າ', icon: Edit3, color: 'from-indigo-500 to-purple-500' },
    { id: 'new', label: 'ສິນຄ້າເຂົ້າໃໝ່', icon: PlusCircle, color: 'from-emerald-500 to-teal-500' },
];

// ===================== HELPERS =====================
const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const fmt = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return `${d.toLocaleDateString('lo-LA')}  ${d.toLocaleTimeString('lo-LA', { hour: '2-digit', minute: '2-digit' })}`;
};

const fmtExcel = (ts) => (!ts ? '-' : new Date(ts).toLocaleString('th-TH'));

// Parse "Name (EMP-ID)" -> { name, empId }
const parseUser = (str) => {
    if (!str) return { name: '-', empId: null };
    const m = str.match(/^(.+?)\s\(([^)]+)\)$/);
    return m ? { name: m[1].trim(), empId: m[2].trim() } : { name: str, empId: null };
};

const UserCell = ({ value, iconColor = 'text-slate-400' }) => {
    const { name, empId } = parseUser(value);
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
                <User size={15} className={`${iconColor} shrink-0`} />
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{name}</span>
            </div>
            {empId && (
                <span className="ml-6 inline-block px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider font-mono">
                    {empId}
                </span>
            )}
        </div>
    );
};

// ===================== EXCEL EXPORT =====================
const exportToExcel = async (rows, activeTab, startDate, endDate) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HQ Command Center';
    workbook.created = new Date();

    const tabNames = { requests: 'Store Requests', edits: 'Edit Activity', new: 'New Arrivals' };
    const ws = workbook.addWorksheet(tabNames[activeTab]);

    const headerFill = { requests: 'FFF97316', edits: 'FF6366F1', new: 'FF10B981' };
    const headerStyle = {
        font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 12, name: 'Phetsarath OT' },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: headerFill[activeTab] } },
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
    };

    if (activeTab === 'requests') {
        ws.columns = [
            { header: 'ເລກທີບິນ (Doc)', key: 'docNo', width: 22 },
            { header: 'ສາຂາ', key: 'branch_id', width: 18 },
            { header: 'ສິນຄ້າ', key: 'product_name', width: 35 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'ຜູ້ Request', key: 'request_by_name', width: 22 },
            { header: 'ຂໍ (Qty)', key: 'qty', width: 10 },
            { header: 'ສະຕ໋ອກ (Stock)', key: 'stock_qty', width: 14 },
            { header: 'ຄົງເຫຼືອ (Remain)', key: 'remain_qty', width: 16 },
            { header: 'ສະຖານະ', key: 'status', width: 14 },
            { header: 'Employee ID', key: 'request_by_id', width: 16 },
            { header: 'ຮັບ/ປະຕິເສດ ໂດຍ', key: 'accepted_by_name', width: 22 },
            { header: 'Employee ID', key: 'accepted_by_id', width: 16 },
            { header: 'ເວລາ Request', key: 'created_at', width: 24 },
            { header: 'ເວລາ Action', key: 'updated_at', width: 24 },
        ];
        ws.getRow(1).eachCell(c => Object.assign(c, headerStyle));
        rows.forEach((r, i) => {
            const isAcc = r.status === 'accepted' || r.status === 'approved';
            const isRej = r.status === 'rejected';
            
            // Stock calculation
            const stockQty = r.stock_at_request ?? null;
            const requestedQty = r.qty ?? 0;
            
            // Pending & Rejected: don't show remaining. Accepted: stock - qty.
            const remainQty = (stockQty != null && isAcc) 
                ? stockQty - requestedQty 
                : null;

            const { name: reqName, empId: reqId } = parseUser(r.request_by);
            const { name: accName, empId: accId } = parseUser(r.accepted_by);
            const row = ws.addRow({
                branch_id: r.branch_id, 
                docNo: r.batch_id && r.batch_id.startsWith('REQ') ? r.batch_id : 'N/A', 
                product_name: r.product_name || r.barcode,
                barcode: r.barcode, 
                qty: requestedQty,
                stock_qty: stockQty != null ? stockQty : '-',
                remain_qty: remainQty != null ? remainQty : '-',
                status: isAcc ? 'ອານຸມັດ' : isRej ? 'ປະຕິເສດ' : 'ລໍຖ້າ',
                request_by_name: reqName, request_by_id: reqId || r.request_by_id || '-',
                accepted_by_name: accName, accepted_by_id: accId || '-',
                created_at: fmtExcel(r.created_at), updated_at: fmtExcel(r.updated_at),
            });
            const bg = isAcc ? 'FFD1FAE5' : isRej ? 'FFFEE2E2' : 'FFFEFCE8';
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? bg : 'FFFFFFFF' } }; });
            row.getCell('status').font = { bold: true, color: { argb: isAcc ? 'FF065F46' : isRej ? 'FF991B1B' : 'FF92400E' } };
        });
    } else if (activeTab === 'edits') {
        ws.columns = [
            { header: 'ສາຂາ', key: 'branch_id', width: 18 },
            { header: 'ສິນຄ້າ', key: 'item_name', width: 35 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'ຜູ້ແກ້ໄຂ', key: 'updated_by_name', width: 22 },
            { header: 'Employee ID', key: 'updated_by_id', width: 16 },
            { header: 'ການປ່ຽນ', key: 'change', width: 14 },
            { header: 'ສະຕ໋ອກ (ກ່ອນ)', key: 'old_qty', width: 16 },
            { header: 'ຄົງເຫຼືອ (ຫຼັງ)', key: 'new_qty', width: 16 },
            { header: 'ເຫດຜົນ', key: 'details', width: 32 },
            { header: 'ເວລາ', key: 'updated_at', width: 24 },
        ];
        ws.getRow(1).eachCell(c => Object.assign(c, headerStyle));
        rows.forEach((r, i) => {
            const ch = (r.new_qty ?? 0) - (r.old_qty ?? 0);
            const { name: editName, empId: editId } = parseUser(r.updated_by || r.added_by);
            const isNew = r._source === 'added';
            const row = ws.addRow({
                branch_id: r.branch_id,
                item_name: r.item_name || r.barcode,
                barcode: r.barcode,
                updated_by_name: editName,
                updated_by_id: editId || r.updated_by_id || '-',
                change: ch > 0 ? `+${ch}` : ch,
                old_qty: isNew ? '-' : (r.old_qty ?? '-'),
                new_qty: r.new_qty ?? '-',
                details: r.details || r.change_reason || r.remarks || (isNew ? 'ສິນຄ້າເຂ້າໃໝ່' : 'ແກ້ໄຂຂໍ້ມູນ'),
                updated_at: fmtExcel(r.updated_at),
            });
            const bg = isNew ? 'FFD1FAE5' : (ch > 0 ? 'FFD1FAE5' : ch < 0 ? 'FFFEE2E2' : 'FFF1F5F9');
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? bg : 'FFFFFFFF' } }; });
            row.getCell('change').font = { bold: true, color: { argb: ch > 0 ? 'FF065F46' : ch < 0 ? 'FF991B1B' : 'FF6B7280' } };
        });
    } else {
        ws.columns = [
            { header: 'ສາຂາ', key: 'branch_id', width: 18 },
            { header: 'ສິນຄ້າ', key: 'item_name', width: 35 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'ຈຳນວນ', key: 'qty', width: 10 },
            { header: 'ຜູ້ດຳເນີນ', key: 'added_by_name', width: 22 },
            { header: 'Employee ID', key: 'added_by_id', width: 16 },
            { header: 'ເຫດຜົນ', key: 'remarks', width: 32 },
            { header: 'ເວລາ', key: 'created_at', width: 24 },
        ];
        ws.getRow(1).eachCell(c => Object.assign(c, headerStyle));
        rows.forEach((r, i) => {
            const { name: addName, empId: addId } = parseUser(r.added_by);
            const row = ws.addRow({
                branch_id: r.branch_id, item_name: r.item_name || r.barcode,
                barcode: r.barcode, qty: r.qty,
                added_by_name: addName, added_by_id: addId || '-',
                remarks: r.remarks || r.reason || 'ເພີ່ມເຂົ້າລະບົບໂດຍກົງ',
                created_at: fmtExcel(r.created_at),
            });
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFD1FAE5' : 'FFFFFFFF' } }; });
        });
    }

    // Apply Phetsarath OT font + center alignment to ALL cells
    ws.eachRow((row, rowNumber) => {
        row.height = rowNumber === 1 ? 30 : 22;
        row.eachCell(cell => {
            cell.font = { ...cell.font, name: 'Phetsarath OT' };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            if (!cell.border) {
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                };
            }
        });
    });
    const dateStr = startDate && endDate ? `${startDate}_to_${endDate}` : startDate || endDate || 'all';
    const fileName = `HQ_${tabNames[activeTab].replace(' ', '_')}_${dateStr}.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
};

// ===================== UI ATOMS =====================
const LoadingSpinner = () => (
    <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={42} />
            <p className="text-xl font-bold">ກຳລັງໂຫລດ...</p>
        </div>
    </div>
);

const EmptyState = ({ label }) => (
    <div className="text-center py-14 text-slate-300 dark:text-slate-700">
        <AlertCircle size={52} strokeWidth={1} className="mx-auto mb-3 opacity-40" />
        <p className="text-xl font-bold">{label}</p>
    </div>
);

const StatusBadge = ({ status }) => {
    const map = {
        pending: { label: 'ລໍຖ້າ', cls: 'bg-amber-100 text-amber-700 border border-amber-200', icon: '⏳' },
        accepted: { label: 'ອານຸມັດ', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: '✅' },
        approved: { label: 'ອານຸມັດ', cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200', icon: '✅' },
        rejected: { label: 'ປະຕິເສດ', cls: 'bg-rose-100 text-rose-700 border border-rose-200', icon: '❌' },
    };
    const c = map[status] || { label: status, cls: 'bg-slate-100 text-slate-500', icon: '•' };
    return (
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-black whitespace-nowrap ${c.cls}`}>
            {c.icon} {c.label}
        </span>
    );
};

// ===================== BRANCH OVERVIEW CARDS =====================
const BranchGrid = ({ data, activeTab, onSelectBranch }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {BRANCHES.map(branch => {
            const c = BC[branch];
            const rows = data.filter(r => r.branch_id === branch);
            let mainVal, mainLabel, subA, subB, subC;

            if (activeTab === 'requests') {
                mainVal = rows.length; mainLabel = 'ຄຳຂໍທັງໝົດ';
                subA = { val: rows.filter(r => r.status === 'pending').length, label: 'ລໍຖ້າ', color: 'text-amber-500' };
                subB = { val: rows.filter(r => r.status === 'accepted' || r.status === 'approved').length, label: 'ອານຸມັດ', color: 'text-emerald-600' };
                subC = { val: rows.filter(r => r.status === 'rejected').length, label: 'ປະຕິເສດ', color: 'text-rose-500' };
            } else if (activeTab === 'edits') {
                mainVal = rows.length; mainLabel = 'ການແກ້ໄຂ';
                subA = { val: new Set(rows.map(r => r.updated_by)).size, label: 'ຜູ້ແກ້ໄຂ', color: 'text-indigo-500' };
                subB = { val: new Set(rows.map(r => r.barcode)).size, label: 'ສິນຄ້າ', color: 'text-purple-600' };
                subC = null;
            } else {
                mainVal = rows.length; mainLabel = 'ສິນຄ້າໃໝ່';
                subA = { val: new Set(rows.map(r => r.added_by)).size, label: 'ຜູ້ດຳເນີນ', color: 'text-teal-600' };
                subB = null;
                subC = null;
            }

            const hasImg = branch === 'ສີວິໄລ' || branch === 'ຕະຫຼາດລາວ';
            return (
                <button key={branch} onClick={() => onSelectBranch(branch)}
                    className={`text-left p-7 rounded-3xl border-2 ${c.card} ${c.bdr} shadow-md hover:shadow-xl hover:scale-[1.025] active:scale-[0.99] transition-all duration-200 group focus:outline-none focus:ring-4 focus:ring-offset-1 focus:ring-orange-300 relative overflow-hidden`}>

                    {branch === 'ສີວິໄລ' && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={imgSvl} alt="Sivilay Branch" className="w-full h-full object-cover object-center opacity-100 group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    )}

                    {branch === 'ຕະຫຼາດລາວ' && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={imgTll} alt="Talad Lao Branch" className="w-full h-full object-cover object-center opacity-100 group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    )}

                    {/* Dark overlay for readability on image cards */}
                    {hasImg && (
                        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-black/50 to-black/70 pointer-events-none transition-opacity duration-500 group-hover:opacity-0" />
                    )}

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5">
                            <span className={`text-xl font-black ${hasImg ? 'text-white' : c.txt} drop-shadow-md`}>{branch}</span>
                            <div className={`w-10 h-10 rounded-xl ${c.gr} flex items-center justify-center text-white shadow-sm`}><ChevronRight size={20} /></div>
                        </div>
                        <p className={`text-7xl font-black leading-none ${hasImg ? 'text-white' : c.txt} drop-shadow-xl tracking-tighter`}>{mainVal}</p>
                        <p className={`text-base font-bold ${hasImg ? 'text-white/90' : 'text-slate-500'} mt-1 drop-shadow-md`}>{mainLabel}</p>

                        <div className={`flex gap-4 pt-4 mt-4 border-t ${hasImg ? 'border-white/30' : 'border-slate-200 dark:border-slate-700'}`}>
                            <div>
                                <p className={`text-2xl font-black ${hasImg ? 'text-white' : subA.color} drop-shadow-md`}>{subA.val}</p>
                                <p className={`text-[10px] font-bold ${hasImg ? 'text-white/80' : 'text-slate-400'} uppercase tracking-wider`}>{subA.label}</p>
                            </div>
                            {subB && (
                                <div>
                                    <p className={`text-2xl font-black ${hasImg ? 'text-white' : subB.color} drop-shadow-md`}>{subB.val}</p>
                                    <p className={`text-[10px] font-bold ${hasImg ? 'text-white/80' : 'text-slate-400'} uppercase tracking-wider`}>{subB.label}</p>
                                </div>
                            )}
                            {subC && (
                                <div>
                                    <p className={`text-2xl font-black ${hasImg ? 'text-rose-300' : subC.color} drop-shadow-md`}>{subC.val}</p>
                                    <p className={`text-[10px] font-bold ${hasImg ? 'text-white/80' : 'text-slate-400'} uppercase tracking-wider`}>{subC.label}</p>
                                </div>
                            )}
                        </div>
                        <p className={`text-sm font-bold mt-4 transition-colors ${hasImg ? 'text-white/70 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                            👆 ກົດເພື່ອເບິ່ງລາຍລະອຽດ
                        </p>
                    </div>
                </button>
            );
        })}
    </div>
);

// ===================== BRANCH DETAIL =====================
const BranchDetail = ({ branch, activeTab, data, onBack, startDate, endDate }) => {
    const c = BC[branch];
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 100;
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const exportRef = useRef(null);

    // Reset filter when branch changes
    useEffect(() => { setStatusFilter('all'); setSearch(''); setPage(0); }, [branch]);
    useEffect(() => { setPage(0); }, [search, statusFilter]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const branchData = data.filter(r => r.branch_id === branch);
    const filtered = branchData.filter(r => {
        // Status filter (requests tab only)
        if (activeTab === 'requests' && statusFilter !== 'all') {
            if (statusFilter === 'accepted' && r.status !== 'accepted' && r.status !== 'approved') return false;
            if (statusFilter === 'pending' && r.status !== 'pending') return false;
            if (statusFilter === 'rejected' && r.status !== 'rejected') return false;
        }
        if (!search) return true;
        const s = search.toLowerCase();
        return (
            (r.product_name || r.item_name || '').toLowerCase().includes(s) ||
            (r.barcode || '').includes(s) ||
            (r.request_by || r.updated_by || r.added_by || '').toLowerCase().includes(s) ||
            (r.accepted_by || '').toLowerCase().includes(s)
        );
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const headers =
        activeTab === 'requests' ? ['#', 'ເລກທີບິນ', 'ສິນຄ້າ', 'ຜູ້ Request', 'ຂໍ', 'ສະຕ໋ອກ', 'ຄົງເຫຼືອ', 'ສະຖານະ', 'ຮັບ/ປະຕິເສດ ໂດຍ'] :
            activeTab === 'edits' ? ['#', 'ສິນຄ້າ', 'ຜູ້ແກ້ໄຂ', 'ການປ່ຽນແປງ', 'ສະຕ໋ອກ (ກ່ອນ)', 'ຄົງເຫຼືອ (ຫຼັງ)', 'ເຫດຜົນ', 'ເວລາ'] :
                ['#', 'ສິນຄ້າ', 'ຜູ້ດຳເນີນ', 'ຈຳນວນ', 'ເຫດຜົນ', 'ເວລາ'];

    const reqSummary = activeTab === 'requests' ? [
        { label: 'ທັງໝົດ', val: branchData.length, key: 'all', cls: 'bg-white/20', active: 'bg-white/40 ring-2 ring-white' },
        { label: 'ລໍຖ້າ', val: branchData.filter(r => r.status === 'pending').length, key: 'pending', cls: 'bg-amber-400/30', active: 'bg-amber-400/60 ring-2 ring-amber-300' },
        { label: 'ອານຸມັດ', val: branchData.filter(r => r.status === 'accepted' || r.status === 'approved').length, key: 'accepted', cls: 'bg-emerald-400/30', active: 'bg-emerald-400/60 ring-2 ring-emerald-300' },
        { label: 'ປະຕິເສດ', val: branchData.filter(r => r.status === 'rejected').length, key: 'rejected', cls: 'bg-rose-400/30', active: 'bg-rose-400/60 ring-2 ring-rose-300' },
    ] : [];

    // Export: 'dated' uses current filtered (date-filtered) data, 'all' uses all branch data
    const handleExport = async (mode) => {
        setShowExportMenu(false);
        setIsExporting(true);
        try {
            const exportRows = mode === 'dated' ? filtered : branchData;
            const s = mode === 'dated' ? startDate : '';
            const e = mode === 'dated' ? endDate : '';
            await exportToExcel(exportRows, activeTab, s, e);
        } catch (err) { console.error(err); }
        finally { setIsExporting(false); }
    };

    const renderRow = (r, i) => {
        if (activeTab === 'requests') {
            const isAccepted = r.status === 'accepted' || r.status === 'approved';
            const isRejected = r.status === 'rejected';
            const docNo = r.batch_id && r.batch_id.startsWith('REQ') ? r.batch_id : 'N/A';

            // 📸 ใช้ stock_at_request (snapshot ณ เวลา request) ไม่ใช่ realtime
            const stockQty = r.stock_at_request ?? null;
            const requestedQty = r.qty ?? 0;

            // คงเหลือ: จะแสดงแค่ในสถานะ "✅ ອານຸມັດ" เท่านั้น
            const remainQty = (stockQty != null && isAccepted)
                ? stockQty - requestedQty
                : null;

            const stockColor = stockQty == null ? 'text-slate-300'
                : stockQty <= requestedQty ? 'text-rose-500 font-black'
                : stockQty <= requestedQty * 2 ? 'text-amber-500 font-black'
                : 'text-emerald-600 font-black';

            const remainColor = remainQty == null ? 'text-slate-300'
                : remainQty < 0 ? 'text-rose-600 font-black'
                : remainQty === 0 ? 'text-orange-500 font-bold'
                : isRejected ? 'text-slate-400 font-semibold'
                : 'text-slate-700 dark:text-slate-200 font-semibold';

            return (
                <tr key={i} className={`transition-colors ${isAccepted ? 'bg-emerald-50/40' : isRejected ? 'bg-rose-50/40' : 'hover:bg-amber-50/40'}`}>
                    <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-md text-[11px] font-black tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                            DOC: {docNo}
                        </span>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2"><User size={16} className="text-slate-400 shrink-0" /><span className="text-base font-bold text-slate-700 dark:text-slate-200">{r.product_name || r.barcode || '-'}</span></div>
                        <p className="text-sm text-slate-400 font-mono ml-6">{r.barcode}</p>
                    </td>
                    <td className="px-6 py-4">
                        <UserCell value={r.request_by} iconColor="text-slate-400" />
                        <p className="text-xs text-slate-400 mt-1">{fmt(r.created_at)}</p>
                    </td>
                    {/* ขอ */}
                    <td className="px-4 py-4 text-center">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{requestedQty}</span>
                    </td>
                    {/* สต็อกในระบบ */}
                    <td className="px-4 py-4 text-center">
                        <span className={`text-2xl ${stockColor}`}>
                            {stockQty != null ? stockQty : <span className="text-sm text-slate-300">-</span>}
                        </span>
                    </td>
                    {/* คงเหลือหลังจ่าย */}
                    <td className="px-4 py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-2xl ${remainColor}`}>
                                {remainQty != null ? remainQty : <span className="text-sm text-slate-300">-</span>}
                            </span>
                            {remainQty != null && remainQty < 0 && (
                                <span className="text-[9px] font-black text-rose-500 uppercase">ບໍ່ພໍ!</span>
                            )}
                        </div>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={r.status} /></td>
                    <td className="px-6 py-4">
                        {r.accepted_by ? (() => {
                            const isAcc = r.status === 'accepted' || r.status === 'approved';
                            const bgCls = isAcc ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-rose-100 dark:bg-rose-900/30';
                            const { name, empId } = parseUser(r.accepted_by);
                            return (
                                <div className={`flex flex-col gap-1 px-3 py-2 rounded-xl ${bgCls}`}>
                                    <div className="flex items-center gap-1.5">
                                        <User size={14} className={isAcc ? 'text-emerald-600' : 'text-rose-500'} />
                                        <span className={`text-sm font-black ${isAcc ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{name}</span>
                                    </div>
                                    {empId && (
                                        <span className={`ml-5 inline-block px-1.5 py-0.5 rounded text-[10px] font-black font-mono uppercase tracking-wider ${isAcc ? 'bg-emerald-200/70 text-emerald-800' : 'bg-rose-200/70 text-rose-800'}`}>{empId}</span>
                                    )}
                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><Clock size={11} /> {fmt(r.updated_at)}</p>
                                </div>
                            );
                        })() : <span className="text-slate-300">-</span>}
                    </td>
                </tr>
            );
        }
        if (activeTab === 'edits') {
            const qtyChange = (r.new_qty ?? 0) - (r.old_qty ?? 0);
            const oldQty = r.old_qty ?? null;
            const newQty = r.new_qty ?? null;
            const isNew = r._source === 'added';
            const changeColor = qtyChange > 0 ? 'text-emerald-500' : qtyChange < 0 ? 'text-rose-500' : 'text-slate-400';
            const remainColor = newQty == null ? 'text-slate-300' : newQty < 0 ? 'text-rose-600 font-black' : newQty === 0 ? 'text-orange-500 font-bold' : 'text-slate-700 dark:text-slate-200 font-semibold';
            return (
                <tr key={i} className={`transition-colors ${isNew ? 'bg-emerald-50/40 dark:bg-emerald-900/10' : 'hover:bg-indigo-50/30'}`}>
                    <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            {isNew && <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 whitespace-nowrap">ສິນຄ້າໃໝ່</span>}
                            <div>
                                <p className="text-base font-bold text-slate-800 dark:text-white">{r.item_name || r.barcode || '-'}</p>
                                <p className="text-sm text-slate-400 font-mono">{r.barcode}</p>
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4"><UserCell value={r.updated_by} iconColor={isNew ? 'text-emerald-400' : 'text-indigo-400'} /><p className="text-xs text-slate-400 mt-1">{fmt(r.updated_at)}</p></td>
                    {/* ການປ່ຽນແປງ */}
                    <td className="px-4 py-4 text-center">
                        <span className={`text-2xl font-black ${changeColor}`}>{qtyChange > 0 ? `+${qtyChange}` : qtyChange || '-'}</span>
                    </td>
                    {/* ສະຕ໋ອກ (ກ່ອນ) */}
                    <td className="px-4 py-4 text-center">
                        <span className="text-2xl font-black text-slate-500 dark:text-slate-400">
                            {isNew ? <span className="text-sm text-slate-300">-</span> : (oldQty != null ? oldQty : <span className="text-sm text-slate-300">-</span>)}
                        </span>
                    </td>
                    {/* ຄົງເຫຼືອ (ຫຼັງ) */}
                    <td className="px-4 py-4 text-center">
                        <span className={`text-2xl ${remainColor}`}>
                            {newQty != null ? newQty : <span className="text-sm text-slate-300">-</span>}
                        </span>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm text-slate-500 italic">{r.details || r.change_reason || 'ແກ້ໄຂຂໍ້ມູນ'}</span></td>
                    <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{fmt(r.updated_at)}</td>
                </tr>
            );
        }
        return (
            <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>
                <td className="px-6 py-4"><p className="text-base font-bold text-slate-800 dark:text-white">{r.item_name || r.barcode || '-'}</p><p className="text-sm text-slate-400 font-mono">{r.barcode}</p></td>
                <td className="px-6 py-4"><UserCell value={r.added_by} iconColor="text-emerald-400" /></td>
                <td className="px-6 py-4 text-center"><span className="text-3xl font-black text-emerald-600">{r.qty ?? '-'}</span></td>
                <td className="px-6 py-4"><span className="text-sm text-slate-500 italic">{r.remarks || r.reason || 'ເພີ່ມເຂົ້າລະບົບໂດຍກົງ'}</span></td>
                <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{fmt(r.created_at)}</td>
            </tr>
        );
    };

    return (
        <div className={`rounded-3xl border-2 ${c.bdr} overflow-hidden shadow-xl`}>
            {/* Header */}
            <div className={`${c.grR} px-6 py-5`}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    {/* Branch name + back */}
                    <div className="flex items-center gap-4">
                        <button onClick={onBack} className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-all"><ArrowLeftCircle size={26} /></button>
                        <div><h2 className="text-2xl font-black text-white">📍 {branch}</h2><p className="text-white/80 text-base font-bold">{filtered.length} ລາຍການ</p></div>
                    </div>

                    {/* Request summary badges — clickable filter buttons */}
                    {reqSummary.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                            {reqSummary.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setStatusFilter(statusFilter === s.key ? 'all' : s.key)}
                                    className={`flex flex-col items-center px-4 py-2 rounded-2xl text-white transition-all hover:scale-105 active:scale-95 ${
                                        statusFilter === s.key ? s.active : s.cls + ' hover:bg-white/30'
                                    }`}
                                >
                                    <span className="text-2xl font-black">{s.val}</span>
                                    <span className="text-xs font-bold opacity-80 uppercase">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Export Dropdown */}
                    <div className="relative" ref={exportRef}>
                        <button
                            onClick={() => setShowExportMenu(v => !v)}
                            disabled={isExporting || branchData.length === 0}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/20 hover:bg-white/30 border border-white/30 text-white text-sm font-black transition-all disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileSpreadsheet size={18} />}
                            <span>{isExporting ? 'Exporting...' : 'Export Excel'}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {showExportMenu && (
                            <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                                {/* Header */}
                                <div className="px-5 py-3 bg-slate-50 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                                    <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">📊 Export Excel — {branch}</p>
                                </div>

                                {/* Option 1: Export by selected date */}
                                <button onClick={() => handleExport('dated')}
                                    className="w-full flex items-start gap-3 px-5 py-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors text-left group">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <FileSpreadsheet size={20} className="text-emerald-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">Export ວັນທີເລືອກ</p>
                                        <p className="text-xs text-slate-400 mt-0.5 font-bold">
                                            {startDate || endDate
                                                ? `📅 ${startDate || '...'} → ${endDate || '...'}`
                                                : '📅 ທຸກຊ່ວງວັນ (ບໍ່ໄດ້ເລືອກວັນທີ)'}
                                        </p>
                                        <p className="text-xs text-emerald-600 font-bold mt-0.5">{filtered.length} ລາຍການ</p>
                                    </div>
                                </button>

                                <div className="h-px bg-slate-100 dark:bg-slate-700 mx-5" />

                                {/* Option 2: Export all */}
                                <button onClick={() => handleExport('all')}
                                    className="w-full flex items-start gap-3 px-5 py-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors text-left group">
                                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                        <BarChart3 size={20} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white">Export ທັງໝົດ</p>
                                        <p className="text-xs text-slate-400 mt-0.5 font-bold">📋 ທຸກຂໍ້ມູນ ບໍ່ຈຳກັດວັນທີ</p>
                                        <p className="text-xs text-blue-600 font-bold mt-0.5">{branchData.length} ລາຍການ</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                        <input type="text" placeholder="ຄົ້ນຫາ..." value={search} onChange={e => setSearch(e.target.value)}
                            className="pl-11 pr-4 py-3 rounded-2xl bg-white/20 text-white placeholder:text-white/60 text-base font-bold outline-none focus:bg-white/30 transition-all w-48" />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>{headers.map(h => <th key={h} className="px-6 py-4 text-sm font-black uppercase text-slate-500 tracking-wider text-left whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                        {paginatedData.length > 0 ? paginatedData.map((r, i) => renderRow(r, page * PAGE_SIZE + i)) : <tr><td colSpan={headers.length}><EmptyState label="ບໍ່ພົບຂໍ້ມູນ" /></td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-500">
                        ແຖວ {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} ຈາກ {filtered.length} ລາຍການ
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            ← Prev
                        </button>
                        <span className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-black shadow-md">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={page >= totalPages - 1}
                            className="px-5 py-2.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-sm font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// ===================== MAIN (React Portal) =====================
const HQCommandCenter = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('requests');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        // ✅ DO NOT reset selectedBranch here — keep the user on the detail page
        try {
            let rows = [];
            if (activeTab === 'requests') {
                let q = supabase.from('store_requests')
                    .select('id, branch_id, status, created_at, updated_at, request_by, accepted_by, product_name, barcode, qty, batch_id, stock_at_request')
                    .order('created_at', { ascending: false });
                if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
                const { data: d, error } = await q;
                if (error) throw error;
                rows = d || [];
            } else if (activeTab === 'edits') {
                // gt('old_qty', 0) — กรองออกรายการที่ old_qty=0 (สินค้าใหม่จาก QuickAdd)
                // เพราะ logInventoryHistory write ด้วย old_qty=0 ซึ่งซ้อนกับ added_items_log
                let q = supabase.from('inventory_history').select('*')
                    .gt('old_qty', 0)
                    .order('updated_at', { ascending: false }).limit(5000);
                if (startDate) q = q.gte('updated_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('updated_at', `${endDate}T23:59:59`);
                const { data: d, error } = await q;
                if (error) throw error;
                rows = d || [];
                // 🆕 Also fetch added_items_log and merge in
                let q2 = supabase.from('added_items_log').select('*').order('created_at', { ascending: false }).limit(5000);
                if (startDate) q2 = q2.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q2 = q2.lte('created_at', `${endDate}T23:59:59`);
                const { data: addedData } = await q2;
                const normalizedAdded = (addedData || []).map(r => ({
                    ...r,
                    _source: 'added',
                    old_qty: 0,
                    new_qty: r.qty,
                    updated_by: r.added_by,
                    updated_at: r.created_at,
                    details: r.remarks || r.reason || 'ສິນຄ້າເຂ້າໃໝ່',
                }));
                rows = [...rows, ...normalizedAdded].sort((a, b) =>
                    new Date(b.updated_at) - new Date(a.updated_at)
                );
            } else {
                let q = supabase.from('added_items_log').select('*').order('created_at', { ascending: false }).limit(5000);
                if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
                const { data: d, error } = await q;
                if (!error) rows = d || [];
            }
            setData(rows);
        } catch (e) {
            console.error('HQ fetch error:', e);
            setData([]);
        } finally {
            setIsLoading(false);
        }
    }, [activeTab, startDate, endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const activeTabConfig = TABS.find(t => t.id === activeTab);
    const dateLabel = startDate || endDate
        ? `📅 ${startDate || '...'} → ${endDate || '...'}`
        : '📅 ທຸກຊ່ວງວັນ';

    const content = (
        <div className="fixed inset-0 z-[200] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden" style={{ fontFamily: 'inherit' }}>

            {/* ===== STICKY HEADER ===== */}
            <div className="bg-white dark:bg-slate-900 border-b-2 border-slate-100 dark:border-slate-800 px-6 lg:px-10 pt-4 pb-0 shadow-sm flex-shrink-0">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
                    {/* Back + Title */}
                    <div className="flex items-center gap-4">
                        <button onClick={selectedBranch ? () => setSelectedBranch(null) : onBack}
                            className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all group">
                            <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                            <span className="text-base font-black">{selectedBranch ? '← ກັບ' : '← ໜ້າຫຼັກ'}</span>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center text-white shadow-lg"><BarChart3 size={24} /></div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                    HQ Command Center{selectedBranch && <span className="ml-2 text-orange-500">/ {selectedBranch}</span>}
                                </h1>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    {activeTabConfig?.label} · {isLoading ? '...' : `${data.length} ລາຍການ`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Date Controls only — no Export here */}
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={() => { setStartDate(todayStr()); setEndDate(todayStr()); }}
                            className="px-5 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-base font-black shadow-md hover:scale-105 active:scale-95 transition-all">
                            📅 ວັນນີ້
                        </button>
                        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-2.5 border border-slate-200 dark:border-slate-700">
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none" />
                            <span className="text-slate-400 font-bold">→</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                className="bg-transparent text-sm font-bold text-slate-600 dark:text-slate-300 outline-none" />
                        </div>
                        {(startDate || endDate) && (
                            <button onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="w-11 h-11 rounded-2xl bg-rose-100 dark:bg-rose-900/30 hover:bg-rose-200 flex items-center justify-center text-rose-500 transition-all" title="Clear">
                                <X size={18} />
                            </button>
                        )}
                        <button onClick={fetchData}
                            className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-all">
                            <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>

                {/* Tab Buttons */}
                <div className="flex gap-3 -mb-px">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSelectedBranch(null); }}
                            className={`flex items-center gap-3 px-7 py-4 rounded-t-2xl text-base font-black transition-all duration-200 border-b-4 ${activeTab === tab.id
                                ? `bg-gradient-to-r ${tab.color} text-white border-transparent shadow-lg`
                                : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                            <tab.icon size={20} /><span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ===== SCROLLABLE CONTENT ===== */}
            <div className="flex-1 overflow-y-auto px-6 lg:px-10 py-6 custom-scrollbar">
                {isLoading ? <LoadingSpinner /> : selectedBranch ? (
                    <BranchDetail
                        branch={selectedBranch}
                        activeTab={activeTab}
                        data={data}
                        onBack={() => setSelectedBranch(null)}
                        startDate={startDate}
                        endDate={endDate}
                    />
                ) : (
                    <div className="space-y-6">
                        {/* Summary Banner */}
                        <div className={`rounded-3xl bg-gradient-to-r ${activeTabConfig?.color} p-7 text-white shadow-xl`}>
                            <p className="text-xl font-bold opacity-80 mb-1">
                                {activeTab === 'requests' ? 'ຄຳຂໍ Store Request' : activeTab === 'edits' ? 'ການແກ້ໄຂສິນຄ້າ' : 'ສິນຄ້າເຂົ້າໃໝ່'} · ທຸກສາຂາ
                            </p>
                            <p className="text-8xl font-black leading-none">{data.length}</p>
                            <p className="text-white/70 font-bold mt-2 text-base">{dateLabel}</p>
                            {activeTab === 'requests' && (
                                <div className="flex gap-6 mt-5 pt-5 border-t border-white/20">
                                    {[
                                        { label: 'ລໍຖ້າ', val: data.filter(r => r.status === 'pending').length, icon: '⏳' },
                                        { label: 'ອານຸມັດ', val: data.filter(r => r.status === 'accepted' || r.status === 'approved').length, icon: '✅' },
                                        { label: 'ປະຕິເສດ', val: data.filter(r => r.status === 'rejected').length, icon: '❌' },
                                    ].map(s => (
                                        <div key={s.label}>
                                            <p className="text-3xl font-black">{s.icon} {s.val}</p>
                                            <p className="text-white/70 font-bold text-sm uppercase">{s.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Instruction */}
                        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700">
                            <span className="text-4xl">👇</span>
                            <p className="text-xl font-black text-amber-700 dark:text-amber-400">ກົດທີ່ຊື່ສາຂາ ເພື່ອເບິ່ງລາຍລະອຽດ ແລະ Export Excel</p>
                        </div>

                        {/* Branch Cards */}
                        <BranchGrid data={data} activeTab={activeTab} onSelectBranch={setSelectedBranch} />
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default HQCommandCenter;
