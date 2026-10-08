import { supabase } from '../../../utils/supabaseClient';

/**
 * Fetch stock count data from stock_count_lak8 for a specific branch and date.
 * @param {string} branch  - e.g. 'PSN', 'VX', 'LAK8'
 * @param {string} date    - ISO date string 'YYYY-MM-DD'
 * @returns {Array}        - Array of { barcode, qty, branch, owner_branch }
 */
export async function fetchStockCountForBranchDate(branch, date) {
  if (!branch || !date) return [];

  const { data, error } = await supabase
    .from('stock_count_lak8')
    .select('barcode, qty, branch, owner_branch, count_date')
    .eq('branch', branch)
    .eq('count_date', date);

  if (error) throw error;
  return data || [];
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
