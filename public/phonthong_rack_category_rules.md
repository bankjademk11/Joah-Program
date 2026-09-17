# กฎการจับสินค้าเข้า Rack Location

## สาขาที่รองรับ

เอกสารนี้ใช้กับสาขาเดียวเท่านั้น:

```text
branch_id = ໂພນຕ້ອງ
```

ข้อมูลของสาขาอื่น เช่น `ເມກ້າມໍ` และ `ເທຣນນິ້ງ (Training)` ไม่ถูกนำมาใช้ในกฎชุดนี้ และไม่ควรถูกนำมาปะปนกับข้อมูลของสาขา `ໂພນຕ້ອງ`.

## หลักการสำคัญ

ระบบจะ map สินค้าเข้า `rack_location` จากข้อมูลที่ยืนยันได้ในลำดับต่อไปนี้:

1. ตรวจว่า `branch_id` เป็น `ໂພນຕ້ອງ` หรือไม่
2. ตรวจ `category_1` ให้ตรงกับหมวดหมู่ของ Rack
3. ตรวจ `category_2` กับกฎย่อยที่ได้จาก Layout
4. ถ้ามี Rack เดียวที่ตรงกัน จึงคืนค่า `rack_location`
5. ถ้ามีหลาย Rack ที่ตรงกัน ระบบจะคืนค่าเป็น `NULL` จนกว่าจะมีกฎเพิ่มเติมที่ใช้แยกสินค้าได้
6. ถ้าไม่มี `category_2` หรือไม่มีหลักฐานพอ ระบบจะคืนค่าเป็น `NULL`
7. ห้ามเดา Rack จากชื่อสินค้า, barcode หรือความใกล้เคียงของชื่อหมวดหมู่

> `NULL` หมายถึง “ยังไม่มีข้อมูลเพียงพอสำหรับการกำหนด Rack” ไม่ได้หมายความว่าสินค้าผิดหรือไม่มีสินค้าในสาขา

## ข้อมูลที่ใช้ในการ map

ตารางสินค้า `public.master_data` มีข้อมูลหมวดหมู่ดังนี้:

| ฟิลด์ | ความหมาย |
|---|---|
| `barcode` | รหัสสินค้า |
| `category_1` | หมวดหมู่หลัก |
| `category_2` | หมวดหมู่ย่อย |
| `branch_id` | สาขาของสินค้า |
| `rack_location` | ฟิลด์ปลายทางสำหรับตำแหน่ง Rack หากมีในตารางหรือ view ที่ใช้งานจริง |

Rack master ที่ส่งมาเดิมมีฟิลด์ `Category`, `Zone` และ `Rack` แต่ไม่มี `Category 2` ดังนั้นการเติม `category_2` จะทำได้เฉพาะรายการที่มีข้อมูลยืนยันจาก Layout เท่านั้น.

## Rack master ของสาขาໂພນຕ້ອງ

| Category | Zone | Rack range |
|---|---|---|
| `KITCHEN` | A | `JMPT. A-1` ถึง `JMPT. A-8` |
| `KITCHEN` | B | `JMPT. B-1` ถึง `JMPT. B-8` |
| `CLEANING` | C | `JMPT. C-1` ถึง `JMPT. C-8` |
| `TOOL/DIGITAL` | D | `JMPT. D-1` ถึง `JMPT. D-8` |
| `STATIONERY` | E | `JMPT. E-1` ถึง `JMPT. E-8` |
| `STATIONERY` | F | `JMPT. F-1` ถึง `JMPT. F-8` |
| `TOYS` | G | `JMPT. G-1` ถึง `JMPT. G-3` |
| `STORAGE` | G | `JMPT. G-4` ถึง `JMPT. G-11` |
| `FASHION` | G | `JMPT. G-12` ถึง `JMPT. G-14` |
| `INTERIOR` | G | `JMPT. G-15` ถึง `JMPT. G-17` |
| `CLEANING` | G | `JMPT. G-18` ถึง `JMPT. G-20` |

## กฎ Category 2 จาก Layout

รายการต่อไปนี้เป็นการถอดจาก Layout ที่ส่งมาโดยตรง ไม่ใช่การคาดเดาจากชื่อสินค้า.

### KITCHEN

| `category_2` | Rack location |
|---|---|
| `Food storage/Lunch box` | `JMPT. A-1` |
| `Kitchen cleaning` | `JMPT. A-2` |
| `Cooking utensils` | `JMPT. A-3` |
| `Cookware` | `JMPT. A-4` |
| `Glasses/Cups/Water Bottles` | `JMPT. A-5` |
| `Kitchen Disposables` | `JMPT. A-6` |
| `Paper Towels/Wraps` | `JMPT. A-7` |
| `Cutlery` | `JMPT. A-8` |
| `Sealed/Storage Containers` | `JMPT. B-1`, `B-2`, `B-3`, `B-4`, `B-6`, `B-7`, `B-8` |
| `Tableware/Bowls/Trays` | `JMPT. B-5` |

`Sealed/Storage Containers` มีหลาย Rack ตาม Layout จึงยังไม่ควรเลือก Rack เดียวโดยอัตโนมัติ. หากต้องการเลือกให้ละเอียดกว่านี้ ต้องมี rule เพิ่ม เช่น ขนาด, รุ่นสินค้า, barcode group หรือภาพจัดเรียงสินค้า.

### CLEANING

| `category_2` | Rack location |
|---|---|
| `Cleaning tools` | `JMPT. C-1`, `JMPT. C-8` |
| `Bathroom supplies` | `JMPT. C-2`, `JMPT. C-3` |
| `Laundry supplies` | `JMPT. C-4`, `JMPT. C-5` |
| `Towel` | `JMPT. C-6` |
| `Trash bin/Plastic bag` | `JMPT. C-7` |

`CLEANING/BATH` จากไฟล์สินค้าไม่ใช่ข้อความเดียวกับ `CLEANING` ใน Rack master. ระบบจึงไม่ควรเปลี่ยนชื่อให้เองโดยเงียบ ๆ. ควรสร้าง normalization rule ที่ได้รับการยืนยันก่อน หรือให้ `rack_location = NULL`.

### TOOL/DIGITAL

| `category_2` | Rack location |
|---|---|
| `Gardening tools` | `JMPT. D-1` |
| `Hard tools` | `JMPT. D-2`, `JMPT. D-3`, `JMPT. D-4` |
| `Small tools` | `JMPT. D-5` |
| `Computer` / `Computers` | `JMPT. D-6` |
| `Mobile Phone Accessories` | `JMPT. D-7`, `JMPT. D-8` |

ถ้าในข้อมูลใช้ `Computers` แต่ Layout ใช้ `Computer` ให้ถือเป็น **ชื่อที่ต้องตรวจสอบหรือ normalization ที่ต้องอนุมัติ**. ไม่ควรเปลี่ยนค่าในข้อมูลต้นฉบับโดยอัตโนมัติ.

### STATIONERY

| `category_2` | Rack location |
|---|---|
| `Art Supplies` | `JMPT. E-1` |
| `STICKER` / `Stickers` | `JMPT. E-2`, `JMPT. E-3` |
| `Letter envelope` / `Letters/Envelopes` | `JMPT. E-4` |
| `writing supplies` / `Writing Supplies` | `JMPT. E-5`, `JMPT. F-5` |
| `GIFT BAG` | `JMPT. E-6`, `JMPT. E-7` |
| `tape` / `Tape` | `JMPT. E-8` |
| `Diary/Note` / `Diaries/Notebooks/Memos` | `JMPT. F-1`, `JMPT. F-2`, `JMPT. F-3`, `JMPT. F-4` |
| `office supplies` / `Stationery/Office Supplies` | `JMPT. F-6`, `JMPT. F-7` |
| `school supplies` / `School Supplies` | `JMPT. F-8` |

`STATIONERY` มี Zone E และ F. เมื่อ `category_2` อยู่หลาย Rack ระบบต้องคืน `NULL` จนกว่าจะมีกฎแยกเพิ่มเติม.

## Zone G

Layout ระบุ Category และช่วง Rack แต่ไม่ได้ระบุ `category_2` ราย Rack ดังนี้:

| Category | Rack range | การกำหนด `rack_location` |
|---|---|---|
| `TOYS` | `JMPT. G-1` ถึง `JMPT. G-3` | `NULL` หากยังไม่มี cat2 rule ราย Rack |
| `STORAGE` | `JMPT. G-4` ถึง `JMPT. G-11` | `NULL` หากยังไม่มี cat2 rule ราย Rack |
| `FASHION` | `JMPT. G-12` ถึง `JMPT. G-14` | `NULL` หากยังไม่มี cat2 rule ราย Rack |
| `INTERIOR` | `JMPT. G-15` ถึง `JMPT. G-17` | `NULL` หากยังไม่มี cat2 rule ราย Rack |
| `CLEANING` | `JMPT. G-18` ถึง `JMPT. G-20` | `NULL` หากยังไม่มี cat2 rule ราย Rack |

การรู้ว่า Category อยู่ใน Zone G ยังไม่เพียงพอสำหรับการเลือก Rack เดียว. ระบบควรเก็บ Zone หรือ candidate range แยกไว้ได้ แต่ไม่ควรเขียนลง `rack_location` จนกว่าจะมีข้อมูล cat2 หรือ rule แยกที่ชัดเจน.

## กฎเมื่อไม่มี Category 2

กรณีใดกรณีหนึ่งต่อไปนี้ ให้กำหนด `rack_location = NULL`:

- `category_2` เป็น `NULL` หรือเป็นค่าว่าง
- `category_2` มีค่า `0` และยังไม่ได้ยืนยันว่า `0` เป็นหมวดสินค้าจริง
- `category_1` ไม่มีใน Rack master ของ `ໂພນຕ້ອງ`
- `category_1` มีชื่อไม่ตรงกับ Rack master และยังไม่มี normalization rule ที่ยืนยันแล้ว
- `category_2` ตรงกับหลาย Rack และยังไม่มีกฎแยกสินค้า
- Layout ระบุได้แค่ Zone หรือช่วง Rack
- สินค้ามีข้อมูลไม่ครบจนไม่สามารถตรวจสอบได้

ตัวอย่างผลลัพธ์:

```json
{
  "branch_id": "ໂພນຕ້ອງ",
  "category_1": "STORAGE",
  "category_2": null,
  "rack_location": null
}
```

## Pseudocode สำหรับระบบ Auto Mapping

```js
function mapRackLocation({ branchId, category1, category2 }) {
  if (branchId !== "ໂພນຕ້ອງ") {
    return null;
  }

  if (!category1 || !category2 || category2 === "0") {
    return null;
  }

  const candidates = rackRules
    .filter((rule) => rule.branch_id === "ໂພນຕ້ອງ")
    .filter((rule) => rule.category_1 === category1)
    .filter((rule) => rule.category_2 === category2)
    .map((rule) => rule.rack_location);

  const uniqueCandidates = [...new Set(candidates)];

  if (uniqueCandidates.length !== 1) {
    return null;
  }

  return uniqueCandidates[0];
}
```

กฎนี้ตั้งใจให้ปลอดภัย: ถ้าได้มากกว่าหนึ่งคำตอบจะไม่เลือกเอง.

## รูปแบบข้อมูล Rack Rule ที่แนะนำ

ควรเก็บกฎแยกจากข้อมูลสินค้า เพื่อแก้ไข Layout ได้โดยไม่ต้องแก้ข้อมูลสินค้าเดิม.

```text
branch_id
category_1
category_2
zone
rack_location
rule_status
source
```

ตัวอย่าง:

```text
ໂພນຕ້ອງ | KITCHEN | Cookware | A | JMPT. A-4 | confirmed | JOAH PHONTHONG LAYOUT
ໂພນຕ້ອງ | KITCHEN | Sealed/Storage Containers | B | NULL | pending_detail | JOAH PHONTHONG LAYOUT
ໂພນຕ້ອງ | STORAGE | NULL | G | NULL | missing_cat2 | JOAH PHONTHONG LAYOUT
```

## สิ่งที่ยังไม่ควรทำ

ไม่ควรใช้ `category_1` เพียงอย่างเดียวเพื่อเลือก Rack เดียว เพราะหลาย Category มีหลาย Rack. ไม่ควรใช้ข้อมูลจากสาขาอื่นมาเติม Rack ของ `ໂພນຕ້ອງ`. ไม่ควรเปลี่ยนค่า `category_1` หรือ `category_2` ใน master data เพียงเพื่อให้ match โดยไม่มีตาราง normalization ที่บันทึกเหตุผล.

## สรุป

สำหรับสาขา `ໂພນຕ້ອງ` สามารถเติม `category_2` จาก Layout ได้บางส่วน โดยเฉพาะ Rack A–F. ส่วน Rack G มีเพียง Category และช่วง Rack จึงยังไม่มีข้อมูลพอสำหรับการเลือก Rack รายสินค้า. ดังนั้นระบบควรกำหนด `rack_location` เป็น `NULL` เมื่อไม่มี `category_2`, เมื่อมีหลาย candidate หรือเมื่อ Layout ยังไม่ได้ระบุรายละเอียด.

แนวทางนี้ป้องกันไม่ให้สินค้าถูกจัดเข้าชั้นผิด และเปิดให้เพิ่ม rule ในภายหลังได้โดยไม่ต้องแก้ข้อมูลเดิม.

## References

[1]: /home/ubuntu/upload/pasted_content.txt "Branch rack configuration supplied by the user"

[2]: /home/ubuntu/upload/pasted_file_Zj64OT_image.png "JOAH PHONTHONG LAYOUT supplied by the user"
