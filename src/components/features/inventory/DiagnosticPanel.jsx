import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, HelpCircle, Edit2 } from 'lucide-react';

const DiagnosticPanel = ({ diagnosticRow, onClose, onEdit, getStatusHint }) => {
    // Lock body scroll when panel is open
    useEffect(() => {
        if (diagnosticRow) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [diagnosticRow]);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (diagnosticRow) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [diagnosticRow, onClose]);

    if (!diagnosticRow) return null;

    const hint = getStatusHint(diagnosticRow);

    // Use createPortal to render directly to document.body
    // This escapes any parent overflow/transform that breaks position:fixed
    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
            }}
        >
            {/* Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                }}
                onClick={onClose}
            />

            {/* Centered Modal Panel */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '680px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    borderRadius: '2.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    animation: 'diagnosticModalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                }}
                className="dark:!bg-slate-900 dark:!border-slate-800"
            >
                {/* Decorative Blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className={`p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 relative z-10`}
                    style={{ background: hint.bg ? undefined : '#f8fafc' }}
                >
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            <div className={`p-4 rounded-[1.25rem] text-white ${hint.bg} shadow-lg flex-shrink-0 animate-bounce-subtle`}>
                                {hint.icon}
                            </div>
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white leading-tight">{hint.title}</h3>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Validation Analysis Report</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all flex-shrink-0 transform hover:scale-110 active:scale-95 shadow-sm"
                            title="ປິດ (Esc)"
                        >
                            <X size={24} className="text-slate-500" />
                        </button>
                    </div>
                    {/* Barcode Info */}
                    <div className="p-5 rounded-[1.5rem] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
                        <div className="flex justify-between items-start mb-1">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Item Identifier</p>
                            <span className="text-[9px] font-black text-joah-orange bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded-md">LIVE SCAN</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">{diagnosticRow.barcode}</p>
                        <p className="text-sm font-bold text-slate-500 mt-1 truncate">{diagnosticRow.masterItemName || diagnosticRow.itemName}</p>
                    </div>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar relative z-10">
                    {/* Root Cause */}
                    <div className="p-6 rounded-[1.5rem] bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1 h-full bg-joah-orange"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <HelpCircle size={14} className="text-joah-orange" /> สาเหตุ (Root Cause)
                        </p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{hint.reason}</p>
                    </div>

                    {/* Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Actual Data */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> ຂໍ້ມູນທີຕວດພົບ (Actual)
                            </p>
                            <div className="p-5 rounded-[1.5rem] bg-rose-50/30 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-900/20 space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">ຫມວດໝູ່ 1</p>
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">{diagnosticRow.category1 || '-'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">ຫມວດໝູ່ 2</p>
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">{diagnosticRow.category2 || '-'}</p>
                                </div>
                                <div className="pt-3 border-t border-rose-100 dark:border-rose-900/20">
                                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-1">ບ່ອນວາງ (Rack)</p>
                                    <p className="text-base font-black text-rose-600 dark:text-rose-400">{diagnosticRow.rackLocation || '-'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Master Data */}
                        <div className="space-y-3">
                            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2 justify-center">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ຂໍ້ມູນທີ່ຖືກຕ້ອງ (Master)
                            </p>
                            <div className="p-5 rounded-[1.5rem] bg-emerald-50/30 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-900/20 space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ຫມວດໝູ່ 1</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{diagnosticRow.masterCategory1 || 'ຍັງບໍ່ມີຂໍ້ມູນ'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ຫມວດໝູ່ 2</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{diagnosticRow.masterCategory2 || 'ຍັງບໍ່ມີຂໍ້ມູນ'}</p>
                                </div>
                                <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/20">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ໂຊນທີຄວນຢູ່</p>
                                    <div className="text-base font-black text-emerald-600 dark:text-emerald-400 flex flex-wrap gap-2">
                                        {(() => {
                                            let rackText = '-';
                                            if (diagnosticRow.status === 'passed') {
                                                rackText = diagnosticRow.rackLocation || '-';
                                            } else if (hint && hint.fixSteps && hint.fixSteps.length > 0) {
                                                const found = hint.fixSteps.reduce((acc, step) => {
                                                    if (acc) return acc;
                                                    if (!step) return null;
                                                    const idx = step.indexOf('Rack:');
                                                    if (idx !== -1) return step.substring(idx + 5).trim();
                                                    return null;
                                                }, null);
                                                if (found) rackText = found;
                                            }

                                            if (rackText === '-') return '-';

                                            // --- Smart Merge Logic ---
                                            try {
                                                // Check for Lao/Thai characters or complex text
                                                // If found, DO NOT re-sort or merge aggressively to preserve context (e.g. "E 5/7/8")
                                                const hasLaoOrThai = /[\u0E80-\u0EFF\u0E00-\u0E7F]/.test(rackText);

                                                if (hasLaoOrThai) {
                                                    // Simple mode: Just split by | for major separators, keep the rest distinct
                                                    // This fixes: "E01-E04 ຫຼື ໂລພື້ນ E 5/7/8" staying together
                                                    const parts = rackText.split('|').map(s => s.trim()).filter(Boolean);

                                                    return parts.map((opt, i) => (
                                                        <span key={i} className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                                            {opt}
                                                        </span>
                                                    ));
                                                }

                                                // Clean mode (Standard Racks): Apply Smart Merge & Sort
                                                // 1. Split by delimiters |, /, , (BUT NOT SPACE to avoid breaking sentences/Lao text)
                                                // Clean up multiple spaces first
                                                const cleanText = rackText.replace(/\s+/g, ' ').trim();
                                                const rawParts = cleanText.split(/[|/,]+/).map(s => s.trim()).filter(Boolean);

                                                let standardLocs = new Set();
                                                let otherText = new Set(); // Keep non-standard text separate

                                                rawParts.forEach(part => {
                                                    // Check if it looks like a rack range (A01-A05)
                                                    const rangeMatch = part.match(/^([A-Z]+)(\d+)-([A-Z]+)(\d+)$/);
                                                    // Check if it looks like a single rack (A01, B-02, etc) - looser check
                                                    const singleMatch = part.match(/^[A-Z0-9\-]+$/);

                                                    if (rangeMatch && rangeMatch[1] === rangeMatch[3]) {
                                                        // Expand Range
                                                        const prefix = rangeMatch[1];
                                                        const start = parseInt(rangeMatch[2]);
                                                        const end = parseInt(rangeMatch[4]);
                                                        const length = rangeMatch[2].length;

                                                        if (end >= start && (end - start) < 100) {
                                                            for (let i = start; i <= end; i++) {
                                                                standardLocs.add(`${prefix}${i.toString().padStart(length, '0')}`);
                                                            }
                                                        } else {
                                                            otherText.add(part);
                                                        }
                                                    } else if (singleMatch) {
                                                        // It's a code-like string (e.g. A01, 5, 7, E01) - Add to be sorted
                                                        standardLocs.add(part);
                                                    } else {
                                                        // It's descriptive text (e.g. ໂລພື້ນ, ຫຼັກ, Zone B) - Keep valid
                                                        otherText.add(part);
                                                    }
                                                });

                                                // 3. Sort standard locations
                                                const sortedLocs = Array.from(standardLocs).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

                                                // 4. Re-collapse standard locations
                                                const collapsed = [];
                                                if (sortedLocs.length > 0) {
                                                    let rangeStart = sortedLocs[0];
                                                    let prev = sortedLocs[0];

                                                    for (let i = 1; i < sortedLocs.length; i++) {
                                                        const curr = sortedLocs[i];
                                                        let isSeq = false;
                                                        const matchPrev = prev.match(/^([A-Z]+)(\d+)$/);
                                                        const matchCurr = curr.match(/^([A-Z]+)(\d+)$/);

                                                        if (matchPrev && matchCurr && matchPrev[1] === matchCurr[1]) {
                                                            const numPrev = parseInt(matchPrev[2]);
                                                            const numCurr = parseInt(matchCurr[2]);
                                                            if (numCurr === numPrev + 1) isSeq = true;
                                                        }

                                                        if (isSeq) {
                                                            prev = curr;
                                                        } else {
                                                            if (rangeStart === prev) collapsed.push(rangeStart);
                                                            else collapsed.push(`${rangeStart}-${prev}`);
                                                            rangeStart = curr;
                                                            prev = curr;
                                                        }
                                                    }
                                                    if (rangeStart === prev) collapsed.push(rangeStart);
                                                    else collapsed.push(`${rangeStart}-${prev}`);
                                                }

                                                // Combine with other text
                                                const finalDisplay = [...collapsed, ...Array.from(otherText)];

                                                // Return Display
                                                return finalDisplay.map((opt, i) => (
                                                    <span key={i} className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                                                        {opt}
                                                    </span>
                                                ));

                                            } catch (e) {
                                                console.error("Rack parse error", e);
                                                // Fallback to simple split if error
                                                const options = rackText.split(/[|,]/).map(s => s.trim()).filter(Boolean);
                                                return options.map((opt, i) => (
                                                    <span key={i} className="px-2 py-1 rounded-md bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs border border-emerald-200 dark:border-emerald-800">
                                                        {opt}
                                                    </span>
                                                ));
                                            }
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Solution Steps */}
                    <div className="p-6 rounded-[1.5rem] bg-slate-900 dark:bg-black text-white shadow-2xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 blur-[60px] rounded-full group-hover:bg-indigo-500/40 transition-all"></div>
                        <div className="flex items-center gap-3 mb-5 relative z-10">
                            <div className="p-2 bg-indigo-500 rounded-lg"><HelpCircle size={16} /></div>
                            <p className="text-[10px] font-black uppercase tracking-widest">ວິທີເເກ້ໄຂ (Solution Steps)</p>
                        </div>
                        <div className="space-y-4 relative z-10">
                            <p className="text-sm font-bold text-indigo-200 bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">{hint.action}</p>
                            {hint.fixSteps?.length > 0 && (
                                <div className="grid grid-cols-1 gap-3">
                                    {hint.fixSteps.map((step, idx) => (
                                        <div key={idx} className="flex gap-4 items-center bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/5 transition-all">
                                            <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-black flex-shrink-0 text-sm shadow-lg shadow-indigo-500/20">{idx + 1}</div>
                                            <p className="text-sm font-bold text-slate-300 leading-tight">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 sm:px-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-end gap-3 flex-shrink-0 relative z-10">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-8 h-12 rounded-2xl font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-widest hover:bg-white dark:hover:bg-slate-800 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                    >
                        ປິດໜ້າຕ່າງ
                    </button>
                    {diagnosticRow.status !== 'passed' && (
                        <button
                            onClick={() => {
                                onClose();
                                onEdit(diagnosticRow);
                            }}
                            className="w-full sm:w-auto px-8 h-12 rounded-2xl bg-joah-orange text-white font-black uppercase text-xs tracking-widest hover:translate-y--1 hover:shadow-xl transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
                        >
                            <Edit2 size={16} />
                            ເເກ້ໄຂຂໍ້ມູນທັນທີ
                        </button>
                    )}
                </div>

                <style>{`
                    @keyframes diagnosticModalScaleIn {
                        from { transform: scale(0.9) translateY(20px); opacity: 0; }
                        to { transform: scale(1) translateY(0); opacity: 1; }
                    }
                    .animate-bounce-subtle {
                        animation: bounce-subtle 2s infinite;
                    }
                    @keyframes bounce-subtle {
                        0%, 100% { transform: translateY(0); }
                        50% { transform: translateY(-3px); }
                    }
                `}</style>
            </div>
        </div>,
        document.body
    );
};

export default DiagnosticPanel;
