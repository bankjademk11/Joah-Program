import React from 'react';
import { Search, Filter, Calendar, Building2, ArrowRight, Package, UploadCloud, Trash2 } from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function ROList({
  roListWithStats,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  storeFilter,
  onStoreFilterChange,
  availableStores,
  onSelectRO,
  onOpenImport,
  onDeleteRO
}) {
  return (
    <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-5 xl:p-6 shadow-lg border border-blue-50 space-y-4">
      {/* FILTER ROW + ACTION BUTTONS */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* LEFT: DATE, STORE, STATUS FILTERS */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Date display */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-1.5 px-2 text-slate-600">
              <Calendar size={16} className="text-indigo-600" />
              <span className="text-sm font-black text-slate-700">Date:</span>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 font-mono">
              18/09/2026
            </div>
          </div>

          {/* Store / Branch filter */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <Building2 size={16} className="text-indigo-600 ml-2" />
            <select
              value={storeFilter}
              onChange={(e) => onStoreFilterChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[170px]"
            >
              <option value="ALL">🏢 All Stores</option>
              {availableStores.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
            <Filter size={16} className="text-indigo-600 ml-2" />
            <select
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 transition-all cursor-pointer min-w-[160px]"
            >
              <option value="ALL">All Status</option>
              <option value="WAITING">⏳ Waiting</option>
              <option value="CHECKING">🔄 Checking</option>
              <option value="COMPLETED">✅ Completed (OK)</option>
              <option value="SHORT">❌ Short</option>
              <option value="OVER">⚠️ Over</option>
              <option value="DIFFERENCE">⚠️ Difference</option>
            </select>
          </div>
        </div>

        {/* RIGHT: SEARCH BAR + IMPORT BUTTON */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search RO, SO, barcode..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 transition"
            />
          </div>

          {onOpenImport && (
            <button
              onClick={onOpenImport}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-100 transition-all cursor-pointer active:scale-95 shrink-0"
              title="Import RO Excel Picking List"
            >
              <UploadCloud size={15} />
              <span>Import Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
              <th className="py-3.5 px-4 w-12 text-center">#</th>
              <th className="py-3.5 px-4">RO / SO Reference</th>
              <th className="py-3.5 px-4">Store</th>
              <th className="py-3.5 px-4">Delivery Date</th>
              <th className="py-3.5 px-4 text-center">Total Items</th>
              <th className="py-3.5 px-4 text-center">RO Qty</th>
              <th className="py-3.5 px-4 text-center">Received</th>
              <th className="py-3.5 px-4 text-center">Status</th>
              <th className="py-3.5 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {roListWithStats.length === 0 ? (
              <tr>
                <td colSpan="9" className="py-12 text-center text-slate-400">
                  <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold">No RO matching the filter</p>
                </td>
              </tr>
            ) : (
              roListWithStats.map((ro, idx) => (
                <tr
                  key={ro.id}
                  onClick={() => onSelectRO(ro)}
                  className="hover:bg-blue-50/50 cursor-pointer transition group"
                >
                  <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-400">
                    {idx + 1}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-black text-blue-700 group-hover:text-blue-900 flex items-center gap-1.5 font-mono">
                      <span>{ro.roNumber}</span>
                      {ro.blockAppearances && ro.blockAppearances.length > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold font-sans" title="Continuation Block">
                          Cont. Block
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      {ro.soNumber || ro.fullReference}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800">{ro.storeName}</div>
                    <div className="text-xs text-slate-400 font-mono">{ro.storeCode}</div>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                    {ro.deliveryDate}
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-700">
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-sans">
                      {ro.totalItems} items
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-black text-slate-800 font-mono">
                    {ro.totalRoQty.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center font-black font-mono">
                    <span className={
                      ro.totalReceived === ro.totalRoQty
                        ? 'text-emerald-600'
                        : ro.totalReceived < ro.totalRoQty
                        ? 'text-rose-600'
                        : 'text-amber-500'
                    }>
                      {ro.stats.waitingCount === ro.totalItems ? '-' : ro.totalReceived.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <StatusBadge status={ro.stats.status} label={ro.stats.label} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectRO(ro);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition shadow-xs"
                      >
                        <span>Check Order</span>
                        <ArrowRight size={14} />
                      </button>
                      {onDeleteRO && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteRO(ro.id);
                          }}
                          className="p-1.5 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition shadow-xs"
                          title="Delete RO"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="md:hidden divide-y divide-slate-100">
        {roListWithStats.length === 0 ? (
          <div className="py-10 text-center text-slate-400">
            <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-sm">No RO found</p>
          </div>
        ) : (
          roListWithStats.map((ro) => (
            <div
              key={ro.id}
              onClick={() => onSelectRO(ro)}
              className="p-4 active:bg-blue-50/50 transition cursor-pointer space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black text-sm text-blue-700 font-mono">
                    {ro.roNumber}
                  </div>
                  <div className="text-xs text-slate-400 font-mono line-clamp-1">
                    {ro.soNumber}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge status={ro.stats.status} label={ro.stats.label} size="sm" />
                  {onDeleteRO && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteRO(ro.id);
                      }}
                      className="p-1.5 rounded-xl bg-rose-50 text-rose-400 hover:bg-rose-500 hover:text-white transition"
                      title="Delete RO"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 pt-1 font-bold">
                <span>{ro.storeName}</span>
                <span className="font-mono text-slate-400">{ro.deliveryDate}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl text-center text-xs">
                <div>
                  <div className="text-slate-400 text-[10px] font-bold">Total Items</div>
                  <div className="font-black text-slate-700">{ro.totalItems} items</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-bold">RO QTY</div>
                  <div className="font-black text-slate-800 font-mono">{ro.totalRoQty}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-bold">RECEIVED</div>
                  <div className="font-black text-indigo-600 font-mono">
                    {ro.stats.waitingCount === ro.totalItems ? '-' : ro.totalReceived}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
