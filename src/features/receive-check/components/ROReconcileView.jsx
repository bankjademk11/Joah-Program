import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckCircle2, AlertCircle, ArrowUpCircle, Clock, HelpCircle,
  Loader2, RefreshCw, Filter, Search, BarChart3, Building2, Calendar
} from 'lucide-react';
import { fetchStockCountForBranchDate, buildReconciliationRows } from '../services/reconcileService';

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  OK:          { label: 'Matched (OK)',     icon: CheckCircle2,   color: 'text-emerald-600', bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  SHORT:       { label: 'Short',            icon: AlertCircle,    color: 'text-rose-600',    bg: 'bg-rose-50',     border: 'border-rose-200',    badge: 'bg-rose-100 text-rose-700' },
  OVER:        { label: 'Over',             icon: ArrowUpCircle,  color: 'text-amber-600',   bg: 'bg-amber-50',    border: 'border-amber-200',   badge: 'bg-amber-100 text-amber-700' },
  NOT_COUNTED: { label: 'Not Counted',      icon: Clock,          color: 'text-slate-400',   bg: 'bg-slate-50',    border: 'border-slate-200',   badge: 'bg-slate-100 text-slate-500' },
  EXTRA:       { label: 'Extra (Not in RO)',icon: HelpCircle,     color: 'text-purple-600',  bg: 'bg-purple-50',   border: 'border-purple-200',  badge: 'bg-purple-100 text-purple-700' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NOT_COUNTED;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black ${cfg.badge}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function ROReconcileView({ ro }) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [lastFetched, setLastFetched] = useState(null);

  // The branch = ro.storeCode, date = ro.deliveryDate
  const branch = ro?.storeCode;
  const rawDate = ro?.deliveryDate; // may be "08/10/2026" (DD/MM/YYYY) or "2026-10-08" (YYYY-MM-DD)

  // Convert DD/MM/YYYY → YYYY-MM-DD for Supabase query
  const date = React.useMemo(() => {
    if (!rawDate) return '';
    if (rawDate.includes('/')) {
      const parts = rawDate.split('/');
      if (parts.length === 3) {
        const [d, m, y] = parts;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
    }
    return rawDate; // already YYYY-MM-DD
  }, [rawDate]);

  const loadReconcile = async () => {
    if (!branch || !date || !ro?.items?.length) return;
    setIsLoading(true);
    setError('');
    try {
      const stockCounts = await fetchStockCountForBranchDate(branch, date);
      const reconciled = buildReconciliationRows(ro.items, stockCounts);
      setRows(reconciled);
      setLastFetched(new Date());
    } catch (err) {
      console.error(err);
      setError('Failed to fetch stock_count_lak8: ' + (err.message || ''));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (branch && date) {
      loadReconcile();
    }
  }, [ro?.id, branch, date]);

  // ─── Summary stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const s = { OK: 0, SHORT: 0, OVER: 0, NOT_COUNTED: 0, EXTRA: 0 };
    let totalRoQty = 0, totalCountedQty = 0;
    rows.forEach(r => {
      s[r.status] = (s[r.status] || 0) + 1;
      totalRoQty += r.roQty;
      totalCountedQty += r.countedQty || 0;
    });
    return { ...s, totalRoQty, totalCountedQty, totalRows: rows.length };
  }, [rows]);

  // ─── Filtered rows ──────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.barcode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  if (!ro) return null;

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header info */}
      <div className="bg-white/90 rounded-2xl p-4 border border-slate-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-indigo-600" />
              <h3 className="font-black text-slate-800 text-base">
                Reconciliation: Delivery RO vs Store Stock Count
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-500 font-mono">
              <span className="flex items-center gap-1"><Building2 size={12} /> Branch: <strong className="text-slate-700">{branch || '—'}</strong></span>
              <span className="flex items-center gap-1"><Calendar size={12} /> Date: <strong className="text-slate-700">{date || '—'}</strong></span>
            </div>
            {lastFetched && (
              <p className="text-[10px] text-slate-400">Last updated: {lastFetched.toLocaleTimeString()}</p>
            )}
          </div>

          <button
            onClick={loadReconcile}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Stats */}
      {!isLoading && rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = stats[key] || 0;
            const Icon = cfg.icon;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(prev => prev === key ? 'ALL' : key)}
                className={`
                  p-3 rounded-2xl border text-left transition-all active:scale-95 cursor-pointer
                  ${statusFilter === key
                    ? `${cfg.bg} ${cfg.border} ring-2 ring-offset-1 ring-current ${cfg.color}`
                    : 'bg-white border-slate-100 hover:border-slate-200'}
                `}
              >
                <div className={`flex items-center gap-1.5 mb-1 ${statusFilter === key ? cfg.color : 'text-slate-500'}`}>
                  <Icon size={15} />
                  <span className="text-[11px] font-bold">{cfg.label}</span>
                </div>
                <div className={`text-2xl font-black font-mono ${statusFilter === key ? cfg.color : 'text-slate-700'}`}>
                  {count}
                </div>
                <div className="text-[10px] text-slate-400">items</div>
              </button>
            );
          })}
        </div>
      )}

      {/* RO vs Stock QTY Summary */}
      {!isLoading && rows.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-2xl border border-indigo-100 p-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">RO QTY (DC Sent)</div>
              <div className="text-2xl font-black text-indigo-700 font-mono">{stats.totalRoQty.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock Count (Received)</div>
              <div className="text-2xl font-black text-emerald-700 font-mono">{stats.totalCountedQty.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Difference</div>
              <div className={`text-2xl font-black font-mono ${stats.totalCountedQty - stats.totalRoQty === 0 ? 'text-emerald-600' : stats.totalCountedQty - stats.totalRoQty > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                {stats.totalCountedQty - stats.totalRoQty >= 0 ? '+' : ''}{(stats.totalCountedQty - stats.totalRoQty).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter + Search */}
      {!isLoading && rows.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 flex-1">
            <Search size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search barcode or product name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 text-xs bg-transparent outline-none text-slate-700"
            />
          </div>
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Filter size={14} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="text-xs bg-transparent outline-none text-slate-700 cursor-pointer min-w-[140px]"
            >
              <option value="ALL">All Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="bg-white/80 rounded-2xl p-12 text-center border border-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-2" />
          <p className="text-sm font-black text-slate-600">
            Fetching Stock Count from Supabase...
          </p>
        </div>
      )}

      {/* Empty: no stock data */}
      {!isLoading && rows.length === 0 && !error && (
        <div className="bg-white/80 rounded-2xl p-12 text-center border border-slate-100">
          <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-black text-slate-500">
            No stock count records found for {branch} on {date}
          </p>
          <p className="text-xs text-slate-400 mt-1">Table stock_count_lak8 currently has no matching records</p>
        </div>
      )}

      {/* Table */}
      {!isLoading && filteredRows.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 w-10 text-center">#</th>
                <th className="py-3 px-4">Barcode</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4 text-center">RO QTY<br/><span className="text-[9px] font-medium normal-case">(DC Sent)</span></th>
                <th className="py-3 px-4 text-center">Counted<br/><span className="text-[9px] font-medium normal-case">(Stock Count)</span></th>
                <th className="py-3 px-4 text-center">Diff<br/><span className="text-[9px] font-medium normal-case">(Variance)</span></th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.map((row, idx) => {
                const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.NOT_COUNTED;
                return (
                  <tr key={row.barcode + idx} className={`transition ${cfg.bg} hover:brightness-95`}>
                    <td className="py-2.5 px-4 text-center text-xs text-slate-400 font-bold">{idx + 1}</td>
                    <td className="py-2.5 px-4 font-mono text-xs font-black text-slate-700">{row.barcode}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 font-['Noto_Sans_Lao',sans-serif]">
                      {row.productName || <span className="text-slate-300 italic">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-black text-slate-800">{row.roQty}</td>
                    <td className="py-2.5 px-4 text-center font-mono font-black text-slate-800">
                      {row.countedQty !== null ? row.countedQty : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono font-black">
                      {row.diff !== null ? (
                        <span className={row.diff === 0 ? 'text-emerald-600' : row.diff > 0 ? 'text-amber-600' : 'text-rose-600'}>
                          {row.diff > 0 ? '+' : ''}{row.diff}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-400">
            Showing {filteredRows.length} of {rows.length} items
          </div>
        </div>
      )}
    </div>
  );
}
