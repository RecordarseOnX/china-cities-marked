// src/components/Auth.jsx

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Auth.css';

// --- 用户名验证逻辑 (已更新20字符限制) ---
const ALLOWED_SYMBOLS = '_-'; 
const USERNAME_REGEX = new RegExp(`^[a-zA-Z0-9\\u4e00-\\u9fa5${ALLOWED_SYMBOLS}]+$`);

function validateUsername(username) {
  let weightedLength = 0;
  for (const char of username) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      weightedLength += 2;
    } else {
      weightedLength += 1;
    }
  }

  if (weightedLength < 2) return { isValid: false, message: '用户名太短了 (最少2位英文字符或1个汉字)。' };
  if (weightedLength > 20) return { isValid: false, message: '用户名太长了 (最多20位英文字符或10个汉字)。' };
  if (!USERNAME_REGEX.test(username)) return { isValid: false, message: `用户名只能包含中文、字母、数字、下划线(_)和连字符(-)。` };
  return { isValid: true, message: '验证通过' };
}

// --- 组件主体 (回归初心最终版) ---
function Auth({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  // 核心逻辑：直接读写 'users' 表
  const handleProceed = async (e) => {
    e.preventDefault();

    const validation = validateUsername(username);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }

    setLoading(true);
    try {
      // 步骤 1: 查找用户是否已存在于 'users' 表
      let { data: user, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .single(); // .single() 会在找不到用户时返回一个特定错误

      // 步骤 2: 如果找不到用户 (这是新用户注册的正常流程)
      if (error && error.code === 'PGRST116') {
        // 插入新用户
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert({ username: username })
          .select('id, username')
          .single();

        if (insertError) throw insertError; // 如果插入失败，则抛出错误
        
        user = newUser; // 将新创建的用户信息赋给 user 变量
      } else if (error) {
        // 如果是其他未知数据库错误，则抛出
        throw error;
      }

      // 步骤 3: 无论是找到的还是新创建的，都视为登录成功
      onLoginSuccess(user);

    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-header">我的城市足迹</h1>
        <p className="auth-description">输入你的专属用户名以继续</p>
        <form onSubmit={handleProceed} className="auth-form">
          <input
            className="auth-input"
            type="text"
            placeholder="2-20位用户名 (中文算2位)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <button type="submit" className="auth-button primary" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? '请稍候...' : '进入地图'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;