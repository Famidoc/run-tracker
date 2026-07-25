import React from 'react';
import { Activity, Radio, Volume2, VolumeX } from 'lucide-react';
import { useRunContext } from '../context/RunContext';

export function Header() {
  const { simulatorMode, setSimulatorMode, settings, updateSettings, isTracking } = useRunContext();

  return (
    <header className="app-header">
      <div className="brand-logo">
        <Activity size={24} color="#00E676" />
        <span>RUN<span className="brand-badge">TRACKER</span></span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Simulator Toggle & Active Mode Badge */}
        <button
          className="sim-pill"
          onClick={() => !isTracking && setSimulatorMode(!simulatorMode)}
          style={{
            cursor: isTracking ? 'default' : 'pointer',
            opacity: 1,
            background: simulatorMode ? 'rgba(0, 229, 255, 0.15)' : 'rgba(0, 230, 118, 0.15)',
            border: `1px solid ${simulatorMode ? 'rgba(0, 229, 255, 0.4)' : 'rgba(0, 230, 118, 0.4)'}`,
            color: simulatorMode ? '#00E5FF' : '#00E676',
            padding: '4px 10px',
            fontSize: '11px',
            fontWeight: '700'
          }}
          title={isTracking ? '跑步紀錄進行中' : '點擊切換 GPS 模式'}
        >
          <Radio size={14} />
          {simulatorMode ? '🎮 模擬測試' : '🛰️ 實體 GPS'}
        </button>

        {/* Voice Cue quick toggle */}
        <button
          onClick={() => updateSettings({ ...settings, voiceCues: !settings.voiceCues })}
          style={{
            background: 'none',
            border: 'none',
            color: settings.voiceCues ? '#00E676' : '#8E9BAE',
            cursor: 'pointer',
            padding: '6px'
          }}
          title={settings.voiceCues ? '語音報訊已開啟' : '語音報訊已關閉'}
        >
          {settings.voiceCues ? <Volume2 size={20} /> : <VolumeX size={20} />}
        </button>
      </div>
    </header>
  );
}
