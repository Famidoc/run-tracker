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
  useSimulator: false, // Default Real GPS for Production
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
  return [];
}
