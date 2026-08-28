import React from 'react';
import { PlayCircle, BarChart3, History, User, HelpCircle } from 'lucide-react';
import { useRunContext } from '../context/RunContext';

export function Navbar({ activeTab, setActiveTab }) {
  const { isTouchLocked, isTracking } = useRunContext();

  const tabs = [
    { id: 'run', label: '跑步', icon: PlayCircle },
    { id: 'analytics', label: '統計', icon: BarChart3 },
    { id: 'history', label: '紀錄', icon: History },
    { id: 'settings', label: '設定', icon: User },
    { id: 'help', label: '說明', icon: HelpCircle }
  ];

  // 【修復】鎖定中禁止切換分頁：isTouchLocked && isTracking 雙重條件
  const isNavLocked = isTouchLocked && isTracking;

  return (
    <nav
      className="bottom-nav"
      style={isNavLocked ? { pointerEvents: 'none', userSelect: 'none' } : undefined}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (isNavLocked) return; // 防護：鎖定時忽略點擊
              setActiveTab(tab.id);
            }}
          >
            <Icon />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

