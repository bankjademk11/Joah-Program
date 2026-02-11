# Warehouse Rack Validator (Joah Tools)

ລະບົບກວດສອບຄວາມຖືກຕ້ອງຂອງຂໍ້ມູນໂລເຄຊັ້ນ Rack ໃນສາງສິນຄ້າ (Warehouse Validation Tool).

## 🌟 ຄຸນສົມບັດ (Features)

1.  **ກວດສອບຂໍ້ມູນ (Validation):**
    *   ກວດສອບ Barcode, Rack Location, Category-1, Category-2
    *   ແຈ້ງເຕือนເມື່ອຂໍ້ມູນບໍ່ກົງກັນ (Mismatch) ຫຼື ບໍ່ພົບຂໍ້ມູນ (Missing)
2.  **ໂຫມດການດຶງຂໍ້ມູນ:**
    *   **Manual Upload:** ອັບໂຫຼດໄຟລ໌ Excel ທີ່ມີທັງ Sheet "Location" ແລະ "DATA"
    *   **Internal Database:** ດຶງຂໍ້ມູນຈາກຖານຂໍ້ມູນກາງ (`DataBaseJoah.xlsx`) ໂດຍອັດຕະໂນມັດ
3.  **Smart Tooltip:**
    *   ສະແດງຂໍ້ມູນທີ່ຖືກຕ້ອງເມື່ອເອົາເມາສ໌ຊີ້ໃສ່ລາຍການທີ່ຜິດພາດ
4.  **Export Report:**
    *   ສົ່ງອອກຜົນການກວດສອບເປັນ Excel ພ້ອມແຍກສີ (ຂຽວ/ແດງ/ຟ້າ) ແລະ ວັນທີ່ກວດສອບ

---

## 📂 ການອັບເດດຖານຂໍ້ມູນ (Database Update)

ຫາກຕ້ອງການອັບເດດຂໍ້ມູນສິນຄ້າຫຼັກ (Master Data) ໃຫ້ກັບລະບົບ ເພື່ອໃຫ້ປຸ່ມ **"ໃຊ້ຖານຂໍ້ມູນຫຼັກ"** ດຶງຂໍ້ມູນລ່າສຸດ:

1.  ກຽມໄຟລ໌ Excel ທີ່ມີຂໍ້ມູນ Sheet **"DATA"**
2.  ປ່ຽນຊື່ໄຟລ໌ເປັນ **`DataBaseJoah.xlsx`** (ຕ້ອງຊື່ນີ້ເປະໆ)
3.  ນຳໄປວາງທັບໄຟລ໌ເກົ່າທີ່ໂຟນເດີ:
    > **`public/DataBaseJoah.xlsx`**
    
    *(ຫາກ Deploy ແລ້ວ ໃຫ້ນຳໄປວາງໃນໂຟນເດີ Root ຫຼື Public ຂອງ Server)*

4.  Refresh ຫນ້າເວັບ ຂໍ້ມູນຈະຖືກອັບເດດທັນທີ

---

## 🚀 ການຕິດຕັ້ງແລະຣັນ (Installation)

1.  ຕິດຕັ້ງ Dependencies:
    ```bash
    npm install
    ```
2.  ຣັນໂປຣແກຣມ (Development):
    ```bash
    npm run dev
    ```
3.  ສ້າງໄຟລ໌ສຳລັບ Deploy (Production):
    ```bash
    npm run build
    ```
