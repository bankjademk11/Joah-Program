import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Play,
  Activity,
  Clock,
  ChevronRight,
  X,
  Search,
  Database,
  Camera,
  Sparkles,
} from 'lucide-react';
import ITOpIcon from '../../assets/Icons_AppJoah/it_oparationIcon.webp';

const IT_SERVICES = [
  {
    id: 'barcode-inspector',
    title: 'Barcode & Inventory Integrity Inspector',
    category: 'DATA AUDIT',
    badge: 'ACTIVE TOOL',
    badgeColor: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    icon: FileSpreadsheet,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    desc: 'ກວດສອບບາໂຄ້ດຜິດປົກກະຕິ, ບາໂຄ້ດບໍ່ຄົບ 13 ຫຼັກ, ອັກຂະລະແປກປອມ ໃນຄັງສາງ (location_inventory) ແລະ ໜ້າຮ້ານ (store_inventory) ແຍກຕາມສາຂາ ພ້ອມ Export Excel ໃຫ້ສາຂາກວດກາ.',
    metrics: [
      { label: 'Scope', val: 'WH & Store Front' },
      { label: 'Branches', val: '6 ສາຂາ' },
      { label: 'Status', val: '100%' }
    ],
    tags: ['EAN-13 Audit', 'Branch Filter', 'Excel Export', 'Auto-Whitelist'],
    isReady: true
  },
  {
    id: 'employee-activity',
    title: 'Employee Activity & Movement Log',
    category: 'MONITORING',
    badge: 'ACTIVE TOOL',
    badgeColor: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
    icon: Activity,
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    iconBg: 'bg-indigo-100 dark:bg-indigo-950/60',
    desc: 'ຕິດຕາມການເຄື່ອນໄຫວຂອງພະນັກງານໃນລະບົບ: ໃຜ ແກ້ໄຂສິນຄ້າໃດ, ເວລາໃດ, ສາຂາໃດ — ດຶງຂໍ້ມູນຈາກ inventory_history ແລະ store_inventory_history ເພື່ອກວດສອບ Accountability ຂອງພະນັກງານແຕ່ລະຄົນ.',
    metrics: [
      { label: 'Data Source', val: 'History Tables' },
      { label: 'Tracked Fields', val: 'Qty, Rack, Cat' },
      { label: 'Filter By', val: 'Branch / Staff' }
    ],
    tags: ['updated_by Tracking', 'Branch Filter', 'Staff Audit', 'Change History'],
    isReady: true
  },
  {
    id: 'master-data-import',
    title: 'Master Data Excel Importer',
    category: 'DATA MANAGEMENT',
    badge: 'ACTIVE TOOL',
    badgeColor: 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border-teal-200 dark:border-teal-800',
    icon: Database,
    iconColor: 'text-teal-600 dark:text-teal-400',
    iconBg: 'bg-teal-100 dark:bg-teal-950/60',
    desc: 'ອັບໂຫຼດຂໍ້ມູນສິນຄ້າ Master Data ຈາກໄຟລ໌ Excel/CSV ເຂົ້າສູ່ຖານຂໍ້ມູນ Supabase (ຕາຕະລາງ master_data) ແຍກຕາມສາຂາ ພ້ອມກວດສອບ Barcode ຊ້ຳຊ້ອນ ແລະ Auto Upsert.',
    metrics: [
      { label: 'Target', val: 'master_data' },
      { label: 'Key', val: 'barcode + branch' },
      { label: 'Format', val: '.xlsx / .csv' }
    ],
    tags: ['Excel Import', 'Supabase Upsert', 'Branch Filter', 'Store Sync'],
    isReady: true
  },
  {
    id: 'visual-lens-search',
    title: 'Visual Product Search (Joah Lens)',
    category: 'AI & SEARCH',
    badge: 'AI LENS READY',
    badgeColor: 'bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300 border-violet-200 dark:border-violet-800',
    icon: Camera,
    iconColor: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-violet-100 dark:bg-violet-950/60',
    desc: 'ຄົ້ນຫາສິນຄ້າດ້ວຍຮູບພາບ ຄ້າຍ Google Lens: ຖ່າຍຮູບສິນຄ້າທີ່ບໍ່ມີບາໂຄ້ດ ຫຼື ເລືອກຮູບເພື່ອ Match ກັບຖານຂໍ້ມູນຮູບໃນ Supabase Bucket (product-images) ອັດຕະໂນມັດ.',
    metrics: [
      { label: 'Bucket', val: 'product-images' },
      { label: 'Engine', val: 'Visual Match' },
      { label: 'Input', val: 'Live Cam / Upload' }
    ],
    tags: ['Google Lens Style', 'Supabase Bucket', 'Live Camera', 'Visual Match'],
    isReady: true
  }
];

export default function ITToolsDashboard({ onBack, onLaunchTool, user }) {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const isHQ = user?.role === 'HQ';
  const categories = ['ALL', 'DATA AUDIT', 'MONITORING', 'DATA MANAGEMENT', 'AI & SEARCH'];

  const filteredServices = IT_SERVICES.filter(service => {
    // Hide Visual Lens Search from non-HQ users
    if (service.id === 'visual-lens-search' && !isHQ) return false;

    if (selectedCategory !== 'ALL' && service.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = service.title.toLowerCase().includes(q);
      const matchDesc = service.desc.toLowerCase().includes(q);
      const matchTag = service.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchTag) return false;
    }
    return true;
  });

  const handleLaunch = (toolId) => {
    if (onLaunchTool) {
      onLaunchTool(toolId);
    }
  };

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="px-8 py-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              title="Return to Main Dashboard"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-3">
              <img src={ITOpIcon} alt="IT Hub" className="w-10 h-10 rounded-xl object-cover shadow-sm" />
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    IT Operations &amp; Routine Hub
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    IT Tools
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  ສູນລວມເຄື່ອງມືບຳລຸງຮັກສາລະບົບ, ກວດສອບຄວາມຖືກຕ້ອງຂອງຂໍ້ມູນ ແລະ ວຽກ Routine ອັດຕະໂນມັດ
                </p>
              </div>
            </div>
          </div>

          {/* Quick System Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Database &amp; Sync Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full p-8 space-y-6 flex-1">
        {/* Search & Category Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${selectedCategory === cat
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm font-semibold'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <input
              type="text"
              placeholder="Search tools, tags, routines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:border-slate-400 dark:focus:border-slate-600 focus:outline-none shadow-sm"
            />
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Tools Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map(service => {
            const IconComponent = service.icon;

            return (
              <div
                key={service.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                {/* Card Top */}
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${service.iconBg} ${service.iconColor} border border-slate-200/50 dark:border-slate-800`}>
                      <IconComponent size={24} />
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${service.badgeColor}`}>
                      {service.badge}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                      {service.category}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors mt-0.5">
                      {service.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                      {service.desc}
                    </p>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 dark:border-slate-800 text-center">
                    {service.metrics.map((m, idx) => (
                      <div key={idx} className="space-y-0.5">
                        <div className="text-[9px] font-mono text-slate-400 uppercase truncate">
                          {m.label}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 font-mono">
                          {m.val}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(service.tags) ? service.tags : []).map((t, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Launch Action */}
                <div className="pt-5 mt-4">
                  {service.isReady ? (
                    <button
                      onClick={() => handleLaunch(service.id)}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <Play size={14} className="fill-current" />
                      <span>ເປີດໃຊ້ງານເຄື່ອງມື (Open Tool)</span>
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-400 text-xs font-medium flex items-center justify-center gap-2 cursor-not-allowed border border-dashed border-slate-200 dark:border-slate-800"
                    >
                      <Clock size={13} />
                      <span>ກຳລັງພັດທະນາ (In Development)</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
