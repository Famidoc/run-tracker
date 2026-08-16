import React, { useState } from 'react';
import { RunProvider } from './context/RunContext';
import { Header } from './components/Header';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { RunScreen } from './screens/RunScreen';
import { AnalyticsScreen } from './screens/AnalyticsScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { HelpScreen } from './screens/HelpScreen';
import './styles/main.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('run');

  return (
    <RunProvider>
      <div className="app-container">
        {/* Top Header */}
        <Header />

        {/* Dynamic Content Screen */}
        <main className="content-body">
          {activeTab === 'run' && <RunScreen />}
          {activeTab === 'analytics' && <AnalyticsScreen />}
          {activeTab === 'history' && <HistoryScreen />}
          {activeTab === 'settings' && <SettingsScreen />}
          {activeTab === 'help' && <HelpScreen />}
          <Footer />
        </main>

        {/* Bottom Tab Bar */}
        <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </RunProvider>
  );
}
