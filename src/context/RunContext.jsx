import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { StorageService } from '../utils/storage';
import { IDBService } from '../utils/indexedDB';
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
  const [trash, setTrash] = useState(() => StorageService.getTrash());

  // Auto clean trash & restore from IndexedDB if needed on startup
  useEffect(() => {
    const cleaned = StorageService.clearOldTrash(30);
    setTrash(cleaned);

    // Background restore from IndexedDB if LocalStorage was cleared
    IDBService.getAllRuns().then((idbRuns) => {
      if (idbRuns && idbRuns.length > 0) {
        setHistory((prev) => {
          const map = new Map(prev.map((r) => [r.id, r]));
          let hasNew = false;
          idbRuns.forEach((r) => {
            if (!map.has(r.id)) {
              map.set(r.id, r);
              hasNew = true;
            }
          });
          if (hasNew) {
            const merged = Array.from(map.values()).sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            return merged;
          }
          return prev;
        });
      }
    }).catch((e) => console.warn('IDB startup restore warning:', e));
  }, []);

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

  // Save active session to localStorage (Throttled & compressed to prevent storage exhaustion)
  useEffect(() => {
    if (isTracking) {
      try {
        // Keep active session small: only latest 80 points
        const slimPath = pathPoints.slice(-80);
        localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
          isTracking,
          isPaused,
          durationSeconds,
          distanceKm,
          currentSpeedKmh,
          calories,
          pathPoints: slimPath,
          kmSplits,
          targetGoal,
          simulatorMode,
          lastAnnouncedKm: lastAnnouncedKmRef.current,
          kmStartTime: kmStartTimeRef.current,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Active session save warning:', e);
      }
    } else {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
  }, [isTracking, isPaused, durationSeconds, distanceKm, currentSpeedKmh, calories, pathPoints, kmSplits, targetGoal, simulatorMode]);

  // Web Audio Background Keep-Alive Audio Loop (Prevents mobile OS browser sleep & tab eviction)
  const silentAudioRef = useRef(null);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        audio.loop = true;
        silentAudioRef.current = audio;
      } catch (e) {
        console.warn('Silent audio init warning:', e);
      }
    }
  }, []);

  const playBackgroundAudio = () => {
    if (silentAudioRef.current) {
      silentAudioRef.current.play().catch(() => {});
    }
  };

  const pauseBackgroundAudio = () => {
    if (silentAudioRef.current) {
      silentAudioRef.current.pause();
    }
  };

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
    gracePeriodSecRef.current = 25; // 25s Grace Period on Start to prevent auto-pause trap
    outOfZoneSecondsRef.current = 0;

    playBackgroundAudio();

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
    gracePeriodSecRef.current = 25; // 25s Grace Period on Resume to prevent auto-pause trap
    outOfZoneSecondsRef.current = 0;

    // CRITICAL RESET: Reset lastValidGpsRef & rolling window so post-resume location doesn't calculate jump against pre-pause location
    lastValidGpsRef.current = null;
    lastPointRef.current = null;
    gpsWindowRef.current = [];
    rollingPaceRef.current = 0;

    playBackgroundAudio();

    if (settings.voiceCues) {
      speakText('繼續跑步', settings.voiceVolume ?? 1.0);
    }
  };

  // Prepare Stop Draft (Pauses activity and prepares complete record without deleting ongoing state)
  const getSummaryDraft = () => {
    setIsPaused(true);
    const calculatedPathDist = calculateTotalPathDistance(pathPoints);
    const safeDist = typeof distanceKm === 'number' && !isNaN(distanceKm) ? distanceKm : 0;
    const finalDist = Math.max(parseFloat(safeDist.toFixed(2)), calculatedPathDist);
    const finalSec = durationSeconds || 0;

    const avgPace = formatPace(finalDist, finalSec);
    const avgSpeedKmh = parseFloat(formatSpeed(finalDist, finalSec)) || 0;
    const finalCalories = calories > 0 ? calories : calculateCaloriesBurned(profile?.weightKg || 68, finalSec, avgSpeedKmh || 9.5);

    const completeSplits = ensureCompleteKmSplits({
      distanceKm: finalDist,
      durationSeconds: finalSec,
      kmSplits
    });

    return {
      id: `run-${Date.now()}`,
      date: new Date().toISOString(),
      distanceKm: finalDist,
      durationSeconds: finalSec,
      avgPace,
      avgSpeedKmh,
      calories: finalCalories,
      title: getRunTitle(new Date()),
      path: pathPoints || [],
      kmSplits: completeSplits
    };
  };

  // Confirm Save Run (Officially saves to History/IDB and clears state)
  const confirmSaveRun = (recordToSave) => {
    const record = recordToSave || getSummaryDraft();
    const updatedHistory = StorageService.saveRunRecord(record);
    setHistory(updatedHistory);

    pauseBackgroundAudio();

    if (settings?.voiceCues) {
      try {
        speakText(`跑步完成！本次完成 ${record.distanceKm} 公里，耗時 ${Math.floor(record.durationSeconds / 60)} 分鐘，消耗 ${record.calories} 卡路里。`, settings?.voiceVolume ?? 1.0);
      } catch (ve) {
        console.warn('Speech warning:', ve);
      }
    }

    resetRunState();
    return record;
  };

  // Confirm Discard Run (Moves record directly to Trash and clears state)
  const confirmDiscardRun = (recordToDiscard) => {
    const record = recordToDiscard || getSummaryDraft();
    const updatedTrash = StorageService.addDirectToTrash(record);
    setTrash(updatedTrash);
    pauseBackgroundAudio();
    resetRunState();
  };

  // Resume Running from Stop Dialog (User clicked "繼續跑")
  const resumeFromStop = () => {
    resumeRun();
  };

  // Stop & Save (Legacy Direct Wrapper)
  const stopRun = () => {
    try {
      const draft = getSummaryDraft();
      return confirmSaveRun(draft);
    } catch (e) {
      console.error('stopRun emergency recovery error:', e);
      // Emergency Record Creation
      const emergencyRecord = {
        id: `run-${Date.now()}`,
        date: new Date().toISOString(),
        distanceKm: typeof distanceKm === 'number' ? parseFloat(distanceKm.toFixed(2)) : 0,
        durationSeconds: durationSeconds || 0,
        avgPace: formatPace(distanceKm, durationSeconds),
        avgSpeedKmh: parseFloat(formatSpeed(distanceKm, durationSeconds)) || 0,
        calories: calories || 0,
        title: getRunTitle(new Date()),
        path: [],
        kmSplits: kmSplits || []
      };
      const updatedHistory = StorageService.saveRunRecord(emergencyRecord);
      setHistory(updatedHistory);
      pauseBackgroundAudio();
      resetRunState();
      return emergencyRecord;
    }
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
    pauseBackgroundAudio();
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch (e) {}
  };

  // Move run record to trash (Soft Delete)
  const deleteRunRecord = (id) => {
    const result = StorageService.moveToTrash(id);
    setHistory(result.history);
    setTrash(result.trash);
  };

  // Discard run record safely to trash (Used when user chooses "不用儲存" after finishing)
  const discardRunRecord = (record) => {
    if (!record) return;
    const updatedHistory = StorageService.getHistory().filter(item => item.id !== record.id);
    localStorage.setItem('runtracker_history_v1', JSON.stringify(updatedHistory));
    setHistory(updatedHistory);

    const updatedTrash = StorageService.addDirectToTrash(record);
    setTrash(updatedTrash);
  };

  // Restore run record from trash back to history
  const restoreRunRecord = (id) => {
    const result = StorageService.restoreFromTrash(id);
    setHistory(result.history);
    setTrash(result.trash);
  };

  // Permanently delete a single record from trash
  const permanentDeleteRunRecord = (id) => {
    const updatedTrash = StorageService.permanentDeleteTrash(id);
    setTrash(updatedTrash);
  };

  // Empty all records from trash
  const emptyTrash = () => {
    const updatedTrash = StorageService.emptyTrash();
    setTrash(updatedTrash);
  };

  // Manually add run record
  const addManualRunRecord = ({ date, distanceKm, durationSeconds, title, notes }) => {
    const finalDist = parseFloat(parseFloat(distanceKm).toFixed(2));
    const finalDuration = parseInt(durationSeconds, 10);
    const avgPace = formatPace(finalDist, finalDuration);
    const avgSpeedKmh = parseFloat(formatSpeed(finalDist, finalDuration));
    const finalCalories = calculateCaloriesBurned(profile.weightKg || 68, finalDuration, avgSpeedKmh || 9.5);

    const completeSplits = ensureCompleteKmSplits({
      distanceKm: finalDist,
      durationSeconds: finalDuration,
      kmSplits: []
    });

    const runDate = date ? new Date(date) : new Date();
    const newRecord = {
      id: `manual-${Date.now()}`,
      date: runDate.toISOString(),
      distanceKm: finalDist,
      durationSeconds: finalDuration,
      avgPace,
      avgSpeedKmh,
      calories: finalCalories,
      title: title?.trim() || getRunTitle(runDate),
      notes: notes?.trim() || '',
      isManual: true,
      path: [],
      kmSplits: completeSplits
    };

    const updatedHistory = StorageService.saveRunRecord(newRecord);
    setHistory(updatedHistory);
    return newRecord;
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
        playBackgroundAudio();
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
    if (!isTracking) return;

    const currentSec = durationSecRef.current;
    let incDist = 0;
    let computedSpeedKmh = 0;

    // IF PAUSED: Do not accumulate distance or path, BUT keep updating real-time speed to enable Auto-Resume
    if (isPaused) {
      if (!simulatorMode && accuracy !== null && typeof accuracy === 'number' && accuracy <= 40) {
        if (lastValidGpsRef.current) {
          const rawDist = getHaversineDistance(lastValidGpsRef.current.lat, lastValidGpsRef.current.lng, lat, lng);
          const timeDeltaSec = Math.max(1, currentSec - lastValidGpsRef.current.timeSec);
          if (timeDeltaSec >= 1 && rawDist < 0.15) {
            const impliedSpeed = (rawDist / timeDeltaSec) * 3600;
            if (impliedSpeed <= 22.0) {
              const curSpeed = rawSpeedMs !== null && rawSpeedMs > 0 && rawSpeedMs * 3.6 <= 22 ? rawSpeedMs * 3.6 : impliedSpeed;
              if (curSpeed >= 3.0) {
                highSpeedSecondsRef.current += 1;
                if (highSpeedSecondsRef.current >= 3 && isAutoPausedBySystemRef.current && settings.autoPause) {
                  // AUTO-RESUME TRIGGERED! (Unlocks the deadlock)
                  resumeRun();
                  if (settings.voiceCues) {
                    speakText('偵測到持續移動，自動恢復計時！', settings.voiceVolume ?? 1.0);
                  }
                  return;
                }
              } else {
                highSpeedSecondsRef.current = 0;
              }
            }
          }
        }
        lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
      }
      return;
    }

    const newPoint = { lat, lng, timeSec: currentSec };

    if (simulatorMode) {
      setPathPoints((prevPath) => [...prevPath, newPoint]);

      computedSpeedKmh = rawSpeedMs !== null && rawSpeedMs > 0 ? rawSpeedMs * 3.6 : 10.2;
      incDist = (computedSpeedKmh * 1) / 3600; // 1s tick standard runner speed

      lastPointRef.current = newPoint;
      gpsWindowRef.current.push({ lat, lng, timeSec: currentSec, distKm: incDist });
    } else {
      // Real GPS Mode Anti-Drift & Anti-Burst Filtering

      // 1. Accuracy Filter: If GPS accuracy is worse than 40 meters, discard point
      if (accuracy !== null && typeof accuracy === 'number' && accuracy > 40) {
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

        // 2. Anti-Burst Filter: Discard speed spikes > 24 km/h (pace < 2'30"/km) caused by GPS batch delivery
        if (impliedSpeedKmh > 24.0) {
          console.warn(`GPS burst spike discarded! Speed: ${impliedSpeedKmh.toFixed(1)} km/h, distance: ${(rawDist * 1000).toFixed(0)}m in ${timeDeltaSec}s`);
          return;
        }

        // Accumulate valid movement (>= 0.4 meters)
        if (rawDist >= 0.0004) {
          incDist = rawDist;
          if (rawSpeedMs !== null && rawSpeedMs > 0 && rawSpeedMs * 3.6 <= 24) {
            computedSpeedKmh = rawSpeedMs * 3.6;
          } else {
            computedSpeedKmh = impliedSpeedKmh;
          }
          lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
          lastPointRef.current = newPoint;
          setPathPoints((prevPath) => [...prevPath, newPoint]);
          gpsWindowRef.current.push({ lat, lng, timeSec: currentSec, distKm: incDist });
        } else if (timeDeltaSec >= 3) {
          // Stationary position refresh
          lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
        }
      }
    }

    // Maintain 30-second rolling window buffer for stable instant pace & speed smoothing
    gpsWindowRef.current = gpsWindowRef.current.filter((pt) => currentSec - pt.timeSec <= 30);

    if (gpsWindowRef.current.length >= 2) {
      const windowStart = gpsWindowRef.current[0];
      const windowEnd = gpsWindowRef.current[gpsWindowRef.current.length - 1];
      const windowTimeSec = Math.max(1, windowEnd.timeSec - windowStart.timeSec);

      let windowDistKm = 0;
      for (let i = 1; i < gpsWindowRef.current.length; i++) {
        windowDistKm += gpsWindowRef.current[i].distKm || 0;
      }

      if (windowDistKm >= 0.005 && windowTimeSec >= 3) {
        const rawRollingSpeed = (windowDistKm / windowTimeSec) * 3600;
        const rawRollingPace = windowTimeSec / windowDistKm; // sec/km

        if (rawRollingSpeed >= 2.0 && rawRollingSpeed <= 24.0) {
          if (rollingPaceRef.current === 0) {
            rollingPaceRef.current = rawRollingPace;
          } else {
            // Stable Low-Pass EMA smoothing: 75% history + 25% window sample (prevents pace volatility)
            rollingPaceRef.current = (rollingPaceRef.current * 0.75) + (rawRollingPace * 0.25);
          }
        }

        if (computedSpeedKmh <= 0) {
          computedSpeedKmh = rawRollingSpeed;
        } else {
          computedSpeedKmh = (computedSpeedKmh * 0.6) + (rawRollingSpeed * 0.4);
        }
      }
    }

    // 3. Update Speed State
    if (computedSpeedKmh > 0) {
      const boundedSpeed = Math.min(24, Math.max(0, computedSpeedKmh));
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

    // Timer Tick
    timerRef.current = setInterval(() => {
      if (!isPaused) {
        setDurationSeconds((prevSec) => prevSec + 1);
        durationSecRef.current += 1;
      }
      const nextSec = durationSecRef.current;

      if (gracePeriodSecRef.current > 0 && !isPaused) {
        gracePeriodSecRef.current -= 1;
      }

      if (simulatorMode && !isPaused) {
        if (!simulatorInstanceRef.current) {
          simulatorInstanceRef.current = new GPSSimulator(settings.presetRoute || 'daan');
        }
        const simData = simulatorInstanceRef.current.nextPoint(3); // 3x step for responsive testing UI updates
        if (processLocationPointRef.current) {
          processLocationPointRef.current(simData.lat, simData.lng, simData.speedKmh / 3.6);
        }
      }

      // Auto-Pause check when speed is too low (Requires 10 continuous seconds of speed < 2.0 km/h)
      if (settings.autoPause && !simulatorMode && !isPaused && gracePeriodSecRef.current <= 0 && nextSec >= 25 && distanceKm >= 0.05) {
        const pauseThreshold = settings.autoPauseSpeedThresholdKmh || 2.0;
        if (currentSpeedKmh < pauseThreshold) {
          lowSpeedSecondsRef.current += 1;
          if (lowSpeedSecondsRef.current >= 10) {
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

      // Pace Zone Alert check (Debounce 60 seconds & require 15 continuous seconds out-of-zone)
      if (settings.paceZoneEnabled && settings.voiceCues && !isPaused && distanceKm >= 0.15) {
        const paceComp = getPaceComparison();
        const curPaceSec = paceComp.currentPaceSec;
        const minSec = paceToSeconds(settings.targetPaceMin || '05:00');
        const maxSec = paceToSeconds(settings.targetPaceMax || '06:30');

        // Human running bounds (2'30" to 16'40")
        const isTooFast = curPaceSec >= 150 && curPaceSec < minSec;
        const isTooSlow = curPaceSec > maxSec && curPaceSec <= 1000;

        if (isTooFast || isTooSlow) {
          outOfZoneSecondsRef.current += 1;
          if (outOfZoneSecondsRef.current >= 15 && (nextSec - lastPaceAlertTimeRef.current >= 60)) {
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
      if (targetGoal.type === 'time' && !isPaused && nextSec >= targetGoal.targetValue * 60 && !goalReached) {
        triggerGoalReached(`目標時間 ${targetGoal.targetValue} 分鐘已達成！`);
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, isPaused, simulatorMode]);

  // Real Device Geolocation Watcher (Keeps watching during tracking, even when paused, to allow Auto-Resume)
  useEffect(() => {
    if (!isTracking || simulatorMode || typeof window === 'undefined' || !navigator.geolocation) return;

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
  }, [isTracking, simulatorMode]);

  // Dynamic Pace Comparison (Current Km Segment Pace vs Overall Average Pace)
  const getPaceComparison = () => {
    const avgPaceSec = distanceKm > 0.05 && durationSeconds > 0 ? durationSeconds / distanceKm : 0;
    const avgPaceStr = formatPace(distanceKm, durationSeconds);

    const currentKmNum = Math.floor(distanceKm) + 1;

    let currentPaceSec = 0;

    const currentKmDist = distanceKm - Math.floor(distanceKm);
    const currentKmTime = Math.max(0, durationSeconds - kmStartTimeRef.current);

    if (rollingPaceRef.current > 0) {
      currentPaceSec = rollingPaceRef.current;
    } else if (currentKmDist >= 0.05 && currentKmTime > 0) {
      currentPaceSec = currentKmTime / currentKmDist;
    } else if (currentSpeedKmh > 0) {
      currentPaceSec = 3600 / currentSpeedKmh;
    } else {
      currentPaceSec = avgPaceSec;
    }

    // Clamp currentPaceSec to realistic human bounds (150s to 1200s, i.e., 2:30 to 20:00)
    if (currentPaceSec > 0) {
      currentPaceSec = Math.min(1200, Math.max(150, currentPaceSec));
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
        trash,
        deleteRunRecord,
        discardRunRecord,
        restoreRunRecord,
        permanentDeleteRunRecord,
        emptyTrash,
        addManualRunRecord,
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
        getSummaryDraft,
        confirmSaveRun,
        confirmDiscardRun,
        resumeFromStop,
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
