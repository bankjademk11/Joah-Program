import React, { useState, useRef } from 'react';
import {
    UploadCloud, FolderOpen, CheckCircle2, AlertCircle, RefreshCw,
    X, Image as ImageIcon, Layers, Play, Database,
    FileSpreadsheet, ShieldAlert, Check, Trash2, StopCircle
} from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';

const BUCKET_NAME = 'product-images';
const CONCURRENCY_LIMIT = 8; // ອັບໂຫລດພ້ອມກັນ 8 ໄຟລ໌ຕໍ່ຮອບເພື່ອຄວາມວ່ອງໄວ

// Helper: Recursively traverse entries from drag and drop
const traverseFileTree = async (item) => {
    return new Promise((resolve) => {
        if (item.isFile) {
            item.file((file) => {
                resolve([file]);
            }, () => resolve([]));
        } else if (item.isDirectory) {
            const dirReader = item.createReader();
            const allFiles = [];

            const readEntries = () => {
                dirReader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve(allFiles);
                    } else {
                        const filePromises = entries.map(entry => traverseFileTree(entry));
                        const nestedFiles = await Promise.all(filePromises);
                        nestedFiles.forEach(fList => allFiles.push(...fList));
                        readEntries(); // Keep reading until empty (readEntries returns in chunks of 100)
                    }
                }, () => resolve(allFiles));
            };

            readEntries();
        } else {
            resolve([]);
        }
    });
};

const ImageBulkUploader = ({ onClose }) => {
    const [files, setFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState({ total: 0, completed: 0, failed: 0, currentFile: '', skipped: 0, overwritten: 0 });
    const [logs, setLogs] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessingDrop, setIsProcessingDrop] = useState(false);

    // Duplicate detection and overwrite control
    // Mode: 'overwrite' (ຂຽນທັບ), 'skip' (ຂ້າມ)
    const [overwriteMode, setOverwriteMode] = useState('skip');
    const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
    const [duplicateFiles, setDuplicateFiles] = useState([]);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);

    const abortRef = useRef(false);
    const fileInputRef = useRef(null);
    const excelInputRef = useRef(null);

    // Clear and reset loaded files
    const handleClearAll = () => {
        if (isUploading) return;
        setFiles([]);
        setDuplicateFiles([]);
        setProgress({ total: 0, completed: 0, failed: 0, skipped: 0, overwritten: 0, currentFile: '' });
        setOverwriteMode('skip');
        setShowDuplicateModal(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (excelInputRef.current) excelInputRef.current.value = '';
        setLogs(prev => ['🧹 ລ້າງລາຍການໄຟລ໌ທັງໝົດແລ້ວ (ພ້ອມເລືອກຊຸດໃໝ່)', ...prev]);
    };

    // Check existing files on Supabase storage using parallel HEAD requests
    const detectDuplicates = async (fileList) => {
        if (!fileList || fileList.length === 0) return [];
        setIsCheckingDuplicates(true);
        setLogs(prev => [`🔍 ກຳລັງກວດສອບຮູບຊ້ຳໃນລະບົບ (${fileList.length.toLocaleString()} ໄຟລ໌)...`, ...prev]);

        const duplicates = [];
        const BATCH_SIZE = 25;
        const storageBase = `${supabase.storage.from(BUCKET_NAME).getPublicUrl('').data.publicUrl}/`;

        for (let i = 0; i < fileList.length; i += BATCH_SIZE) {
            const batch = fileList.slice(i, i + BATCH_SIZE);
            const checkPromises = batch.map(async (f) => {
                try {
                    const res = await fetch(`${storageBase}${encodeURIComponent(f.name)}`, { method: 'HEAD' });
                    if (res.status === 200) {
                        return f;
                    }
                } catch (e) {
                    // Ignore network error in check
                }
                return null;
            });

            const results = await Promise.all(checkPromises);
            results.forEach(res => {
                if (res) duplicates.push(res);
            });
        }

        setIsCheckingDuplicates(false);
        return duplicates;
    };

    // After files are loaded (either via folder, excel, or drop)
    const onFilesLoaded = async (loadedFiles, sourceLabel = '') => {
        setFiles(loadedFiles);
        setProgress({ total: loadedFiles.length, completed: 0, failed: 0, skipped: 0, overwritten: 0, currentFile: '' });

        // Auto-check for duplicates
        const dupes = await detectDuplicates(loadedFiles);
        setDuplicateFiles(dupes);

        if (dupes.length > 0) {
            setLogs(prev => [
                `⚠️ ພົບຮູບທີ່ຊ້ຳກັບໃນລະບົບແລ້ວ ${dupes.length.toLocaleString()} ຮູບ! (ເລືອກໂໝດຂຽນທັບ ຫຼື ຂ້າມໄດ້ດ້ານລຸ່ມ)`,
                `📂 ໂຫຼດໄຟລ໌ທັງໝົດ ${loadedFiles.length.toLocaleString()} ຮູບ (${sourceLabel})`,
                ...prev
            ]);
        } else {
            setLogs(prev => [
                `✨ ບໍ່ພົບຮູບຊ້ຳເລີຍ (ທັງໝົດ ${loadedFiles.length.toLocaleString()} ຮູບໃໝ່)`,
                `📂 ໂຫຼດໄຟລ໌ທັງໝົດ ${loadedFiles.length.toLocaleString()} ຮູບ (${sourceLabel})`,
                ...prev
            ]);
        }
    };

    // Process a selected or dropped Excel file
    const processExcelFile = async (file) => {
        if (!file) return;

        setLogs(prev => [`📂 ກຳລັງອ່ານໄຟລ໌ Excel: ${file.name}...`, ...prev]);
        setProgress({ total: 0, completed: 0, failed: 0, currentFile: 'Reading Excel...' });

        try {
            const ExcelJS = (await import('exceljs')).default;
            const workbook = new ExcelJS.Workbook();
            const arrayBuffer = await file.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);

            let extractedFiles = [];
            const media = workbook.model.media; // All images in the workbook

            if (!media || media.length === 0) {
                alert('ບໍ່ພົບຮູບພາບໃນໄຟລ໌ Excel ນີ້. ກະລຸນາກວດສອບວ່າເປັນໄຟລ໌ທີ່ມີຮູບພາບແທ້ຫຼືບໍ່');
                setLogs(prev => [`⚠️ ບໍ່ພົບຮູບພາບໃນໄຟລ໌ Excel: ${file.name}`, ...prev]);
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
                setLogs(prev => [`❌ ບໍ່ສາມາດຈັບຄູ່ຮູບກັບ Barcode (ຖັນ D) ໄດ້. ກະລຸນາກວດສອບຖັນ Barcode ໃນໄຟລ໌`, ...prev]);
                alert('ບໍ່ສາມາດຈັບຄູ່ຮູບກັບ Barcode ໃນຖັນ D ໄດ້. ກະລຸນາກວດສອບໄຟລ໌ Excel');
                return;
            }

            await onFilesLoaded(extractedFiles, 'Excel Import');

        } catch (error) {
            console.error(error);
            setLogs(prev => [`❌ ເກີດຂໍ້ຜິດພາດໃນການອ່ານ Excel: ${error.message}`, ...prev]);
        }
    };

    const handleFolderSelect = async (e) => {
        const selectedFiles = Array.from(e.target.files || []).filter(f =>
            /\.(png|jpe?g|webp|gif)$/i.test(f.name)
        );

        if (selectedFiles.length === 0) {
            alert('ບໍ່ພົບໄຟລ໌ຮູບພາບໃນໂຟນເດີທີ່ເລືອກ (ຕ້ອງເປັນໄຟລ໌ .png, .jpg, .webp)');
            return;
        }

        await onFilesLoaded(selectedFiles, 'Folder Picker');
    };

    const handleExcelSelect = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await processExcelFile(file);
        }
        if (excelInputRef.current) excelInputRef.current.value = '';
    };

    // ── Drag & Drop Handlers (Supports Folders & Excel Files & Image Files) ──
    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setIsDragging(false);
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (isUploading) return;

        const items = e.dataTransfer.items;
        const droppedFiles = e.dataTransfer.files;

        if ((!items || items.length === 0) && (!droppedFiles || droppedFiles.length === 0)) return;

        setIsProcessingDrop(true);
        setLogs(prev => ['🔍 ກຳລັງກວດສອບ ແລະ ດຶງໄຟລ໌ທີ່ລາກເຂົ້າມາ...', ...prev]);

        try {
            let collectedFiles = [];

            // 1. Try webkitGetAsEntry (handles dropped folders recursively)
            if (items && items.length > 0 && items[0].webkitGetAsEntry) {
                const entries = [];
                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry();
                    if (entry) entries.push(entry);
                }

                const traversePromises = entries.map(entry => traverseFileTree(entry));
                const results = await Promise.all(traversePromises);
                results.forEach(fList => collectedFiles.push(...fList));
            } else if (droppedFiles && droppedFiles.length > 0) {
                collectedFiles = Array.from(droppedFiles);
            }

            // 2. Check if an Excel file was dropped
            const excelFile = collectedFiles.find(f => /\.(xlsx|xls)$/i.test(f.name));
            if (excelFile) {
                setLogs(prev => [`📊 ພົບໄຟລ໌ Excel: ${excelFile.name} -> ເລີ່ມດຶງຮູບຕາມ Barcode (ຖັນ D)...`, ...prev]);
                await processExcelFile(excelFile);
                setIsProcessingDrop(false);
                return;
            }

            // 3. Otherwise filter image files
            const validImages = collectedFiles.filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f.name));

            if (validImages.length === 0) {
                alert('ບໍ່ພົບໄຟລ໌ຮູບພາບ ຫຼື ໄຟລ໌ Excel ໃນລາຍການທີ່ລາກເຂົ້າມາ');
                setLogs(prev => ['⚠️ ບໍ່ພົບໄຟລ໌ຮູບພາບ ຫຼື Excel', ...prev]);
                setIsProcessingDrop(false);
                return;
            }

            await onFilesLoaded(validImages, 'Drag & Drop');

        } catch (err) {
            console.error('Error handling dropped files:', err);
            setLogs(prev => [`❌ ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌: ${err.message}`, ...prev]);
        } finally {
            setIsProcessingDrop(false);
        }
    };

    const startUpload = async (overrideOverwriteMode = null) => {
        if (files.length === 0) return;
        setIsUploading(true);
        setShowDuplicateModal(false);
        abortRef.current = false;

        const effectiveMode = overrideOverwriteMode || overwriteMode;

        let completedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        let overwrittenCount = 0;

        const duplicateSet = new Set(duplicateFiles.map(d => d.name));

        // Filter files based on overwrite mode
        let filesToProcess = [...files];
        if (effectiveMode === 'skip') {
            const skippedList = files.filter(f => duplicateSet.has(f.name));
            skippedCount = skippedList.length;
            filesToProcess = files.filter(f => !duplicateSet.has(f.name));
        }

        const totalCount = filesToProcess.length;

        const updateLog = (msg) => {
            setLogs(prev => [msg, ...prev.slice(0, 49)]);
        };

        if (effectiveMode === 'overwrite') {
            updateLog(`🔄 ໂໝດຂຽນທັບ (Overwrite ON): ຮູບທີ່ມີຢູ່ແລ້ວຈະຖືກອັບເດດແທນທີ່`);
        } else if (effectiveMode === 'skip') {
            updateLog(`⏭️ ໂໝດຂ້າມຮູບຊ້ຳ (Skip ON): ຂ້າມ ${skippedCount} ຮູບທີ່ເຄີຍມີແລ້ວ`);
        }

        updateLog(`🚀 ເລີ່ມອັບໂຫຼດ ${totalCount.toLocaleString()} ຮູບ ➜ ລະບົບ Cloud Storage...`);

        const queue = [...filesToProcess];

        const uploadWorker = async () => {
            while (queue.length > 0 && !abortRef.current) {
                const file = queue.shift();
                if (!file) break;

                const fileName = file.name;
                const barcode = fileName.replace(/\.[^/.]+$/, "").trim();
                const isExisting = duplicateSet.has(fileName);

                try {
                    // Upload to Supabase Storage with upsert true
                    const { error: uploadError } = await supabase.storage
                        .from(BUCKET_NAME)
                        .upload(fileName, file, {
                            cacheControl: '3600',
                            upsert: true
                        });

                    if (uploadError) throw uploadError;

                    // Get Public URL
                    const { data: { publicUrl } } = supabase.storage
                        .from(BUCKET_NAME)
                        .getPublicUrl(fileName);

                    // Update Supabase price_checker table with image_url
                    await supabase
                        .from('price_checker')
                        .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
                        .eq('barcode', barcode);

                    completedCount++;
                    if (isExisting) {
                        overwrittenCount++;
                        updateLog(`🔄 [${completedCount}/${totalCount}] ${fileName} -> ຂຽນທັບຮູບເກົ່າສຳເລັດ`);
                    } else {
                        updateLog(`✅ [${completedCount}/${totalCount}] ${fileName} -> ອັບໂຫຼດສຳເລັດ`);
                    }
                } catch (err) {
                    console.error(`Error uploading ${fileName}:`, err);
                    failedCount++;
                    updateLog(`❌ [ຜິດພາດ] ${fileName}: ${err.message || 'Upload failed'}`);
                }

                setProgress({
                    total: totalCount + skippedCount,
                    completed: completedCount,
                    failed: failedCount,
                    skipped: skippedCount,
                    overwritten: overwrittenCount,
                    currentFile: fileName
                });
            }
        };

        // Run concurrent workers
        const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => uploadWorker());
        await Promise.all(workers);

        setIsUploading(false);
        if (!abortRef.current) {
            updateLog(`🎉 ສຳເລັດທັງໝົດ! สำเร็จ: ${completedCount} (ຂຽນທັບ: ${overwrittenCount}), ຂ້າມ: ${skippedCount}, ຜິດພາດ: ${failedCount}`);
        }
    };

    const cancelUpload = () => {
        abortRef.current = true;
        setIsUploading(false);
        setLogs(prev => ['🛑 ຍົກເລີກການອັບໂຫຼດແລ້ວ', ...prev]);
    };

    const percent = progress.total > 0 ? Math.round(((progress.completed + progress.skipped) / progress.total) * 100) : 0;
    const isCompletedAll = progress.total > 0 && (progress.completed + progress.skipped === progress.total);

    const formatBytes = (bytes, decimals = 1) => {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const totalSizeBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);

    return (
        <div
            className="fixed inset-0 z-[2000] bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-4 select-none font-lao"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`w-full max-w-2xl bg-slate-900 border transition-all duration-300 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.3)] flex flex-col max-h-[92vh] relative ${
                isDragging ? 'border-purple-400 scale-[1.01] shadow-[0_0_80px_rgba(168,85,247,0.6)]' : 'border-purple-500/40'
            }`}>

                {/* Drag Overlay Indicator */}
                {isDragging && (
                    <div className="absolute inset-0 z-50 bg-purple-950/95 backdrop-blur-md flex flex-col items-center justify-center gap-4 border-4 border-dashed border-purple-400 rounded-3xl animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                        <div className="w-20 h-20 rounded-3xl bg-purple-500/30 border-2 border-purple-300 flex items-center justify-center text-purple-200 animate-bounce">
                            <UploadCloud size={46} />
                        </div>
                        <div className="text-center">
                            <h3 className="text-2xl font-black text-white">ວາງໂຟນເດີ ຫຼື ໄຟລ໌ Excel ທີ່ນີ້</h3>
                            <p className="text-xs font-bold text-purple-300 mt-1">
                                ປ່ອຍມືເພື່ອໂຫຼດໄຟລ໌ຮູບພາບເຂົ້າລະບົບອັດຕະໂນມັດ
                            </p>
                        </div>
                    </div>
                )}

                {/* Processing Overlay */}
                {isProcessingDrop && (
                    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <RefreshCw size={36} className="text-purple-400 animate-spin" />
                        <p className="text-sm font-bold text-purple-200">ກຳລັງອ່ານ ແລະ ປະມວນຜົນໄຟລ໌...</p>
                    </div>
                )}

                {/* Modal: View All Duplicate Barcodes Modal */}
                {showDuplicateModal && duplicateFiles.length > 0 && (
                    <div className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 text-left">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                                <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-400/30">
                                    <ShieldAlert size={22} />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-sm sm:text-base font-black text-white">ລາຍການຮູບທີ່ມີຢູ່ແລ້ວໃນລະບົບ</h3>
                                    <p className="text-xs text-amber-300/80 mt-0.5">
                                        ພົບທັງໝົດ <b className="text-amber-400 font-mono text-sm">{duplicateFiles.length.toLocaleString()}</b> ຮູບທີ່ຊ້ຳກັບໃນຖານຂໍ້ມູນ
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowDuplicateModal(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <p className="text-xs text-slate-300">
                                ທ່ານສາມາດເລືອກວ່າຈະ <b>"ຂຽນທັບ"</b> ເພື່ອອັບເດດຮູບໃໝ່ ຫຼື <b>"ຂ້າມ"</b> ເພື່ອຮັກສາຮູບເກົ່າໄວ້:
                            </p>

                            {/* Duplicate Barcodes Grid */}
                            <div className="p-3 rounded-xl bg-black/60 border border-slate-800 max-h-44 overflow-y-auto custom-scrollbar">
                                <div className="flex flex-wrap gap-1.5">
                                    {duplicateFiles.map((d, i) => (
                                        <span key={i} className="px-2 py-0.5 text-[10px] font-mono font-bold bg-amber-950/60 text-amber-300 border border-amber-800/40 rounded">
                                            {d.name.replace(/\.[^/.]+$/, "")}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* Choice Buttons */}
                            <div className="grid grid-cols-2 gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverwriteMode('overwrite');
                                        setShowDuplicateModal(false);
                                    }}
                                    className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 border transition-all ${
                                        overwriteMode === 'overwrite'
                                            ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                    }`}
                                >
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                        <RefreshCw size={14} />
                                        ເລືອກ: ຂຽນທັບຮູບເກົ່າ
                                    </span>
                                    <span className="text-[10px] opacity-75 font-normal">
                                        (ອັບເດດແທນທີ່ຮູບເກົ່າ)
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setOverwriteMode('skip');
                                        setShowDuplicateModal(false);
                                    }}
                                    className={`p-3 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-1 border transition-all ${
                                        overwriteMode === 'skip'
                                            ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                                    }`}
                                >
                                    <span className="text-xs font-black flex items-center gap-1.5">
                                        <Check size={14} />
                                        ເລືອກ: ຂ້າມຮູບເກົ່າ
                                    </span>
                                    <span className="text-[10px] opacity-75 font-normal">
                                        (ອັບໂຫຼດສະເພາະຮູບໃໝ່)
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="px-5 py-4 bg-gradient-to-r from-purple-950/80 via-slate-900 to-slate-950 border-b border-purple-500/20 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
                            <UploadCloud size={22} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                ອັບໂຫຼດຮູບພາບສິນຄ້າ (Bulk Image Uploader)
                            </h2>
                            <p className="text-[11px] text-purple-300/70">
                                ອັບໂຫຼດຮູບຂຶ້ນສາງຮູບສິນຄ້າອອນລາຍ
                            </p>
                        </div>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            disabled={isUploading}
                            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                            title="ປິດໜ້າຕ່າງ"
                        >
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Content (Scrollable) */}
                <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">

                    {/* Rule Warning & Hint Banner */}
                    <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-left">
                        <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-[11px] text-amber-200/90 leading-relaxed">
                            <span className="font-bold text-amber-300">ຄຳແນະນຳການຕັ້ງຊື່ໄຟລ໌ຮູບ: </span>
                            ຊື່ໄຟລ໌ຮູບຕ້ອງເປັນ <b>"ຕົວເລກບາໂຄ້ດ"</b> ເທົ່ານັ້ນ (ເຊັ່ນ: <span className="font-mono bg-black/40 px-1 py-0.5 rounded text-amber-200">1261300700284.jpg</span>) ຫ້າມມີຍະຫວ່າງ ຫຼື ວົງເລັບ ເພື່ອໃຫ້ລະບົບຈັບຄູ່ກັບສິນຄ້າໄດ້ຖືກຕ້ອງ.
                        </div>
                    </div>

                    {/* Upload Cards (Folder or Excel) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Folder Picker Card */}
                        <button
                            type="button"
                            disabled={isUploading}
                            className="p-5 rounded-2xl bg-purple-950/20 border-2 border-dashed border-purple-500/40 hover:border-purple-400 hover:bg-purple-950/30 flex flex-col items-center justify-center text-center gap-2.5 transition-all cursor-pointer group disabled:opacity-40 disabled:pointer-events-none"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                webkitdirectory="true"
                                directory="true"
                                multiple
                                onChange={handleFolderSelect}
                                className="hidden"
                            />
                            <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 group-hover:scale-110 transition-transform">
                                <FolderOpen size={26} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">ກົດເລືອກ ຫຼື ລາກໂຟນເດີຮູບ</h3>
                                <p className="text-[11px] text-purple-200/60 mt-0.5">
                                    ອ່ານຮູບທັງໝົດໃນ Folder ໂດຍອັດຕະໂນມັດ
                                </p>
                            </div>
                            <span className="mt-1 px-4 py-1.5 rounded-lg bg-purple-600/70 group-hover:bg-purple-600 text-white font-bold text-[11px] transition-colors">
                                ເລືອກໂຟນເດີ (Select Folder)
                            </span>
                        </button>

                        {/* Excel File Picker Card */}
                        <button
                            type="button"
                            disabled={isUploading}
                            className="p-5 rounded-2xl bg-emerald-950/20 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 hover:bg-emerald-950/30 flex flex-col items-center justify-center text-center gap-2.5 transition-all cursor-pointer group disabled:opacity-40 disabled:pointer-events-none"
                            onClick={() => excelInputRef.current?.click()}
                        >
                            <input
                                ref={excelInputRef}
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleExcelSelect}
                                className="hidden"
                            />
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={26} />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white">ກົດເລືອກ ຫຼື ລາກໄຟລ໌ Excel</h3>
                                <p className="text-[11px] text-emerald-200/60 mt-0.5">
                                    ໄຟລ໌ Odoo/Joah (ຖັນ D = Barcode, ຖັນ B = ຮູບ)
                                </p>
                            </div>
                            <span className="mt-1 px-4 py-1.5 rounded-lg bg-emerald-600/70 group-hover:bg-emerald-600 text-white font-bold text-[11px] transition-colors">
                                ເລືອກໄຟລ໌ Excel (.xlsx)
                            </span>
                        </button>
                    </div>

                    {/* Duplicate Status & Quick Mode Switcher */}
                    {files.length > 0 && !isUploading && (
                        <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-left">
                                {isCheckingDuplicates ? (
                                    <>
                                        <RefreshCw size={15} className="text-purple-400 animate-spin shrink-0" />
                                        <span className="text-xs text-purple-300">ກຳລັງກວດສອບຮູບຊ້ຳໃນລະບົບ...</span>
                                    </>
                                ) : duplicateFiles.length > 0 ? (
                                    <>
                                        <ShieldAlert size={16} className="text-amber-400 shrink-0" />
                                        <div className="text-xs text-slate-300">
                                            ພົບຮູບຊ້ຳ <b className="text-amber-400 font-mono font-bold">{duplicateFiles.length.toLocaleString()}</b> ຮູບ
                                            <button
                                                type="button"
                                                onClick={() => setShowDuplicateModal(true)}
                                                className="ml-2 text-[10px] text-amber-300 underline hover:text-amber-200 font-bold"
                                            >
                                                (ກົດເບິ່ງລາຍການ)
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                                        <span className="text-xs text-emerald-400 font-bold">
                                            ທັງໝົດ {files.length.toLocaleString()} ຮູບເປັນຮູບໃໝ່ ບໍ່ມີຊ້ຳ
                                        </span>
                                    </>
                                )}
                            </div>

                            {/* Mode Toggle Pills (Directly on main screen) */}
                            {duplicateFiles.length > 0 && !isCheckingDuplicates && (
                                <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-slate-800 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setOverwriteMode('skip')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            overwriteMode === 'skip'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ✓ ຂ້າມຮູບເກົ່າ (Skip)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOverwriteMode('overwrite')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                            overwriteMode === 'overwrite'
                                                ? 'bg-purple-600 text-white shadow-xs'
                                                : 'text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        ↻ ຂຽນທັບ (Overwrite)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Preview Section */}
                    {files.length > 0 && (
                        <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                                    <ImageIcon size={14} className="text-purple-400" />
                                    ຕົວຢ່າງຮູບທີ່ເລືອກ ({files.length.toLocaleString()} ຮູບ · {formatBytes(totalSizeBytes)})
                                </span>
                                {files.length > 30 && (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        ສະແດງ 30 ຮູບທຳອິດ
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto custom-scrollbar p-1.5 bg-black/50 rounded-xl">
                                {files.slice(0, 30).map((file, idx) => {
                                    const barcode = file.name.replace(/\.[^/.]+$/, "");
                                    const isDupe = duplicateFiles.some(d => d.name === file.name);
                                    const objUrl = URL.createObjectURL(file);
                                    return (
                                        <div key={idx} className="flex flex-col items-center gap-1 group relative">
                                            <div className={`w-14 h-14 rounded-xl bg-black border overflow-hidden flex items-center justify-center relative ${
                                                isDupe ? 'border-amber-500/70 shadow-[0_0_8px_rgba(245,158,11,0.25)]' : 'border-slate-800'
                                            }`}>
                                                <img
                                                    src={objUrl}
                                                    alt={barcode}
                                                    className="w-full h-full object-cover"
                                                    onLoad={() => URL.revokeObjectURL(objUrl)}
                                                />
                                                {isDupe && (
                                                    <div className="absolute top-0.5 right-0.5 px-1 py-0.2 bg-amber-500 text-slate-950 font-black text-[7px] rounded uppercase shadow-xs">
                                                        ຊ້ຳ
                                                    </div>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-mono font-bold truncate w-full text-center px-1 rounded ${
                                                isDupe ? 'text-amber-300' : 'text-slate-300'
                                            }`} title={barcode}>
                                                {barcode}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Progress Stats Bar */}
                    {(isUploading || progress.total > 0) && (
                        <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-950/90 border border-purple-500/30">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-bold text-purple-200 flex items-center gap-1.5">
                                    <Layers size={13} className="text-purple-400" />
                                    ຄວາມຄືບໜ້າ (Progress)
                                </span>
                                <span className="font-mono font-black text-purple-300 text-xs sm:text-sm">
                                    {percent}% ({progress.completed.toLocaleString()} / {progress.total.toLocaleString()})
                                    {progress.skipped > 0 && <span className="text-slate-400 text-xs ml-1.5 font-normal">(ຂ້າມ {progress.skipped})</span>}
                                    {progress.overwritten > 0 && <span className="text-amber-400 text-xs ml-1.5 font-normal">(ຂຽນທັບ {progress.overwritten})</span>}
                                    {progress.failed > 0 && <span className="text-rose-400 text-xs ml-1.5 font-normal">(ຜິດພາດ {progress.failed})</span>}
                                </span>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-purple-500/30 relative">
                                <div
                                    className={`h-full rounded-full transition-all duration-300 ${
                                        isCompletedAll
                                            ? 'bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]'
                                            : 'bg-gradient-to-r from-purple-600 to-indigo-500 shadow-[0_0_12px_rgba(168,85,247,0.7)]'
                                    }`}
                                    style={{ width: `${percent}%` }}
                                />
                            </div>

                            {progress.currentFile && !isCompletedAll && (
                                <p className="text-[11px] font-mono text-purple-300/70 truncate text-left">
                                    ກຳລັງອັບໂຫຼດ: <span className="text-white font-semibold">{progress.currentFile}</span>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Real-time Logs Console */}
                    {logs.length > 0 && (
                        <div className="space-y-1 text-left">
                            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono tracking-wider">
                                ບັນທຶກການເຮັດວຽກ (Activity Log)
                            </span>
                            <div className="p-2.5 rounded-xl bg-black/80 border border-slate-800 h-28 overflow-y-auto font-mono text-[10px] space-y-1 text-slate-300 custom-scrollbar">
                                {logs.map((log, idx) => (
                                    <div key={idx} className="truncate">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Sticky Action Footer (Always Visible at bottom!) */}
                <div className="px-5 py-3.5 bg-slate-950 border-t border-purple-500/20 flex items-center justify-between gap-3 shrink-0">
                    {/* Left: Clear / Reset Button */}
                    <div>
                        {files.length > 0 && !isUploading && (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="px-3.5 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                                title="ລ້າງລາຍການຮູບອອກທັງໝົດເພື່ອເລີ່ມໃໝ່"
                            >
                                <Trash2 size={14} />
                                ລ້າງຮູບ (Clear)
                            </button>
                        )}
                    </div>

                    {/* Right: Main Action Buttons */}
                    <div className="flex items-center gap-2">
                        {isUploading ? (
                            <button
                                type="button"
                                onClick={cancelUpload}
                                className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(244,63,94,0.4)] flex items-center gap-2"
                            >
                                <StopCircle size={15} />
                                ຍົກເລີກການອັບໂຫຼດ (Cancel)
                            </button>
                        ) : isCompletedAll ? (
                            <button
                                type="button"
                                onClick={handleClearAll}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-[0_0_15px_rgba(16,185,129,0.4)] flex items-center gap-2"
                            >
                                <CheckCircle2 size={15} />
                                ສຳເລັດແລ້ວ · ອັບໂຫຼດຊຸດໃໝ່
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => startUpload()}
                                disabled={files.length === 0 || isCheckingDuplicates}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-2"
                            >
                                <Play size={15} />
                                {files.length > 0
                                    ? `ເລີ່ມອັບໂຫຼດ ${files.length.toLocaleString()} ຮູບ`
                                    : 'ກະລຸນາເລືອກຮູບກ່ອນ'}
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ImageBulkUploader;