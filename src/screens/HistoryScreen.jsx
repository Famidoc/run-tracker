import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Flame,
  ChevronRight,
  Trash2,
  MapPin,
  Layers,
  Download,
  PlusCircle,
  RotateCcw,
  AlertCircle,
  Check,
  FileText,
  ShieldCheck,
  X
} from 'lucide-react';
import { useRunContext } from '../context/RunContext';
import {
  formatTime,
  ensureCompleteKmSplits,
  calculateTotalPathDistance,
  formatPace,
  formatSpeed,
  calculateCaloriesBurned,
  generateGPX,
  downloadFile
} from '../utils/metrics';
import { MapViewComponent } from '../components/MapViewComponent';

export function HistoryScreen() {
  const {
    history,
    trash = [],
    deleteRunRecord,
    restoreRunRecord,
    permanentDeleteRunRecord,
    emptyTrash,
    addManualRunRecord,
    profile
  } = useRunContext();

  const [selectedRun, setSelectedRun] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showTrashModal, setShowTrashModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Manual Form State
  const now = new Date();
  const defaultDateTimeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  
  const [manualDate, setManualDate] = useState(defaultDateTimeStr);
  const [manualDistance, setManualDistance] = useState('9.0');
  const [manualHours, setManualHours] = useState('0');
  const [manualMinutes, setManualMinutes] = useState('50');
  const [manualSeconds, setManualSeconds] = useState('0');
  const [manualTitle, setManualTitle] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
  };

  // Helper to ensure record stats display valid values
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

  // Real-time calculation for manual entry preview
  const numDist = parseFloat(manualDistance) || 0;
  const totalDurationSec = (parseInt(manualHours || '0', 10) * 3600) +
                           (parseInt(manualMinutes || '0', 10) * 60) +
                           (parseInt(manualSeconds || '0', 10));
  const previewPace = numDist > 0 && totalDurationSec > 0 ? formatPace(numDist, totalDurationSec) : "--'--\"";
  const previewSpeedKmh = numDist > 0 && totalDurationSec > 0 ? parseFloat(formatSpeed(numDist, totalDurationSec)) : 0;
  const previewCalories = numDist > 0 && totalDurationSec > 0 ? calculateCaloriesBurned(profile?.weightKg || 68, totalDurationSec, previewSpeedKmh) : 0;

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (numDist <= 0) {
      alert('請輸入大於 0 的跑步公里數！');
      return;
    }
    if (totalDurationSec <= 0) {
      alert('請輸入跑步耗費的時間！');
      return;
    }

    addManualRunRecord({
      date: manualDate ? new Date(manualDate).toISOString() : new Date().toISOString(),
      distanceKm: numDist,
      durationSeconds: totalDurationSec,
      title: manualTitle.trim() || undefined,
      notes: manualNotes.trim() || ''
    });

    setShowManualModal(false);
    showToast(`✅ 成功補登 ${numDist} KM 跑步紀錄！`);
  };

  const modalStats = selectedRun ? getRecordDisplayStats(selectedRun) : null;
  const modalRecord = selectedRun ? { ...selectedRun, distanceKm: modalStats.dist, avgPace: modalStats.pace, calories: modalStats.cal } : null;
  const modalSplits = modalRecord ? ensureCompleteKmSplits(modalRecord) : [];

  return (
    <div style={{ padding: '16px 20px', paddingBottom: '40px' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid #00E5FF',
          color: '#FFF',
          padding: '10px 20px',
          borderRadius: '24px',
          boxShadow: '0 8px 30px rgba(0, 229, 255, 0.3)',
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

      {/* Header & Quick Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: '800' }}>跑步歷史紀錄</h1>
          <p style={{ fontSize: '12px', color: '#8E9BAE' }}>點擊紀錄查看地圖軌跡，支援補登與垃圾桶救回</p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {/* Manual Run Entry Button */}
          <button
            onClick={() => setShowManualModal(true)}
            style={{
              background: 'rgba(0, 230, 118, 0.12)',
              border: '1px solid rgba(0, 230, 118, 0.4)',
              color: '#00E676',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              transition: 'all 0.2s ease'
            }}
          >
            <PlusCircle size={15} />
            <span>補登</span>
          </button>

          {/* Trash Bin Button */}
          <button
            onClick={() => setShowTrashModal(true)}
            style={{
              background: trash.length > 0 ? 'rgba(255, 214, 0, 0.12)' : 'rgba(255, 255, 255, 0.05)',
              border: `1px solid ${trash.length > 0 ? 'rgba(255, 214, 0, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
              color: trash.length > 0 ? '#FFD600' : '#8E9BAE',
              borderRadius: '12px',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <Trash2 size={15} />
            <span>最近刪除 {trash.length > 0 ? `(${trash.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <MapPin size={40} color="#8E9BAE" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: '16px', fontWeight: '700', color: '#8E9BAE' }}>尚無跑步紀錄</div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>
            您可以點擊右上方「補登」手動補齊今天的 9K，或至「跑步」分頁開始新訓練！
          </div>
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
                  margin: 0,
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontWeight: '800', fontSize: '16px', color: '#FFF' }}>{record.title}</span>
                    {record.isManual && (
                      <span style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '6px',
                        background: 'rgba(0, 229, 255, 0.15)',
                        border: '1px solid rgba(0, 229, 255, 0.3)',
                        color: '#00E5FF',
                        fontWeight: '700'
                      }}>
                        手動補登
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#8E9BAE', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} /> {new Date(record.date).toLocaleDateString()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteRunRecord(record.id);
                        showToast('🗑️ 紀錄已移至【最近刪除】，30天內可隨時還原！');
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
                      title="移至最近刪除"
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

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 23, 0.92)',
          backdropFilter: 'blur(12px)',
          zIndex: 300,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', border: '1.5px solid rgba(0, 230, 118, 0.4)', margin: 0 }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={20} color="#00E676" />
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>手動補登跑步紀錄</h2>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                style={{ background: 'none', border: 'none', color: '#8E9BAE', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Date & Time */}
              <div>
                <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>跑步日期與時間</label>
                <input
                  type="datetime-local"
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#FFF',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Distance */}
              <div>
                <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>跑步里程 (公里 KM)</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    max="200"
                    placeholder="例: 9.0"
                    value={manualDistance}
                    onChange={(e) => setManualDistance(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      paddingRight: '48px',
                      borderRadius: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(0, 230, 118, 0.4)',
                      color: '#00E676',
                      fontSize: '18px',
                      fontWeight: '800',
                      boxSizing: 'border-box'
                    }}
                    required
                  />
                  <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#8E9BAE', fontSize: '13px', fontWeight: '700' }}>
                    KM
                  </span>
                </div>
              </div>

              {/* Duration (Hours / Minutes / Seconds) */}
              <div>
                <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>運動耗時 (時 : 分 : 秒)</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                  <div>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      placeholder="時"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#FFF',
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: '700',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#8E9BAE', marginTop: '2px' }}>小時</div>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="分"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#FFF',
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: '700',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#8E9BAE', marginTop: '2px' }}>分鐘</div>
                  </div>

                  <div>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="秒"
                      value={manualSeconds}
                      onChange={(e) => setManualSeconds(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '10px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#FFF',
                        textAlign: 'center',
                        fontSize: '15px',
                        fontWeight: '700',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ textAlign: 'center', fontSize: '10px', color: '#8E9BAE', marginTop: '2px' }}>秒</div>
                  </div>
                </div>
              </div>

              {/* Real-time Calculation Preview Card */}
              <div style={{
                background: 'rgba(0, 229, 255, 0.06)',
                border: '1px solid rgba(0, 229, 255, 0.25)',
                borderRadius: '12px',
                padding: '10px 14px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '8px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>預估平均配速</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#00E5FF' }}>{previewPace}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8E9BAE' }}>預估消耗熱量</div>
                  <div style={{ fontSize: '16px', fontWeight: '800', color: '#FF1744' }}>{previewCalories} kcal</div>
                </div>
              </div>

              {/* Title & Notes */}
              <div>
                <label style={{ fontSize: '12px', color: '#8E9BAE', display: 'block', marginBottom: '6px' }}>自訂標題 (選填)</label>
                <input
                  type="text"
                  placeholder="例: 晨間 9K 節奏跑"
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#FFF',
                    fontSize: '14px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', borderRadius: '12px', fontSize: '14px' }}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ flex: 1.5, padding: '12px', borderRadius: '12px', fontSize: '14px', fontWeight: '800', margin: 0 }}
                >
                  確認補登
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Trash Bin Modal */}
      {showTrashModal && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10, 14, 23, 0.94)',
          backdropFilter: 'blur(12px)',
          zIndex: 300,
          overflowY: 'auto',
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="glass-card" style={{ maxWidth: '440px', width: '100%', border: '1.5px solid rgba(255, 214, 0, 0.4)', margin: 0 }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={20} color="#FFD600" />
                <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0 }}>最近刪除 (回收站)</h2>
              </div>
              <button
                onClick={() => setShowTrashModal(false)}
                style={{ background: 'none', border: 'none', color: '#8E9BAE', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '12px', color: '#8E9BAE', lineHeight: '1.5', marginBottom: '14px' }}>
              遭刪除或誤按「不用儲存」的紀錄將在此<strong style={{ color: '#FFF' }}>保留 30 天</strong>，期間可隨時一鍵還原。
            </p>

            {trash.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '12px', marginBottom: '16px' }}>
                <ShieldCheck size={36} color="#00E676" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#FFF' }}>回收站是空的</div>
                <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '4px' }}>目前沒有任何被刪除的跑步紀錄</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                  <button
                    onClick={() => {
                      if (confirm('確定要永久清空回收站內的所有紀錄嗎？清空後將無法復原！')) {
                        emptyTrash();
                        showToast('回收站已徹底清空');
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#FF1744',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    全部清空
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
                  {trash.map((item) => {
                    const stats = getRecordDisplayStats(item);
                    const deletedTime = item.deletedAt ? new Date(item.deletedAt).getTime() : Date.now();
                    const daysLeft = Math.max(1, 30 - Math.floor((Date.now() - deletedTime) / (1000 * 60 * 60 * 24)));

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '12px',
                          padding: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '700', fontSize: '14px', color: '#FFF' }}>{item.title}</span>
                          <span style={{ fontSize: '10px', color: '#FFD600', background: 'rgba(255, 214, 0, 0.1)', padding: '2px 6px', borderRadius: '6px' }}>
                            剩餘 {daysLeft} 天
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px', color: '#8E9BAE' }}>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                          <span>{stats.dist} KM · {formatTime(item.durationSeconds)} · {stats.pace}</span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => {
                              restoreRunRecord(item.id);
                              showToast(`🔄 已成功救回「${item.title} (${stats.dist} KM)」！`);
                            }}
                            style={{
                              flex: 1.2,
                              background: 'rgba(0, 230, 118, 0.15)',
                              border: '1px solid rgba(0, 230, 118, 0.4)',
                              color: '#00E676',
                              borderRadius: '8px',
                              padding: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <RotateCcw size={13} />
                            <span>一鍵還原</span>
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`確定要永久刪除這筆 ${stats.dist} KM 的紀錄嗎？刪除後將永遠無法救回！`)) {
                                permanentDeleteRunRecord(item.id);
                                showToast('已永久刪除該筆紀錄');
                              }
                            }}
                            style={{
                              flex: 1,
                              background: 'rgba(255, 23, 68, 0.12)',
                              border: '1px solid rgba(255, 23, 68, 0.3)',
                              color: '#FF1744',
                              borderRadius: '8px',
                              padding: '6px',
                              fontSize: '12px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            <Trash2 size={13} />
                            <span>永久刪除</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button
              onClick={() => setShowTrashModal(false)}
              className="btn-secondary"
              style={{ width: '100%', padding: '10px', borderRadius: '12px', fontSize: '13px' }}
            >
              關閉
            </button>

          </div>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0 }}>{selectedRun.title}</h2>
                  {selectedRun.isManual && (
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '6px',
                      background: 'rgba(0, 229, 255, 0.15)',
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                      color: '#00E5FF',
                      fontWeight: '700'
                    }}>
                      手動補登
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#8E9BAE', marginTop: '2px' }}>{new Date(selectedRun.date).toLocaleString()}</div>
              </div>
              <button
                onClick={() => setSelectedRun(null)}
                style={{ background: 'none', border: 'none', color: '#8E9BAE', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ✕
              </button>
            </div>

            {/* Path Map (If has GPS data) */}
            {selectedRun.path && selectedRun.path.length > 0 ? (
              <div style={{ marginBottom: '16px' }}>
                <MapViewComponent pathPoints={selectedRun.path || []} isTracking={false} />
              </div>
            ) : (
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.1)',
                borderRadius: '14px',
                padding: '20px',
                textAlign: 'center',
                color: '#8E9BAE',
                fontSize: '12px',
                marginBottom: '16px'
              }}>
                <FileText size={28} color="#8E9BAE" style={{ margin: '0 auto 6px' }} />
                <span>此紀錄為手動補登（無 GPS 地圖軌跡）</span>
                {selectedRun.notes && (
                  <div style={{ marginTop: '8px', color: '#FFF', fontSize: '13px', background: 'rgba(255,255,255,0.04)', padding: '8px 12px', borderRadius: '8px' }}>
                    備註：{selectedRun.notes}
                  </div>
                )}
              </div>
            )}

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
              {selectedRun.path && selectedRun.path.length > 0 && (
                <button
                  className="btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', border: '1px solid #00E5FF', color: '#00E5FF', background: 'rgba(0, 229, 255, 0.1)', fontSize: '13px', borderRadius: '12px', cursor: 'pointer' }}
                  onClick={() => {
                    const gpxContent = generateGPX(selectedRun);
                    downloadFile(`run_${selectedRun.id}.gpx`, gpxContent, 'application/gpx+xml');
                  }}
                >
                  <Download size={15} />
                  <span>匯出 GPX</span>
                </button>
              )}

              <button
                className="btn-danger"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px 8px', borderRadius: '12px', fontSize: '13px', cursor: 'pointer' }}
                onClick={() => {
                  deleteRunRecord(selectedRun.id);
                  setSelectedRun(null);
                  showToast('🗑️ 紀錄已移至【最近刪除】');
                }}
              >
                <Trash2 size={15} />
                <span>移至回收站</span>
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
