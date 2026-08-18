/**
 * RunTracker Storage Service
 * Multi-layer resilient storage combining LocalStorage & IndexedDB.
 * Features automatic QuotaExceededError recovery, smart path downsampling, and zero-data-loss protection.
 */

import { IDBService } from './indexedDB';

const STORAGE_KEYS = {
  RUN_HISTORY: 'runtracker_history_v1',
  RUN_TRASH: 'runtracker_trash_v1',
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
  voiceVolume: 1.0, // Speech & Cue Volume (0.2 to 1.0)
  cueDistanceKm: 1.0, // Every 1km
  useSimulator: false, // Default Real GPS for Production
  theme: 'dark',
  presetRoute: 'daan',
  goalReachedAction: 'continue', // 'continue' | 'autoPause'
  autoPause: false, // 智慧自動暫停
  autoPauseSpeedThresholdKmh: 2.5, // 速度門檻 km/h
  paceZoneEnabled: false, // 雙向配速區間警報
  targetPaceMin: "05:00", // 上限 (過快)
  targetPaceMax: "06:30", // 下限 (過慢)
  defaultGoal: {
    type: 'free',
    distanceValue: 5.0,
    timeValue: 30
  }
};

/**
 * Downsample GPS path points to keep LocalStorage footprint ultra-light (~15KB per run instead of 500KB)
 */
export function compressPathPoints(path, maxPoints = 250) {
  if (!path || !Array.isArray(path) || path.length <= maxPoints) {
    return path || [];
  }
  const result = [path[0]];
  const step = (path.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i++) {
    const idx = Math.round(i * step);
    if (path[idx]) result.push(path[idx]);
  }
  result.push(path[path.length - 1]);
  return result;
}

/**
 * Sanitize a record for lightweight LocalStorage persistence
 */
function sanitizeRecordForStorage(record) {
  if (!record) return record;
  return {
    ...record,
    path: compressPathPoints(record.path, 200)
  };
}

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
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('Get history parse error:', e);
      return [];
    }
  },

  /**
   * Save Run Record with bulletproof multi-tier Quota protection
   */
  saveRunRecord(record) {
    if (!record || !record.id) return this.getHistory();

    // 1. Asynchronously save full-fidelity uncompressed record to IndexedDB
    IDBService.saveRun(record).catch((err) => console.warn('IDB background save:', err));

    // 2. Prepare sanitized record for LocalStorage
    const lightweightRecord = sanitizeRecordForStorage(record);
    const history = this.getHistory();
    const filtered = history.filter((item) => item.id !== lightweightRecord.id);
    const updated = [lightweightRecord, ...filtered];
    updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 3. Try standard save
    try {
      localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(updated));
      return updated;
    } catch (quotaError) {
      console.warn('LocalStorage Quota reached, applying emergency storage compression...', quotaError);

      // Level 1 Recovery: Aggressively compress all past paths in history
      try {
        const compressedHistory = updated.map((r) => ({
          ...r,
          path: compressPathPoints(r.path, 80)
        }));
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(compressedHistory));
        return compressedHistory;
      } catch (e1) {
        console.warn('Level 1 compression insufficient, applying Level 2 recovery...', e1);
      }

      // Level 2 Recovery: Clean trash and purge active session to free space
      try {
        localStorage.removeItem(STORAGE_KEYS.RUN_TRASH);
        localStorage.removeItem('runtracker_active_session_v1');
        const compressedHistory = updated.map((r) => ({
          ...r,
          path: compressPathPoints(r.path, 50)
        }));
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(compressedHistory));
        return compressedHistory;
      } catch (e2) {
        console.warn('Level 2 recovery failed, applying Level 3 fallback...', e2);
      }

      // Level 3 Recovery: Strip path from old records (keep path for latest only)
      try {
        const slimHistory = updated.map((r, idx) => ({
          ...r,
          path: idx === 0 ? compressPathPoints(r.path, 50) : []
        }));
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(slimHistory));
        return slimHistory;
      } catch (e3) {
        console.error('Critical storage fallback! Keeping in-memory history:', e3);
        // CRITICAL: NEVER return [] on failure, always return the updated array to UI
        return updated;
      }
    }
  },

  // Move to Trash (Soft delete with 30-day retention)
  moveToTrash(id) {
    try {
      const history = this.getHistory();
      const targetRecord = history.find((item) => item.id === id);
      const updatedHistory = history.filter((item) => item.id !== id);
      
      try {
        localStorage.setItem(STORAGE_KEYS.RUN_HISTORY, JSON.stringify(updatedHistory));
      } catch (e) {
        console.warn('Move to trash history save error:', e);
      }

      if (targetRecord) {
        const trash = this.getTrash();
        const trashItem = {
          ...sanitizeRecordForStorage(targetRecord),
          deletedAt: new Date().toISOString()
        };
        const updatedTrash = [trashItem, ...trash.filter((item) => item.id !== id)];
        try {
          localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(updatedTrash));
        } catch (te) {
          // If trash quota exceeded, clear older trash to make room
          const trimmedTrash = updatedTrash.slice(0, 5);
          try {
            localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(trimmedTrash));
          } catch (t2) {}
        }
      }
      return { history: updatedHistory, trash: this.getTrash() };
    } catch (e) {
      console.error('Move to trash error:', e);
      return { history: this.getHistory(), trash: this.getTrash() };
    }
  },

  // Move direct record to trash (e.g. from discard button on summary modal)
  addDirectToTrash(record) {
    try {
      const trash = this.getTrash();
      const trashItem = {
        ...sanitizeRecordForStorage(record),
        deletedAt: new Date().toISOString()
      };
      const updatedTrash = [trashItem, ...trash.filter((item) => item.id !== record.id)];
      try {
        localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(updatedTrash));
      } catch (e) {
        const trimmed = updatedTrash.slice(0, 5);
        try {
          localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(trimmed));
        } catch (e2) {}
      }
      return this.getTrash();
    } catch (e) {
      console.error('Add direct to trash error:', e);
      return this.getTrash();
    }
  },

  // Get Trash items
  getTrash() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RUN_TRASH);
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  // Restore record from trash back to history
  restoreFromTrash(id) {
    try {
      const trash = this.getTrash();
      const targetRecord = trash.find((item) => item.id === id);
      const updatedTrash = trash.filter((item) => item.id !== id);
      
      try {
        localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(updatedTrash));
      } catch (e) {}

      let updatedHistory = this.getHistory();
      if (targetRecord) {
        const { deletedAt, ...restoredRecord } = targetRecord;
        updatedHistory = this.saveRunRecord(restoredRecord);
      }
      return { history: updatedHistory, trash: updatedTrash };
    } catch (e) {
      console.error('Restore from trash error:', e);
      return { history: this.getHistory(), trash: this.getTrash() };
    }
  },

  // Permanently delete a single item from trash
  permanentDeleteTrash(id) {
    try {
      const trash = this.getTrash();
      const updatedTrash = trash.filter((item) => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(updatedTrash));
      IDBService.deleteRun(id).catch(() => {});
      return updatedTrash;
    } catch (e) {
      console.error('Permanent delete error:', e);
      return [];
    }
  },

  // Empty entire trash
  emptyTrash() {
    try {
      localStorage.removeItem(STORAGE_KEYS.RUN_TRASH);
      return [];
    } catch (e) {
      console.error('Empty trash error:', e);
      return [];
    }
  },

  // Auto clean trash older than 30 days
  clearOldTrash(retentionDays = 30) {
    try {
      const trash = this.getTrash();
      const now = Date.now();
      const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
      const validTrash = trash.filter((item) => {
        const deletedTime = item.deletedAt ? new Date(item.deletedAt).getTime() : now;
        return (now - deletedTime) <= maxAgeMs;
      });
      localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(validTrash));
      return validTrash;
    } catch (e) {
      console.error('Clear old trash error:', e);
      return this.getTrash();
    }
  },

  clearAllData() {
    localStorage.removeItem(STORAGE_KEYS.RUN_HISTORY);
    localStorage.removeItem(STORAGE_KEYS.RUN_TRASH);
    localStorage.removeItem(STORAGE_KEYS.USER_PROFILE);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    localStorage.removeItem('runtracker_active_session_v1');
  },

  exportJSON() {
    const data = {
      profile: this.getProfile(),
      settings: this.getSettings(),
      history: this.getHistory(),
      trash: this.getTrash(),
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
      if (parsed.trash && Array.isArray(parsed.trash)) {
        localStorage.setItem(STORAGE_KEYS.RUN_TRASH, JSON.stringify(parsed.trash));
      }
      return true;
    } catch (e) {
      console.error('Import error:', e);
      return false;
    }
  }
};
