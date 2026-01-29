-- 1. Create Employees table (if not exists)
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Clean table before inserting specific approved users (Optional - based on requirement to have ONLY these users)
-- TRUNCATE employees; 

-- 3. Insert or Update specific approved users
INSERT INTO employees (employee_id, name, role)
VALUES 
('k2411149', 'Mr. khamphout kiettimoungkhoun', 'staff'),
('k2412084', 'Mr. Khunthavong sayyavongsa', 'staff'),
('k2508142', 'Mr. Chanthavisouk Aiyyavong', 'staff'),
('k2507171', 'Mr. DiDar keopaserd', 'staff')
ON CONFLICT (employee_id) 
DO UPDATE SET name = EXCLUDED.name;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- 5. Create Policy to ensure data is read-only for public (simplest for this app context)
-- Or restricted to authenticated users if Supabase Auth is fully implemented
CREATE POLICY "Enable read access for all users" ON employees FOR SELECT USING (true);
