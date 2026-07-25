import React, { useState } from 'react';
import { Play, Pause, Square, Flame, Gauge, Clock, Navigation, Target, Award, Sparkles, Star, Check, Plus, Minus } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { formatTime, formatPace, formatSpeed } from '../utils/metrics';
import { MapViewComponent } from '../components/MapViewComponent';

export function RunScreen() {
  const {
    isTracking,
    isPaused,
    durationSeconds,
    distanceKm,
    currentSpeedKmh,
    calories,
    pathPoints,
    targetGoal,
    setTargetGoal,
    saveDefaultGoal,
    settings,
    goalReached,
    startRun,
    pauseRun,
    resumeRun,
    stopRun,
    simulatorMode
  } = useRunContext();

  const [savedSummary, setSavedSummary] = useState(null);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);

  const handleStop = () => {
    const record = stopRun();
    if (record) {
      setSavedSummary(record);
    }
  };

  const paceStr = formatPace(distanceKm, durationSeconds);
  const speedStr = formatSpeed(distanceKm, durationSeconds);
  const timeStr = formatTime(durationSeconds);

  // Goal Progress Percentage
  let goalPercent = 0;
  if (targetGoal.type === 'distance' && targetGoal.targetValue > 0) {
    goalPercent = Math.min(100, Math.round((distanceKm / targetGoal.targetValue) * 100));
  } else if (targetGoal.type === 'time' && targetGoal.targetValue > 0) {
    goalPercent = Math.min(100, Math.round(((durationSeconds / 60) / targetGoal.targetValue) * 100));
  }

  return (
    <div style={{ padding: '16px 20px', paddingBottom: '30px' }}>

      {/* Goal Celebration Popup */}
      {goalReached && isTracking && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(0,230,118,0.2), rgba(0,229,255,0.2))',
          border: '1px solid #00E676',
          borderRadius: '16px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'pulse 2s infinite'
        }}>
          <Award size={28} color="#00E676" />
          <div>
            <div style={{ fontWeight: '800', color: '#00E676' }}>🎉 目標達成！</div>
            <div style={{ fontSize: '12px', color: '#F0F4F8' }}>您已完成預設的運動目標，繼續保持！</div>
          </div>
        </div>
      )}

      {/* Real-time Map View */}
      <div style={{ marginBottom: '16px' }}>
        <MapViewComponent pathPoints={pathPoints} isTracking={isTracking} />
      </div>

      {/* Goal Selector (When idle) */}
      {!isTracking && (
        <div className="glass-card" style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-muted)', marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Target size={16} color="#00E5FF" />
              <span>選擇跑步目標</span>
            </div>
            {settings?.defaultGoal?.type === targetGoal.type &&
             (targetGoal.type === 'free' ||
              (targetGoal.type === 'distance' && settings?.defaultGoal?.distanceValue === targetGoal.targetValue) ||
              (targetGoal.type === 'time' && settings?.defaultGoal?.timeValue === targetGoal.targetValue)) && (
              <span style={{ fontSize: '11px', color: '#FFD600', background: 'rgba(255, 214, 0, 0.15)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(255, 214, 0, 0.3)' }}>
                ★ 習慣預設
              </span>
            )}
          </div>

          {/* 3 Main Modes */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
            {[
              { type: 'free', label: '1. 自由跑' },
              { type: 'distance', label: '2. 公里數' },
              { type: 'time', label: '3. 時間' }
            ].map((tab) => {
              const isSelected = targetGoal.type === tab.type;
              return (
                <button
                  key={tab.type}
                  onClick={() => {
                    if (tab.type === 'free') {
                      setTargetGoal({ type: 'free', targetValue: 0 });
                    } else if (tab.type === 'distance') {
                      setTargetGoal({ type: 'distance', targetValue: settings.defaultGoal?.distanceValue || 5.0 });
                    } else if (tab.type === 'time') {
                      setTargetGoal({ type: 'time', targetValue: settings.defaultGoal?.timeValue || 30 });
                    }
                  }}
                  style={{
                    background: isSelected ? 'linear-gradient(135deg, rgba(0, 230, 118, 0.2), rgba(0, 229, 255, 0.15))' : 'rgba(255, 255, 255, 0.03)',
                    border: `1px solid ${isSelected ? '#00E676' : 'rgba(255, 255, 255, 0.08)'}`,
                    color: isSelected ? '#00E676' : '#8E9BAE',
                    borderRadius: '12px',
                    padding: '10px 4px',
                    fontSize: '13px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Mode details & fine-tuning */}
          {targetGoal.type === 'free' && (
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', padding: '12px', textAlign: 'center', fontSize: '13px', color: '#8E9BAE', border: '1px dashed rgba(255,255,255,0.08)' }}>
              🏃 無限制自主跑，隨心揮灑汗水！
            </div>
          )}

          {targetGoal.type === 'distance' && (
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#8E9BAE' }}>微調目標公里數</span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#00E676' }}>
                  {targetGoal.targetValue} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>KM</span>
                </span>
              </div>

              {/* Step Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {[-1, -0.5, +0.5, +1].map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      const val = Math.max(0.5, Math.min(50, Math.round((targetGoal.targetValue + step) * 10) / 10));
                      setTargetGoal({ type: 'distance', targetValue: val });
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#FFF',
                      padding: '6px 0',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {step > 0 ? `+${step}k` : `${step}k`}
                  </button>
                ))}
              </div>

              {/* Quick Pills */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {[3, 5, 10, 21].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTargetGoal({ type: 'distance', targetValue: val })}
                    style={{
                      flex: 1,
                      background: targetGoal.targetValue === val ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${targetGoal.targetValue === val ? '#00E676' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      color: targetGoal.targetValue === val ? '#00E676' : '#8E9BAE',
                      padding: '6px 0',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {val} k
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="0.5"
                max="30"
                step="0.5"
                value={targetGoal.targetValue}
                onChange={(e) => setTargetGoal({ type: 'distance', targetValue: parseFloat(e.target.value) })}
                style={{ width: '100%', accentColor: '#00E676', cursor: 'pointer' }}
              />
            </div>
          )}

          {targetGoal.type === 'time' && (
            <div style={{ background: 'rgba(0, 0, 0, 0.2)', borderRadius: '14px', padding: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#8E9BAE' }}>微調目標時間</span>
                <span style={{ fontSize: '22px', fontWeight: '800', color: '#00E5FF' }}>
                  {targetGoal.targetValue} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>分鐘</span>
                </span>
              </div>

              {/* Step Buttons */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                {[-10, -5, +5, +10].map((step) => (
                  <button
                    key={step}
                    onClick={() => {
                      const val = Math.max(5, Math.min(180, targetGoal.targetValue + step));
                      setTargetGoal({ type: 'time', targetValue: val });
                    }}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#FFF',
                      padding: '6px 0',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer'
                    }}
                  >
                    {step > 0 ? `+${step}分` : `${step}分`}
                  </button>
                ))}
              </div>

              {/* Quick Pills */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {[15, 30, 45, 60].map((val) => (
                  <button
                    key={val}
                    onClick={() => setTargetGoal({ type: 'time', targetValue: val })}
                    style={{
                      flex: 1,
                      background: targetGoal.targetValue === val ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${targetGoal.targetValue === val ? '#00E5FF' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: '8px',
                      color: targetGoal.targetValue === val ? '#00E5FF' : '#8E9BAE',
                      padding: '6px 0',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {val} 分
                  </button>
                ))}
              </div>

              {/* Slider */}
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={targetGoal.targetValue}
                onChange={(e) => setTargetGoal({ type: 'time', targetValue: parseInt(e.target.value, 10) })}
                style={{ width: '100%', accentColor: '#00E5FF', cursor: 'pointer' }}
              />
            </div>
          )}

          {/* Action Bar: Save as Default */}
          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
            <button
              onClick={() => {
                saveDefaultGoal(targetGoal);
                setDefaultSavedSuccess(true);
                setTimeout(() => setDefaultSavedSuccess(false), 2000);
              }}
              style={{
                background: defaultSavedSuccess ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 214, 0, 0.1)',
                border: `1px solid ${defaultSavedSuccess ? '#00E676' : '#FFD600'}`,
                color: defaultSavedSuccess ? '#00E676' : '#FFD600',
                borderRadius: '20px',
                padding: '6px 14px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.2s ease'
              }}
            >
              {defaultSavedSuccess ? <Check size={14} /> : <Star size={14} />}
              <span>{defaultSavedSuccess ? '已儲存為習慣預設' : '設為習慣預設目標'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Metric Card */}
      <div className={`glass-card ${isTracking ? 'glow-card-green' : ''}`}>
        
        {/* Mode Indicator Tag */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            padding: '3px 12px',
            borderRadius: '12px',
            background: simulatorMode ? 'rgba(0, 229, 255, 0.12)' : 'rgba(0, 230, 118, 0.12)',
            border: `1px solid ${simulatorMode ? 'rgba(0, 229, 255, 0.3)' : 'rgba(0, 230, 118, 0.3)'}`,
            color: simulatorMode ? '#00E5FF' : '#00E676',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            {simulatorMode ? '🎮 GPS 模擬測試模式' : '🛰️ 真實 GPS 衛星定位中'}
          </span>
        </div>

        {/* Goal Progress Bar */}
        {targetGoal.type !== 'free' && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#8E9BAE', marginBottom: '6px' }}>
              <span>目標進度 ({targetGoal.type === 'distance' ? `${targetGoal.targetValue} km` : `${targetGoal.targetValue} mins`})</span>
              <span style={{ color: '#00E676', fontWeight: '700' }}>{goalPercent}%</span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${goalPercent}%`, height: '100%', background: 'linear-gradient(90deg, #00E5FF, #00E676)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        )}

        {/* Distance Huge Display */}
        <div className="metric-large">
          <div className="metric-value-huge">{distanceKm.toFixed(2)}</div>
          <div className="metric-unit">累積里程 (KM)</div>
        </div>

        {/* 2x2 Sub metrics */}
        <div className="metric-grid-2x2">
          <div className="sub-metric-card">
            <div className="sub-metric-title"><Clock size={14} color="#00E5FF" /> 時間</div>
            <div className="sub-metric-value">{timeStr}</div>
          </div>

          <div className="sub-metric-card">
            <div className="sub-metric-title"><Gauge size={14} color="#00E676" /> 平均配速</div>
            <div className="sub-metric-value">{paceStr}</div>
          </div>

          <div className="sub-metric-card">
            <div className="sub-metric-title"><Navigation size={14} color="#FFD600" /> 時速</div>
            <div className="sub-metric-value">{speedStr} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>km/h</span></div>
          </div>

          <div className="sub-metric-card">
            <div className="sub-metric-title"><Flame size={14} color="#FF1744" /> 消耗卡路里</div>
            <div className="sub-metric-value">{calories} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>kcal</span></div>
          </div>
        </div>

      </div>

      {/* Running Controls */}
      <div style={{ marginTop: '24px' }}>
        {!isTracking ? (
          <button className="btn-primary" onClick={startRun}>
            <Play fill="#0A0E17" size={24} />
            <span>開始跑步</span>
          </button>
        ) : (
          <div style={{ display: 'flex', gap: '12px' }}>
            {isPaused ? (
              <button className="btn-primary" style={{ flex: 1 }} onClick={resumeRun}>
                <Play fill="#0A0E17" size={20} />
                <span>繼續</span>
              </button>
            ) : (
              <button className="btn-secondary" style={{ flex: 1 }} onClick={pauseRun}>
                <Pause size={20} color="#FFD600" />
                <span>暫停</span>
              </button>
            )}

            <button className="btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handleStop}>
              <Square size={18} fill="#FF1744" />
              <span>結束儲存</span>
            </button>
          </div>
        )}
      </div>

      {/* Run Summary Modal after Stop */}
      {savedSummary && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(16px)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div className="glass-card glow-card-green" style={{ width: '100%', maxWidth: '420px', textAlign: 'center' }}>
            <Sparkles size={40} color="#00E676" style={{ margin: '0 auto 12px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: '800', marginBottom: '4px' }}>跑步完成紀錄！</h2>
            <p style={{ color: '#8E9BAE', fontSize: '13px', marginBottom: '20px' }}>{savedSummary.title} • {new Date(savedSummary.date).toLocaleDateString()}</p>

            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
              <div style={{ fontSize: '40px', fontWeight: '800', color: '#00E676' }}>{savedSummary.distanceKm} <span style={{ fontSize: '16px', color: '#8E9BAE' }}>KM</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>總時間</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{formatTime(savedSummary.durationSeconds)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>平均配速</div>
                  <div style={{ fontSize: '16px', fontWeight: '700' }}>{savedSummary.avgPace}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>卡路里</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#FF1744' }}>{savedSummary.calories} kcal</div>
                </div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => setSavedSummary(null)}>
              確認儲存
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
