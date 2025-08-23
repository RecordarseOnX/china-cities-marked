// src/components/StarRating.jsx

import React, { useState } from 'react';
import './StarRating.css';

const Star = ({ filled, onClick }) => (
  <svg
    className={`star ${filled ? 'filled' : ''}`}
    onClick={onClick}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
  </svg>
);

function StarRating({ totalStars = 10, initialRating = 0, onRate }) {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);

  // 当 initialRating prop 变化时，更新内部 state
  useState(() => {
    setRating(initialRating);
  }, [initialRating]);

  const handleClick = (newRating) => {
    // 最低分为 1 星
    const finalRating = newRating === rating ? 0 : newRating;
    setRating(finalRating);
    if (onRate) {
      onRate(finalRating);
    }
  };

  return (
    <div className="star-rating-container">
      {[...Array(totalStars)].map((_, index) => {
        const starValue = index + 1;
        return (
          <Star
            key={starValue}
            filled={starValue <= (hoverRating || rating)}
            onClick={() => handleClick(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
          />
        );
      })}
    </div>
  );
}

export default StarRating;