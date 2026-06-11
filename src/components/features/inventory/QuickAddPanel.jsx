import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Edit2, Database, MapPin, Info, User, Save, Loader2, Eye, AlertTriangle, CheckCircle, ChevronDown, ChevronRight, CornerDownRight, Sparkles, ScanLine, Hash, Zap, Trash2 } from 'lucide-react';
import { CATEGORY_RACK_RULES, getRackSuggestions, BRANCH_RACK_RULES, getBranchCategories } from '../../../utils/rackUtils';
import LocationInspector from './LocationInspector';
import { supabase } from '../../../utils/supabaseClient';
import technoHubLogo from '../../../assets/technohublogo.png';

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
    const [customMode, setCustomMode] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [viewingCategories, setViewingCategories] = useState(false); // New state to toggle Category Selection View
    const [dcQty, setDcQty] = useState(0); // 🆕 DC Qty state
    const [localInspectedLocation, setLocalInspectedLocation] = useState(null); // Local inspector state
    const dropdownRef = useRef(null);
    const [locationSearch, setLocationSearch] = useState('');
    // TECHNOHUB Scan-to-Count Mode
    const [isTechnoHubMode, setIsTechnoHubMode] = useState(false);
    const [scanLog, setScanLog] = useState([]);
    const [scanInput, setScanInput] = useState('');
    const scanInputRef = useRef(null);

    // Reason Logic
    const [selectedReasonOption, setSelectedReasonOption] = useState(t('reasons.newStock') || '');
    const [otherReasonText, setOtherReasonText] = useState('');

    // Recent Racks History
    const [recentRacks, setRecentRacks] = useState(() => {
        try {
            const saved = localStorage.getItem('joah_inventory_recent_racks');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    });

    // Sync reason to form
    useEffect(() => {
        if (selectedReasonOption === 'Other') {
            setQuickAddForm(prev => ({ ...prev, remarks: otherReasonText ? `Other: ${otherReasonText}` : 'Other' }));
        } else {
            setQuickAddForm(prev => ({ ...prev, remarks: selectedReasonOption }));
        }
    }, [selectedReasonOption, otherReasonText, setQuickAddForm]);

    // Persist Rack Location to localStorage and History whenever it changes
    useEffect(() => {
        if (quickAddForm.rack_location) {
            const loc = quickAddForm.rack_location.toUpperCase();
            localStorage.setItem('joah_inventory_last_rack_location', loc);
            
            // Update Recent Racks (Keep last 5 unique)
            setRecentRacks(prev => {
                const filtered = prev.filter(r => r !== loc);
                const updated = [loc, ...filtered].slice(0, 5);
                localStorage.setItem('joah_inventory_recent_racks', JSON.stringify(updated));
                return updated;
            });
        }
    }, [quickAddForm.rack_location]);

    // Reset reason when panel opens/closes
    useEffect(() => {
        if (isOpen) {
            // Set Default Reason and Restore Last Rack when opened
            const defaultReason = t('reasons.newStock');
            setSelectedReasonOption(defaultReason);
            const lastRack = localStorage.getItem('joah_inventory_last_rack_location') || '';
            setQuickAddForm(prev => ({ 
                ...prev, 
                remarks: defaultReason,
                rack_location: prev.rack_location || lastRack 
            }));
            
            // Refresh Recent Racks from storage
            try {
                const saved = localStorage.getItem('joah_inventory_recent_racks');
                if (saved) setRecentRacks(JSON.parse(saved));
            } catch (e) {}
        } else {
            setSelectedReasonOption('');
            setOtherReasonText('');
            setDropdownOpen(false);
            setLocationSearch('');
            setCustomMode(true);
            setSelectedCategory('');
            setViewingCategories(false);
            setLocalInspectedLocation(null);
            setIsTechnoHubMode(false);
            setScanLog([]);
            setScanInput('');
        }
    }, [isOpen, t, setQuickAddForm]);

    // Reset search when dropdown closes
    useEffect(() => {
        if (!dropdownOpen) {
            setLocationSearch('');
        }
    }, [dropdownOpen]);

    useEffect(() => {
        if (!isOpen || !quickAddForm.barcode_no) return;

        const barcode = String(quickAddForm.barcode_no).trim();
        
        // 🆕 Fetch DC Qty whenever barcode changes
        supabase.from('table_dc_stock')
            .select('qty')
            .eq('barcode', barcode)
            .eq('branch_id', currentBranch || localStorage.getItem('joah_branch_id') || 'ຕະຫຼາດລາວ')
            .maybeSingle()
            .then(({ data }) => setDcQty(data?.qty || 0))
            .catch(err => console.error("Error fetching DC qty:", err));
            
        const masterItem = masterData.find(m =>
            String(m.barcode || m.Barcode || m['Barcode No.'] || '').trim() === barcode
        );

        if (masterItem) {
            setIsFoundInMaster(true);
            const itemNameValue = masterItem.item_name || masterItem.product_name_la || masterItem['Product Name(LA)'] || masterItem['Item Name'] || '';
            const cat1Value = masterItem.category_1 || masterItem['CATEGORIES 1'] || masterItem['Category 1'] || '';
            const cat2Value = masterItem.category_2 || masterItem['CATEGORIES 2'] || masterItem['Category 2'] || '';

            // Always check source from Supabase directly (masterData from Excel won't have source field)
            supabase.from('master_data').select('source').eq('barcode', barcode).maybeSingle()
                .then(({ data: sourceData }) => {
                    const isTH = sourceData?.source === 'TECHNOHUB';
                    setIsTechnoHubMode(isTH);
                    if (isTH) {
                        setScanLog([]);
                        setScanInput('');
                        setQuickAddForm(prev => ({
                            ...prev, qty: 0,
                            item_name: String(itemNameValue).trim(),
                            category_1_actual: String(cat1Value).trim(),
                            category_2_actual: String(cat2Value).trim()
                        }));
                        setTimeout(() => scanInputRef.current?.focus(), 300);
                    } else {
                        setIsTechnoHubMode(false);
                        setQuickAddForm(prev => ({
                            ...prev,
                            item_name: String(itemNameValue).trim(),
                            category_1_actual: String(cat1Value).trim(),
                            category_2_actual: String(cat2Value).trim()
                        }));
                    }
                });
        } else {
            setIsFoundInMaster(false);
            setIsTechnoHubMode(false);
            setQuickAddForm(prev => ({
                ...prev,
                item_name: '',
                category_1_actual: '',
                category_2_actual: '',
                qty: 0,
                // ✅ PRESERVE Rack Location: Don't reset it to empty
                rack_location: prev.rack_location || localStorage.getItem('joah_inventory_last_rack_location') || ''
            }));
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

    // Use branch-specific rules
    const branchCategories = getBranchCategories(currentBranch);

    const getAllLocations = () => {
        const allLocs = [];
        branchCategories.forEach(cat => {
            allLocs.push(...getRackSuggestions(cat, currentBranch));
        });
        return [...new Set(allLocs)].sort(); // Unique and Sorted
    };

    // Helper to get Rack Suggestions based on current mode
    const currentSuggestions = !customMode
        ? getRackSuggestions(quickAddForm.category_1_actual || selectedCategory, currentBranch)
        : (selectedCategory ? getRackSuggestions(selectedCategory, currentBranch) : getAllLocations());

    // 🆕 Auto-select Rack if search matches a suggestion (for Barcode Scanners)
    useEffect(() => {
        if (!locationSearch || !dropdownOpen) return;
        
        const searchUpper = locationSearch.trim().toUpperCase();
        // Check if it's an exact match in current suggestions
        const match = currentSuggestions.find(loc => loc.toUpperCase() === searchUpper);
        
        if (match) {
            setQuickAddForm(prev => ({ ...prev, rack_location: match }));
            setDropdownOpen(false);
            setLocationSearch('');
        }
    }, [locationSearch, currentSuggestions, dropdownOpen, setQuickAddForm]);

    const isSaveDisabled = isSaving || !quickAddForm.qty || parseFloat(quickAddForm.qty) <= 0 || (selectedReasonOption === t('reasons.newStock') && parseFloat(quickAddForm.qty) <= 0);

    const latestOnSave = useRef(onSave);
    useEffect(() => {
        latestOnSave.current = onSave;
    });

    // Global Enter to Save — MUST be before early return to comply with Rules of Hooks
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if (e.key === 'Enter' && isOpen && !isSaveDisabled && !dropdownOpen) {
                // Ignore if typing in the barcode scan input
                if (e.target === scanInputRef.current) return;
                e.preventDefault();
                if (latestOnSave.current) {
                    latestOnSave.current();
                }
            }
        };
        document.addEventListener('keydown', handleGlobalKeyDown);
        return () => document.removeEventListener('keydown', handleGlobalKeyDown);
    }, [isOpen, isSaveDisabled, dropdownOpen]);

    if (!isOpen) return null;

    // Calculate Recommended Locations based on previous scans of this barcode
    const recommendedScannedLocs = quickAddForm.barcode_no
        ? [...new Set(allResults.filter(r => String(r.barcode).trim() === String(quickAddForm.barcode_no).trim() && r.rackLocation).map(r => r.rackLocation))]
        : [];

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

            {/* Container for Side-by-Side Layout */}
            <div className="relative z-10 flex items-start gap-4 max-h-[90vh]">

                {/* Compact Modal (Matched EditPanel Style) */}
                <div
                    style={{
                        width: '100%',
                        maxWidth: '520px',
                        backgroundColor: 'white',
                        borderRadius: '12px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        // maxHeight handled by parent
                        overflow: 'hidden',
                    }}
                    className="dark:!bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                    {/* Header — changes based on TECHNOHUB mode */}
                    <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 transition-colors duration-300 ${isTechnoHubMode ? 'bg-[#3899c8] border-[#2d7ba8]' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            {isTechnoHubMode ? (
                                /* TECHNOHUB Logo Mode */
                                <div className="flex items-center gap-3">
                                    <img
                                        src={technoHubLogo}
                                        alt="TECHNOHUB"
                                        style={{ mixBlendMode: 'multiply', width: '80px', height: 'auto' }}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/30">Scan to Count</span>
                                        </div>
                                        <p className="text-[10px] text-white/80 font-semibold mt-0.5">⚡ High Value Product — ນັບເທື່ອລະຊິ້ນ</p>
                                    </div>
                                </div>
                            ) : (
                                /* Normal Mode */
                                <>
                                    <div className="p-2 rounded-lg bg-emerald-500 text-white shadow-sm">
                                        <Plus size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('quickAdd.title')}</h3>
                                    </div>
                                </>
                            )}
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

                        {/* Quantity Section — Normal or TECHNOHUB Scan-to-Count */}
                        {isTechnoHubMode ? (
                            <div className="rounded-xl border-2 border-sky-300 dark:border-sky-700 overflow-hidden shadow-sm">
                                {/* TECHNOHUB Header */}
                                <div className="flex items-center gap-2 px-4 py-2.5 bg-[#3899c8] text-white border-b border-[#2d7ba8]">
                                    <Zap size={14} className="shrink-0" />
                                    <span className="text-xs font-black uppercase tracking-wider">TECHNOHUB — Scan-to-Count Mode</span>
                                    <span className="ml-auto text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">High Value</span>
                                </div>

                                <div className="p-4 space-y-3 bg-sky-50 dark:bg-sky-950/20">
                                    {/* Count Display */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Hash size={16} className="text-[#3899c8]" />
                                            <span className="text-xs font-bold text-sky-700 dark:text-sky-300">ຈຳນວນທີ່ສະແກນ</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-4xl font-black text-[#3899c8] dark:text-sky-400 tabular-nums min-w-[3rem] text-right">
                                                {quickAddForm.qty}
                                            </div>
                                            <span className="text-xs text-sky-400 font-bold">ຊິ້ນ</span>
                                        </div>
                                    </div>

                                    {/* Scan Input */}
                                    <div className="relative">
                                        <ScanLine size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-sky-400" />
                                        <input
                                            ref={scanInputRef}
                                            type="text"
                                            value={scanInput}
                                            onChange={(e) => setScanInput(e.target.value.replace(/\s+/g, ''))}
                                            onKeyDown={(e) => {
                                                if (e.key === ' ') e.preventDefault();
                                                if (e.key === 'Enter') {
                                                    const scanned = scanInput.trim();
                                                    if (scanned === String(quickAddForm.barcode_no).trim()) {
                                                        setScanLog(prev => [...prev, new Date()]);
                                                        setQuickAddForm(prev => ({ ...prev, qty: prev.qty + 1 }));
                                                        setScanInput('');
                                                    } else {
                                                        // Wrong barcode — flash red briefly
                                                        setScanInput('❌ ບາໂຄດບໍ່ຕົງ!');
                                                        setTimeout(() => setScanInput(''), 1000);
                                                    }
                                                    e.preventDefault();
                                                }
                                            }}
                                            placeholder="ສະແກນ Barcode ຊ້ຳ (+1 ຕໍ່ຄັ້ງ)..."
                                            autoFocus
                                            className="w-full pl-9 pr-3 py-2.5 text-sm font-mono font-bold bg-white dark:bg-slate-800 border-2 border-sky-200 dark:border-sky-800 rounded-lg outline-none focus:border-[#3899c8] focus:ring-2 focus:ring-sky-500/20 transition-all placeholder:text-slate-300 placeholder:font-normal shadow-sm"
                                        />
                                    </div>

                                    {/* Scan Log */}
                                    {scanLog.length > 0 && (
                                        <div className="max-h-28 overflow-y-auto space-y-1 custom-scrollbar">
                                            <div className="text-[10px] font-bold text-sky-500 uppercase tracking-widest mb-1.5">ປະຫວັດການສະແກນ ({scanLog.length} ຄັ້ງ)</div>
                                            {[...scanLog].reverse().map((ts, i) => (
                                                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-sky-100 dark:border-sky-900/50 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-4 h-4 rounded-full bg-[#3899c8] text-white text-[9px] font-black flex items-center justify-center">{scanLog.length - i}</div>
                                                        <span className="text-xs text-sky-700 dark:text-sky-300 font-mono">{quickAddForm.barcode_no}</span>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400">{ts.toLocaleTimeString('lo-LA')}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Undo Last Scan */}
                                    {scanLog.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setScanLog(prev => prev.slice(0, -1));
                                                setQuickAddForm(prev => ({ ...prev, qty: Math.max(0, prev.qty - 1) }));
                                            }}
                                            className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 size={11} /> ຍົກເລີກການສະແກນຄັ້ງລ່າສຸດ
                                        </button>
                                    )}
                                    
                                    {/* 🆕 DC hint — only when New Stock In */}
                                    {selectedReasonOption === t('reasons.newStock') && (
                                        <p className="text-[10px] text-violet-500 font-bold mt-2 text-center animate-in fade-in duration-200 bg-violet-50 dark:bg-violet-900/20 py-1.5 rounded-lg border border-violet-100 dark:border-violet-900">
                                            ⚡ ຈຳນວນນີ້ຈະລຸດ QTY DC ອັດຕະໂນມັດ (DC ເຫຼືອ: {dcQty})
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : (
                        <div className="p-4 rounded-lg border-2 border-slate-200 dark:border-slate-800 space-y-3">
                            <div className="flex items-center gap-2">
                                <Database size={16} className="text-emerald-500" />
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('quickAdd.quantity')}</p>
                            </div>

                            <div className="relative">
                                <input
                                    type="number"
                                    value={quickAddForm.qty === 0 ? '' : quickAddForm.qty}
                                    onChange={(e) => {
                                        const val = e.target.value === '' ? 0 : parseFloat(e.target.value);
                                        setQuickAddForm(prev => ({ ...prev, qty: val }));
                                    }}
                                    placeholder="0"
                                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border-2 border-emerald-100 dark:border-emerald-900/50 rounded-xl text-3xl font-bold text-emerald-600 dark:text-emerald-400 text-center outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 number-input-no-arrows"
                                />
                                <p className="text-[10px] text-slate-400 mt-2 text-center">{t('quickAdd.identifyQty')}</p>
                                
                                {/* 🆕 DC hint — only when New Stock In */}
                                {selectedReasonOption === t('reasons.newStock') && (
                                    <p className="text-[10px] text-violet-500 font-bold mt-2 text-center animate-in fade-in duration-200">
                                        ⚡ ຈຳນວນນີ້ຈະລຸດ QTY DC ອັດຕະໂນມັດ (DC ເຫຼືອ: {dcQty})
                                    </p>
                                )}
                            </div>
                        </div>
                        )}

                        {/* Location Section (CUSTOM DROPDOWN) */}
                        <div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                <MapPin size={14} className="text-emerald-500" />
                                {t('quickAdd.targetLocation')}
                                {customMode && <span className="text-[10px] text-emerald-500 font-normal">{t('quickAdd.customMode')}</span>}
                            </p>

                            {/* Recommended Locations Chips */}
                            {recommendedScannedLocs.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase font-bold text-amber-500">
                                        <Sparkles size={10} /> ໂລເຄຊັ້ນແນະນຳ (ເຄີຍສະແກນແລ້ວ)
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {recommendedScannedLocs.map(loc => (
                                            <button
                                                key={`rec-${loc}`}
                                                onClick={() => {
                                                    setQuickAddForm(prev => ({ ...prev, rack_location: loc }));
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${quickAddForm.rack_location === loc 
                                                    ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/40 dark:border-amber-700 dark:text-amber-400' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-amber-600/50 dark:hover:bg-amber-900/20'}`}
                                            >
                                                {loc}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Recently Used Racks (History) */}
                            {recentRacks.length > 0 && (
                                <div className="mb-3">
                                    <div className="flex items-center gap-1.5 mb-1.5 text-[10px] uppercase font-bold text-slate-400">
                                        <Zap size={10} className="text-emerald-500" /> ໂລເຄຊັ້ນທີ່ໃຊ້ຫຼ້າสุด (History)
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {recentRacks.map(loc => (
                                            <button
                                                key={`recent-${loc}`}
                                                onClick={() => {
                                                    setQuickAddForm(prev => ({ ...prev, rack_location: loc }));
                                                }}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${quickAddForm.rack_location === loc 
                                                    ? 'bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-700 dark:text-emerald-400' 
                                                    : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-600/50 dark:hover:bg-amber-900/20'}`}
                                            >
                                                {loc}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-2" ref={dropdownRef}>
                                {/* CUSTOM SELECT TRIGGER */}
                                <div
                                    className={`flex-1 relative cursor-pointer select-none`}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                >
                                    <div className={`w-full py-2.5 px-3 flex items-center justify-between text-sm font-medium bg-white dark:bg-slate-800 border ${dropdownOpen ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-lg transition-all`}>
                                        <span className={quickAddForm.rack_location || selectedCategory ? 'text-slate-800 dark:text-white' : 'text-slate-400'}>
                                            {customMode && viewingCategories
                                                ? t('quickAdd.selectCategory')
                                                : (customMode && !viewingCategories && !quickAddForm.rack_location)
                                                    ? (selectedCategory ? `${t('quickAdd.selectLocationIn')} ${selectedCategory}...` : t('quickAdd.selectLocationAll'))
                                                    : (quickAddForm.rack_location || t('quickAdd.selectLocationPlaceholder'))
                                            }
                                        </span>
                                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>

                                    {/* CUSTOM DROPDOWN MENU */}
                                    {dropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-60 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100 flex flex-col">
                                            {/* Search Input */}
                                            <div className="p-2 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-20 flex-shrink-0">
                                                <input
                                                    type="text"
                                                    value={locationSearch}
                                                    onChange={(e) => setLocationSearch(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            const searchUpper = locationSearch.trim().toUpperCase();
                                                            const filtered = currentSuggestions.filter(loc => !searchUpper || loc.toUpperCase().includes(searchUpper));
                                                            const exactMatch = filtered.find(loc => loc.toUpperCase() === searchUpper);
                                                            
                                                            if (exactMatch) {
                                                                setQuickAddForm(prev => ({ ...prev, rack_location: exactMatch }));
                                                                setDropdownOpen(false);
                                                                setLocationSearch('');
                                                            } else if (filtered.length > 0) {
                                                                setQuickAddForm(prev => ({ ...prev, rack_location: filtered[0] }));
                                                                setDropdownOpen(false);
                                                                setLocationSearch('');
                                                            } else if (searchUpper.length > 0) {
                                                                setQuickAddForm(prev => ({ ...prev, rack_location: searchUpper }));
                                                                setDropdownOpen(false);
                                                                setLocationSearch('');
                                                            }
                                                        }
                                                    }}
                                                    placeholder="🔍 ค้นหา Location..."
                                                    className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400/30 transition-all"
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
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
                                                            const filtered = currentSuggestions.filter(loc => !locationSearch || loc.toUpperCase().includes(locationSearch.toUpperCase()));
                                                            
                                                            // For MEGAMALL or when search doesn't match suggestions, allow manual creation
                                                            const isMegaMall = currentBranch === 'ເມກ້າມໍ';
                                                            const canAddCustom = locationSearch.trim().length > 0 && !filtered.some(f => f.toUpperCase() === locationSearch.toUpperCase());

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

                                                                    {filtered.length > 0 ? (
                                                                        filtered.map(loc => {
                                                                            const count = allResults.filter(r => r.rackLocation === loc).length;
                                                                            return (
                                                                                <div
                                                                                    key={loc}
                                                                                    className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between ${quickAddForm.rack_location === loc ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                                                                    onClick={() => {
                                                                                        setQuickAddForm(prev => ({ ...prev, rack_location: loc }));
                                                                                        setDropdownOpen(false);
                                                                                        setLocationSearch('');
                                                                                    }}
                                                                                >
                                                                                    <span>{loc}</span>
                                                                                    {count > 0 && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-500">{count} SKU</span>}
                                                                                </div>
                                                                            );
                                                                        })
                                                                    ) : !canAddCustom && (
                                                                        <div className="px-3 py-4 text-center text-sm text-slate-400 italic">
                                                                            {locationSearch ? `ບໍ່ພົບ "${locationSearch}"` : t('quickAdd.noLocationsFound')}<br />
                                                                            <span className="text-xs">{t('quickAdd.tryCustomMode')}</span>
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
                            disabled={isSaveDisabled}
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
};

export default QuickAddPanel;
