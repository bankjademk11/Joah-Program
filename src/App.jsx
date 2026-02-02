import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import SheetMapper from './components/SheetMapper';
import Dashboard from './components/Dashboard';
import ResultTable from './components/ResultTable';
import Navbar from './components/Navbar';
import {
  readExcelFile,
  readExcelFromUrl,
  getSheetNames,
  sheetToJSON,
  validateData,
  suggestSheetMapping
} from './utils/excelProcessor';
import { supabase } from './utils/supabaseClient';
import { fetchMasterFromSupabase, syncMasterDataToSupabase, fetchLocationFromSupabase, fetchOdooFromSupabase } from './utils/supabaseSync';
import HistoryLog from './components/HistoryLog';
import { RefreshCw, Database, UploadCloud, LayoutDashboard, Database as DBIcon, Play, Moon, Sun, X, RotateCw, Sparkles, ShieldCheck, History, Trash2 } from 'lucide-react';
import joahLogo from './assets/Joah.jpeg';
import databaseUrl from './assets/DataBaseJoah.xlsx';

import Login from './components/Login';
import OdooMonitor from './components/OdooMonitor';
import StoreRequest from './components/StoreRequest';
import StoreRequestManager from './components/StoreRequestManager';
import { ToastProvider, useToast } from './components/ToastProvider';


function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState(null);

  const [step, setStep] = useState('upload');
  const [workbook, setWorkbook] = useState(null);
  const [rawFile, setRawFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [locationSheetName, setLocationSheetName] = useState('');
  const [suggestions, setSuggestions] = useState({});
  const [validationResults, setValidationResults] = useState([]);
  const [masterData, setMasterData] = useState([]);
  const [stats, setStats] = useState({ total: 0, passed: 0, mismatch: 0, missing: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dbSource, setDbSource] = useState('excel');
  const [dataSourceLabel, setDataSourceLabel] = useState('Local Mode (Excel)');
  const [loadedFileName, setLoadedFileName] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [showHistory, setShowHistory] = useState(false);
  const [showStoreRequestManager, setShowStoreRequestManager] = useState(false);
  const [preFilledBarcode, setPreFilledBarcode] = useState(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);



  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleLogin = (userInfo) => {
    setUser(userInfo);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    setStep('upload');
    setPreFilledBarcode(null);
  };

  const handleGotoProductManager = (barcode) => {
    setPreFilledBarcode(barcode);
    setStep('product-manager');
  };

  const handleFileSelect = async (file) => {
    setIsProcessing(true);
    setRawFile(file);
    try {
      const wb = await readExcelFile(file);
      processWorkbook(wb);
    } catch (error) {
      alert('ເກີດຂໍ້ຜິດພາດໃນການອ່ານໄຟລ໌: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processWorkbook = (wb) => {
    const names = getSheetNames(wb);
    const suggested = suggestSheetMapping(names);
    setWorkbook(wb);
    setSheetNames(names);
    setSuggestions(suggested);
    if (suggested.location) setLocationSheetName(suggested.location);
    setStep('mapping');
  };

  const handleDatabaseLoad = async () => {
    setIsProcessing(true);
    try {
      // Check for both Master Data and Location Counting data
      const [cloudMaster, cloudLocation] = await Promise.all([
        fetchMasterFromSupabase(),
        fetchLocationFromSupabase()
      ]);

      if ((cloudMaster && cloudMaster.length > 0) || (cloudLocation && cloudLocation.length > 0)) {
        setDbSource('supabase');
        setDataSourceLabel('Cloud Mode (Supabase)');
        await handleValidate({
          locationSheet: 'Cloud Database',
          pSource: 'supabase'
        });
        return;
      } else {
        setDbSource('excel');
        setDataSourceLabel('Pre-built Mode (Local Assets)');

        const isError = cloudMaster === null || cloudLocation === null;
        if (isError) {
          alert('❌ ບໍ່ສາມາດເຊື່ອມຕໍ່ກັບ Cloud ໄດ້. ກະລຸນາກວດສອບ Internet ຫຼື Supabase Connection.');
        } else {
          alert('ℹ️ ຍັງບໍ່ມີຂໍ້ມູນໃນ Cloud (ທັງ Master ແລະ Inventory). ກະລຸນາ Sync ຂໍ້ມູນກ່อน หรือ ใช้ข้อมูลจากไฟล์ส่วนตัวแทน.');
        }
      }

      const wb = await readExcelFromUrl(databaseUrl);
      const names = getSheetNames(wb);
      const suggested = suggestSheetMapping(names);
      setRawFile(new File([], "DataBaseJoah.xlsx"));
      setLoadedFileName('DataBaseJoah.xlsx');
      setWorkbook(wb);
      setSheetNames(names);
      setSuggestions(suggested);
      if (suggested.location) setLocationSheetName(suggested.location);
      setStep('mapping');
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidate = async ({ locationSheet, dataSheet, pSource }) => {
    setIsProcessing(true);
    const activeSource = pSource || dbSource;
    setLocationSheetName(locationSheet || 'Cloud Database');
    try {
      let dataRows = [];
      let locationRows = [];
      let odooRows = [];

      if (activeSource === 'supabase') {
        const [cloudMaster, cloudLocation, cloudOdoo] = await Promise.all([
          fetchMasterFromSupabase(),
          fetchLocationFromSupabase(),
          fetchOdooFromSupabase()
        ]);

        if (!cloudMaster || cloudMaster.length === 0) {
          console.warn("ບໍ່ພົບຂໍ້ມູນ Master Data ໃນ Cloud.");
        }

        dataRows = (cloudMaster || []).map(d => ({
          'CATEGORIES 1': d.category_1,
          'CATEGORIES 2': d.category_2,
          'Barcode': d.barcode,
          'product_name_la': d.product_name_la,
          'item_name': d.item_name,
          'Item Name': d.product_name_la || d.item_name,
          'Qty': d.qty,
          'updated_at': d.updated_at,
          'updated_by': d.updated_by
        }));

        locationRows = (cloudLocation || []).map(l => ({
          id: l.id,
          'Barcode': l.barcode_no,
          'Rack Location': l.rack_location,
          'Category-1': l.category_1_actual,
          'Category-2': l.category_2_actual,
          'QTY': l.qty,
          'Item Name': l.item_name,
          'uploaded_by': l.uploaded_by,
          'created_at': l.created_at
        }));

        odooRows = (cloudOdoo || []).map(o => ({
          barcode: o.barcode,
          qty: o.qty_odoo
        }));

      } else {
        if (!workbook) throw new Error("ກະລຸນາເລືອກໄຟລ໌ Excel ກ່ອນ.");
        dataRows = sheetToJSON(workbook, dataSheet || 'DATA');
        locationRows = sheetToJSON(workbook, locationSheet);
        // Local mode doesn't support Odoo file yet, or we assume Odoo upload via the new button goes to Supabase only.
        // If user is in Excel mode but uploaded Odoo via the specific button, it went to Supabase.
        // For simplicity, let's try to fetch Odoo from Supabase even in Excel mode if available? 
        // User asked for "Comparison from Odoo".
        // Let's assume Odoo data is always in Supabase for now as per the added feature.
        const cloudOdoo = await fetchOdooFromSupabase();
        odooRows = (cloudOdoo || []).map(o => ({
          barcode: o.barcode,
          qty: o.qty_odoo
        }));
      }

      const { results, stats } = validateData(locationRows, dataRows, odooRows);
      setValidationResults(results);
      setMasterData(dataRows);
      setStats(stats);
      setStep('results');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateResultRowQty = (rowIndex, newData) => {
    setValidationResults(prev => prev.map(row => row.rowIndex === rowIndex ? { ...row, ...newData } : row));
  };

  const handleSyncToCloud = async () => {
    if (!workbook) return;
    setIsProcessing(true);
    try {
      const dataRows = sheetToJSON(workbook, 'DATA');
      const result = await syncMasterDataToSupabase(dataRows);
      if (result.success) alert(`✅ Synced ${result.synced} items to Cloud!`);
      else alert('❌ Sync Failed: ' + result.error);
    } catch (e) {
      alert('Error: ' + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col transition-colors duration-500 bg-dots">
        {/* Navigation */}
        <Navbar
          step={step}
          dbSource={dbSource}
          dataSourceLabel={dataSourceLabel}
          isDarkMode={isDarkMode}
          setIsDarkMode={setIsDarkMode}
          isProcessing={isProcessing}
          onRefresh={() => handleValidate({ locationSheet: locationSheetName })}
          onShowHistory={() => setShowHistory(true)}
          onReset={() => window.location.reload()}
          currentUser={user}
          onOpenRequests={() => setShowStoreRequestManager(true)}
        />

        {/* Main Content */}
        <main className="flex-1 flex flex-col px-4 md:px-8 py-8 items-center justify-center">
          {step === 'upload' && (
            <div className="max-w-5xl w-full animate-fade-in-up flex flex-col items-center">
              <div className="text-center mb-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-joah-orange border border-orange-100 dark:border-orange-500/20 mb-6">
                  <Sparkles size={14} className="animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Inventory Excellence</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
                  ກວດສອບຄວາມຖືກຕ້ອງ <br /><span className="text-joah-orange">ສິນຄ້າໃນສາງ</span>
                </h1>
                <p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  ລະບົບກວດສອບຂໍ້ມູນสິນค้าອັດຕະໂນມັດ ປຽບທຽບລະຫວ່າງໜ້າວຽກຈິງ ແລະ ຖານຂໍ້ມູນກາງ ເພື່ອຄວາມສະດວກ
                </p>

                {/* Admin Toggle Button */}
                <div className="mt-8">
                  <button
                    onClick={() => setShowAdminMenu(!showAdminMenu)}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider transition-all duration-300 ${showAdminMenu
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg shadow-rose-500/30'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                  >
                    <ShieldCheck size={18} />
                    <span>{showAdminMenu ? 'ປິດເມນູ Admin' : 'Admin - Showing All'}</span>
                  </button>
                </div>
              </div>

              <div className={`grid gap-8 w-full transition-all duration-500 ${showAdminMenu ? 'md:grid-cols-2 lg:grid-cols-4 max-w-7xl' : 'justify-center'
                }`}>
                {/* Always show: File Upload (only if admin) */}
                {showAdminMenu && <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />}

                {/* Always show: Cloud Database */}
                <div className={`glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-joah-orange hover:shadow-orange-500/10 transition-all duration-500 ${!showAdminMenu ? 'max-w-md mx-auto' : ''
                  }`}>
                  <div className="w-16 h-16 rounded-3xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center text-joah-orange group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                    <DBIcon size={32} strokeWidth={2.5} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ໃຊ້ຖານຂໍ້ມູນຫຼັກ</h3>
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Cloud Record Database</p>
                  </div>
                  <button
                    onClick={handleDatabaseLoad}
                    disabled={isProcessing}
                    className="w-full btn-primary mt-2 group py-4"
                  >
                    {isProcessing ? <RefreshCw className="animate-spin" /> : <Database size={18} />}
                    <span>ສືບຕໍ່ດ້ວຍ Cloud Database</span>
                  </button>
                </div>

                {/* Store Request Card */}
                {!showAdminMenu && (
                  <div className="glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-blue-500 hover:shadow-blue-500/10 transition-all duration-500 max-w-md mx-auto">
                    <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                      <ShieldCheck size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ຂໍສິນຄ້າຈາກສາງ</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Store Request System</p>
                    </div>
                    <button
                      onClick={() => setStep('store-request')}
                      className="w-full btn-primary mt-2 group py-4 bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                    >
                      <Play size={18} />
                      <span>ເຂົ້າສູ່ໜ້າຮ້ານ</span>
                    </button>
                  </div>
                )}

                {/* Admin only: Product Management */}
                {showAdminMenu && (
                  <div className="glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-emerald-500 hover:shadow-emerald-500/10 transition-all duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                      <LayoutDashboard size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ຈັດການສິນຄ້າ</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Product Management</p>
                    </div>
                    <button
                      onClick={() => setStep('product-manager')}
                      className="w-full btn-primary mt-2 group py-4 bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/30"
                    >
                      <LayoutDashboard size={18} />
                      <span>ເພີ່ມ/ແກ້ໄຂສິນຄ້າ</span>
                    </button>
                  </div>
                )}

                {/* Admin only: Master Data Audit */}
                {showAdminMenu && (
                  <div className="glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-sky-500 hover:shadow-sky-500/10 transition-all duration-500">
                    <div className="w-16 h-16 rounded-3xl bg-sky-50 dark:bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                      <Database size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດສອບຖານຂໍ້ມູນ</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Master Data Audit</p>
                    </div>
                    <button
                      onClick={() => setStep('master-audit')}
                      className="w-full btn-primary mt-2 group py-4 bg-sky-600 hover:bg-sky-700 shadow-sky-500/30"
                    >
                      <Database size={18} />
                      <span>ກວດສອບ Master Data</span>
                    </button>
                  </div>
                )}

                {/* Admin only: Odoo Sync Card */}
                {showAdminMenu && (
                  <div className="glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-purple-500 hover:shadow-purple-500/10 transition-all duration-500 relative">
                    <div className="w-16 h-16 rounded-3xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">
                      <RotateCw size={32} strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">Odoo Stock Sync</h3>
                      <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Manage ERP Data</p>
                    </div>

                    <button
                      onClick={() => setStep('odoo-monitor')}
                      disabled={isProcessing}
                      className="w-full btn-primary mt-2 group py-4 bg-purple-600 hover:bg-purple-700 shadow-purple-500/30"
                    >
                      <LayoutDashboard size={18} />
                      <span>Open Monitor</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="max-w-md w-full animate-fade-in-up">
              <div className="glass-card rounded-[2.5rem] shadow-2xl p-10 border-white/50">
                <div className="flex items-center justify-between mb-8 pb-8 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">ກວດສອບຂໍ້ມູນ</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Configuration</p>
                  </div>
                  {dbSource === 'excel' && (
                    <button onClick={handleSyncToCloud} disabled={isProcessing} className="flex flex-col items-center gap-1 group">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-400 flex items-center justify-center group-hover:bg-joah-orange group-hover:text-white transition-all duration-300 shadow-sm">
                        {isProcessing ? <RefreshCw className="animate-spin" width={18} /> : <CloudUpload width={18} />}
                      </div>
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Sync Cloud</span>
                    </button>
                  )}
                </div>
                <SheetMapper sheetNames={sheetNames} suggestions={suggestions} onConfirm={handleValidate} />
              </div>
            </div>
          )}

          {step === 'odoo-monitor' && (
            <OdooMonitor onBack={() => setStep('upload')} />
          )}

          {step === 'store-request' && (
            <StoreRequest onBack={() => setStep('upload')} currentUser={user} />
          )}


          {step === 'product-manager' && (
            <ProductManager
              onBack={() => { setStep('upload'); setPreFilledBarcode(null); }}
              currentUser={user}
              initialBarcode={preFilledBarcode}
            />
          )}

          {step === 'master-audit' && (
            <MasterAudit onBack={() => setStep('upload')} currentUser={user} />
          )}

          {step === 'results' && (
            <div className="w-full h-full space-y-8 animate-fade-in-up">
              <Dashboard stats={stats} activeFilter={filterStatus} onFilterChange={setFilterStatus} />
              <ResultTable
                results={validationResults}
                masterData={masterData}
                rawFile={rawFile}
                locationSheetName={locationSheetName}
                filterStatus={filterStatus}
                onFilterChange={setFilterStatus}
                dbSource={dbSource}
                onRefresh={() => handleValidate({ locationSheet: locationSheetName })}
                onUpdateRowQty={handleUpdateResultRowQty}
                currentUser={user}
                onAddNewProduct={handleGotoProductManager}
              />
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="py-6 px-8 text-center bg-white/30 dark:bg-slate-900/30 backdrop-blur-md">
          <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-[0.4em]">Built with ❤️ by JOAH Team Santisouk Laxayphone</p>
        </footer>

        {/* History Modal */}
        {showHistory && <HistoryLog onClose={() => setShowHistory(false)} />}

        {/* Store Request Manager Modal */}
        {showStoreRequestManager && (
          <StoreRequestManager
            onClose={() => setShowStoreRequestManager(false)}
            currentUser={user}
          />
        )}
      </div>
    </ToastProvider>
  );
}

export default App;
