// src/components/NotificationModal.jsx
import React, { useRef } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';
import { X, Annoyed } from "lucide-react";
import './NotificationModal.css'; // 确保引入的是 NotificationModal.css

function NotificationModal({ isOpen, onClose, content }) {
  const modalRef = useRef();

  useOnClickOutside(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="notification-modal-overlay"> 
      <div className="notification-modal-content" ref={modalRef}>
        
        {/* ▼▼▼ 【核心修改】结构与 CommentModal 完全对齐 ▼▼▼ */}
        <div className="notification-modal-header">
          <h4>
            <Annoyed size={22} strokeWidth={2} />
            <span>更新公告</span>
          </h4>
          <button className="close-button" onClick={onClose} aria-label="关闭">
            <X /> {/* SVG 图标，大小将在 CSS 中控制 */}
          </button>
        </div>

        <div className="notification-modal-body">
          <div className="notification-content">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NotificationModal;