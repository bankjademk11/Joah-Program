import React from 'react';
import { X, AlertTriangle, Info, CheckCircle, Loader2 } from 'lucide-react';

const ConfirmModal = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger', // danger, warning, info
    isLoading = false
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger': return <AlertTriangle size={32} className="text-rose-500" />;
            case 'warning': return <AlertTriangle size={32} className="text-amber-500" />;
            case 'info': return <Info size={32} className="text-blue-500" />;
            case 'success': return <CheckCircle size={32} className="text-emerald-500" />;
            default: return <Info size={32} className="text-blue-500" />;
        }
    };

    const getConfirmButtonStyle = () => {
        switch (type) {
            case 'danger': return 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/30';
            case 'warning': return 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/30';
            case 'info': return 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30';
            case 'success': return 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30';
            default: return 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30';
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
            <div
                className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-100 dark:border-slate-700"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-8 text-center flex flex-col items-center">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-rose-50 dark:bg-rose-500/10' :
                            type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10' :
                                type === 'success' ? 'bg-emerald-50 dark:bg-emerald-500/10' :
                                    'bg-blue-50 dark:bg-blue-500/10'
                        }`}>
                        {getIcon()}
                    </div>

                    <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 tracking-tight">
                        {title}
                    </h3>

                    <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex gap-3 w-full">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 py-3 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-slate-400 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`flex-1 py-3 px-6 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2 ${getConfirmButtonStyle()}`}
                        >
                            {isLoading && <Loader2 size={18} className="animate-spin" />}
                            <span>{confirmText}</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
