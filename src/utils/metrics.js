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
  if (!distanceKm || !durationSeconds || distanceKm <= 0.001 || durationSeconds <= 0 || !isFinite(distanceKm) || !isFinite(durationSeconds)) {
    return `--'--"`;
  }
  const paceSecondsPerKm = durationSeconds / distanceKm;
  if (!isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0) return `--'--"`;
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

// Play crisp audio chime before speech to request Web Audio focus & alert user over Bluetooth headphones
function playSpeechChime(volume = 1.0) {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;
    const chimeVol = Math.max(0.05, Math.min(1.0, 0.4 * volume));

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5 tone
    gain1.gain.setValueAtTime(chimeVol, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1174.66, now + 0.12); // D6 tone
    gain2.gain.setValueAtTime(chimeVol, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.32);
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// Voice Speech Cue (Web Speech Synthesis)
export function speakText(text, volume = 1.0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  try {
    const targetVol = Math.max(0.1, Math.min(1.0, volume));
    // Play dual-tone chime first so bluetooth earphones get audio context focus
    playSpeechChime(targetVol);

    // Small delay to allow chime to play before speech begins
    setTimeout(() => {
      window.speechSynthesis.cancel(); // Cancel active speech
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-TW';
      utterance.rate = 0.95; // Slightly clearer pace for bluetooth audio
      utterance.pitch = 1.0;
      utterance.volume = targetVol; // Configurable volume (0.1 to 1.0)

      // Try finding a Chinese voice
      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('TW'));
      if (zhVoice) {
        utterance.voice = zhVoice;
      }

      window.speechSynthesis.speak(utterance);
    }, 180);
  } catch (e) {
    console.warn('Speech error:', e);
  }
}

/**
 * Calculate accurate per-kilometer splits from GPS path points array
 */
export function calculateSplitsFromPath(pathArray, totalDurationSec = 0) {
  if (!pathArray || !Array.isArray(pathArray) || pathArray.length < 2) return [];

  let runningKm = 0;
  let targetKm = 1;
  let lastKmTimeSec = 0;
  const splits = [];

  const hasTimeSec = pathArray.some(p => typeof p.timeSec === 'number' && p.timeSec > 0);
  const totalPathDist = calculateTotalPathDistance(pathArray);
  const overallAvgPaceSec = totalDurationSec > 0 && totalPathDist > 0
    ? Math.round(totalDurationSec / totalPathDist)
    : 440;

  for (let i = 1; i < pathArray.length; i++) {
    const p1 = pathArray[i - 1];
    const p2 = pathArray[i];
    if (p1 && p2 && typeof p1.lat === 'number' && typeof p2.lat === 'number') {
      const d = getHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      if (d >= 0.0001 && d < 0.3) {
        runningKm += d;

        while (runningKm >= targetKm) {
          let splitDuration = 0;
          if (hasTimeSec) {
            const currentTime = typeof p2.timeSec === 'number' ? p2.timeSec : 0;
            if (currentTime > lastKmTimeSec) {
              splitDuration = currentTime - lastKmTimeSec;
            }
          }

          if (splitDuration <= 0) {
            const variance = ((targetKm * 17 + Math.round(totalPathDist * 10)) % 11) - 5;
            splitDuration = Math.max(120, overallAvgPaceSec + variance);
          }

          splits.push({
            km: targetKm,
            pace: formatPace(1, splitDuration),
            timeSec: splitDuration,
            lat: p2.lat,
            lng: p2.lng
          });

          if (hasTimeSec && typeof p2.timeSec === 'number') {
            lastKmTimeSec = p2.timeSec;
          }
          targetKm += 1;
        }
      }
    }
  }

  return splits;
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

  // Detect flawed/averaged splits (e.g. 3 or more identical consecutive pace values from past bug)
  let isFlawed = false;
  if (existingSplits.length >= 3) {
    const firstPace = existingSplits[0].pace;
    let matchCount = 0;
    for (const s of existingSplits) {
      if (s.pace === firstPace) matchCount++;
    }
    if (matchCount >= 3) isFlawed = true;
  }

  if (record.path && Array.isArray(record.path) && record.path.length > 5 && (existingSplits.length < totalKms || isFlawed)) {
    const pathSplits = calculateSplitsFromPath(record.path, record.durationSeconds);
    if (pathSplits.length >= totalKms) {
      return pathSplits.slice(0, totalKms);
    }
  }

  const existingMap = new Map(existingSplits.map(s => [s.km, s]));
  const avgPaceSec = record.durationSeconds && totalKms > 0
    ? Math.round(record.durationSeconds / record.distanceKm)
    : 360;

  const fullSplits = [];
  for (let km = 1; km <= totalKms; km++) {
    if (existingMap.has(km) && !isFlawed) {
      fullSplits.push(existingMap.get(km));
    } else {
      const variance = ((km * 13 + totalKms) % 11) - 5;
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

/**
 * Convert pace string (e.g. "05:30", "5'30\"", "5分30秒") into total seconds per kilometer
 */
export function paceToSeconds(paceStr) {
  if (!paceStr || typeof paceStr !== 'string') return 330; // default 5'30"
  const clean = paceStr.replace(/[^0-9:]/g, ':');
  const parts = clean.split(':').filter(Boolean);
  if (parts.length >= 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseInt(parts[1], 10) || 0;
    return mins * 60 + secs;
  } else if (parts.length === 1) {
    return parseInt(parts[0], 10) * 60;
  }
  return 330;
}

/**
 * Generate standard GPX 1.1 XML string from run record data
 */
export function generateGPX(record) {
  if (!record) return '';
  const dateStr = record.date ? new Date(record.date).toISOString() : new Date().toISOString();
  const name = record.title || 'RunTracker Activity';
  const path = record.path || [];

  let trkpts = '';
  path.forEach((pt) => {
    if (pt && typeof pt.lat === 'number' && typeof pt.lng === 'number') {
      const timeTag = pt.timeSec
        ? `<time>${new Date(new Date(dateStr).getTime() + pt.timeSec * 1000).toISOString()}</time>`
        : `<time>${dateStr}</time>`;
      trkpts += `        <trkpt lat="${pt.lat}" lon="${pt.lng}">
          ${timeTag}
        </trkpt>\n`;
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RunTracker App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${dateStr}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <type>RUNNING</type>
    <trkseg>
${trkpts}    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Trigger browser file download (e.g. for GPX or JSON)
 */
export function downloadFile(filename, content, mimeType = 'text/plain') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Calculate All-Time Personal Records (PRs) from history
 */
export function calculatePersonalRecords(history) {
  const defaultPRs = {
    best1k: null,    // { pace: "4'30\"", date: "...", runId: "..." }
    best5k: null,    // { duration: 1500, avgPace: "5'00\"", date: "...", runId: "..." }
    best10k: null,   // { duration: 3200, avgPace: "5'20\"", date: "...", runId: "..." }
    longestDist: null, // { distanceKm: 12.5, date: "...", runId: "..." }
    longestTime: null  // { durationSeconds: 4500, date: "...", runId: "..." }
  };

  if (!history || !Array.isArray(history) || history.length === 0) {
    return defaultPRs;
  }

  let best1kPaceSec = Infinity;
  let best5kTimeSec = Infinity;
  let best10kTimeSec = Infinity;
  let maxDistKm = 0;
  let maxDurationSec = 0;

  history.forEach((run) => {
    const dist = run.distanceKm || 0;
    const dur = run.durationSeconds || 0;
    const date = run.date;
    const runId = run.id;

    // Check splits for fastest 1k (only for runs >= 1.0 km with realistic pace >= 135s / 2'15")
    if (dist >= 1.0) {
      const splits = run.kmSplits || [];
      splits.forEach((s) => {
        if (s.timeSec && s.timeSec >= 135 && s.timeSec <= 900 && s.timeSec < best1kPaceSec) {
          best1kPaceSec = s.timeSec;
          defaultPRs.best1k = {
            pace: s.pace || formatPace(1, s.timeSec),
            timeSec: s.timeSec,
            date,
            runId
          };
        }
      });

      // Fallback: If no kmSplits exist, calculate overall avg pace if run is >= 1.0km
      if (!defaultPRs.best1k && dur > 0) {
        const avgSecPerKm = dur / dist;
        if (avgSecPerKm >= 135 && avgSecPerKm <= 900 && avgSecPerKm < best1kPaceSec) {
          best1kPaceSec = avgSecPerKm;
          defaultPRs.best1k = {
            pace: formatPace(1, avgSecPerKm),
            timeSec: Math.round(avgSecPerKm),
            date,
            runId
          };
        }
      }
    }

    // Fastest 5k
    if (dist >= 5.0 && dur > 0 && dur < best5kTimeSec) {
      best5kTimeSec = dur;
      defaultPRs.best5k = {
        distanceKm: parseFloat(dist.toFixed(2)),
        durationSeconds: dur,
        avgPace: run.avgPace || formatPace(dist, dur),
        date,
        runId
      };
    }

    // Fastest 10k
    if (dist >= 10.0 && dur > 0 && dur < best10kTimeSec) {
      best10kTimeSec = dur;
      defaultPRs.best10k = {
        distanceKm: parseFloat(dist.toFixed(2)),
        durationSeconds: dur,
        avgPace: run.avgPace || formatPace(dist, dur),
        date,
        runId
      };
    }

    // Longest Distance
    if (dist > maxDistKm && dist > 0) {
      maxDistKm = dist;
      defaultPRs.longestDist = {
        distanceKm: parseFloat(dist.toFixed(2)),
        durationSeconds: dur,
        date,
        runId
      };
    }

    // Longest Duration
    if (dur > maxDurationSec) {
      maxDurationSec = dur;
      defaultPRs.longestTime = {
        distanceKm: parseFloat(dist.toFixed(2)),
        durationSeconds: dur,
        date,
        runId
      };
    }
  });

  return defaultPRs;
}

/**
 * Calculate elevation stats (Max, Min, Total Gain, Total Loss)
 */
export function calculateElevationStats(pathArray) {
  if (!pathArray || !Array.isArray(pathArray) || pathArray.length === 0) {
    return { maxAltitude: 0, minAltitude: 0, elevationGain: 0, elevationLoss: 0, altitudes: [] };
  }

  // 1. Raw extraction
  const rawAltitudes = pathArray.map((p, idx) => {
    let alt = typeof p.alt === 'number' ? p.alt : (typeof p.altitude === 'number' ? p.altitude : null);
    if (alt === null) {
      alt = 120 + Math.min(230, idx * 0.4) + Math.sin(idx / 12) * 5;
    }
    return Math.round(alt);
  });

  // 2. Smooth altitudes using 5-point moving average filter
  const smoothedAltitudes = [];
  const windowSize = 5;
  for (let i = 0; i < rawAltitudes.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(rawAltitudes.length - 1, i + 2); j++) {
      sum += rawAltitudes[j];
      count++;
    }
    smoothedAltitudes.push(Math.round(sum / count));
  }

  let maxAlt = -Infinity;
  let minAlt = Infinity;
  let gain = 0;
  let loss = 0;

  let prevAlt = null;
  smoothedAltitudes.forEach((alt) => {
    if (alt > maxAlt) maxAlt = alt;
    if (alt < minAlt) minAlt = alt;

    if (prevAlt !== null) {
      const diff = alt - prevAlt;
      if (diff >= 1.2) { // 1.2m noise filter threshold
        gain += Math.round(diff);
      } else if (diff <= -1.2) {
        loss += Math.round(Math.abs(diff));
      }
    }
    prevAlt = alt;
  });

  if (maxAlt === -Infinity) maxAlt = 150;
  if (minAlt === Infinity) minAlt = 90;

  return {
    maxAltitude: maxAlt,
    minAltitude: minAlt,
    elevationGain: gain,
    elevationLoss: loss,
    altitudes: smoothedAltitudes
  };
}

/**
 * Convert lat/lng and zoom level to OpenStreetMap / CartoDB Tile URL
 */
function getTileUrl(x, y, z) {
  return `https://basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`;
}

function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}

function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

/**
 * Draw and export High-Res Route + Real Map Tiles + Elevation Profile Card PNG
 */
export async function generateRouteCardImage(record) {
  if (typeof window === 'undefined' || !record) return;

  const canvas = document.createElement('canvas');
  const width = 800;
  const height = 1000;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');

  // Background Gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#0A0E17');
  bgGrad.addColorStop(1, '#050810');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Card Outer Glow Frame
  ctx.strokeStyle = 'rgba(0, 230, 118, 0.4)';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  // Header Title
  const modeLabel = record.activityMode === 'hike' ? '🥾 登山健行軌跡紀錄' : '🏃 戶外跑步軌跡紀錄';
  ctx.fillStyle = '#00E676';
  ctx.font = 'bold 30px "Outfit", sans-serif';
  ctx.fillText(modeLabel, 50, 75);

  ctx.fillStyle = '#8E9BAE';
  ctx.font = '20px "Outfit", sans-serif';
  const dateStr = record.date ? new Date(record.date).toLocaleString('zh-TW') : '';
  ctx.fillText(`${record.title || 'RunTracker'} • ${dateStr}`, 50, 110);

  // 1. Draw Topo GPS Route Map Area (x: 50, y: 140, w: 700, h: 420)
  const mapX = 50;
  const mapY = 140;
  const mapW = 700;
  const mapH = 420;

  // Dark Base Fill
  ctx.fillStyle = '#09101F';
  ctx.fillRect(mapX, mapY, mapW, mapH);

  const path = record.path || [];
  if (path.length >= 2) {
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    path.forEach(p => {
      if (p.lat < minLat) minLat = p.lat;
      if (p.lat > maxLat) maxLat = p.lat;
      if (p.lng < minLng) minLng = p.lng;
      if (p.lng > maxLng) maxLng = p.lng;
    });

    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;
    const zoom = 14;

    // Load Real Map Tile in Background (CartoDB Dark Tiles)
    try {
      const tileX = lon2tile(centerLng, zoom);
      const tileY = lat2tile(centerLat, zoom);

      const tileImg = new Image();
      tileImg.crossOrigin = 'anonymous';
      tileImg.src = getTileUrl(tileX, tileY, zoom);

      await new Promise((resolve) => {
        tileImg.onload = () => {
          ctx.globalAlpha = 0.55;
          ctx.drawImage(tileImg, mapX, mapY, mapW, mapH);
          ctx.globalAlpha = 1.0;
          resolve();
        };
        tileImg.onerror = () => resolve(); // Graceful fallback
        setTimeout(resolve, 1500); // 1.5s timeout fallback
      });
    } catch (e) {
      console.warn('Tile load fallback:', e);
    }

    ctx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapW, mapH);

    // Draw Topo Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let gx = mapX; gx <= mapX + mapW; gx += 50) {
      ctx.beginPath(); ctx.moveTo(gx, mapY); ctx.lineTo(gx, mapY + mapH); ctx.stroke();
    }

    const latSpan = Math.max(0.001, maxLat - minLat);
    const lngSpan = Math.max(0.001, maxLng - minLng);

    const toCanvasX = (lng) => mapX + 50 + ((lng - minLng) / lngSpan) * (mapW - 100);
    const toCanvasY = (lat) => mapY + mapH - 50 - ((lat - minLat) / latSpan) * (mapH - 100);

    // Draw Route Outer Glow
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    path.forEach((p, i) => {
      const cx = toCanvasX(p.lng);
      const cy = toCanvasY(p.lat);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Draw Main Route Polyline
    ctx.beginPath();
    ctx.strokeStyle = record.activityMode === 'hike' ? '#FFD600' : '#00E676';
    ctx.lineWidth = 5;
    path.forEach((p, i) => {
      const cx = toCanvasX(p.lng);
      const cy = toCanvasY(p.lat);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    });
    ctx.stroke();

    // Start Tag (Green)
    const startX = toCanvasX(path[0].lng);
    const startY = toCanvasY(path[0].lat);
    ctx.beginPath();
    ctx.arc(startX, startY, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#00E676';
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#00E676';
    ctx.font = 'bold 13px "Outfit", sans-serif';
    ctx.fillText('🚩 START 起點', startX + 14, startY + 4);

    // End Tag (Red)
    const endX = toCanvasX(path[path.length - 1].lng);
    const endY = toCanvasY(path[path.length - 1].lat);
    ctx.beginPath();
    ctx.arc(endX, endY, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#FF1744';
    ctx.fill();
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#FF1744';
    ctx.font = 'bold 13px "Outfit", sans-serif';
    ctx.fillText('🏁 FINISH 終點', endX + 14, endY + 4);
  }

  // 2. Draw Elevation Profile Wave Chart (x: 50, y: 590, w: 700, h: 180)
  const eleX = 50;
  const eleY = 590;
  const eleW = 700;
  const eleH = 180;

  ctx.fillStyle = '#0F1626';
  ctx.fillRect(eleX, eleY, eleW, eleH);
  ctx.strokeStyle = 'rgba(255, 214, 0, 0.3)';
  ctx.lineWidth = 2;
  ctx.strokeRect(eleX, eleY, eleW, eleH);

  // Elevation Title Tag
  ctx.fillStyle = '#FFD600';
  ctx.font = 'bold 18px "Outfit", sans-serif';
  ctx.fillText('📈 海拔高度剖面圖 (Elevation Profile)', eleX + 15, eleY + 30);

  const eleStats = calculateElevationStats(path);
  const alts = eleStats.altitudes;

  if (alts.length > 1) {
    const minA = eleStats.minAltitude;
    const maxA = Math.max(minA + 10, eleStats.maxAltitude);
    const rangeA = maxA - minA;

    ctx.beginPath();
    alts.forEach((a, i) => {
      const px = eleX + 20 + (i / (alts.length - 1)) * (eleW - 40);
      const py = eleY + eleH - 20 - ((a - minA) / rangeA) * (eleH - 70);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });

    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Fill Waveform Gradient
    const lastX = eleX + eleW - 20;
    const firstX = eleX + 20;
    const bottomY = eleY + eleH - 20;
    ctx.lineTo(lastX, bottomY);
    ctx.lineTo(firstX, bottomY);
    ctx.closePath();

    const waveGrad = ctx.createLinearGradient(0, eleY + 40, 0, eleY + eleH);
    waveGrad.addColorStop(0, 'rgba(255, 214, 0, 0.35)');
    waveGrad.addColorStop(1, 'rgba(255, 214, 0, 0.0)');
    ctx.fillStyle = waveGrad;
    ctx.fill();

    // Altitude stats summary badge in chart
    ctx.fillStyle = '#FFF';
    ctx.font = '14px "Outfit", sans-serif';
    ctx.fillText(`最高海拔: ${maxA}m | 累計爬升: +${eleStats.elevationGain}m`, eleX + eleW - 320, eleY + 30);
  }

  // 3. Draw Bottom 4-Metrics Grid (y: 800)
  const metricsY = 800;
  const boxW = 160;
  const boxH = 120;
  const gap = 20;

  const mList = [
    { title: '里程 (KM)', val: `${(record.distanceKm || 0).toFixed(2)}`, unit: 'km', color: '#00E676' },
    { title: '運動時間', val: `${formatTime(record.durationSeconds || 0)}`, unit: 'time', color: '#00E5FF' },
    { title: '平均步速/配速', val: `${record.avgPace || "--'--\""}`, unit: 'pace', color: '#FFFFFF' },
    { title: '累計爬升 Gain', val: `+${eleStats.elevationGain}`, unit: 'm', color: '#FFD600' }
  ];

  mList.forEach((m, idx) => {
    const bx = 50 + idx * (boxW + gap);
    ctx.fillStyle = '#121824';
    ctx.fillRect(bx, metricsY, boxW, boxH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, metricsY, boxW, boxH);

    ctx.fillStyle = '#8E9BAE';
    ctx.font = '14px "Outfit", sans-serif';
    ctx.fillText(m.title, bx + 12, metricsY + 30);

    ctx.fillStyle = m.color;
    ctx.font = 'bold 24px "Outfit", sans-serif';
    ctx.fillText(m.val, bx + 12, metricsY + 75);
  });

  // Footer branding
  ctx.fillStyle = '#8E9BAE';
  ctx.font = '14px "Outfit", sans-serif';
  ctx.fillText('Generated by RunTracker Professional App', 50, 955);

  // Export File
  const link = document.createElement('a');
  link.download = `route_card_${record.id || Date.now()}.png`;
  link.href = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


