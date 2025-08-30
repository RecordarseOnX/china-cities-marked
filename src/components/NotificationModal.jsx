// src/components/NotificationModal.jsx
import React, { useRef } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';
import { X } from "lucide-react";
import './CommentModal.css'; // 直接复用原来的样式

function NotificationModal({ isOpen, onClose, content }) {
  const modalRef = useRef();

  useOnClickOutside(modalRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="comment-modal-overlay">
      <div className="comment-modal-content" ref={modalRef}>
        <div className="modal-header">
          <h4>更新公告</h4>
          <button className="close-button" onClick={onClose}><X size={20} strokeWidth={2.2} /> {/* ✅ SVG 图标替换 × */}</button>
        </div>

        <div className="modal-body">
          <textarea
            value={content}
            readOnly
          />
        </div>
      </div>
    </div>
  );
}

export default NotificationModal;
