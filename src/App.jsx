// --- 1. Imports ---
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
// import useOnClickOutside from './hooks/useOnClickOutside'; // 如果没用到可以注释掉
import MapComponent from './components/Map';
import Search from './components/Search';
import Stats from './components/Stats';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import ImageModal from './components/ImageModal';
import CommentModal from './components/CommentModal';
import NotificationModal from './components/NotificationModal';
import './App.css';

// --- 移除 PDF 相关库 (jsPDF, html2canvas) ---

import L from 'leaflet';
import toast, { Toaster } from 'react-hot-toast';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';
import * as turf from '@turf/turf'; 

// --- 引入 TopoJSON 转换库 ---
import * as topojson from 'topojson-client';

// --- 2. 主组件 ---
function App() {
  // --- State 定义 ---
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [visitedCities, setVisitedCities] = useState(new Map());
  const [cityLayers, setCityLayers] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false);
  const [currentCityData, setCurrentCityData] = useState(null);
  
  // --- 移除 isExporting 和 progress State ---

  const [lightboxImage, setLightboxImage] = useState(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentingCity, setCommentingCity] = useState(null);
  const [colorMode, setColorMode] = useState('colorful');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isZoomSwitchEnabled, setIsZoomSwitchEnabled] = useState(true);
  const [mapSvgElement, setMapSvgElement] = useState(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  
  // 地图相关 State
  const [cityGeojsonData, setCityGeojsonData] = useState(null);
  const [provinceGeojsonData, setProvinceGeojsonData] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [provinceToCitiesMap, setProvinceToCitiesMap] = useState(new Map());
  
  const rightColumnRef = useRef();

  const fetchVisitedCities = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.from('visited_cities').select(`*, photos (category, photo_url)`).eq('user_id', user.id);
      if (error) throw error;
      const cityMap = new Map(data.map(city => [city.city_name, city]));
      setVisitedCities(cityMap);
    } catch (error) {
      console.error('获取城市数据失败:', error);
      toast.error('获取城市数据失败: ' + error.message);
    }
  }, [user]);

  // --- useEffect Hooks ---
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 主数据加载 (使用 TopoJSON)
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      fetchVisitedCities();
      
      // 【核心修改】加载 TopoJSON 文件
      Promise.all([
        fetch('/中国_市.json').then(res => res.json()), // 确保文件名对应
        fetch('/中国_省.json').then(res => res.json()),
        fetch('/province-city-map.json').then(res => res.json())
      ])
      .then(([cityTopoData, provinceTopoData, provinceCityMapData]) => {
        // --- TopoJSON 转换为 GeoJSON ---
        // 自动获取 objects 中的第一个 key (例如 "china_cities" 或 "map")
        const cityKey = Object.keys(cityTopoData.objects)[0];
        const cityGeoJSON = topojson.feature(cityTopoData, cityTopoData.objects[cityKey]);

        const provinceKey = Object.keys(provinceTopoData.objects)[0];
        const provinceGeoJSON = topojson.feature(provinceTopoData, provinceTopoData.objects[provinceKey]);

        setCityGeojsonData(cityGeoJSON);
        setProvinceGeojsonData(provinceGeoJSON);

        console.log("正在从预计算文件加载省市映射...");
        const newMap = new Map(provinceCityMapData);
        setProvinceToCitiesMap(newMap);
    
        console.log("映射表加载完成:", newMap);
      })
      .catch(error => {
        console.error("加载地图核心数据失败:", error);
        toast.error("加载地图数据失败，请刷新页面重试。");
      });

    } else {
      localStorage.removeItem('user');
    }
  }, [user, fetchVisitedCities]);


  const { globalWaterLat, provinceDataMap } = useMemo(() => {
    if (!provinceGeojsonData?.features || !cityGeojsonData?.features || provinceToCitiesMap.size === 0) {
      return { globalWaterLat: 20, provinceDataMap: new Map() };
    }

    const totalCitiesInChina = new Set(cityGeojsonData.features.map(f => f.properties.name)).size;
    const visitedCitiesCount = visitedCities.size;
    const nationwideProgress = totalCitiesInChina > 0 ? visitedCitiesCount / totalCitiesInChina : 0;
    const START_LAT = 20;
    // 使用 turf 计算 bbox
    const NORTHERNMOST_LAT = Math.max(...provinceGeojsonData.features.map(f => turf.bbox(f)[3]));
    const globalWaterLat = START_LAT + nationwideProgress * (NORTHERNMOST_LAT - START_LAT);

    const provinceDataMap = new Map();
    for (const [provinceName, cities] of provinceToCitiesMap.entries()) {
      const cityStatusMap = new Map(cities.map(cityName => [cityName, visitedCities.has(cityName)]));
      const visitedCount = [...cityStatusMap.values()].filter(Boolean).length;
      const totalCount = cityStatusMap.size;
      
      let provinceOwnProgress = 0;
      if (totalCount > 0) {
        if (totalCount === 1 && visitedCount === 1) {
          provinceOwnProgress = 1; 
        } 
        else if (visitedCount >= 1) {
          provinceOwnProgress = 0.5;
          if (totalCount > 1) {
            provinceOwnProgress += (visitedCount - 1) / (totalCount - 1) * 0.5;
          }
        }
      }

      provinceDataMap.set(provinceName, {
        cities: cityStatusMap,
        progress: provinceOwnProgress,
      });
    }

    return { globalWaterLat, provinceDataMap };
    
  }, [visitedCities, cityGeojsonData, provinceGeojsonData, provinceToCitiesMap]);

  const handleMapLoad = useCallback((map) => {
    setMapInstance(map);
    const svg = map.getPanes().overlayPane.querySelector('svg');
    if (svg) setMapSvgElement(svg);
  }, []);

  // --- 事件处理器 ---
  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  const toggleColorMode = () => setColorMode(prev => (prev === 'colorful' ? 'single' : 'colorful'));
  const toggleZoomSwitch = () => {
    setIsZoomSwitchEnabled(prev => !prev);
  };

  const handleProvinceClick = (provinceFeature) => {
    if (!mapInstance) return;
    const provinceLayer = L.geoJSON(provinceFeature);
    const bounds = provinceLayer.getBounds();
    mapInstance.flyToBounds(bounds, { padding: [50, 50] });
  };
  
  const handleSearchSelect = (cityName) => {
    const cityLayer = cityLayers[cityName];
    if (cityLayer && mapInstance) {
      mapInstance.flyToBounds(cityLayer.getBounds(), { maxZoom: 8 });
    }
    handleCityClick(cityName);
  };

  const handleCityClick = (cityName) => {
    const isVisited = visitedCities.has(cityName);
    const visitedData = visitedCities.get(cityName);
    const newCityData = { ...(visitedData || {}), name: cityName, isVisited };
    if (isSidebarOpen && currentCityData?.name === cityName) {
      setIsSidebarOpen(false);
      setIsPanelExpanded(false);
    } else {
      setCurrentCityData(newCityData);
      setIsSidebarOpen(true);
      setIsPanelExpanded(true);
    }
  };

  const handleSaveCity = async (cityPayload, photosPayload) => {
    const { data: existing } = await supabase.from('visited_cities').select('id').eq('user_id', user.id).eq('city_name', cityPayload.city_name).maybeSingle();
    const { data: city, error: cityError } = await supabase.from('visited_cities').upsert({ user_id: user.id, ...cityPayload }, { onConflict: 'user_id, city_name' }).select().single();
    if (cityError) return toast.error("保存城市信息失败: " + cityError.message);
    await supabase.from('photos').delete().eq('visited_city_id', city.id);
    if (photosPayload && photosPayload.length > 0) {
      const photosToInsert = photosPayload.map(p => ({ visited_city_id: city.id, category: p.category, photo_url: p.photo_url }));
      const { error: insertError } = await supabase.from('photos').insert(photosToInsert);
      if (insertError) return toast.error("保存新照片失败: " + insertError.message);
    }
    toast.success(existing ? "更新成功！" : "标记成功！");
    await fetchVisitedCities();
    handleCityClick(city.city_name);
  };
  
  const handleUnmarkCity = async (cityName) => {
    const promise = supabase.from('visited_cities').delete().match({ user_id: user.id, city_name: cityName });
    toast.promise(promise, { loading: '正在取消标记...', success: '城市已取消标记！', error: '操作失败，请重试。'});
    await promise;
    setIsSidebarOpen(false);
    fetchVisitedCities();
  };

  const handleLogout = () => { setUser(null); setIsSidebarOpen(false); };
  const handleImageClick = (src) => setLightboxImage(src);
  const handleCloseLightbox = () => setLightboxImage(null);
  const handleCommentClick = (city) => { setCommentingCity(city); setIsCommentModalOpen(true); };
  const handleCloseCommentModal = () => { setIsCommentModalOpen(false); setCommentingCity(null); };
  
  const handleSaveComment = async (cityName, comment, rating) => {
    if (!user) return;

    const payload = {
      user_id: user.id,
      city_name: cityName,
      comment: comment || null,
      rating: rating ? Number(rating) : 0
    };

    try {
      const { error } = await supabase
        .from('visited_cities')
        .upsert(payload, { onConflict: 'user_id, city_name' });

      if (error) throw error;

      setCurrentCityData(prev => prev && prev.name === cityName ? {
        ...prev,
        comment: comment || prev.comment,
        rating: rating ? Number(rating) : prev.rating
      } : prev);

      toast.success('点评已保存！');
    } catch (err) {
      console.error("保存点评失败:", err);
      toast.error("保存点评失败: " + err.message);
    }
  };
  
  // --- 移除 handleExportPDF 函数 ---

  // 延迟函数
  const delay = ms => new Promise(res => setTimeout(res, ms));

  // 一键标记所有城市
  const handleMarkAllCities = async () => {
    if (!user || !cityGeojsonData || !cityGeojsonData.features || isMarkingAll) {
      toast.error("数据尚未准备好或正在操作中。");
      return;
    }
    if (!window.confirm("【开发者测试功能】\n\n确定要将全国所有市都标记为“已抵达”吗？\n这将是一个缓慢的过程，请保持页面开启。")) {
      return;
    }

    setIsMarkingAll(true);
    toast.loading('开始标记所有城市...');

    const allCities = cityGeojsonData.features;
    const totalCities = allCities.length;
    let markedCount = 0;

    try {
      for (const feature of allCities) {
        const cityName = feature.properties.name;
        
        const singleCityPayload = {
          user_id: user.id,
          city_name: cityName,
          visit_date: new Date().toISOString().split('T')[0]
        };

        const { error } = await supabase
          .from('visited_cities')
          .upsert(singleCityPayload, { onConflict: 'user_id, city_name' });
        
        if (error) {
          console.error(`标记城市 "${cityName}" 失败:`, error);
          throw new Error(`标记城市 "${cityName}" 时出错`);
        }

        markedCount++;
        toast.loading(`标记中 (${markedCount}/${totalCities}): ${cityName}`);
        await delay(50); 
      }
      
      await fetchVisitedCities();
      toast.success('所有城市标记成功！地图已刷新。');

    } catch (error) {
      console.error("一键标记失败:", error);
      toast.error(`操作中断: ${error.message || '请检查控制台获取详情。'}`);
    } finally {
      setIsMarkingAll(false);
    }
  };


  if (!user) {
    return <Auth onLoginSuccess={setUser} />;
  }

  return (
    <div id="app-container">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--panel-color)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-md)',
          },
        }}
      />
      <MapComponent
        cityGeojsonData={cityGeojsonData}
        provinceGeojsonData={provinceGeojsonData}
        selectedCities={new Set(visitedCities.keys())}
        setCityLayers={setCityLayers}
        onCityClick={handleCityClick}
        onProvinceClick={handleProvinceClick}
        colorMode={colorMode}
        provinceProgress={provinceDataMap}
        globalWaterLat={globalWaterLat}
        onMapLoad={handleMapLoad}
        isZoomSwitchEnabled={isZoomSwitchEnabled}
      />

      <div className="ui-top-left-cluster">
        <div className="user-info-bar">
          <span>{user.username}</span>
          <span className="separator">·</span>
          <button onClick={handleLogout} className="logout-button">退出</button>
          {/* 移除导出按钮 */}
          
          {user && user.username === 'onxSuisui' && (
            <button onClick={handleMarkAllCities} className="test-button" disabled={isMarkingAll}>
              {isMarkingAll ? '标记中...' : '一键标记所有'}
            </button>
          )}

          <button onClick={() => setIsNotificationOpen(true)} className="notification-button">
            通知
          </button>
        </div>

        <Search cityLayers={cityLayers} onCitySelect={handleSearchSelect} />

        <div className="theme-title-container">
          <ThemeToggle
            theme={theme}
            toggleTheme={toggleTheme}
            colorMode={colorMode}
            toggleColorMode={toggleColorMode}
            isZoomSwitchEnabled={isZoomSwitchEnabled}
            toggleZoomSwitch={toggleZoomSwitch}
          />
          <span className="inline-title">因为路就在脚下</span>
          
          {/* 移除进度条显示 */}
        </div>
      </div> 

      {isSidebarOpen && (
        <div 
          className="ui-right-column modal-mode"
          onClick={() => setIsSidebarOpen(false)}
        >
          <div 
            className="modal-content-container" 
            ref={rightColumnRef} 
            onClick={(e) => e.stopPropagation()}
          >
            <Stats
              visitedCount={visitedCities.size}
              totalCount={
                cityGeojsonData 
                ? new Set(cityGeojsonData.features.map(f => f.properties.name)).size 
                : 0
              }
            />
            <div className="sidebar-content-wrapper open">
              {currentCityData && (
                <Sidebar
                  key={currentCityData.name}
                  cityData={currentCityData}
                  onSave={handleSaveCity}
                  onUnmark={handleUnmarkCity}
                  onImageClick={handleImageClick}
                  onCommentClick={handleCommentClick}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {lightboxImage && <ImageModal src={lightboxImage} onClose={handleCloseLightbox} />}
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={handleCloseCommentModal}
        cityData={commentingCity}
        onSave={handleSaveComment}
      />
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        content={`📢\n- 优化了数据加载速度 (TopoJSON)\n- 优化了数据源\n- 去掉了无趣的导出功能`}
      />
    </div>
  );
}

export default App;