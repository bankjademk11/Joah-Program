import React, { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Shield, Layers, UploadCloud, RefreshCw, Loader2, Trash2 } from 'lucide-react';
import { getROOverallStatus } from '../utils/receiveStatus';
import ReceivingSummary from '../components/ReceivingSummary';
import ROList from '../components/ROList';
import RODetail from '../components/RODetail';
import ImportROModal from '../components/ImportROModal';
import {
  fetchAllReceiveOrders,
  insertReceiveOrder,
  updateReceiveOrderItem,
  updateReceiveOrderStatus,
  deleteReceiveOrder,
  clearAllReceiveOrders
} from '../services/receiveSupabaseService';
import joahLogo from '../../../assets/Joah.jpeg';
import gardenBg from '../../../assets/BackGroundIM/website-background-light-blue.jpg';

export default function ReceiveCheckV0({ onBack }) {
  const [currentView, setCurrentView] = useState('list');
  const [selectedRoId, setSelectedRoId] = useState(null);

  // Real Database state
  const [roList, setRoList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorNotice, setErrorNotice] = useState('');

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  // Load from Supabase
  const loadOrdersFromDb = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    else setIsRefreshing(true);
    setErrorNotice('');

    try {
      const data = await fetchAllReceiveOrders();
      setRoList(data);
    } catch (err) {
      console.error(err);
      if (err.message === 'TABLES_NOT_FOUND' || err.status === 404 || err.code === '42P01') {
        setErrorNotice('No tables in Supabase: Please run the SQL Script in Supabase SQL Editor to create receive_orders and receive_order_items tables');
      } else {
        setErrorNotice('Error connecting to Supabase: ' + (err.message || 'Please check your network'));
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadOrdersFromDb(true);
  }, []);

  const handleImportSuccess = async (newRO) => {
    try {
      setIsLoading(true);
      await insertReceiveOrder(newRO, newRO.items);
      await loadOrdersFromDb(false);
      setSelectedRoId(newRO.id);
      setCurrentView('detail');
    } catch (err) {
      console.error(err);
      alert('Error saving to Supabase: ' + err.message);
      // Fallback local state if DB error
      setRoList(prev => [newRO, ...prev]);
      setSelectedRoId(newRO.id);
      setCurrentView('detail');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle updating item received quantity in DB
  const handleUpdateItemReceived = async (roId, itemId, newReceivedQty) => {
    try {
      // Optimistic update
      setRoList(prev => prev.map(ro => {
        if (ro.id !== roId) return ro;
        return {
          ...ro,
          items: ro.items.map(it => it.id === itemId ? { ...it, received: newReceivedQty } : it)
        };
      }));

      // Update Supabase
      await updateReceiveOrderItem(itemId, { received: newReceivedQty });
    } catch (err) {
      console.error('Failed to update item in Supabase:', err);
    }
  };

  // Handle updating item remark in DB
  const handleUpdateItemRemark = async (roId, itemId, newRemark) => {
    try {
      setRoList(prev => prev.map(ro => {
        if (ro.id !== roId) return ro;
        return {
          ...ro,
          items: ro.items.map(it => it.id === itemId ? { ...it, remark: newRemark } : it)
        };
      }));

      await updateReceiveOrderItem(itemId, { remark: newRemark });
    } catch (err) {
      console.error('Failed to update remark in Supabase:', err);
    }
  };

  // Handle deleting single RO
  const handleDeleteRO = async (roId) => {
    if (!window.confirm('Are you sure you want to delete this RO from the system?')) return;
    try {
      setIsLoading(true);
      await deleteReceiveOrder(roId);
      await loadOrdersFromDb(false);
      if (selectedRoId === roId) {
        setSelectedRoId(null);
        setCurrentView('list');
      }
    } catch (err) {
      console.error(err);
      alert('Delete failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle clearing all RO data
  const handleClearAll = async () => {
    if (!window.confirm('⚠️ Warning: Are you sure you want to delete all RO data from the Database? Data will be cleared for new import.')) {
      return;
    }
    try {
      setIsLoading(true);
      // Clear localStorage also
      localStorage.removeItem('joah_imported_ros_v0');
      localStorage.removeItem('joah_receiving_records_v0');
      
      await clearAllReceiveOrders();
      await loadOrdersFromDb(false);
      setSelectedRoId(null);
      setCurrentView('list');
      alert('All old data cleared successfully! You can now import a new Excel file.');
    } catch (err) {
      console.error(err);
      alert('Error deleting: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const availableStores = useMemo(() => {
    const set = new Set();
    roList.forEach(ro => ro.storeName && set.add(ro.storeName));
    return Array.from(set);
  }, [roList]);

  const roListWithStats = useMemo(() => {
    return roList.map(ro => {
      const stats = getROOverallStatus(ro.items || []);
      return {
        ...ro,
        stats,
        totalReceived: stats.totalReceived
      };
    });
  }, [roList]);

  const filteredROList = useMemo(() => {
    return roListWithStats.filter(ro => {
      if (statusFilter !== 'ALL') {
        if (ro.stats.status !== statusFilter) return false;
      }

      if (storeFilter !== 'ALL') {
        if (ro.storeName !== storeFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRo = ro.roNumber.toLowerCase().includes(q);
        const matchesSo = ro.soNumber.toLowerCase().includes(q);
        const matchesStore = ro.storeName.toLowerCase().includes(q);
        const matchesProduct = ro.items.some(
          it => it.barcode.includes(q) || it.productName.toLowerCase().includes(q)
        );

        if (!matchesRo && !matchesSo && !matchesStore && !matchesProduct) {
          return false;
        }
      }

      return true;
    });
  }, [roListWithStats, statusFilter, storeFilter, searchQuery]);

  const boStats = useMemo(() => {
    let totalReceivedQty = 0;
    let totalItemRows = 0;
    const barcodeSet = new Set();

    roListWithStats.forEach(ro => {
      totalReceivedQty += ro.totalReceived;
      totalItemRows += ro.items.length;
      ro.items.forEach(it => barcodeSet.add(it.barcode));
    });

    return {
      totalReceivedQty,
      totalItemRows,
      uniqueBarcodesCount: barcodeSet.size,
      uniqueBranches: availableStores.length
    };
  }, [roListWithStats, availableStores]);

  const activeRO = useMemo(() => {
    return roListWithStats.find(r => r.id === selectedRoId) || null;
  }, [roListWithStats, selectedRoId]);

  return (
    <div
      className="min-h-screen w-full relative animate-in fade-in duration-300 font-['Noto_Sans_Lao',sans-serif] text-slate-800"
      style={{
        backgroundImage: `url(${gardenBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Light overlay */}
      <div className="absolute inset-0 bg-white/30 pointer-events-none z-0" />

      {/* TOP HEADER BAR (1080p optimized) */}
      <header className="sticky top-0 z-40 text-white shadow-lg bg-gradient-to-r from-slate-800 via-blue-800 to-slate-700 border-b border-blue-600/30">
        <div className="max-w-[1760px] mx-auto px-6 xl:px-10 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all active:scale-95 cursor-pointer"
                title="Back"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2 font-mono">
                📦 DC TO STORE DELIVERY CHECK
              </h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg border border-white/30">
                <img src={joahLogo} alt="Joah" className="w-5 h-5 rounded object-cover" />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">JOAH</span>
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 ml-3">
              <span className="bg-white/20 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase border border-white/20 font-mono">
                PSN (STORE)
              </span>
              <span className="text-[10px] text-white/80 font-medium font-mono">
                2026-09-18
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-emerald-950 border border-emerald-300 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-950"></span>
                ACTIVE
              </span>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-400 hover:to-blue-400 text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <UploadCloud size={14} />
              <span>Import Excel</span>
            </button>
            <button
              onClick={handleClearAll}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 hover:text-white shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95 border border-rose-400/30"
              title="Clear all receive orders from database"
            >
              <Trash2 size={14} />
              <span>Clear Orders</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="relative z-10 max-w-[1760px] mx-auto px-6 xl:px-10 py-6 space-y-5">
        {errorNotice && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-between">
            <span>⚠️ {errorNotice}</span>
            <button
              onClick={() => loadOrdersFromDb(true)}
              className="px-3 py-1 bg-amber-200 hover:bg-amber-300 rounded-lg text-amber-950 font-black cursor-pointer transition"
            >
              Retry
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-16 text-center border border-blue-50 shadow-lg space-y-3">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
            <p className="text-base font-black text-slate-700">Loading Receive Orders from Supabase...</p>
            <p className="text-xs text-slate-400">Please wait a moment</p>
          </div>
        ) : currentView === 'list' ? (
          <>
            {/* TOP BANNER — Light Blue-White Theme matching 1080p */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 xl:p-8 shadow-xl border border-blue-100 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-[500px] h-[300px] bg-gradient-to-bl from-blue-100/80 via-sky-50/60 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>
              <div className="absolute left-0 bottom-0 w-[300px] h-[200px] bg-gradient-to-tr from-indigo-50/60 to-transparent rounded-full blur-2xl pointer-events-none -ml-10 -mb-10"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                      <Shield size={14} /> Back-Office
                    </span>
                    <span className="text-sm text-slate-500 font-bold font-mono">
                      JOAH Delivery & Receiving Management
                    </span>
                  </div>
                  <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                    🏢 DC to Store Delivery Verification & Audit
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    Monitor delivery orders (RO), verify received stock against store inventory counts, and track variances.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => setIsImportModalOpen(true)}
                    className="px-5 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-sm font-black flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all cursor-pointer active:scale-95"
                  >
                    <UploadCloud size={18} />
                    <span>Import RO Excel</span>
                  </button>

                  {onBack && (
                    <button
                      onClick={onBack}
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-black flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                    >
                      <ArrowLeft size={18} />
                      <span>Back to Home</span>
                    </button>
                  )}
                </div>
              </div>

              {/* QUICK STATS CARDS */}
              <ReceivingSummary
                stats={boStats}
                totalROCount={roListWithStats.length}
              />
            </div>

            {/* RO TABLE & FILTERS CONTAINER */}
            <ROList
              roListWithStats={filteredROList}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              storeFilter={storeFilter}
              onStoreFilterChange={setStoreFilter}
              availableStores={availableStores}
              onOpenImport={() => setIsImportModalOpen(true)}
              onDeleteRO={handleDeleteRO}
              onSelectRO={(ro) => {
                setSelectedRoId(ro.id);
                setCurrentView('detail');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </>
        ) : (
          <RODetail
            ro={activeRO}
            receivingData={{}}
            onBack={() => {
              setCurrentView('list');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onUpdateReceived={(itemId, qty) => handleUpdateItemReceived(activeRO.id, itemId, qty)}
            onUpdateRemark={(itemId, remark) => handleUpdateItemRemark(activeRO.id, itemId, remark)}
          />
        )}
      </div>

      {/* IMPORT EXCEL MODAL */}
      <ImportROModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportSuccess={handleImportSuccess}
      />
    </div>
  );
}
