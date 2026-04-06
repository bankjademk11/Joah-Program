import React, { useState } from 'react';
import { ArrowLeft, Database } from 'lucide-react';
import StoreDashboard from './StoreDashboard';
import StoreResultTable from './StoreResultTable';

// ข้อมูลจำลองสำหรับหน้ากระดาน
const DUMMY_RESULTS = [
  { barcode: '8851016140021', rowIndex: 1, item_name: 'Mockup Item 1', rackLocation: 'ZONE-A1', qty: 15, category1: 'BEVERAGE', category2: 'JUICE', status: 'passed' },
  { barcode: '8851016140022', rowIndex: 2, item_name: 'Mockup Item 2', rackLocation: 'ZONE-A2', qty: 0, category1: 'SNACK', category2: 'CHIPS', status: 'missing' },
  { barcode: '8851016140023', rowIndex: 3, item_name: 'Mockup Item 3', rackLocation: 'ZONE-B1', qty: 50, category1: 'FOOD', category2: 'NOODLE', status: 'passed' },
];

const DUMMY_STATS = {
  total: 3,
  passed: 2,
  mismatch: 0,
  missing: 1,
  zeroQty: 1,
  hasQty: 2
};

const StoreInventoryMockup = ({ onBack }) => {
  const [filterStatus, setFilterStatus] = useState('all');
  const [hideZeroQty, setHideZeroQty] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');

  return (
    <div className="w-full h-full space-y-8 animate-fade-in-up">
      {/* Header ย้อนกลับ */}
      <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white dark:bg-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Database className="text-blue-500" size={20} />
            ຂໍ້ມູນສາງໜ້າຮ້ານ (ລຸ້ນທົດລອງ )
          </h2>
        </div>
      </div>

      <StoreDashboard
        stats={DUMMY_STATS}
        activeFilter={filterStatus}
        onFilterChange={setFilterStatus}
        hideZeroQty={hideZeroQty}
        onHideZeroQtyChange={setHideZeroQty}
      />

      <StoreResultTable
        results={DUMMY_RESULTS}
        allResults={DUMMY_RESULTS}
        locationFilter={locationFilter}
        onLocationFilterChange={setLocationFilter}
        masterData={DUMMY_RESULTS}
        rawFile={null}
        locationSheetName="Store Mockup"
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
        dbSource="supabase"
        onRefresh={() => { }}
        refreshTrigger={0}
        onUpdateRowQty={() => { }}
        currentUser={{ name: 'Mockup User', branch_id: 'ຕະຫຼາດລາວ', role: 'HQ' }}
        currentBranch="ຕະຫຼາດລາວ"
        onAddNewProduct={() => { }}
      />
    </div>
  );
};

export default StoreInventoryMockup;
