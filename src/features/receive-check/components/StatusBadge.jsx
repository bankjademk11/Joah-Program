import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Clock, Check } from 'lucide-react';

export default function StatusBadge({ status, label, size = 'md' }) {
  const isSm = size === 'sm';

  const config = {
    OK: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <Check className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    COMPLETED: {
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    SHORT: {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: <AlertCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    OVER: {
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: <AlertTriangle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    DIFFERENCE: {
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: <AlertTriangle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    CHECKING: {
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: <Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    },
    WAITING: {
      bg: 'bg-slate-100 text-slate-600 border-slate-200',
      icon: <Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
    }
  };

  const itemConfig = config[status] || config.WAITING;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold border rounded-full font-['Noto_Sans_Lao',sans-serif] ${
        isSm ? 'px-2.5 py-0.5 text-[11px]' : 'px-3 py-1 text-xs'
      } ${itemConfig.bg}`}
    >
      {itemConfig.icon}
      <span>{label || status}</span>
    </span>
  );
}
