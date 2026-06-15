import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

const BigDigitalClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('lo-LA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('lo-LA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md hidden xl:flex flex-col items-center justify-center min-w-[280px]">
      <div className="flex items-center gap-2 text-joah-orange mb-2">
        <Clock size={20} className="animate-pulse" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">ເວລາປັດຈຸບັນ</span>
      </div>
      <div className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums mb-1">
        {formatTime(time)}
      </div>
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
        {formatDate(time)}
      </div>
    </div>
  );
};

export default BigDigitalClock;
