import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase as defaultSupabase } from "../../utils/supabaseClient";

const DEFAULT_BRANCH = "ໂພນຕ້ອງ";
const BRANCH_OPTIONS = ["ໂພນຕ້ອງ", "ສີວິໄລ", "ວັງຊາຍ", "ຕະຫຼາດລາວ"];
const BATCH_SIZE = 500;

const aliases = {
  barcode: ["barcode", "bar code", "sku"],
  item_name: ["description", "item name", "item_name"],
  product_name_la: ["lao description", "product name la", "product_name_la"],
  category_1: ["categories 1", "category 1", "category_1"],
  category_2: ["categories 2", "category 2", "category_2"],
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

  const columns = mapColumns(matrix[0]);

  if (columns.barcode < 0) {
    throw new Error("ບໍ່ພົບຖັນ Barcode ໃນໄຟລ໌");
  }

  const records = new Map();

  let invalidRows = 0;
  let duplicateRows = 0;

  matrix.slice(1).forEach((row) => {
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
  barcode_no: ["barcode", "bar code", "sku", "barcode_no", "ບາໂຄດ"],
  item_name: ["description", "item name", "item_name", "product name", "ຊື່ສິນຄ້າ"],
  store_qty: ["qty", "quantity", "store_qty", "store qty", "ຈຳນວນ"],
  shelf_location: ["shelf", "location", "shelf_location", "rack", "ตู้", "ຊັ້ນ"],
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

  const columns = mapStoreColumns(matrix[0]);

  if (columns.barcode_no < 0) {
    throw new Error("ບໍ່ພົບຖັນ Barcode ໃນໄຟລ໌ (ຕ້ອງມີຄໍລຳ Barcode)");
  }

  const records = new Map();
  let invalidRows = 0;
  let duplicateRows = 0;

  matrix.slice(1).forEach((row) => {
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

  const [dragging, setDragging] = useState(false);

  const branchId = customBranch.trim() || branch;

  const preview = useMemo(
    () => parsed?.rows.slice(0, 8) || [],
    [parsed],
  );

  const isWorking = busy || inspecting || syncingStoreDirect;

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

      const result =
        importMode === "store_inventory"
          ? parseStoreInventorySheet(firstSheet, branchId, nextFile.name, updatedBy)
          : parseMasterSheet(firstSheet, branchId, nextFile.name, updatedBy);

      setParsed(result);

      setNotice({
        ok: true,
        text: `ອ່ານໄຟລ໌ສຳເລັດ ${formatNumber(
          result.rows.length,
        )} ລາຍການ (${importMode === "store_inventory" ? "Store Inventory" : "Master Data"})`,
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

            if (existing?.id) {
              existingUpdates.push({
                id: existing.id,
                barcode_no: row.barcode_no,
                item_name: row.item_name || master?.item_name || existing.item_name || null,
                store_qty: row.store_qty,
                shelf_location: row.shelf_location || existing.shelf_location || null,
                branch_id: branchId,
                category_1_actual: master?.category_1 || existing.category_1_actual || null,
                category_2_actual: master?.category_2 || existing.category_2_actual || null,
                last_updated: new Date().toISOString(),
                updated_by: updatedBy || "store-excel-import",
              });
            } else {
              newInserts.push({
                barcode_no: row.barcode_no,
                item_name: row.item_name || master?.item_name || null,
                store_qty: row.store_qty,
                shelf_location: row.shelf_location || null,
                branch_id: branchId,
                category_1_actual: master?.category_1 || null,
                category_2_actual: master?.category_2 || null,
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

                        {importMode === "store_inventory" ? (
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

                          {importMode === "store_inventory" ? (
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
