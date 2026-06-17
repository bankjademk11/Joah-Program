# 🚀 Odoo API to Supabase Sync: Implementation Plan

## 1. Project Context & Objectives
**Background**: 
The `Odoo API` project has successfully implemented read-only JSON-RPC queries to fetch real-time POS sales data directly from Odoo. 
Currently, the `warehouse-validator` project handles store-front inventory, but stock deduction relies on manual Excel/CSV exports from Odoo.

**Objective**: 
Automate the store-front inventory deduction process by integrating the `Odoo API` logic into the `warehouse-validator` project. We will automatically fetch aggregated product sales from Odoo, deduct the quantities from the Supabase store inventory, and maintain a strict **Sync History/Log Table** for auditing and Excel reporting.

---

## 2. Odoo API Data Structure (What we get from Odoo)
We use the `read_group` method on the `pos.order.line` model. This efficiently returns the total quantity sold per product, per branch, within a specific timeframe.

**Query Parameters:**
- `model`: `pos.order.line`
- `domain`: `[['company_id', '=', branchId], ['order_id.state', 'in', ['paid', 'done', 'invoiced']], ['order_id.date_order', '>=', dateStart], ['order_id.date_order', '<=', dateEnd]]`
- `groupby`: `['product_id']`

**Example Odoo Response:**
```json
[
  {
    "product_id": [1075, "Lay's Classic 50g"],
    "qty": 45,
    "price_subtotal_incl": 225000.0,
    "product_id_count": 12
  },
  {
    "product_id": [884, "Coca Cola 325ml"],
    "qty": 120,
    "price_subtotal_incl": 600000.0,
    "product_id_count": 30
  }
]
```

---

## 3. Database Schema: Sync Log Table (Supabase)
To ensure every deduction is tracked and can be audited per branch, we will create a dedicated log table.

**Execute this in Supabase SQL Editor:**
```sql
CREATE TABLE pos_sales_sync_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sync_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- When the sync occurred
    branch_id INT,                                         -- Odoo Company ID (e.g., 247 for Phonsinuan)
    branch_name TEXT,                                      -- Name of the branch
    product_odoo_id INT,                                   -- Odoo Product ID
    product_name TEXT,                                     -- Name of the product
    qty_deducted NUMERIC,                                  -- Quantity sold/deducted
    total_sales_amount NUMERIC,                            -- Revenue from these items
    sync_period_start TIMESTAMP WITH TIME ZONE,            -- The start time of the Odoo filter
    sync_period_end TIMESTAMP WITH TIME ZONE,              -- The end time of the Odoo filter
    sync_status TEXT DEFAULT 'SUCCESS',                    -- SUCCESS or FAILED
    remarks TEXT                                           -- Optional notes
);

-- Index for faster filtering on history page
CREATE INDEX idx_pos_logs_branch ON pos_sales_sync_logs(branch_name);
CREATE INDEX idx_pos_logs_date ON pos_sales_sync_logs(sync_timestamp);
```

---

## 4. Implementation Steps for `warehouse-validator` Agent

### Phase 1: The Sync Engine (Logic)
1. **Fetch Last Sync Time**: Query `pos_sales_sync_logs` to find the `sync_period_end` of the last successful sync for a specific branch. If none exists, default to start of the day.
2. **Fetch Odoo Sales**: Use the `Odoo API` code to fetch aggregated sales from the Last Sync Time until `NOW()`.
3. **Database Transaction (Deduction & Logging)**:
   - Loop through the Odoo response array.
   - For each product, `UPDATE` the main store inventory table by subtracting `qty`.
   - `INSERT` a record into `pos_sales_sync_logs` documenting the exact deduction.

### Phase 2: The History & Export UI (Frontend)
1. **Component**: Create `StoreSyncHistory.jsx`.
2. **Data Fetching**: Pull data from `pos_sales_sync_logs`, ordered by `sync_timestamp DESC`.
3. **Filters**: Add Dropdowns/Inputs to filter by `branch_name`, `date range`, and `product_name`.
4. **Export to Excel**:
   - Add an "Export to Excel" button.
   - Use the `xlsx` library (or convert JSON to CSV blob) to download the currently filtered logs.
   - This empowers the accounting/audit team to verify missing stock against POS sales.

---

## 5. Security & Safety Notes
- **Odoo Safety**: All Odoo operations MUST remain `search_read` or `read_group`. Never attempt to `create` or `write` to Odoo to avoid disrupting live POS operations.
- **Idempotency**: Ensure that if a sync fails midway, it does not double-deduct quantities upon retry. Tracking the exact `dateStart` and `dateEnd` of each sync block is crucial.
