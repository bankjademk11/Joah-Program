import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import * as XLSX from "xlsx";
import { supabase } from "../../utils/supabaseClient";
import {
  X, Upload, BarChart3, ChevronRight, ChevronDown, FileSpreadsheet,
  Search, ArrowUpDown, Download, RotateCw, ArrowLeft,
  CheckCircle2, FileText, LayoutDashboard, Database, TrendingUp, Info,
  UploadCloud, Loader2, History, User
} from "lucide-react";


const PAGE_SIZE = 50;

export default function SalesAggregator({ onBack }) {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [barcodeCol, setBarcodeCol] = useState("");
  const [qtyCol, setQtyCol] = useState("");
  const [aggData, setAggData] = useState([]);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("count");
  const [sortDir, setSortDir] = useState(-1);
  const [page, setPage] = useState(0);
  const [step, setStep] = useState("upload"); // upload | config | result
  const [isReading, setIsReading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);

  // --- Import to Store Inventory ---
  const [showImportModal, setShowImportModal] = useState(false);
  const [importBranch, setImportBranch] = useState('ໂພນສີນວນ');
  const [importMode, setImportMode] = useState('deduct'); // deduct | history_only
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // --- History ---
  const [historyData, setHistoryData] = useState([]);
  const [isFetchingHistory, setIsFetchingHistory] = useState(false);
  
  const [selectedHistory, setSelectedHistory] = useState(null);
  const [historyDetailsData, setHistoryDetailsData] = useState([]);
  const [isFetchingDetails, setIsFetchingDetails] = useState(false);

  // --- History Filters ---
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');

  // --- Logic ---
  const parseFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    setIsReading(true); // Start loading

    const reader = new FileReader();
    reader.onload = (e) => {
      // Use setTimeout to allow UI to render the loading state first
      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const parsed = XLSX.utils.sheet_to_json(ws, { defval: "" });

          if (!parsed.length) {
            alert("ໄຟລ໌ນີ້ບໍ່ມີຂໍ້ມູນ");
            setIsReading(false);
            return;
          }

          const cols = Object.keys(parsed[0]);
          setRows(parsed);
          setHeaders(cols);
          const bIdx = cols.findIndex((c) => c.toLowerCase().includes("barcode"));
          const qIdx = cols.findIndex(
            (c) => c.toLowerCase().includes("quantity") || c.toLowerCase().includes("qty")
          );
          setBarcodeCol(cols[bIdx >= 0 ? bIdx : 0]);
          setQtyCol(cols[qIdx >= 0 ? qIdx : 0]);
          setStep("config");
        } catch (error) {
          console.error("Error parsing file:", error);
          alert("ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌");
        } finally {
          setIsReading(false); // Stop loading
        }
      }, 150);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragging(false);
      parseFile(e.dataTransfer.files[0]);
    },
    [parseFile]
  );

  const runAgg = useCallback(() => {
    setIsReading(true); // Start loading for aggregation
    setTimeout(() => {
      const map = {};
      for (const row of rows) {
        const key = String(row[barcodeCol]).trim();
        if (!key) continue;
        const q = parseFloat(row[qtyCol]) || 0;
        if (!map[key]) map[key] = { barcode: key, count: 0, qty: 0 };
        map[key].count++;
        map[key].qty += q;
      }
      setAggData(Object.values(map));
      setPage(0);
      setStep("result");
      setIsReading(false);
    }, 100);
  }, [rows, barcodeCol, qtyCol]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return aggData
      .filter((r) => !q || r.barcode.toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortKey === "barcode") return sortDir * a.barcode.localeCompare(b.barcode);
        return sortDir * (a[sortKey] - b[sortKey]);
      });
  }, [aggData, search, sortKey, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d * -1);
    else { setSortKey(key); setSortDir(-1); }
    setPage(0);
  };

  const totalQty = useMemo(() => aggData.reduce((s, r) => s + r.qty, 0), [aggData]);

  const downloadCSV = () => {
    const csvRows = [
      ["Barcode", "ຈຳນວນຄັ້ງ", "Qty ລວມ"],
      ...filtered.map((r) => [r.barcode, r.count, Math.round(r.qty)]),
    ];
    // BOM for Excel Lao language support
    const csvContent = "\uFEFF" + csvRows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importBranch || aggData.length === 0) return;
    setIsImporting(true);
    setImportResult(null);

    try {
      const importedBy = localStorage.getItem('joah_employee_name') || 'unknown';
      
      // Prepare JSON payload
      const formattedData = aggData.map(item => ({
        barcode: item.barcode,
        qty: Math.round(item.qty)
      }));

      if (importMode === 'deduct') {
        // ===== GM FORMULA: F2 = Q1 - S1 - T1 - D1 =====
        // F = ໜ້າຮ້ານ (Shop Front)  Q = ລວມທັງໝົດ (Total)
        // S = ຍອດຂາຍ (Sales)        T = ຫຼັງສາງ (Backstore)  D = DC Warehouse

        // Step 1: Fetch all store_inventory records for this branch
        console.log('🚀 [SalesAggregator] Step 1: Fetching store_inventory records for branch:', importBranch);
        let existingData = [];
        let rangeStart = 0;
        const RANGE_SIZE = 1000;
        let isFetching = true;
        while (isFetching) {
          const { data: chunk, error } = await supabase
            .from('store_inventory')
            .select('id, barcode_no, store_qty, q_qty, sales_qty')
            .eq('branch_id', importBranch)
            .range(rangeStart, rangeStart + RANGE_SIZE - 1);
          if (error) throw error;
          if (chunk && chunk.length > 0) {
            existingData = existingData.concat(chunk);
            rangeStart += RANGE_SIZE;
            if (chunk.length < RANGE_SIZE) isFetching = false;
          } else {
            isFetching = false;
          }
        }

        // Build barcode → store_inventory map
        const storeMap = {};
        existingData.forEach(item => { storeMap[item.barcode_no] = item; });

        // Get relevant barcodes (only ones that exist in our inventory)
        const barcodes = formattedData.map(d => d.barcode).filter(b => storeMap[b]);

        // Step 2: Bulk fetch T (location_inventory = ຫຼັງສາງ/Backstore)
        console.log(`🚀 [SalesAggregator] Step 2: Fetching location_inventory for ${barcodes.length} barcodes...`);
        let whData = [];
        const CHUNK = 200;
        for (let i = 0; i < barcodes.length; i += CHUNK) {
          const chunk = barcodes.slice(i, i + CHUNK);
          const { data: whChunk } = await supabase
            .from('location_inventory')
            .select('barcode_no, qty')
            .eq('branch_id', importBranch)
            .in('barcode_no', chunk);
          if (whChunk) whData = whData.concat(whChunk);
        }
        const tMap = {};
        whData.forEach(r => {
          const bc = String(r.barcode_no || '').trim();
          if (bc) tMap[bc] = (tMap[bc] || 0) + Number(r.qty || 0);
        });

        // Step 3: Bulk fetch D (table_dc_stock = DC Warehouse)
        console.log(`🚀 [SalesAggregator] Step 3: Fetching table_dc_stock for ${barcodes.length} barcodes...`);
        let dcData = [];
        for (let i = 0; i < barcodes.length; i += CHUNK) {
          const chunk = barcodes.slice(i, i + CHUNK);
          const { data: dcChunk } = await supabase
            .from('table_dc_stock')
            .select('barcode, qty')
            .eq('branch_id', importBranch)
            .in('barcode', chunk);
          if (dcChunk) dcData = dcData.concat(dcChunk);
        }
        const dMap = {};
        dcData.forEach(r => {
          const bc = String(r.barcode || '').trim();
          if (bc) dMap[bc] = (dMap[bc] || 0) + Number(r.qty || 0);
        });

        // Step 4: Apply GM Formula for each imported item
        console.log('🚀 [SalesAggregator] Step 4: Applying GM Formula...');
        let updatedCount = 0;
        let notFoundCount = 0;
        const updateList = [];
        const timestamp = new Date().toISOString();
        const logPayload = [];

        for (const item of formattedData) {
          const existing = storeMap[item.barcode];
          if (existing) {
            const T1 = tMap[item.barcode] || 0;  // ຫຼັງສາງ current
            const D1 = dMap[item.barcode] || 0;  // DC current
            const S1 = item.qty;                  // ຍອດຂາຍ from import

            // Calculate Q1 dynamically to ensure it includes all components before GM Formula
            const Q1 = Number(existing.store_qty || 0) + T1 + D1;

            // ===== GM FORMULA: F2 = Q1 - S1 - T1 - D1 =====
            const F2 = Math.max(0, Q1 - S1 - T1 - D1);
            
            // Q2 = Q1 - S1 (total reduces by sales amount)
            const Q2 = Math.max(0, Q1 - S1);

            updateList.push({
              id: existing.id,
              store_qty: F2,
              q_qty: Q2,
              sales_qty: (existing.sales_qty || 0) + S1
            });
            logPayload.push({
              barcode_no: item.barcode,
              sales_qty: S1,
              import_date: timestamp,
              branch_id: importBranch,
              imported_by: importedBy
            });
            updatedCount++;
          } else {
            notFoundCount++;
          }
        }

        // Step 5: Batch update store_inventory (store_qty + q_qty + sales_qty)
        console.log(`🚀 [SalesAggregator] Step 5: Updating store_inventory (${updateList.length} items)...`);
        const UPDATE_CHUNK = 50;
        for (let i = 0; i < updateList.length; i += UPDATE_CHUNK) {
          const chunk = updateList.slice(i, i + UPDATE_CHUNK);
          await Promise.all(
            chunk.map(({ id, store_qty, q_qty, sales_qty }) =>
              supabase
                .from('store_inventory')
                .update({ store_qty, q_qty, sales_qty, last_updated: timestamp })
                .eq('id', id)
            )
          );
        }

        // Step 6: Log to store_sales_log for history tracking
        console.log(`🚀 [SalesAggregator] Step 6: Logging to store_sales_log (${logPayload.length} items)...`);
        for (let i = 0; i < logPayload.length; i += UPDATE_CHUNK) {
          const chunk = logPayload.slice(i, i + UPDATE_CHUNK);
          const { error } = await supabase.from('store_sales_log').insert(chunk);
          if (error) throw error;
        }

        setImportResult({ 
          updated: updatedCount, 
          notFound: notFoundCount, 
          errors: 0,
          mode: 'deduct'
        });
      } else {
        // Mode: History Only — Update sales_qty ONLY, do NOT touch store_qty or q_qty
        
        // Step 1: Fetch all existing store_inventory records for this branch
        console.log('🚀 [SalesAggregator/HistoryOnly] Step 1: Fetching store_inventory records...');
        let existingData = [];
        let isFetching = true;
        let rangeStart = 0;
        const RANGE_SIZE = 1000;
        while (isFetching) {
          const { data: chunk, error } = await supabase
            .from('store_inventory')
            .select('id, barcode_no, sales_qty')
            .eq('branch_id', importBranch)
            .range(rangeStart, rangeStart + RANGE_SIZE - 1);
          if (error) throw error;
          if (chunk && chunk.length > 0) {
            existingData = existingData.concat(chunk);
            rangeStart += RANGE_SIZE;
            if (chunk.length < RANGE_SIZE) isFetching = false;
          } else {
            isFetching = false;
          }
        }

        // Step 2: Build a map barcode -> {id, sales_qty}
        const existingMap = {};
        existingData.forEach(item => {
          existingMap[item.barcode_no] = item;
        });

        // Step 3: Build update list — add to sales_qty only, do NOT change store_qty/q_qty
        let updatedCount = 0;
        let notFoundCount = 0;
        const updateList = [];
        for (const item of formattedData) {
          const existing = existingMap[item.barcode];
          if (existing) {
            updateList.push({
              id: existing.id,
              sales_qty: (existing.sales_qty || 0) + item.qty
            });
            updatedCount++;
          } else {
            notFoundCount++;
          }
        }

        // Step 4: Update sales_qty in parallel chunks
        console.log(`🚀 [SalesAggregator/HistoryOnly] Step 4: Updating sales_qty (${updateList.length} items)...`);
        const CHUNK = 50;
        for (let i = 0; i < updateList.length; i += CHUNK) {
          const chunk = updateList.slice(i, i + CHUNK);
          await Promise.all(
            chunk.map(({ id, sales_qty }) =>
              supabase
                .from('store_inventory')
                .update({ sales_qty })
                .eq('id', id)
            )
          );
        }

        // Step 5: Log to store_sales_log for history tracking
        console.log('🚀 [SalesAggregator/HistoryOnly] Step 5: Logging to store_sales_log...');
        const timestamp = new Date().toISOString();
        const logPayload = formattedData.map(item => ({
          barcode_no: item.barcode,
          sales_qty: item.qty,
          import_date: timestamp,
          branch_id: importBranch,
          imported_by: importedBy
        }));
        for (let i = 0; i < logPayload.length; i += CHUNK) {
          const chunk = logPayload.slice(i, i + CHUNK);
          const { error } = await supabase.from('store_sales_log').insert(chunk);
          if (error) throw error;
        }

        setImportResult({ 
          updated: updatedCount, 
          notFound: notFoundCount, 
          errors: 0,
          mode: 'history_only'
        });
      }

      // ── 🆕 FIRE SIGNAL TO REFRESH ALL CLIENTS ──
      try {
        console.log('🔥 [SYNC] Attempting to fire massive_import_done signal...');
        const { data: sigData, error: sigErr } = await supabase.from('app_sync_signals')
          .upsert({ signal_name: 'massive_import_done', updated_at: new Date().toISOString() })
          .select();
        console.log('🔥 [SYNC] Signal Upsert Response:', { sigData, sigErr });
      } catch(signalErr) {
        console.error("🔥 [SYNC] Failed to fire sync signal", signalErr);
      }

    } catch (err) {
      console.error('🔥 [SalesAggregator] Import error:', err);
      alert(`การนำเข้าล้มเหลว: ${err.message}`);
      setImportResult({ updated: 0, notFound: 0, errors: aggData.length, mode: importMode });
    } finally {
      setIsImporting(false);
    }
  };

  const fetchHistory = async () => {
    setIsFetchingHistory(true);
    setSelectedHistory(null);
    setStep("history");
    try {
      const { data, error } = await supabase
        .from('vw_sales_import_history')
        .select('*')
        .order('import_date', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setHistoryData(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
      alert('ບໍ່ສາມາດດึงຂໍ້ມູນປະຫວັດໄດ້');
    } finally {
      setIsFetchingHistory(false);
    }
  };

  const fetchHistoryDetails = async (record) => {
    setSelectedHistory(record);
    setIsFetchingDetails(true);
    try {
      const { data, error } = await supabase
        .from('store_sales_log')
        .select('barcode_no, sales_qty')
        .eq('import_date', record.import_date)
        .eq('branch_id', record.branch_id)
        .order('sales_qty', { ascending: false });
        
      if (error) throw error;
      setHistoryDetailsData(data || []);
    } catch (err) {
      console.error('Error fetching history details:', err);
      alert('ບໍ່ສາມາດດึงຂໍ້ມູນລາຍລະອຽດໄດ້');
      setSelectedHistory(null);
    } finally {
      setIsFetchingDetails(false);
    }
  };

  const exportHistoryCSV = () => {
    if (historyData.length === 0) return;
    const csvRows = [
      ['Date/Time', 'Branch', 'Total SKUs', 'Total Sales Qty', 'Imported By'],
      ...historyData.map(r => [
        new Date(r.import_date).toLocaleString('lo-LA'),
        r.branch_id,
        r.total_skus,
        r.total_sales_qty,
        r.imported_by || 'Unknown'
      ])
    ];
    const content = '\uFEFF' + csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportDetailsCSV = () => {
    if (!selectedHistory || historyDetailsData.length === 0) return;
    const csvRows = [
      ['Barcode', 'Sales Qty'],
      ...historyDetailsData.map(r => [r.barcode_no, r.sales_qty])
    ];
    const content = '\uFEFF' + csvRows.map(r => r.join(',')).join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeDate = new Date(selectedHistory.import_date).toISOString().split('T')[0];
    a.download = `sales_detail_${selectedHistory.branch_id}_${safeDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const content = (
    <div className="fixed inset-0 z-[300] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* --- Header --- */}
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 shadow-sm relative z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all group"
          >
            <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <TrendingUp size={18} />
              </div>
              <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Sales Aggregator</h1>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ລວມຍອດຂາຍສິນຄ້າຈາກ Odoo</p>
          </div>
        </div>

        {/* Steps Indicator */}
        <div className="hidden md:flex items-center gap-3">
          {[
            { id: 'upload', label: 'ອັບໂຫລດ', icon: Upload },
            { id: 'config', label: 'ຕັ້ງຄ່າ', icon: Database },
            { id: 'result', label: 'ຜົນລາຍງານ', icon: BarChart3 }
          ].map((s, idx) => (
            <div key={s.id} className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${step === s.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20 scale-105'
                  : (step === 'result' || (step === 'config' && s.id === 'upload'))
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
                }`}>
                <s.icon size={14} />
                <span className="text-xs font-black">{s.label}</span>
              </div>
              {idx < 2 && <ChevronRight size={14} className="text-slate-300" />}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => step === 'history' ? setStep('upload') : fetchHistory()}
            className="h-10 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex items-center gap-2 font-black text-xs"
          >
            <History size={16} />
            <span className="hidden sm:inline">{step === 'history' ? 'ກັບຄືນ' : 'ປະຫວັດ'}</span>
          </button>
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-all"
          >
            <X size={24} />
          </button>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10 relative">
        {/* Loading Overlay */}
        {isReading && (
          <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-800 p-10 rounded-[2.5rem] shadow-2xl border border-blue-500/20 flex flex-col items-center gap-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-blue-100 dark:border-blue-900/30 border-t-blue-600 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Database size={24} className="text-blue-600 animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-800 dark:text-white mb-1">ກຳລັງປະມວນຜົນຂໍ້ມູນ</h3>
                <p className="text-sm font-bold text-slate-400">ກະລຸນາລໍຖ້າຈັກຄູ່, ງານນີ້ໃຊ້ພະລັງງານສູງ...</p>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto w-full">

          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="max-w-2xl mx-auto pt-10 animate-in slide-in-from-bottom-5 duration-500">
              <div className="text-center mb-10">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white mb-3">ເລີ່ມຕົ້ນສະຫຼຸບຍອດຂາຍ</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">ວາງໄຟລ໌ Excel ທີ່ Export ມາຈາກ Odoo ເພື່ອລວມຍອດຕາມ Barcode</p>
              </div>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => document.getElementById("file-input").click()}
                className={`group relative rounded-[2.5rem] border-4 border-dashed p-20 text-center transition-all duration-500 h-[400px] flex flex-col items-center justify-center
                    ${dragging
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/10 scale-95"
                    : "border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-white dark:hover:bg-slate-900/50 cursor-pointer shadow-xl shadow-transparent hover:shadow-blue-500/10"
                  }`}
              >
                <div className={`w-24 h-24 rounded-3xl mb-8 flex items-center justify-center transition-all duration-500 ${dragging ? 'bg-blue-600 text-white scale-110' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 group-hover:scale-110'
                  }`}>
                  <Upload size={48} strokeWidth={2.5} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-2 underline underline-offset-8 decoration-blue-200 dark:decoration-blue-800 group-hover:decoration-blue-500 transition-all">
                  ຄລິກ ຫຼື ວາງໄຟລ໌ລົງທີ່ນີ້
                </h3>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">ຮອງຮັບ .XLSX, .XLS, .CSV</p>

                <input
                  id="file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => parseFile(e.target.files[0])}
                />
              </div>
            </div>
          )}

          {/* STEP 2: CONFIGURATION */}
          {step === "config" && (
            <div className="max-w-xl mx-auto pt-10 animate-in zoom-in-95 duration-300">
              <div className="glass-card rounded-[2.5rem] border-blue-500/30 p-10 shadow-2xl overflow-hidden relative">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />

                <div className="flex items-center gap-4 mb-10">
                  <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
                    <FileSpreadsheet size={28} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-emerald-600">File Detected</p>
                    <h3 className="text-lg font-black text-slate-800 dark:text-white truncate">{fileName}</h3>
                    <p className="text-xs font-bold text-slate-500">ພົບຂໍ້ມູນທັງໝົດ: {rows.length.toLocaleString()} ແຖວ</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-[10px]">1</span>
                      ເລືອກຄໍລຳ Barcode
                    </label>
                    <div className="relative">
                      <select
                        value={barcodeCol}
                        onChange={(e) => setBarcodeCol(e.target.value)}
                        className="w-full h-14 pl-5 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white font-black text-sm outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-[10px]">2</span>
                      ເລືອກຄໍລຳ Quantity (ຈຳນວນ)
                    </label>
                    <div className="relative">
                      <select
                        value={qtyCol}
                        onChange={(e) => setQtyCol(e.target.value)}
                        className="w-full h-14 pl-5 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white font-black text-sm outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                      <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>
                  </div>

                  <div className="pt-6">
                    <button
                      onClick={runAgg}
                      className="w-full h-16 rounded-[1.5rem] bg-blue-600 hover:bg-blue-700 text-white font-black text-lg shadow-xl shadow-blue-500/30 hover:-translate-y-1 transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      <span>ປະມວນຜົນລວມຍອດ</span>
                      <ArrowLeft className="rotate-180" size={22} />
                    </button>
                    <button
                      onClick={() => setStep('upload')}
                      className="w-full mt-4 h-12 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-bold transition-colors text-sm"
                    >
                      ຍົກເລີກ ແລະ ເລືອກໄຟລ໌ໃໝ່
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: RESULTS */}
          {step === "result" && (
            <div className="space-y-8 animate-in fade-in duration-500">

              {/* Dashboard Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-[2rem] p-8 border-blue-500/20 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-3">Total SKUs</p>
                  <p className="text-5xl font-black text-slate-800 dark:text-white">{aggData.length.toLocaleString()}</p>
                  <p className="text-sm font-bold text-slate-400 mt-2">ລາຍການສິນຄ້າທັງໝົດ</p>
                </div>
                <div className="glass-card rounded-[2rem] p-8 border-emerald-500/20 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3">Aggregated Qty</p>
                  <p className="text-5xl font-black text-slate-800 dark:text-white">{Math.round(totalQty).toLocaleString()}</p>
                  <p className="text-sm font-bold text-slate-400 mt-2">ຈຳນວນສິນຄ້າລວມທັງໝົດ</p>
                </div>
                <div className="glass-card rounded-[2rem] p-8 border-amber-500/20 shadow-xl relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 rounded-full group-hover:scale-150 transition-transform duration-700" />
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3">Odoo Raw Rows</p>
                  <p className="text-5xl font-black text-slate-800 dark:text-white">{rows.length.toLocaleString()}</p>
                  <p className="text-sm font-bold text-slate-400 mt-2">ແຖວຂໍ້ມູນຈາກ Odoo</p>
                </div>
              </div>

              {/* Table Control Bar */}
              <div className="glass-card rounded-[2rem] p-4 flex flex-col lg:flex-row items-center gap-4 border-slate-200 dark:border-slate-800">
                <div className="flex-1 w-full relative">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="ຄົ້ນຫາບາໂຄ້ດ..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    className="w-full h-14 pl-14 pr-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-800 dark:text-white font-black text-sm outline-none focus:border-blue-500 transition-all shadow-inner"
                  />
                </div>
                <div className="flex gap-3 w-full lg:w-auto flex-wrap">
                  <button
                    onClick={downloadCSV}
                    className="flex-1 lg:flex-none h-14 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
                  >
                    <FileSpreadsheet size={18} />
                    <span>ດາວໂຫລດ CSV</span>
                  </button>
                  <button
                    onClick={() => { setShowImportModal(true); setImportResult(null); }}
                    className="flex-1 lg:flex-none h-14 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 whitespace-nowrap active:scale-95"
                  >
                    <UploadCloud size={18} />
                    <span>Import to Store</span>
                  </button>
                  <button
                    onClick={() => { setStep("upload"); setRows([]); setAggData([]); setSearch(""); }}
                    className="h-14 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-500 transition-all flex items-center justify-center gap-2 active:scale-95"
                    title="Reset"
                  >
                    <RotateCw size={18} />
                    <span className="hidden sm:inline font-black text-sm">ຣີເຊັດ</span>
                  </button>
                </div>

              </div>

              {/* Result Table */}
              <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                        {[
                          { key: "barcode", label: "ບາໂຄ້ດ (Barcode)" },
                          { key: "count", label: "ຈຳນວນຄັ້ງ", center: true },
                          { key: "qty", label: "ຈຳນວນລວມ (Qty)", center: true },
                        ].map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={`px-8 py-6 text-xs font-black text-slate-500 uppercase tracking-widest cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors group ${col.center ? 'text-center' : ''}`}
                          >
                            <div className={`flex items-center gap-2 ${col.center ? 'justify-center' : ''}`}>
                              {col.label}
                              <ArrowUpDown size={14} className={`transition-opacity ${sortKey === col.key ? 'opacity-100 text-blue-500' : 'opacity-0 group-hover:opacity-40'}`} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {pageSlice.length > 0 ? pageSlice.map((r, i) => (
                        <tr key={r.barcode} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                <FileText size={16} />
                              </div>
                              <span className="font-mono font-black text-blue-600 dark:text-blue-400">{r.barcode}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 font-black text-sm">
                              {r.count.toLocaleString()} ລາຍການ
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <span className="text-xl font-black text-slate-800 dark:text-white">
                              {Math.round(r.qty).toLocaleString()}
                            </span>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan="3" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4 text-slate-300 dark:text-slate-700">
                              <Search size={64} strokeWidth={1} />
                              <p className="text-xl font-bold">ບໍ່ພົບຂໍ້ມູນທີ່ທ່ານຄົ້ນຫາ</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm font-bold text-slate-400">
                    ສະແດງ {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} ຈາກ {filtered.length.toLocaleString()} ລາຍການ
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="rotate-180" size={20} />
                    </button>
                    <div className="h-12 px-5 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-blue-500/20">
                      {page + 1} / {totalPages}
                    </div>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={page + 1 >= totalPages}
                      className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Step 4: History */}
          {step === "history" && !selectedHistory && (
            <div className="max-w-6xl mx-auto w-full animate-in slide-in-from-bottom-4 duration-500 pb-10">
              <div className="flex flex-col gap-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-inner">
                      <History size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 dark:text-white">ປະຫວັດການນຳເຂົ້າ (History)</h2>
                      <p className="text-sm font-bold text-slate-400 mt-1">ສະຫຼຸບຍອດການ Import ເຂົ້າ Store Inventory</p>
                    </div>
                  </div>
                  <button
                    onClick={exportHistoryCSV}
                    disabled={historyData.length === 0}
                    className="h-11 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-sm transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20"
                  >
                    <Download size={16} />
                    Export Excel
                  </button>
                </div>

                {/* Date Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Search size={16} />
                    <span className="font-black text-xs uppercase tracking-widest">ຄົ້ນຫາ</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-400">ຕັ້ງແຕ່</label>
                    <input
                      type="date"
                      value={historyDateFrom}
                      onChange={e => setHistoryDateFrom(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-400">ຮອດ</label>
                    <input
                      type="date"
                      value={historyDateTo}
                      onChange={e => setHistoryDateTo(e.target.value)}
                      className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <button
                    onClick={fetchHistory}
                    className="h-9 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs transition-all shadow-sm"
                  >
                    ຄົ້ນຫາ
                  </button>
                  {(historyDateFrom || historyDateTo) && (
                    <button
                      onClick={() => { setHistoryDateFrom(''); setHistoryDateTo(''); }}
                      className="h-9 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 font-black text-xs transition-all"
                    >
                      ລ້າງ
                    </button>
                  )}
                  {historyData.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-slate-400">
                      ພົບ {historyData.length.toLocaleString()} ລາຍການ
                    </span>
                  )}
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/80 dark:bg-slate-800/80">
                        <th className="px-8 py-5 font-black text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap">ວັນທີ ແລະ ເວລາ</th>
                        <th className="px-8 py-5 font-black text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap">ສາຂາ</th>
                        <th className="px-8 py-5 font-black text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">SKUs ທັງໝົດ</th>
                        <th className="px-8 py-5 font-black text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap text-center">ຍອດຂາຍລວມ (Qty)</th>
                        <th className="px-8 py-5 font-black text-xs text-slate-400 uppercase tracking-widest whitespace-nowrap">ຜູ້ບັນທຶກ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {isFetchingHistory ? (
                        <tr>
                          <td colSpan="5" className="py-20 text-center">
                            <Loader2 size={32} className="animate-spin text-blue-500 mx-auto" />
                          </td>
                        </tr>
                      ) : historyData.length > 0 ? (
                        historyData.map((r, i) => (
                          <tr 
                            key={i} 
                            onClick={() => fetchHistoryDetails(r)}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group cursor-pointer"
                          >
                            <td className="px-8 py-5">
                              <span className="font-mono font-bold text-slate-600 dark:text-slate-300">
                                {new Date(r.import_date).toLocaleString('lo-LA')}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-black text-sm text-slate-700 dark:text-slate-300">
                                {r.branch_id}
                              </span>
                            </td>
                            <td className="px-8 py-5 text-center">
                              <span className="inline-flex items-center px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                {Number(r.total_skus).toLocaleString()} ລາຍການ
                              </span>
                            </td>
                            <td className="px-8 py-5 text-center">
                              <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                                {Number(r.total_sales_qty).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-2 text-slate-500">
                                <User size={14} />
                                <span className="font-bold text-sm">{r.imported_by || 'Unknown'}</span>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-20 text-center">
                            <div className="flex flex-col items-center gap-4 text-slate-300 dark:text-slate-700">
                              <History size={64} strokeWidth={1} />
                              <p className="text-lg font-black">ຍັງບໍ່ມີປະຫວັດການນຳເຂົ້າ</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 4.1: History Details */}
          {step === "history" && selectedHistory && (
            <div className="max-w-4xl mx-auto w-full animate-in slide-in-from-right-4 duration-300 pb-10">
              <div className="flex items-center gap-4 mb-6">
                <button 
                  onClick={() => setSelectedHistory(null)}
                  className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-purple-600 hover:border-purple-300 dark:hover:border-purple-700 transition-all flex items-center justify-center shadow-sm"
                >
                  <ArrowLeft size={20} />
                </button>
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white">
                    ລາຍລະອຽດການນຳເຂົ້າ
                  </h2>
                  <p className="text-sm font-bold text-slate-400 mt-1">
                    ວັນທີ: {new Date(selectedHistory.import_date).toLocaleString('lo-LA')} 
                    <span className="mx-2 text-slate-300">•</span> 
                    ສາຂາ: <span className="text-purple-500">{selectedHistory.branch_id}</span>
                  </p>
                </div>
              </div>

              <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
                <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-slate-400" />
                    <span className="font-bold text-slate-600 dark:text-slate-300">
                      ລາຍການທັງໝົດ: <span className="font-black text-slate-800 dark:text-white">{Number(selectedHistory.total_skus).toLocaleString()}</span> SKUs
                    </span>
                  </div>
                  <button
                    onClick={exportDetailsCSV}
                    disabled={historyDetailsData.length === 0}
                    className="h-10 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black text-xs transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Download size={14} />
                    Export Excel
                  </button>
                </div>
                
                <div className="overflow-x-auto custom-scrollbar max-h-[60vh]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                      <tr>
                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest">Barcode</th>
                        <th className="px-8 py-4 font-black text-xs text-slate-400 uppercase tracking-widest text-right">Qty (ຍອດຂາຍ)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                      {isFetchingDetails ? (
                        <tr>
                          <td colSpan="2" className="py-20 text-center">
                            <Loader2 size={32} className="animate-spin text-purple-500 mx-auto" />
                            <p className="text-sm font-bold text-slate-400 mt-4">ກຳລັງດึงຂໍ້ມູນ...</p>
                          </td>
                        </tr>
                      ) : historyDetailsData.length > 0 ? (
                        historyDetailsData.map((r, i) => (
                          <tr key={i} className="hover:bg-purple-50/50 dark:hover:bg-purple-900/10 transition-colors">
                            <td className="px-8 py-4">
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-200">{r.barcode_no}</span>
                            </td>
                            <td className="px-8 py-4 text-right">
                              <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                                {Number(r.sales_qty).toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="2" className="py-20 text-center text-slate-400">
                            ບໍ່ພົບຂໍ້ມູນລາຍລະອຽດ
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* --- Import Modal --- */}
      {showImportModal && (
        <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-8 w-full max-w-md shadow-2xl border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-800 dark:text-white">Import to Store Inventory</h3>
                <p className="text-sm text-slate-400 font-medium mt-1">ໂພນວນ <span className="font-black text-emerald-500">{aggData.length.toLocaleString()}</span> SKUs ເຂົ້າບັນທຶກ</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 text-slate-400 hover:text-rose-500 transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="mb-6">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">ເລືອກສາຂາ</label>
              <div className="relative mb-4">
                <select
                  value={importBranch}
                  onChange={(e) => setImportBranch(e.target.value)}
                  className="w-full h-14 pl-5 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white font-black text-sm outline-none focus:border-emerald-500 transition-all appearance-none cursor-pointer"
                >
                  {['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ໂພນສີນວນ', 'ວັງຊາຍ'].map(b => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
              </div>

              {!importResult && (
                <>
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">ຮູບແບບການ Import</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setImportMode('deduct')}
                      className={`h-14 rounded-2xl border-2 font-black text-xs flex flex-col items-center justify-center transition-all ${
                        importMode === 'deduct'
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-md shadow-emerald-500/10'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-300'
                      }`}
                    >
                      <span>ຕັດສະຕ໋ອກ</span>
                      <span className="text-[10px] opacity-70">(ລົບຈຳນວນ)</span>
                    </button>
                    <button
                      onClick={() => setImportMode('history_only')}
                      className={`h-14 rounded-2xl border-2 font-black text-xs flex flex-col items-center justify-center transition-all ${
                        importMode === 'history_only'
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-md shadow-blue-500/10'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300'
                      }`}
                    >
                      <span>ບັນທຶກປະຫວັດຢ່າງດຽວ</span>
                      <span className="text-[10px] opacity-70">(ບໍ່ລົບຈຳນວນ)</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {!importResult && !isImporting && importMode === 'deduct' && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 mb-6 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                  ⚠️ <strong>ຕັດສະຕ໋ອກ:</strong> ຈະບວກເພີ່ມ <strong>sales_qty</strong> ໃນ store_inventory ສະເພາະ Barcode ທີ່ມີແລ້ວ. ອັນທີ່ບໍ່ມີຈະຖືກຂ້າມ.
                </p>
              </div>
            )}
            {!importResult && !isImporting && importMode === 'history_only' && (
              <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 mb-6 animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xs font-bold text-blue-700 dark:text-blue-400">
                  ℹ️ <strong>ບັນທຶກປະຫວັດຢ່າງດຽວ:</strong> ຈະບັນທຶກເຂົ້າໜ້າ History ເທົ່ານັ້ນ. ຈະບໍ່ໄປຫັກຈຳນວນສິນຄ້າໃນສະຕ໋ອກ.
                </p>
              </div>
            )}

            {importResult && (
              <div className={`p-4 rounded-2xl border mb-6 space-y-3 ${importResult.mode === 'history_only' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'}`}>
                <div className={`flex items-center gap-2 ${importResult.mode === 'history_only' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  <CheckCircle2 size={18} />
                  <span className="font-black text-sm">
                    {importResult.mode === 'history_only' ? 'ບັນທຶກປະຫວັດສຳເລັດ!' : 'ນຳເຂົ້າສຳເລັດ!'}
                  </span>
                </div>
                {importResult.mode === 'deduct' ? (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 rounded-xl bg-white dark:bg-slate-800">
                      <p className="text-2xl font-black text-emerald-600">{importResult.updated}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Updated</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white dark:bg-slate-800">
                      <p className="text-2xl font-black text-amber-500">{importResult.notFound}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Not Found</p>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white dark:bg-slate-800">
                      <p className="text-2xl font-black text-rose-500">{importResult.errors}</p>
                      <p className="text-[10px] font-black text-slate-400 uppercase">Errors</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 rounded-xl bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-800">
                    <p className="text-3xl font-black text-blue-600">{importResult.updated.toLocaleString()}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">ລາຍການຖືກບັນທຶກລົງປະຫວັດ</p>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(false)}
                className="flex-1 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-black text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                {importResult ? 'ປິດ' : 'ຍກເລີກ'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95"
                >
                  {isImporting ? (
                    <><Loader2 size={18} className="animate-spin" /> ກຳລັງ Import...</>
                  ) : (
                    <><UploadCloud size={18} /> ເລີ່ມ Import</>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Footer Decoration --- */}
      <footer className="h-10 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-1.5 opacity-30">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Sales Pro Aggregator System</p>
        </div>
      </footer>

    </div>
  );

  return createPortal(content, document.body);
}
