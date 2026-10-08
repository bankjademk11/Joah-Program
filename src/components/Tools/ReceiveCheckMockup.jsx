import React, { useMemo, useState } from "react";
import {
  Home,
  ClipboardList,
  ScanBarcode,
  History,
  Settings,
  Search,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  XCircle,
  RefreshCw,
  Package,
  Store,
  Clock3,
  Plus,
  Minus,
  ScanLine,
  Check,
  MoreHorizontal,
  LayoutDashboard,
  Menu,
} from "lucide-react";
import { getProductImageUrl, handleImageError } from '../../utils/productImageUtils';

/*
  ReceiveCheckMockup.jsx
  React + Tailwind CSS
  Install icons:
    npm i lucide-react

  This is a front-end mockup only.
  Replace demo data / handlers with Supabase later.
*/

const initialROs = [
  {
    id: "0772RO1710100012609",
    so: "SO17-111020001260904393",
    store: "Joah Phonsinuan",
    storeCode: "171010001",
    date: "18 ก.ย. 2026",
    status: "checking",
    total: 320,
    items: [
      { id: 1, barcode: "4549318700012", name: "กระทะ 4\"", qty: 4, received: 4 },
      { id: 2, barcode: "4549318700029", name: "ตะขอแขวน", qty: 4, received: 2 },
      { id: 3, barcode: "4549318700036", name: "ยางรัดผม", qty: 10, received: 12 },
      { id: 4, barcode: "4549318700043", name: "ผ้า Microfiber", qty: 1, received: 1 },
      { id: 5, barcode: "4549318700050", name: "ปากกา", qty: 24, received: 24 },
    ],
  },
  {
    id: "0775RO1710100012609",
    so: "SO17-111020001260904387",
    store: "Nongkhai",
    storeCode: "171020004",
    date: "18 ก.ย. 2026",
    status: "waiting",
    total: 256,
    items: [
      { id: 1, barcode: "4549318700104", name: "แก้วน้ำ", qty: 12, received: 0 },
      { id: 2, barcode: "4549318700111", name: "กล่องเก็บของ", qty: 6, received: 0 },
      { id: 3, barcode: "4549318700128", name: "ถุงซิป", qty: 24, received: 0 },
    ],
  },
  {
    id: "0779RO1710100012609",
    so: "SO17-111020001260904379",
    store: "Vientiane",
    storeCode: "171020005",
    date: "18 ก.ย. 2026",
    status: "waiting",
    total: 412,
    items: [
      { id: 1, barcode: "4549318700203", name: "จานเซรามิก", qty: 20, received: 0 },
      { id: 2, barcode: "4549318700210", name: "ช้อน", qty: 30, received: 0 },
    ],
  },
  {
    id: "0778RO1710100012609",
    so: "SO17-111020001260904370",
    store: "Savannakhet",
    storeCode: "171020006",
    date: "17 ก.ย. 2026",
    status: "done",
    total: 198,
    items: [
      { id: 1, barcode: "4549318700302", name: "แก้วกาแฟ", qty: 10, received: 10 },
      { id: 2, barcode: "4549318700319", name: "ผ้าเช็ดโต๊ะ", qty: 8, received: 8 },
    ],
  },
  {
    id: "0777RO1710100012609",
    so: "SO17-111020001260904365",
    store: "Pakpasak",
    storeCode: "171020003",
    date: "17 ก.ย. 2026",
    status: "waiting",
    total: 364,
    items: [
      { id: 1, barcode: "4549318700401", name: "ชั้นวางของ", qty: 3, received: 0 },
      { id: 2, barcode: "4549318700418", name: "ตะกร้าพลาสติก", qty: 15, received: 0 },
    ],
  },
];

function statusFor(item) {
  if (item.received > item.qty) return "over";
  if (item.received < item.qty) return "short";
  return "ok";
}

function StatusBadge({ status }) {
  const config = {
    ok: {
      label: "OK",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
    short: {
      label: "SHORT",
      icon: XCircle,
      className: "bg-rose-50 text-rose-600 border-rose-100",
    },
    over: {
      label: "OVER",
      icon: AlertCircle,
      className: "bg-amber-50 text-amber-600 border-amber-100",
    },
    checking: {
      label: "กำลังตรวจสอบ",
      icon: RefreshCw,
      className: "bg-amber-50 text-amber-600 border-amber-100",
    },
    waiting: {
      label: "รอรับของ",
      icon: Package,
      className: "bg-blue-50 text-blue-600 border-blue-100",
    },
    done: {
      label: "เสร็จสิ้น",
      icon: CheckCircle2,
      className: "bg-emerald-50 text-emerald-600 border-emerald-100",
    },
  };

  const item = config[status] || config.waiting;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${item.className}`}
    >
      <Icon size={13} />
      {item.label}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, tone = "purple" }) {
  const tones = {
    purple: "bg-violet-50 text-violet-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_10px_30px_rgba(75,60,140,0.06)]">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400">{title}</p>
          <p className="mt-2 text-2xl font-black text-slate-800">{value}</p>
        </div>
        <div className={`rounded-xl p-2.5 ${tones[tone]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
        active
          ? "bg-violet-500 text-white shadow-lg shadow-violet-200"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function Sidebar({ activePage, setActivePage, mobileOpen, setMobileOpen }) {
  return (
    <>
      {mobileOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col bg-[#15192f] px-4 py-5 text-white transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center gap-3 px-2">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 to-fuchsia-300 text-xl shadow-lg">
            🎀
          </div>
          <div>
            <h1 className="text-lg font-black">Receive Check</h1>
            <p className="text-xs text-slate-400">DC → Store</p>
          </div>
        </div>

        <nav className="space-y-2">
          <NavItem
            icon={Home}
            label="หน้าหลัก"
            active={activePage === "dashboard"}
            onClick={() => setActivePage("dashboard")}
          />
          <NavItem
            icon={ClipboardList}
            label="รายการ RO"
            active={activePage === "ro"}
            onClick={() => setActivePage("ro")}
          />
          <NavItem
            icon={ScanBarcode}
            label="สแกนสินค้า"
            active={activePage === "scan"}
            onClick={() => setActivePage("scan")}
          />
          <NavItem
            icon={History}
            label="ประวัติการรับของ"
            active={activePage === "history"}
            onClick={() => setActivePage("history")}
          />
          <NavItem
            icon={Settings}
            label="ตั้งค่า"
            active={activePage === "settings"}
            onClick={() => setActivePage("settings")}
          />
        </nav>

        <div className="mt-auto rounded-2xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-violet-300 text-sm">
              👩🏻
            </div>
            <div>
              <p className="text-xs font-bold">AM Manager</p>
              <p className="text-[11px] text-slate-400">สายงาน DC</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

function Dashboard({ ros, onOpenRO }) {
  const checking = ros.filter((x) => x.status === "checking").length;
  const done = ros.filter((x) => x.status === "done").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-violet-500">
            Receive Control Center
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-800">รายการ RO</h2>
          <p className="mt-1 text-sm text-slate-400">
            ตรวจสอบและเช็กการรับสินค้าจาก DC ไปยัง Store
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
          <CalendarDays size={16} />
          วันที่ 18 ก.ย. 2026
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard title="ทั้งหมด" value={ros.length} icon={LayoutDashboard} />
        <StatCard title="รอรับของ" value={ros.filter((x) => x.status === "waiting").length} icon={ClipboardList} tone="blue" />
        <StatCard title="กำลังตรวจสอบ" value={checking} icon={RefreshCw} tone="amber" />
        <StatCard title="เสร็จสิ้น" value={done} icon={CheckCircle2} tone="emerald" />
      </div>

      <ROTable ros={ros} onOpenRO={onOpenRO} />
    </div>
  );
}

function ROTable({ ros, onOpenRO }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(75,60,140,0.06)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-2">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              placeholder="ค้นหา RO / ร้าน / เลขที่..."
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-300 md:w-72"
            />
          </div>
          <button className="rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-500">
            ทั้งหมด
          </button>
        </div>
        <button className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-200">
          + สร้างรายการตรวจรับ
        </button>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-slate-50/80 text-left text-xs font-bold text-slate-400">
            <tr>
              <th className="px-5 py-3">ลำดับ</th>
              <th className="px-5 py-3">RO Number</th>
              <th className="px-5 py-3">ร้านค้า (Store)</th>
              <th className="px-5 py-3">วันที่ส่ง</th>
              <th className="px-5 py-3">สถานะ</th>
              <th className="px-5 py-3">ยอดรวม</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {ros.map((ro, index) => (
              <tr key={ro.id} className="border-t border-slate-100 hover:bg-violet-50/30">
                <td className="px-5 py-4 text-slate-400">{index + 1}</td>
                <td className="px-5 py-4 font-bold text-slate-700">{ro.id}</td>
                <td className="px-5 py-4">
                  <div className="font-semibold text-slate-700">{ro.store}</div>
                  <div className="text-xs text-slate-400">{ro.storeCode}</div>
                </td>
                <td className="px-5 py-4 text-slate-500">{ro.date}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={ro.status} />
                </td>
                <td className="px-5 py-4 font-semibold text-slate-600">
                  {ro.total.toLocaleString()} หน่วย
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => onOpenRO(ro)}
                    className="rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-600 hover:bg-violet-100"
                  >
                    ดูรายละเอียด
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="divide-y divide-slate-100 md:hidden">
        {ros.map((ro, index) => (
          <button
            key={ro.id}
            onClick={() => onOpenRO(ro)}
            className="flex w-full items-start justify-between gap-3 p-4 text-left"
          >
            <div>
              <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                #{index + 1} · {ro.date}
              </div>
              <p className="font-black text-slate-700">{ro.id}</p>
              <p className="mt-1 text-sm text-slate-500">{ro.store}</p>
              <div className="mt-2">
                <StatusBadge status={ro.status} />
              </div>
            </div>
            <ChevronRight className="mt-5 text-slate-300" size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

function ROReceivePage({ ro, onBack }) {
  const [items, setItems] = useState(ro.items);
  const [barcode, setBarcode] = useState("");

  const summary = useMemo(() => {
    const result = { ok: 0, short: 0, over: 0 };
    items.forEach((item) => {
      result[statusFor(item)] += 1;
    });
    return result;
  }, [items]);

  const updateReceived = (id, nextValue) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? { ...item, received: Math.max(0, Number(nextValue) || 0) }
          : item
      )
    );
  };

  const handleScan = () => {
    const found = items.find((item) => item.barcode === barcode.trim());
    if (!found) return;

    updateReceived(found.id, found.received + 1);
    setBarcode("");
  };

  const totalReceived = items.reduce((sum, item) => sum + item.received, 0);
  const totalRO = items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-violet-600"
        >
          <ArrowLeft size={17} />
          กลับรายการ RO
        </button>
        <StatusBadge status="checking" />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard label="RO Number" value={ro.id} />
        <InfoCard label="วันที่ส่ง" value={ro.date} icon={CalendarDays} />
        <InfoCard
          label="ร้านค้า (Store)"
          value={ro.store}
          subValue={ro.storeCode}
          icon={Store}
        />
      </div>

      <div className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_10px_30px_rgba(75,60,140,0.06)]">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-bold text-slate-400">
              สแกน Barcode หรือกรอกรหัสสินค้า
            </label>
            <div className="relative">
              <ScanLine
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400"
              />
              <input
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleScan()}
                placeholder="เช่น 4549318700012"
                className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
              />
            </div>
          </div>
          <button
            onClick={handleScan}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-6 py-3 font-bold text-white shadow-lg shadow-violet-200"
          >
            <ScanBarcode size={18} />
            สแกน
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_10px_30px_rgba(75,60,140,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold text-slate-400">
              <tr>
                <th className="px-4 py-3">ลำดับ</th>
                <th className="px-4 py-3">Barcode</th>
                <th className="px-4 py-3">ชื่อสินค้า</th>
                <th className="px-4 py-3 text-center">RO Qty</th>
                <th className="px-4 py-3 text-center">Received</th>
                <th className="px-4 py-3 text-center">สถานะ</th>
                <th className="px-4 py-3 text-center">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const status = statusFor(item);
                const diff = item.received - item.qty;

                return (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 shrink-0 rounded-lg bg-slate-50 border border-slate-100 p-1 flex items-center justify-center overflow-hidden shadow-sm">
                          <img
                            src={getProductImageUrl(item.barcode)}
                            alt={item.name}
                            onError={(e) => handleImageError(e, item.barcode)}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <span className="font-mono text-xs font-semibold text-slate-600">
                          {item.barcode}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">
                      {item.name}
                    </td>
                    <td className="px-4 py-4 text-center font-bold text-slate-700">
                      {item.qty}
                    </td>
                    <td className="px-4 py-4">
                      <div className="mx-auto flex w-fit items-center gap-1 rounded-xl border border-slate-200 p-1">
                        <button
                          onClick={() => updateReceived(item.id, item.received - 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          value={item.received}
                          onChange={(e) =>
                            updateReceived(item.id, e.target.value)
                          }
                          className="w-12 bg-transparent text-center font-black outline-none"
                        />
                        <button
                          onClick={() => updateReceived(item.id, item.received + 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-violet-500 hover:bg-violet-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <StatusBadge status={status} />
                    </td>
                    <td className="px-4 py-4 text-center text-xs font-semibold">
                      {status === "ok" && <span className="text-slate-300">-</span>}
                      {status === "short" && (
                        <span className="text-rose-500">ขาด {Math.abs(diff)}</span>
                      )}
                      {status === "over" && (
                        <span className="text-amber-500">เกิน {diff}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-white p-4">
          <SummaryPill icon={CheckCircle2} label="OK" value={summary.ok} tone="ok" />
          <SummaryPill icon={XCircle} label="SHORT" value={summary.short} tone="short" />
          <SummaryPill icon={AlertCircle} label="OVER" value={summary.over} tone="over" />

          <div className="ml-auto flex w-full flex-col gap-2 md:w-auto md:flex-row">
            <div className="rounded-xl bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500">
              Received {totalReceived.toLocaleString()} / {totalRO.toLocaleString()} หน่วย
            </div>
            <button
              onClick={() => alert("บันทึกการรับสินค้าเรียบร้อย")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200"
            >
              <Check size={17} />
              ยืนยันการรับสินค้า
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, subValue, icon: Icon = ClipboardList }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      <p className="break-all font-black text-slate-700">{value}</p>
      {subValue && <p className="mt-1 text-xs text-slate-400">{subValue}</p>}
    </div>
  );
}

function SummaryPill({ icon: Icon, label, value, tone }) {
  const classes = {
    ok: "bg-emerald-50 text-emerald-600",
    short: "bg-rose-50 text-rose-600",
    over: "bg-amber-50 text-amber-600",
  };

  return (
    <div className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold ${classes[tone]}`}>
      <Icon size={14} />
      {label} {value}
    </div>
  );
}

function ScanPage({ onOpenRO }) {
  const [barcode, setBarcode] = useState("");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-violet-500">
          Quick Receive
        </p>
        <h2 className="mt-1 text-2xl font-black text-slate-800">สแกนสินค้า</h2>
        <p className="mt-1 text-sm text-slate-400">
          สแกนเพื่อเพิ่มจำนวนรับเข้าของรายการ RO อัตโนมัติ
        </p>
      </div>

      <div className="rounded-[28px] border border-violet-100 bg-white p-5 shadow-[0_15px_45px_rgba(75,60,140,0.08)]">
        <div className="rounded-[22px] border-2 border-dashed border-violet-200 bg-violet-50/50 px-5 py-10 text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-white text-violet-500 shadow-sm">
            <ScanBarcode size={40} />
          </div>
          <h3 className="mt-4 text-xl font-black text-slate-700">สแกน Barcode</h3>
          <p className="mt-2 text-sm text-slate-400">
            ใช้กล้องเครื่องสแกน หรือกรอกรหัสสินค้า
          </p>
        </div>

        <div className="mt-5">
          <div className="relative">
            <ScanLine
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-violet-400"
            />
            <input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="เช่น 4549318700012"
              className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <button
            onClick={() => {
              const ro = initialROs[0];
              onOpenRO(ro);
            }}
            className="mt-3 w-full rounded-xl bg-violet-500 px-4 py-3 font-bold text-white shadow-lg shadow-violet-200"
          >
            ค้นหา
          </button>
        </div>

        <div className="mt-7 text-center text-6xl">📦</div>
        <p className="mt-2 text-center text-sm font-bold text-violet-500">
          สแกนเลย! เช็กของให้ครบ
        </p>
      </div>
    </div>
  );
}

export default function ReceiveCheckMockup() {
  const [activePage, setActivePage] = useState("dashboard");
  const [selectedRO, setSelectedRO] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const openRO = (ro) => {
    setSelectedRO(ro);
    setActivePage("receive");
    setMobileOpen(false);
  };

  const renderPage = () => {
    if (activePage === "receive" && selectedRO) {
      return <ROReceivePage ro={selectedRO} onBack={() => setActivePage("dashboard")} />;
    }

    if (activePage === "scan") {
      return <ScanPage onOpenRO={openRO} />;
    }

    if (activePage === "history") {
      return (
        <PlaceholderPage
          title="ประวัติการรับของ"
          description="ดูรายการที่ยืนยันการรับสินค้าแล้ว"
          icon={History}
        />
      );
    }

    if (activePage === "settings") {
      return (
        <PlaceholderPage
          title="ตั้งค่า"
          description="ตั้งค่า Store, Scanner และการทำงานของระบบ"
          icon={Settings}
        />
      );
    }

    return <Dashboard ros={initialROs} onOpenRO={openRO} />;
  };

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-slate-800">
      <div className="flex min-h-screen">
        <Sidebar
          activePage={activePage === "receive" ? "ro" : activePage}
          setActivePage={(page) => {
            setSelectedRO(null);
            setActivePage(page);
          }}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-100 bg-[#f7f8fc]/90 px-4 backdrop-blur md:px-7 lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl bg-white p-2 text-slate-600 shadow-sm"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-500 text-sm">
                🎀
              </div>
              <span className="text-sm font-black">Receive Check</span>
            </div>
            <button className="rounded-xl bg-white p-2 text-slate-500 shadow-sm">
              <MoreHorizontal size={20} />
            </button>
          </header>

          <div className="mx-auto w-full max-w-[1400px] p-4 md:p-7">
            {renderPage()}
          </div>
        </main>
      </div>
    </div>
  );
}

function PlaceholderPage({ title, description, icon: Icon }) {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="text-center">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-violet-50 text-violet-500">
          <Icon size={30} />
        </div>
        <h2 className="mt-4 text-2xl font-black text-slate-800">{title}</h2>
        <p className="mt-2 text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}
