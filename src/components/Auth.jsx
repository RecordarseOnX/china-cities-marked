// src/components/Auth.jsx

import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import './Auth.css'; // 我们会继续使用之前的样式

// --- 用户名验证逻辑 ---
// 1. 定义允许的符号
const ALLOWED_SYMBOLS = '_-'; 
// 2. 创建正则表达式，只允许中文、字母、数字和我们定义的符号
const USERNAME_REGEX = new RegExp(`^[a-zA-Z0-9\\u4e00-\\u9fa5${ALLOWED_SYMBOLS}]+$`);

function validateUsername(username) {
  // 计算加权长度 (中文算2位)
  let weightedLength = 0;
  for (const char of username) {
    // 使用正则表达式判断是否为中文字符
    if (/[\u4e00-\u9fa5]/.test(char)) {
      weightedLength += 2;
    } else {
      weightedLength += 1;
    }
  }

  if (weightedLength < 2) {
    return { isValid: false, message: '用户名太短了 (最少2位英文字符或1个汉字)。' };
  }
  if (weightedLength > 14) {
    return { isValid: false, message: '用户名太长了 (最多14位英文字符或7个汉字)。' };
  }
  if (!USERNAME_REGEX.test(username)) {
    return { isValid: false, message: `用户名只能包含中文、字母、数字、下划线(_)和连字符(-)。` };
  }

  return { isValid: true, message: '验证通过' };
}
// --- 验证逻辑结束 ---


function Auth({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');

  // 核心逻辑：进入或创建账户
  const handleProceed = async (e) => {
    e.preventDefault();

    // 步骤 1: 客户端验证
    const validation = validateUsername(username);
    if (!validation.isValid) {
      alert(validation.message);
      return;
    }

    setLoading(true);
    try {
      // 步骤 2: 查找用户是否存在
      let { data: user, error } = await supabase
        .from('users')
        .select('id, username')
        .eq('username', username)
        .single();

      // 如果用户不存在 (这是预期的“错误”，代表新用户)
      if (error && error.code === 'PGRST116') {
        // 步骤 3: 创建新用户
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

      // 步骤 4: 登录成功
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
            placeholder="2-14位用户名 (中文算2位)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          {/* 单一按钮，既是登录也是注册 */}
          <button type="submit" className="auth-button primary" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? '请稍候...' : '进入地图'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Auth;