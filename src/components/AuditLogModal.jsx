
import React from 'react';
import { createPortal } from 'react-dom';
import { History, X, Loader2, Clock, ArrowUpDown } from 'lucide-react';

const AuditLogModal = ({ isOpen, onClose, isLoading, historyData }) => {
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-slate-950/40 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 border border-slate-200 dark:border-slate-800 shadow-2xl animate-scale-in relative overflow-hidden flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                            <History size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">ປະຫວັດການແກ້ໄຂ</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Audit Log</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4 text-slate-400">
                            <Loader2 className="animate-spin" size={32} />
                            <p className="text-xs font-black uppercase tracking-widest">Loading History...</p>
                        </div>
                    ) : historyData && historyData.length > 0 ? (
                        historyData.map((log) => (
                            <div key={log.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-start gap-4">
                                <div className="mt-1 p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                    <Clock size={16} />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex justify-between items-start">
                                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">{log.updated_by || 'Unknown'}</p>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{new Date(log.updated_at).toLocaleString('lo-LA')}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                        <span>Qty:</span>
                                        <span className="line-through opacity-70">{log.old_qty}</span>
                                        <ArrowUpDown size={12} className="rotate-90 text-indigo-500" />
                                        <span className="font-bold text-indigo-600 dark:text-indigo-300">{log.new_qty}</span>
                                    </div>
                                    {log.change_reason && (
                                        <div className="mt-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-100 dark:border-orange-500/20">
                                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Reason</p>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{log.change_reason}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 opacity-60">
                            <History size={48} strokeWidth={1} />
                            <p className="text-xs font-black uppercase tracking-widest">No History Found</p>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AuditLogModal;
