/**
 * odooApi.js
 * Handles all communication with Odoo JSON-RPC 2.0 API via Vite proxy.
 * Strictly READ-ONLY — no Create, Update, or Delete operations.
 */

const BASE = '/api'

// ── Auth ─────────────────────────────────────────────────────

/**
 * Authenticate with Odoo using username + password.
 * @returns {{ uid: number, name: string, db: string }} session info on success
 * @throws Error with message on failure
 */
export async function authenticate(db, login, password) {
  const res = await fetch(`${BASE}/web/session/authenticate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: { db, login, password },
    }),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

  const json = await res.json()

  if (json.error) {
    throw new Error(json.error.data?.message || json.error.message || 'Authentication failed')
  }

  const result = json.result
  // Odoo returns uid=false when credentials are wrong
  if (!result || !result.uid) {
    throw new Error('Invalid username or password')
  }

  return { uid: result.uid, name: result.name, db: result.db }
}

/**
 * Logout from Odoo session.
 */
export async function logout() {
  try {
    await fetch(`${BASE}/web/session/destroy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params: {} }),
    })
  } catch { /* ignore */ }
}

// ── Product Search ────────────────────────────────────────────

/**
 * Search for a product by barcode or internal reference (default_code).
 * @param {string} searchTerm - barcode or SKU
 * @returns {Promise<Object|null>} product data or null if not found
 */
export async function searchProduct(searchTerm) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'product.template',
      method: 'search_read',
      args: [
        [
          '|',
          ['barcode', '=', searchTerm.trim()],
          ['default_code', '=', searchTerm.trim()]
        ]
      ],
      kwargs: {
        fields: ['name', 'product_name_eng', 'product_name_la', 'list_price', 'standard_price', 'qty_available', 'default_code', 'barcode', 'categ_id'],
        limit: 1,
      },
    },
  }

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)

  const json = await response.json()

  if (json.error) {
    const msg = json.error.data?.message || json.error.message || 'Odoo API error'
    // Session expired → treat as auth error
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED')
      err.isAuthError = true
      throw err
    }
    throw new Error(msg)
  }

  const results = json.result
  if (!Array.isArray(results) || results.length === 0) return null
  return results[0]
}

// ── JOAH Product List ─────────────────────────────────────────

/**
 * Fetch paginated JOAH brand products (product_bu_id = 9126).
 * @param {number} offset - pagination offset (0-based)
 * @param {number} limit  - number of records per page
 * @param {string} search - optional name/code search term
 * @returns {Promise<{ total: number, records: Object[] }>}
 */
export async function fetchJoahProducts(offset = 0, limit = 20, search = '', onlyWithImage = false) {
  // product_bu_id = 9126 is the "Joah Master Data" filter — covers all 10,000+ JOAH products
  const domain = [['product_bu_id', 'in', [9126]]]
  if (onlyWithImage) {
    domain.push(['image_128', '!=', false])
  }
  if (search.trim()) {
    domain.push('|')
    domain.push(['name', 'ilike', search.trim()])
    domain.push(['default_code', 'ilike', search.trim()])
  }

  const FIELDS = ['id', 'name', 'product_name_eng', 'product_name_la', 'default_code', 'list_price', 'qty_available', 'categ_id', 'uom_id', 'image_128']

  // ── 1. Fetch paginated records via search_read ──────────────
  const recordsPayload = {
    jsonrpc: '2.0', method: 'call', id: Date.now(),
    params: {
      model: 'product.template',
      method: 'search_read',
      args: [domain],
      kwargs: { fields: FIELDS, offset, limit, order: 'name asc' },
    },
  }

  // ── 2. Fetch total count via search_count ───────────────────
  const countPayload = {
    jsonrpc: '2.0', method: 'call', id: Date.now() + 1,
    params: {
      model: 'product.template',
      method: 'search_count',
      args: [domain],
      kwargs: {},
    },
  }

  const [recRes, cntRes] = await Promise.all([
    fetch(`${BASE}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(recordsPayload),
    }),
    fetch(`${BASE}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(countPayload),
    }),
  ])

  if (!recRes.ok) throw new Error(`HTTP ${recRes.status}: ${recRes.statusText}`)
  if (!cntRes.ok) throw new Error(`HTTP ${cntRes.status}: ${cntRes.statusText}`)

  const recJson = await recRes.json()
  const cntJson = await cntRes.json()

  // Check errors in either response
  for (const j of [recJson, cntJson]) {
    if (j.error) {
      const msg = j.error.data?.message || j.error.message || 'Odoo API error'
      if (j.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
        const err = new Error('SESSION_EXPIRED')
        err.isAuthError = true
        throw err
      }
      throw new Error(msg)
    }
  }

  return {
    total: cntJson.result ?? 0,
    records: recJson.result ?? [],
  }
}

// ── Branch Sales ──────────────────────────────────────────────

/**
 * Fetch sales data for Joah branches grouped by company.
 * @param {string} dateStart - Start date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {string} dateEnd - End date (YYYY-MM-DD HH:mm:ss in UTC)
 * @returns {Promise<Object[]>} array of aggregated sales per branch
 */
export async function fetchBranchSales(dateStart, dateEnd) {
  // Joah branch company IDs based on the provided session info
  const branchIds = [247, 248, 249, 261, 273];

  const domain = [
    ['company_id', 'in', branchIds],
    ['state', 'in', ['paid', 'done', 'invoiced']]
  ];

  if (dateStart) {
    domain.push(['date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order',
      method: 'read_group',
      args: [domain, ['amount_total', 'company_id'], ['company_id']],
      kwargs: {},
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  return json.result || [];
}

// ── Branch Detailed Orders ────────────────────────────────────

/**
 * Fetch detailed orders for a specific branch.
 * @param {number} branchId - The company_id of the branch
 * @param {string} dateStart - Start date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {string} dateEnd - End date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {number} limit - Number of recent orders to fetch
 * @returns {Promise<Object[]>}
 */
export async function fetchBranchOrders(branchId, dateStart, dateEnd, limit = 50) {
  const domain = [
    ['company_id', '=', branchId],
    ['state', 'in', ['paid', 'done', 'invoiced']]
  ];

  if (dateStart) {
    domain.push(['date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields: ['name', 'amount_total', 'date_order', 'pos_reference', 'partner_id', 'user_id', 'lines'],
        order: 'date_order desc',
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  return json.result || [];
}

/**
 * Fetch detailed order lines (items sold) for a set of line IDs.
 * @param {number[]} lineIds - Array of pos.order.line IDs
 * @returns {Promise<Object[]>}
 */
export async function fetchOrderLines(lineIds) {
  if (!lineIds || lineIds.length === 0) return [];

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order.line',
      method: 'search_read',
      args: [[['id', 'in', lineIds]]],
      kwargs: {
        fields: ['product_id', 'qty', 'price_unit', 'price_subtotal_incl'],
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
 * Fetch aggregated product sales for a branch using read_group.
 * @param {number} branchId - The company_id of the branch
 * @param {string} dateStart - Start date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {string} dateEnd - End date (YYYY-MM-DD HH:mm:ss in UTC)
 * @returns {Promise<Object[]>}
 */
// All Joah branch company IDs — passed in context so Odoo unlocks multi-company data
const ALL_JOAH_COMPANY_IDS = [8, 173, 241, 247, 248, 249, 261, 273]; // 173 = Phonsinuan, 8 = Vangxaiy

export async function fetchBranchProductSales(branchId, dateStart, dateEnd, filterJoahOnly = true) {
  const domain = [
    ['company_id', '=', branchId],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ];

  if (filterJoahOnly) {
    domain.push(['product_id.product_bu_id', '=', 9126]); // 🏷️ Filter Joah brand only
  }

  if (dateStart) {
    domain.push(['order_id.date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['order_id.date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order.line',
      method: 'read_group',
      args: [domain, ['product_id', 'qty', 'price_subtotal_incl'], ['product_id']],
      kwargs: {
        orderby: 'qty desc',
        // 🔑 THE KEY FIX: Tell Odoo to unlock all Joah branch companies
        context: {
          allowed_company_ids: ALL_JOAH_COMPANY_IDS
        }
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

  return (json.result || []).filter(item => item.product_id);
}

/**
 * Fetch detailed product sales (individual items) with timestamps.
 * @param {number} branchId - The company_id of the branch
 * @param {string} dateStart - Start date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {string} dateEnd - End date (YYYY-MM-DD HH:mm:ss in UTC)
 * @returns {Promise<Object[]>}
 */
export async function fetchDetailedProductSales(branchId, dateStart, dateEnd, filterJoahOnly = true) {
  const domain = [
    ['company_id', '=', branchId],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ];

  if (filterJoahOnly) {
    domain.push(['product_id.product_bu_id', '=', 9126]); // 🏷️ Filter Joah brand only
  }

  if (dateStart) {
    domain.push(['order_id.date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['order_id.date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order.line',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields: ['product_id', 'qty', 'price_subtotal_incl', 'create_date', 'order_id'],
        order: 'create_date desc',
        limit: 100000, // Limit removed/increased to prevent truncation on high volume days
        // 🔑 THE KEY FIX: Tell Odoo to unlock all Joah branch companies
        context: {
          allowed_company_ids: ALL_JOAH_COMPANY_IDS
        }
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

  return (json.result || []).filter(item => item.product_id);
}

/**
 * Fetch delta sales strictly by ID (100% accurate, no missed offline sales).
 * @param {number} branchId - The company_id of the branch
 * @param {number|null} lastProcessedId - The ID of the last pos.order.line we successfully synced
 * @returns {Promise<Object[]>}
 */
export async function fetchSyncDeltaSales(branchId, lastProcessedId) {
  const domain = [
    ['company_id', '=', branchId],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']]
  ];

  if (lastProcessedId) {
    domain.push(['id', '>', lastProcessedId]);
  }

  // 🛡️ เกราะป้องกันชั้นที่ 2: บังคับดึงยอดขายเฉพาะของ "วันนี้" (ตั้งแต่เที่ยงคืน) เท่านั้น
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  domain.push(['order_id.date_order', '>=', `${yyyy}-${mm}-${dd} 00:00:00`]);

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order.line',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields: ['id', 'product_id', 'qty', 'price_subtotal_incl', 'create_date', 'order_id'],
        order: 'id asc', // Crucial: Ascending so we don't skip middle records if we hit the limit
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
  if (json.error) throw new Error(json.error.data?.message || json.error.message || 'Odoo API error');

  return (json.result || []).filter(item => item.product_id);
}

/**
 * Fetch actual EAN13 barcodes for a list of product IDs from product.product.
 * This is needed because pos.order.line only gives us [internal_ref] in the name,
 * but the master data / store inventory uses EAN13 barcodes.
 * @param {number[]} productIds - Array of product IDs
 * @returns {Promise<Object>} Map of product_id -> barcode (EAN13)
 */
/**
 * Audit: Fetch order count & total grouped by STATE for a branch.
 * This reveals cancelled/draft orders that are invisible in normal reports.
 * @param {number} branchId - The company_id of the branch
 * @param {string} dateStart - Start date (YYYY-MM-DD HH:mm:ss in UTC)
 * @param {string} dateEnd - End date (YYYY-MM-DD HH:mm:ss in UTC)
 * @returns {Promise<Object[]>} array of { state, amount_total, __count }
 */
export async function fetchOrderStateAudit(branchId, dateStart, dateEnd) {
  // NO state filter — we want to see ALL states including cancel, draft
  const domain = [
    ['company_id', '=', branchId],
  ];

  if (dateStart) {
    domain.push(['date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order',
      method: 'read_group',
      args: [domain, ['amount_total', 'state'], ['state']],
      kwargs: {
        context: {
          allowed_company_ids: ALL_JOAH_COMPANY_IDS
        }
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
 * Fetch daily sales summary for the last 14 days using read_group
 */
export async function fetchDailySales(branchId, dateStartStr, dateEndStr, filterJoahOnly = true) {
  // ── Query 1: Orders (bills) to get their true date_order ─────────────────
  const orderDomain = [
    ['company_id', '=', branchId],
    ['state', 'in', ['paid', 'done', 'invoiced']],
  ];
  if (dateStartStr) orderDomain.push(['date_order', '>=', dateStartStr]);
  if (dateEndStr)   orderDomain.push(['date_order', '<=', dateEndStr]);

  const orderPayload = {
    jsonrpc: '2.0', method: 'call', id: Date.now(),
    params: {
      model: 'pos.order',
      method: 'search_read',
      args: [orderDomain],
      kwargs: { fields: ['id', 'date_order', 'amount_total'], limit: 100000 },
    },
  };

  // ── Query 2: Sales lines (for revenue) ───────────────────────────────────
  const lineDomain = [
    ['company_id', '=', branchId],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ];
  if (filterJoahOnly) lineDomain.push(['product_id.product_bu_id', '=', 9126]);
  if (dateStartStr) lineDomain.push(['order_id.date_order', '>=', dateStartStr]);
  if (dateEndStr)   lineDomain.push(['order_id.date_order', '<=', dateEndStr]);

  const linePayload = {
    jsonrpc: '2.0', method: 'call', id: Date.now() + 1,
    params: {
      model: 'pos.order.line',
      method: 'search_read',
      args: [lineDomain],
      kwargs: { fields: ['id', 'price_subtotal_incl', 'order_id'], limit: 100000 },
    },
  };

  // ── Fire both in parallel ───────────────────────────────────────────────
  const [orderRes, lineRes] = await Promise.all([
    fetch(`${BASE}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(orderPayload),
    }),
    fetch(`${BASE}/web/dataset/call_kw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(linePayload),
    })
  ]);

  if (!orderRes.ok) throw new Error(`HTTP ${orderRes.status}`);
  if (!lineRes.ok)  throw new Error(`HTTP ${lineRes.status}`);

  const orderJson = await orderRes.json();
  const lineJson  = await lineRes.json();

  if (orderJson.error) throw new Error(orderJson.error.data?.message || 'API error');
  if (lineJson.error)  throw new Error(lineJson.error.data?.message || 'API error');

  const orders = orderJson.result || [];
  const lines  = lineJson.result  || [];

  // ── Manual Grouping in JS ────────────────────────────────────────────────
  // Convert UTC date_order to Asia/Vientiane day string (e.g., "15 Jun 2026")
  // Always pin to Asia/Vientiane regardless of user's computer timezone.
  const getLocalDayStr = (utcStr) => {
    if (!utcStr) return 'Unknown';
    const d = new Date(utcStr.replace(' ', 'T') + 'Z');
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Vientiane',
    });
  };

  const orderMap = {}; // order_id -> dayStr
  const dailyStats = {}; // dayStr -> { price_subtotal_incl, order_count, sku_count, _seen_orders: Set }

  orders.forEach(o => {
    const dayStr = getLocalDayStr(o.date_order);
    orderMap[o.id] = dayStr;
    
    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = { price_subtotal_incl: 0, order_count: 0, sku_count: 0, _seen_orders: new Set() };
    }
    // If NOT filtering Joah, count all orders here
    if (!filterJoahOnly) {
      dailyStats[dayStr].order_count += 1;
    }
  });

  lines.forEach(l => {
    const oId = l.order_id && l.order_id[0];
    if (!oId) return;
    
    const dayStr = orderMap[oId];
    if (!dayStr) return; // Line's order is outside our range (shouldn't happen but safe)

    if (!dailyStats[dayStr]) {
      dailyStats[dayStr] = { price_subtotal_incl: 0, order_count: 0, sku_count: 0, _seen_orders: new Set() };
    }

    dailyStats[dayStr].price_subtotal_incl += (l.price_subtotal_incl || 0);
    dailyStats[dayStr].sku_count += 1;

    // If filtering Joah, count unique orders that contain Joah lines
    if (filterJoahOnly) {
      if (!dailyStats[dayStr]._seen_orders.has(oId)) {
        dailyStats[dayStr]._seen_orders.add(oId);
        dailyStats[dayStr].order_count += 1;
      }
    }
  });

  // Convert map to array format expected by the frontend
  return Object.entries(dailyStats).map(([dayStr, stats]) => ({
    'create_date:day': dayStr, // Keep key name so OdooSalesViewer doesn't break
    price_subtotal_incl: stats.price_subtotal_incl,
    order_count: stats.order_count,
    sku_count: stats.sku_count,
  }));
}

/**
 * Audit: Fetch detailed cancelled/draft orders for a branch.
 * @param {number} branchId - The company_id of the branch
 * @param {string} dateStart - Start date
 * @param {string} dateEnd - End date
 * @returns {Promise<Object[]>}
 */
export async function fetchAbnormalOrders(branchId, dateStart, dateEnd) {
  const domain = [
    ['company_id', '=', branchId],
    ['state', 'not in', ['paid', 'done', 'invoiced']],
  ];

  if (dateStart) {
    domain.push(['date_order', '>=', dateStart]);
  }
  if (dateEnd) {
    domain.push(['date_order', '<=', dateEnd]);
  }

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields: ['name', 'pos_reference', 'amount_total', 'amount_tax', 'date_order', 'state', 'user_id', 'lines'],
        order: 'date_order desc',
        limit: 200,
        context: {
          allowed_company_ids: ALL_JOAH_COMPANY_IDS
        }
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

export async function fetchProductBarcodes(productIds) {
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

  // Build a map: product_id -> barcode (EAN13)
  const barcodeMap = {};
  (json.result || []).forEach(product => {
    if (product.barcode) {
      barcodeMap[product.id] = product.barcode;
    }
  });

  return barcodeMap;
}


/**
 * Fetch Inventory Overview picking types (stock.picking.type)
 * @returns {Promise<Object[]>} List of picking types for Inventory Overview
 */
export async function fetchInventoryOverview(allowedCompanyIds = null) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.picking.type',
      method: 'web_search_read',
      args: [],
      kwargs: {
        domain: [],
        specification: {
          id: {},
          color: {},
          code: {},
          count_move_ready: {},
          show_picking_type: {},
          is_favorite: {},
          name: {},
          warehouse_id: { fields: { display_name: {} } },
          count_picking_batch: {},
          count_picking_ready: {},
          count_picking_waiting: {},
          count_picking_late: {},
          count_picking_backorders: {},
          count_picking_wave: {},
          kanban_dashboard_graph: {},
          count_mo_todo: {},
          count_mo_waiting: {},
          count_mo_late: {},
          count_mo_in_progress: {},
          count_mo_to_close: {}
        },
        ...(Array.isArray(allowedCompanyIds) && allowedCompanyIds.length > 0 ? { context: { allowed_company_ids: allowedCompanyIds } } : {})
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  const result = json.result;
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.records)) return result.records;
  return [];
}

/**
 * Fetch stock.picking records for a given picking_type_id (drill-down from Inventory Overview card)
 * @param {number} pickingTypeId - The id of the stock.picking.type
 * @param {number} limit - Max records to fetch
 * @returns {Promise<{records: Object[], length: number}>}
 */
export async function fetchPickingsByType(pickingTypeId, limit = 80) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.picking',
      method: 'web_search_read',
      args: [],
      kwargs: {
        domain: [['picking_type_id', '=', pickingTypeId]],
        specification: {
          id: {},
          name: {},
          company_id: { fields: { display_name: {} } },
          location_id: { fields: { display_name: {} } },
          location_dest_id: { fields: { display_name: {} } },
          partner_id: { fields: { display_name: {} } },
          user_id: { fields: { display_name: {} } },
          scheduled_date: {},
          date_done: {},
          origin: {},
          state: {},
          picking_type_code: {},
          batch_id: { fields: { display_name: {} } },
          picking_type_id: { fields: { display_name: {} } },
        },
        limit,
        order: 'scheduled_date desc',
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  const result = json.result;
  if (Array.isArray(result)) return { records: result, length: result.length };
  if (result && Array.isArray(result.records)) return { records: result.records, length: result.length || result.records.length };
  return { records: [], length: 0 };
}

/**
 * Fetch detailed single stock.picking record including its products/moves (move_ids_without_package)
 * @param {number} pickingId - The ID of stock.picking record
 * @returns {Promise<Object>}
 */
export async function fetchPickingDetail(pickingId) {
  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'stock.picking',
      method: 'web_read',
      args: [[pickingId]],
      kwargs: {
        specification: {
          id: {},
          name: {},
          state: {},
          scheduled_date: {},
          date_done: {},
          origin: {},
          location_id: { fields: { display_name: {} } },
          location_dest_id: { fields: { display_name: {} } },
          partner_id: { fields: { display_name: {} } },
          user_id: { fields: { display_name: {} } },
          company_id: { fields: { display_name: {} } },
          picking_type_id: { fields: { display_name: {} } },
          move_ids_without_package: {
            fields: {
              id: {},
              name: {},
              barcode: {},
              product_id: { fields: { display_name: {} } },
              product_uom_qty: {},
              quantity: {},
              product_uom: { fields: { display_name: {} } },
              state: {},
              image_1920: {}
            }
          }
        }
      }
    }
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  const result = json.result;
  if (Array.isArray(result) && result.length > 0) return result[0];
  return result;
}


// ── CheckPrice ULTIMATE (Read-Only Product Details) ───────────

/**
 * Fetch rich product details for CheckPrice ULTIMATE.
 * Queries product.template or product.product safely with comprehensive fields.
 * @param {string} searchTerm - Barcode or Default Code (SKU)
 * @returns {Promise<Object|null>}
 */
export async function fetchProductUltimate(searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return null;
  const term = searchTerm.trim();

  // Search domain matching barcode, default_code, or exact name
  const domain = [
    '|',
    ['barcode', '=', term],
    ['default_code', '=', term]
  ];

  const fields = [
    'id',
    'name',
    'display_name',
    'product_name_la',
    'product_name_eng',
    'default_code',
    'barcode',
    'list_price',
    'standard_price',
    'qty_available',
    'virtual_available',
    'uom_id',
    'uom_name',
    'categ_id',
    'product_brand_id',
    'product_owner',
    'vendor_code',
    'vendor_current_status',
    'packing_size',
    'packing_size_qty',
    'dc_min_stock',
    'min_order_pcs',
    'replenishment_type',
    'available_in_pos',
    'sale_ok',
    'active',
    'currency_id',
    'write_date',
    'product_variant_id',
    'image_1920',
    'image_512',
    'image_128'
  ];

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'product.template',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields,
        limit: 1,
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
    const msg = json.error.data?.message || json.error.message || 'Odoo API error';
    if (json.error.code === 100 || msg.includes('session') || msg.includes('Access Denied')) {
      const err = new Error('SESSION_EXPIRED');
      err.isAuthError = true;
      throw err;
    }
    throw new Error(msg);
  }

  const results = json.result;
  if (!Array.isArray(results) || results.length === 0) {
    // If not found in product.template, try product.product as fallback
    return await fetchProductProductUltimate(term);
  }

  return results[0];
}

async function fetchProductProductUltimate(term) {
  const domain = [
    '|',
    ['barcode', '=', term],
    ['default_code', '=', term]
  ];

  const fields = [
    'id',
    'name',
    'display_name',
    'default_code',
    'barcode',
    'list_price',
    'standard_price',
    'qty_available',
    'virtual_available',
    'uom_id',
    'uom_name',
    'categ_id',
    'product_tmpl_id',
    'write_date'
  ];

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'product.product',
      method: 'search_read',
      args: [domain],
      kwargs: {
        fields,
        limit: 1,
      },
    },
  };

  const response = await fetch(`${BASE}/web/dataset/call_kw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  if (!response.ok) return null;
  const json = await response.json();
  if (json.error || !json.result || json.result.length === 0) return null;

  return json.result[0];
}
