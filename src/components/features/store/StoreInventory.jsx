import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowLeft, Search, Download, Database, MapPin,
  Filter, ChevronDown, ArrowUpDown, Package,
  RotateCw, ScanLine, FileSpreadsheet, Eye, EyeOff,
  ChevronLeft, ChevronRight, CheckCircle, AlertCircle, BarChart3
} from 'lucide-react';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { useLanguage } from '../../../contexts/LanguageContext';
import ExcelJS from 'exceljs';
import BarcodeScannerModal from '../../ui/BarcodeScannerModal';

const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ', 'ເມກ້າມໍ'];
const ITEMS_PER_PAGE = 50;

const MEGAMALL = 'ເມກ້າມໍ';

const StoreInventory = ({ onBack, currentUser, isAdmin, initialBranch }) => {
  const { t } = useLanguage();
  const toast = useToast();


  // ---- State ----
  const [inventoryData, setInventoryData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(
    initialBranch || (isAdmin ? 'ຕະຫຼາດລາວ' : (currentUser?.branch_id || ''))
  );
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // ---- Cooldown Timer ----
  useEffect(() => {
    if (cooldownRemaining > 0) {
      const timer = setInterval(() => setCooldownRemaining(prev => Math.max(0, prev - 1)), 1000);
      return () => clearInterval(timer);
    }
  }, [cooldownRemaining]);

  // ---- Fetch ----
  const fetchInventory = useCallback(async () => {
    if (!selectedBranch) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('store_inventory')
        .select('*')
        .eq('branch_id', selectedBranch)
        .order('item_name', { ascending: true });
      if (error) throw error;
      setInventoryData(data || []);
    } catch (err) {
      toast.error('ເກີດຂໍ້ຜິດພາດ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);

  useEffect(() => {
    fetchInventory();
    setCurrentPage(1);
  }, [fetchInventory]);

  // ---- Realtime ----
  useEffect(() => {
    const channel = supabase
      .channel(`store_inventory_rt_${selectedBranch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_inventory' }, (payload) => {
        const rowBranch = payload.new?.branch_id || payload.old?.branch_id;
        if (rowBranch !== selectedBranch) return;
        fetchInventory();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedBranch, fetchInventory]);

  // ---- Sort ----
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  // ---- Filter + Sort + Search ----
  const filteredResults = inventoryData
    .filter(row => {
      const qty = row.store_qty ?? 0;
      const matchSearch =
        (row.barcode_no || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.item_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (row.shelf_location || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchFilter =
        filterStatus === 'all' ||
        (filterStatus === 'has_stock' && qty > 0) ||
        (filterStatus === 'out_of_stock' && qty === 0) ||
        (filterStatus === 'low_stock' && qty > 0 && qty <= 5);
      return matchSearch && matchFilter;
    })
    .sort((a, b) => {
      if (!sortConfig.key) return 0;
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (sortConfig.key === 'store_qty') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      } else {
        valA = String(valA || '').toLowerCase();
        valB = String(valB || '').toLowerCase();
      }
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentResults = filteredResults.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // ---- Stats ----
  const stats = {
    total: inventoryData.length,
    hasStock: inventoryData.filter(r => (r.store_qty ?? 0) > 0).length,
    outOfStock: inventoryData.filter(r => (r.store_qty ?? 0) === 0).length,
    lowStock: inventoryData.filter(r => (r.store_qty ?? 0) > 0 && (r.store_qty ?? 0) <= 5).length,
  };

  // ---- Export ----
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const workbook = new ExcelJS.Workbook();
      const ws = workbook.addWorksheet('Store Inventory');
      ws.columns = [
        { header: '#', key: 'no', width: 6 },
        { header: 'Barcode', key: 'barcode', width: 22 },
        { header: 'ຊື່ສິນຄ້າ', key: 'item_name', width: 40 },
        { header: 'ຕຳແໜ່ງຊັ້ນ', key: 'shelf_location', width: 16 },
        { header: 'ຈຳນວນໜ້າຮ້ານ', key: 'store_qty', width: 16 },
        { header: 'ສາຂາ', key: 'branch_id', width: 16 },
        { header: 'ອັບເດດ', key: 'last_updated', width: 20 },
        { header: 'ໂດຍ', key: 'updated_by', width: 18 },
      ];
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } };
      filteredResults.forEach((row, idx) => {
        ws.addRow({
          no: idx + 1,
          barcode: row.barcode_no,
          item_name: row.item_name || '',
          shelf_location: row.shelf_location || '',
          store_qty: row.store_qty ?? 0,
          branch_id: row.branch_id,
          last_updated: row.last_updated ? new Date(row.last_updated).toLocaleString() : '',
          updated_by: row.updated_by || '',
        });
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(new Blob([buffer]));
      a.download = `StoreInventory_${selectedBranch}_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      toast.success('Export ສຳເລັດ!');
    } catch (err) {
      toast.error('Export Error: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRefresh = async () => {
    if (cooldownRemaining > 0) return;
    await fetchInventory();
    setCooldownRemaining(3);
  };

  // ---- Render ----
  return (
    <>
      <div className="space-y-6 animate-fade-in-up">

        {/* ===== ACTION BAR ===== */}
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-[40px] rounded-[2rem] sm:rounded-[3rem] p-4 sm:p-6 lg:p-8 flex flex-col xl:flex-row gap-4 sm:gap-8 items-center border-[1.5px] border-white/80 dark:border-slate-800 shadow-[0_20px_60px_-15px_rgba(16,185,129,0.15)] relative z-50">

          {/* Back Button + Title */}
          <div className="flex items-center gap-4 w-full xl:w-auto">
            <button
              onClick={onBack}
              className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm border border-slate-100 dark:border-slate-700 transition-colors flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white tracking-tight truncate flex items-center gap-2">
                <Database className="text-emerald-500 shrink-0" size={20} />
                ຂໍ້ມູນຊັ້ນວ່າງເຄື່ອງໜ້າຮ້ານ
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Store Inventory · {selectedBranch}</p>
            </div>
          </div>

          {/* Inputs */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {/* Search */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Search className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                placeholder="ຄົ້ນຫາບາໂຄ້ດ, ຊື່ ຫຼື ຊັ້ນວາງ..."
                className="w-full bg-slate-50/60 dark:bg-slate-800/60 pl-12 sm:pl-16 pr-12 sm:pr-14 py-3 sm:py-4 rounded-[2rem] text-sm font-black tracking-wide text-slate-700 dark:text-white border-2 border-slate-200/60 dark:border-slate-700/50 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/10 outline-none transition-all placeholder:text-slate-400/70 shadow-inner"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              <button
                onClick={() => setShowScanner(true)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-2xl bg-white dark:bg-slate-700 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 shadow-sm border border-slate-200 dark:border-slate-600 transition-all"
                title="Scan Barcode"
              >
                <ScanLine size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Filter Dropdown */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Filter className="text-slate-400 group-focus-within:text-emerald-500 transition-colors" size={20} strokeWidth={2.5} />
              </div>
              <select
                className="w-full bg-slate-50/60 dark:bg-slate-800/60 pl-12 sm:pl-16 pr-10 sm:pr-14 py-3 sm:py-4 rounded-[2rem] text-sm font-black tracking-wide text-slate-700 dark:text-white border-2 border-slate-200/60 dark:border-slate-700/50 focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-400 outline-none transition-all appearance-none cursor-pointer shadow-inner"
                value={filterStatus}
                onChange={e => { setFilterStatus(e.target.value); setCurrentPage(1); }}
              >
                <option value="all">ທັງໝົດ ({stats.total})</option>
                <option value="has_stock">ມີສະຕ໋ອກ ({stats.hasStock})</option>
                <option value="out_of_stock">ໝົດສະຕ໋ອກ ({stats.outOfStock})</option>
                <option value="low_stock">ສະຕ໋ອກຕໍ່າ ≤5 ({stats.lowStock})</option>
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} strokeWidth={2.5} />
            </div>


          </div>

          {/* Right Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 w-full xl:w-auto xl:border-l-2 border-slate-100 dark:border-slate-800 pt-4 sm:pt-6 xl:pt-0 xl:pl-8">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 sm:flex-none bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 hover:from-emerald-400 hover:via-teal-400 hover:to-teal-400 text-white shadow-[0_10px_20px_-5px_rgba(16,185,129,0.5)] transition-all hover:-translate-y-1 py-3 sm:py-4 px-5 sm:px-8 rounded-[2rem] text-[11px] sm:text-xs flex items-center justify-center gap-2 sm:gap-3 font-black tracking-widest uppercase active:translate-y-0 min-w-0"
            >
              {isExporting ? <RotateCw className="animate-spin shrink-0" size={15} /> : <Download size={15} className="shrink-0" />}
              <span className="truncate">Export Excel</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isLoading || cooldownRemaining > 0}
              className={`flex-1 sm:flex-none bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-emerald-300 text-slate-600 dark:text-slate-300 hover:text-emerald-600 py-3 sm:py-4 px-5 sm:px-8 rounded-[2rem] text-[11px] sm:text-xs font-black shadow-sm hover:shadow-[0_10px_20px_-5px_rgba(16,185,129,0.15)] transition-all hover:-translate-y-1 flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-widest active:translate-y-0 min-w-0 ${cooldownRemaining > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RotateCw size={16} strokeWidth={2.5} className={`shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="truncate">{isLoading ? 'ກຳລັງໂຫລດ...' : cooldownRemaining > 0 ? `ລໍຖ້າ ${cooldownRemaining}s` : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* ===== TABLE ===== */}
        <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 overflow-visible mt-6">
          <div className="overflow-x-auto custom-scrollbar rounded-[2.5rem]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                  <th className="px-8 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">#</th>
                  <th className="px-6 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">Barcode / ຊື່ສິນຄ້າ</th>
                  <th className="px-6 py-6 text-sm font-black text-slate-800 dark:text-slate-200 border-b-2 border-slate-200 dark:border-slate-700 tracking-wider">ຕຳແໜ່ງຊັ້ນ</th>
                  {/* Shop QTY - Primary, highlighted */}
                  <th
                    onClick={() => handleSort('store_qty')}
                    className="px-6 py-6 text-center text-sm font-black text-emerald-600 dark:text-emerald-400 border-b-2 border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors group/head tracking-wider"
                  >
                    <div className="flex items-center justify-center gap-2">
                      ຈຳນວນໜ້າຮ້ານ
                      <div className={`transition-all duration-300 ${sortConfig.key === 'store_qty' ? 'text-emerald-500 scale-110' : 'text-emerald-300 group-hover/head:text-emerald-500'}`}>
                        {sortConfig.key === 'store_qty' ? (
                          sortConfig.direction === 'asc' ? <ChevronDown size={16} strokeWidth={3} /> : <ChevronDown size={16} className="rotate-180" strokeWidth={3} />
                        ) : <ArrowUpDown size={16} strokeWidth={3} />}
                      </div>
                    </div>
                  </th>
                  <th className="px-6 py-6 text-center text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700 hidden sm:table-cell">
                    ອັບເດດລ່າສຸດ
                  </th>
                  <th className="px-6 py-6 text-center text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider border-b-2 border-slate-200 dark:border-slate-700 hidden sm:table-cell">
                    ໂດຍ
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={`skeleton-${i}`} className="animate-pulse bg-white/5">
                      <td colSpan="6" className="px-8 py-6 h-20 bg-slate-100/50"></td>
                    </tr>
                  ))
                ) : currentResults.length > 0 ? (
                  currentResults.map((row, idx) => {
                    const qty = row.store_qty ?? 0;
                    const isZero = qty === 0;
                    const isLow = qty > 0 && qty <= 5;
                    return (
                      <tr
                        key={row.id}
                        className={`group transition-all duration-300 hover:bg-emerald-500/[0.03] dark:hover:bg-emerald-500/[0.05] ${isZero ? 'opacity-50' : ''}`}
                      >
                        <td className="px-8 py-6 text-xs font-black text-slate-300 dark:text-slate-700">#{startIndex + idx + 1}</td>
                        <td className="px-3 sm:px-6 py-4 sm:py-6">
                          <div className="flex flex-col gap-1.5 sm:gap-2 py-1">
                            <div className="flex items-center">
                              <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 text-xs sm:text-sm font-black font-mono tracking-wider shadow-sm truncate max-w-[140px] sm:max-w-none">
                                {row.barcode_no}
                              </span>
                            </div>
                            <span className="text-[10px] sm:text-xs font-extrabold text-slate-600 dark:text-slate-300 line-clamp-2 max-w-[160px] sm:max-w-[280px] leading-relaxed">
                              {row.item_name || <span className="opacity-50 italic">Unnamed Item</span>}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 sm:px-6 py-4 sm:py-6">
                          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/50 transition-all font-mono whitespace-nowrap">
                            <MapPin size={12} className="text-emerald-500 shrink-0 sm:w-[13px] sm:h-[13px]" />
                            <span className="text-xs sm:text-[13px] font-black text-slate-700 dark:text-slate-200 tracking-wide uppercase">
                              {row.shelf_location || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 sm:px-6 py-4 sm:py-6">
                          <div className="flex flex-col items-center">
                            <span className={`text-xl sm:text-2xl font-black leading-none ${
                              isZero ? 'text-rose-400 dark:text-rose-500'
                              : isLow ? 'text-amber-500 dark:text-amber-400'
                              : 'text-slate-800 dark:text-white'
                            }`}>
                              {qty}
                            </span>
                            <div className={`hidden sm:flex items-center gap-1 text-[9px] font-black uppercase tracking-widest mt-2 p-1 px-2 rounded-lg ${
                              isZero ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-400'
                              : isLow ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-500'
                              : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500'
                            }`}>
                              {isZero ? '🔴 Out' : isLow ? '🟡 Low' : '🟢 OK'}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-6 text-center text-xs text-slate-400 hidden sm:table-cell">
                          {row.last_updated
                            ? new Date(row.last_updated).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
                            : '—'}
                        </td>
                        <td className="px-6 py-6 text-center text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                          {row.updated_by || '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="py-24 text-center">
                      <div className="flex flex-col items-center gap-6 text-slate-300 dark:text-slate-700 animate-fade-in">
                        <Package size={40} className="w-20 h-20 text-slate-200" strokeWidth={1.5} />
                        <p className="text-lg font-black text-slate-800 dark:text-white">
                          {inventoryData.length === 0
                            ? `ຍັງບໍ່ມີຂໍ້ມູນໃນ store_inventory ສຳລັບ ${selectedBranch}`
                            : 'ບໍ່ພົບຂໍ້ມູນຈາກການຄົ້ນຫາ'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ===== PAGINATION ===== */}
          <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between border-t border-slate-100 dark:border-slate-800/50">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
              Showing{' '}
              <span className="text-slate-700 dark:text-slate-300">
                {filteredResults.length === 0 ? 0 : startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredResults.length)}
              </span>{' '}
              of <span className="text-slate-700 dark:text-slate-300">{filteredResults.length}</span> items
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="btn-secondary !p-3 !rounded-xl disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-700 dark:text-white">
                {currentPage} / {totalPages || 1}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="btn-secondary !p-3 !rounded-xl disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScannerModal
          onDetected={(code) => {
            setSearchTerm(code);
            setCurrentPage(1);
            setShowScanner(false);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </>
  );
};

export default StoreInventory;
