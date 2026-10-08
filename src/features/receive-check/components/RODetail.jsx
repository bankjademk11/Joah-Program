import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Calendar, Building2, Barcode, CheckCircle2, BarChart3, List, RefreshCw, Loader2, X } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getReceiveItemStatus } from '../utils/receiveStatus';
import ROReconcileView from './ROReconcileView';
import { fetchStockCountForBranchDate } from '../services/reconcileService';

export default function RODetail({
  ro,
  receivingData = {},
  onBack,
  onUpdateReceived,
  onUpdateRemark
}) {
  const [activeTab, setActiveTab] = useState('items'); // Default to 'items' tab now that it shows live counts!
  const [stockCounts, setStockCounts] = useState([]);
  const [isLoadingStock, setIsLoadingStock] = useState(false);
  const [overrideDate, setOverrideDate] = useState('');
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'i' || e.key === 'I') {
        setIsDateModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Normalize date: DD/MM/YYYY -> YYYY-MM-DD
  const branch = ro?.storeCode;
  const rawDate = overrideDate || ro?.deliveryDate;
  const formattedDate = useMemo(() => {
    if (!rawDate) return '';
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return rawDate;
  }, [rawDate]);

  // Fetch stock counts for this branch & date
  const loadStockData = async () => {
    if (!branch || !formattedDate) return;
    setIsLoadingStock(true);
    try {
      const counts = await fetchStockCountForBranchDate(branch, formattedDate);
      setStockCounts(counts || []);
    } catch (err) {
      console.error('Failed to load stock count for RODetail:', err);
    } finally {
      setIsLoadingStock(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, [branch, formattedDate]);

  // Map barcodes to total counted qty from stock_count_lak8
  const stockCountMap = useMemo(() => {
    const map = new Map();
    for (const sc of stockCounts) {
      const prev = map.get(sc.barcode) || 0;
      map.set(sc.barcode, prev + (Number(sc.qty) || 0));
    }
    return map;
  }, [stockCounts]);

  if (!ro) return null;

  // Build items with real received count from stock_count_lak8 (or manual override)
  const itemsWithState = ro.items.map(item => {
    const override = receivingData[item.id];
    
    // Priority: 1. Manual user override if exists, 2. Live count from stock_count_lak8, 3. item.received, 4. null
    let received = null;
    if (override !== undefined && override.received !== undefined && override.received !== null) {
      received = override.received;
    } else if (stockCountMap.has(item.barcode)) {
      received = stockCountMap.get(item.barcode);
    } else if (item.received !== undefined && item.received !== null && item.received !== '') {
      received = item.received;
    }

    const remark = (override !== undefined && override.remark) ? override.remark : (item.remark || '');
    const statusObj = getReceiveItemStatus(item.roQty, received);

    return {
      ...item,
      received,
      remark: remark || (statusObj.status === 'SHORT' ? `Short ${Math.abs(statusObj.difference)}` : statusObj.status === 'OVER' ? `Over +${statusObj.difference}` : ''),
      statusObj
    };
  });

  let totalRoQty = 0;
  let totalReceived = 0;
  let okCount = 0;
  let shortCount = 0;
  let overCount = 0;
  let waitingCount = 0;

  itemsWithState.forEach(it => {
    totalRoQty += it.roQty;
    if (it.received !== null && it.received !== undefined && it.received !== '') {
      totalReceived += Number(it.received) || 0;
      if (it.statusObj.status === 'OK') okCount++;
      else if (it.statusObj.status === 'SHORT') shortCount++;
      else if (it.statusObj.status === 'OVER') overCount++;
    } else {
      waitingCount++;
    }
  });

  let overallStatus = 'WAITING';
  let overallLabel = 'Waiting';
  if (waitingCount === 0) {
    if (shortCount === 0 && overCount === 0) {
      overallStatus = 'COMPLETED';
      overallLabel = 'Completed (OK)';
    } else if (shortCount > 0 && overCount === 0) {
      overallStatus = 'SHORT';
      overallLabel = `Short (${shortCount} items)`;
    } else if (overCount > 0 && shortCount === 0) {
      overallStatus = 'OVER';
      overallLabel = `Over (${overCount} items)`;
    } else {
      overallStatus = 'DIFFERENCE';
      overallLabel = 'Difference (Short/Over)';
    }
  } else if (waitingCount < itemsWithState.length) {
    overallStatus = 'CHECKING';
    overallLabel = `Checking (${okCount + shortCount + overCount}/${itemsWithState.length})`;
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* TOP HEADER CARD */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 xl:p-8 shadow-xl border border-blue-100 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[300px] bg-gradient-to-bl from-blue-100/80 via-sky-50/60 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-wider mb-1">
              <span>Delivery Details (DC → Store)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {ro.roNumber}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
              SO Reference: {ro.soNumber || ro.fullReference}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={overallStatus} label={overallLabel} size="md" />
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-black flex items-center gap-2 border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>Back to RO List</span>
            </button>
          </div>
        </div>

        {/* 4 STATS ACCENT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-indigo-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Total Items</div>
            <div className="text-2xl font-black text-indigo-600 font-mono">
              {itemsWithState.length} <span className="text-sm font-sans font-normal text-slate-500">SKUs</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-sky-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">RO Qty</div>
            <div className="text-2xl font-black text-sky-600 font-mono">
              {totalRoQty.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-emerald-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Received</div>
            <div className={`text-2xl font-black font-mono ${
              totalReceived === totalRoQty ? 'text-emerald-600' :
              totalReceived < totalRoQty ? 'text-rose-600' : 'text-amber-500'
            }`}>
              {waitingCount === itemsWithState.length ? '-' : totalReceived.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-amber-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Difference</div>
            <div className={`text-2xl font-black font-mono ${
              totalReceived - totalRoQty === 0 ? 'text-emerald-600' :
              totalReceived - totalRoQty < 0 ? 'text-rose-600' : 'text-amber-500'
            }`}>
              {waitingCount === itemsWithState.length ? '-' : (
                totalReceived - totalRoQty === 0 ? 'Exact 0' :
                totalReceived - totalRoQty < 0 ? `Short ${totalReceived - totalRoQty}` : `Over +${totalReceived - totalRoQty}`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TAB SWITCHER */}
      <div className="flex items-center gap-2 bg-white/80 rounded-2xl p-1.5 shadow-sm border border-slate-100 w-fit">
        <button
          onClick={() => setActiveTab('items')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'items'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <List size={14} />
          <span>RO Items</span>
        </button>
        <button
          onClick={() => setActiveTab('reconcile')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'reconcile'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BarChart3 size={14} />
          <span>📊 Reconcile View</span>
        </button>
      </div>

      {/* RECONCILE TAB */}
      {activeTab === 'reconcile' && (
        <ROReconcileView ro={overrideDate ? { ...ro, deliveryDate: overrideDate } : ro} />
      )}

      {/* ITEMS TABLE TAB */}
      {activeTab === 'items' && (
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 xl:p-6 shadow-lg border border-blue-50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-black text-slate-800">
              Items in Delivery Order ({itemsWithState.length} items)
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-mono flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span>Store: <strong className="text-slate-800">{ro.storeCode}</strong></span>
              <span>•</span>
              <span>Date: <strong className="text-slate-800">{ro.deliveryDate}</strong></span>
            </div>
            <button
              onClick={loadStockData}
              disabled={isLoadingStock}
              className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition flex items-center gap-1 text-xs font-bold cursor-pointer"
              title="Refresh stock count"
            >
              <RefreshCw size={13} className={isLoadingStock ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-36">Barcode</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4 w-24 text-center">RO Qty</th>
                <th className="py-3 px-4 w-28 text-center">Received</th>
                <th className="py-3 px-4 w-24 text-center">Diff</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-48">Remark</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {itemsWithState.map((item, idx) => (
                <tr key={item.id} className="hover:bg-blue-50/40 transition">
                  <td className="py-3 px-4 text-center text-xs text-slate-400 font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-700">
                    {item.barcode}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800 text-xs sm:text-sm">
                      {item.productName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Unit: {item.unit || 'Unit'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-black text-slate-800 font-mono">
                    {item.roQty}
                  </td>
                  <td className="py-3 px-4 text-center font-black font-mono text-base">
                    <span className={
                      item.received === null ? 'text-slate-300' :
                      item.statusObj.status === 'OK' ? 'text-emerald-600' :
                      item.statusObj.status === 'SHORT' ? 'text-rose-600' : 'text-amber-500'
                    }>
                      {item.received === null ? '-' : item.received}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-black font-mono text-xs">
                    {item.received === null ? (
                      <span className="text-slate-300">-</span>
                    ) : item.statusObj.difference === 0 ? (
                      <span className="text-emerald-600">0</span>
                    ) : item.statusObj.difference < 0 ? (
                      <span className="text-rose-600">{item.statusObj.difference}</span>
                    ) : (
                      <span className="text-amber-500">+{item.statusObj.difference}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={item.statusObj.status} label={item.statusObj.label} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {item.remark ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {item.remark}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW */}
        <div className="md:hidden divide-y divide-slate-100">
          {itemsWithState.map((item, idx) => (
            <div key={item.id} className="p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 mr-2">#{idx + 1}</span>
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    {item.barcode}
                  </span>
                </div>
                <StatusBadge status={item.statusObj.status} label={item.statusObj.label} size="sm" />
              </div>

              <div className="font-bold text-xs text-slate-800 line-clamp-2">
                {item.productName}
              </div>

              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl text-center text-xs font-mono">
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">RO QTY</div>
                  <div className="font-black text-slate-800">{item.roQty}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">RECEIVED</div>
                  <div className="font-black text-indigo-600">
                    {item.received === null ? '-' : item.received}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">DIFF</div>
                  <div className={`font-black ${
                    item.received === null ? 'text-slate-300' :
                    item.statusObj.difference === 0 ? 'text-emerald-600' :
                    item.statusObj.difference < 0 ? 'text-rose-600' : 'text-amber-500'
                  }`}>
                    {item.received === null ? '-' : item.statusObj.difference}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
      
      {/* Override Date Modal */}
      {isDateModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col relative">
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <h3 className="text-lg font-black flex items-center gap-2">
                <Calendar size={18} /> Shift Date
              </h3>
              <button
                onClick={() => setIsDateModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-medium text-slate-500">
                Select a new date to override the reconciliation date for this RO.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">Reconcile Date:</label>
                <input
                  type="date"
                  value={overrideDate || formattedDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-bold text-xs outline-none transition"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    setOverrideDate('');
                    setIsDateModalOpen(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Reset
                </button>
                <button
                  onClick={() => {
                    setIsDateModalOpen(false);
                    loadStockData();
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-md shadow-indigo-200 transition cursor-pointer"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
