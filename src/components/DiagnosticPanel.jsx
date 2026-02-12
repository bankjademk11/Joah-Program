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
                                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span> ข้อมูลที่ตรวจพบ (Actual)
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
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> ข้อมูลที่ถูกต้อง (Master)
                            </p>
                            <div className="p-5 rounded-[1.5rem] bg-emerald-50/30 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-900/20 space-y-4">
                                <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ຫມວດໝູ່ 1</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{diagnosticRow.masterCategory1 || 'ยังไม่มีข้อมูล'}</p>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ຫມວດໝູ່ 2</p>
                                    <p className="text-sm font-black text-slate-800 dark:text-white">{diagnosticRow.masterCategory2 || 'ยังไม่มีข้อมูล'}</p>
                                </div>
                                <div className="pt-3 border-t border-emerald-100 dark:border-emerald-900/20">
                                    <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mb-1">ໂຊນທີຄວນຢູ່</p>
                                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400">
                                        {diagnosticRow.status === 'passed'
                                            ? diagnosticRow.rackLocation
                                            : (diagnosticRow.reason?.includes('ควรแม่น')
                                                ? diagnosticRow.reason.split('ควรแม่น ')[1].split(')')[0]
                                                : '-')}
                                    </p>
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
