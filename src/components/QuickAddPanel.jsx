import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Database, MapPin, Info, User, Save, Loader2, Eye, AlertTriangle, CheckCircle } from 'lucide-react';
import { CATEGORY_RACK_RULES, getRackSuggestions } from '../utils/rackUtils';

const QuickAddPanel = ({
    isOpen,
    onClose,
    quickAddForm,
    setQuickAddForm,
    isFoundInMaster,
    setIsFoundInMaster,
    isSaving,
    onSave,
    masterData = [],
    results = [],
    allResults = [],
    t,
    setInspectedLocation,
    onAddNewProduct
}) => {
    const [showExtendedInput, setShowExtendedInput] = useState(false);

    // --- Detect if barcode exists in Master Data ---
    useEffect(() => {
        if (isOpen && quickAddForm.barcode_no) {
            const barcode = String(quickAddForm.barcode_no).trim();
            const masterItem = masterData.find(m =>
                String(m.barcode || m.Barcode || m['Barcode No.'] || '').trim() === barcode
            );

            if (masterItem) {
                setIsFoundInMaster(true);
                const itemNameValue = masterItem.item_name || masterItem.product_name_la || masterItem['Product Name(LA)'] || masterItem['Item Name'] || '';
                const cat1Value = masterItem.category_1 || masterItem['CATEGORIES 1'] || masterItem['Category 1'] || '';
                const cat2Value = masterItem.category_2 || masterItem['CATEGORIES 2'] || masterItem['Category 2'] || '';

                setQuickAddForm(prev => ({
                    ...prev,
                    item_name: String(itemNameValue).trim(),
                    category_1_actual: String(cat1Value).trim(),
                    category_2_actual: String(cat2Value).trim()
                }));
            } else {
                setIsFoundInMaster(false);
                setQuickAddForm(prev => ({
                    ...prev,
                    item_name: '',
                    category_1_actual: '',
                    category_2_actual: '',
                    qty: 0,
                    rack_location: ''
                }));
            }
        }
    }, [quickAddForm.barcode_no, isOpen, masterData, setIsFoundInMaster, setQuickAddForm]);

    // Lock body scroll
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Close on Escape
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape' && !isSaving) onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose, isSaving]);

    if (!isOpen) return null;

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
                onClick={!isSaving ? onClose : undefined}
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
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] rounded-full pointer-events-none"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-6 sm:p-8 border-b border-slate-100 dark:border-slate-800 relative z-10 flex-shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"><Plus size={24} /></div>
                        <div>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight">ເພີ່ມຂໍ້ມູນເຂົ້າ Inventory</h3>
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Direct Stock Addition</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all transform hover:scale-105 active:scale-95 shadow-sm disabled:opacity-50"
                    >
                        <X size={24} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar relative z-10">

                    {/* Warning Banner when NOT found in Master */}
                    {!isFoundInMaster && quickAddForm.barcode_no && (
                        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/20 border-2 border-rose-200 dark:border-rose-900/30">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-rose-100 dark:bg-rose-900/30 rounded-xl shrink-0">
                                    <AlertTriangle className="text-rose-600 dark:text-rose-400" size={20} />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-black text-rose-700 dark:text-rose-400 mb-1">⚠️ ບໍ່ພົບໃນ Master Data</h4>
                                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mb-2">ບາໂຄ້ດນີ້ຍັງບໍ່ທັນຖືກເພີ່ມເຂົ້າໃນລະບົບຫຼັກ. <span className="underline">ກະລຸນາເພີ່ມຂໍ້ມູນໃນ "Product Manager" ກ່ອນ.</span></p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Barcode & Name Info */}
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Barcode</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={quickAddForm.barcode_no}
                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, barcode_no: e.target.value }))}
                                    className="input-field py-4 font-mono text-xl font-black focus:ring-4 focus:ring-joah-orange/10 transition-all pl-6"
                                    placeholder="ຍິງບາໂຄ້ດ ຫຼື ພິມຢູ່ທີ່ນີ້..."
                                    autoFocus
                                />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                    {isFoundInMaster && (
                                        <div className="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg flex items-center gap-1.5 animate-fade-in">
                                            <CheckCircle size={14} />
                                            <span className="text-[9px] font-black uppercase tracking-tighter">Verified in Master</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Item Name {!isFoundInMaster && <span className="text-rose-500 font-bold">(Add to Master First)</span>}</label>
                            <input
                                type="text"
                                value={quickAddForm.item_name}
                                readOnly={isFoundInMaster}
                                disabled={!isFoundInMaster}
                                className={`input-field py-4 font-bold ${isFoundInMaster ? 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 cursor-not-allowed' : 'bg-white dark:bg-slate-900 shadow-sm border-rose-200 dark:border-rose-900/30'}`}
                                placeholder={isFoundInMaster ? "ຊື່ສິນຄ້າ..." : "🔒 Locked - Add to Master First"}
                            />
                        </div>
                    </div>

                    {/* QTY Merge Tool Style */}
                    <div className="space-y-5">
                        {/* Total Preview */}
                        <div className="p-6 rounded-[2rem] bg-slate-900 text-white shadow-xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[60px] rounded-full"></div>
                            <div className="flex items-center justify-between relative z-10">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ສັງລວມທັງໝົດ (Total Actual Quantity)</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-black text-emerald-500 tracking-tight tabular-nums">
                                            {quickAddForm.qty || 0}
                                        </span>
                                        <span className="text-xs font-bold text-slate-500 uppercase">Items</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Merge Input */}
                        <div className="p-6 rounded-[2rem] bg-emerald-50/30 dark:bg-emerald-500/5 border-2 border-emerald-100 dark:border-emerald-900/30 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20">
                                    <Plus size={18} />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-slate-800 dark:text-white leading-tight">ວາງຈຳນວນທີ່ນັບໄດ້ (Merge Count)</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Enter current counted amount to merge</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <input
                                    id="quick-merge-input"
                                    type="number"
                                    placeholder="ປ້ອນຈຳນວນທີ່ນັບໄດ້ຕື່ມ..."
                                    className="flex-1 px-6 py-5 bg-white dark:bg-slate-950 border-2 border-emerald-200 dark:border-emerald-800 rounded-2xl text-2xl font-black text-emerald-600 dark:text-emerald-400 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = parseFloat(e.target.value) || 0;
                                            setQuickAddForm(prev => ({ ...prev, qty: (parseFloat(prev.qty) || 0) + val }));
                                            e.target.value = '';
                                            e.preventDefault();
                                        }
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        const input = document.getElementById('quick-merge-input');
                                        const val = parseFloat(input.value) || 0;
                                        setQuickAddForm(prev => ({ ...prev, qty: (parseFloat(prev.qty) || 0) + val }));
                                        input.value = '';
                                    }}
                                    className="px-8 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 active:scale-95 flex flex-col items-center justify-center gap-1"
                                >
                                    <span>MERGE</span>
                                    <span className="text-[8px] opacity-60">Add Count</span>
                                </button>
                            </div>
                        </div>

                        {/* Custom Toggle Field - Moved below Merge Tool */}
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={() => setShowExtendedInput(!showExtendedInput)}
                                className={`px-6 py-3 rounded-2xl border-2 transition-all font-black uppercase text-[10px] tracking-widest flex items-center gap-3 ${showExtendedInput
                                    ? 'bg-joah-orange text-white border-joah-orange shadow-lg shadow-orange-500/20 w-full justify-center'
                                    : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800 hover:border-joah-orange hover:text-joah-orange'
                                    }`}
                            >
                                <Edit2 size={16} />
                                {showExtendedInput ? 'Hide Settings' : 'Custom (Location & Category)'}
                            </button>
                        </div>
                    </div>

                    {/* Extended Inputs (Location, Categories) */}
                    {showExtendedInput && (
                        <div className="animate-fade-in-up space-y-6 pt-2">
                            {/* Rack Location Selection */}
                            <div className="p-6 rounded-[2rem] bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-joah-orange uppercase tracking-widest flex items-center gap-2">
                                        <MapPin size={14} /> Rack Location (Suggestions)
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => quickAddForm.rack_location && setInspectedLocation(quickAddForm.rack_location)}
                                        disabled={!quickAddForm.rack_location}
                                        className="p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-joah-orange disabled:opacity-50 transition-colors"
                                    >
                                        <Eye size={18} />
                                    </button>
                                </div>
                                <select
                                    className="w-full py-4 px-5 font-bold bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:border-joah-orange outline-none transition-all text-sm appearance-none cursor-pointer"
                                    value={quickAddForm.rack_location}
                                    onChange={(e) => setQuickAddForm({ ...quickAddForm, rack_location: e.target.value })}
                                >
                                    <option value="">-- ເລືອກໂລເຄຊັ້ນ --</option>
                                    {getRackSuggestions(quickAddForm.category_1_actual).map(loc => {
                                        const count = allResults.filter(r => r.rackLocation === loc).length;
                                        return (
                                            <option key={loc} value={loc}>
                                                {loc} {count > 0 ? `\u00A0\u00A0\u00A0|\u00A0\u00A0\u00A0 ${count} SKU` : ''}
                                            </option>
                                        );
                                    })}
                                    <option value="CUSTOM">-- ປ້ອນເອງ (Custom) --</option>
                                </select>
                            </div>

                            {/* Category Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category 1</p>
                                    <select
                                        className={`w-full py-4 px-5 font-bold rounded-2xl border-2 transition-all text-sm appearance-none cursor-pointer ${!isFoundInMaster ? 'bg-white border-slate-200 focus:border-joah-orange' : 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed'}`}
                                        value={quickAddForm.category_1_actual}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, category_1_actual: e.target.value })}
                                        disabled={isFoundInMaster}
                                    >
                                        <option value="">ເລືອກເເຄສ</option>
                                        {quickAddForm.category_1_actual && !Object.keys(CATEGORY_RACK_RULES).includes(quickAddForm.category_1_actual) && (
                                            <option value={quickAddForm.category_1_actual}>{quickAddForm.category_1_actual} (Original)</option>
                                        )}
                                        {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Category 2</p>
                                    <select
                                        className={`w-full py-4 px-5 font-bold rounded-2xl border-2 transition-all text-sm appearance-none cursor-pointer ${!isFoundInMaster ? 'bg-white border-slate-200 focus:border-joah-orange text-slate-700' : 'bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed'}`}
                                        value={quickAddForm.category_2_actual}
                                        onChange={(e) => setQuickAddForm({ ...quickAddForm, category_2_actual: e.target.value })}
                                        disabled={isFoundInMaster}
                                    >
                                        <option value="">{isFoundInMaster ? quickAddForm.category_2_actual || 'ບໍ່ມີເເຄສ 2' : 'ເລືອກເເຄສ2'}</option>
                                        {!isFoundInMaster && [...new Set(allResults
                                            .filter(r => r.category1 === quickAddForm.category_1_actual && r.category2)
                                            .map(r => r.category2)
                                        )].sort().map(cat2 => (
                                            <option key={cat2} value={cat2}>{cat2}</option>
                                        ))}
                                        {!isFoundInMaster && <option value="CUSTOM">-- ປ້ອນເອງ (Custom) --</option>}
                                    </select>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Reason/Remarks Dropdown */}
                    <div className="p-6 rounded-[2rem] bg-orange-50 dark:bg-orange-950/20 border-2 border-orange-200 dark:border-orange-900/30 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Info size={16} className="text-joah-orange" />
                                <span className="text-[10px] font-black text-joah-orange uppercase tracking-widest">{t('results.reasonPrompt')}</span>
                            </div>
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-100 dark:bg-rose-900/30 px-2 py-0.5 rounded-md uppercase tracking-wide">{t('results.mustFill')}</span>
                        </div>
                        <select
                            value={quickAddForm.remarks}
                            onChange={(e) => setQuickAddForm({ ...quickAddForm, remarks: e.target.value })}
                            className="w-full py-4 px-5 bg-white dark:bg-slate-800 border-2 border-orange-200 dark:border-orange-800/50 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-joah-orange/10 focus:border-joah-orange outline-none transition-all appearance-none cursor-pointer"
                        >
                            <option value="">-- ເລືອກເຫດຜົນ (Select Reason) --</option>
                            <option value="ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)">ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)</option>
                            <option value="ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)">ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)</option>
                            <option value="ບໍ່ມີພື້ນທີ່ຈັດເກັບ / ໂລເຕັມ (No Storage Space)">ບໍ່ມີພື້ນທີ່ຈັດເກັບ / ໂລເຕັມ (No Storage Space)</option>
                            <option value="ສິນຄ້າເສຍຫາຍ (Damaged Goods)">ສິນຄ້າເສຍຫາຍ (Damaged Goods)</option>
                            <option value="ຂໍ້ມູນ Master ຜິດ (Incorrect Master Data)">ຂໍ້ມູນ Master ຜິດ (Incorrect Master Data)</option>
                            <option value="ອື່ນໆ (Other)">ອື່ນໆ (Other)</option>
                        </select>
                    </div>

                    {/* Verifier Info */}
                    <div className="pt-2">
                        <div className="relative group">
                            <span className="floating-label z-10 px-2 bg-white dark:bg-slate-900">{t('results.verifier')}</span>
                            <div className="relative">
                                <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input
                                    type="text"
                                    value={localStorage.getItem('joah_employee_name') || 'Unknown Staff'}
                                    readOnly
                                    className="input-field pl-12 py-4 text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 sm:p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-2 gap-4 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="btn-secondary bg-slate-800 text-white border-slate-700 hover:bg-slate-700 h-16 uppercase text-xs tracking-widest shadow-none disabled:opacity-50 rounded-2xl"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className={`btn-primary h-16 uppercase text-xs tracking-widest shadow-emerald-500/10 bg-emerald-600 hover:bg-emerald-700 rounded-2xl border-none ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        <span>{isSaving ? t('results.saving') : 'Add to Inventory'}</span>
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

export default QuickAddPanel;
