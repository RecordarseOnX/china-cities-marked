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

  const toggleColorMode = () => {
  setColorMode(prevMode => (prevMode === 'colorful' ? 'single' : 'colorful'));};

  const [colorMode, setColorMode] = useState('colorful'); // 'colorful' or 'single'

  const rightColumnRef = useRef();
  // 【关键】只有当图片放大弹窗未打开时，才启用侧边栏的“点击外部关闭”功能
  useOnClickOutside(rightColumnRef, () => setIsSidebarOpen(false), lightboxImage === null);
  

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
    const promise = supabase.from('visited_cities').upsert({ user_id: user.id, ...payload }, { onConflict: 'user_id, city_name' });
    toast.promise(promise, { loading: '正在保存...', success: isUpdating ? '更新成功！' : '标记成功！', error: '保存失败，请重试。' });
    try {
      await promise;
      await fetchVisitedCities();
      handleCityClick(payload.city_name);
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

    // 3. 新增用于处理点评的函数
  const handleCommentClick = (city) => {
    setCommentingCity(city);
    setIsCommentModalOpen(true);
  };

  const handleCloseCommentModal = () => {
    setIsCommentModalOpen(false);
    setCommentingCity(null);
  };

  const handleSaveComment = async (cityName, comment, rating) => {
      const promise = supabase
        .from('visited_cities')
        .update({ comment: comment, rating: rating }) // 同时更新 comment 和 rating
        .match({ user_id: user.id, city_name: cityName });

      toast.promise(promise, {
        loading: '正在保存...',
        success: '已保存！',
        error: '保存失败，请重试。'
      });

      try {
        await promise;
        await fetchVisitedCities();
      } catch (error) {
        console.error("保存点评失败:", error);
      }
  };


const handleExportPDF = () => {
  if (!window.confirm("您确定要将当前的旅游地图导出为 PDF 吗？")) return;

  setIsExporting(true);

  const exportPromise = new Promise(async (resolve, reject) => {
    try {
      if (!geojsonData) return reject(new Error("地图数据尚未加载"));

      const sortedCities = Array.from(visitedCities.values())
        .filter(c => c.visit_date && c.photo_url)
        .sort((a, b) => new Date(a.visit_date) - new Date(b.visit_date));

      if (sortedCities.length === 0) return reject(new Error("没有包含日期和照片的城市可供导出"));

      // 创建临时地图容器
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 1200px; height: 800px;';
      document.body.appendChild(tempContainer);

      let mapImageDataUrl;

      try {
        const tempMap = L.map(tempContainer, { zoomControl: false, attributionControl: false, preferCanvas: true });
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
        const geojsonLayer = L.geoJSON(geojsonData, {
          style: f => ({
            color: `rgb(${lineRgb})`,
            weight: 0.6,
            fillOpacity: selectedCitiesSet.has(f.properties.name) ? 0.6 : 0,
            fillColor: getColor(f.properties.name)
          })
        }).addTo(tempMap);

        tempMap.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
        await new Promise(res => setTimeout(res, 500));

        const canvas = await html2canvas(tempContainer, {
          useCORS: true,
          logging: false,
          backgroundColor: theme === 'dark' ? 'rgb(30,32,33)' : 'rgb(247,247,247)'
        });

        mapImageDataUrl = canvas.toDataURL('image/png');
      } finally {
        document.body.removeChild(tempContainer);
      }

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;

      try {
        const fontResponse = await fetch('/NotoSansSC-Regular.ttf');
        if (fontResponse.ok) {
          const font = await fontResponse.arrayBuffer();
          const fontBase64 = btoa(new Uint8Array(font).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          doc.addFileToVFS('NotoSansSC-Regular.ttf', fontBase64);
          doc.addFont('NotoSansSC-Regular.ttf', 'NotoSansSC', 'normal');
          doc.setFont('NotoSansSC');
        }
      } catch (e) {
        console.warn("字体加载失败", e);
      }

      const addHeaderAndFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(9); doc.setTextColor(150);
          doc.text(`${user.username}的城市足迹`, margin, 10);
          doc.text(`第 ${i} 页 / 共 ${pageCount} 页`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
      };

      // 首页
      doc.setFontSize(28); doc.setTextColor(40);
      doc.text("我的城市足迹", pageWidth / 2, 80, { align: 'center' });
      doc.setFontSize(16);
      doc.text(`- ${user.username} -`, pageWidth / 2, 95, { align: 'center' });

      const mapProps = doc.getImageProperties(mapImageDataUrl);
      doc.addImage(mapImageDataUrl, 'PNG', margin, 120, pageWidth - margin * 2, (pageWidth - margin * 2) * mapProps.height / mapProps.width);

      // 城市照片
      if (sortedCities.length > 0) {
        doc.addPage();
        let y = margin;
        for (const city of sortedCities) {
          const imgProps = await doc.getImageProperties(city.photo_url);
          const imgHeight = (pageWidth - margin * 2) * imgProps.height / imgProps.width;
          if (y + 15 + imgHeight > doc.internal.pageSize.getHeight() - margin) {
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
          doc.addImage(city.photo_url, 'JPEG', margin, y, pageWidth - margin * 2, imgHeight);
          y += imgHeight + 15;
        }
      }

      addHeaderAndFooter();
      doc.save(`${user.username}_城市足迹_${new Date().toLocaleDateString().replace(/\//g, '-')}.pdf`);
      resolve("PDF已成功生成并开始下载！");
    } catch (e) {
      reject(e);
    } finally {
      setIsExporting(false);
    }
  });

  toast.promise(exportPromise, {
    loading: '正在生成PDF...',
    success: msg => msg,
    error: err => `导出失败: ${err.message}`
  });
};

  const handleImageClick = (src) => setLightboxImage(src);
  const handleCloseLightbox = () => setLightboxImage(null);



  if (!user) {
    return <Auth onLoginSuccess={setUser} />;
  }

 return (
    <div id="app-container">
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: 'var(--panel-color)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' } }}/>

      <MapComponent
        geojsonData={geojsonData}
        selectedCities={new Set(visitedCities.keys())}
        setCityLayers={setCityLayers}
        onCityClick={handleCityClick}
        colorMode={colorMode} // 传递颜色模式
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
        <ThemeToggle 
          theme={theme} 
          toggleTheme={toggleTheme} 
          colorMode={colorMode}
          toggleColorMode={toggleColorMode}
        />
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
               onCommentClick={handleCommentClick} // 4. 将触发函数传递给 Sidebar
             />
           )}
        </div>
      </div>
      {lightboxImage && <ImageModal src={lightboxImage} onClose={handleCloseLightbox} />}
      <CommentModal
        isOpen={isCommentModalOpen}
        onClose={handleCloseCommentModal}
        cityData={commentingCity}
        onSave={handleSaveComment} // 函数名改为 onSave
      />

    </div>
  );
}

export default App;