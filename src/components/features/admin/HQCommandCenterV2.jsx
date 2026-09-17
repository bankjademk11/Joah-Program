import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../utils/supabaseClient';
import ExcelJS from 'exceljs';
import {
    BarChart3, GitBranch, Edit3, PlusCircle,
    Loader2, ArrowLeft, Clock,
    AlertCircle, User, ChevronRight, ArrowLeftCircle, Search, RefreshCw,
    FileSpreadsheet, X, ChevronDown, Store, Filter,
    CheckCircle2, AlertTriangle, ShieldCheck, Check, Truck, Box
} from 'lucide-react';

import imgSvl from '../../../assets/SVLJoah.png';
import imgTll from '../../../assets/TLLimage.png';
import imgVx from '../../../assets/VX.png';
import imgPsn from '../../../assets/PSNimage.png';
import joahLogo from '../../../assets/Joah.jpeg';
import imgMgm from '../../../assets/Joah.jpeg'; // Placeholder — replace with Megamall photo

// ===================== CONSTANTS =====================
const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ', 'ເມກ້າມໍ', 'ໂພນຕ້ອງ', 'ເທຣນນິ້ງ (Training)'];

const BC = {
    'ຕະຫຼາດລາວ': { gr: 'bg-gradient-to-br from-orange-500 to-amber-500', grR: 'bg-gradient-to-r from-orange-500 to-amber-500', card: 'bg-orange-50 dark:bg-orange-900/20', bdr: 'border-orange-200 dark:border-orange-700', txt: 'text-orange-600 dark:text-orange-400' },
    'ສີວິໄລ': { gr: 'bg-gradient-to-br from-blue-500 to-indigo-600', grR: 'bg-gradient-to-r from-blue-500 to-indigo-600', card: 'bg-blue-50 dark:bg-blue-900/20', bdr: 'border-blue-200 dark:border-blue-700', txt: 'text-blue-600 dark:text-blue-400' },
    'ໂພນສີນວນ': { gr: 'bg-gradient-to-br from-emerald-500 to-teal-600', grR: 'bg-gradient-to-r from-emerald-500 to-teal-600', card: 'bg-emerald-50 dark:bg-emerald-900/20', bdr: 'border-emerald-200 dark:border-emerald-700', txt: 'text-emerald-600 dark:text-emerald-400' },
    'ວັງຊາຍ': { gr: 'bg-gradient-to-br from-purple-500 to-violet-600', grR: 'bg-gradient-to-r from-purple-500 to-violet-600', card: 'bg-purple-50 dark:bg-purple-900/20', bdr: 'border-purple-200 dark:border-purple-700', txt: 'text-purple-600 dark:text-purple-400' },
    'ເມກ້າມໍ': { gr: 'bg-gradient-to-br from-rose-500 to-pink-600', grR: 'bg-gradient-to-r from-rose-500 to-pink-600', card: 'bg-rose-50 dark:bg-rose-900/20', bdr: 'border-rose-200 dark:border-rose-700', txt: 'text-rose-600 dark:text-rose-400' },
    'ໂພນຕ້ອງ': { gr: 'bg-gradient-to-br from-teal-500 to-cyan-600', grR: 'bg-gradient-to-r from-teal-500 to-cyan-600', card: 'bg-teal-50 dark:bg-teal-900/20', bdr: 'border-teal-200 dark:border-teal-700', txt: 'text-teal-600 dark:text-teal-400' },
    'ເທຣນນິ້ງ (Training)': { gr: 'bg-gradient-to-br from-cyan-500 to-blue-600', grR: 'bg-gradient-to-r from-cyan-500 to-blue-600', card: 'bg-cyan-50 dark:bg-cyan-900/20', bdr: 'border-cyan-200 dark:border-cyan-700', txt: 'text-cyan-600 dark:text-cyan-400' },
};

const TABS = [

    { id: 'requests', label: 'ລາຍການສາງຕອບຮັບ Request', icon: GitBranch, color: 'from-orange-500 to-amber-500' },
    { id: 'store_edits', label: 'ໜ້າຮ້ານValidate', icon: Store, color: 'from-blue-500 to-cyan-500' },
    { id: 'edits', label: 'ປະຫວັດການເເກ້ໄຂStockຫຼັງສາງ', icon: Edit3, color: 'from-indigo-500 to-purple-500' },
    // { id: 'new', label: 'ສິນຄ້າເຂົ້າໃໝ່', icon: PlusCircle, color: 'from-emerald-500 to-teal-500' },
    { id: 'store_manual_edits', label: 'ປະຫວັດແກ້ໄຂໜ້າຮ້ານ', icon: Edit3, color: 'from-violet-500 to-purple-600' },
    { id: 'import_dc', label: 'ປະຫວັດການນຳເຂົ້າ DC', icon: FileSpreadsheet, color: 'from-pink-500 to-rose-500' },
    { id: 'import_sales', label: 'ປະຫວັດການນຳເຂົ້າ Sale', icon: FileSpreadsheet, color: 'from-fuchsia-500 to-pink-500' },
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

const fmtExcel = (ts) => (!ts ? '-' : new Date(ts).toLocaleString('en-GB'));

// Calculate duration between 2 timestamps in human readable Lao string
const calcDuration = (start, end) => {
    if (!start || !end) return null;
    const diffMs = new Date(end) - new Date(start);
    if (diffMs < 0) return '0 ວິ';
    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    if (days > 0) return `${days} ມື້ ${hours} ຊມ`;
    if (hours > 0) return `${hours} ຊມ ${mins} ນາທີ`;
    if (mins > 0) return `${mins} ນາທີ`;
    return `${secs} ວິ`;
};

// Calculate elapsed time from timestamp until now
const calcElapsedFromNow = (ts) => {
    if (!ts) return null;
    const diffMs = Date.now() - new Date(ts).getTime();
    if (diffMs < 0) return '0 ວິ';
    const totalSecs = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSecs / 86400);
    const hours = Math.floor((totalSecs % 86400) / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    if (days > 0) return `${days} ມື້ ${hours} ຊມ`;
    if (hours > 0) return `${hours} ຊມ`;
    return `${mins} ນາທີ`;
};

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
const exportToExcel = async (rows, activeTab, startDate, endDate, branchName, showDetailedTime = true) => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'HQ Command Center';
    workbook.created = new Date();

    const tabNames = { requests: 'Store Requests', edits: 'Edit Activity', new: 'New Arrivals', store_edits: 'Store History', store_manual_edits: 'Store Edit History', import_dc: 'DC Import History', import_sales: 'Sales Import History' };
    const ws = workbook.addWorksheet(tabNames[activeTab] || 'Export');

    const headerFill = { requests: 'FFF97316', edits: 'FF6366F1', new: 'FF10B981', store_edits: 'FF06B6D4', store_manual_edits: 'FF7C3AED', import_dc: 'FFEC4899', import_sales: 'FFD946EF' };
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
            { header: 'ຂໍ (Qty)', key: 'qty', width: 10 },
            { header: 'ສະຕ໋ອກ (Stock)', key: 'stock_qty', width: 14 },
            { header: 'ຄົງເຫຼືອ (Remain)', key: 'remain_qty', width: 16 },
            { header: 'ສະຖານະວົງຈອນ', key: 'lifecycle_status', width: 24 },
            { header: 'ຜູ້ Request (ໜ້າຮ້ານ)', key: 'request_by_name', width: 22 },
            { header: 'ID ຜູ້ຂໍ', key: 'request_by_id', width: 14 },
            { header: 'ເວລາ Request', key: 'created_at', width: 22 },
            { header: 'ສາງຕອບຮັບ/ສົ່ງ', key: 'accepted_by_name', width: 22 },
            { header: 'ID ສາງ', key: 'accepted_by_id', width: 14 },
            { header: 'ເວລາສາງຕອບຮັບ', key: 'updated_at', width: 22 },
            { header: 'ເວລາຕອບຮັບສາງ', key: 'wh_duration', width: 20 },
            { header: 'ໜ້າຮ້ານກວດຮັບເຄື່ອງ', key: 'confirmed_by_name', width: 22 },
            { header: 'ID ຜູ້ຮັບ', key: 'confirmed_by_id', width: 14 },
            { header: 'ເວລາກົດຮັບໜ້າຮ້ານ', key: 'confirmed_at', width: 22 },
            { header: 'ເວລາທັງໝົດ (Cycle Time)', key: 'cycle_time', width: 22 },
        ];
        rows.forEach((r, i) => {
            const isAcc = r.status === 'accepted' || r.status === 'approved';
            const isRej = r.status === 'rejected';
            const hasConfirmed = Boolean(r.store_confirmed_at);

            // Stock calculation
            const stockQty = r.stock_at_request ?? null;
            const requestedQty = r.qty ?? 0;
            const remainQty = (stockQty != null && isAcc) ? stockQty - requestedQty : null;

            const { name: reqName, empId: reqId } = parseUser(r.request_by);
            const { name: accName, empId: accId } = parseUser(r.accepted_by);
            const { name: confName, empId: confId } = parseUser(r.store_confirmed_by);

            let lifecycleText = 'ລໍຖ້າສາງຕອບຮັບ';
            if (isRej) lifecycleText = 'ສາງປະຕິເສດ';
            else if (isAcc && hasConfirmed) lifecycleText = '✅ ສຳເລັດສົມບູນ';
            else if (isAcc && !hasConfirmed) lifecycleText = '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ';

            const whDuration = (isAcc || isRej) ? calcDuration(r.created_at, r.updated_at) : '-';
            const totalCycle = hasConfirmed ? calcDuration(r.created_at, r.store_confirmed_at) : (isAcc ? `ຄ້າງ ${calcElapsedFromNow(r.updated_at)}` : '-');

            const row = ws.addRow({
                branch_id: r.branch_id,
                docNo: r.batch_id && r.batch_id.startsWith('REQ') ? r.batch_id : 'N/A',
                product_name: r.product_name || r.barcode,
                barcode: r.barcode,
                qty: requestedQty,
                stock_qty: stockQty != null ? stockQty : '-',
                remain_qty: remainQty != null ? remainQty : '-',
                lifecycle_status: lifecycleText,
                request_by_name: reqName, request_by_id: reqId || r.request_by_id || '-',
                created_at: fmtExcel(r.created_at),
                accepted_by_name: accName, accepted_by_id: accId || '-',
                updated_at: (isAcc || isRej) ? fmtExcel(r.updated_at) : '-',
                wh_duration: whDuration,
                confirmed_by_name: confName, confirmed_by_id: confId || '-',
                confirmed_at: hasConfirmed ? fmtExcel(r.store_confirmed_at) : '-',
                cycle_time: totalCycle,
            });
            const bg = (isAcc && hasConfirmed) ? 'FFD1FAE5' : (isAcc && !hasConfirmed) ? 'FFFFEDD5' : isRej ? 'FFFEE2E2' : 'FFFEFCE8';
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? bg : 'FFFFFFFF' } }; });
            row.getCell('lifecycle_status').font = { bold: true, color: { argb: (isAcc && hasConfirmed) ? 'FF065F46' : (isAcc && !hasConfirmed) ? 'FFC2410C' : isRej ? 'FF991B1B' : 'FF92400E' } };
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
    } else if (activeTab === 'store_edits' || activeTab === 'store_manual_edits') {
        ws.columns = [
            { header: 'ເລກບິນ (Bill ID)', key: 'bill_id', width: 22 },
            { header: 'ສາຂາ', key: 'branch_id', width: 18 },
            { header: 'ສິນຄ້າ', key: 'item_name', width: 35 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'Employee ID', key: 'updated_by_id', width: 16 },
            { header: 'ພະນັກງານ', key: 'updated_by_name', width: 22 },
            { header: 'ຈຳນວນ(ເກົ່າ → ໃໝ່)', key: 'qty_text', width: 20 },
            { header: 'Tag (ປະເພດ)', key: 'tag_text', width: 20 },
            { header: 'Shelf (ບ່ອນເກັບ)', key: 'shelf_text', width: 20 },
            { header: 'ກວດສອບການຮັບ (Audit)', key: 'audit_status', width: 22 },
            { header: 'Max (ຄວາມຈຸ)', key: 'max_text', width: 20 },
            { header: 'ເຫດຜົນ', key: 'details', width: 24 },
            ...(showDetailedTime ? [
                { header: 'ເວລາກົດຮັບ SKU', key: 'sku_start', width: 24 },
                { header: 'ບັນທຶກການສຳເລັດແຕ່ລະ SKU', key: 'updated_at', width: 24 },
                { header: 'ເວລາທີ່ໃຊ້ຂອງແຕ່ລະ SKU', key: 'sku_time', width: 24 },
                { header: 'ເວລາເລີ່ມບິນ', key: 'batch_start', width: 24 },
                { header: 'ເວລາສຳເລັດບິນ', key: 'batch_end', width: 24 },
                { header: 'ເວລາທັງບິນ', key: 'batch_time', width: 20 },
            ] : [
                { header: 'ເວລາບັນທຶກ', key: 'updated_at', width: 24 },
                { header: 'ເວລາທັງບິນ', key: 'batch_time', width: 20 },
            ]),
        ];

        // Share batch info for Excel export too
        const billMap = {};
        rows.forEach(r => {
            if (!r.bill_id) return;
            if (!billMap[r.bill_id]) billMap[r.bill_id] = {};
            if (r.batch_started_at && !billMap[r.bill_id].batch_started_at) billMap[r.bill_id].batch_started_at = r.batch_started_at;
            if (r.batch_ended_at && !billMap[r.bill_id].batch_ended_at) billMap[r.bill_id].batch_ended_at = r.batch_ended_at;
            if (r.batch_total_seconds && !billMap[r.bill_id].batch_total_seconds) billMap[r.bill_id].batch_total_seconds = r.batch_total_seconds;
        });

        const fmtSecs = (s) => {
            if (!s || s <= 0) return '-';
            if (s < 60) return `${s} ວິ`;
            const m = Math.floor(s / 60);
            const sec = s % 60;
            return sec > 0 ? `${m} ນາທີ ${sec} ວິ` : `${m} ນາທີ`;
        };

        rows.forEach((r, i) => {
            const { name: editName, empId: editId } = parseUser(r.updated_by);
            const billInfo = (r.bill_id && billMap[r.bill_id]) || {};
            const batchSecs = billInfo.batch_total_seconds || r.batch_total_seconds;
            const batchStartedAt = billInfo.batch_started_at || r.batch_started_at;
            const batchEndedAt = billInfo.batch_ended_at || r.batch_ended_at;

            const isPendingStore = !r.store_confirmed_at;
            const auditStatus = isPendingStore ? `⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ (${r.delay_str || ''})` : (r.is_backdated ? `🚨 ຮັບຍ້ອນຫຼັງ (${r.delay_str || ''})` : (r.delay_str ? `⚡ ປົກກະຕິ (${r.delay_str})` : 'ເຕີມສຳເລັດ'));
            const row = ws.addRow({
                bill_id: r.bill_id || '-',
                branch_id: r.branch_id,
                item_name: r.item_name || r.barcode,
                barcode: r.barcode,
                updated_by_id: editId || r.updated_by_id || '-',
                updated_by_name: editName,
                qty_text: `${r.old_qty ?? '-'} -> ${r.new_qty ?? '-'}`,
                tag_text: r.old_tag === r.new_tag ? (r.new_tag || '-') : `${r.old_tag || '-'} -> ${r.new_tag || '-'}`,
                shelf_text: r.old_shelf === r.new_shelf ? (r.new_shelf || '-') : `${r.old_shelf || '-'} -> ${r.new_shelf || '-'}`,
                audit_status: auditStatus,
                max_text: String(r.old_max) === String(r.new_max) ? (r.new_max ?? '-') : `${r.old_max ?? '-'} -> ${r.new_max ?? '-'}`,
                details: r.details || r.change_reason || 'Manual Update',
                updated_at: fmtExcel(r.updated_at || r.created_at),
                batch_time: fmtSecs(batchSecs),
                ...(showDetailedTime ? {
                    sku_start: r.process_started_at ? fmtExcel(r.process_started_at) : '-',
                    sku_time: fmtSecs(r.process_time_seconds),
                    batch_start: batchStartedAt ? fmtExcel(batchStartedAt) : '-',
                    batch_end: batchEndedAt ? fmtExcel(batchEndedAt) : '-',
                } : {}),
            });
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFECFEFF' : 'FFFFFFFF' } }; });
        });
    } else if (activeTab === 'import_dc' || activeTab === 'import_sales') {
        ws.columns = [
            { header: 'ສາຂາ', key: 'branch_id', width: 18 },
            { header: 'Barcode', key: 'barcode', width: 18 },
            { header: 'ຈຳນວນ', key: 'qty', width: 14 },
            { header: 'Employee ID', key: 'updated_by_id', width: 16 },
            { header: 'ຜູ້ນຳເຂົ້າ', key: 'updated_by_name', width: 22 },
            { header: 'ເວລາ', key: 'updated_at', width: 24 },
        ];
        rows.forEach((r, i) => {
            const { name: editName, empId: editId } = parseUser(r.updated_by);
            const row = ws.addRow({
                branch_id: r.branch_id,
                barcode: r.barcode,
                qty: r.qty,
                updated_by_id: editId || '-',
                updated_by_name: editName,
                updated_at: fmtExcel(r.updated_at)
            });
            row.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFFCE7F3' : 'FFFFFFFF' } }; });
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

    // Insert 5 rows at the top for the Logo and Header details
    ws.spliceRows(1, 0, [], [], [], [], []);

    // Fetch and add Joah Logo
    try {
        const res = await fetch(joahLogo);
        const buf = await res.arrayBuffer();
        const logoId = workbook.addImage({ buffer: buf, extension: 'jpeg' });
        // Place logo covering A1:B4
        ws.addImage(logoId, {
            tl: { col: 0, row: 0 },
            br: { col: 2, row: 4 },
            editAs: 'absolute'
        });
        ws.mergeCells('A1:B4');
    } catch (e) {
        console.error("Could not load logo for Excel", e);
    }

    // Add Title and Info
    const displayDateStr = startDate && endDate ? `${startDate} ຫາ ${endDate}` : startDate || endDate || 'ທັງໝົດ';

    ws.mergeCells('C1:F2');
    const titleCell = ws.getCell('C1');
    titleCell.value = `ລາຍງານ: ${tabNames[activeTab]}`;
    titleCell.font = { name: 'Phetsarath OT', size: 18, bold: true };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.mergeCells('C3:F3');
    const branchCell = ws.getCell('C3');
    branchCell.value = `ສາຂາ: ${branchName || 'ທັງໝົດ'}`;
    branchCell.font = { name: 'Phetsarath OT', size: 12, bold: true };
    branchCell.alignment = { vertical: 'middle', horizontal: 'left' };

    ws.mergeCells('C4:F4');
    const dateCell = ws.getCell('C4');
    dateCell.value = `ວັນທີ: ${displayDateStr}`;
    dateCell.font = { name: 'Phetsarath OT', size: 12 };
    dateCell.alignment = { vertical: 'middle', horizontal: 'left' };

    // Apply header style to row 6 (which is our data table header now)
    ws.getRow(6).eachCell(c => Object.assign(c, headerStyle));

    // Apply Phetsarath OT font + center alignment to ALL cells
    ws.eachRow((row, rowNumber) => {
        if (rowNumber === 6) row.height = 30;
        else if (rowNumber > 6) row.height = 22;

        row.eachCell(cell => {
            if (rowNumber >= 6) {
                cell.font = { ...cell.font, name: 'Phetsarath OT' };
                if (rowNumber > 6) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                }
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: { argb: 'FF94A3B8' } },
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

// 🌟 Full Request Lifecycle Badge (ຂໍ -> ສົ່ງ -> ຮັບ)
const RequestLifecycleBadge = ({ item }) => {
    const isAccepted = item.status === 'accepted' || item.status === 'approved';
    const isRejected = item.status === 'rejected';
    const isPending = item.status === 'pending';
    const hasStoreConfirmed = Boolean(item.store_confirmed_at);

    if (isRejected) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border border-rose-200">
                <span>❌</span>
                <span>ສາງປະຕິເສດ</span>
            </div>
        );
    }

    if (isPending) {
        const elapsed = calcElapsedFromNow(item.created_at);
        return (
            <div className="inline-flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700 border border-amber-200">
                    <span className="animate-pulse">⏳</span>
                    <span>ລໍຖ້າສາງຕອບຮັບ</span>
                </span>
                {elapsed && <span className="text-[10px] text-amber-600 font-mono text-center">ລໍຖ້າແລ້ວ {elapsed}</span>}
            </div>
        );
    }

    if (isAccepted && !hasStoreConfirmed) {
        // Warehouse sent, but Store hasn't confirmed yet! (SLA Warning)
        const elapsed = calcElapsedFromNow(item.updated_at || item.created_at);
        const diffMs = Date.now() - new Date(item.updated_at || item.created_at).getTime();
        const isVeryLate = diffMs > 3600 * 1000 * 4; // > 4 hours
        return (
            <div className="inline-flex flex-col gap-0.5">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${isVeryLate
                    ? 'bg-rose-100 text-rose-700 border-rose-300 animate-pulse'
                    : 'bg-orange-100 text-orange-700 border-orange-200'
                    }`}>
                    <AlertTriangle size={12} className={isVeryLate ? 'text-rose-600 animate-bounce' : 'text-orange-500'} />
                    <span>⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ</span>
                </span>
                <span className={`text-[10px] font-bold text-center ${isVeryLate ? 'text-rose-600 font-black' : 'text-orange-600'}`}>
                    {isVeryLate ? `🚨 ຄ້າງມາດົນ ${elapsed}` : `ສົ່ງມາແລ້ວ ${elapsed}`}
                </span>
            </div>
        );
    }

    if (isAccepted && hasStoreConfirmed) {
        const cycleTime = calcDuration(item.created_at, item.store_confirmed_at);
        return (
            <div className="inline-flex flex-col gap-0.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>✅ ສຳເລັດສົມບູນ</span>
                </span>
                {cycleTime && (
                    <span className="text-[10px] text-emerald-600 font-mono text-center">
                        ⏱️ ລວມ {cycleTime}
                    </span>
                )}
            </div>
        );
    }

    return <StatusBadge status={item.status} />;
};

// ===================== BRANCH OVERVIEW CARDS =====================
const BranchGrid = ({ data, activeTab, onSelectBranch }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {BRANCHES.map(branch => {
            const c = BC[branch];
            const rows = data.filter(r => r.branch_id === branch);
            let mainVal, mainLabel, subA, subB, subC, subD;

            if (activeTab === 'requests') {
                mainVal = rows.length; mainLabel = 'ຄຳຂໍທັງໝົດ';
                const pendingWH = rows.filter(r => r.status === 'pending').length;
                const pendingStore = rows.filter(r => (r.status === 'accepted' || r.status === 'approved') && !r.store_confirmed_at).length;
                const completed = rows.filter(r => (r.status === 'accepted' || r.status === 'approved') && r.store_confirmed_at).length;
                const rejected = rows.filter(r => r.status === 'rejected').length;
                subA = { val: pendingWH, label: 'ລໍຖ້າສາງ', color: 'text-amber-500', filterKey: 'pending' };
                subB = { val: pendingStore, label: '⚠️ ຄ້າງໜ້າຮ້ານ', color: pendingStore > 0 ? 'text-rose-500 font-black' : 'text-orange-500', filterKey: 'pending_store' };
                subC = { val: completed, label: '✅ ສຳເລັດ', color: 'text-emerald-600', filterKey: 'completed' };
                if (rejected > 0) {
                    subD = { val: rejected, label: '❌ ປະຕິເສດ', color: 'text-rose-500 font-black', filterKey: 'rejected' };
                }
            } else if (activeTab === 'edits') {
                mainVal = rows.length; mainLabel = 'ການແກ້ໄຂຄລັງ';
                subA = { val: new Set(rows.map(r => r.updated_by)).size, label: 'ຜູ້ແກ້ໄຂ', color: 'text-indigo-500' };
                subB = { val: new Set(rows.map(r => r.barcode)).size, label: 'ສິນຄ້າ', color: 'text-purple-600' };
                subC = null;
            } else if (activeTab === 'store_edits') {
                mainVal = rows.length; mainLabel = 'ການເຕີມເຄື່ອງ';
                const pendingStoreCount = rows.filter(r => !r.store_confirmed_at).length;
                const backdatedCount = rows.filter(r => r.is_backdated && r.store_confirmed_at).length;
                const normalCount = rows.filter(r => !r.is_backdated && r.store_confirmed_at).length;
                subA = { val: normalCount, label: '⚡ ປົກກະຕິ', color: 'text-emerald-600', filterKey: 'on_time' };
                subB = { val: backdatedCount, label: '🚨 ຮັບຍ້ອນຫຼັງ', color: backdatedCount > 0 ? 'text-rose-500 font-black' : 'text-purple-500', filterKey: 'backdated' };
                subC = { val: pendingStoreCount, label: '⚠️ ຄ້າງຮັບ', color: pendingStoreCount > 0 ? 'text-rose-500 font-black' : 'text-orange-500', filterKey: 'pending_store' };
                subD = { val: new Set(rows.map(r => r.updated_by)).size, label: 'ພະນັກງານ', color: 'text-blue-500' };
            } else if (activeTab === 'store_manual_edits') {
                mainVal = rows.length; mainLabel = 'ການແກ້ໄຂ Panel';
                const negativeCount = rows.filter(r => (r.old_qty ?? 0) < 0).length;
                subA = { val: new Set(rows.map(r => r.updated_by)).size, label: 'ຜູ້ແກ້ໄຂ', color: 'text-violet-500' };
                subB = { val: new Set(rows.map(r => r.barcode)).size, label: 'ສິນຄ້າ', color: 'text-purple-600' };
                subC = { val: negativeCount, label: '🚨 ແກ້ຕິດລົບ', color: negativeCount > 0 ? 'text-rose-500 font-black' : 'text-slate-400', filterKey: 'negative_stock' };
            } else if (activeTab === 'import_dc' || activeTab === 'import_sales') {
                mainVal = rows.length; mainLabel = activeTab === 'import_dc' ? 'ການນຳເຂົ້າ DC' : 'ການນຳເຂົ້າ Sale';
                subA = { val: new Set(rows.map(r => r.barcode)).size, label: 'ສິນຄ້າ', color: activeTab === 'import_dc' ? 'text-pink-500' : 'text-fuchsia-500' };
                subB = { val: new Set(rows.map(r => r.updated_by)).size, label: 'ຜູ້ນຳເຂົ້າ', color: 'text-rose-500' };
                subC = null;
            } else {
                mainVal = rows.length; mainLabel = 'ສິນຄ້າໃໝ່';
                subA = { val: new Set(rows.map(r => r.added_by)).size, label: 'ຜູ້ດຳເນີນ', color: 'text-teal-600' };
                subB = null;
                subC = null;
            }

            const hasImg = branch === 'ສີວິໄລ' || branch === 'ຕະຫຼາດລາວ' || branch === 'ວັງຊາຍ' || branch === 'ໂພນສີນວນ' || branch === 'ເມກ້າມໍ';
            return (
                <div key={branch} onClick={() => onSelectBranch(branch, 'all')}
                    className={`text-left p-7 rounded-3xl border-2 ${c.card} ${c.bdr} shadow-md hover:shadow-xl hover:scale-[1.025] active:scale-[0.99] transition-all duration-200 group relative overflow-hidden cursor-pointer`}>

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

                    {branch === 'ວັງຊາຍ' && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={imgVx} alt="Wang Xay Branch" className="w-full h-full object-cover object-center opacity-100 group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    )}

                    {branch === 'ໂພນສີນວນ' && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={imgPsn} alt="Phon Sinuan Branch" className="w-full h-full object-cover object-center opacity-100 group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    )}

                    {branch === 'ເມກ້າມໍ' && (
                        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                            <img src={imgMgm} alt="Megamall Branch" className="w-full h-full object-cover object-center opacity-100 group-hover:scale-110 transition-transform duration-700" />
                        </div>
                    )}

                    {/* Dark overlay for readability on image cards */}
                    {hasImg && (
                        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/40 via-black/50 to-black/70 pointer-events-none transition-opacity duration-500 group-hover:opacity-0" />
                    )}

                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-5">
                            <span className={`text-xl font-black ${hasImg ? 'text-white' : c.txt} drop-shadow-md`}>{branch}</span>
                            <div className={`w-10 h-10 rounded-xl ${c.gr} flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform`}><ChevronRight size={20} /></div>
                        </div>
                        <p className={`text-7xl font-black leading-none ${hasImg ? 'text-white' : c.txt} drop-shadow-xl tracking-tighter`}>{mainVal}</p>
                        <p className={`text-base font-bold ${hasImg ? 'text-white/90' : 'text-slate-500'} mt-1 drop-shadow-md`}>{mainLabel}</p>

                        <div className={`inline-flex flex-wrap gap-x-4 gap-y-2 mt-4 px-3 py-2 rounded-xl max-w-full ${hasImg ? 'bg-black/40 border border-white/20 backdrop-blur-md shadow-sm' : 'bg-white/60 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'}`}>
                            {[subA, subB, subC, subD].filter(Boolean).map((sub, idx) => (
                                <div
                                    key={idx}
                                    onClick={(e) => {
                                        if (sub.filterKey) {
                                            e.stopPropagation();
                                            onSelectBranch(branch, sub.filterKey);
                                        }
                                    }}
                                    className={`rounded-xl p-1.5 -m-1.5 transition-all ${sub.filterKey ? (hasImg ? 'hover:bg-white/20' : 'hover:bg-white dark:hover:bg-slate-700') + ' hover:scale-105 active:scale-95 cursor-pointer shadow-sm hover:shadow' : ''}`}
                                    title={sub.filterKey ? `ກົດເພື່ອເບິ່ງ: ${sub.label}` : undefined}
                                >
                                    <p className={`text-2xl font-black ${hasImg ? (sub.color.includes('rose') ? 'text-rose-400' : sub.color.includes('amber') || sub.color.includes('orange') ? 'text-amber-400' : sub.color.includes('emerald') ? 'text-emerald-400' : 'text-white') : sub.color} drop-shadow-sm leading-none`}>{sub.val}</p>
                                    <p className={`text-[10px] font-bold ${hasImg ? 'text-white/90' : 'text-slate-500'} mt-1.5 uppercase tracking-wider`}>{sub.label}</p>
                                </div>
                            ))}
                        </div>
                        <p className={`text-sm font-bold mt-4 transition-colors ${hasImg ? 'text-white/70 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                            👆 ກົດເພື່ອເບິ່ງລາຍລະອຽດ
                        </p>
                    </div>
                </div>
            );
        })}
    </div>
);

// ===================== BRANCH DETAIL =====================
const BranchDetail = ({ branch, activeTab, data, onBack, startDate, endDate, initialStatusFilter = 'all' }) => {
    const c = BC[branch] || {
        gr: 'bg-gradient-to-br from-slate-700 to-slate-900',
        grR: 'bg-gradient-to-r from-slate-700 to-slate-900',
        card: 'bg-slate-50 dark:bg-slate-900/20',
        bdr: 'border-slate-300 dark:border-slate-700',
        txt: 'text-slate-700 dark:text-slate-300'
    };
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState(initialStatusFilter || 'all');
    const [columnFilters, setColumnFilters] = useState({});
    const [openFilterCol, setOpenFilterCol] = useState(null);
    const [page, setPage] = useState(0);
    const PAGE_SIZE = 100;
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [showDetailedTime, setShowDetailedTime] = useState(false); // Toggle for detailed timing columns
    const exportRef = useRef(null);
    const tableHeaderRef = useRef(null);

    // Reset filter when branch or activeTab changes, respecting initialStatusFilter if provided
    useEffect(() => { setStatusFilter(initialStatusFilter || 'all'); setSearch(''); setPage(0); setColumnFilters({}); setOpenFilterCol(null); }, [branch, activeTab, initialStatusFilter]);
    useEffect(() => { setPage(0); }, [search, statusFilter, columnFilters]);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false);
            if (tableHeaderRef.current && !tableHeaderRef.current.contains(e.target)) setOpenFilterCol(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const getRowValues = (r, activeTab, branch) => {
        const showBranchCol = branch === 'ທັງໝົດ' || branch === 'All';

        let result = [];
        if (activeTab === 'requests') {
            const isAcc = r.status === 'accepted' || r.status === 'approved';
            const isRej = r.status === 'rejected';
            const hasConfirmed = Boolean(r.store_confirmed_at);
            let lifecycleStr = 'ລໍຖ້າສາງ';
            if (isRej) lifecycleStr = 'ສາງປະຕິເສດ';
            else if (isAcc && hasConfirmed) lifecycleStr = '✅ ສຳເລັດສົມບູນ';
            else if (isAcc && !hasConfirmed) lifecycleStr = '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ';

            result = [
                '',
                r.batch_id && r.batch_id.startsWith('REQ') ? r.batch_id : 'N/A',
                (r.product_name || r.item_name || '') + ' ' + (r.barcode || ''),
                String(r.qty ?? 0),
                String(r.stock_at_request ?? '-'),
                r.stock_at_request != null ? String(r.stock_at_request - (r.qty ?? 0)) : '-',
                r.request_by || '',
                r.accepted_by || '',
                r.store_confirmed_by || (hasConfirmed ? 'ໜ້າຮ້ານຮັບແລ້ວ' : (isAcc ? '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ' : '-')),
                lifecycleStr
            ];
        } else if (activeTab === 'store_edits') {
            const isPendingStore = !r.store_confirmed_at;
            const auditText = isPendingStore ? `⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ (${r.delay_str || ''})` : (r.is_backdated ? `🚨 ຮັບຍ້ອນຫຼັງ (${r.delay_str || ''})` : (r.delay_str ? `⚡ ປົກກະຕິ (${r.delay_str})` : 'ເຕີມສຳເລັດ'));
            result = [
                '',
                r.bill_id || '-',
                (r.item_name || '') + ' ' + (r.barcode || ''),
                r.updated_by || '',
                String((r.old_qty ?? 0) + ' ' + (r.new_qty ?? 0)),
                String(r.old_shelf || '-'),
                auditText,
                r.details || r.change_reason || 'Manual Update',
                ...(showDetailedTime ? [
                    r.process_started_at ? fmt(r.process_started_at) : '',
                    fmt(r.updated_at || r.created_at),
                    String(r.process_time_seconds || ''),
                    r.batch_started_at ? fmt(r.batch_started_at) : '',
                    r.batch_ended_at ? fmt(r.batch_ended_at) : '',
                    String(r.batch_total_seconds || '')
                ] : [
                    fmt(r.updated_at || r.created_at),
                    String(r.batch_total_seconds || '')
                ])
            ];
        } else if (activeTab === 'store_manual_edits') {
            result = [
                '',
                r.bill_id || '-',
                (r.item_name || '') + ' ' + (r.barcode || ''),
                r.updated_by || '',
                String((r.old_qty ?? 0) + ' ' + (r.new_qty ?? 0)),
                String((r.old_tag || '-') + ' ' + (r.new_tag || '-')),
                String((r.old_shelf || '-') + ' ' + (r.new_shelf || '-')),
                String((r.old_max ?? '-') + ' ' + (r.new_max ?? '-')),
                r.details || r.change_reason || 'Manual Update',
                ...(showDetailedTime ? [
                    r.process_started_at ? fmt(r.process_started_at) : '',
                    String(r.process_time_seconds || ''),
                    r.batch_started_at ? fmt(r.batch_started_at) : ''
                ] : []),
                String(r.batch_total_seconds || ''),
                ...(showDetailedTime ? [
                    r.batch_ended_at ? fmt(r.batch_ended_at) : '',
                    fmt(r.updated_at)
                ] : [])
            ];
        } else if (activeTab === 'edits') {
            result = [
                '',
                (r.item_name || '') + ' ' + (r.barcode || ''),
                r.updated_by || '',
                String((r.new_qty ?? 0) - (r.old_qty ?? 0)),
                String(r.old_qty ?? ''),
                String(r.new_qty ?? ''),
                r.details || '',
                fmt(r.updated_at)
            ];
        } else if (activeTab === 'import_dc' || activeTab === 'import_sales') {
            result = [
                '',
                r.barcode || '-',
                r.updated_by || '',
                String(r.qty ?? 0),
                r.details || '',
                fmt(r.updated_at)
            ];
        } else {
            result = [
                '',
                (r.item_name || '') + ' ' + (r.barcode || ''),
                r.added_by || '',
                String(r.qty ?? ''),
                r.remarks || r.reason || '',
                fmt(r.created_at)
            ];
        }

        if (showBranchCol) {
            result.splice(1, 0, r.branch_id || '');
        }
        return result;
    };

    const branchData = (branch === 'ທັງໝົດ' || branch === 'All') ? data : data.filter(r => r.branch_id === branch);

    const columnUniqueValues = useMemo(() => {
        const unique = {};
        branchData.forEach(r => {
            const rowValues = getRowValues(r, activeTab, branch);
            rowValues.forEach((val, idx) => {
                if (idx > 0) { // skip index 0 ('#')
                    if (!unique[idx]) unique[idx] = new Set();
                    const strVal = String(val).trim();
                    if (strVal && strVal !== '-' && strVal !== '0') {
                        unique[idx].add(strVal);
                    }
                }
            });
        });
        const result = {};
        for (const idx in unique) {
            result[idx] = Array.from(unique[idx]).sort((a, b) => a.localeCompare(b, 'lo-LA'));
        }
        return result;
    }, [branchData, activeTab, showDetailedTime]);

    // Build a map: bill_id -> batch timing info (from whichever row has it)
    const billSummaryMap = useMemo(() => {
        const map = {};
        branchData.forEach(r => {
            if (!r.bill_id) return;
            if (!map[r.bill_id]) map[r.bill_id] = {};
            // Take any non-null value found in any row for this bill
            if (r.batch_started_at && !map[r.bill_id].batch_started_at)
                map[r.bill_id].batch_started_at = r.batch_started_at;
            if (r.batch_ended_at && !map[r.bill_id].batch_ended_at)
                map[r.bill_id].batch_ended_at = r.batch_ended_at;
            if (r.batch_total_seconds && !map[r.bill_id].batch_total_seconds)
                map[r.bill_id].batch_total_seconds = r.batch_total_seconds;
        });
        return map;
    }, [branchData]);

    const filtered = branchData.filter(r => {
        // Status filter (requests tab)
        if (activeTab === 'requests' && statusFilter !== 'all') {
            const isAcc = r.status === 'accepted' || r.status === 'approved';
            const isRej = r.status === 'rejected';
            const isPend = r.status === 'pending';
            const hasConfirmed = Boolean(r.store_confirmed_at);

            if ((statusFilter === 'pending' || statusFilter === 'pending_wh') && !isPend) return false;
            if (statusFilter === 'pending_store' && (!isAcc || hasConfirmed)) return false;
            if (statusFilter === 'completed' && (!isAcc || !hasConfirmed)) return false;
            if (statusFilter === 'rejected' && !isRej) return false;
        }

        // Status filter (store_edits tab)
        if (activeTab === 'store_edits' && statusFilter !== 'all') {
            const isPendingStore = !r.store_confirmed_at;
            if (statusFilter === 'pending_store' && !isPendingStore) return false;
            if (statusFilter === 'on_time' && (isPendingStore || r.is_backdated)) return false;
            if (statusFilter === 'backdated' && (isPendingStore || !r.is_backdated)) return false;
        }

        // Status filter (store_manual_edits tab)
        if (activeTab === 'store_manual_edits' && statusFilter !== 'all') {
            const isNegative = (r.old_qty ?? 0) < 0;
            if (statusFilter === 'negative_stock' && !isNegative) return false;
            if (statusFilter === 'normal_stock' && isNegative) return false;
        }

        // Column filters (Excel-like Checkboxes)
        if (Object.keys(columnFilters).length > 0) {
            const rowValues = getRowValues(r, activeTab, branch);
            for (const [colIndexStr, selectedVals] of Object.entries(columnFilters)) {
                if (!selectedVals || selectedVals.length === 0) continue; // undefined or empty array means all selected (no filter)
                const colIndex = parseInt(colIndexStr);
                const cellText = String(rowValues[colIndex] || '').trim();

                if (selectedVals.includes('__NEGATIVE__')) {
                    const numVal = parseFloat(cellText.replace(/,/g, ''));
                    if (isNaN(numVal) || numVal >= 0) {
                        return false;
                    }
                    continue; // matches negative
                }

                if (!selectedVals.includes(cellText)) {
                    return false;
                }
            }
        }

        return true;
    });
    if (activeTab === 'requests' || activeTab === 'store_edits') {
        filtered.sort((a, b) => {
            const aIsPendingStore = (activeTab === 'store_edits' || a.status === 'accepted' || a.status === 'approved') && !a.store_confirmed_at;
            const bIsPendingStore = (activeTab === 'store_edits' || b.status === 'accepted' || b.status === 'approved') && !b.store_confirmed_at;
            if (aIsPendingStore && !bIsPendingStore) return 1;
            if (!aIsPendingStore && bIsPendingStore) return -1;
            const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
            const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
            return timeB - timeA;
        });
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paginatedData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const showBranchCol = branch === 'ທັງໝົດ' || branch === 'All';

    // Columns visible depends on showDetailedTime toggle (for store_edits)
    const baseHeaders =
        activeTab === 'requests' ? [
            '#', 'ເລກທີບິນ', 'ສິນຄ້າ', 'ຂໍ', 'ສະຕ໋ອກ', 'ຄົງເຫຼືອ',
            '1. ຜູ້ Request (ໜ້າຮ້ານ)', '2. ສາງຕອບຮັບ (Warehouse)', '3. ໜ້າຮ້ານກວດຮັບ (Receipt)',
            'ສະຖານະວົງຈອນ'
        ] :
            activeTab === 'store_edits' ? [
                '#', 'ເລກບິນ', 'ສິນຄ້າ', 'ພະນັກງານກົດຮັບ', 'ຈຳນວນ(ເກົ່າ→ໃໝ່)',
                'Shelf (ບ່ອນເກັບ)', 'ກວດສອບການຮັບ (Audit)', 'ເຫດຜົນ',
                ...(showDetailedTime ? [
                    'ເວລາກົດຮັບ SKU', 'ບັນທຶກการສຳເລັດແຕ່ລະ SKU', 'ເວລາທີ່ໃຊ້ຂອງແຕ່ລະ SKU',
                    'ເວລາເລີ່ມບິນ', 'ເວລາສຳເລັດບິນ', 'ເວລາທັງບິນ'
                ] : ['ເວລາບັນທຶກ', 'ເວລາທັງບິນ'])
            ] :
                activeTab === 'store_manual_edits' ? [
                    '#', 'ເລກບິນ', 'ສິນຄ້າ', 'ພະນັກງານ', 'ຈຳນວນ(ເກົ່າ→ໃໝ່)',
                    'Tag (ເກົ່າ→ໃໝ່)', 'Shelf (ເກົ່າ→ໃໝ່)', 'Max Qty (ເກົ່າ→ໃໝ່)', 'ເຫດຜົນ',
                    ...(showDetailedTime ? [
                        'ເວລາກົດຮັບ SKU', 'ບັນທຶກการສຳເລັດແຕ່ລະ SKU', 'ເວລາທີ່ໃຊ້ຂອງແຕ່ລະ SKU',
                        'ເວລາເລີ່ມບິນ', 'ເວລາສຳເລັດບິນ', 'ເວລາທັງບິນ'
                    ] : ['ເວລາບັນທຶກ', 'ເວລາທັງບິນ']),
                ] :
                    (activeTab === 'import_dc' || activeTab === 'import_sales') ? ['#', 'Barcode', 'ຜູ້ນຳເຂົ້າ', 'ຈຳນວນ', 'ເຫດຜົນ', 'ເວລາ'] :
                        activeTab === 'edits' ? ['#', 'ສິນຄ້າ', 'ຜູ້ແກ້ໄຂ', 'ການປ່ຽນແປງ', 'ສະຕ໋ອກ (ກ່ອນ)', 'ຄົງເຫຼືອ (ຫຼັງ)', 'ເຫດຜົນ', 'ເວລາ'] :
                            ['#', 'ສິນຄ້າ', 'ຜູ້ດຳເນີນ', 'ຈຳນວນ', 'ເຫດຜົນ', 'ເວລາ'];

    const headers = showBranchCol ? [baseHeaders[0], 'ສາຂາ', ...baseHeaders.slice(1)] : baseHeaders;

    const pendingWHCount = branchData.filter(r => r.status === 'pending').length;
    const pendingStoreCount = branchData.filter(r => (r.status === 'accepted' || r.status === 'approved') && !r.store_confirmed_at).length;
    const completedCount = branchData.filter(r => (r.status === 'accepted' || r.status === 'approved') && r.store_confirmed_at).length;
    const rejectedCount = branchData.filter(r => r.status === 'rejected').length;

    const pendingStoreEditCount = branchData.filter(r => !r.store_confirmed_at).length;
    const backdatedCount = branchData.filter(r => r.is_backdated && r.store_confirmed_at).length;
    const onTimeCount = branchData.filter(r => !r.is_backdated && r.store_confirmed_at).length;

    const negativeStockEdits = branchData.filter(r => (r.old_qty ?? 0) < 0).length;
    const normalStockEdits = branchData.length - negativeStockEdits;

    const reqSummary = activeTab === 'requests' ? [
        { label: 'ທັງໝົດ', val: branchData.length, key: 'all', cls: 'bg-white/20', active: 'bg-white/40 ring-2 ring-white' },
        { label: 'ລໍຖ້າສາງ', val: pendingWHCount, key: 'pending', cls: 'bg-amber-400/30', active: 'bg-amber-400/60 ring-2 ring-amber-300' },
        { label: '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ', val: pendingStoreCount, key: 'pending_store', cls: pendingStoreCount > 0 ? 'bg-orange-400/50 animate-pulse' : 'bg-orange-400/30', active: 'bg-orange-500/70 ring-2 ring-orange-300' },
        { label: '✅ ຮັບເຄື່ອງແລ້ວ', val: completedCount, key: 'completed', cls: 'bg-emerald-400/30', active: 'bg-emerald-400/60 ring-2 ring-emerald-300' },
        { label: 'ປະຕິເສດ', val: rejectedCount, key: 'rejected', cls: 'bg-rose-400/30', active: 'bg-rose-400/60 ring-2 ring-rose-300' },
    ] : activeTab === 'store_edits' ? [
        { label: 'ທັງໝົດ', val: branchData.length, key: 'all', cls: 'bg-white/20', active: 'bg-white/40 ring-2 ring-white' },
        { label: '⚡ ຮັບປົກກະຕິ', val: onTimeCount, key: 'on_time', cls: 'bg-emerald-400/30', active: 'bg-emerald-400/60 ring-2 ring-emerald-300' },
        { label: '🚨 ຮັບຍ້ອນຫຼັງ (>12ຊມ)', val: backdatedCount, key: 'backdated', cls: backdatedCount > 0 ? 'bg-rose-500/40 animate-pulse' : 'bg-purple-400/30', active: 'bg-rose-500/70 ring-2 ring-rose-300' },
        { label: '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ', val: pendingStoreEditCount, key: 'pending_store', cls: pendingStoreEditCount > 0 ? 'bg-orange-400/50 animate-pulse' : 'bg-orange-400/30', active: 'bg-orange-500/70 ring-2 ring-orange-300' },
    ] : activeTab === 'store_manual_edits' ? [
        { label: 'ທັງໝົດ', val: branchData.length, key: 'all', cls: 'bg-white/20', active: 'bg-white/40 ring-2 ring-white' },
        { label: 'ສະຕ໋ອກປົກກະຕິ', val: normalStockEdits, key: 'normal_stock', cls: 'bg-emerald-400/30', active: 'bg-emerald-400/60 ring-2 ring-emerald-300' },
        { label: '🚨 ແກ້ສະຕ໋ອກຕິດລົບ', val: negativeStockEdits, key: 'negative_stock', cls: negativeStockEdits > 0 ? 'bg-rose-500/40 animate-pulse' : 'bg-purple-400/30', active: 'bg-rose-500/70 ring-2 ring-rose-300' },
    ] : [];

    // Export: 'dated' uses current filtered (date-filtered) data, 'all' uses all branch data
    const handleExport = async (mode) => {
        setShowExportMenu(false);
        setIsExporting(true);
        try {
            const exportRows = mode === 'dated' ? filtered : branchData;
            const s = mode === 'dated' ? startDate : '';
            const e = mode === 'dated' ? endDate : '';
            await exportToExcel(exportRows, activeTab, s, e, branch, showDetailedTime);
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

            const hasConfirmed = Boolean(r.store_confirmed_at);
            const whDuration = (isAccepted || isRejected) ? calcDuration(r.created_at, r.updated_at) : null;
            const cycleTime = hasConfirmed ? calcDuration(r.created_at, r.store_confirmed_at) : null;

            return (
                <tr key={i} className={`transition-colors ${isAccepted && hasConfirmed ? 'bg-emerald-50/30 dark:bg-emerald-950/20' :
                    isAccepted && !hasConfirmed ? 'bg-amber-50/40 dark:bg-amber-950/20' :
                        isRejected ? 'bg-rose-50/30 dark:bg-rose-950/20' : 'hover:bg-slate-50/40 dark:hover:bg-slate-800/40'
                    }`}>
                    <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>

                    {showBranchCol && (
                        <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-700 border border-orange-200">
                                {r.branch_id}
                            </span>
                        </td>
                    )}

                    {/* DOC No */}
                    <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black tracking-widest bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
                            DOC: {docNo}
                        </span>
                    </td>

                    {/* Product */}
                    <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Box size={16} className="text-slate-400 shrink-0" />
                            <span className="text-base font-bold text-slate-800 dark:text-slate-100">{r.product_name || r.barcode || '-'}</span>
                        </div>
                        <p className="text-sm text-slate-400 font-mono ml-6">{r.barcode}</p>
                    </td>

                    {/* ขอ (Qty) */}
                    <td className="px-3 py-4 text-center">
                        <span className="text-2xl font-black text-blue-600 dark:text-blue-400">{requestedQty}</span>
                    </td>

                    {/* สต็อกในระบบ */}
                    <td className="px-3 py-4 text-center">
                        <span className={`text-2xl ${stockColor}`}>
                            {stockQty != null ? stockQty : <span className="text-sm text-slate-300">-</span>}
                        </span>
                    </td>

                    {/* คงเหลือหลังจ่าย */}
                    <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-2xl ${remainColor}`}>
                                {remainQty != null ? remainQty : <span className="text-sm text-slate-300">-</span>}
                            </span>
                            {remainQty != null && remainQty < 0 && (
                                <span className="text-[9px] font-black text-rose-500 uppercase">ບໍ່ພໍ!</span>
                            )}
                        </div>
                    </td>

                    {/* 1. ຜູ້ Request (ໜ້າຮ້ານ) */}
                    <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                            <UserCell value={r.request_by} iconColor="text-blue-500" />
                            <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                                <Clock size={11} className="text-slate-400" /> {fmt(r.created_at)}
                            </p>
                        </div>
                    </td>

                    {/* 2. ສາງຕອບຮັບ (Warehouse) */}
                    <td className="px-5 py-4">
                        {r.accepted_by ? (() => {
                            const bgCls = isAccepted ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60';
                            const { name, empId } = parseUser(r.accepted_by);
                            return (
                                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border ${bgCls}`}>
                                    <div className="flex items-center gap-1.5">
                                        <Truck size={14} className={isAccepted ? 'text-emerald-600' : 'text-rose-500'} />
                                        <span className={`text-sm font-black ${isAccepted ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}`}>{name}</span>
                                    </div>
                                    {empId && (
                                        <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-black font-mono w-fit ${isAccepted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{empId}</span>
                                    )}
                                    <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 font-mono">
                                        <Clock size={11} /> {fmt(r.updated_at)}
                                    </p>
                                    {whDuration && (
                                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                                            ⏱️ ສາງໃຊ້ເວລາ: {whDuration}
                                        </span>
                                    )}
                                </div>
                            );
                        })() : (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-dashed border-amber-300 dark:border-amber-800">
                                <span className="animate-spin text-sm">⏳</span>
                                <span>ລໍຖ້າສາງຕອບຮັບ</span>
                            </div>
                        )}
                    </td>

                    {/* 3. ໜ້າຮ້ານກວດຮັບ (Store Receipt) */}
                    <td className="px-5 py-4">
                        {hasConfirmed ? (() => {
                            const { name, empId } = parseUser(r.store_confirmed_by);
                            return (
                                <div className="flex flex-col gap-1 p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60">
                                    <div className="flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-teal-600 dark:text-teal-400" />
                                        <span className="text-sm font-black text-teal-800 dark:text-teal-200">{name || 'ພະນັກງານໜ້າຮ້ານ'}</span>
                                    </div>
                                    {empId && (
                                        <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-black font-mono w-fit bg-teal-100 text-teal-800">{empId}</span>
                                    )}
                                    <p className="text-[11px] text-teal-700 dark:text-teal-300 flex items-center gap-1 mt-0.5 font-mono">
                                        <Check size={11} className="text-teal-600" /> {fmt(r.store_confirmed_at)}
                                    </p>
                                    {cycleTime && (
                                        <span className="text-[10px] text-teal-800 dark:text-teal-300 font-black">
                                            🚀 Cycle: {cycleTime}
                                        </span>
                                    )}
                                </div>
                            );
                        })() : isAccepted ? (() => {
                            const elapsed = calcElapsedFromNow(r.updated_at || r.created_at);
                            const diffMs = Date.now() - new Date(r.updated_at || r.created_at).getTime();
                            const isVeryLate = diffMs > 3600 * 1000 * 4;
                            return (
                                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border ${isVeryLate
                                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                                    : 'bg-orange-50 dark:bg-orange-950/40 border-orange-200 dark:border-orange-800'
                                    }`}>
                                    <div className="flex items-center gap-1.5">
                                        <AlertTriangle size={14} className={isVeryLate ? 'text-rose-600 animate-bounce' : 'text-orange-500'} />
                                        <span className={`text-xs font-black ${isVeryLate ? 'text-rose-700 dark:text-rose-300' : 'text-orange-700 dark:text-orange-300'}`}>
                                            {isVeryLate ? '🚨 ຄ້າງຮັບດ່ວນ!' : '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ'}
                                        </span>
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-500">
                                        ຄ້າງມາແລ້ວ: {elapsed}
                                    </span>
                                </div>
                            );
                        })() : (
                            <span className="text-slate-300 text-sm">-</span>
                        )}
                    </td>

                    {/* ສະຖານະວົງຈອນ */}
                    <td className="px-5 py-4 whitespace-nowrap">
                        <RequestLifecycleBadge item={r} />
                    </td>
                </tr>
            );
        }
        if (activeTab === 'store_edits' || activeTab === 'store_manual_edits') {
            const fmtSecs = (s) => {
                if (!s || s <= 0) return null;
                if (s < 60) return `${s} ວິ`;
                const m = Math.floor(s / 60);
                const sec = s % 60;
                return sec > 0 ? `${m} ນາທີ ${sec} ວິ` : `${m} ນາທີ`;
            };

            // Use shared bill summary for ALL rows in the same bill
            const billInfo = (r.bill_id && billSummaryMap[r.bill_id]) || {};
            const batchSecs = billInfo.batch_total_seconds || r.batch_total_seconds;
            const batchStartedAt = billInfo.batch_started_at || r.batch_started_at;
            const batchEndedAt = billInfo.batch_ended_at || r.batch_ended_at;

            const skuSecs = r.process_time_seconds;
            const speedLabel = batchSecs > 0
                ? batchSecs < 300 ? { txt: '⚡ ໄວ', cls: 'bg-emerald-100 text-emerald-700' }
                    : batchSecs < 900 ? { txt: '⏳ ປົກກະຕິ', cls: 'bg-amber-100 text-amber-700' }
                        : { txt: '🐢 ຊ້າ', cls: 'bg-rose-100 text-rose-700' }
                : null;

            return (
                <tr key={i} className="hover:bg-cyan-50/30 transition-colors">
                    <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>

                    {showBranchCol && (
                        <td className="px-4 py-3 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                                {r.branch_id}
                            </span>
                        </td>
                    )}

                    {/* Bill ID */}
                    <td className="px-4 py-3">
                        {r.bill_id ? (
                            <span className="inline-block px-2 py-1 rounded-lg text-[10px] font-black tracking-widest bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/50 max-w-[120px] truncate" title={r.bill_id}>
                                {r.bill_id}
                            </span>
                        ) : <span className="text-slate-300 text-sm">-</span>}
                    </td>

                    {/* Product */}
                    <td className="px-4 py-3">
                        <div className="flex flex-col">
                            <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight">{r.item_name || r.barcode || '-'}</p>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{r.barcode}</p>
                        </div>
                    </td>

                    {/* Employee */}
                    <td className="px-4 py-3">
                        <UserCell value={r.updated_by} iconColor="text-blue-400" />
                    </td>

                    {/* QTY */}
                    <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                            <div className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-xl ${(r.old_qty ?? 0) < 0 ? 'bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                                <span className={`text-xs font-bold ${(r.old_qty ?? 0) < 0 ? 'text-rose-500' : 'text-slate-400'}`}>{r.old_qty ?? '-'}</span>
                                <span className="text-slate-300">→</span>
                                <span className="text-base font-black text-blue-600">{r.new_qty ?? '-'}</span>
                            </div>
                            {activeTab === 'store_manual_edits' && (r.old_qty ?? 0) < 0 && (
                                <span className="text-[9px] font-black text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/50 px-1.5 py-0.5 rounded animate-pulse uppercase tracking-wider">
                                    🚨 ແກ້ສະຕ໋ອກຕິດລົບ
                                </span>
                            )}
                        </div>
                    </td>

                    {/* SHELF */}
                    <td className="px-4 py-3 text-center">
                        {(() => {
                            const oldV = r.old_shelf || '-';
                            const newV = r.new_shelf || '-';
                            const changed = oldV !== newV;
                            return changed ? (
                                <div className="flex items-center justify-center gap-1 bg-amber-50 dark:bg-amber-900/20 py-1.5 px-2 rounded-xl">
                                    <span className="text-xs font-bold text-slate-400 line-through">{oldV}</span>
                                    <span className="text-amber-400 text-xs">→</span>
                                    <span className="text-xs font-black text-amber-700 dark:text-amber-300">{newV}</span>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 py-1.5 px-3 rounded-xl">{newV}</span>
                            );
                        })()}
                    </td>

                    {/* 🌟 ກວດສອບການຮັບ (Audit Status) for store_edits only */}
                    {activeTab === 'store_edits' && (() => {
                        const isPendingStore = !r.store_confirmed_at;
                        return (
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                {isPendingStore ? (
                                    <div className="inline-flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 animate-pulse">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-orange-700 dark:text-orange-300 uppercase">
                                            <AlertTriangle size={11} className="text-orange-500" />
                                            <span>⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ</span>
                                        </span>
                                        {r.delay_str && (
                                            <span className="text-[9px] font-mono text-orange-600 dark:text-orange-400 font-bold">
                                                ຄ້າງມາ {r.delay_str}
                                            </span>
                                        )}
                                    </div>
                                ) : r.is_backdated ? (
                                    <div className="inline-flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-rose-700 dark:text-rose-300 uppercase">
                                            <AlertTriangle size={11} className="text-rose-500 animate-pulse" />
                                            <span>🚨 ຮັບຍ້ອນຫຼັງ</span>
                                        </span>
                                        {r.delay_str && (
                                            <span className="text-[9px] font-mono text-rose-600 dark:text-rose-400 font-bold">
                                                ຊ້າໄປ {r.delay_str}
                                            </span>
                                        )}
                                    </div>
                                ) : r.delay_str ? (
                                    <div className="inline-flex flex-col items-center gap-0.5 p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase">
                                            <CheckCircle2 size={11} className="text-emerald-500" />
                                            <span>⚡ ຮັບປົກກະຕິ</span>
                                        </span>
                                        <span className="text-[9px] font-mono text-emerald-600 dark:text-emerald-400">
                                            ໃຊ້ເວລາ {r.delay_str}
                                        </span>
                                    </div>
                                ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                        <span>📦 ເຕີມສຳເລັດ</span>
                                    </span>
                                )}
                            </td>
                        );
                    })()}

                    {/* TAG for manual edits only */}
                    {activeTab === 'store_manual_edits' && (
                        <td className="px-4 py-3 text-center">
                            {(() => {
                                const oldV = r.old_tag || '-';
                                const newV = r.new_tag || '-';
                                const changed = oldV !== newV;
                                return changed ? (
                                    <div className="flex items-center justify-center gap-1 bg-amber-50 dark:bg-amber-900/20 py-1.5 px-2 rounded-xl">
                                        <span className="text-xs font-bold text-slate-400 line-through">{oldV}</span>
                                        <span className="text-amber-400 text-xs">→</span>
                                        <span className="text-xs font-black text-amber-700 dark:text-amber-300">{newV}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 py-1.5 px-3 rounded-xl">{newV}</span>
                                );
                            })()}
                        </td>
                    )}

                    {/* MAX QTY for manual edits only */}
                    {activeTab === 'store_manual_edits' && (
                        <td className="px-4 py-3 text-center">
                            {(() => {
                                const oldV = r.old_max ?? '-';
                                const newV = r.new_max ?? '-';
                                const changed = String(oldV) !== String(newV);
                                return changed ? (
                                    <div className="flex items-center justify-center gap-1 bg-amber-50 dark:bg-amber-900/20 py-1.5 px-2 rounded-xl">
                                        <span className="text-xs font-bold text-slate-400 line-through">{oldV}</span>
                                        <span className="text-amber-400 text-xs">→</span>
                                        <span className="text-xs font-black text-amber-700 dark:text-amber-300">{newV}</span>
                                    </div>
                                ) : (
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 py-1.5 px-3 rounded-xl">{newV}</span>
                                );
                            })()}
                        </td>
                    )}

                    {/* Details */}
                    <td className="px-4 py-3">
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                            {r.details || r.change_reason || 'Manual Update'}
                        </span>
                    </td>

                    {/* SKU Start Time - detail only */}
                    {showDetailedTime && (
                        <td className="px-4 py-3 text-center">
                            <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                                {r.process_started_at ? fmt(r.process_started_at) : <span className="text-slate-300">-</span>}
                            </span>
                        </td>
                    )}

                    {/* Recorded At / ບັນທຶກການສຳເລັດແຕ່ລະ SKU */}
                    <td className="px-4 py-3 text-slate-400 text-[11px] whitespace-nowrap text-center">
                        {fmt(r.updated_at || r.created_at)}
                    </td>

                    {/* Per-SKU Duration - detail only */}
                    {showDetailedTime && (
                        <td className="px-4 py-3 text-center">
                            {skuSecs > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-[10px] font-black rounded-lg whitespace-nowrap">
                                    ⏱️ {fmtSecs(skuSecs)}
                                </span>
                            ) : <span className="text-slate-300">-</span>}
                        </td>
                    )}

                    {/* Batch Start - detail only */}
                    {showDetailedTime && (
                        <td className="px-4 py-3 text-center">
                            <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
                                {batchStartedAt ? fmt(batchStartedAt) : <span className="text-slate-300">-</span>}
                            </span>
                        </td>
                    )}

                    {/* Batch End - detail only */}
                    {showDetailedTime && (
                        <td className="px-4 py-3 text-center">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                                {batchEndedAt ? fmt(batchEndedAt) : <span className="text-slate-300">-</span>}
                            </span>
                        </td>
                    )}

                    {/* Batch Total Duration */}
                    <td className="px-4 py-3 text-center">
                        {batchSecs > 0 ? (
                            <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[11px] font-black rounded-lg whitespace-nowrap">
                                    📦 {fmtSecs(batchSecs)}
                                </span>
                                {speedLabel && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${speedLabel.cls}`}>{speedLabel.txt}</span>
                                )}
                            </div>
                        ) : <span className="text-slate-300">-</span>}
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
                    {showBranchCol && (
                        <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                                {r.branch_id}
                            </span>
                        </td>
                    )}
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
        if (activeTab === 'import_dc' || activeTab === 'import_sales') {
            return (
                <tr key={i} className={`transition-colors ${activeTab === 'import_sales' ? 'hover:bg-rose-50/30' : 'hover:bg-pink-50/30'}`}>
                    <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>
                    {showBranchCol && (
                        <td className="px-4 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                                {r.branch_id}
                            </span>
                        </td>
                    )}
                    <td className="px-6 py-4">
                        <span className="font-mono text-sm font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md whitespace-nowrap">{r.barcode || '-'}</span>
                    </td>
                    <td className="px-6 py-4"><UserCell value={r.updated_by} iconColor={activeTab === 'import_sales' ? 'text-rose-400' : 'text-pink-400'} /></td>
                    <td className="px-6 py-4 text-center"><span className="text-2xl font-black text-slate-700 dark:text-white">{r.qty ?? '-'}</span></td>
                    <td className="px-6 py-4"><span className="text-sm text-slate-500 italic">{r.details || ''}</span></td>
                    <td className="px-6 py-4 text-slate-400 text-sm whitespace-nowrap">{fmt(r.updated_at)}</td>
                </tr>
            );
        }
        return (
            <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-4 py-4 text-center text-sm font-black text-slate-400">{i + 1}</td>
                {showBranchCol && (
                    <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 rounded-full text-[10px] font-black bg-orange-100 text-orange-700 border border-orange-200">
                            {r.branch_id}
                        </span>
                    </td>
                )}
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
                                    className={`flex flex-col items-center px-4 py-2 rounded-2xl text-white transition-all hover:scale-105 active:scale-95 ${statusFilter === s.key ? s.active : s.cls + ' hover:bg-white/30'
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

                    {/* Search + Detail Time Toggle */}
                    <div className="flex items-center gap-2">
                        {activeTab === 'store_edits' && (
                            <button
                                onClick={() => setShowDetailedTime(v => !v)}
                                title={showDetailedTime ? '຋່ອນເວລາລະເອີຍດ' : 'ແສດເວລາລະເອີຍດ'}
                                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-2xl border text-xs font-black transition-all whitespace-nowrap ${showDetailedTime
                                    ? 'bg-violet-500 border-violet-400 text-white shadow-lg shadow-violet-500/30'
                                    : 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                                    }`}
                            >
                                <Clock size={14} />
                                <span>{showDetailedTime ? 'ເວລາລະເອີຍດ' : 'ເວລາລະເອີຍດ'}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-black ${showDetailedTime ? 'bg-white/20 text-white' : 'bg-white/30 text-white'
                                    }`}>{showDetailedTime ? 'ON' : 'OFF'}</span>
                            </button>
                        )}
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60" size={18} />
                            <input type="text" placeholder="ຄົ້ນຫາ..." value={search} onChange={e => setSearch(e.target.value)}
                                className="pl-11 pr-4 py-3 rounded-2xl bg-white/20 text-white placeholder:text-white/60 text-base font-bold outline-none focus:bg-white/30 transition-all w-48" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800" ref={tableHeaderRef}>
                        <tr>
                            {headers.map((h, idx) => {
                                const isCenter = ['#', 'จຳນວນ', 'Tag', 'Shelf', 'Max', 'ສະຕ໋ອກ', 'ຄົງເຫຼືອ', 'ຂໍ', 'ປ່ຽນແປງ', 'ການປ່ຽນ', 'ເວລາ', 'ເລີ່ມບິນ', 'ສຳເລັດບິນ', 'ບັນທຶກ'].some(k => h.includes(k));
                                const disabledCols = ['ຂໍ', 'ສະຕ໋ອກ'];
                                const hasFilter = idx > 0 && columnUniqueValues[idx] && columnUniqueValues[idx].length > 0 && !disabledCols.includes(h);
                                const isFilterOpen = openFilterCol === idx;
                                const currentFilter = columnFilters[idx];
                                const isAllSelected = !currentFilter || currentFilter.length === 0;

                                return (
                                    <th key={idx} className={`px-4 py-3 align-top whitespace-nowrap relative ${isCenter ? 'text-center' : 'text-left'}`}>
                                        <div className={`flex flex-col gap-2 ${isCenter ? 'items-center' : 'items-start'}`}>
                                            <span className="text-xs font-black uppercase text-slate-500 tracking-wider">
                                                {h}
                                            </span>
                                            {hasFilter && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setOpenFilterCol(isFilterOpen ? null : idx); }}
                                                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${!isAllSelected ? 'bg-orange-50 border-joah-orange text-joah-orange' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                                >
                                                    <Filter size={12} />
                                                    <span>{isAllSelected ? 'ກັ່ນຕອງ' : `ເລືອກ (${currentFilter.length})`}</span>
                                                    <ChevronDown size={12} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown Popover */}
                                        {isFilterOpen && hasFilter && (
                                            <div
                                                className="absolute top-full mt-2 left-0 min-w-[200px] max-w-[280px] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <div className="p-2.5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-700/50">
                                                    <button
                                                        onClick={() => {
                                                            if (isAllSelected) {
                                                                setColumnFilters({ ...columnFilters, [idx]: ['__NONE__'] }); // use a dummy string to represent none selected so it's not empty array
                                                            } else {
                                                                setColumnFilters({ ...columnFilters, [idx]: undefined });
                                                            }
                                                        }}
                                                        className="text-[11px] font-black text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors uppercase tracking-wider"
                                                    >
                                                        {isAllSelected ? '☐ ຍົກເລີກທັງໝົດ' : '☑ ເລືອກທັງໝົດ'}
                                                    </button>
                                                </div>

                                                {/* Special Negative Filter for ຄົງເຫຼືອ */}
                                                {h.includes('ຄົງເຫຼືອ') && (
                                                    <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-rose-50/50 dark:bg-rose-900/10">
                                                        <label className="flex items-start gap-2.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 p-1.5 rounded-lg cursor-pointer transition-colors group">
                                                            <input
                                                                type="checkbox"
                                                                checked={!isAllSelected && currentFilter.includes('__NEGATIVE__')}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setColumnFilters({ ...columnFilters, [idx]: ['__NEGATIVE__'] });
                                                                    } else {
                                                                        setColumnFilters({ ...columnFilters, [idx]: undefined });
                                                                    }
                                                                }}
                                                                className="mt-0.5 w-3.5 h-3.5 rounded border-rose-300 text-rose-500 focus:ring-rose-500 bg-white checked:bg-rose-500 transition-all cursor-pointer"
                                                            />
                                                            <span className="text-[11px] font-black text-rose-600 dark:text-rose-400 flex-1 leading-snug">
                                                                🚨 ສະເພາະລາຍການຕິດລົບ (&lt; 0)
                                                            </span>
                                                        </label>
                                                    </div>
                                                )}

                                                <div className="max-h-60 overflow-y-auto p-2 flex flex-col gap-0.5 custom-scrollbar bg-white dark:bg-slate-800">
                                                    {columnUniqueValues[idx].map((val, vIdx) => {
                                                        const isSelected = isAllSelected || currentFilter.includes(val);
                                                        return (
                                                            <label key={vIdx} className="flex items-start gap-2.5 p-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-colors group">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => {
                                                                        if (isAllSelected) {
                                                                            // going from all to all-except-one
                                                                            setColumnFilters({ ...columnFilters, [idx]: columnUniqueValues[idx].filter(v => v !== val) });
                                                                        } else {
                                                                            const newFilter = currentFilter.includes(val)
                                                                                ? currentFilter.filter(v => v !== val)
                                                                                : [...currentFilter, val];

                                                                            // if empty, we use dummy string
                                                                            if (newFilter.length === 0) {
                                                                                setColumnFilters({ ...columnFilters, [idx]: ['__NONE__'] });
                                                                            } else if (newFilter.length === columnUniqueValues[idx].length) {
                                                                                setColumnFilters({ ...columnFilters, [idx]: undefined });
                                                                            } else {
                                                                                setColumnFilters({ ...columnFilters, [idx]: newFilter });
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="mt-0.5 w-3.5 h-3.5 rounded border-slate-300 text-joah-orange focus:ring-joah-orange bg-white checked:bg-joah-orange transition-all cursor-pointer"
                                                                />
                                                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 break-words flex-1 group-hover:text-joah-orange transition-colors whitespace-normal text-left leading-snug">
                                                                    {val}
                                                                </span>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </th>
                                );
                            })}
                        </tr>
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

const HQCommandCenterV2 = ({ onBack }) => {
    const [activeTab, setActiveTab] = useState('requests');
    const [startDate, setStartDate] = useState(todayStr());
    const [endDate, setEndDate] = useState(todayStr());
    const [selectedBranch, setSelectedBranch] = useState(null);
    const [branchFilter, setBranchFilter] = useState('all');
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const handleSelectBranch = (branch, filter = 'all') => {
        setBranchFilter(filter);
        setSelectedBranch(branch);
    };

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        // ✅ DO NOT reset selectedBranch here — keep the user on the detail page
        try {
            // 🚀 Helper for Chunked Fetching (Auto-pagination over 1000 limit)
            const fetchAllChunks = async (queryBuilder) => {
                let allData = [];
                let from = 0;
                const step = 1000;
                while (true) {
                    const { data, error } = await queryBuilder.range(from, from + step - 1);
                    if (error) throw error;
                    if (!data || data.length === 0) break;
                    allData = [...allData, ...data];
                    if (data.length < step) break; // End of records
                    from += step;
                }
                return allData;
            };

            let rows = [];
            if (activeTab === 'requests') {
                let q = supabase.from('store_requests')
                    .select('id, branch_id, status, created_at, updated_at, request_by, accepted_by, product_name, barcode, qty, batch_id, stock_at_request, store_confirmed_at, store_confirmed_by')
                    .order('created_at', { ascending: false });
                if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
                rows = await fetchAllChunks(q);

            } else if (activeTab === 'edits') {
                let q = supabase.from('inventory_history').select('*')
                    .order('updated_at', { ascending: false });
                if (startDate) q = q.gte('updated_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('updated_at', `${endDate}T23:59:59`);
                rows = await fetchAllChunks(q);

                let q2 = supabase.from('added_items_log').select('*').order('created_at', { ascending: false });
                if (startDate) q2 = q2.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q2 = q2.lte('created_at', `${endDate}T23:59:59`);
                const addedData = await fetchAllChunks(q2);

                const normalizedAdded = (addedData || []).map(r => ({
                    ...r,
                    _source: 'added',
                    old_qty: 0,
                    new_qty: r.qty,
                    updated_by: r.added_by,
                    updated_at: r.created_at,
                    details: r.remarks || r.reason || 'ສິນຄ້າເຂົ້າໃໝ່',
                }));
                rows = [...rows, ...normalizedAdded].sort((a, b) =>
                    new Date(b.updated_at) - new Date(a.updated_at)
                );

            } else if (activeTab === 'store_edits') {
                // 🌟 ດຶງ store_requests ທັງໝົດທີ່ສາງຕອບຮັບແລ້ວ (ທັງທີ່ກົດຮັບແລ້ວ ແລະ ຄ້າງໜ້າຮ້ານກົດຮັບ)
                let q = supabase.from('store_requests')
                    .select('id, branch_id, status, created_at, updated_at, request_by, accepted_by, product_name, barcode, qty, batch_id, stock_at_request, store_confirmed_at, store_confirmed_by')
                    .in('status', ['accepted', 'approved'])
                    .order('created_at', { ascending: false });

                // กรองวันที่: ถ้า confirmed ให้ดู store_confirmed_at หรือถ้ายังไม่ confirmed ให้ดู updated_at / created_at
                // เพื่อให้ครอบคลุมช่วงวันที่เลือก ดึงตาม created_at หรือ updated_at
                if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
                const storeRequestsList = await fetchAllChunks(q);

                // พยายามดึง store_inventory_history มาจับคู่เพื่อเอาข้อมูล shelf, tags, process_time ถ้ามี
                const batchIds = [...new Set((storeRequestsList || []).map(r => r.batch_id).filter(Boolean))];
                let historyMap = {};
                if (batchIds.length > 0) {
                    for (let i = 0; i < batchIds.length; i += 100) {
                        const chunk = batchIds.slice(i, i + 100);
                        const { data: hList } = await supabase
                            .from('store_inventory_history')
                            .select('*')
                            .in('bill_id', chunk);
                        (hList || []).forEach(h => {
                            const reason = h.change_reason || '';
                            if (!reason.startsWith('ຮັບຈາກ Request')) {
                                const key = `${h.bill_id}_${h.barcode_no || h.barcode}`;
                                historyMap[key] = h;
                                if (!historyMap[h.bill_id]) historyMap[h.bill_id] = h;
                            }
                        });
                    }
                }

                rows = (storeRequestsList || []).map(r => {
                    const hInfo = (r.batch_id && (historyMap[`${r.batch_id}_${r.barcode}`] || historyMap[r.batch_id])) || null;
                    const reqSentAt = r.updated_at || r.created_at;
                    const actualReceivedAt = r.store_confirmed_at;
                    const isPendingStore = !actualReceivedAt;

                    // Calculate delay from when WH sent/accepted to store confirmed
                    let delayMs = 0;
                    let isBackdated = false;
                    let delayStr = null;
                    if (reqSentAt && actualReceivedAt) {
                        delayMs = new Date(actualReceivedAt).getTime() - new Date(reqSentAt).getTime();
                        if (delayMs > 3600 * 1000 * 12) { // > 12 hours
                            isBackdated = true;
                        }
                        delayStr = calcDuration(reqSentAt, actualReceivedAt);
                    } else if (isPendingStore && reqSentAt) {
                        delayStr = calcElapsedFromNow(reqSentAt);
                    }

                    return {
                        ...r,
                        _source: 'store_request',
                        item_name: r.product_name,
                        barcode: r.barcode,
                        old_qty: hInfo?.old_store_qty ?? r.stock_at_request ?? '-',
                        new_qty: hInfo?.new_store_qty ?? (isPendingStore ? '-' : r.qty),
                        old_tag: hInfo?.old_product_tag || null,
                        new_tag: hInfo?.new_product_tag || null,
                        old_shelf: hInfo?.old_shelf_location || null,
                        new_shelf: hInfo?.new_shelf_location || null,
                        old_max: hInfo?.old_max_qty || null,
                        new_max: hInfo?.new_max_qty || null,
                        updated_by: r.store_confirmed_by || (isPendingStore ? r.request_by : (hInfo?.updated_by || r.request_by)),
                        store_confirmed_by: r.store_confirmed_by,
                        updated_at: actualReceivedAt || reqSentAt,
                        created_at: r.created_at,
                        details: isPendingStore ? '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ' : (hInfo?.change_reason || `ຮັບຈາກ Request (${r.batch_id || 'N/A'})`),
                        process_time_seconds: hInfo?.process_time_seconds || 0,
                        process_started_at: hInfo?.process_started_at || null,
                        batch_started_at: hInfo?.batch_started_at || null,
                        batch_ended_at: hInfo?.batch_ended_at || null,
                        batch_total_seconds: hInfo?.batch_total_seconds || 0,
                        bill_id: r.batch_id || null,
                        // 🌟 Cross-Audit with store_requests
                        req_created_at: r.created_at,
                        req_sent_at: reqSentAt,
                        req_by: r.request_by,
                        accepted_by: r.accepted_by,
                        delay_ms: delayMs,
                        is_backdated: isBackdated,
                        delay_str: delayStr,
                    };
                });


            } else if (activeTab === 'store_manual_edits') {
                let q = supabase.from('store_inventory_history').select('*')
                    .in('action_type', ['edited', 'added'])  // ການແກ້ໄຂ ຫຼື ເພີ່ມເອງໜ້າຮ້ານ
                    .order('updated_at', { ascending: false });
                if (startDate) q = q.gte('updated_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('updated_at', `${endDate}T23:59:59`);
                const storeManualData = await fetchAllChunks(q);

                rows = (storeManualData || []).map(r => ({
                    ...r,
                    _source: 'store',
                    item_name: r.item_name,
                    barcode: r.barcode_no || r.barcode,
                    old_qty: r.old_store_qty ?? 0,
                    new_qty: r.new_store_qty ?? 0,
                    old_tag: r.old_product_tag,
                    new_tag: r.new_product_tag,
                    old_shelf: r.old_shelf_location,
                    new_shelf: r.new_shelf_location,
                    old_max: r.old_max_qty,
                    new_max: r.new_max_qty,
                    updated_by: r.updated_by,
                    updated_at: r.updated_at || r.created_at,
                    created_at: r.created_at,
                    details: r.change_reason || 'Manual Update',
                    process_time_seconds: r.process_time_seconds || 0,
                    process_started_at: r.process_started_at || null,
                    // ✅ FIX: Batch timing fields
                    batch_started_at: r.batch_started_at || null,
                    batch_ended_at: r.batch_ended_at || null,
                    batch_total_seconds: r.batch_total_seconds || 0,
                    bill_id: r.bill_id || null,
                }));

            } else if (activeTab === 'import_dc') {
                let qDc = supabase.from('store_dc_log').select('*').order('import_date', { ascending: false });
                if (startDate) qDc = qDc.gte('import_date', `${startDate}T00:00:00`);
                if (endDate) qDc = qDc.lte('import_date', `${endDate}T23:59:59`);
                const dcData = await fetchAllChunks(qDc);

                rows = (dcData || []).map(r => ({
                    ...r,
                    _source: 'dc',
                    barcode: r.barcode_no,
                    qty: r.imported_qty,
                    updated_by: r.imported_by,
                    updated_at: r.import_date,
                    details: 'ນຳເຂົ້າສິນຄ້າ DC'
                }));

            } else if (activeTab === 'import_sales') {
                let qSales = supabase.from('store_sales_log').select('*').order('import_date', { ascending: false });
                if (startDate) qSales = qSales.gte('import_date', `${startDate}T00:00:00`);
                if (endDate) qSales = qSales.lte('import_date', `${endDate}T23:59:59`);
                const salesData = await fetchAllChunks(qSales);

                rows = (salesData || []).map(r => ({
                    ...r,
                    _source: 'sales',
                    barcode: r.barcode_no,
                    qty: r.sales_qty,
                    updated_by: r.imported_by,
                    updated_at: r.import_date,
                    details: 'ນຳເຂົ້າປະຫວັດຍອດຂາຍ'
                }));

            } else {
                let q = supabase.from('added_items_log').select('*').order('created_at', { ascending: false });
                if (startDate) q = q.gte('created_at', `${startDate}T00:00:00`);
                if (endDate) q = q.lte('created_at', `${endDate}T23:59:59`);
                rows = await fetchAllChunks(q);
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
                                    HQ Command Center V2{selectedBranch && <span className="ml-2 text-orange-500">/ {selectedBranch}</span>}
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
                        onBack={() => { setSelectedBranch(null); setBranchFilter('all'); }}
                        startDate={startDate}
                        endDate={endDate}
                        initialStatusFilter={branchFilter}
                    />
                ) : (
                    <div className="space-y-6">
                        {/* Summary Banner */}
                        <div className={`rounded-3xl bg-gradient-to-r ${activeTabConfig?.color} p-7 text-white shadow-xl`}>
                            <p className="text-xl font-bold opacity-80 mb-1">
                                {activeTab === 'requests' ? 'ຄຳຂໍ Store Request' : activeTab === 'edits' ? 'ການແກ້ໄຂຄລັງ' : activeTab === 'store_edits' ? 'ປະຫວັດໜ້າຮ້ານ' : activeTab === 'import_dc' ? 'ປະຫວັດການນຳເຂົ້າ DC' : activeTab === 'import_sales' ? 'ປະຫວັດການນຳເຂົ້າ Sale' : 'ສິນຄ້າເຂົ້າໃໝ່'} · ທຸກສາຂາ
                            </p>
                            <p className="text-8xl font-black leading-none">{data.length}</p>
                            <p className="text-white/70 font-bold mt-2 text-base">{dateLabel}</p>
                            {activeTab === 'requests' && (
                                <div className="flex flex-wrap gap-4 sm:gap-6 mt-5 pt-5 border-t border-white/20">
                                    {[
                                        { label: 'ທັງໝົດ', val: data.length, icon: '📦', key: 'all', cls: 'hover:bg-white/20' },
                                        { label: 'ລໍຖ້າສາງ', val: data.filter(r => r.status === 'pending').length, icon: '⏳', key: 'pending', cls: 'hover:bg-amber-400/30' },
                                        { label: '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ', val: data.filter(r => (r.status === 'accepted' || r.status === 'approved') && !r.store_confirmed_at).length, icon: '⚠️', key: 'pending_store', cls: 'hover:bg-orange-500/30' },
                                        { label: '✅ ຮັບເຄື່ອງແລ້ວ', val: data.filter(r => (r.status === 'accepted' || r.status === 'approved') && r.store_confirmed_at).length, icon: '✅', key: 'completed', cls: 'hover:bg-emerald-400/30' },
                                        { label: 'ປະຕິເສດ', val: data.filter(r => r.status === 'rejected').length, icon: '❌', key: 'rejected', cls: 'hover:bg-rose-400/30' },
                                    ].map(s => (
                                        <button
                                            key={s.label}
                                            onClick={() => handleSelectBranch('ທັງໝົດ', s.key)}
                                            className={`text-left p-3 rounded-2xl bg-white/10 ${s.cls} transition-all hover:scale-105 active:scale-95 border border-white/20`}
                                            title={`ກົດເພື່ອເບິ່ງລາຍການ: ${s.label}`}
                                        >
                                            <p className="text-3xl font-black">{s.icon} {s.val}</p>
                                            <p className="text-white/80 font-bold text-xs sm:text-sm uppercase tracking-wider">{s.label}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {activeTab === 'store_edits' && (
                                <div className="flex flex-wrap gap-4 sm:gap-6 mt-5 pt-5 border-t border-white/20">
                                    {[
                                        { label: 'ທັງໝົດ', val: data.length, icon: '📦', key: 'all', cls: 'hover:bg-white/20' },
                                        { label: '⚡ ຮັບປົກກະຕິ', val: data.filter(r => !r.is_backdated && r.store_confirmed_at).length, icon: '⚡', key: 'on_time', cls: 'hover:bg-emerald-400/30' },
                                        { label: '🚨 ຮັບຍ້ອນຫຼັງ (>12ຊມ)', val: data.filter(r => r.is_backdated && r.store_confirmed_at).length, icon: '🚨', key: 'backdated', cls: 'hover:bg-rose-500/30' },
                                        { label: '⚠️ ຄ້າງໜ້າຮ້ານກົດຮັບ', val: data.filter(r => !r.store_confirmed_at).length, icon: '⚠️', key: 'pending_store', cls: 'hover:bg-orange-500/30' },
                                    ].map(s => (
                                        <button
                                            key={s.label}
                                            onClick={() => s.key && handleSelectBranch('ທັງໝົດ', s.key)}
                                            disabled={!s.key}
                                            className={`text-left p-3 rounded-2xl bg-white/10 ${s.cls || (s.key ? 'hover:bg-white/20' : '')} ${s.key ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'} transition-all border border-white/20`}
                                            title={s.key ? `ກົດເພື່ອເບິ່ງ: ${s.label}` : undefined}
                                        >
                                            <p className="text-3xl font-black">{s.icon} {s.val}</p>
                                            <p className="text-white/80 font-bold text-xs sm:text-sm uppercase tracking-wider">{s.label}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Instruction */}
                        <div className="flex items-center gap-4 px-6 py-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700">
                            <span className="text-4xl">👇</span>
                            <p className="text-xl font-black text-amber-700 dark:text-amber-400">ກົດທີ່ຊື່ສາຂາ ຫຼື ຕົວເລກສະຖານະ ເພື່ອເບິ່ງລາຍລະອຽດ ແລະ Export Excel</p>
                        </div>

                        {/* Branch Cards */}
                        <BranchGrid data={data} activeTab={activeTab} onSelectBranch={handleSelectBranch} />
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(content, document.body);
};

export default HQCommandCenterV2;
