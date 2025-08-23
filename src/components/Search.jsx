// src/components/Search.jsx

import React, { useState, useEffect, useRef } from 'react';

function Search({ cityLayers, onCitySelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1); // 用于键盘导航
  const [isFocused, setIsFocused] = useState(false); // 用于控制 placeholder
  const searchContainerRef = useRef(null);
  const inputRef = useRef(null);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setActiveIndex(-1); // 重置键盘选择
    if (value.trim()) {
      const matchedCities = Object.keys(cityLayers).filter(name => name.includes(value.trim()));
      setResults(matchedCities);
    } else {
      setResults([]);
    }
  };

  const handleItemClick = (name) => {
    onCitySelect(name);
    setQuery('');
    setResults([]);
    inputRef.current.blur(); // 选择后让输入框失焦
  };

  // --- 【关键】处理键盘事件 ---
  const handleKeyDown = (e) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prevIndex) => (prevIndex + 1) % results.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prevIndex) => (prevIndex - 1 + results.length) % results.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && results[activeIndex]) {
          handleItemClick(results[activeIndex]);
        }
        break;
      case 'Escape':
        setResults([]);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setResults([]);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // --- 【关键】滚动到高亮的选项 ---
  useEffect(() => {
    if (activeIndex >= 0) {
      const activeItem = document.getElementById(`search-item-${activeIndex}`);
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [activeIndex]);

  return (
    <div id="searchContainer" ref={searchContainerRef}>
      <input
        ref={inputRef}
        type="text"
        id="searchInput"
        placeholder={isFocused || query ? '' : '输入市名搜索...'}
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="off"
      />
      {results.length > 0 && (
        <div id="searchResults">
          {results.map((name, index) => (
            <div 
              key={name}
              id={`search-item-${index}`}
              className={`search-item ${index === activeIndex ? 'active' : ''}`}
              onClick={() => handleItemClick(name)}
              onMouseEnter={() => setActiveIndex(index)} // 鼠标悬停同步高亮
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Search;