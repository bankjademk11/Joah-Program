import React, { useState, useRef } from 'react';
import { 
    UploadCloud, FolderOpen, CheckCircle2, AlertCircle, RefreshCw, 
    X, Image as ImageIcon, Layers, FileCheck, ArrowRight, Play, Pause, Database
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
                            <h3 className="text-base font-bold text-white">ເລືອກໂຟນເດີຮູບພາບໃນເຄື່ອງ</h3>
                            <p className="text-xs text-purple-200/60 mt-0.5">
                                ເລືອກ Folder ທີ່ມີຮູບ (10,000+ ຮູບ) ລະບົບຈະອ່ານໄຟລ໌ທັງໝົດອັດຕະໂນມັດ
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="mt-2 px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition-all shadow-[0_0_20px_rgba(168,85,247,0.4)] disabled:opacity-50 flex items-center gap-2"
                        >
                            <FolderOpen size={16} />
                            ເລືອກ Folder (Select Folder)
                        </button>
                    </div>

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
