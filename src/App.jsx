// --- 1. Imports ---
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from './supabaseClient';
import useOnClickOutside from './hooks/useOnClickOutside';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import L from 'leaflet';
import toast, { Toaster } from 'react-hot-toast';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';
// 引入 Turf.js
import { centroid } from '@turf/turf';
import { booleanPointInPolygon } from '@turf/turf';
import * as turf from '@turf/turf'; 

// --- 2. 主组件 ---
function App() {
  // --- State 定义 ---
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [visitedCities, setVisitedCities] = useState(new Map());
  const [cityLayers, setCityLayers] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isPanelExpanded, setIsPanelExpanded] = useState(false); // <--- 在这里添加新的 state
  const [currentCityData, setCurrentCityData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentingCity, setCommentingCity] = useState(null);
  const [colorMode, setColorMode] = useState('colorful');
  const [progress, setProgress] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isZoomSwitchEnabled, setIsZoomSwitchEnabled] = useState(true);
  const [mapSvgElement, setMapSvgElement] = useState(null);
  const [isMarkingAll, setIsMarkingAll] = useState(false); // <--- 在这里添加这行代码
  
  // 地图相关 State
  const [cityGeojsonData, setCityGeojsonData] = useState(null);
  const [provinceGeojsonData, setProvinceGeojsonData] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [provinceToCitiesMap, setProvinceToCitiesMap] = useState(new Map());
  
  const rightColumnRef = useRef();

  // --- Hooks & 回调函数 ---
  // useOnClickOutside(rightColumnRef, () => setIsSidebarOpen(false), lightboxImage === null && !isCommentModalOpen);

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

  // 主数据加载和省市映射计算 Effect
  useEffect(() => {
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
      fetchVisitedCities();
      
      Promise.all([
        fetch('/中国_市.geojson').then(res => res.json()),
        fetch('/中国_省.geojson').then(res => res.json())
      ]).then(([cityData, provinceData]) => {
        setCityGeojsonData(cityData);
        setProvinceGeojsonData(provinceData);

        console.log("开始自动计算省市映射关系...");
        const newMap = new Map();
        if (!cityData || !provinceData) return;

        for (const cityFeature of cityData.features) {
          const cityCentroid = centroid(cityFeature);
          for (const provinceFeature of provinceData.features) {
            if (booleanPointInPolygon(cityCentroid, provinceFeature)) {
              const provinceName = provinceFeature.properties.name;
              const cityName = cityFeature.properties.name;
              if (!newMap.has(provinceName)) newMap.set(provinceName, []);
              newMap.get(provinceName).push(cityName);
              break;
            }
          }
        }
        setProvinceToCitiesMap(newMap);
        console.log("映射表构建完成:", newMap);
      });
    } else {
      localStorage.removeItem('user');
    }
  }, [user, fetchVisitedCities]);

  // --- 【核心修改】计算全国统一进度和全局水位线 ---
// App.jsx (大约在第114行)

  // --- 【核心修改】计算全国统一进度、全局水位线，并为每个省份附加其独立的进度信息 ---
// App.jsx (大约在第114行)

  const { globalWaterLat, provinceDataMap } = useMemo(() => {
    if (!provinceGeojsonData?.features || !cityGeojsonData?.features || provinceToCitiesMap.size === 0) {
      return { globalWaterLat: 20, provinceDataMap: new Map() };
    }

    // 1. 为 "全国水位" 模式计算数据
    const totalCitiesInChina = cityGeojsonData.features.length;
    const visitedCitiesCount = visitedCities.size;
    const nationwideProgress = totalCitiesInChina > 0 ? visitedCitiesCount / totalCitiesInChina : 0;
    const START_LAT = 20;
    const NORTHERNMOST_LAT = Math.max(...provinceGeojsonData.features.map(f => turf.bbox(f)[3]));
    const globalWaterLat = START_LAT + nationwideProgress * (NORTHERNMOST_LAT - START_LAT);

    // 2. 为 "独立染色" 模式和 Tooltip 计算数据
    const provinceDataMap = new Map();
    for (const [provinceName, cities] of provinceToCitiesMap.entries()) {
      const cityStatusMap = new Map(cities.map(cityName => [cityName, visitedCities.has(cityName)]));
      const visitedCount = [...cityStatusMap.values()].filter(Boolean).length;
      const totalCount = cityStatusMap.size;
      
      // 计算省份独立的、非线性的进度 ("第一个50%"逻辑)
      let provinceOwnProgress = 0;
      if (visitedCount >= 1) {
        provinceOwnProgress = 0.5;
        if (totalCount > 1) {
          provinceOwnProgress += (visitedCount - 1) / (totalCount - 1) * 0.5;
        }
      }

      // 将两种模式所需的数据都准备好
      provinceDataMap.set(provinceName, {
        cities: cityStatusMap,       // 用于 Tooltip
        progress: provinceOwnProgress, // 用于 "独立染色" 模式
      });
    }

    return { globalWaterLat, provinceDataMap };
    
  }, [visitedCities, cityGeojsonData, provinceGeojsonData, provinceToCitiesMap]);

  const handleMapLoad = useCallback((map) => {
    setMapInstance(map);

    // 正确获取 SVG 容器
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
      setIsPanelExpanded(false); // <--- 点击同一个城市时，收起面板
    } else {
      setCurrentCityData(newCityData);
      setIsSidebarOpen(true);
      setIsPanelExpanded(true); // <--- 点击新城市时，展开面板
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

      // 仅更新 currentCityData 的 comment 和 rating，保留 photos
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
  
  const handleExportPDF = async () => {
    if (!window.confirm("您确定要将当前的旅游地图导出为 PDF 吗？")) return;

    if (!cityGeojsonData || !cityGeojsonData.features?.length) {
      toast.error("地图数据尚未加载或为空，请稍候再试");
      return;
    }

    setIsExporting(true);
    setProgress(0);

    try {
      const sortedCities = Array.from(visitedCities.values())
        .filter(city => city.photos && city.photos.length > 0)
        .sort((a, b) => {
          const dateA = a.visit_date ? new Date(a.visit_date) : new Date(0);
          const dateB = b.visit_date ? new Date(b.visit_date) : new Date(0);
          return dateB - dateA; // 降序
        });

      if (sortedCities.length === 0) throw new Error("没有包含照片的已标记城市可供导出");

      // 生成地图封面
      let mapImageDataUrl;
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 1200px; height: 800px;';
      document.body.appendChild(tempContainer);

      try {
        const tempMap = L.map(tempContainer, { zoomControl: false, attributionControl: false, preferCanvas: true });

        // 颜色处理
        const lineRgb = theme === 'dark' ? '90, 90, 90' : '163, 168, 175';
        const colorScale = scaleSequential(interpolateSinebow);
        const getColor = (name) => {
          let hash = 0;
          for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
            hash |= 0;
          }
          return colorScale((Math.abs(hash) % 1000) / 1000);
        };

        const selectedCitiesSet = new Set(visitedCities.keys());
        const geojsonLayer = L.geoJSON(cityGeojsonData, {
          style: f => ({
            color: `rgb(${lineRgb})`,
            weight: 0.6,
            fillOpacity: selectedCitiesSet.has(f.properties.name) ? 0.6 : 0,
            fillColor: colorMode === 'single' ? '#48cae4' : getColor(f.properties.name)
          })
        }).addTo(tempMap);

        tempMap.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
        await new Promise(res => setTimeout(res, 500));

        const canvas = await html2canvas(tempContainer, {
          useCORS: true,
          logging: false,
          backgroundColor: theme === 'dark' ? 'rgb(30, 32, 33)' : 'rgb(247, 247, 247)'
        });
        mapImageDataUrl = canvas.toDataURL('image/png');
      } finally {
        document.body.removeChild(tempContainer);
      }

      // 创建 PDF
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const headerOffset = 20;
      const contentWidth = pageWidth - margin * 2;
      const safeContentHeight = pageHeight - margin * 2;

      // 加载中文字体
      try {
        const fontResponse = await fetch('/NotoSansSC-Regular.ttf');
        if (fontResponse.ok) {
          const fontBlob = await fontResponse.blob();
          const reader = new FileReader();
          const fontBase64 = await new Promise((res, rej) => {
            reader.onloadend = () => res(reader.result.split(',')[1]);
            reader.onerror = rej;
            reader.readAsDataURL(fontBlob);
          });
          doc.addFileToVFS('NotoSansSC-Regular.ttf', fontBase64);
          doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');
          doc.setFont('NotoSansSC', 'normal');
        }
      } catch (e) {
        console.warn("自定义字体加载失败", e);
      }

      const addHeaderAndFooter = (docInstance) => {
        const pageCount = docInstance.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          docInstance.setPage(i);
          docInstance.setFontSize(9);
          docInstance.setTextColor(150);
          docInstance.text(`${user.username}的城市足迹`, margin, 10);
          docInstance.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth - margin, pageHeight - 10, { align: 'right' });
        }
      };

      // ===== 封面 =====
      doc.setFontSize(28);
      doc.setTextColor(40);
      doc.text("我的城市足迹", pageWidth / 2, 100, { align: 'center' });
      doc.setFontSize(16);
      doc.text(`- ${user.username} -`, pageWidth / 2, 115, { align: 'center' });

      const mapProps = doc.getImageProperties(mapImageDataUrl);
      const mapAspectRatio = mapProps.width / mapProps.height;
      const mapWidth = pageWidth - margin * 2;
      const mapHeight = mapWidth / mapAspectRatio;
      doc.addImage(mapImageDataUrl, 'PNG', margin, 130, mapWidth, mapHeight);

      // ===== 城市详情页 =====
      for (let i = 0; i < sortedCities.length; i++) {
        const city = sortedCities[i];
        doc.addPage();
        let y = margin + headerOffset;

        doc.setFontSize(20);
        doc.setTextColor('#1f2937');
        doc.text(city.city_name, margin, y);

        if (city.visit_date) {
          doc.setFontSize(14);
          doc.setTextColor('#1f2937');
          doc.text(city.visit_date, pageWidth - margin, y, { align: 'right' });
        }
        y += 8;

        if (city.rating > 0) {
          doc.setFontSize(14);
          doc.setTextColor('#f59e0b');
          const stars = '★'.repeat(city.rating) + '☆'.repeat(10 - city.rating);
          doc.text(stars, margin, y);
          y += 8;
        }

        if (city.comment) {
          doc.setFontSize(13);
          doc.setTextColor('#1f2937');
          const commentLines = doc.splitTextToSize(city.comment, contentWidth);
          doc.text(commentLines, margin, y, { lineHeightFactor: 1.5 });
          y += commentLines.length * 5 * 1.1 - 2;
        }

        doc.setDrawColor(230);
        doc.line(margin, y, pageWidth - margin, y);
        y += 5;

        // 图片网格
        if (city.photos && city.photos.length > 0) {
          const gridCols = 2;
          const gridRows = 2;
          const gridWidth = (contentWidth - 5) / gridCols;
          const gridHeight = (safeContentHeight - y - 10) / gridRows;

          for (let j = 0; j < Math.min(city.photos.length, 4); j++) {
            const photo = city.photos[j];
            const props = await doc.getImageProperties(photo.photo_url);
            const imgAspect = props.width / props.height;
            const boxAspect = gridWidth / gridHeight;

            let drawWidth, drawHeight;
            if (imgAspect > boxAspect) {
              drawWidth = gridWidth;
              drawHeight = gridWidth / imgAspect;
            } else {
              drawHeight = gridHeight;
              drawWidth = gridHeight * imgAspect;
            }

            const col = j % gridCols;
            const row = Math.floor(j / gridCols);
            const offsetX = margin + col * (gridWidth + 5) + (gridWidth - drawWidth) / 2;
            const offsetY = y + row * (gridHeight + 5) + (gridHeight - drawHeight) / 2;

            doc.addImage(photo.photo_url, 'JPEG', offsetX, offsetY, drawWidth, drawHeight);
          }
          y += gridHeight * gridRows + 10;
        }

        // 更新进度条
        setProgress(Math.round(((i + 1) / sortedCities.length) * 100));
        await new Promise(res => setTimeout(res, 50));
      }

      addHeaderAndFooter(doc);
      doc.save(`${user.username}_城市足迹_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
      toast.success("PDF已成功生成！");
    } catch (err) {
      console.error(err);
      toast.error("导出失败：" + err.message);
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };


   const handleMarkAllCities = async () => {
    // 安全检查：确保用户已登录、城市数据已加载，并且功能没有在运行中
    if (!user || !cityGeojsonData || isMarkingAll) {
      toast.error("功能尚未准备好或正在操作中。");
      return;
    }

    // 弹窗确认，这是非常重要的一步，防止误操作
    if (!window.confirm("【开发者测试功能】\n\n确定要将全国所有市都标记为“已抵达”吗？")) {
      return;
    }

    // 1. 开始执行，将状态设为“正在标记中”
    setIsMarkingAll(true);

    // 2. 准备要发送到数据库的数据
    //    我们遍历所有城市的地理数据，为每个城市创建一个记录
    const allCitiesPayload = cityGeojsonData.features.map(feature => ({
      user_id: user.id,
      city_name: feature.properties.name,
      visit_date: new Date().toISOString().split('T')[0] // 统一使用今天的日期
    }));

    // 3. 使用 toast.promise 来显示操作进度，用户体验更好
    const promise = supabase.from('visited_cities').upsert(allCitiesPayload, {
      onConflict: 'user_id, city_name' // 如果城市已存在则更新，不存在则插入
    });

    toast.promise(promise, {
      loading: '正在标记全国城市，请稍候...',
      success: '所有城市标记成功！地图即将刷新。',
      error: '标记失败，详情请查看控制台。'
    });

    // 4. 执行数据库操作
    try {
      const { error } = await promise;
      if (error) throw error; // 如果有错误，则抛出
      
      // 操作成功后，调用您已有的 fetchVisitedCities 函数来刷新地图
      await fetchVisitedCities(); 
    } catch (error) {
      console.error("开发者功能“一键标记”失败:", error);
    } finally {
      // 5. 无论成功与否，最后都将状态恢复为“未在标记中”
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
        provinceProgress={provinceDataMap} // <-- 使用新的变量名
        globalWaterLat={globalWaterLat}              // <-- 新增：传递全局水位线
        onMapLoad={handleMapLoad}
        isZoomSwitchEnabled={isZoomSwitchEnabled}
      />

      <div className="ui-top-left-cluster">
        <div className="user-info-bar">
          <span>{user.username}</span>
          <span className="separator">·</span>
          <button onClick={handleLogout} className="logout-button">退出</button>
          <button onClick={handleExportPDF} className="export-button" disabled={isExporting}>
            {isExporting ? '生成中...' : '导出'}
          </button>
          
          {/* 
            【核心修改】
            这是一个条件渲染：只有当登录用户的 username 是 'onxSuisui' 时，
            才会显示这个 "一键标记所有" 的按钮。
          */}
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

          {isExporting && (
            <div className="pdf-progress-container">
              <progress value={progress} max={100} className="pdf-progress-bar" />
              <span className="pdf-progress-text">{progress}%</span>
            </div>
          )}
        </div>
      </div> {/* 关闭 .ui-top-left-cluster */}

            {isSidebarOpen && (
    <div 
      className="ui-right-column modal-mode"
      // 【核心逻辑修复】点击遮罩层时，直接关闭 Sidebar
      onClick={() => setIsSidebarOpen(false)}
    >
      {/* 
        我们将 ref 绑定到内容容器上。
        【核心逻辑修复】点击内容本身时，调用 e.stopPropagation() 
        来阻止事件冒泡到父级遮罩层，防止意外关闭。
      */}
      <div 
        className="modal-content-container" 
        ref={rightColumnRef} 
        onClick={(e) => e.stopPropagation()}
      >
        <Stats
          visitedCount={visitedCities.size}
          totalCount={cityGeojsonData ? cityGeojsonData.features.length : 0}
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
        content={`📢\n- 添加了省级的缩放，可以通过图层按钮关闭\n- 省级也有两套配色，一套水位设计，一套浓度设计\n- 为移动端做了简单的适配...至少可以正常查看了`}
      />
    </div>
  );
}

export default App;