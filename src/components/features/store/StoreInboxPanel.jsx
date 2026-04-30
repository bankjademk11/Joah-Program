import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Package, ChevronDown, ChevronUp, RotateCw, Mail, Clock, MapPin, ArrowRight, ScanLine, Bell, Sparkles, Inbox } from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { logStoreInventoryHistory } from '../../../utils/supabaseSync';
import { useToast } from '../../ui/ToastProvider';
import confetti from 'canvas-confetti';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';
import joahLogo from '../../../assets/Joah.jpeg';

// ─── Location Confirm Modal ─────────────────────────────────────────────────────────
const LocationConfirmModal = ({ item, existingRecord, onConfirm, onCancel, isLoading }) => {
  const [scanInput, setScanInput] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const inputRef = React.useRef(null);
  const lastChangeTimeRef = React.useRef(Date.now());

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const targetLocation = existingRecord.shelf_location || '';
  const hasLocation = Boolean(targetLocation && targetLocation.trim() !== '' && targetLocation !== 'ບໍ່ລະບຸ');
  const isMatch = !hasLocation || scanInput.trim().toUpperCase() === targetLocation.trim().toUpperCase();

  const handleScanChange = (e) => {
    const now = Date.now();
    const val = e.target.value;
    const timeDiff = now - lastChangeTimeRef.current;
    lastChangeTimeRef.current = now;

    if (val.length - scanInput.length > 2) {
      setScanInput(val);
      return;
    }

    if (timeDiff > 50 && val.length > 0) {
      setScanInput(val.slice(-1));
    } else {
      setScanInput(val);
    }
  };

  const handleKeyDown = (e) => {
    // Standard key handling
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-[2rem] sm:rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800 overflow-hidden ring-1 ring-black/5">
        {/* Header */}
        <div className="px-5 sm:px-6 py-5 sm:py-6 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
            <MapPin size={80} />
          </div>
          <div className="flex items-center gap-3 sm:gap-4 relative z-10">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-white/20 backdrop-blur-md shrink-0 shadow-inner">
              <MapPin size={20} className="sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-base sm:text-lg leading-tight tracking-tight">ພົບສິນຄ້ານີ້ໃນລະບົບ!</p>
              <p className="text-emerald-100 text-[11px] sm:text-xs mt-1 font-medium opacity-90">ກະລຸນາໄປວາງສິນຄ້າທີ່ຊັ້ນວາງດ້ານລຸ່ມ</p>
            </div>
          </div>
        </div>

        {/* Product info */}
        <div className="px-5 py-4 sm:px-6 sm:py-5 space-y-4">
          <div className="flex items-center justify-between p-3 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-sm">
            <div className="min-w-0 flex-1 pr-3">
              <p className="text-sm sm:text-base font-black text-slate-800 dark:text-white font-mono truncate" title={item.barcode}>
                {item.barcode}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-1 font-bold line-clamp-1" title={item.product_name}>
                {item.product_name}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">ຈຳນວນຮັບ</p>
              <p className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none mt-1">+{item.qty}</p>
            </div>
          </div>

          {/* Location highlight */}
          <div className="group relative">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-100 dark:border-emerald-900/50 text-center shadow-sm">
              <div className="flex flex-col items-center gap-1">
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                  ໂລເຄຊັ້ນປັດຈຸບັນ
                </span>
                <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-300 mt-1 font-mono tracking-tight">
                  {existingRecord.shelf_location || 'ບໍ່ລະບຸ'}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100/50 dark:border-blue-900/30">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 shrink-0">
              <Sparkles size={16} />
            </div>
            <p className="text-[11px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 leading-snug">
              ຈຳນວນໃໝ່: <span className="text-blue-600 dark:text-blue-400 font-black">{(existingRecord.store_qty || 0) + item.qty}</span> 
              <span className="text-slate-400 ml-1.5 font-medium">(ເດີມ {existingRecord.store_qty || 0} + ຮັບ {item.qty})</span>
            </p>
          </div>

          {/* Location Scan Input */}
          {hasLocation && (
            <div className="pt-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  ສະແກນຢືນຢັນໂລເຄຊັ້ນ
                </p>
                <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800 ml-3"></div>
              </div>
              <div className="relative group">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={`ສະແກນ ${targetLocation}`}
                  value={scanInput}
                  onChange={handleScanChange}
                  className={`w-full p-4 pr-14 rounded-2xl border-2 outline-none font-mono text-center uppercase text-base font-black transition-all duration-300 shadow-sm ${scanInput.length === 0
                    ? 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-slate-800 dark:text-white focus:border-emerald-400/50 focus:bg-white dark:focus:bg-slate-900'
                    : isMatch
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 ring-4 ring-emerald-500/10'
                      : 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 focus:border-rose-500 ring-4 ring-rose-500/10'
                    }`}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-xl transition-all active:scale-90"
                >
                  <ScanLine size={22} />
                </button>
              </div>
              {!isMatch && scanInput.length > 0 && (
                <p className="text-[10px] sm:text-xs text-rose-500 font-black mt-2 text-center flex items-center justify-center gap-1.5 animate-bounce">
                  <span>❌</span> ໂລເຄຊັ້ນບໍ່ກົງກັນ (Location mismatch)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 sm:px-6 sm:pb-6 grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="py-3.5 rounded-2xl border-2 border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-black text-xs sm:text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all disabled:opacity-50 active:scale-[0.95] flex items-center justify-center gap-2"
          >
            <X size={16} />
            ຍົກເລີກ
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || !isMatch}
            className={`py-3.5 rounded-2xl font-black text-xs sm:text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.95] shadow-xl ${isLoading || !isMatch
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/40'
              }`}
          >
            {isLoading ? <RotateCw size={18} className="animate-spin shrink-0" /> : <CheckCircle size={18} className="shrink-0" />}
            <span>{isLoading ? 'ກຳລັງບັນທຶກ...' : 'ວາງເຄື່ອງ'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─── Main StoreInboxPanel ─────────────────────────────────────────────────────────────
const StoreInboxPanel = ({ onClose, currentUser, activeBranch, onOpenQuickAdd }) => {
  const [batches, setBatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmingItem, setConfirmingItem] = useState(null);
  const [expandedBatch, setExpandedBatch] = useState(null);
  const [locationModal, setLocationModal] = useState(null);
  const [isConfirmingLocation, setIsConfirmingLocation] = useState(false);
  // ⏱️ Persist batch timings across panel open/close via localStorage
  const STORAGE_KEY = 'store_inbox_batch_timings';
  const [batchTimings, setBatchTimings] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  });
  const saveBatchTimings = (updaterFn) => {
    setBatchTimings(prev => {
      const next = updaterFn(prev);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const toast = useToast();
  const userBranch = activeBranch || currentUser?.branch_id;

  const fetchPendingConfirmations = useCallback(async () => {
    setIsLoading(true);
    try {
      const requestByStr = currentUser?.id
        ? `${currentUser.name} (${currentUser.id})`
        : (currentUser?.name || 'Store Staff');

        let query = supabase
          .from('store_requests')
          .select('*')
          .eq('status', 'accepted')
          .is('store_confirmed_at', null)
          .eq('request_by', requestByStr)
          .gte('created_at', '2026-04-30T00:00:00.000Z')
          .order('created_at', { ascending: false });

      if (userBranch) query = query.eq('branch_id', userBranch);

      const { data, error } = await query;
      if (error) throw error;

      const grouped = {};
      (data || []).forEach(req => {
        const batchKey = req.batch_id || `legacy_${req.id}`;
        if (!grouped[batchKey]) {
          grouped[batchKey] = {
            batch_id: batchKey,
            created_at: req.created_at,
            request_by: req.request_by,
            branch_id: req.branch_id,
            items: []
          };
        }
        grouped[batchKey].items.push(req);
      });

      setBatches(
        Object.values(grouped).sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      );
    } catch (err) {
      toast.error('ດຶງຂໍ້ມູນຜິດພາດ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [userBranch, currentUser]);

  useEffect(() => {
    fetchPendingConfirmations();
    const channel = supabase
      .channel('store_inbox_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_requests' }, payload => {
        const branch = payload.new?.branch_id || payload.old?.branch_id;
        if (userBranch && branch !== userBranch) return;
        fetchPendingConfirmations();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchPendingConfirmations]);

  const markItemConfirmed = async (itemId) => {
    const { error } = await supabase
      .from('store_requests')
      .update({
        store_confirmed_at: new Date().toISOString(),
        store_confirmed_by: currentUser?.name || 'Store Staff'
      })
      .eq('id', itemId);
    if (error) throw error;
  };

  const removeItemFromUI = (itemId, batchId) => {
    setBatches(prev =>
      prev
        .map(batch =>
          batch.batch_id !== batchId
            ? batch
            : { ...batch, items: batch.items.filter(i => i.id !== itemId) }
        )
        .filter(batch => batch.items.length > 0)
    );
  };

  const fireConfetti = (isFull = false) => {
    confetti({
      particleCount: isFull ? 150 : 40,
      spread: isFull ? 80 : 50,
      origin: { y: 0.6 },
      colors: ['#10B981', '#34D399', '#FCD34D', '#F472B6', '#60A5FA'],
      zIndex: 300,
      disableForReducedMotion: true
    });
  };

  const handleReceiveItem = async (item, batchId) => {
    setConfirmingItem(item.id);
    const now = Date.now();
    // Read existing timing synchronously from localStorage (not stale state)
    let existingTimings;
    try { existingTimings = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { existingTimings = {}; }
    const batchStartedAtMs = existingTimings[batchId]?.startedAt || now;
    if (!existingTimings[batchId]) {
      saveBatchTimings(prev => ({ ...prev, [batchId]: { startedAt: now } }));
    }

    try {
      let query = supabase
        .from('store_inventory')
        .select('id, barcode_no, shelf_location, store_qty, item_name, product_tag, branch_id, max_qty')
        .eq('barcode_no', String(item.barcode).trim());

      if (userBranch) query = query.eq('branch_id', userBranch);

      const { data: existingItems, error: lookupError } = await query.limit(1);
      if (lookupError) throw lookupError;

      const existing = existingItems?.[0] || null;

      if (existing) {
        setLocationModal({ item, batchId, existingRecord: existing, startTime: Date.now() });
        setConfirmingItem(null);
      } else {
        setConfirmingItem(null);
        if (onOpenQuickAdd) {
          onOpenQuickAdd({
            barcode_no: String(item.barcode || '').trim(),
            item_name: item.product_name || '',
            qty: item.qty || 0,
            max_qty: 0,
            rack_location: '',
            category_1_actual: '',
            category_2_actual: '',
            product_tag: '',
            remarks: 'ຮັບສິນຄ້າຈາກສາງ (Inbox)',
            _inboxItemId: item.id,
            _inboxBatchId: batchId,
            _batchStartedAt: batchStartedAtMs,
          });
        }
      }
    } catch (err) {
      toast.error('ຜິດພາດ: ' + err.message);
      setConfirmingItem(null);
    }
  };

  const handleLocationConfirm = async () => {
    if (!locationModal) return;
    const { item, batchId, existingRecord } = locationModal;
    setIsConfirmingLocation(true);
    try {
      const updatedByStr = currentUser?.id
        ? `${currentUser.name} (${currentUser.id})`
        : (currentUser?.name || 'Store Staff');

      const newQty = (existingRecord.store_qty || 0) + (item.qty || 0);
      const now = Date.now();

      const processTimeSeconds = locationModal.startTime
        ? Math.floor((now - locationModal.startTime) / 1000)
        : 0;

      const batchTiming = batchTimings[batchId];
      const batchStartedAt = batchTiming?.startedAt ? new Date(batchTiming.startedAt).toISOString() : null;
      const batchEndedAt = new Date(now).toISOString();
      const batchTotalSeconds = batchTiming?.startedAt
        ? Math.floor((now - batchTiming.startedAt) / 1000)
        : 0;

      const targetBatch = batches.find(b => b.batch_id === batchId);
      const remainingAfterThis = (targetBatch?.items.length ?? 1) - 1;
      const isLastInBatch = remainingAfterThis === 0;

      const historyPayload = {
        actionType: 'received',
        barcode: item.barcode,
        itemName: item.product_name,
        oldQty: existingRecord.store_qty || 0,
        newQty: newQty,
        oldLocation: existingRecord.shelf_location,
        newLocation: existingRecord.shelf_location,
        oldTag: existingRecord.product_tag || null,
        newTag: existingRecord.product_tag || null,
        oldMaxQty: existingRecord.max_qty || null,
        newMaxQty: existingRecord.max_qty || null,
        reason: 'ຮັບສິນຄ້າຈາກສາງ (Inbox) - ວາງເຄື່ອງຕຳແໜ່ງເດີມ',
        branchId: existingRecord.branch_id || userBranch,
        updatedBy: updatedByStr,
        processTimeSeconds: processTimeSeconds,
        processStartedAt: locationModal.startTime ? new Date(locationModal.startTime).toISOString() : null,
        billId: batchId,
        batchStartedAt: batchStartedAt,
        batchEndedAt: isLastInBatch ? batchEndedAt : null,
        batchTotalSeconds: isLastInBatch ? batchTotalSeconds : null,
      };

      const { error: updateErr } = await supabase
        .from('store_inventory')
        .update({ store_qty: newQty, updated_by: updatedByStr })
        .eq('id', existingRecord.id);
      if (updateErr) throw updateErr;

      await logStoreInventoryHistory(historyPayload);
      await markItemConfirmed(item.id);

      if (isLastInBatch) {
        saveBatchTimings(prev => {
          const next = { ...prev };
          delete next[batchId];
          return next;
        });
      }

      toast.success(`✅ ວາງ "${item.product_name}" ທີ່ ${existingRecord.shelf_location} ສຳເລັດ!`);
      fireConfetti(isLastInBatch);
      removeItemFromUI(item.id, batchId);
      setLocationModal(null);
    } catch (err) {
      toast.error('ຜິດພາດ: ' + err.message);
    } finally {
      setIsConfirmingLocation(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleString('lo-LA', { dateStyle: 'medium', timeStyle: 'short' });

  const totalPendingItems = batches.reduce((sum, b) => sum + b.items.length, 0);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="w-full h-full sm:h-auto sm:max-w-lg bg-white dark:bg-slate-900 rounded-none sm:rounded-[3rem] shadow-none sm:shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col sm:max-h-[90vh] overflow-hidden border-0 sm:border border-white/20 dark:border-slate-800">

          {/* ── Clean Header with Brand Logo ──────────────────────── */}
          <div className="relative shrink-0 bg-white dark:bg-slate-900 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            
            {/* Logo and Titles */}
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-4">
              {/* Logo Box */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm shrink-0 flex items-center justify-center p-1">
                <img 
                  src={joahLogo} 
                  alt="JOAH" 
                  className="w-full h-full object-contain" 
                />
              </div>

              {/* Text Info */}
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-800 dark:text-white truncate">
                    ກ່ອງຈົດໝາຍ
                  </h2>
                  {totalPendingItems > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg border border-emerald-200 dark:border-emerald-800/60 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                        {totalPendingItems} SKU
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center">
                  <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded border border-slate-100 dark:border-slate-800 inline-block truncate">
                    ສາງອະນຸມັດ · ລໍຖ້າຢືນຢັນຮັບ
                  </p>
                </div>
              </div>
            </div>

            {/* Top Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={fetchPendingConfirmations}
                disabled={isLoading}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-all active:scale-90"
                title="ໂຫຼດໃໝ່"
              >
                <RotateCw size={18} className={`${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 sm:p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

          </div>

          {/* ── Content ─────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-4 bg-slate-50 dark:bg-slate-950/20">
            {isLoading && batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                  <RotateCw size={40} className="animate-spin text-emerald-500 relative z-10" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-black uppercase tracking-widest text-slate-500">ກຳລັງດຶງຂໍ້ມູນ...</span>
                  <p className="text-[10px] text-slate-400 mt-1 font-bold">Please wait a moment</p>
                </div>
              </div>
            ) : batches.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 sm:py-32 gap-6">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-gradient-to-tr from-emerald-500 to-teal-400 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-[2.5rem] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-2xl flex items-center justify-center relative">
                    <div className="absolute top-0 right-0 p-2 transform translate-x-1/4 -translate-y-1/4 bg-emerald-500 text-white rounded-2xl shadow-lg">
                      <Sparkles size={20} />
                    </div>
                    <Inbox size={48} className="text-emerald-200 dark:text-emerald-800 sm:w-16 sm:h-16" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-800 dark:text-white tracking-tight">ບໍ່ມີຂອງລໍຖ້າຢືนຢັນ</h3>
                  <p className="text-xs sm:text-sm font-bold text-slate-400 tracking-wide uppercase">ກ່ອງຈົດໝາຍຂອງທ່ານຫວ່າງເປົ່າ ✨</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in-up">
                {batches.map(batch => {
                  const isExpanded = expandedBatch === batch.batch_id;
                  const pendingCount = batch.items.length;
                  const totalQty = batch.items.reduce((sum, item) => sum + (item.qty || 0), 0);

                  return (
                    <div
                      key={batch.batch_id}
                      className={`group rounded-[2rem] border transition-all duration-300 overflow-hidden ${
                        isExpanded 
                          ? 'border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 shadow-xl ring-1 ring-emerald-500/10' 
                          : 'border-slate-200/60 dark:border-slate-800 bg-white/80 dark:bg-slate-900/50 hover:border-emerald-200 dark:hover:border-emerald-800 hover:shadow-md'
                      }`}
                    >
                      {/* Batch Header */}
                      <div
                        className={`p-4 sm:p-5 cursor-pointer transition-colors ${isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}
                        onClick={() => setExpandedBatch(isExpanded ? null : batch.batch_id)}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-500 ${
                            isExpanded ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-900/30 group-hover:text-emerald-500'
                          }`}>
                            <Package size={24} className={isExpanded ? 'animate-bounce' : ''} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className={`font-black text-sm sm:text-base font-mono truncate tracking-tight transition-colors ${isExpanded ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-white'}`}>
                                {batch.batch_id.startsWith('legacy') ? 'ໃບຄຳຂໍເກົ່າ' : batch.batch_id}
                              </p>
                              <div className={`p-1.5 rounded-full transition-all ${isExpanded ? 'bg-emerald-500 text-white' : 'text-slate-300 group-hover:text-emerald-400'}`}>
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <p className="text-[11px] sm:text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                  {pendingCount} SKU · {totalQty} Unit
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/30 text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest border border-emerald-100 dark:border-emerald-800">
                                ✓ Approved
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/50">
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[120px] sm:max-w-xs">
                                ໂດຍ: <span className="text-slate-500 dark:text-slate-300">{batch.request_by}</span>
                              </p>
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Clock size={12} className="shrink-0" />
                                <span className="text-[10px] font-mono font-bold tracking-tight">{formatDate(batch.created_at)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded: Per-SKU rows */}
                      {isExpanded && (
                        <div className="bg-slate-50/50 dark:bg-slate-900/50 p-2 sm:p-3 space-y-2">
                          {batch.items.map(item => {
                            const isThisConfirming = confirmingItem === item.id;
                            return (
                              <div
                                key={item.id}
                                className="group/item flex items-center gap-3 p-3 sm:p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 shadow-sm hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-300"
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs sm:text-sm font-black text-slate-700 dark:text-slate-200 truncate leading-tight" title={item.product_name}>
                                    {item.product_name}
                                  </p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-400 tracking-wider">
                                      {item.barcode}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right mr-2">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">QTY</p>
                                  <p className="text-sm sm:text-lg font-black text-emerald-600 dark:text-emerald-400 leading-none tracking-tight">
                                    ×{item.qty}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleReceiveItem(item, batch.batch_id)}
                                  disabled={!!confirmingItem}
                                  className="shrink-0 flex items-center justify-center gap-2 h-10 px-5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 text-white text-xs font-black rounded-xl transition-all active:scale-90 shadow-lg shadow-emerald-500/20"
                                >
                                  {isThisConfirming
                                    ? <RotateCw size={14} className="animate-spin" />
                                    : <Bell size={14} />
                                  }
                                  <span>{isThisConfirming ? '...' : 'ຮັບເຄື່ອງ'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Collapsed single-item quick-confirm */}
                      {!isExpanded && batch.items.length === 1 && (
                        <div className="px-4 pb-4">
                          <button
                            onClick={() => handleReceiveItem(batch.items[0], batch.batch_id)}
                            disabled={!!confirmingItem}
                            className="w-full py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:shadow-emerald-500/30 disabled:opacity-50 text-white font-black rounded-2xl text-xs shadow-xl transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                          >
                            {confirmingItem === batch.items[0].id
                              ? <RotateCw size={16} className="animate-spin" />
                              : <CheckCircle size={16} />
                            }
                            <span>ຢືນຢັນຮັບສິນຄ້າ</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────── */}
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center justify-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></div>
              <p className="text-[10px] sm:text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
                ກົດ "ຮັບເຄື່ອງ" ເພື່ອຢືນຢັນການວາງສິນຄ້າເຂົ້າຊັ້ນ
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Location Confirm Modal */}
      {locationModal && (
        <LocationConfirmModal
          item={locationModal.item}
          existingRecord={locationModal.existingRecord}
          onConfirm={handleLocationConfirm}
          onCancel={() => setLocationModal(null)}
          isLoading={isConfirmingLocation}
        />
      )}
    </>,
    document.body
  );
};

export default StoreInboxPanel;
