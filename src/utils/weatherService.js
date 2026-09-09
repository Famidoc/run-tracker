/**
 * Weather and Air Quality Service
 * Uses Open-Meteo free APIs (No API key required, CORS enabled)
 */

/**
 * Get PM2.5 level description and color indicator based on Taiwan EPA / WHO standards
 * @param {number} pm25 
 * @returns {{ label: string, color: string, advice: string }}
 */
export function getPm25Level(pm25) {
  if (pm25 === null || pm25 === undefined || isNaN(pm25)) {
    return { label: '未知', color: '#8E9BAE', advice: '' };
  }
  if (pm25 <= 15.4) {
    return { label: '良好', color: '#00E676', advice: '空氣良好，非常適合戶外跑步' };
  }
  if (pm25 <= 35.4) {
    return { label: '普通', color: '#FFD600', advice: '空氣普通，適合一般戶外運動' };
  }
  if (pm25 <= 54.4) {
    return { label: '敏感族群注意', color: '#FF9100', advice: '敏感體質跑者建議減緩強度或戴口罩' };
  }
  if (pm25 <= 150.4) {
    return { label: '對所有族群不健康', color: '#FF1744', advice: '不建議進行劇烈戶外跑步' };
  }
  return { label: '非常不健康', color: '#D500F9', advice: '空氣品質極差，請暫停戶外運動' };
}

/**
 * Fetch real-time weather and air quality for coordinates
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<{ temp: number|null, humidity: number|null, pm25: number|null, pm25Info: object, timestamp: number } | null>}
 */
export async function fetchCurrentWeatherAndAirQuality(latitude, longitude) {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const lat = Number(latitude).toFixed(4);
    const lon = Number(longitude).toFixed(4);

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`;

    const [weatherRes, aqiRes] = await Promise.allSettled([
      fetch(weatherUrl, { signal: controller.signal }),
      fetch(aqiUrl, { signal: controller.signal })
    ]);

    clearTimeout(timeoutId);

    let temp = null;
    let humidity = null;
    let pm25 = null;

    if (weatherRes.status === 'fulfilled' && weatherRes.value.ok) {
      const data = await weatherRes.value.json();
      if (data?.current) {
        temp = typeof data.current.temperature_2m === 'number' ? Math.round(data.current.temperature_2m * 10) / 10 : null;
        humidity = typeof data.current.relative_humidity_2m === 'number' ? Math.round(data.current.relative_humidity_2m) : null;
      }
    }

    if (aqiRes.status === 'fulfilled' && aqiRes.value.ok) {
      const aqiData = await aqiRes.value.json();
      if (aqiData?.current && typeof aqiData.current.pm2_5 === 'number') {
        pm25 = Math.round(aqiData.current.pm2_5 * 10) / 10;
      }
    }

    if (temp === null && humidity === null && pm25 === null) {
      return null;
    }

    const pm25Info = getPm25Level(pm25);

    return {
      temp,
      humidity,
      pm25,
      pm25Info,
      timestamp: Date.now()
    };
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('Failed to fetch weather/air quality:', err);
    return null;
  }
}

/**
 * Format weather data into a tidy notes string
 * @param {object} weather 
 * @returns {string}
 */
export function formatWeatherNotes(weather) {
  if (!weather) return '';
  const parts = [];

  if (typeof weather.temp === 'number') {
    parts.push(`氣溫 ${weather.temp}°C`);
  }
  if (typeof weather.humidity === 'number') {
    parts.push(`濕度 ${weather.humidity}%`);
  }
  if (typeof weather.pm25 === 'number') {
    const levelLabel = weather.pm25Info?.label ? ` (${weather.pm25Info.label})` : '';
    parts.push(`PM2.5 ${weather.pm25} μg/m³${levelLabel}`);
  }

  if (parts.length === 0) return '';
  return `【環境氣象】${parts.join(' ｜ ')}`;
}
