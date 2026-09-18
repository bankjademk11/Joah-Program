import React from 'react';
import {
  X,
  CloudRain,
  Sun,
  CloudLightning,
  CloudFog,
  Wind,
  Droplets,
  Gauge,
  Thermometer,
  Calendar,
  Clock,
  Compass,
  MapPin,
  RefreshCw
} from 'lucide-react';
import { KM8_COORDS } from '../../../utils/weatherService';

/**
 * WeatherAppModal
 * Samsung / OneUI Weather App inspired design:
 * - Dynamic animated gradient headers (Storm / Rain / Sun)
 * - Current real-time temperature, condition, feels like
 * - 24-hour horizontal scrolling hourly forecast
 * - 7-day weekly outlook cards
 * - Details grid (Wind, Humidity, Pressure, Cloud Cover)
 */
const WeatherAppModal = ({ isOpen, onClose, weatherData, onRefresh }) => {
  if (!isOpen) return null;

  const data = weatherData || {};
  const isRain = data.isRaining || data.precipitation > 0;
  const temp = data.temperature ?? 26;
  const apparentTemp = data.apparentTemperature ?? 30;
  const precip = data.precipitation ?? 0;
  const humidity = data.humidity ?? 90;
  const windSpeed = data.windSpeed ?? 12;
  const pressure = data.pressure ?? 992;
  const cloudCover = data.cloudCover ?? 100;
  const code = data.weatherCode ?? 95;

  // Weather description in Lao & English
  const getWeatherInfo = (wCode) => {
    if (wCode >= 95) return { text: 'ພາຍຸຝົນຟ້າຮ້ອງ (Thunderstorm)', icon: CloudLightning, color: 'text-amber-300' };
    if (wCode >= 80) return { text: 'ຝົນຕົກຊູ່ (Showers)', icon: CloudRain, color: 'text-sky-300' };
    if (wCode >= 50) return { text: 'ຝົນຕົກ (Rainy)', icon: CloudRain, color: 'text-cyan-300' };
    if (wCode >= 45) return { text: 'ໝອກລົງ (Foggy)', icon: CloudFog, color: 'text-slate-300' };
    if (wCode >= 1) return { text: 'ມີເມກເປັນບາງສ່ວນ (Partly Cloudy)', icon: CloudRain, color: 'text-sky-200' };
    return { text: 'ທ້ອງຟ້າແຈ່ມໃສ (Clear / Sunny)', icon: Sun, color: 'text-amber-400' };
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-2xl bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 border border-slate-800/80 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Dynamic Samsung Weather Ambient Header */}
        <div className={`relative p-6 sm:p-8 overflow-hidden transition-all duration-700 ${
          isRain 
            ? 'bg-gradient-to-br from-indigo-900/80 via-sky-950/70 to-slate-900' 
            : 'bg-gradient-to-br from-amber-600/30 via-orange-950/40 to-slate-900'
        }`}>
          {/* Ambient Lighting Glow */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Bar: Location & Close Button */}
          <div className="flex items-center justify-between relative z-10 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-white/10 text-sky-400 backdrop-blur-sm">
                <MapPin size={18} />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                  Km8 Office · ວຽງຈັນ
                </h3>
                <p className="text-[11px] font-bold text-slate-400">
                  {KM8_COORDS.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Refresh Weather"
                >
                  <RefreshCw size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Hero Temperature & Condition */}
          <div className="flex items-center justify-between relative z-10 pt-2">
            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-6xl sm:text-7xl font-black text-white tracking-tighter">
                  {temp}
                </span>
                <span className="text-3xl sm:text-4xl font-bold text-sky-400">°C</span>
              </div>
              <p className={`text-base sm:text-lg font-black mt-1 flex items-center gap-2 ${currentInfo.color}`}>
                <CurrentIcon size={20} className="animate-pulse" />
                {currentInfo.text}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-1">
                ຮູ້ສຶກຄື (Feels like): {apparentTemp}°C · ປະລິມານຝົນ: {precip} mm/h
              </p>
            </div>

            <div className="p-4 sm:p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md flex flex-col items-center justify-center">
              <CurrentIcon size={56} className={`${currentInfo.color} drop-shadow-[0_0_15px_rgba(56,189,248,0.4)]`} />
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 mt-2">
                {isRain ? 'ຝົນກຳລັງຕົກ' : 'ປອດໂປ່ງ'}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Content: Hourly, Weekly & Details */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">

          {/* 🕒 Hourly Forecast (24 Hours) */}
          {data.hourly && data.hourly.length > 0 && (
            <div className="bg-slate-800/40 rounded-3xl p-4 sm:p-5 border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                <Clock size={14} className="text-sky-400" />
                <span>ພະຍາກອນລາຍຊົ່ວໂມງ (Hourly Forecast)</span>
              </div>
              <div className="flex items-center gap-4 overflow-x-auto pb-2 pt-1 custom-scrollbar">
                {data.hourly.map((h, i) => {
                  const info = getWeatherInfo(h.code);
                  const Icon = info.icon;
                  return (
                    <div
                      key={i}
                      className="flex flex-col items-center justify-center min-w-[70px] p-2.5 rounded-2xl bg-white/5 border border-white/5 hover:border-sky-500/30 transition-all text-center shrink-0"
                    >
                      <span className="text-[11px] font-bold text-slate-400 mb-2">{formatHour(h.time)}</span>
                      <Icon size={24} className={`${info.color} mb-2`} />
                      <span className="text-sm font-black text-white mb-1">{h.temp}°</span>
                      {h.prob > 0 ? (
                        <span className="text-[10px] font-black text-sky-400">{h.prob}%</span>
                      ) : (
                        <span className="text-[10px] text-slate-600">-</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📅 7-Day Outlook */}
          {data.daily && data.daily.length > 0 && (
            <div className="bg-slate-800/40 rounded-3xl p-4 sm:p-5 border border-slate-800/60">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 mb-3">
                <Calendar size={14} className="text-amber-400" />
                <span>ພະຍາກອນ 7 ວັນຂ້າງໜ້າ (7-Day Forecast)</span>
              </div>
              <div className="space-y-2.5">
                {data.daily.map((d, i) => {
                  const info = getWeatherInfo(d.code);
                  const Icon = info.icon;
                  const isToday = i === 0;
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-between p-3 rounded-2xl transition-all ${
                        isToday ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-white/5 border border-white/5'
                      }`}
                    >
                      <div className="w-32 text-left">
                        <p className="text-xs font-black text-white">
                          {isToday ? 'ມື້ນີ້ (Today)' : formatDayName(d.date)}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{info.text.split('(')[0]}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Icon size={20} className={info.color} />
                        {d.precipProbMax > 20 && (
                          <span className="text-[10px] font-bold text-sky-400 w-8 text-right">
                            {d.precipProbMax}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-right">
                        <span className="text-xs font-bold text-slate-400">{d.tempMin}°</span>
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-sky-400 to-amber-400 rounded-full"
                            style={{ width: `${Math.min(100, (d.tempMax - d.tempMin) * 12)}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-black text-white">{d.tempMax}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 📊 Weather Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <Wind size={14} className="text-teal-400" />
                <span>ຄວາມໄວລົມ</span>
              </div>
              <p className="text-lg font-black text-white mt-2">{windSpeed} <span className="text-xs text-slate-400 font-bold">km/h</span></p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <Droplets size={14} className="text-sky-400" />
                <span>ຄວາມຊຸ່ມຊື່ນ</span>
              </div>
              <p className="text-lg font-black text-white mt-2">{humidity}%</p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <Gauge size={14} className="text-purple-400" />
                <span>ຄວາມກົດອາກາດ</span>
              </div>
              <p className="text-lg font-black text-white mt-2">{pressure} <span className="text-xs text-slate-400 font-bold">hPa</span></p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800/60 flex flex-col justify-between">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                <CloudRain size={14} className="text-cyan-400" />
                <span>ເມກປົກຄຸມ</span>
              </div>
              <p className="text-lg font-black text-white mt-2">{cloudCover}%</p>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default WeatherAppModal;
