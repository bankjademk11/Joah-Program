/**
 * odooTransferApi.js
 * API client สำหรับอ่านข้อมูล Odoo Stock Transfers (stock.picking) 
 * แยกต่างหากโดยเฉพาะ ไม่ยุ่งเกี่ยวกับไฟล์หรือ component เดิมของระบบ
 * READ + VALIDATE (No Backorder policy)
 */

const BASE = '/api';

// ─── Helper: call any Odoo RPC method ────────────────────────────────────────
async function odooRpc(model, method, args = [], kwargs = {}) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: { model, method, args, kwargs },
  };
  const res = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo RPC error');
  return json.result;
}

/**
 * Validate a stock.picking — No Backorder policy (ตามนโยบายหัวหน้า)
 * 
 * Flow (จาก network capture จริง):
 *   1. stock.picking.button_validate([id])
 *      → ถ้าคืน action wizard (res_model: stock.backorder.confirmation) = มีสินค้าไม่ครบ
 *      → ถ้าคืน false = validate สำเร็จทันที
 *   2. ถ้ามี wizard: search_read หา wizard id ที่เพิ่งสร้าง
 *   3. stock.backorder.confirmation.process_cancel_backorder([wizard_id])
 *      → คืน false = สำเร็จ, picking state → "done"
 */
export async function validateOdooPickingNoBackorder(pickingId, onProgress) {
  const id = Number(pickingId);

  // Step 1: ส่งคำสั่ง Validate ให้ Odoo
  onProgress?.({ percent: 15, currentBatch: 1, totalBatches: 3, text: 'กำลังส่งคำสั่ง Validate ไปยัง Odoo...' });
  const validateResult = await odooRpc('stock.picking', 'button_validate', [[id]]);
  console.log('[validateOdooPicking] button_validate result:', validateResult);

  // ถ้าคืน false = สำเร็จทันที ไม่ต้อง backorder flow
  if (!validateResult) {
    onProgress?.({ percent: 100, currentBatch: 3, totalBatches: 3, text: 'Validate สำเร็จ 100%' });
    return { success: true, hadBackorder: false };
  }

  // ถ้าคืน action ที่เป็น wizard stock.backorder.confirmation
  if (validateResult?.res_model === 'stock.backorder.confirmation') {
    onProgress?.({ percent: 45, currentBatch: 2, totalBatches: 3, text: 'ตรวจพบสินค้าขาด/ไม่ครบ กำลังเตรียมขอยกเลิก Backorder (web_save)...' });

    // Step 2: เรียก web_save บน stock.backorder.confirmation (ตรงตาม payload network จริง Odoo 18)
    const saveResult = await odooRpc(
      'stock.backorder.confirmation',
      'web_save',
      [[], { pick_ids: [[4, id]] }, {}],
      { context: validateResult.context || {} }
    );
    console.log('[validateOdooPicking] web_save result:', saveResult);

    // ดึง wizardId จาก saveResult
    const wizardId = Array.isArray(saveResult) && saveResult.length > 0 ? saveResult[0].id : saveResult?.id;

    if (!wizardId) {
      throw new Error('ไม่สามารถบันทึก Backorder wizard ได้ (web_save failed)');
    }

    onProgress?.({ percent: 75, currentBatch: 3, totalBatches: 3, text: 'กำลังส่งคำสั่ง No Backorder (process_cancel_backorder)...' });

    // Step 3: กด "No Backorder" = process_cancel_backorder([wizardId])
    const noBackResult = await odooRpc(
      'stock.backorder.confirmation',
      'process_cancel_backorder',
      [[wizardId]],
      { context: validateResult.context || {} }
    );
    console.log('[validateOdooPicking] process_cancel_backorder result:', noBackResult);

    onProgress?.({ percent: 100, currentBatch: 3, totalBatches: 3, text: 'Validate & Clear Backorder สำเร็จ!' });
    return { success: true, hadBackorder: true, wizardId };
  }

  // กรณีอื่น (unexpected)
  console.warn('[validateOdooPicking] Unexpected result:', validateResult);
  onProgress?.({ percent: 100, currentBatch: 3, totalBatches: 3, text: 'เสร็จสิ้นกระบวนการ' });
  return { success: true, hadBackorder: false };
}



/**
 * Fetch Stock Pickings (Receipts / Transfer IN) จาก Odoo (stock.picking model)
 */
export async function fetchOdooStockPickings({ companyId, search = '', limit = 100 } = {}) {
  const domain = [['picking_type_code', '=', 'incoming']];
  if (companyId) {
    domain.push(['company_id', '=', Number(companyId)]);
  }
  if (search && search.trim()) {
    const q = search.trim();
    domain.push('|');
    domain.push('|');
    domain.push(['name', 'ilike', q]);
    domain.push(['origin', 'ilike', q]);
    domain.push(['partner_id.name', 'ilike', q]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.picking',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields: [
          'id', 'name', 'location_id', 'location_dest_id', 'partner_id',
          'scheduled_date', 'date_deadline', 'date_done', 'origin', 'bill_reference',
          'picking_type_id', 'company_id', 'state', 'priority',
          'move_ids_without_package'
        ],
        order: 'scheduled_date desc, id desc',
        limit: limit
      },
    },
  };

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Odoo API error');
  }
  return json.result || [];
}

/**
 * Fetch Items / Move Lines ของบิล Transfer IN จาก Odoo
 * ใช้ stock.move (move_ids_without_package) - Odoo 18 compatible
 * field 'quantity' = done qty (Odoo 17+), 'product_uom_qty' = demand qty
 */
export async function fetchOdooPickingItems(pickingId) {
  if (!pickingId) return [];

  // ลอง query stock.move ก่อน (move_ids_without_package)
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.move',
      method: 'search_read',
      args: [[
        ['picking_id', '=', Number(pickingId)],
        ['state', 'not in', ['cancel', 'draft']]
      ]],
      kwargs: {
        fields: [
          'id',
          'product_id',
          'product_uom_qty',   // Demand qty
          'quantity',           // Done qty (Odoo 17+, replaces quantity_done)
          'product_uom',
          'state',
          'location_id',
          'location_dest_id',
          'description_picking',
          'move_line_ids'
        ],
        order: 'id asc',
        limit: 1000
      },
    },
  };

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const json = await response.json();

  console.log('[odooTransferApi] fetchOdooPickingItems raw result:', json);

  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Odoo API error');
  }

  const moves = json.result || [];
  console.log(`[odooTransferApi] Got ${moves.length} stock.move records for picking ${pickingId}`);
  if (moves.length > 0) {
    console.log('[odooTransferApi] Sample move fields:', Object.keys(moves[0]));
    console.log('[odooTransferApi] Sample move data:', moves[0]);
  }

  return moves;
}

/**
 * Fetch Items ทั้งหมดโดยใช้ stock.move.line (รายการ lot/serial ละเอียด)
 * สำหรับกรณีที่ stock.move ไม่แสดงข้อมูล
 */
export async function fetchOdooPickingMoveLines(pickingId) {
  if (!pickingId) return [];

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.move.line',
      method: 'search_read',
      args: [[
        ['picking_id', '=', Number(pickingId)]
      ]],
      kwargs: {
        fields: [
          'id',
          'product_id',
          'quantity',         // Done qty (Odoo 17+)
          'qty_done',         // Done qty (Odoo 16 fallback)
          'reserved_uom_qty', // Demand qty (Odoo 17+)
          'reserved_qty',
          'product_uom_id',
          'lot_id',
          'lot_name',
          'state'
        ],
        order: 'id asc',
        limit: 2000
      },
    },
  };

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const json = await response.json();

  console.log('[odooTransferApi] fetchOdooPickingMoveLines raw result:', json);

  if (json.error) {
    console.warn('[odooTransferApi] stock.move.line error:', json.error);
    return [];
  }

  return json.result || [];
}

/**
 * Fetch Barcode MAP สำหรับสินค้าในบิล
 */
export async function fetchProductBarcodesMap(productIds) {
  if (!productIds || productIds.length === 0) return {};

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'product.product',
      method: 'search_read',
      args: [[['id', 'in', productIds]]],
      kwargs: {
        fields: ['id', 'barcode', 'default_code', 'display_name'],
        limit: 5000
      },
    },
  };

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  const json = await response.json();
  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Odoo API error');
  }

  const barcodeMap = {};
  (json.result || []).forEach(product => {
    barcodeMap[product.id] = {
      barcode: product.barcode || product.default_code || '-',
      name: product.display_name || '-'
    };
  });

  return barcodeMap;
}
