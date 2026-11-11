import React, { useState, useEffect, useMemo, useRef } from 'react';
import ExcelJS from 'exceljs';
import {
  CheckCircle2, AlertCircle, ArrowUpCircle, Clock, HelpCircle,
  Loader2, RefreshCw, Filter, Search, BarChart3, Building2, Calendar,
  ChevronLeft, ChevronRight, Download, FileSpreadsheet,
  ArrowRightLeft, RotateCcw, Check, X, Sparkles, History,
  Lock, ShieldCheck, Delete, MoreVertical
} from 'lucide-react';
import joahLogo from '../../../assets/favicon-full-transparent.png';
import { getProductImageFallbacks } from '../../../utils/productImageUtils';
import {
  fetchStockCountForBranchDate,
  buildReconciliationRows,
  transferExtraItemsToRO,
  rollbackROTransfer,
  getTransferHistory,
  normalizeRoDate
} from '../services/reconcileService';

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
export default function ROReconcileView({ ro, roList = [], onTransferComplete }) {
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
  const date = React.useMemo(() => normalizeRoDate(rawDate), [rawDate]);

  // Map barcode -> productName & matching RO bills (ONLY same branch & same date)
  const globalCatalog = useMemo(() => {
    const nameMap = new Map();
    const roOwnersMap = new Map(); // barcode -> array of { id, roNumber, storeCode }
    const normBranch = (branch || '').trim().toLowerCase();

    (roList || []).forEach(order => {
      const isSameBranch = (order.storeCode || '').trim().toLowerCase() === normBranch;
      const isSameDate = normalizeRoDate(order.deliveryDate) === date;

      (order.items || []).forEach(it => {
        if (it.barcode && it.productName && !nameMap.has(it.barcode)) {
          nameMap.set(it.barcode, it.productName);
        }
        if (it.barcode && order.id !== ro?.id && isSameBranch && isSameDate) {
          if (!roOwnersMap.has(it.barcode)) {
            roOwnersMap.set(it.barcode, []);
          }
          roOwnersMap.get(it.barcode).push({
            id: order.id,
            roNumber: order.roNumber || order.fullReference,
            storeCode: order.storeCode
          });
        }
      });
    });
    return { nameMap, roOwnersMap };
  }, [roList, ro?.id, branch, date]);

  const roReference = ro?.fullReference || ro?.roNumber || null;

  const loadReconcile = async () => {
    if (!branch || !date || !ro?.items?.length) return;
    setIsLoading(true);
    setError('');
    try {
      const stockCounts = await fetchStockCountForBranchDate(branch, date, roReference);
      const reconciled = buildReconciliationRows(ro.items, stockCounts).map(r => ({
        ...r,
        productName: r.productName || globalCatalog.nameMap.get(r.barcode) || null
      }));
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
  const [exportProgress, setExportProgress] = useState('');

  // ─── Helper: Fetch & normalize product image for ExcelJS (handles png/jpg/webp & shrinks size) ──
  const fetchProductImageForExcel = async (barcode) => {
    const cleanCode = String(barcode || '').trim();
    if (!cleanCode || cleanCode === '-') return null;

    const urls = getProductImageFallbacks(cleanCode);
    for (const imgUrl of urls) {
      try {
        const res = await fetch(imgUrl);
        if (!res.ok) continue;

        const blob = await res.blob();
        try {
          const bitmap = await createImageBitmap(blob);
          const MAX_SIZE = 160;
          const scale = Math.min(MAX_SIZE / bitmap.width, MAX_SIZE / bitmap.height, 1);
          const targetW = Math.max(1, Math.round(bitmap.width * scale));
          const targetH = Math.max(1, Math.round(bitmap.height * scale));

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, targetW, targetH);
          ctx.drawImage(bitmap, 0, 0, targetW, targetH);
          bitmap.close?.();

          const jpegBlob = await new Promise((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85)
          );
          if (jpegBlob) {
            const buf = await jpegBlob.arrayBuffer();
            return { buf, ext: 'jpeg', width: targetW, height: targetH };
          }
        } catch {
          const ext = imgUrl.split('.').pop().split('?')[0]?.toLowerCase();
          if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
            const buf = await blob.arrayBuffer();
            return { buf, ext: ext === 'jpg' ? 'jpeg' : ext, width: 64, height: 64 };
          }
        }
      } catch {
        // try next fallback extension
      }
    }
    return null;
  };

  // ─── Export to Multi-Sheet Excel (Thai) with Joah Logo & Black-Border Grid ──
  const exportToExcel = async () => {
    if (!rows.length) return;
    setIsExporting(true);
    setExportProgress('ກຳລັງຕຽມຂໍ້ມູນ...');
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

      // ── Categorize items by status ──
      const shortItems = rows.filter(r => r.status === 'SHORT');
      const overItems = rows.filter(r => r.status === 'OVER');
      const uncountedItems = rows.filter(r => r.status === 'NOT_COUNTED');
      const okItems = rows.filter(r => r.status === 'OK');
      const extraItems = rows.filter(r => r.status === 'EXTRA');

      // Image rules:
      // - Less (SHORT): Always attach images (unlimited)
      // - Over Items (OVER): Always attach images (unlimited)
      // - Uncounted (NOT_COUNTED): Attach images ONLY if <= 20 items; otherwise normal
      // - Not PO (EXTRA): Always attach images (unlimited)
      const includeUncountedImages = uncountedItems.length > 0 && uncountedItems.length <= 20;

      // ── Batch Fetch Unique Product Images ──
      const barcodesToFetch = new Set();
      shortItems.forEach(r => r.barcode && barcodesToFetch.add(r.barcode));
      overItems.forEach(r => r.barcode && barcodesToFetch.add(r.barcode));
      if (includeUncountedImages) {
        uncountedItems.forEach(r => r.barcode && barcodesToFetch.add(r.barcode));
      }
      extraItems.forEach(r => r.barcode && barcodesToFetch.add(r.barcode));

      const uniqueBarcodes = Array.from(barcodesToFetch);
      const imageCache = new Map();

      if (uniqueBarcodes.length > 0) {
        const CHUNK_SIZE = 10;
        for (let i = 0; i < uniqueBarcodes.length; i += CHUNK_SIZE) {
          const slice = uniqueBarcodes.slice(i, i + CHUNK_SIZE);
          setExportProgress(`ກຳລັງດຶງຮູບ (${Math.min(i + CHUNK_SIZE, uniqueBarcodes.length)}/${uniqueBarcodes.length})...`);
          const fetched = await Promise.all(slice.map(code => fetchProductImageForExcel(code)));
          slice.forEach((code, idx) => {
            const imgData = fetched[idx];
            if (imgData) {
              try {
                const imageId = workbook.addImage({
                  buffer: imgData.buf,
                  extension: imgData.ext,
                });
                imageCache.set(code, {
                  imageId,
                  width: imgData.width || 64,
                  height: imgData.height || 64,
                });
              } catch (err) {
                console.warn(`Could not register image for ${code}:`, err);
                imageCache.set(code, null);
              }
            } else {
              imageCache.set(code, null);
            }
          });
        }
      }

      setExportProgress('ກຳລັງສ້າງໄຟລ໌ Excel...');

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
        dataList = [],
        includeImages = false
      }) => {
        const ws = workbook.addWorksheet(sheetName, {
          views: [{ showGridLines: true }]
        });

        if (tabColor) {
          ws.properties.tabColor = { argb: tabColor };
        }

        const lastCol = includeImages ? 'H' : 'G';
        const offset = includeImages ? 1 : 0;

        // Configure Column Widths (NO 'header' property to prevent row 1 overwrite)
        ws.columns = includeImages
          ? [
              { key: 'index', width: 8 },
              { key: 'image', width: 14 },
              { key: 'barcode', width: 22 },
              { key: 'productName', width: 42 },
              { key: 'roQty', width: 18 },
              { key: 'countedQty', width: 22 },
              { key: 'diff', width: 16 },
              { key: 'status', width: 20 },
            ]
          : [
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

        // Report Title & Subtitle (C1:G/H2)
        ws.mergeCells(`C1:${lastCol}1`);
        const titleCell = ws.getCell('C1');
        titleCell.value = titleText;
        titleCell.font = { name: FONT_TH, size: 18, bold: true, color: { argb: 'FF1E293B' } };
        titleCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells(`C2:${lastCol}2`);
        const subTitleCell = ws.getCell('C2');
        subTitleCell.value = 'JOAH Home & Living  •  Warehouse & Branch Stock Validator';
        subTitleCell.font = { name: FONT_TH, size: 12, italic: true, color: { argb: 'FF64748B' } };
        subTitleCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // RO Metadata (C3:G/H4)
        ws.mergeCells('C3:D3');
        const roCell = ws.getCell('C3');
        roCell.value = `RO No.: ${ro?.roNumber || roReference || '-'}`;
        roCell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FF4338CA' } };
        roCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells(`E3:${lastCol}3`);
        const dateCell = ws.getCell('E3');
        dateCell.value = `Delivery Date: ${date || rawDate || '-'}`;
        dateCell.font = { name: FONT_TH, size: 13, color: { argb: 'FF334155' } };
        dateCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells('C4:D4');
        const branchCell = ws.getCell('C4');
        branchCell.value = `Branch: ${branch || '-'}`;
        branchCell.font = { name: FONT_TH, size: 13, bold: true, color: { argb: 'FF0F172A' } };
        branchCell.alignment = { vertical: 'middle', horizontal: 'left' };

        ws.mergeCells(`E4:${lastCol}4`);
        const refCell = ws.getCell('E4');
        refCell.value = `RO Reference: ${roReference || '-'}`;
        refCell.font = { name: FONT_TH, size: 12, italic: true, color: { argb: 'FF64748B' } };
        refCell.alignment = { vertical: 'middle', horizontal: 'left' };

        // Summary KPI Ribbon (Row 5: A5 to G/H5)
        ws.mergeCells(`A5:${lastCol}5`);
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
        const tableHeaders = includeImages
          ? [
              'No.',
              'Image',
              'Barcode',
              'Product Name',
              'RO Qty (DC Sent)',
              'Received Qty (Counted)',
              'Variance (Diff)',
              'Status',
            ]
          : [
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

          const rowValues = includeImages
            ? [
                idx + 1,
                '', // Thumbnail cell
                r.barcode,
                r.productName || '-',
                roVal,
                countedVal,
                diffVal,
                statusLabel,
              ]
            : [
                idx + 1,
                r.barcode,
                r.productName || '-',
                roVal,
                countedVal,
                diffVal,
                statusLabel,
              ];

          const row = ws.addRow(rowValues);
          row.height = includeImages ? 62 : 24;

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
            } else if (includeImages && colNum === 2) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (colNum === 2 + offset) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: 'Consolas', size: 10, bold: true };
            } else if (colNum === 3 + offset) {
              cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            } else if (colNum === 4 + offset || colNum === 5 + offset) {
              // Real numbers with thousands formatting
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.numFmt = '#,##0';
              cell.font = { name: 'Consolas', size: 10 };
            } else if (colNum === 6 + offset) {
              // Real number with +/- indicator
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.numFmt = '+#,##0;-#,##0;0';
              cell.font = {
                name: 'Consolas',
                size: 10,
                bold: true,
                color: { argb: diffVal === 0 ? 'FF15803D' : diffVal > 0 ? 'FFB45309' : 'FFE11D48' }
              };
            } else if (colNum === 7 + offset) {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { name: FONT_TH, size: 12, bold: true, color: { argb: statusColor } };
            }
          });

          // Embed product image in Column B when enabled
          if (includeImages) {
            const cachedImg = imageCache.get(r.barcode);
            if (cachedImg) {
              try {
                const boxMaxW = 76;
                const boxMaxH = 70;
                const ratio = Math.min(boxMaxW / cachedImg.width, boxMaxH / cachedImg.height);
                const drawW = Math.round(cachedImg.width * ratio);
                const drawH = Math.round(cachedImg.height * ratio);
                // Col B width = 14 (~103px), Row height = 62pt (~82px)
                const offsetX = Math.max(4, Math.floor((103 - drawW) / 2));
                const offsetY = Math.max(4, Math.floor((82 - drawH) / 2));

                ws.addImage(cachedImg.imageId, {
                  tl: {
                    nativeCol: 1,
                    nativeColOff: Math.floor(offsetX * 9525),
                    nativeRow: row.number - 1,
                    nativeRowOff: Math.floor(offsetY * 9525),
                  },
                  ext: { width: drawW, height: drawH },
                  editAs: 'oneCell'
                });
              } catch (err) {
                console.warn(`Failed to place image for ${r.barcode}:`, err);
              }
            } else {
              const imgCell = row.getCell(2);
              imgCell.value = '-';
              imgCell.alignment = { vertical: 'middle', horizontal: 'center' };
              imgCell.font = { name: FONT_TH, size: 11, color: { argb: 'FF94A3B8' } };
            }
          }
        });

        // Total Summary Row
        const totalValues = includeImages
          ? [
              '',
              '',
              'Grand Total',
              `${dataList.length} items`,
              sheetRoQty,
              sheetCountedQty,
              sheetDiff,
              ''
            ]
          : [
              '',
              'Grand Total',
              `${dataList.length} items`,
              sheetRoQty,
              sheetCountedQty,
              sheetDiff,
              ''
            ];

        const totalRow = ws.addRow(totalValues);
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
          if (colNum === 4 + offset || colNum === 5 + offset) {
            cell.numFmt = '#,##0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (colNum === 6 + offset) {
            cell.numFmt = '+#,##0;-#,##0;0';
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.font = {
              name: 'Consolas',
              size: 11,
              bold: true,
              color: { argb: sheetDiff === 0 ? 'FF15803D' : sheetDiff > 0 ? 'FFB45309' : 'FFE11D48' }
            };
          } else {
            cell.alignment = {
              vertical: 'middle',
              horizontal: (colNum === 2 + offset || colNum === 3 + offset) ? 'left' : 'center'
            };
          }
        });
      };

      // ── Create Multiple Status Sheets ──
      // 1. All Items (normal, no images)
      addReconcileSheet({
        sheetName: `All Items (${rows.length})`,
        tabColor: 'FF4338CA',
        headerBgColor: 'FF4338CA',
        titleText: 'RO Goods Receiving Reconciliation Report - All Items',
        dataList: rows,
        includeImages: false
      });

      // 2. SHORT Items (Missing) -> Always attach images (unlimited)
      addReconcileSheet({
        sheetName: `Less  (${shortItems.length})`,
        tabColor: 'FFE11D48',
        headerBgColor: 'FFBE123C',
        titleText: 'Short / Missing Items (Less than RO Qty)',
        dataList: shortItems,
        includeImages: true
      });

      // 3. OVER Items (Surplus) -> Always attach images (unlimited)
      addReconcileSheet({
        sheetName: `Over Items (${overItems.length})`,
        tabColor: 'FFD97706',
        headerBgColor: 'FFB45309',
        titleText: 'Over Received Items (More than RO Qty)',
        dataList: overItems,
        includeImages: true
      });

      // 4. Uncounted Items -> Attach images only if <= 20 items, otherwise normal
      addReconcileSheet({
        sheetName: `Uncounted (${uncountedItems.length})`,
        tabColor: 'FF64748B',
        headerBgColor: 'FF475569',
        titleText: 'Items Not Yet Counted (Uncounted)',
        dataList: uncountedItems,
        includeImages: includeUncountedImages
      });

      // 5. Matched OK Items (normal, no images)
      addReconcileSheet({
        sheetName: `Matched OK (${okItems.length})`,
        tabColor: 'FF16A34A',
        headerBgColor: 'FF15803D',
        titleText: 'Matched Items - Quantity Correct (OK)',
        dataList: okItems,
        includeImages: false
      });

      // 6. Extra Items (Not PO) -> Always attach images (unlimited)
      if (extraItems.length > 0) {
        addReconcileSheet({
          sheetName: `Not PO (${extraItems.length})`,
          tabColor: 'FF9333EA',
          headerBgColor: 'FF7E22CE',
          titleText: 'Extra Items - Not in RO (Received but not ordered)',
          dataList: extraItems,
          includeImages: true
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
      alert('Failed to generate Excel: ' + (err.message || ''));
    } finally {
      setIsExporting(false);
      setExportProgress('');
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

  // ─── Transfer (Not in RO) & Rollback States ─────────────────────────────
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedExtraBarcodes, setSelectedExtraBarcodes] = useState(() => new Set());
  const [transferMode, setTransferMode] = useState('matched'); // 'matched' | 'all' | 'selected'
  const [targetRoId, setTargetRoId] = useState('');
  const [roSearchTerm, setRoSearchTerm] = useState('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferProgress, setTransferProgress] = useState('');
  const [transferHistory, setTransferHistory] = useState(() => getTransferHistory());
  const [lastCompletedTransfer, setLastCompletedTransfer] = useState(null);
  const [rollingBackId, setRollingBackId] = useState(null);

  // PIN Protection Gate (PIN: 248) for Move Not in RO & Rollback / History
  const TRANSFER_ACCESS_PIN = '248';
  const [isPinUnlocked, setIsPinUnlocked] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pendingPinAction, setPendingPinAction] = useState(null);
  const [pendingActionLabel, setPendingActionLabel] = useState('');
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef(null);

  useEffect(() => {
    setIsPinUnlocked(false);
    setIsActionsMenuOpen(false);
  }, [ro?.id]);

  useEffect(() => {
    if (!isActionsMenuOpen) return;
    const handleClickOutside = (event) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(event.target)) {
        setIsActionsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isActionsMenuOpen]);

  const requestPinThen = (actionFn, label = 'Protected Action') => {
    if (isPinUnlocked) {
      actionFn();
      return;
    }
    setPendingPinAction(() => actionFn);
    setPendingActionLabel(label);
    setPinInput('');
    setPinError('');
    setIsPinModalOpen(true);
  };

  const submitPin = (codeToCheck = pinInput) => {
    if (codeToCheck === TRANSFER_ACCESS_PIN) {
      setIsPinUnlocked(true);
      setIsPinModalOpen(false);
      setPinError('');
      const action = pendingPinAction;
      setPendingPinAction(null);
      setPinInput('');
      if (typeof action === 'function') {
        action();
      }
      return true;
    }
    setPinError('Incorrect PIN. Please try again.');
    setPinInput('');
    return false;
  };

  const handlePinDigitPress = (digit) => {
    if (pinInput.length >= 6) return;
    const next = pinInput + digit;
    setPinInput(next);
    setPinError('');
    if (next.length === TRANSFER_ACCESS_PIN.length) {
      submitPin(next);
    }
  };

  const extraRows = useMemo(() => rows.filter(r => r.status === 'EXTRA'), [rows]);

  // Candidate Target ROs: strictly same branch AND same upload/delivery date
  const candidateROs = useMemo(() => {
    const normBranch = (branch || '').trim().toLowerCase();

    return (roList || [])
      .filter(o => {
        if (o.id === ro?.id) return false;
        const isSameBranch = (o.storeCode || '').trim().toLowerCase() === normBranch;
        const isSameDate = normalizeRoDate(o.deliveryDate) === date;
        return isSameBranch && isSameDate;
      })
      .map(o => {
        const orderBarcodes = new Set((o.items || []).map(it => it.barcode));
        let matchedCount = 0;
        let matchedQty = 0;
        extraRows.forEach(er => {
          if (orderBarcodes.has(er.barcode)) {
            matchedCount += 1;
            matchedQty += Number(er.countedQty) || 0;
          }
        });
        return {
          ...o,
          orderBarcodes,
          matchedCount,
          matchedQty
        };
      })
      .sort((a, b) => {
        if (b.matchedCount !== a.matchedCount) return b.matchedCount - a.matchedCount;
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
  }, [roList, ro?.id, extraRows, branch, date]);

  const filteredCandidateROs = useMemo(() => {
    return candidateROs.filter(c => {
      if (roSearchTerm.trim()) {
        const q = roSearchTerm.toLowerCase();
        const name = (c.roNumber || c.fullReference || '').toLowerCase();
        return name.includes(q);
      }
      return true;
    });
  }, [candidateROs, roSearchTerm]);

  const selectedTargetRo = useMemo(
    () => candidateROs.find(c => String(c.id) === String(targetRoId)) || null,
    [candidateROs, targetRoId]
  );

  // Auto-select best target RO and appropriate mode when opening modal
  const openTransferModal = (initialMode = null) => {
    const bestCandidate = candidateROs[0] || null;
    if (bestCandidate && !targetRoId) {
      setTargetRoId(bestCandidate.id);
    }
    if (initialMode) {
      setTransferMode(initialMode);
    } else if (selectedExtraBarcodes.size > 0) {
      setTransferMode('selected');
    } else if (bestCandidate && bestCandidate.matchedCount > 0) {
      setTransferMode('matched');
    } else {
      setTransferMode('all');
    }
    setIsTransferModalOpen(true);
  };

  // Compute exact rows to be moved based on transferMode & selectedTargetRo
  const rowsToTransferPreview = useMemo(() => {
    if (!selectedTargetRo) return [];
    if (transferMode === 'matched') {
      return extraRows.filter(r => selectedTargetRo.orderBarcodes.has(r.barcode));
    }
    if (transferMode === 'selected') {
      return extraRows.filter(r => selectedExtraBarcodes.has(r.barcode));
    }
    return extraRows; // 'all'
  }, [selectedTargetRo, transferMode, extraRows, selectedExtraBarcodes]);

  const totalPreviewQty = useMemo(
    () => rowsToTransferPreview.reduce((sum, r) => sum + (Number(r.countedQty) || 0), 0),
    [rowsToTransferPreview]
  );

  const toggleSelectExtraBarcode = (barcode) => {
    setSelectedExtraBarcodes(prev => {
      const next = new Set(prev);
      if (next.has(barcode)) next.delete(barcode);
      else next.add(barcode);
      return next;
    });
  };

  const toggleSelectAllExtra = () => {
    if (selectedExtraBarcodes.size === extraRows.length) {
      setSelectedExtraBarcodes(new Set());
    } else {
      setSelectedExtraBarcodes(new Set(extraRows.map(r => r.barcode)));
    }
  };

  const handleConfirmTransfer = async () => {
    if (!selectedTargetRo || rowsToTransferPreview.length === 0) return;
    setIsTransferring(true);
    setTransferProgress('Starting transfer...');
    try {
      const record = await transferExtraItemsToRO({
        extraRowsToMove: rowsToTransferPreview,
        sourceRo: ro,
        sourceDate: date,
        targetRo: selectedTargetRo,
        onProgress: setTransferProgress
      });
      setTransferHistory(getTransferHistory());
      setLastCompletedTransfer(record);
      setSelectedExtraBarcodes(new Set());
      setIsTransferModalOpen(false);
      await loadReconcile();
      onTransferComplete?.();
    } catch (err) {
      console.error('Failed to transfer items:', err);
      alert('Failed to transfer items: ' + (err.message || ''));
    } finally {
      setIsTransferring(false);
      setTransferProgress('');
    }
  };

  const handleRollback = async (transferId) => {
    if (!transferId) return;
    setRollingBackId(transferId);
    setTransferProgress('Restoring items to original RO...');
    try {
      const updated = await rollbackROTransfer(transferId, setTransferProgress);
      setTransferHistory(updated);
      if (lastCompletedTransfer?.transferId === transferId) {
        setLastCompletedTransfer(prev => prev ? { ...prev, rolledBack: true } : null);
      }
      await loadReconcile();
      onTransferComplete?.();
    } catch (err) {
      console.error('Failed to rollback transfer:', err);
      alert('Failed to rollback transfer: ' + (err.message || ''));
    } finally {
      setRollingBackId(null);
      setTransferProgress('');
    }
  };

  const activeTransferCount = useMemo(
    () => transferHistory.filter(h => !h.rolledBack).length,
    [transferHistory]
  );

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

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {rows.length > 0 && (
              <button
                onClick={exportToExcel}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white hover:bg-emerald-700 transition cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm hover:shadow"
                title="Export Excel ລາຍງານກວດຮັບ"
              >
                {isExporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                {isExporting ? (exportProgress || 'Exporting...') : 'Export Excel'}
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

            {(stats.EXTRA > 0 || transferHistory.length > 0) && (
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                  title="More actions"
                  aria-label="More actions"
                >
                  <MoreVertical size={16} />
                </button>

                {isActionsMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 animate-in fade-in">
                    {stats.EXTRA > 0 && (
                      <button
                        type="button"
                        disabled={isTransferring}
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          requestPinThen(
                            () => openTransferModal(selectedExtraBarcodes.size > 0 ? 'selected' : null),
                            'Move Not in RO'
                          );
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 transition cursor-pointer disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowRightLeft size={14} className="text-slate-400" />
                          <span>Move Not in RO</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          {selectedExtraBarcodes.size > 0 ? `${selectedExtraBarcodes.size} sel` : stats.EXTRA}
                          {!isPinUnlocked && <Lock size={11} />}
                        </span>
                      </button>
                    )}

                    {transferHistory.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsActionsMenuOpen(false);
                          requestPinThen(() => setIsHistoryModalOpen(true), 'Rollback / History');
                        }}
                        className="w-full px-3.5 py-2.5 text-left text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2 transition cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <RotateCcw size={14} className="text-slate-400" />
                          <span>Rollback / History</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          {activeTransferCount}
                          {!isPinUnlocked && <Lock size={11} />}
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transfer Success + Instant Rollback Banner */}
      {lastCompletedTransfer && !lastCompletedTransfer.rolledBack && (
        <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-in fade-in">
          <div className="flex items-start sm:items-center gap-2.5 text-xs text-purple-900">
            <CheckCircle2 size={18} className="text-purple-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-black">Transfer completed!</span> Moved <strong className="font-mono">{lastCompletedTransfer.skuCount} SKUs ({lastCompletedTransfer.totalQty.toLocaleString()} pcs)</strong> to RO <strong className="underline">{lastCompletedTransfer.targetRoNumber}</strong> ({lastCompletedTransfer.targetBranch}).
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => requestPinThen(() => handleRollback(lastCompletedTransfer.transferId), 'Instant Rollback')}
              disabled={rollingBackId === lastCompletedTransfer.transferId}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {rollingBackId === lastCompletedTransfer.transferId ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <RotateCcw size={13} />
              )}
              <span>Instant Rollback</span>
            </button>
            <button
              onClick={() => setLastCompletedTransfer(null)}
              className="p-1.5 rounded-lg text-purple-400 hover:text-purple-700 hover:bg-purple-100 transition cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

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
                {statusFilter === 'EXTRA' && (
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={extraRows.length > 0 && selectedExtraBarcodes.size === extraRows.length}
                      onChange={toggleSelectAllExtra}
                      className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                      title="Select all"
                    />
                  </th>
                )}
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
                  const matchingROs = row.status === 'EXTRA' ? (globalCatalog.roOwnersMap.get(row.barcode) || []) : [];
                  const isChecked = selectedExtraBarcodes.has(row.barcode);

                  return (
                    <tr
                      key={row.barcode + idx}
                      onClick={() => {
                        if (statusFilter === 'EXTRA' && row.status === 'EXTRA') {
                          toggleSelectExtraBarcode(row.barcode);
                        }
                      }}
                      className={`transition ${cfg.bg} hover:brightness-95 ${statusFilter === 'EXTRA' ? 'cursor-pointer' : ''}`}
                    >
                      {statusFilter === 'EXTRA' && (
                        <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                          {row.status === 'EXTRA' && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectExtraBarcode(row.barcode)}
                              className="w-4 h-4 rounded accent-purple-600 cursor-pointer"
                            />
                          )}
                        </td>
                      )}
                      <td className="py-2.5 px-4 text-center text-xs text-slate-400 font-bold">{globalIdx + 1}</td>
                      <td className="py-2.5 px-4 font-mono text-xs font-black text-slate-700">{row.barcode}</td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 font-['Noto_Sans_Lao',sans-serif]">
                        <div>{row.productName || <span className="text-slate-300 italic">—</span>}</div>
                        {matchingROs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {matchingROs.slice(0, 2).map(m => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold"
                              >
                                🎯 Belongs to RO: {m.roNumber} ({m.storeCode})
                              </span>
                            ))}
                            {matchingROs.length > 2 && (
                              <span className="text-[10px] text-purple-500 font-bold">
                                +{matchingROs.length - 2} more
                              </span>
                            )}
                          </div>
                        )}
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
                <tr><td colSpan={statusFilter === 'EXTRA' ? 8 : 7} className="py-8 text-center text-slate-400 text-xs font-bold">No matching items</td></tr>
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

      {/* ─── TRANSFER (NOT IN RO) MODAL ────────────────────────────────────────── */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <ArrowRightLeft size={18} />
                  <span>Move (Not in RO) Items to Another RO</span>
                </h3>
                <p className="text-xs text-purple-200 mt-0.5">
                  Source RO: <strong>{ro.roNumber || ro.fullReference}</strong> ({branch}) • Total Not in RO items: {extraRows.length}
                </p>
              </div>
              <button
                onClick={() => !isTransferring && setIsTransferModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Step 1: Select Target RO */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    1. Select Target RO (Branch {branch} • Date {date})
                  </label>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-[11px] font-black text-indigo-700">
                    🏢 Branch {branch} • 📅 {date} ({candidateROs.length} ROs)
                  </span>
                </div>

                {/* Search Target RO */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <Search size={14} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search RO number in the same branch & upload date..."
                    value={roSearchTerm}
                    onChange={e => setRoSearchTerm(e.target.value)}
                    className="flex-1 text-xs bg-transparent outline-none text-slate-700 font-medium"
                  />
                  {roSearchTerm && (
                    <button onClick={() => setRoSearchTerm('')} className="text-slate-400 hover:text-slate-600">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Candidate RO List */}
                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                  {filteredCandidateROs.length > 0 ? (
                    filteredCandidateROs.map(c => {
                      const isSelected = String(c.id) === String(targetRoId);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setTargetRoId(c.id);
                            if (c.matchedCount > 0 && transferMode !== 'selected') {
                              setTransferMode('matched');
                            } else if (c.matchedCount === 0 && transferMode === 'matched') {
                              setTransferMode('all');
                            }
                          }}
                          className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200'
                              : 'bg-white border-slate-200 hover:border-purple-300'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-xs text-slate-800 truncate">
                                {c.roNumber || c.fullReference}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-700">
                                Branch: {c.storeCode}
                              </span>
                              <span className="text-[11px] text-slate-500 font-mono">
                                📅 {c.deliveryDate}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Items in RO: <strong>{(c.items || []).length} SKUs</strong> (RO Qty: {(c.totalRoQty || 0).toLocaleString()})
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {c.matchedCount > 0 ? (
                              <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black flex items-center gap-1">
                                <Sparkles size={12} className="text-emerald-600" />
                                Matches {c.matchedCount} SKUs ({c.matchedQty.toLocaleString()} pcs)
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-bold">
                                No matching SKUs
                              </span>
                            )}
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                              isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check size={12} />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400 font-bold">
                      No other ROs found for branch {branch} on {date}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Select Transfer Scope */}
              {selectedTargetRo && (
                <div className="space-y-2.5">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    2. Select Items to Move to {selectedTargetRo.roNumber || selectedTargetRo.fullReference}
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setTransferMode('matched')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        transferMode === 'matched'
                          ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 text-emerald-900'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center justify-between">
                        <span>🎯 Matched SKUs Only</span>
                        {transferMode === 'matched' && <Check size={14} className="text-emerald-600" />}
                      </div>
                      <div className="text-lg font-black font-mono mt-1 text-emerald-700">
                        {selectedTargetRo.matchedCount} <span className="text-xs font-sans font-normal">items</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Safest option (only moves barcodes present in target RO)
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferMode('all')}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        transferMode === 'all'
                          ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200 text-purple-900'
                          : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center justify-between">
                        <span>📦 All (Not in RO)</span>
                        {transferMode === 'all' && <Check size={14} className="text-purple-600" />}
                      </div>
                      <div className="text-lg font-black font-mono mt-1 text-purple-700">
                        {extraRows.length} <span className="text-xs font-sans font-normal">items</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Move all extra items from this RO to the target RO
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTransferMode('selected')}
                      disabled={selectedExtraBarcodes.size === 0}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedExtraBarcodes.size === 0
                          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                          : transferMode === 'selected'
                            ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 text-indigo-900 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 cursor-pointer'
                      }`}
                    >
                      <div className="text-xs font-black flex items-center justify-between">
                        <span>☑️ Selected in Table</span>
                        {transferMode === 'selected' && <Check size={14} className="text-indigo-600" />}
                      </div>
                      <div className="text-lg font-black font-mono mt-1 text-indigo-700">
                        {selectedExtraBarcodes.size} <span className="text-xs font-sans font-normal">items</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Move only barcodes checked in the table
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Summary Box */}
              {selectedTargetRo && (
                <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-bold">Transfer Summary:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <RotateCcw size={12} /> 100% Rollback Supported
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-800/90 p-3 rounded-xl border border-slate-700">
                    <div>
                      <div className="text-[10px] text-slate-400">From Source RO:</div>
                      <div className="font-black text-rose-300 truncate">{ro.roNumber || ro.fullReference} ({branch})</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">To Target RO:</div>
                      <div className="font-black text-emerald-300 truncate">
                        {selectedTargetRo.roNumber || selectedTargetRo.fullReference} ({selectedTargetRo.storeCode})
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span>Items to be moved:</span>
                    <span className="text-base font-black font-mono text-amber-300">
                      {rowsToTransferPreview.length} SKUs (Total {totalPreviewQty.toLocaleString()} pcs)
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-slate-500 font-bold">
                {isTransferring && (
                  <span className="flex items-center gap-1.5 text-purple-700">
                    <Loader2 size={14} className="animate-spin" />
                    {transferProgress}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isTransferring}
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTransferring || !selectedTargetRo || rowsToTransferPreview.length === 0}
                  onClick={handleConfirmTransfer}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-200 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isTransferring ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />}
                  <span>Confirm Transfer ({rowsToTransferPreview.length} SKUs)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── ROLLBACK / TRANSFER HISTORY MODAL ─────────────────────────────────── */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[85vh]">
            <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black flex items-center gap-2">
                  <History size={18} />
                  <span>RO Transfer History &amp; Rollback</span>
                </h3>
                <p className="text-xs text-amber-100 mt-0.5">
                  Click Rollback anytime to restore moved items back to their original source RO
                </p>
              </div>
              <button
                onClick={() => !rollingBackId && setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {transferHistory.length > 0 ? (
                transferHistory.map(item => (
                  <div
                    key={item.transferId}
                    className={`p-4 rounded-2xl border transition ${
                      item.rolledBack
                        ? 'bg-slate-50 border-slate-200 opacity-70'
                        : 'bg-white border-amber-200 shadow-sm'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-mono text-[10px] font-black">
                          {new Date(item.createdAt).toLocaleString('en-US')}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-black">
                          {item.skuCount} SKUs ({item.totalQty.toLocaleString()} pcs)
                        </span>
                      </div>

                      {item.rolledBack ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-200 text-slate-600 text-xs font-black">
                          <Check size={13} /> Rolled Back
                        </span>
                      ) : (
                        <button
                          onClick={() => handleRollback(item.transferId)}
                          disabled={rollingBackId !== null}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black shadow-sm transition cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          {rollingBackId === item.transferId ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <RotateCcw size={13} />
                          )}
                          <span>Rollback (Restore)</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-100">
                        <div className="text-[10px] text-rose-500 font-bold">From Source RO:</div>
                        <div className="font-black text-slate-800 truncate">{item.sourceRoNumber}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Branch: {item.sourceBranch} • Date: {item.sourceDate}
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
                        <div className="text-[10px] text-emerald-600 font-bold">To Target RO:</div>
                        <div className="font-black text-slate-800 truncate">{item.targetRoNumber}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Branch: {item.targetBranch} • Date: {item.targetDate}
                        </div>
                      </div>
                    </div>

                    {item.sampleBarcodes?.length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-500 font-mono truncate">
                        Sample barcodes: {item.sampleBarcodes.join(', ')}
                        {item.skuCount > item.sampleBarcodes.length ? ` ... (+${item.skuCount - item.sampleBarcodes.length})` : ''}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs font-bold">
                  No transfer history yet
                </div>
              )}
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-bold">
                {rollingBackId ? transferProgress : `Showing latest ${transferHistory.length} transfer records`}
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-black hover:bg-slate-700 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SECURITY PIN GATE MODAL (PIN: 248) ────────────────────────────────── */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-[100000] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100">
            <div className="bg-gradient-to-r from-slate-800 via-slate-900 to-indigo-950 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-amber-300">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black leading-tight">Security PIN Required</h3>
                  <p className="text-[11px] text-slate-300">{pendingActionLabel || 'Protected Action'}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsPinModalOpen(false);
                  setPendingPinAction(null);
                  setPinInput('');
                  setPinError('');
                }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPin();
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-slate-600 text-center font-medium">
                Enter the access PIN to continue using Transfer / Rollback controls.
              </p>

              {/* PIN Dots & Input */}
              <div className="space-y-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoFocus
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setPinInput(digits);
                    setPinError('');
                    if (digits.length === TRANSFER_ACCESS_PIN.length) {
                      submitPin(digits);
                    }
                  }}
                  placeholder="Enter PIN..."
                  className={`w-full text-center text-2xl font-black tracking-[0.6em] py-3 px-4 rounded-2xl border outline-none transition font-mono ${
                    pinError
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-800 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                  }`}
                />

                {pinError && (
                  <p className="text-xs font-bold text-rose-600 text-center">
                    {pinError}
                  </p>
                )}
              </div>

              {/* Numeric Keypad */}
              <div className="grid grid-cols-3 gap-2">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinDigitPress(digit)}
                    className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-black text-base transition cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinError('');
                  }}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 font-bold text-xs transition cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => handlePinDigitPress('0')}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-black text-base transition cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinInput((prev) => prev.slice(0, -1));
                    setPinError('');
                  }}
                  className="py-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 flex items-center justify-center transition cursor-pointer"
                  title="Backspace"
                >
                  <Delete size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPinModalOpen(false);
                    setPendingPinAction(null);
                    setPinInput('');
                    setPinError('');
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer"
                >
                  <ShieldCheck size={14} />
                  <span>Unlock</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
