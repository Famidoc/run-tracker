/**
 * RunTracker Storage Service
 * Handles persistence of running history, user profile, and settings.
 */

const STORAGE_KEYS = {
  RUN_HISTORY: 'runtracker_history_v1',
  USER_PROFILE: 'runtracker_profile_v1',
  SETTINGS: 'runtracker_settings_v1'
};

const DEFAULT_PROFILE = {
  name: '跑者',
  gender: 'male', // 'male' | 'female'
  weightKg: 68,
  heightCm: 175,
  age: 28,
  weeklyTargetKm: 25
};

const DEFAULT_SETTINGS = {
  voiceCues: true,
  cueDistanceKm: 1.0, // Every 1km
  useSimulator: true, // Default enabled for desktop testing
  theme: 'dark',
  presetRoute: 'daan',
  defaultGoal: {
    type: 'free',
    distanceValue: 5.0,
    timeValue: 30
  }
};

export const StorageService = {
  // Profile
  getProfile() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? { ...DEFAULT_PROFILE, ...JSON.parse(data) } : DEFAULT_PROFILE;
    } catch {
      return DEFAULT_PROFILE;
    }
  },

  saveProfile(profile) {
    try {
      localStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
    } catch (e) {
      console.error('Save profile error:', e);
    }
  },

  // Settings
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Save settings error:', e);
    }
  },

  // Run History
  getHistory() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RUN_HISTORY);
      if (!data) return getInitialSampleData();
      return JSON.parse(data);
    } catch {
      return getInitialSampleData();
    }
  },

  saveRunRecord(record) {
    try {
      const history = this.getHistory();
      const updated = [record, ...history];
      localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Save run error:', e);
      return [];
    }
  },

  deleteRunRecord(id) {
    try {
      const history = this.getHistory();
      const updated = history.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Delete run error:', e);
      return [];
    }
  },

  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.RUN_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
  },

  exportJSON() {
    const data = {
      profile: this.getProfile(),
      settings: this.getSettings(),
      history: this.getHistory(),
      exportDate: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  },

  importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.profile) this.saveProfile(parsed.profile);
      if (parsed.settings) this.saveSettings(parsed.settings);
      if (parsed.history && Array.isArray(parsed.history)) {
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(parsed.history));
      }
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
};

// Provide sample data for immediate visual wow on first load!
function getInitialSampleData() {
  const now = new Date();
  
  const sample1Date = new Date(now.getTime() - 86400000 * 1).toISOString(); // Yesterday
  const sample2Date = new Date(now.getTime() - 86400000 * 3).toISOString(); // 3 days ago
  const sample3Date = new Date(now.getTime() - 86400000 * 5).toISOString(); // 5 days ago

  return [
    {
      id: 'run-sample-1',
      date: sample1Date,
      distanceKm: 5.24,
      durationSeconds: 1680, // 28 mins
      avgPace: `5'20"`,
      avgSpeedKmh: 11.2,
      calories: 348,
      title: '傍晚河濱輕鬆跑',
      path: [
        { lat: 25.0782, lng: 121.5451 },
        { lat: 25.0795, lng: 121.5520 },
        { lat: 25.0810, lng: 121.5600 },
        { lat: 25.0785, lng: 121.5650 }
      ],
      kmSplits: [
        { km: 1, pace: `5'30"`, timeSec: 330 },
        { km: 2, pace: `5'22"`, timeSec: 322 },
        { km: 3, pace: `5'15"`, timeSec: 315 },
        { km: 4, pace: `5'18"`, timeSec: 318 },
        { km: 5, pace: `5'10"`, timeSec: 310 }
      ]
    },
    {
      id: 'run-sample-2',
      date: sample2Date,
      distanceKm: 3.80,
      durationSeconds: 1260, // 21 mins
      avgPace: `5'31"`,
      avgSpeedKmh: 10.8,
      calories: 252,
      title: '大安公園夜跑',
      path: [
        { lat: 25.0335, lng: 121.5328 },
        { lat: 25.0338, lng: 121.5385 },
        { lat: 25.0268, lng: 121.5388 }
      ],
      kmSplits: [
        { km: 1, pace: `5'40"`, timeSec: 340 },
        { km: 2, pace: `5'32"`, timeSec: 332 },
        { km: 3, pace: `5'24"`, timeSec: 324 }
      ]
    },
    {
      id: 'run-sample-3',
      date: sample3Date,
      distanceKm: 10.12,
      durationSeconds: 3420, // 57 mins
      avgPace: `5'37"`,
      avgSpeedKmh: 10.6,
      calories: 672,
      title: '週末 10K 長跑自主訓練',
      path: [
        { lat: 25.0335, lng: 121.5328 },
        { lat: 25.0338, lng: 121.5385 },
        { lat: 25.0268, lng: 121.5388 },
        { lat: 25.0265, lng: 121.5330 }
      ],
      kmSplits: [
        { km: 1, pace: `5'45"`, timeSec: 345 },
        { km: 2, pace: `5'40"`, timeSec: 340 },
        { km: 3, pace: `5'38"`, timeSec: 338 },
        { km: 4, pace: `5'35"`, timeSec: 335 },
        { km: 5, pace: `5'32"`, timeSec: 332 },
        { km: 6, pace: `5'36"`, timeSec: 336 },
        { km: 7, pace: `5'34"`, timeSec: 334 },
        { km: 8, pace: `5'39"`, timeSec: 339 },
        { km: 9, pace: `5'31"`, timeSec: 331 },
        { km: 10, pace: `5'25"`, timeSec: 325 }
      ]
    }
  ];
}
