// src/components/CommentModal.jsx

import React, { useState, useEffect, useRef } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';
import StarRating from './StarRating'; // 1. 引入星级评分组件
import './CommentModal.css';

function CommentModal({ isOpen, onClose, cityData, onSave }) {
  const [comment, setComment] = useState('');
  const [rating, setRating] = useState(0); // 2. 新增评分 state
  const modalRef = useRef();

  // 点击弹窗外部时，自动保存并关闭
  useOnClickOutside(modalRef, () => {
    if (isOpen) {
      onSave(cityData.name, comment, rating); // 3. 保存时传递评分
      onClose();
    }
  });

  useEffect(() => {
    if (isOpen && cityData) {
      setComment(cityData.comment || '');
      setRating(cityData.rating || 0); // 4. 填充评分
    }
  }, [isOpen, cityData]);

  if (!isOpen) return null;

  return (
    <div className="comment-modal-overlay">
      <div className="comment-modal-content" ref={modalRef}>
        <h4>点评: {cityData.name}</h4>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="写下你对这座城市的回忆..."
          maxLength="200"
          autoFocus
        />
        <div className="modal-footer">
          {/* 5. 添加星级评分组件 */}
          <StarRating
            initialRating={rating}
            onRate={(newRating) => setRating(newRating)}
          />
          <div className={`char-counter ${comment.length > 200 ? 'exceeded' : ''}`}>
            {comment.length} / 200
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommentModal;