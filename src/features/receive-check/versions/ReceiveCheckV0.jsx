import React, { useState, useMemo } from 'react';
import { ArrowLeft, Shield, Layers } from 'lucide-react';
import { sourceROList, demoReceivingMap, metadata } from '../data/mockReceiveData';
import { getROOverallStatus } from '../utils/receiveStatus';
import ReceivingSummary from '../components/ReceivingSummary';
import ROList from '../components/ROList';
import RODetail from '../components/RODetail';
import joahLogo from '../../../assets/Joah.jpeg';
import gardenBg from '../../../assets/BackGroundIM/website-background-light-blue.jpg';

export default function ReceiveCheckV0({ onBack }) {
  const [currentView, setCurrentView] = useState('list');
  const [selectedRoId, setSelectedRoId] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [storeFilter, setStoreFilter] = useState('ALL');

  const [useDemoOverlay, setUseDemoOverlay] = useState(true);
  const [receivingData, setReceivingData] = useState(() => demoReceivingMap);

  const availableStores = useMemo(() => {
    const set = new Set();
    sourceROList.forEach(ro => set.add(ro.storeName));
    return Array.from(set);
  }, []);

  const roListWithStats = useMemo(() => {
    return sourceROList.map(ro => {
      const roReceiving = useDemoOverlay ? (receivingData[ro.id] || {}) : {};
      
      const itemsWithReceiving = ro.items.map(item => {
        const itemRec = roReceiving[item.id];
        return {
          ...item,
          received: itemRec !== undefined ? itemRec.received : null,
          remark: itemRec !== undefined ? itemRec.remark : ''
        };
      });

      const stats = getROOverallStatus(itemsWithReceiving);

      return {
        ...ro,
        stats,
        totalReceived: stats.totalReceived
      };
    });
  }, [useDemoOverlay, receivingData]);

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
                title="ກັບຄືນ"
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
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-400 text-emerald-950 border border-emerald-300 flex items-center gap-1 font-['Noto_Sans_Lao',sans-serif]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-950"></span>
                ກຳລັງກວດ
              </span>
            </div>
          </div>

          {/* Right Header Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setUseDemoOverlay(!useDemoOverlay)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-amber-400 text-amber-950 hover:bg-amber-300 shadow-sm transition flex items-center gap-1.5 cursor-pointer"
            >
              <Layers size={14} />
              <span>{useDemoOverlay ? 'ໂໝດ: ຈຳລອງສະຖານະ (Demo)' : 'ໂໝດ: ຂໍ້ມູນດິບ Excel'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <div className="relative z-10 max-w-[1760px] mx-auto px-6 xl:px-10 py-6 space-y-5">
        {currentView === 'list' ? (
          <>
            {/* TOP BANNER — Light Blue-White Theme matching 1080p */}
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 xl:p-8 shadow-xl border border-blue-100 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-[500px] h-[300px] bg-gradient-to-bl from-blue-100/80 via-sky-50/60 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>
              <div className="absolute left-0 bottom-0 w-[300px] h-[200px] bg-gradient-to-tr from-indigo-50/60 to-transparent rounded-full blur-2xl pointer-events-none -ml-10 -mb-10"></div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                      <Shield size={14} /> ລະບົບຫຼັງບ້ານ
                    </span>
                    <span className="text-sm text-slate-500 font-bold font-mono">
                      JOAH Back-Office System
                    </span>
                  </div>
                  <h2 className="text-3xl xl:text-4xl font-black tracking-tight text-slate-800 flex items-center gap-2">
                    🏢 ລະບົບກວດສອບ & ລາຍງານສຳລັບພະນັກງານຫຼັງບ້ານ
                  </h2>
                  <p className="text-slate-500 text-sm font-medium">
                    ກວດກາລາຍການຮັບສິນຄ້າຈາກ DC ຫາ Store, ຕິດຕາມບິນ RO, ສ່ວນຕ່າງຂາດ/ເກີນ ແລະ ຈັດການຂໍ້ມູນ
                  </p>
                </div>

                {onBack && (
                  <button
                    onClick={onBack}
                    className="px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-black flex items-center gap-2 border border-slate-200 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
                  >
                    <ArrowLeft size={18} />
                    <span>ກັບໄປໜ້າຫຼັກ</span>
                  </button>
                )}
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
            receivingData={useDemoOverlay ? (receivingData[selectedRoId] || {}) : {}}
            onBack={() => {
              setCurrentView('list');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onUpdateReceived={() => {}}
            onUpdateRemark={() => {}}
          />
        )}
      </div>
    </div>
  );
}
