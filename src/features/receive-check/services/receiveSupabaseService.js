import { supabase } from '../../../utils/supabaseClient';

const PAGE_SIZE = 1000;
const CONCURRENCY = 6;

function normalizeDateYMD(rawDate) {
  if (!rawDate) return '';
  const clean = String(rawDate).trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return clean;
}

/**
 * Fetch all pages of a Supabase query in parallel batches after page 0 returns exact count.
 */
async function fetchAllPagesParallel(buildQuery) {
  const { data: firstPage, count, error: firstErr } = await buildQuery({ withCount: true })
    .range(0, PAGE_SIZE - 1);

  if (firstErr) throw firstErr;
  if (!firstPage || firstPage.length === 0) return [];

  const total = typeof count === 'number' ? count : firstPage.length;
  if (firstPage.length < PAGE_SIZE || total <= PAGE_SIZE) {
    return firstPage;
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allRows = [...firstPage];

  for (let startPage = 1; startPage < totalPages; startPage += CONCURRENCY) {
    const endPage = Math.min(startPage + CONCURRENCY, totalPages);
    const batchPromises = [];
    for (let p = startPage; p < endPage; p++) {
      const from = p * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      batchPromises.push(buildQuery({ withCount: false }).range(from, to));
    }
    const results = await Promise.all(batchPromises);
    for (const res of results) {
      if (res.error) throw res.error;
      if (res.data?.length) allRows.push(...res.data);
    }
  }

  return allRows;
}

/**
 * Fetch all receive orders with their items from Supabase
 */
export async function fetchAllReceiveOrders() {
  try {
    const { data: orders, error: ordersErr } = await supabase
      .from('receive_orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (ordersErr) {
      if (ordersErr.code === '42P01' || ordersErr.message?.includes('does not exist') || ordersErr.code === 'PGRST205' || ordersErr.code === 'PGRST301') {
        const notFoundErr = new Error('TABLES_NOT_FOUND');
        notFoundErr.original = ordersErr;
        throw notFoundErr;
      }
      throw ordersErr;
    }
    if (!orders || orders.length === 0) return [];

    const orderIds = orders.map(o => o.id);
    const branches = Array.from(new Set(orders.map(o => o.store_code).filter(Boolean)));
    const dates = Array.from(new Set(orders.map(o => normalizeDateYMD(o.delivery_date)).filter(Boolean)));

    // Fetch receive_order_items AND stock_count_lak8 in parallel using concurrent page batches
    const itemsPromise = fetchAllPagesParallel(({ withCount }) =>
      supabase
        .from('receive_order_items')
        .select(
          'id, receive_order_id, location, barcode, product_name, ro_qty, received_qty, remark, unit',
          withCount ? { count: 'exact' } : undefined
        )
        .in('receive_order_id', orderIds)
        .order('id', { ascending: true })
    );

    const stockCountsPromise =
      branches.length > 0 && dates.length > 0
        ? fetchAllPagesParallel(({ withCount }) =>
            supabase
              .from('stock_count_lak8')
              .select(
                'id, barcode, qty, branch, count_date, ro_reference',
                withCount ? { count: 'exact' } : undefined
              )
              .in('branch', branches)
              .in('count_date', dates)
              .order('id', { ascending: true })
          ).catch((e) => {
            console.warn('Failed to fetch live counts for receive_orders list:', e);
            return [];
          })
        : Promise.resolve([]);

    const [items, allStockCounts] = await Promise.all([itemsPromise, stockCountsPromise]);

    // Group items by receive_order_id
    const itemsByOrder = {};
    for (const it of items) {
      if (!itemsByOrder[it.receive_order_id]) {
        itemsByOrder[it.receive_order_id] = [];
      }
      itemsByOrder[it.receive_order_id].push({
        id: it.id,
        receiveOrderId: it.receive_order_id,
        location: it.location || '',
        barcode: it.barcode,
        productName: it.product_name,
        roQty: Number(it.ro_qty) || 0,
        received: it.received_qty !== null ? Number(it.received_qty) : null,
        remark: it.remark || '',
        unit: it.unit || 'Unit'
      });
    }

    // O(M) single-pass indexing of stock counts into Hash Maps
    const countsByBranchDateRo = new Map();
    const countsByBranchDateAll = new Map();

    for (const sc of allStockCounts) {
      const scBranch = (sc.branch || '').trim().toLowerCase();
      const scDate = sc.count_date || '';
      const scRoRef = (sc.ro_reference || '').trim().toLowerCase();
      const qty = Number(sc.qty) || 0;

      const roKey = `${scBranch}||${scDate}||${scRoRef}`;
      let roMap = countsByBranchDateRo.get(roKey);
      if (!roMap) {
        roMap = new Map();
        countsByBranchDateRo.set(roKey, roMap);
      }
      roMap.set(sc.barcode, (roMap.get(sc.barcode) || 0) + qty);

      const allKey = `${scBranch}||${scDate}`;
      let allMap = countsByBranchDateAll.get(allKey);
      if (!allMap) {
        allMap = new Map();
        countsByBranchDateAll.set(allKey, allMap);
      }
      allMap.set(sc.barcode, (allMap.get(sc.barcode) || 0) + qty);
    }

    // O(N) mapping of orders
    return orders.map(o => {
      const roRef = (o.full_reference || o.ro_number || '').trim().toLowerCase();
      const branchLower = (o.store_code || '').trim().toLowerCase();
      const formattedOrderDate = normalizeDateYMD(o.delivery_date);

      const countedMap = roRef
        ? countsByBranchDateRo.get(`${branchLower}||${formattedOrderDate}||${roRef}`)
        : countsByBranchDateAll.get(`${branchLower}||${formattedOrderDate}`);

      const orderItems = (itemsByOrder[o.id] || []).map(it => {
        const liveReceived = countedMap?.has(it.barcode)
          ? countedMap.get(it.barcode)
          : it.received;
        return {
          ...it,
          received: liveReceived
        };
      });

      return {
        id: o.id,
        fullReference: o.full_reference || o.ro_number,
        soNumber: o.so_number || '',
        roNumber: o.ro_number,
        rawStore: o.store_name,
        storeCode: o.store_code,
        storeName: o.store_name,
        branchTag: o.branch_tag,
        deliveryDate: o.delivery_date,
        totalItems: o.total_items,
        totalRoQty: o.total_ro_qty,
        status: o.status,
        createdAt: o.created_at,
        items: orderItems
      };
    });
  } catch (err) {
    console.error('Error fetching receive orders from Supabase:', err);
    throw err;
  }
}

/**
 * Insert a new receive order and its line items into Supabase
 */
export async function insertReceiveOrder(orderData, itemsData) {
  try {
    // 1. Insert into receive_orders
    const { data: insertedOrder, error: orderErr } = await supabase
      .from('receive_orders')
      .insert({
        ro_number: orderData.roNumber,
        so_number: orderData.soNumber,
        full_reference: orderData.fullReference,
        branch_tag: orderData.branchTag,
        store_code: orderData.storeCode,
        store_name: orderData.storeName,
        delivery_date: orderData.deliveryDate,
        total_items: orderData.totalItems,
        total_ro_qty: orderData.totalRoQty,
        status: orderData.status || 'WAITING'
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // 2. Prepare and insert line items in chunks
    const itemsToInsert = itemsData.map(item => ({
      receive_order_id: insertedOrder.id,
      location: item.location || '',
      barcode: item.barcode,
      actual_barcode: item.actualBarcode || item.barcode,
      product_name: item.productName,
      ro_qty: item.roQty,
      received_qty: item.received !== undefined ? item.received : null,
      remark: item.remark || '',
      unit: item.unit || 'Unit'
    }));

    const chunkSize = 200;
    const insertPromises = [];
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      insertPromises.push(
        supabase
          .from('receive_order_items')
          .insert(chunk)
          .select('id, receive_order_id, location, barcode, product_name, ro_qty, received_qty, remark, unit')
      );
    }

    const chunkResults = await Promise.all(insertPromises);
    const insertedItems = [];
    for (const { data: chunkRows, error: chunkErr } of chunkResults) {
      if (chunkErr) throw chunkErr;
      if (chunkRows?.length) {
        for (const it of chunkRows) {
          insertedItems.push({
            id: it.id,
            receiveOrderId: it.receive_order_id,
            location: it.location || '',
            barcode: it.barcode,
            productName: it.product_name,
            roQty: Number(it.ro_qty) || 0,
            received: it.received_qty !== null ? Number(it.received_qty) : null,
            remark: it.remark || '',
            unit: it.unit || 'Unit'
          });
        }
      }
    }

    return { ...insertedOrder, insertedItems };
  } catch (err) {
    console.error('Error inserting receive order to Supabase:', err);
    throw err;
  }
}

/**
 * Update received quantity or remark for an individual item
 */
export async function updateReceiveOrderItem(itemId, updates) {
  try {
    const payload = {};
    if (updates.received !== undefined) payload.received_qty = updates.received;
    if (updates.remark !== undefined) payload.remark = updates.remark;
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('receive_order_items')
      .update(payload)
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating receive order item:', err);
    throw err;
  }
}

/**
 * Update overall RO order status
 */
export async function updateReceiveOrderStatus(orderId, status) {
  try {
    const { data, error } = await supabase
      .from('receive_orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating receive order status:', err);
    throw err;
  }
}

/**
 * Delete a specific receive order and its items
 */
export async function deleteReceiveOrder(orderId) {
  try {
    const { error } = await supabase
      .from('receive_orders')
      .delete()
      .eq('id', orderId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error deleting receive order:', err);
    throw err;
  }
}

/**
 * Clear all receive orders and items from database
 */
export async function clearAllReceiveOrders() {
  try {
    const { error } = await supabase
      .from('receive_orders')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Error clearing all receive orders:', err);
    throw err;
  }
}

