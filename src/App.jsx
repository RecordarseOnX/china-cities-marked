// src/App.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient';
import useOnClickOutside from './hooks/useOnClickOutside';
import MapComponent from './components/Map';
import Search from './components/Search';
import Stats from './components/Stats';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import './App.css';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import L from 'leaflet'; // 引入 Leaflet 核心库，用于后台截图
import { scaleSequential } from 'd3-scale'; // 截图逻辑也需要
import { interpolateSinebow } from 'd3-scale-chromatic'; // 截图逻辑也需要

function App() {
  // --- 状态管理 ---
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [geojsonData, setGeojsonData] = useState(null);
  const [visitedCities, setVisitedCities] = useState(new Map());
  const [cityLayers, setCityLayers] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentCityData, setCurrentCityData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  
  // --- Refs ---
  const rightColumnRef = useRef();
  useOnClickOutside(rightColumnRef, () => setIsSidebarOpen(false));

  // --- 数据获取与主题应用 ---
  const fetchVisitedCities = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('visited_cities').select('*').eq('user_id', user.id);
      if (error) throw error;
      const cityMap = new Map(data.map(city => [city.city_name, city]));
      setVisitedCities(cityMap);
    } catch (error) { console.error('获取城市数据失败:', error); }
  }, [user]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      fetch('/中国_市.geojson').then(res => res.json()).then(setGeojsonData);
      fetchVisitedCities();
    } else { localStorage.removeItem('user'); }
  }, [user, fetchVisitedCities]);

  // --- 交互处理函数 ---
  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const handleCityClick = (cityName) => {
    const visitedData = visitedCities.get(cityName);
    if (isSidebarOpen && currentCityData && currentCityData.name === cityName) {
      setIsSidebarOpen(false);
    } else {
      setCurrentCityData({ name: cityName, isVisited: !!visitedData, ...visitedData });
      setIsSidebarOpen(true);
    }
  };

  const handleSaveCity = async (payload) => {
    try {
      await supabase.from('visited_cities').upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id, city_name' });
      await fetchVisitedCities();
      handleCityClick(payload.city_name);
    } catch (error) { alert('保存失败: ' + error.message); }
  };
  
  const handleUnmarkCity = async (cityName) => {
    try {
      await supabase.from('visited_cities').delete().match({ user_id: user.id, city_name: cityName });
      await fetchVisitedCities();
      setIsSidebarOpen(false);
    } catch (error) { alert('取消标记失败: ' + error.message); }
  };

  const handleLogout = () => {
    setUser(null);
    setIsSidebarOpen(false);
  };

  // --- 【截图逻辑升级】全新的、完美的地图截图和PDF导出函数 ---
  const handleExportPDF = async () => {
    if (!geojsonData) return alert("地图数据尚未加载，无法导出。");
    
    setIsExporting(true);

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.width = '1200px';
    tempContainer.style.height = '800px';
    document.body.appendChild(tempContainer);

    let mapImageDataUrl;

    try {
      const tempMap = L.map(tempContainer, {
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true
      });

      const lineRgb = theme === 'dark' ? '90, 90, 90' : '163, 168, 175';
      const colorScale = scaleSequential(interpolateSinebow);
      const getColor = (name) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
          hash = name.charCodeAt(i) + ((hash << 5) - hash); hash |= 0;
        }
        return colorScale((Math.abs(hash) % 1000) / 1000);
      };
      const selectedCitiesSet = new Set(visitedCities.keys());

      const geojsonLayer = L.geoJSON(geojsonData, {
        style: (feature) => ({
          color: `rgb(${lineRgb})`,
          weight: 0.6,
          fillOpacity: selectedCitiesSet.has(feature.properties.name) ? 0.6 : 0,
          fillColor: getColor(feature.properties.name)
        })
      }).addTo(tempMap);

      tempMap.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
      
      await new Promise(resolve => setTimeout(resolve, 500)); 

      const canvas = await html2canvas(tempContainer, { useCORS: true, logging: false, backgroundColor: theme === 'dark' ? 'rgb(30, 32, 33)' : 'rgb(247, 247, 247)' });
      mapImageDataUrl = canvas.toDataURL('image/png');
    } catch (error) {
      console.error("地图截图失败:", error);
      alert("地图截图失败，请重试。");
    } finally {
      if (tempContainer) {
        document.body.removeChild(tempContainer);
      }
      // 如果截图失败，确保按钮状态恢复
      if (!mapImageDataUrl) {
          setIsExporting(false);
          return;
      }
    }

    // --- 后续的 PDF 生成逻辑 ---
    try {
      const sortedCities = Array.from(visitedCities.values())
        .filter(city => city.visit_date && city.photo_url)
        .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));
      
      if (sortedCities.length === 0) {
        alert("没有包含日期和照片的已标记城市可供导出。");
        setIsExporting(false);
        return;
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      const fontToBase64 = (url) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        fetch(url).then(res => res.blob()).then(blob => {
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }).catch(reject);
      });

      try {
        const fontBase64 = await fontToBase64('/NotoSansSC-Regular.ttf');
        doc.addFileToVFS('NotoSansSC-Regular.ttf', fontBase64);
        doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');
        doc.setFont('NotoSansSC');
      } catch (e) { console.warn("自定义字体加载失败", e); }

      const addHeaderAndFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(9); doc.setTextColor(150);
          doc.text(`${user.username}的城市足迹`, margin, 10);
          doc.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
      };

      // 封面页
      doc.setFontSize(28); doc.setTextColor(40);
      doc.text("我的城市足迹", pageWidth / 2, 80, { align: 'center' });
      doc.setFontSize(16);
      doc.text(`- ${user.username} -`, pageWidth / 2, 95, { align: 'center' });
      const mapImageProps = doc.getImageProperties(mapImageDataUrl);
      const mapAspectRatio = mapImageProps.width / mapImageProps.height;
      const mapWidth = pageWidth - margin * 2;
      const mapHeight = mapWidth / mapAspectRatio;
      doc.addImage(mapImageDataUrl, 'PNG', margin, 120, mapWidth, mapHeight);
      
      // 内容页
      if (sortedCities.length > 0) {
        doc.addPage();
        let y = margin;
        for (const city of sortedCities) {
          const cityImageProps = await doc.getImageProperties(city.photo_url);
          const imageAspectRatio = cityImageProps.width / cityImageProps.height;
          const imageWidth = pageWidth - margin * 2;
          const imageHeight = imageWidth / imageAspectRatio;
          const itemHeight = 15 + imageHeight;
          if (y + itemHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
          }
          doc.setFontSize(16); doc.setTextColor(40);
          doc.text(city.city_name, margin, y);
          doc.setFontSize(11); doc.setTextColor(100);
          doc.text(city.visit_date, pageWidth - margin, y, { align: 'right' });
          y += 10;
          doc.setDrawColor(230);
          doc.line(margin, y - 2, pageWidth - margin, y - 2);
          doc.addImage(city.photo_url, 'JPEG', margin, y, imageWidth, imageHeight);
          y += imageHeight + 15;
        }
      }

      addHeaderAndFooter(doc);
      doc.save(`${user.username}_城市足迹_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);

    } catch (error) {
      console.error("生成PDF失败:", error);
      alert("生成PDF时发生错误，请检查控制台获取详情。");
    } finally {
      setIsExporting(false);
    }
  };

  if (!user) return <Auth onLoginSuccess={setUser} />;

  return (
    <div id="app-container">
      <MapComponent
        geojsonData={geojsonData}
        selectedCities={new Set(visitedCities.keys())}
        setCityLayers={setCityLayers}
        onCityClick={handleCityClick}
      />
      <div className="ui-top-left-cluster">
        <div className="user-info-bar">
          <span>{user.username}</span>
          <span className="separator">·</span>
          <button onClick={handleExportPDF} className="export-button" disabled={isExporting}>
            {isExporting ? '生成中...' : '导出'}
          </button>
          <button onClick={handleLogout} className="logout-button">退出</button>
        </div>
        <Search cityLayers={cityLayers} onCitySelect={handleCityClick} />
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </div>
      <div className="ui-right-column" ref={rightColumnRef}>
        <Stats
          visitedCount={visitedCities.size}
          totalCount={geojsonData ? geojsonData.features.length : 0}
        />
        <div className={`sidebar-content-wrapper ${isSidebarOpen ? 'open' : ''}`}>
           {currentCityData && (
             <Sidebar
               cityData={currentCityData}
               onSave={handleSaveCity}
               onUnmark={handleUnmarkCity}
             />
           )}
        </div>
      </div>
    </div>
  );
}

export default App;