import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { StorageService } from '../utils/storage';
import {
  getHaversineDistance,
  calculateCaloriesBurned,
  formatPace,
  formatSpeed,
  speakText,
  ensureCompleteKmSplits,
  calculateTotalPathDistance,
  paceToSeconds,
  generateGPX,
  downloadFile,
  calculatePersonalRecords
} from '../utils/metrics';
import { GPSSimulator } from '../utils/gpsSimulator';

const RunContext = createContext();

const ACTIVE_SESSION_KEY = 'runtracker_active_session_v1';

function getActiveSessionInitial() {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.isTracking && (Date.now() - (data.timestamp || 0)) < 7200000) {
      return data;
    }
  } catch (e) {}
  return null;
}

export function RunProvider({ children }) {
  const activeSessionRef = useRef(getActiveSessionInitial());
  const initialData = activeSessionRef.current;

  // Settings & Profile
  const [profile, setProfile] = useState(() => StorageService.getProfile());
  const [settings, setSettings] = useState(() => StorageService.getSettings());
  const [history, setHistory] = useState(() => StorageService.getHistory());

  // Active Run State (Restored from activeSession if page reloaded)
  const [isTracking, setIsTracking] = useState(() => initialData ? initialData.isTracking : false);
  const [isPaused, setIsPaused] = useState(() => initialData ? initialData.isPaused : false);
  const [durationSeconds, setDurationSeconds] = useState(() => initialData ? initialData.durationSeconds : 0);
  const [distanceKm, setDistanceKm] = useState(() => initialData ? initialData.distanceKm : 0);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(() => initialData ? initialData.currentSpeedKmh : 0);
  const [calories, setCalories] = useState(() => initialData ? initialData.calories : 0);
  const [pathPoints, setPathPoints] = useState(() => initialData ? (initialData.pathPoints || []) : []);
  const [kmSplits, setKmSplits] = useState(() => initialData ? (initialData.kmSplits || []) : []);

  // Goal & Notifications
  const [targetGoal, setTargetGoal] = useState(() => {
    if (initialData && initialData.targetGoal) return initialData.targetGoal;
    const def = settings.defaultGoal || { type: 'free', distanceValue: 5.0, timeValue: 30 };
    if (def.type === 'distance') return { type: 'distance', targetValue: def.distanceValue || 5.0 };
    if (def.type === 'time') return { type: 'time', targetValue: def.timeValue || 30 };
    return { type: 'free', targetValue: 0 };
  });
  const [goalReached, setGoalReached] = useState(false);
  const [simulatorMode, setSimulatorModeState] = useState(() => {
    if (initialData) return initialData.simulatorMode;
    return settings.useSimulator ?? false;
  });

  // UI Interactive States (Touch Guard & Outdoor High-Contrast 4-Data Mode)
  const [isTouchLocked, setIsTouchLocked] = useState(false);
  const [isOutdoorView, setIsOutdoorView] = useState(false);

  // Auto-Pause & Pace Zone Warning Refs
  const lowSpeedSecondsRef = useRef(0);
  const highSpeedSecondsRef = useRef(0);
  const isAutoPausedBySystemRef = useRef(false);
  const lastPaceAlertTimeRef = useRef(0);
  const gracePeriodSecRef = useRef(0);
  const outOfZoneSecondsRef = useRef(0);

  const setSimulatorMode = (val) => {
    setSimulatorModeState(val);
    updateSettings({
      ...settings,
      useSimulator: val
    });
  };

  // Save current targetGoal as default in user settings
  const saveDefaultGoal = (goalToSave = targetGoal) => {
    const curDef = settings.defaultGoal || { type: 'free', distanceValue: 5.0, timeValue: 30 };
    const goalType = goalToSave.type;
    let newDist = curDef.distanceValue || 5.0;
    let newTime = curDef.timeValue || 30;

    if (goalType === 'distance') {
      newDist = goalToSave.targetValue || 5.0;
    } else if (goalType === 'time') {
      newTime = goalToSave.targetValue || 30;
    }

    const updatedDefaultGoal = {
      type: goalType,
      distanceValue: newDist,
      timeValue: newTime
    };

    updateSettings({
      ...settings,
      defaultGoal: updatedDefaultGoal
    });
  };

  // Refs for timers, GPS watchers, and distance accumulation
  const timerRef = useRef(null);
  const gpsWatcherRef = useRef(null);
  const simulatorInstanceRef = useRef(null);

  const lastAnnouncedKmRef = useRef(initialData ? (initialData.lastAnnouncedKm || 0) : 0);
  const lastPointRef = useRef(null);
  const lastValidGpsRef = useRef(null); // { lat, lng, timeSec }
  const kmStartTimeRef = useRef(initialData ? (initialData.kmStartTime || 0) : 0);
  const gpsWindowRef = useRef([]); // Rolling 12-second window [{ lat, lng, timeSec, distKm }]
  const rollingPaceRef = useRef(0); // Instant rolling pace in seconds/km

  // Profile / Settings handlers
  const updateProfile = (newProfile) => {
    setProfile(newProfile);
    StorageService.saveProfile(newProfile);
  };

  const updateSettings = (newSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
  };

  // Save active session to localStorage so accidental reload (or network switch) resumes seamlessly
  useEffect(() => {
    if (isTracking) {
      try {
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
          isTracking,
          isPaused,
          durationSeconds,
          distanceKm,
          currentSpeedKmh,
          calories,
          pathPoints,
          kmSplits,
          targetGoal,
          simulatorMode,
          lastAnnouncedKm: lastAnnouncedKmRef.current,
          kmStartTime: kmStartTimeRef.current,
          timestamp: Date.now()
        }));
      } catch (e) {}
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }, [isTracking, isPaused, durationSeconds, distanceKm, currentSpeedKmh, calories, pathPoints, kmSplits, targetGoal, simulatorMode]);

  // Start Running Session
  const startRun = () => {
    setIsTracking(true);
    setIsPaused(false);
    setDurationSeconds(0);
    setDistanceKm(0);
    setCurrentSpeedKmh(0);
    setCalories(0);
    setPathPoints([]);
    setKmSplits([]);
    setGoalReached(false);

    lastAnnouncedKmRef.current = 0;
    lastPointRef.current = null;
    lastValidGpsRef.current = null;
    gpsWindowRef.current = [];
    rollingPaceRef.current = 0;
    kmStartTimeRef.current = 0;

    lowSpeedSecondsRef.current = 0;
    highSpeedSecondsRef.current = 0;
    isAutoPausedBySystemRef.current = false;
    lastPaceAlertTimeRef.current = 0;
    gracePeriodSecRef.current = 20; // 20s Grace Period on Start to prevent auto-pause trap
    outOfZoneSecondsRef.current = 0;

    if (settings.voiceCues) {
      speakText('跑步開始，加油！', settings.voiceVolume ?? 1.0);
    }

    // Initialize Simulator or Real Geolocation
    if (simulatorMode) {
      simulatorInstanceRef.current = new GPSSimulator(settings.presetRoute || 'daan');
    }
  };

  // Pause
  const pauseRun = () => {
    setIsPaused(true);
    lowSpeedSecondsRef.current = 0;
    highSpeedSecondsRef.current = 0;
    if (settings.voiceCues) {
      speakText('已暫停跑步', settings.voiceVolume ?? 1.0);
    }
  };

  // Resume
  const resumeRun = () => {
    setIsPaused(false);
    isAutoPausedBySystemRef.current = false;
    lowSpeedSecondsRef.current = 0;
    highSpeedSecondsRef.current = 0;
    gracePeriodSecRef.current = 20; // 20s Grace Period on Resume to prevent auto-pause trap
    outOfZoneSecondsRef.current = 0;

    // CRITICAL RESET: Reset lastValidGpsRef & rolling window so post-resume location doesn't calculate jump against pre-pause location
    lastValidGpsRef.current = null;
    lastPointRef.current = null;
    gpsWindowRef.current = [];
    rollingPaceRef.current = 0;

    if (settings.voiceCues) {
      speakText('繼續跑步', settings.voiceVolume ?? 1.0);
    }
  };

  // Stop & Save
  const stopRun = () => {
    const calculatedPathDist = calculateTotalPathDistance(pathPoints);
    const finalDist = Math.max(parseFloat(distanceKm.toFixed(2)), calculatedPathDist);

    const avgPace = formatPace(finalDist, durationSeconds);
    const avgSpeedKmh = parseFloat(formatSpeed(finalDist, durationSeconds));
    const finalCalories = calories > 0 ? calories : calculateCaloriesBurned(profile.weightKg || 68, durationSeconds, avgSpeedKmh || 9.5);

    const completeSplits = ensureCompleteKmSplits({
      distanceKm: finalDist,
      durationSeconds,
      kmSplits
    });

    const newRecord = {
      id: `run-${Date.now()}`,
      date: new Date().toISOString(),
      distanceKm: finalDist,
      durationSeconds,
      avgPace,
      avgSpeedKmh,
      calories: finalCalories,
      title: getRunTitle(new Date()),
      path: pathPoints,
      kmSplits: completeSplits
    };

    const updatedHistory = StorageService.saveRunRecord(newRecord);
    setHistory(updatedHistory);

    if (settings.voiceCues) {
      speakText(`跑步完成！本次完成 ${finalDist} 公里，耗時 ${Math.floor(durationSeconds / 60)} 分鐘，消耗 ${finalCalories} 卡路里。`, settings.voiceVolume ?? 1.0);
    }

    resetRunState();
    return newRecord;
  };

  const resetRunState = () => {
    setIsTracking(false);
    setIsPaused(false);
    setDurationSeconds(0);
    setDistanceKm(0);
    setCurrentSpeedKmh(0);
    setCalories(0);
    setPathPoints([]);
    setKmSplits([]);
    lastPointRef.current = null;
    lastValidGpsRef.current = null;
    gpsWindowRef.current = [];
    rollingPaceRef.current = 0;
    lowSpeedSecondsRef.current = 0;
    highSpeedSecondsRef.current = 0;
    isAutoPausedBySystemRef.current = false;
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) {}
  };

  // Delete run record
  const deleteRunRecord = (id) => {
    const updated = StorageService.deleteRunRecord(id);
    setHistory(updated);
  };

  // Screen Wake Lock API to prevent screen timeout during run
  const wakeLockRef = useRef(null);
  const requestWakeLock = async () => {
    if (typeof window !== 'undefined' && 'wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
      } catch (e) {
        console.warn('Wake lock request warning:', e);
      }
    }
  };

  const releaseWakeLock = () => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
  };

  useEffect(() => {
    if (isTracking && !isPaused) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
    return () => releaseWakeLock();
  }, [isTracking, isPaused]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isTracking && !isPaused) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [isTracking, isPaused]);

  // MediaSession API to prevent native phone music players from taking focus during workouts
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        if (isTracking && !isPaused) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: 'RunTracker 跑步監控中',
            artist: '體能監控與GPS發音提醒',
            album: 'RunTracker App'
          });
          navigator.mediaSession.playbackState = 'playing';
        } else if (!isTracking) {
          navigator.mediaSession.playbackState = 'none';
        } else if (isPaused) {
          navigator.mediaSession.playbackState = 'paused';
        }
      } catch (e) {
        console.warn('MediaSession error:', e);
      }
    }
  }, [isTracking, isPaused]);

  // Ref to track current duration for real GPS callbacks
  const durationSecRef = useRef(0);
  useEffect(() => {
    durationSecRef.current = durationSeconds;
  }, [durationSeconds]);

  const triggerGoalReached = (textMsg) => {
    setGoalReached(true);
    if (settings.voiceCues) {
      speakText(textMsg, settings.voiceVolume ?? 1.0);
    }
    if (settings.goalReachedAction === 'autoPause') {
      setIsPaused(true);
      if (settings.voiceCues) {
        setTimeout(() => {
          speakText('運動已自動暫停，請確認是否儲存紀錄。', settings.voiceVolume ?? 1.0);
        }, 3500);
      }
    }
  };

  // Update distance, calories, splits & goals helper
  const updateMetricsAndGoal = (incDist, speedKmh, currentSec) => {
    setDistanceKm((prevDist) => {
      const nextDist = prevDist + incDist;

      // Check 1 KM Voice Cues & Splits
      const currentKmIndex = Math.floor(nextDist);
      if (currentKmIndex > lastAnnouncedKmRef.current && currentKmIndex >= 1) {
        const kmDelta = currentKmIndex - lastAnnouncedKmRef.current;
        const elapsedSinceLast = currentSec - kmStartTimeRef.current;
        const avgSplitDuration = Math.max(1, Math.round(elapsedSinceLast / kmDelta));
        kmStartTimeRef.current = currentSec;

        const newSplits = [];
        for (let k = lastAnnouncedKmRef.current + 1; k <= currentKmIndex; k++) {
          const splitPace = formatPace(1, avgSplitDuration);
          newSplits.push({ km: k, pace: splitPace, timeSec: avgSplitDuration });
        }
        lastAnnouncedKmRef.current = currentKmIndex;

        setKmSplits((prev) => {
          const existingMap = new Map(prev.map((s) => [s.km, s]));
          newSplits.forEach((s) => existingMap.set(s.km, s));
          return Array.from(existingMap.values());
        });

        if (settings.voiceCues) {
          const lastPaceStr = newSplits[newSplits.length - 1].pace;
          speakText(
            `第 ${currentKmIndex} 公里完成，配速 ${lastPaceStr.replace("'", '分').replace('"', '秒')}`,
            settings.voiceVolume ?? 1.0
          );
        }
      }

      // Check Goal Distance
      if (targetGoal.type === 'distance' && nextDist >= targetGoal.targetValue && !goalReached) {
        triggerGoalReached(`太棒了！已達成目標里程 ${targetGoal.targetValue} 公里！`);
      }

      return nextDist;
    });

    // Pure side-effects cleanly placed outside setDistanceKm
    const newCal = calculateCaloriesBurned(
      profile.weightKg || 68,
      currentSec,
      speedKmh || 9.5
    );
    setCalories(newCal);
  };

  // Unified Location Processing Pipeline (for BOTH simulator & real GPS)
  const processLocationPoint = (lat, lng, rawSpeedMs = null, accuracy = null) => {
    if (!isTracking || isPaused) return; // Ignore incoming GPS points when paused

    const currentSec = durationSecRef.current;
    const newPoint = { lat, lng, timeSec: currentSec };

    let incDist = 0;
    let computedSpeedKmh = 0;

    if (simulatorMode) {
      setPathPoints((prevPath) => [...prevPath, newPoint]);

      computedSpeedKmh = rawSpeedMs !== null && rawSpeedMs > 0 ? rawSpeedMs * 3.6 : 10.2;
      incDist = (computedSpeedKmh * 1) / 3600; // 1s tick standard runner speed

      lastPointRef.current = newPoint;
      gpsWindowRef.current.push({ lat, lng, timeSec: currentSec, distKm: incDist });
    } else {
      // Real GPS Mode Anti-Drift Filtering

      // 1. Accuracy Filter: If GPS accuracy is worse than 45 meters, discard point
      if (accuracy !== null && typeof accuracy === 'number' && accuracy > 45) {
        console.warn('Real GPS point discarded due to low accuracy:', accuracy);
        return;
      }

      if (!lastValidGpsRef.current) {
        lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
        lastPointRef.current = newPoint;
        setPathPoints((prevPath) => [...prevPath, newPoint]);
        gpsWindowRef.current = [{ lat, lng, timeSec: currentSec, distKm: 0 }];
      } else {
        const rawDist = getHaversineDistance(lastValidGpsRef.current.lat, lastValidGpsRef.current.lng, lat, lng);
        const timeDeltaSec = Math.max(1, currentSec - lastValidGpsRef.current.timeSec);
        const impliedSpeedKmh = (rawDist / timeDeltaSec) * 3600;

        // 2. Maximum Human Speed Filter: Running speed max ~28 km/h (2'08"/km pace)
        const isSpeedSpike = impliedSpeedKmh > 28.0;

        if (isSpeedSpike) {
          console.warn(`GPS drift spike discarded! Speed: ${impliedSpeedKmh.toFixed(1)} km/h, distance: ${(rawDist * 1000).toFixed(0)}m in ${timeDeltaSec}s`);
          return;
        }

        // Accumulate valid movement (>= 0.3 meters or time delta gap)
        if (rawDist >= 0.0003 || timeDeltaSec >= 1) {
          if (rawDist >= 0.0003) {
            incDist = rawDist;
          }
          if (rawSpeedMs !== null && rawSpeedMs > 0 && rawSpeedMs * 3.6 <= 28) {
            computedSpeedKmh = rawSpeedMs * 3.6;
          } else if (incDist > 0 && timeDeltaSec > 0) {
            computedSpeedKmh = impliedSpeedKmh;
          }
          lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
          lastPointRef.current = newPoint;
          setPathPoints((prevPath) => [...prevPath, newPoint]);
          gpsWindowRef.current.push({ lat, lng, timeSec: currentSec, distKm: incDist });
        }
      }
    }

    // Maintain 25-second rolling window buffer for instant pace & speed smoothing
    gpsWindowRef.current = gpsWindowRef.current.filter((pt) => currentSec - pt.timeSec <= 25);

    if (gpsWindowRef.current.length >= 2) {
      const windowStart = gpsWindowRef.current[0];
      const windowEnd = gpsWindowRef.current[gpsWindowRef.current.length - 1];
      const windowTimeSec = Math.max(1, windowEnd.timeSec - windowStart.timeSec);

      let windowDistKm = 0;
      for (let i = 1; i < gpsWindowRef.current.length; i++) {
        windowDistKm += gpsWindowRef.current[i].distKm || 0;
      }

      if (windowDistKm > 0.003 && windowTimeSec > 0) {
        const rawRollingSpeed = (windowDistKm / windowTimeSec) * 3600;
        const rawRollingPace = windowTimeSec / windowDistKm; // sec/km

        if (rawRollingSpeed >= 2.0 && rawRollingSpeed <= 26.0) {
          if (rollingPaceRef.current === 0) {
            rollingPaceRef.current = rawRollingPace;
          } else {
            // EMA smoothing: 80% history + 20% instant sample
            rollingPaceRef.current = (rollingPaceRef.current * 0.8) + (rawRollingPace * 0.2);
          }
        }

        if (computedSpeedKmh <= 0) {
          computedSpeedKmh = rawRollingSpeed;
        } else {
          computedSpeedKmh = (computedSpeedKmh * 0.5) + (rawRollingSpeed * 0.5);
        }
      }
    }

    // 3. Update Speed State
    if (computedSpeedKmh > 0) {
      const boundedSpeed = Math.min(25, Math.max(0, computedSpeedKmh));
      setCurrentSpeedKmh(boundedSpeed);
    }

    // 4. Update Distance, Calories, Splits & Goals
    if (incDist > 0) {
      updateMetricsAndGoal(incDist, computedSpeedKmh, currentSec);
    }
  };

  // Always keep processLocationPointRef updated to latest function
  const processLocationPointRef = useRef(processLocationPoint);
  processLocationPointRef.current = processLocationPoint;

  // Main Timer & Simulator Tick Loop
  useEffect(() => {
    if (!isTracking) return;

    // Check Auto-Resume when system auto-paused and speed goes back up
    if (isPaused) {
      if (settings.autoPause && isAutoPausedBySystemRef.current && currentSpeedKmh >= (settings.autoPauseSpeedThresholdKmh || 2.5) + 0.5) {
        highSpeedSecondsRef.current += 1;
        if (highSpeedSecondsRef.current >= 2) {
          setIsPaused(false);
          isAutoPausedBySystemRef.current = false;
          highSpeedSecondsRef.current = 0;
          lowSpeedSecondsRef.current = 0;
          if (settings.voiceCues) {
            speakText('偵測到持續移動，繼續計時跑步！', settings.voiceVolume ?? 1.0);
          }
        }
      } else {
        highSpeedSecondsRef.current = 0;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setDurationSeconds((prevSec) => prevSec + 1);
      durationSecRef.current += 1;
      const nextSec = durationSecRef.current;

      if (gracePeriodSecRef.current > 0) {
        gracePeriodSecRef.current -= 1;
      }

      if (simulatorMode) {
        if (!simulatorInstanceRef.current) {
          simulatorInstanceRef.current = new GPSSimulator(settings.presetRoute || 'daan');
        }
        const simData = simulatorInstanceRef.current.nextPoint(3); // 3x step for responsive testing UI updates
        if (processLocationPointRef.current) {
          processLocationPointRef.current(simData.lat, simData.lng, simData.speedKmh / 3.6);
        }
      }

      // Auto-Pause check when speed is too low (Disabled in simulatorMode or during 20s grace period / start phase)
      if (settings.autoPause && !simulatorMode && gracePeriodSecRef.current <= 0 && nextSec >= 20 && distanceKm >= 0.03) {
        const pauseThreshold = settings.autoPauseSpeedThresholdKmh || 2.5;
        if (currentSpeedKmh < pauseThreshold) {
          lowSpeedSecondsRef.current += 1;
          if (lowSpeedSecondsRef.current >= 5) {
            setIsPaused(true);
            isAutoPausedBySystemRef.current = true;
            lowSpeedSecondsRef.current = 0;
            if (settings.voiceCues) {
              speakText('速度低於門檻，運動已自動暫停', settings.voiceVolume ?? 1.0);
            }
          }
        } else {
          lowSpeedSecondsRef.current = 0;
        }
      } else {
        lowSpeedSecondsRef.current = 0;
      }

      // Pace Zone Alert check (Debounce 25 seconds & require 10 seconds continuous out-of-zone)
      if (settings.paceZoneEnabled && settings.voiceCues && distanceKm >= 0.1) {
        const paceComp = getPaceComparison();
        const curPaceSec = paceComp.currentPaceSec;
        const minSec = paceToSeconds(settings.targetPaceMin || '05:00');
        const maxSec = paceToSeconds(settings.targetPaceMax || '06:30');

        const isTooFast = curPaceSec > 120 && curPaceSec < minSec;
        const isTooSlow = curPaceSec > maxSec && curPaceSec < 1200;

        if (isTooFast || isTooSlow) {
          outOfZoneSecondsRef.current += 1;
          if (outOfZoneSecondsRef.current >= 10 && (nextSec - lastPaceAlertTimeRef.current >= 25)) {
            lastPaceAlertTimeRef.current = nextSec;
            outOfZoneSecondsRef.current = 0;
            const pStr = paceComp.currentPaceStr.replace("'", '分').replace('"', '秒');
            if (isTooFast) {
              speakText(`注意！當前配速 ${pStr}，高於目標區間，請放慢步伐！`, settings.voiceVolume ?? 1.0);
            } else {
              speakText(`提醒！當前配速 ${pStr}，低於目標區間，請加加油！`, settings.voiceVolume ?? 1.0);
            }
          }
        } else {
          outOfZoneSecondsRef.current = 0;
        }
      }

      // Time Goal check
      if (targetGoal.type === 'time' && nextSec >= targetGoal.targetValue * 60 && !goalReached) {
        triggerGoalReached(`目標時間 ${targetGoal.targetValue} 分鐘已達成！`);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, isPaused, simulatorMode]);

  // Real Device Geolocation Watcher
  useEffect(() => {
    if (!isTracking || isPaused || simulatorMode || typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed, accuracy } = pos.coords;
        if (processLocationPointRef.current) {
          processLocationPointRef.current(latitude, longitude, speed, accuracy);
        }
      },
      (err) => console.warn('Real Geolocation warning:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, isPaused, simulatorMode]);

  // Dynamic Pace Comparison (Current Km Segment Pace vs Overall Average Pace)
  const getPaceComparison = () => {
    const avgPaceSec = distanceKm > 0.05 && durationSeconds > 0 ? durationSeconds / distanceKm : 0;
    const avgPaceStr = formatPace(distanceKm, durationSeconds);

    const currentKmNum = Math.floor(distanceKm) + 1;

    let currentPaceSec = 0;

    const currentKmDist = distanceKm - Math.floor(distanceKm);
    const currentKmTime = Math.max(0, durationSeconds - kmStartTimeRef.current);

    if (currentKmDist >= 0.03 && currentKmTime > 0) {
      const segmentPaceSec = currentKmTime / currentKmDist;
      if (currentKmDist < 0.10 && rollingPaceRef.current > 0) {
        // Blend rolling pace and segment pace at start of new kilometer for smooth transition
        const blendWeight = (currentKmDist - 0.03) / 0.07; // 0.0 to 1.0
        currentPaceSec = (segmentPaceSec * blendWeight) + (rollingPaceRef.current * (1 - blendWeight));
      } else {
        currentPaceSec = segmentPaceSec;
      }
    } else if (rollingPaceRef.current > 0) {
      currentPaceSec = rollingPaceRef.current;
    } else if (currentSpeedKmh > 0) {
      currentPaceSec = 3600 / currentSpeedKmh;
    } else {
      currentPaceSec = avgPaceSec;
    }

    // Clamp currentPaceSec to realistic human bounds (120s to 1200s, i.e., 2:00 to 20:00)
    if (currentPaceSec > 0) {
      currentPaceSec = Math.min(1200, Math.max(120, currentPaceSec));
    }

    const currentPaceStr = currentPaceSec > 0 ? formatPace(1, currentPaceSec) : "--'--\"";
    const isFasterOrEqual = avgPaceSec <= 0 || currentPaceSec <= avgPaceSec;

    return {
      avgPaceStr,
      avgPaceSec,
      currentPaceStr,
      currentPaceSec,
      currentKmNum,
      isFasterOrEqual
    };
  };

  return (
    <RunContext.Provider
      value={{
        profile,
        updateProfile,
        settings,
        updateSettings,
        history,
        deleteRunRecord,
        isTracking,
        isPaused,
        durationSeconds,
        distanceKm,
        currentSpeedKmh,
        calories,
        pathPoints,
        kmSplits,
        targetGoal,
        setTargetGoal,
        saveDefaultGoal,
        goalReached,
        simulatorMode,
        setSimulatorMode,
        isTouchLocked,
        setIsTouchLocked,
        isOutdoorView,
        setIsOutdoorView,
        startRun,
        pauseRun,
        resumeRun,
        stopRun,
        getPaceComparison,
        generateGPX,
        downloadFile,
        calculatePersonalRecords
      }}
    >
      {children}
    </RunContext.Provider>
  );
}

export function useRunContext() {
  return useContext(RunContext);
}

function getRunTitle(date) {
  const hours = date.getHours();
  let timeStr = '跑步';
  if (hours >= 5 && hours < 9) timeStr = '晨間跑步';
  else if (hours >= 9 && hours < 17) timeStr = '日間戶外跑';
  else if (hours >= 17 && hours < 21) timeStr = '傍晚舒壓跑';
  else timeStr = '深夜自主跑';
  return timeStr;
}

function getHikeTitle(date) {
  const hours = date.getHours();
  let timeStr = '健行';
  if (hours >= 5 && hours < 12) timeStr = '晨間山岳健行';
  else if (hours >= 12 && hours < 17) timeStr = '午後步道探索';
  else timeStr = '傍晚戶外健行';
  return timeStr;
}
