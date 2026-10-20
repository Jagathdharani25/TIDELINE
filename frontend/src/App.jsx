import React, { useState } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import HomeView from './views/HomeView';
import MapView from './views/MapView';
import EmergencyView from './views/EmergencyView';
import MaintenanceView from './views/MaintenanceView';
import LogsView from './views/LogsView';
import LoginPage from './views/LoginPage';
import PasswordSetupPage from './views/PasswordSetupPage';
import LocalAssistantModal from './components/LocalAssistantModal';
import ApiStatusModal from './components/ApiStatusModal';
import useGpsLocation from './utils/useGpsLocation';
import useSyncManager from './utils/useSyncManager';
import { AuthProvider } from './utils/useAuth';
import useAuth from './utils/useAuth';

function TidelineMain() {
  const { user, isAuthenticated, loading, needsPasswordSetup, logout } = useAuth();
  const [currentView, setCurrentView] = useState('home');
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

  // Global authentic hardware GPS state
  const { status: gpsStatus } = useGpsLocation();

  // 1. Loading screen while authenticating
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#081826',
        color: '#17D9A3',
        fontFamily: 'IBM Plex Mono, monospace',
        fontSize: '13px',
        letterSpacing: '0.12em',
      }}>
        INITIALIZING TIDELINE NAVAL BRIDGE CONSOLE...
      </div>
    );
  }

  // 2. Strict Authentication Requirement — Login page shown if not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 3. Password Setup Page if account requires initial password creation
  if (needsPasswordSetup) {
    return <PasswordSetupPage />;
  }

  // Active view renderer for Primary HUD station
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
        return (
          <HomeView
            onChangeView={setCurrentView}
            onOpenAssistant={() => setIsAssistantOpen(true)}
            viewMode="bridge"
          />
        );
    }
  };

  return (
    <div className="bridge-console-root">
      {/* ── 1. Top Unified Header: TIDELINE, IST, GPS FIX, SYNCED, AI ASSIST, LOGOUT ── */}
      <Header
        gpsStatus={gpsStatus}
        syncSummary={syncSummary}
        isSyncing={isSyncing}
        onTriggerSync={triggerSync}
        onOpenAssistant={() => setIsAssistantOpen(true)}
        onOpenStatusModal={() => setIsStatusModalOpen(true)}
        user={user}
        onLogout={logout}
      />

      {/* ── 2. Single-Screen 2-Panel Naval Bridge Console ── */}
      <main className="bridge-console-main">
        <div className="bridge-grid">
          {/* Left Panel: Primary Station View (Vessel Telemetry & Station Controls) */}
          <section className="bridge-panel bridge-panel-primary" aria-label="Primary Console Station">
            <div className="bridge-panel-header">
              <div className="header-left-meta">
                <span className="panel-title">
                  {currentView === 'home'
                    ? 'VESSEL TELEMETRY & CONTROLS'
                    : `${currentView.toUpperCase()} STATION`}
                </span>
                <span className="badge">PRIMARY HUD</span>
              </div>
              <div className="header-right-meta">
                <span className="staff-indicator" title={`Authorized Staff: ${user?.fullName || user?.username} (${user?.role || 'OFFICER'})`}>
                  ⚓ {user?.username} ({user?.role || 'OFFICER'})
                </span>
                <button
                  id="btn-primary-logout"
                  type="button"
                  className="bridge-logout-btn"
                  onClick={logout}
                  title="Sign out of current watch and return to login page"
                >
                  LOGOUT
                </button>
              </div>
            </div>
            <div className="bridge-panel-body">
              {renderActiveView()}
            </div>
          </section>

          {/* Right Panel: Auxiliary Station View (Offline Nautical Chart & Radar HUD) */}
          <section className="bridge-panel bridge-panel-auxiliary" aria-label="Auxiliary Console Station">
            <div className="bridge-panel-header">
              <span className="panel-title">
                {currentView === 'map' ? 'VESSEL CONTROL & QUICK ACCESS' : 'OFFLINE NAUTICAL CHART & RADAR'}
              </span>
              <span className="badge">AUXILIARY HUD</span>
            </div>
            <div className="bridge-panel-body">
              {currentView === 'map' ? (
                <HomeView
                  onChangeView={setCurrentView}
                  onOpenAssistant={() => setIsAssistantOpen(true)}
                  viewMode="bridge"
                />
              ) : (
                <MapView isAuxiliary={true} />
              )}
            </div>
          </section>
        </div>
      </main>

      {/* ── 3. Fixed Bottom Marine Navigation Bar (HOME, MAP, SOS, FIX, LOGS) ── */}
      <BottomNav
        currentView={currentView}
        onChangeView={setCurrentView}
      />

      {/* Local AI Assistant Modal */}
      {isAssistantOpen && (
        <LocalAssistantModal
          onClose={() => setIsAssistantOpen(false)}
          viewMode="bridge"
        />
      )}

      {/* Local API & SQLite Database Status Modal */}
      {isStatusModalOpen && (
        <ApiStatusModal
          backendStatus={backendStatus}
          onClose={() => setIsStatusModalOpen(false)}
          viewMode="bridge"
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <TidelineMain />
    </AuthProvider>
  );
}
