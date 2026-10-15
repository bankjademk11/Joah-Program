import React, { useState, useEffect, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  CheckCircle2, AlertCircle, ArrowUpCircle, Clock, HelpCircle,
  Loader2, RefreshCw, Filter, Search, BarChart3, Building2, Calendar,
  ChevronLeft, ChevronRight, Download, FileSpreadsheet
} from 'lucide-react';
import joahLogo from '../../../assets/favicon-full-transparent.png';
import { fetchStockCountForBranchDate, buildReconciliationRows } from '../services/reconcileService';

// ─── Status Config ─────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  OK: { label: 'Matched (OK)', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-800' },
  SHORT: { label: 'LESS', icon: AlertCircle, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
  OVER: { label: 'OVER', icon: ArrowUpCircle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  NOT_COUNTED: { label: 'Not Counted', icon: Clock, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-500' },
  EXTRA: { label: '(Not in RO)', icon: HelpCircle, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
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
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 50;

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

  const roReference = ro?.fullReference || ro?.roNumber || null;

  const loadReconcile = async () => {
    if (!branch || !date || !ro?.items?.length) return;
    setIsLoading(true);
    setError('');
    try {
      const stockCounts = await fetchStockCountForBranchDate(branch, date, roReference);
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
  }, [ro?.id, branch, date, roReference]);

  const [isExporting, setIsExporting] = useState(false);

  // ─── Export to Multi-Sheet Excel (Thai) with Joah Logo & Black-Border Grid ──
  const exportToExcel = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Joah Warehouse Validator';
      workbook.created = new Date();

      // ── Embed Joah Logo Buffer Once ──
      let logoId = null;
      try {
        const res = await fetch(joahLogo);
        const buf = await res.arrayBuffer();
        logoId = workbook.addImage({ buffer: buf, extension: 'png' });
      } catch (err) {
        console.warn('Could not load logo for Excel report:', err);
      }

      const FONT_TH = 'TH Sarabun New';
      const BLACK = 'FF000000';
      const THIN_BLACK = { style: 'thin', color: { argb: BLACK } };
      const MEDIUM_BLACK = { style: 'medium', color: { argb: BLACK } };
      const THICK_BLACK = { style: 'thick', color: { argb: BLACK } };

      // ── Sheet Builder Helper ──
      const addReconcileSheet = ({
        sheetName,
        tabColor,
        headerBgColor = 'FF4338CA',
        titleText = 'RO Goods Receiving Reconciliation Report',
        dataList = []
      }) => {
        const ws = workbook.addWorksheet(sheetName, {
          views: [{ showGridLines: true }]
        });

        if (tabColor) {
          ws.properties.tabColor = { argb: tabColor };
        }

        // Configure Column Widths (NO 'header' property to prevent row 1 overwrite)
        ws.columns = [
          { key: 'index', width: 8 },
          { key: 'barcode', width: 22 },
          { key: 'productName', width: 42 },
          { key: 'roQty', width: 18 },
          { key: 'countedQty', width: 22 },
          { key: 'diff', width: 16 },
          { key: 'status', width: 20 },
        ];

        // Explicit Row Heights
        ws.getRow(1).height = 26;
        ws.getRow(2).height = 20;
        ws.getRow(3).height = 22;
        ws.getRow(4).height = 22;
        ws.getRow(5).height = 26;
        ws.getRow(6).height = 12; // spacer row

        // Dedicated Logo Box (A1:B4)
        ws.mergeCells('A1:B4');
        const logoBox = ws.getCell('A1');
        logoBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };

        if (logoId !== null) {
          ws.addImage(logoId, {
            tl: { col: 0.25, row: 0.18 },
            ext: { width: 88, height: 88 },
            editAs: 'oneCell'
          });
        }

        // Report Title & Subtitle (C1:G2)
        ws.mergeCells('C1:G1');
        const titleCell = ws.getCell('C1');
        titleCell.value = titleText;
        titleCell.font = { name: FONT_TH, size: 18, bold: true, color: { argb: 'FF1E293B' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells('C2:G2');
        const subTitleCell = ws.getCell('C2');
        subTitleCell.value = 'JOAH Home & Living  •  Warehouse & Branch Stock Validator';
        subTitleCell.font = { name: FONT_TH, size: 12, italic: true, color: { argb: 'FF64748B' } };
        subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // RO Metadata (C3:G4)
        ws.mergeCells('C3:D3');
        const roCell = ws.getCell('C3');
        roCell.value = `RO No.: ${ro?.roNumber || roReference || '-'}`;
        roCell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FF4338CA' } };
        roCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells('E3:G3');
        const dateCell = ws.getCell('E3');
        dateCell.value = `Delivery Date: ${date || rawDate || '-'}`;
        dateCell.font = { name: FONT_TH, size: 13, color: { argb: 'FF334155' } };
        dateCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells('C4:D4');
        const branchCell = ws.getCell('C4');
        branchCell.value = `Branch: ${branch || '-'}`;
        branchCell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FF0F172A' } };
        branchCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells('E4:G4');
        const refCell = ws.getCell('E4');
        refCell.value = `RO Reference: ${roReference || '-'}`;
        refCell.font = { name: FONT_TH, size: 12, italic: true, color: { argb: 'FF64748B' } };
        refCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Summary KPI Ribbon (Row 5: A5 to G5)
        ws.mergeCells('A5:G5');
        const sumCell = ws.getCell('A5');
        const sheetRoQty = dataList.reduce((acc, r) => acc + (Number(r.roQty) || 0), 0);
        const sheetCountedQty = dataList.reduce((acc, r) => acc + (Number(r.countedQty) || 0), 0);
        const sheetDiff = sheetCountedQty - sheetRoQty;
        const sheetDiffSign = sheetDiff >= 0 ? '+' : '';

        sumCell.value = `  Summary: ${dataList.length} items | RO Qty: ${sheetRoQty.toLocaleString()} | Received: ${sheetCountedQty.toLocaleString()} (Diff: ${sheetDiffSign}${sheetDiff.toLocaleString()})   [ Overall: Total ${stats.totalRows} | Matched: ${stats.OK} | Short: ${stats.SHORT} | Over: ${stats.OVER} | Uncounted: ${stats.NOT_COUNTED}${stats.EXTRA > 0 ? ` | Extra: ${stats.EXTRA}` : ''} ]`;
        sumCell.font = { name: FONT_TH, size: 12, bold: true, color: { argb: 'FF1E293B' } };
        sumCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EDF5' } };
        sumCell.alignment = { vertical: 'middle', horizontal: 'left' };
        sumCell.border = {
          top: MEDIUM_BLACK,
          bottom: MEDIUM_BLACK,
          left: THIN_BLACK,
          right: THIN_BLACK,
        };

        // Table Column Headers (Row 7)
        const tableHeaders = [
          'No.',
          'Barcode',
          'Product Name',
          'RO Qty (DC Sent)',
          'Received Qty (Counted)',
          'Variance (Diff)',
          'Status',
        ];

        const headerRow = ws.getRow(7);
        headerRow.values = tableHeaders;
        headerRow.height = 32;

        headerRow.eachCell((cell) => {
          cell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBgColor } };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.border = {
            top: THICK_BLACK,
            bottom: THICK_BLACK,
            left: MEDIUM_BLACK,
            right: MEDIUM_BLACK,
          };
        });

        // Add Data Rows (Row 8+)
        dataList.forEach((r, idx) => {
          const roVal = Number(r.roQty) || 0;
          const countedVal = r.countedQty !== null && r.countedQty !== undefined ? Number(r.countedQty) : 0;
          const diffVal = r.diff !== null && r.diff !== undefined ? Number(r.diff) : 0;
          const statusLabel = STATUS_CONFIG[r.status]?.label || r.status;

          const row = ws.addRow([
            idx + 1,
            r.barcode,
            r.productName || '-',
            roVal,
            countedVal,
            diffVal,
            statusLabel
          ]);

          row.height = 24;

          // Status colors
          let bgArgb = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';
          let statusColor = 'FF64748B';

          if (r.status === 'OK') {
            bgArgb = idx % 2 === 0 ? 'FFF0FDF4' : 'FFE7F9EE'; // light green
            statusColor = 'FF15803D';
          } else if (r.status === 'SHORT') {
            bgArgb = idx % 2 === 0 ? 'FFFFF1F2' : 'FFFFE4E6'; // light red
            statusColor = 'FFE11D48';
          } else if (r.status === 'OVER') {
            bgArgb = idx % 2 === 0 ? 'FFFFFBEB' : 'FFFEF3C7'; // light amber
            statusColor = 'FFB45309';
          } else if (r.status === 'EXTRA') {
            bgArgb = idx % 2 === 0 ? 'FFFAF5FF' : 'FFF3E8FF'; // light purple
            statusColor = 'FF7E22CE';
          } else if (r.status === 'NOT_COUNTED') {
            bgArgb = idx % 2 === 0 ? 'FFF8FAFC' : 'FFF1F5F9'; // slate
            statusColor = 'FF64748B';
          }

          row.eachCell((cell, colNum) => {
            cell.font = { name: FONT_TH, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgArgb } };
            cell.border = {
              top: THIN_BLACK,
              bottom: THIN_BLACK,
              left: THIN_BLACK,
              right: THIN_BLACK,
            };

            if (colNum === 1) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colNum === 2) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: 'Consolas', size: 10, bold: true };
            } else if (colNum === 3) {
              cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            } else if (colNum === 4 || colNum === 5) {
              // Real numbers with thousands formatting
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.numFmt = '#,##0';
              cell.font = { name: 'Consolas', size: 10 };
            } else if (colNum === 6) {
              // Real number with +/- indicator
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.numFmt = '+#,##0;-#,##0;0';
              cell.font = {
                name: 'Consolas',
                size: 10,
                bold: true,
                color: { argb: diffVal === 0 ? 'FF15803D' : diffVal > 0 ? 'FFB45309' : 'FFE11D48' }
              };
            } else if (colNum === 7) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: FONT_TH, size: 12, bold: true, color: { argb: statusColor } };
            }
          });
        });

        // Total Summary Row
        const totalRow = ws.addRow([
          '',
          'Grand Total',
          `${dataList.length} items`,
          sheetRoQty,
          sheetCountedQty,
          sheetDiff,
          ''
        ]);
        totalRow.height = 30;
        totalRow.eachCell((cell, colNum) => {
          cell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FF0F172A' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1D5DB' } };
          cell.border = {
            top: THICK_BLACK,
            bottom: THICK_BLACK,
            left: MEDIUM_BLACK,
            right: MEDIUM_BLACK,
          };
          if (colNum === 4 || colNum === 5) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 6) {
            cell.numFmt = '+#,##0;-#,##0;0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Consolas',
              size: 11,
              bold: true,
              color: { argb: sheetDiff === 0 ? 'FF15803D' : sheetDiff > 0 ? 'FFB45309' : 'FFE11D48' }
            };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: colNum === 2 || colNum === 3 ? 'left' : 'center' };
          }
        });
      };

      // ── Create Multiple Status Sheets ──
      // 1. All Items
      addReconcileSheet({
        sheetName: `All Items (${rows.length})`,
        tabColor: 'FF4338CA',
        headerBgColor: 'FF4338CA',
        titleText: 'RO Goods Receiving Reconciliation Report - All Items',
        dataList: rows
      });

      // 2. SHORT Items (Missing)
      const shortItems = rows.filter(r => r.status === 'SHORT');
      addReconcileSheet({
        sheetName: `Less  (${shortItems.length})`,
        tabColor: 'FFE11D48',
        headerBgColor: 'FFBE123C',
        titleText: 'Short / Missing Items (Less than RO Qty)',
        dataList: shortItems
      });

      // 3. OVER Items (Surplus)
      const overItems = rows.filter(r => r.status === 'OVER');
      addReconcileSheet({
        sheetName: `Over Items (${overItems.length})`,
        tabColor: 'FFD97706',
        headerBgColor: 'FFB45309',
        titleText: 'Over Received Items (More than RO Qty)',
        dataList: overItems
      });

      // 4. Uncounted Items
      const uncountedItems = rows.filter(r => r.status === 'NOT_COUNTED');
      addReconcileSheet({
        sheetName: `Uncounted (${uncountedItems.length})`,
        tabColor: 'FF64748B',
        headerBgColor: 'FF475569',
        titleText: 'Items Not Yet Counted (Uncounted)',
        dataList: uncountedItems
      });

      // 5. Matched OK Items
      const okItems = rows.filter(r => r.status === 'OK');
      addReconcileSheet({
        sheetName: `Matched OK (${okItems.length})`,
        tabColor: 'FF16A34A',
        headerBgColor: 'FF15803D',
        titleText: 'Matched Items - Quantity Correct (OK)',
        dataList: okItems
      });

      // 6. Extra Items (If any)
      const extraItems = rows.filter(r => r.status === 'EXTRA');
      if (extraItems.length > 0) {
        addReconcileSheet({
          sheetName: `Not PO (${extraItems.length})`,
          tabColor: 'FF9333EA',
          headerBgColor: 'FF7E22CE',
          titleText: 'Extra Items - Not in RO (Received but not ordered)',
          dataList: extraItems
        });
      }

      // ── Generate and Download File ──
      const cleanRo = (ro?.roNumber || roReference || 'RO').replace(/[\/\\?%*:|"<>]/g, '_');
      const cleanBranch = (branch || 'Branch').replace(/[\/\\?%*:|"<>]/g, '_');
      const fileName = `RO_Reconcile_${cleanBranch}_${cleanRo}_${date || 'Date'}.xlsx`;

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export Excel:', err);
      alert('ไม่สามารถสร้าง Excel ได้: ' + (err.message || ''));
    } finally {
      setIsExporting(false);
    }
  };

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
    setCurrentPage(1); // reset to page 1 when filter changes
    return rows.filter(r => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return r.barcode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [rows, statusFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

          <div className="flex items-center gap-2 shrink-0">
            {rows.length > 0 && (
              <button
                onClick={exportToExcel}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm hover:shadow"
                title="Export Excel ລາຍງານກວດຮັບ"
              >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </button>
            )}

            <button
              onClick={loadReconcile}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
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
        <div className="bg-white/80 rounded-2xl p-12 text-center border border-slate-100 animate-in fade-in">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600">Fetching Stock Count from Supabase...</p>
          <p className="text-xs text-slate-400 mt-1">Collecting all pages of data, please wait</p>
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
                <th className="py-3 px-4 text-center">RO QTY<br /><span className="text-[9px] font-medium normal-case">(DC Sent)</span></th>
                <th className="py-3 px-4 text-center">Counted<br /><span className="text-[9px] font-medium normal-case">(Stock Count)</span></th>
                <th className="py-3 px-4 text-center">Diff<br /><span className="text-[9px] font-medium normal-case">(Variance)</span></th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredRows.length > 0 ? (
                paginatedRows.map((row, idx) => {
                  const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.NOT_COUNTED;
                  const globalIdx = (safePage - 1) * PAGE_SIZE + idx;
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
                })
              ) : (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs font-bold">No matching items</td></tr>
              )}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length} items
              {statusFilter !== 'ALL' || searchQuery ? (
                <span className="ml-2 text-indigo-400 font-bold">(filtered — <button className="underline cursor-pointer" onClick={() => { setStatusFilter('ALL'); setSearchQuery(''); }}>Clear</button>)</span>
              ) : null}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-3 py-1 text-xs font-black text-slate-700">
                Page {safePage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
