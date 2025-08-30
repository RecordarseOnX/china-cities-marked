// Sidebar.jsx
import React, { useState, useEffect } from 'react';
import DatePicker from './DatePicker';
import './Sidebar.css'; 

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);
const CommentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

const PHOTO_CATEGORIES = [
  { id: 'scenery', name: '风景', icon: '/icons/scenery.svg' },
  { id: 'friends', name: '朋友', icon: '/icons/friends.svg' },
  { id: 'food', name: '美食', icon: '/icons/food.svg' },
  { id: 'lover', name: '恋人', icon: '/icons/lover.svg' },
];

function Sidebar({ cityData, onSave, onUnmark, onImageClick, onCommentClick }) {
  const [visitDate, setVisitDate] = useState('');
  const [photos, setPhotos] = useState({});

  const [activeCategory, setActiveCategory] = useState('scenery');
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (cityData) {
      setVisitDate(cityData.visit_date || new Date().toISOString().split('T')[0]);
      setPhotos(prev => {
        if (!prev || Object.keys(prev).length === 0 || cityData.name !== prev.cityName) {
          const photosObject = (cityData.photos || []).reduce((acc, photo) => {
            acc[photo.category] = { url: photo.photo_url, file: null };
            return acc;
          }, {});
          return { ...photosObject, cityName: cityData.name };
        }
        return prev;
      });
      setActiveCategory('scenery');
    }
  }, [cityData]);

  const handleFileChange = (file) => {
    if (file && file.type.startsWith('image/')) {
      setPhotos(prev => ({
        ...prev,
        [activeCategory]: { ...prev[activeCategory], file: file }
      }));
    }
  };

  const handleSave = async () => {
    setIsUploading(true);
    let finalPhotos = { ...photos };

    for (const category of PHOTO_CATEGORIES) {
      const catId = category.id;
      if (finalPhotos[catId] && finalPhotos[catId].file) {
        const formData = new FormData();
        formData.append('file', finalPhotos[catId].file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append('folder', 'city');
        try {
          const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
          const data = await response.json();
          if (data.secure_url) {
            finalPhotos[catId] = { url: data.secure_url, file: null };
          } else {
            throw new Error(data.error?.message || `“${category.name}”图片上传失败`);
          }
        } catch (error) {
          toast.error(error.message);
          setIsUploading(false);
          return;
        }
      }
    }

    const photosToSave = Object.entries(finalPhotos)
      .filter(([_, photo]) => photo && photo.url)
      .map(([category, photo]) => ({ category, photo_url: photo.url }));

    try {
      await onSave(
        { city_name: cityData.name, visit_date: visitDate || null },
        photosToSave
      );
    } finally {
      setIsUploading(false); // 确保保存后再恢复
    }
  };

  
  const handleUnmarkCity = () => {
    if (window.confirm(`确定要取消标记城市 "${cityData.name}" 吗？`)) {
      onUnmark(cityData.name);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files && e.dataTransfer.files[0]) { handleFileChange(e.dataTransfer.files[0]); } };
  
  if (!cityData) return null;

  const currentPhoto = photos[activeCategory];
  const imageSourceForDisplay = currentPhoto?.file ? URL.createObjectURL(currentPhoto.file) : currentPhoto?.url;
  const getOriginalCloudinaryUrl = (url) => {
    if (!url || !url.includes('/upload/')) return url;
    const parts = url.split('/upload/');
    const publicIdWithVersion = parts[1].substring(parts[1].indexOf('v'));
    return `${parts[0]}/upload/${publicIdWithVersion}`;
  };
  const imageSourceForLightbox = currentPhoto?.file ? URL.createObjectURL(currentPhoto.file) : getOriginalCloudinaryUrl(currentPhoto?.url);

  return (
    <>
      <div className="sidebar-header">
        <h3>{cityData.name}</h3>
        <button onClick={() => onCommentClick(cityData)} className="comment-button" aria-label="添加或编辑点评">点评&nbsp;<CommentIcon /></button>
      </div>
      <div className="sidebar-body">
        <div className="form-group">
          <label>初次到达时间</label>
          <DatePicker value={visitDate} onChange={setVisitDate} />
        </div>

        <div className="form-group">
          <div className="photo-header">
            <label>照片 (4:3)</label>
            <div className="photo-category-tabs">
              {PHOTO_CATEGORIES.map(cat => (
                <button 
                  key={cat.id} 
                  className={`category-tab ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  title={cat.name}
                >
                  <img src={cat.icon} alt={cat.name} />
                </button>
              ))}
            </div>
          </div>
          <div className={`photo-area ${imageSourceForDisplay ? 'clickable' : ''}`} onClick={() => imageSourceForLightbox && onImageClick(imageSourceForLightbox)}>
            {imageSourceForDisplay ? <img src={imageSourceForDisplay} alt={cityData.name} /> : <div className="photo-placeholder">无照片</div>}
          </div>
          <input type="file" id="file-upload" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0])} className="file-input-hidden" />
          <label htmlFor="file-upload" className={`file-input-label ${isDragging ? 'dragging' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <span className="file-name">{currentPhoto?.file ? currentPhoto.file.name : `为“${PHOTO_CATEGORIES.find(c => c.id === activeCategory).name}”选择文件`}</span>
          </label>
        </div>
                {/* 添加 comment 和 rating 显示 */}
        {cityData.comment && (
          <div className="form-group">
            <label>点评</label>
            <p>{cityData.comment}</p>
          </div>
        )}
        {cityData.rating > 0 && (
          <div className="form-group">
            <label>评分</label>
            <p className="rating">{'★'.repeat(cityData.rating) + '☆'.repeat(10 - cityData.rating)}</p>
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <button onClick={handleSave} disabled={isUploading} className="button-primary">
          {isUploading ? (
            <><span className="spinner"></span> 保存中...</>
          ) : cityData.isVisited ? '更新标记' : '确认标记'}
        </button>
        {cityData.isVisited && <button onClick={handleUnmarkCity} className="button-danger">取消标记</button>}
      </div>
    </>
  );
}

export default Sidebar;