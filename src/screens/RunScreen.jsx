import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Square, Flame, Gauge, Clock, Navigation, Target, Award, Sparkles, Star, Check, Plus, Minus, Zap, Lock, Unlock, Maximize2, Minimize2, ShieldAlert, Trash2, FileText, Edit3, CloudSun, Droplets, Wind, Thermometer } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { formatTime, formatPace, formatSpeed } from '../utils/metrics';
import { MapViewComponent } from '../components/MapViewComponent';

// 【防誤觸保護】長按暫停按鈕組件（需長按 0.95 秒觸發，徹底防止口袋短褲布料摩擦與汗水誤觸）
function LongPressPauseButton({ onPause, isOutdoor = false }) {
  const [progress, setProgress] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const pressTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const toastTimeoutRef = useRef(null);

  const startPress = (e) => {
    setIsPressing(true);
    setProgress(0);

    const startTime = Date.now();
    const duration = 950; // 0.95 秒長按門檻

    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
    }, 25);

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(0);
      setIsPressing(false);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([60, 40, 60]); } catch (err) {}
      }
      onPause();
    }, duration);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // 若短按即放開（小於觸發時間），提示需要長按以防誤觸
    if (isPressing && progress > 0 && progress < 90) {
      setShowToast(true);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = setTimeout(() => setShowToast(false), 2200);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate(30); } catch (err) {}
      }
    }

    setIsPressing(false);
    setProgress(0);
  };

  useEffect(() => {
    return () => {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
      {showToast && (
        <div style={{
          position: 'absolute',
          bottom: '115%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 214, 0, 0.96)',
          color: '#0A0E17',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: '800',
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 14px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 99,
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>🛡️ 防誤觸：請長按 1 秒暫停</span>
        </div>
      )}

      <button
        type="button"
        className="btn-secondary"
        style={{
          flex: 1,
          width: '100%',
          padding: isOutdoor ? '14px' : '16px',
          fontSize: isOutdoor ? '16px' : '18px',
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'manipulation',
          borderColor: isPressing ? '#FFD600' : undefined
        }}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        onTouchCancel={cancelPress}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* 長按進度條動畫背景 */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progress}%`,
            background: 'linear-gradient(90deg, rgba(255, 214, 0, 0.25), rgba(255, 214, 0, 0.5))',
            pointerEvents: 'none',
            transition: progress === 0 ? 'width 0.2s ease-out' : 'none'
          }}
        />

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 1 }}>
          <Pause size={isOutdoor ? 20 : 24} color="#FFD600" />
          <span>{isPressing ? '按住以暫停...' : '長按暫停'}</span>
        </div>
      </button>
    </div>
  );
}

export function RunScreen({ setActiveTab }) {
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
    getSummaryDraft,
    confirmSaveRun,
    confirmDiscardRun,
    resumeFromStop,
    deleteRunRecord,
    discardRunRecord,
    simulatorMode,
    getPaceComparison,
    isTouchLocked,
    setIsTouchLocked,
    isOutdoorView,
    setIsOutdoorView,
    currentWeather,
    isFetchingWeather,
    refreshWeather
  } = useRunContext();

  const [savedSummary, setSavedSummary] = useState(null);
  const [runNotes, setRunNotes] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [defaultSavedSuccess, setDefaultSavedSuccess] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

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
    const draft = getSummaryDraft ? getSummaryDraft() : stopRun();
    if (draft) {
      setSavedSummary(draft);
      setRunNotes(draft.notes || '');
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

          {/* Outdoor Weather & Air Quality Status */}
          {currentWeather && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
              margin: '14px 0 8px',
            }}>
              {/* 氣溫 */}
              <div style={{
                background: '#0D1424',
                border: '1.5px solid rgba(255, 183, 77, 0.4)',
                borderRadius: '16px',
                padding: '10px 4px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0
              }}>
                <div style={{ fontSize: '13px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px' }}>
                  氣溫
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: '#FFB74D', display: 'flex', alignItems: 'center', gap: '3px', lineHeight: 1.1 }}>
                  <span style={{ fontSize: '17px' }}>🌡️</span>
                  <span>{currentWeather.temp !== null ? `${currentWeather.temp}°C` : '--'}</span>
                </div>
              </div>

              {/* 濕度 */}
              <div style={{
                background: '#0D1424',
                border: '1.5px solid rgba(79, 195, 247, 0.4)',
                borderRadius: '16px',
                padding: '10px 4px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0
              }}>
                <div style={{ fontSize: '13px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px' }}>
                  濕度
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: '#4FC3F7', display: 'flex', alignItems: 'center', gap: '3px', lineHeight: 1.1 }}>
                  <span style={{ fontSize: '17px' }}>💧</span>
                  <span>{currentWeather.humidity !== null ? `${currentWeather.humidity}%` : '--'}</span>
                </div>
              </div>

              {/* PM2.5 */}
              <div style={{
                background: '#0D1424',
                border: `1.5px solid ${currentWeather.pm25Info?.color || '#00E676'}66`,
                borderRadius: '16px',
                padding: '10px 4px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 0
              }}>
                <div style={{ fontSize: '12px', color: '#8E9BAE', fontWeight: '700', marginBottom: '4px', whiteSpace: 'nowrap' }}>
                  PM2.5 ({currentWeather.pm25Info?.label || '良好'})
                </div>
                <div style={{ fontSize: '21px', fontWeight: '900', color: currentWeather.pm25Info?.color || '#00E676', display: 'flex', alignItems: 'center', gap: '3px', lineHeight: 1.1 }}>
                  <span style={{ fontSize: '17px' }}>🍃</span>
                  <span>{currentWeather.pm25 !== null ? currentWeather.pm25 : '--'}</span>
                  <span style={{ fontSize: '12px', fontWeight: '700', opacity: 0.85 }}>µg</span>
                </div>
              </div>
            </div>
          )}

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
              <LongPressPauseButton onPause={pauseRun} />
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

        {/* Real-time Weather & Air Quality Bar (Active during run) */}
        {isTracking && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px'
          }}>
            {currentWeather ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FFB74D' }}>
                  <Thermometer size={14} color="#FFB74D" />
                  <span style={{ fontWeight: '700' }}>{currentWeather.temp !== null ? `${currentWeather.temp}°C` : '--'}</span>
                  <span style={{ fontSize: '10px', color: '#8E9BAE' }}>氣溫</span>
                </div>
                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#4FC3F7' }}>
                  <Droplets size={14} color="#4FC3F7" />
                  <span style={{ fontWeight: '700' }}>{currentWeather.humidity !== null ? `${currentWeather.humidity}%` : '--'}</span>
                  <span style={{ fontSize: '10px', color: '#8E9BAE' }}>濕度</span>
                </div>
                <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: currentWeather.pm25Info?.color || '#00E676' }}>
                  <Wind size={14} color={currentWeather.pm25Info?.color || '#00E676'} />
                  <span style={{ fontWeight: '700' }}>
                    {currentWeather.pm25 !== null ? `${currentWeather.pm25}` : '--'}
                  </span>
                  <span style={{ fontSize: '10px', color: '#8E9BAE' }}>μg</span>
                  {currentWeather.pm25Info?.label && (
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 5px',
                      borderRadius: '4px',
                      background: `${currentWeather.pm25Info.color}22`,
                      color: currentWeather.pm25Info.color,
                      fontWeight: '800'
                    }}>
                      {currentWeather.pm25Info.label}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div style={{ width: '100%', textAlign: 'center', color: '#8E9BAE', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <CloudSun size={14} color="#00E5FF" />
                <span>{isFetchingWeather ? '正在抓取當前定位氣溫、濕度與空氣品質...' : '定位成功後將自動載入即時氣溫、濕度與 PM2.5'}</span>
              </div>
            )}
          </div>
        )}

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
              <LongPressPauseButton onPause={pauseRun} isOutdoor />
            )}

            <button className="btn-danger" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={handleStop}>
              <Square size={18} fill="#FF1744" />
              <span>結束儲存</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary Modal after Stop (Includes Resume Running option) */}
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
          <div className="glass-card glow-card-green" style={{ width: '100%', maxWidth: '420px', textAlign: 'center', maxHeight: '92vh', overflowY: 'auto' }}>
            <Sparkles size={36} color="#00E676" style={{ margin: '0 auto 10px' }} />
            <h2 style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>跑步訓練摘要</h2>
            <p style={{ color: '#8E9BAE', fontSize: '12px', marginBottom: '14px' }}>
              運動已暫停。您可以點擊「繼續跑」返回運動，或確認儲存紀錄。
            </p>

            {/* Core Stats */}
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '38px', fontWeight: '800', color: '#00E676' }}>{savedSummary.distanceKm} <span style={{ fontSize: '16px', color: '#8E9BAE' }}>KM</span></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>總時間</div>
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>{formatTime(savedSummary.durationSeconds)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>平均配速</div>
                  <div style={{ fontSize: '15px', fontWeight: '700' }}>{savedSummary.avgPace}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>卡路里</div>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#FF1744' }}>{savedSummary.calories} kcal</div>
                </div>
              </div>
            </div>

            {/* Run Notes & Mood Section */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(0, 229, 255, 0.25)',
              borderRadius: '16px',
              padding: '12px 14px',
              marginBottom: '14px',
              textAlign: 'left'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: '700', color: '#00E5FF', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Edit3 size={13} color="#00E5FF" />
                  <span>跑步心得與路況備註 (選填)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {savedSummary.weather && (
                    <span style={{ fontSize: '10px', background: 'rgba(0, 230, 118, 0.15)', color: '#00E676', padding: '1px 6px', borderRadius: '6px', fontWeight: '700' }}>
                      🌤️ 已自動帶入當時氣象
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#8E9BAE' }}>{runNotes.length}/200</span>
                </div>
              </div>

              {/* Quick Preset Tags */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {[
                  '🌧️ 途中下雨',
                  '☀️ 天氣悶熱',
                  '💨 逆風吃力',
                  '💪 狀況極佳',
                  '🥵 感覺疲憊',
                  '🦵 雙腿緊繃',
                  '🏃 節奏順暢',
                  '🌙 夜跑舒服'
                ].map((tag) => {
                  const isSelected = runNotes.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setRunNotes((prev) => {
                          if (!prev.trim()) return tag;
                          if (prev.includes(tag)) {
                            // 再次點擊若已存在則移除
                            return prev.replace(new RegExp(`；?${tag}；?`), '；').replace(/^；|；$/g, '').trim();
                          }
                          return `${prev}；${tag}`;
                        });
                      }}
                      style={{
                        background: isSelected ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected ? '1px solid #00E5FF' : '1px solid rgba(255, 255, 255, 0.12)',
                        color: isSelected ? '#00E5FF' : '#B0BEC5',
                        borderRadius: '14px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Textarea Input */}
              <textarea
                rows={2}
                maxLength={200}
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="寫下今天的心得或路況（如：跑到一半下雨、今天很熱濕度大跑起來很累...）"
                style={{
                  width: '100%',
                  background: 'rgba(10, 14, 23, 0.65)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  padding: '8px 10px',
                  color: '#FFF',
                  fontSize: '13px',
                  lineHeight: '1.4',
                  resize: 'none',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* Action Buttons Stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Primary Green Action: Resume Run */}
              <button
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '14px',
                  fontSize: '15px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, #00E676, #00B0FF)',
                  color: '#0A0E17',
                  border: 'none',
                  boxShadow: '0 4px 20px rgba(0, 230, 118, 0.4)',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  resumeFromStop();
                  setSavedSummary(null);
                  showToast('🏃 已恢復跑步，繼續累積里程！');
                }}
              >
                <Play fill="#0A0E17" size={18} />
                <span>🏃 繼續跑 (返回運動)</span>
              </button>

              {/* Secondary Actions: Confirm Save & Discard */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  style={{
                    flex: 1,
                    padding: '12px',
                    borderRadius: '12px',
                    background: 'rgba(255, 23, 68, 0.12)',
                    border: '1.5px solid rgba(255, 23, 68, 0.4)',
                    color: '#FF1744',
                    fontWeight: '700',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setShowDiscardConfirm(true)}
                >
                  <Trash2 size={16} />
                  <span>不用儲存</span>
                </button>

                <button
                  style={{
                    flex: 1.3,
                    padding: '12px',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'rgba(0, 229, 255, 0.15)',
                    border: '1.5px solid #00E5FF',
                    color: '#00E5FF',
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    setShowDiscardConfirm(false);
                    const dist = savedSummary.distanceKm;
                    const finalRecord = {
                      ...savedSummary,
                      notes: runNotes.trim()
                    };
                    confirmSaveRun(finalRecord);
                    setSavedSummary(null);
                    setRunNotes('');
                    showToast(`✅ 已成功儲存 ${dist} KM 跑步紀錄！`);
                    if (setActiveTab) {
                      setTimeout(() => setActiveTab('history'), 400);
                    }
                  }}
                >
                  <Check size={16} />
                  <span>確認結束並儲存</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #00E676',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: '24px',
          boxShadow: '0 8px 30px rgba(0, 230, 118, 0.3)',
          zIndex: 400,
          fontSize: '13px',
          fontWeight: '700',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <span>{toastMessage}</span>
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
                  confirmDiscardRun({
                    ...savedSummary,
                    notes: runNotes.trim()
                  });
                  setShowDiscardConfirm(false);
                  setSavedSummary(null);
                  setRunNotes('');
                  showToast('🗑️ 紀錄已移至最近刪除 (回收站)');
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
