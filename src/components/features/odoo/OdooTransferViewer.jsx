import React, { useState, useEffect, useMemo } from 'react';
import {
    ArrowLeft, Search, RefreshCw, Filter, Building2, PackageCheck,
    CheckCircle2, Clock, XCircle, AlertCircle, FileText, Eye, Star,
    Printer, Send, Lock, RotateCcw, ChevronLeft, ChevronRight, MessageSquare, History, User
} from 'lucide-react';
import {
    fetchOdooStockPickings,
    fetchOdooPickingItems,
    fetchOdooPickingMoveLines,
    fetchProductBarcodesMap,
    validateOdooPickingNoBackorder
} from '../../../services/odooTransferApi';
import OdooValidateModal from './OdooValidateModal';
import OdooAutoAgentModal from './OdooAutoAgentModal';

const ODOO_COMPANIES = [
    { id: 249, name: '171030003-Joah Taladlao', label: 'ຕະຫຼາດລາວ (TLL)' }, // Cleaned up name to prevent "Patuxai / Taladlao" confusion
    { id: 248, name: '171020002-Joah Sivilay', label: 'ສີວິໄລ (SVL)' },
    { id: 261, name: '171040004-Joah Vangxaiy', label: 'ວັງຊາຍ (VX)' },
    { id: 247, name: '171010001-Joah Phonsinuan', label: 'ໂພນສີນວນ (PSN)' },
    { id: 273, name: '171050005-Joah Patuxai', label: 'ປະຕູໄຊ (PTX)' }, // Fixed label from MGM to PTX
];

// ═════════════════════════════════════════════════════════════════════════
// DESIGN SYSTEM — "MARK-I READOUT"
// A JARVIS-style diagnostic HUD rendered in daylight glass instead of a
// dark cockpit: chamfered (not rounded) panels, a rotating reactor core as
// the one recurring emblem, mono/uppercase readout type, and a thin cyan
// sweep that drifts across active panels like a live telemetry scan.
// ═════════════════════════════════════════════════════════════════════════

const HudStyles = () => (
    <style>{`
        @keyframes reactor-spin { to { transform: rotate(360deg); } }
        @keyframes reactor-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes hud-sweep { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
        @keyframes core-glow { 0%, 100% { box-shadow: 0 0 6px 1px rgba(34,211,238,.55); } 50% { box-shadow: 0 0 12px 3px rgba(34,211,238,.85); } }

        .hud-panel {
            position: relative;
            background: #ffffff;
            clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px);
            box-shadow: inset 0 0 0 1px rgba(56,189,248,.28), 0 1px 28px rgba(15,23,42,.05);
        }
        .hud-panel::before {
            content: '';
            position: absolute; top: 0; left: 0; right: 0; height: 2px;
            background: linear-gradient(90deg, transparent, #22d3ee 25%, #67e8f9 50%, #22d3ee 75%, transparent);
            opacity: .8;
        }
        .hud-panel.is-live::after {
            content: '';
            position: absolute; inset: 0;
            background: linear-gradient(115deg, transparent 42%, rgba(34,211,238,.10) 50%, transparent 58%);
            width: 60%;
            animation: hud-sweep 4.5s ease-in-out infinite;
            pointer-events: none;
        }
        .hud-panel-sm {
            clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
        }
        .hud-btn {
            clip-path: polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px);
        }
        .hud-readout { letter-spacing: .12em; }
    `}</style>
);

function ReactorCore({ size = 30, live = false }) {
    const ring = live ? '#22d3ee' : '#7dd3fc';
    return (
        <span className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox="0 0 40 40" style={{ animation: `reactor-spin ${live ? 2.2 : 7}s linear infinite` }}>
                <circle cx="20" cy="20" r="17.5" fill="none" stroke={live ? '#a5f3fc' : '#e2e8f0'} strokeWidth="1" strokeDasharray="1.2 3.4" />
            </svg>
            <svg width={size * 0.7} height={size * 0.7} viewBox="0 0 40 40" className="absolute" style={{ animation: `reactor-spin-rev ${live ? 1.6 : 4.5}s linear infinite` }}>
                <circle cx="20" cy="20" r="15" fill="none" stroke={ring} strokeWidth="1.8" strokeDasharray="9 7" strokeLinecap="round" />
            </svg>
            <span
                className="absolute rounded-full bg-cyan-400"
                style={{ width: size * 0.16, height: size * 0.16, animation: 'core-glow 1.8s ease-in-out infinite' }}
            />
        </span>
    );
}

function HudPanel({ children, className = '', live = false, small = false, ...rest }) {
    return (
        <div className={`hud-panel ${small ? 'hud-panel-sm' : ''} ${live ? 'is-live' : ''} ${className}`} {...rest}>
            {children}
        </div>
    );
}

function StatusReadout({ isDraft, isReady, isDone }) {
    const steps = [
        { key: 'draft', label: 'Draft', on: isDraft, color: 'bg-slate-600' },
        { key: 'ready', label: 'Ready', on: isReady, color: 'bg-cyan-400' },
        { key: 'done', label: 'Done', on: isDone, color: 'bg-emerald-500' },
    ];
    return (
        <div className="flex items-center gap-2 font-mono">
            {steps.map((s, i) => (
                <React.Fragment key={s.key}>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 ${s.on ? s.color : 'bg-slate-200'} rounded-[1px]`} style={s.on ? { boxShadow: '0 0 6px 1px rgba(34,211,238,.5)' } : {}} />
                        <span className={`text-[10px] hud-readout uppercase font-bold ${s.on ? 'text-slate-700' : 'text-slate-300'}`}>{s.label}</span>
                    </div>
                    {i < steps.length - 1 && <span className="w-4 h-px bg-slate-200" />}
                </React.Fragment>
            ))}
        </div>
    );
}

function Field({ label, value, tone, strong, muted }) {
    const toneClass = tone === 'cyan' ? 'text-cyan-600' : tone === 'amber' ? 'text-amber-600' : muted ? 'text-slate-300' : 'text-slate-600';
    return (
        <div className="grid grid-cols-3 items-center">
            <span className="text-slate-400 font-semibold hud-readout uppercase text-[10px]">{label}</span>
            <span className={`col-span-2 font-bold ${strong ? 'text-sm text-slate-800' : toneClass}`}>{value}</span>
        </div>
    );
}

export default function OdooTransferViewer({ onBack }) {
    const [selectedCompanyId, setSelectedCompanyId] = useState(261); // Default VX
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [pickings, setPickings] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);

    // Navigation & Full-Page View State
    // viewMode: 'list' | 'form'
    const [viewMode, setViewMode] = useState('list');
    const [selectedPickingIndex, setSelectedPickingIndex] = useState(0);
    const [selectedPicking, setSelectedPicking] = useState(null);
    const [pickingItems, setPickingItems] = useState([]);
    const [isItemsLoading, setIsItemsLoading] = useState(false);

    // Form View Tab State: 'operations' | 'additional' | 'note' | 'employee'
    const [activeTab, setActiveTab] = useState('operations');

    // Validate Modal State
    const [showValidateModal, setShowValidateModal] = useState(false);

    // Multi-select & Auto Agent State
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [isAgentRunning, setIsAgentRunning] = useState(false);
    const [agentStatusText, setAgentStatusText] = useState('');
    const [agentProgressInfo, setAgentProgressInfo] = useState({ current: 0, total: 0 });
    const [agentErrorHalt, setAgentErrorHalt] = useState(null); // { picking, error }
    const [agentSummaryReport, setAgentSummaryReport] = useState(null); // { success: [], skipped: [] }

    // Ref เพื่อหยุดการทำงานของ Agent loop
    const stopAgentRef = React.useRef(false);

    // ฟังก์ชันรัน Live Auto Agent (สลับเปลี่ยนหน้าจริงช้าๆ ทีละบิล)
    const startLiveAgent = async () => {
        const targetPickings = filteredPickings.filter(p => selectedIds.has(p.id) && p.state === 'assigned');
        if (targetPickings.length === 0) return;

        setIsAgentRunning(true);
        setAgentErrorHalt(null);
        setAgentSummaryReport(null);
        stopAgentRef.current = false;
        setAgentProgressInfo({ current: 0, total: targetPickings.length });

        const validatedList = [];
        const skippedList = [];

        for (let i = 0; i < targetPickings.length; i++) {
            if (stopAgentRef.current) break;

            const picking = targetPickings[i];
            const pickingIdx = filteredPickings.findIndex(p => p.id === picking.id);
            setAgentProgressInfo({ current: i + 1, total: targetPickings.length });

            // Step 1: สลับสวิตช์เปิดหน้า Form View บิลนี้บนจอจริงๆ
            setAgentStatusText(`[บิลที่ ${i + 1}/${targetPickings.length}] 🖱️ Agent กำลังคลิกเปิดบิล ${picking.name}...`);
            await handleOpenFormView(picking, pickingIdx >= 0 ? pickingIdx : 0);
            await new Promise(r => setTimeout(r, 2000)); // หน่วง 2 วินาทีให้ดูภาพหัวบิล

            if (stopAgentRef.current) break;

            // ⚠️ PRE-CHECK: ตรวจสอบว่าบิลนี้มี Bill reference หรือไม่?
            const billRef = picking.bill_reference;
            if (!billRef || String(billRef).trim() === '' || billRef === false) {
                console.warn(`[LiveAgent] Skipped ${picking.name} because it lacks Bill reference`);
                skippedList.push({ ...picking, reason: 'ไม่มี Bill reference' });
                setAgentStatusText(`⚠️ [บิลที่ ${i + 1}/${targetPickings.length}] บิล ${picking.name} ไม่มี Bill reference -> ข้ามอัตโนมัติตามนโยบาย!`);
                await new Promise(r => setTimeout(r, 3000)); // แสดงเตือน 3 วินาที
                setViewMode('list');
                await new Promise(r => setTimeout(r, 1000));
                continue; // ⏩ ข้ามไปบิลถัดไปทันที!
            }

            // Step 2: หน่วงเวลาเสมือนคนนั่งอ่านรายการสินค้าบนตาราง
            setAgentStatusText(`[บิลที่ ${i + 1}/${targetPickings.length}] 🔍 Agent กำลังตรวจเช็กรายการสินค้าในตาราง...`);
            await new Promise(r => setTimeout(r, 2500)); // หน่วง 2.5 วินาที

            if (stopAgentRef.current) break;

            // Step 3: สั่งกดปุ่ม Validate บิลบนหน้าจอ
            setAgentStatusText(`[บิลที่ ${i + 1}/${targetPickings.length}] ⚡ Agent กำลังเลื่อนเมาส์กดปุ่ม Validate...`);
            await new Promise(r => setTimeout(r, 1500)); // หน่วง 1.5 วินาที

            // 🔄 Validate พร้อม Auto-Retry สำหรับ concurrent update error
            const MAX_RETRIES = 3;
            let validated = false;
            let lastErr = null;

            for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                if (stopAgentRef.current) break;
                try {
                    await validateOdooPickingNoBackorder(picking.id, (prog) => {
                        setAgentStatusText(`[บิลที่ ${i + 1}/${targetPickings.length}] ${prog.text}`);
                    });
                    // ✅ สำเร็จ
                    setSelectedPicking(prev => prev ? { ...prev, state: 'done' } : prev);
                    validatedList.push(picking);
                    setAgentStatusText(`✅ บิล ${picking.name} Validate สำเร็จแล้ว!`);
                    await new Promise(r => setTimeout(r, 1500));
                    validated = true;
                    break; // ออกจาก retry loop
                } catch (err) {
                    lastErr = err;
                    const errMsg = err.message || '';
                    console.error(`[LiveAgent] Attempt ${attempt}/${MAX_RETRIES} failed for ${picking.name}:`, errMsg);

                    // 🔁 Concurrent update — รอแล้ว retry อัตโนมัติ
                    const isConcurrentError = (
                        errMsg.includes('could not serialize access') ||
                        errMsg.includes('concurrent update') ||
                        errMsg.includes('deadlock detected')
                    );

                    if (isConcurrentError && attempt < MAX_RETRIES) {
                        setAgentStatusText(`⏳ [บิลที่ ${i + 1}/${targetPickings.length}] Odoo กำลัง busy... รอ 5 วินาทีแล้ว retry ครั้งที่ ${attempt + 1}/${MAX_RETRIES} (บิล ${picking.name})`);
                        await new Promise(r => setTimeout(r, 5000));
                        continue; // 🔄 retry
                    }

                    // ถ้า retry ครบแล้วยังไม่ได้ หรือ error อื่น → ตัดสินใจ skip หรือ halt
                    const isSkippableOdooError = (
                        isConcurrentError || // retry ครบแล้วยังไม่ได้ → ข้าม
                        errMsg.includes('Incompatible companies') ||
                        errMsg.includes('belongs to company') ||
                        errMsg.includes('belongs to another company') ||
                        errMsg.includes('AccessError') ||
                        errMsg.includes('You are not allowed') ||
                        errMsg.includes('record does not exist') ||
                        errMsg.includes('The document is in a wrong state')
                    );

                    if (isSkippableOdooError) {
                        // ⚠️ Odoo data/lock error → ข้ามบิลนี้ ทำงานต่อ
                        console.warn('[LiveAgent] Skipping due to Odoo error:', picking.name, errMsg);
                        const skipReason = isConcurrentError
                            ? `Retry ${MAX_RETRIES}x แล้ว Odoo ยัง busy (concurrent lock)`
                            : `Odoo error: ${errMsg.slice(0, 70)}`;
                        skippedList.push({ ...picking, reason: skipReason });
                        setAgentStatusText(`⚠️ [บิลที่ ${i + 1}/${targetPickings.length}] บิล ${picking.name} → ข้ามไปบิลถัดไป`);
                        await new Promise(r => setTimeout(r, 3000));
                        setViewMode('list');
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        // ❌ Fatal error → หยุด Agent แสดง popup :(
                        setAgentErrorHalt({
                            picking,
                            message: errMsg || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุขณะ Validate บิลนี้'
                        });
                        setIsAgentRunning(false);
                        return;
                    }
                    break; // ออกจาก retry loop
                }
            }

            if (stopAgentRef.current) break;

            // Step 4: หน่วง 5 วินาทีก่อนปิดหน้านี้กลับไป List
            for (let count = 5; count > 0; count--) {
                if (stopAgentRef.current) break;
                setAgentStatusText(`⏳ บิล ${picking.name} เสร็จเรียบร้อย! กำลังสลับไปบิลถัดไปในอีก ${count} วินาที...`);
                await new Promise(r => setTimeout(r, 1000));
            }

            // Step 5: ปิดหน้ากลับไปที่ List view
            setViewMode('list');
            await new Promise(r => setTimeout(r, 1000));
        }

        setIsAgentRunning(false);
        setViewMode('list');
        setSelectedIds(new Set());
        setAgentSummaryReport({
            success: validatedList,
            skipped: skippedList
        });
        loadPickings();
    };

    const stopLiveAgent = () => {
        stopAgentRef.current = true;
        setIsAgentRunning(false);
        setAgentErrorHalt(null);
    };

    // Fetch Pickings List
    const loadPickings = async () => {
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const records = await fetchOdooStockPickings({
                companyId: selectedCompanyId,
                search: searchQuery,
                status: statusFilter,
                limit: 1000
            });
            setPickings(records || []);
        } catch (err) {
            console.error('Error fetching Odoo Transfers:', err);
            setErrorMsg(err.message || 'ບໍ່ສາມາດເຊື່ອມຕໍ່ Odoo API ได้');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadPickings();
    }, [selectedCompanyId, statusFilter]);

    // Open Picking in Full-Page Form View
    const handleOpenFormView = async (picking, index) => {
        setSelectedPicking(picking);
        setSelectedPickingIndex(index);
        setViewMode('form');
        setActiveTab('operations');
        setIsItemsLoading(true);
        setPickingItems([]);
        try {
            // Step 1: ดึง stock.move (move_ids_without_package)
            let items = await fetchOdooPickingItems(picking.id);
            console.log('[OdooTransferViewer] stock.move items:', items.length, items);

            // Step 2: ถ้า stock.move ว่าง ให้ fallback ไป stock.move.line
            if (items.length === 0) {
                console.warn('[OdooTransferViewer] stock.move empty, fallback to stock.move.line...');
                const moveLines = await fetchOdooPickingMoveLines(picking.id);
                console.log('[OdooTransferViewer] stock.move.line items:', moveLines.length, moveLines);
                items = moveLines.map(ml => ({
                    id: ml.id,
                    product_id: ml.product_id,
                    product_uom_qty: ml.reserved_uom_qty || ml.reserved_qty || 0,
                    quantity: ml.quantity || ml.qty_done || 0,
                    quantity_done: ml.qty_done || ml.quantity || 0,
                    product_uom: ml.product_uom_id,
                    state: ml.state,
                    _source: 'move.line'
                }));
            }

            // Step 3: ดึง barcode สำหรับ product ทั้งหมด
            const productIds = items
                .map(i => Array.isArray(i.product_id) ? i.product_id[0] : i.product_id)
                .filter(Boolean);

            let barcodeMap = {};
            if (productIds.length > 0) {
                barcodeMap = await fetchProductBarcodesMap(productIds);
            }

            const enriched = items.map(item => {
                const pid = Array.isArray(item.product_id) ? item.product_id[0] : item.product_id;
                const bInfo = barcodeMap[pid] || {};
                const productName = Array.isArray(item.product_id) ? item.product_id[1] : '-';
                // Odoo 18: ใช้ 'quantity' สำหรับ done qty; fallback quantity_done
                const donedQty = item.quantity ?? item.quantity_done ?? 0;
                return {
                    ...item,
                    barcode: bInfo.barcode || '-',
                    productName,
                    resolvedDoneQty: donedQty,
                    resolvedDemandQty: item.product_uom_qty || 0,
                };
            });

            console.log('[OdooTransferViewer] enriched items:', enriched.length);
            setPickingItems(enriched);
        } catch (err) {
            console.error('[OdooTransferViewer] Error loading picking items:', err);
        } finally {
            setIsItemsLoading(false);
        }
    };

    // Filtered Pickings
    const filteredPickings = useMemo(() => {
        return pickings.filter(p => {
            if (statusFilter !== 'all') {
                if (statusFilter === 'assigned' && p.state !== 'assigned') return false;
                if (statusFilter === 'done' && p.state !== 'done') return false;
                if (statusFilter === 'cancel' && p.state !== 'cancel') return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = String(p.name || '').toLowerCase().includes(q);
                const originMatch = String(p.origin || '').toLowerCase().includes(q);
                const partnerMatch = Array.isArray(p.partner_id) ? String(p.partner_id[1]).toLowerCase().includes(q) : false;
                return nameMatch || originMatch || partnerMatch;
            }
            return true;
        });
    }, [pickings, statusFilter, searchQuery]);

    // Format Scheduled Date string
    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        const diffMs = Date.now() - d.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'ມື້ນີ້ (Today)';
        if (diffDays > 0) return `${diffDays} days ago`;
        return `${Math.abs(diffDays)} days from now`;
    };

    const currentCompanyName = useMemo(() => {
        const found = ODOO_COMPANIES.find(c => c.id === selectedCompanyId);
        return found ? found.name : '171040004-Joah Vangxaiy';
    }, [selectedCompanyId]);

    // Navigate Prev / Next Picking in Form View
    const handleNavPicking = (dir) => {
        const newIdx = selectedPickingIndex + dir;
        if (newIdx >= 0 && newIdx < filteredPickings.length) {
            const nextP = filteredPickings[newIdx];
            handleOpenFormView(nextP, newIdx);
        }
    };

    // ──────────────────────────────────────────────────────────────────────────
    // RENDER FORM VIEW
    // ──────────────────────────────────────────────────────────────────────────
    if (viewMode === 'form' && selectedPicking) {
        const isReady = selectedPicking.state === 'assigned';
        const isDone = selectedPicking.state === 'done';
        const isDraft = selectedPicking.state === 'draft';

        return (
            <>
                <HudStyles />
                {/* Live Agent Status Bar */}
                {isAgentRunning && (
                    <div className="bg-white/95 backdrop-blur-md border-b border-cyan-200 px-4 py-2 flex items-center justify-between text-xs font-mono shadow-[0_2px_20px_rgba(34,211,238,0.15)] sticky top-0 z-50">
                        <div className="flex items-center gap-3 text-slate-600">
                            <ReactorCore size={20} live />
                            <span className="font-black text-slate-800 hud-readout uppercase">Live Automation Agent // Active</span>
                            <span className="text-slate-300">—</span>
                            <span className="text-cyan-600 font-bold">{agentStatusText}</span>
                        </div>
                        <button
                            onClick={stopLiveAgent}
                            className="hud-btn px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] cursor-pointer"
                        >
                            ⏹ หยุด Agent ทันที
                        </button>
                    </div>
                )}
                <div
                    className="min-h-screen text-slate-800 font-sans flex flex-col w-full"
                    style={{
                        backgroundImage: 'linear-gradient(180deg,#f8fafc 0%,#ffffff 40%,#ecfeff 100%), repeating-linear-gradient(0deg, rgba(56,189,248,.045) 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, rgba(56,189,248,.045) 0 1px, transparent 1px 44px)'
                    }}
                >
                    {/* 1. Breadcrumbs */}
                    <div className="bg-white/90 backdrop-blur-sm border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-mono">
                        <div className="flex items-center gap-2 text-slate-400">
                            <button onClick={() => setViewMode('list')} className="hover:text-cyan-600 font-semibold flex items-center gap-1 cursor-pointer transition-colors">
                                Inventory Overview
                            </button>
                            <span>/</span>
                            <span className="hover:text-cyan-600 cursor-pointer transition-colors">{currentCompanyName}: Transfer IN</span>
                            <span>/</span>
                            <span className="text-slate-700 font-bold">To Do</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 text-slate-400">
                                <span>{selectedPickingIndex + 1} / {filteredPickings.length}</span>
                                <button onClick={() => handleNavPicking(-1)} disabled={selectedPickingIndex === 0} className="p-1 hover:bg-cyan-50 hover:text-cyan-600 rounded disabled:opacity-30 cursor-pointer transition-colors">
                                    <ChevronLeft size={16} />
                                </button>
                                <button onClick={() => handleNavPicking(1)} disabled={selectedPickingIndex === filteredPickings.length - 1} className="p-1 hover:bg-cyan-50 hover:text-cyan-600 rounded disabled:opacity-30 cursor-pointer transition-colors">
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                            <button onClick={() => setViewMode('list')} className="hud-btn px-3 py-1 bg-white hover:bg-slate-50 text-slate-600 font-bold cursor-pointer border border-slate-200">
                                ✕ ปิดหน้านี้
                            </button>
                        </div>
                    </div>

                    {/* 2. Action Bar + Status Readout */}
                    <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Print Pick</button>
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Print Grn</button>
                            <button
                                onClick={() => setShowValidateModal(true)}
                                disabled={isDone}
                                className={`hud-btn px-4 py-1.5 cursor-pointer font-black transition-all ${isDone
                                    ? 'bg-emerald-50 text-emerald-500 border border-emerald-200 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_0_16px_rgba(34,211,238,0.45)] hover:shadow-[0_0_24px_rgba(34,211,238,0.65)]'
                                    }`}
                            >
                                {isDone ? '✓ Validated' : '⚡ Validate'}
                            </button>
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Print</button>
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Return</button>
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-rose-50 hover:text-rose-500 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Cancel</button>
                            <button className="hud-btn px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 cursor-pointer transition-colors">Wave Split</button>
                        </div>
                        <div className="hud-panel-sm px-4 py-2 bg-slate-50/60">
                            <StatusReadout isDraft={isDraft} isReady={isReady} isDone={isDone} />
                        </div>
                    </div>

                    {/* 3. Main Body */}
                    <div className="flex-1 flex flex-col lg:flex-row w-full overflow-hidden">
                        <div className="flex-1 p-6 overflow-y-auto space-y-6">
                            {/* Title */}
                            <div className="flex items-center gap-3">
                                <ReactorCore size={34} />
                                <div>
                                    <p className="text-[10px] hud-readout uppercase font-bold text-cyan-500 mb-0.5">Transfer Record</p>
                                    <h1 className="text-3xl font-black text-slate-800 tracking-tight font-mono leading-none">
                                        {selectedPicking.name}
                                    </h1>
                                </div>
                                <Star size={20} className="text-slate-300 hover:text-amber-400 cursor-pointer transition-colors ml-1" />
                            </div>

                            {/* Field sheet */}
                            <HudPanel live={isReady} className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 text-xs font-mono">
                                <div className="space-y-4">
                                    <Field label="Receive From" value={Array.isArray(selectedPicking.partner_id) ? selectedPicking.partner_id[1] : 'I-Furniture Co., Ltd'} strong />
                                    <Field label="Source Location" value={Array.isArray(selectedPicking.location_id) ? selectedPicking.location_id[1] : 'Inter-company transit'} />
                                    <Field label="Destination Location" value={Array.isArray(selectedPicking.location_dest_id) ? selectedPicking.location_dest_id[1] : 'WI999999'} tone="cyan" />
                                    <div className="grid grid-cols-3 items-center">
                                        <span className="text-slate-400 font-semibold hud-readout uppercase text-[10px]">Bill reference</span>
                                        <span className="col-span-2 font-bold text-amber-600 text-sm bg-amber-50 px-2.5 py-1 border border-amber-200 inline-block hud-btn">
                                            {selectedPicking.bill_reference || '-'}
                                        </span>
                                    </div>
                                    <Field label="Operation Type" value={Array.isArray(selectedPicking.picking_type_id) ? selectedPicking.picking_type_id[1] : `${currentCompanyName}: Transfer IN`} />
                                    <Field label="Type of Operation" value="Receipt" />
                                </div>
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 items-center">
                                        <span className="text-slate-400 font-semibold hud-readout uppercase text-[10px]">Scheduled ❓</span>
                                        <span className="col-span-2 font-bold text-rose-500 text-sm bg-rose-50 px-2 py-1 border border-rose-200 hud-btn">
                                            {selectedPicking.scheduled_date || '10/06/2026 09:53:09'}
                                        </span>
                                    </div>
                                    <Field label="Source Document ❓" value={selectedPicking.origin || '00001RO1710400042606'} tone="amber" />
                                    <Field label="Picking List No." value={selectedPicking.picking_list_no || '-'} muted />
                                    <Field label="Assign Owner ❓" value={selectedPicking.owner_id || '-'} muted />
                                </div>
                            </HudPanel>

                            {/* Tabs */}
                            <div className="space-y-4">
                                <div className="flex border-b border-slate-200 text-xs font-bold gap-6 font-mono hud-readout uppercase">
                                    {[
                                        { id: 'operations', label: 'Operations' },
                                        { id: 'additional', label: 'Additional Info' },
                                        { id: 'note', label: 'Note' },
                                        { id: 'employee', label: 'Employee History' }
                                    ].map(tab => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`pb-2.5 transition-all cursor-pointer border-b-2 ${activeTab === tab.id ? 'border-cyan-400 text-cyan-600' : 'border-transparent text-slate-400 hover:text-slate-600'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>

                                {activeTab === 'operations' && (
                                    <HudPanel live={!isItemsLoading && pickingItems.length > 0}>
                                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center text-[11px] text-slate-400 font-mono hud-readout">
                                            <span>ITEMS 1–{pickingItems.length} / {pickingItems.length}</span>
                                            <span className="text-cyan-500 uppercase">move_ids_without_package · stock.move</span>
                                        </div>

                                        {isItemsLoading ? (
                                            <div className="py-16 text-center">
                                                <div className="flex justify-center"><ReactorCore size={32} live /></div>
                                                <p className="text-xs text-slate-400 font-medium mt-3 font-mono hud-readout uppercase">ກຳລັງໂຫຼດລາຍການສິນຄ້າ...</p>
                                            </div>
                                        ) : pickingItems.length === 0 ? (
                                            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                                                <p className="text-2xl">📭</p>
                                                <p className="font-semibold text-slate-500">ບໍ່ພົບລາຍການສິນຄ້າໃນບິນນີ້</p>
                                                <p className="text-slate-400 text-[11px] font-mono">picking_id: {selectedPicking?.id} | state: {selectedPicking?.state}</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-left border-collapse text-xs">
                                                    <thead>
                                                        <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold border-b border-slate-200 font-mono hud-readout">
                                                            <th className="py-3 px-4 w-10 text-center">#</th>
                                                            <th className="py-3 px-4 w-14 text-center">📷</th>
                                                            <th className="py-3 px-4">Barcode</th>
                                                            <th className="py-3 px-4">Product / Description</th>
                                                            <th className="py-3 px-4 text-right">Demand</th>
                                                            <th className="py-3 px-4 text-right">Done</th>
                                                            <th className="py-3 px-4 text-center">UoM</th>
                                                            <th className="py-3 px-4 text-center">State</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {pickingItems.map((item, i) => {
                                                            const isExceeded = item.resolvedDoneQty > item.resolvedDemandQty;
                                                            const uomName = Array.isArray(item.product_uom)
                                                                ? item.product_uom[1]
                                                                : (Array.isArray(item.product_uom_id) ? item.product_uom_id[1] : 'Unit');
                                                            return (
                                                                <tr key={item.id} className="hover:bg-cyan-50/40 transition-colors">
                                                                    <td className="py-3 px-4 text-center text-slate-400 font-mono font-bold text-[11px]">{i + 1}</td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <div className="hud-btn w-9 h-9 bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-300 mx-auto text-base">📷</div>
                                                                    </td>
                                                                    <td className="py-3 px-4 font-mono font-bold text-amber-600 text-[12px]">{item.barcode}</td>
                                                                    <td className="py-3 px-4 text-slate-700 font-semibold max-w-[280px]">
                                                                        <p className="leading-snug">{item.productName}</p>
                                                                        {item.description_picking && <p className="text-slate-400 text-[10px] mt-0.5">{item.description_picking}</p>}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-right font-black text-slate-800 font-mono">{item.resolvedDemandQty.toFixed(2)}</td>
                                                                    <td className={`py-3 px-4 text-right font-black font-mono ${isExceeded ? 'text-rose-500' : item.resolvedDoneQty > 0 ? 'text-emerald-500' : 'text-slate-300'}`}>
                                                                        {item.resolvedDoneQty.toFixed(2)}
                                                                        {isExceeded && <span className="ml-1 text-[10px]">⚠</span>}
                                                                    </td>
                                                                    <td className="py-3 px-4 text-center text-slate-400 text-[11px]">{uomName}</td>
                                                                    <td className="py-3 px-4 text-center">
                                                                        <span className={`inline-block px-2 py-0.5 hud-btn text-[10px] font-bold border font-mono ${item.state === 'done' ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                                                            : item.state === 'assigned' ? 'bg-cyan-50 text-cyan-600 border-cyan-200'
                                                                                : 'bg-slate-50 text-slate-400 border-slate-200'
                                                                            }`}>
                                                                            {item.state || '?'}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </HudPanel>
                                )}

                                {activeTab !== 'operations' && (
                                    <HudPanel className="p-6 text-xs text-slate-400 font-mono">
                                        <p className="font-semibold text-slate-600 mb-1 hud-readout uppercase">Tab: {activeTab}</p>
                                        <p>Read-only details for {activeTab} section in Odoo 18.</p>
                                    </HudPanel>
                                )}
                            </div>
                        </div>

                        {/* Chatter panel */}
                        <div className="w-full lg:w-80 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 p-4 space-y-4 overflow-y-auto shrink-0">
                            <div className="flex gap-2">
                                <button className="hud-btn flex-1 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-xs font-bold cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.35)]">Send message</button>
                                <button className="hud-btn flex-1 py-1.5 bg-white text-slate-600 text-xs font-bold cursor-pointer border border-slate-200">Log note</button>
                                <button className="hud-btn py-1.5 px-3 bg-white text-slate-600 text-xs font-bold cursor-pointer border border-slate-200">Activities</button>
                            </div>
                            <div className="border-t border-slate-100 pt-4 space-y-3">
                                <div className="text-[11px] font-bold text-slate-400 hud-readout uppercase font-mono">Jun 10, 2026</div>
                                <div className="hud-panel-sm flex gap-3 text-xs bg-slate-50 p-3">
                                    <div className="w-7 h-7 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 shrink-0">🤖</div>
                                    <div>
                                        <p className="font-bold text-slate-700">System Admin</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                            This lod stock - lock source & destination locations has been created from: <span className="text-cyan-600 font-mono">00001RO1710400042606</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="hud-panel-sm flex gap-3 text-xs bg-slate-50 p-3">
                                    <div className="w-7 h-7 bg-cyan-100 rounded-full flex items-center justify-center text-cyan-600 shrink-0">🤖</div>
                                    <div>
                                        <p className="font-bold text-slate-700">System Admin</p>
                                        <p className="text-[11px] text-slate-400 mt-0.5">LOD Stock - Lock Source & Destination Locations created</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {showValidateModal && (
                    <OdooValidateModal
                        picking={selectedPicking}
                        pickingItems={pickingItems}
                        onClose={() => setShowValidateModal(false)}
                        onSuccess={() => {
                            setShowValidateModal(false);
                            setSelectedPicking(prev => prev ? { ...prev, state: 'done' } : prev);
                            loadPickings();
                        }}
                    />
                )}
            </>
        );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // RENDER LIST VIEW
    // ──────────────────────────────────────────────────────────────────────────
    return (
        <div
            className="min-h-screen text-slate-800 font-sans p-4 sm:p-6 w-full"
            style={{
                backgroundImage: 'linear-gradient(180deg,#f8fafc 0%,#ffffff 40%,#ecfeff 100%), repeating-linear-gradient(0deg, rgba(56,189,248,.045) 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, rgba(56,189,248,.045) 0 1px, transparent 1px 44px)'
            }}
        >
            <HudStyles />
            {/* Top Navigation */}
            <div className="w-full mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="hud-btn p-2.5 bg-white hover:bg-slate-50 border border-slate-200 transition-all text-slate-500 hover:text-cyan-600 cursor-pointer">
                        <ArrowLeft size={20} />
                    </button>
                    <ReactorCore size={38} />
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="hud-btn px-2 py-0.5 text-[10px] font-extrabold uppercase bg-cyan-50 text-cyan-600 border border-cyan-200 font-mono hud-readout">
                                Odoo 18 · Direct Read-Only
                            </span>
                            <span className="text-xs text-slate-400 font-mono">stock.picking</span>
                        </div>
                        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 mt-0.5">
                            Inventory Transfers IN <span className="font-mono text-sm text-slate-400 font-bold">// ໃບຮັບສິນຄ້າເຂົ້າສາງ</span>
                        </h1>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {selectedIds.size > 0 && !isAgentRunning && (
                        <button onClick={startLiveAgent} className="hud-btn flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_0_18px_rgba(34,211,238,0.45)] transition-all text-xs font-black cursor-pointer">
                            <ReactorCore size={16} live /> รัน Live Agent ({selectedIds.size} บิล)
                        </button>
                    )}
                    {isAgentRunning && (
                        <button onClick={stopLiveAgent} className="hud-btn flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white shadow-md transition-all text-xs font-black cursor-pointer">
                            ⏹ หยุด Live Agent
                        </button>
                    )}
                    <button onClick={loadPickings} disabled={isLoading || isAgentRunning} className="hud-btn flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:border-cyan-300 hover:text-cyan-600 text-slate-600 transition-all text-xs font-bold cursor-pointer disabled:opacity-40">
                        <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} /> รีเฟรช Odoo
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="w-full mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <HudPanel small className="p-4 flex items-center gap-3">
                    <Building2 className="text-cyan-500 shrink-0" size={22} />
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-bold hud-readout uppercase mb-1 font-mono">ເລືອກສາຂາ (Company)</label>
                        <select
                            value={selectedCompanyId}
                            onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
                            className="w-full bg-white border border-slate-200 hud-btn px-3 py-2 text-xs text-slate-800 font-bold focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 cursor-pointer"
                        >
                            {ODOO_COMPANIES.map(c => (
                                <option key={c.id} value={c.id}>{c.label} — {c.name}</option>
                            ))}
                        </select>
                    </div>
                </HudPanel>

                <HudPanel small className="p-4 flex items-center gap-3">
                    <Filter className="text-blue-400 shrink-0" size={22} />
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-bold hud-readout uppercase mb-1 font-mono">ສະຖານະ (Status)</label>
                        <div className="flex gap-1.5">
                            {[
                                { id: 'all', label: 'ทั้งหมด' },
                                { id: 'assigned', label: 'Ready' },
                                { id: 'done', label: 'Done' },
                                { id: 'cancel', label: 'Cancel' }
                            ].map(st => (
                                <button
                                    key={st.id}
                                    onClick={() => setStatusFilter(st.id)}
                                    className={`hud-btn px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${statusFilter === st.id
                                        ? 'bg-gradient-to-r from-cyan-400 to-blue-500 text-white shadow-[0_0_10px_rgba(34,211,238,0.4)]'
                                        : 'bg-white text-slate-400 border border-slate-200 hover:text-cyan-600 hover:border-cyan-200'
                                        }`}
                                >
                                    {st.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </HudPanel>

                <HudPanel small className="p-4 flex items-center gap-3">
                    <Search className="text-slate-300 shrink-0" size={22} />
                    <div className="flex-1">
                        <label className="block text-[10px] text-slate-400 font-bold hud-readout uppercase mb-1 font-mono">ຄົ້ນຫາ Reference</label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="พิมพ์เลขบิล หรือ Contact..."
                            className="w-full bg-white border border-slate-200 hud-btn px-3 py-2 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 font-semibold"
                        />
                    </div>
                </HudPanel>
            </div>

            {/* Table */}
            <div className="w-full">
                <HudPanel live={!isLoading && filteredPickings.length > 0}>
                    <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                        <div className="flex items-center gap-3">
                            <FileText size={16} className="text-cyan-500" />
                            <span className="text-xs font-bold text-slate-600 font-mono hud-readout uppercase">
                                Transfer IN · {filteredPickings.length} บิล
                            </span>
                            <button
                                onClick={() => {
                                    const readyIds = filteredPickings.filter(p => p.state === 'assigned').map(p => p.id);
                                    if (selectedIds.size === readyIds.length && readyIds.length > 0) setSelectedIds(new Set());
                                    else setSelectedIds(new Set(readyIds));
                                }}
                                className="hud-btn px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-cyan-50 text-cyan-600 border border-slate-200 hover:border-cyan-200 transition-all cursor-pointer"
                            >
                                {selectedIds.size > 0 ? '✕ ยกเลิกทั้งหมด' : '☑ เลือก Ready ทั้งหมด'}
                            </button>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                            {selectedIds.size > 0 ? `เลือกไว้ ${selectedIds.size} รายการ` : 'Read-Only Direct API'}
                        </span>
                    </div>

                    {isLoading ? (
                        <div className="py-20 text-center">
                            <div className="flex justify-center"><ReactorCore size={36} live /></div>
                            <p className="text-xs text-slate-400 font-medium mt-3 font-mono hud-readout uppercase">Loading Transfer IN...</p>
                        </div>
                    ) : errorMsg ? (
                        <div className="py-16 text-center px-4">
                            <AlertCircle size={32} className="text-rose-400 mx-auto mb-2" />
                            <p className="text-sm font-semibold text-rose-500 mb-1">{errorMsg}</p>
                            <p className="text-xs text-slate-400">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือ Session Odoo</p>
                        </div>
                    ) : filteredPickings.length === 0 ? (
                        <div className="py-16 text-center text-slate-400">
                            <PackageCheck size={36} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">ไม่พบรายการบิล Transfer IN ตามเงื่อนไขที่เลือก</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-400 text-[10px] font-bold uppercase border-b border-slate-200 font-mono hud-readout">
                                        <th className="py-3 px-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={filteredPickings.length > 0 && selectedIds.size === filteredPickings.filter(p => p.state === 'assigned').length}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedIds(new Set(filteredPickings.filter(p => p.state === 'assigned').map(p => p.id)));
                                                    else setSelectedIds(new Set());
                                                }}
                                                className="rounded border-slate-300 bg-white text-cyan-500 focus:ring-cyan-300 cursor-pointer"
                                            />
                                        </th>
                                        <th className="py-3 px-4 w-12 text-center">#</th>
                                        <th className="py-3 px-4">Reference</th>
                                        <th className="py-3 px-4">Bill Reference</th>
                                        <th className="py-3 px-4">From</th>
                                        <th className="py-3 px-4">To</th>
                                        <th className="py-3 px-4">Contact</th>
                                        <th className="py-3 px-4">Scheduled Date</th>
                                        <th className="py-3 px-4">Source Document</th>
                                        <th className="py-3 px-4 text-center">Status</th>
                                        <th className="py-3 px-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredPickings.map((p, idx) => {
                                        const fromName = Array.isArray(p.location_id) ? p.location_id[1] : '-';
                                        const toName = Array.isArray(p.location_dest_id) ? p.location_dest_id[1] : '-';
                                        const contactName = Array.isArray(p.partner_id) ? p.partner_id[1] : '-';
                                        const isReady = p.state === 'assigned';
                                        const isDone = p.state === 'done';
                                        const isCancel = p.state === 'cancel';
                                        return (
                                            <tr key={p.id} className={`hover:bg-cyan-50/40 transition-colors ${selectedIds.has(p.id) ? 'bg-cyan-50/70' : ''}`}>
                                                <td className="py-3 px-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        disabled={p.state !== 'assigned'}
                                                        checked={selectedIds.has(p.id)}
                                                        onChange={(e) => {
                                                            const next = new Set(selectedIds);
                                                            if (e.target.checked) next.add(p.id); else next.delete(p.id);
                                                            setSelectedIds(next);
                                                        }}
                                                        className="rounded border-slate-300 bg-white text-cyan-500 focus:ring-cyan-300 cursor-pointer disabled:opacity-30"
                                                    />
                                                </td>
                                                <td className="py-3 px-4 text-center text-slate-400 font-mono">{idx + 1}</td>
                                                <td className="py-3 px-4 font-bold text-slate-800 font-mono">{p.name}</td>
                                                <td className="py-3 px-4 text-slate-600">{fromName}</td>
                                                <td className="py-3 px-4 text-slate-600 font-mono">{toName}</td>
                                                <td className="py-3 px-4 text-slate-600">{contactName}</td>
                                                <td className="py-3 px-4">
                                                    <span className={`text-[11px] font-medium font-mono ${formatTimeAgo(p.scheduled_date).includes('ago') ? 'text-rose-500' : 'text-slate-500'}`}>
                                                        {formatTimeAgo(p.scheduled_date)}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-slate-400">{p.origin || '/'}</td>
                                                <td className="py-3 px-4 text-center">
                                                    {isReady && <span className="hud-btn inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-cyan-50 text-cyan-600 border border-cyan-200 font-mono"><Clock size={11} /> Ready</span>}
                                                    {isDone && <span className="hud-btn inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 font-mono"><CheckCircle2 size={11} /> Done</span>}
                                                    {isCancel && <span className="hud-btn inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200 font-mono"><XCircle size={11} /> Cancel</span>}
                                                    {!isReady && !isDone && !isCancel && <span className="hud-btn inline-flex items-center px-2 py-0.5 text-[11px] bg-slate-100 text-slate-400 border border-slate-200 font-mono">{p.state}</span>}
                                                </td>
                                                <td className="py-3 px-4 text-center">
                                                    <button onClick={() => handleOpenFormView(p, idx)} className="hud-btn inline-flex items-center gap-1 px-3 py-1.5 bg-cyan-50 hover:bg-cyan-100 text-cyan-600 border border-cyan-200 text-xs font-bold transition-all cursor-pointer">
                                                        <Eye size={13} /> เปิดดูบิล
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </HudPanel>
            </div>

            {/* Error popup */}
            {agentErrorHalt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md">
                    <HudPanel className="w-full max-w-lg p-8 text-center space-y-5">
                        <div className="flex justify-center"><ReactorCore size={40} /></div>
                        <div>
                            <h3 className="text-2xl font-black text-slate-800">พบข้อผิดพลาด! Agent หยุดทำงานชั่วคราว</h3>
                            <p className="text-xs text-rose-500/80 mt-1 font-mono">ระบบเบรกการทำงานอัตโนมัติเพื่อป้องกันข้อมูลใน Odoo ผิดพลาด</p>
                        </div>
                        <div className="hud-panel-sm bg-slate-50 border-none p-4 text-left font-mono text-xs space-y-2">
                            <div className="flex justify-between border-b border-rose-100 pb-2">
                                <span className="text-slate-400">บิลที่มีปัญหา:</span>
                                <span className="font-bold text-slate-800">{agentErrorHalt.picking?.name} (ID: {agentErrorHalt.picking?.id})</span>
                            </div>
                            <div className="space-y-1">
                                <span className="text-rose-500 font-bold">ข้อความ Error:</span>
                                <p className="text-rose-600 bg-rose-50 p-3 border border-rose-200 text-[11px] leading-relaxed break-all hud-btn">{agentErrorHalt.message}</p>
                            </div>
                        </div>
                        <button onClick={stopLiveAgent} className="hud-btn w-full py-3 bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs cursor-pointer transition-colors">
                            เข้าใจแล้ว — ปิดหน้าจอนี้
                        </button>
                    </HudPanel>
                </div>
            )}

            {/* Summary report */}
            {agentSummaryReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md">
                    <HudPanel className="w-full max-w-lg p-6 space-y-5">
                        <div className="text-center">
                            <div className="flex justify-center mb-2"><ReactorCore size={40} /></div>
                            <h3 className="text-xl font-black text-slate-800">Agent ทำงานเสร็จสมบูรณ์!</h3>
                            <p className="text-xs text-slate-400 mt-1 font-mono">สรุปผลการทำงานทั้งหมดของ Live Automation Agent</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="hud-panel-sm bg-emerald-50 border-none p-4 text-center">
                                <p className="text-3xl font-black text-emerald-500 font-mono">{agentSummaryReport.success.length}</p>
                                <p className="text-xs text-emerald-600 font-bold mt-1">✓ Validate สำเร็จ</p>
                            </div>
                            <div className="hud-panel-sm bg-amber-50 border-none p-4 text-center">
                                <p className="text-3xl font-black text-amber-500 font-mono">{agentSummaryReport.skipped.length}</p>
                                <p className="text-xs text-amber-600 font-bold mt-1">⚠ ไม่มี Bill Reference</p>
                            </div>
                        </div>
                        {agentSummaryReport.skipped.length > 0 && (
                            <div className="hud-panel-sm bg-slate-50 border-none p-4 space-y-2">
                                <p className="text-xs font-black text-amber-600 hud-readout uppercase font-mono">⚠ รายการที่ถูกข้าม</p>
                                <div className="max-h-40 overflow-y-auto space-y-1.5">
                                    {agentSummaryReport.skipped.map((p) => (
                                        <div key={p.id} className="hud-btn flex justify-between items-center text-xs font-mono bg-amber-50 px-3 py-2 border border-amber-100">
                                            <span className="font-bold text-slate-800">{p.name}</span>
                                            <span className="text-amber-600 text-[11px]">{p.reason}</span>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">กรุณาตรวจสอบและใส่ Bill reference ใน Odoo ก่อน แล้วค่อยรัน Agent ใหม่ครับ</p>
                            </div>
                        )}
                        <button onClick={() => setAgentSummaryReport(null)} className="hud-btn w-full py-3 bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-black text-sm shadow-[0_0_16px_rgba(34,211,238,0.4)] cursor-pointer transition-all">
                            รับทราบ — ปิดรายงาน
                        </button>
                    </HudPanel>
                </div>
            )}
        </div>
    );
}