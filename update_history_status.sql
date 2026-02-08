-- สร้างคอลัมน์ details, old_rack, new_rack สำหรับรองรับฟีเจอร์ใหม่
-- (ไม่ต้องกังวลเรื่องข้อมูลเก่า รัน code นี้เพื่อให้ระบบใหม่บันทึกได้ก็พอครับ)

ALTER TABLE inventory_history 
ADD COLUMN IF NOT EXISTS details text DEFAULT NULL;

ALTER TABLE inventory_history 
ADD COLUMN IF NOT EXISTS old_rack text DEFAULT NULL;

ALTER TABLE inventory_history 
ADD COLUMN IF NOT EXISTS new_rack text DEFAULT NULL;
