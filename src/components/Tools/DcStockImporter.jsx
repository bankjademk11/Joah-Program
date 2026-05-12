import { useState, useCallback, useRef } from 'react';
import {
  ArrowLeft, Upload, Database, CheckCircle, AlertCircle,
  Loader2, FileSpreadsheet, TrendingDown, BarChart3, Trash2,
  Download, ChevronDown, RotateCcw, Package
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
  const fileInputRef = useRef(null);

  // ─── Parse Excel/CSV ───────────────────────────────────────────
  const parseFile = useCallback((selectedFile) => {
    if (!selectedFile) return;
    if (!importBranch) { alert('⚠️ ກະລຸນາເລືອກສາຂາກ່ອນ!'); return; }
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
        const autoBarcode = hdrs.find(h => /barcode|บาร์โค้ด|ບາ/i.test(h)) || hdrs[0];
        const autoQty = hdrs.find(h => /qty|quantity|ຈຳນວນ|จำนวน|on.hand|on_hand/i.test(h)) || hdrs[1];
        setBarcodeCol(autoBarcode);
        setQtyCol(autoQty);
        setStep('config');
      } catch (err) {
        alert('ອ່ານໄຟລ໌ຜິດພາດ: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(selectedFile);
  }, [importBranch]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) parseFile(f);
  };

  // ─── Build Preview ─────────────────────────────────────────────
  const buildPreview = () => {
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

  // ─── Import to Supabase ────────────────────────────────────────
  const handleImport = async () => {
    if (!previewData.length) return;
    if (!importBranch) { alert('ກະລຸນາເລືອກສາຂາ'); return; }
    setIsImporting(true);
    setImportResult(null);
    try {
      // Step 1: Delete old data for this branch
      const { error: delErr } = await supabase
        .from('table_dc_stock')
        .delete()
        .eq('branch_id', importBranch);
      if (delErr) throw delErr;

      // Step 2: Insert new data in chunks
      const payload = previewData.map(r => ({
        barcode: r.barcode,
        qty: r.qty,
        branch_id: importBranch,
        updated_at: new Date().toISOString()
      }));
      const CHUNK = 1000;
      let successCount = 0;
      for (let i = 0; i < payload.length; i += CHUNK) {
        const chunk = payload.slice(i, i + CHUNK);
        const { error } = await supabase.from('table_dc_stock').insert(chunk);
        if (error) {
          throw error;
        }
        successCount += chunk.length;
      }
      setImportResult({ success: successCount, total: previewData.length, branch: importBranch });
      setStep('result');
    } catch (err) {
      console.error('[DC DEBUG] import failed:', err);
      alert('ນຳເຂົ້າຜິດພາດ: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  // ─── Clear all DC Stock ───────────────────────────────────────
  const handleClearAll = async () => {
    if (!importBranch) { alert('ກະລຸນາເລືອກສາຂາກ່ອນ'); return; }
    if (!window.confirm(`ແນ່ໃຈບໍ? ລົບ DC Stock ສາຂາ "${importBranch}" ທັງໝົດ!`)) return;
    try {
      const { error } = await supabase.from('table_dc_stock').delete().eq('branch_id', importBranch);
      if (error) throw error;
      alert('ລົບຂໍ້ມູນສຳເລັດ!');
    } catch (err) {
      alert('ລົບຜິດພາດ: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-50 dark:bg-slate-950 flex flex-col overflow-hidden animate-in fade-in duration-300">

      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8 shrink-0 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all group"
          >
            <ArrowLeft size={22} className="group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                <Package size={18} />
              </div>
              <h1 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">DC Stock Importer</h1>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">ນຳເຂົ້າສະຕ໋ອກຄັງ (Warehouse) ຈາກ Odoo</p>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="hidden md:flex items-center gap-3">
          {[
            { id: 'upload', label: 'ອັບໂຫລດ', icon: Upload },
            { id: 'config', label: 'ຕັ້ງຄ່າ', icon: Database },
            { id: 'preview', label: 'ກວດສອບ', icon: BarChart3 },
            { id: 'result', label: 'ຜົນລາຍງານ', icon: CheckCircle },
          ].map((s, idx, arr) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-xs font-black ${
                step === s.id
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-500/20 scale-105'
                  : ['result', 'preview', 'config'].includes(step) && idx < ['upload', 'config', 'preview', 'result'].indexOf(step)
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-600'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
              }`}>
                <s.icon size={13} />
                <span>{s.label}</span>
              </div>
              {idx < arr.length - 1 && <ChevronDown size={13} className="text-slate-300 -rotate-90" />}
            </div>
          ))}
        </div>

        <div className="w-24" />
      </header>

      {/* ─── Main ───────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-8">

        {/* STEP 1: UPLOAD */}
        {step === 'upload' && (
          <div className="max-w-xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[2.5rem] p-16 flex flex-col items-center gap-6 cursor-pointer transition-all duration-300 ${
                isDragging
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02]'
                  : 'border-slate-200 dark:border-slate-700 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10'
              }`}
            >
              <div className="w-24 h-24 rounded-[2rem] bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-500">
                <FileSpreadsheet size={48} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-slate-700 dark:text-white">ລາກ ຫຼື ຄລິກເພື່ອເລືອກໄຟລ໌</p>
                <p className="text-sm font-bold text-slate-400 mt-2">ຮອງຮັບ Excel (.xlsx) ແລະ CSV (.csv) ຈາກ Odoo</p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-400 font-bold">
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">.xlsx</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">.csv</span>
                <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800">.xls</span>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files[0] && parseFile(e.target.files[0])}
            />

            {/* Branch Selector */}
            <div className="mt-6 p-5 glass-card rounded-[2rem] border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/50 dark:bg-indigo-900/10">
              <label className="text-xs font-black text-indigo-600 uppercase tracking-widest block mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px]">!</span>
                ກະລຸນາເລືອກສາຂາທີ່ຈະ Import ກ່ອນ
              </label>
              <div className="relative">
                <select
                  value={importBranch}
                  onChange={e => setImportBranch(e.target.value)}
                  className={`w-full h-12 pl-4 pr-10 rounded-xl bg-white dark:bg-slate-800 border-2 font-black text-sm outline-none transition-all appearance-none cursor-pointer ${
                    importBranch
                      ? 'border-emerald-400 dark:border-emerald-600 text-slate-700 dark:text-white'
                      : 'border-red-300 dark:border-red-700 text-red-400'
                  }`}
                >
                  <option value="" disabled>-- ເລືອກສາຂາ --</option>
                  <option value="ຕະຫຼາດລາວ">ຕະຫຼາດລາວ</option>
                  <option value="ສີວິໄລ">ສີວິໄລ</option>
                  <option value="ວັງຊາຍ">ວັງຊາຍ</option>
                  <option value="ໂພນສີນວນ">ໂພນສີນວນ</option>
                </select>
                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none ${importBranch ? 'text-emerald-500' : 'text-red-400'}`} size={16} />
              </div>
              {!importBranch && (
                <p className="text-xs font-bold text-red-400 mt-2">⚠️ ຕ້ອງເລືອກສາຂາກ່ອນຖືນຈະອັບໂຫລດໄດ້</p>
              )}
            </div>

            {/* Clear all button */}
            <button
              onClick={handleClearAll}
              className="mt-4 w-full h-12 rounded-2xl border-2 border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-black text-sm transition-all flex items-center justify-center gap-2"
            >
              <Trash2 size={16} />
              ລົບ DC Stock ສາຂານີ້ (Clear Branch)
            </button>
          </div>
        )}

        {/* STEP 2: CONFIG */}
        {step === 'config' && (
          <div className="max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card rounded-[2.5rem] p-10 border-white/50 shadow-2xl">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 text-xs font-black mb-4">
                  <CheckCircle size={14} />
                  ໄຟລ໌: {file?.name}  ({rawRows.length.toLocaleString()} rows)
                </div>
                <h2 className="text-2xl font-black text-slate-800 dark:text-white">ເລືອກ Column ທີ່ຕ້ອງການ</h2>
                <p className="text-sm text-slate-400 font-bold mt-1">ລະບຸ Column ຂອງ Barcode ແລະ Quantity</p>
              </div>

              <div className="space-y-6">
                {/* Barcode */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-[10px]">1</span>
                    Column ຂອງ Barcode
                  </label>
                  <div className="relative">
                    <select
                      value={barcodeCol}
                      onChange={(e) => setBarcodeCol(e.target.value)}
                      className="w-full h-14 pl-5 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white font-black text-sm outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>

                {/* Qty */}
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center text-[10px]">2</span>
                    Column ຂອງ Quantity (ຈຳນວນ)
                  </label>
                  <div className="relative">
                    <select
                      value={qtyCol}
                      onChange={(e) => setQtyCol(e.target.value)}
                      className="w-full h-14 pl-5 pr-12 rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-700 dark:text-white font-black text-sm outline-none focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                    >
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={buildPreview}
                    className="w-full h-16 rounded-[1.5rem] bg-indigo-600 hover:bg-indigo-700 text-white font-black text-lg shadow-xl shadow-indigo-500/30 hover:-translate-y-1 transition-all flex items-center justify-center gap-3"
                  >
                    <BarChart3 size={22} />
                    ກວດສອບຂໍ້ມູນ
                  </button>
                  <button
                    onClick={() => setStep('upload')}
                    className="w-full mt-4 h-12 text-slate-400 hover:text-slate-600 font-bold text-sm transition-colors"
                  >
                    ຍົກເລີກ ແລະ ເລືອກໄຟລ໌ໃໝ່
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: PREVIEW */}
        {step === 'preview' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-6 mb-8">
              <div className="glass-card rounded-[2rem] p-8 border-indigo-500/20 shadow-xl">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Total SKUs</p>
                <p className="text-5xl font-black text-slate-800 dark:text-white">{previewData.length.toLocaleString()}</p>
                <p className="text-sm font-bold text-slate-400 mt-2">ລາຍການ Barcode</p>
              </div>
              <div className="glass-card rounded-[2rem] p-8 border-emerald-500/20 shadow-xl">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-3">Total Qty (DC)</p>
                <p className="text-5xl font-black text-slate-800 dark:text-white">
                  {previewData.reduce((s, r) => s + r.qty, 0).toLocaleString()}
                </p>
                <p className="text-sm font-bold text-slate-400 mt-2">ຈຳນວນທັງໝົດໃນຄັງ</p>
              </div>
              <div className="glass-card rounded-[2rem] p-8 border-amber-500/20 shadow-xl">
                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-3">ສາຂາ</p>
                <p className="text-2xl font-black text-slate-800 dark:text-white mt-3">{importBranch}</p>
                <p className="text-sm font-bold text-slate-400 mt-2">ທີ່ຈະ Import</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="flex-1 h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-base shadow-xl shadow-indigo-500/30 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-3"
              >
                {isImporting ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                {isImporting ? 'ກຳລັງນຳເຂົ້າ...' : 'ນຳເຂົ້າ DC Stock'}
              </button>
              <button
                onClick={() => setStep('config')}
                className="h-14 px-6 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-black text-sm hover:border-slate-400 transition-all"
              >
                ຍ້ອນກັບ
              </button>
            </div>

            {/* Preview table */}
            <div className="glass-card rounded-[2.5rem] border-white/50 shadow-2xl overflow-hidden">
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-black text-slate-600 dark:text-slate-300">
                  ຕົວຢ່າງຂໍ້ມູນ (ສະແດງ 20 ລາຍການທຳອິດ)
                </p>
              </div>
              <div className="overflow-x-auto custom-scrollbar max-h-[55vh]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md">
                    <tr>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">#</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Barcode</th>
                      <th className="px-8 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">QTY (DC)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {previewData.slice(0, 20).map((r, i) => (
                      <tr key={i} className="hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                        <td className="px-8 py-4 text-sm text-slate-400 font-bold">{i + 1}</td>
                        <td className="px-8 py-4">
                          <span className="font-mono font-black text-slate-700 dark:text-slate-200">{r.barcode}</span>
                        </td>
                        <td className="px-8 py-4 text-right">
                          <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                            {r.qty.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {previewData.length > 20 && (
                      <tr>
                        <td colSpan="3" className="px-8 py-4 text-center text-sm font-bold text-slate-400">
                          ... ແລະ {(previewData.length - 20).toLocaleString()} ລາຍການເພີ່ມເຕີມ
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: RESULT */}
        {step === 'result' && importResult && (
          <div className="max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-500 flex flex-col items-center gap-8 pt-10">
            <div className="w-24 h-24 rounded-[2rem] bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-500 shadow-lg shadow-emerald-500/20">
              <CheckCircle size={52} strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white">ນຳເຂົ້າສຳເລັດ!</h2>
              <p className="text-slate-400 font-bold mt-2">DC Stock ສາຂາ <span className="text-indigo-500 font-black">{importResult.branch}</span> ຖືກອັບເດດແລ້ວ</p>
            </div>

            <div className="w-full grid grid-cols-2 gap-4">
              <div className="glass-card rounded-[2rem] p-6 text-center border-emerald-500/20">
                <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">ສຳເລັດ</p>
                <p className="text-4xl font-black text-slate-800 dark:text-white">{importResult.success.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-400 mt-1">ລາຍການ</p>
              </div>
              <div className="glass-card rounded-[2rem] p-6 text-center border-indigo-500/20">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2">ທັງໝົດ</p>
                <p className="text-4xl font-black text-slate-800 dark:text-white">{importResult.total.toLocaleString()}</p>
                <p className="text-xs font-bold text-slate-400 mt-1">SKUs</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => { setStep('upload'); setFile(null); setRawRows([]); setPreviewData([]); setImportResult(null); }}
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} />
                Import ໄຟລ໌ໃໝ່
              </button>
              <button
                onClick={onBack}
                className="w-full h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-slate-500 font-bold text-sm hover:border-slate-400 transition-all"
              >
                ກັບໄປໜ້າຫຼັກ
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
