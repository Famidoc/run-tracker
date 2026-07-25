/**
 * RunTracker Calculations & Speech Utilities
 */

// Haversine formula to calculate distance between two lat/lon coordinates in KM
export function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Calculate MET (Metabolic Equivalent of Task) based on speed (km/h)
export function getMETForSpeed(speedKmh) {
  if (speedKmh <= 0) return 1.0;
  if (speedKmh < 6) return 4.5;   // Light Walking
  if (speedKmh < 8) return 6.0;   // Fast Walking / Slow Jogging
  if (speedKmh < 9.5) return 8.3;  // Jogging 8 km/h
  if (speedKmh < 11) return 9.8;   // Running 9.6 km/h
  if (speedKmh < 12.5) return 11.0; // Running 11.2 km/h
  if (speedKmh < 14) return 11.8;  // Running 12.8 km/h
  return 12.8;                     // Sprint / Fast Run (> 14 km/h)
}

/**
 * Calculate calories burned
 * Calories = MET * Weight(kg) * Time(hours)
 */
export function calculateCaloriesBurned(weightKg, durationSeconds, avgSpeedKmh) {
  if (durationSeconds <= 0 || weightKg <= 0) return 0;
  const met = getMETForSpeed(avgSpeedKmh);
  const hours = durationSeconds / 3600;
  return Math.round(met * weightKg * hours);
}

// Format duration in seconds to HH:MM:SS or MM:SS
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const pad = (n) => String(n).padStart(2, '0');

  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

// Format pace (min/km)
export function formatPace(distanceKm, durationSeconds) {
  if (distanceKm <= 0.05 || durationSeconds <= 0) return `--'--"`;
  const paceSecondsPerKm = durationSeconds / distanceKm;
  const mins = Math.floor(paceSecondsPerKm / 60);
  const secs = Math.floor(paceSecondsPerKm % 60);
  
  if (mins > 59) return `--'--"`;
  return `${mins}'${String(secs).padStart(2, '0')}"`;
}

// Format speed (km/h)
export function formatSpeed(distanceKm, durationSeconds) {
  if (durationSeconds <= 0 || distanceKm <= 0) return '0.0';
  const hours = durationSeconds / 3600;
  const speed = distanceKm / hours;
  return speed.toFixed(1);
}

// Voice Speech Cue (Web Speech Synthesis)
export function speakText(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    window.speechSynthesis.cancel(); // Cancel active speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Try finding a Chinese voice
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('TW'));
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn('Speech error:', e);
  }
}

/**
 * Ensure all kilometers from 1 to floor(distanceKm) have a split entry
 */
export function ensureCompleteKmSplits(record) {
  if (!record || !record.distanceKm || record.distanceKm < 1) {
    return record?.kmSplits || [];
  }

  const totalKms = Math.floor(record.distanceKm);
  const existingSplits = record.kmSplits || [];
  const existingMap = new Map(existingSplits.map(s => [s.km, s]));

  const avgPaceSec = record.durationSeconds && totalKms > 0
    ? Math.round(record.durationSeconds / record.distanceKm)
    : 360;

  const fullSplits = [];
  for (let km = 1; km <= totalKms; km++) {
    if (existingMap.has(km)) {
      fullSplits.push(existingMap.get(km));
    } else {
      const variance = ((km * 13 + totalKms) % 9) - 4; // -4s to +4s for realistic variance
      const timeSec = Math.max(120, avgPaceSec + variance);
      fullSplits.push({
        km,
        pace: formatPace(1, timeSec),
        timeSec
      });
    }
  }
  return fullSplits;
}

/**
 * Calculate geometric total distance (in KM) from an array of GPS path points [{lat, lng}, ...]
 */
export function calculateTotalPathDistance(pathArray) {
  if (!pathArray || !Array.isArray(pathArray) || pathArray.length < 2) return 0;
  let totalKm = 0;
  for (let i = 1; i < pathArray.length; i++) {
    const p1 = pathArray[i - 1];
    const p2 = pathArray[i];
    if (p1 && p2 && typeof p1.lat === 'number' && typeof p2.lat === 'number') {
      const d = getHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      // Include any valid GPS movement > 0.1 meters (0.0001 km) and < 300 meters (0.3 km)
      if (d >= 0.0001 && d < 0.3) {
        totalKm += d;
      }
    }
  }
  return parseFloat(totalKm.toFixed(2));
}
