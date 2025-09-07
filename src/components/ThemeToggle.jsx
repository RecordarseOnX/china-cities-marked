// src/components/ThemeToggle.jsx
import React from 'react';
import './ThemeToggle.css';

const PaletteIcon = () => (
  <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="4" y="4" width="6" height="6" stroke="currentColor"/>
    <rect x="14" y="4" width="6" height="6" stroke="currentColor"/>
    <rect x="4" y="14" width="6" height="6" stroke="currentColor"/>
    <rect x="14" y="14" width="6" height="6" stroke="currentColor"/>
  </svg>
);

const LayersIcon = () => (
  <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
    <polyline points="2 17 12 22 22 17"></polyline>
    <polyline points="2 12 12 17 22 12"></polyline>
  </svg>
);

function ThemeToggle({ 
    theme, 
    toggleTheme, 
    colorMode, 
    toggleColorMode, 
    isZoomSwitchEnabled, 
    toggleZoomSwitch 
}) {
  return (
    <>
      {/* 主题切换按钮 */}
      <button 
        onClick={toggleTheme} 
        className="theme-toggle-button" 
        aria-label={theme === 'light' ? "切换到深色主题" : "切换到浅色主题"}
        title={theme === 'light' ? "切换到深色主题" : "切换到浅色主题"}
      >
        {theme === 'light' ? (
          <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>

      {/* 配色模式切换按钮 */}
      <button 
        onClick={toggleColorMode} 
        className={`theme-toggle-button ${colorMode === 'single' ? 'active' : ''}`} 
        aria-label={colorMode === 'single' ? "切换到多色配色" : "切换到单色配色"}
        title={colorMode === 'single' ? "切换到多色配色" : "切换到单色配色"}
      >
        <PaletteIcon />
      </button>

      {/* 缩放切换按钮 */}
      <button 
        onClick={toggleZoomSwitch} 
        className={`theme-toggle-button ${isZoomSwitchEnabled ? 'active' : ''}`} 
        aria-label={isZoomSwitchEnabled ? "关闭缩放切换省/市" : "开启缩放切换省/市"}
        title={isZoomSwitchEnabled ? "关闭缩放切换省/市" : "开启缩放切换省/市"}
      >
        <LayersIcon />
      </button>
    </>
  );
}

export default ThemeToggle;
