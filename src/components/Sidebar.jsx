// src/components/Sidebar.jsx

import React, { useState, useEffect } from 'react';
import './Sidebar.css'; 

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

// 内联的 SVG 图标组件
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
);
const UploadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
);
// 新增：点评图标
const CommentIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
);

// 接收一个新的 onCommentClick prop
function Sidebar({ cityData, onSave, onUnmark, onImageClick, onCommentClick }) {
  const [visitDate, setVisitDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (cityData) {
      setVisitDate(cityData.visit_date || '');
      setPhotoUrl(cityData.photo_url || null);
    }
    setNewPhotoFile(null);
    setIsUploading(false);
    setIsDragging(false);
  }, [cityData]);

  const handleFileChange = (file) => {
    if (file && file.type.startsWith('image/')) {
      setNewPhotoFile(file);
    }
  };

  const handleSave = async () => {
    let uploadedPhotoUrl = photoUrl;
    if (newPhotoFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', newPhotoFile);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'city');
      try {
        const response = await fetch(UPLOAD_URL, { method: 'POST', body: formData });
        const data = await response.json();
        if (data.secure_url) {
          uploadedPhotoUrl = data.secure_url;
        } else { 
          throw new Error(data.error.message || '图片上传失败'); 
        }
      } catch (error) {
        alert(error.message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    onSave({
      city_name: cityData.name,
      visit_date: visitDate || null,
      photo_url: uploadedPhotoUrl,
    });
  };
  
  const handleUnmarkCity = () => {
    if (window.confirm(`确定要取消标记城市 "${cityData.name}" 吗？`)) {
      onUnmark(cityData.name);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileChange(files[0]);
    }
  };
  
  if (!cityData) return null;

  const imageSourceForDisplay = newPhotoFile ? URL.createObjectURL(newPhotoFile) : photoUrl;

  const getOriginalCloudinaryUrl = (url) => {
    if (!url || !url.includes('/upload/')) return url;
    const parts = url.split('/upload/');
    const publicIdWithVersion = parts[1].substring(parts[1].indexOf('v'));
    return `${parts[0]}/upload/${publicIdWithVersion}`;
  };
  const imageSourceForLightbox = newPhotoFile ? URL.createObjectURL(newPhotoFile) : getOriginalCloudinaryUrl(cityData.photo_url);

  return (
    <>
      <div className="sidebar-header">
        <h3>{cityData.name}</h3>
        {/* 【关键】只有当城市已被标记时，才显示点评按钮 */}
        {cityData.isVisited && (
          <button onClick={() => onCommentClick(cityData)} className="comment-button" aria-label="添加或编辑点评">
            <CommentIcon />
          </button>
        )}
      </div>
      <div className="sidebar-body">
        <div className="form-group">
          <label>初次到达时间</label>
          <div className="input-wrapper">
            <CalendarIcon />
            <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <label>照片 (4:3)</label>
          <div 
            className={`photo-area ${imageSourceForDisplay ? 'clickable' : ''}`} 
            onClick={() => imageSourceForLightbox && onImageClick(imageSourceForLightbox)}
          >
            {imageSourceForDisplay ? <img src={imageSourceForDisplay} alt={cityData.name} /> : <div className="photo-placeholder">无照片</div>}
          </div>
          <input type="file" id="file-upload" accept="image/*" onChange={(e) => handleFileChange(e.target.files[0])} className="file-input-hidden" />
          <label 
            htmlFor="file-upload" 
            className={`file-input-label ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            <UploadIcon />
            <span className="file-name">{newPhotoFile ? newPhotoFile.name : '选择或拖拽文件'}</span>
          </label>
        </div>
      </div>
      <div className="sidebar-footer">
        {cityData.isVisited ? (
          <button onClick={handleSave} disabled={isUploading} className="button-primary">{isUploading ? '上传中...' : '更新标记'}</button>
        ) : (
          <button onClick={handleSave} disabled={isUploading} className="button-primary">{isUploading ? '上传中...' : '确认标记'}</button>
        )}
        {cityData.isVisited && <button onClick={handleUnmarkCity} className="button-danger">取消标记</button>}
      </div>
    </>
  );
}

export default Sidebar;