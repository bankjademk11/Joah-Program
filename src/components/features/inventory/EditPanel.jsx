import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit2, Database, MapPin, Info, User, Save, Loader2, Eye, Plus, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, CornerDownRight, Zap, ScanLine, Hash, Trash2 } from 'lucide-react';
import { CATEGORY_RACK_RULES, getRackSuggestions, BRANCH_RACK_RULES, getBranchCategories } from '../../../utils/rackUtils';
import LocationInspector from './LocationInspector';
import { supabase } from '../../../utils/supabaseClient';
import technoHubLogo from '../../../assets/technohublogo.png';

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
    handleSplit,
    handleClone,
    results, // For backward compatibility
    allResults, // Essential for Inspector
    mergeAmount,
    setMergeAmount,
    t,
    currentBranch
}) => {
    // --- UI States matching QuickAddPanel ---
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [customMode, setCustomMode] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [viewingCategories, setViewingCategories] = useState(false);
    const [localInspectedLocation, setLocalInspectedLocation] = useState(null);
    const dropdownRef = useRef(null);
    const [locationSearch, setLocationSearch] = useState('');
    const [isSplitMode, setIsSplitMode] = useState(false);
    const [isCloneMode, setIsCloneMode] = useState(false);
    // TECHNOHUB Scan-to-Count/Deduct Mode
    const [isTechnoHubMode, setIsTechnoHubMode] = useState(false);
    const [scanLog, setScanLog] = useState([]);
    const [scanInput, setScanInput] = useState('');
    const scanInputRef = useRef(null);
    const [latestDcQty, setLatestDcQty] = useState(null);

    // --- Helpers ---
    // Use branch-specific rules
    const branchCategories = getBranchCategories(currentBranch);

    const getAllLocations = () => {
        const allLocs = [];
        branchCategories.forEach(cat => {
            allLocs.push(...getRackSuggestions(cat, currentBranch));
        });
        return [...new Set(allLocs)].sort();
    };

    // Determine current suggestions based on mode and categories
    const currentSuggestions = !customMode
        ? getRackSuggestions(editCat1 || selectedRow?.category1 || selectedCategory, currentBranch)
        : (selectedCategory ? getRackSuggestions(selectedCategory, currentBranch) : getAllLocations());

    // --- Effects ---

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Prevent body scroll
    useEffect(() => {
        if (selectedRow) {
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [selectedRow]);

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                if (dropdownOpen) setDropdownOpen(false);
                else if (!isUpdating) onClose();
            }
        };
        if (selectedRow) {
            document.addEventListener('keydown', handleEsc);
        }
        return () => document.removeEventListener('keydown', handleEsc);
    }, [selectedRow, onClose, isUpdating, dropdownOpen]);

    // Reason Logic
    const [selectedReasonOption, setSelectedReasonOption] = useState('');
    const [otherReasonText, setOtherReasonText] = useState('');

    const isNewStockReason = selectedReasonOption === t('reasons.newStock');

    // Sync reason to form
    useEffect(() => {
        if (selectedReasonOption === 'Other') {
            setEditReason(otherReasonText ? `Other: ${otherReasonText}` : 'Other');
        } else {
            setEditReason(selectedReasonOption);
        }
    }, [selectedReasonOption, otherReasonText, setEditReason]);

    // Reset reason when panel opens/closes
    useEffect(() => {
        if (!selectedRow) {
            setSelectedReasonOption('');
            setOtherReasonText('');
            setDropdownOpen(false);
            setLocationSearch('');
            setCustomMode(false);
            setSelectedCategory('');
            setViewingCategories(false);
            setLocalInspectedLocation(null);
            setIsSplitMode(false);
            setIsCloneMode(false);
            setIsTechnoHubMode(false);
            setScanLog([]);
            setScanInput('');
        }
    }, [selectedRow]);

    // Detect TECHNOHUB source when selectedRow changes
    useEffect(() => {
        if (!selectedRow?.barcode) return;
        supabase.from('master_data').select('source').eq('barcode', String(selectedRow.barcode).trim()).maybeSingle()
            .then(({ data }) => {
                const isTH = data?.source === 'TECHNOHUB';
                setIsTechnoHubMode(isTH);
                if (isTH) {
                    setScanLog([]);
                    setScanInput('');
                    setMergeAmount(0);
                    setTimeout(() => scanInputRef.current?.focus(), 300);
                }
            });
    }, [selectedRow?.barcode]);

    // Reset search when dropdown closes
    useEffect(() => {
        if (!dropdownOpen) {
            setLocationSearch('');
        }
    }, [dropdownOpen]);

    // Fetch latest DC Qty specifically for the hint when New Stock In is selected
    useEffect(() => {
        if (isNewStockReason && selectedRow?.barcode && currentBranch) {
            supabase.from('table_dc_stock').select('qty').eq('barcode', selectedRow.barcode).eq('branch_id', currentBranch).maybeSingle()
                .then(({ data }) => {
                    setLatestDcQty(data?.qty ?? 0);
                });
        }
    }, [isNewStockReason, selectedRow?.barcode, currentBranch]);

    if (!selectedRow) return null;

    // mergeAmount (Add Amount) = qty transferred from DC when reason is New Stock In
    const isDcTransferValid = !isNewStockReason || (mergeAmount !== '' && parseInt(mergeAmount) > 0);

    const handleSave = async () => {
        // 1. Auto-deduct DC stock if New Stock In
        const cleanBarcode = selectedRow?.barcode ? String(selectedRow.barcode).trim() : null;
        const deductAmt = parseInt(mergeAmount);
        
        console.log('🚀 [EditPanel] Starting handleSave...', { isNewStockReason, mergeAmount, cleanBarcode, currentBranch });

        if (isNewStockReason && deductAmt > 0 && cleanBarcode && currentBranch) {
            try {
                console.log(`📡 [EditPanel] Attempting to deduct ${deductAmt} from DC for ${cleanBarcode} (${currentBranch})...`);
                
                // Fetch latest DC stock from DB
                const { data: dcData, error: dcFetchError } = await supabase
                    .from('table_dc_stock')
                    .select('qty')
                    .eq('barcode', cleanBarcode)
                    .eq('branch_id', currentBranch)
                    .maybeSingle();

                if (dcFetchError) throw dcFetchError;

                const currentDc = dcData?.qty || 0;
                const newDcQty = Math.max(0, currentDc - deductAmt);

                console.log(`📊 [EditPanel] DC Stock Found: ${currentDc}, New Value: ${newDcQty}`);

                const { error: updateError } = await supabase
                    .from('table_dc_stock')
                    .update({ 
                        qty: newDcQty, 
                        updated_at: new Date().toISOString()
                    })
                    .eq('barcode', cleanBarcode)
                    .eq('branch_id', currentBranch);

                if (updateError) throw updateError;
                
                console.log(`✅ [EditPanel] DC Stock updated successfully: ${cleanBarcode} (${currentDc} -> ${newDcQty})`);
            } catch (err) {
                console.error('❌ [EditPanel] Failed to deduct DC stock:', err);
                alert('ເກີດຂໍ້ຜິດພາດໃນການຫັກລົບ QTY DC: ' + err.message);
            }
        } else {
            console.log('⏭️ [EditPanel] Skipping DC deduction (Reason is not New Stock or amount is 0)');
        }

        // 2. Standard update (Awaited to ensure completion before potential unmount)
        try {
            if (isSplitMode) {
                await handleSplit(mergeAmount, editLocation, editReason);
            } else if (isCloneMode) {
                await handleClone(mergeAmount, editLocation, editReason);
            } else {
                await handleUpdate();
            }
        } catch (err) {
            console.error('❌ [EditPanel] Standard update failed:', err);
            // Error handling usually managed by the prop functions themselves
        }
    };

    // Use allResults if available, fallback to filtered results for inspector
    const inspectorData = allResults || results || [];

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
                        overflow: 'hidden',
                    }}
                    className="dark:!bg-slate-900 border border-slate-200 dark:border-slate-800"
                >
                    {/* Header — changes based on TECHNOHUB mode */}
                    <div className={`flex items-center justify-between px-5 py-4 border-b flex-shrink-0 transition-colors duration-300 ${isTechnoHubMode ? 'bg-[#3899c8] border-[#2d7ba8]' : 'border-slate-200 dark:border-slate-800'}`}>
                        <div className="flex items-center gap-3">
                            {isTechnoHubMode ? (
                                <div className="flex items-center gap-3">
                                    <img
                                        src={technoHubLogo}
                                        alt="TECHNOHUB"
                                        style={{ mixBlendMode: 'multiply', width: '80px', height: 'auto' }}
                                    />
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="bg-white/20 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-white/30">
                                                {isSplitMode ? 'Scan to Deduct' : 'Scan to Count'}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-white/80 font-semibold mt-0.5">⚡ High Value — {isSplitMode ? 'ສະແກນເພື່ອຕັດຈຳນວນ' : 'ສະແກນເພື່ອເພີ່ມຈຳນວນ'}</p>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="p-2 rounded-lg bg-indigo-500 text-white shadow-sm">
                                        <Edit2 size={18} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('editPanel.title')}</h3>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={onClose}
                            disabled={isUpdating}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors disabled:opacity-50"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">

                        {/* Item Info - Compact */}
                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-3">
                            <div className="flex justify-between items-center text-xs text-slate-500">
                                <span>{t('editPanel.itemDetails')}</span>
                                <span className="bg-white dark:bg-slate-700 px-2 py-0.5 rounded text-indigo-500 font-mono font-bold border border-slate-200 dark:border-slate-600">#{selectedRow.rowIndex}</span>
                            </div>

                            {/* Barcode Display */}
                            <div className="relative">
                                <p className="text-lg font-bold text-slate-800 dark:text-white font-mono">{selectedRow.barcode}</p>
                                <p className="text-[10px] text-slate-400">{t('results.barcode')}</p>
                            </div>

                            <div className="h-px bg-slate-200 dark:bg-slate-700 w-full" />

                            {/* Name Display */}
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedRow.masterItemName || selectedRow.itemName}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{t('results.itemName')}</p>
                            </div>
                        </div>

                        {/* Quantity Section (With Merge Logic GUI) */}
                        <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                                <Database size={16} className="text-indigo-500" />
                                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">{t('editPanel.quantityManagement')}</p>
                            </div>

                            {/* Mode Toggle */}
                            <div className="px-4 pt-3">
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg gap-0.5">
                                    <button
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${!isSplitMode && !isCloneMode ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                        onClick={() => { setIsSplitMode(false); setIsCloneMode(false); setMergeAmount(isTechnoHubMode ? 0 : ''); setScanLog([]); setScanInput(''); }}
                                    >
                                        {isTechnoHubMode ? '📦 ຮັບຂອງ' : 'ແກ້ໄຂ'}
                                    </button>
                                    <button
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${isSplitMode ? 'bg-white dark:bg-slate-700 text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                        onClick={() => { setIsSplitMode(true); setIsCloneMode(false); setMergeAmount(isTechnoHubMode ? 0 : ''); setScanLog([]); setScanInput(''); }}
                                    >
                                        ແບ່ງໄປ
                                    </button>
                                    <button
                                        className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${isCloneMode ? 'bg-white dark:bg-slate-700 text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                        onClick={() => { setIsCloneMode(true); setIsSplitMode(false); setMergeAmount(''); setScanLog([]); setScanInput(''); }}
                                    >
                                        ໂຄນສິນຄ້າ
                                    </button>
                                </div>
                            </div>

                            {/* TECHNOHUB Scan Mode (Add or Deduct) */}
                            {isTechnoHubMode && !isCloneMode ? (
                                <div className="p-4 space-y-3 bg-sky-50 dark:bg-sky-950/20">
                                    {/* Count Summary */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Hash size={16} className="text-[#3899c8]" />
                                            <span className="text-xs font-bold text-sky-700 dark:text-sky-300">
                                                {isSplitMode ? 'ຈຳນວນທີ່ຕ້ອງການຕັດ' : 'ຈຳນວນທີ່ສະແກນ'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {/* Current */}
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400">ປະຈຸບັນ</div>
                                                <div className="text-lg font-bold text-slate-600">{editQty || 0}</div>
                                            </div>
                                            <div className={`text-lg font-black ${isSplitMode ? 'text-rose-500' : 'text-sky-500'}`}>
                                                {isSplitMode ? '-' : '+'}
                                            </div>
                                            {/* Scanned Count */}
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400">ສະແກນ</div>
                                                <div className={`text-4xl font-black tabular-nums ${isSplitMode ? 'text-rose-500' : 'text-[#3899c8]'}`}>
                                                    {mergeAmount || 0}
                                                </div>
                                            </div>
                                            <div className="text-slate-300 font-bold">=</div>
                                            {/* Result */}
                                            <div className="text-right">
                                                <div className="text-xs text-slate-400">ຜົນລັບ</div>
                                                <div className={`text-lg font-black ${isSplitMode && Number(mergeAmount) > editQty ? 'text-rose-600' : 'text-slate-800 dark:text-white'}`}>
                                                    {isSplitMode
                                                        ? Math.max(0, (editQty || 0) - (Number(mergeAmount) || 0))
                                                        : (editQty || 0) + (Number(mergeAmount) || 0)
                                                    }
                                                </div>
                                            </div>
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
                                                    if (scanned === String(selectedRow?.barcode).trim()) {
                                                        // Split mode: check max
                                                        if (isSplitMode && Number(mergeAmount) >= editQty) {
                                                            setScanInput('⚠️ ເກີນຈຳນວນທີ່ມີ!');
                                                            setTimeout(() => setScanInput(''), 1000);
                                                        } else {
                                                            setScanLog(prev => [...prev, new Date()]);
                                                            setMergeAmount(prev => Number(prev || 0) + 1);
                                                            setScanInput('');
                                                        }
                                                    } else {
                                                        setScanInput('❌ ບາໂຄດບໍ່ຕົງ!');
                                                        setTimeout(() => setScanInput(''), 1000);
                                                    }
                                                    e.preventDefault();
                                                }
                                            }}
                                            placeholder={isSplitMode ? 'ສະແກນ Barcode ເພື່ອຕັດ (-1 ຕໍ່ຄັ້ງ)...' : 'ສະແກນ Barcode ຊ້ຳ (+1 ຕໍ່ຄັ້ງ)...'}
                                            autoFocus
                                            className={`w-full pl-9 pr-3 py-2.5 text-sm font-mono font-bold bg-white dark:bg-slate-800 border-2 rounded-lg outline-none focus:ring-2 transition-all placeholder:text-slate-300 placeholder:font-normal shadow-sm ${isSplitMode
                                                    ? 'border-rose-200 dark:border-rose-800 focus:border-rose-500 focus:ring-rose-500/20'
                                                    : 'border-sky-200 dark:border-sky-800 focus:border-[#3899c8] focus:ring-sky-500/20'
                                                }`}
                                        />
                                    </div>

                                    {/* Scan Log */}
                                    {scanLog.length > 0 && (
                                        <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar">
                                            <div className={`text-[10px] font-bold uppercase tracking-widest mb-1.5 ${isSplitMode ? 'text-rose-500' : 'text-sky-500'}`}>
                                                ປະຫວັດການສະແກນ ({scanLog.length} ຄັ້ງ)
                                            </div>
                                            {[...scanLog].reverse().map((ts, i) => (
                                                <div key={i} className="flex items-center justify-between px-2.5 py-1.5 bg-white dark:bg-slate-800 rounded-lg border border-sky-100 dark:border-sky-900/50 shadow-sm">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-4 h-4 rounded-full text-white text-[9px] font-black flex items-center justify-center ${isSplitMode ? 'bg-rose-500' : 'bg-[#3899c8]'}`}>{scanLog.length - i}</div>
                                                        <span className="text-xs text-sky-700 dark:text-sky-300 font-mono">{selectedRow?.barcode}</span>
                                                        <span className={`text-[10px] font-bold ${isSplitMode ? 'text-rose-500' : 'text-sky-500'}`}>{isSplitMode ? '-1' : '+1'}</span>
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
                                                setMergeAmount(prev => Math.max(0, Number(prev || 0) - 1));
                                            }}
                                            className="flex items-center gap-1.5 text-[11px] font-bold text-rose-500 hover:text-rose-600 transition-colors"
                                        >
                                            <Trash2 size={11} /> ຍົກເລີກການສະແກນຄັ້ງລ່າສຸດ
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* Normal Qty input area — Clone shows full-width only; others show Current + Icon + Input */
                                <div className="p-4">
                                    {isCloneMode ? (
                                        <div>
                                            <input
                                                type="number"
                                                placeholder="0"
                                                className="w-full p-4 bg-white dark:bg-slate-950 border-2 border-emerald-200 dark:border-emerald-900/40 rounded-xl text-4xl font-bold text-center text-emerald-600 dark:text-emerald-400 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-300 number-input-no-arrows"
                                                value={mergeAmount}
                                                onChange={(e) => setMergeAmount(e.target.value)}
                                                autoFocus
                                            />
                                            <p className="text-[10px] text-slate-400 mt-2 text-center">ຈຳນວນສິນຄ້າທີ່ຕ້ອງການໂຄນໄປ Rack ໃໝ່</p>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-3">
                                            {/* Current Qty Display */}
                                            <div className="flex-1 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-center border border-transparent">
                                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">{t('editPanel.current')}</p>
                                                <span className="text-2xl font-bold text-slate-700 dark:text-slate-300">{editQty || 0}</span>
                                            </div>

                                            {/* Icon based on mode */}
                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                {isSplitMode ? <CornerDownRight size={16} strokeWidth={3} className="text-rose-400" /> : <Plus size={16} strokeWidth={3} />}
                                            </div>

                                            {/* Additional Input */}
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    placeholder="0"
                                                    className={`w-full p-3 bg-white dark:bg-slate-950 border-2 rounded-xl text-3xl font-bold text-center outline-none transition-all placeholder:text-slate-300 number-input-no-arrows ${isSplitMode
                                                        ? 'border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                                                        : 'border-indigo-100 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10'
                                                        }`}
                                                    value={mergeAmount}
                                                    onChange={(e) => {
                                                        if (isSplitMode && Number(e.target.value) > editQty) {
                                                            setMergeAmount(editQty);
                                                        } else {
                                                            setMergeAmount(e.target.value);
                                                        }
                                                    }}
                                                    autoFocus
                                                />
                                                <p className="text-[10px] text-slate-400 mt-2 text-center text-xs">
                                                    {isSplitMode ? 'ແບ່ງຈຳນວນອອກ' : t('editPanel.addAmount')}
                                                </p>
                                                {/* DC hint — only when New Stock In */}
                                                {isNewStockReason && (
                                                    <p className="text-[10px] text-violet-500 font-bold mt-1 text-center animate-in fade-in duration-200">
                                                        ⚡ ຈຳນວນນີ້ຈະລຸດ QTY DC ອັດຕະໂນມັດ (DC ເຫຼືອ: {latestDcQty ?? selectedRow.dcQty ?? '...'})
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Rack Location Section (MATCHING QUICKADDPANEL UI EXACTLY) */}
                        <div>
                            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                                <MapPin size={14} className={isSplitMode ? "text-rose-500" : isCloneMode ? "text-emerald-500" : "text-indigo-500"} />
                                {isSplitMode ? 'ເລືອກ Rack ທີ່ຕ້ອງການແບ່ງໄປ (Target Rack)' : isCloneMode ? 'ເລືອກ Rack ສຳລັບ Clone ໄປ (Target Rack)' : t('editPanel.targetLocation')}
                                {customMode && <span className="text-[10px] text-indigo-500 font-normal">{t('quickAdd.customMode')}</span>}
                            </p>

                            <div className="flex gap-2" ref={dropdownRef}>
                                {/* CUSTOM SELECT TRIGGER */}
                                <div
                                    className={`flex-1 relative cursor-pointer select-none`}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                >
                                    <div className={`w-full py-2.5 px-3 flex items-center justify-between text-sm font-medium bg-white dark:bg-slate-800 border ${dropdownOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 dark:border-slate-700'} rounded-lg transition-all`}>
                                        <span className={editLocation || selectedCategory ? 'text-slate-800 dark:text-white' : 'text-slate-400'}>
                                            {customMode && viewingCategories
                                                ? t('quickAdd.selectCategory')
                                                : (customMode && !viewingCategories && !editLocation)
                                                    ? (selectedCategory ? `${t('quickAdd.selectLocationIn')} ${selectedCategory}...` : t('quickAdd.selectLocationAll'))
                                                    : (editLocation || t('quickAdd.selectLocationPlaceholder'))
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
                                                    placeholder="🔍 ຄົ້ນຫາ Location..."
                                                    className="w-full px-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 transition-all"
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            </div>
                                            <div className="overflow-y-auto flex-1">

                                                {/* State 1: Custom Mode - Select Category (Only if VIEWING CATEGORIES) */}
                                                {customMode && viewingCategories && (
                                                    <>
                                                        <div
                                                            className="px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 sticky top-0 z-10 border-b border-indigo-100 flex items-center gap-2"
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
                                                                className="px-3 py-2.5 text-sm hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex items-center gap-2 group transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setSelectedCategory(cat);
                                                                    setViewingCategories(false); // Switch to Location View
                                                                    setEditLocation(''); // Clear location when changing category
                                                                }}
                                                            >
                                                                <span className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400">📦 {cat}</span>
                                                                <ChevronRight size={14} className="ml-auto text-slate-300 group-hover:text-indigo-500" />
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
                                                                        }}
                                                                    >
                                                                        <X size={12} /> {t('quickAdd.clearFilter')} ({selectedCategory})
                                                                    </div>
                                                                )}

                                                                {/* Filter Button (To Category View) */}
                                                                <div
                                                                    className="px-3 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border-b border-indigo-100 flex items-center justify-between"
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
                                                            return filtered.length > 0 ? (
                                                                filtered.map(loc => {
                                                                    const count = inspectorData.filter(r => r.rackLocation === loc).length;
                                                                    return (
                                                                        <div
                                                                            key={loc}
                                                                            className={`px-3 py-2.5 text-sm cursor-pointer flex items-center justify-between ${editLocation === loc ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 font-medium' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                                                            onClick={() => {
                                                                                setEditLocation(loc);
                                                                                setDropdownOpen(false);
                                                                                setLocationSearch('');
                                                                            }}
                                                                        >
                                                                            <span>{loc}</span>
                                                                            {count > 0 && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full text-slate-500">{count} SKU</span>}
                                                                        </div>
                                                                    );
                                                                })
                                                            ) : (
                                                                <div className="px-3 py-4 text-center text-sm text-slate-400 italic">
                                                                    {locationSearch ? `ບໍ່ພົບ "${locationSearch}"` : t('quickAdd.noLocationsFound')}<br />
                                                                    <span className="text-xs">{t('quickAdd.tryCustomMode')}</span>
                                                                </div>
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
                                                                <div className="px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer flex items-center gap-2 font-medium">
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

                                {/* Eye Inspection Button */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const target = editLocation || selectedRow.rackLocation;
                                        if (target) {
                                            setLocalInspectedLocation(localInspectedLocation === target ? null : target);
                                        }
                                    }}
                                    disabled={!editLocation && !selectedRow.rackLocation}
                                    className={`px-3 py-2.5 rounded-lg transition-colors border ${localInspectedLocation ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 border-indigo-200 dark:border-indigo-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 border-transparent disabled:opacity-50'}`}
                                >
                                    <Eye size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Static Categories Display */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('results.category1')}</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{editCat1 || selectedRow.category1 || '-'}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t('results.category2')}</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{editCat2 || selectedRow.category2 || '-'}</p>
                            </div>
                        </div>

                        {/* Reason Selection */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                                    <Info size={14} className="text-orange-500" /> {t('editPanel.reason')}
                                </label>
                                <span className="text-[9px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-900/20 px-2 py-0.5 rounded-full">{t('editPanel.reasonRequired')}</span>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedReasonOption}
                                    onChange={(e) => setSelectedReasonOption(e.target.value)}
                                    className="w-full py-3 px-4 text-sm font-bold bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 rounded-xl focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none appearance-none"
                                >
                                    <option value="">{t('editPanel.selectReason')}</option>
                                    <option value={t('reasons.newStock')}>{t('reasons.newStock')}</option>
                                    <option value={t('reasons.stockOut')}>{t('reasons.stockOut')}</option>
                                    <option value={t('reasons.actualCount')}>{t('reasons.actualCount')}</option>
                                    <option value={t('reasons.noSpace')}>{t('reasons.noSpace')}</option>
                                    <option value={t('reasons.actualLocation')}>{t('reasons.actualLocation')}</option>
                                    <option value={t('reasons.defective')}>{t('reasons.defective')}</option>
                                    <option value={t('reasons.supplyChainDelay')}>{t('reasons.supplyChainDelay')}</option>
                                    <option value={t('reasons.checkList')}>{t('reasons.checkList')}</option>
                                    <option value={t('reasons.depositFull')}>{t('reasons.depositFull')}</option>
                                    <option value="Other">{t('reasons.other')}</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>

                            {/* Conditional Other Reason Input */}
                            {selectedReasonOption === 'Other' && (
                                <div className="mt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <input
                                        type="text"
                                        value={otherReasonText}
                                        onChange={(e) => setOtherReasonText(e.target.value)}
                                        placeholder={t('editPanel.otherReasonPlaceholder')}
                                        className="w-full py-2.5 px-4 text-sm bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-800 rounded-xl outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all"
                                        autoFocus
                                    />
                                </div>
                            )}
                        </div>

                        {/* Verifier (Read Only) */}
                        <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                            <User size={16} className="text-slate-400" />
                            <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-0.5">{t('editPanel.verifier')}</p>
                                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{currentUser ? currentUser.name : (localStorage.getItem('joah_employee_name') || 'Unknown')}</p>
                            </div>
                        </div>

                    </div>

                    {/* Footer - Compact & Matched */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 grid grid-cols-2 gap-3 flex-shrink-0">
                        <button
                            onClick={onClose}
                            disabled={isUpdating}
                            className="px-4 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                        >
                            {t('editPanel.cancel')}
                        </button>
                        <button
                            onClick={() => handleSave()}
                            disabled={isUpdating || !isDcTransferValid || (isCloneMode && editLocation && editLocation === selectedRow?.rackLocation)}
                            title={isCloneMode && editLocation === selectedRow?.rackLocation ? 'ບໍ່ສາມາດໂຄນໄປ Rack ເດີມໄດ້' : ''}
                            className={`px-4 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${isCloneMode
                                ? (editLocation && editLocation === selectedRow?.rackLocation ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600')
                                : 'bg-indigo-500 hover:bg-indigo-600'
                                }`}
                        >
                            {isUpdating ? (
                                <>
                                    <Loader2 className="animate-spin" size={16} />
                                    <span>{t('editPanel.saving')}</span>
                                </>
                            ) : (
                                <>
                                    <Save size={16} />
                                    <span>{t('editPanel.saveChanges')}</span>
                                </>
                            )}
                        </button>
                    </div>

                </div>

                {/* ATTACHED LOCATION INSPECTOR (Side Panel) */}
                {localInspectedLocation && (
                    <LocationInspector
                        inspectedLocation={localInspectedLocation}
                        onClose={() => setLocalInspectedLocation(null)}
                        allResults={inspectorData} // Use prepared data
                        className="w-80 max-h-[85vh] shadow-2xl border border-slate-200 dark:border-slate-800 rounded-xl flex-shrink-0"
                    />
                )}
            </div>
        </div>,
        document.body
    );
};

export default EditPanel;