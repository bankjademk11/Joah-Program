import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X, AlertCircle, CheckCircle2, Calendar, Building2, Hash, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { allBranches } from '../data/mockReceiveData';

export default function ImportROModal({ isOpen, onClose, onImportSuccess }) {
  const [selectedBranch, setSelectedBranch] = useState('PSN');
  const [roDate, setRoDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [roReference, setRoReference] = useState('');
  const [file, setFile] = useState(null);
  const [previewRows, setPreviewRows] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const currentBranchObj = allBranches.find(b => b.tag === selectedBranch) || allBranches[0];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setErrorMsg('');
    setFile(selectedFile);
    parseExcelPreview(selectedFile);
  };

  const parseExcelPreview = (fileObj) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        if (!data || data.length === 0) {
          setErrorMsg('Excel file is empty or unreadable');
          return;
        }
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        if (!rawJson || rawJson.length < 2) {
          setErrorMsg('Excel file has no data or invalid format');
          setPreviewRows([]);
          return;
        }

        // Search for header row
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(rawJson.length, 5); i++) {
          const rowStr = (rawJson[i] || []).join(' ').toLowerCase();
          if (rowStr.includes('barcode') || rowStr.includes('product') || rowStr.includes('picking')) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = (rawJson[headerRowIndex] || []).map(h => String(h).trim().toLowerCase());
        
        let locIdx = headers.findIndex(h => h.includes('location'));
        let barcodeIdx = headers.findIndex(h => h === 'barcode (product)' || h === 'actual barcode' || h === 'barcode');
        if (barcodeIdx === -1) barcodeIdx = 1;
        
        let productIdx = headers.findIndex(h => h.includes('product') && !h.includes('barcode'));
        if (productIdx === -1) productIdx = 3;

        let qtyIdx = headers.findIndex(h => h.includes('picking') || h.includes('qty') || h.includes('ຈຳນວນ'));
        if (qtyIdx === -1) qtyIdx = headers.length > 4 ? 4 : headers.length - 1;

        const parsedItems = [];
        for (let i = headerRowIndex + 1; i < rawJson.length; i++) {
          const row = rawJson[i];
          if (!row || row.length === 0) continue;

          const barcode = String(row[barcodeIdx] !== undefined ? row[barcodeIdx] : '').trim();
          const productName = String(row[productIdx] !== undefined ? row[productIdx] : '').trim();
          const rawQty = row[qtyIdx];
          const qty = parseInt(rawQty, 10);

          if (!barcode && !productName) continue;
          if (isNaN(qty) || qty <= 0) continue;

          parsedItems.push({
            id: `item-${i}`,
            location: locIdx !== -1 && row[locIdx] ? String(row[locIdx]).trim() : '',
            barcode: barcode || 'NO_BARCODE',
            productName: productName || 'Unknown Product',
            roQty: qty,
            unit: 'Unit'
          });
        }

        if (parsedItems.length === 0) {
          setErrorMsg('No products found with quantity > 0 in Excel file');
          setPreviewRows([]);
        } else {
          setPreviewRows(parsedItems);
        }
      } catch (err) {
        console.error(err);
        setErrorMsg('Error reading Excel file: ' + err.message);
        setPreviewRows([]);
      }
    };
    reader.readAsArrayBuffer(fileObj);
  };

  const handleSaveImport = () => {
    if (!roReference.trim()) {
      setErrorMsg('Please enter RO / SO Reference number');
      return;
    }
    if (previewRows.length === 0) {
      setErrorMsg('Please select an Excel file with product data');
      return;
    }

    setIsProcessing(true);

    try {
      let formattedDate = roDate;
      if (roDate.includes('-')) {
        const [y, m, d] = roDate.split('-');
        formattedDate = `${d}/${m}/${y}`;
      }

      const refClean = roReference.trim();
      let soNumber = refClean;
      let roNumber = refClean;
      if (refClean.includes('-')) {
        const parts = refClean.split('-');
        soNumber = parts[0].trim();
        roNumber = parts.slice(1).join('-').trim() || parts[0].trim();
      }

      const newRoId = `ro-import-${Date.now()}`;
      const totalRoQty = previewRows.reduce((sum, it) => sum + it.roQty, 0);

      const itemsWithRoId = previewRows.map((it, idx) => ({
        ...it,
        id: `${newRoId}-item-${idx + 1}`
      }));

      const newRO = {
        id: newRoId,
        fullReference: refClean,
        soNumber,
        roNumber,
        rawStore: currentBranchObj.name,
        storeCode: selectedBranch,
        storeName: currentBranchObj.name,
        branchTag: selectedBranch,
        deliveryDate: formattedDate,
        totalItems: itemsWithRoId.length,
        totalRoQty,
        items: itemsWithRoId,
        isCustomImported: true,
        createdAt: new Date().toISOString()
      };

      onImportSuccess(newRO);
      onClose();
    } catch (err) {
      setErrorMsg('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 px-6 py-5 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
              <FileSpreadsheet size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-xl font-black">Import Delivery RO Excel</h3>
              <p className="text-white/80 text-xs mt-0.5">Import DC RO To Store (Picking List)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition cursor-pointer text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* FORM FIELDS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Branch Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Building2 size={14} className="text-indigo-600" />
                <span>Destination Store:</span>
                <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-bold text-xs outline-none transition cursor-pointer"
              >
                {allBranches.map((b) => (
                  <option key={b.tag} value={b.tag}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Date Picker */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                <span>Delivery Date:</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={roDate}
                onChange={(e) => setRoDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-bold text-xs outline-none transition"
              />
            </div>
          </div>

          {/* 3. RO / SO Reference Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Hash size={14} className="text-indigo-600" />
              <span>RO / SO Reference Number:</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. SO17-111020001260904393 or 0772RO1710100012609"
              value={roReference}
              onChange={(e) => setRoReference(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 font-mono text-xs font-bold outline-none transition"
            />
            <p className="text-[11px] text-slate-400">
              Enter RO number to match with store inventory count
            </p>
          </div>

          {/* 4. Excel File Upload */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-indigo-600" />
              <span>Upload Excel File (.xlsx / .xls):</span>
              <span className="text-rose-500">*</span>
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                file
                  ? 'border-indigo-400 bg-indigo-50/30'
                  : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <UploadCloud size={32} className={`mx-auto mb-2 ${file ? 'text-indigo-600' : 'text-slate-400'}`} />
              {file ? (
                <div>
                  <p className="text-xs font-black text-indigo-700 flex items-center justify-center gap-1.5">
                    <CheckCircle2 size={14} /> {file.name}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Size: {(file.size / 1024).toFixed(1)} KB · Click to change file
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-bold text-slate-600">
                    Click to select file or drag and drop here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supported columns: Location | Barcode | Actual Barcode | Product | Picking for Store
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* PREVIEW OF PARSED ITEMS */}
          {previewRows.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-indigo-600" />
                  Preview parsed items ({previewRows.length} items, Total{' '}
                  {previewRows.reduce((s, it) => s + it.roQty, 0)} units)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                  ✓ Ready to import
                </span>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-100 text-[10px] text-slate-500 uppercase font-black sticky top-0">
                    <tr>
                      <th className="p-2">Location</th>
                      <th className="p-2">Barcode</th>
                      <th className="p-2">Product Name</th>
                      <th className="p-2 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700 font-medium">
                    {previewRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-white">
                        <td className="p-2 font-mono text-[11px] text-slate-500">{r.location || '-'}</td>
                        <td className="p-2 font-mono text-[11px] font-bold text-indigo-700">{r.barcode}</td>
                        <td className="p-2 truncate max-w-[200px]">{r.productName}</td>
                        <td className="p-2 text-right font-black font-mono">{r.roQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {previewRows.length > 10 && (
                  <div className="p-2 text-center text-[10px] text-slate-400 font-bold bg-white">
                    ...and {previewRows.length - 10} more items
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveImport}
            disabled={isProcessing || previewRows.length === 0 || !roReference.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-black shadow-md shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <UploadCloud size={16} />
            <span>{isProcessing ? 'Saving...' : 'Import this RO'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
