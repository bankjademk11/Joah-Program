import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { fetchKm8Weather, subscribeWeather } from '../../utils/weatherService';
import WeatherAppModal from '../features/weather/WeatherAppModal';

const BigDigitalClock = ({ onNavigateWeather }) => {
  const [time, setTime] = useState(new Date());
  const [showWeatherModal, setShowWeatherModal] = useState(false);

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

  // Weather Live State via shared cache
  const [weather, setWeather] = useState({
    temperature: 28,
    precipitation: 0,
    weatherCode: 0,
    isRaining: false
  });

  useEffect(() => {
    const unsubscribe = subscribeWeather((data) => {
      if (data) setWeather(data);
    });

    fetchKm8Weather();
    // Safe polling: 5 minutes interval (saves API quota)
    const interval = setInterval(() => {
      fetchKm8Weather();
    }, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const handleWeatherClick = () => {
    if (onNavigateWeather) {
      onNavigateWeather();
    } else {
      setShowWeatherModal(true);
    }
  };

  return (
    <div className="glass-card rounded-[2rem] p-6 border border-slate-200 dark:border-slate-800 shadow-xl bg-white/50 dark:bg-slate-900/50 backdrop-blur-md hidden xl:flex flex-col items-center justify-center min-w-[280px] relative overflow-hidden">
      <div className="flex items-center gap-2 text-joah-orange mb-2">
        <Clock size={20} className="animate-pulse" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">ເວລາປັດຈຸບັນ</span>
      </div>
      <div className="text-5xl font-black text-slate-800 dark:text-white tracking-tighter tabular-nums mb-1">
        {formatTime(time)}
      </div>
      <div className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-3">
        {formatDate(time)}
      </div>

      {/* 🌤️ / 🌧️ Weather Live Status Badge (Km8 Office) - Clickable to open full Weather App */}
      <button
        type="button"
        onClick={handleWeatherClick}
        className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 dark:bg-slate-950/80 border border-slate-700/60 hover:border-sky-500/50 hover:bg-slate-800 text-white shadow-md transition-all duration-300 hover:scale-105 active:scale-95 group cursor-pointer"
        title="ກົດເພື່ອເປີດໜ້າຕ່າງສະພາບອາກາດເຕັມຮູບແບບ (Samsung Weather)"
      >
        {weather.isRaining ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
            </span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-sky-300 group-hover:text-sky-200">
              🌧️ ຝົນ Km8:
            </span>
            <span className="text-[11px] font-mono font-extrabold text-amber-400">
              {weather.temperature !== undefined ? `${weather.temperature}°C` : ''} · {weather.precipitation} mm/h
            </span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] font-bold tracking-wider uppercase text-emerald-300 group-hover:text-emerald-200">
              ☀️ Km8
            </span>
            <span className="text-[12px] font-black text-white font-mono bg-white/10 px-1.5 py-0.5 rounded-md">
              {weather.temperature ?? 28}°C
            </span>
            <span className="text-[11px] font-medium text-slate-300">
              ປອດໂປ່ງ
            </span>
          </>
        )}
        <span className="text-[10px] text-slate-400 opacity-70 group-hover:opacity-100 pl-1 border-l border-slate-700">
          ເບິ່ງເພີ່ມ &rsaquo;
        </span>
      </button>

      {/* Fallback Modal if navigation prop is not passed */}
      {!onNavigateWeather && (
        <WeatherAppModal
          isOpen={showWeatherModal}
          onClose={() => setShowWeatherModal(false)}
          weatherData={weather}
          onRefresh={() => fetchKm8Weather(true)}
        />
      )}
    </div>
  );
};

export default BigDigitalClock;
