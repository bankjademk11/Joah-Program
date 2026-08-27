import React, { useState, useEffect } from 'react'
import { RefreshCw, Search, Filter, AlertTriangle, Building2, ChevronDown, Check, ArrowLeft, PackageCheck, FileText, Layers } from 'lucide-react'
import { fetchInventoryOverview, fetchPickingsByType, fetchPickingDetail } from '../../../services/odooApi'

const ODOO_COMPANIES = [
  { id: 178, name: '171010001-Joah Phonsinuan' },
  { id: 179, name: '171020002-Joah Sivilay' },
  { id: 180, name: '171030003-Joah Taladlao' },
  { id: 181, name: '171040004-Joah Vangxay' },
  { id: 182, name: '171050005-Joah Phonxai' },
]

export default function InventoryOverviewDashboard({ mockData = null }) {
  const [records, setRecords] = useState(mockData ? mockData.result?.records || [] : [])
  const [loading, setLoading] = useState(!mockData)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState('ALL')

  // Drill-down State (Level 2: Pickings List View)
  const [selectedPickingType, setSelectedPickingType] = useState(null) // item object
  const [pickings, setPickings] = useState([])
  const [loadingPickings, setLoadingPickings] = useState(false)

  // Drill-down State (Level 3: Single Transfer Form View with Products)
  const [activePickingDetail, setActivePickingDetail] = useState(null)
  const [loadingPickingDetail, setLoadingPickingDetail] = useState(false)

  // Odoo Company / Branch Switcher State (null = default Odoo active session company)
  const [selectedCompanies, setSelectedCompanies] = useState(null)
  const [isCompanyDropdownOpen, setIsCompanyDropdownOpen] = useState(false)

  const loadData = async (companyIds = selectedCompanies) => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchInventoryOverview(companyIds)
      setRecords(data)
    } catch (err) {
      console.error('Error fetching inventory overview:', err)
      setError(err.message)
      if (mockData?.result?.records) {
        setRecords(mockData.result.records)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!mockData) {
      loadData(selectedCompanies)
    }
  }, [selectedCompanies])

  // Fetch detail pickings when clicking a card
  const handleOpenDetail = async (item) => {
    setSelectedPickingType(item)
    setActivePickingDetail(null)
    setLoadingPickings(true)
    try {
      const res = await fetchPickingsByType(item.id)
      setPickings(res.records || [])
    } catch (err) {
      console.error('Error fetching pickings detail:', err)
    } finally {
      setLoadingPickings(false)
    }
  }

  // Fetch single picking form (items/moves inside a bill)
  const handleOpenPickingForm = async (pickingSummary) => {
    setActivePickingDetail(pickingSummary)
    setLoadingPickingDetail(true)
    try {
      const detail = await fetchPickingDetail(pickingSummary.id)
      if (detail) {
        setActivePickingDetail(detail)
      }
    } catch (err) {
      console.error('Error fetching single picking form:', err)
    } finally {
      setLoadingPickingDetail(false)
    }
  }

  // Unique warehouses for filter
  const warehouses = Array.from(
    new Set(
      records
        .map(r => r.warehouse_id?.display_name)
        .filter(Boolean)
    )
  )

  const filteredRecords = records.filter(item => {
    const matchSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.warehouse_id?.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchWh = selectedWarehouse === 'ALL' || item.warehouse_id?.display_name === selectedWarehouse
    return matchSearch && matchWh
  })

  // Exact Odoo Kanban Graph renderer
  const renderOdooGraph = (graphJsonString) => {
    if (!graphJsonString) return null
    try {
      const parsed = typeof graphJsonString === 'string' ? JSON.parse(graphJsonString) : graphJsonString
      const graphData = parsed[0]?.values || []
      const maxValue = Math.max(...graphData.map(v => v.value), 1)

      return (
        <div className="flex items-end gap-[3px] h-[55px] mt-4 pt-2 border-t border-slate-100">
          {graphData.map((bar, idx) => {
            const isSample = bar.type === 'sample'
            const heightPercent = bar.value > 0 ? Math.max((bar.value / maxValue) * 100, 12) : (isSample ? 0 : 0)

            const barColor = isSample ? '#e2e8f0' : (bar.value > 0 ? '#d97706' : '#cbd5e1')
            const primaryBarColor = idx === 0 && bar.value > 0 ? '#e11d48' : barColor

            return (
              <div
                key={idx}
                title={`${bar.label}: ${bar.value}`}
                className="flex-1 flex flex-col items-center h-full justify-end group relative"
              >
                <div
                  style={{
                    height: `${heightPercent}%`,
                    backgroundColor: primaryBarColor,
                  }}
                  className="w-full rounded-t-[1px] transition-all duration-300 group-hover:brightness-90"
                />
              </div>
            )
          })}
        </div>
      )
    } catch {
      return null
    }
  }

  // ── Level 3: Render Odoo Form View (Single Transfer Bill Detail) ───────────
  if (activePickingDetail) {
    const moves = activePickingDetail.move_ids_without_package || []
    const currentState = activePickingDetail.state || 'done'

    return (
      <div className="min-h-screen bg-[#F9F9FB] text-slate-800 font-sans text-xs sm:text-sm">
        {/* Top Odoo Control Panel Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 shadow-xs">
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setActivePickingDetail(null)}
              className="text-[#714B67] hover:underline font-semibold flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              Inventory Overview
            </button>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500 font-medium">
              {activePickingDetail.picking_type_id?.display_name || 'Transfers'}
            </span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-800 font-bold">{activePickingDetail.name}</span>
          </div>

          <div className="flex items-center gap-2">
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1 rounded text-xs border border-slate-300 flex items-center gap-1.5">
              <Layers size={13} />
              Moves
            </button>
          </div>
        </div>

        {/* Action Buttons & Status Workflow Ribbon */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-3">
          {/* Left Action Buttons */}
          <div className="flex items-center gap-2">
            <button className="bg-[#714B67] hover:bg-[#5A3B52] text-white font-medium px-3 py-1 rounded text-xs">
              Print Grn
            </button>
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1 rounded text-xs border border-slate-300">
              Print
            </button>
            <button className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-1 rounded text-xs border border-slate-300">
              Return
            </button>
          </div>

          {/* Right Status Workflow Arrow Wizard */}
          <div className="flex items-center text-xs font-semibold text-slate-400">
            {['Draft', 'Waiting', 'Ready', 'Done'].map((stepName, idx) => {
              const stepKey = stepName.toLowerCase()
              const isActive = (currentState === 'done' && stepKey === 'done') ||
                               (currentState === 'assigned' && stepKey === 'ready') ||
                               (currentState === 'ready' && stepKey === 'ready') ||
                               (currentState === 'waiting' && stepKey === 'waiting') ||
                               (currentState === 'draft' && stepKey === 'draft')

              return (
                <div
                  key={idx}
                  className={`px-3 py-1 border-y border-r border-slate-200 transition-colors flex items-center ${
                    idx === 0 ? 'border-l rounded-l' : ''
                  } ${idx === 3 ? 'rounded-r' : ''} ${
                    isActive
                      ? 'bg-[#008784] text-white border-[#008784] font-bold'
                      : 'bg-slate-50 text-slate-500'
                  }`}
                >
                  {stepName}
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Odoo Sheet Container */}
        <div className="max-w-6xl mx-auto m-4 bg-white rounded-sm border border-slate-200 shadow-sm p-6">
          {/* Header Title */}
          <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-300 text-xl cursor-pointer hover:text-amber-400">☆</span>
              <h1 className="text-2xl font-bold text-slate-900 font-sans tracking-tight">
                {activePickingDetail.name}
              </h1>
            </div>
          </div>

          {/* Form Fields Grid - Two Columns (Odoo Layout) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2 mb-8 text-xs sm:text-sm">
            {/* Left Column */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Contact</span>
                <span className="col-span-2 text-slate-800 font-medium">{activePickingDetail.partner_id?.display_name || '-'}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Source Location</span>
                <span className="col-span-2 font-mono text-slate-800 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100/60 inline-block w-fit">
                  {activePickingDetail.location_id?.display_name || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Destination Location</span>
                <span className="col-span-2 font-mono text-slate-800 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100/60 inline-block w-fit">
                  {activePickingDetail.location_dest_id?.display_name || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Operation Type</span>
                <span className="col-span-2 text-slate-800 font-medium">{activePickingDetail.picking_type_id?.display_name || '-'}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Type of Operation</span>
                <span className="col-span-2 text-slate-700">Internal Transfer</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-2">
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Scheduled Date</span>
                <span className="col-span-2 font-mono text-slate-800 bg-amber-50/50 px-1.5 py-0.5 rounded border border-amber-100/60 inline-block w-fit">
                  {activePickingDetail.scheduled_date || '-'}
                </span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Effective Date</span>
                <span className="col-span-2 font-mono text-slate-800">{activePickingDetail.date_done || '-'}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Source Document</span>
                <span className="col-span-2 text-slate-700">{activePickingDetail.origin || '-'}</span>
              </div>
              <div className="grid grid-cols-3 items-center">
                <span className="text-slate-500 font-medium">Picking List Number</span>
                <span className="col-span-2 text-slate-700">-</span>
              </div>
            </div>
          </div>

          {/* Form Tabs */}
          <div className="border-b border-slate-200 mb-4 flex gap-6 text-xs sm:text-sm font-semibold">
            <button className="text-[#714B67] border-b-2 border-[#714B67] pb-2">
              Operations
            </button>
            <button className="text-slate-400 hover:text-slate-600 pb-2">
              Additional Info
            </button>
            <button className="text-slate-400 hover:text-slate-600 pb-2">
              Note
            </button>
            <button className="text-slate-400 hover:text-slate-600 pb-2">
              Employee History
            </button>
          </div>

          {/* Operations / Products Table (Exact Odoo Column Headers) */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-700 font-bold">
                  <th className="py-2 px-2 w-8">#</th>
                  <th className="py-2 px-2 w-12 text-center">image</th>
                  <th className="py-2 px-3">Barcode</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Packaging</th>
                  <th className="py-2 px-3 text-right">Demand</th>
                  <th className="py-2 px-3 text-right">Q...</th>
                  <th className="py-2 px-3 text-right">quantity_e...</th>
                  <th className="py-2 px-3">Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPickingDetail ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">Loading operation details...</td>
                  </tr>
                ) : moves.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400">No move lines available in this transfer.</td>
                  </tr>
                ) : (
                  moves.map((m, idx) => (
                    <tr key={m.id || idx} className="hover:bg-slate-50/80 transition-colors text-slate-700">
                      <td className="py-2.5 px-2 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-2 text-center">
                        {m.image_1920 ? (
                          <img src={`data:image/png;base64,${m.image_1920}`} alt="" className="w-6 h-6 object-contain inline-block rounded" />
                        ) : (
                          <span className="text-slate-300">📷</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{m.barcode || '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {m.product_id?.display_name || m.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">-</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-700">
                        {m.product_uom_qty ? Number(m.product_uom_qty).toFixed(2) : '0.00'}
                      </td>
                      <td className="py-2.5 px-3 text-right text-slate-500">
                        <span className="inline-block text-[#008784] font-bold">📊</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                        {m.quantity ? Number(m.quantity).toFixed(2) : '0.00'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{m.product_uom?.display_name || 'Unit'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Level 2: Render Drill-down Detail Table View (Odoo List View) ───────────────────
  if (selectedPickingType) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-4 sm:p-6">
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPickingType(null)}
              className="flex items-center gap-1.5 text-slate-600 hover:text-[#714B67] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-colors"
            >
              <ArrowLeft size={16} />
              <span>Back to Overview</span>
            </button>
            <span className="text-slate-300">|</span>
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <PackageCheck size={20} className="text-[#714B67]" />
                {selectedPickingType.name}
              </h2>
              <p className="text-xs text-slate-400">
                {selectedPickingType.warehouse_id?.display_name || ''} ({pickings.length} items)
              </p>
            </div>
          </div>

          <button
            onClick={() => handleOpenDetail(selectedPickingType)}
            disabled={loadingPickings}
            className="flex items-center gap-2 bg-[#714B67] hover:bg-[#5c3c54] text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-colors"
          >
            <RefreshCw size={14} className={loadingPickings ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Odoo Style List View Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px] tracking-wider">
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">From</th>
                  <th className="py-3 px-4">To</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Responsible / User</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingPickings ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={8} className="py-3 px-4 bg-slate-50/50 h-10"></td>
                    </tr>
                  ))
                ) : pickings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-medium">
                      No Transfers found for this operation.
                    </td>
                  </tr>
                ) : (
                  pickings.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td
                        onClick={() => handleOpenPickingForm(p)}
                        className="py-2.5 px-4 font-bold text-[#714B67] hover:text-[#5c3c54] hover:underline cursor-pointer flex items-center gap-1.5"
                      >
                        <FileText size={14} className="text-[#714B67]" />
                        <span>{p.name}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.location_id?.display_name || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.location_dest_id?.display_name || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-xs">
                        {p.scheduled_date || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.user_id?.display_name || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 text-xs truncate max-w-[150px]">
                        {p.company_id?.display_name || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                          p.state === 'done'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : p.state === 'assigned' || p.state === 'ready'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : p.state === 'waiting'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {p.state}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans p-4 sm:p-6">
      {/* ── Top Header Control Bar ───────────────────────────────── */}
      <div className="bg-white rounded-lg border border-slate-200 p-3 px-4 mb-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold text-slate-800 tracking-tight">Inventory Overview</h1>
          <span className="bg-slate-100 text-slate-600 text-xs px-2.5 py-1 rounded-full font-medium">
            {records.length} Operations
          </span>
          <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Odoo Live API
          </span>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Odoo Style Company Multi-Branch Selector */}
          <div className="relative">
            <button
              onClick={() => setIsCompanyDropdownOpen(!isCompanyDropdownOpen)}
              className="flex items-center gap-2 bg-[#714B67]/10 text-[#714B67] hover:bg-[#714B67]/20 border border-[#714B67]/30 px-3 py-1.5 rounded-md text-xs sm:text-sm font-semibold transition-colors"
            >
              <Building2 size={15} />
              <span>
                {!selectedCompanies || selectedCompanies.length === 0
                  ? 'Default Active Company'
                  : selectedCompanies.length === 1
                    ? ODOO_COMPANIES.find(c => c.id === selectedCompanies[0])?.name || 'Company'
                    : `${selectedCompanies.length} Companies Selected`}
              </span>
              <ChevronDown size={14} className={`transition-transform ${isCompanyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Box */}
            {isCompanyDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex justify-between items-center px-2 py-1 mb-1 border-b border-slate-100">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Select Odoo Company
                  </span>
                  <button
                    onClick={() => { setSelectedCompanies(null); setIsCompanyDropdownOpen(false); }}
                    className="text-[10px] text-purple-600 hover:underline font-bold"
                  >
                    Reset (Default)
                  </button>
                </div>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {ODOO_COMPANIES.map(comp => {
                    const isSelected = selectedCompanies ? selectedCompanies.includes(comp.id) : false
                    return (
                      <div
                        key={comp.id}
                        onClick={() => {
                          const current = selectedCompanies || []
                          let updated
                          if (current.includes(comp.id)) {
                            updated = current.filter(id => id !== comp.id)
                          } else {
                            updated = [...current, comp.id]
                          }
                          setSelectedCompanies(updated.length > 0 ? updated : null)
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs cursor-pointer font-medium transition-colors ${isSelected ? 'bg-[#714B67]/10 text-[#714B67]' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => { }}
                            className="rounded text-[#714B67] focus:ring-[#714B67] cursor-pointer"
                          />
                          <span className="truncate">{comp.name}</span>
                        </div>
                        {isSelected && <Check size={14} className="text-[#714B67] shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Warehouse Selector */}
          {warehouses.length > 0 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md text-sm">
              <Filter size={14} className="text-slate-500" />
              <select
                value={selectedWarehouse}
                onChange={e => setSelectedWarehouse(e.target.value)}
                className="bg-transparent border-none outline-none font-medium text-slate-700 text-xs sm:text-sm cursor-pointer"
              >
                <option value="ALL">All Warehouses ({warehouses.length})</option>
                {warehouses.map(wh => (
                  <option key={wh} value={wh}>{wh}</option>
                ))}
              </select>
            </div>
          )}

          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-md outline-none focus:bg-white focus:border-purple-500 transition-colors"
            />
          </div>

          <button
            onClick={() => loadData(selectedCompanies)}
            disabled={loading}
            className="flex items-center gap-2 bg-[#714B67] hover:bg-[#5c3c54] text-white text-xs sm:text-sm font-medium px-3.5 py-1.5 rounded-md transition-colors shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-5 text-sm flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* ── Exact Odoo Kanban Grid ───────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-44 bg-slate-200/60 rounded-md animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {filteredRecords.map(item => {
            const hasBatches = item.count_picking_batch > 0
            const hasReady = item.count_picking_ready > 0
            const hasWaiting = item.count_picking_waiting > 0
            const hasLate = item.count_picking_late > 0
            const hasBackorders = item.count_picking_backorders > 0

            return (
              <div
                key={item.id}
                onClick={() => handleOpenDetail(item)}
                className="bg-white border border-slate-200 rounded-md p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
              >
                <div>
                  {/* Title & Warehouse */}
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-slate-800 text-base leading-snug group-hover:text-[#714B67] transition-colors">
                        {item.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-normal">
                        {item.warehouse_id?.display_name || ''}
                      </p>
                    </div>
                  </div>

                  {/* Odoo Style Action Buttons */}
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    {hasBatches && (
                      <span className="bg-[#e2e8f0] text-slate-700 text-xs font-semibold px-2.5 py-1 rounded hover:bg-slate-300">
                        {item.count_picking_batch} Batches
                      </span>
                    )}

                    {hasReady ? (
                      <span className="bg-[#e2e8f0] text-slate-700 text-xs font-semibold px-2.5 py-1 rounded hover:bg-slate-300">
                        {item.count_picking_ready} {item.code === 'incoming' ? 'To Receive' : item.code === 'outgoing' ? 'To Deliver' : 'To Process'}
                      </span>
                    ) : (
                      <button className="bg-[#714B67] hover:bg-[#5c3c54] text-white text-xs font-medium px-4 py-1 rounded transition-colors">
                        Open
                      </button>
                    )}
                  </div>

                  {/* Numbers & Stats (Waiting, Late, Backorders, Operations) */}
                  <div className="flex justify-between items-end text-xs mb-1">
                    <div className="space-y-1 text-slate-600">
                      {hasWaiting && (
                        <div className="flex items-center gap-3">
                          <span className="w-16 text-slate-500">Waiting</span>
                          <span className="font-semibold text-[#00878a]">{item.count_picking_waiting}</span>
                        </div>
                      )}
                      {hasLate && (
                        <div className="flex items-center gap-3">
                          <span className="w-16 text-slate-500">Late</span>
                          <span className="font-semibold text-[#00878a]">{item.count_picking_late}</span>
                        </div>
                      )}
                      {hasBackorders && (
                        <div className="flex items-center gap-3">
                          <span className="w-16 text-slate-500">Back Orders</span>
                          <span className="font-semibold text-[#00878a]">{item.count_picking_backorders}</span>
                        </div>
                      )}
                    </div>

                    {item.count_move_ready > 0 && (
                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 block">Operations</span>
                        <span className="font-bold text-[#00878a] text-sm">{item.count_move_ready}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Graph Bar */}
                {renderOdooGraph(item.kanban_dashboard_graph)}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

