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
        limit: 1000, // Limit to prevent massive payload
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
  const domain = [
    ['company_id', '=', branchId],
    ['order_id.state', 'in', ['paid', 'done', 'invoiced']],
  ];

  if (filterJoahOnly) {
    domain.push(['product_id.product_bu_id', '=', 9126]);
  }

  if (dateStartStr) domain.push(['order_id.date_order', '>=', dateStartStr]);
  if (dateEndStr) domain.push(['order_id.date_order', '<=', dateEndStr]);

  const payload = {
    jsonrpc: '2.0',
    method: 'call',
    id: Date.now(),
    params: {
      model: 'pos.order.line',
      method: 'read_group',
      args: [domain, ['price_subtotal_incl'], ['create_date:day']],
      kwargs: {
        context: {
          allowed_company_ids: ALL_JOAH_COMPANY_IDS,
          tz: 'Asia/Vientiane' // Extremely important for correct day grouping!
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

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  if (json.error) throw new Error(json.error.data?.message || 'API error');

  return json.result || [];
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
