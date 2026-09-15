import React, { useState, useRef } from 'react';
import { 
    UploadCloud, FolderOpen, CheckCircle2, AlertCircle, RefreshCw, 
    X, Image as ImageIcon, Layers, FileCheck, ArrowRight, Play, Pause, Database, Table
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const BUCKET_NAME = 'product-images';
const CONCURRENCY_LIMIT = 8; // อัปโหลดพร้อมกัน 8 ไฟล์ต่อรอบเพื่อให้เร็วและไม่สะดุด

const ImageBulkUploader = ({ onClose }) => {
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, currentFile: '' });
    const [logs, setLogs] = useState([]);
    const [isPaused, setIsPaused] = useState(false);
    const abortRef = useRef(false);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);

    const handleFolderSelect = (e) => {
        const selectedFiles = Array.from(e.target.files || []).filter(f => 
            /\.(png|jpe?g|webp|gif)$/i.test(f.name)
        );

        if (selectedFiles.length === 0) {
            alert('ບໍ່ພົບໄຟລ໌ຮູບພາບໃນໂຟນເດີທີ່ເລືອກ');
            return;
        }

        setFiles(selectedFiles);
        setProgress({ total: selectedFiles.length, completed: 0, failed: 0, currentFile: '' });
        setLogs([`📂 ໂຫຼດໄຟລ໌ທັງໝົດ ${selectedFiles.length.toLocaleString()} ຮູບພ້ອມອັບໂຫຼດ`]);
    };

    const handleExcelSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogs([`📂 ກຳລັງອ່ານໄຟລ໌ Excel: ${file.name}...`]);
        setProgress({ total: 0, completed: 0, failed: 0, currentFile: 'Reading Excel...' });

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            let extractedFiles = [];
            const media = workbook.model.media; // All images in the workbook

            if (!media || media.length === 0) {
                alert('ບໍ່ພົບຮູບພາບໃນໄຟລ໌ Excel ນີ້');
                return;
            }

            // Iterate worksheets to map imageId to cell
            workbook.eachSheet((worksheet) => {
                const images = worksheet.getImages();
                images.forEach(image => {
                    const rowIdx = image.range.tl.nativeRow; // 0-indexed row
                    // Barcode is in column D, which is column index 4 (1-indexed) in exceljs
                    const excelRow = worksheet.getRow(rowIdx + 1);
                    const barcodeCell = excelRow.getCell(4);
                    let barcodeValue = barcodeCell.value;

                    // Handle if value is an object (formula or hyperlink)
                    if (barcodeValue && typeof barcodeValue === 'object' && barcodeValue.result) {
                        barcodeValue = barcodeValue.result;
                    } else if (barcodeValue && typeof barcodeValue === 'object' && barcodeValue.text) {
                        barcodeValue = barcodeValue.text;
                    }

                    let barcodeStr = '';
                    if (barcodeValue) {
                        barcodeStr = barcodeValue.toString().trim();
                    }

                    if (barcodeStr) {
                        const mediaItem = media[image.imageId];
                        if (mediaItem && mediaItem.buffer) {
                            const ext = mediaItem.extension || 'jpeg';
                            const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
                            const newFile = new File([mediaItem.buffer], `${barcodeStr}.${ext}`, { type: mimeType });
                            extractedFiles.push(newFile);
                        }
                    }
                });
            });

            if (extractedFiles.length === 0) {
                setLogs(prev => [`❌ ບໍ່ສາມາດຈັບຄູ່ຮູບກັບ Barcode (ຖັນ D) ໄດ້`, ...prev]);
                return;
            }

            setFiles(extractedFiles);
            setProgress({ total: extractedFiles.length, completed: 0, failed: 0, currentFile: '' });
            setLogs([`✅ ດຶງຮູບພາບຈາກ Excel ສຳເລັດ ${extractedFiles.length.toLocaleString()} ຮູບ ພ້ອມອັບໂຫຼດແລ້ວ!`]);
            
        } catch (error) {
            console.error(error);
            setLogs(prev => [`❌ ເກີດຂໍ້ຜິດພາດໃນການອ່ານ Excel: ${error.message}`, ...prev]);
        }
        
        // Clear input so same file can be selected again
        if (excelInputRef.current) excelInputRef.current.value = '';
    };

    const startUpload = async () => {
        if (files.length === 0) return;
        setIsUploading(true);
        setIsPaused(false);
        abortRef.current = false;

        let completedCount = 0;
        let failedCount = 0;
        const totalCount = files.length;

        const updateLog = (msg) => {
            setLogs(prev => [msg, ...prev.slice(0, 49)]);
        };

        // Bucket already exists (product-images) — go straight to upload
        updateLog(`🚀 ເລີ່ມອັບໂຫຼດ ${totalCount.toLocaleString()} ຮູບ ➜ Bucket "${BUCKET_NAME}"...`);

        const queue = [...files];

        const uploadWorker = async () => {
            while (queue.length > 0 && !abortRef.current) {
                const file = queue.shift();
                if (!file) break;

                const fileName = file.name;
                const barcode = fileName.replace(/\.[^/.]+$/, "").trim(); // Barcode without extension

                try {
                    // 1. Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    // 2. Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(fileName);

                    // 3. Update Supabase price_checker table with image_url
                    await supabase
                        .from('price_checker')
                        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
                        .eq('barcode', barcode);

                    completedCount++;
                    updateLog(`✅ [${completedCount}/${totalCount}] ${fileName} -> ອັບໂຫຼດສຳເລັດ`);
                } catch (err) {
                    console.error(`Error uploading ${fileName}:`, err);
                    failedCount++;
                    updateLog(`❌ [ຜິດພາດ] ${fileName}: ${err.message || 'Upload failed'}`);
                }

                setProgress({
                    total: totalCount,
                    completed: completedCount,
                    failed: failedCount,
                    currentFile: fileName
                });
            }
        };

        // Run concurrent workers
        const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => uploadWorker());
        await Promise.all(workers);

        setIsUploading(false);
        if (!abortRef.current) {
            updateLog(`🎉 ອັບໂຫຼດສຳເລັດທັງໝົດ! สำเร็จ: ${completedCount}, ຜິດພາດ: ${failedCount}`);
        }
    };

    const stopUpload = () => {
        abortRef.current = true;
        setIsUploading(false);
        setLogs(prev => ['⚠️ ຢຸດການອັບໂຫຼດແລ້ວ', ...prev]);
    };

    const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

    const formatBytes = (bytes, decimals = 2) => {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    const topLargestFiles = [...files].sort((a, b) => (b.size || 0) - (a.size || 0)).slice(0, 5);

    return (
        <div className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 select-none font-lao">
            <div className="w-full max-w-2xl bg-slate-900 border border-purple-500/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.3)] flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-5 bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-950 border-b border-purple-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                            <UploadCloud size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white flex items-center gap-2">
                                ອັບໂຫຼດຮູບພາບສິນຄ້າ (Bulk Image Uploader)
                            </h2>
                            <p className="text-xs text-purple-300/70">
                                ອັບໂຫຼດຮູບຂຶ້ນ Supabase Storage ({BUCKET_NAME})
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button 
                            onClick={onClose}
                            disabled={isUploading}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* Upload Options Row */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Folder Picker Card */}
                        <div className="p-6 rounded-2xl bg-purple-950/30 border-2 border-dashed border-purple-500/40 hover:border-purple-400 flex flex-col items-center justify-center text-center gap-3 transition-colors">
                            <input
                                ref={fileInputRef}
                                type="file"
                                webkitdirectory="true"
                                directory="true"
                                multiple
                                onChange={handleFolderSelect}
                                className="hidden"
                            />
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                                <FolderOpen size={30} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">ເລືອກໂຟນເດີຮູບພາບ</h3>
                                <p className="text-xs text-purple-200/60 mt-0.5">
                                    ອ່ານຮູບທັງໝົດໃນ Folder
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="mt-2 px-6 py-2.5 w-full rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <FolderOpen size={16} />
                                Select Folder
                            </button>
                        </div>

                        {/* Excel File Picker Card */}
                        <div className="p-6 rounded-2xl bg-emerald-950/30 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 flex flex-col items-center justify-center text-center gap-3 transition-colors">
                            <input
                                ref={excelInputRef}
                                type="file"
                                accept=".xlsx"
                                onChange={handleExcelSelect}
                                className="hidden"
                            />
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                                <Table size={30} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-white">ດຶງຮູບຈາກ Excel</h3>
                                <p className="text-xs text-emerald-200/60 mt-0.5">
                                    ຮູບ (Col B) ຄູ່ກັບ Barcode (Col D)
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => excelInputRef.current?.click()}
                                disabled={isUploading}
                                className="mt-2 px-6 py-2.5 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)] disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Table size={16} />
                                Import Excel
                            </button>
                        </div>
                    </div>

                    {/* Preview Section (Only show before upload starts) */}
                    {files.length > 0 && !isUploading && progress.completed === 0 && (
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30">
                            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                                <ImageIcon size={16} />
                                ຕົວຢ່າງການຈັບຄູ່ຮູບກັບ Barcode ({files.length.toLocaleString()} ລາຍການ)
                            </h3>
                            <p className="text-xs text-emerald-300/70">
                                ກະລຸນາກວດສອບຄວາມຖືກຕ້ອງກ່ອນກົດອັບໂຫຼດ (ສະແດງ 50 ຮູບທຳອິດ)
                            </p>
                            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 max-h-48 overflow-y-auto custom-scrollbar p-2 bg-black/40 rounded-xl">
                                {files.slice(0, 50).map((file, idx) => {
                                    const barcode = file.name.replace(/\.[^/.]+$/, "");
                                    const objUrl = URL.createObjectURL(file);
                                    return (
                                        <div key={idx} className="flex flex-col items-center gap-1.5 group">
                                            <div className="w-16 h-16 rounded-xl bg-black border border-emerald-500/30 overflow-hidden flex items-center justify-center relative">
                                                <img 
                                                    src={objUrl} 
                                                    alt={barcode} 
                                                    className="w-full h-full object-cover"
                                                    onLoad={() => URL.revokeObjectURL(objUrl)}
                                                />
                                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] text-white font-mono text-center p-1 break-all">
                                                    {file.name}
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-bold text-emerald-200/90 truncate w-full text-center bg-emerald-900/40 px-1 py-0.5 rounded" title={barcode}>
                                                {barcode}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            
                            {/* File Size Summary */}
                            <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-700/50 flex flex-col gap-2">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                                    <span className="text-xs font-bold text-slate-300">📊 ຂະໜາດໄຟລ໌ທັງໝົດ (Total Size)</span>
                                    <span className="text-sm font-black text-emerald-400">{formatBytes(totalSizeBytes)}</span>
                                </div>
                                <div className="flex flex-col gap-1.5 pt-1">
                                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                                        <AlertCircle size={10} /> 5 ອັນດັບຮູບທີ່ກິນພື້ນທີ່ຫຼາຍທີ່ສຸດ
                                    </span>
                                    {topLargestFiles.map((f, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] bg-black/40 px-2 py-1 rounded">
                                            <span className="text-slate-400 truncate w-3/4">{f.name}</span>
                                            <span className="text-rose-300 font-mono font-bold whitespace-nowrap">{formatBytes(f.size)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {files.length > 50 && (
                                <p className="text-[10px] text-center text-slate-400 italic mt-2">... ແລະອີກ {(files.length - 50).toLocaleString()} ຮູບ</p>
                            )}
                        </div>
                    )}

                    {/* Progress Stats */}
                    {progress.total > 0 && (
                        <div className="space-y-3 p-4 rounded-2xl bg-slate-950/80 border border-purple-500/30">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-purple-200 flex items-center gap-1.5">
                                    <Layers size={14} className="text-purple-400" />
                                    ຄວາມຄືບໜ້າ (Progress)
                                </span>
                                <span className="font-mono font-black text-purple-300 text-sm">
                                    {percent}% ({progress.completed.toLocaleString()} / {progress.total.toLocaleString()})
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-3.5 rounded-full bg-slate-900 overflow-hidden border border-purple-500/30 relative">
                                <div 
                                    className="h-full bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-500 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.8)]"
                                    style={{ width: `${percent}%` }}
                                />
                            </div>

                            {/* Current File Display */}
                            {progress.currentFile && (
                                <p className="text-[11px] font-mono text-purple-300/70 truncate">
                                    ກຳລັງອັບໂຫຼດ: <span className="text-white font-semibold">{progress.currentFile}</span>
                                </p>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-2 pt-2">
                                {!isUploading ? (
                                    <button
                                        onClick={startUpload}
                                        disabled={files.length === 0 || progress.completed === progress.total}
                                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-40 flex items-center justify-center gap-2"
                                    >
                                        <Play size={16} />
                                        ເລີ່ມອັບໂຫຼດ {files.length.toLocaleString()} ຮູບ
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopUpload}
                                        className="flex-1 py-3 rounded-xl bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(244,63,94,0.4)] flex items-center justify-center gap-2"
                                    >
                                        <Pause size={16} />
                                        ຢຸດການອັບໂຫຼດຊົ່ວຄາວ (Stop)
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Real-time Logs Console */}
                    {logs.length > 0 && (
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-purple-300/80 uppercase font-mono tracking-wider">
                                Upload Activity Log
                            </span>
                            <div className="p-3 rounded-xl bg-black/80 border border-purple-500/20 h-40 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300 custom-scrollbar">
                                {logs.map((log, idx) => (
                                    <div key={idx} className="truncate">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="px-6 py-3 bg-slate-950 border-t border-purple-500/20 flex items-center justify-between text-xs text-purple-400/60 font-mono">
                    <span>Supabase Storage · {BUCKET_NAME}</span>
                    <span>Concurrency: {CONCURRENCY_LIMIT} Parallel</span>
                </div>

            </div>
        </div>
    );
};

export default ImageBulkUploader;
