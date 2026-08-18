import React from 'react';
import { APP_VERSION, APP_BUILD_DATE } from '../config/version';

export function Footer() {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '20px 16px 28px',
      fontSize: '12px',
      color: 'var(--text-muted)',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      marginTop: '24px',
      lineHeight: '1.6'
    }}>
      <div>@2026 by Famidoc Chang & Antigravity</div>
      <div style={{ fontSize: '11px', color: '#8E9BAE', marginTop: '2px' }}>
        RunTracker <span style={{ color: '#00E676', fontWeight: '700' }}>{APP_VERSION}</span> • Build {APP_BUILD_DATE}
      </div>
    </footer>
  );
}
