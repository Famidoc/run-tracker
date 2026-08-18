import React from 'react';
import { QRCodeCard } from '../components/QRCodeCard';
import { APP_VERSION, APP_BUILD_DATE } from '../config/version';
import {
  PlayCircle,
  Volume2,
  BatteryCharging,
  Database,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Info,
  MapPin,
  Flame,
  Award,
  Share2
} from 'lucide-react';

export function HelpScreen() {
  return (
    <div className="help-screen">
      {/* 頁面標題 */}
      <div className="screen-header">
        <h2 className="screen-title">使用說明與分享</h2>
        <p className="screen-subtitle">掌握專業功能技巧，與親友享受跑步樂趣</p>
      </div>

      {/* 最上方 QR Code 分享卡片 */}
      <QRCodeCard />

      {/* 說明區塊 1: 快速上手 */}
      <div className="glass-card help-section">
        <div className="help-section-title">
          <PlayCircle className="section-title-icon text-green" />
          <h3>🏃‍♂️ 快速上手指南</h3>
        </div>
        <ul className="help-list">
          <li>
            <CheckCircle2 className="list-icon text-green" />
            <div>
              <strong>開啟定位與開始跑步：</strong>
              進到「跑步」頁面，確保瀏覽器已允許使用 GPS 位置，點擊霓虹綠大按鈕即可開始追蹤。
            </div>
          </li>
          <li>
            <CheckCircle2 className="list-icon text-green" />
            <div>
              <strong>即時數據顯示：</strong>
              畫面會即時呈現移動距離 (km)、耗時、當前配速 (min/km)、消耗熱量 (kcal) 及心率/步頻估算。
            </div>
          </li>
          <li>
            <CheckCircle2 className="list-icon text-green" />
            <div>
              <strong>暫停與結束儲存：</strong>
              途中可隨時點擊「暫停」，運動結束後點擊「完成」即可自動儲存這筆訓練紀錄。
            </div>
          </li>
        </ul>
      </div>

      {/* 說明區塊 2: 語音提醒播報 */}
      <div className="glass-card help-section">
        <div className="help-section-title">
          <Volume2 className="section-title-icon text-cyan" />
          <h3>🔊 語音播報功能說明</h3>
        </div>
        <ul className="help-list">
          <li>
            <CheckCircle2 className="list-icon text-cyan" />
            <div>
              <strong>每公里自動提醒：</strong>
              App 會在您每完成 1 公里時，自動以清楚的中文語音播報當前距離與配速。
            </div>
          </li>
          <li>
            <CheckCircle2 className="list-icon text-cyan" />
            <div>
              <strong>開關與音量設定：</strong>
              可在「設定」頁面中開關「公里語音提醒」或調整語音播報音量。
            </div>
          </li>
        </ul>
      </div>

      {/* 說明區塊 3: GPS 定位與省電建議 */}
      <div className="glass-card help-section">
        <div className="help-section-title">
          <BatteryCharging className="section-title-icon text-amber" />
          <h3>🔋 GPS 定位與背景省電建議</h3>
        </div>
        <div className="help-notice-box warning">
          <AlertTriangle className="notice-icon" />
          <div>
            <strong>重要提示：</strong>
            部分手機系統在螢幕鎖定時會限制瀏覽器背景定位，請參考下方調整建議：
          </div>
        </div>
        <ul className="help-list">
          <li>
            <CheckCircle2 className="list-icon text-amber" />
            <div>
              <strong>iOS (iPhone Safari)：</strong>
              請至手機「設定」&gt;「隱私權與安全性」&gt;「定位服務」&gt;「Safari」，設定為「使用 App 期間」。
            </div>
          </li>
          <li>
            <CheckCircle2 className="list-icon text-amber" />
            <div>
              <strong>Android (Chrome)：</strong>
              請關閉 Chrome 的「省電最佳化」或關閉手機「低電量模式」，以維持螢幕關閉時繼續追蹤 GPS 軌跡。
            </div>
          </li>
        </ul>
      </div>

      {/* 說明區塊 4: 歷史紀錄與備份 */}
      <div className="glass-card help-section">
        <div className="help-section-title">
          <Database className="section-title-icon text-purple" />
          <h3>📊 數據紀錄與備份管理</h3>
        </div>
        <ul className="help-list">
          <li>
            <CheckCircle2 className="list-icon text-purple" />
            <div>
              <strong>歷史紀錄、手動補登與最近刪除：</strong>
              可在「紀錄」分頁回顧歷史跑量軌跡。若忘記攜帶手機或誤刪，可點擊「補登」手動補齊里程；若誤按捨棄或刪除，可從「最近刪除」回收站於 30 天內一鍵救回。
            </div>
          </li>
          <li>
            <CheckCircle2 className="list-icon text-purple" />
            <div>
              <strong>資料匯出與備份 (JSON)：</strong>
              至「設定」頁面可備份導出 JSON 紀錄檔案（含回收站數據），跨裝置轉移或更換手機時隨時一鍵還原。
            </div>
          </li>
        </ul>
      </div>

      {/* 說明區塊 5: 加入主畫面 (PWA) */}
      <div className="glass-card help-section">
        <div className="help-section-title">
          <Smartphone className="section-title-icon text-green" />
          <h3>📱 將 App 加入手機主畫面</h3>
        </div>
        <ul className="help-list">
          <li>
            <Info className="list-icon text-green" />
            <div>
              <strong>iOS：</strong> 點擊 Safari 底部的「分享 <Share2 className="inline-icon" />」按鈕 &gt; 選擇「加入主畫面」。
            </div>
          </li>
          <li>
            <Info className="list-icon text-green" />
            <div>
              <strong>Android：</strong> 點擊 Chrome 右上角選單「⋮」&gt; 選擇「新增至主畫面」或「安裝應用程式」。
            </div>
          </li>
        </ul>
      </div>

      {/* 頁尾版本與致謝 */}
      <div className="help-footer-info">
        <p>RunTracker <span style={{ color: '#00E676', fontWeight: '800' }}>{APP_VERSION}</span> (Build {APP_BUILD_DATE}) • Famidoc 專業跑步夥伴</p>
        <p className="footer-subtext">祝您每次跑步體驗愉快，突破個人紀錄！🏃💨</p>
      </div>
    </div>
  );
}
