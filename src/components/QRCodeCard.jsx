import React, { useState } from 'react';
import { Share2, Copy, Check, QrCode, ExternalLink } from 'lucide-react';

export function QRCodeCard() {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  // 優先使用當前的實際網址，否則使用 GitHub Pages 預設網址
  const currentUrl = typeof window !== 'undefined' && window.location.href.startsWith('http')
    ? window.location.href
    : 'https://famidoc.github.io/run-tracker/';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(currentUrl)}`;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(currentUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = currentUrl;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('複製失敗:', err);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Run Tracker 專業跑步追蹤',
          text: '快來體驗專業的 Run Tracker 跑步數據追蹤與語音廣播功能！',
          url: currentUrl,
        });
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('分享失敗:', err);
        }
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="glass-card qr-card-container">
      <div className="qr-card-header">
        <div className="qr-icon-badge">
          <QrCode className="qr-badge-icon" />
        </div>
        <div>
          <h3 className="qr-card-title">掃描分享此 App</h3>
          <p className="qr-card-subtitle">與親朋好友一起開啟專業跑步追蹤之旅</p>
        </div>
      </div>

      <div className="qr-code-wrapper">
        <div className="qr-code-border">
          <img
            src={qrImageUrl}
            alt="Run Tracker App QR Code"
            width="180"
            height="180"
            style={{
              display: 'block',
              borderRadius: '8px',
              opacity: imgLoaded ? 1 : 0.8,
              transition: 'opacity 0.3s ease'
            }}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              // 萬一網路中斷時的輕量備用 SVG API
              e.target.src = `https://chart.googleapis.com/chart?cht=qr&chs=260x260&chl=${encodeURIComponent(currentUrl)}`;
            }}
          />
        </div>
      </div>

      <div className="qr-url-box" onClick={handleCopy} title="點擊複製網址">
        <span className="qr-url-text">{currentUrl}</span>
        <ExternalLink className="qr-url-icon" />
      </div>

      <div className="qr-action-buttons">
        <button
          className={`qr-btn qr-btn-copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
        >
          {copied ? <Check className="btn-icon" /> : <Copy className="btn-icon" />}
          <span>{copied ? '已複製連結！' : '複製網址'}</span>
        </button>

        <button className="qr-btn qr-btn-share" onClick={handleShare}>
          <Share2 className="btn-icon" />
          <span>分享給好友</span>
        </button>
      </div>
    </div>
  );
}
