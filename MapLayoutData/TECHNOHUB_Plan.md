# 🖥️ TECHNOHUB — แผนการพัฒนาระบบตรวจสอบสินค้า

## ✅ สถานะโดยรวม
| Step | รายการ | สถานะ |
|------|--------|--------|
| 1 | เพิ่ม Column `source` ใน Supabase `master_data` | ✅ Done |
| 2 | ทดสอบ Insert Mockup TECHNOHUB data | ✅ Done |
| 3 | สร้างฟังก์ชัน Import Master Data ผ่าน Excel | 🔜 TODO |
| 4 | สร้างหน้า UI สำหรับ Import (เลือกไฟล์ + preview) | 🔜 TODO |
| 5 | เชื่อมระบบตรวจสอบสินค้ากับ TECHNOHUB master | 🔜 TODO |
| 6 | ทดสอบ End-to-End | 🔜 TODO |

---

## 📋 Step 1 — Database (✅ Done)

### SQL ที่รันแล้ว
```sql
ALTER TABLE master_data
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL;

COMMENT ON COLUMN master_data.source IS 'ระบุแหล่งที่มาของ master data เช่น TECHNOHUB, JOAH ถ้าเป็น NULL = JOAH (ค่าเดิม)';
```

### โครงสร้าง `master_data` ปัจจุบัน
| Column | Type | หมายเหตุ |
|--------|------|----------|
| `barcode` | TEXT | PK ร่วมกับ branch_id |
| `product_name_la` | TEXT | ชื่อสินค้าภาษาลาว |
| `item_name` | TEXT | ชื่อสินค้า |
| `category_1` | TEXT | หมวดหมู่ 1 |
| `category_2` | TEXT | หมวดหมู่ 2 |
| `qty` | INT | จำนวน |
| `branch_id` | TEXT | สาขา (normalize → ຕະຫຼາດລາວ) |
| `source` | TEXT | **ใหม่!** `NULL` = JOAH, `'TECHNOHUB'` = TECHNOHUB |

### ข้อสำคัญ
- ข้อมูลเก่าของ JOAH ทั้งหมด `source = NULL` (ไม่กระทบ)
- เฉพาะ Record ที่ Import จาก TECHNOHUB เท่านั้น จะมี `source = 'TECHNOHUB'`

---

## 📋 Step 3 — ฟังก์ชัน Import Excel (🔜 TODO)

### แผนการทำงาน
```
User เลือกไฟล์ Excel ของ TECHNOHUB
    ↓
ระบบอ่าน Header ของ Excel
    ↓
Map Header → Column ใน master_data
    ↓
syncMasterDataToSupabase(data, branchId, source='TECHNOHUB')
    ↓
บันทึกลง Supabase พร้อม source = 'TECHNOHUB'
```

### สิ่งที่ต้องรู้ก่อน Implement
- [ ] Header ของ Excel TECHNOHUB มีชื่อว่าอะไร? (Barcode, Product Name, Category ฯลฯ)
- [ ] ผู้ใช้ระบุว่าเป็นไฟล์ TECHNOHUB ด้วยวิธีไหน? (Toggle / เมนูแยก / ชื่อไฟล์?)
- [ ] TECHNOHUB ใช้ `branch_id` เดียวกับ JOAH (`ຕະຫຼາດລາວ`) หรือมี branch_id ใหม่?

### ไฟล์ที่ต้องแก้ไข
- `src/utils/supabaseSync.js` — เพิ่ม parameter `source` ใน `syncMasterDataToSupabase`
- `src/utils/excelProcessor.js` — อาจต้อง Map Header ของ TECHNOHUB เพิ่ม
- หน้า UI ที่เกี่ยวข้อง — เพิ่มปุ่ม/ตัวเลือก Import TECHNOHUB

---

## 📋 Step 4 — UI (🔜 TODO)

### หน้าที่ควรมี
1. **Upload Zone** — ลาก/เลือกไฟล์ Excel ของ TECHNOHUB
2. **Preview Table** — แสดงข้อมูลก่อน Import (กี่ Row, Header ตรงไหม)
3. **Confirm Button** — ยืนยัน Import → เขียนลง Supabase
4. **Result Summary** — แสดงว่า Insert/Update กี่ Record

---

## 🗒️ หมายเหตุเพิ่มเติม
- Mockup data สำหรับทดสอบ (บันทึกไว้): barcode THB-0001 ถึง THB-0005  
- ลบ Mockup data ออกก่อน Go Live จริง:
  ```sql
  DELETE FROM master_data WHERE source = 'TECHNOHUB' AND barcode LIKE 'THB-%';
  ```
