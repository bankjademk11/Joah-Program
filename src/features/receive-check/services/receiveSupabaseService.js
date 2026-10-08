import { supabase } from '../../../utils/supabaseClient';

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
    const { data: items, error: itemsErr } = await supabase
      .from('receive_order_items')
      .select('*')
      .in('receive_order_id', orderIds);

    if (itemsErr) throw itemsErr;

    // Group items by receive_order_id
    const itemsByOrder = {};
    (items || []).forEach(it => {
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
    });

    return orders.map(o => ({
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
      items: itemsByOrder[o.id] || []
    }));
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
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
      const chunk = itemsToInsert.slice(i, i + chunkSize);
      const { error: chunkErr } = await supabase
        .from('receive_order_items')
        .insert(chunk);
      if (chunkErr) throw chunkErr;
    }

    return insertedOrder;
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

