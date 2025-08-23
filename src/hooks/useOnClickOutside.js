// src/hooks/useOnClickOutside.js
import { useEffect } from 'react';

// 新增一个 isEnabled 参数，默认为 true
function useOnClickOutside(ref, handler, isEnabled = true) {
  useEffect(() => {
    // 如果 Hook 被禁用，则不执行任何操作
    if (!isEnabled) {
      return;
    }

    const listener = (event) => {
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler, isEnabled]); // 将 isEnabled 加入依赖项数组
}

export default useOnClickOutside;