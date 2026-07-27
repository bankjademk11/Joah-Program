import React, { useState } from 'react';
import { X, Search, LayoutGrid } from 'lucide-react';
import InventoryIcon from '../../assets/Icons_AppJoah/Inventoryicon.png';
import StoreIcon from '../../assets/Icons_AppJoah/Storeicon.png';
import RequestIcon from '../../assets/Icons_AppJoah/Requesticon.png';
import HQIcon from '../../assets/Icons_AppJoah/HQicon.png';
import SaleViewIcon from '../../assets/Icons_AppJoah/SaleView.png';
import BgImage from '../../assets/Icons_AppJoah/web_background.jpg';

const apps = [
    {
        id: 'inventory',
        name: 'Inventory',
        icon: InventoryIcon,
        step: 'results' // ResultTable
    },
    {
        id: 'store',
        name: 'Store',
        icon: StoreIcon,
        step: 'store-inventory-mockup' // Maps to Store view
    },
    {
        id: 'store-request',
        name: 'Store Request',
        icon: RequestIcon,
        step: 'store-request'
    },
    {
        id: 'hq',
        name: 'HQ Command',
        icon: HQIcon,
        step: 'hq-dashboard'
    },
    {
        id: 'sales-viewer',
        name: 'Sales Viewer',
        icon: SaleViewIcon,
        step: 'odoo-sales-viewer'
    },
    {
        id: 'odoo-transfers',
        name: 'Odoo Transfer IN',
        icon: RequestIcon,
        step: 'odoo-transfers'
    }
];

const AppLauncher = ({ isOpen, onClose, onNavigate }) => {
    const [searchTerm, setSearchTerm] = useState('');

    if (!isOpen) return null;

    const filteredApps = apps.filter(app => 
        app.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleAppClick = (step) => {
        onNavigate(step);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[10000] bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-3xl flex flex-col transition-all duration-300 animate-in fade-in zoom-in-95 overflow-hidden">
            
            {/* Image Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <img 
                    src={BgImage} 
                    alt="Background" 
                    className="w-full h-full object-cover opacity-90 dark:opacity-40"
                />
                {/* Overlay gradient to ensure text readability */}
                <div className="absolute inset-0 bg-white/10 dark:bg-slate-900/50" />
            </div>

            {/* Header / Search */}
            <div className="relative w-full h-20 px-8 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 z-10">
                <div className="flex-1 max-w-xl mx-auto flex items-center relative">
                    <Search className="absolute left-4 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Search apps..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full h-12 pl-12 pr-4 rounded-2xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-joah-orange/50 transition-all text-lg font-medium"
                        autoFocus
                    />
                </div>
                <button 
                    onClick={onClose}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 ml-4"
                >
                    <X size={28} />
                </button>
            </div>

            {/* App Grid - Odoo Style */}
            <div className="relative z-10 flex-1 overflow-y-auto p-8 sm:p-12">
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-6 sm:gap-8 lg:gap-12">
                        {filteredApps.map((app) => (
                            <button
                                key={app.id}
                                onClick={() => handleAppClick(app.step)}
                                className="group flex flex-col items-center gap-3 transition-all duration-300 hover:scale-105"
                            >
                                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-[2rem] bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-center p-4 group-hover:shadow-xl group-hover:shadow-black/5 dark:group-hover:shadow-black/40 transition-all duration-300">
                                    <img 
                                        src={app.icon} 
                                        alt={app.name} 
                                        className="w-full h-full object-contain filter drop-shadow-sm group-hover:drop-shadow-md transition-all duration-300"
                                    />
                                </div>
                                <span className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-200 tracking-tight text-center max-w-[120px] leading-tight drop-shadow-sm">
                                    {app.name}
                                </span>
                            </button>
                        ))}
                    </div>
                    {filteredApps.length === 0 && (
                        <div className="w-full pt-20 flex flex-col items-center justify-center text-slate-400">
                            <LayoutGrid size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No apps found matching "{searchTerm}"</p>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Footer indicator */}
            <div className="py-4 flex justify-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                JOAH App Launcher
            </div>
        </div>
    );
};

export default AppLauncher;
