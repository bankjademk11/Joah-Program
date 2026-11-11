import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase as defaultSupabase } from "../../utils/supabaseClient";
import {
  getPhonthongRackDecision,
  PHONTHONG_BRANCH,
  isPhonthongStyleBranch,
  getPhonthongStyleRackPrefix,
  inferCategory1FromCategory2,
  KOREAN_TO_ENGLISH_CATEGORY_1,
} from "../../utils/phonthongRackRules";

const DEFAULT_BRANCH = "ໂພນຕ້ອງ";
const BRANCH_OPTIONS = ["ໂພນຕ້ອງ", "JmartDD", "ໂພນສີນວນ", "ສີວິໄລ", "ວັງຊາຍ", "ຕະຫຼາດລາວ", "ເມກ້າມໍ"];
const BATCH_SIZE = 500;

const aliases = {
  barcode: [
    "barcode", "bar code", "sku", "barcode_no", "barcodeno", "code", "item code",
    "item_code", "default code", "default_code", "internal reference",
    "บาร์โค้ด", "ບາໂຄດ", "รหัสบาร์โค้ด", "รหัสสินค้า", "product barcode"
  ],
  item_name: [
    "description", "item name", "item_name", "product name", "product_name",
    "name", "ชื่อสินค้า", "ຊື່ສິນຄ້າ", "ລາຍການ", "ຊື່"
  ],
  product_name_la: [
    "lao description", "product name la", "product_name_la",
    "ຊື່ພາສາລາວ", "ຊື່ລາວ"
  ],
  category_1: [
    "categories 1", "category 1", "category_1", "cat1", "cat 1",
    "หมวดหมู่หลัก", "หมวดหมู่ 1", "ໝວດໝູ່ 1", "ໝວດ 1"
  ],
  category_2: [
    "categories 2", "category 2", "category_2", "cat2", "cat 2",
    "หมวดหมู่ย่อย", "หมวดหมู่ 2", "ໝວດໝູ່ 2", "ໝວດ 2"
  ],
};

const clean = (v) => String(v ?? "").trim();
const headerKey = (v) => clean(v).toLowerCase().replace(/[\s_-]+/g, "");
const text = (v) => clean(v).replace(/\.0+$/, "");

function mapColumns(headers) {
  const normalized = headers.map(headerKey);

  return Object.fromEntries(
    Object.entries(aliases).map(([field, names]) => [
      field,
      normalized.findIndex((h) => names.map(headerKey).includes(h)),
    ]),
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function formatFileSize(bytes) {
  if (!bytes) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function parseMasterSheet(sheet, branchId, source, updatedBy) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new Error("ບໍ່ພົບຂໍ້ມູນໃນໄຟລ໌");
  }

  let headerRowIndex = 0;
  let columns = mapColumns(matrix[0]);

  if (columns.barcode < 0) {
    for (let r = 1; r < Math.min(matrix.length, 15); r++) {
      const candidate = mapColumns(matrix[r]);
      if (candidate.barcode >= 0) {
        headerRowIndex = r;
        columns = candidate;
        break;
      }
    }
  }

  if (columns.barcode < 0) {
    throw new Error("ບໍ່ພົບຖັນ Barcode ໃນໄຟລ໌ (ກະລຸນາກວດສອບຫົວຕາຕະລາງ Barcode, ບາໂຄດ, บาร์โค้ด ຫຼື SKU)");
  }

  const records = new Map();

  let invalidRows = 0;
  let duplicateRows = 0;

  matrix.slice(headerRowIndex + 1).forEach((row) => {
    const barcode = text(row[columns.barcode]);

    if (!barcode && row.every((v) => !clean(v))) {
      return;
    }

    if (!barcode) {
      invalidRows += 1;
      return;
    }

    const record = {
      barcode,
      product_name_la:
        columns.product_name_la >= 0
          ? clean(row[columns.product_name_la]) || null
          : null,
      item_name:
        columns.item_name >= 0
          ? clean(row[columns.item_name]) || null
          : null,
      category_1:
        columns.category_1 >= 0
          ? clean(row[columns.category_1]) || null
          : null,
      category_2:
        columns.category_2 >= 0
          ? clean(row[columns.category_2]) || null
          : null,
      qty: 0,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy || "excel-import",
      branch_id: branchId,
      source: source || null,
    };

    const key = `${barcode}::${branchId}`;

    if (records.has(key)) {
      duplicateRows += 1;
    }

    records.set(key, record);
  });

  return {
    rows: [...records.values()],
    invalidRows,
    duplicateRows,
    totalRows: matrix.length - 1,
  };
}

const storeAliases = {
  barcode_no: [
    "barcode", "bar code", "sku", "barcode_no", "barcodeno", "code", "item code",
    "item_code", "default code", "default_code", "internal reference",
    "บาร์โค้ด", "ບາໂຄດ", "รหัสบาร์โค้ด", "รหัสสินค้า", "product barcode"
  ],
  item_name: [
    "description", "item name", "item_name", "product name", "product_name",
    "name", "ชื่อสินค้า", "ຊື່ສິນຄ້າ", "ລາຍການ", "ຊື່"
  ],
  store_qty: [
    "qty", "quantity", "store_qty", "store qty", "on hand", "on_hand",
    "จำนวน", "ຈຳນວນ", "ยอดคงเหลือ", "stock", "stock qty"
  ],
  shelf_location: [
    "shelf", "location", "shelf_location", "shelf location", "rack", "rack location",
    "rack_location", "ตู้", "ຊັ້ນ", "ໂລເຄຊັ່ນ", "ຕຳແໜ່ງ", "โล"
  ],
};

function mapStoreColumns(headers) {
  const normalized = headers.map(headerKey);
  return Object.fromEntries(
    Object.entries(storeAliases).map(([field, names]) => [
      field,
      normalized.findIndex((h) => names.map(headerKey).includes(h)),
    ]),
  );
}

export function parseStoreInventorySheet(sheet, branchId, source, updatedBy) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new Error("ບໍ່ພົບຂໍ້ມູນໃນໄຟລ໌");
  }

  let headerRowIndex = 0;
  let columns = mapStoreColumns(matrix[0]);

  if (columns.barcode_no < 0) {
    for (let r = 1; r < Math.min(matrix.length, 15); r++) {
      const candidate = mapStoreColumns(matrix[r]);
      if (candidate.barcode_no >= 0) {
        headerRowIndex = r;
        columns = candidate;
        break;
      }
    }
  }

  if (columns.barcode_no < 0) {
    throw new Error("ບໍ່ພົບຖັນ Barcode ໃນໄຟລ໌ (ຕ້ອງມີຄໍລຳ Barcode, ບາໂຄດ ຫຼື SKU)");
  }

  const records = new Map();
  let invalidRows = 0;
  let duplicateRows = 0;

  matrix.slice(headerRowIndex + 1).forEach((row) => {
    const barcode = text(row[columns.barcode_no]);

    if (!barcode && row.every((v) => !clean(v))) {
      return;
    }

    if (!barcode) {
      invalidRows += 1;
      return;
    }

    const qtyVal = columns.store_qty >= 0 ? parseFloat(clean(row[columns.store_qty])) : 0;
    const store_qty = isNaN(qtyVal) ? 0 : Math.round(qtyVal);

    const record = {
      barcode_no: barcode,
      item_name: columns.item_name >= 0 ? clean(row[columns.item_name]) || null : null,
      store_qty: store_qty,
      shelf_location: columns.shelf_location >= 0 ? clean(row[columns.shelf_location]) || null : null,
      branch_id: branchId,
      last_updated: new Date().toISOString(),
      updated_by: updatedBy || "store-excel-import",
    };

    const key = `${barcode}::${record.shelf_location || ""}::${branchId}`;

    if (records.has(key)) {
      duplicateRows += 1;
    }

    records.set(key, record);
  });

  return {
    rows: [...records.values()],
    invalidRows,
    duplicateRows,
    totalRows: matrix.length - 1,
  };
}

const salesAliases = {
  barcode_no: [
    "ບາໂຄດ 13 ຫຼັກ (barcode)", "ບາໂຄດ 13 ຫຼັກ", "barcode", "bar code", "sku", "barcode_no",
    "barcodeno", "code", "item code", "item_code", "default code",
    "บาร์โค้ด", "ບາໂຄດ", "รหัสบาร์โค้ด", "รหัสสินค้า", "product barcode"
  ],
  item_name: [
    "ຊື່ສິນຄ້າ (product name)", "description", "item name", "item_name", "product name",
    "product_name", "name", "ชื่อสินค้า", "ຊື່ສິນຄ້າ", "ລາຍການ", "ຊື່"
  ],
  sales_qty: [
    "ຈຳນວນ (qty)", "qty", "quantity", "sales_qty", "sales qty", "sold qty", "sold_qty",
    "จำนวน", "ຈຳນວນ", "จำนวนขาย", "ຈຳນວນຂາຍ"
  ],
  amount_lak: [
    "ຍອດ (lak)", "ຍອດຂາຍ", "ຍອດ", "amount", "total", "lak", "price", "ยอดขาย", "จำนวนเงิน"
  ],
  order_ref: [
    "order ref", "order_ref", "order", "receipt", "bill", "ເລກບິນ", "เลขบิล"
  ],
  sale_time: [
    "ເວລາ (time)", "ເວລາ", "time", "date", "datetime", "วันที่", "ວັນທີ"
  ],
};

function mapSalesColumns(headers) {
  const normalized = (headers || []).map(headerKey);
  return Object.fromEntries(
    Object.entries(salesAliases).map(([field, names]) => {
      const normalizedNames = names.map(headerKey);
      let idx = normalized.findIndex((h) => h && normalizedNames.includes(h));
      if (idx < 0) {
        idx = normalized.findIndex(
          (h) => h && normalizedNames.some((n) => n.length >= 3 && h.includes(n)),
        );
      }
      return [field, idx];
    }),
  );
}

export function isSalesReportSheet(sheet) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });
  for (let r = 0; r < Math.min(matrix.length, 15); r++) {
    const rowText = (matrix[r] || []).map((c) => clean(c).toLowerCase()).join(" ");
    if (
      rowText.includes("ລາຍງານຍອດຂາຍ") ||
      (rowText.includes("order ref") && rowText.includes("barcode")) ||
      (rowText.includes("ບາໂຄດ 13 ຫຼັກ") && rowText.includes("ຈຳນວນ"))
    ) {
      return true;
    }
  }
  return false;
}

export function parseSalesSheet(sheet, branchId, source, updatedBy) {
  const matrix = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new Error("ບໍ່ພົບຂໍ້ມູນໃນໄຟລ໌");
  }

  let headerRowIndex = 0;
  let columns = mapSalesColumns(matrix[0]);

  if (columns.barcode_no < 0 || columns.sales_qty < 0) {
    for (let r = 1; r < Math.min(matrix.length, 25); r++) {
      const candidate = mapSalesColumns(matrix[r]);
      if (candidate.barcode_no >= 0 && candidate.sales_qty >= 0) {
        headerRowIndex = r;
        columns = candidate;
        break;
      }
    }
  }

  if (columns.barcode_no < 0) {
    throw new Error(
      "ບໍ່ພົບຖັນ Barcode ໃນໄຟລ໌ຍອດຂາຍ (ຕ້ອງມີຄໍລຳ ບາໂຄດ 13 ຫຼັກ (Barcode) ຫຼື Barcode)",
    );
  }

  if (columns.sales_qty < 0) {
    throw new Error("ບໍ່ພົບຖັນ ຈຳນວນ (Qty) ໃນໄຟລ໌ຍອດຂາຍ");
  }

  const records = new Map();
  let invalidRows = 0;
  let duplicateRows = 0;
  let validDataRows = 0;
  let totalSoldQty = 0;

  matrix.slice(headerRowIndex + 1).forEach((row) => {
    const barcode = text(row[columns.barcode_no]);

    if (!barcode && row.every((v) => !clean(v))) {
      return;
    }

    if (!barcode) {
      invalidRows += 1;
      return;
    }

    const rawQty =
      columns.sales_qty >= 0 ? clean(row[columns.sales_qty]).replace(/,/g, "") : "0";
    const qtyVal = parseFloat(rawQty);
    const sales_qty = isNaN(qtyVal) ? 0 : Math.round(qtyVal);

    if (sales_qty <= 0) {
      return;
    }

    const rawLak =
      columns.amount_lak >= 0
        ? clean(row[columns.amount_lak]).replace(/[^\d.-]/g, "")
        : "0";
    const lakVal = parseFloat(rawLak);
    const amount_lak = isNaN(lakVal) ? 0 : Math.round(lakVal);

    const itemName =
      columns.item_name >= 0 ? clean(row[columns.item_name]) || null : null;

    validDataRows += 1;
    totalSoldQty += sales_qty;

    if (records.has(barcode)) {
      duplicateRows += 1;
      const existing = records.get(barcode);
      existing.sales_qty += sales_qty;
      existing.tx_count += 1;
      existing.amount_lak += amount_lak;
      if (!existing.item_name && itemName) {
        existing.item_name = itemName;
      }
    } else {
      records.set(barcode, {
        barcode_no: barcode,
        item_name: itemName,
        sales_qty: sales_qty,
        tx_count: 1,
        amount_lak: amount_lak,
        branch_id: branchId,
        last_updated: new Date().toISOString(),
        updated_by: updatedBy || "sales-excel-import",
      });
    }
  });

  return {
    rows: [...records.values()],
    invalidRows,
    duplicateRows,
    totalRows: validDataRows,
    totalSoldQty,
  };
}

export default function MasterDataImport({
  supabase,
  branchOptions = BRANCH_OPTIONS,
  defaultBranch = DEFAULT_BRANCH,
  tableName = "master_data",
  updatedBy = "excel-import",
  onComplete,
  onBack,
}) {
  const client = supabase || defaultSupabase;

  const inputRef = useRef(null);

  const [branch, setBranch] = useState(defaultBranch);
  const [customBranch, setCustomBranch] = useState("");

  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [notice, setNotice] = useState(null);
  const [modalState, setModalState] = useState("idle");
  const [importSummary, setImportSummary] = useState(null);

  const [importMode, setImportMode] = useState("master_data"); // 'master_data' | 'store_inventory'

  const [syncStore, setSyncStore] = useState(true);
  const [syncedStoreCount, setSyncedStoreCount] = useState(0);

  const [inspecting, setInspecting] = useState(false);
  const [inspectResult, setInspectResult] = useState(null);
  const [syncingStoreDirect, setSyncingStoreDirect] = useState(false);

  // 🆕 Copy Shelf Location & Categories from another branch
  const [copySourceBranch, setCopySourceBranch] = useState("ໂພນສີນວນ");
  const [copyInspectResult, setCopyInspectResult] = useState(null);
  const [isInspectingCopy, setIsInspectingCopy] = useState(false);
  const [isCopyingShelf, setIsCopyingShelf] = useState(false);
  const [autoAssignPhonthongAfterCopy, setAutoAssignPhonthongAfterCopy] = useState(true);

  const [dragging, setDragging] = useState(false);

  const branchId = customBranch.trim() || branch;

  const preview = useMemo(
    () => parsed?.rows.slice(0, 8) || [],
    [parsed],
  );

  const isWorking = busy || inspecting || syncingStoreDirect || isCopyingShelf || isInspectingCopy;

  async function inspectBranchStore() {
    if (!client || !branchId) return;

    setInspecting(true);
    setInspectResult(null);
    setNotice(null);

    try {
      let storeItems = [];
      let page = 0;

      while (true) {
        const { data, error } = await client
          .from("store_inventory")
          .select(
            "id, barcode_no, item_name, category_1_actual, category_2_actual",
          )
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) throw error;

        if (!data || data.length === 0) break;

        storeItems.push(...data);
        page++;
      }

      let masterMap = new Map();
      page = 0;

      while (true) {
        const { data, error } = await client
          .from("master_data")
          .select("barcode, item_name, category_1, category_2")
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) throw error;

        if (!data || data.length === 0) break;

        data.forEach((m) => masterMap.set(m.barcode, m));
        page++;
      }

      let needUpdateCount = 0;

      storeItems.forEach((item) => {
        const m = masterMap.get(item.barcode_no);

        if (m) {
          if (
            item.item_name !== m.item_name ||
            item.category_1_actual !== m.category_1 ||
            item.category_2_actual !== m.category_2
          ) {
            needUpdateCount++;
          }
        }
      });

      setInspectResult({
        totalStore: storeItems.length,
        totalMaster: masterMap.size,
        needUpdateCount,
      });

      setNotice({
        ok: true,
        text: `ກວດສອບສາຂາ ${branchId} ສຳເລັດ ພົບຂໍ້ມູນ ${formatNumber(
          storeItems.length,
        )} ລາຍການ ແລະມີ ${formatNumber(
          needUpdateCount,
        )} ລາຍການທີ່ຄວນອັບເດດ`,
      });
    } catch (err) {
      setNotice({
        ok: false,
        text: `ກວດສອບບໍ່ສຳເລັດ: ${err.message}`,
      });
    } finally {
      setInspecting(false);
    }
  }

  async function syncBranchStoreDirectly() {
    if (!client || !branchId) return;

    setSyncingStoreDirect(true);
    setProgress(0);
    setModalState("uploading");
    setNotice(null);

    try {
      let storeItems = [];
      let page = 0;

      while (true) {
        const { data, error } = await client
          .from("store_inventory")
          .select(
            "id, barcode_no, item_name, category_1_actual, category_2_actual",
          )
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) throw error;

        if (!data || data.length === 0) break;

        storeItems.push(...data);
        page++;
      }

      if (storeItems.length === 0) {
        setModalState("idle");

        setNotice({
          ok: false,
          text: `ບໍ່ພົບຂໍ້ມູນໃນ store_inventory ຂອງສາຂາ ${branchId}`,
        });

        return;
      }

      let masterMap = new Map();
      page = 0;

      while (true) {
        const { data, error } = await client
          .from("master_data")
          .select("barcode, item_name, category_1, category_2")
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);

        if (error) throw error;

        if (!data || data.length === 0) break;

        data.forEach((m) => masterMap.set(m.barcode, m));
        page++;
      }

      const updates = [];

      storeItems.forEach((item) => {
        const m = masterMap.get(item.barcode_no);

        if (!m) return;

        if (
          item.item_name !== m.item_name ||
          item.category_1_actual !== m.category_1 ||
          item.category_2_actual !== m.category_2
        ) {
          updates.push({
            id: item.id,
            barcode_no: item.barcode_no,
            branch_id: branchId,
            item_name: m.item_name || null,
            category_1_actual: m.category_1 || null,
            category_2_actual: m.category_2 || null,
            last_updated: new Date().toISOString(),
            updated_by: updatedBy || "master-direct-sync",
          });
        }
      });

      if (updates.length === 0) {
        setModalState("idle");

        setNotice({
          ok: true,
          text: `ຂໍ້ມູນ store_inventory ຂອງສາຂາ ${branchId} ເປັນປັດຈຸບັນແລ້ວ`,
        });

        setInspectResult((prev) =>
          prev
            ? {
              ...prev,
              needUpdateCount: 0,
            }
            : null,
        );

        return;
      }

      let synced = 0;

      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        const { error } = await client
          .from("store_inventory")
          .upsert(batch, { onConflict: "id" });

        if (error) throw error;

        synced += batch.length;

        setProgress(
          Math.round((synced / updates.length) * 100),
        );
      }

      setImportSummary({
        imported: updates.length,
        syncedStore: synced,
        branchId,
        fileName: `Sync ຈາກ master_data ຂອງສາຂາ ${branchId}`,
      });

      setNotice({
        ok: true,
        text: `ອັບເດດ store_inventory ສາຂາ ${branchId} ສຳເລັດ ${formatNumber(
          synced,
        )} ລາຍການ`,
      });

      setInspectResult({
        totalStore: storeItems.length,
        totalMaster: masterMap.size,
        needUpdateCount: 0,
      });

      setModalState("success");
    } catch (error) {
      setNotice({
        ok: false,
        text: error.message || "ເກີດຂໍ້ຜິດພາດຂະນະ Sync",
      });

      setModalState("error");
    } finally {
      setSyncingStoreDirect(false);
    }
  }

  
  // =========================================================================
  // 🆕 Sync Category from Master Data & Auto-Assign Shelf (English Only)
  // หลักการ:
  // 1. ดึงข้อมูล Category 1 & 2 จาก master_data โดยตรง (ไม่ดึงจากสาขาอื่น)
  // 2. ตรวจสอบอย่างเข้มงวด: ต้องเป็นภาษาอังกฤษเท่านั้น (English Only) ห้ามภาษาอื่นเด็ดขาด
  // 3. ห้ามก๊อปปี้ shelf_location จากที่อื่น ให้ระบบคำนวณ Auto-Assign ผัง JMPT ของ ໂພນຕ້ອງ เอง
  // =========================================================================
  const isEnglishOnly = (text) => {
    if (!text) return false;
    const s = String(text).trim();
    if (!s || s === "0" || s === "—" || s.toLowerCase() === "null") return false;
    // ตรวจสอบว่าต้องไม่มีภาษาเกาหลี (Hangul: \uAC00-\uD7AF, \u1100-\u11FF, \u3130-\u318F), ภาษาลาว, ภาษาไทย หรือจีน
    if (/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u0E00-\u0E7F\u0EB0-\u0EFF]/.test(s)) return false;
    // ต้องมีเฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และเครื่องหมายวรรคตอนทั่วไป
    return /^[A-Za-z0-9\s/&,()._'-]+$/.test(s) && /[A-Za-z]/.test(s);
  };

  async function inspectSyncMasterDataCategory() {
    if (!client || !branchId) return;
    setIsInspectingCopy(true);
    setCopyInspectResult(null);
    setNotice(null);

    try {
      let targetItems = [];
      let page = 0;
      while (true) {
        const { data, error } = await client
          .from("store_inventory")
          .select("id, barcode_no, shelf_location, category_1_actual, category_2_actual")
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        targetItems.push(...data);
        page++;
      }

      // รายการที่ต้องการประมวลผล: ยังไม่มี Shelf Location หรือยังไม่มี Category หรือ Category เดิมไม่ใช่ภาษาอังกฤษ
      const needProcessing = targetItems.filter((item) => {
        const loc = String(item.shelf_location || "").trim();
        const hasNoShelf = !loc || loc === "—" || loc.toLowerCase() === "null";
        const hasNoCategory = !item.category_1_actual || !item.category_2_actual;
        const isNotEnglish = (item.category_1_actual && !isEnglishOnly(item.category_1_actual)) ||
                             (item.category_2_actual && !isEnglishOnly(item.category_2_actual));
        return hasNoShelf || hasNoCategory || isNotEnglish;
      });

      if (needProcessing.length === 0) {
        setNotice({
          ok: true,
          text: `ທຸກລາຍການສິນຄ້າໃນສາຂາ ${branchId} (${formatNumber(targetItems.length)} ລາຍການ) ມີ Category (English) ແລະ Shelf Location ຄົບຖ້ວນແລ້ວ!`,
        });
        setIsInspectingCopy(false);
        return;
      }

      const barcodes = [...new Set(needProcessing.map((i) => i.barcode_no).filter(Boolean))];
      let masterCategoryMap = new Map();
      let rejectedNonEnglishCount = 0;
      const chunkSize = 200;

      for (let i = 0; i < barcodes.length; i += chunkSize) {
        const chunk = barcodes.slice(i, i + chunkSize);

        // ดึงจาก master_data โดยตรง
        const { data: mData } = await client
          .from("master_data")
          .select("barcode, item_name, category_1, category_2, branch_id")
          .in("barcode", chunk);

        if (mData) {
          mData.forEach((row) => {
            const bc = String(row.barcode || "").trim();
            if (!bc) return;

            // ตรวจสอบภาษาอังกฤษ หรือแปล Category 1 เกาหลีเป็นอังกฤษ
            let rawCat1 = clean(row.category_1);
            const rawCat2 = clean(row.category_2);

            if (rawCat1 && KOREAN_TO_ENGLISH_CATEGORY_1[rawCat1]) {
              rawCat1 = KOREAN_TO_ENGLISH_CATEGORY_1[rawCat1];
            }

            const isCat1English = isEnglishOnly(rawCat1);
            const isCat2English = isEnglishOnly(rawCat2);

            if ((row.category_1 && !isCat1English) || (row.category_2 && !isCat2English)) {
              rejectedNonEnglishCount++;
            }

            let validCat1 = isCat1English ? rawCat1 : null;
            // ถ้า Cat 1 เป็นอังกฤษ แต่ Cat 2 เป็นเกาหลี/ไม่ใช่ภาษาอังกฤษ ให้ตัด Cat 2 ทิ้งเป็น null (เอาแค่ Cat 1)
            // แต่ถ้า Cat 2 เป็นอังกฤษ ให้เก็บไว้เสมอ
            const validCat2 = (isCat1English && !isCat2English) ? null : (isCat2English ? rawCat2 : null);

            // ถ้า Cat 1 ว่างแต่ Cat 2 เป็นอังกฤษ ให้ Infer Cat 1 จาก Cat 2
            if (!validCat1 && validCat2) {
              const inferred = inferCategory1FromCategory2(validCat2);
              if (inferred) validCat1 = inferred;
            }

            if (validCat1 || validCat2) {
              const existing = masterCategoryMap.get(bc);
              // ให้ความสำคัญกับ master_data ของสาขานี้ก่อน หรือแถวที่มีหมวดหมู่สมบูรณ์
              if (!existing || row.branch_id === branchId || (!existing.category_1 && validCat1)) {
                masterCategoryMap.set(bc, {
                  category_1: validCat1 || existing?.category_1 || null,
                  category_2: validCat2 || existing?.category_2 || null,
                  item_name: row.item_name || existing?.item_name || null,
                });
              }
            }
          });
        }
      }

      let canAutoAssignCount = 0;
      let matchedCategoryCount = 0;

      needProcessing.forEach((item) => {
        const m = masterCategoryMap.get(item.barcode_no);
        let c1 = (item.category_1_actual && isEnglishOnly(item.category_1_actual)) ? item.category_1_actual : (m?.category_1 || null);
        const c2 = (item.category_2_actual && isEnglishOnly(item.category_2_actual)) ? item.category_2_actual : (m?.category_2 || null);

        // ถ้า c1 ขาดแต่ c2 มีค่าภาษาอังกฤษ ให้ Infer c1 จาก c2
        if (!c1 && c2) {
          const inferred = inferCategory1FromCategory2(c2);
          if (inferred) c1 = inferred;
        }

        if (m && (m.category_1 || m.category_2)) {
          matchedCategoryCount++;
        }

        if (isPhonthongStyleBranch(branchId) && (c1 || c2)) {
          const dec = getPhonthongRackDecision({
            branchId,
            category1: c1,
            category2: c2,
          });
          if (dec.status === "ASSIGNED") canAutoAssignCount++;
        }
      });

      setCopyInspectResult({
        totalTarget: targetItems.length,
        unassignedCount: needProcessing.length,
        matchedCategoryCount,
        canAutoAssignCount,
        rejectedNonEnglishCount,
        source: "master_data",
      });

      const rackPrefix = getPhonthongStyleRackPrefix(branchId);
      setNotice({
        ok: true,
        text: `ກວດສອບ Master Data (English Only): ພົບ ${formatNumber(matchedCategoryCount)} ລາຍການ${isPhonthongStyleBranch(branchId) ? ` (ຈັດເຂົ້າຜັງ ${rackPrefix} ຂອງ ${branchId} ໄດ້ ${formatNumber(canAutoAssignCount)} ລາຍການ)` : ""}${rejectedNonEnglishCount > 0 ? `, ຕັດພາສາອື່ນອອກ ${formatNumber(rejectedNonEnglishCount)} ຄ່າ` : ""}`,
      });
    } catch (err) {
      setNotice({
        ok: false,
        text: `ກວດສອບບໍ່ສຳເລັດ: ${err.message}`,
      });
    } finally {
      setIsInspectingCopy(false);
    }
  }

  async function executeSyncMasterDataCategory() {
    if (!client || !branchId) return;
    setIsCopyingShelf(true);
    setProgress(0);
    setModalState("uploading");
    setNotice(null);

    try {
      let targetItems = [];
      let page = 0;
      while (true) {
        const { data, error } = await client
          .from("store_inventory")
          .select("id, barcode_no, shelf_location, category_1_actual, category_2_actual, item_name")
          .eq("branch_id", branchId)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        targetItems.push(...data);
        page++;
      }

      const needProcessing = targetItems.filter((item) => {
        const loc = String(item.shelf_location || "").trim();
        const hasNoShelf = !loc || loc === "—" || loc.toLowerCase() === "null";
        const hasNoCategory = !item.category_1_actual || !item.category_2_actual;
        const isNotEnglish = (item.category_1_actual && !isEnglishOnly(item.category_1_actual)) ||
                             (item.category_2_actual && !isEnglishOnly(item.category_2_actual));
        return hasNoShelf || hasNoCategory || isNotEnglish;
      });

      if (needProcessing.length === 0) {
        setModalState("idle");
        setNotice({
          ok: true,
          text: "ທຸກລາຍການມີ Category (English Only) ແລະ Shelf Location ຄົບຖ້ວນແລ້ວ",
        });
        return;
      }

      const barcodes = [...new Set(needProcessing.map((i) => i.barcode_no).filter(Boolean))];
      let masterCategoryMap = new Map();
      let rejectedNonEnglishCount = 0;
      const chunkSize = 200;

      for (let i = 0; i < barcodes.length; i += chunkSize) {
        const chunk = barcodes.slice(i, i + chunkSize);

        const { data: mData } = await client
          .from("master_data")
          .select("barcode, item_name, category_1, category_2, branch_id")
          .in("barcode", chunk);

        if (mData) {
          mData.forEach((row) => {
            const bc = String(row.barcode || "").trim();
            if (!bc) return;

            // ตรวจสอบภาษาอังกฤษ หรือแปล Category 1 เกาหลีเป็นอังกฤษ
            let rawCat1 = clean(row.category_1);
            const rawCat2 = clean(row.category_2);

            if (rawCat1 && KOREAN_TO_ENGLISH_CATEGORY_1[rawCat1]) {
              rawCat1 = KOREAN_TO_ENGLISH_CATEGORY_1[rawCat1];
            }

            const isCat1English = isEnglishOnly(rawCat1);
            const isCat2English = isEnglishOnly(rawCat2);

            if ((row.category_1 && !isCat1English) || (row.category_2 && !isCat2English)) {
              rejectedNonEnglishCount++;
            }

            let validCat1 = isCat1English ? rawCat1 : null;
            // ถ้า Cat 1 เป็นอังกฤษ แต่ Cat 2 เป็นเกาหลี/ไม่ใช่ภาษาอังกฤษ ให้ตัด Cat 2 ทิ้งเป็น null (เอาแค่ Cat 1)
            // แต่ถ้า Cat 2 เป็นอังกฤษ ให้เก็บไว้เสมอ
            const validCat2 = (isCat1English && !isCat2English) ? null : (isCat2English ? rawCat2 : null);

            // ถ้า Cat 1 ว่างแต่ Cat 2 เป็นอังกฤษ ให้ Infer Cat 1 จาก Cat 2
            if (!validCat1 && validCat2) {
              const inferred = inferCategory1FromCategory2(validCat2);
              if (inferred) validCat1 = inferred;
            }

            if (validCat1 || validCat2) {
              const existing = masterCategoryMap.get(bc);
              if (!existing || row.branch_id === branchId || (!existing.category_1 && validCat1)) {
                masterCategoryMap.set(bc, {
                  category_1: validCat1 || existing?.category_1 || null,
                  category_2: validCat2 || existing?.category_2 || null,
                  item_name: row.item_name || existing?.item_name || null,
                });
              }
            }
          });
        }
      }

      const isPhonthong = isPhonthongStyleBranch(branchId);
      const rackPrefix = getPhonthongStyleRackPrefix(branchId);
      let phonthongAssignedCount = 0;
      let categoryOnlyCount = 0;
      const updates = [];

      needProcessing.forEach((item) => {
        const m = masterCategoryMap.get(item.barcode_no);
        const currentCat1Valid = item.category_1_actual && isEnglishOnly(item.category_1_actual);
        const currentCat2Valid = item.category_2_actual && isEnglishOnly(item.category_2_actual);

        let c1 = currentCat1Valid ? item.category_1_actual : (m?.category_1 || null);
        let c2 = currentCat2Valid ? item.category_2_actual : (m?.category_2 || null);

        // ถ้า c1 ว่างแต่ c2 มีค่าภาษาอังกฤษ ให้ Infer c1 จาก c2 อัตโนมัติ
        if (!c1 && c2) {
          const inferred = inferCategory1FromCategory2(c2);
          if (inferred) c1 = inferred;
        }

        const resolvedName = item.item_name || m?.item_name || null;

        let finalShelf = item.shelf_location || null;

        // คำนวณ Auto-Assign Shelf Location สำหรับสาขา ໂພນຕ້ອງ (JMPT) / JmartDD (JMDD) โดยเด็ดขาด ห้ามก๊อปปี้ shelf_location จากที่อื่น
        if (isPhonthong && (c1 || c2)) {
          const decision = getPhonthongRackDecision({
            branchId,
            category1: c1,
            category2: c2,
          });

          if (decision.status === "ASSIGNED" && decision.rackLocation) {
            finalShelf = decision.rackLocation; // JMPT./JMDD. A-1 - G-20
            phonthongAssignedCount++;
          }
        }

        const categoryChanged = (c1 !== item.category_1_actual) || (c2 !== item.category_2_actual);
        const shelfChanged = finalShelf && finalShelf !== item.shelf_location;

        if (categoryChanged || shelfChanged) {
          if (!shelfChanged && categoryChanged) {
            categoryOnlyCount++;
          }

          updates.push({
            id: item.id,
            barcode_no: item.barcode_no,
            branch_id: branchId,
            shelf_location: finalShelf,
            category_1_actual: c1,
            category_2_actual: c2,
            item_name: resolvedName,
            last_updated: new Date().toISOString(),
            updated_by: updatedBy || "master-data-sync-english-only",
          });
        }
      });

      if (updates.length === 0) {
        setModalState("idle");
        setNotice({
          ok: false,
          text: "ບໍ່ພົບ Category (English) ທີ່ກົງກັນໃນ Master Data",
        });
        return;
      }

      let saved = 0;
      for (let i = 0; i < updates.length; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);
        const { error } = await client
          .from("store_inventory")
          .upsert(batch, { onConflict: "id" });
        if (error) throw error;

        saved += batch.length;
        setProgress(Math.round((saved / updates.length) * 100));
      }

      setImportSummary({
        imported: updates.length,
        syncedStore: updates.length,
        branchId,
        fileName: "Sync Category ຈາກ Master Data (English Only)",
        phonthongAssigned: phonthongAssignedCount,
        categoryOnlyCount,
        rejectedNonEnglishCount,
        isMasterDataCategoryFeature: true,
      });

      setNotice({
        ok: true,
        text: `Sync Category ຈາກ Master Data (English Only) ສຳເລັດ ${formatNumber(updates.length)} ລາຍການ!${isPhonthong ? ` (ຈັດເຂົ້າຜັງ ${rackPrefix} ${branchId}: ${formatNumber(phonthongAssignedCount)} ລາຍການ)` : ""}`,
      });

      setCopyInspectResult(null);
      setModalState("success");
    } catch (err) {
      setNotice({
        ok: false,
        text: err.message || "ເກີດຂໍ້ຜິດພາດໃນການ Sync Category ຈາກ Master Data",
      });
      setModalState("error");
    } finally {
      setIsCopyingShelf(false);
    }
  }

  async function readFile(nextFile) {
    if (!nextFile) return;

    setFile(nextFile);
    setParsed(null);
    setNotice(null);
    setSyncedStoreCount(0);
    setInspectResult(null);

    try {
      const workbook = XLSX.read(await nextFile.arrayBuffer(), {
        type: "array",
      });

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      let effectiveMode = importMode;
      if (effectiveMode !== "sales_import" && isSalesReportSheet(firstSheet)) {
        effectiveMode = "sales_import";
        setImportMode("sales_import");
      }

      const result =
        effectiveMode === "sales_import"
          ? parseSalesSheet(firstSheet, branchId, nextFile.name, updatedBy)
          : effectiveMode === "store_inventory"
          ? parseStoreInventorySheet(firstSheet, branchId, nextFile.name, updatedBy)
          : parseMasterSheet(firstSheet, branchId, nextFile.name, updatedBy);

      setParsed(result);

      setNotice({
        ok: true,
        text:
          effectiveMode === "sales_import"
            ? `ອ່ານໄຟລ໌ຍອດຂາຍສຳເລັດ: ລວມບາໂຄດຊ້ຳແລ້ວເຫຼືອ ${formatNumber(
                result.rows.length,
              )} ລາຍການ (ຈາກ ${formatNumber(result.totalRows)} ບິນ, ຈຳນວນຂາຍລວມ ${formatNumber(
                result.totalSoldQty,
              )} ຊິ້ນ)`
            : `ອ່ານໄຟລ໌ສຳເລັດ ${formatNumber(
                result.rows.length,
              )} ລາຍການ (${effectiveMode === "store_inventory" ? "Store Inventory" : "Master Data"})`,
      });
    } catch (error) {
      setNotice({
        ok: false,
        text: error.message || "ອ່ານໄຟລ໌ບໍ່ສຳເລັດ",
      });
    }
  }

  async function importRows() {
    if (!client || !parsed?.rows.length) return;

    setBusy(true);
    setProgress(0);
    setModalState("uploading");
    setSyncedStoreCount(0);

    try {
      if (importMode === "sales_import") {
        let storeItems = [];
        let page = 0;
        while (true) {
          const { data, error } = await client
            .from("store_inventory")
            .select("id, barcode_no, item_name, store_qty, sales_qty, shelf_location")
            .eq("branch_id", branchId)
            .range(page * 1000, (page + 1) * 1000 - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          storeItems.push(...data);
          page++;
        }

        const storeByBarcode = new Map();
        storeItems.forEach((item) => {
          const bc = clean(item.barcode_no);
          if (!bc) return;
          if (!storeByBarcode.has(bc)) {
            storeByBarcode.set(bc, []);
          }
          storeByBarcode.get(bc).push(item);
        });

        const updates = [];
        const salesLogs = [];
        let matchedBarcodes = 0;
        let unmatchedBarcodes = 0;
        let totalDeductedQty = 0;
        let totalAddedSalesQty = 0;
        const nowIso = new Date().toISOString();

        parsed.rows.forEach((salesRow) => {
          const bc = clean(salesRow.barcode_no);
          const soldQty = Number(salesRow.sales_qty || 0);
          if (!bc || soldQty <= 0) return;

          const candidates = storeByBarcode.get(bc);
          if (!candidates || candidates.length === 0) {
            unmatchedBarcodes += 1;
            return;
          }

          matchedBarcodes += 1;
          totalAddedSalesQty += soldQty;

          let remainingToDeduct = soldQty;

          candidates.forEach((storeRow, idx) => {
            const currentStoreQty = Number(storeRow.store_qty || 0);
            const currentSalesQty = Number(storeRow.sales_qty || 0);

            let deductHere = 0;
            if (remainingToDeduct > 0) {
              if (idx === candidates.length - 1) {
                deductHere = Math.min(currentStoreQty, remainingToDeduct);
                remainingToDeduct = 0;
              } else if (currentStoreQty > 0) {
                deductHere = Math.min(currentStoreQty, remainingToDeduct);
                remainingToDeduct -= deductHere;
              }
            }

            totalDeductedQty += deductHere;
            const newStoreQty = Math.max(0, currentStoreQty - deductHere);
            const newSalesQty = idx === 0 ? currentSalesQty + soldQty : currentSalesQty;

            if (newStoreQty !== currentStoreQty || newSalesQty !== currentSalesQty) {
              updates.push({
                id: storeRow.id,
                barcode_no: storeRow.barcode_no,
                branch_id: branchId,
                item_name: storeRow.item_name || salesRow.item_name || null,
                shelf_location: storeRow.shelf_location,
                store_qty: newStoreQty,
                sales_qty: newSalesQty,
                last_updated: nowIso,
                updated_by: updatedBy || "sales-excel-import",
              });
            }
          });

          salesLogs.push({
            barcode_no: bc,
            sales_qty: soldQty,
            import_date: nowIso,
            branch_id: branchId,
            imported_by: updatedBy || "sales-excel-import",
          });
        });

        if (updates.length === 0) {
          setModalState("error");
          setNotice({
            ok: false,
            text: `ບໍ່ພົບບາໂຄດທີ່ກົງກັບ Store Inventory ຂອງສາຂາ ${branchId} (ຈາກທັງໝົດ ${formatNumber(
              parsed.rows.length,
            )} ບາໂຄດໃນໄຟລ໌)`,
          });
          return;
        }

        let completed = 0;
        for (let i = 0; i < updates.length; i += BATCH_SIZE) {
          const batch = updates.slice(i, i + BATCH_SIZE);
          const { error } = await client
            .from("store_inventory")
            .upsert(batch, { onConflict: "id" });
          if (error) throw error;

          completed += batch.length;
          setProgress(Math.round((completed / updates.length) * 100));
        }

        try {
          for (let i = 0; i < salesLogs.length; i += BATCH_SIZE) {
            const logBatch = salesLogs.slice(i, i + BATCH_SIZE);
            await client.from("store_sales_log").insert(logBatch);
          }
        } catch (logErr) {
          console.warn("Could not write to store_sales_log:", logErr);
        }

        setNotice({
          ok: true,
          text: `ນຳເຂົ້າຍອດຂາຍສຳເລັດ! ອັບເດດສິນຄ້າ ${formatNumber(
            matchedBarcodes,
          )} ລາຍການ (ຫັກ Stock -${formatNumber(totalDeductedQty)} ຊິ້ນ, ເພີ່ມ QTY ຍອດຂາຍ +${formatNumber(
            totalAddedSalesQty,
          )} ຊິ້ນ)`,
        });

        setImportSummary({
          imported: matchedBarcodes,
          syncedStore: updates.length,
          branchId,
          fileName: file?.name,
          isSalesImportFeature: true,
          totalSoldQty: totalAddedSalesQty,
          totalDeductedQty,
          unmatchedBarcodes,
          mergedDuplicateTx: parsed.duplicateRows,
          totalRawTx: parsed.totalRows,
        });

        setModalState("success");
        onComplete?.({
          imported: matchedBarcodes,
          syncedStore: updates.length,
          branchId,
          fileName: file?.name,
        });
        return;
      }

      if (importMode === "store_inventory") {
        let importedCount = 0;

        for (let i = 0; i < parsed.rows.length; i += BATCH_SIZE) {
          const batch = parsed.rows.slice(i, i + BATCH_SIZE);
          const barcodes = batch.map((r) => r.barcode_no);

          // 1. Auto-fetch category_1 & category_2 from master_data
          let masterMap = new Map();
          const { data: mData } = await client
            .from("master_data")
            .select("barcode, item_name, category_1, category_2")
            .in("barcode", barcodes);

          if (mData) {
            mData.forEach((m) => masterMap.set(m.barcode, m));
          }

          // 2. Fetch existing store_inventory rows to match IDs
          const { data: existingRows } = await client
            .from("store_inventory")
            .select("id, barcode_no, shelf_location, store_qty, item_name, category_1_actual, category_2_actual")
            .eq("branch_id", branchId)
            .in("barcode_no", barcodes);

          // Fix: keep a full list of existing rows per barcode instead of
          // letting a single "barcode-only" fallback key get silently
          // overwritten. That old behaviour could point two different
          // shelf_location rows in the same batch at the same existing
          // `id`, which made Postgres reject the upsert with
          // "ON CONFLICT DO UPDATE command cannot affect row a second
          // time" (surfaced by PostgREST as a 500) and aborted the
          // whole import partway through.
          const existingMap = new Map();
          const existingByBarcode = new Map();

          if (existingRows) {
            existingRows.forEach((item) => {
              const k = `${item.barcode_no}::${item.shelf_location || ""}`;
              existingMap.set(k, item);

              if (!existingByBarcode.has(item.barcode_no)) {
                existingByBarcode.set(item.barcode_no, []);
              }
              existingByBarcode.get(item.barcode_no).push(item);
            });
          }

          const existingUpdates = [];
          const newInserts = [];

          batch.forEach((row) => {
            const master = masterMap.get(row.barcode_no);
            const key = `${row.barcode_no}::${row.shelf_location || ""}`;

            // Exact composite match first (barcode + shelf_location).
            let existing = existingMap.get(key);

            // Only fall back to a bare-barcode match when it's
            // unambiguous: the incoming row has no shelf_location AND
            // there is exactly one existing DB row for that barcode.
            if (!existing && !row.shelf_location) {
              const candidates = existingByBarcode.get(row.barcode_no) || [];
              if (candidates.length === 1) {
                existing = candidates[0];
              }
            }

            let resolvedCat1 = master?.category_1 || existing?.category_1_actual || null;
            let resolvedCat2 = master?.category_2 || existing?.category_2_actual || null;

            // ถ้า Category 1 ว่าง แต่ Category 2 มีค่า ให้ Infer Category 1
            if (!resolvedCat1 && resolvedCat2) {
              const inferred = inferCategory1FromCategory2(resolvedCat2);
              if (inferred) resolvedCat1 = inferred;
            }

            let assignedShelf = row.shelf_location || existing?.shelf_location || null;

            // Auto-assign Phonthong / JmartDD layout (JMPT / JMDD) if shelf is null and categories exist
            if (!assignedShelf && isPhonthongStyleBranch(branchId) && (resolvedCat1 || resolvedCat2)) {
              const decision = getPhonthongRackDecision({
                branchId,
                category1: resolvedCat1,
                category2: resolvedCat2,
              });
              if (decision.status === "ASSIGNED" && decision.rackLocation) {
                assignedShelf = decision.rackLocation;
              }
            }

            if (existing?.id) {
              existingUpdates.push({
                id: existing.id,
                barcode_no: row.barcode_no,
                item_name: row.item_name || master?.item_name || existing.item_name || null,
                store_qty: row.store_qty,
                shelf_location: assignedShelf,
                branch_id: branchId,
                category_1_actual: resolvedCat1,
                category_2_actual: resolvedCat2,
                last_updated: new Date().toISOString(),
                updated_by: updatedBy || "store-excel-import",
              });
            } else {
              newInserts.push({
                barcode_no: row.barcode_no,
                item_name: row.item_name || master?.item_name || null,
                store_qty: row.store_qty,
                shelf_location: assignedShelf,
                branch_id: branchId,
                category_1_actual: resolvedCat1,
                category_2_actual: resolvedCat2,
                last_updated: new Date().toISOString(),
                updated_by: updatedBy || "store-excel-import",
              });
            }
          });

          // Safety net: never let the same `id` appear twice in one
          // upsert batch, even if some future edge case slips past the
          // matching logic above. Keeps the last occurrence.
          const dedupedUpdates = [
            ...new Map(existingUpdates.map((u) => [u.id, u])).values(),
          ];

          if (dedupedUpdates.length > 0) {
            const { error: err1 } = await client
              .from("store_inventory")
              .upsert(dedupedUpdates, { onConflict: "id" });
            if (err1) throw err1;
          }

          if (newInserts.length > 0) {
            const { error: err2 } = await client
              .from("store_inventory")
              .upsert(newInserts, { onConflict: "barcode_no,shelf_location,branch_id" });
            if (err2) {
              const { error: err3 } = await client.from("store_inventory").insert(newInserts);
              if (err3) throw err3;
            }
          }

          importedCount += batch.length;
          setProgress(Math.round((importedCount / parsed.rows.length) * 100));
        }

        setNotice({
          ok: true,
          text: `ນຳເຂົ້າ store_inventory ສຳເລັດ ${formatNumber(
            parsed.rows.length,
          )} ລາຍການ ເຂົ້າສາຂາ ${branchId}`,
        });

        setImportSummary({
          imported: parsed.rows.length,
          syncedStore: parsed.rows.length,
          branchId,
          fileName: file?.name,
        });

        setModalState("success");
        onComplete?.({
          imported: parsed.rows.length,
          syncedStore: parsed.rows.length,
          branchId,
          fileName: file?.name,
        });
        return;
      }

      // Default: master_data import
      let importedCount = 0;
      let totalSyncedInStore = 0;

      for (
        let i = 0;
        i < parsed.rows.length;
        i += BATCH_SIZE
      ) {
        const batch = parsed.rows
          .slice(i, i + BATCH_SIZE)
          .map((row) => ({
            ...row,
            branch_id: branchId,
            updated_at: new Date().toISOString(),
          }));

        const { error } = await client
          .from(tableName)
          .upsert(batch, {
            onConflict: "barcode,branch_id",
            ignoreDuplicates: false,
          });

        if (error) throw error;

        if (syncStore) {
          const barcodes = batch.map((r) => r.barcode);

          const { data: storeRows } = await client
            .from("store_inventory")
            .select("id, barcode_no")
            .eq("branch_id", branchId)
            .in("barcode_no", barcodes);

          if (storeRows && storeRows.length > 0) {
            const masterMap = new Map(
              batch.map((r) => [r.barcode, r]),
            );

            const updates = storeRows.map((item) => {
              const m = masterMap.get(item.barcode_no);

              return {
                id: item.id,
                barcode_no: item.barcode_no,
                branch_id: branchId,
                item_name: m?.item_name || null,
                category_1_actual: m?.category_1 || null,
                category_2_actual: m?.category_2 || null,
                last_updated: new Date().toISOString(),
                updated_by:
                  updatedBy || "master-import-sync",
              };
            });

            const { error: storeErr } = await client
              .from("store_inventory")
              .upsert(updates, { onConflict: "id" });

            if (!storeErr) {
              totalSyncedInStore += updates.length;
            }
          }
        }

        importedCount += batch.length;

        setProgress(
          Math.round(
            (importedCount / parsed.rows.length) * 100,
          ),
        );
      }

      setSyncedStoreCount(totalSyncedInStore);

      setNotice({
        ok: true,
        text: `ນຳເຂົ້າສຳເລັດ ${formatNumber(
          parsed.rows.length,
        )} ລາຍການ ເຂົ້າ ${branchId}`,
      });

      setImportSummary({
        imported: parsed.rows.length,
        syncedStore: totalSyncedInStore,
        branchId,
        fileName: file?.name,
      });

      setModalState("success");

      onComplete?.({
        imported: parsed.rows.length,
        syncedStore: totalSyncedInStore,
        branchId,
        fileName: file?.name,
      });
    } catch (error) {
      setNotice({
        ok: false,
        text: error.message || "ນຳເຂົ້າບໍ່ສຳເລັດ",
      });

      setModalState("error");
    } finally {
      setBusy(false);
    }
  }

  function resetPage() {
    setModalState("idle");
    setParsed(null);
    setFile(null);
    setProgress(0);
    setNotice(null);
    setImportSummary(null);

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <section className="min-h-screen bg-[#f6f8fb] px-4 py-5 text-slate-800 sm:px-6 lg:px-8">
      {/* ============================= */}
      {/* MODAL */}
      {/* ============================= */}

      {modalState !== "idle" && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md">
          <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_25px_80px_rgba(15,23,42,0.25)]">
            {modalState === "uploading" && (
              <div className="p-8 text-center">
                <div className="mx-auto mb-7 flex h-24 w-24 items-center justify-center rounded-full bg-emerald-50">
                  <div className="relative h-20 w-20">
                    <svg
                      className="h-full w-full -rotate-90"
                      viewBox="0 0 100 100"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="8"
                      />

                      <circle
                        cx="50"
                        cy="50"
                        r="42"
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="8"
                        strokeDasharray={`${2 * Math.PI * 42}`}
                        strokeDashoffset={`${2 *
                          Math.PI *
                          42 *
                          (1 - progress / 100)
                          }`}
                        strokeLinecap="round"
                        className="transition-all duration-300"
                      />
                    </svg>

                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-extrabold text-slate-800">
                        {progress}%
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    ກຳລັງດຳເນີນການ
                  </div>

                  <h3 className="text-xl font-extrabold text-slate-900">
                    ກຳລັງນຳເຂົ້າຂໍ້ມູນ
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    ລະບົບກຳລັງປະມວນຜົນຂໍ້ມູນ
                    ກະລຸນາຢ່າປິດໜ້ານີ້
                  </p>
                </div>

                <div className="mt-7 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {modalState === "success" && importSummary && (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-4xl">
                  ✓
                </div>

                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">
                    ສຳເລັດ
                  </div>

                  <h3 className="mt-2 text-2xl font-extrabold text-slate-900">
                    ນຳເຂົ້າຂໍ້ມູນສຳເລັດ
                  </h3>

                  {importSummary.isMasterDataCategoryFeature ? (
                    <div className="mt-3 text-sm leading-6 text-slate-600">
                      <p>
                        Sync Category ຈາກ Master Data (English Only) ສຳເລັດ{" "}
                        <span className="font-extrabold text-slate-900">
                          {formatNumber(importSummary.imported)}
                        </span>{" "}
                        ລາຍການ
                      </p>
                      <p className="mt-1">
                        ເຂົ້າສາຂາ{" "}
                        <span className="font-extrabold text-emerald-700">
                          {importSummary.branchId}
                        </span>
                      </p>
                      {importSummary.phonthongAssigned > 0 && (
                        <div className="mt-3 text-xs font-bold text-amber-800 bg-amber-50 p-3 rounded-2xl border border-amber-200">
                          ✨ ຈັດເຂົ້າຜັງ {getPhonthongStyleRackPrefix(importSummary.branchId)} ຂອງ {importSummary.branchId} ອັດຕະໂນມັດ: <strong className="text-amber-900 font-extrabold text-sm">{formatNumber(importSummary.phonthongAssigned)}</strong> ລາຍການ
                        </div>
                      )}
                      {importSummary.categoryOnlyCount > 0 && (
                        <div className="mt-2 text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                          📦 ອັບເດດ Category (English) ຄົບຖ້ວນ: {formatNumber(importSummary.categoryOnlyCount)} ລາຍการ
                        </div>
                      )}
                      {importSummary.rejectedNonEnglishCount > 0 && (
                        <div className="mt-2 text-[11px] font-bold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100">
                          🛡️ ຕັດຄ່າພາສາອື່ນທີ່ບໍ່ແມ່ນພາສາອັງກິດອອກ: {formatNumber(importSummary.rejectedNonEnglishCount)} ຄ່າ
                        </div>
                      )}
                    </div>
                  ) : importSummary.isSalesImportFeature ? (
                    <div className="mt-3 text-sm leading-6 text-slate-600 space-y-2">
                      <p>
                        ນຳເຂົ້າຍອດຂາຍ ແລະອັບເດດສິນຄ້າ{" "}
                        <span className="font-extrabold text-slate-900">
                          {formatNumber(importSummary.imported)}
                        </span>{" "}
                        ບາໂຄດ ເຂົ້າສາຂາ{" "}
                        <span className="font-extrabold text-emerald-700">
                          {importSummary.branchId}
                        </span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-xs font-bold pt-1">
                        <div className="rounded-2xl bg-orange-50 border border-orange-200 p-3 text-orange-800">
                          <div>📈 ເພີ່ມ QTY ຍອດຂາຍ (Sales)</div>
                          <div className="text-lg font-extrabold text-orange-600 mt-0.5">
                            +{formatNumber(importSummary.totalSoldQty)} ຊິ້ນ
                          </div>
                        </div>
                        <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-rose-800">
                          <div>📉 ຫັກ Stock ໜ້າຮ້ານ</div>
                          <div className="text-lg font-extrabold text-rose-600 mt-0.5">
                            -{formatNumber(importSummary.totalDeductedQty)} ຊິ້ນ
                          </div>
                        </div>
                      </div>
                      {importSummary.mergedDuplicateTx > 0 && (
                        <div className="text-xs font-semibold text-amber-800 bg-amber-50 p-2.5 rounded-2xl border border-amber-200">
                          🔄 ລວມບາໂຄດທີ່ຂາຍຊ້ຳຫຼາຍຄັ້ງ: ຍຸບລວມ {formatNumber(importSummary.mergedDuplicateTx)} ບິນຊ້ຳ ຈາກທັງໝົດ {formatNumber(importSummary.totalRawTx)} ລາຍການຂາຍ
                        </div>
                      )}
                      {importSummary.unmatchedBarcodes > 0 && (
                        <div className="text-[11px] font-semibold text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-200">
                          ℹ️ ບາໂຄດໃນໄຟລ໌ຂາຍທີ່ບໍ່ພົບໃນ Store Inventory ຂອງສາຂານີ້: {formatNumber(importSummary.unmatchedBarcodes)} ລາຍການ
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm leading-7 text-slate-500">
                      ນຳເຂົ້າ{" "}
                      <span className="font-extrabold text-slate-900">
                        {formatNumber(importSummary.imported)}
                      </span>{" "}
                      ລາຍການ
                      <br />
                      ເຂົ້າສາຂາ{" "}
                      <span className="font-extrabold text-emerald-700">
                        {importSummary.branchId}
                      </span>
                    </p>
                  )}

                  {importSummary.syncedStore > 0 && (
                    <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                          🔄
                        </div>

                        <div>
                          <p className="text-sm font-bold text-emerald-900">
                            ອັບເດດ Store Inventory ແລ້ວ
                          </p>

                          <p className="mt-1 text-xs leading-5 text-emerald-700">
                            ປັບຂໍ້ມູນສິນຄ້າ{" "}
                            {formatNumber(
                              importSummary.syncedStore,
                            )}{" "}
                            ລາຍການ
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={resetPage}
                  className="mt-7 w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  ສຳເລັດ · ອັບໂຫຼດໄຟລ໌ໃໝ່
                </button>
              </div>
            )}

            {modalState === "error" && (
              <div className="p-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-rose-100 text-4xl text-rose-600">
                  !
                </div>

                <div className="mt-6">
                  <div className="text-xs font-bold uppercase tracking-[0.2em] text-rose-600">
                    ERROR
                  </div>

                  <h3 className="mt-2 text-2xl font-extrabold text-slate-900">
                    ບໍ່ສາມາດດຳເນີນການໄດ້
                  </h3>

                  <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left text-sm leading-6 text-rose-700">
                    {notice?.text ||
                      "ເກີດຂໍ້ຜິດພາດ"}
                  </div>
                </div>

                <button
                  onClick={() => setModalState("idle")}
                  className="mt-7 w-full rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  ປິດ
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1440px]">
        {/* ============================= */}
        {/* HEADER */}
        {/* ============================= */}

        <header className="mb-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {onBack && (
                <button
                  onClick={onBack}
                  className="group mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  aria-label="ກັບຄືນ"
                >
                  <span className="text-xl transition group-hover:-translate-x-0.5">
                    ←
                  </span>
                </button>
              )}

              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-400">
                  <span>ລະບົບສິນຄ້າ</span>
                  <span>/</span>
                  <span className="text-slate-600">
                    Master Data
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                    ນຳເຂົ້າຂໍ້ມູນສິນຄ້າ
                  </h1>

                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    ລະບົບພ້ອມໃຊ້ງານ
                  </span>
                </div>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  ນຳເຂົ້າ Master Data ຫຼື Store Inventory ຈາກ Excel
                  ແລະອັບເດດຂໍ້ມູນເຂົ້າ Supabase ໄດ້ອັດຕະໂນມັດ
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("master_data");
                      setFile(null);
                      setParsed(null);
                      setNotice(null);
                    }}
                    className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold transition shadow-sm border ${importMode === "master_data"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    📦 1. ອັບໂຫລດ Master Data (master_data)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("store_inventory");
                      setFile(null);
                      setParsed(null);
                      setNotice(null);
                    }}
                    className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold transition shadow-sm border ${importMode === "store_inventory"
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    🏬 2. ອັບໂຫລດ Store Inventory ({branchId}) · shelf_location ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportMode("sales_import");
                      setFile(null);
                      setParsed(null);
                      setNotice(null);
                    }}
                    className={`rounded-2xl px-4 py-2.5 text-xs font-extrabold transition shadow-sm border ${importMode === "sales_import"
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-orange-200 bg-orange-50/70 text-orange-800 hover:bg-orange-100"
                      }`}
                  >
                    🛒 3. ອັບໂຫລດຍອດຂາຍ (Sales Import) · ຫັກ Stock + ເພີ່ມ QTY ຍອດຂາຍ
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                ສາຂາປັດຈຸບັນ
              </div>

              <div className="mt-1 text-lg font-extrabold text-slate-900">
                {branchId || "—"}
              </div>
            </div>
          </div>

          {/* Stepper */}
          <div className="mt-6 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid-cols-4">
            {[
              {
                no: "01",
                title: "ເລືອກສາຂາ",
                active: true,
              },
              {
                no: "02",
                title: "ເລືອກໄຟລ໌",
                active: !!file,
              },
              {
                no: "03",
                title: "ກວດສອບ",
                active: !!parsed,
              },
              {
                no: "04",
                title: "ນຳເຂົ້າ",
                active:
                  modalState === "success" ||
                  progress > 0,
              },
            ].map((step, index) => (
              <div
                key={step.no}
                className={`relative flex items-center gap-3 px-4 py-4 sm:px-5 ${index < 3
                  ? "border-b border-slate-100 sm:border-b-0 sm:border-r"
                  : ""
                  }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${step.active
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400"
                    }`}
                >
                  {step.no}
                </div>

                <div>
                  <div
                    className={`text-sm font-bold ${step.active
                      ? "text-slate-900"
                      : "text-slate-400"
                      }`}
                  >
                    {step.title}
                  </div>

                  {index === 0 && (
                    <div className="text-[11px] text-slate-400">
                      ກຳນົດສາຂາ
                    </div>
                  )}

                  {index === 1 && (
                    <div className="text-[11px] text-slate-400">
                      Excel / CSV
                    </div>
                  )}

                  {index === 2 && (
                    <div className="text-[11px] text-slate-400">
                      Preview
                    </div>
                  )}

                  {index === 3 && (
                    <div className="text-[11px] text-slate-400">
                      Supabase
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </header>

        {/* ============================= */}
        {/* NOTICE */}
        {/* ============================= */}

        {notice && (
          <div
            className={`mb-6 flex items-start gap-3 rounded-2xl border px-4 py-4 shadow-sm ${notice.ok
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
              }`}
          >
            <div
              className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-black ${notice.ok
                ? "bg-emerald-500 text-white"
                : "bg-rose-500 text-white"
                }`}
            >
              {notice.ok ? "✓" : "!"}
            </div>

            <div>
              <div
                className={`text-sm font-bold ${notice.ok
                  ? "text-emerald-900"
                  : "text-rose-900"
                  }`}
              >
                {notice.ok
                  ? "ດຳເນີນການສຳເລັດ"
                  : "ມີບັນຫາ"}
              </div>

              <p
                className={`mt-0.5 text-sm leading-6 ${notice.ok
                  ? "text-emerald-700"
                  : "text-rose-700"
                  }`}
              >
                {notice.text}
              </p>
            </div>
          </div>
        )}

        {/* ============================= */}
        {/* MAIN GRID */}
        {/* ============================= */}

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          {/* ============================= */}
          {/* LEFT SIDEBAR */}
          {/* ============================= */}

          <aside className="space-y-5">
            {/* Branch */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  🏪
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    ເລືອກສາຂາ
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ຂໍ້ມູນຈະຖືກບັນທຶກຕາມສາຂາທີ່ເລືອກ
                  </p>
                </div>
              </div>

              <label className="mt-5 block text-xs font-bold text-slate-500">
                ສາຂາ
              </label>

              <select
                value={branch}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setCustomBranch("");
                  setParsed(null);
                  setFile(null);
                  setInspectResult(null);
                  setNotice(null);
                }}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              >
                {branchOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}

                <option value="__custom__">
                  + ເພີ່ມສາຂາເອງ
                </option>
              </select>

              {branch === "__custom__" && (
                <div className="mt-3">
                  <input
                    value={customBranch}
                    onChange={(e) => {
                      setCustomBranch(e.target.value);
                      setParsed(null);
                      setFile(null);
                      setInspectResult(null);
                    }}
                    placeholder="ພິມຊື່ສາຂາ..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              )}

              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <div className="text-[11px] font-bold text-slate-400">
                  ສາຂາທີ່ຈະນຳເຂົ້າ
                </div>

                <div className="mt-1 text-base font-extrabold text-slate-900">
                  {branchId || "ກະລຸນາເລືອກສາຂາ"}
                </div>
              </div>
            </div>

            {/* Auto Sync */}
            <div
              className={`rounded-3xl border p-5 shadow-sm transition ${syncStore
                ? "border-emerald-200 bg-emerald-50/70"
                : "border-slate-200 bg-white"
                }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-2xl ${syncStore
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100"
                      }`}
                  >
                    🔄
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Sync ອັດຕະໂນມັດ
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      ອັບເດດຊື່ ແລະຫມວດໝູ່ໄປຫາ Store Inventory
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSyncStore((prev) => !prev)}
                  disabled={isWorking}
                  aria-label="ເປີດ ຫຼື ປິດ Sync"
                  className={`relative h-7 w-12 rounded-full transition ${syncStore
                    ? "bg-emerald-500"
                    : "bg-slate-300"
                    }`}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${syncStore
                      ? "left-6"
                      : "left-1"
                      }`}
                  />
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-white/80 bg-white/80 p-3 text-xs leading-5 text-slate-500">
                {syncStore ? (
                  <>
                    ເມື່ອ import ສຳເລັດ
                    ລະບົບຈະພະຍາຍາມອັບເດດ
                    <span className="font-bold text-slate-700">
                      {" "}
                      item_name
                    </span>
                    ,{" "}
                    <span className="font-bold text-slate-700">
                      category_1_actual
                    </span>{" "}
                    ແລະ
                    <span className="font-bold text-slate-700">
                      {" "}
                      category_2_actual
                    </span>
                    ໃຫ້ອັດຕະໂນມັດ
                  </>
                ) : (
                  <>
                    ຈະນຳເຂົ້າສະເພາະ Master Data
                    ໂດຍບໍ່ Sync ໄປຫາ Store Inventory
                  </>
                )}
              </div>
            </div>

            {/* Direct Sync */}
            <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-xl text-white">
                  ⚡
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    ກວດສອບ ແລະ Sync
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ປຽບທຽບ Master Data ກັບ Store Inventory
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-white/80 p-3 text-xs">
                <span className="font-bold text-indigo-700">
                  ສາຂາ:
                </span>{" "}
                <span className="font-extrabold text-slate-900">
                  {branchId || "—"}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={inspectBranchStore}
                  disabled={isWorking || !branchId}
                  className="rounded-2xl border border-indigo-200 bg-white px-3 py-3 text-xs font-bold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inspecting
                    ? "ກຳລັງກວດ..."
                    : "🔍 ກວດສອບ"}
                </button>

                <button
                  type="button"
                  onClick={syncBranchStoreDirectly}
                  disabled={
                    isWorking || !branchId
                  }
                  className="rounded-2xl bg-indigo-600 px-3 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {syncingStoreDirect
                    ? "ກຳລັງ Sync..."
                    : "⚡ Sync ທັນທີ"}
                </button>
              </div>

              {inspectResult && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-indigo-100 bg-white">
                  <div className="grid grid-cols-2 divide-x border-b">
                    <div className="p-3">
                      <div className="text-[11px] text-slate-400">
                        Store
                      </div>

                      <div className="mt-1 text-lg font-extrabold text-slate-900">
                        {formatNumber(
                          inspectResult.totalStore,
                        )}
                      </div>
                    </div>

                    <div className="p-3">
                      <div className="text-[11px] text-slate-400">
                        Master
                      </div>

                      <div className="mt-1 text-lg font-extrabold text-slate-900">
                        {formatNumber(
                          inspectResult.totalMaster,
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-500">
                        ຕ້ອງອັບເດດ
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${inspectResult.needUpdateCount > 0
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700"
                          }`}
                      >
                        {formatNumber(
                          inspectResult.needUpdateCount,
                        )}{" "}
                        ລາຍການ
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            
            {/* 🆕 5. Sync Category from Master Data (English Only) & Auto Shelf */}
            <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50/70 to-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-xl text-white shadow-sm">
                  🔤
                </div>

                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Master Data Category
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    ດຶງ Category ຈາກ Master Data (ພາສາອັງກິດເທົ່ານັ້ນ) ແລ້ວຈັດຜັງ Shelf ໂພນຕ້ອງ ให้อัตโนมัติ
                  </p>
                </div>
              </div>

              {/* Source info */}
              <div className="mt-4 rounded-2xl bg-sky-100/60 p-3 text-xs space-y-1.5 text-sky-900">
                <div className="flex justify-between items-center">
                  <span className="font-bold">ແຫຼ່ງຂໍ້ມູນ:</span>
                  <span className="font-extrabold text-sky-800">📦 ตาราง master_data</span>
                </div>
                <div className="flex justify-between items-center border-t border-sky-200/60 pt-1.5">
                  <span className="font-bold">ສາຂາປາຍທາງ:</span>
                  <span className="font-extrabold text-slate-900">{branchId}</span>
                </div>
              </div>

              {/* Security Rule Badge */}
              <div className="mt-3 rounded-2xl bg-emerald-50 border border-emerald-200 p-2.5 text-[11px] leading-5 text-emerald-800 flex items-start gap-2">
                <span className="text-emerald-600 font-bold text-sm">✓</span>
                <div>
                  <strong>ກວດສອບພາສາອັງກິດ (English Only):</strong> ຮອງຮັບສະເພາະພາສາອັງກິດເທົ່ານັ້ນ ຫ້າມພາສາອື່ນປົນເດັດຂາດ. ຕຳແໜ່ງ Shelf Location ຈະຖືກຈັດເຂົ້າຜັງ <strong>{getPhonthongStyleRackPrefix(branchId)}</strong> ຂອງ {branchId || "ໂພນຕ້ອງ"} ให้อัตโนมัติ (ບໍ່ດຶງໂລເຄຊັ່ນຈາກບ່ອນອື່ນ)
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={inspectSyncMasterDataCategory}
                  disabled={isWorking || !branchId}
                  className="rounded-2xl border border-sky-300 bg-white px-3 py-3 text-xs font-bold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isInspectingCopy ? "ກຳລັງກວດ..." : "🔍 ກວດສອບ"}
                </button>

                <button
                  type="button"
                  onClick={executeSyncMasterDataCategory}
                  disabled={isWorking || !branchId}
                  className="rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-3 text-xs font-bold text-white shadow-sm transition hover:from-sky-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isCopyingShelf ? "ກຳລັງ Sync..." : "🚀 ເລີ່ມ Sync & Auto Shelf"}
                </button>
              </div>

              {/* Inspect Result */}
              {copyInspectResult && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-sky-200 bg-white p-3 text-xs space-y-2">
                  <div className="flex justify-between items-center text-slate-600">
                    <span>ລາຍການທີ່ຍັງຂາດ Category/Shelf:</span>
                    <span className="font-extrabold text-slate-900">{formatNumber(copyInspectResult.unassignedCount)} ລາຍການ</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-700 font-bold border-t border-slate-100 pt-1.5">
                    <span>ພົບ Category ພາສາອັງກິດໃນ Master:</span>
                    <span className="font-extrabold text-emerald-600">+{formatNumber(copyInspectResult.matchedCategoryCount)} ລາຍການ</span>
                  </div>
                  {copyInspectResult.canAutoAssignCount > 0 && (
                    <div className="flex justify-between items-center text-amber-700 font-bold border-t border-slate-100 pt-1.5">
                      <span>ຈັດເຂົ້າຜັງ {getPhonthongStyleRackPrefix(branchId)} {branchId}:</span>
                      <span className="font-extrabold text-amber-600">{formatNumber(copyInspectResult.canAutoAssignCount)} ລາຍການ</span>
                    </div>
                  )}
                  {copyInspectResult.rejectedNonEnglishCount > 0 && (
                    <div className="flex justify-between items-center text-rose-600 font-bold border-t border-slate-100 pt-1.5">
                      <span>ຕັດຄ່າທີ່ບໍ່ແມ່ນພາສາອັງກິດອອກ:</span>
                      <span className="font-extrabold text-rose-600">-{formatNumber(copyInspectResult.rejectedNonEnglishCount)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Rules */}
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-extrabold text-slate-900">
                ຂໍ້ມູນການນຳເຂົ້າ
              </div>

              <div className="mt-4 space-y-3">
                {[
                  "ຮອງຮັບ .xlsx / .xls / .csv",
                  "ໃຊ້ Sheet ທຳອິດອັດຕະໂນມັດ",
                  `ສົ່ງຂໍ້ມູນຄັ້ງລະ ${BATCH_SIZE} ແຖວ`,
                  "Barcode ຊ້ຳ ຈະໃຊ້ຂໍ້ມູນແຖວລ່າສຸດ",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-start gap-2.5 text-xs leading-5 text-slate-500"
                  >
                    <span className="mt-0.5 text-emerald-500">
                      ✓
                    </span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          {/* ============================= */}
          {/* MAIN */}
          {/* ============================= */}

          <main className="space-y-5">
            
            {/* 💡 Column Guide Banner */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm text-xs leading-5">
              <div className="flex items-center gap-2 font-extrabold text-slate-800 text-sm">
                <span>💡</span>
                <span>ຮູບແບບຫົວຖັນ Excel ທີ່ລະບົບຮອງຮັບ (Column Format Guide):</span>
              </div>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-600">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="font-bold text-emerald-700">📦 Master Data:</div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    <li><strong className="text-slate-800">Barcode:</strong> Barcode, บาร์โค้ด, ບາໂຄດ, SKU, Code <span className="text-rose-500 font-bold">*ຈຳເປັນ</span></li>
                    <li><strong className="text-slate-800">Item Name:</strong> Description, Item Name, ຊື່ສິນຄ້າ, ຊື່</li>
                    <li><strong className="text-slate-800">Category 1:</strong> Category 1, ໝວດໝູ່ 1, หมวดหลัก</li>
                    <li><strong className="text-slate-800">Category 2:</strong> Category 2, ໝວດໝູ່ 2, หมวดย่อย</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <div className="font-bold text-sky-700">🏬 Store Inventory:</div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    <li><strong className="text-slate-800">Barcode:</strong> Barcode, Barcode_No, บาร์โค้ด, ບາໂຄດ <span className="text-rose-500 font-bold">*ຈຳເປັນ</span></li>
                    <li><strong className="text-slate-800">Item Name:</strong> Item Name, Description, ຊື່ສິນຄ້າ</li>
                    <li><strong className="text-slate-800">Store Qty:</strong> Qty, Quantity, จำนวน, ຈຳນວນ</li>
                    <li><strong className="text-slate-800">Shelf Location:</strong> Shelf, Location, Rack, ตู้, ຊັ້ນ</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-orange-50/60 p-3 border border-orange-200/70">
                  <div className="font-bold text-orange-700">🛒 ລາຍງານຍອດຂາຍ (Sales Report):</div>
                  <ul className="mt-1 space-y-0.5 list-disc list-inside">
                    <li><strong className="text-slate-800">Barcode:</strong> ບາໂຄດ 13 ຫຼັກ (Barcode) <span className="text-rose-500 font-bold">*ຈຳເປັນ</span></li>
                    <li><strong className="text-slate-800">Product Name:</strong> ຊື່ສິນຄ້າ (Product Name)</li>
                    <li><strong className="text-slate-800">Qty:</strong> ຈຳນວນ (Qty) <span className="text-rose-500 font-bold">*ຈຳເປັນ</span></li>
                    <li><strong className="text-orange-800">ບາໂຄດຊ້ຳ:</strong> ລະບົບບວກລວມຈຳນວນຂາຍໃຫ້ອັດຕະໂນມັດ ແລ້ວນຳໄປຫັກ Stock + ເພີ່ມ QTY ຍອດຂາຍ</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Upload */}
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();

                if (
                  e.currentTarget === e.target
                ) {
                  setDragging(false);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);

                readFile(
                  e.dataTransfer.files?.[0],
                );
              }}
              className={`relative overflow-hidden rounded-[28px] border-2 border-dashed bg-white shadow-sm transition ${dragging
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-slate-200"
                }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                hidden
                onChange={(e) =>
                  readFile(e.target.files?.[0])
                }
              />

              <div className="relative px-5 py-14 sm:px-10 sm:py-16">
                <div className="mx-auto max-w-2xl text-center">
                  <div
                    className={`mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] text-4xl shadow-sm transition ${dragging
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-100"
                      }`}
                  >
                    {dragging ? "↓" : "↑"}
                  </div>

                  <div className="mt-6">
                    <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                      ອັບໂຫຼດໄຟລ໌ Excel
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      ລາກໄຟລ໌ມາວາງບ່ອນນີ້
                      ຫຼືເລືອກໄຟລ໌ຈາກເຄື່ອງ
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      inputRef.current?.click()
                    }
                    disabled={isWorking}
                    className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span>📁</span>
                    ເລືອກໄຟລ໌
                  </button>

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-slate-400">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
                      XLSX
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
                      XLS
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
                      CSV
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1.5">
                      Sheet ທຳອິດ
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Selected File */}
            {file && (
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-xl">
                      📊
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-slate-900">
                        {file.name}
                      </div>

                      <div className="mt-1 text-xs text-slate-400">
                        {formatFileSize(file.size)} ·{" "}
                        {parsed
                          ? `${formatNumber(
                            parsed.rows.length,
                          )} ລາຍການ`
                          : "ກຳລັງກວດສອບ"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFile(null);
                      setParsed(null);
                      setNotice(null);

                      if (inputRef.current) {
                        inputRef.current.value =
                          "";
                      }
                    }}
                    disabled={isWorking}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                  >
                    ລຶບໄຟລ໌
                  </button>
                </div>
              </div>
            )}

            {/* Preview */}
            {parsed && (
              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-extrabold text-slate-900">
                          ກວດສອບຂໍ້ມູນກ່ອນນຳເຂົ້າ
                        </h2>

                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
                          READY
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        ກວດເບິ່ງຕົວຢ່າງ
                        ກ່ອນສົ່ງເຂົ້າ Supabase
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={importRows}
                      disabled={
                        busy ||
                        !client ||
                        !parsed.rows.length ||
                        !branchId
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3.5 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {busy ? (
                        <>
                          <span className="animate-spin">
                            ◌
                          </span>
                          ກຳລັງນຳເຂົ້າ {progress}%
                        </>
                      ) : (
                        <>
                          <span>↑</span>
                          ນຳເຂົ້າ Supabase
                        </>
                      )}
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-[11px] font-bold text-slate-400">
                        ຈຳນວນທັງໝົດ
                      </div>

                      <div className="mt-1 text-xl font-extrabold text-slate-900">
                        {formatNumber(parsed.totalRows)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-emerald-50 p-4">
                      <div className="text-[11px] font-bold text-emerald-600">
                        ພ້ອມນຳເຂົ້າ
                      </div>

                      <div className="mt-1 text-xl font-extrabold text-emerald-700">
                        {formatNumber(parsed.rows.length)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-amber-50 p-4">
                      <div className="text-[11px] font-bold text-amber-600">
                        Barcode ຊ້ຳ
                      </div>

                      <div className="mt-1 text-xl font-extrabold text-amber-700">
                        {formatNumber(parsed.duplicateRows)}
                      </div>
                    </div>

                    <div className="rounded-2xl bg-rose-50 p-4">
                      <div className="text-[11px] font-bold text-rose-600">
                        ບໍ່ມີ Barcode
                      </div>

                      <div className="mt-1 text-xl font-extrabold text-rose-700">
                        {formatNumber(parsed.invalidRows)}
                      </div>
                    </div>
                  </div>

                  {busy && (
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-xs font-bold text-slate-500">
                        <span>ຄວາມຄືບໜ້າ</span>
                        <span>{progress}%</span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{
                            width: `${progress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <span className="font-bold text-slate-500">
                      ແຫຼ່ງຂໍ້ມູນ:
                    </span>

                    <span className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">
                      {file?.name}
                    </span>

                    <span className="font-bold text-slate-400">
                      →
                    </span>

                    <span className="rounded-full bg-emerald-100 px-3 py-1.5 font-bold text-emerald-700">
                      {branchId}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 bg-white text-left">
                        <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                          Barcode
                        </th>

                        <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                          ຊື່ສິນຄ້າ (Description)
                        </th>

                        {importMode === "sales_import" ? (
                          <>
                            <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                              ຈຳນວນຄັ້ງຂາຍ (Bills)
                            </th>
                            <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-orange-600">
                              ຈຳນວນຂາຍລວມ (-Stock / +Sales)
                            </th>
                            <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                              ຍອດລວມ (LAK)
                            </th>
                          </>
                        ) : importMode === "store_inventory" ? (
                          <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                            จำนวน (QTY)
                          </th>
                        ) : (
                          <>
                            <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                              ໝວດໝູ່ 1
                            </th>

                            <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                              ໝວດໝູ່ 2
                            </th>
                          </>
                        )}

                        <th className="px-5 py-4 text-[11px] font-extrabold uppercase tracking-wide text-slate-400">
                          ສາຂາ
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {preview.map((row, index) => (
                        <tr
                          key={`${row.barcode || row.barcode_no}-${row.branch_id}-${index}`}
                          className="transition hover:bg-slate-50/80"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-300">
                                {String(index + 1).padStart(
                                  2,
                                  "0",
                                )}
                              </span>

                              <span className="rounded-lg bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700">
                                {row.barcode || row.barcode_no}
                              </span>
                            </div>
                          </td>

                          <td className="max-w-[280px] px-5 py-4">
                            <div
                              className="truncate text-sm font-semibold text-slate-800"
                              title={
                                row.item_name || ""
                              }
                            >
                              {row.item_name || (
                                <span className="text-slate-300">
                                  —
                                </span>
                              )}
                            </div>
                          </td>

                          {importMode === "sales_import" ? (
                            <>
                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-lg bg-amber-100 px-2.5 py-1 font-mono text-xs font-bold text-amber-800">
                                  {formatNumber(row.tx_count)} ຄັ້ງ
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className="inline-flex rounded-lg bg-orange-100 px-3 py-1 font-mono text-xs font-black text-orange-800">
                                  {formatNumber(row.sales_qty)} ຊິ້ນ
                                </span>
                              </td>
                              <td className="px-5 py-4">
                                <span className="font-mono text-xs font-bold text-slate-600">
                                  ₭ {formatNumber(row.amount_lak)}
                                </span>
                              </td>
                            </>
                          ) : importMode === "store_inventory" ? (
                            <td className="px-5 py-4">
                              <span className="inline-flex rounded-lg bg-emerald-100 px-3 py-1 font-mono text-xs font-black text-emerald-800">
                                {formatNumber(row.store_qty)}
                              </span>
                            </td>
                          ) : (
                            <>
                              <td className="max-w-[220px] px-5 py-4">
                                <div className="truncate text-sm text-slate-600">
                                  {row.category_1 || (
                                    <span className="text-slate-300">
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="max-w-[220px] px-5 py-4">
                                <div className="truncate text-sm text-slate-600">
                                  {row.category_2 || (
                                    <span className="text-slate-300">
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          <td className="px-5 py-4">
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-700">
                              {row.branch_id}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
                  <div className="flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      ສະແດງຕົວຢ່າງ{" "}
                      {formatNumber(preview.length)} ລາຍການ
                      ຈາກທັງໝົດ{" "}
                      {formatNumber(parsed.rows.length)}
                    </span>

                    <span className="font-semibold">
                      Barcode + Branch ແມ່ນຄີຫຼັກສຳລັບ Upsert
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!parsed && !file && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                    💡
                  </div>

                  <div>
                    <div className="text-sm font-extrabold text-slate-900">
                      ກຽມຂໍ້ມູນກ່ອນນຳເຂົ້າ
                    </div>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      ເລືອກສາຂາດ້ານຊ້າຍ
                      ແລ້ວອັບໂຫຼດໄຟລ໌ທີ່ມີ Barcode
                      ຈາກນັ້ນລະບົບຈະສະແດງ Preview
                      ກ່ອນຈະບັນທຶກລົງ Supabase
                    </p>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </section>
  );
}

export { DEFAULT_BRANCH };
