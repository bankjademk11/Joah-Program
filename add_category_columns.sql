-- เพิ่ม columns สำหรับบันทึกการเปลี่ยนแปลง Category
-- รันสคริปต์นี้ใน Supabase SQL Editor

ALTER TABLE inventory_history 
ADD COLUMN IF NOT EXISTS old_category_1 text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS new_category_1 text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS old_category_2 text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS new_category_2 text DEFAULT NULL;

-- ตรวจสอบว่าเพิ่มสำเร็จ
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_history' 
  AND column_name LIKE '%category%'
ORDER BY ordinal_position;
