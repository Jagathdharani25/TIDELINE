import React, { useState } from 'react';
import StatusBar from './components/StatusBar';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import MapView from './views/MapView';
import EmergencyView from './views/EmergencyView';
import MaintenanceView from './views/MaintenanceView';
import LogsView from './views/LogsView';
import LocalAssistantModal from './components/LocalAssistantModal';
import ApiStatusModal from './components/ApiStatusModal';
import useGpsLocation from './utils/useGpsLocation';
import useSyncManager from './utils/useSyncManager';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [viewMode, setViewMode] = useState('handheld'); // 'handheld' or 'bridge'
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  // Centralized Synchronization Coordinator
  const {
    backendStatus,
    syncSummary,
    isSyncing,
    triggerSync,
    refreshSummary,
  } = useSyncManager();

  // Global GPS state — drives StatusBar pill across all views
  const { status: gpsStatus } = useGpsLocation();

  const renderActiveView = () => {
    switch (currentView) {
      case 'map':
        return <MapView />;
      case 'emergency':
        return <EmergencyView onDataChange={refreshSummary} />;
      case 'maintenance':
        return <MaintenanceView onDataChange={refreshSummary} />;
      case 'logs':
        return <LogsView onDataChange={refreshSummary} />;
      case 'home':
      default:
        return <HomeView onChangeView={setCurrentView} onOpenAssistant={() => setIsAssistantOpen(true)} />;
    }
  };

  return (
    <div className={`stage-container ${viewMode === 'bridge' ? 'bridge-mode' : ''}`}>
      <div className={`stage-top-bar ${viewMode === 'bridge' ? 'bridge-top-bar' : ''}`}>
        <div className="view-mode-toggle">
          <button
            className={`view-mode-btn ${viewMode === 'handheld' ? 'active' : ''}`}
            onClick={() => setViewMode('handheld')}
            title="Sleek handheld phone terminal simulation"
          >
            HANDHELD FRAME
          </button>
          <button
            className={`view-mode-btn ${viewMode === 'bridge' ? 'active' : ''}`}
            onClick={() => setViewMode('bridge')}
            title="Widescreen naval bridge console display"
          >
            BRIDGE CONSOLE
          </button>
        </div>
      </div>

      <div className={`phone ${viewMode === 'bridge' ? 'wide-bridge' : ''}`}>
        <div className="notch"></div>
        <div className="screen">
          <StatusBar
            backendStatus={backendStatus}
            gpsStatus={gpsStatus}
            syncSummary={syncSummary}
            isSyncing={isSyncing}
            onTriggerSync={triggerSync}
            onOpenStatusModal={() => setIsStatusModalOpen(true)}
          />
          <Header
            backendStatus={backendStatus}
            onOpenAssistant={() => setIsAssistantOpen(true)}
            onOpenStatusModal={() => setIsStatusModalOpen(true)}
          />

          <main className="content">
            {viewMode === 'bridge' ? (
              <div className="bridge-grid">
                <div className="bridge-panel">
                  <div className="bridge-panel-header">
                    <span>{currentView === 'home' ? 'Vessel Telemetry & Controls' : currentView.toUpperCase() + ' STATION'}</span>
                    <span className="badge">PRIMARY HUD</span>
                  </div>
                  {renderActiveView()}
                </div>
                <div className="bridge-panel">
                  <div className="bridge-panel-header">
                    <span>{currentView === 'map' ? 'VESSEL CONTROL & STORAGE' : 'OFFLINE CHART & RADAR'}</span>
                    <span className="badge">AUXILIARY HUD</span>
                  </div>
                  {currentView === 'map' ? (
                    <HomeView onChangeView={setCurrentView} onOpenAssistant={() => setIsAssistantOpen(true)} />
                  ) : (
                    <MapView />
                  )}
                </div>
              </div>
            ) : (
              renderActiveView()
            )}
          </main>

          <BottomNav currentView={currentView} onChangeView={setCurrentView} />

          {/* Local AI Assistant: Positioned intelligently, never covers map in bridge mode */}
          {isAssistantOpen && (
            <LocalAssistantModal
              onClose={() => setIsAssistantOpen(false)}
              viewMode={viewMode}
            />
          )}

          {/* Local API & SQLite Database Status Popover */}
          {isStatusModalOpen && (
            <ApiStatusModal
              backendStatus={backendStatus}
              onClose={() => setIsStatusModalOpen(false)}
              viewMode={viewMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
