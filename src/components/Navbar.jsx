import React from 'react';
import { PlayCircle, BarChart3, History, User, HelpCircle } from 'lucide-react';

export function Navbar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'run', label: '跑步', icon: PlayCircle },
    { id: 'analytics', label: '統計', icon: BarChart3 },
    { id: 'history', label: '紀錄', icon: History },
    { id: 'settings', label: '設定', icon: User },
    { id: 'help', label: '說明', icon: HelpCircle }
  ];

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={`nav-tab ${isActive ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

