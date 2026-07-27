import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Pause, Square, AlertCircle, CheckCircle2, Loader2, Bot,
    Clock, ArrowRight, Frown, ShieldAlert, Sparkles
} from 'lucide-react';
import { fetchOdooPickingItems, fetchProductBarcodesMap, validateOdooPickingNoBackorder } from '../../../services/odooTransferApi';

/**
 * OdooAutoAgentModal
 * ระบบ Auto Validate Agent ช่วยรัน Validate บิลอัตโนมัติทีละบิล
 * - แสดง visual จำลองการทำงานของคน
 * - Delay 5 วินาทีระหว่างบิล
 * - หากเจอ Error จะหยุดทำงานทันทีพร้อมขึ้น Popup หน้าจอ :( สไตล์ครีเอทีฟ
 */
export default function OdooAutoAgentModal({ selectedPickings, onClose, onRefreshList }) {
    // state: 'running' | 'paused' | 'error_halt' | 'completed'
    const [agentState, setAgentState] = useState('running');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [successCount, setSuccessCount] = useState(0);
    const [failedCount, setFailedCount] = useState(0);
    
    // บิลปัจจุบันที่กำลังทำงาน
    const [currentPicking, setCurrentPicking] = useState(null);
    const [currentItems, setCurrentItems] = useState([]);
    const [isLoadingItems, setIsLoadingItems] = useState(false);
    
    // Status text & countdown
    const [statusText, setStatusText] = useState('กำลังเริ่มต้นระบบ Agent...');
    const [countdown, setCountdown] = useState(0);
    const [errorInfo, setErrorInfo] = useState(null);

    const isCancelledRef = useRef(false);
    const isPausedRef = useRef(false);

    // Sync refs
    useEffect(() => {
        isPausedRef.current = (agentState === 'paused');
    }, [agentState]);

    // Main Agent Loop
    useEffect(() => {
        let isMounted = true;
        isCancelledRef.current = false;

        const runAgentLoop = async () => {
            if (selectedPickings.length === 0) return;

            for (let i = 0; i < selectedPickings.length; i++) {
                if (isCancelledRef.current) break;

                // รอหากอยู่ในสถานะ Paused
                while (isPausedRef.current) {
                    if (isCancelledRef.current) break;
                    await new Promise(r => setTimeout(r, 500));
                }

                if (isCancelledRef.current) break;

                const picking = selectedPickings[i];
                setCurrentIndex(i);
                setCurrentPicking(picking);

                // Step 1: จำลองคนกดคลิกเปิดบิล (Form View)
                setStatusText(`[บิลที่ ${i + 1}/${selectedPickings.length}] 🖱️ กำลังเปิดบิล ${picking.name}...`);
                setIsLoadingItems(true);
                await new Promise(r => setTimeout(r, 2000)); // หน่วง 2 วินาที (อ่านหัวบิล)

                // Step 2: ดึงและแสดงรายการสินค้า (จำลองคนนั่งกวาดสายตาตรวจสินค้า)
                setStatusText(`[บิลที่ ${i + 1}/${selectedPickings.length}] 🔍 กำลังตรวจสอบรายการสินค้าในบิล...`);
                try {
                    const items = await fetchOdooPickingItems(picking.id);
                    const productIds = items.map(it => Array.isArray(it.product_id) ? it.product_id[0] : it.product_id).filter(Boolean);
                    let barcodeMap = {};
                    if (productIds.length > 0) {
                        barcodeMap = await fetchProductBarcodesMap(productIds);
                    }
                    const enriched = items.map(item => {
                        const pid = Array.isArray(item.product_id) ? item.product_id[0] : item.product_id;
                        return {
                            ...item,
                            barcode: barcodeMap[pid]?.barcode || '-',
                            productName: Array.isArray(item.product_id) ? item.product_id[1] : '-',
                            resolvedDoneQty: item.quantity ?? item.quantity_done ?? 0,
                            resolvedDemandQty: item.product_uom_qty || 0,
                        };
                    });
                    if (isMounted) setCurrentItems(enriched);
                } catch (err) {
                    console.error('Error loading items in Agent:', err);
                } finally {
                    if (isMounted) setIsLoadingItems(false);
                }

                // หน่วง 2.5 วินาที จำลองคนอ่านรายการสินค้าบนตาราง
                await new Promise(r => setTimeout(r, 2500));

                // Step 3: จำลองคนขยับเมาส์ไปกดปุ่ม Validate
                setStatusText(`[บิลที่ ${i + 1}/${selectedPickings.length}] ⚡ กำลังเลื่อนเมาส์กดปุ่ม Validate...`);
                await new Promise(r => setTimeout(r, 1500));

                // Step 4: ส่งคำสั่ง Validate
                try {
                    await validateOdooPickingNoBackorder(picking.id, (progress) => {
                        if (isMounted) setStatusText(`[บิลที่ ${i + 1}/${selectedPickings.length}] ${progress.text}`);
                    });
                    
                    if (isMounted) {
                        setSuccessCount(prev => prev + 1);
                        setStatusText(`✅ บิล ${picking.name} สำเร็จแล้ว! (กำลังรอเริ่มบิลถัดไป)`);
                    }
                } catch (err) {
                    console.error('Agent Error on picking:', picking.name, err);
                    if (isMounted) {
                        setFailedCount(prev => prev + 1);
                        setErrorInfo({
                            pickingName: picking.name,
                            pickingId: picking.id,
                            message: err.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุระหว่าง Validate'
                        });
                        setAgentState('error_halt'); // หยุดทันที!
                    }
                    return; // ออกจาก loop ทันที
                }

                // Step 5: Delay 5 วินาทีก่อนขยับไปบิลถัดไป
                if (i < selectedPickings.length - 1) {
                    for (let c = 5; c > 0; c--) {
                        if (isCancelledRef.current) break;
                        while (isPausedRef.current) {
                            if (isCancelledRef.current) break;
                            await new Promise(r => setTimeout(r, 500));
                        }
                        if (isMounted) {
                            setCountdown(c);
                            setStatusText(`⏳ บิล ${picking.name} สำเร็จเรียบร้อย! กำลังไปบิลถัดไปในอีก ${c} วินาที...`);
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    if (isMounted) setCountdown(0);
                }
            }

            if (isMounted && !isCancelledRef.current && agentState !== 'error_halt') {
                setAgentState('completed');
                setStatusText('🎉 ประมวลผลเสร็จสิ้นทุกบิลเรียบร้อยแล้ว!');
                onRefreshList?.();
            }
        };

        runAgentLoop();

        return () => {
            isMounted = false;
            isCancelledRef.current = true;
        };
    }, []);

    const handleStop = () => {
        isCancelledRef.current = true;
        onClose?.();
        onRefreshList?.();
    };

    const handlePauseToggle = () => {
        setAgentState(prev => prev === 'running' ? 'paused' : 'running');
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-500/50 flex items-center justify-center text-purple-400">
                            <Bot size={22} className={agentState === 'running' ? 'animate-bounce' : ''} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-black text-white">Auto Validate Agent</h2>
                                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-purple-950 text-purple-300 border border-purple-800 rounded-md flex items-center gap-1">
                                    <Sparkles size={11} /> Smart Bot Active
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">หุ่นยนต์ช่วยประมวลผลบิลอัตโนมัติทีละรายการ</p>
                        </div>
                    </div>

                    {/* Agent Control Buttons */}
                    <div className="flex items-center gap-2">
                        {agentState !== 'error_halt' && agentState !== 'completed' && (
                            <button
                                onClick={handlePauseToggle}
                                className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                                    agentState === 'paused'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                        : 'bg-amber-600 hover:bg-amber-500 text-white'
                                }`}
                            >
                                {agentState === 'paused' ? <><Play size={14} /> ทำงานต่อ</> : <><Pause size={14} /> ชั่วคราว</>}
                            </button>
                        )}
                        <button
                            onClick={handleStop}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs border border-slate-700 flex items-center gap-1.5 cursor-pointer"
                        >
                            <Square size={14} /> ปิดหน้าต่าง
                        </button>
                    </div>
                </div>

                {/* Progress Overview Bar */}
                <div className="bg-slate-950/60 border-b border-slate-800 px-6 py-3 space-y-2">
                    <div className="flex justify-between items-center text-xs font-mono">
                        <span className="text-slate-400 font-semibold">ความคืบหน้ารวม</span>
                        <span className="text-purple-300 font-bold">
                            {currentIndex + (agentState === 'completed' ? 1 : 0)} / {selectedPickings.length} บิล ({Math.round(((currentIndex + (agentState === 'completed' ? 1 : 0)) / selectedPickings.length) * 100)}%)
                        </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 border border-slate-700">
                        <div
                            className="bg-gradient-to-r from-purple-600 to-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.round(((currentIndex + (agentState === 'completed' ? 1 : 0)) / selectedPickings.length) * 100)}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono pt-0.5">
                        <span className="text-emerald-400 font-bold">สำเร็จแล้ว: {successCount} บิล</span>
                        <span className="text-rose-400 font-bold">พบข้อผิดพลาด: {failedCount} บิล</span>
                    </div>
                </div>

                {/* Main Body View */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* ❌ AGENT ERROR HALT POPUP ( : ( Sad Face Screen) */}
                    {agentState === 'error_halt' && errorInfo && (
                        <div className="bg-rose-950/90 border-2 border-rose-600 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-300 text-center space-y-4">
                            <div className="text-6xl font-black text-rose-500 font-mono tracking-tighter select-none">
                                :(
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-rose-200">พบข้อผิดพลาด! Agent หยุดทำงานชั่วคราว</h3>
                                <p className="text-xs text-rose-300/80 mt-1">
                                    ระบบหยุดทำงานอัตโนมัติเพื่อป้องกันข้อมูลใน Odoo ผิดพลาด
                                </p>
                            </div>

                            {/* Error Details Card */}
                            <div className="bg-black/60 border border-rose-800/80 rounded-2xl p-4 text-left font-mono text-xs space-y-2">
                                <div className="flex justify-between border-b border-rose-900/60 pb-2">
                                    <span className="text-slate-400">บิลที่มีปัญหา:</span>
                                    <span className="font-bold text-white">{errorInfo.pickingName} (ID: {errorInfo.pickingId})</span>
                                </div>
                                <div className="space-y-1">
                                    <span className="text-rose-400 font-bold">สาเหตุ Error:</span>
                                    <p className="text-rose-200 bg-rose-950/60 p-2.5 rounded-xl border border-rose-900 text-[11px] leading-relaxed break-all">
                                        {errorInfo.message}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-center gap-3">
                                <button
                                    onClick={handleStop}
                                    className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer border border-slate-700"
                                >
                                    ปิดและกลับไปตรวจสอบ
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Active Working Visual Sheet */}
                    {agentState !== 'error_halt' && currentPicking && (
                        <div className="space-y-4">
                            {/* Live Action Status Bar */}
                            <div className="bg-purple-950/40 border border-purple-800/60 rounded-2xl p-4 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Loader2 size={20} className="text-purple-400 animate-spin" />
                                    <div>
                                        <p className="text-xs text-purple-300 font-bold">{statusText}</p>
                                        {countdown > 0 && (
                                            <p className="text-[11px] text-amber-400 font-mono mt-0.5 flex items-center gap-1">
                                                <Clock size={12} /> หน่วงเวลาถอยหลัง: {countdown} วินาที...
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className="text-xs font-mono font-bold text-slate-300 bg-slate-900 px-3 py-1 rounded-xl border border-slate-700">
                                    {currentPicking.name}
                                </span>
                            </div>

                            {/* Simulated Form View Card */}
                            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                                    <div>
                                        <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">กำลังจำลองหน้า Odoo Form View</span>
                                        <h3 className="text-lg font-black text-white font-mono">{currentPicking.name}</h3>
                                    </div>
                                    <span className="px-3 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-bold rounded-full">
                                        State: {currentPicking.state}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                                    <div>
                                        <span className="text-slate-400">Receive From:</span>
                                        <p className="font-bold text-slate-200">
                                            {Array.isArray(currentPicking.partner_id) ? currentPicking.partner_id[1] : '-'}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400">Source Document:</span>
                                        <p className="font-bold text-amber-300">{currentPicking.origin || '-'}</p>
                                    </div>
                                </div>

                                {/* Items list preview */}
                                <div className="border border-slate-800 rounded-xl overflow-hidden">
                                    <div className="bg-slate-900 px-4 py-2 text-[11px] font-bold text-slate-400 flex justify-between">
                                        <span>รายการสินค้า ({currentItems.length} รายการ)</span>
                                        <span>Operations</span>
                                    </div>
                                    {isLoadingItems ? (
                                        <div className="py-8 text-center text-xs text-slate-500">
                                            <Loader2 size={20} className="animate-spin text-purple-400 mx-auto mb-1" />
                                            กำลังดึงรายการสินค้า...
                                        </div>
                                    ) : (
                                        <div className="max-h-44 overflow-y-auto divide-y divide-slate-800/60 text-xs">
                                            {currentItems.map((item, idx) => (
                                                <div key={item.id || idx} className="p-2.5 flex justify-between items-center hover:bg-slate-900/40">
                                                    <div className="space-y-0.5">
                                                        <span className="font-mono text-amber-300 font-bold text-[11px] block">{item.barcode}</span>
                                                        <span className="text-slate-200 font-semibold line-clamp-1">{item.productName}</span>
                                                    </div>
                                                    <div className="text-right font-mono">
                                                        <span className="text-slate-400 text-[11px]">Demand: {item.resolvedDemandQty}</span>
                                                        <span className="text-emerald-400 font-bold ml-2">Done: {item.resolvedDoneQty}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Completed View */}
                    {agentState === 'completed' && (
                        <div className="py-10 text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-emerald-950 border-2 border-emerald-500 flex items-center justify-center mx-auto text-emerald-400">
                                <CheckCircle2 size={32} />
                            </div>
                            <h3 className="text-xl font-black text-emerald-300">ทำงานเสร็จสมบูรณ์เรียบร้อย! 🎉</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Agent ได้ประมวลผลบิลทั้งหมด <strong className="text-white">{selectedPickings.length} บิล</strong> เรียบร้อยแล้ว สต็อกใน Odoo ถูกอัปเดตตรงกันแล้ว
                            </p>
                            <button
                                onClick={handleStop}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg cursor-pointer"
                            >
                                ปิดหน้าต่างและอัปเดตตาราง
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
