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
import { fetchMasterFromSupabase, syncMasterDataToSupabase, fetchLocationFromSupabase } from './utils/supabaseSync';
import HistoryLog from './components/HistoryLog';
import { RefreshCw, Database, CloudUpload, LayoutDashboard, Database as DBIcon, Play, Moon, Sun, X, RotateCw, Sparkles, ShieldCheck, History } from 'lucide-react';
import joahLogo from './assets/Joah.jpeg';
import databaseUrl from './assets/DataBaseJoah.xlsx';

function App() {
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

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
      const cloudMaster = await fetchMasterFromSupabase();
      if (cloudMaster && cloudMaster.length > 0) {
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
        alert('ℹ️ ຍັງບໍ່ມີຂໍ້ມູນໃນ Cloud. ລະບົບຈະໂຫຼດຂໍ້ມູນຕົວຢ່າງຈາກໄຟລ໌ພາຍໃນແທน.');
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

      if (activeSource === 'supabase') {
        const cloudMaster = await fetchMasterFromSupabase();
        if (!cloudMaster || cloudMaster.length === 0) {
          throw new Error("ບໍ່ພົບຂໍ້ມູນ Master Data ໃນ Cloud.");
        }
        dataRows = cloudMaster.map(d => ({
          'CATEGORIES 1': d.category_1, 'CATEGORIES 2': d.category_2, 'Barcode': d.barcode,
          'Item Name': d.item_name, 'Qty': d.qty, 'updated_at': d.updated_at, 'updated_by': d.updated_by
        }));
        const cloudLocation = await fetchLocationFromSupabase();
        if (!cloudLocation || cloudLocation.length === 0) {
          throw new Error("ບໍ່ພົບຂໍ້ມູນ Location Inventory.");
        }
        locationRows = cloudLocation.map(l => ({
          id: l.id, 'Barcode': l.barcode_no, 'Rack Location': l.rack_location,
          'Category-1': l.category_1_actual, 'Category-2': l.category_2_actual,
          'QTY': l.qty, 'Item Name': l.item_name
        }));
      } else {
        if (!workbook) throw new Error("ກະລຸນາເລືອກໄຟລ໌ Excel ກ່ອນ.");
        dataRows = sheetToJSON(workbook, dataSheet || 'DATA');
        locationRows = sheetToJSON(workbook, locationSheet);
      }

      const { results, stats } = validateData(locationRows, dataRows);
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

  return (
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
                ລະບົບກວດສອບຂໍ້ມູນສິນຄ້າອັດຕະໂນມັດ ປຽບທຽບລະຫວ່າງໜ້າວຽກຈິງ ແລະ ຖານຂໍ້ມູນກາງ ເພື່ອຄວາມແມ່ນຍຳ 100%
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
              <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />

              <div className="glass-card rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center gap-6 group hover:border-joah-orange hover:shadow-orange-500/10 transition-all duration-500">
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
    </div>
  );
}

export default App;
