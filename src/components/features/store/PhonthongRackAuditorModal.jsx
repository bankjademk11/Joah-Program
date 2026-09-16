import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  AlertCircle,
  HelpCircle,
  ListChecks,
  MapPin,
  Package,
  RefreshCw,
  Search,
  X,
  Zap,
} from 'lucide-react';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';
import { getProductImageUrl, handleImageError } from '../../../utils/productImageUtils';

/**
 * PhonthongRackAuditorModal
 *
 * Mobile-first redesign.
 *
 * UX flow:
 * 1. Select / scan rack
 * 2. Review rack + choose scan method
 * 3. Continuous audit with sticky progress + thumb-friendly bottom action
 * 4. Summary + retry / next rack
 *
 * Existing business logic is preserved:
 * - inventoryData is filtered by shelf_location / rackLocation
 * - camera + barcode gun are both supported
 * - scannedBarcodes is a Set<string>
 * - out-of-rack barcodes are shown as warnings
 */
const PhonthongRackAuditorModal = ({
  isOpen,
  onClose,
  inventoryData = [],
  branchName = 'ໂພນຕ້ອງ',
}) => {
  const [step, setStep] = useState('scan_rack');
  const [auditMethod, setAuditMethod] = useState('camera');
  const [rackInput, setRackInput] = useState('');
  const [selectedRack, setSelectedRack] = useState('');
  const [rackItems, setRackItems] = useState([]);
  const [scannedBarcodes, setScannedBarcodes] = useState(new Set());
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [scannerTarget, setScannerTarget] = useState('rack');
  const [manualProductInput, setManualProductInput] = useState('');
  const [lastScannedFeedback, setLastScannedFeedback] = useState(null);
  const [showAllItems, setShowAllItems] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);
  const gunInputRef = useRef(null);

  const resetAudit = () => {
    setStep('scan_rack');
    setAuditMethod('camera');
    setRackInput('');
    setSelectedRack('');
    setRackItems([]);
    setScannedBarcodes(new Set());
    setShowCameraScanner(false);
    setScannerTarget('rack');
    setManualProductInput('');
    setLastScannedFeedback(null);
    setShowAllItems(false);
    setShowMethodPicker(false);
  };

  useEffect(() => {
    if (isOpen) resetAudit();
  }, [isOpen]);

  useEffect(() => {
    if (step === 'audit_active' && auditMethod === 'gun') {
      const timer = setTimeout(() => gunInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [step, auditMethod]);

  const playBeep = (isSuccess) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isSuccess ? 'sine' : 'sawtooth';
      osc.frequency.setValueAtTime(isSuccess ? 880 : 320, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (isSuccess ? 0.12 : 0.24));
    } catch (_) {
      // Audio feedback is optional.
    }
  };

  const normalizeRackItem = (item, rack) => ({
    ...item,
    barcode_no: item.barcode_no || item.barcode,
    item_name: item.item_name || item.itemName || item.masterItemName || '',
    store_qty: item.store_qty ?? item.qty ?? item.masterQty ?? 0,
    shelf_location: item.shelf_location || item.rackLocation || rack,
  });

  const handleSelectRack = (rawRack) => {
    const cleanRack = (rawRack || '').trim();
    if (!cleanRack) return;

    const matching = inventoryData
      .filter((item) => {
        const loc = (item.shelf_location || item.rackLocation || '').trim();
        return loc.toUpperCase() === cleanRack.toUpperCase();
      })
      .map((item) => normalizeRackItem(item, cleanRack));

    setSelectedRack(cleanRack);
    setRackInput(cleanRack);
    setRackItems(matching);
    setScannedBarcodes(new Set());
    setLastScannedFeedback(null);
    setShowAllItems(false);
    setStep('preview_rack');
  };

  const openCamera = (target) => {
    setScannerTarget(target);
    setShowCameraScanner(true);
  };

  const startAudit = (method = auditMethod) => {
    setAuditMethod(method);
    setScannedBarcodes(new Set());
    setLastScannedFeedback(null);
    setShowMethodPicker(false);
    setStep('audit_active');

    if (method === 'camera') {
      setTimeout(() => openCamera('product'), 120);
    } else {
      setTimeout(() => gunInputRef.current?.focus(), 120);
    }
  };

  const handleScanProductBarcode = (barcode) => {
    const cleanBarcode = (barcode || '').trim();
    if (!cleanBarcode) return;

    const matchedItem = rackItems.find(
      (item) => (item.barcode_no || '').trim() === cleanBarcode,
    );

    if (matchedItem) {
      setScannedBarcodes((prev) => {
        const next = new Set(prev);
        next.add(cleanBarcode);
        return next;
      });
      playBeep(true);
      setLastScannedFeedback({
        type: 'success',
        text: `ພົບ ${matchedItem.item_name || cleanBarcode}`,
        barcode: cleanBarcode,
      });
    } else {
      playBeep(false);
      setLastScannedFeedback({
        type: 'warning',
        text: `ບາໂຄ້ດນີ້ບໍ່ຢູ່ໃນ ${selectedRack}`,
        barcode: cleanBarcode,
      });
    }

    setManualProductInput('');
  };

  const totalItems = rackItems.length;
  const verifiedCount = useMemo(
    () => rackItems.filter((item) => scannedBarcodes.has((item.barcode_no || '').trim())).length,
    [rackItems, scannedBarcodes],
  );
  const missingCount = Math.max(totalItems - verifiedCount, 0);
  const progress = totalItems > 0 ? Math.round((verifiedCount / totalItems) * 100) : 0;
  const isAllVerified = totalItems > 0 && verifiedCount === totalItems;

  const missingItems = useMemo(
    () => rackItems.filter((item) => !scannedBarcodes.has((item.barcode_no || '').trim())),
    [rackItems, scannedBarcodes],
  );

  const displayedItems = useMemo(() => {
    if (showAllItems) return rackItems;
    if (step === 'audit_active') return missingItems;
    return rackItems;
  }, [missingItems, rackItems, showAllItems, step]);

  const stepIndex = step === 'scan_rack' ? 1 : step === 'preview_rack' ? 2 : step === 'audit_active' ? 3 : 4;

  const pageTitle = {
    scan_rack: 'ເລືອກໂລທີ່ຈະກວດ',
    preview_rack: `ກວດກ່ອນເລີ່ມ · ${selectedRack}`,
    audit_active: `ກຳລັງກວດ · ${selectedRack}`,
    summary: `ສະຫຼຸບຜົນ · ${selectedRack}`,
  }[step];

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm">
      <div className="flex h-[100dvh] w-full items-end sm:items-center justify-center">
        <div className="flex h-[100dvh] w-full max-w-2xl flex-col overflow-hidden bg-white text-slate-900 shadow-2xl dark:bg-slate-950 dark:text-white sm:h-[92vh] sm:rounded-[28px] sm:border sm:border-slate-200 sm:dark:border-slate-800">
          {/* Header */}
          <header className="sticky top-0 z-20 shrink-0 border-b border-slate-200/80 bg-white/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
            <div className="flex items-center gap-3">
              {step !== 'scan_rack' && (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 'summary') setStep('audit_active');
                    else if (step === 'audit_active') setStep('preview_rack');
                    else setStep('scan_rack');
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 active:scale-95 dark:bg-slate-800 dark:text-slate-200"
                  aria-label="ກັບ"
                >
                  <ArrowLeft size={19} />
                </button>
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
                    <ListChecks size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black tracking-tight">ກວດສິນຄ້າໃນໂລ</h2>
                    <div className="truncate text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {branchName} · {pageTitle}
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 active:scale-95 dark:bg-slate-800 dark:text-slate-300"
                aria-label="ປິດ"
              >
                <X size={19} />
              </button>
            </div>

            {/* Progress */}
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`h-1.5 rounded-full transition-colors ${n <= stepIndex ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-800'
                    }`}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between px-0.5 text-[9px] font-black uppercase tracking-wide text-slate-400">
              <span>ໂລ</span>
              <span>ກວດເບິ່ງ</span>
              <span>ສະແກນ</span>
              <span>ສະຫຼຸບ</span>
            </div>
          </header>

          {/* STEP 1 */}
          {step === 'scan_rack' && (
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-6 pt-5">
              <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
                <div className="mb-5 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
                    <MapPin size={30} />
                  </div>
                  <h3 className="text-xl font-black">ເລືອກ Rack Location</h3>
                  <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-6 text-slate-500 dark:text-slate-400">
                    ສະແກນປ້າຍໂລຈະໄວທີ່ສຸດ ຫຼື ພິມຊື່ໂລເອງກໍໄດ້
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openCamera('rack')}
                  className="mb-4 flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                >
                  <Camera size={22} />
                  ເປີດກ້ອງສະແກນໂລ
                </button>

                <div className="my-2 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  ຫຼື
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSelectRack(rackInput);
                  }}
                  className="mt-3 space-y-3"
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="text"
                      inputMode="text"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      value={rackInput}
                      onChange={(e) => setRackInput(e.target.value)}
                      placeholder="ເຊັ່ນ JMPT. A-1"
                      className="min-h-14 w-full rounded-2xl border-2 border-slate-200 bg-slate-50 pl-11 pr-4 text-base font-black outline-none transition focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!rackInput.trim()}
                    className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-slate-900"
                  >
                    ດຳເນີນການ
                    <ArrowRight size={19} />
                  </button>
                </form>
              </div>
            </main>
          )}

          {/* STEP 2 */}
          {step === 'preview_rack' && (
            <main className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex items-center rounded-lg bg-emerald-500 px-2.5 py-1 font-mono text-xs font-black text-white">
                      {selectedRack}
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      ສິນຄ້າທີ່ລະບຸໃນໂລ <span className="font-black text-slate-900 dark:text-white">{totalItems}</span> ລາຍການ
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('scan_rack')}
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-black text-slate-500 active:bg-white dark:active:bg-slate-800"
                  >
                    ເປີ່ຍນໂລ
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-36">
                {rackItems.length === 0 ? (
                  <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
                    <Package size={46} className="mb-3 text-slate-300 dark:text-slate-700" />
                    <h3 className="text-base font-black">ບໍ່ພົບສິນຄ້າໃນໂລນີ້</h3>
                    <p className="mt-2 max-w-xs text-xs font-medium leading-5 text-slate-400">
                      ກວດເບິ່ງ Shelf Location ຫຼື ກັບໄປເລືອກໂລອື່ນ
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {rackItems.slice(0, 30).map((item, idx) => (
                      <div
                        key={item.id || `${item.barcode_no}-${idx}`}
                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
                      >
                        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                          <img
                            src={getProductImageUrl(item.barcode_no)}
                            alt={item.item_name}
                            onError={(e) => handleImageError(e, item.barcode_no)}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[11px] font-black text-slate-900 dark:text-white">
                            {item.barcode_no || 'NO BARCODE'}
                          </div>
                          <div className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                            {item.item_name || 'Unnamed Item'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400">Qty</div>
                          <div className="text-base font-black text-emerald-600 dark:text-emerald-400">
                            {item.store_qty ?? 0}
                          </div>
                        </div>
                      </div>
                    ))}
                    {rackItems.length > 30 && (
                      <div className="rounded-xl bg-slate-100 px-3 py-2 text-center text-[11px] font-bold text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                        ສະແດງ 30 ລາຍການທຳອິດ · ລາຍການທັງໝົດ {rackItems.length}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {rackItems.length > 0 && (
                <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-2xl border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:absolute">
                  <div className="mb-2 text-center text-xs font-bold text-slate-500">
                    ເລືອກວິທີສະແກນ · ສາມາດປ່ຽນພາຍຫຼັງໄດ້
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setShowMethodPicker(true)}
                      className="min-h-12 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-black text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <div className="flex items-center justify-center gap-2">
                        {auditMethod === 'camera' ? <Camera size={17} /> : <Barcode size={17} />}
                        {auditMethod === 'camera' ? 'ກ້ອງ' : 'ປືນຍິງ'}
                        <ChevronDown size={15} />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => startAudit(auditMethod)}
                      className="min-h-12 rounded-xl bg-emerald-500 px-4 text-sm font-black text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
                    >
                      ເລີ່ມກວດ
                      <ArrowRight className="ml-1 inline" size={17} />
                    </button>
                  </div>
                </div>
              )}
            </main>
          )}

          {/* STEP 3 */}
          {step === 'audit_active' && (
            <main className="flex min-h-0 flex-1 flex-col">
              <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-500 px-2 py-1 font-mono text-[11px] font-black text-white">
                        {selectedRack}
                      </span>
                      <span className="text-xs font-black text-slate-700 dark:text-slate-200">
                        {verifiedCount}/{totalItems}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] font-bold text-slate-400">ສະແກນຄົບ {progress}%</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllItems((v) => !v)}
                    className="rounded-xl bg-slate-100 px-3 py-2 text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {showAllItems ? 'ສະແດງທີ່ຍັງເຫຼືອ' : 'ເບິ່ງທັງໝົດ'}
                  </button>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleScanProductBarcode(manualProductInput);
                  }}
                  className="flex gap-2"
                >
                  <div className="relative min-w-0 flex-1">
                    <Barcode className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      ref={gunInputRef}
                      value={manualProductInput}
                      onChange={(e) => setManualProductInput(e.target.value)}
                      placeholder={auditMethod === 'gun' ? 'ຍິງບາໂຄ້ດຕໍ່ເນື່ອງ...' : 'ພິມບາໂຄ້ດ...'}
                      inputMode="numeric"
                      autoComplete="off"
                      className="min-h-12 w-full rounded-xl border-2 border-slate-200 bg-slate-50 pl-10 pr-3 font-mono text-sm font-black outline-none focus:border-emerald-500 dark:border-slate-800 dark:bg-slate-900"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!manualProductInput.trim()}
                    className="min-h-12 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white disabled:opacity-40"
                  >
                    ກວດ
                  </button>
                </form>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openCamera('product')}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Camera size={17} />
                    ສະແກນກ້ອງ
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMethodPicker(true)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-black text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <Zap size={17} />
                    {auditMethod === 'gun' ? 'ໂໝດປືນ' : 'ໂໝດກ້ອງ'}
                  </button>
                </div>

                {lastScannedFeedback && (
                  <div
                    className={`mt-2 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] font-black ${lastScannedFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300'
                      }`}
                  >
                    {lastScannedFeedback.type === 'success' ? <CheckCircle2 size={15} className="mt-0.5 shrink-0" /> : <CircleAlert size={15} className="mt-0.5 shrink-0" />}
                    <div className="min-w-0">
                      <div>{lastScannedFeedback.text}</div>
                      {lastScannedFeedback.barcode && (
                        <div className="mt-0.5 truncate font-mono text-[10px] opacity-75">{lastScannedFeedback.barcode}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-28">
                {displayedItems.length === 0 ? (
                  <div className="flex min-h-[30vh] flex-col items-center justify-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <Check size={28} />
                    </div>
                    <h3 className="text-base font-black">ກວດຄົບແລ້ວ</h3>
                    <p className="mt-1 text-xs font-medium text-slate-400">ບໍ່ມີລາຍການທີ່ຍັງລໍຖ້າກວດ</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {displayedItems.map((item, idx) => {
                      const barcode = (item.barcode_no || '').trim();
                      const isScanned = scannedBarcodes.has(barcode);
                      return (
                        <div
                          key={item.id || `${barcode}-${idx}`}
                          className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-all ${isScanned
                            ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/20'
                            : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                            }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${isScanned ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}>
                            {isScanned ? '✓' : '•'}
                          </div>
                          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                            <img
                              src={getProductImageUrl(item.barcode_no)}
                              alt={item.item_name}
                              onError={(e) => handleImageError(e, item.barcode_no)}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-mono text-[11px] font-black">{barcode || 'NO BARCODE'}</div>
                            <div className="mt-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                              {item.item_name || 'Unnamed Item'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] font-bold text-slate-400">Qty</div>
                            <div className="text-sm font-black">{item.store_qty ?? 0}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="fixed bottom-0 left-0 right-0 z-30 mx-auto w-full max-w-2xl border-t border-slate-200 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95 sm:absolute">
                <button
                  type="button"
                  onClick={() => setStep('summary')}
                  className="min-h-12 w-full rounded-xl bg-slate-900 text-sm font-black text-white dark:bg-white dark:text-slate-900"
                >
                  ຈົບການກວດ · {verifiedCount}/{totalItems}
                </button>
              </div>
            </main>
          )}

          {/* STEP 4 */}
          {step === 'summary' && (
            <main className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-5">
              <div className="mx-auto max-w-lg">
                <div className="text-center">
                  <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${isAllVerified ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'}`}>
                    {isAllVerified ? <CheckCircle2 size={34} /> : <CircleAlert size={34} />}
                  </div>
                  <h3 className="mt-4 text-xl font-black">{isAllVerified ? 'ກວດຄົບທຸກລາຍການ' : 'ກວດຍັງບໍ່ຄົບ'}</h3>
                  <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400">Rack {selectedRack}</p>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2">
                  <div className="rounded-2xl bg-slate-50 p-3 text-center dark:bg-slate-900">
                    <div className="text-[10px] font-bold text-slate-400">ທັງໝົດ</div>
                    <div className="mt-1 text-2xl font-black">{totalItems}</div>
                  </div>
                  <div className="rounded-2xl bg-emerald-50 p-3 text-center dark:bg-emerald-950/30">
                    <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">ພົບ</div>
                    <div className="mt-1 text-2xl font-black text-emerald-600 dark:text-emerald-400">{verifiedCount}</div>
                  </div>
                  <div className="rounded-2xl bg-amber-50 p-3 text-center dark:bg-amber-950/30">
                    <div className="text-[10px] font-bold text-amber-700 dark:text-amber-300">ຂາດ</div>
                    <div className="mt-1 text-2xl font-black text-amber-600 dark:text-amber-400">{missingCount}</div>
                  </div>
                </div>

                {missingCount > 0 && (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900 dark:bg-amber-950/20">
                    <div className="mb-2 flex items-center gap-2 text-xs font-black text-amber-700 dark:text-amber-300">
                      <CircleAlert size={16} />
                      ລາຍການທີ່ຍັງບໍ່ພົບ
                    </div>
                    <div className="space-y-2">
                      {missingItems.slice(0, 15).map((item, idx) => (
                        <div key={item.id || idx} className="flex items-center justify-between gap-3 rounded-xl bg-white/70 px-3 py-2 dark:bg-slate-900/50">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-black">{item.barcode_no}</div>
                            <div className="truncate text-[11px] font-medium text-slate-500">{item.item_name || 'Unnamed Item'}</div>
                          </div>
                          <div className="shrink-0 text-xs font-black">{item.store_qty ?? 0}</div>
                        </div>
                      ))}
                      {missingItems.length > 15 && (
                        <div className="pt-1 text-center text-[10px] font-bold text-amber-700 dark:text-amber-300">
                          + ອີກ {missingItems.length - 15} ລາຍການ
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('audit_active')}
                    className="min-h-12 rounded-xl border-2 border-slate-200 text-xs font-black dark:border-slate-800"
                  >
                    <RefreshCw className="mr-1 inline" size={16} />
                    ສະແກນຕໍ່
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('scan_rack');
                      setRackInput('');
                      setSelectedRack('');
                      setRackItems([]);
                      setScannedBarcodes(new Set());
                      setLastScannedFeedback(null);
                    }}
                    className="min-h-12 rounded-xl bg-emerald-500 text-xs font-black text-white"
                  >
                    <MapPin className="mr-1 inline" size={16} />
                    ເຊັກໂລອື່ນ
                  </button>
                </div>
              </div>
            </main>
          )}

          {/* Method picker */}
          {showMethodPicker && (
            <div className="absolute inset-0 z-40 flex items-end bg-slate-950/45 sm:items-center sm:justify-center">
              <div className="w-full rounded-t-3xl bg-white p-4 pb-[max(16px,env(safe-area-inset-bottom))] shadow-2xl dark:bg-slate-950 sm:max-w-md sm:rounded-3xl">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-800 sm:hidden" />
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black">ເລືອກວິທີສະແກນ</h3>
                    <p className="mt-1 text-xs font-medium text-slate-400">ເລືອກຕາມອຸປະກອນທີ່ທ່ານກຳລັງໃຊ້</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowMethodPicker(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-900"
                    aria-label="ປິດ"
                  >
                    <X size={17} />
                  </button>
                </div>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => startAudit('camera')}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left ${auditMethod === 'camera' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-white"><Camera size={21} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black">ກ້ອງໂທລະສັບ</span>
                      <span className="block text-[11px] font-medium text-slate-400">ເໝາະກັບການກວດແບບພາກສະໜາມ</span>
                    </span>
                    {auditMethod === 'camera' && <CheckCircle2 size={20} className="text-emerald-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => startAudit('gun')}
                    className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left ${auditMethod === 'gun' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' : 'border-slate-200 dark:border-slate-800'}`}
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900"><Barcode size={21} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black">ປືນຍິງບາໂຄ້ດ</span>
                      <span className="block text-[11px] font-medium text-slate-400">ເໝາະກັບການຍິງສະແກນຕໍ່ເນື່ອງ</span>
                    </span>
                    {auditMethod === 'gun' && <CheckCircle2 size={20} className="text-emerald-500" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Scanner */}
          {showCameraScanner && (
            <BarcodeScannerModal
              onDetected={(code) => {
                setShowCameraScanner(false);
                if (scannerTarget === 'rack') handleSelectRack(code);
                else handleScanProductBarcode(code);
              }}
              onClose={() => setShowCameraScanner(false)}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default PhonthongRackAuditorModal;
