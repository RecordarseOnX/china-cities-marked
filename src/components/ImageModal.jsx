import React from 'react';
import './ImageModal.css';

function ImageModal({ src, onClose }) {
  if (!src) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="lightbox-content">
        <img src={src} alt="放大的城市照片" />
      </div>
    </div>
  );
}

export default ImageModal;
