/**
 * Weather and Air Quality Service
 * Priority 1 (Taiwan): Civil IoT Taiwan (民生公共物聯網 CoLife SensorThings API)
 *   - Temperature & Humidity: Central Weather Administration (中央氣象署自動氣象站/現在天氣觀測站)
 *   - PM2.5: Ministry of Environment (環境部智慧城鄉空品微型感測器)
 * Priority 2 (Global / Fallback): Open-Meteo free APIs
 */

/**
 * Calculate Haversine distance in kilometers between two coordinates
 */
function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Check if coordinates are within Taiwan region
 */
function isInTaiwan(lat, lon) {
  return lat >= 21.5 && lat <= 26.5 && lon >= 118.0 && lon <= 122.5;
}

/**
 * Get PM2.5 level description and color indicator based on Taiwan MOENV standards
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
    return { label: '敏感注意', color: '#FF9100', advice: '敏感體質跑者建議減緩強度' };
  }
  if (pm25 <= 150.4) {
    return { label: '不健康', color: '#FF1744', advice: '不建議進行劇烈戶外跑步' };
  }
  return { label: '非常不健康', color: '#D500F9', advice: '空氣品質極差，請暫停戶外運動' };
}

/**
 * Fetch real-time Temperature & Relative Humidity from Taiwan CWA stations (民生公共物聯網 STA_Weather)
 */
async function fetchTaiwanCwaWeather(lat, lon) {
  const url = `https://sta.colife.org.tw/STA_Weather/v1.0/Things?$top=50&$filter=geo.distance(Locations/location,geography'POINT(${lon} ${lat})') lt 0.12&$expand=Locations,Datastreams($filter=name eq 'AirTemperature' or name eq 'RelativeHumidity';$expand=Observations($top=1;$orderby=phenomenonTime desc))`;

  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return null;

  const data = await res.json();
  const now = Date.now();

  const validStations = (data.value || [])
    .map((thing) => {
      const coords = thing.Locations?.[0]?.location?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [sLon, sLat] = coords;
      const dist = calcDistanceKm(lat, lon, sLat, sLon);

      const tObs = thing.Datastreams?.find((d) => d.name === 'AirTemperature')?.Observations?.[0];
      const hObs = thing.Datastreams?.find((d) => d.name === 'RelativeHumidity')?.Observations?.[0];

      const tVal = tObs !== undefined ? Number(tObs.result) : NaN;
      const hVal = hObs !== undefined ? Number(hObs.result) : NaN;
      const obsTime = tObs?.phenomenonTime ? new Date(tObs.phenomenonTime).getTime() : 0;
      const ageMinutes = obsTime > 0 ? (now - obsTime) / 60000 : 9999;

      // Filter out invalid missing codes (-99) or stale observations (> 3 hours)
      if (isNaN(tVal) || tVal < -25 || tVal > 50 || ageMinutes > 180) {
        return null;
      }

      const altitude = thing.properties?.StationAltitude ? Number(thing.properties.StationAltitude) : null;

      return {
        name: thing.properties?.stationName || thing.name,
        dist,
        temp: tVal,
        humidity: !isNaN(hVal) && hVal > 0 && hVal <= 100 ? hVal : null,
        altitude
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist);

  if (validStations.length === 0) return null;

  // Use Inverse Distance Weighting (IDW) of the nearest up to 3 stations within 6 km
  const nearestAlt = validStations[0].altitude;
  const nearStations = validStations
    .filter((s) => {
      if (s.dist > 6.5) return false;
      if (nearestAlt !== null && s.altitude !== null && Math.abs(s.altitude - nearestAlt) > 150) {
        return false;
      }
      return true;
    })
    .slice(0, 3);

  const targets = nearStations.length > 0 ? nearStations : [validStations[0]];

  let wSum = 0;
  let tSum = 0;
  let hSum = 0;
  let hWeightSum = 0;

  for (const s of targets) {
    const weight = 1 / Math.pow(Math.max(0.25, s.dist), 2);
    wSum += weight;
    tSum += s.temp * weight;
    if (s.humidity !== null) {
      hSum += s.humidity * weight;
      hWeightSum += weight;
    }
  }

  return {
    temp: Math.round((tSum / wSum) * 10) / 10,
    humidity: hWeightSum > 0 ? Math.round(hSum / hWeightSum) : null,
    stationName: validStations[0].name,
    stationDistKm: Math.round(validStations[0].dist * 10) / 10
  };
}

/**
 * Query MOENV Air Quality Micro-Sensors (環境部智慧城鄉微型感測器 STA_AirQuality_EPAIoT)
 */
async function queryMoenvMicroSensors(lat, lon, radiusDeg) {
  const url = `https://sta.colife.org.tw/STA_AirQuality_EPAIoT/v1.0/Things?$top=100&$filter=geo.distance(Locations/location,geography'POINT(${lon} ${lat})') lt ${radiusDeg}&$expand=Locations,Datastreams($filter=name eq 'PM2.5';$expand=Observations($top=1;$orderby=phenomenonTime desc))`;

  const res = await fetch(url, { signal: AbortSignal.timeout(4500) });
  if (!res.ok) return [];

  const data = await res.json();
  const now = Date.now();

  return (data.value || [])
    .map((thing) => {
      const coords = thing.Locations?.[0]?.location?.coordinates;
      if (!coords || coords.length < 2) return null;
      const [sLon, sLat] = coords;
      const dist = calcDistanceKm(lat, lon, sLat, sLon);

      const pmObs = thing.Datastreams?.find((d) => d.name === 'PM2.5')?.Observations?.[0];
      const pmVal = pmObs !== undefined ? Number(pmObs.result) : NaN;
      const obsTime = pmObs?.phenomenonTime ? new Date(pmObs.phenomenonTime).getTime() : 0;
      const ageMinutes = obsTime > 0 ? (now - obsTime) / 60000 : 9999;

      if (isNaN(pmVal) || pmVal < 0 || pmVal > 500 || ageMinutes > 120) {
        return null;
      }

      return {
        deviceName: thing.properties?.deviceName || thing.name,
        dist,
        pm25: pmVal
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.dist - b.dist);
}

/**
 * Fetch real-time local PM2.5 from nearest MOENV micro-sensors using median filtering
 */
async function fetchTaiwanLocalPm25(lat, lon) {
  // First search within ~2.0 km (0.018 deg) so page limit of 100 never truncates nearby sensors
  let validSensors = await queryMoenvMicroSensors(lat, lon, 0.018);

  // If no active micro-sensors within 2 km, expand search to ~7.5 km (0.068 deg)
  if (validSensors.length === 0) {
    validSensors = await queryMoenvMicroSensors(lat, lon, 0.068);
  }

  if (validSensors.length === 0) return null;

  // Prefer sensors within 1.5 km if at least 3 exist; otherwise take up to 5 nearest sensors
  const ultraClose = validSensors.filter((s) => s.dist <= 1.5);
  const nearestGroup = ultraClose.length >= 3 ? ultraClose.slice(0, 5) : validSensors.slice(0, 5);

  // Calculate median PM2.5 to reject single street-corner exhaust/cooking spikes
  const sortedPm = nearestGroup.map((s) => s.pm25).sort((a, b) => a - b);
  const mid = Math.floor(sortedPm.length / 2);
  const medianPm =
    sortedPm.length % 2 !== 0
      ? sortedPm[mid]
      : (sortedPm[mid - 1] + sortedPm[mid]) / 2;

  return {
    pm25: Math.round(medianPm * 10) / 10,
    sensorCount: nearestGroup.length,
    nearestDistKm: Math.round(nearestGroup[0].dist * 10) / 10
  };
}

/**
 * Fallback: Fetch from Open-Meteo global model API
 */
async function fetchOpenMeteoFallback(lat, lon, needWeather = true, needPm25 = true) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5500);

  try {
    const tasks = [
      needWeather
        ? fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`,
            { signal: controller.signal }
          )
        : Promise.resolve(null),
      needPm25
        ? fetch(
            `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm2_5`,
            { signal: controller.signal }
          )
        : Promise.resolve(null)
    ];

    const [weatherRes, aqiRes] = await Promise.allSettled(tasks);
    clearTimeout(timeoutId);

    let temp = null;
    let humidity = null;
    let pm25 = null;

    if (needWeather && weatherRes.status === 'fulfilled' && weatherRes.value?.ok) {
      const data = await weatherRes.value.json();
      if (data?.current) {
        temp =
          typeof data.current.temperature_2m === 'number'
            ? Math.round(data.current.temperature_2m * 10) / 10
            : null;
        humidity =
          typeof data.current.relative_humidity_2m === 'number'
            ? Math.round(data.current.relative_humidity_2m)
            : null;
      }
    }

    if (needPm25 && aqiRes.status === 'fulfilled' && aqiRes.value?.ok) {
      const aqiData = await aqiRes.value.json();
      if (aqiData?.current && typeof aqiData.current.pm2_5 === 'number') {
        pm25 = Math.round(aqiData.current.pm2_5 * 10) / 10;
      }
    }

    return { temp, humidity, pm25 };
  } catch (e) {
    clearTimeout(timeoutId);
    return { temp: null, humidity: null, pm25: null };
  }
}

/**
 * Fetch real-time weather and air quality for coordinates
 * Prioritizes Taiwan local physical sensors (CWA + MOENV IoT) and falls back to Open-Meteo
 * @param {number} latitude 
 * @param {number} longitude 
 * @returns {Promise<{ temp: number|null, humidity: number|null, pm25: number|null, pm25Info: object, sourceLabel: string, tempStation: string|null, pm25Station: string|null, isLocalSensor: boolean, timestamp: number } | null>}
 */
export async function fetchCurrentWeatherAndAirQuality(latitude, longitude) {
  if (!latitude || !longitude || isNaN(latitude) || isNaN(longitude)) {
    return null;
  }

  const latNum = Number(latitude);
  const lonNum = Number(longitude);
  const latStr = latNum.toFixed(4);
  const lonStr = lonNum.toFixed(4);

  let temp = null;
  let humidity = null;
  let pm25 = null;
  let tempStation = null;
  let pm25Station = null;
  let isLocalSensor = false;

  try {
    // Priority 1: Taiwan Local Real-time Physical Sensors
    if (isInTaiwan(latNum, lonNum)) {
      const [cwaRes, moenvRes] = await Promise.allSettled([
        fetchTaiwanCwaWeather(latNum, lonNum),
        fetchTaiwanLocalPm25(latNum, lonNum)
      ]);

      if (cwaRes.status === 'fulfilled' && cwaRes.value) {
        temp = cwaRes.value.temp;
        humidity = cwaRes.value.humidity;
        tempStation = `${cwaRes.value.stationName}站`;
        isLocalSensor = true;
      }

      if (moenvRes.status === 'fulfilled' && moenvRes.value) {
        pm25 = moenvRes.value.pm25;
        pm25Station = `在地微感測`;
        isLocalSensor = true;
      }
    }

    // Priority 2: Fallback to Open-Meteo for any missing metrics
    const needWeather = temp === null || humidity === null;
    const needPm25 = pm25 === null;

    if (needWeather || needPm25) {
      const fallback = await fetchOpenMeteoFallback(latStr, lonStr, needWeather, needPm25);
      if (temp === null && fallback.temp !== null) temp = fallback.temp;
      if (humidity === null && fallback.humidity !== null) humidity = fallback.humidity;
      if (pm25 === null && fallback.pm25 !== null) pm25 = fallback.pm25;
    }

    if (temp === null && humidity === null && pm25 === null) {
      return null;
    }

    const pm25Info = getPm25Level(pm25);
    const sourceParts = [];
    if (tempStation) sourceParts.push(`氣象署${tempStation}`);
    if (pm25Station) sourceParts.push(pm25Station);
    const sourceLabel = sourceParts.length > 0 ? sourceParts.join('・') : 'Open-Meteo';

    return {
      temp,
      humidity,
      pm25,
      pm25Info,
      sourceLabel,
      tempStation,
      pm25Station,
      isLocalSensor,
      timestamp: Date.now()
    };
  } catch (err) {
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
  const srcTag = weather.isLocalSensor ? '環境實測' : '環境氣象';
  return `【${srcTag}】${parts.join(' ｜ ')}`;
}
