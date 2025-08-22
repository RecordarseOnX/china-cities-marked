// src/components/Search.jsx

import React, { useState, useEffect, useRef } from 'react';

function Search({ cityLayers, onCitySelect }) {
  // state 用于管理输入框的文本
  const [query, setQuery] = useState('');
  // state 用于管理匹配到的城市列表
  const [results, setResults] = useState([]);
  
  // ref 用于获取搜索组件最外层容器的引用，以便处理外部点击
  const searchContainerRef = useRef(null);

  // 当输入框内容变化时触发
  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    // 如果输入内容不为空，则筛选城市
    if (value.trim()) {
      const matchedCities = Object.keys(cityLayers).filter(name => name.includes(value.trim()));
      setResults(matchedCities);
    } else {
      // 如果输入为空，则清空结果
      setResults([]);
    }
  };

  // 当点击下拉列表中的某一项时触发
  const handleItemClick = (name) => {
    // 调用从 App.jsx 传入的 onCitySelect 函数，这会打开侧边栏
    onCitySelect(name);
    // 清空搜索框并隐藏结果列表
    setQuery('');
    setResults([]);
  };
  
  // 这个 useEffect 用于处理“点击空白区域关闭搜索结果”的逻辑
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setResults([]);
      }
    };
    // 添加事件监听
    document.addEventListener('mousedown', handleClickOutside);
    // 组件卸载时移除事件监听，防止内存泄漏
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    // 将 ref 附加到最外层容器上
    <div id="searchContainer" ref={searchContainerRef}>
      <input
        type="text"
        id="searchInput"
        placeholder="输入市名搜索..."
        value={query}
        onChange={handleInputChange}
        autoComplete="off"
      />
      {/* 只有当有搜索结果时，才渲染下拉列表 */}
      {results.length > 0 && (
        <div id="searchResults">
          {results.map(name => (
            <div 
              key={name} 
              className="search-item" 
              onClick={() => handleItemClick(name)}
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