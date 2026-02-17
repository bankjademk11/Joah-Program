import React, { useEffect } from 'react';
import { MapPin, X, Package } from 'lucide-react';

const LocationInspector = ({ inspectedLocation, onClose, allResults, className }) => {

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') onClose();
        };
        if (inspectedLocation) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [inspectedLocation, onClose]);

    if (!inspectedLocation) return null;

    // Filter items in this location
    const itemsInLocation = allResults.filter(r => r.rackLocation === inspectedLocation);

    return (
        <div className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-slide-in-right ${className}`} style={{ zIndex: 100 }}>
            {/* Decorative Background Blob */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>

            {/* Header */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 rounded-t-[2rem] relative z-10 shrink-0">
                <div>
                    <h3 className="text-base font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="p-1.5 bg-joah-orange text-white shadow-lg shadow-orange-500/20 rounded-lg">
                            <MapPin size={14} />
                        </div>
                        {inspectedLocation}
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest pl-1">
                        {itemsInLocation.length} ITEMS FOUND
                    </p>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/30 hover:text-rose-600 rounded-lg text-slate-400 transition-all"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content List */}
            <div className="p-3 overflow-y-auto custom-scrollbar space-y-2 flex-1 min-h-0 relative z-10">
                {itemsInLocation.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                        <Package size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="font-bold text-xs">Empty Rack</p>
                    </div>
                ) : (
                    itemsInLocation.map((item, idx) => (
                        <div key={idx} className="bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-all group">
                            <div className="flex justify-between items-start mb-1.5">
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-[8px] font-black rounded-md text-slate-500 font-mono">
                                    {item.barcode}
                                </span>
                                <span className="text-[8px] font-bold text-joah-orange bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">
                                    {item.category2 || item.category1}
                                </span>
                            </div>
                            <div className="flex justify-between items-end gap-2">
                                <h4 className="font-bold text-slate-700 dark:text-slate-200 text-[11px] line-clamp-2 leading-tight flex-1" title={item.itemName || item.masterItemName}>
                                    {item.itemName || item.masterItemName || 'Unknown Item'}
                                </h4>
                                <div className="text-right min-w-[2.5rem]">
                                    <span className="block text-sm font-black text-slate-900 dark:text-white leading-none">
                                        {item.qty}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default LocationInspector;
