import React, { useState, useEffect } from 'react';
import { ArrowLeft, Upload, Trash2, Clock, Database, RefreshCw, FileSpreadsheet, CheckCircle, AlertTriangle } from 'lucide-react';
import { readExcelFile, sheetToJSON, getSheetNames } from '../../../utils/excelProcessor';
import { syncOdooToSupabase, clearOdooData, fetchOdooFromSupabase } from '../../../utils/supabaseSync';
import { supabase } from '../../../utils/supabaseClient';

const OdooMonitor = ({ onBack }) => {
    const [stats, setStats] = useState({
        totalItems: 0,
        lastUpdated: null,
        syncStatus: 'unknown' // 'synced', 'empty', 'error'
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    const fetchOdooStats = async () => {
        setIsLoading(true);
        try {
            // Get count
            const { count, error: countError } = await supabase
                .from('odoo_stocks')
                .select('*', { count: 'exact', head: true });

            if (countError) throw countError;

            // Get latest update time
            const { data: latest, error: timeError } = await supabase
                .from('odoo_stocks')
                .select('updated_at')
                .limit(1)
                .order('updated_at', { ascending: false });

            if (timeError) throw timeError;

            setStats({
                totalItems: count || 0,
                lastUpdated: latest && latest.length > 0 ? latest[0].updated_at : null,
                syncStatus: count > 0 ? 'synced' : 'empty'
            });
        } catch (error) {
            console.error('Error fetching Odoo stats:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchOdooStats();
    }, []);

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsProcessing(true);
        setUploadProgress(10);
        try {
            const wb = await readExcelFile(file);
            setUploadProgress(30);

            const sheets = getSheetNames(wb);
            if (sheets.length === 0) throw new Error('No sheets found');

            const data = sheetToJSON(wb, sheets[0]); // Assume first sheet
            setUploadProgress(50);

            const result = await syncOdooToSupabase(data);
            setUploadProgress(100);

            if (result.success) {
                alert(`✅ Successfully synced ${result.synced} records!`);
                fetchOdooStats();
            } else {
                throw new Error(result.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsProcessing(false);
            setUploadProgress(0);
            e.target.value = ''; // Reset input
        }
    };

    const handleClearData = async () => {
        if (!confirm('⚠️ Are you sure you want to DELETE ALL Odoo data? This action cannot be undone.')) return;

        setIsProcessing(true);
        try {
            const res = await clearOdooData();
            if (res.success) {
                alert('✅ Odoo data cleared successfully.');
                fetchOdooStats();
            } else {
                throw new Error(res.error);
            }
        } catch (err) {
            alert('Error: ' + err.message);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-5xl mx-auto p-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="p-3 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 transition-colors shadow-sm border border-slate-100 dark:border-slate-700"
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Odoo Stock Monitor</h1>
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Manage & Sync ERP Data</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Stats Card 1: Status */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Database size={80} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Sync Status</p>
                        <div className={`text-2xl font-black flex items-center gap-2 ${stats.totalItems > 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {stats.totalItems > 0 ? (
                                <>
                                    <CheckCircle size={24} />
                                    <span>Active</span>
                                </>
                            ) : (
                                <>
                                    <AlertTriangle size={24} />
                                    <span>No Data</span>
                                </>
                            )}
                        </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <p className="text-xs font-bold text-slate-500">
                            {stats.totalItems > 0 ? 'Ready for comparison' : 'Please upload file'}
                        </p>
                    </div>
                </div>

                {/* Stats Card 2: Total Items */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <FileSpreadsheet size={80} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Total SKU Records</p>
                        <h2 className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter">
                            {isLoading ? '...' : stats.totalItems.toLocaleString()}
                        </h2>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <p className="text-xs font-bold text-slate-500">Unique barcodes in system</p>
                    </div>
                </div>

                {/* Stats Card 3: Last Sync */}
                <div className="glass-card p-6 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:shadow-lg transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Clock size={80} />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Last Updated</p>
                        <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight leading-tight">
                            {isLoading ? '...' : stats.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('lo-LA') : 'Never'}
                        </h2>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800/50">
                        <p className="text-xs font-bold text-slate-500">Server time (UTC+7)</p>
                    </div>
                </div>
            </div>

            {/* Actions Area */}
            <div className="glass-card p-8 rounded-[2.5rem] border-purple-500/20 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent pointer-events-none" />

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                    <div className="flex-1 space-y-2 text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 mb-2">
                            <RefreshCw size={12} className={isProcessing ? "animate-spin" : ""} />
                            <span className="text-[10px] font-black uppercase tracking-widest">Zone Update</span>
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 dark:text-white">Update Odoo Database</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">
                            Upload your latest Odoo stock export (.xlsx) here. The system will automatically replace previous data with the new set.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                        <input
                            type="file"
                            accept=".xlsx"
                            id="odoo-upload-page"
                            className="hidden"
                            onChange={handleFileUpload}
                            disabled={isProcessing}
                        />

                        <button
                            onClick={() => document.getElementById('odoo-upload-page').click()}
                            disabled={isProcessing}
                            className="btn-primary py-4 px-8 bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/30 min-w-[200px]"
                        >
                            {isProcessing ? (
                                <div className="flex items-center gap-2">
                                    <RefreshCw className="animate-spin" size={20} />
                                    <span>Processing {uploadProgress}%</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <Upload size={20} />
                                    <span>Upload New File</span>
                                </div>
                            )}
                        </button>

                        <button
                            onClick={handleClearData}
                            disabled={isProcessing || stats.totalItems === 0}
                            className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-900/10 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/20 border-2 border-transparent hover:border-rose-200 dark:hover:border-rose-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Clear All Data"
                        >
                            <Trash2 size={24} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OdooMonitor;
