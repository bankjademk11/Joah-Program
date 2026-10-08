import React from 'react';
import { ArrowLeft, Calendar, Building2, Barcode, CheckCircle2 } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { getReceiveItemStatus } from '../utils/receiveStatus';

export default function RODetail({
  ro,
  receivingData,
  onBack,
  onUpdateReceived,
  onUpdateRemark
}) {
  if (!ro) return null;

  const itemsWithState = ro.items.map(item => {
    const override = receivingData[item.id];
    const received = override !== undefined ? override.received : null;
    const remark = override !== undefined ? override.remark : '';
    const statusObj = getReceiveItemStatus(item.roQty, received);

    return {
      ...item,
      received,
      remark: remark || (statusObj.status === 'SHORT' ? `ຂາດ ${Math.abs(statusObj.difference)}` : statusObj.status === 'OVER' ? `ເກີນ ${statusObj.difference}` : ''),
      statusObj
    };
  });

  let totalRoQty = 0;
  let totalReceived = 0;
  let okCount = 0;
  let shortCount = 0;
  let overCount = 0;
  let waitingCount = 0;

  itemsWithState.forEach(it => {
    totalRoQty += it.roQty;
    if (it.received !== null && it.received !== undefined && it.received !== '') {
      totalReceived += Number(it.received) || 0;
      if (it.statusObj.status === 'OK') okCount++;
      else if (it.statusObj.status === 'SHORT') shortCount++;
      else if (it.statusObj.status === 'OVER') overCount++;
    } else {
      waitingCount++;
    }
  });

  let overallStatus = 'WAITING';
  let overallLabel = 'ລໍຖ້າກວດ';
  if (waitingCount === 0) {
    if (shortCount === 0 && overCount === 0) {
      overallStatus = 'COMPLETED';
      overallLabel = 'ສຳເລັດແລ້ວ (OK)';
    } else if (shortCount > 0 && overCount === 0) {
      overallStatus = 'SHORT';
      overallLabel = `ຂາດ ${shortCount} ລາຍການ`;
    } else if (overCount > 0 && shortCount === 0) {
      overallStatus = 'OVER';
      overallLabel = `ເກີນ ${overCount} ລາຍການ`;
    } else {
      overallStatus = 'DIFFERENCE';
      overallLabel = 'ບໍ່ຕົງ (ຂາດ/ເກີນ)';
    }
  } else if (waitingCount < itemsWithState.length) {
    overallStatus = 'CHECKING';
    overallLabel = 'ກຳລັງກວດສອບ';
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* TOP HEADER CARD */}
      <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 xl:p-8 shadow-xl border border-blue-100 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-[500px] h-[300px] bg-gradient-to-bl from-blue-100/80 via-sky-50/60 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 text-xs font-black text-indigo-600 uppercase tracking-wider mb-1">
              <span>ລາຍລະອຽດການຮັບສິນຄ້າ (DC → Store)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
              {ro.roNumber}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-mono mt-0.5">
              SO Reference: {ro.soNumber || ro.fullReference}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <StatusBadge status={overallStatus} label={overallLabel} size="md" />
            <button
              onClick={onBack}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-black flex items-center gap-2 border border-slate-200 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <ArrowLeft size={16} />
              <span>ກັບໄປລາຍການ RO</span>
            </button>
          </div>
        </div>

        {/* 4 STATS ACCENT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-indigo-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ຈຳນວນລາຍການ (Items)</div>
            <div className="text-2xl font-black text-indigo-600 font-mono">
              {itemsWithState.length} <span className="text-sm font-sans font-normal text-slate-500">SKUs</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-sky-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ຍອດຕາມບິນ (RO QTY)</div>
            <div className="text-2xl font-black text-sky-600 font-mono">
              {totalRoQty.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-emerald-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ຮັບຕົວຈິງ (RECEIVED)</div>
            <div className={`text-2xl font-black font-mono ${
              totalReceived === totalRoQty ? 'text-emerald-600' :
              totalReceived < totalRoQty ? 'text-rose-600' : 'text-amber-500'
            }`}>
              {waitingCount === itemsWithState.length ? '-' : totalReceived.toLocaleString()}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-l-amber-400 space-y-1">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">ສ່ວນຕ່າງ (DIFFERENCE)</div>
            <div className={`text-2xl font-black font-mono ${
              totalReceived - totalRoQty === 0 ? 'text-emerald-600' :
              totalReceived - totalRoQty < 0 ? 'text-rose-600' : 'text-amber-500'
            }`}>
              {waitingCount === itemsWithState.length ? '-' : (
                totalReceived - totalRoQty === 0 ? 'ຕົງ 0' :
                totalReceived - totalRoQty < 0 ? `ຂາດ ${totalReceived - totalRoQty}` : `ເກີນ +${totalReceived - totalRoQty}`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ITEMS TABLE */}
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-5 xl:p-6 shadow-lg border border-blue-50 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Barcode className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-black text-slate-800">
              ລາຍການສິນຄ້າໃນບິນ ({itemsWithState.length} ລາຍການ)
            </h2>
          </div>
          <div className="text-xs text-slate-400 font-mono">
            Source: DC RO to Store exampo Mr.jo.xlsx
          </div>
        </div>

        {/* DESKTOP TABLE */}
        <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-black text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4 w-12 text-center">#</th>
                <th className="py-3 px-4 w-36">ບາໂຄດ (Barcode)</th>
                <th className="py-3 px-4">ຊື່ສິນຄ້າ (Product Name)</th>
                <th className="py-3 px-4 w-24 text-center">RO Qty</th>
                <th className="py-3 px-4 w-28 text-center">Received</th>
                <th className="py-3 px-4 w-24 text-center">Diff</th>
                <th className="py-3 px-4 w-28 text-center">Status</th>
                <th className="py-3 px-4 w-48">Remark (ໝາຍເຫດ)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {itemsWithState.map((item, idx) => (
                <tr key={item.id} className="hover:bg-blue-50/40 transition">
                  <td className="py-3 px-4 text-center text-xs text-slate-400 font-bold">
                    {idx + 1}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-700">
                    {item.barcode}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-800 text-xs sm:text-sm">
                      {item.productName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      ໜ່ວຍ: {item.unit || 'Unit'}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center font-black text-slate-800 font-mono">
                    {item.roQty}
                  </td>
                  <td className="py-3 px-4 text-center font-black font-mono text-base">
                    <span className={
                      item.received === null ? 'text-slate-300' :
                      item.statusObj.status === 'OK' ? 'text-emerald-600' :
                      item.statusObj.status === 'SHORT' ? 'text-rose-600' : 'text-amber-500'
                    }>
                      {item.received === null ? '-' : item.received}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-black font-mono text-xs">
                    {item.received === null ? (
                      <span className="text-slate-300">-</span>
                    ) : item.statusObj.difference === 0 ? (
                      <span className="text-emerald-600">0</span>
                    ) : item.statusObj.difference < 0 ? (
                      <span className="text-rose-600">{item.statusObj.difference}</span>
                    ) : (
                      <span className="text-amber-500">+{item.statusObj.difference}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <StatusBadge status={item.statusObj.status} label={item.statusObj.label} size="sm" />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600">
                    {item.remark ? (
                      <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                        {item.remark}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MOBILE VIEW */}
        <div className="md:hidden divide-y divide-slate-100">
          {itemsWithState.map((item, idx) => (
            <div key={item.id} className="p-3.5 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 mr-2">#{idx + 1}</span>
                  <span className="font-mono text-xs font-bold text-indigo-700">
                    {item.barcode}
                  </span>
                </div>
                <StatusBadge status={item.statusObj.status} label={item.statusObj.label} size="sm" />
              </div>

              <div className="font-bold text-xs text-slate-800 line-clamp-2">
                {item.productName}
              </div>

              <div className="grid grid-cols-3 gap-2 p-2 bg-slate-50 rounded-xl text-center text-xs font-mono">
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">RO QTY</div>
                  <div className="font-black text-slate-800">{item.roQty}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">RECEIVED</div>
                  <div className="font-black text-indigo-600">
                    {item.received === null ? '-' : item.received}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400 text-[10px] font-sans font-bold">DIFF</div>
                  <div className={`font-black ${
                    item.received === null ? 'text-slate-300' :
                    item.statusObj.difference === 0 ? 'text-emerald-600' :
                    item.statusObj.difference < 0 ? 'text-rose-600' : 'text-amber-500'
                  }`}>
                    {item.received === null ? '-' : item.statusObj.difference}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
