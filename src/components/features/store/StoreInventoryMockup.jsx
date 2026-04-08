import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Database, Filter } from 'lucide-react';
import StoreDashboard from './StoreDashboard';
import StoreResultTable from './StoreResultTable';
import { supabase } from '../../../utils/supabaseClient';
import { useToast } from '../../ui/ToastProvider';
import { getStoreRackSuggestions, validateStoreRack } from '../../../utils/storeRackUtils';

const BRANCHES = ['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ'];

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
  const mapRow = (row, idx, warehouseMap = {}) => {
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
      masterQty: qty,
      warehouseQty: warehouseMap[String(row.barcode_no).trim()] ?? 0, 
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
      // 1. Fetch store_inventory (ໜ້າຮ້ານ)
      const { data: storeData, error: storeErr } = await supabase
        .from('store_inventory')
        .select('*')
        .eq('branch_id', selectedBranch)
        .order('item_name', { ascending: true });
      if (storeErr) throw storeErr;

      // 2. OPTIMIZATION: Fetch ONLY relevant barcodes from location_inventory
      const relevantBarcodes = [...new Set((storeData || []).map(r => r.barcode_no))].filter(Boolean);
      
      let whData = [];
      if (relevantBarcodes.length > 0) {
          // Chunk barcodes if there are too many (Supabase URL limit)
          const chunkSize = 200; 
          for (let i = 0; i < relevantBarcodes.length; i += chunkSize) {
              const chunk = relevantBarcodes.slice(i, i + chunkSize);
              const { data: chunkData, error: whErr } = await supabase
                .from('location_inventory')
                .select('barcode_no, qty, branch_id, rack_location')
                .eq('branch_id', selectedBranch)
                .in('barcode_no', chunk);
              
              if (!whErr && chunkData) {
                  whData = [...whData, ...chunkData];
              }
          }
      }

      console.group(`[StoreInventory.OPTIMIZED] ⚡ Warehouse Sync`);
      console.log('Store items:', storeData.length);
      console.log('Warehouse rows fetched (relevant items only):', whData.length);
      
      // Build barcode → sum of qty map
      const warehouseMap = {};
      whData.forEach(row => {
        const bc = String(row.barcode_no || '').trim();
        if (bc) {
            warehouseMap[bc] = (warehouseMap[bc] || 0) + Number(row.qty || 0);
        }
      });
      console.groupEnd();

      setResults((storeData || []).map((row, idx) => mapRow(row, idx, warehouseMap)));
    } catch (err) {
      console.error('[StoreInventory.DEBUG] ❌ Critical Error in fetchData:', err);
      toast.error('ດຶງຂໍ້ມູນຜິດພາດ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranch]);


  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`store_inventory_rt_${selectedBranch}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'store_inventory' }, (payload) => {
        const rowBranch = payload.new?.branch_id || payload.old?.branch_id;
        if (rowBranch !== selectedBranch) return;
        fetchData();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedBranch, fetchData]);

  // Update qty in store_inventory
  const handleUpdateRowQty = async (rowIndex, updates) => {
    const row = results.find(r => r.rowIndex === rowIndex);
    if (!row?.id) return;
    try {
      const { error } = await supabase
        .from('store_inventory')
        .update({
          store_qty: updates.qty,
          shelf_location: updates.rackLocation || row.rackLocation,
          updated_by: currentUser?.name || 'Staff',
          last_updated: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (error) throw error;
      setResults(prev => prev.map(r =>
        r.rowIndex === rowIndex ? { ...r, ...updates, status: updates.qty > 0 ? 'passed' : 'missing' } : r
      ));
    } catch (err) {
      toast.error('ອັບເດດຜິດພາດ: ' + err.message);
    }
  };

  const handleAddNewProduct = async (formData) => {
    try {
      const searchBarcode = String(formData.barcode_no).trim();
      console.group(`[StoreInventory.DEBUG] 💾 Saving New Product: "${searchBarcode}"`);
      
      // Additional check to warehouse data
      console.log('Searching for warehouse QTY in location_inventory...');
      const { data: debugWh, error: debugWhErr } = await supabase
        .from('location_inventory')
        .select('*')
        .eq('branch_id', selectedBranch);

      if (!debugWhErr && debugWh) {
          const match = debugWh.filter(r => String(r.barcode_no || '').trim() === searchBarcode);
          if (match.length > 0) {
              const totalWh = match.reduce((sum, r) => sum + Number(r.qty || 0), 0);
              console.log(`✅ MATCH FOUND in location_inventory! Total Qty: ${totalWh}`);
              console.log('Match details (rows):', match);
          } else {
              console.warn(`❌ NO MATCH found for barcode "${searchBarcode}" in branch "${selectedBranch}" of location_inventory table.`);
              const partialMatch = debugWh.filter(r => String(r.barcode_no || '').includes(searchBarcode));
              if (partialMatch.length > 0) {
                  console.log('💡 Found items with SIMILAR barcode (partial match):', partialMatch);
              }
          }
      } else if (debugWhErr) {
          console.error('❌ Error querying location_inventory for debug:', debugWhErr);
      }

      const payload = {
        barcode_no: formData.barcode_no,
        item_name: formData.item_name || 'New Item',
        store_qty: formData.qty || 0,
        shelf_location: formData.rack_location || '-',
        category_1_actual: formData.category_1_actual || '',
        category_2_actual: formData.category_2_actual || '',
        branch_id: selectedBranch,
        updated_by: currentUser?.name || 'Staff',
        last_updated: new Date().toISOString()
      };

      console.log('Final Payload for store_inventory:', payload);
      console.groupEnd(); // End of Saving New Product debug group

      const { error } = await supabase.from('store_inventory').insert(payload);

      if (error) {
          console.error('[StoreInventory.DEBUG] ❌ Supabase INSERT Error:', error);
          throw error;
      }

      console.log('[StoreInventory.DEBUG] ✅ Success! Refreshing data...');
      await fetchData();
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
    <div className="w-full h-full space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2 truncate">
            <Database className="text-emerald-500" size={20} />
            ຂໍ້ມູນຊັ້ນວ່າງເຄື່ອງໜ້າຮ້ານ
          </h2>
          <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Store Inventory · {selectedBranch}</p>
        </div>

        {/* Branch Selector (Admin only) */}
        {isAdmin && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl px-3 py-2">
            <Filter size={13} className="text-emerald-500 shrink-0" />
            <select
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-transparent text-sm font-black text-slate-800 dark:text-white outline-none cursor-pointer"
            >
              {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
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
