import { supabase } from '../../../utils/supabaseClient';

const TRANSFER_HISTORY_KEY = 'joah_ro_transfer_history_v1';

/**
 * Normalize DD/MM/YYYY or YYYY-MM-DD to YYYY-MM-DD
 */
export function normalizeRoDate(rawDate) {
  if (!rawDate) return '';
  const clean = String(rawDate).trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts.length === 3) {
      const [y, m, d] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  return clean;
}

/**
 * Fetch stock count data from stock_count_lak8 for a specific branch, date, and optional RO reference.
 * @param {string} branch       - e.g. 'PSN', 'VX', 'LAK8'
 * @param {string} date         - ISO date string 'YYYY-MM-DD'
 * @param {string} [roReference]- e.g. 'test TLL 01' or fullReference
 * @returns {Array}             - Array of stock_count_lak8 records
 */
export async function fetchStockCountForBranchDate(branch, date, roReference = null) {
  if (!branch || !date) return [];

  // Supabase returns max 1000 rows by default — paginate to get ALL rows
  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('stock_count_lak8')
      .select('id, barcode, qty, branch, owner_branch, doc_nos, brand, created_by, count_date, ro_reference')
      .eq('branch', branch)
      .eq('count_date', date);

    if (roReference && roReference.trim() !== '') {
      query = query.ilike('ro_reference', roReference.trim());
    }

    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE; // if less than PAGE_SIZE, no more pages
    } else {
      hasMore = false;
    }
  }

  return allData;
}

/**
 * Fetch stock count records from stock_count_lak8 that are OUTSIDE any RO / SO Reference
 * (ro_reference is null, empty, or 'NONE') for the exact same branch and count_date.
 */
export async function fetchUnassignedStockCountsForBranchDate(branch, date) {
  if (!branch || !date) return [];

  const PAGE_SIZE = 1000;
  let allData = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('stock_count_lak8')
      .select('id, barcode, qty, branch, owner_branch, doc_nos, brand, created_by, count_date, ro_reference, created_at, updated_at')
      .eq('branch', branch)
      .eq('count_date', date)
      .or('ro_reference.is.null,ro_reference.eq.,ro_reference.ilike.NONE')
      .order('updated_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (data && data.length > 0) {
      allData = allData.concat(data);
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  return allData;
}

/**
 * Build reconciliation rows by joining RO items with stock count data.
 * @param {Array} roItems      - receive_order_items: { barcode, productName, roQty }
 * @param {Array} stockCounts  - from fetchStockCountForBranchDate: { id, barcode, qty, ... }
 * @returns {Array} rows with comparison columns + underlying stockRecords
 */
export function buildReconciliationRows(roItems, stockCounts) {
  // Group stockCounts by barcode (sum qty in case of duplicates) & retain raw DB records
  const countedMap = new Map();
  const recordsMap = new Map();
  for (const sc of stockCounts) {
    const prev = countedMap.get(sc.barcode) || 0;
    countedMap.set(sc.barcode, prev + (Number(sc.qty) || 0));
    if (!recordsMap.has(sc.barcode)) {
      recordsMap.set(sc.barcode, []);
    }
    recordsMap.get(sc.barcode).push(sc);
  }

  // Build rows from RO items
  const roBarcodesSet = new Set();
  const rows = roItems.map(item => {
    roBarcodesSet.add(item.barcode);
    const countedQty = countedMap.has(item.barcode) ? countedMap.get(item.barcode) : null;
    const roQty = Number(item.roQty) || 0;
    const diff = countedQty !== null ? countedQty - roQty : null;

    let status = 'NOT_COUNTED';
    if (countedQty !== null) {
      if (diff === 0) status = 'OK';
      else if (diff < 0) status = 'SHORT';
      else status = 'OVER';
    }

    return {
      barcode: item.barcode,
      productName: item.productName,
      roQty,
      countedQty,
      diff,
      status,
      source: 'RO',
      stockRecords: recordsMap.get(item.barcode) || []
    };
  });

  // Add EXTRA rows: counted in stock but NOT in RO
  for (const [barcode, qty] of countedMap.entries()) {
    if (!roBarcodesSet.has(barcode)) {
      rows.push({
        barcode,
        productName: null,
        roQty: 0,
        countedQty: qty,
        diff: qty,
        status: 'EXTRA',
        source: 'STOCK_ONLY',
        stockRecords: recordsMap.get(barcode) || []
      });
    }
  }

  return rows;
}

/**
 * Load transfer history from localStorage
 */
export function getTransferHistory() {
  try {
    const raw = localStorage.getItem(TRANSFER_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save transfer history to localStorage (keep latest 30 entries)
 */
function saveTransferHistory(list) {
  try {
    localStorage.setItem(TRANSFER_HISTORY_KEY, JSON.stringify(list.slice(0, 30)));
  } catch (err) {
    console.warn('Could not save transfer history to localStorage:', err);
  }
}

/**
 * Shared transfer engine: moves `recordsToMove` (from stock_count_lak8) into `targetRo`,
 * merging quantities when the barcode already exists in the target RO, and saving a full
 * rollback snapshot in localStorage.
 */
async function executeStockCountTransfer({
  recordsToMove,
  sourceMeta,
  targetRo,
  onProgress
}) {
  if (!recordsToMove?.length) {
    throw new Error('No matching source records found in stock_count_lak8');
  }
  if (!targetRo) throw new Error('Please select a target RO bill');

  const targetBranch = (targetRo.storeCode || '').trim();
  const targetDate = normalizeRoDate(targetRo.deliveryDate);
  const targetRoRef = (targetRo.fullReference || targetRo.roNumber || '').trim();

  if (!targetBranch || !targetDate || !targetRoRef) {
    throw new Error('Incomplete target RO information (Branch / Date / RO Reference)');
  }

  onProgress?.('Checking existing items in target RO...');

  // Fetch existing stock counts in target RO to detect barcode collisions
  const existingTargetCounts = await fetchStockCountForBranchDate(targetBranch, targetDate, targetRoRef);
  const targetBarcodeMap = new Map();
  for (const sc of existingTargetCounts) {
    if (!targetBarcodeMap.has(sc.barcode)) {
      targetBarcodeMap.set(sc.barcode, sc);
    }
  }

  const directMoveRecords = [];
  const mergeRecords = [];
  const seenBarcodesInBatch = new Set();

  for (const rec of recordsToMove) {
    if (!rec.id) continue;
    if (targetBarcodeMap.has(rec.barcode) || seenBarcodesInBatch.has(rec.barcode)) {
      mergeRecords.push(rec);
    } else {
      seenBarcodesInBatch.add(rec.barcode);
      directMoveRecords.push(rec);
    }
  }

  const operations = [];

  // 1. Process direct moves in chunks of 100 IDs
  const CHUNK_SIZE = 100;
  for (let i = 0; i < directMoveRecords.length; i += CHUNK_SIZE) {
    const chunk = directMoveRecords.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map(c => c.id);
    onProgress?.(`Transferring items (${Math.min(i + CHUNK_SIZE, directMoveRecords.length)}/${directMoveRecords.length})...`);

    const { error } = await supabase
      .from('stock_count_lak8')
      .update({
        branch: targetBranch,
        count_date: targetDate,
        ro_reference: targetRoRef,
        updated_at: new Date().toISOString()
      })
      .in('id', ids);

    if (error) {
      // Fallback: if batch update hits a constraint, move to merge/individual handling
      for (const item of chunk) {
        mergeRecords.push(item);
      }
    } else {
      for (const item of chunk) {
        operations.push({
          type: 'direct_move',
          id: item.id,
          barcode: item.barcode,
          qty: Number(item.qty) || 0,
          fromBranch: item.branch,
          fromDate: item.count_date,
          fromRoRef: item.ro_reference,
          toBranch: targetBranch,
          toDate: targetDate,
          toRoRef: targetRoRef
        });
        targetBarcodeMap.set(item.barcode, {
          ...item,
          branch: targetBranch,
          count_date: targetDate,
          ro_reference: targetRoRef
        });
      }
    }
  }

  // 2. Process merge records (where barcode already exists in target RO)
  for (let i = 0; i < mergeRecords.length; i++) {
    const rec = mergeRecords[i];
    onProgress?.(`Merging duplicate items (${i + 1}/${mergeRecords.length})...`);

    const existingTarget = targetBarcodeMap.get(rec.barcode);
    if (existingTarget && existingTarget.id && existingTarget.id !== rec.id) {
      const prevTargetQty = Number(existingTarget.qty) || 0;
      const addQty = Number(rec.qty) || 0;
      const newTargetQty = prevTargetQty + addQty;

      const { error: updErr } = await supabase
        .from('stock_count_lak8')
        .update({
          qty: newTargetQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingTarget.id);

      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from('stock_count_lak8')
        .delete()
        .eq('id', rec.id);

      if (delErr) throw delErr;

      existingTarget.qty = newTargetQty;

      operations.push({
        type: 'merged',
        targetRowId: existingTarget.id,
        addedQty: addQty,
        previousTargetQty: prevTargetQty,
        barcode: rec.barcode,
        qty: addQty,
        deletedRecord: {
          barcode: rec.barcode,
          qty: addQty,
          branch: rec.branch,
          owner_branch: rec.owner_branch || null,
          doc_nos: rec.doc_nos || null,
          brand: rec.brand || 'joah',
          created_by: rec.created_by || 'Staff',
          count_date: rec.count_date,
          ro_reference: rec.ro_reference
        }
      });
    } else {
      // Try single row direct update
      const { error: singleErr } = await supabase
        .from('stock_count_lak8')
        .update({
          branch: targetBranch,
          count_date: targetDate,
          ro_reference: targetRoRef,
          updated_at: new Date().toISOString()
        })
        .eq('id', rec.id);

      if (singleErr) throw singleErr;

      operations.push({
        type: 'direct_move',
        id: rec.id,
        barcode: rec.barcode,
        qty: Number(rec.qty) || 0,
        fromBranch: rec.branch,
        fromDate: rec.count_date,
        fromRoRef: rec.ro_reference,
        toBranch: targetBranch,
        toDate: targetDate,
        toRoRef: targetRoRef
      });
    }
  }

  const totalMovedQty = operations.reduce((sum, op) => sum + (Number(op.qty) || 0), 0);
  const uniqueMovedBarcodes = Array.from(new Set(operations.map(op => op.barcode)));

  const transferRecord = {
    transferId: `TRF-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sourceRoId: sourceMeta?.sourceRoId ?? null,
    sourceRoNumber: sourceMeta?.sourceRoNumber || '-',
    sourceFullRef: sourceMeta?.sourceFullRef || '-',
    sourceBranch: sourceMeta?.sourceBranch || '-',
    sourceDate: sourceMeta?.sourceDate || targetDate,
    targetRoId: targetRo?.id || null,
    targetRoNumber: targetRo?.roNumber || targetRo?.fullReference || '-',
    targetFullRef: targetRo?.fullReference || targetRo?.roNumber || '-',
    targetBranch,
    targetDate,
    skuCount: uniqueMovedBarcodes.length,
    totalQty: totalMovedQty,
    sampleBarcodes: uniqueMovedBarcodes.slice(0, 10),
    operations,
    rolledBack: false,
    rolledBackAt: null
  };

  const currentHistory = getTransferHistory();
  saveTransferHistory([transferRecord, ...currentHistory]);

  return transferRecord;
}

/**
 * Transfer selected (Not in RO) rows from current RO to target RO, recording full snapshot for Rollback.
 */
export async function transferExtraItemsToRO({
  extraRowsToMove,
  sourceRo,
  sourceDate,
  targetRo,
  onProgress
}) {
  if (!extraRowsToMove?.length) throw new Error('No items selected to transfer');

  const recordsToMove = [];
  for (const r of extraRowsToMove) {
    if (Array.isArray(r.stockRecords) && r.stockRecords.length > 0) {
      recordsToMove.push(...r.stockRecords);
    }
  }

  return executeStockCountTransfer({
    recordsToMove,
    sourceMeta: {
      sourceRoId: sourceRo?.id || null,
      sourceRoNumber: sourceRo?.roNumber || sourceRo?.fullReference || '-',
      sourceFullRef: sourceRo?.fullReference || sourceRo?.roNumber || '-',
      sourceBranch: sourceRo?.storeCode || '-',
      sourceDate: sourceDate || normalizeRoDate(sourceRo?.deliveryDate)
    },
    targetRo,
    onProgress
  });
}

/**
 * Transfer selected counts that were scanned OUTSIDE any RO / SO Reference
 * (on the same branch & date) into the target RO.
 */
export async function transferUnassignedCountsToRO({
  unassignedRowsToMove,
  targetRo,
  sourceBranch,
  sourceDate,
  onProgress
}) {
  if (!unassignedRowsToMove?.length) throw new Error('No outside-RO counts selected to transfer');

  const recordsToMove = [];
  for (const r of unassignedRowsToMove) {
    if (Array.isArray(r.stockRecords) && r.stockRecords.length > 0) {
      recordsToMove.push(...r.stockRecords);
    }
  }

  return executeStockCountTransfer({
    recordsToMove,
    sourceMeta: {
      sourceRoId: null,
      sourceRoNumber: 'Outside RO (No Ref)',
      sourceFullRef: 'Outside RO (No Reference)',
      sourceBranch: sourceBranch || targetRo?.storeCode || '-',
      sourceDate: sourceDate || normalizeRoDate(targetRo?.deliveryDate)
    },
    targetRo,
    onProgress
  });
}

/**
 * Rollback a previous transfer entry, restoring all items back to the original RO bill.
 * @param {string} transferId
 * @param {Function} [onProgress]
 */
export async function rollbackROTransfer(transferId, onProgress) {
  const history = getTransferHistory();
  const entry = history.find(h => h.transferId === transferId);
  if (!entry) throw new Error('Transfer history record not found');
  if (entry.rolledBack) throw new Error('This transfer has already been rolled back');

  const directOps = entry.operations.filter(op => op.type === 'direct_move');
  const mergedOps = entry.operations.filter(op => op.type === 'merged');

  // 1. Group direct_move ops by (fromBranch, fromDate, fromRoRef) and batch restore
  const groups = new Map();
  for (const op of directOps) {
    const key = `${op.fromBranch}||${op.fromDate}||${op.fromRoRef || ''}`;
    if (!groups.has(key)) {
      groups.set(key, {
        fromBranch: op.fromBranch,
        fromDate: op.fromDate,
        fromRoRef: op.fromRoRef,
        ids: []
      });
    }
    groups.get(key).ids.push(op.id);
  }

  const CHUNK_SIZE = 100;
  for (const grp of groups.values()) {
    for (let i = 0; i < grp.ids.length; i += CHUNK_SIZE) {
      const idChunk = grp.ids.slice(i, i + CHUNK_SIZE);
      onProgress?.(`Restoring items to original RO (${Math.min(i + CHUNK_SIZE, grp.ids.length)}/${grp.ids.length})...`);
      const { error } = await supabase
        .from('stock_count_lak8')
        .update({
          branch: grp.fromBranch,
          count_date: grp.fromDate,
          ro_reference: grp.fromRoRef,
          updated_at: new Date().toISOString()
        })
        .in('id', idChunk);

      if (error) throw error;
    }
  }

  // 2. Restore merged ops (subtract addedQty from target row and re-insert original source row)
  for (let i = 0; i < mergedOps.length; i++) {
    const op = mergedOps[i];
    onProgress?.(`Splitting merged quantities back (${i + 1}/${mergedOps.length})...`);

    const { data: currentTarget } = await supabase
      .from('stock_count_lak8')
      .select('id, qty')
      .eq('id', op.targetRowId)
      .maybeSingle();

    if (currentTarget) {
      const restoredQty = Math.max(0, (Number(currentTarget.qty) || 0) - (Number(op.addedQty) || 0));
      const { error: updErr } = await supabase
        .from('stock_count_lak8')
        .update({
          qty: restoredQty,
          updated_at: new Date().toISOString()
        })
        .eq('id', op.targetRowId);
      if (updErr) throw updErr;
    }

    if (op.deletedRecord) {
      const { error: insErr } = await supabase
        .from('stock_count_lak8')
        .insert({
          ...op.deletedRecord,
          updated_at: new Date().toISOString()
        });
      if (insErr) throw insErr;
    }
  }

  // Mark entry as rolledBack in localStorage
  const updatedHistory = history.map(h =>
    h.transferId === transferId
      ? { ...h, rolledBack: true, rolledBackAt: new Date().toISOString() }
      : h
  );
  saveTransferHistory(updatedHistory);

  return updatedHistory;
}
