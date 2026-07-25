import React, { useState } from 'react';
import { BarChart2, Calendar, TrendingUp, Flame, Zap, Award } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { formatTime } from '../utils/metrics';

export function AnalyticsScreen() {
  const { history, profile } = useRunContext();
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'

  // Calculate stats from history
  const totalRuns = history.length;
  const totalDistance = history.reduce((sum, item) => sum + item.distanceKm, 0);
  const totalDuration = history.reduce((sum, item) => sum + item.durationSeconds, 0);
  const totalCalories = history.reduce((sum, item) => sum + item.calories, 0);

  // Generate 7 days bar chart data
  const chartDays = getPast7DaysData(history);

  // Personal Best (PB)
  const longestRun = history.length > 0
    ? [...history].sort((a, b) => b.distanceKm - a.distanceKm)[0]
    : null;

  return (
    <div style={{ padding: '16px 20px', paddingBottom: '30px' }}>
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>數據統計分析</h1>
          <p style={{ fontSize: '12px', color: '#8E9BAE' }}>累積追蹤與歷史進步趨勢</p>
        </div>

        {/* Week/Month Switch */}
        <div style={{ background: '#121824', borderRadius: '20px', padding: '3px', border: '1px solid rgba(255,255,255,0.08)', display: 'flex' }}>
          <button
            onClick={() => setViewMode('week')}
            style={{
              background: viewMode === 'week' ? '#00E676' : 'none',
              color: viewMode === 'week' ? '#0A0E17' : '#8E9BAE',
              border: 'none',
              borderRadius: '16px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            本週
          </button>
          <button
            onClick={() => setViewMode('month')}
            style={{
              background: viewMode === 'month' ? '#00E676' : 'none',
              color: viewMode === 'month' ? '#0A0E17' : '#8E9BAE',
              border: 'none',
              borderRadius: '16px',
              padding: '4px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            本月
          </button>
        </div>
      </div>

      {/* Weekly Goal Progress Card */}
      <div className="glass-card glow-card-green">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Zap size={18} color="#00E676" />
            <span style={{ fontWeight: '700', fontSize: '14px' }}>本週目標進度</span>
          </div>
          <span style={{ fontSize: '13px', color: '#00E676', fontWeight: '800' }}>
            {totalDistance.toFixed(1)} / {profile.weeklyTargetKm || 25} KM
          </span>
        </div>
        <div style={{ width: '100%', height: '10px', background: 'rgba(255,255,255,0.08)', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{
            width: `${Math.min(100, (totalDistance / (profile.weeklyTargetKm || 25)) * 100)}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #00E5FF, #00E676)',
            borderRadius: '5px'
          }} />
        </div>
      </div>

      {/* Distance Bar Chart */}
      <div className="glass-card">
        <div style={{ fontSize: '14px', fontWeight: '700', color: '#8E9BAE', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <BarChart2 size={16} color="#00E5FF" />
          <span>7 天跑量趨勢 (KM)</span>
        </div>

        <div className="chart-bar-container">
          {chartDays.map((d, i) => {
            const maxVal = Math.max(...chartDays.map(item => item.distance), 10);
            const heightPercent = (d.distance / maxVal) * 100;
            return (
              <div key={i} className="chart-bar-column">
                <span style={{ fontSize: '10px', color: d.distance > 0 ? '#00E676' : 'transparent', fontWeight: '700' }}>
                  {d.distance > 0 ? d.distance.toFixed(1) : ''}
                </span>
                <div
                  className={`chart-bar ${d.distance > 0 ? 'active' : ''}`}
                  style={{ height: `${Math.max(8, heightPercent)}%` }}
                />
                <span className="chart-label">{d.dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key Metrics Overview Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
        <div className="sub-metric-card">
          <div className="sub-metric-title"><TrendingUp size={14} color="#00E676" /> 累積總跑量</div>
          <div className="sub-metric-value">{totalDistance.toFixed(1)} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>KM</span></div>
        </div>

        <div className="sub-metric-card">
          <div className="sub-metric-title"><Calendar size={14} color="#00E5FF" /> 累積跑步次數</div>
          <div className="sub-metric-value">{totalRuns} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>次</span></div>
        </div>

        <div className="sub-metric-card">
          <div className="sub-metric-title"><Flame size={14} color="#FF1744" /> 總消耗卡路里</div>
          <div className="sub-metric-value">{totalCalories} <span style={{ fontSize: '12px', color: '#8E9BAE' }}>kcal</span></div>
        </div>

        <div className="sub-metric-card">
          <div className="sub-metric-title"><Zap size={14} color="#FFD600" /> 累積運動時間</div>
          <div className="sub-metric-value">{formatTime(totalDuration)}</div>
        </div>
      </div>

      {/* Personal Best (PB) Card */}
      {longestRun && (
        <div className="glass-card" style={{ background: 'linear-gradient(135deg, #121824, #1E293B)', border: '1px solid rgba(255,214,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <Award size={22} color="#FFD600" />
            <span style={{ fontWeight: '800', color: '#FFD600', fontSize: '15px' }}>個人最長紀錄 (PB)</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#FFF' }}>
              {longestRun.distanceKm} <span style={{ fontSize: '14px', color: '#8E9BAE' }}>KM</span>
            </div>
            <div style={{ fontSize: '12px', color: '#8E9BAE' }}>
              {longestRun.title} • {new Date(longestRun.date).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Utility to aggregate distance by past 7 days
function getPast7DaysData(history) {
  const result = [];
  const daysMap = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const targetDate = new Date(now.getTime() - i * 86400000);
    const dateStr = targetDate.toISOString().split('T')[0];
    const dayLabel = daysMap[targetDate.getDay()];

    const dayDistance = history
      .filter(item => item.date.startsWith(dateStr))
      .reduce((sum, item) => sum + item.distanceKm, 0);

    result.push({ dayLabel, distance: dayDistance });
  }

  return result;
}
