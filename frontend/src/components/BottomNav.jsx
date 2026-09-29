import React from 'react';

export default function BottomNav({ currentView, onChangeView }) {
  const navItems = [
    {
      id: 'home',
      label: 'HOME',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M3 11l9-7 9 7" />
          <path d="M5 10v10h14V10" />
        </svg>
      ),
    },
    {
      id: 'map',
      label: 'MAP',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M9 4l6 3 5-2v15l-5 2-6-3-5 2V6z" />
          <path d="M9 4v15M15 7v15" />
        </svg>
      ),
    },
    {
      id: 'emergency',
      label: 'SOS',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 2l9 4v6c0 5-3.8 8.7-9 10-5.2-1.3-9-5-9-10V6z" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      ),
    },
    {
      id: 'maintenance',
      label: 'FIX',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2-2z" />
        </svg>
      ),
    },
    {
      id: 'logs',
      label: 'LOGS',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M6 3h9l4 4v14H6z" />
          <path d="M9 9h7M9 13h7M9 17h4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="bottomnav" aria-label="Marine Navigation">
      {navItems.map((item) => {
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`navitem ${isActive ? 'active' : ''}`}
            onClick={() => onChangeView(item.id)}
            data-view={item.id}
            aria-label={`Go to ${item.label}`}
          >
            {item.icon}
            {item.label}
            <div className="dotline"></div>
          </button>
        );
      })}
    </nav>
  );
}
