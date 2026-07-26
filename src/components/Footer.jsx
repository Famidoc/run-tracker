import React from 'react';

export function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '20px 16px 28px',
      fontSize: '11px',
      color: 'var(--text-muted)',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      marginTop: '24px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px'
    }}>
      <div>© {new Date().getFullYear()} RunTracker Pro • 專業跑步追蹤與數據分析</div>
      <div style={{ fontSize: '10px', color: 'rgba(142, 155, 174, 0.6)' }}>
        Designed with ❤️ for Runners • Powered by Antigravity AI
      </div>
    </footer>
  );
}
