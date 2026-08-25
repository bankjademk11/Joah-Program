import React, { useState } from 'react';
import { 
  ArrowLeft, Search, Plus, Trash2, CheckCircle, FileText, 
  Printer, RotateCcw, AlertTriangle, Layers, Calendar, User, 
  Building, MapPin, Tag, Barcode, ChevronDown, ChevronRight, Hash, DollarSign
} from 'lucide-react';

export default function OdooStockAdjustmentView({ onBack, userBranch, isAdmin }) {
  // State for List view vs Form view
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'form'
  
  // Search & Filter state for List view
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'draft' | 'wait_to_approve' | 'done'
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'adjust' | 'scrap' | 'internal_use'

  // Sample data initialized from Odoo multi.scrap.adjust schema & web_searchread RPC payload
  const [adjustments, setAdjustments] = useState([
    {
      id: 8877,
      name: 'ADJ/2026/08/8877',
      date: '2026-08-25 03:18:36',
      user_id: 'IT Management joah',
      type_adjust: 'adjust',
      reason_code_id: 'Periodic Count Discrepancy',
      state: 'draft',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Stock adjustment record #8877',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [
        {
          id: 101,
          product_barcode: '8850123456789',
          product_template_id: 'Joah Green Tea 500ml',
          location_adjust_id: 'SVL/Stock',
          reason_code_id: 'Expired Product',
          received_loss: 'loss',
          lot_id: 'LOT202608-01',
          mfg_status_code: 'EXP',
          mfg_date: '2026-01-10',
          expire_date: '2026-08-20',
          uom_id: 'Units',
          old_on_hand: 50,
          diff_qty: -5,
          cost: 12000,
          diff_amount: -60000
        }
      ],
      stock_move_line_ids: []
    },
    {
      id: 8854,
      name: 'ADJ/2026/08/8854',
      date: '2026-08-25 02:38:58',
      user_id: '171020002 Store Manager SVL',
      type_adjust: 'scrap',
      reason_code_id: 'Damaged Goods',
      state: 'done',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Scrap',
      description: 'Scrap order for damaged goods',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    },
    {
      id: 8853,
      name: 'ADJ/2026/08/8853',
      date: '2026-08-25 02:36:21',
      user_id: 'IT Management joah',
      type_adjust: 'adjust',
      reason_code_id: 'Count Variance',
      state: 'draft',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Routine inventory re-check',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    },
    {
      id: 8756,
      name: 'ADJ/2026/08/8756',
      date: '2026-08-24 06:37:26',
      user_id: 'IT Management joah',
      type_adjust: 'adjust',
      reason_code_id: 'System Correction',
      state: 'done',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Approved adjustment batch',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    },
    {
      id: 7831,
      name: 'ADJ/2026/07/7831',
      date: '2026-07-27 07:22:10',
      user_id: 'IT Management joah',
      type_adjust: 'adjust',
      reason_code_id: 'Monthly Audit',
      state: 'done',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Completed July Stock Count',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    },
    {
      id: 1710,
      name: 'ADJ/2026/04/1710',
      date: '2026-04-23 05:28:57',
      user_id: '171020002 Store Manager SVL',
      type_adjust: 'adjust',
      reason_code_id: 'Audit Correction',
      state: 'wait_to_approve',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Pending HQ Manager approval',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    },
    {
      id: 1708,
      name: 'ADJ/2026/04/1708',
      date: '2026-04-23 04:34:38',
      user_id: '171020002 Store Manager SVL',
      type_adjust: 'adjust',
      reason_code_id: 'Audit Correction',
      state: 'wait_to_approve',
      company_id: '171020002-Joah Sivilay',
      store_location_id: 'SVL/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: 'Pending HQ Manager approval',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    }
  ]);

  // Current active record in Form View
  const [currentRecord, setCurrentRecord] = useState(null);
  const [activeTab, setActiveTab] = useState('order_lines'); // 'order_lines' | 'stock_move'

  // New line item state inside Form View
  const [newLine, setNewLine] = useState({
    product_barcode: '',
    product_template_id: '',
    received_loss: 'loss',
    reason_code_id: 'Stock Discrepancy',
    lot_id: '',
    mfg_status_code: 'MFG',
    mfg_date: '',
    expire_date: '',
    uom_id: 'Units',
    old_on_hand: 0,
    diff_qty: 0,
    cost: 0
  });

  // Open record in form view
  const handleOpenForm = (record) => {
    setCurrentRecord(JSON.parse(JSON.stringify(record))); // deep copy
    setViewMode('form');
  };

  // Create new record
  const handleCreateNew = () => {
    const newDoc = {
      id: Date.now(),
      name: '/',
      date: new Date().toISOString().replace('T', ' ').substring(0, 19),
      user_id: 'Current User',
      type_adjust: 'adjust',
      reason_code_id: 'Stock Variance',
      state: 'draft',
      company_id: userBranch || 'ເມກ້າມໍ',
      store_location_id: 'MAIN/Stock',
      adjustment_location_id: 'Virtual Locations/Adjustment',
      description: '',
      can_print_form_adjust_accounting: true,
      can_print_form_adjust_operation: true,
      order_line_ids: [],
      stock_move_line_ids: []
    };
    setCurrentRecord(newDoc);
    setViewMode('form');
  };

  // Action Handlers for Header Buttons
  const handleConfirm = () => {
    if (!currentRecord) return;
    const updated = {
      ...currentRecord,
      name: currentRecord.name === '/' ? `ADJ/${new Date().getFullYear()}/${String(new Date().getMonth() + 1).padStart(2, '0')}/${String(Math.floor(Math.random() * 900) + 100)}` : currentRecord.name,
      state: 'wait_to_approve'
    };
    setCurrentRecord(updated);
    updateAdjustmentsList(updated);
  };

  const handleApprove = () => {
    if (!currentRecord) return;
    const updated = { ...currentRecord, state: 'done' };
    setCurrentRecord(updated);
    updateAdjustmentsList(updated);
  };

  const handleSetToDraft = () => {
    if (!currentRecord) return;
    const updated = { ...currentRecord, state: 'draft' };
    setCurrentRecord(updated);
    updateAdjustmentsList(updated);
  };

  const updateAdjustmentsList = (record) => {
    setAdjustments(prev => {
      const exists = prev.some(item => item.id === record.id);
      if (exists) {
        return prev.map(item => item.id === record.id ? record : item);
      }
      return [record, ...prev];
    });
  };

  // Add line item to current record
  const handleAddLine = () => {
    if (!newLine.product_template_id.trim()) return;
    const diffAmt = (Number(newLine.diff_qty) || 0) * (Number(newLine.cost) || 0);
    const lineItem = {
      id: Date.now(),
      ...newLine,
      diff_qty: Number(newLine.diff_qty) || 0,
      cost: Number(newLine.cost) || 0,
      diff_amount: diffAmt
    };
    setCurrentRecord(prev => ({
      ...prev,
      order_line_ids: [...prev.order_line_ids, lineItem]
    }));
    // Reset line input
    setNewLine({
      product_barcode: '',
      product_template_id: '',
      received_loss: 'loss',
      reason_code_id: 'Stock Discrepancy',
      lot_id: '',
      mfg_status_code: 'MFG',
      mfg_date: '',
      expire_date: '',
      uom_id: 'Units',
      old_on_hand: 0,
      diff_qty: 0,
      cost: 0
    });
  };

  // Remove line item
  const handleRemoveLine = (lineId) => {
    setCurrentRecord(prev => ({
      ...prev,
      order_line_ids: prev.order_line_ids.filter(l => l.id !== lineId)
    }));
  };

  const branches = [
    { id: 'ALL', name: 'ທຸກສາຂາ (ALL)' },
    { id: 173, name: 'ໂພນສີນວນ (PSN)', companyName: 'Joah Phonsinuan' },
    { id: 248, name: 'ສີວິໄລ (SVL)', companyName: '171020002-Joah Sivilay' },
    { id: 249, name: 'ຕະຫຼາດລາວ (TLL)', companyName: 'Joah Taladlao' },
    { id: 8, name: 'ວັງຊາຍ (VX)', companyName: 'Joah Vangxay' },
    { id: 273, name: 'ປະຕູໄຊ (PTX)', companyName: 'Joah Patuxay' },
    { id: 241, name: 'ເມກ້າມໍ (MGM)', companyName: 'Joah Megamall' }
  ];

  const [selectedBranch, setSelectedBranch] = useState('ALL');

  // Filtered list items
  const filteredAdjustments = adjustments.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        item.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.state === statusFilter;
    const matchType = typeFilter === 'all' || item.type_adjust === typeFilter;
    const matchBranch = selectedBranch === 'ALL' || item.company_id.includes(branches.find(b => b.id === Number(selectedBranch))?.companyName || '');
    return matchSearch && matchStatus && matchType && matchBranch;
  });

  const getStatusBadge = (state) => {
    switch (state) {
      case 'done':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">Done</span>;
      case 'wait_to_approve':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">Wait to Approve</span>;
      case 'draft':
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">Draft</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      
      {/* Top Navbar Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={viewMode === 'form' ? () => setViewMode('list') : onBack}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-joah-orange hover:text-white transition-all border border-slate-200 dark:border-slate-700"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded bg-joah-orange/10 text-joah-orange uppercase tracking-wider">Odoo Inventory</span>
              <h1 className="text-lg font-black text-slate-800 dark:text-white">
                Scrap & Stock Adjustment <span className="text-xs text-slate-400 font-medium">(multi.scrap.adjust)</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">ສາຂາ:</span>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-joah-orange outline-none cursor-pointer hover:border-joah-orange transition-all"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {viewMode === 'list' && (
          <button
            onClick={handleCreateNew}
            className="flex items-center gap-2 px-4 py-2 bg-joah-orange hover:bg-orange-600 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md shadow-orange-500/20 transition-all hover:scale-105"
          >
            <Plus size={16} />
            <span>ສ້າງລາຍການໃໝ່ (Create)</span>
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">
        
        {/* ================================================================= */}
        {/* LIST VIEW                                                         */}
        {/* ================================================================= */}
        {viewMode === 'list' && (
          <div className="space-y-4">
            
            {/* Search & Filter Bar */}
            <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ຄົ້ນຫາຊື່ document, ລາຍລະອຽດ, ຜູ້ຮັບຜິດຊອບ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-joah-orange/50 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="all">ທຸກສະຖານະ (All Status)</option>
                  <option value="draft">Draft</option>
                  <option value="wait_to_approve">Wait to Approve</option>
                  <option value="done">Done</option>
                </select>

                {/* Type Adjust Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="all">ທຸກປະເພດ (All Types)</option>
                  <option value="adjust">Adjustment</option>
                  <option value="scrap">Scrap</option>
                  <option value="internal_use">Internal Use</option>
                </select>
              </div>
            </div>

            {/* List Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="p-4">Reference Name</th>
                      <th className="p-4">Adjust Date</th>
                      <th className="p-4">Responsible User</th>
                      <th className="p-4">Type</th>
                      <th className="p-4">Company</th>
                      <th className="p-4 text-center">Status</th>
                      <th className="p-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm font-medium">
                    {filteredAdjustments.length > 0 ? (
                      filteredAdjustments.map((item) => (
                        <tr 
                          key={item.id} 
                          onClick={() => handleOpenForm(item)}
                          className="hover:bg-joah-orange/10 dark:hover:bg-joah-orange/10 cursor-pointer transition-all group"
                        >
                          <td className="p-4 font-bold text-joah-orange flex items-center gap-2 group-hover:underline">
                            <FileText size={16} />
                            {item.name}
                          </td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{item.date}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{item.user_id}</td>
                          <td className="p-4 uppercase text-xs font-bold text-slate-500">{item.type_adjust}</td>
                          <td className="p-4 text-slate-600 dark:text-slate-300">{item.company_id}</td>
                          <td className="p-4 text-center">{getStatusBadge(item.state)}</td>
                          <td className="p-4 text-center">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenForm(item);
                              }}
                              className="px-3 py-1.5 bg-joah-orange/10 text-joah-orange hover:bg-joah-orange hover:text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1 mx-auto"
                            >
                              <span>ເບິ່ງບິນ</span> (View)
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-400 dark:text-slate-600 font-medium">
                          ບໍ່ພົບລາຍການ adjustment ທີ່ตรงตามเงื่อนไข
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* FORM VIEW                                                         */}
        {/* ================================================================= */}
        {viewMode === 'form' && currentRecord && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-fade-in-up">
            
            {/* Form Header Action Bar & Statusbar */}
            <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
              
              {/* Left Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {currentRecord.state === 'draft' && (
                  <button
                    onClick={handleConfirm}
                    className="px-4 py-2 bg-joah-orange hover:bg-orange-600 text-white rounded-xl font-bold text-xs shadow-md shadow-orange-500/20 transition-all"
                  >
                    Confirm
                  </button>
                )}
                {currentRecord.state === 'wait_to_approve' && (
                  <button
                    onClick={handleApprove}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle size={14} /> Approve
                  </button>
                )}

                {/* Print buttons */}
                {currentRecord.name !== '/' && (
                  <>
                    <button
                      onClick={() => alert('Printing Adjust Accounting Form...')}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Printer size={14} /> Print Adjust Accounting
                    </button>
                    <button
                      onClick={() => alert('Printing Form Adjust Operation...')}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                    >
                      <Printer size={14} /> Print Form Adjust
                    </button>
                  </>
                )}

                {currentRecord.state === 'wait_to_approve' && (
                  <button
                    onClick={handleSetToDraft}
                    className="px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Set to Draft
                  </button>
                )}
              </div>

              {/* Statusbar Widget */}
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <span className={`px-3 py-1.5 rounded-lg transition-all ${currentRecord.state === 'draft' ? 'bg-joah-orange text-white shadow-sm' : 'text-slate-400'}`}>
                  Draft
                </span>
                <ChevronRight size={14} className="text-slate-300" />
                <span className={`px-3 py-1.5 rounded-lg transition-all ${currentRecord.state === 'wait_to_approve' ? 'bg-sky-500 text-white shadow-sm' : 'text-slate-400'}`}>
                  Wait to Approve
                </span>
                <ChevronRight size={14} className="text-slate-300" />
                <span className={`px-3 py-1.5 rounded-lg transition-all ${currentRecord.state === 'done' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400'}`}>
                  Done
                </span>
              </div>
            </div>

            {/* Sheet Body */}
            <div className="p-6 space-y-6">
              
              {/* Document Title Header */}
              <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Document Reference</p>
                <h1 className="text-3xl font-black text-joah-orange tracking-tight">
                  {currentRecord.name === '/' ? 'ADJ / New Draft' : currentRecord.name}
                </h1>
              </div>

              {/* Group Fields Layout (2 Columns) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Group 1: Adjustment Detail */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag size={14} className="text-joah-orange" /> Adjustment Detail
                  </h3>
                  
                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Type Adjust:</label>
                    <span className="col-span-2 font-bold capitalize text-slate-800 dark:text-slate-200">{currentRecord.type_adjust}</span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Adjust Date:</label>
                    <span className="col-span-2 text-slate-700 dark:text-slate-300">{currentRecord.date}</span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Responsible User:</label>
                    <span className="col-span-2 font-semibold text-slate-700 dark:text-slate-300">{currentRecord.user_id}</span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Description:</label>
                    <input
                      type="text"
                      disabled={currentRecord.state !== 'draft'}
                      value={currentRecord.description}
                      onChange={(e) => setCurrentRecord({ ...currentRecord, description: e.target.value })}
                      placeholder="Enter description or note..."
                      className="col-span-2 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:ring-1 focus:ring-joah-orange"
                    />
                  </div>
                </div>

                {/* Group 2: Location Detail */}
                <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin size={14} className="text-joah-orange" /> Location & Company
                  </h3>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Store Location:</label>
                    <span className="col-span-2 font-medium text-slate-700 dark:text-slate-300">{currentRecord.store_location_id}</span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Adjust Location:</label>
                    <span className="col-span-2 font-medium text-slate-700 dark:text-slate-300">{currentRecord.adjustment_location_id}</span>
                  </div>

                  <div className="grid grid-cols-3 items-center text-xs">
                    <label className="font-bold text-slate-500">Company:</label>
                    <span className="col-span-2 font-bold text-slate-800 dark:text-slate-200">{currentRecord.company_id}</span>
                  </div>
                </div>

              </div>

              {/* Notebook / Tabs Section */}
              <div className="space-y-4 pt-2">
                <div className="flex border-b border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => setActiveTab('order_lines')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 ${
                      activeTab === 'order_lines' 
                        ? 'border-joah-orange text-joah-orange' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Order Lines ({currentRecord.order_line_ids.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('stock_move')}
                    className={`px-5 py-2.5 font-bold text-xs transition-all border-b-2 ${
                      activeTab === 'stock_move' 
                        ? 'border-joah-orange text-joah-orange' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    Stock Movement ({currentRecord.stock_move_line_ids.length})
                  </button>
                </div>

                {/* Tab 1: Order Lines List */}
                {activeTab === 'order_lines' && (
                  <div className="space-y-4">
                    
                    {/* Add Line Control Form (Only in draft mode) */}
                    {currentRecord.state === 'draft' && (
                      <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3">
                        <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Plus size={14} className="text-joah-orange" /> Add Order Line
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Barcode</label>
                            <input
                              type="text"
                              placeholder="Barcode"
                              value={newLine.product_barcode}
                              onChange={(e) => setNewLine({ ...newLine, product_barcode: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Product Template *</label>
                            <input
                              type="text"
                              placeholder="Product name"
                              value={newLine.product_template_id}
                              onChange={(e) => setNewLine({ ...newLine, product_template_id: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Recv / Loss</label>
                            <select
                              value={newLine.received_loss}
                              onChange={(e) => setNewLine({ ...newLine, received_loss: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                            >
                              <option value="loss">Loss (-)</option>
                              <option value="received">Received (+)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Lot / Serial</label>
                            <input
                              type="text"
                              placeholder="Lot ID"
                              value={newLine.lot_id}
                              onChange={(e) => setNewLine({ ...newLine, lot_id: e.target.value })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Old On Hand</label>
                            <input
                              type="number"
                              value={newLine.old_on_hand}
                              onChange={(e) => setNewLine({ ...newLine, old_on_hand: Number(e.target.value) })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Diff Qty</label>
                            <input
                              type="number"
                              value={newLine.diff_qty}
                              onChange={(e) => setNewLine({ ...newLine, diff_qty: Number(e.target.value) })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none font-bold text-joah-orange"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-400 mb-1">Cost (LAK)</label>
                            <input
                              type="number"
                              value={newLine.cost}
                              onChange={(e) => setNewLine({ ...newLine, cost: Number(e.target.value) })}
                              className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none"
                            />
                          </div>

                          <div className="flex items-end">
                            <button
                              onClick={handleAddLine}
                              className="w-full py-1.5 bg-joah-orange hover:bg-orange-600 text-white rounded-lg font-bold text-xs transition-all shadow-sm"
                            >
                              Add Line
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Order Lines Table */}
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                            <th className="p-3">Barcode</th>
                            <th className="p-3">Product</th>
                            <th className="p-3">Lot/Serial</th>
                            <th className="p-3">UoM</th>
                            <th className="p-3 text-right">Old On Hand</th>
                            <th className="p-3 text-right">Diff Qty</th>
                            <th className="p-3 text-right">Cost (LAK)</th>
                            <th className="p-3 text-right">Diff Amt (LAK)</th>
                            {currentRecord.state === 'draft' && <th className="p-3 text-center">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                          {currentRecord.order_line_ids.length > 0 ? (
                            currentRecord.order_line_ids.map((line) => (
                              <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-3 font-mono text-slate-500">{line.product_barcode || '-'}</td>
                                <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{line.product_template_id}</td>
                                <td className="p-3 text-slate-600 dark:text-slate-400">{line.lot_id || '-'}</td>
                                <td className="p-3 text-slate-500">{line.uom_id}</td>
                                <td className="p-3 text-right text-slate-600 dark:text-slate-400">{line.old_on_hand}</td>
                                <td className={`p-3 text-right font-bold ${line.received_loss === 'loss' ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {line.diff_qty > 0 ? `+${line.diff_qty}` : line.diff_qty}
                                </td>
                                <td className="p-3 text-right text-slate-600 dark:text-slate-400">
                                  {Number(line.cost).toLocaleString('lo-LA')}
                                </td>
                                <td className={`p-3 text-right font-bold ${line.diff_amount < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                  {Number(line.diff_amount).toLocaleString('lo-LA')} ₭
                                </td>
                                {currentRecord.state === 'draft' && (
                                  <td className="p-3 text-center">
                                    <button
                                      onClick={() => handleRemoveLine(line.id)}
                                      className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={currentRecord.state === 'draft' ? 9 : 8} className="p-6 text-center text-slate-400">
                                ຍັງບໍ່ມີรายการสินค้าใน Order Lines
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 2: Stock Move Lines */}
                {activeTab === 'stock_move' && (
                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-500">
                          <th className="p-3">Reference</th>
                          <th className="p-3">Date</th>
                          <th className="p-3">Product</th>
                          <th className="p-3">Lot/Serial</th>
                          <th className="p-3">From Location</th>
                          <th className="p-3">To Location</th>
                          <th className="p-3 text-right">Qty Done</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                        {currentRecord.stock_move_line_ids.length > 0 ? (
                          currentRecord.stock_move_line_ids.map((sm) => (
                            <tr key={sm.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-joah-orange">{sm.reference}</td>
                              <td className="p-3 text-slate-500">{sm.date}</td>
                              <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{sm.product_id}</td>
                              <td className="p-3 text-slate-500">{sm.lot_id || '-'}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">{sm.location_id}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-400">{sm.location_dest_id}</td>
                              <td className="p-3 text-right font-bold">{sm.qty_done}</td>
                              <td className="p-3 text-center">{getStatusBadge(sm.state)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan="8" className="p-6 text-center text-slate-400">
                              ຍັງບໍ່ມີ Stock Movement สำหรับเอกสารนี้ (สร้างเมื่อ Approve รายการ)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
