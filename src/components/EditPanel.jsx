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
    mergeAmount,
    setMergeAmount,
    t
}) => {
    const [customMode, setCustomMode] = React.useState(false);
    const [selectedCategory, setSelectedCategory] = React.useState('');

    useEffect(() => {
        if (selectedRow) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedRow]);

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
                onClick={!isUpdating ? onClose : undefined}
            />

            {/* Compact Modal */}
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
                className="dark:!bg-slate-900"
            >
                {/* Minimal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-joah-orange text-white">
                            <Edit2 size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 dark:text-white">ແກ້ໄຂຂໍ້ມູນ</h3>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isUpdating}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors disabled:opacity-50"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Compact Content */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">

                    {/* Item Info - Compact */}
                    <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-2">
                        <div className="flex justify-between items-center text-xs text-slate-500">
                            <span>Item Info</span>
                            <span className="text-joah-orange">#{selectedRow.rowIndex}</span>
                        </div>
                        <p className="text-lg font-bold text-slate-800 dark:text-white font-mono">{selectedRow.barcode}</p>
                        <p className="text-xs text-slate-500 truncate">{selectedRow.masterItemName || selectedRow.itemName}</p>

                        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                            <div>
                                <p className="text-[10px] text-slate-400 mb-1">Location</p>
                                <div className="flex items-center gap-1.5">
                                    <MapPin size={14} className="text-joah-orange" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedRow.rackLocation}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Quantity - Minimal Design */}
                    <div className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-2">
                            <Database size={16} className="text-joah-orange" />
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">ສັງລວມຍອດສິນຄ້າ</p>
                        </div>

                        {/* Simple Calculation */}
                        <div className="flex items-center gap-3">
                            {/* Current */}
                            <div className="flex-1 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-center">
                                <p className="text-[10px] text-slate-500 mb-1">Current</p>
                                <span className="text-xl font-bold text-slate-700 dark:text-slate-300">{editQty || 0}</span>
                            </div>

                            {/* Plus */}
                            <Plus size={16} className="text-slate-400" />

                            {/* Additional Input */}
                            <div className="flex-1">
                                <input
                                    id="merge-input"
                                    type="number"
                                    placeholder="0"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 rounded-lg text-xl font-bold text-joah-orange text-center outline-none focus:border-joah-orange transition-colors"
                                    value={mergeAmount}
                                    onChange={(e) => setMergeAmount(e.target.value)}
                                    autoFocus
                                />
                                <p className="text-[9px] text-slate-400 mt-1 text-center">Additional</p>
                            </div>
                        </div>
                    </div>

                    {/* Rack Location with Direct Dropdown */}
                    <div>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                            <MapPin size={14} className="text-joah-orange" /> Rack Location
                        </p>

                        {/* Location Dropdown */}
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                {/* Dynamic Dropdown */}
                                <select
                                    className="flex-1 py-2.5 px-3 text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:border-joah-orange outline-none"
                                    value={!customMode ? editLocation : (selectedCategory ? editLocation : selectedCategory)}
                                    onChange={(e) => {
                                        const value = e.target.value;

                                        // If selecting CUSTOM option
                                        if (value === 'CUSTOM') {
                                            setCustomMode(true);
                                            setSelectedCategory('');
                                            setEditLocation('');
                                            return;
                                        }

                                        // If in custom mode and no category selected yet (selecting category)
                                        if (customMode && !selectedCategory) {
                                            setSelectedCategory(value);
                                            setEditLocation('');
                                            return;
                                        }

                                        // If in custom mode with category selected (selecting location)
                                        if (customMode && selectedCategory) {
                                            if (value === 'BACK') {
                                                setSelectedCategory('');
                                                setEditLocation('');
                                                return;
                                            }
                                            setEditLocation(value);
                                            // KEEP CUSTOM MODE OPEN - Don't exit for continuous selection
                                            // setCustomMode(false);
                                            // setSelectedCategory('');
                                            return;
                                        }

                                        // Normal mode - selecting location
                                        setEditLocation(value);
                                    }}
                                >
                                    {/* Normal Mode: Show current category locations + Custom */}
                                    {!customMode && (
                                        <>
                                            <option value="">-- ເລືອກໂລເຄຊັ້ນ --</option>
                                            {getRackSuggestions(editCat1 || selectedRow.category1).map(loc => {
                                                const count = results.filter(r => r.rackLocation === loc).length;
                                                return (
                                                    <option key={loc} value={loc}>
                                                        {loc} {count > 0 ? `| ${count} SKU` : ''}
                                                    </option>
                                                );
                                            })}
                                            <option value="CUSTOM">🔧 Custom (ທຸກໝວດໝູ່)</option>
                                        </>
                                    )}

                                    {/* Custom Mode - Step 1: Show Categories */}
                                    {customMode && !selectedCategory && (
                                        <>
                                            <option value="">-- ເລືອກໝວດໝູ່ --</option>
                                            {Object.keys(CATEGORY_RACK_RULES).map(cat => (
                                                <option key={cat} value={cat}>📦 {cat}</option>
                                            ))}
                                        </>
                                    )}

                                    {/* Custom Mode - Step 2: Show Locations in selected category */}
                                    {customMode && selectedCategory && (
                                        <>
                                            <option value="BACK">← ກັບໄປເລືອກໝວດໝູ່</option>
                                            <option value="">-- ເລືອກໂລເຄຊັ້ນ --</option>
                                            {getRackSuggestions(selectedCategory).map(loc => {
                                                const count = results.filter(r => r.rackLocation === loc).length;
                                                return (
                                                    <option key={loc} value={loc}>
                                                        {loc} {count > 0 ? `| ${count} SKU` : ''}
                                                    </option>
                                                );
                                            })}
                                        </>
                                    )}
                                </select>

                                {/* Eye Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const loc = editLocation || selectedRow.rackLocation;
                                        if (loc) setInspectedLocation(loc);
                                    }}
                                    disabled={!editLocation && !selectedRow.rackLocation}
                                    className="px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-500 hover:text-joah-orange disabled:opacity-50 transition-colors"
                                >
                                    <Eye size={18} />
                                </button>
                            </div>

                            {/* Current Location Display */}
                            {editLocation && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <MapPin size={14} className="text-joah-orange" />
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{editLocation}</span>
                                    {editLocation !== selectedRow.rackLocation && (
                                        <span className="ml-auto text-[9px] font-semibold text-joah-orange bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-md">Changed</span>
                                    )}
                                </div>
                            )}

                            {/* Status Indicator for Custom Mode */}
                            {customMode && (
                                <div className="flex items-center gap-2 text-xs text-joah-orange px-3 py-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-900/30">
                                    <div className="w-2 h-2 bg-joah-orange rounded-full animate-pulse"></div>
                                    <span className="font-semibold">
                                        {!selectedCategory ? 'ກຳລັງເລືອກໝວດໝູ່...' : `ເລືອກໂລໃນ ${selectedCategory} (ຕໍ່ເນື່ອງ)`}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Categories - Compact */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs text-slate-500 mb-1.5">Category 1</p>
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{editCat1 || selectedRow.category1 || '-'}</span>
                            </div>
                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1.5">Category 2</p>
                            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{editCat2 || selectedRow.category2 || '-'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Reason - Minimal */}
                    <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-900/30">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5">
                                <Info size={14} className="text-joah-orange" />
                                <span className="text-xs font-semibold text-joah-orange">{t('results.reasonPrompt')}</span>
                            </div>
                            <span className="text-[9px] font-semibold text-rose-500">Required</span>
                        </div>
                        <select
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            className="w-full py-2 px-3 text-sm font-medium bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-lg focus:border-joah-orange outline-none"
                        >
                            <option value="">-- ເລືອກເຫດຜົນ --</option>
                            <optgroup label="📦 Quantity">
                                <option value="ນັບສິນຄ້າໃໝ່ (Recount)">ນັບສິນຄ້າໃໝ່</option>
                                <option value="ພົບສິນຄ້າເພີ່ມ (Found Additional Stock)">ພົບສິນຄ້າເພີ່ມ</option>
                                <option value="ສິນຄ້າຫາຍ / ຂາດ (Missing / Shortage)">ສິນຄ້າຫາຍ / ຂາດ</option>
                                <option value="ສິນຄ້າເສຍຫາຍ (Damaged Goods)">ສິນຄ້າເສຍຫາຍ</option>
                                <option value="ຮັບສິນຄ້າເຂົ້າໃໝ່ (New Stock Received)">ຮັບສິນຄ້າເຂົ້າໃໝ່</option>
                                <option value="ສົ່ງສິນຄ້າອອກ (Stock Out / Sold)">ສົ່ງສິນຄ້າອອກ</option>
                            </optgroup>
                            <optgroup label="📍 Location">
                                <option value="ຍ້າຍໄປພື້ນທີ່ໃໝ່ (Relocated to New Area)">ຍ້າຍໄປພື້ນທີ່ໃໝ່</option>
                                <option value="ຈັດລຽງຊ້ັນວາງຄືນໃໝ່ (Shelf Reorganization)">ຈັດລຽງຊ້ັນວາງຄືນໃໝ່</option>
                                <option value="ສິນຄ້າວາງຜິດບ່ອນ (Misplaced Item)">ສິນຄ້າວາງຜິດບ່ອນ</option>
                            </optgroup>
                            <optgroup label="⚙️ Other">
                                <option value="ແກ້ໄຂຂໍ້ມູນຜິດພາດ (Data Correction)">ແກ້ໄຂຂໍ້ມູນຜິດພາດ</option>
                                <option value="ຄຳສັ່ງຈາກຜູ້ຈັດການ (Manager Request)">ຄຳສັ່ງຈາກຜູ້ຈັດການ</option>
                                <option value="ອື່ນໆ (Other)">ອື່ນໆ</option>
                            </optgroup>
                        </select>
                    </div>

                    {/* Verifier */}
                    <div>
                        <p className="text-xs text-slate-500 mb-1.5">{t('results.verifier')}</p>
                        <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <User size={16} className="text-slate-400" />
                            <input
                                type="text"
                                value={currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown')}
                                readOnly
                                className="flex-1 bg-transparent text-sm font-medium text-slate-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Simple Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-2 gap-3">
                    <button
                        onClick={onClose}
                        disabled={isUpdating}
                        className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                        {t('common.cancel')}
                    </button>
                    <button
                        onClick={handleUpdate}
                        disabled={isUpdating}
                        className="px-4 py-2.5 rounded-lg bg-joah-orange text-white text-sm font-semibold hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 className="animate-spin" size={16} />
                                <span>{t('results.saving')}</span>
                            </>
                        ) : (
                            <>
                                <Save size={16} />
                                <span>{t('results.saveChanges')}</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default EditPanel;