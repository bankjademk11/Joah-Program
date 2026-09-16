import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Database, Filter, ListChecks } from 'lucide-react';
import StoreDashboard from './StoreDashboard';
import StoreResultTable from './StoreResultTable';
import PhonthongRackAuditorModal from './PhonthongRackAuditorModal';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { getStoreRackSuggestions, validateStoreRack } from '../../../utils/storeRackUtils';
import { logStoreInventoryHistory } from '../../../utils/supabaseSync';

const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ', 'ເມກ້າມໍ', 'ໂພນຕ້ອງ', 'ເທຣນນິ້ງ (Training)'];
const MEGAMALL = 'ເມກ້າມໍ';

const StoreInventoryMockup = ({ onBack, currentUser, isAdmin, initialBranch }) => {
  const toast = useToast();

  const [filterStatus, setFilterStatus] = useState('all');
  const [hideZeroQty, setHideZeroQty] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(
    initialBranch || (isAdmin ? 'ຕະຫຼາດລາວ' : (currentUser?.branch_id || ''))
  );
  const [results, setResults] = useState([]);
  const [masterDataList, setMasterDataList] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showRackAuditor, setShowRackAuditor] = useState(false);

  // Check if branch is Phonthong (ໂພນຕ້ອງ)
  const isPhonthong = selectedBranch === 'ໂພນຕ້ອງ' || (selectedBranch && selectedBranch.includes('ໂພນຕ້ອງ'));

  // Helper to find category from masterDataList
  const getCategoryFromMaster = (barcode) => {
    const bc = String(barcode).trim();
    const match = masterDataList.find(m => String(m.barcode).trim() === bc);
    return match?.category_1 || match?.category_2 || '';
  };

  // ============================================================
  // Fetch MASTER DATA ทั้งหมด
  // อ่านทีละ 1,000 รายการจนกว่าจะครบทุก record
  // ============================================================
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const PAGE_SIZE = 1000;
        let allData = [];
        let from = 0;

        console.log('[StoreInventory] 🔄 Loading ALL master_data...');

        while (true) {
          const { data: pageData, error } = await supabase
            .from('master_data')
            .select('barcode, product_name_la, item_name, category_1, category_2, branch_id')
            .range(from, from + PAGE_SIZE - 1);

          if (error) {
            console.error(
              '[StoreInventory] ❌ Error fetching master_data:',
              error
            );
            return;
          }

          // ไม่มีข้อมูลแล้ว = โหลดครบแล้ว
          if (!pageData || pageData.length === 0) {
            break;
          }

          allData = [...allData, ...pageData];

          console.log(
            `[StoreInventory] 📦 Master Data loaded: ${allData.length} records`
          );

          // ถ้าได้ข้อมูลน้อยกว่า PAGE_SIZE
          // แสดงว่าเป็นหน้าสุดท้าย
          if (pageData.length < PAGE_SIZE) {
            break;
          }

          from += PAGE_SIZE;
        }

        // ========================================================
        // Deduplicate ด้วย barcode
        // ========================================================
        const dedupMap = new Map();

        allData.forEach(row => {
          const barcode = String(row.barcode || '').trim();

          if (barcode && !dedupMap.has(barcode)) {
            dedupMap.set(barcode, row);
          }
        });

        const deduped = Array.from(dedupMap.values());

        setMasterDataList(deduped);

        console.log(
          '[StoreInventory] ✅ Master Data loaded:',
          allData.length,
          'total records,',
          deduped.length,
          'unique SKUs'
        );

      } catch (err) {
        console.warn(
          '[StoreInventory] ⚠️ Could not load master_data:',
          err.message
        );
      }
    };

    fetchMasterData();
  }, []);

  // Helper: find master_data row by barcode
  const getMasterRow = (barcode) => {
    const bc = String(barcode || '').trim();
    return masterDataList.find(m => String(m.barcode || '').trim() === bc) || null;
  };

  // Map store_inventory row → StoreResultTable row shape
  const mapRow = (row, idx, warehouseMap = {}, dcMap = {}, warehouseRackMap = {}) => {
    const qty = row.store_qty ?? 0;
    const rack = row.shelf_location || '';
    const bc = String(row.barcode_no || '').trim();

    // Lookup master_data
    const masterRow = getMasterRow(bc);

    // PRIORITIZE:
    // 1. item_name จาก store_inventory
    // 2. product_name_la หรือ item_name จาก master_data
    const resolvedItemName =
      row.item_name ||
      masterRow?.product_name_la ||
      masterRow?.item_name ||
      '';

    // PRIORITIZE:
    // 1. category_1_actual ที่บันทึกใน DB
    // 2. category จาก master_data
    const masterCategory =
      row.category_1_actual ||
      masterRow?.category_1 ||
      masterRow?.category_2 ||
      '';

    // Determine status based on Rules
    let status = 'passed';

    if (qty === 0) {
      status = 'missing';
    } else if (!masterCategory) {
      status = 'incomplete';
    } else if (!validateStoreRack(rack, masterCategory, selectedBranch)) {
      status = 'mismatch';
    }

    return {
      id: row.id,
      rowIndex: idx + 1,
      barcode: bc,
      itemName: resolvedItemName,
      masterItemName: resolvedItemName,
      rackLocation: rack || '—',
      qty: qty,
      maxQty: row.max_qty || null,
      productTag: row.product_tag || null,
      masterQty: qty,
      warehouseQty: warehouseMap[bc] ?? 0,
      warehouseRack: warehouseRackMap[bc]
        ? Array.from(warehouseRackMap[bc]).join(', ')
        : '',
      dcQty: dcMap[bc] ?? 0,
      salesQty: row.sales_qty ?? null,
      category1: masterCategory,
      category2: row.category_2_actual || '',
      status: status,
      branch_id: row.branch_id,
    };
  };

  const fetchData = useCallback(async () => {
    if (!selectedBranch) return;

    setIsLoading(true);

    try {
      // ==========================================================
      // 1. Fetch store_inventory (ໜ້າຮ້ານ)
      // ==========================================================
      let storeData = [];
      let storePage = 0;
      const storePageSize = 1000;
      let storeHasMore = true;

      while (storeHasMore) {
        const { data: pageData, error: storeErr } = await supabase
          .from('store_inventory')
          .select(
            'id, barcode_no, item_name, store_qty, shelf_location, category_1_actual, category_2_actual, max_qty, product_tag, sales_qty, branch_id'
          )
          .eq('branch_id', selectedBranch)
          .range(
            storePage * storePageSize,
            (storePage + 1) * storePageSize - 1
          );

        if (storeErr) throw storeErr;

        if (!pageData || pageData.length === 0) {
          storeHasMore = false;
        } else {
          storeData = [...storeData, ...pageData];

          if (pageData.length < storePageSize) {
            storeHasMore = false;
          }

          storePage++;
        }

        if (storePage > 25) break;
      }

      // ==========================================================
      // 2. Fetch location_inventory + table_dc_stock
      // ==========================================================
      const relevantBarcodes = [
        ...new Set((storeData || []).map(r => r.barcode_no))
      ].filter(Boolean);

      let whData = [];
      let dcData = [];

      if (relevantBarcodes.length > 0) {
        const chunkSize = 200;
        const whPromises = [];
        const dcPromises = [];

        for (let i = 0; i < relevantBarcodes.length; i += chunkSize) {
          const chunk = relevantBarcodes.slice(i, i + chunkSize);

          // location_inventory → warehouseQty
          whPromises.push(
            supabase
              .from('location_inventory')
              .select('barcode_no, qty, rack_location')
              .eq('branch_id', selectedBranch)
              .in('barcode_no', chunk)
          );

          // table_dc_stock → dcQty
          dcPromises.push(
            supabase
              .from('table_dc_stock')
              .select('barcode, qty')
              .eq('branch_id', selectedBranch)
              .in('barcode', chunk)
          );
        }

        // Execute queries in parallel
        const [whResponses, dcResponses] = await Promise.all([
          Promise.all(whPromises),
          Promise.all(dcPromises)
        ]);

        // Merge warehouse results
        whResponses.forEach(res => {
          if (!res.error && res.data) {
            whData = [...whData, ...res.data];
          }
        });

        // Merge DC results
        dcResponses.forEach(res => {
          if (!res.error && res.data) {
            dcData = [...dcData, ...res.data];
          }
        });
      }

      // ==========================================================
      // Build warehouseMap
      // ==========================================================
      const warehouseMap = {};
      const warehouseRackMap = {};

      whData.forEach(row => {
        const bc = String(row.barcode_no || '').trim();

        if (bc) {
          warehouseMap[bc] =
            (warehouseMap[bc] || 0) + Number(row.qty || 0);

          if (
            row.rack_location &&
            row.rack_location !== '-' &&
            row.rack_location !== 'N/A'
          ) {
            if (!warehouseRackMap[bc]) {
              warehouseRackMap[bc] = new Set();
            }

            warehouseRackMap[bc].add(row.rack_location);
          }
        }
      });

      // ==========================================================
      // Build dcMap
      // ==========================================================
      const dcMap = {};

      dcData.forEach(row => {
        const bc = String(row.barcode || '').trim();

        if (bc) {
          dcMap[bc] =
            (dcMap[bc] || 0) + Number(row.qty || 0);
        }
      });

      // ==========================================================
      // Map final results
      // ==========================================================
      setResults(
        (storeData || []).map(
          (row, idx) => mapRow(row, idx, warehouseMap, dcMap, warehouseRackMap)
        )
      );

    } catch (err) {
      console.error('[StoreInventory] ❌ fetchData error:', err);

      toast.error(
        'ດຶງຂໍ້ມູນຜິດພາດ: ' + err.message
      );

    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch, masterDataList]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ============================================================
  // Realtime
  // ============================================================
  useEffect(() => {
    let debounceTimer = null;

    const triggerRefresh = () => {
      clearTimeout(debounceTimer);

      debounceTimer = setTimeout(() => {
        fetchData();
      }, 3000);
    };

    const channel = supabase
      .channel(`store_rt_all_${selectedBranch}`)

      // ========================================================
      // 1. Store QTY
      // ========================================================
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_inventory'
        },
        async (payload) => {
          const rowId =
            payload.new?.id ||
            payload.old?.id;

          if (!rowId) return;

          if (payload.eventType === 'DELETE') {
            setResults(prev =>
              prev.filter(r => r.id !== rowId)
            );

            return;
          }

          if (
            payload.eventType === 'UPDATE' ||
            payload.eventType === 'INSERT'
          ) {
            try {
              const { data: freshRow, error } =
                await supabase
                  .from('store_inventory')
                  .select('*')
                  .eq('id', rowId)
                  .single();

              if (error || !freshRow) return;

              if (
                freshRow.branch_id !== selectedBranch
              ) {
                return;
              }

              setResults(prev => {
                const existingIdx =
                  prev.findIndex(r => r.id === rowId);

                if (existingIdx >= 0) {
                  const oldRow = prev[existingIdx];

                  const updatedRow = {
                    ...mapRow(
                      freshRow,
                      oldRow.rowIndex - 1,
                      {},
                      {},
                      {}
                    ),
                    warehouseQty:
                      oldRow.warehouseQty,
                    warehouseRack:
                      oldRow.warehouseRack,
                    dcQty:
                      oldRow.dcQty
                  };

                  const newArr = [...prev];

                  newArr[existingIdx] = updatedRow;

                  return newArr;
                } else {
                  const newRow =
                    mapRow(
                      freshRow,
                      prev.length,
                      {},
                      {},
                      {}
                    );

                  return [
                    newRow,
                    ...prev
                  ];
                }
              });

            } catch (err) {
              console.error(
                '[Realtime sync error]:',
                err
              );
            }
          }
        }
      )

      // ========================================================
      // 2. Warehouse QTY
      // ========================================================
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'location_inventory'
        },
        (payload) => {
          const rowBranch =
            payload.new?.branch_id ||
            payload.old?.branch_id;

          if (
            rowBranch &&
            rowBranch !== selectedBranch
          ) {
            return;
          }

          triggerRefresh();
        }
      )

      // ========================================================
      // 3. DC Stock QTY
      // ========================================================
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'table_dc_stock'
        },
        (payload) => {
          const rowBranch =
            payload.new?.branch_id ||
            payload.old?.branch_id;

          if (
            rowBranch &&
            rowBranch !== selectedBranch
          ) {
            return;
          }

          triggerRefresh();
        }
      )

      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };

  }, [selectedBranch, fetchData]);

  // ============================================================
  // Update qty in local state
  // ============================================================
  const handleUpdateRowQty = (rowIndex, updates) => {
    setResults(prev =>
      prev.map(r =>
        r.rowIndex === rowIndex
          ? {
            ...r,
            ...updates,
            status:
              updates.qty > 0
                ? 'passed'
                : 'missing'
          }
          : r
      )
    );
  };

  // ============================================================
  // Add New Product
  // ============================================================
  const handleAddNewProduct = async (formData) => {
    try {
      const searchBarcode =
        String(formData.barcode_no).trim();

      // Additional check to warehouse data
      const {
        data: debugWh,
        error: debugWhErr
      } = await supabase
        .from('location_inventory')
        .select('*')
        .eq('branch_id', selectedBranch);

      const payload = {
        barcode_no:
          formData.barcode_no,

        item_name:
          formData.item_name ||
          'New Item',

        store_qty:
          formData.qty || 0,

        shelf_location:
          formData.rack_location || '-',

        category_1_actual:
          formData.category_1_actual || '',

        category_2_actual:
          formData.category_2_actual || '',

        max_qty:
          formData.max_qty
            ? Number(formData.max_qty)
            : null,

        product_tag:
          formData.product_tag || null,

        branch_id:
          selectedBranch,

        updated_by:
          currentUser?.id
            ? `${currentUser.name} (${currentUser.id})`
            : (currentUser?.name || 'Staff'),

        last_updated:
          new Date().toISOString()
      };

      // Check if item already exists
      // at exact shelf_location + branch
      const {
        data: existingRow
      } = await supabase
        .from('store_inventory')
        .select('id, store_qty')
        .eq(
          'barcode_no',
          payload.barcode_no
        )
        .eq(
          'shelf_location',
          payload.shelf_location
        )
        .eq(
          'branch_id',
          selectedBranch
        )
        .maybeSingle();

      let error = null;

      if (existingRow) {
        // Update existing row
        const updatePayload = {
          item_name:
            payload.item_name,

          store_qty:
            payload.store_qty,

          category_1_actual:
            payload.category_1_actual,

          category_2_actual:
            payload.category_2_actual,

          max_qty:
            payload.max_qty,

          product_tag:
            payload.product_tag,

          updated_by:
            payload.updated_by,

          last_updated:
            payload.last_updated
        };

        const res =
          await supabase
            .from('store_inventory')
            .update(updatePayload)
            .eq(
              'id',
              existingRow.id
            );

        error = res.error;

      } else {
        // Upsert new row
        const res =
          await supabase
            .from('store_inventory')
            .upsert(
              payload,
              {
                onConflict:
                  'barcode_no,shelf_location,branch_id'
              }
            );

        error = res.error;
      }

      if (error) {
        console.error(
          '[StoreInventory.DEBUG] ❌ Supabase UPSERT Error:',
          error
        );

        throw error;
      }

      // ========================================================
      // Log to history
      // ========================================================
      await logStoreInventoryHistory({
        actionType: 'added',

        barcode:
          payload.barcode_no,

        itemName:
          payload.item_name,

        oldQty: 0,

        newQty:
          payload.store_qty,

        oldLocation: null,

        newLocation:
          payload.shelf_location,

        oldTag: null,

        newTag:
          payload.product_tag,

        oldMaxQty: null,

        newMaxQty:
          payload.max_qty,

        reason:
          formData.remarks ||
          formData.reason ||
          'New Item Add',

        branchId:
          selectedBranch,

        updatedBy:
          payload.updated_by
      });

      // ========================================================
      // Deduct DC stock
      // ========================================================
      const remarkStr =
        formData.remarks ||
        formData.reason ||
        '';

      const isNewStock =
        remarkStr.includes('New Stock In') ||
        remarkStr.includes('ສິນຄ້າເຂົ້າໃໝ່') ||
        remarkStr.includes(
          'First-time product data recording'
        ) ||
        remarkStr.includes(
          'ການບັນທຶກຂໍ້ມູນສິນຄ້າໜ້າຮ້ານຄັ້ງທຳອິດ'
        );

      if (
        isNewStock &&
        Number(formData.qty) > 0
      ) {
        try {
          const deductAmt =
            Number(formData.qty);

          const {
            data: dcRow,
            error: dcFetchErr
          } = await supabase
            .from('table_dc_stock')
            .select('qty')
            .eq(
              'barcode',
              formData.barcode_no
            )
            .eq(
              'branch_id',
              selectedBranch
            )
            .maybeSingle();

          console.log(
            '[DC Deduct] dcRow:',
            dcRow,
            '| deductAmt:',
            deductAmt,
            '| branch:',
            selectedBranch,
            '| barcode:',
            formData.barcode_no,
            '| fetchErr:',
            dcFetchErr
          );

          if (dcRow) {
            const newDcQty =
              Math.max(
                0,
                (dcRow.qty || 0) -
                deductAmt
              );

            const {
              error: dcUpdateErr
            } = await supabase
              .from('table_dc_stock')
              .update({
                qty: newDcQty,
                updated_at:
                  new Date().toISOString()
              })
              .eq(
                'barcode',
                formData.barcode_no
              )
              .eq(
                'branch_id',
                selectedBranch
              );

            if (dcUpdateErr) {
              console.error(
                '[DC Deduct] Update error:',
                dcUpdateErr
              );
            } else {
              console.log(
                `[DC Deduct] ✅ DC qty updated: ${dcRow.qty} → ${newDcQty}`
              );
            }

          } else {
            console.warn(
              '[DC Deduct] ⚠️ No DC record found for',
              formData.barcode_no,
              'branch:',
              selectedBranch
            );
          }

        } catch (dcErr) {
          console.error(
            '[DC Deduct] Exception:',
            dcErr
          );
        }
      }

      console.log(
        '[StoreInventory.DEBUG] ✅ Success! UI will update via Realtime...'
      );

      toast.success(
        'ເພີ່ມສິນຄ້າໃໝ່ສຳເລັດ!'
      );

    } catch (err) {
      console.error(
        '[StoreInventory.DEBUG] ❌ Exception in handleAddNewProduct:',
        err
      );

      toast.error(
        'ເພີ່ມສິນຄ້າໃໝ່ຜິດພາດ: ' +
        err.message
      );

      throw err;
    }
  };

  // ============================================================
  // Dashboard Stats
  // ============================================================
  const stats = {
    total:
      results.length,

    passed:
      results.filter(
        r => r.status === 'passed'
      ).length,

    mismatch:
      results.filter(
        r => r.status === 'mismatch'
      ).length,

    incomplete:
      results.filter(
        r => r.status === 'incomplete'
      ).length,

    missing:
      results.filter(
        r => r.status === 'missing'
      ).length,

    zeroQty:
      results.filter(
        r => (r.qty ?? 0) === 0
      ).length,

    hasQty:
      results.filter(
        r => (r.qty ?? 0) > 0
      ).length,
  };

  return (
    <div className="w-full h-full space-y-4 sm:space-y-8 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 bg-white/50 dark:bg-slate-900/50 p-2 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm">

        <button
          onClick={onBack}
          className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
        >
          <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <div className="flex-1 min-w-0">

          <h2 className="text-base sm:text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 truncate">
            <Database className="text-emerald-500 w-4 h-4 sm:w-5 sm:h-5" />
            ຂໍ້ມູນຊັ້ນວ່າງເຄື່ອງໜ້າຮ້ານ
          </h2>

          <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">
            Store Inventory · {selectedBranch}
          </p>

        </div>

      </div>

      {/* Dashboard Stats */}
      <StoreDashboard
        stats={stats}
        activeFilter={filterStatus}
        onFilterChange={setFilterStatus}
        hideZeroQty={hideZeroQty}
        onHideZeroQtyChange={setHideZeroQty}
        onOpenRackAuditor={
          isPhonthong
            ? () => setShowRackAuditor(true)
            : null
        }
      />

      {/* Real Table */}
      <StoreResultTable
        results={results}
        allResults={results}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        masterData={masterDataList}
        rawFile={null}
        locationSheetName={selectedBranch}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        dbSource="supabase"
        onRefresh={fetchData}
        refreshTrigger={refreshTrigger}
        onUpdateRowQty={handleUpdateRowQty}
        currentUser={
          currentUser || {
            name: 'Staff',
            branch_id: selectedBranch,
            role: isAdmin ? 'HQ' : 'Store'
          }
        }
        currentBranch={selectedBranch}
        onAddNewProduct={handleAddNewProduct}
      />

      {/* ໂພນຕ້ອງ ເທົ່ານັ້ນ */}
      {showRackAuditor && (
        <PhonthongRackAuditorModal
          isOpen={showRackAuditor}
          onClose={() =>
            setShowRackAuditor(false)
          }
          inventoryData={results}
          branchName={selectedBranch}
        />
      )}

    </div>
  );
};

export default StoreInventoryMockup;