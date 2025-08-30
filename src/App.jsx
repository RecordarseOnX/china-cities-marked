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
import NotificationModal from './components/NotificationModal';

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
  const [progress, setProgress] = useState(0);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  
  const rightColumnRef = useRef();
  
  // --- 【关键修复】升级 useOnClickOutside 的启用条件 ---
  // 只有当图片弹窗 和 点评弹窗都关闭时，才允许点击外部关闭侧边栏
  useOnClickOutside(
    rightColumnRef, 
    () => setIsSidebarOpen(false), 
    lightboxImage === null && !isCommentModalOpen
  );

  const fetchVisitedCities = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('visited_cities')
        .select(`
          *,
          photos (
            category,
            photo_url
          )
        `)
        .eq('user_id', user.id);
      if (error) throw error;
      const cityMap = new Map(data.map(city => [city.city_name, city]));
      setVisitedCities(cityMap);
    } catch (error) {
      console.error('获取城市数据失败:', error);
      toast.error('获取城市数据失败: ' + error.message);
    }
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
    const isVisited = visitedCities.has(cityName);
    const visitedData = visitedCities.get(cityName);
    const newCityData = {
      ...(visitedData || {}),
      name: cityName,
      isVisited: isVisited,
    };
    
    if (isSidebarOpen && currentCityData && currentCityData.name === cityName) {
      setIsSidebarOpen(false);
    } else {
      setCurrentCityData(newCityData);
      setIsSidebarOpen(true);
    }
  };

  const handleSaveCity = async (cityPayload, photosPayload) => {
    // 步骤0: 先查该城市是否已存在，判断是新增还是更新
    const { data: existing, error: checkError } = await supabase
      .from('visited_cities')
      .select('id')
      .eq('user_id', user.id)
      .eq('city_name', cityPayload.city_name)
      .maybeSingle();

    if (checkError) {
      toast.error("查询城市信息失败: " + checkError.message);
      return;
    }
    const isUpdate = !!existing;

    // 步骤1: 保存或更新城市信息
    const { data: city, error: cityError } = await supabase
      .from('visited_cities')
      .upsert(
        { user_id: user.id, ...cityPayload },
        { onConflict: 'user_id, city_name' }
      )
      .select()
      .single();

    if (cityError) {
      toast.error("保存城市信息失败: " + cityError.message);
      return;
    }

    // 步骤2: 删除该城市所有旧的照片
    const { error: deleteError } = await supabase
      .from('photos')
      .delete()
      .eq('visited_city_id', city.id);

    if (deleteError) {
      toast.error("清理旧照片失败: " + deleteError.message);
      return;
    }

    // 步骤3: 如果有新照片，就插入它们
    if (photosPayload && photosPayload.length > 0) {
      const photosToInsert = photosPayload.map(p => ({
        visited_city_id: city.id,
        category: p.category,
        photo_url: p.photo_url,
      }));
      const { error: insertError } = await supabase
        .from('photos')
        .insert(photosToInsert);

      if (insertError) {
        toast.error("保存新照片失败: " + insertError.message);
        return;
      }
    }

    // 成功提示：根据是新增还是更新来区分
    if (isUpdate) {
      toast.success("更新成功！");
    } else {
      toast.success("标记成功！");
    }

    // 刷新数据 & 更新侧边栏
    await fetchVisitedCities();
    handleCityClick(city.city_name);
  };

  
  const handleUnmarkCity = async (cityName) => {
    const promise = supabase
      .from('visited_cities')
      .delete()
      .match({ user_id: user.id, city_name: cityName });

    toast.promise(promise, {
      loading: '正在取消标记...',
      success: '城市已取消标记，刷新界面完成更新！',
      error: '操作失败，请重试。'
    });

    try {
      await promise;

      // 关闭侧边栏
      setIsSidebarOpen(false);

      // 可选：刷新数据
      fetchVisitedCities();

    } catch (error) {
      console.error("取消标记失败:", error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsSidebarOpen(false);
  };

  const handleExportPDF = async () => {
    if (!window.confirm("您确定要将当前的旅游地图导出为 PDF 吗？")) return;

    setIsExporting(true);
    setProgress(0);

    try {
      if (!geojsonData) throw new Error("地图数据尚未加载");

      const sortedCities = Array.from(visitedCities.values())
        .filter(city => city.photos && city.photos.length > 0)
        .sort((a, b) => {
          const dateA = a.visit_date ? new Date(a.visit_date) : new Date(0);
          const dateB = b.visit_date ? new Date(b.visit_date) : new Date(0);
          return dateB - dateA; // 降序，最近日期在前
        });

      if (sortedCities.length === 0) throw new Error("没有包含照片的已标记城市可供导出");

      // 生成地图封面
      let mapImageDataUrl;
      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position: absolute; left: -9999px; width: 1200px; height: 800px;';
      document.body.appendChild(tempContainer);
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

      // ====== 封面 ======
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

      // ====== 城市详情页 ======
      for (let i = 0; i < sortedCities.length; i++) {
        const city = sortedCities[i];
        doc.addPage();
        let y = margin + headerOffset;

        // 城市名称和日期
        doc.setFontSize(20);
        doc.setTextColor('#1f2937');
        doc.text(city.city_name, margin, y);
        if (city.visit_date) {
          doc.setFontSize(14);
          doc.setTextColor('#1f2937');
          doc.text(city.visit_date, pageWidth - margin, y, { align: 'right' });
        }
        y += 8;

        // 评分
        if (city.rating > 0) {
          doc.setFontSize(14);
          doc.setTextColor('#f59e0b');
          const stars = '★'.repeat(city.rating) + '☆'.repeat(10 - city.rating);
          doc.text(stars, margin, y);
          y += 8;
        }

        // 评论
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

        // 4等分图片网格
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
        await new Promise(res => setTimeout(res, 50)); // 保证 React 渲染
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


  if (!user) {
    return <Auth onLoginSuccess={setUser} />;
  }

  return (
    <div id="app-container">
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { background: 'var(--panel-color)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-md)' } }}/>

      <MapComponent geojsonData={geojsonData} selectedCities={new Set(visitedCities.keys())} setCityLayers={setCityLayers} onCityClick={handleCityClick} colorMode={colorMode}/>

      <div className="ui-top-left-cluster">
        <div className="user-info-bar">
          <span>{user.username}</span>
          <span className="separator">·</span>
          <button onClick={handleLogout} className="logout-button">退出</button>
          <button onClick={handleExportPDF} className="export-button" disabled={isExporting}>
            {isExporting ? '生成中...' : '导出'}
          </button>
          <button onClick={() => setIsNotificationOpen(true)} className="notification-button">
            通知
          </button>
        </div>
        <Search cityLayers={cityLayers} onCitySelect={handleCityClick} />
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} colorMode={colorMode} toggleColorMode={toggleColorMode} />
          {isExporting && (
            <div className="pdf-progress" style={{ marginTop: 8 }}>
              <progress value={progress} max={100} style={{ width: '100%' }} />
              <span>{progress}%</span>
            </div>
          )}
      </div>

      <div className="ui-right-column" ref={rightColumnRef}>
        <Stats visitedCount={visitedCities.size} totalCount={geojsonData ? geojsonData.features.length : 0} />
        <div className={`sidebar-content-wrapper ${isSidebarOpen ? 'open' : ''}`}>
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
        content={`📢 更新公告\n\n1. 优化了标记和更新的反馈，减少卡顿感。\n2. 新增了公告功能，如你所见。\n3. 优化了弹窗的关闭按钮设计。`}
      />

    </div>
  );
}

export default App;