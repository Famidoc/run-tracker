import React, { useState } from 'react';
import { User, Volume2, Radio, Download, Upload, Trash2, Check, ShieldCheck, Target } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { StorageService } from '../utils/storage';
import { PRESET_ROUTES } from '../utils/gpsSimulator';

export function SettingsScreen() {
  const { profile, updateProfile, settings, updateSettings, simulatorMode, setSimulatorMode } = useRunContext();

  const [weightKg, setWeightKg] = useState(profile.weightKg || 68);
  const [weeklyTargetKm, setWeeklyTargetKm] = useState(profile.weeklyTargetKm || 25);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e) => {
    e.preventDefault();
    updateProfile({
      ...profile,
      weightKg: parseFloat(weightKg),
      weeklyTargetKm: parseFloat(weeklyTargetKm)
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportJSON = () => {
    const jsonStr = StorageService.exportJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `runtracker_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const ok = StorageService.importJSON(event.target.result);
      if (ok) {
        alert('資料導入成功！請重新整理頁面以載入更新。');
        window.location.reload();
      } else {
        alert('導入失敗，請確認檔案格式是否為標準 JSON！');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ padding: '16px 20px', paddingBottom: '30px' }}>
      
      {/* Page Title */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800' }}>個人設定與備份</h1>
        <p style={{ fontSize: '12px', color: '#8E9BAE' }}>維護身體參數與習慣的預設運動目標</p>
      </div>

      {/* Default Habitual Run Goal */}
      <div className="glass-card">
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFD600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={18} />
          <span>習慣預設跑步目標</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>預設目標模式</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { type: 'free', label: '自由跑' },
                { type: 'distance', label: '公里數' },
                { type: 'time', label: '時間' }
              ].map((tab) => {
                const isSelected = (settings.defaultGoal?.type || 'free') === tab.type;
                return (
                  <button
                    key={tab.type}
                    type="button"
                    onClick={() => {
                      const newGoal = {
                        ...settings.defaultGoal,
                        type: tab.type,
                        distanceValue: settings.defaultGoal?.distanceValue || 5.0,
                        timeValue: settings.defaultGoal?.timeValue || 30
                      };
                      updateSettings({ ...settings, defaultGoal: newGoal });
                    }}
                    style={{
                      background: isSelected ? 'rgba(255, 214, 0, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                      border: `1px solid ${isSelected ? '#FFD600' : 'rgba(255, 255, 255, 0.08)'}`,
                      color: isSelected ? '#FFD600' : '#8E9BAE',
                      borderRadius: '10px',
                      padding: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {settings.defaultGoal?.type === 'distance' && (
            <div>
              <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>習慣預設公里數 (km)</label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="50"
                value={settings.defaultGoal?.distanceValue || 5.0}
                onChange={(e) => {
                  const newGoal = { ...settings.defaultGoal, distanceValue: parseFloat(e.target.value) || 5.0 };
                  updateSettings({ ...settings, defaultGoal: newGoal });
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '10px',
                  color: '#FFF',
                  fontSize: '15px',
                  fontWeight: '700',
                  outline: 'none'
                }}
              />
            </div>
          )}

          {settings.defaultGoal?.type === 'time' && (
            <div>
              <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>習慣預設時間 (分鐘)</label>
              <input
                type="number"
                step="5"
                min="5"
                max="180"
                value={settings.defaultGoal?.timeValue || 30}
                onChange={(e) => {
                  const newGoal = { ...settings.defaultGoal, timeValue: parseInt(e.target.value, 10) || 30 };
                  updateSettings({ ...settings, defaultGoal: newGoal });
                }}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '10px',
                  color: '#FFF',
                  fontSize: '15px',
                  fontWeight: '700',
                  outline: 'none'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* User Body Parameters Form */}
      <div className="glass-card">
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#00E676', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} />
          <span>個人身體參數 (卡路里計算關鍵)</span>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>體重 (kg)</label>
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px',
                color: '#FFF',
                fontSize: '16px',
                fontWeight: '700',
                outline: 'none'
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>每週目標跑量 (km)</label>
            <input
              type="number"
              value={weeklyTargetKm}
              onChange={(e) => setWeeklyTargetKm(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '12px',
                color: '#FFF',
                fontSize: '16px',
                fontWeight: '700',
                outline: 'none'
              }}
            />
          </div>

          <button className="btn-primary" type="submit" style={{ marginTop: '8px', padding: '12px' }}>
            {savedSuccess ? <Check size={18} /> : null}
            <span>{savedSuccess ? '已成功儲存' : '儲存身體參數'}</span>
          </button>
        </form>
      </div>

      {/* Voice & Simulator Preferences */}
      <div className="glass-card">
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#00E5FF', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={18} />
          <span>跑步輔助與語音報訊</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Voice toggle */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: '700', fontSize: '14px' }}>語音播報當前配速</div>
              <div style={{ fontSize: '11px', color: '#8E9BAE' }}>每跑滿 1 公里以中文自動語音播報</div>
            </div>
            <input
              type="checkbox"
              checked={settings.voiceCues}
              onChange={(e) => updateSettings({ ...settings, voiceCues: e.target.checked })}
              style={{ width: '20px', height: '20px', accentColor: '#00E676', cursor: 'pointer' }}
            />
          </div>

          {/* Simulator Toggle & Route Selector */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div>
                <div style={{ fontWeight: '700', fontSize: '14px', color: '#00E5FF' }}>GPS 模擬器模式</div>
                <div style={{ fontSize: '11px', color: '#8E9BAE' }}>開啟後可在電腦瀏覽器播放模擬跑步</div>
              </div>
              <input
                type="checkbox"
                checked={simulatorMode}
                onChange={(e) => setSimulatorMode(e.target.checked)}
                style={{ width: '20px', height: '20px', accentColor: '#00E5FF', cursor: 'pointer' }}
              />
            </div>

            {simulatorMode && (
              <div>
                <label style={{ fontSize: '11px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>選擇模擬路線</label>
                <select
                  value={settings.presetRoute || 'daan'}
                  onChange={(e) => updateSettings({ ...settings, presetRoute: e.target.value })}
                  style={{
                    width: '100%',
                    background: '#121824',
                    border: '1px solid rgba(0,229,255,0.3)',
                    color: '#00E5FF',
                    borderRadius: '10px',
                    padding: '10px',
                    fontWeight: '700',
                    outline: 'none'
                  }}
                >
                  {PRESET_ROUTES.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Data Backup & Export */}
      <div className="glass-card">
        <div style={{ fontSize: '15px', fontWeight: '700', color: '#FFD600', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} />
          <span>本地資料備份與匯出</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button className="btn-secondary" onClick={handleExportJSON}>
            <Download size={16} color="#00E676" />
            <span>匯出 JSON 跑步紀錄檔</span>
          </button>

          <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={16} color="#00E5FF" />
            <span>匯入 JSON 備份檔案</span>
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          </label>

          <button
            className="btn-danger"
            style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={() => {
              if (window.confirm('確定要清除所有本地跑步紀錄與個人設定嗎？此動作無法復原。')) {
                StorageService.clearAllData();
                window.location.reload();
              }
            }}
          >
            <Trash2 size={16} />
            <span>重置並清除所有本地數據</span>
          </button>
        </div>
      </div>

    </div>
  );
}
