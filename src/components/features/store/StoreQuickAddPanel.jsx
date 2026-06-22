import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Database, MapPin, Info, User, Save, Loader2, Eye, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, CornerDownRight, Sparkles, RefreshCw, ScanLine } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { getStoreRackSuggestions, getStoreBranchCategories, validateStoreRack } from '../../../utils/storeRackUtils';
import LocationInspector from '../inventory/LocationInspector';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';

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
    onAddNewProduct,
    currentBranch
}) => {
    // Custom Dropdown States
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [customMode, setCustomMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [viewingCategories, setViewingCategories] = useState(false); // New state to toggle Category Selection View
    const [localInspectedLocation, setLocalInspectedLocation] = useState(null); // Local inspector state
    const dropdownRef = useRef(null);
    const qtyInputRef = useRef(null); // 🆕 Ref for Quantity input
    const maxQtyInputRef = useRef(null); // 🆕 Ref for Max Qty input
    const locationTriggerRef = useRef(null); // 🆕 Ref for Rack Location trigger
    const [focusedStep, setFocusedStep] = useState('qty'); // 🆕 Track speedrun steps: 'qty', 'maxQty', 'tag', 'rack'
    const [locationSearch, setLocationSearch] = useState('');
    const [showLocationScanner, setShowLocationScanner] = useState(false); // 🆕 Scanner for locations
    const [dcQty, setDcQty] = useState(0); // 🆕 DC Qty state
    // Reason Logic
    const [selectedReasonOption, setSelectedReasonOption] = useState(t('reasons.firstTimeRecord') || '');
    const [otherReasonText, setOtherReasonText] = useState('');

    // Ensure onSave uses latest function to prevent stale closure on Enter key submission
    const latestOnSave = useRef(onSave);
    useEffect(() => {
        latestOnSave.current = onSave;
    }, [onSave]);

    // Handle Global Keyboard Events (Enter & Arrows)
    useEffect(() => {
        const handleGlobalKeys = (e) => {
            if (!isOpen || isSaving) return;
            
            // 1. ARROW KEYS (Only for Product Tag step)
            if (focusedStep === 'tag') {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    setQuickAddForm(prev => ({ ...prev, product_tag: 'hook' }));
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    setQuickAddForm(prev => ({ ...prev, product_tag: 'shelf' }));
                }
            }

            // 2. ENTER KEY (For Product Tag and Rack steps, since they have no direct text input when closed)
            if (e.key === 'Enter') {
                // Ignore if user is typing in any input field (handled locally)
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
                
                if (focusedStep === 'tag') {
                    e.preventDefault();
                    setFocusedStep('rack');
                    if (!quickAddForm.rack_location) {
                        setDropdownOpen(true);
                    }
                } else if (focusedStep === 'rack' && !dropdownOpen) {
                    // Final Save
                    e.preventDefault();
                    if (!quickAddForm.qty || parseFloat(quickAddForm.qty) <= 0 || (selectedReasonOption === t('reasons.newStock') && parseFloat(quickAddForm.qty) <= 0)) {
                        return;
                    }
                    if (latestOnSave.current) {
                        latestOnSave.current();
                    }
                }
            }
        };

        document.addEventListener('keydown', handleGlobalKeys);
        return () => document.removeEventListener('keydown', handleGlobalKeys);
    }, [isOpen, isSaving, focusedStep, quickAddForm.qty, quickAddForm.rack_location, selectedReasonOption, t, setQuickAddForm]);

    useEffect(() => {
        if (selectedReasonOption === 'Other') {
            setQuickAddForm(prev => ({ ...prev, remarks: otherReasonText ? `Other: ${otherReasonText}` : 'Other' }));
        } else {
            setQuickAddForm(prev => ({ ...prev, remarks: selectedReasonOption }));
        }
    }, [selectedReasonOption, otherReasonText, setQuickAddForm]);

    // Persist Rack Location & Product Tag to localStorage
    useEffect(() => {
        if (quickAddForm.rack_location) {
            localStorage.setItem('joah_last_rack_location', quickAddForm.rack_location);
        }
        if (quickAddForm.product_tag) {
            localStorage.setItem('joah_last_product_tag', quickAddForm.product_tag);
        }
    }, [quickAddForm.rack_location, quickAddForm.product_tag]);

    // Reset reason when panel opens/closes
    useEffect(() => {
        if (isOpen) {
            // Set Default Reason when opened
            const defaultReason = t('reasons.firstTimeRecord');
            setSelectedReasonOption(defaultReason);
            setQuickAddForm(prev => {
                const lastTag = localStorage.getItem('joah_last_product_tag') || '';
                return { ...prev, remarks: defaultReason, product_tag: prev.product_tag || lastTag };
            });

            // ⚡ SPEEDRUN: Reset to first step
            setFocusedStep('qty');
            setTimeout(() => {
                qtyInputRef.current?.focus();
                qtyInputRef.current?.select();
            }, 100);
        } else {
            setSelectedReasonOption('');
            setOtherReasonText('');
            setDropdownOpen(false);
            setLocationSearch('');
            setCustomMode(false); // Reset Custom Mode
            setSelectedCategory(''); // Reset Category Filter
            setViewingCategories(false); // Reset View
            setLocalInspectedLocation(null); // Reset Local Inspector
            setShowLocationScanner(false); // 🆕 Reset scanner
        }
    }, [isOpen, t]);

    // Reset search when dropdown closes
    useEffect(() => {
        if (!dropdownOpen) {
            setLocationSearch('');
        }
    }, [dropdownOpen]);

    // 🆕 Auto-select Rack if search matches an existing location (for Barcode Scanners)
    useEffect(() => {
        if (!locationSearch || !dropdownOpen) return;
        
        const searchUpper = locationSearch.trim().toUpperCase();
        const allPossible = getAllLocations();
        const match = allPossible.find(loc => loc.toUpperCase() === searchUpper);
        
        if (match) {
            setQuickAddForm(prev => ({ ...prev, rack_location: match }));
            setDropdownOpen(false);
            setLocationSearch('');
        }
    }, [locationSearch, dropdownOpen, setQuickAddForm]);

    // ⚡ OPTIMIZED: On-Demand Master Data Search
    useEffect(() => {
        const lookupBarcode = async () => {
            if (!isOpen || !quickAddForm.barcode_no) return;

            const barcode = String(quickAddForm.barcode_no).trim();
            if (barcode.length < 3) return; // Don't search too early

            try {
                // 1. ลองหาใน local masterData ก่อน (ถ้ามีโหลดมาแล้ว)
                let masterItem = masterData.find(m =>
                    String(m.barcode || m.Barcode || m['Barcode No.'] || '').trim() === barcode
                );

                // 2. ถ้าไม่เจอ ให้ถาม Database โดยตรง (แม่นยำที่สุด)
                if (!masterItem) {
                    const { data: dbItems, error } = await supabase
                        .from('master_data')
                        .select('barcode, product_name_la, item_name, category_1, category_2, branch_id')
                        .eq('barcode', barcode);

                    if (!error && dbItems && dbItems.length > 0) {
                        // Priority: ຕະຫຼາດລາວ
                        masterItem = dbItems.find(i => i.branch_id === 'ຕະຫຼາດລາວ') || dbItems[0];
                    }
                }

                // 🔍 DEBUG
                console.group(`%c[QuickAdd] Master Lookup: "${barcode}"`, 'color: #10b981; font-weight: bold;');
                if (masterItem) {
                    console.log('✅ Found:', masterItem);
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
                    console.warn('❌ Not found in database');
                    setIsFoundInMaster(false);
                    setQuickAddForm(prev => ({
                        ...prev,
                        // Only clear item_name if it wasn't pre-filled from Inbox (preserve Inbox product name)
                        item_name: prev.item_name || '',
                        category_1_actual: '',
                        category_2_actual: '',
                        // NOTE: Do NOT reset qty or rack_location here — they may be pre-filled from inbox flow
                    }));
                }
                console.groupEnd();

                // 3. 🆕 Fetch DC Qty
                const { data: dcData } = await supabase
                    .from('table_dc_stock')
                    .select('qty')
                    .eq('barcode', barcode)
                    .eq('branch_id', currentBranch || localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ')
                    .maybeSingle();
                setDcQty(dcData?.qty || 0);

            } catch (err) {
                console.error('Master Lookup Error:', err);
            }
        };

        const timeoutId = setTimeout(lookupBarcode, 300); // Debounce to prevent too many requests
        return () => clearTimeout(timeoutId);

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

    // Close on Escape & Click Outside Logic (For Custom Dropdown)
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (dropdownOpen) setDropdownOpen(false);
                else if (!isSaving) onClose();
            }
        };

        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEsc);
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('keydown', handleEsc);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose, isSaving, dropdownOpen]);

    if (!isOpen) return null;

    // Use branch-specific rules
    const branchCategories = getStoreBranchCategories(currentBranch);

    const getAllLocations = () => {
        const allLocs = [];
        branchCategories.forEach(cat => {
            allLocs.push(...getStoreRackSuggestions(cat, currentBranch));
        });
        return [...new Set(allLocs)].sort(); // Unique and Sorted
    };

    // 1. Locations recommended by Rules (Categories)
    const ruleMatchedRacks = (quickAddForm.category_1_actual && currentBranch)
        ? getStoreRackSuggestions(quickAddForm.category_1_actual, currentBranch)
        : [];

    // 2. Locations recommended by Previous Scans
    const recommendedScannedLocs = quickAddForm.barcode_no
        ? [...new Set(allResults.filter(r => String(r.barcode).trim() === String(quickAddForm.barcode_no).trim() && r.rackLocation).map(r => r.rackLocation))]
        : [];

    // 3. Current Validation Status
    const isRackValid = (quickAddForm.rack_location && quickAddForm.category_1_actual)
        ? validateStoreRack(quickAddForm.rack_location, quickAddForm.category_1_actual, currentBranch)
        : true; // Default true if no data yet

    const panelPortal = createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 sm:p-4 bg-black/40">
            {/* Simple Backdrop */}
            <div
                className="absolute inset-0"
                onClick={!isSaving ? onClose : undefined}
            />

            {/* Container for Side-by-Side Layout */}
            <div className="relative z-10 flex items-start gap-4 w-full h-full sm:w-auto sm:h-auto sm:max-h-[90vh]">

                {/* Compact Modal (Matched EditPanel Style) */}
                <div
                    className="w-full h-full sm:h-auto sm:max-w-[520px] bg-white dark:bg-slate-900 rounded-none sm:rounded-xl shadow-none sm:shadow-md flex flex-col overflow-hidden border-0 sm:border border-slate-200 dark:border-slate-800"
                >
                    {/* Minimal Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm">
                                <Plus size={18} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('quickAdd.title')}</h3>
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
                                    <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300">{t('quickAdd.notFoundMaster')}</h4>
                                    <p className="text-[10px] font-medium text-rose-600 dark:text-rose-400">{t('quickAdd.pleaseAddMaster')}</p>
                                </div>
                            </div>
                        )}

                        {/* Item Info Input Group */}
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>{t('quickAdd.itemDetails')}</span>
                                {isFoundInMaster && (
                                    <span className="text-emerald-500 font-bold flex items-center gap-1">
                                        <CheckCircle size={12} /> {t('quickAdd.masterVerified')}
                                    </span>
                                )}
                            </div>

                            {/* Barcode Input */}
                            <div className="relative">
                                <input
                                    type="text"
                                    value={quickAddForm.barcode_no}
                                    readOnly
                                    className="w-full bg-transparent text-lg font-bold text-slate-500 dark:text-slate-400 font-mono outline-none cursor-not-allowed select-none"
                                    placeholder="Scan Barcode..."
                                />
                                <div className="flex items-center gap-1 mt-1">
                                    <p className="text-[10px] text-slate-400">{t('quickAdd.barcode')}</p>
                                    <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-1.5 rounded-sm font-bold tracking-wider">ອ່ານໄດ້ເທົ່ານັ້ນ (Read-only)</span>
                                </div>
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
                                    placeholder={isFoundInMaster ? t('quickAdd.itemName') : t('quickAdd.enterItemName')}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">{t('quickAdd.itemName')}</p>
                            </div>
                        </div>

                        {/* Quantity + Max Qty Section (2-Column) */}
                        <div className="grid grid-cols-2 gap-3">
                            {/* QTY */}
                            <div className="p-4 rounded-lg border-2 border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-900/10 space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <Database size={13} className="text-emerald-500" />
                                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide">{t('quickAdd.quantity')}</p>
                                </div>
                                <input
                                    ref={qtyInputRef}
                                    type="number"
                                    value={quickAddForm.qty === 0 ? '' : quickAddForm.qty}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        setQuickAddForm(prev => ({ ...prev, qty: val }));
                                    }}
                                    onFocus={() => setFocusedStep('qty')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            maxQtyInputRef.current?.focus();
                                            maxQtyInputRef.current?.select();
                                            setFocusedStep('maxQty');
                                        }
                                    }}
                                    placeholder="0"
                                    className="w-full p-2 bg-white dark:bg-slate-800 border-2 border-emerald-200 dark:border-emerald-900/50 rounded-xl text-2xl font-black text-emerald-600 dark:text-emerald-400 text-center outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 number-input-no-arrows"
                                />
                                <p className="text-[10px] text-slate-400 text-center">{t('quickAdd.identifyQty')}</p>
                                
                                {/* 🆕 DC hint — only when New Stock In OR First-time record */}
                                {(selectedReasonOption === t('reasons.newStock') || selectedReasonOption === t('reasons.firstTimeRecord')) && (
                                    <p className="text-[10px] text-violet-500 font-bold mt-1 text-center animate-in fade-in duration-200">
                                        ⚡ ຈຳນວນນີ້ຈະລຸດ QTY DC อັດຕະໂນມັດ (DC ເຫຼືອ: {dcQty})
                                    </p>
                                )}
                            </div>

                            {/* MAX QTY */}
                            <div className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30 space-y-2">
                                <div className="flex items-center gap-1.5">
                                    <RefreshCw size={13} className="text-slate-400" />
                                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Max Qty</p>
                                </div>
                                <input
                                    ref={maxQtyInputRef}
                                    type="number"
                                    value={quickAddForm.max_qty === 0 ? '' : quickAddForm.max_qty}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        setQuickAddForm(prev => ({ ...prev, max_qty: val }));
                                    }}
                                    onFocus={() => setFocusedStep('maxQty')}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            setFocusedStep('tag');
                                            e.target.blur(); // Blur to show tag focus visually
                                        }
                                    }}
                                    placeholder="—"
                                    className="w-full p-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-2xl font-black text-slate-500 dark:text-slate-400 text-center outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-400/10 transition-all placeholder:text-slate-200 number-input-no-arrows"
                                />
                                <p className="text-[10px] text-slate-400 text-center">ຄວາມຈຸສູງສຸດ</p>
                            </div>
                        </div>

                        {/* Product Tag Section */}
                        <div className={`p-3.5 rounded-lg border-2 transition-all ${focusedStep === 'tag' ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 shadow-md ring-4 ring-emerald-500/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800/20'}`}>
                            <div className="flex justify-between items-center mb-2.5">
                                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <span>🏷️</span> ປະເພດການວາງສິນຄ້າ
                                </p>
                                {focusedStep === 'tag' && <span className="text-[10px] font-black text-emerald-600 animate-pulse">← Use Arrows to Select →</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {/* Hook */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickAddForm(prev => ({ ...prev, product_tag: 'hook' }));
                                        setFocusedStep('tag');
                                    }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${quickAddForm.product_tag === 'hook'
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 shadow-sm shadow-violet-200 dark:shadow-violet-900/20'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-900/10'
                                        } ${focusedStep === 'tag' && quickAddForm.product_tag === 'hook' ? 'ring-2 ring-violet-400 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                                >
                                    <span className="text-base">🪝</span>
                                    <div className="text-left">
                                        <p className="text-xs font-black leading-tight">Hook</p>
                                        <p className="text-[9px] font-medium opacity-60 leading-tight">ແຂວນ Hook</p>
                                    </div>
                                    {quickAddForm.product_tag === 'hook' && (
                                        <CheckCircle size={14} className="ml-auto text-violet-500 flex-shrink-0" />
                                    )}
                                </button>

                                {/* Shelf */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setQuickAddForm(prev => ({ ...prev, product_tag: 'shelf' }));
                                        setFocusedStep('tag');
                                    }}
                                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 font-bold text-sm transition-all ${quickAddForm.product_tag === 'shelf'
                                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 shadow-sm shadow-sky-200 dark:shadow-sky-900/20'
                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-sky-300 hover:bg-sky-50/50 dark:hover:bg-sky-900/10'
                                        } ${focusedStep === 'tag' && quickAddForm.product_tag === 'shelf' ? 'ring-2 ring-sky-400 ring-offset-2 dark:ring-offset-slate-900' : ''}`}
                                >
                                    <span className="text-base">📦</span>
                                    <div className="text-left">
                                        <p className="text-xs font-black leading-tight">Shelf</p>
                                        <p className="text-[9px] font-medium opacity-60 leading-tight">ວາງຊັ້ນ</p>
                                    </div>
                                    {quickAddForm.product_tag === 'shelf' && (
                                        <CheckCircle size={14} className="ml-auto text-sky-500 flex-shrink-0" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Location Section (CUSTOM DROPDOWN) */}
                        <div className={`transition-all ${focusedStep === 'rack' ? 'p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/5 ring-4 ring-emerald-500/10' : ''}`}>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                <MapPin size={14} className="text-emerald-500" />
                                {t('quickAdd.targetLocation')}
                                {customMode && <span className="text-[10px] text-emerald-500 font-normal ml-2">{t('quickAdd.customMode')}</span>}
                                {focusedStep === 'rack' && <span className="text-[10px] font-black text-emerald-600 ml-auto animate-pulse">Press ENTER to Save</span>}
                            </p>

                            {/* 🔁 Smart Rack Memory Badge */}
                            {localStorage.getItem('joah_last_rack_location') && (
                                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
                                    <span className="text-[11px] font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                                        🔁 ເກັບຄ່າ Rack ຫຼ້າສຸດ:
                                        <span className="font-mono bg-emerald-100 dark:bg-emerald-800 px-1.5 py-0.5 rounded-md">
                                            {localStorage.getItem('joah_last_rack_location')}
                                        </span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            localStorage.removeItem('joah_last_rack_location');
                                            setQuickAddForm(prev => ({ ...prev, rack_location: '' }));
                                        }}
                                        className="ml-auto text-[9px] font-black text-rose-400 hover:text-rose-600 transition-colors uppercase tracking-wide"
                                        title="ລ້າງ Rack ທີ່ຈຳໄວ້"
                                    >
                                        ✕ ລ້າງ
                                    </button>
                                </div>
                            )}

                            <div className="flex gap-2" ref={dropdownRef}>
                                {/* CUSTOM SELECT TRIGGER */}
                                <div
                                    className={`flex-1 relative cursor-pointer select-none`}
                                    onClick={() => {
                                        setDropdownOpen(!dropdownOpen);
                                        setFocusedStep('rack');
                                    }}
                                >
                                    <div className={`w-full py-3 px-4 flex items-center justify-between text-base font-black bg-white dark:bg-slate-800 border-2 ${dropdownOpen || focusedStep === 'rack' ? 'border-emerald-500 ring-4 ring-emerald-500/10' : !isRackValid ? 'border-rose-400 bg-rose-50' : 'border-slate-200 dark:border-slate-700'} rounded-2xl transition-all shadow-sm`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-1.5 rounded-lg ${!isRackValid ? 'bg-rose-500 text-white' : (quickAddForm.rack_location && isRackValid) ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                {!isRackValid ? <AlertTriangle size={16} /> : (quickAddForm.rack_location && isRackValid) ? <CheckCircle size={16} /> : <MapPin size={16} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className={quickAddForm.rack_location || selectedCategory ? 'text-slate-900 dark:text-white' : 'text-slate-300'}>
                                                    {customMode && viewingCategories
                                                        ? t('quickAdd.selectCategory')
                                                        : (customMode && !viewingCategories && !quickAddForm.rack_location)
                                                            ? (selectedCategory ? `${t('quickAdd.selectLocationIn')} ${selectedCategory}...` : t('quickAdd.selectLocationAll'))
                                                            : (quickAddForm.rack_location || t('quickAdd.selectLocationPlaceholder'))
                                                    }
                                                </span>
                                                {quickAddForm.category_1_actual && (
                                                    <span className={`text-[9px] uppercase tracking-widest font-black ${!isRackValid ? 'text-rose-500' : 'text-slate-400'}`}>
                                                        {!isRackValid ? `❌ ຜິດໝວດ (ຕ້ອງການ ${quickAddForm.category_1_actual})` : `🎯 Category: ${quickAddForm.category_1_actual}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronDown size={20} className={`text-slate-300 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {/* CUSTOM DROPDOWN MENU */}
                                    {dropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                            {/* Search Input */}
                                            <div className="p-2 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-20 flex-shrink-0">
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        value={locationSearch}
                                                        onChange={(e) => setLocationSearch(e.target.value)}
                                                        onFocus={() => setFocusedStep('rack')}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                if (locationSearch) {
                                                                    // Get all locations manually to find the first match
                                                                    const allPossibleRacks = [];
                                                                    Object.values(BRANCH_RACK_RULES[currentBranch] || {}).forEach(rules => {
                                                                        rules.forEach(rule => allPossibleRacks.push(...rule.zones));
                                                                    });
                                                                    const searchFilteredAll = allPossibleRacks.filter(loc => loc.toUpperCase().includes(locationSearch.toUpperCase()));
                                                                    const canAddCustom = locationSearch.trim().length > 0 && !searchFilteredAll.some(f => f.toUpperCase() === locationSearch.toUpperCase());
                                                                    
                                                                    let picked = '';
                                                                    if (canAddCustom) picked = locationSearch.toUpperCase();
                                                                    else if (searchFilteredAll.length > 0) picked = searchFilteredAll[0];
                                                                    
                                                                    if (picked) {
                                                                        setQuickAddForm(prev => ({ ...prev, rack_location: picked }));
                                                                        setDropdownOpen(false);
                                                                        setLocationSearch('');
                                                                    }
                                                                } else {
                                                                    // If empty, just close dropdown
                                                                    setDropdownOpen(false);
                                                                }
                                                            }
                                                        }}
                                                        placeholder="🔍 ຄົ້ນຫາ Location..."
                                                        className="w-full pl-3 pr-10 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all font-bold"
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setShowLocationScanner(true);
                                                        }}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-emerald-500 rounded-md hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all"
                                                        title="Scan Location Label"
                                                    >
                                                        <ScanLine size={16} strokeWidth={2.5} />
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="overflow-y-auto flex-1">

                                                {/* State 1: Custom Mode - Select Category (Only if VIEWING CATEGORIES) */}
                                                {customMode && viewingCategories && (
                                                    <>
                                                        <div
                                                            className="px-3 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 sticky top-0 z-10 border-b border-emerald-100 flex items-center gap-2"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setViewingCategories(false); // Back to All Locations
                                                            }}
                                                        >
                                                            <ChevronDown size={14} className="rotate-90" />
                                                            {t('quickAdd.backToAll')}
                                                        </div>

                                                        <div className="px-3 py-2 text-xs font-bold text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-b dark:border-slate-700">
                                                            {t('quickAdd.selectCategoryFilter')}
                                                        </div>

                                                        {branchCategories.map(cat => (
                                                            <div
                                                                key={cat}
                                                                className="px-3 py-2.5 text-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer flex items-center gap-2 group transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedCategory(cat);
                                                                    setViewingCategories(false); // Switch to Location View
                                                                    // Logic: Set Category 1/2 to NULL
                                                                    setQuickAddForm(prev => ({ ...prev, category_1_actual: '', category_2_actual: '' }));
                                                                }}
                                                            >
                                                                <span className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400">📦 {cat}</span>
                                                                <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-emerald-500" />
                                                            </div>
                                                        ))}
                                                    </>
                                                )}

                                                {/* State 2: Select Location (Normal, or Custom All, or Custom Filtered) */}
                                                {(!customMode || (customMode && !viewingCategories)) && (
                                                    <>
                                                        {/* Custom Mode Header Actions */}
                                                        {customMode && (
                                                            <div className="sticky top-0 z-10">
                                                                {/* If Filtered by Category -> Show Back to All */}
                                                                {selectedCategory && (
                                                                    <div
                                                                        className="px-3 py-2 text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/40 border-b border-rose-100 flex items-center gap-2"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedCategory(''); // Clear Filter
                                                                            // Show All Locations again
                                                                        }}
                                                                    >
                                                                        <X size={12} /> {t('quickAdd.clearFilter')} ({selectedCategory})
                                                                    </div>
                                                                )}

                                                                {/* Filter Button (To Category View) */}
                                                                <div
                                                                    className="px-3 py-2 text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border-b border-emerald-100 flex items-center justify-between"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setViewingCategories(true); // Switch to Category View
                                                                    }}
                                                                >
                                                                    <span className="flex items-center gap-2"><Database size={12} /> {selectedCategory ? t('quickAdd.changeCategory') : t('quickAdd.customSelf')}</span>
                                                                    <ChevronRight size={12} />
                                                                </div>
                                                            </div>
                                                        )}



                                                        {(() => {
                                                            // 1. Get List of all relevant locations
                                                            const allPossibleRacks = getAllLocations();

                                                            // 2. Identify which ones are Recommended (by Rule OR by History)
                                                            const recommendedList = [...new Set([...ruleMatchedRacks, ...recommendedScannedLocs])];

                                                            // 3. Filter by search
                                                            const searchFilteredAll = allPossibleRacks.filter(loc => !locationSearch || loc.toUpperCase().includes(locationSearch.toUpperCase()));
                                                            const searchFilteredRec = recommendedList.filter(loc => !locationSearch || loc.toUpperCase().includes(locationSearch.toUpperCase()));

                                                            // For MEGAMALL or when search doesn't match suggestions, allow manual creation
                                                            const isMegaMall = currentBranch === 'ເມກ້າມໍ';
                                                            const canAddCustom = locationSearch.trim().length > 0 && !searchFilteredAll.some(f => f.toUpperCase() === locationSearch.toUpperCase());

                                                            // Header Helper
                                                            const renderHeader = (title, icon) => (
                                                                <div className="px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 dark:bg-slate-800/50 border-b border-t first:border-t-0 dark:border-slate-700 flex items-center gap-2">
                                                                    {icon} {title}
                                                                </div>
                                                            );

                                                            return (
                                                                <>
                                                                    {canAddCustom && (
                                                                        <div
                                                                            className="px-3 py-3 text-sm cursor-pointer bg-emerald-50 dark:bg-emerald-900/30 border-b border-emerald-100 dark:border-emerald-800 flex items-center justify-between group"
                                                                            onClick={() => {
                                                                                setQuickAddForm(prev => ({ ...prev, rack_location: locationSearch.toUpperCase() }));
                                                                                setDropdownOpen(false);
                                                                                setLocationSearch('');
                                                                            }}
                                                                        >
                                                                            <div className="flex flex-col">
                                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">✨ ສ້າງໂລເຄຊັ້ນໃໝ່ (Manual)</span>
                                                                                <span className="font-black text-emerald-700 dark:text-emerald-300">{locationSearch.toUpperCase()}</span>
                                                                            </div>
                                                                            <Plus size={16} className="text-emerald-500 group-hover:scale-125 transition-transform" />
                                                                        </div>
                                                                    )}

                                                                    {/* 🌟 RECOMMENDED SECTION */}
                                                                    {searchFilteredRec.length > 0 && (
                                                                        <>
                                                                            {renderHeader("Recommended for you", <Sparkles size={10} className="text-emerald-500" />)}
                                                                            {searchFilteredRec.map(loc => {
                                                                                const isMatched = ruleMatchedRacks.includes(loc);
                                                                                const count = allResults.filter(r => r.rackLocation === loc).length;
                                                                                return (
                                                                                    <div
                                                                                        key={`rec-${loc}`}
                                                                                        className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between border-l-2 ${quickAddForm.rack_location === loc ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600' : 'hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 border-transparent'}`}
                                                                                        onClick={() => {
                                                                                            setQuickAddForm(prev => ({ ...prev, rack_location: loc }));
                                                                                            setDropdownOpen(false);
                                                                                            setLocationSearch('');
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className="font-bold">{loc}</span>
                                                                                            {isMatched ?
                                                                                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-black">MATCH</span> :
                                                                                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded-full font-black">HISTORY</span>
                                                                                            }
                                                                                            {count > 0 && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-500">{count} SKU</span>}
                                                                                        </div>
                                                                                        <CheckCircle size={14} className={quickAddForm.rack_location === loc ? 'text-emerald-500' : 'opacity-0'} />
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </>
                                                                    )}

                                                                    {/* 📍 ALL LOCATIONS SECTION */}
                                                                    {searchFilteredAll.length > 0 ? (
                                                                        <>
                                                                            {renderHeader("All Locations", <MapPin size={10} />)}
                                                                            {searchFilteredAll.map(loc => {
                                                                                const count = allResults.filter(r => r.rackLocation === loc).length;
                                                                                return (
                                                                                    <div
                                                                                        key={`all-${loc}`}
                                                                                        className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${quickAddForm.rack_location === loc ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                                                                        onClick={() => {
                                                                                            setQuickAddForm(prev => ({ ...prev, rack_location: loc }));
                                                                                            setDropdownOpen(false);
                                                                                            setLocationSearch('');
                                                                                        }}
                                                                                    >
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={quickAddForm.rack_location === loc ? 'font-bold' : ''}>{loc}</span>
                                                                                            {count > 0 && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-500">{count} SKU</span>}
                                                                                        </div>
                                                                                        {quickAddForm.rack_location === loc && <CheckCircle size={14} className="text-emerald-500" />}
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </>
                                                                    ) : !canAddCustom && (
                                                                        <div className="px-3 py-6 text-center text-sm text-slate-400 italic">
                                                                            {locationSearch ? `ບໍ່ພົບ "${locationSearch}"` : t('quickAdd.noLocationsFound')}
                                                                        </div>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}

                                                        {/* Start Custom Mode Option (Only in Normal Mode) */}
                                                        {!customMode && (
                                                            <div
                                                                className="border-t border-slate-100 dark:border-slate-700 mt-1 pt-1"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setCustomMode(true);
                                                                    setSelectedCategory('');
                                                                    setViewingCategories(false); // Default to ALL LOCATIONS view
                                                                    setDropdownOpen(true);
                                                                }}
                                                            >
                                                                <div className="px-3 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer flex items-center gap-2 font-medium">
                                                                    <CornerDownRight size={14} />
                                                                    {t('quickAdd.customOption')}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (quickAddForm.rack_location) {
                                            setLocalInspectedLocation(localInspectedLocation === quickAddForm.rack_location ? null : quickAddForm.rack_location);
                                        }
                                    }}
                                    disabled={!quickAddForm.rack_location}
                                    className={`px-3 py-2.5 rounded-lg transition-colors border ${localInspectedLocation ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 border-emerald-200 dark:border-emerald-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-transparent disabled:opacity-50'}`}
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Category Display (Compact & Read-Only / Auto-filled) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">{t('results.category1')}</p>
                                <div className={`px-3 py-2 border rounded-lg ${isFoundInMaster ? 'bg-slate-50 border-slate-200 cursor-not-allowed' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        {quickAddForm.category_1_actual || '-'}
                                    </span>
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1.5">{t('results.category2')}</p>
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
                                    <span className="text-xs font-semibold text-joah-orange">{t('quickAdd.reasonPrompt')}</span>
                                </div>
                                <span className="text-[9px] font-semibold text-rose-500">Required</span>
                            </div>
                            <select
                                value={selectedReasonOption}
                                onChange={(e) => setSelectedReasonOption(e.target.value)}
                                className="w-full py-2 px-3 text-sm font-medium bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800/50 rounded-lg focus:border-joah-orange outline-none"
                            >
                                <option value="">{t('quickAdd.selectReason')}</option>
                                <option value={t('reasons.firstTimeRecord')}>{t('reasons.firstTimeRecord')}</option>
                                <option value={t('reasons.newStock')}>{t('reasons.newStock')}</option>
                                <option value={t('reasons.stockOut')}>{t('reasons.stockOut')}</option>
                                <option value={t('reasons.actualCount')}>{t('reasons.actualCount')}</option>
                                <option value={t('reasons.noSpace')}>{t('reasons.noSpace')}</option>
                                <option value={t('reasons.actualLocation')}>{t('reasons.actualLocation')}</option>
                                <option value={t('reasons.defective')}>{t('reasons.defective')}</option>
                                <option value={t('reasons.supplyChainDelay')}>{t('reasons.supplyChainDelay')}</option>
                                <option value={t('reasons.itemAtFront')}>{t('reasons.itemAtFront')}</option>
                                <option value={t('reasons.checkList')}>{t('reasons.checkList')}</option>
                                <option value="Other">{t('reasons.other')}</option>
                            </select>

                            {/* Conditional Other Reason Input */}
                            {selectedReasonOption === 'Other' && (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <input
                                        type="text"
                                        value={otherReasonText}
                                        onChange={(e) => setOtherReasonText(e.target.value)}
                                        placeholder={t('quickAdd.otherReasonPlaceholder')}
                                        className="w-full py-2 px-3 text-sm bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 custom-input-focus rounded-lg outline-none"
                                        autoFocus
                                    />
                                </div>
                            )}
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
                            {t('quickAdd.cancel')}
                        </button>
                        <button
                            onClick={onSave}
                            disabled={isSaving || !quickAddForm.qty || parseFloat(quickAddForm.qty) <= 0 || (selectedReasonOption === t('reasons.newStock') && parseFloat(quickAddForm.qty) <= 0)}
                            className="px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            <span>{isSaving ? t('quickAdd.saving') : t('quickAdd.save')}</span>
                        </button>
                    </div>

                </div>

                {/* ATTACHED LOCATION INSPECTOR (Side Panel) */}
                {localInspectedLocation && (
                    <LocationInspector
                        inspectedLocation={localInspectedLocation}
                        onClose={() => setLocalInspectedLocation(null)}
                        allResults={allResults}
                        className="w-80 max-h-[85vh] shadow-2xl border border-slate-200 dark:border-slate-800 rounded-xl flex-shrink-0"
                    />
                )}
            </div>

        </div>,
        document.body
    );

    // ✅ FIXED: Scanner is a SEPARATE Portal - completely outside QuickAddPanel's stacking context
    const scannerPortal = showLocationScanner ? createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 200000 }}>
            <BarcodeScannerModal
                onDetected={(code) => {
                    setLocationSearch(code);
                    setShowLocationScanner(false);
                    const allLocs = getAllLocations();
                    if (allLocs.includes(code.toUpperCase())) {
                        setQuickAddForm(prev => ({ ...prev, rack_location: code.toUpperCase() }));
                        setDropdownOpen(false);
                    }
                }}
                onClose={() => setShowLocationScanner(false)}
            />
        </div>,
        document.body
    ) : null;

    return (
        <>
            {panelPortal}
            {scannerPortal}
        </>
    );
};

export default QuickAddPanel;
