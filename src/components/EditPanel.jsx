import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Database, MapPin, Info, User, Save, Loader2, Eye, Plus } from 'lucide-react';
import { CATEGORY_RACK_RULES, getRackSuggestions } from '../utils/rackUtils';

const EditPanel = ({
    selectedRow,
    onClose,
    editQty, setEditQty,
    editLocation, setEditLocation,
    setInspectedLocation,
    editCat1, setEditCat1,
    editCat2, setEditCat2,
    editReason, setEditReason,
    currentUser,
    isUpdating,
    handleUpdate,
    results,
    t
}) => {
    const [showExtendedInput, setShowExtendedInput] = React.useState(false);

    // Lock body scroll
    useEffect(() => {
        if (selectedRow) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedRow]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && !isUpdating) onClose();
        };
        if (selectedRow) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [selectedRow, onClose, isUpdating]);

    if (!selectedRow) return null;

    return createPortal(
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999, // Higher than DiagnosticPanel if needed, or same level
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                onClick={!isUpdating ? onClose : undefined}
            />

            {/* Modal Content */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '672px', // max-w-2xl
                    backgroundColor: 'white',
                    borderRadius: '2rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                    animation: 'modalScaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                }}
                className="dark:!bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
                {/* Decorative Blur */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/10 blur-[60px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 relative z-10 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-joah-orange text-white shadow-lg shadow-orange-500/20"><Edit2 size={24} /></div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">ແກ້ໄຂຂໍ້ມູນ</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Manual Adjustment</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUpdating}
                        className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar relative z-10">
                    {/* Item Info Card */}
                    <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex justify-between items-start text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span>Item Info</span>
                            <span className="text-joah-orange">#{selectedRow.rowIndex}</span>
                        </div>
                        <div className="space-y-1">
                            <p className="text-2xl font-black text-slate-800 dark:text-white font-mono tracking-tight">{selectedRow.barcode}</p>
                            <p className="text-sm font-bold text-slate-500 truncate">{selectedRow.masterItemName || selectedRow.itemName}</p>
                        </div>
                        <div className="pt-4 grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-700/50">
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">System Count</p>
                                <div className="flex items-center gap-2"><Database size={14} className="text-sky-500" /><span className="text-base font-black text-slate-700 dark:text-slate-300">{selectedRow.masterQty || 0}</span></div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Current Location</p>
                                <div className="flex items-center gap-2"><MapPin size={14} className="text-joah-orange" /><span className="text-base font-black text-slate-700 dark:text-slate-300">{selectedRow.rackLocation}</span></div>
                            </div>
                        </div>
                    </div>

                    {/* Form Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Improved QTY Merge Tool - Primary Input */}
                        <div className="md:col-span-2 space-y-6">
                            {/* The Resulting Total View */}
                            <div className="p-6 rounded-[2rem] bg-slate-900 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-joah-orange/20 blur-[60px] rounded-full"></div>
                                <div className="flex items-center justify-between relative z-10">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ສັງລວມທັງໝົດ (Total Actual Quantity)</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-5xl font-black text-joah-orange tracking-tight tabular-nums">
                                                {editQty || 0}
                                            </span>
                                            <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* The Merge Tool (Calculator Style) */}
                            <div className="p-6 rounded-[2rem] bg-indigo-50/30 dark:bg-indigo-500/5 border-2 border-indigo-100 dark:border-indigo-900/30 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20">
                                        <Plus size={18} />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">ວາງຈຳນວນທີ່ນັບໄດ້ (Merge Count)</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Enter current counted amount to merge</p>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <input
                                        id="merge-input"
                                        type="number"
                                        placeholder="ປ້ອນຈຳນວນທີ່ນັບໄດ້ຕື່ມ..."
                                        className="flex-1 px-6 py-5 bg-white dark:bg-slate-950 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl text-2xl font-black text-indigo-600 dark:text-indigo-400 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = parseFloat(e.target.value) || 0;
                                                setEditQty(prev => (parseFloat(prev) || 0) + val);
                                                e.target.value = '';
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const input = document.getElementById('merge-input');
                                            const val = parseFloat(input.value) || 0;
                                            setEditQty(prev => (parseFloat(prev) || 0) + val);
                                            input.value = '';
                                        }}
                                        className="px-8 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-indigo-500/30 active:scale-95 flex flex-col items-center justify-center gap-1"
                                    >
                                        <span>MERGE</span>
                                        <span className="text-[8px] opacity-60">Add Count</span>
                                    </button>
                                </div>
                                <p className="text-center text-[10px] font-bold text-slate-400 animate-pulse">
                                    💡 Tip: ປ້ອນຈຳນວນແລ້ວກົດ Enter ເພື່ອລວມຍອດໄດ້ເລີຍ
                                </p>
                            </div>
                        </div>

                        {/* Rack Location - Read Only with Custom Dropdown */}
                        <div className="relative group md:col-span-2">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <MapPin size={14} className="text-joah-orange" /> Rack Location
                            </p>
                            {/* Current Location Display */}
                            <div className="flex gap-3 items-center">
                                <div className="flex-1 flex items-center gap-3 px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl">
                                    <MapPin size={18} className="text-joah-orange flex-shrink-0" />
                                    <span className="text-base font-black text-slate-700 dark:text-slate-300 uppercase tracking-tight">{editLocation || selectedRow.rackLocation || '-'}</span>
                                    {editLocation !== selectedRow.rackLocation && editLocation && (
                                        <span className="ml-auto text-[9px] font-black text-joah-orange bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md uppercase">Changed</span>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const loc = editLocation || selectedRow.rackLocation;
                                        if (loc) setInspectedLocation(loc);
                                    }}
                                    disabled={!editLocation && !selectedRow.rackLocation}
                                    className="px-4 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl text-slate-500 hover:text-joah-orange disabled:opacity-50 transition-colors"
                                    title="View items in this location"
                                >
                                    <Eye size={22} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowExtendedInput(!showExtendedInput)}
                                    className={`px-4 py-4 rounded-2xl border-2 transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-2 ${showExtendedInput
                                        ? 'bg-joah-orange text-white border-joah-orange shadow-lg shadow-orange-500/20'
                                        : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-joah-orange hover:text-joah-orange'
                                        }`}
                                >
                                    <Edit2 size={18} />
                                    {showExtendedInput ? 'Hide' : 'custom'}
                                </button>
                            </div>

                            {/* Extended Fields: Custom Location Dropdown & Reason */}
                            {showExtendedInput && (
                                <div className="animate-fade-in-up space-y-5 mt-5 p-5 rounded-[2rem] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800">

                                    {/* Category Change Dropdown */}
                                    <div className="p-4 rounded-2xl bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/20">
                                        <p className="text-[9px] font-black text-sky-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Database size={12} /> ປ່ຽນໝວດໝູ່ (Change Category)
                                        </p>
                                        <select
                                            value={editCat1}
                                            onChange={(e) => setEditCat1(e.target.value)}
                                            className="w-full py-3.5 px-4 font-bold bg-white dark:bg-slate-800 border-2 border-sky-200 dark:border-sky-800/50 rounded-2xl focus:border-joah-orange outline-none transition-all text-sm appearance-none cursor-pointer"
                                        >
                                            <option value="">{selectedRow.category1 || 'Select Category'}</option>
                                            {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Custom Location Dropdown */}
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20">
                                        <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Edit2 size={12} /> ປ່ຽນໂລເຄຊັ້ນ (Change Location)
                                        </p>
                                        <select
                                            className="w-full py-3.5 px-4 font-bold bg-white dark:bg-slate-800 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl focus:border-joah-orange outline-none transition-all text-sm appearance-none cursor-pointer"
                                            value={editLocation}
                                            onChange={(e) => setEditLocation(e.target.value)}
                                        >
                                            <option value="">-- ເລືອກໂລເຄຊັ້ນ --</option>
                                            {getRackSuggestions(editCat1 || selectedRow.category1).map(loc => {
                                                const count = results.filter(r => r.rackLocation === loc).length;
                                                return (
                                                    <option key={loc} value={loc}>
                                                        {loc} {count > 0 ? `\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0 ${count} SKU` : ''}
                                                    </option>
                                                );
                                            })}
                                        </select>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Category 1 - Read Only Display */}
                        <div className="relative group">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category 1</p>
                            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl">
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{editCat1 || selectedRow.category1 || '-'}</span>
                            </div>
                        </div>

                        {/* Category 2 - Read Only Display */}
                        <div className="relative group">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Category 2</p>
                            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border-2 border-slate-100 dark:border-slate-800 rounded-2xl">
                                <span className="text-sm font-black text-slate-700 dark:text-slate-300">{editCat2 || selectedRow.category2 || '-'}</span>
                            </div>
                        </div>

                        {/* Reason Dropdown - Required */}
                        <div className="md:col-span-2 relative group mt-2">
                            <div className="p-5 rounded-2xl bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900/30 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Info size={14} className="text-joah-orange" />
                                        <span className="text-[10px] font-black text-joah-orange uppercase tracking-widest">{t('results.reasonPrompt')}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-md uppercase tracking-wide">{t('results.mustFill')}</span>
                                </div>
                                <select
                                    value={editReason}
                                    onChange={(e) => setEditReason(e.target.value)}
                                    className="w-full py-3.5 px-4 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-800/50 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-joah-orange/10 focus:border-joah-orange outline-none transition-all appearance-none cursor-pointer text-slate-700 dark:text-slate-200"
                                >
                                    <option value="">-- ເລືອກເຫດຜົນ (Select Reason) --</option>
                                    <optgroup label="📦 ປັບປຸງ QTY (Quantity Adjustment)">
                                        <option value="ນັບສິນຄ້າໃໝ່ (Recount)">ນັບສິນຄ້າໃໝ່ (Recount)</option>
                                        <option value="ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)">ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)</option>
                                        <option value="ສິນຄ້າຫາຍ / ຂາດ (Missing / Shortage)">ສິນຄ້າຫາຍ / ຂາດ (Missing / Shortage)</option>
                                        <option value="ສິນຄ້າເສຍຫາຍ (Damaged Goods)">ສິນຄ້າເສຍຫາຍ (Damaged Goods)</option>
                                        <option value="ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)">ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)</option>
                                        <option value="ສົ່ງສິນຄ້າອອກ (Stock Out / Sold)">ສົ່ງສິນຄ້າອອກ (Stock Out / Sold)</option>
                                    </optgroup>
                                    <optgroup label="📍 ຍ້າຍໂລເຄຊັ້ນ (Location Change)">
                                        <option value="ຍ້າຍໄປພື້ນທີ່ໃໝ່ (Relocated to New Area)">ຍ້າຍໄປພື້ນທີ່ໃໝ່ (Relocated to New Area)</option>
                                        <option value="ຈັດລຽງຊ້ັນວາງຄືນໃໝ່ (Shelf Reorganization)">ຈັດລຽງຊ້ັນວາງຄືນໃໝ່ (Shelf Reorganization)</option>
                                        <option value="ສິນຄ້າວາງຜິດບ່ອນ (Misplaced Item)">ສິນຄ້າວາງຜິດບ່ອນ (Misplaced Item)</option>
                                    </optgroup>
                                    <optgroup label="⚙️ ອື່ນໆ (Other)">
                                        <option value="ແກ້ໄຂຂໍ້ມູນຜິດພາດ (Data Correction)">ແກ້ໄຂຂໍ້ມູນຜິດພາດ (Data Correction)</option>
                                        <option value="ຄຳສັ່ງຈາກຜູ້ຈັດການ (Manager Request)">ຄຳສັ່ງຈາກຜູ້ຈັດການ (Manager Request)</option>
                                        <option value="ອື່ນໆ (Other)">ອື່ນໆ (Other)</option>
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        {/* Verifier Info */}
                        <div className="mt-2 md:col-span-2">
                            <div className="relative group">
                                <span className="floating-label z-10 px-2 bg-white dark:bg-slate-900">{t('results.verifier')}</span>
                                <div className="relative">
                                    <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                    <input
                                        type="text"
                                        value={currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown')}
                                        readOnly
                                        className="input-field pl-12 py-4 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-2 gap-4 flex-shrink-0">
                    <button onClick={onClose} disabled={isUpdating} className="btn-secondary bg-slate-800 text-white border-slate-700 hover:bg-slate-700 h-14 uppercase text-xs tracking-widest shadow-none disabled:opacity-50">{t('common.cancel')}</button>
                    <button onClick={handleUpdate} disabled={isUpdating} className={`btn-primary h-14 uppercase text-xs tracking-widest shadow-orange-500/10 ${isUpdating ? 'opacity-70 cursor-wait' : ''}`}>
                        {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        <span>{isUpdating ? t('results.saving') : t('results.saveChanges')}</span>
                    </button>
                </div>
            </div>

            {/* Inline keyframes */}
            <style>{`
                @keyframes modalScaleIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>,
        document.body
    );
};

export default EditPanel;
