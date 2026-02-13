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
    const [customMode, setCustomMode] = React.useState(false);
    const [selectedCategory, setSelectedCategory] = React.useState('');

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
                    category_1_actual: '', // Will be set by Location Selection
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
            {/* Simple Backdrop */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.4)',
                }}
                onClick={!isSaving ? onClose : undefined}
            />

            {/* Compact Modal (Matched EditPanel Style) */}
            <div
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '520px',
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '90vh',
                    overflow: 'hidden',
                }}
                className="dark:!bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
                {/* Minimal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm">
                            <Plus size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">ເພີ່ມຂໍ້ມູນເຂົ້າ Inventory</h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Compact Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">

                    {/* Warning Banner when NOT found in Master */}
                    {!isFoundInMaster && quickAddForm.barcode_no && (
                        <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 flex items-center gap-3">
                            <AlertTriangle className="text-rose-600 dark:text-rose-400 shrink-0" size={18} />
                            <div>
                                <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">⚠️ ບໍ່ພົບໃນ Master Data</h4>
                                <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">ກະລຸນາເພີ່ມຂໍ້ມູນໃນ "Product Manager" ກ່ອນ.</p>
                            </div>
                        </div>
                    )}

                    {/* Item Info Input Group */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Item Details</span>
                            {isFoundInMaster && (
                                <span className="text-emerald-500 font-bold flex items-center gap-1">
                                    <CheckCircle size={12} /> Master Verified
                                </span>
                            )}
                        </div>

                        {/* Barcode Input */}
                        <div className="relative">
                            <input
                                type="text"
                                value={quickAddForm.barcode_no}
                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, barcode_no: e.target.value }))}
                                className="w-full bg-transparent text-lg font-bold text-slate-800 dark:text-white font-mono outline-none placeholder:text-slate-300"
                                placeholder="Scan Barcode..."
                                autoFocus
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Barcode</p>
                        </div>

                        <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />

                        {/* Name Input */}
                        <div>
                            <input
                                type="text"
                                value={quickAddForm.item_name}
                                readOnly={isFoundInMaster}
                                disabled={!isFoundInMaster}
                                onChange={(e) => setQuickAddForm(prev => ({ ...prev, item_name: e.target.value }))}
                                className={`w-full bg-transparent text-sm font-medium outline-none ${isFoundInMaster ? 'text-slate-600 dark:text-slate-400 cursor-default' : 'text-slate-800 dark:text-white'}`}
                                placeholder={isFoundInMaster ? "Product Name" : "Enter Product Name..."}
                            />
                            <p className="text-[10px] text-slate-400 mt-1">Item Name</p>
                        </div>
                    </div>

                    {/* Quantity Section */}
                    <div className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-emerald-500" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">ຈຳນວນສິນຄ້າ (Quantity)</p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Total Preview (Current Value) */}
                            <div className="flex-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">Total</p>
                                <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{quickAddForm.qty || 0}</span>
                            </div>

                            {/* Plus Icon */}
                            <Plus size={16} className="text-slate-400" />

                            {/* Merge/Add Input */}
                            <div className="flex-1">
                                <input
                                    id="quick-merge-input"
                                    type="number"
                                    placeholder="0"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-lg text-xl font-bold text-emerald-600 dark:text-emerald-400 text-center outline-none focus:border-emerald-500 transition-colors"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            const val = parseFloat(e.target.value) || 0;
                                            setQuickAddForm(prev => ({ ...prev, qty: (parseFloat(prev.qty) || 0) + val }));
                                            e.target.value = '';
                                            e.preventDefault();
                                        }
                                    }}
                                />
                                <p className="text-[9px] text-slate-400 mt-1 text-center">Add Amount</p>
                            </div>

                            {/* Merge Button (Small) */}
                            <button
                                type="button"
                                onClick={() => {
                                    const input = document.getElementById('quick-merge-input');
                                    const val = parseFloat(input.value) || 0;
                                    setQuickAddForm(prev => ({ ...prev, qty: (parseFloat(prev.qty) || 0) + val }));
                                    input.value = '';
                                }}
                                className="p-3 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm active:scale-95 transition-all"
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Location Section (Unified with Category Logic) */}
                    <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                            <MapPin size={14} className="text-emerald-500" /> Rack Location {customMode && <span className="text-[10px] text-emerald-500 font-normal">(Custom Mode)</span>}
                        </p>

                        <div className="flex gap-2">
                            <select
                                className="flex-1 py-2.5 px-3 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-emerald-500 outline-none transition-colors"
                                value={!customMode ? quickAddForm.rack_location : (selectedCategory ? quickAddForm.rack_location : selectedCategory)}
                                onChange={(e) => {
                                    const value = e.target.value;

                                    // 1. Enter Custom Mode
                                    if (value === 'CUSTOM') {
                                        setCustomMode(true);
                                        setSelectedCategory('');
                                        return;
                                    }

                                    // 2. Custom Mode: Select Category
                                    if (customMode && !selectedCategory) {
                                        setSelectedCategory(value);
                                        // Auto-update Category 1 in form
                                        setQuickAddForm(prev => ({ ...prev, category_1_actual: value }));
                                        return;
                                    }

                                    // 3. Custom Mode: Select Location (or Back)
                                    if (customMode && selectedCategory) {
                                        if (value === 'BACK') {
                                            setSelectedCategory('');
                                            return;
                                        }
                                        setQuickAddForm(prev => ({ ...prev, rack_location: value }));
                                        return;
                                    }

                                    // 4. Normal Mode: Select Location directly
                                    setQuickAddForm(prev => ({ ...prev, rack_location: value }));
                                }}
                            >
                                {!customMode && (
                                    <>
                                        <option value="">-- ເລືອກໂລເຄຊັ້ນ --</option>
                                        {/* Show suggestions based on current Cat 1 (if exists) or all? EditPanel logic suggests based on Cat 1 */}
                                        {getRackSuggestions(quickAddForm.category_1_actual || selectedCategory).map(loc => {
                                            const count = allResults.filter(r => r.rackLocation === loc).length;
                                            return (
                                                <option key={loc} value={loc}>
                                                    {loc} {count > 0 ? `| ${count} SKU` : ''}
                                                </option>
                                            );
                                        })}
                                        <option value="CUSTOM">🔧 Custom (ເລືອກຕາມໝວດໝູ່)</option>
                                    </>
                                )}

                                {customMode && !selectedCategory && (
                                    <>
                                        <option value="">-- ເລືອກໝວດໝູ່ --</option>
                                        {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                            <option key={cat} value={cat}>📦 {cat}</option>
                                        ))}
                                    </>
                                )}

                                {customMode && selectedCategory && (
                                    <>
                                        <option value="BACK">← ກັບໄປເລືອກໝວດໝູ່</option>
                                        <option value="">-- ເລືອກໂລເຄຊັ້ນ ({selectedCategory}) --</option>
                                        {getRackSuggestions(selectedCategory).map(loc => {
                                            const count = allResults.filter(r => r.rackLocation === loc).length;
                                            return (
                                                <option key={loc} value={loc}>
                                                    {loc} {count > 0 ? `| ${count} SKU` : ''}
                                                </option>
                                            );
                                        })}
                                    </>
                                )}
                            </select>

                            <button
                                type="button"
                                onClick={() => quickAddForm.rack_location && setInspectedLocation(quickAddForm.rack_location)}
                                disabled={!quickAddForm.rack_location}
                                className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-emerald-500 disabled:opacity-50 transition-colors"
                            >
                                <Eye size={18} />
                            </button>
                        </div>

                        {/* Show selected location chip & status */}
                        {quickAddForm.rack_location && (
                            <div className="mt-2 flex items-center gap-2">
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <MapPin size={14} className="text-emerald-500" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{quickAddForm.rack_location}</span>
                                </div>
                                {customMode && (
                                    <span className="text-[10px] font-medium text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-md border border-emerald-100 dark:border-emerald-800">
                                        Manual Select
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Category Display (Compact & Read-Only / Auto-filled) */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-slate-500 mb-1.5">Category 1</p>
                            <div className={`px-3 py-2 border rounded-lg ${isFoundInMaster ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {quickAddForm.category_1_actual || '-'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1.5">Category 2</p>
                            <div className={`px-3 py-2 border rounded-lg ${isFoundInMaster ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    {quickAddForm.category_2_actual || '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Reason/Remarks Dropdown */}
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <Info size={14} className="text-joah-orange" />
                                <span className="text-xs font-semibold text-joah-orange">{t('results.reasonPrompt')}</span>
                            </div>
                            <span className="text-[9px] font-semibold text-rose-500">Required</span>
                        </div>
                        <select
                            value={quickAddForm.remarks}
                            onChange={(e) => setQuickAddForm({ ...quickAddForm, remarks: e.target.value })}
                            className="w-full py-2 px-3 text-sm font-medium bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-lg focus:border-joah-orange outline-none"
                        >
                            <option value="">-- ເລືອກເຫດຜົນ (Select Reason) --</option>
                            <option value="ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)">ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)</option>
                            <option value="ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)">ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)</option>
                            <option value="ບໍ່ມີພື້ນທີ່ຈັດເກັບ / ໂລເຕັມ (No Storage Space)">ບໍ່ມີພື້ນທີ່ຈັດເກັບ / ໂລເຕັມ (No Storage Space)</option>
                            <option value="ສິນຄ້າເສຍຫາຍ (Damaged Goods)">ສິນຄ້າເສຍຫາຍ (Damaged Goods)</option>
                            <option value="ข้อมูล Master ຜິດ (Incorrect Master Data)">ຂໍ້ມູນ Master ຜິດ (Incorrect Master Data)</option>
                            <option value="ອື່ນໆ (Other)">ອື່ນໆ (Other)</option>
                        </select>
                    </div>

                    {/* Verifier */}
                    <div>
                        <p className="text-xs text-slate-500 mb-1.5">{t('results.verifier')}</p>
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <User size={16} className="text-slate-400" />
                            <input
                                type="text"
                                value={localStorage.getItem('joah_employee_name') || 'Unknown Staff'}
                                readOnly
                                className="flex-1 bg-transparent text-sm font-medium text-slate-500 outline-none"
                            />
                        </div>
                    </div>

                </div>

                {/* Compact Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-2 gap-3 flex-shrink-0">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        <span>{isSaving ? t('results.saving') : 'Add Inventory'}</span>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default QuickAddPanel;
