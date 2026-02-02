-- คำสั่งสำหรับล้างข้อมูล Odoo ทั้งหมดในตาราง
TRUNCATE TABLE odoo_stocks RESTART IDENTITY;

-- หรือถ้าต้องการลบแบบธรรมดา (ไม่ reset ID)
-- DELETE FROM odoo_stocks;
