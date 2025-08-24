import React, { useState, useEffect, useRef } from 'react';
import './DatePicker.css';

// 辅助函数：格式化数字，确保为两位
const pad = (num) => num.toString().padStart(2, '0');

// 辅助函数：获取某年某月有多少天
const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();

function DatePicker({ value, onChange }) {
  const parseDate = (dateString) => {
    const date = dateString ? new Date(dateString) : new Date();
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
    };
  };

  const [date, setDate] = useState(parseDate(value));
  const [maxDays, setMaxDays] = useState(getDaysInMonth(date.year, date.month));
  const [isPopupOpen, setIsPopupOpen] = useState(false);

  const containerRef = useRef(null);

  useEffect(() => setDate(parseDate(value)), [value]);

  useEffect(() => {
    const newMaxDays = getDaysInMonth(date.year, date.month);
    setMaxDays(newMaxDays);
    if (date.day > newMaxDays) {
      setDate(d => ({ ...d, day: newMaxDays }));
    }
    const newDateString = `${date.year}-${pad(date.month)}-${pad(date.day)}`;
    onChange(newDateString);
  }, [date.year, date.month, date.day]);

  const handleWheel = (part, delta) => {
    setDate(prev => {
      let { year, month, day } = prev;
      const step = delta > 0 ? -1 : 1;
      switch (part) {
        case 'year': year += step; break;
        case 'month': month = (month - 1 + step + 12) % 12 + 1; break;
        case 'day': 
          const daysInMonth = getDaysInMonth(year, month);
          day = (day - 1 + step + daysInMonth) % daysInMonth + 1; 
          break;
      }
      return { year, month, day };
    });
  };

  // 点击显示/隐藏弹窗
  const handlePartClick = () => setIsPopupOpen(prev => !prev);

  // 点击弹窗外关闭
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsPopupOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="date-picker-container" ref={containerRef}>
      <div className="date-picker-part" data-part="year" onClick={handlePartClick} onWheel={(e)=>{e.preventDefault(); handleWheel('year', e.deltaY);}}>
        {date.year}年
      </div>
      <div className="date-picker-part" data-part="month" onClick={handlePartClick} onWheel={(e)=>{e.preventDefault(); handleWheel('month', e.deltaY);}}>
        {pad(date.month)}月
      </div>
      <div className="date-picker-part" data-part="day" onClick={handlePartClick} onWheel={(e)=>{e.preventDefault(); handleWheel('day', e.deltaY);}}>
        {pad(date.day)}日
      </div>

      {isPopupOpen && (
        <div className="date-picker-popup">
          <div className="popup-column">
            {Array.from({ length: 200 }, (_, i) => 1900 + i).map(y => (
              <div key={y} className={`popup-item ${y === date.year ? 'selected' : ''}`} onClick={() => setDate(prev => ({ ...prev, year: y }))}>
                {y}
              </div>
            ))}
          </div>
          <div className="popup-column">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <div key={m} className={`popup-item ${m === date.month ? 'selected' : ''}`} onClick={() => setDate(prev => ({ ...prev, month: m }))}>
                {pad(m)}
              </div>
            ))}
          </div>
          <div className="popup-column">
            {Array.from({ length: maxDays }, (_, i) => i + 1).map(d => (
              <div key={d} className={`popup-item ${d === date.day ? 'selected' : ''}`} onClick={() => setDate(prev => ({ ...prev, day: d }))}>
                {pad(d)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default DatePicker;
