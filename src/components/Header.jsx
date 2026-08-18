import React, { useState } from 'react';
import { Activity, Radio, Volume2, VolumeX, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { APP_VERSION, APP_BUILD_DATE, APP_RELEASE_NOTES } from '../config/version';

export function Header() {
  const { simulatorMode, setSimulatorMode, settings, updateSettings, isTracking } = useRunContext();
  const [showVersionModal, setShowVersionModal] = useState(false);

  const handleForceUpdate = () => {
    if ('caches' in window) {
      caches.keys().then((names) => {
        return Promise.all(names.map((name) => caches.delete(name)));
      }).then(() => {
        window.location.reload(true);
      });
    } else {
      window.location.reload(true);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="brand-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Activity size={24} color="#00E676" />
            <span>RUN<span className="brand-badge">TRACKER</span></span>
          </div>
          
          {/* Version Badge */}
          <button
            onClick={() => setShowVersionModal(true)}
            style={{
              background: 'rgba(0, 230, 118, 0.15)',
              border: '1px solid rgba(0, 230, 118, 0.3)',
              color: '#00E676',
              fontSize: '10px',
              fontWeight: '800',
              padding: '2px 6px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginLeft: '2px'
            }}
            title="點擊查看版本更新日誌"
          >
            {APP_VERSION}
          </button>
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

      {/* Version & Changelog Modal */}
      {showVersionModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 23, 0.92)',
          backdropFilter: 'blur(12px)',
          zIndex: 500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', border: '1.5px solid rgba(0, 230, 118, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={20} color="#00E676" />
                <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>版本資訊</h3>
              </div>
              <button
                onClick={() => setShowVersionModal(false)}
                style={{ background: 'none', border: 'none', color: '#8E9BAE', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', color: '#8E9BAE' }}>目前版本</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#00E676' }}>{APP_VERSION}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8E9BAE' }}>發布日期</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#FFF' }}>{APP_BUILD_DATE} (最新)</span>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#FFF', marginBottom: '8px' }}>🚀 近期重點更新日誌：</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {APP_RELEASE_NOTES.map((note, idx) => (
                  <li key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#8E9BAE', lineHeight: '1.4' }}>
                    <CheckCircle2 size={14} color="#00E676" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleForceUpdate}
                style={{
                  flex: 1,
                  background: 'rgba(0, 229, 255, 0.15)',
                  border: '1px solid rgba(0, 229, 255, 0.4)',
                  color: '#00E5FF',
                  borderRadius: '12px',
                  padding: '10px',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <RefreshCw size={14} />
                <span>強制重新載入</span>
              </button>

              <button
                onClick={() => setShowVersionModal(false)}
                className="btn-primary"
                style={{ flex: 1, padding: '10px', borderRadius: '12px', fontSize: '13px', margin: 0 }}
              >
                知道了
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
