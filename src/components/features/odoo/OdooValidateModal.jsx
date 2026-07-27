import React, { useState } from 'react';
import {
    AlertTriangle, CheckCircle2, XCircle, Loader2, PackageCheck,
    ArrowRight, Info, ShieldAlert
} from 'lucide-react';
import { validateOdooPickingNoBackorder } from '../../../services/odooTransferApi';

/**
 * OdooValidateModal
 * Modal ยืนยัน + Execute การ Validate stock.picking ใน Odoo 18
 * Policy: No Backorder (ตามนโยบายหัวหน้า)
 * 
 * Props:
 *   picking       – picking object ที่จะ validate
 *   pickingItems  – รายการสินค้าใน picking
 *   onClose       – fn เมื่อปิด modal
 *   onSuccess     – fn(result) เมื่อ validate สำเร็จ
 */
export default function OdooValidateModal({ picking, pickingItems, onClose, onSuccess }) {
    // phase: 'confirm' | 'loading' | 'success' | 'error'
    const [phase, setPhase] = useState('confirm');
    const [result, setResult] = useState(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [progress, setProgress] = useState({ percent: 0, currentBatch: 1, totalBatches: 1, text: 'กำลังเตรียมข้อมูล...' });

    if (!picking) return null;

    const totalDemand = pickingItems.reduce((s, i) => s + (i.resolvedDemandQty || 0), 0);
    const totalDone = pickingItems.reduce((s, i) => s + (i.resolvedDoneQty || 0), 0);
    const hasShortage = totalDone < totalDemand;
    const shortageCount = pickingItems.filter(i => (i.resolvedDoneQty || 0) < (i.resolvedDemandQty || 0)).length;
    const emptyCount = pickingItems.filter(i => (i.resolvedDoneQty || 0) === 0).length;

    const handleValidate = async () => {
        setPhase('loading');
        try {
            const res = await validateOdooPickingNoBackorder(picking.id, (progressInfo) => {
                setProgress(progressInfo);
            });
            setResult(res);
            setPhase('success');
            // แจ้ง parent หลัง 1.5 วิ
            setTimeout(() => onSuccess?.(res), 1500);
        } catch (err) {
            console.error('[OdooValidateModal] validate error:', err);
            setErrorMsg(err.message || 'เกิดข้อผิดพลาดระหว่าง validate');
            setPhase('error');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

                {/* ── Header ── */}
                <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-900/60 border border-purple-700 flex items-center justify-center shrink-0">
                        <PackageCheck size={20} className="text-purple-300" />
                    </div>
                    <div>
                        <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Odoo 18 — stock.picking.button_validate</p>
                        <h2 className="text-base font-black text-white">Validate Transfer</h2>
                    </div>
                </div>

                {/* ── PHASE: CONFIRM ── */}
                {phase === 'confirm' && (
                    <div className="p-6 space-y-5">
                        {/* Picking info card */}
                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Reference</span>
                                <span className="font-black text-white font-mono">{picking.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Source Document</span>
                                <span className="font-bold text-amber-300 font-mono text-xs">{picking.origin || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Total Items</span>
                                <span className="font-bold text-white">{pickingItems.length} รายการ</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400 text-xs">Demand / Done</span>
                                <span className="font-mono font-bold">
                                    <span className="text-white">{totalDemand.toFixed(0)}</span>
                                    <span className="text-slate-500 mx-1">/</span>
                                    <span className={totalDone < totalDemand ? 'text-rose-400' : 'text-emerald-400'}>
                                        {totalDone.toFixed(0)}
                                    </span>
                                </span>
                            </div>
                        </div>

                        {/* Warning: qty shortage */}
                        {hasShortage && (
                            <div className="bg-amber-950/50 border border-amber-700/60 rounded-xl p-4 space-y-1.5">
                                <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                                    <AlertTriangle size={16} />
                                    <span>สินค้าไม่ครบตาม Demand</span>
                                </div>
                                <p className="text-amber-200/70 text-xs leading-relaxed">
                                    มี <strong className="text-amber-300">{shortageCount} รายการ</strong> ที่ Done น้อยกว่า Demand
                                    {emptyCount > 0 && <> (รวมถึง <strong className="text-rose-400">{emptyCount} รายการ</strong> ที่ยังไม่ได้รับเลย)</>}
                                </p>
                                <div className="mt-2 flex items-start gap-2 text-xs text-slate-300 bg-slate-900/60 rounded-lg p-2.5 border border-slate-700">
                                    <Info size={13} className="text-blue-400 shrink-0 mt-0.5" />
                                    <span>Odoo จะแสดง <strong>Create Backorder?</strong> dialog — ระบบนี้จะกด <strong className="text-cyan-300">No Backorder</strong> อัตโนมัติตามนโยบายหัวหน้า</span>
                                </div>
                            </div>
                        )}

                        {/* Policy reminder */}
                        <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-800/40 rounded-xl p-3 border border-slate-700/50">
                            <ShieldAlert size={13} className="text-purple-400 shrink-0 mt-0.5" />
                            <span>การ Validate จะเปลี่ยน state บิลเป็น <strong className="text-emerald-400">Done</strong> ใน Odoo จริง — ไม่สามารถย้อนกลับได้ง่าย</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleValidate}
                                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-black text-sm rounded-xl shadow-lg shadow-purple-900/40 transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                <PackageCheck size={16} />
                                ยืนยัน Validate
                                <ArrowRight size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PHASE: LOADING ── */}
                {phase === 'loading' && (
                    <div className="p-8 text-center space-y-5">
                        <div className="relative inline-block">
                            <div className="w-16 h-16 rounded-full bg-purple-900/40 border-2 border-purple-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-900/30">
                                <Loader2 size={30} className="text-purple-400 animate-spin" />
                            </div>
                        </div>
                        <div>
                            <p className="text-white font-black text-base">กำลัง Validate บิลแบบแบ่ง Batch Smart Process...</p>
                            <p className="text-slate-400 text-xs mt-1">กำลังประมวลผลคำสั่งทีละ Batch ไปยัง Odoo 18 Server</p>
                            <p className="text-purple-300 font-mono font-bold text-xs mt-1">{picking.name}</p>
                        </div>

                        {/* Smart Progress Bar */}
                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-center text-xs font-bold font-mono">
                                <span className="text-purple-400">{progress.text || 'กำลังประมวลผล...'}</span>
                                <span className="text-white bg-purple-950 px-2 py-0.5 rounded border border-purple-800">
                                    {Math.min(100, Math.max(0, progress.percent || 0))}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700 p-0.5">
                                <div
                                    className="bg-gradient-to-r from-purple-600 to-indigo-400 h-full rounded-full transition-all duration-300 shadow-md shadow-purple-500/50"
                                    style={{ width: `${Math.min(100, Math.max(5, progress.percent || 0))}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] text-slate-500 font-mono pt-1">
                                <span>Batch {progress.currentBatch || 1} / {progress.totalBatches || 1}</span>
                                <span>บิลมี {pickingItems.length} รายการ (แบ่ง batch ละ 50)</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── PHASE: SUCCESS ── */}
                {phase === 'success' && (
                    <div className="p-10 text-center space-y-4">
                        <div className="w-16 h-16 rounded-full bg-emerald-900/40 border-2 border-emerald-500 flex items-center justify-center mx-auto">
                            <CheckCircle2 size={28} className="text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-emerald-300 font-black text-lg">Validate สำเร็จ! ✅</p>
                            <p className="text-slate-400 text-xs mt-1">บิล <span className="font-mono text-white">{picking.name}</span> เปลี่ยนเป็น <span className="text-emerald-400 font-bold">Done</span> แล้ว</p>
                        </div>
                        {result?.hadBackorder && (
                            <div className="text-xs text-slate-400 bg-slate-800 rounded-xl p-3 border border-slate-700 max-w-xs mx-auto">
                                <p>📋 Backorder wizard ถูกยกเลิก (No Backorder)</p>
                                {result.emptyMoveCount > 0 && <p className="text-rose-400 mt-1">• {result.emptyMoveCount} รายการไม่ได้รับเลย</p>}
                                {result.partialMoveCount > 0 && <p className="text-amber-400 mt-0.5">• {result.partialMoveCount} รายการรับไม่ครบ</p>}
                            </div>
                        )}
                        <p className="text-slate-500 text-[11px]">กำลังปิดหน้าต่างนี้...</p>
                    </div>
                )}

                {/* ── PHASE: ERROR ── */}
                {phase === 'error' && (
                    <div className="p-8 space-y-4">
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-full bg-rose-900/40 border-2 border-rose-600 flex items-center justify-center mx-auto mb-3">
                                <XCircle size={28} className="text-rose-400" />
                            </div>
                            <p className="text-rose-300 font-black text-base">Validate ล้มเหลว ❌</p>
                        </div>
                        <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4">
                            <p className="text-rose-300 text-xs font-mono leading-relaxed break-all">{errorMsg}</p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl border border-slate-700 transition-all cursor-pointer"
                            >
                                ปิด
                            </button>
                            <button
                                onClick={() => setPhase('confirm')}
                                className="flex-1 py-2.5 bg-rose-900 hover:bg-rose-800 text-rose-100 font-bold text-sm rounded-xl border border-rose-700 transition-all cursor-pointer"
                            >
                                ลองใหม่
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
