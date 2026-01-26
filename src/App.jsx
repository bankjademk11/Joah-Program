import { useState, useEffect } from 'react';
import FileUpload from './components/FileUpload';
import SheetMapper from './components/SheetMapper';
import Dashboard from './components/Dashboard';
import ResultTable from './components/ResultTable';
import {
  readExcelFile,
  readExcelFromUrl,
  getSheetNames,
  sheetToJSON,
  validateData,
  suggestSheetMapping
} from './utils/excelProcessor';
import { supabase } from './utils/supabaseClient';
import { fetchMasterFromSupabase, syncMasterDataToSupabase } from './utils/supabaseSync';
import { RefreshCw, Database, Cloud, CloudUpload, LayoutDashboard, Database as DBIcon, Play, Moon, Sun, X, RotateCw } from 'lucide-react';
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

  const handleDatabaseLoad = async () => {
    setIsProcessing(true);
    try {
      const supabaseData = await fetchMasterFromSupabase();
      if (supabaseData && supabaseData.length > 0) {
        setDbSource('supabase');
        setDataSourceLabel('Cloud Mode (Supabase)');
      } else {
        setDbSource('excel');
        setDataSourceLabel('Pre-built Mode (Local Assets)');
      }

      const wb = await readExcelFromUrl(databaseUrl);
      const response = await fetch(databaseUrl);
      const blob = await response.blob();
      const dummyFile = new File([blob], "DataBaseJoah.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      setRawFile(dummyFile);
      setLoadedFileName('DataBaseJoah.xlsx');

      // Load workbook metadata but don't jump to next step automatically
      // This allows the user to see the "Active" status and click "Start"
      const names = getSheetNames(wb);
      const suggested = suggestSheetMapping(names);
      setWorkbook(wb);
      setSheetNames(names);
      setSuggestions(suggested);
      if (suggested.location) setLocationSheetName(suggested.location);
    } catch (error) {
      console.error(error);
      alert('ບໍ່ສາມາດໂຫຼດຖານຂໍ້ມູນໄດ້: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSyncToCloud = async () => {
    setIsProcessing(true);
    try {
      const wb = await readExcelFromUrl(databaseUrl);
      setWorkbook(wb);

      const dataRows = sheetToJSON(wb, 'DATA');
      if (!dataRows || dataRows.length === 0) {
        throw new Error("ບໍ່ພົບຂໍ້ມູນໃນ Sheet 'DATA' ໃນໄຟລ໌ຕົ້ນທາງ.");
      }

      const result = await syncMasterDataToSupabase(dataRows);

      if (result.success) {
        setDbSource('supabase');
        setDataSourceLabel('Synced Cloud Mode');

        const names = getSheetNames(wb);
        const suggested = suggestSheetMapping(names);

        if (suggested.locationSheet) {
          const locationSheet = suggested.locationSheet;
          setLocationSheetName(locationSheet);

          const cloudData = await fetchMasterFromSupabase();
          const mappedDataRows = cloudData.map(d => ({
            'CATEGORIES 1': d.category_1,
            'CATEGORIES 2': d.category_2,
            'Barcode': d.barcode,
            'Item Name': d.product_name_la
          }));

          const locationRows = sheetToJSON(wb, locationSheet);
          const { results, stats } = validateData(locationRows, mappedDataRows);

          setValidationResults(results);
          setStats(stats);
          setStep('results');
          alert('🚀 Sync ແລະ ກວດສອບຂໍ້ມູນອັດຕະໂນມັດສຳເລັດແລ້ວ!');
        } else {
          setStep('mapping');
          alert('✨ Sync ສຳເລັດແລ້ວ! ກະລຸນາເລືອກ Sheet ທີ່ຕ້ອງການກວດສອບ');
        }
      } else {
        const debugMsg = `❌ Sync ບໍ່ສຳເລັດ!\nສາເຫດ (Reason): ${result.error}`;
        alert(debugMsg);
      }
    } catch (e) {
      alert('❌ Error: ' + e.message);
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

  const handleValidate = async ({ locationSheet, dataSheet }) => {
    setIsProcessing(true);
    setLocationSheetName(locationSheet);
    try {
      let dataRows = [];
      if (dbSource === 'supabase') {
        const cloudData = await fetchMasterFromSupabase();
        console.log('DEBUG: Fetched data from Supabase:', cloudData?.length, 'records');
        dataRows = cloudData.map(d => ({
          'CATEGORIES 1': d.category_1,
          'CATEGORIES 2': d.category_2,
          'Barcode': d.barcode,
          'Item Name': d.product_name_la,
          'Qty': d.qty,
          'updated_at': d.updated_at,
          'updated_by': d.updated_by
        }));
      } else {
        dataRows = sheetToJSON(workbook, dataSheet || 'DATA');
        console.log('DEBUG: Loaded data from Excel:', dataRows?.length, 'records');
      }

      const locationRows = sheetToJSON(workbook, locationSheet);
      console.log('DEBUG: Validating', locationRows.length, 'location rows against', dataRows.length, 'master rows');

      const { results, stats } = validateData(locationRows, dataRows);
      console.log('DEBUG: Validation complete. Stats:', stats);
      setValidationResults(results);
      setStats(stats);
      setStep('results');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateResultRowQty = (rowIndex, newData) => {
    setValidationResults(prev => prev.map(row =>
      row.rowIndex === rowIndex ? { ...row, ...newData } : row
    ));
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden transition-colors duration-300">
      {/* Radical Redesign Navigation */}
      <nav className="sticky top-0 w-full z-50 px-4 md:px-8 pt-4">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-b border-white/40 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-black/20 rounded-[2rem] px-6 py-3 flex items-center justify-between gap-6 min-h-[100px]">

          {/* Signboard Style Branding */}
          <div className="flex items-center cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="relative flex items-center">
              {/* Wide Aspect Ratio Logo Container (Matching 1904x904) */}
              <div className="w-[180px] sm:w-[280px] h-[80px] sm:h-[120px] relative z-10 overflow-hidden rounded-3xl shadow-xl border-4 border-white dark:border-slate-800 transition-all duration-500 group-hover:scale-[1.02] group-hover:shadow-joah-orange/20">
                <img
                  src={joahLogo}
                  alt="Joah Logo"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Minimal Text Label - Submerged in Navbar Text Style */}
              <div className="hidden lg:flex flex-col ml-8 border-l-2 border-slate-100 dark:border-slate-800 pl-8 capitalize">
                <span className="text-4xl font-black text-slate-800 dark:text-slate-100 tracking-tighter uppercase leading-none">WAREHOUSE</span>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-black text-joah-orange uppercase tracking-[0.5em] leading-none">Management System</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status & Source Section */}
            <div className="hidden md:flex flex-col items-end gap-1">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Source:</span>
                <span className="text-sm font-black text-slate-700 dark:text-slate-200 leading-none">{dataSourceLabel}</span>
              </div>

              {dbSource === 'supabase' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 dark:bg-emerald-500/10 rounded-full border border-emerald-100 dark:border-emerald-500/20 animate-fade-in">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Cloud Active</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                title="Swith Theme"
                className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-300 hover:text-joah-orange hover:border-joah-orange transition-all duration-300 shadow-sm"
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              {/* Silent Data Refresh - Pull from Supabase but stay on Results Page */}
              {step === 'results' && (
                <button
                  onClick={() => handleValidate({ locationSheet: locationSheetName })}
                  disabled={isProcessing}
                  title="Refresh Data from Cloud"
                  className="flex items-center gap-3 px-6 h-12 bg-white dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-slate-600 dark:text-slate-200 hover:border-joah-orange hover:text-joah-orange transition-all duration-300 shadow-sm group"
                >
                  <RotateCw size={18} className={`${isProcessing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Sync Refresh</span>
                </button>
              )}

              {dbSource === 'supabase' && step === 'upload' && workbook && (
                <button
                  onClick={() => setStep('mapping')}
                  className="flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-joah-orange text-white text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-joah-orange dark:hover:bg-joah-orange-dark hover:shadow-2xl hover:shadow-orange-500/40 transition-all duration-300 transform hover:-translate-y-1 active:scale-95"
                >
                  <Play size={16} fill="currentColor" />
                  Start
                </button>
              )}

              {step !== 'upload' && (
                <button
                  onClick={() => window.location.reload()}
                  title="Reset & Back to Home"
                  className="w-12 h-12 bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-100 dark:border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500 hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-sm"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Centered for Single Page Feel */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-4 overflow-hidden">
        {step === 'upload' && (
          <div className="max-w-5xl w-full animate-slide-up flex flex-col">
            <div className="text-center mb-6 px-4">
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-2 transition-colors">
                ກວດສອບຄວາມຖືກຕ້ອງ <span className="text-joah-orange">ສິນຄ້າໃນສາງ</span>
              </h1>
              <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto transition-colors">
                ລະບົບກວດສອບຂໍ້ມູນສິນຄ້າອັດຕະໂນມັດ ປຽບທຽບລະຫວ່າງໜ້າວຽກຈິງ ແລະ ຖານຂໍ້ມູນກາງ ເພື່ອຄວາມແມ່ນຍຳ 100%
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto w-full">
              <FileUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />

              <div className="glass-card rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center gap-4 group hover:border-joah-orange/30 transition-all duration-500">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-joah-orange group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
                  <DBIcon size={32} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">ໃຊ້ຖານຂໍ້ມູນຫຼັກ</h3>
                  <p className="text-[10px] text-slate-500 leading-relaxed uppercase font-bold tracking-widest leading-none">Cloud Record Database</p>
                </div>
                <button
                  onClick={handleDatabaseLoad}
                  disabled={isProcessing}
                  className="w-full btn-primary h-12 text-sm mt-1 group shadow-md"
                >
                  {isProcessing ? <RefreshCw className="animate-spin" /> : <Database width={16} />}
                  <span>ສືບຕໍ່ດ້ວຍ Cloud Database</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="max-w-md w-full animate-slide-up">
            <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl p-8 border border-slate-100 dark:border-slate-800 transition-colors">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Mapping Sheets</h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 uppercase font-bold tracking-widest leading-none">Configuration</p>
                </div>
                {dbSource === 'excel' && (
                  <button
                    onClick={handleSyncToCloud}
                    disabled={isProcessing}
                    className="flex flex-col items-center gap-1 group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">
                      {isProcessing ? <RefreshCw className="animate-spin" width={16} /> : <CloudUpload width={16} />}
                    </div>
                    <span className="text-[8px] font-black text-slate-400 uppercase group-hover:text-blue-600 transition-colors">Sync</span>
                  </button>
                )}
              </div>
              <SheetMapper sheetNames={sheetNames} suggestions={suggestions} onConfirm={handleValidate} />
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="w-full h-full space-y-6 animate-in overflow-y-auto pr-2 custom-scrollbar">
            <Dashboard
              stats={stats}
              activeFilter={filterStatus}
              onFilterChange={setFilterStatus}
            />
            <ResultTable
              results={validationResults}
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

      {/* Footer - More compact */}
      <footer className="py-4 px-8 text-center border-t border-slate-100 dark:border-slate-800 transition-colors">
        <p className="text-xs font-black text-slate-300 dark:text-slate-700 uppercase tracking-[0.3em]">Built with ❤️ by JOAH Team Santisouk Laxayphone</p>
      </footer>
    </div>
  );
}

export default App;
