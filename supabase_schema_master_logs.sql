-- Create Master Products Log Table for Audit History
CREATE TABLE IF NOT EXISTS master_products_logs (
    id BIGSERIAL PRIMARY KEY,
    operation_type TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    barcode_no TEXT,
    item_name TEXT,
    old_data JSONB,
    new_data JSONB,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE master_products_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for public" ON master_products_logs FOR ALL USING (true);

-- Function to handle auto-logging if we wanted database-level logs
-- But manual app-level logs are easier to control for now.
