import React, { useState, useRef } from 'react';
import { Play, Pause, Square, Flame, Gauge, Clock, Navigation, Target, Award, Sparkles, Star, Check, Plus, Minus, Zap, Lock, Unlock, Maximize2, Minimize2, ShieldAlert, Trash2 } from 'lucide-react';
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
    deleteRunRecord,
    discardRunRecord,
    simulatorMode,
    getPaceComparison,
    isTouchLocked,
    setIsTouchLocked,
    isOutdoorView,
    setIsOutdoorView
  } = useRunContext();

  const [savedSummary, setSavedSummary] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);

  // Touch Guard hold timer state
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const holdIntervalRef = useRef(null);

  const handleTouchHoldStart = () => {
    let current = 0;
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    holdIntervalRef.current = setInterval(() => {
      current += 5; // 20 steps over 2 seconds (100ms each)
      setHoldProgress(current);
      if (current >= 100) {
        clearInterval(holdIntervalRef.current);
        setIsTouchLocked(false);
        setHoldProgress(0);
      }
    }, 100);
  };

  const handleTouchHoldEnd = () => {
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    setHoldProgress(0);
  };

  const handleStop = () => {
    const record = stopRun();
    if (record) {
      setSavedSummary(record);
      setIsOutdoorView(false);
      setIsTouchLocked(false);
    }
  };

  const paceComp = getPaceComparison ? getPaceComparison() : {
    avgPaceStr: formatPace(distanceKm, durationSeconds),
    currentPaceStr: formatPace(distanceKm, durationSeconds),
    currentKmNum: Math.floor(distanceKm) + 1,
    isFasterOrEqual: true
  };

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
    <div style={{ padding: '16px 20px', paddingBottom: '30px', position: 'relative' }}>

      {/* FULLSCREEN: Touch Guard Overlay */}
      {isTouchLocked && isTracking && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(5, 8, 15, 0.96)',
          backdropFilter: 'blur(20px)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px 24px'
        }}>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(255, 214, 0, 0.15)', border: '2px solid #FFD600',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <ShieldAlert size={36} color="#FFD600" />
            </div>
            <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#FFF', marginBottom: '6px' }}>觸控防誤觸鎖定中</h2>
            <p style={{ fontSize: '13px', color: '#8E9BAE' }}>防止手持手掌或汗水誤觸控制</p>
          </div>

          <div style={{ textAlignment: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: '56px', fontWeight: '900', color: '#00E676', lineHeight: 1 }}>{distanceKm.toFixed(2)}</div>
            <div style={{ fontSize: '14px', color: '#8E9BAE', marginTop: '4px' }}>累積公里 (KM) • {timeStr}</div>
          </div>

          <div style={{ width: '100%', maxWidth: '320px', textAlign: 'center', marginBottom: '20px' }}>
            {/* Progress bar */}
            <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginBottom: '12px', overflow: 'hidden' }}>
              <div style={{ width: `${holdProgress}%`, height: '100%', background: '#FFD600', transition: 'width 0.1s linear' }} />
            </div>

            <button
              onMouseDown={handleTouchHoldStart}
              onMouseUp={handleTouchHoldEnd}
              onTouchStart={handleTouchHoldStart}
              onTouchEnd={handleTouchHoldEnd}
              style={{
                width: '100%',
                padding: '16px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, rgba(255,214,0,0.2), rgba(255,109,0,0.2))',
                border: '1.5px solid #FFD600',
                color: '#FFD600',
                fontSize: '16px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                userSelect: 'none',
                WebkitUserSelect: 'none'
              }}
            >
              <Lock size={20} />
              <span>按住 2 秒解鎖鎖定</span>
            </button>
          </div>
        </div>
      )}

      {/* FULLSCREEN: Outdoor High-Contrast 4-Data Dashboard View */}
      {isOutdoorView && isTracking && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: '#04070D',
          zIndex: 8888,
          display: 'flex',
          flexDirection: 'column',
          padding: '20px 20px 30px',
          justifyContent: 'space-between'
        }}>
          {/* Header Controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00E676', fontWeight: '800', fontSize: '15px' }}>
              <Zap size={18} />
              <span>戶外強光大字儀表板</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setIsTouchLocked(true)}
                style={{ background: 'rgba(255,214,0,0.15)', border: '1px solid #FFD600', color: '#FFD600', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Lock size={16} /> 鎖定
              </button>
              <button
                onClick={() => setIsOutdoorView(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#FFF', padding: '8px 12px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Minimize2 size={16} /> 退出大字
              </button>
            </div>
          </div>

          {/* 4 Large Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '20px 0' }}>
            
            {/* Metric 1: Current Km Pace */}
            <div style={{ background: '#0D1424', border: `2px solid ${paceComp.isFasterOrEqual ? '#00E676' : '#FF1744'}`, borderRadius: '20px', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                當前第 {paceComp.currentKmNum} 公里配速
              </div>
              <div style={{ fontSize: '38px', fontWeight: '900', color: paceComp.isFasterOrEqual ? '#00E676' : '#FF1744', lineHeight: 1.1 }}>
                {paceComp.currentPaceStr}
              </div>
              <div style={{ fontSize: '11px', color: paceComp.isFasterOrEqual ? '#00E676' : '#FF1744', marginTop: '6px', fontWeight: '700' }}>
                {paceComp.isFasterOrEqual ? '🟢 快於均速' : '🔴 掉速提醒'}
              </div>
            </div>

            {/* Metric 2: Overall Average Pace */}
            <div style={{ background: '#0D1424', border: '2px solid #00E5FF', borderRadius: '20px', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                全整趟總平均配速
              </div>
              <div style={{ fontSize: '38px', fontWeight: '900', color: '#00E5FF', lineHeight: 1.1 }}>
                {paceComp.avgPaceStr}
              </div>
              <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '6px' }}>
                Overall Avg Pace
              </div>
            </div>

            {/* Metric 3: Distance */}
            <div style={{ background: '#0D1424', border: '2px solid #FFFFFF', borderRadius: '20px', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                累積里程 (KM)
              </div>
              <div style={{ fontSize: '42px', fontWeight: '900', color: '#FFFFFF', lineHeight: 1.1 }}>
                {distanceKm.toFixed(2)}
              </div>
              <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '6px' }}>
                Kilometers
              </div>
            </div>

            {/* Metric 4: Duration Time */}
            <div style={{ background: '#0D1424', border: '2px solid #FFD600', borderRadius: '20px', padding: '20px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px', textTransform: 'uppercase' }}>
                跑步總耗時
              </div>
              <div style={{ fontSize: '38px', fontWeight: '900', color: '#FFD600', lineHeight: 1.1 }}>
                {timeStr}
              </div>
              <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '6px' }}>
                Duration
              </div>
            </div>

          </div>

          {/* Bottom Action Controls */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {isPaused ? (
              <button className="btn-primary" style={{ flex: 1, padding: '16px', fontSize: '18px' }} onClick={resumeRun}>
                <Play fill="#0A0E17" size={24} />
                <span>繼續</span>
              </button>
            ) : (
              <button className="btn-secondary" style={{ flex: 1, padding: '16px', fontSize: '18px' }} onClick={pauseRun}>
                <Pause size={24} color="#FFD600" />
                <span>暫停</span>
              </button>
            )}

            <button className="btn-danger" style={{ flex: 1, padding: '16px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }} onClick={handleStop}>
              <Square size={22} fill="#FF1744" />
              <span>結束跑步</span>
            </button>
          </div>
        </div>
      )}

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

          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {[
              { type: 'free', label: '自主跑', icon: Sparkles },
              { type: 'distance', label: '距離目標', icon: Navigation },
              { type: 'time', label: '時間目標', icon: Clock }
            ].map((g) => {
              const Icon = g.icon;
              const active = targetGoal.type === g.type;
              return (
                <button
                  key={g.type}
                  onClick={() => {
                    if (g.type === 'free') setTargetGoal({ type: 'free', targetValue: 0 });
                    else if (g.type === 'distance') setTargetGoal({ type: 'distance', targetValue: settings?.defaultGoal?.distanceValue || 5.0 });
                    else if (g.type === 'time') setTargetGoal({ type: 'time', targetValue: settings?.defaultGoal?.timeValue || 30 });
                  }}
                  style={{
                    flex: 1,
                    padding: '10px 4px',
                    borderRadius: '12px',
                    border: active ? '1.5px solid #00E676' : '1px solid rgba(255,255,255,0.08)',
                    background: active ? 'rgba(0, 230, 118, 0.15)' : 'rgba(255,255,255,0.03)',
                    color: active ? '#00E676' : 'var(--text-muted)',
                    fontWeight: '700',
                    fontSize: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Icon size={18} />
                  <span>{g.label}</span>
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

        {/* Quick Toolbar for Tracking Mode (Touch Lock & Outdoor Big Display Buttons) */}
        {isTracking && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '12px', color: '#00E676', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00E676', boxShadow: '0 0 8px #00E676' }} />
              <span style={{ color: '#00E676' }}>跑步追蹤進行中</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsTouchLocked(true)}
                style={{ background: 'rgba(255, 214, 0, 0.15)', border: '1px solid #FFD600', color: '#FFD600', borderRadius: '12px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Lock size={13} />
                <span>防誤觸鎖</span>
              </button>
              <button
                onClick={() => setIsOutdoorView(true)}
                style={{ background: 'rgba(0, 229, 255, 0.15)', border: '1px solid #00E5FF', color: '#00E5FF', borderRadius: '12px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
              >
                <Maximize2 size={13} />
                <span>大字模式</span>
              </button>
            </div>
          </div>
        )}

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

        {/* Pace Comparison Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          marginTop: '16px',
          marginBottom: '12px'
        }}>
          {/* Current Km Pace */}
          <div className="sub-metric-card" style={{
            background: paceComp.isFasterOrEqual ? 'rgba(0, 230, 118, 0.06)' : 'rgba(255, 23, 68, 0.06)',
            border: `1px solid ${paceComp.isFasterOrEqual ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 23, 68, 0.3)'}`
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="sub-metric-title">
                <Zap size={14} color={paceComp.isFasterOrEqual ? "#00E676" : "#FF1744"} />
                <span>目前配速</span>
              </div>
              <span style={{
                fontSize: '10px',
                fontWeight: '700',
                padding: '2px 6px',
                borderRadius: '6px',
                background: paceComp.isFasterOrEqual ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)',
                color: paceComp.isFasterOrEqual ? '#00E676' : '#FF1744'
              }}>
                {paceComp.isFasterOrEqual ? '🟢 快於均速' : '🔴 掉速提醒'}
              </span>
            </div>
            <div className="sub-metric-value" style={{
              color: paceComp.isFasterOrEqual ? '#00E676' : '#FF1744',
              fontSize: '26px'
            }}>
              {paceComp.currentPaceStr}
            </div>
            <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '2px' }}>
              第 {paceComp.currentKmNum} 公里配速
            </div>
          </div>

          {/* Average Pace */}
          <div className="sub-metric-card">
            <div className="sub-metric-title"><Gauge size={14} color="#00E5FF" /> 平均配速</div>
            <div className="sub-metric-value" style={{ fontSize: '26px' }}>{paceComp.avgPaceStr}</div>
            <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '2px' }}>全域總平均</div>
          </div>
        </div>

        {/* 3 Secondary Sub metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div className="sub-metric-card" style={{ padding: '10px 8px' }}>
            <div className="sub-metric-title" style={{ fontSize: '11px' }}><Clock size={12} color="#00E5FF" /> 時間</div>
            <div className="sub-metric-value" style={{ fontSize: '16px' }}>{timeStr}</div>
          </div>

          <div className="sub-metric-card" style={{ padding: '10px 8px' }}>
            <div className="sub-metric-title" style={{ fontSize: '11px' }}><Navigation size={12} color="#FFD600" /> 時速</div>
            <div className="sub-metric-value" style={{ fontSize: '16px' }}>{speedStr} <span style={{ fontSize: '10px', color: '#8E9BAE' }}>k/h</span></div>
          </div>

          <div className="sub-metric-card" style={{ padding: '10px 8px' }}>
            <div className="sub-metric-title" style={{ fontSize: '11px' }}><Flame size={12} color="#FF1744" /> 卡路里</div>
            <div className="sub-metric-value" style={{ fontSize: '16px' }}>{calories} <span style={{ fontSize: '10px', color: '#8E9BAE' }}>kcal</span></div>
          </div>
        </div>

      </div>

      {/* Running Controls */}
      <div style={{ marginTop: '24px' }}>
        {!isTracking ? (
          <button className="btn-primary" onClick={startRun}>
            <Play fill="#0A0E17" size={24} />
            <span>開始跑步紀錄</span>
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

      {/* Summary Modal after Stop */}
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

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                style={{
                  flex: 1,
                  padding: '14px',
                  borderRadius: '16px',
                  background: 'rgba(255, 23, 68, 0.12)',
                  border: '1.5px solid rgba(255, 23, 68, 0.4)',
                  color: '#FF1744',
                  fontWeight: '700',
                  fontSize: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => setShowDiscardConfirm(true)}
              >
                <Trash2 size={18} />
                <span>不用儲存</span>
              </button>

              <button
                className="btn-primary"
                style={{
                  flex: 1.5,
                  padding: '14px',
                  borderRadius: '16px',
                  fontSize: '15px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  margin: 0
                }}
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setSavedSummary(null);
                }}
              >
                <Check size={18} />
                <span>確認儲存</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Safety Dialog */}
      {showDiscardConfirm && savedSummary && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 350,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '380px',
            width: '100%',
            border: '1.5px solid rgba(255, 23, 68, 0.5)',
            textAlign: 'center',
            padding: '24px 20px',
            boxShadow: '0 12px 40px rgba(255, 23, 68, 0.2)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(255, 23, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#FF1744'
            }}>
              <ShieldAlert size={32} />
            </div>

            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#FFF', marginBottom: '8px' }}>
              確定不儲存這筆紀錄嗎？
            </h3>

            <p style={{ fontSize: '13px', color: '#8E9BAE', lineHeight: '1.6', marginBottom: '16px' }}>
              本次訓練共 <span style={{ color: '#00E676', fontWeight: '800' }}>{savedSummary.distanceKm} 公里</span>，耗時 <span style={{ color: '#00E5FF', fontWeight: '800' }}>{formatTime(savedSummary.durationSeconds)}</span>。<br />
              點擊捨棄後，紀錄將被移至<span style={{ color: '#FFD600', fontWeight: '700' }}>【最近刪除 (回收站)】</span>保留 30 天，您隨時可在「歷史紀錄」中救回。
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn-primary"
                style={{
                  flex: 1.2,
                  padding: '12px',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '800',
                  margin: 0
                }}
                onClick={() => setShowDiscardConfirm(false)}
              >
                保留並儲存
              </button>

              <button
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  background: 'rgba(255, 23, 68, 0.15)',
                  border: '1px solid rgba(255, 23, 68, 0.5)',
                  color: '#FF1744',
                  fontWeight: '700',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (discardRunRecord) {
                    discardRunRecord(savedSummary);
                  } else if (deleteRunRecord) {
                    deleteRunRecord(savedSummary.id);
                  }
                  setShowDiscardConfirm(false);
                  setSavedSummary(null);
                }}
              >
                移至回收站
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
