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
import ImageModal from './components/ImageModal';
import CommentModal from './components/CommentModal';
import './App.css';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import L from 'leaflet';
import { scaleSequential } from 'd3-scale';
import { interpolateSinebow } from 'd3-scale-chromatic';

import toast, { Toaster } from 'react-hot-toast';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user')));
  const [geojsonData, setGeojsonData] = useState(null);
  const [visitedCities, setVisitedCities] = useState(new Map());
  const [cityLayers, setCityLayers] = useState({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentCityData, setCurrentCityData] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lightboxImage, setLightboxImage] = useState(null);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentingCity, setCommentingCity] = useState(null);
  const [colorMode, setColorMode] = useState('colorful');
  
  const rightColumnRef = useRef();
  useOnClickOutside(
    rightColumnRef, 
    () => setIsSidebarOpen(false), 
    lightboxImage === null && !isCommentModalOpen
  );

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

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const toggleColorMode = () => {
    setColorMode(prevMode => (prevMode === 'colorful' ? 'single' : 'colorful'));
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
    const isUpdating = visitedCities.has(payload.city_name);
    const promise = supabase.from('visited_cities').upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id, city_name' }).select().single();
    toast.promise(promise, { loading: '正在保存...', success: isUpdating ? '更新成功！' : '标记成功！', error: '保存失败，请重试。' });
    try {
      const { data } = await promise;
      await fetchVisitedCities();
      setCurrentCityData({ name: data.city_name, isVisited: true, ...data });
    } catch (error) { console.error("保存失败:", error); }
  };
  
  const handleUnmarkCity = async (cityName) => {
    const promise = supabase.from('visited_cities').delete().match({ user_id: user.id, city_name: cityName });
    toast.promise(promise, { loading: '正在取消标记...', success: '已取消标记！', error: '操作失败，请重试。' });
    try {
      await promise;
      await fetchVisitedCities();
      setIsSidebarOpen(false);
    } catch (error) { console.error("取消标记失败:", error); }
  };

  const handleLogout = () => {
    setUser(null);
    setIsSidebarOpen(false);
  };

  const handleExportPDF = () => {
    if (window.confirm("您确定要将当前的旅游地图导出为 PDF 吗？")) {
      setIsExporting(true);
      const exportPromise = new Promise(async (resolve, reject) => {
        try {
          if (!geojsonData) return reject(new Error("地图数据尚未加载"));
          const sortedCities = Array.from(visitedCities.values()).filter(c => c.photo_url).sort((a,b) => (new Date(a.visit_date || 0)) - (new Date(b.visit_date || 0)));
          if (sortedCities.length === 0) return reject(new Error("没有包含照片的已标记城市可供导出"));
          
          let mapImageDataUrl;
          const tempContainer = document.createElement('div');
          tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 1200px; height: 800px;';
          document.body.appendChild(tempContainer);
          try {
            const tempMap = L.map(tempContainer, { zoomControl: false, attributionControl: false, preferCanvas: true });
            const lineRgb = theme === 'dark' ? '90, 90, 90' : '163, 168, 175';
            const colorScale = scaleSequential(interpolateSinebow);
            const getColor = (name) => {
              let hash = 0; for(let i=0; i<name.length; i++) { hash = name.charCodeAt(i) + ((hash << 5) - hash); hash |= 0; }
              return colorScale((Math.abs(hash) % 1000) / 1000);
            };
            const selectedCitiesSet = new Set(visitedCities.keys());
            const geojsonLayer = L.geoJSON(geojsonData, { style: f => ({ color: `rgb(${lineRgb})`, weight: 0.6, fillOpacity: selectedCitiesSet.has(f.properties.name) ? 0.6 : 0, fillColor: colorMode === 'single' ? '#48cae4' : getColor(f.properties.name) }) }).addTo(tempMap);
            tempMap.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
            await new Promise(res => setTimeout(res, 500));
            const canvas = await html2canvas(tempContainer, { useCORS: true, logging: false, backgroundColor: theme === 'dark' ? 'rgb(30, 32, 33)' : 'rgb(247, 247, 247)' });
            mapImageDataUrl = canvas.toDataURL('image/png');
          } finally {
            document.body.removeChild(tempContainer);
          }

          const doc = new jsPDF('p', 'mm', 'a4');
          const pageWidth = doc.internal.pageSize.getWidth();
          const pageHeight = doc.internal.pageSize.getHeight();
          const margin = 15;
          const contentWidth = pageWidth - margin * 2;
          
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
          } catch(e) { console.warn("自定义字体加载失败", e); }
          
          const addHeaderAndFooter = () => {
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9); doc.setTextColor(150);
                doc.text(`${user.username}的城市足迹`, margin, 10);
                doc.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth - margin, pageHeight - 10, { align: 'right' });
            }
          };
          
          doc.setFontSize(28); doc.setTextColor(40);
          doc.text("我的城市足迹", pageWidth/2, 80, {align: 'center'});
          doc.setFontSize(16);
          doc.text(`- ${user.username} -`, pageWidth/2, 95, {align: 'center'});
          const mapProps = doc.getImageProperties(mapImageDataUrl);
          const mapAspectRatio = mapProps.width / mapProps.height;
          const mapWidth = pageWidth - margin * 2;
          const mapHeight = mapWidth / mapAspectRatio;
          doc.addImage(mapImageDataUrl, 'PNG', margin, 120, mapWidth, mapHeight);
          
          if (sortedCities.length > 0) {
            doc.addPage();
            let y = margin;
            for (const city of sortedCities) {
              const leftColumnWidth = contentWidth * 0.45;
              const rightColumnWidth = contentWidth * 0.5;
              const gap = contentWidth * 0.05;
              const cityImageProps = await doc.getImageProperties(city.photo_url);
              const imageAspectRatio = cityImageProps.width / cityImageProps.height;
              const imageHeight = leftColumnWidth / imageAspectRatio;
              doc.setFontSize(11);
              const commentLines = city.comment ? doc.splitTextToSize(city.comment, rightColumnWidth) : [];
              const textHeight = (city.visit_date ? 8 : 0) + (city.rating > 0 ? 8 : 0) + (commentLines.length * 5) + 12;
              const itemHeight = Math.max(imageHeight, textHeight) + 15;
              if (y + itemHeight > pageHeight - margin) {
                doc.addPage();
                y = margin;
              }
              doc.addImage(city.photo_url, 'JPEG', margin, y, leftColumnWidth, imageHeight);
              const textX = margin + leftColumnWidth + gap;
              let textY = y;
              doc.setFontSize(20); doc.setTextColor('#1f2937');
              doc.text(city.city_name, textX, textY + 6); 
              textY += 12;
              if (city.visit_date) {
                doc.setFontSize(10); doc.setTextColor('#6b7280');
                doc.text(city.visit_date, textX, textY);
                textY += 8;
              }
              if (city.rating > 0) {
                doc.setFontSize(14); doc.setTextColor('#f59e0b');
                const stars = '★'.repeat(city.rating) + '☆'.repeat(10 - city.rating);
                doc.text(stars, textX, textY);
                textY += 8;
              }
              if (city.comment) {
                doc.setFontSize(11); doc.setTextColor('#374151');
                doc.text(commentLines, textX, textY, { lineHeightFactor: 1.5 });
              }
              y += itemHeight;
            }
          }

          addHeaderAndFooter(doc);
          doc.save(`${user.username}_城市足迹_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
          resolve("PDF已成功生成并开始下载！");
        } catch(e) {
          reject(e);
        }
      }).finally(() => {
        setIsExporting(false);
      });
      toast.promise(exportPromise, { loading: '正在生成PDF...', success: (msg) => msg, error: (err) => `导出失败: ${err.message}` });
    }
  };

  const handleImageClick = (src) => setLightboxImage(src);
  const handleCloseLightbox = () => setLightboxImage(null);
  
  const handleCommentClick = (city) => {
    setCommentingCity(city);
    setIsCommentModalOpen(true);
  };
  const handleCloseCommentModal = () => {
    setIsCommentModalOpen(false);
    setCommentingCity(null);
  };
  
  // 【关键修复】更新保存点评函数，实现即时刷新
// 保存点评（评论 + 评分）
const handleSaveComment = async (cityName, comment, rating) => {
  // 先检查这座城市在 visitedCities 里是否已有记录
  const existingCityData =
    visitedCities.get(cityName) || { city_name: cityName, user_id: user.id };

  // 组装写入数据库的 payload
  const payload = {
    ...existingCityData,
    comment,
    rating,
  };

  // 调用 Supabase upsert：存在则更新，不存在则插入
  const promise = supabase
    .from("visited_cities")
    .upsert(payload, { onConflict: "user_id, city_name" })
    .select()
    .single();

  // toast 提示保存进度和结果
  toast.promise(promise, {
    loading: "正在保存点评...",
    success: "点评已保存！",
    error: "保存失败，请重试。",
  });

  try {
    const { data } = await promise;

    // 1. 更新全局的 visitedCities Map
    setVisitedCities((prev) => new Map(prev).set(cityName, data));

    // 2. 如果侧边栏正在显示的就是当前城市，则更新它的数据
    setCurrentCityData((prev) =>
      prev && prev.name === cityName ? { ...prev, ...data, isVisited: true } : prev
    );

    // 3. 如果点评弹窗里正好是当前城市，则同步更新它的数据
    setCommentingCity((prev) =>
      prev && prev.name === cityName ? { ...prev, ...data } : prev
    );
  } catch (error) {
    console.error("保存点评失败:", error);
  }
};


  if (!user) return <Auth onLoginSuccess={setUser} />;

  return (
    <div id="app-container">
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: 'var(--panel-color)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' } }}/>
      <MapComponent geojsonData={geojsonData} selectedCities={new Set(visitedCities.keys())} setCityLayers={setCityLayers} onCityClick={handleCityClick} colorMode={colorMode}/>
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
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} colorMode={colorMode} toggleColorMode={toggleColorMode} />
      </div>
      <div className="ui-right-column" ref={rightColumnRef}>
        <Stats visitedCount={visitedCities.size} totalCount={geojsonData ? geojsonData.features.length : 0} />
        <div className={`sidebar-content-wrapper ${isSidebarOpen ? 'open' : ''}`}>
           {currentCityData && (
             <Sidebar
               cityData={currentCityData}
               onSave={handleSaveCity}
               onUnmark={handleUnmarkCity}
               onImageClick={handleImageClick}
               onCommentClick={handleCommentClick}
             />
           )}
        </div>
      </div>
      {lightboxImage && <ImageModal src={lightboxImage} onClose={handleCloseLightbox} />}
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={handleCloseCommentModal}
        cityData={commentingCity}
        onSave={handleSaveComment}
      />
    </div>
  );
}

export default App;