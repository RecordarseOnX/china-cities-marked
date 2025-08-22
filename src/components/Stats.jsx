import React from 'react';

function Stats({ visitedCount, totalCount }) {
  // 计算待探索的数量
  const remainingCount = totalCount > 0 ? totalCount - visitedCount : 0;

  return (
    <div id="stats">
      <div className="stat-item">
        <span className="stat-number">{visitedCount}</span>
        <span className="stat-label">已抵达</span>
      </div>
      <div className="stat-item">
        <span className="stat-number">{remainingCount}</span>
        <span className="stat-label">待探索</span>
      </div>
    </div>
  );
}

export default Stats;