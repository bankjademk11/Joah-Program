import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Database, Filter } from 'lucide-react';
import StoreDashboard from './StoreDashboard';
import StoreResultTable from './StoreResultTable';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { getStoreRackSuggestions, validateStoreRack } from '../../../utils/storeRackUtils';
import { logStoreInventoryHistory } from '../../../utils/supabaseSync';

const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ', 'ເມກ້າມໍ'];
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

  // Helper to find category from masterDataList
  const getCategoryFromMaster = (barcode) => {
    const bc = String(barcode).trim();
    const match = masterDataList.find(m => String(m.barcode).trim() === bc);
    return match?.category_1 || match?.category_2 || '';
  };

  // Fetch master_data ສຳລັບ QuickAdd auto-fill
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        let allMasterData = [];
        let page = 0;
        const pageSize = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: pageData, error } = await supabase
            .from('master_data')
            .select('barcode, product_name_la, item_name, category_1, category_2, branch_id', { count: 'exact' })
            .order('barcode', { ascending: true })
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error('[StoreInventory] Error fetching master_data page:', error);
            break;
          }

          if (!pageData || pageData.length === 0) {
            hasMore = false;
          } else {
            allMasterData = [...allMasterData, ...pageData];
            if (pageData.length < pageSize) hasMore = false;
            page++;
          }
          if (page > 50) break; // 50k Limit safety
        }

        if (allMasterData.length > 0) {
          // Dedup: prefer ຕະຫຼາດລາວ, fallback to any branch
          const dedupMap = new Map();
          // First pass: add all (any branch)
          allMasterData.forEach(row => {
            if (row.barcode) {
              if (!dedupMap.has(row.barcode)) dedupMap.set(row.barcode, row);
            }
          });
          // Second pass: override with ຕະຫຼາດລາວ if exists (highest priority)
          allMasterData.filter(r => r.branch_id === 'ຕະຫຼາດລາວ').forEach(row => {
            if (row.barcode) dedupMap.set(row.barcode, row);
          });
          const deduped = Array.from(dedupMap.values());
          setMasterDataList(deduped);
          console.log('[StoreInventory] Master Data loaded:', deduped.length, 'unique SKUs from', allMasterData.length, 'total records');
        }
      } catch (err) {
        console.warn('[StoreInventory] Could not load master_data:', err.message);
      }
    };
    fetchMasterData();
  }, []);


  // Map store_inventory row → StoreResultTable row shape
  const mapRow = (row, idx, warehouseMap = {}, dcMap = {}) => {
    const qty = row.store_qty ?? 0;
    const rack = row.shelf_location || '';

    // 🚀 PRIORITIZE: Use category saved in DB, fallback to master data lookup
    const masterCategory = row.category_1_actual || getCategoryFromMaster(row.barcode_no);

    // Determine status based on Rules
    let status = 'passed';
    if (qty === 0) {
      status = 'missing';
    } else if (!masterCategory) {
      status = 'incomplete'; // No category in master_data
    } else if (!validateStoreRack(rack, masterCategory, selectedBranch)) {
      status = 'mismatch'; // Wrong rack for this category
    }

    return {
      id: row.id,
      rowIndex: idx + 1,
      barcode: row.barcode_no,
      itemName: row.item_name || '',
      masterItemName: row.item_name || '',
      rackLocation: rack || '—',
      qty: qty,
      maxQty: row.max_qty || null,
      productTag: row.product_tag || null,
      masterQty: qty,
      warehouseQty: warehouseMap[String(row.barcode_no).trim()] ?? 0,
      dcQty: dcMap[String(row.barcode_no).trim()] ?? 0,
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
      // 1. Fetch store_inventory (ໜ້າຮ້ານ) — paginated with RETRY LOGIC
      let storeData = [];
      let storePage = 0;
      const storePageSize = 1000;
      let storeHasMore = true;
      let retryCount = 0;
      const maxRetries = 3;

      while (storeHasMore) {
        try {
          const { data: pageData, error: storeErr } = await supabase
            .from('store_inventory')
            .select('*')
            .eq('branch_id', selectedBranch)
            .order('item_name', { ascending: true })
            .range(storePage * storePageSize, (storePage + 1) * storePageSize - 1);
          
          if (storeErr) throw storeErr;
          
          if (!pageData || pageData.length === 0) {
            storeHasMore = false;
          } else {
            storeData = [...storeData, ...pageData];
            if (pageData.length < storePageSize) storeHasMore = false;
            storePage++;
            retryCount = 0; // reset retry on success
          }
          if (storePage > 100) break; // safety cap: 100k records max
        } catch (err) {
          if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(r => setTimeout(r, 1000 * retryCount)); // exponential backoff
          } else {
            throw err;
          }
        }
      }

      // 2. Fetch location_inventory for warehouseQty (ຈຳນວນ ຫຼັງສາງ)
      const relevantBarcodes = [...new Set((storeData || []).map(r => r.barcode_no))].filter(Boolean);

      let whData = [];
      let dcData = [];
      if (relevantBarcodes.length > 0) {
        const chunkSize = 200;
        for (let i = 0; i < relevantBarcodes.length; i += chunkSize) {
          const chunk = relevantBarcodes.slice(i, i + chunkSize);

          // location_inventory → warehouseQty (ຫຼັງສາງ)
          const { data: whChunk, error: whErr } = await supabase
            .from('location_inventory')
            .select('barcode_no, qty')
            .eq('branch_id', selectedBranch)
            .in('barcode_no', chunk);
          if (!whErr && whChunk) whData = [...whData, ...whChunk];

          // table_dc_stock → dcQty (QTY DC Warehouse)
          const { data: dcChunk, error: dcErr } = await supabase
            .from('table_dc_stock')
            .select('barcode, qty')
            .eq('branch_id', selectedBranch)
            .in('barcode', chunk);
          if (!dcErr && dcChunk) dcData = [...dcData, ...dcChunk];
        }
      }

      // Build warehouseMap (location_inventory)
      const warehouseMap = {};
      whData.forEach(row => {
        const bc = String(row.barcode_no || '').trim();
        if (bc) warehouseMap[bc] = (warehouseMap[bc] || 0) + Number(row.qty || 0);
      });

      // Build dcMap (table_dc_stock)
      const dcMap = {};
      dcData.forEach(row => {
        const bc = String(row.barcode || '').trim();
        if (bc) dcMap[bc] = (dcMap[bc] || 0) + Number(row.qty || 0);
      });

      setResults((storeData || []).map((row, idx) => mapRow(row, idx, warehouseMap, dcMap)));
    } catch (err) {
      console.error('[StoreInventory.DEBUG] ❌ Critical Error in fetchData:', err);
      toast.error('ດຶງຂໍ້ມູນຜິດພາດ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Realtime: subscribe to ALL tables that feed QTY data ───────────────
  useEffect(() => {
    // Debounce: batch rapid changes into one re-fetch
    let debounceTimer = null;
    const triggerRefresh = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchData();
      }, 3000); // Increased debounce to 3s to reduce network load from 60 concurrent users
    };

    const channel = supabase
      .channel(`store_rt_all_${selectedBranch}`)
      // 1. Store QTY (ໜ້າຮ້ານ) – store_qty, sales_qty
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_inventory' }, (payload) => {
        const rowBranch = payload.new?.branch_id || payload.old?.branch_id;
        if (rowBranch !== selectedBranch) return;

        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          setResults(prev => {
            const existingIdx = prev.findIndex(r => r.id === payload.new.id);
            if (existingIdx >= 0) {
              // Update existing row locally
              const oldRow = prev[existingIdx];
              const updatedRow = {
                ...oldRow,
                qty: payload.new.store_qty ?? 0,
                rackLocation: payload.new.shelf_location || '—',
                masterQty: payload.new.store_qty ?? 0,
                salesQty: payload.new.sales_qty ?? null,
                category1: payload.new.category_1_actual || oldRow.category1,
                category2: payload.new.category_2_actual || oldRow.category2,
                maxQty: payload.new.max_qty || null,
                productTag: payload.new.product_tag || null,
                status: (payload.new.store_qty ?? 0) > 0 ? 'passed' : 'missing'
              };
              const newArr = [...prev];
              newArr[existingIdx] = updatedRow;
              return newArr;
            } else if (payload.eventType === 'INSERT') {
              // New row added by someone else
              const newRow = {
                id: payload.new.id,
                rowIndex: prev.length + 1,
                barcode: payload.new.barcode_no,
                itemName: payload.new.item_name || '',
                masterItemName: payload.new.item_name || '',
                rackLocation: payload.new.shelf_location || '—',
                qty: payload.new.store_qty ?? 0,
                maxQty: payload.new.max_qty || null,
                productTag: payload.new.product_tag || null,
                masterQty: payload.new.store_qty ?? 0,
                warehouseQty: 0,
                dcQty: 0,
                salesQty: payload.new.sales_qty ?? null,
                category1: payload.new.category_1_actual || '',
                category2: payload.new.category_2_actual || '',
                status: (payload.new.store_qty ?? 0) > 0 ? 'passed' : 'missing',
                branch_id: payload.new.branch_id,
              };
              return [newRow, ...prev];
            }
            return prev;
          });
        } else if (payload.eventType === 'DELETE') {
          setResults(prev => prev.filter(r => r.id !== payload.old.id));
        }
      })
      // 2. Warehouse QTY (ຫຼັງສາງ) – from location_inventory
      .on('postgres_changes', { event: '*', schema: 'public', table: 'location_inventory' }, (payload) => {
        const rowBranch = payload.new?.branch_id || payload.old?.branch_id;
        if (rowBranch && rowBranch !== selectedBranch) return;
        triggerRefresh();
      })
      // 3. DC Stock QTY – from table_dc_stock
      .on('postgres_changes', { event: '*', schema: 'public', table: 'table_dc_stock' }, (payload) => {
        const rowBranch = payload.new?.branch_id || payload.old?.branch_id;
        if (rowBranch && rowBranch !== selectedBranch) return;
        triggerRefresh();
      })
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [selectedBranch, fetchData]);

  // Update qty in local state (DB update handled by StoreResultTable)
  const handleUpdateRowQty = (rowIndex, updates) => {
    setResults(prev => prev.map(r =>
      r.rowIndex === rowIndex ? { ...r, ...updates, status: updates.qty > 0 ? 'passed' : 'missing' } : r
    ));
  };

  const handleAddNewProduct = async (formData) => {
    try {
      const searchBarcode = String(formData.barcode_no).trim();

      // Additional check to warehouse data
      const { data: debugWh, error: debugWhErr } = await supabase
        .from('location_inventory')
        .select('*')
        .eq('branch_id', selectedBranch);

      const payload = {
        barcode_no: formData.barcode_no,
        item_name: formData.item_name || 'New Item',
        store_qty: formData.qty || 0,
        shelf_location: formData.rack_location || '-',
        category_1_actual: formData.category_1_actual || '',
        category_2_actual: formData.category_2_actual || '',
        max_qty: formData.max_qty ? Number(formData.max_qty) : null,
        product_tag: formData.product_tag || null,
        branch_id: selectedBranch,
        updated_by: currentUser?.id ? `${currentUser.name} (${currentUser.id})` : (currentUser?.name || 'Staff'),
        last_updated: new Date().toISOString()
      };

      const { error } = await supabase.from('store_inventory').insert(payload);

      if (error) {
        console.error('[StoreInventory.DEBUG] ❌ Supabase INSERT Error:', error);
        throw error;
      }

      // Log to history
      await logStoreInventoryHistory({
        actionType: 'added',
        barcode: payload.barcode_no,
        itemName: payload.item_name,
        oldQty: 0,
        newQty: payload.store_qty,
        oldLocation: null,
        newLocation: payload.shelf_location,
        oldTag: null,
        newTag: payload.product_tag,
        oldMaxQty: null,
        newMaxQty: payload.max_qty,
        reason: formData.remarks || formData.reason || 'New Item Add',
        branchId: selectedBranch,
        updatedBy: payload.updated_by
      });

      // ── 🆕 Deduct DC stock if reason is "New Stock In" OR "First-time product data recording" ──
      const remarkStr = formData.remarks || formData.reason || '';
      const isNewStock = remarkStr.includes('New Stock In') || remarkStr.includes('ສິນຄ້າເຂົ້າໃໝ່') || remarkStr.includes('First-time product data recording') || remarkStr.includes('ການບັນທຶກຂໍ້ມູນສິນຄ້າໜ້າຮ້ານຄັ້ງທຳອິດ');
      if (isNewStock && Number(formData.qty) > 0) {
        try {
          const deductAmt = Number(formData.qty);
          const { data: dcRow, error: dcFetchErr } = await supabase
            .from('table_dc_stock')
            .select('qty')
            .eq('barcode', formData.barcode_no)
            .eq('branch_id', selectedBranch)
            .maybeSingle();

          console.log('[DC Deduct] dcRow:', dcRow, '| deductAmt:', deductAmt, '| branch:', selectedBranch, '| barcode:', formData.barcode_no, '| fetchErr:', dcFetchErr);

          if (dcRow) {
            const newDcQty = Math.max(0, (dcRow.qty || 0) - deductAmt);
            const { error: dcUpdateErr } = await supabase
              .from('table_dc_stock')
              .update({ qty: newDcQty, updated_at: new Date().toISOString() })
              .eq('barcode', formData.barcode_no)
              .eq('branch_id', selectedBranch);
            if (dcUpdateErr) {
              console.error('[DC Deduct] Update error:', dcUpdateErr);
            } else {
              console.log(`[DC Deduct] ✅ DC qty updated: ${dcRow.qty} → ${newDcQty}`);
            }
          } else {
            console.warn('[DC Deduct] ⚠️ No DC record found for', formData.barcode_no, 'branch:', selectedBranch);
          }
        } catch (dcErr) {
          console.error('[DC Deduct] Exception:', dcErr);
        }
      }
      // ────────────────────────────────────────────────────────────────────

      console.log('[StoreInventory.DEBUG] ✅ Success! UI will update via Realtime...');
      toast.success('ເພີ່ມສິນຄ້າໃໝ່ສຳເລັດ!');
    } catch (err) {
      console.error('[StoreInventory.DEBUG] ❌ Exception in handleAddNewProduct:', err);
      toast.error('ເພີ່ມສິນຄ້າໃໝ່ຜິດພາດ: ' + err.message);
      throw err;
    }
  };


  // Compute stats for StoreDashboard
  const stats = {
    total: results.length,
    passed: results.filter(r => r.status === 'passed').length,
    mismatch: results.filter(r => r.status === 'mismatch').length,
    incomplete: results.filter(r => r.status === 'incomplete').length,
    missing: results.filter(r => r.status === 'missing').length,
    zeroQty: results.filter(r => (r.qty ?? 0) === 0).length,
    hasQty: results.filter(r => (r.qty ?? 0) > 0).length,
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
          <p className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase tracking-widest">Store Inventory · {selectedBranch}</p>
        </div>


      </div>

      {/* Dashboard Stats */}
      <StoreDashboard
        stats={stats}
        activeFilter={filterStatus}
        onFilterChange={setFilterStatus}
        hideZeroQty={hideZeroQty}
        onHideZeroQtyChange={setHideZeroQty}
      />

      {/* Real Table — same StoreResultTable, now with real data */}
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
        currentUser={currentUser || { name: 'Staff', branch_id: selectedBranch, role: isAdmin ? 'HQ' : 'Store' }}
        currentBranch={selectedBranch}
        onAddNewProduct={handleAddNewProduct}
      />
    </div>
  );
};

export default StoreInventoryMockup;
