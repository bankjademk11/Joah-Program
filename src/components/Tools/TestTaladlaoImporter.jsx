import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../utils/supabaseClient';
import { Upload, Database, CheckCircle, AlertCircle, Package } from 'lucide-react';

export default function TestTaladlaoImporter({ onBack }) {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [previewData, setPreviewData] = useState([]);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            readPreview(selectedFile);
        }
    };

    const readPreview = (selectedFile) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                
                // Show first 5 rows as preview
                setPreviewData(jsonData.slice(0, 5));
            } catch (err) {
                console.error(err);
                setStatus({ type: 'error', message: 'ບໍ່ສາມາດອ່ານໄຟລ໌ Excel ໄດ້' });
            }
        };
        reader.readAsBinaryString(selectedFile);
    };

    const handleImport = () => {
        if (!file) return;

        setLoading(true);
        setStatus(null);

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);

                if (jsonData.length === 0) {
                    throw new Error('ບໍ່ພົບຂໍ້ມູນໃນໄຟລ໌ Excel');
                }

                // Process Data: Map barcode and item name, set QTY to 1000
                const uniqueItems = new Map();
                
                jsonData.forEach(row => {
                    const barcode = String(row['Barcode No.'] || row['barcode'] || row['Barcode'] || row['BARCODE'] || '').trim();
                    if (barcode && !uniqueItems.has(barcode)) {
                        const itemName = row['Product Name(LA)'] || row['product_name_la'] || row['Item Name'] || row['Product Name'] || '';
                        
                        uniqueItems.set(barcode, {
                            barcode_no: barcode,
                            item_name: itemName,
                            branch_name: 'ຕະຫຼາດລາວ',
                            qty: 1000,
                            max_qty: 1000
                        });
                    }
                });

                const finalData = Array.from(uniqueItems.values());
                setProgress({ current: 0, total: finalData.length });

                // Chunk insert
                const chunkSize = 1000;
                for (let i = 0; i < finalData.length; i += chunkSize) {
                    const chunk = finalData.slice(i, i + chunkSize);
                    
                    const { error } = await supabase
                        .from('test_taladlao_store')
                        .insert(chunk);

                    if (error) {
                        console.error("Supabase error:", error);
                        throw new Error(error.message);
                    }
                    
                    setProgress(prev => ({ ...prev, current: Math.min(i + chunkSize, finalData.length) }));
                }

                setStatus({ type: 'success', message: `ອັບໂຫຼດຂໍ້ມູນສຳເລັດ ${finalData.length} ລາຍການ!` });

            } catch (error) {
                setStatus({ type: 'error', message: error.message || 'ເກີດຂໍ້ຜິດພາດໃນການອັບໂຫຼດ' });
            } finally {
                setLoading(false);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleClearData = async () => {
        if (!confirm('ທ່ານແນ່ໃຈບໍ່ວ່າຕ້ອງການລຶບຂໍ້ມູນ Test ທັງໝົດ?')) return;
        
        setLoading(true);
        try {
            // Empty the table (Requires RLS to allow delete or just delete where id > 0)
            const { error } = await supabase
                .from('test_taladlao_store')
                .delete()
                .neq('id', 0); // Hack to delete all rows

            if (error) throw error;
            setStatus({ type: 'success', message: 'ລຶບຂໍ້ມູນທັງໝົດສຳເລັດ!' });
            setPreviewData([]);
            setFile(null);
            setProgress({ current: 0, total: 0 });
        } catch (error) {
            setStatus({ type: 'error', message: error.message });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4 md:p-6 animate-fade-in-up">
            <div className="flex items-center gap-3 mb-6">
                <button 
                    onClick={onBack}
                    className="p-2 bg-white dark:bg-slate-800 rounded-xl shadow-sm text-slate-500 hover:text-joah-orange hover:bg-orange-50 transition-all border border-slate-200 dark:border-slate-700"
                >
                    &larr;
                </button>
                <div>
                    <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <Database className="text-joah-orange" /> Test Store Importer
                    </h1>
                    <p className="text-xs text-slate-500 font-medium">ອັບໂຫຼດ Excel ເຂົ້າຕາຕະລາງ test_taladlao_store ສຳລັບທົດສອບ (QTY = 1000)</p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 mb-6">
                <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                            ເລືອກໄຟລ໌ Excel (Master Data)
                        </label>
                        <input 
                            type="file" 
                            accept=".xlsx, .xls"
                            onChange={handleFileChange}
                            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-orange-50 file:text-joah-orange hover:file:bg-orange-100 transition-all"
                        />
                    </div>
                    
                    <button 
                        onClick={handleImport}
                        disabled={!file || loading}
                        className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold shadow-md transition-all ${
                            !file || loading 
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                            : 'bg-joah-orange text-white hover:bg-orange-600 hover:shadow-lg hover:-translate-y-0.5'
                        }`}
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <Upload size={18} />
                        )}
                        ເລີ່ມນຳເຂົ້າຂໍ້ມູນ
                    </button>

                    <button 
                        onClick={handleClearData}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl font-bold bg-red-100 text-red-600 hover:bg-red-200 transition-all"
                    >
                        ລຶບຂໍ້ມູນເກົ່າ
                    </button>
                </div>

                {/* Progress Bar */}
                {loading && progress.total > 0 && (
                    <div className="mt-6">
                        <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                            <span>ກຳລັງອັບໂຫຼດ...</span>
                            <span>{progress.current} / {progress.total}</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                            <div 
                                className="bg-joah-orange h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${(progress.current / progress.total) * 100}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                {/* Status Message */}
                {status && (
                    <div className={`mt-4 p-4 rounded-xl flex items-start gap-3 border ${
                        status.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                        {status.type === 'success' ? <CheckCircle className="shrink-0 text-green-500" /> : <AlertCircle className="shrink-0 text-red-500" />}
                        <p className="text-sm font-bold">{status.message}</p>
                    </div>
                )}
            </div>

            {/* Preview Data */}
            {previewData.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex-1 flex flex-col">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <Package size={16} className="text-slate-400" /> ຕົວຢ່າງຂໍ້ມູນ (5 ລາຍການທຳອິດ)
                        </h3>
                    </div>
                    <div className="p-4 overflow-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="text-slate-500">
                                    <th className="pb-2">Barcode</th>
                                    <th className="pb-2">Product Name</th>
                                    <th className="pb-2 text-right">Qty to Generate</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {previewData.map((row, i) => (
                                    <tr key={i}>
                                        <td className="py-2 font-mono text-slate-600 dark:text-slate-400">
                                            {row['Barcode No.'] || row['barcode'] || row['Barcode'] || row['BARCODE']}
                                        </td>
                                        <td className="py-2 text-slate-800 dark:text-slate-200 font-bold">
                                            {row['Product Name(LA)'] || row['product_name_la'] || row['Item Name'] || row['Product Name']}
                                        </td>
                                        <td className="py-2 text-right font-black text-joah-orange">
                                            1,000
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
