// weatherService.js
// Shared Cache for Open-Meteo Weather API
// Prevents duplicate requests, protects quota (10,000 req/day limit), and caches responses for 5 minutes.

export const KM8_COORDS = {
  latitude: 17.8985,
  longitude: 102.6367,
  name: 'ສຳນັກງານ i-Furniture Km8 (VJXP+FGJ, Vientiane)'
};

const CACHE_KEY = 'joah_km8_weather_full_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes cache

let memoryCache = null;
let pendingPromise = null;
const listeners = new Set();

export const subscribeWeather = (callback) => {
  listeners.add(callback);
  if (memoryCache) {
    callback(memoryCache);
  }
  return () => listeners.delete(callback);
};

const notifyListeners = (data) => {
  listeners.forEach(cb => {
    try {
      cb(data);
    } catch (_) {}
  });
};

export const fetchKm8Weather = async (force = false) => {
  const now = Date.now();

  // 1. Check Memory Cache
  if (!force && memoryCache && (now - memoryCache.timestamp < CACHE_DURATION_MS)) {
    return memoryCache;
  }

  // 2. Check localStorage Cache
  if (!force && !memoryCache) {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (now - parsed.timestamp < CACHE_DURATION_MS) {
          memoryCache = parsed;
          notifyListeners(memoryCache);
          return memoryCache;
        }
      }
    } catch (_) {}
  }

  // 3. Deduplicate in-flight network requests
  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = (async () => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${KM8_COORDS.latitude}&longitude=${KM8_COORDS.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FBangkok&forecast_days=7`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Weather HTTP error: ${res.status}`);
      const data = await res.json();

      const current = data?.current || {};
      const precip = current.precipitation ?? 0;
      const rainVal = current.rain ?? 0;
      const showersVal = current.showers ?? 0;
      const rawCode = current.weather_code ?? 0;

      // 🌧️ Rain Detection Rule:
      // Open-Meteo returns precipitation = 0.1 mm/h for residual drizzle even hours after rain has ceased.
      // Real noticeable rain must have precipitation >= 0.25 mm/h AND weather_code >= 51 (or rainVal >= 0.25).
      const hasActualRain = (precip >= 0.25 || rainVal >= 0.25 || showersVal >= 0.25) && rawCode >= 51;
      const isRaining = hasActualRain;

      // Determine effective display code:
      // If precipitation < 0.25 mm/h, rain has stopped (show clear or partly cloudy according to cloud cover)
      let displayCode = rawCode;
      if (!isRaining && (rawCode >= 50 && rawCode <= 99)) {
        displayCode = (current.cloud_cover ?? 80) > 75 ? 3 : (current.cloud_cover ?? 80) > 30 ? 2 : 0;
      }

      // Find current hour index in hourly array to align forecast starting from current time
      const hourlyTimes = data?.hourly?.time || [];
      const currentIsoPrefix = current.time ? current.time.slice(0, 13) : '';
      let currentHourIndex = hourlyTimes.findIndex(t => t.startsWith(currentIsoPrefix));
      if (currentHourIndex === -1) currentHourIndex = 0;

      const hourlySlice = hourlyTimes.slice(currentHourIndex, currentHourIndex + 24).map((timeStr, offset) => {
        const idx = currentHourIndex + offset;
        return {
          time: timeStr,
          temp: Math.round(data?.hourly?.temperature_2m?.[idx] ?? 25),
          prob: data?.hourly?.precipitation_probability?.[idx] ?? 0,
          precip: data?.hourly?.precipitation?.[idx] ?? 0,
          code: data?.hourly?.weather_code?.[idx] ?? 0
        };
      });

      const weatherResult = {
        // Current metrics
        temperature: Math.round(current.temperature_2m ?? 27),
        apparentTemperature: Math.round(current.apparent_temperature ?? 30),
        humidity: current.relative_humidity_2m ?? 85,
        precipitation: precip,
        rain: rainVal,
        showers: showersVal,
        weatherCode: displayCode,
        rawWeatherCode: rawCode,
        cloudCover: current.cloud_cover ?? 80,
        windSpeed: current.wind_speed_10m ?? 10,
        pressure: current.surface_pressure ?? 1000,
        isRaining,

        // Hourly forecast (starts from current hour now)
        hourly: hourlySlice,

        // 7-Day Forecast
        daily: (data?.daily?.time || []).map((dateStr, idx) => ({
          date: dateStr,
          code: data?.daily?.weather_code?.[idx] ?? 0,
          tempMax: Math.round(data?.daily?.temperature_2m_max?.[idx] ?? 30),
          tempMin: Math.round(data?.daily?.temperature_2m_min?.[idx] ?? 24),
          precipSum: data?.daily?.precipitation_sum?.[idx] ?? 0,
          precipProbMax: data?.daily?.precipitation_probability_max?.[idx] ?? 0
        })),

        timestamp: Date.now()
      };

      memoryCache = weatherResult;
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(weatherResult));
      } catch (_) {}

      notifyListeners(weatherResult);
      return weatherResult;
    } catch (err) {
      console.warn('[WeatherService] Fetch fallback:', err.message);
      if (memoryCache) return memoryCache;
      return {
        temperature: 26,
        apparentTemperature: 30,
        humidity: 85,
        precipitation: 0,
        rain: 0,
        showers: 0,
        weatherCode: 0,
        cloudCover: 50,
        windSpeed: 10,
        pressure: 1010,
        isRaining: false,
        hourly: [],
        daily: [],
        timestamp: Date.now()
      };
    } finally {
      pendingPromise = null;
    }
  })();

  return pendingPromise;
};
