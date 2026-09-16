import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../utils/supabaseClient';
import {
  Search,
  Filter,
  Download,
  Copy,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Warehouse,
  Store,
  Layers,
  FileSpreadsheet,
  ArrowLeft,
  ChevronDown,
  Info,
  Check,
  ExternalLink
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

const BRANCH_OPTIONS = [
  { id: 'ໂພນສີນວນ', label: 'ໂພນສີນວນ (Phonsinuan)' },
  { id: 'ສີວິໄລ', label: 'ສີວິໄລ (Sivilai)' },
  { id: 'ວັງຊາຍ', label: 'ວັງຊາຍ (Vang Say)' },
  { id: 'ຕະຫຼາດລາວ', label: 'ຕະຫຼາດລາວ (Talad Lao)' },
  { id: 'ເມກ້າມໍ', label: 'ເມກ້າມໍ (Mega Mall)' },
  { id: 'ໂພນຕ້ອງ', label: 'ໂພນຕ້ອງ (Phontong)' },
];

export default function BarcodeIntegrityInspector({ onBack, defaultBranch = 'ໂພນສີນວນ' }) {
  const [selectedBranch, setSelectedBranch] = useState(defaultBranch);
  const [scope, setScope] = useState('both'); // 'both' | 'warehouse' | 'store'
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  const [filterType, setFilterType] = useState('all_issues'); // 'all_issues' | 'not_13' | 'contains_non_digits' | 'empty' | 'valid'
  const [searchKeyword, setSearchKeyword] = useState('');
  const [copied, setCopied] = useState(false);

  // Fetch data from Supabase
  const fetchData = async () => {
    setLoading(true);
    try {
      const combined = [];

      // 1. Fetch Warehouse: location_inventory
      // 1. Fetch Warehouse: location_inventory
      if (scope === 'warehouse' || scope === 'both') {
        const { data: whData, error: whError } = await supabase
          .from('location_inventory')
          .select('id, barcode_no, item_name, rack_location, qty, category_1_actual, category_2_actual, uploaded_by, change_reason, branch_id, updated_at')
          .eq('branch_id', selectedBranch)
          .limit(10000);

        if (whError) {
          console.error('Error fetching location_inventory:', whError);
        } else if (whData) {
          whData.forEach(item => {
            combined.push({
              sourceId: item.id,
              source: 'warehouse',
              sourceLabel: 'ສາງ (Warehouse)',
              barcode: item.barcode_no ? String(item.barcode_no).trim() : '',
              itemName: item.item_name || 'N/A',
              location: item.rack_location || '-',
              qty: item.qty ?? 0,
              cat1: item.category_1_actual || '',
              cat2: item.category_2_actual || '',
              updatedBy: item.uploaded_by || '-',
              changeReason: item.change_reason || '',
              branch: item.branch_id,
              updatedAt: item.updated_at
            });
          });
        }
      }

      // 2. Fetch Store Front: store_inventory
      if (scope === 'store' || scope === 'both') {
        const { data: storeData, error: storeError } = await supabase
          .from('store_inventory')
          .select('id, barcode_no, item_name, shelf_location, store_qty, category_1_actual, category_2_actual, product_tag, max_qty, sales_qty, updated_by, branch_id, last_updated')
          .eq('branch_id', selectedBranch)
          .limit(10000);

        if (storeError) {
          console.error('Error fetching store_inventory:', storeError);
        } else if (storeData) {
          storeData.forEach(item => {
            combined.push({
              sourceId: item.id,
              source: 'store',
              sourceLabel: 'ໜ້າຮ້ານ (Store Front)',
              barcode: item.barcode_no ? String(item.barcode_no).trim() : '',
              itemName: item.item_name || 'N/A',
              location: item.shelf_location || '-',
              qty: item.store_qty ?? 0,
              productTag: item.product_tag || '-',
              maxQty: item.max_qty ?? '-',
              salesQty: item.sales_qty ?? '-',
              cat1: item.category_1_actual || '',
              cat2: item.category_2_actual || '',
              updatedBy: item.updated_by || '-',
              branch: item.branch_id,
              updatedAt: item.last_updated
            });
          });
        }
      }

      // 3. Optional: Cross-check with history tables for fallback if updated_by is empty or unknown
      const suspiciousBarcodes = combined
        .filter(i => (!i.updatedBy || i.updatedBy === '-' || i.updatedBy === 'Unknown') && i.barcode)
        .map(i => i.barcode);

      if (suspiciousBarcodes.length > 0) {
        const uniqueCodes = [...new Set(suspiciousBarcodes)].slice(0, 500);

        // Check inventory_history
        const { data: whHist } = await supabase
          .from('inventory_history')
          .select('barcode, updated_by, updated_at')
          .eq('branch_id', selectedBranch)
          .in('barcode', uniqueCodes)
          .order('updated_at', { ascending: false })
          .limit(1000);

        const whHistMap = {};
        if (whHist) {
          whHist.forEach(h => {
            if (h.barcode && !whHistMap[h.barcode] && h.updated_by) {
              whHistMap[h.barcode] = h.updated_by;
            }
          });
        }

        // Check store_inventory_history
        const { data: storeHist } = await supabase
          .from('store_inventory_history')
          .select('barcode_no, updated_by, updated_at')
          .eq('branch_id', selectedBranch)
          .in('barcode_no', uniqueCodes)
          .order('updated_at', { ascending: false })
          .limit(1000);

        const storeHistMap = {};
        if (storeHist) {
          storeHist.forEach(h => {
            if (h.barcode_no && !storeHistMap[h.barcode_no] && h.updated_by) {
              storeHistMap[h.barcode_no] = h.updated_by;
            }
          });
        }

        // Merge history fallback
        combined.forEach(item => {
          if (!item.updatedBy || item.updatedBy === '-' || item.updatedBy === 'Unknown') {
            if (item.source === 'warehouse' && whHistMap[item.barcode]) {
              item.updatedBy = whHistMap[item.barcode];
            } else if (item.source === 'store' && storeHistMap[item.barcode]) {
              item.updatedBy = storeHistMap[item.barcode];
            }
          }
        });
      }

      setRawData(combined);
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedBranch, scope]);

  // Analyze each barcode
  const analyzedList = useMemo(() => {
    return rawData.map(item => {
      const code = item.barcode;
      const issues = [];

      const trimmedName = (item.itemName || '').trim().toLowerCase();
      // Only flag as anomaly if the product description is a generic placeholder ('new item', 'n/a', or empty)
      const isPlaceholderName = !trimmedName || trimmedName === 'new item' || trimmedName === 'n/a';

      if (isPlaceholderName) {
        if (!code || code === '') {
          issues.push({ code: 'EMPTY', label: 'ບໍ່ມີບາໂຄ້ດ (ວ່າງເປົ່າ / ຫວ່າງ)' });
        } else {
          // Check non-numeric
          if (/\D/.test(code)) {
            const invalidChars = code.replace(/\d/g, '');
            issues.push({ code: 'NON_NUMERIC', label: `ມີຕົວອັກສອນ / ອັກຂະລະປົນ (${invalidChars})` });
          }
          // Check length != 13
          if (code.length !== 13) {
            if (code.length < 13) {
              issues.push({ code: 'LENGTH_MISMATCH', label: `ບາໂຄ້ດບໍ່ຄົບ 13 ຫຼັກ (ມີພຽງ ${code.length} ຫຼັກ)` });
            } else {
              issues.push({ code: 'LENGTH_MISMATCH', label: `ບາໂຄ້ດເກີນ 13 ຫຼັກ (ມີ ${code.length} ຫຼັກ)` });
            }
          }
        }
      }

      const isValid = issues.length === 0;

      return {
        ...item,
        isWhitelisted: !isPlaceholderName,
        issues,
        isValid,
        issueSummary: issues.length > 0 ? issues.map(i => i.label).join(' • ') : 'ປົກກະຕິ (ສິນຄ້າມີຊື່ແທ້)'
      };
    });
  }, [rawData]);

  // Filtered List
  const filteredList = useMemo(() => {
    return analyzedList.filter(item => {
      // Issue filter
      if (filterType === 'all_issues' && item.isValid) return false;
      if (filterType === 'not_13' && !item.issues.some(i => i.code === 'LENGTH_MISMATCH')) return false;
      if (filterType === 'contains_non_digits' && !item.issues.some(i => i.code === 'NON_NUMERIC')) return false;
      if (filterType === 'empty' && !item.issues.some(i => i.code === 'EMPTY')) return false;
      if (filterType === 'valid' && !item.isValid) return false;

      // Keyword search
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchCode = item.barcode.toLowerCase().includes(kw);
        const matchName = item.itemName.toLowerCase().includes(kw);
        const matchLoc = item.location.toLowerCase().includes(kw);
        if (!matchCode && !matchName && !matchLoc) return false;
      }

      return true;
    });
  }, [analyzedList, filterType, searchKeyword]);

  // Statistics counters
  const stats = useMemo(() => {
    let total = analyzedList.length;
    let validCount = 0;
    let not13Count = 0;
    let nonNumericCount = 0;
    let emptyCount = 0;

    analyzedList.forEach(item => {
      if (item.isValid) validCount++;
      if (item.issues.some(i => i.code === 'LENGTH_MISMATCH')) not13Count++;
      if (item.issues.some(i => i.code === 'NON_NUMERIC')) nonNumericCount++;
      if (item.issues.some(i => i.code === 'EMPTY')) emptyCount++;
    });

    const issuesTotal = total - validCount;

    return { total, validCount, not13Count, nonNumericCount, emptyCount, issuesTotal };
  }, [analyzedList]);

  // Export to Excel for branch audit
  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Suspicious Barcodes');

    // Headers
    worksheet.columns = [
      { header: 'Type / Scope', key: 'sourceLabel', width: 22 },
      { header: 'Branch', key: 'branch', width: 16 },
      { header: 'Barcode No', key: 'barcode', width: 22 },
      { header: 'Barcode Length', key: 'length', width: 16 },
      { header: 'Issue Detected', key: 'issueSummary', width: 36 },
      { header: 'Item Name', key: 'itemName', width: 36 },
      { header: 'Rack / Shelf Location', key: 'location', width: 24 },
      { header: 'Product Tag (ໜ້າຮ້ານ)', key: 'productTag', width: 20 },
      { header: 'Max Qty (ໜ້າຮ້ານ)', key: 'maxQty', width: 16 },
      { header: 'Current Qty', key: 'qty', width: 14 },
      { header: 'Updated By (ພະນັກງານແກ້ໄຂ)', key: 'updatedBy', width: 26 },
    ];

    // Style Header Row
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };

    filteredList.forEach(item => {
      worksheet.addRow({
        sourceLabel: item.sourceLabel,
        branch: item.branch,
        barcode: item.barcode || '(Empty)',
        length: item.barcode.length,
        issueSummary: item.issueSummary || 'Valid',
        itemName: item.itemName,
        location: item.location,
        productTag: item.productTag || '-',
        maxQty: item.maxQty ?? '-',
        qty: item.qty,
        updatedBy: item.updatedBy || '-'
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Barcode_Audit_${selectedBranch}_${scope}.xlsx`);
  };

  // Copy list to clipboard
  const handleCopyBarcodes = () => {
    const text = filteredList.map(i => `${i.barcode}\t${i.location}\t${i.itemName}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar Header */}
      <header className="px-6 py-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Return"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide">
                Barcode &amp; Inventory Integrity Inspector
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                AUDIT ENGINE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Audit invalid, malformed, or non-13 digit barcodes across warehouse and store front inventories.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleCopyBarcodes}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied!' : 'Copy List'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export Excel</span>
          </button>
        </div>
      </header>

      {/* Main Container - Full Screen Width */}
      <div className="p-6 w-full space-y-6 flex-1 flex flex-col">
        {/* Filters Toolbar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-sm">
          {/* Branch Picker */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Building2 size={13} className="text-cyan-400" />
              Target Branch (ເລືອກສາຂາ)
            </label>
            <div className="relative">
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full h-10 px-3 pr-8 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white font-medium focus:border-cyan-400 focus:outline-none appearance-none cursor-pointer"
              >
                {BRANCH_OPTIONS.map(b => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Scope Toggle */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Layers size={13} className="text-cyan-400" />
              Inventory Scope (ສາງ / ໜ້າຮ້ານ)
            </label>
            <div className="flex h-10 p-1 rounded-lg bg-slate-950 border border-slate-700">
              <button
                onClick={() => setScope('both')}
                className={`flex-1 text-xs font-medium rounded-md transition-all ${
                  scope === 'both' ? 'bg-slate-800 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                All (ທັງສອງ)
              </button>
              <button
                onClick={() => setScope('warehouse')}
                className={`flex-1 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                  scope === 'warehouse' ? 'bg-slate-800 text-cyan-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Warehouse size={13} />
                <span>ສາງ</span>
              </button>
              <button
                onClick={() => setScope('store')}
                className={`flex-1 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1 ${
                  scope === 'store' ? 'bg-slate-800 text-amber-300 font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Store size={13} />
                <span>ໜ້າຮ້ານ</span>
              </button>
            </div>
          </div>

          {/* Search Box */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Search size={13} className="text-cyan-400" />
              Search Filter
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search Barcode, Name, Location..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
              />
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            </div>
          </div>
        </div>

        {/* Statistical Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => setFilterType('all_issues')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterType === 'all_issues'
                ? 'bg-rose-950/40 border-rose-500 ring-1 ring-rose-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 uppercase">ລວມທີ່ຜິດປົກກະຕິ</div>
            <div className="text-xl font-bold text-rose-400 mt-1">{stats.issuesTotal}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ຕ້ອງໄດ້ກວດສອບ</div>
          </button>

          <button
            onClick={() => setFilterType('not_13')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterType === 'not_13'
                ? 'bg-amber-950/40 border-amber-500 ring-1 ring-amber-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 uppercase">ບໍ່ຄົບ 13 ຫຼັກ</div>
            <div className="text-xl font-bold text-amber-400 mt-1">{stats.not13Count}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ສັ້ນ ຫຼື ຍາວເກີນໄປ</div>
          </button>

          <button
            onClick={() => setFilterType('contains_non_digits')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterType === 'contains_non_digits'
                ? 'bg-purple-950/40 border-purple-500 ring-1 ring-purple-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 uppercase">ມີຕົວອັກສອນປົນ</div>
            <div className="text-xl font-bold text-purple-400 mt-1">{stats.nonNumericCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ມີຕົວໜັງສື/ສັນຍາລັກ</div>
          </button>

          <button
            onClick={() => setFilterType('empty')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterType === 'empty'
                ? 'bg-red-950/40 border-red-500 ring-1 ring-red-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 uppercase">ບໍ່ມີບາໂຄ້ດ</div>
            <div className="text-xl font-bold text-red-400 mt-1">{stats.emptyCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ຄ່າວ່າງເປົ່າ (Null)</div>
          </button>

          <button
            onClick={() => setFilterType('valid')}
            className={`p-3 rounded-xl border text-left transition-all ${
              filterType === 'valid'
                ? 'bg-emerald-950/40 border-emerald-500 ring-1 ring-emerald-500'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="text-[10px] font-mono text-slate-400 uppercase">ຖືກຕ້ອງ 13 ຫຼັກ</div>
            <div className="text-xl font-bold text-emerald-400 mt-1">{stats.validCount}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">ມາດຕະຖານ EAN-13</div>
          </button>

          <div className="p-3 rounded-xl border bg-slate-900 border-slate-800">
            <div className="text-[10px] font-mono text-slate-400 uppercase">Total Inspected</div>
            <div className="text-xl font-bold text-slate-200 mt-1">{stats.total}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">Rows in {selectedBranch}</div>
          </div>
        </div>

        {/* Results Table */}
        <div className="flex-1 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col shadow-lg">
          {/* Table Header Controls */}
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Showing</span>
              <span className="font-mono font-bold text-white">{filteredList.length}</span>
              <span>items</span>
              {filterType !== 'all_issues' && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                  Filter: {filterType}
                </span>
              )}
            </div>
            <div className="text-[11px] font-mono text-slate-500">
              Auto-Audit Protocol active
            </div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-auto max-h-[600px]">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw size={24} className="animate-spin text-cyan-400" />
                <p className="text-sm font-mono">Auditing database records for {selectedBranch}...</p>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-500">
                <CheckCircle2 size={32} className="text-emerald-500/80" />
                <p className="text-sm font-medium text-slate-300">No matching barcode anomalies found.</p>
                <p className="text-xs">All records under current criteria passed validation.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-slate-400 font-mono">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4 w-28">Source</th>
                    <th className="py-3 px-4 w-44">Barcode</th>
                    <th className="py-3 px-4 w-20 text-center">ຫຼັກ</th>
                    <th className="py-3 px-4 w-56">ລາຍລະອຽດທີ່ຜິດປົກກະຕິ (Detected Anomaly)</th>
                    <th className="py-3 px-4 min-w-[200px]">ຊື່ສິນຄ້າ (Item Description)</th>
                    <th className="py-3 px-4 w-28">ພິກັດ (Location)</th>
                    <th className="py-3 px-4 w-28">Tag (ໜ້າຮ້ານ)</th>
                    <th className="py-3 px-4 w-20 text-center">Max Qty</th>
                    <th className="py-3 px-4 w-20 text-right">ຈຳນວນ</th>
                    <th className="py-3 px-4 w-36">ແກ້ໄຂລ່າສຸດໂດຍ (Updated By)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredList.map((item, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-800/50 transition-colors group"
                    >
                      <td className="py-2.5 px-4 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>

                      {/* Source badge */}
                      <td className="py-2.5 px-4 font-mono">
                        {item.source === 'warehouse' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-cyan-950/60 text-cyan-300 border border-cyan-800/50">
                            <Warehouse size={11} />
                            <span>ສາງ</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-950/60 text-amber-300 border border-amber-800/50">
                            <Store size={11} />
                            <span>ໜ້າຮ້ານ</span>
                          </span>
                        )}
                      </td>

                      {/* Barcode */}
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-200">
                        {item.barcode ? (
                          <span className={item.isValid ? 'text-slate-300' : 'text-rose-300 bg-rose-950/40 px-1.5 py-0.5 rounded border border-rose-800/40'}>
                            {item.barcode}
                          </span>
                        ) : (
                          <span className="text-red-400 italic font-mono">(ຫວ່າງເປົ່າ / Null)</span>
                        )}
                      </td>

                      {/* Length */}
                      <td className="py-2.5 px-4 text-center font-mono">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          item.barcode.length === 13
                            ? 'text-slate-400'
                            : 'text-amber-400 bg-amber-950/60 font-bold'
                        }`}>
                          {item.barcode.length}
                        </span>
                      </td>

                      {/* Detected Issues */}
                      <td className="py-2.5 px-4">
                        {item.isValid ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                            <CheckCircle2 size={12} />
                            <span>
                              {item.isWhitelisted && item.barcode.length !== 13
                                ? 'ສິນຄ້າມີຊື່ແທ້ (ບາໂຄ້ດສະເພາະ)'
                                : 'ປົກກະຕິ (ຖືກຕ້ອງ 13 ຫຼັກ)'}
                            </span>
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {item.issues.map((iss, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[11px] text-rose-300"
                              >
                                <AlertTriangle size={11} className="text-rose-400 shrink-0" />
                                <span>{iss.label}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Item Name */}
                      <td className="py-2.5 px-4 text-slate-200 max-w-[300px] truncate" title={item.itemName}>
                        {item.itemName}
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-4 font-mono text-cyan-300">
                        {item.location}
                      </td>

                      {/* Product Tag */}
                      <td className="py-2.5 px-4">
                        {item.productTag && item.productTag !== '-' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 text-purple-300 border border-purple-800/40">
                            {item.productTag}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-[11px]">-</span>
                        )}
                      </td>

                      {/* Max Qty */}
                      <td className="py-2.5 px-4 text-center font-mono text-slate-300">
                        {item.maxQty !== '-' ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 text-[11px]">
                            {item.maxQty}
                          </span>
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Qty */}
                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-slate-200">
                        {item.qty}
                      </td>

                      {/* Updated By */}
                      <td className="py-2.5 px-4">
                        {item.updatedBy && item.updatedBy !== '-' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] bg-slate-800 text-slate-200 border border-slate-700 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                            {item.updatedBy}
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
