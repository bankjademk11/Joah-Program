-- Create Master Products Table
CREATE TABLE IF NOT EXISTS master_products (
    id BIGSERIAL PRIMARY KEY,
    barcode_no TEXT UNIQUE NOT NULL,
    item_name TEXT NOT NULL,
    rack_location TEXT,
    category_1_actual TEXT,
    category_2_actual TEXT,
    qty NUMERIC DEFAULT 0,
    validation_status TEXT DEFAULT 'active',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by TEXT
);

-- Create index for faster barcode lookups
CREATE INDEX IF NOT EXISTS idx_master_products_barcode ON master_products(barcode_no);

-- Enable Row Level Security
ALTER TABLE master_products ENABLE ROW LEVEL SECURITY;

-- Create Policy for read access
CREATE POLICY "Enable read access for all users" ON master_products FOR SELECT USING (true);

-- Create Policy for insert access
CREATE POLICY "Enable insert for authenticated users" ON master_products FOR INSERT WITH CHECK (true);

-- Create Policy for update access
CREATE POLICY "Enable update for authenticated users" ON master_products FOR UPDATE USING (true);

-- Create Policy for delete access
CREATE POLICY "Enable delete for authenticated users" ON master_products FOR DELETE USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_master_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_master_products_updated_at ON master_products;
CREATE TRIGGER trigger_update_master_products_updated_at
    BEFORE UPDATE ON master_products
    FOR EACH ROW
    EXECUTE FUNCTION update_master_products_updated_at();
