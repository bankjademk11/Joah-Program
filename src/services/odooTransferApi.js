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

  // ฟังก์ชันช่วยเหลือในการ handle action wizard แต่ละแบบที่ Odoo ส่งกลับมา
  let currentActionResult = validateResult;
  let hasHandledWizard = false;

  // วน Loop จัดการ Wizard Action (เผื่อกรณี Odoo เด้ง Wizard ซ้อนกัน เช่น Expiry -> Backorder)
  while (currentActionResult && typeof currentActionResult === 'object' && currentActionResult.res_model) {
    hasHandledWizard = true;
    const resModel = currentActionResult.res_model;
    const ctx = currentActionResult.context || {};

    console.log(`[validateOdooPicking] Handling Wizard Action: ${resModel}`, currentActionResult);

    if (resModel === 'expiry.picking.confirmation') {
      onProgress?.({ percent: 50, currentBatch: 2, totalBatches: 3, text: 'ตรวจพบสินค้าใกล้หมดอายุ (Expired Info) กำลังยืนยัน...' });

      // ดึง Wizard ID จาก res_id ที่ Odoo คืนมาใน action หรือเรียก web_save
      let wizardId = currentActionResult.res_id;

      if (!wizardId) {
        // ถ้าไม่มี res_id คืนมา ใช้ web_save ด้วย picking_ids
        const saveExpiry = await odooRpc(
          'expiry.picking.confirmation',
          'web_save',
          [[], { picking_ids: [[6, 0, [id]]] }, {}],
          { context: ctx }
        );
        wizardId = Array.isArray(saveExpiry) && saveExpiry.length > 0 ? saveExpiry[0].id : saveExpiry?.id;
      }

      if (!wizardId) {
        throw new Error('ไม่สามารถรับ Wizard ID สำหรับ Expiry Confirmation ได้');
      }

      onProgress?.({ percent: 75, currentBatch: 3, totalBatches: 3, text: 'กำลังกดยืนยันสินค้าหมดอายุ (process)...' });

      // Step Expiry: process([wizardId]) บน expiry.picking.confirmation
      currentActionResult = await odooRpc(
        'expiry.picking.confirmation',
        'process',
        [[wizardId]],
        { context: ctx }
      );
      console.log('[validateOdooPicking] expiry process result:', currentActionResult);

    } else if (resModel === 'stock.backorder.confirmation') {
      onProgress?.({ percent: 60, currentBatch: 2, totalBatches: 3, text: 'ตรวจพบสินค้าไม่ครบ กำลังขอยกเลิก Backorder (web_save)...' });

      // Step Backorder 1: web_save บน stock.backorder.confirmation
      const saveBackorder = await odooRpc(
        'stock.backorder.confirmation',
        'web_save',
        [[], { pick_ids: [[4, id]] }, {}],
        { context: ctx }
      );
      const wizardId = Array.isArray(saveBackorder) && saveBackorder.length > 0 ? saveBackorder[0].id : saveBackorder?.id;

      if (!wizardId) {
        throw new Error('ไม่สามารถบันทึก Backorder wizard ได้ (web_save failed)');
      }

      onProgress?.({ percent: 85, currentBatch: 3, totalBatches: 3, text: 'กำลังส่งคำสั่ง No Backorder (process_cancel_backorder)...' });

      // Step Backorder 2: process_cancel_backorder([wizardId])
      currentActionResult = await odooRpc(
        'stock.backorder.confirmation',
        'process_cancel_backorder',
        [[wizardId]],
        { context: ctx }
      );
      console.log('[validateOdooPicking] process_cancel_backorder result:', currentActionResult);

    } else {
      // Wizard ชนิดอื่นๆ ที่ยังไม่ได้ดักจับ
      console.warn(`[validateOdooPicking] Unsupported Wizard model: ${resModel}`, currentActionResult);
      break;
    }
  }

  onProgress?.({ percent: 100, currentBatch: 3, totalBatches: 3, text: 'Validate สมบูรณ์เรียบร้อย!' });
  return { success: true, hadWizard: hasHandledWizard };
}



/**
 * Fetch Stock Pickings (Receipts / Transfer IN) จาก Odoo (stock.picking model)
 */
export async function fetchOdooStockPickings({ companyId, search = '', status = '', pickingTypeCode = 'incoming', limit = 1000 } = {}) {
  const domain = [];

  if (pickingTypeCode && pickingTypeCode !== 'all') {
    if (Array.isArray(pickingTypeCode)) {
      domain.push(['picking_type_code', 'in', pickingTypeCode]);
    } else {
      domain.push(['picking_type_code', '=', pickingTypeCode]);
    }
  }

  if (status && status !== 'all') {
    domain.push(['state', '=', status]);
  }

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
