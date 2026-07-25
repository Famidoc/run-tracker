import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { StorageService } from '../utils/storage';
import {
  getHaversineDistance,
  calculateCaloriesBurned,
  formatPace,
  formatSpeed,
  speakText,
  ensureCompleteKmSplits,
  calculateTotalPathDistance
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
  const [simulatorMode, setSimulatorMode] = useState(() => initialData ? initialData.simulatorMode : true);

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

  const lastAnnouncedKmRef = useRef(0);
  const lastPointRef = useRef(null);
  const lastValidGpsRef = useRef(null); // { lat, lng, timeSec }
  const kmStartTimeRef = useRef(0);

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
    kmStartTimeRef.current = 0;

    if (settings.voiceCues) {
      speakText('跑步開始，加油！');
    }

    // Initialize Simulator or Real Geolocation
    if (simulatorMode) {
      simulatorInstanceRef.current = new GPSSimulator(settings.presetRoute || 'daan');
    }
  };

  // Pause
  const pauseRun = () => {
    setIsPaused(true);
    if (settings.voiceCues) {
      speakText('已暫停跑步');
    }
  };

  // Resume
  const resumeRun = () => {
    setIsPaused(false);
    if (settings.voiceCues) {
      speakText('繼續跑步');
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
      speakText(`跑步完成！本次完成 ${finalDist} 公里，耗時 ${Math.floor(durationSeconds / 60)} 分鐘，消耗 ${finalCalories} 卡路里。`);
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

  // Ref to track current duration for real GPS callbacks
  const durationSecRef = useRef(0);
  useEffect(() => {
    durationSecRef.current = durationSeconds;
  }, [durationSeconds]);

  const triggerGoalReached = (textMsg) => {
    setGoalReached(true);
    if (settings.voiceCues) {
      speakText(textMsg);
    }
    if (settings.goalReachedAction === 'autoPause') {
      setIsPaused(true);
      if (settings.voiceCues) {
        setTimeout(() => {
          speakText('運動已自動暫停，請確認是否儲存紀錄。');
        }, 3500);
      }
    }
  };

  // Update distance, calories, splits & goals helper
  const updateMetricsAndGoal = (incDist, speedKmh, currentSec) => {
    setDistanceKm((prevDist) => {
      const nextDist = prevDist + incDist;

      // Update Calories
      const newCal = calculateCaloriesBurned(
        profile.weightKg || 68,
        currentSec,
        speedKmh || 9.5
      );
      setCalories(newCal);

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
            `第 ${currentKmIndex} 公里完成，配速 ${lastPaceStr.replace("'", '分').replace('"', '秒')}`
          );
        }
      }

      // Check Goal Distance
      if (targetGoal.type === 'distance' && nextDist >= targetGoal.targetValue && !goalReached) {
        triggerGoalReached(`太棒了！已達成目標里程 ${targetGoal.targetValue} 公里！`);
      }

      return nextDist;
    });
  };

  // Unified Location Processing Pipeline (for BOTH simulator & real GPS)
  const processLocationPoint = (lat, lng, rawSpeedMs = null) => {
    const newPoint = { lat, lng };
    const currentSec = durationSecRef.current;

    // 1. Update Path Points
    setPathPoints((prevPath) => [...prevPath, newPoint]);

    // 2. Calculate Distance Increment & Speed
    let incDist = 0;
    let computedSpeedKmh = 0;

    if (simulatorMode) {
      if (lastPointRef.current) {
        incDist = getHaversineDistance(lastPointRef.current.lat, lastPointRef.current.lng, lat, lng);
        if (rawSpeedMs !== null && rawSpeedMs > 0) {
          computedSpeedKmh = rawSpeedMs * 3.6;
        } else if (incDist > 0) {
          computedSpeedKmh = incDist * 3600;
        }
      }
    } else {
      // Real GPS Mode
      if (!lastValidGpsRef.current) {
        lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
      } else {
        const rawDist = getHaversineDistance(lastValidGpsRef.current.lat, lastValidGpsRef.current.lng, lat, lng);
        const timeDeltaSec = Math.max(1, currentSec - lastValidGpsRef.current.timeSec);

        // Filter teleports > 200m in < 5s
        const isTeleport = rawDist > 0.2 && timeDeltaSec < 5;

        // Accumulate if displacement >= 0.0003km (0.3 meters) or time >= 1s
        if (!isTeleport && (rawDist >= 0.0003 || timeDeltaSec >= 1)) {
          if (rawDist >= 0.0003) {
            incDist = rawDist;
          }
          if (rawSpeedMs !== null && rawSpeedMs > 0) {
            computedSpeedKmh = rawSpeedMs * 3.6;
          } else if (incDist > 0 && timeDeltaSec > 0) {
            computedSpeedKmh = (incDist / timeDeltaSec) * 3600;
          }
          lastValidGpsRef.current = { lat, lng, timeSec: currentSec };
        }
      }
    }

    lastPointRef.current = newPoint;

    // 3. Update Speed State
    if (computedSpeedKmh > 0) {
      const boundedSpeed = Math.min(35, Math.max(0, computedSpeedKmh));
      setCurrentSpeedKmh(boundedSpeed);
    }

    // 4. Update Distance, Calories, Splits & Goals (TOP-LEVEL STATE UPDATES)
    if (incDist > 0) {
      updateMetricsAndGoal(incDist, computedSpeedKmh, currentSec);
    }
  };

  // Main Timer & Simulator Tick Loop
  useEffect(() => {
    if (!isTracking || isPaused) return;

    timerRef.current = setInterval(() => {
      setDurationSeconds((prevSec) => {
        const nextSec = prevSec + 1;

        if (simulatorMode && simulatorInstanceRef.current) {
          const simData = simulatorInstanceRef.current.nextPoint(1);
          processLocationPoint(simData.lat, simData.lng, simData.speedKmh / 3.6);
        }

        // Time Goal check
        if (targetGoal.type === 'time' && nextSec >= targetGoal.targetValue * 60 && !goalReached) {
          triggerGoalReached(`目標時間 ${targetGoal.targetValue} 分鐘已達成！`);
        }

        return nextSec;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTracking, isPaused, simulatorMode, profile.weightKg, settings.voiceCues, targetGoal, goalReached, settings.goalReachedAction]);

  // Real Device Geolocation Watcher
  useEffect(() => {
    if (!isTracking || isPaused || simulatorMode || typeof window === 'undefined' || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, speed } = pos.coords;
        processLocationPoint(latitude, longitude, speed);
      },
      (err) => console.warn('Real Geolocation warning:', err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking, isPaused, simulatorMode]);

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
        startRun,
        pauseRun,
        resumeRun,
        stopRun
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
