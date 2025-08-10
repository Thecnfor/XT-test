import { getCookie } from '@/lib/utils';

// 获取当前用户名
const getCurrentUsername = () => {
  if (typeof window !== 'undefined') {
    // 1. 尝试从cookie中获取
    const usernameFromCookie = getCookie('username');
    if (usernameFromCookie) {
      return usernameFromCookie;
    }
    
    // 2. 尝试从localStorage中获取
    const usernameFromLocalStorage = localStorage.getItem('username');
    if (usernameFromLocalStorage) {
      return usernameFromLocalStorage;
    }
  }
  
  return 'unknown';
};

// 统一管理导航链接
const AdminLinks = {
  '用户管理': {
    path: `/admin/${getCurrentUsername()}/users`,
    hasSubLinks: false,
    show: true
  },
  '权限设置': {
    path: `/admin/${getCurrentUsername()}/permissions`,
    hasSubLinks: false,
    show: true
  },
  '系统设置': {
    path: `/admin/${getCurrentUsername()}/Protected`,
    hasSubLinks: false,
    show: true
  }
};
export default AdminLinks;
