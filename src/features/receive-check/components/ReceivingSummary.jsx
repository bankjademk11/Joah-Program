import React from 'react';

export default function ReceivingSummary({ stats, totalROCount }) {
  const cards = [
    {
      title: 'TOTAL COUNTED QTY',
      value: stats.totalReceivedQty || 0,
      color: 'border-l-amber-400',
      numColor: 'text-amber-500'
    },
    {
      title: 'TOTAL ITEMS / ROWS',
      value: stats.totalItemRows || 0,
      color: 'border-l-emerald-400',
      numColor: 'text-emerald-600'
    },
    {
      title: 'UNIQUE BARCODES',
      value: stats.uniqueBarcodesCount || 0,
      color: 'border-l-sky-400',
      numColor: 'text-sky-600'
    },
    {
      title: 'ACTIVE BRANCHES / RO',
      value: totalROCount,
      suffix: 'RO',
      color: 'border-l-indigo-400',
      numColor: 'text-indigo-600'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
      {cards.map((card, i) => (
        <div
          key={i}
          className={`bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow space-y-1 border-l-4 ${card.color}`}
        >
          <div className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">
            {card.title}
          </div>
          <div className={`text-2xl sm:text-3xl font-black font-mono ${card.numColor}`}>
            {card.value.toLocaleString()} {card.suffix && <span className="text-lg font-bold ml-1">{card.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
