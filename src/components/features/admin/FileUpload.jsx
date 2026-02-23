import { useState } from 'react';
import { Upload, FileSpreadsheet, Check } from 'lucide-react';

const FileUpload = ({ onFileSelect, isProcessing }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [fileName, setFileName] = useState('');

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files[0];
        handleFile(file);
    };

    const handleFile = (file) => {
        if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.csv'))) {
            setFileName(file.name);
            onFileSelect(file);
        } else {
            alert('ກະລຸນາເລືອກໄຟລ໌ Excel (.xlsx) ເທົ່ານັ້ນ');
        }
    };

    return (
        <div
            className={`relative p-6 rounded-[1.5rem] border-2 border-dashed transition-all duration-500 flex flex-col items-center justify-center text-center gap-4 group cursor-pointer transition-colors
                ${isDragging ? 'border-joah-orange bg-orange-50 dark:bg-orange-900/20 scale-[1.02]' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:border-joah-orange/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isProcessing && document.getElementById('file-input').click()}
            style={{ cursor: isProcessing ? 'wait' : 'pointer' }}
        >
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 transform group-hover:scale-110 group-hover:-rotate-3
                ${fileName ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/30 group-hover:text-joah-orange'}`}>
                {fileName ? <Check size={28} /> : <FileSpreadsheet size={28} />}
            </div>

            <div className="space-y-1">
                <h3 className="text-xl font-black text-slate-800 dark:text-white tracking-tight transition-colors">
                    {fileName || 'ເລືອກໄຟລ໌ໜ້າວຽກ'}
                </h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 max-w-[200px] leading-relaxed font-bold uppercase tracking-widest leading-none transition-colors">
                    {fileName ? `File: ${fileName}` : 'XLSX / CSV File'}
                </p>
            </div>

            <input
                id="file-input"
                type="file"
                accept=".xlsx,.csv"
                onChange={(e) => handleFile(e.target.files[0])}
                className="hidden"
                disabled={isProcessing}
            />

            {!fileName && (
                <div className="mt-1 px-5 py-2 bg-slate-900 dark:bg-joah-orange text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-xl shadow-md group-hover:bg-joah-orange dark:group-hover:bg-orange-600 transition-all duration-300">
                    Upload File
                </div>
            )}

            {isProcessing && (
                <div className="absolute inset-0 bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-[1.5rem] flex items-center justify-center transition-colors">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-4 border-joah-orange border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest transition-colors">Processing...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FileUpload;
