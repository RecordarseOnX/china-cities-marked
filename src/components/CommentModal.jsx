// src/components/CommentModal.jsx

import React, { useState, useEffect, useRef } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';
import StarRating from './StarRating';
import './CommentModal.css';

function CommentModal({ isOpen, onClose, cityData, onSave }) {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0);
  const modalRef = useRef();

  const handleSave = () => {
    if (!isOpen || !cityData) return;
    onSave(cityData.name, comment, rating);
    onClose();
  };

  const handleCloseWithoutSave = () => onClose();

  useOnClickOutside(modalRef, handleCloseWithoutSave);

  // 只在弹窗打开且“城市名字变化”时重置草稿
  useEffect(() => {
    if (isOpen && cityData) {
      setComment(cityData.comment ?? '');
      setRating(cityData.rating ?? 0);
    }
    // 仅依赖 name，避免对象浅比较造成的误触发
  }, [isOpen, cityData?.name]);

  if (!isOpen || !cityData) return null;

  return (
    <div className="comment-modal-overlay">
      <div className="comment-modal-content" ref={modalRef}>
        <div className="modal-header">
          <h4>点评: {cityData.name}</h4>
          <button className="close-button" onClick={handleCloseWithoutSave}>×</button>
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="写下你对这座城市的回忆..."
          maxLength="200"
          autoFocus
        />

        <div className="modal-footer">
          <StarRating
            key={cityData.name}
            // ★ 关键：初始值用 props，而不是本地 state，避免“上一座城市”的值被当初始
            initialRating={cityData?.rating ?? 0}
            onRate={(newRating) => setRating(newRating)}
          />
          <div className="footer-right">
            <span className={`char-counter ${comment.length > 200 ? 'exceeded' : ''}`}>
              {comment.length} / 200
            </span>
            <button onClick={handleSave} className="save-comment-button">保存</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommentModal;
