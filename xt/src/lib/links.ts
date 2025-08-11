import { getCookie } from 'cookies-next';
import { SSRNavLoader } from './ssr-nav-loader';

// 获取当前用户名
const getCurrentUsername = (): string => {
  if (typeof window !== 'undefined') {
    return getCookie('username') as string || localStorage.getItem('username') || 'defaultUser';
  }
  return 'defaultUser';
};

const currentUsername = getCurrentUsername();

// 动态导航链接加载器
class DynamicNavLoader {
  private static cachedNavLinks: Record<string, NavItem> | null = null;
  private static lastFetchTime = 0;
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存
  
  // 获取导航链接（客户端）
  static async getNavLinks(forceRefresh = false): Promise<Record<string, NavItem>> {
    const now = Date.now();
    
    // 如果有缓存且未过期，直接返回
    if (!forceRefresh && this.cachedNavLinks && (now - this.lastFetchTime) < this.CACHE_TTL) {
      return this.cachedNavLinks;
    }
    
    try {
      const response = await fetch('/api/admin/nav-config', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || 'admin-token'}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        this.cachedNavLinks = data.navLinks;
        this.lastFetchTime = now;
        return this.cachedNavLinks;
      }
    } catch (error) {
      console.error('获取导航配置失败:', error);
    }
    
    // 如果API调用失败，返回默认配置
    return this.getDefaultNavLinks();
  }
  
  // 保存导航链接
  static async saveNavLinks(navLinks: Record<string, NavItem>, isGlobal = false): Promise<boolean> {
    try {
      const response = await fetch('/api/admin/nav-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || 'admin-token'}`,
        },
        body: JSON.stringify({
          navLinks,
          isGlobal,
          configName: 'default'
        }),
      });
      
      if (response.ok) {
        // 更新本地缓存
        this.cachedNavLinks = navLinks;
        this.lastFetchTime = Date.now();
        return true;
      }
    } catch (error) {
      console.error('保存导航配置失败:', error);
    }
    
    return false;
  }
  
  // 获取默认导航链接
  private static getDefaultNavLinks(): Record<string, NavItem> {
    return importDynamicRoutes({
      管理员: {
        path: '/admin',
        hasSubLinks: true,
        show: true,
        subRoutes: {
          系统设置: {
            path: '/admin/{username}/Protected',
            show: true
          }
        }
      }
    });
  }
  
  // 清除缓存
  static clearCache(): void {
    this.cachedNavLinks = null;
    this.lastFetchTime = 0;
  }
}

// 导航项类型定义
export interface NavItem {
  path: string;
  hasSubLinks: boolean;
  show: boolean;
  subLinks?: Record<string, NavItem>;
}

// 动态路由工具函数
export const createDynamicPath = (template: string, params: Record<string, string> = {}): string => {
  let path = template;
  // 替换用户名占位符
  path = path.replace(/\{username\}/g, currentUsername);
  // 替换其他参数
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  });
  return path;
};

// 创建导航项的工具函数
export const createNavItem = (
  pathTemplate: string,
  options: {
    hasSubLinks?: boolean;
    show?: boolean;
    params?: Record<string, string>;
    subLinks?: Record<string, NavItem>;
  } = {}
): NavItem => {
  const {
    hasSubLinks = false,
    show = true,
    params = {},
    subLinks = {}
  } = options;

  return {
    path: createDynamicPath(pathTemplate, params),
    hasSubLinks,
    show,
    ...(hasSubLinks && { subLinks })
  };
};

// 继承主导航项路径的工具函数
export const inheritParentPath = (parentPath: string, childPath: string): string => {
  // 如果子路径是绝对路径，直接返回
  if (childPath.startsWith('/')) {
    return childPath;
  }
  // 否则拼接父路径
  const cleanParentPath = parentPath.endsWith('/') ? parentPath.slice(0, -1) : parentPath;
  return `${cleanParentPath}/${childPath}`;
};

// 批量创建子导航项
export const createSubNavItems = (
  parentPath: string,
  subItems: Record<string, string | { path: string; show?: boolean; params?: Record<string, string> }>
): Record<string, NavItem> => {
  const result: Record<string, NavItem> = {};
  
  Object.entries(subItems).forEach(([name, config]) => {
    if (typeof config === 'string') {
      // 简单字符串路径
      result[name] = createNavItem(inheritParentPath(parentPath, config));
    } else {
      // 详细配置对象
      result[name] = createNavItem(
        inheritParentPath(parentPath, config.path),
        {
          show: config.show,
          params: config.params
        }
      );
    }
  });
  
  return result;
};

// 快速导入动态路由配置
export const importDynamicRoutes = (routes: Record<string, {
  path: string;
  hasSubLinks?: boolean;
  show?: boolean;
  params?: Record<string, string>;
  subRoutes?: Record<string, string | { path: string; show?: boolean; params?: Record<string, string> }>;
}>): Record<string, NavItem> => {
  const result: Record<string, NavItem> = {};
  
  Object.entries(routes).forEach(([name, config]) => {
    const navItem = createNavItem(config.path, {
      hasSubLinks: config.hasSubLinks || (config.subRoutes && Object.keys(config.subRoutes).length > 0),
      show: config.show,
      params: config.params
    });
    
    // 如果有子路由，创建子导航项
    if (config.subRoutes) {
      navItem.subLinks = createSubNavItems(navItem.path, config.subRoutes);
      navItem.hasSubLinks = true;
    }
    
    result[name] = navItem;
  });
  
  return result;
};

// 使用新工具函数创建导航链接
export const navLinks = importDynamicRoutes({
  管理员: {
    path: '/admin',
    hasSubLinks: true,
    show: true,
    subRoutes: {
      系统设置: {
        path: '/admin/{username}/Protected',
        show: true
      }
    }
  }
});

export default navLinks;

/* 
使用说明：

1. 快速创建动态路由：
   const routes = importDynamicRoutes({
     '用户管理': {
       path: '/admin/{username}/users',
       hasSubLinks: true,
       subRoutes: {
         '用户列表': 'list',
         '添加用户': 'add',
         '用户详情': { path: 'detail/{id}', params: { id: '123' } }
       }
     }
   });

2. 创建单个导航项：
   const navItem = createNavItem('/dashboard/{username}', {
     hasSubLinks: true,
     show: true
   });

3. 继承父路径：
   const childPath = inheritParentPath('/admin/users', 'detail'); // '/admin/users/detail'

4. 动态路径替换：
   const path = createDynamicPath('/user/{username}/profile/{section}', {
     section: 'settings'
   }); // '/user/currentUser/profile/settings'

5. 批量创建子导航：
   const subNavs = createSubNavItems('/admin', {
     '用户': 'users',
     '设置': { path: 'settings', show: true },
     '日志': { path: 'logs/{date}', params: { date: '2024' } }
   });
*/