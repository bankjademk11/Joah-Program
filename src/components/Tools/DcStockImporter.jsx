import { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Upload, Database, CheckCircle, AlertCircle,
  Loader2, FileSpreadsheet, TrendingDown, BarChart3, Trash2,
  Download, ChevronDown, RotateCcw, Package, Layers, ShieldCheck,
  History, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../utils/supabaseClient';

export default function DcStockImporter({ onBack }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'config' | 'preview' | 'result'
  const [file, setFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [barcodeCol, setBarcodeCol] = useState('');
  const [qtyCol, setQtyCol] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importBranch, setImportBranch] = useState('');
  const [lastImportPayload, setLastImportPayload] = useState(null);
  const fileInputRef = useRef(null);

  // ─── Parse Excel/CSV ───────────────────────────────────────────
  const parseFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (!json.length) return;
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawRows(json);
        // Auto-detect columns
        const autoBarcode = hdrs.find(h => /barcode|ບາໂຄດ|ບາ/i.test(h)) || hdrs[0];
        const autoQty = hdrs.find(h => /qty|quantity|ຈຳນວນ|ຈຳ/i.test(h)) || hdrs[1];
        setBarcodeCol(autoBarcode);
        setQtyCol(autoQty);
        setStep('config');
      } catch (err) {
        alert('ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  };

  // ─── Build Preview ─────────────────────────────────────────────
  const buildPreview = () => {
    if (!importBranch) { alert('⚠️ ກະລຸນາເລືອກສາຂາປາຍທາງກ່ອນ!'); return; }
    const agg = {};
    rawRows.forEach(row => {
      const bc = String(row[barcodeCol] || '').trim();
      const qty = parseFloat(row[qtyCol]) || 0;
      if (!bc) return;
      agg[bc] = (agg[bc] || 0) + qty;
    });
    const arr = Object.entries(agg).map(([barcode, qty]) => ({ barcode, qty: Math.round(qty) }));
    setPreviewData(arr);
    setStep('preview');
  };

  // ─── Import Logic (GM Formula Integrated) ──────────────────────
  const handleImport = async () => {
    if (!previewData.length) return;
    if (!importBranch) { alert('ກະລຸນາເລືອກສາຂາ'); return; }
    setIsImporting(true);
    setImportResult(null);
    try {
      // 1. Fetch current DC data
      let existingDcData = [];
      let page = 0;
      let isFetching = true;
      while (isFetching) {
        const { data, error } = await supabase
          .from('table_dc_stock')
          .select('id, barcode, qty')
          .eq('branch_id', importBranch)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          existingDcData = [...existingDcData, ...data];
          page++;
        } else isFetching = false;
      }
      const dcMap = {};
      existingDcData.forEach(item => { dcMap[item.barcode] = item; });

      // 2. Fetch current Store Inventory (Q)
      let storeInventory = [];
      page = 0;
      isFetching = true;
      while (isFetching) {
        const { data, error } = await supabase
          .from('store_inventory')
          .select('id, barcode_no, q_qty, store_qty')
          .eq('branch_id', importBranch)
          .range(page * 1000, (page + 1) * 1000 - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          storeInventory = [...storeInventory, ...data];
          page++;
        } else isFetching = false;
      }
      const storeMap = {};
      storeInventory.forEach(item => { storeMap[item.barcode_no] = item; });

      // 3. Prepare Payloads
      const addedData = [];
      const dcPayload = [];
      const storeUpdatePayload = [];
      const timestamp = new Date().toISOString();

      previewData.forEach(r => {
        const qtyToAdd = r.qty;
        addedData.push({ barcode: r.barcode, qtyAdded: qtyToAdd });

        const existingDc = dcMap[r.barcode];
        dcPayload.push({
          ...(existingDc ? { id: existingDc.id } : {}),
          barcode: r.barcode,
          qty: (existingDc?.qty || 0) + qtyToAdd,
          branch_id: importBranch,
          updated_at: timestamp
        });

        const existingStore = storeMap[r.barcode];
        if (existingStore) {
          const currentQ = (existingStore.q_qty != null && existingStore.q_qty > 0)
            ? Number(existingStore.q_qty)
            : Number(existingStore.store_qty || 0);
          storeUpdatePayload.push({
            id: existingStore.id,
            q_qty: currentQ + qtyToAdd,
            last_updated: timestamp
          });
        }
      });

      // 4. Batch Updates
      const CHUNK = 500;
      for (let i = 0; i < dcPayload.length; i += CHUNK) {
        const { error } = await supabase.from('table_dc_stock').upsert(dcPayload.slice(i, i + CHUNK));
        if (error) throw error;
      }

      for (let i = 0; i < storeUpdatePayload.length; i += CHUNK) {
        const chunk = storeUpdatePayload.slice(i, i + CHUNK);
        await Promise.all(chunk.map(item => 
          supabase.from('store_inventory').update({ q_qty: item.q_qty, last_updated: item.last_updated }).eq('id', item.id)
        ));
      }

      setLastImportPayload({ branch_id: importBranch, addedData });
      setImportResult({ success: previewData.length, total: previewData.length, branch: importBranch });
      setStep('result');
    } catch (err) {
      console.error('[DC IMPORT] Error:', err);
      alert('ການນຳເຂົ້າລົ້ມເຫຼວ: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearAll = async () => {
    if (!importBranch) return;
    const pin = window.prompt(`ໃສ່ PIN ເພື່ອຢືນຢັນການລ້າງຂໍ້ມູນສາຂາ "${importBranch}" (ຍອດລວມ Q ຈະຖືກຫັກອອກ):`);
    if (pin !== '248248') { if (pin !== null) alert('❌ PIN ບໍ່ຖືກຕ້ອງ!'); return; }

    try {
      const { data: dcItems } = await supabase.from('table_dc_stock').select('barcode, qty').eq('branch_id', importBranch);
      if (dcItems?.length > 0) {
        const { data: storeItems } = await supabase.from('store_inventory').select('id, barcode_no, q_qty').eq('branch_id', importBranch);
        const storeMap = {};
        storeItems?.forEach(si => { storeMap[si.barcode_no] = si; });
        const updates = dcItems.map(dc => {
          const si = storeMap[dc.barcode];
          return si ? { id: si.id, q_qty: Math.max(0, (si.q_qty || 0) - (dc.qty || 0)) } : null;
        }).filter(Boolean);
        await Promise.all(updates.map(u => supabase.from('store_inventory').update({ q_qty: u.q_qty }).eq('id', u.id)));
      }
      await supabase.from('table_dc_stock').delete().eq('branch_id', importBranch);
      alert('✅ ລ້າງຂໍ້ມູນສຳເລັດແລ້ວ!');
    } catch (err) { alert('❌ ຜິດພາດ: ' + err.message); }
  };

  const handleRollback = async () => {
    if (!lastImportPayload) return;
    const pin = window.prompt('ໃສ່ PIN ເພື່ອ Rollback (ຫັກຍອດຄືນ):');
    if (pin !== '248248') { if (pin !== null) alert('❌ PIN ບໍ່ຖືກຕ້ອງ!'); return; }
    setIsImporting(true);
    try {
      const { data: dcItems } = await supabase.from('table_dc_stock').select('id, barcode, qty').eq('branch_id', lastImportPayload.branch_id);
      const { data: storeItems } = await supabase.from('store_inventory').select('id, barcode_no, q_qty').eq('branch_id', lastImportPayload.branch_id);
      const dcMap = {}; dcItems?.forEach(d => dcMap[d.barcode] = d);
      const storeMap = {}; storeItems?.forEach(s => storeMap[s.barcode_no] = s);

      const dcUpdate = []; const dcDelete = []; const storeUpdate = [];
      lastImportPayload.addedData.forEach(added => {
        const dc = dcMap[added.barcode];
        if (dc) {
          const newQty = Math.max(0, (dc.qty || 0) - added.qtyAdded);
          if (newQty <= 0) dcDelete.push(dc.id);
          else dcUpdate.push({ id: dc.id, barcode: dc.barcode, qty: newQty, branch_id: lastImportPayload.branch_id, updated_at: new Date().toISOString() });
        }
        const store = storeMap[added.barcode];
        if (store) storeUpdate.push({ id: store.id, q_qty: Math.max(0, (store.q_qty || 0) - added.qtyAdded) });
      });

      if (dcDelete.length) await supabase.from('table_dc_stock').delete().in('id', dcDelete);
      if (dcUpdate.length) await supabase.from('table_dc_stock').upsert(dcUpdate);
      await Promise.all(storeUpdate.map(u => supabase.from('store_inventory').update({ q_qty: u.q_qty }).eq('id', u.id)));
      
      alert('✅ Rollback ສຳເລັດ!');
      setLastImportPayload(null); setStep('upload');
    } catch (err) { alert('❌ Error: ' + err.message); } finally { setIsImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-50 dark:bg-[#020617] flex flex-col overflow-hidden animate-in fade-in duration-500 font-sans">
      
      {/* ─── Modern Header ─────────────────────────────────────── */}
      <header className="h-24 bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-10 shrink-0 backdrop-blur-xl z-10 shadow-sm">
        <div className="flex items-center gap-6">
          <button
            onClick={onBack}
            className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all border border-slate-200 dark:border-slate-700 shadow-sm group"
          >
            <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Package size={22} />
              </div>
              <h1 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">DC Stock Importer</h1>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <Layers size={10} /> ນຳເຂົ້າສະຕ໋ອກສາງ (Warehouse) ຈາກ Odoo
            </p>
          </div>
        </div>

        {/* Dynamic Stepper UI */}
        <div className="hidden lg:flex items-center gap-2 bg-slate-100 dark:bg-slate-800/50 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
          {[
            { id: 'upload', label: 'ອັບໂຫລດ', icon: Upload },
            { id: 'config', label: 'ຕັ້ງຄ່າ', icon: Database },
            { id: 'preview', label: 'ກວດສອບ', icon: BarChart3 },
            { id: 'result', label: 'ສຳເລັດ', icon: CheckCircle },
          ].map((s, idx, arr) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl transition-all text-xs font-black ${
                step === s.id
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : ['result', 'preview', 'config'].includes(step) && idx < ['upload', 'config', 'preview', 'result'].indexOf(step)
                    ? 'text-emerald-500'
                    : 'text-slate-400'
              }`}>
                <s.icon size={14} strokeWidth={3} />
                <span>{s.label}</span>
              </div>
              {idx < arr.length - 1 && <div className="w-4 h-px bg-slate-200 dark:bg-slate-700 mx-1 opacity-50"></div>}
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20">
        
        {step === 'upload' && (
          <div 
            className={`h-full flex flex-col items-center justify-center p-8 transition-all duration-500 ${isDragging ? 'scale-105' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="max-w-xl w-full text-center space-y-10 animate-in slide-in-from-bottom-8 duration-700">
              <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-800 dark:text-white leading-tight">ອັບໂຫລດໄຟລ໌ Excel</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">ລາກໄຟລ໌ມາເພື່ອນຳເຂົ້າ ຫຼື ກົດປຸ່ມດ້ານລຸ່ມເພື່ອເລືອກໄຟລ໌ສະຕ໋ອກ DC</p>
              </div>

              <div className={`relative p-16 border-2 border-dashed rounded-[48px] bg-white dark:bg-slate-900 shadow-2xl transition-all group overflow-hidden ${isDragging ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' : 'border-slate-200 dark:border-slate-800 shadow-slate-200/50 dark:shadow-none hover:border-indigo-400'}`}>
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <FileSpreadsheet size={200} />
                </div>
                
                <div className="relative flex flex-col items-center gap-8">
                  <div className="w-24 h-24 rounded-[32px] bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-500/40 group-hover:scale-110 transition-transform duration-500">
                    <Upload size={40} strokeWidth={2.5} />
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-12 py-5 bg-slate-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white rounded-[24px] font-black shadow-xl shadow-slate-900/20 dark:shadow-indigo-500/20 transition-all active:scale-95"
                  >
                    ເລືອກໄຟລ໌ຈາກເຄື່ອງ
                  </button>
                  <input type="file" ref={fileInputRef} onChange={(e) => parseFile(e.target.files[0])} className="hidden" accept=".xlsx,.xls,.csv" />
                </div>
              </div>

              <div className="flex items-center justify-center gap-10">
                <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Support .XLSX</span>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500"></div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Support .CSV</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'config' && (
          <div className="h-full flex flex-col items-center p-12 overflow-y-auto animate-in fade-in zoom-in-95 duration-500">
            <div className="max-w-2xl w-full space-y-10 pb-16">
              <div className="bg-white dark:bg-slate-900 p-10 rounded-[40px] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-10 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                
                <div className="flex items-center gap-5 border-b border-slate-100 dark:border-slate-800 pb-8">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600">
                    <Database size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white">ຕັ້ງຄ່າການນຳເຂົ້າ</h3>
                    <p className="text-sm font-medium text-slate-500">ຈັບຄູ່ຄໍລຳຈາກໄຟລ໌ເພື່ອຄວາມຖືກຕ້ອງ</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <ShieldCheck size={12} className="text-emerald-500" /> ເລືອກສາຂາປາຍທາງ
                    </label>
                    <select
                      value={importBranch}
                      onChange={(e) => setImportBranch(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-5 text-sm font-black text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                    >
                      <option value="">-- ເລືອກສາຂາ --</option>
                      {['ຕະຫຼາດລາວ', 'ສີວິໄລ', 'ວັງຊາຍ', 'ໂພນສີນວນ'].map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ຄໍລຳ Barcode</label>
                      <select
                        value={barcodeCol}
                        onChange={(e) => setBarcodeCol(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-5 text-sm font-bold text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                      >
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">ຄໍລຳ ຈຳນວນ (Qty)</label>
                      <select
                        value={qtyCol}
                        onChange={(e) => setQtyCol(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-slate-800 border-2 border-transparent focus:border-indigo-500 rounded-2xl p-5 text-sm font-bold text-slate-800 dark:text-white transition-all outline-none appearance-none cursor-pointer"
                      >
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 pt-6">
                  <button
                    onClick={() => setStep('upload')}
                    className="flex-1 px-8 py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-[24px] font-black transition-all hover:bg-slate-200 active:scale-95"
                  >
                    ຍ້ອນກັບ
                  </button>
                  <button
                    onClick={buildPreview}
                    className="flex-[2] px-8 py-5 bg-indigo-600 text-white rounded-[24px] font-black shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 hover:shadow-indigo-500/30 active:scale-95"
                  >
                    ກວດສອບລາຍການ
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="h-full flex flex-col p-10 animate-in slide-in-from-right-10 duration-500">
            <div className="flex-1 bg-white dark:bg-slate-900 rounded-[48px] border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="flex items-center gap-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600">
                    <BarChart3 size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-white">ກວດສອບຄວາມຖືກຕ້ອງກ່ອນນຳເຂົ້າ</h3>
                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mt-0.5">
                      <Package size={12} /> ສາຂາ: {importBranch} | ທັງໝົດ {previewData.length} ລາຍການ
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('config')}
                    className="px-6 py-3.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl font-black text-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95"
                  >
                    ແກ້ໄຂການຕັ້ງຄ່າ
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="px-10 py-3.5 bg-indigo-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-indigo-500/20 transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50 flex items-center gap-3"
                  >
                    {isImporting ? <Loader2 size={18} className="animate-spin" /> : <TrendingDown size={18} />}
                    {isImporting ? 'ກຳລັງນຳເຂົ້າ...' : 'ຢືນຢັນການນຳເຂົ້າ'}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-white dark:bg-slate-900">
                    <tr>
                      <th className="text-left p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 dark:border-slate-800">No.</th>
                      <th className="text-left p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 dark:border-slate-800">Barcode</th>
                      <th className="text-right p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b-2 border-slate-50 dark:border-slate-800">ຈຳນວນທີ່ຈະເພີ່ມ (+)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {previewData.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="p-5 text-xs font-bold text-slate-400">{idx + 1}</td>
                        <td className="p-5 text-sm font-black text-slate-700 dark:text-slate-200 font-mono tracking-tight">{row.barcode}</td>
                        <td className="p-5 text-right">
                          <span className="px-4 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-black inline-flex items-center gap-1 group-hover:scale-105 transition-transform">
                            +{row.qty.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {step === 'result' && (
          <div className="h-full flex flex-col items-center justify-center p-12 animate-in zoom-in duration-700">
            <div className="max-w-md w-full bg-white dark:bg-slate-900 p-12 rounded-[56px] border border-slate-200 dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] text-center space-y-10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
              
              <div className="w-28 h-28 rounded-[40px] bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 mx-auto animate-bounce-subtle">
                <CheckCircle size={64} strokeWidth={2.5} />
              </div>

              <div className="space-y-3">
                <h2 className="text-4xl font-black text-slate-800 dark:text-white">ນຳເຂົ້າສຳເລັດ!</h2>
                <p className="text-slate-500 font-medium">ຂໍ້ມູນ DC Stock ແລະ ຍອດ Master (Q) ໄດ້ຮັບການອັບເດດແລ້ວ</p>
              </div>

              <div className="grid grid-cols-2 gap-5">
                <div className="p-7 rounded-[32px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <div className="text-3xl font-black text-emerald-600">{importResult?.success.toLocaleString()}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">ສຳເລັດແລ້ວ</div>
                </div>
                <div className="p-7 rounded-[32px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 shadow-inner">
                  <div className="text-3xl font-black text-slate-800 dark:text-white">{importResult?.total.toLocaleString()}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1.5">ທັງໝົດ</div>
                </div>
              </div>

              <div className="pt-4 space-y-5">
                <button
                  onClick={() => setStep('upload')}
                  className="w-full px-8 py-5 bg-slate-900 dark:bg-indigo-600 hover:bg-black dark:hover:bg-indigo-700 text-white rounded-[24px] font-black shadow-2xl transition-all active:scale-95"
                >
                  ຕົກລົງ
                </button>
                {lastImportPayload && (
                  <button
                    onClick={handleRollback}
                    disabled={isImporting}
                    className="w-full px-8 py-5 bg-white dark:bg-slate-800 text-rose-500 dark:text-rose-400 rounded-[24px] font-black flex items-center justify-center gap-3 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all border border-rose-100 dark:border-rose-900/30 shadow-sm"
                  >
                    {isImporting ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                    <span>Rollback (ຫັກຍອດຄືນ)</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modern Footer */}
      <footer className="h-20 bg-white/50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-sm shadow-emerald-500"></div>
            System Active
          </div>
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-800"></div>
          <div className="flex items-center gap-2 text-slate-400">
             <ShieldCheck size={14} className="text-indigo-500" />
             <span className="text-[10px] font-black uppercase tracking-widest">GM Formula Secured</span>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <button
            onClick={handleClearAll}
            className="flex items-center gap-3 px-6 py-2.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl transition-all text-[11px] font-black uppercase tracking-widest border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
          >
            <Trash2 size={16} />
            ລ້າງຂໍ້ມູນທັງໝົດ (Danger Zone)
          </button>
        </div>
      </footer>

      {/* Global CSS for Animations */}
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s ease-in-out infinite;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
      `}</style>
    </div>
  );
}
