import { supabase } from '../../../utils/supabaseClient';

/**
 * Fetch stock count data from stock_count_lak8 for a specific branch, date, and optional RO reference.
 * @param {string} branch       - e.g. 'PSN', 'VX', 'LAK8'
 * @param {string} date         - ISO date string 'YYYY-MM-DD'
 * @param {string} [roReference]- e.g. 'test TLL 01' or fullReference
 * @returns {Array}             - Array of { barcode, qty, branch, owner_branch, ro_reference }
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
      .select('barcode, qty, branch, owner_branch, count_date, ro_reference')
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
 * Build reconciliation rows by joining RO items with stock count data.
 * @param {Array} roItems      - receive_order_items: { barcode, productName, roQty }
 * @param {Array} stockCounts  - from fetchStockCountForBranchDate: { barcode, qty }
 * @returns {Array} rows with comparison columns
 */
export function buildReconciliationRows(roItems, stockCounts) {
  // Group stockCounts by barcode (sum qty in case of duplicates)
  const countedMap = new Map();
  for (const sc of stockCounts) {
    const prev = countedMap.get(sc.barcode) || 0;
    countedMap.set(sc.barcode, prev + (Number(sc.qty) || 0));
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
      source: 'RO'
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
        source: 'STOCK_ONLY'
      });
    }
  }

  return rows;
}
