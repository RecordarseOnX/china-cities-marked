// src/components/Sidebar.jsx

import React, { useState, useEffect } from 'react';
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

function Sidebar({ cityData, onSave, onUnmark }) {
  const [visitDate, setVisitDate] = useState('');
  const [photoUrl, setPhotoUrl] = useState(null);
  const [newPhotoFile, setNewPhotoFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (cityData) {
      setVisitDate(cityData.visit_date || '');
      setPhotoUrl(cityData.photo_url || null);
    }
    setNewPhotoFile(null);
    setIsUploading(false);
  }, [cityData]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setNewPhotoFile(e.target.files[0]);
    }
  };

  const handleSave = async () => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      alert("错误：Cloudinary 配置丢失！请检查您的 .env.local 文件并重启服务器。");
      return;
    }
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
        if (data.error) {
          throw new Error(`Cloudinary 错误: ${data.error.message}`);
        }
        uploadedPhotoUrl = data.secure_url;
      } catch (error) {
        alert(error.message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    
    // --- 【问题修复的关键】 ---
    // 将 payload 中的 cityName 修改为 city_name，与数据库列名保持一致
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
  
  if (!cityData) return null;

  const currentPhoto = newPhotoFile ? URL.createObjectURL(newPhotoFile) : photoUrl;

  return (
    <>
      <div className="sidebar-header"><h3>{cityData.name}</h3></div>
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
          <div className="photo-area">
            {currentPhoto ? <img src={currentPhoto} alt={cityData.name} /> : <div className="photo-placeholder">无照片</div>}
          </div>
          <input type="file" id="file-upload" accept="image/*" onChange={handleFileChange} className="file-input-hidden" />
          <label htmlFor="file-upload" className="file-input-label">
            <UploadIcon />
            <span className="file-name">{newPhotoFile ? newPhotoFile.name : '选择或拖拽文件'}</span>
          </label>
        </div>
      </div>
      <div className="sidebar-footer">
        {cityData.isVisited ? (
          <button onClick={handleSave} disabled={isUploading} className="button-primary">
            {isUploading ? '上传中...' : '更新标记'}
          </button>
        ) : (
          <button onClick={handleSave} disabled={isUploading} className="button-primary">
            {isUploading ? '上传中...' : '确认标记'}
          </button>
        )}
        {cityData.isVisited && <button onClick={handleUnmarkCity} className="button-danger">取消标记</button>}
      </div>
    </>
  );
}

export default Sidebar;