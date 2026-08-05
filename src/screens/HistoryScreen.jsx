import React, { useState } from 'react';
import { Calendar, Clock, Flame, ChevronRight, Trash2, MapPin, Layers, Download } from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import { formatTime, ensureCompleteKmSplits, calculateTotalPathDistance, formatPace, formatSpeed, calculateCaloriesBurned, generateGPX, downloadFile } from '../utils/metrics';
import { MapViewComponent } from '../components/MapViewComponent';

export function HistoryScreen() {
  const { history, deleteRunRecord, profile } = useRunContext();
  const [selectedRun, setSelectedRun] = useState(null);

  // Helper to ensure record stats display valid values (auto-repairing 0km records with path data)
  const getRecordDisplayStats = (record) => {
    let dist = record.distanceKm || 0;
    const pathDist = calculateTotalPathDistance(record.path);
    if (dist <= 0 && pathDist > 0) {
      dist = pathDist;
    }

    let pace = record.avgPace;
    if (!pace || pace === "--'--\"") {
      pace = formatPace(dist, record.durationSeconds);
    }

    let cal = record.calories || 0;
    if (cal <= 0 && dist > 0) {
      const speedKmh = parseFloat(formatSpeed(dist, record.durationSeconds)) || 9.5;
      cal = calculateCaloriesBurned(profile?.weightKg || 68, record.durationSeconds, speedKmh);
    }

    return { dist, pace, cal };
  };

  const modalStats = selectedRun ? getRecordDisplayStats(selectedRun) : null;
  const modalRecord = selectedRun ? { ...selectedRun, distanceKm: modalStats.dist, avgPace: modalStats.pace, calories: modalStats.cal } : null;
  const modalSplits = modalRecord ? ensureCompleteKmSplits(modalRecord) : [];

  return (
    <div style={{ padding: '16px 20px', paddingBottom: '30px' }}>
      
      {/* Page Title */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: '800' }}>跑步歷史紀錄</h1>
        <p style={{ fontSize: '12px', color: '#8E9BAE' }}>點擊任何紀錄查看詳細地圖軌跡與每公里分段數據</p>
      </div>

      {history.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <MapPin size={40} color="#8E9BAE" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#8E9BAE' }}>尚無跑步紀錄</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>點擊底部的「跑步」分頁開始您的第一次自主訓練！</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {history.map((record) => {
            const { dist, pace, cal } = getRecordDisplayStats(record);
            return (
              <div
                key={record.id}
                className="glass-card"
                onClick={() => setSelectedRun(record)}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease, border-color 0.2s ease',
                  margin: 0
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '800', fontSize: '16px', color: '#FFF' }}>{record.title}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#8E9BAE', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {new Date(record.date).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`確定要刪除這筆 ${dist} KM 的跑步紀錄嗎？`)) {
                          deleteRunRecord(record.id);
                        }
                      }}
                      style={{
                        background: 'rgba(255, 23, 68, 0.12)',
                        border: '1px solid rgba(255, 23, 68, 0.3)',
                        color: '#FF1744',
                        borderRadius: '8px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                      title="刪除此筆紀錄"
                    >
                      <Trash2 size={12} />
                      <span>刪除</span>
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                  <div style={{ fontSize: '32px', fontWeight: '800', color: '#00E676' }}>
                    {dist} <span style={{ fontSize: '14px', color: '#8E9BAE' }}>KM</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#00E5FF', fontSize: '14px', fontWeight: '700' }}>
                    <span>詳情</span>
                    <ChevronRight size={16} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', padding: '10px' }}>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8E9BAE' }}>時間</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{formatTime(record.durationSeconds)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8E9BAE' }}>平均配速</div>
                    <div style={{ fontSize: '13px', fontWeight: '700' }}>{pace}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '10px', color: '#8E9BAE' }}>卡路里</div>
                    <div style={{ fontSize: '13px', fontWeight: '700', color: '#FF1744' }}>{cal} kcal</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedRun && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 23, 0.95)',
          backdropFilter: 'blur(16px)',
          zIndex: 200,
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div className="glass-card glow-card-green" style={{ maxWidth: '440px', margin: '0 auto' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800' }}>{selectedRun.title}</h2>
                <div style={{ fontSize: '12px', color: '#8E9BAE' }}>{new Date(selectedRun.date).toLocaleString()}</div>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                style={{ background: 'none', border: 'none', color: '#8E9BAE', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Path Map */}
            <div style={{ marginBottom: '16px' }}>
              <MapViewComponent pathPoints={selectedRun.path || []} isTracking={false} />
            </div>

            {/* Core Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '14px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#8E9BAE' }}>總里程</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#00E676' }}>{modalStats.dist} km</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#8E9BAE' }}>平均配速</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#00E5FF' }}>{modalStats.pace}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: '#8E9BAE' }}>消耗卡路里</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#FF1744' }}>{modalStats.cal} kcal</div>
              </div>
            </div>

            {/* KM Splits Table */}
            {modalSplits.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#8E9BAE', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers size={14} color="#00E5FF" />
                  <span>每公里分段配速 ({modalSplits.length} 公里)</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', maxHeight: '160px', overflowY: 'auto' }}>
                  {modalSplits.map((split) => (
                    <div
                      key={split.km}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        fontSize: '13px'
                      }}
                    >
                      <span style={{ color: '#8E9BAE', fontWeight: '600' }}>第 {split.km} 公里</span>
                      <span style={{ color: '#00E676', fontWeight: '700' }}>{split.pace}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', border: '1px solid #00E5FF', color: '#00E5FF', background: 'rgba(0, 229, 255, 0.1)', fontSize: '13px', borderRadius: '12px', cursor: 'pointer' }}
                onClick={() => {
                  const gpxContent = generateGPX(selectedRun);
                  downloadFile(`run_${selectedRun.id}.gpx`, gpxContent, 'application/gpx+xml');
                }}
              >
                <Download size={15} />
                <span>匯出 GPX 軌跡</span>
              </button>

              <button
                className="btn-danger"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}
                onClick={() => {
                  deleteRunRecord(selectedRun.id);
                  setSelectedRun(null);
                }}
              >
                <Trash2 size={15} />
                <span>刪除紀錄</span>
              </button>

              <button
                className="btn-secondary"
                style={{ flex: 1, padding: '10px 8px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}
                onClick={() => setSelectedRun(null)}
              >
                關閉
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
