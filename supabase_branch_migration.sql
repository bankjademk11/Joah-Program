-- ============================================================
-- JOAH Multi-Branch Migration Script
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Step 1: Add branch_id to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';

-- Step 2: Add branch_id to operational tables
ALTER TABLE location_inventory  ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE inventory_history   ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE added_items_log     ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE odoo_stocks         ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE store_requests      ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';

-- Step 3: Add branch_id to master data tables
ALTER TABLE master_data          ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE master_products      ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';
ALTER TABLE master_products_logs ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'ຕະຫຼາດລາວ';

-- Step 4: Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_inventory_branch   ON location_inventory(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_history_branch    ON inventory_history(branch_id);
CREATE INDEX IF NOT EXISTS idx_added_items_log_branch      ON added_items_log(branch_id);
CREATE INDEX IF NOT EXISTS idx_odoo_stocks_branch          ON odoo_stocks(branch_id);
CREATE INDEX IF NOT EXISTS idx_store_requests_branch       ON store_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_master_data_branch          ON master_data(branch_id);
CREATE INDEX IF NOT EXISTS idx_master_products_branch      ON master_products(branch_id);
CREATE INDEX IF NOT EXISTS idx_master_products_logs_branch ON master_products_logs(branch_id);

-- ============================================================
-- Step 5: FIX EXISTING DATA → tag all current data as ຕະຫຼາດລາວ
-- ⚠️ ຂໍ້ມູນທີ່ມີຢູ່ທັງໝົດເປັນຂອງ ຕະຫຼາດລາວ
-- ============================================================
UPDATE location_inventory  SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE inventory_history   SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE added_items_log     SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE odoo_stocks         SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE store_requests      SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE master_data         SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE master_products     SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';
UPDATE employees           SET branch_id = 'ຕະຫຼາດລາວ' WHERE branch_id IS NULL OR branch_id = 'ໂພນສີນວນ';

-- ============================================================
-- ລາຍຊື່ສາຂາທັງໝົດໃນລະບົບ (5 ສາຂາ/ສາງ):
--   1. ຕະຫຼາດລາວ
--   2. ສີວິໄລ
--   3. ວັງຊາຍ
--   4. ໂພນສີນວນ A  ← ສາງ A
--   5. ໂພນສີນວນ B  ← ສາງ B
--
-- ⚠️ ໂພນສີນວນ A ແລະ B ພະນັກງານຕ້ອງ Register ໃໝ່ດ້ວຍ branch ທີ່ຖືກຕ້ອງ
-- ============================================================
-- Verify:
-- SELECT branch_id, COUNT(*) FROM location_inventory GROUP BY branch_id;
-- SELECT branch_id, COUNT(*) FROM master_data GROUP BY branch_id;
-- SELECT branch_id, COUNT(*) FROM employees GROUP BY branch_id;
-- ============================================================

