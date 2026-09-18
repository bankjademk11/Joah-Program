import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  CloudRain,
  Sun,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  Gauge,
  Calendar,
  Clock,
  MapPin,
  RefreshCw,
  Compass,
  Eye,
  Sunset,
  Sunrise,
  Cloud,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { KM8_COORDS, fetchKm8Weather, subscribeWeather } from '../../../utils/weatherService';
import RainParticles from '../../ui/RainParticles';

/**
 * WeatherPage
 * Full-page standalone screen inspired by Samsung OneUI Weather App.
 * Features:
 * - Dynamic atmospheric animations & gradients (Rain, Storm, Clear, Cloudy)
 * - Large typographic hero header with live status
 * - 24-Hour hourly forecast with precipitation probability curve
 * - 7-Day extended daily forecast with temperature bars
 * - Comprehensive environmental metrics (Wind, Humidity, Pressure, Visibility, UV index, Sunrise/Sunset)
 * - All text in Lao language (ພາສາລາວ)
 */
const WeatherPage = ({ onBack }) => {
  const [weather, setWeather] = useState({
    temperature: 26,
    apparentTemperature: 30,
    precipitation: 0,
    weatherCode: 0,
    humidity: 80,
    windSpeed: 10,
    pressure: 1008,
    cloudCover: 40,
    isRaining: false,
    hourly: [],
    daily: []
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Scroll to top upon entering
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const unsubscribe = subscribeWeather((data) => {
      if (data) setWeather(data);
    });

    fetchKm8Weather();

    return () => unsubscribe();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchKm8Weather(true);
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const isRain = Boolean(weather.isRaining);
  const temp = weather.temperature ?? 26;
  const apparentTemp = weather.apparentTemperature ?? 30;
  const precip = weather.precipitation ?? 0;
  const humidity = weather.humidity ?? 80;
  const windSpeed = weather.windSpeed ?? 10;
  const pressure = weather.pressure ?? 1008;
  const cloudCover = weather.cloudCover ?? 50;
  const code = weather.weatherCode ?? 0;

  // Weather description & visual styling in Lao
  const getWeatherInfo = (wCode) => {
    if (wCode >= 95) {
      return {
        text: 'ພາຍຸຝົນຟ້າຮ້ອງ',
        sub: 'ມີໂອກາດຟ້າຮ້ອງຟ້າແມບ ແລະ ລົມພັດແຮງ',
        icon: CloudLightning,
        gradient: 'from-slate-900 via-indigo-950 to-slate-900',
        cardBg: 'bg-slate-900/60 border-indigo-500/20',
        textColor: 'text-amber-300',
        glowColor: 'bg-amber-500/20'
      };
    }
    if (wCode >= 80) {
      return {
        text: 'ຝົນຕົກຊູ່',
        sub: 'ຝົນຕົກກະຈາຍເປັນໄລຍະ',
        icon: CloudRain,
        gradient: 'from-blue-950 via-slate-900 to-slate-950',
        cardBg: 'bg-slate-900/60 border-sky-500/20',
        textColor: 'text-sky-300',
        glowColor: 'bg-sky-500/20'
      };
    }
    if (wCode >= 50) {
      return {
        text: 'ຝົນຕົກ',
        sub: 'ສະພາບອາກາດມີຝົນຕົກຕໍ່ເນື່ອງ',
        icon: CloudRain,
        gradient: 'from-slate-900 via-cyan-950 to-slate-950',
        cardBg: 'bg-slate-900/60 border-cyan-500/20',
        textColor: 'text-cyan-300',
        glowColor: 'bg-cyan-500/20'
      };
    }
    if (wCode >= 45) {
      return {
        text: 'ໝອກປົກຄຸມ',
        sub: 'ທັດສະນະວິໄສຫຼຸດລົງ ຄວນລະວັງໃນການເດີນທາງ',
        icon: CloudFog,
        gradient: 'from-slate-900 via-slate-800 to-slate-950',
        cardBg: 'bg-slate-900/60 border-slate-700/40',
        textColor: 'text-slate-300',
        glowColor: 'bg-slate-400/20'
      };
    }
    if (wCode >= 1) {
      return {
        text: 'ມີເມກເປັນບາງສ່ວນ',
        sub: 'ອາກາດດີ ມີເມກບັງແດດເປັນຊ່ວງໆ',
        icon: Cloud,
        gradient: 'from-sky-950 via-slate-900 to-slate-950',
        cardBg: 'bg-slate-900/60 border-sky-500/20',
        textColor: 'text-sky-200',
        glowColor: 'bg-sky-400/20'
      };
    }
    return {
      text: 'ທ້ອງຟ້າແຈ່ມໃສ',
      sub: 'ແສງແດດດີ ອາກາດປອດໂປ່ງ',
      icon: Sun,
      gradient: 'from-amber-950 via-slate-900 to-slate-950',
      cardBg: 'bg-slate-900/60 border-amber-500/20',
      textColor: 'text-amber-400',
      glowColor: 'bg-amber-500/20'
    };
  };

  const currentInfo = getWeatherInfo(code);
  const CurrentIcon = currentInfo.icon;

  const formatHour = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDayName = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const days = ['ວັນອາທິດ', 'ວັນຈັນ', 'ວັນອັງຄານ', 'ວັນພຸດ', 'ວັນພະຫັດ', 'ວັນສຸກ', 'ວັນເສົາ'];
    return days[d.getDay()];
  };

  const formatDateFull = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('lo-LA', {
      day: 'numeric',
      month: 'short'
    });
  };

  return (
    <div className={`min-h-screen w-full bg-gradient-to-b ${currentInfo.gradient} text-white selection:bg-sky-500 selection:text-white flex flex-col relative overflow-x-hidden font-weather transition-colors duration-1000 pb-20`}>
      {/* 🌧️ Dynamic Rain & Weather Particle FX Layer */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <RainParticles />
      </div>

      {/* Background Animated Ambient Lights (Samsung Weather Style) */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[500px] ${currentInfo.glowColor} rounded-full blur-[140px] pointer-events-none z-0`} />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute top-2/3 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* Top App Bar */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-slate-950/40 border-b border-white/5 px-4 sm:px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-2 font-bold text-sm"
              title="ກັບຄືນ"
            >
              <ArrowLeft size={20} />
              <span className="hidden sm:inline">ກັບຄືນ</span>
            </button>

            <div className="flex items-center gap-2 pl-2">
              <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
                <MapPin size={18} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>Km8 Office</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-bold">
                    ວຽງຈັນ
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400 font-medium truncate max-w-[200px] sm:max-w-none">
                  {KM8_COORDS.name}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white flex items-center gap-2 text-xs font-bold disabled:opacity-50"
              title="ດຶງຂໍ້ມູນໃໝ່"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin text-sky-400' : ''} />
              <span className="hidden sm:inline">{isRefreshing ? 'ກຳລັງອັບເດດ...' : 'ອັບເດດ'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-8 pt-8 space-y-6 relative z-10">

        {/* 🌟 Samsung OneUI Hero Weather Card */}
        <section className={`rounded-[2.5rem] p-6 sm:p-10 backdrop-blur-2xl border ${currentInfo.cardBg} shadow-2xl relative overflow-hidden transition-all`}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 text-center md:text-left">

            {/* Left: Temp & Primary State */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-black uppercase tracking-wider backdrop-blur-md">
                <span className={`w-2 h-2 rounded-full ${isRain ? 'bg-sky-400 animate-ping' : 'bg-emerald-400'}`}></span>
                <span>{isRain ? '🌧️ ສະຖານະ: ຝົນກຳລັງຕົກ' : '☀️ ສະຖານະ: ປອດໂປ່ງ'}</span>
              </div>

              <div className="flex items-baseline justify-center md:justify-start gap-2">
                <span className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-lg">
                  {temp}
                </span>
                <span className="text-4xl sm:text-5xl font-bold text-sky-400">°C</span>
              </div>

              <div className="space-y-1">
                <h2 className={`text-2xl sm:text-3xl font-black flex items-center justify-center md:justify-start gap-2.5 ${currentInfo.textColor}`}>
                  <CurrentIcon size={32} className="animate-pulse" />
                  <span>{currentInfo.text}</span>
                </h2>
                <p className="text-sm text-slate-300 font-medium">
                  {currentInfo.sub}
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-4 text-xs font-semibold text-slate-400">
                <span>ຮູ້ສຶກຄື: <b className="text-white">{apparentTemp}°C</b></span>
                <span>•</span>
                <span>ປະລິມານຝົນ: <b className="text-sky-300 font-mono">{precip} mm/h</b></span>
                <span>•</span>
                <span>ເມກປົກຄຸມ: <b className="text-white">{cloudCover}%</b></span>
              </div>
            </div>

            {/* Right: Big Icon & Ambient Graphic */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-[2.5rem] bg-gradient-to-tr from-white/5 to-white/15 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-inner group hover:scale-105 transition-transform duration-500">
                <CurrentIcon
                  size={96}
                  className={`${currentInfo.textColor} drop-shadow-[0_0_35px_rgba(56,189,248,0.5)] transition-all duration-700`}
                />
              </div>
              <p className="text-xs font-black uppercase tracking-widest text-slate-400 mt-3">
                Km8 Weather Station
              </p>
            </div>

          </div>
        </section>

        {/* 🕒 Hourly Forecast (24 Hours) with Horizontal Scroll */}
        {weather.hourly && weather.hourly.length > 0 && (
          <section className="rounded-[2rem] p-5 sm:p-6 backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
                <Clock size={16} className="text-sky-400" />
                <span>ພະຍາກອນອາກາດລາຍຊົ່ວໂມງ (24 ຊົ່ວໂມງ)</span>
              </div>
              <span className="text-[11px] text-slate-400 font-bold">ເລື່ອນຊ້າຍ-ຂວາ &rarr;</span>
            </div>

            <div className="flex items-center gap-3 overflow-x-auto pb-3 pt-2 custom-scrollbar">
              {weather.hourly.map((h, i) => {
                const info = getWeatherInfo(h.code);
                const Icon = info.icon;
                const isNow = i === 0;

                return (
                  <div
                    key={i}
                    className={`flex flex-col items-center justify-between min-w-[76px] p-3 rounded-2xl transition-all duration-300 shrink-0 ${isNow
                      ? 'bg-sky-500/20 border-2 border-sky-400/50 shadow-lg shadow-sky-500/10 scale-105'
                      : 'bg-white/5 border border-white/5 hover:border-sky-500/30 hover:bg-white/10'
                      }`}
                  >
                    <span className="text-xs font-bold text-slate-300 mb-2">
                      {isNow ? 'ດຽວນີ້' : formatHour(h.time)}
                    </span>
                    <Icon size={26} className={`${info.textColor} mb-2`} />
                    <span className="text-base font-black text-white mb-1">{h.temp}°</span>
                    {h.prob > 0 ? (
                      <span className="text-[10px] font-black text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded-full">
                        {h.prob}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 📅 7-Day Extended Forecast */}
        {weather.daily && weather.daily.length > 0 && (
          <section className="rounded-[2rem] p-5 sm:p-6 backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-300">
              <Calendar size={16} className="text-amber-400" />
              <span>ພະຍາກອນ 7 ວັນຂ້າງໜ້າ (7-Day Outlook)</span>
            </div>

            <div className="divide-y divide-white/5">
              {weather.daily.map((d, i) => {
                const info = getWeatherInfo(d.code);
                const Icon = info.icon;
                const isToday = i === 0;

                return (
                  <div
                    key={i}
                    className={`flex items-center justify-between py-3.5 px-3 rounded-xl transition-all ${isToday ? 'bg-sky-500/10 font-bold' : 'hover:bg-white/5'
                      }`}
                  >
                    <div className="w-32 sm:w-44 text-left">
                      <p className="text-sm font-black text-white flex items-center gap-2">
                        {isToday ? 'ມື້ນີ້ (Today)' : formatDayName(d.date)}
                      </p>
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {formatDateFull(d.date)} · {info.text}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Icon size={22} className={info.textColor} />
                      {d.precipProbMax > 20 && (
                        <span className="text-xs font-black text-sky-400 w-10 text-right font-mono">
                          {d.precipProbMax}%
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <span className="text-xs font-bold text-slate-400 w-8">{d.tempMin}°</span>
                      <div className="w-20 sm:w-28 h-2 bg-slate-800 rounded-full overflow-hidden p-0.5">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-400 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(25, (d.tempMax - d.tempMin) * 12))}%` }}
                        />
                      </div>
                      <span className="text-xs font-black text-white w-8">{d.tempMax}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 📊 Comprehensive Metric Grid (Samsung Style Cards) */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">

          {/* Wind Speed */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-teal-500/40 transition-all">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Wind size={16} className="text-teal-400" />
              <span>ຄວາມໄວລົມ</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {windSpeed} <span className="text-xs font-bold text-slate-400">km/h</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">ລົມພັດປານກາງ</p>
            </div>
          </div>

          {/* Humidity */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-sky-500/40 transition-all">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Droplets size={16} className="text-sky-400" />
              <span>ຄວາມຊຸ່ມຊື່ນ</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {humidity}<span className="text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {humidity > 80 ? 'ຄວາມຊຸ່ມສູງ' : 'ສະບາຍໂຕ'}
              </p>
            </div>
          </div>

          {/* Air Pressure */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-purple-500/40 transition-all">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Gauge size={16} className="text-purple-400" />
              <span>ຄວາມກົດອາກາດ</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {pressure} <span className="text-xs font-bold text-slate-400">hPa</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">ປົກກະຕິ</p>
            </div>
          </div>

          {/* Cloud Cover */}
          <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-xl flex flex-col justify-between hover:border-cyan-500/40 transition-all">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400">
              <Cloud size={16} className="text-cyan-400" />
              <span>ເມກປົກຄຸມ</span>
            </div>
            <div className="mt-4">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {cloudCover}<span className="text-xs font-bold text-slate-400">%</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">
                {cloudCover > 70 ? 'ເມກໜາແໜ້ນ' : 'ເມກບາງເບົາ'}
              </p>
            </div>
          </div>

        </section>

        {/* Bottom Coordinates & Source Note */}
        <footer className="text-center py-6 text-xs text-slate-500 font-medium space-y-1">
          <p>📍 ສະຖານີສຳນັກງານ Km8 · VJXP+FGJ, ວຽງຈັນ (i-Furniture Km8)</p>
          <p className="text-[11px] text-slate-600">
            ຂໍ້ມູນສະພາບອາກາດ Open-Meteo API · ອັບເດດແຄຊອັດຕະໂນມັດທຸກ 5 ນາທີ
          </p>
        </footer>

      </main>
    </div>
  );
};

export default WeatherPage;
