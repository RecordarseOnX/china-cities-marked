// src/components/ThemeToggle.jsx

import React from 'react';
import './ThemeToggle.css';

// 简洁风格调色板图标
const PaletteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
    {/* 左上 */}
    <rect x="4" y="4" width="6" height="6" fill="white" stroke="currentColor" strokeWidth="1.5"/>
    {/* 右上 */}
    <rect x="14" y="4" width="6" height="6" fill="white" stroke="currentColor" strokeWidth="1.5"/>
    {/* 左下 */}
    <rect x="4" y="14" width="6" height="6" fill="white" stroke="currentColor" strokeWidth="1.5"/>
    {/* 右下 */}
    <rect x="14" y="14" width="6" height="6" fill="white" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);




function ThemeToggle({ theme, toggleTheme, colorMode, toggleColorMode }) {
  return (
    <>
    <button onClick={toggleTheme} className="theme-toggle-button" aria-label="切换主题">
      {theme === 'light' ? (
        // 太阳图标 (浅色模式)
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      ) : (
        // 月亮图标 (深色模式)
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      )}
    </button>
          <button onClick={toggleColorMode} className={`theme-toggle-button ${colorMode === 'single' ? 'active' : ''}`} aria-label="切换地图颜色模式">
        <PaletteIcon />
      </button>
    </>
  );
}

export default ThemeToggle;