'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Save, X, Trash2, ChevronDown, ChevronRight, Copy, Wand2 } from 'lucide-react';
import styled from 'styled-components';
import { 
  NavItem, 
  createDynamicPath,
  getNavLinks,
  saveNavLinks,
  clearNavCache,
  DynamicNavLoader
} from '../../lib/links';

// 使用从 links.ts 导入的 NavItem 类型
type NavLinks = Record<string, NavItem>;

// 动态路由模板接口
interface RouteTemplate {
  name: string;
  pathTemplate: string;
  hasSubLinks?: boolean;
  subRoutes?: Record<string, string | { path: string; show?: boolean; params?: Record<string, string> }>;
}

const NavLinksManager: React.FC = () => {
  const [navLinks, setNavLinks] = useState<NavLinks>({
    '管理员': {
      path: '/admin',
      hasSubLinks: true,
      show: true,
      subLinks: {
        '用户管理': {
          path: '/admin/users',
          hasSubLinks: false,
          show: true,
        },
        '权限设置': {
          path: '/admin/permissions',
          hasSubLinks: false,
          show: true,
        },
        '系统设置': {
          path: '/admin/settings',
          hasSubLinks: false,
          show: true,
        },
      },
    },
  });

  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['管理员']));
  // const [editingItem, setEditingItem] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [isGlobalConfig, setIsGlobalConfig] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  
  // 主导航表单状态
  const [newItemName, setNewItemName] = useState('');
  const [newItemPath, setNewItemPath] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // 路径输入辅助功能
  const [showPathHelper, setShowPathHelper] = useState(false);
  
  // 子导航表单状态
  const [newSubItemName, setNewSubItemName] = useState('');
  const [newSubItemPath, setNewSubItemPath] = useState('');
  const [showAddSubForm, setShowAddSubForm] = useState<string | null>(null);
  
  // 动态路由相关状态
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [, setSelectedTemplate] = useState<RouteTemplate | null>(null);
  // const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  
  // 预设路由模板
  const routeTemplates: RouteTemplate[] = [
    {
      name: '用户管理模块',
      pathTemplate: '/admin/{username}/users',
      hasSubLinks: true,
      subRoutes: {
        '用户列表': 'list',
        '添加用户': 'add',
        '用户详情': { path: 'detail/{id}', params: { id: '123' } }
      }
    },
    {
      name: '个人中心',
      pathTemplate: '/user/{username}',
      hasSubLinks: true,
      subRoutes: {
        '个人资料': 'profile',
        '账户设置': 'settings',
        '安全中心': 'security'
      }
    },
    {
      name: '项目管理',
      pathTemplate: '/projects/{projectId}',
      hasSubLinks: true,
      subRoutes: {
        '项目概览': 'overview',
        '任务管理': 'tasks',
        '团队成员': 'members',
        '项目设置': 'settings'
      }
    },
    {
      name: '简单页面',
      pathTemplate: '/page/{slug}',
      hasSubLinks: false
    }
  ];

  // 加载导航配置
  const loadNavConfig = async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      const navConfig = await getNavLinks(forceRefresh);
      setNavLinks(navConfig);
      setLastSyncTime(new Date());
    } catch (error) {
      console.error('加载导航配置失败:', error);
      setMessage('加载导航配置失败');
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  // 组件挂载时加载配置
  useEffect(() => {
    loadNavConfig();
  }, []);

  // 定期同步配置（每5分钟）
  useEffect(() => {
    const interval = setInterval(() => {
      loadNavConfig(true);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // 生成links.ts文件内容
  const generateLinksFileContent = (links: NavLinks): string => {
    // 将 NavLinks 转换为 importDynamicRoutes 格式
    const routesConfig: Record<string, {
      path: string;
      hasSubLinks: boolean;
      show: boolean;
      subRoutes?: Record<string, { path: string; show: boolean }>;
    }> = {};
    
    Object.entries(links).forEach(([name, navItem]) => {
      routesConfig[name] = {
        path: navItem.path,
        hasSubLinks: navItem.hasSubLinks,
        show: navItem.show
      };
      
      // 如果有子链接，转换为 subRoutes 格式
      if (navItem.subLinks && Object.keys(navItem.subLinks).length > 0) {
        routesConfig[name].subRoutes = {};
        Object.entries(navItem.subLinks).forEach(([subName, subItem]) => {
          routesConfig[name].subRoutes![subName] = {
            path: subItem.path,
            show: subItem.show || true
          };
        });
      }
    });
    
    const routesStr = JSON.stringify(routesConfig, null, 2)
      .replace(/"([^"]+)":/g, '$1:')
      .replace(/"/g, "'");
    
    return `import { getCookie } from 'cookies-next';

// 获取当前用户名
const getCurrentUsername = (): string => {
  if (typeof window !== 'undefined') {
    return getCookie('username') as string || localStorage.getItem('username') || 'defaultUser';
  }
  return 'defaultUser';
};

const currentUsername = getCurrentUsername();

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
  path = path.replace(/\\{username\\}/g, currentUsername);
  // 替换其他参数
  Object.entries(params).forEach(([key, value]) => {
    path = path.replace(new RegExp(\`\\\\{\${key}\\\\}\`, 'g'), value);
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
  return \`\${cleanParentPath}/\${childPath}\`;
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
export const navLinks = importDynamicRoutes(${routesStr});

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
*/`;
  };

  // 保存导航链接
  const saveNavLinksConfig = async (links: NavLinks) => {
    setSaveStatus('saving');
    
    try {
      await saveNavLinks(links, isGlobalConfig);
      await clearNavCache();
      
      setSaveStatus('saved');
      setMessage('导航配置保存成功');
      setMessageType('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving nav links:', error);
      setSaveStatus('error');
      setMessage('保存导航配置失败');
      setMessageType('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  // 切换展开状态
  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedItems(newExpanded);
  };

  // 添加主导航项
  const addMainNavItem = () => {
    if (!newItemName || !newItemPath) return;
    
    const newNavLinks = {
      ...navLinks,
      [newItemName]: {
        path: newItemPath,
        hasSubLinks: true,
        show: true,
        subLinks: {}
      }
    };
    
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
    setNewItemName('');
    setNewItemPath('');
    setShowAddForm(false);
  };

  // 添加子导航项
  const addSubNavItem = (parentKey: string) => {
    if (!newSubItemName || !newSubItemPath) return;
    
    const newNavLinks = { ...navLinks };
    if (!newNavLinks[parentKey].subLinks) {
      newNavLinks[parentKey].subLinks = {};
      newNavLinks[parentKey].hasSubLinks = true;
    }
    
    newNavLinks[parentKey].subLinks![newSubItemName] = {
      path: newSubItemPath,
      hasSubLinks: false,
      show: true,
    };
    
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
    setNewSubItemName('');
    setNewSubItemPath('');
    setShowAddSubForm(null);
  };

  // 删除主导航项
  const deleteMainNavItem = (key: string) => {
    const newNavLinks = { ...navLinks };
    delete newNavLinks[key];
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
  };

  // 删除子导航项
  const deleteSubNavItem = (parentKey: string, subKey: string) => {
    const newNavLinks = { ...navLinks };
    if (newNavLinks[parentKey].subLinks) {
      delete newNavLinks[parentKey].subLinks[subKey];
      
      // 如果没有子项了，更新hasSubLinks
      if (Object.keys(newNavLinks[parentKey].subLinks!).length === 0) {
        newNavLinks[parentKey].hasSubLinks = false;
        delete newNavLinks[parentKey].subLinks;
      }
    }
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
  };

  // 切换显示状态
  const toggleShow = (key: string) => {
    const newNavLinks = {
      ...navLinks,
      [key]: {
        ...navLinks[key],
        show: !navLinks[key].show
      }
    };
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
  };

  // 从模板创建导航项
  const createFromTemplate = (template: RouteTemplate) => {
    
    // 手动创建导航项
    const newNavItem: NavItem = {
      path: createDynamicPath(template.pathTemplate),
      hasSubLinks: template.hasSubLinks || false,
      show: true,
      ...(template.subRoutes && {
        subLinks: Object.entries(template.subRoutes).reduce((acc, [name, config]) => {
          const subPath = typeof config === 'string' ? config : config.path;
          const fullSubPath = subPath.startsWith('/') ? subPath : `${createDynamicPath(template.pathTemplate)}/${subPath}`;
          acc[name] = {
            path: fullSubPath,
            hasSubLinks: false,
            show: typeof config === 'object' ? config.show !== false : true
          };
          return acc;
        }, {} as Record<string, NavItem>)
      })
    };
    
    // 合并到现有导航
    const newNavLinks = {
      ...navLinks,
      [template.name]: newNavItem
    };
    
    setNavLinks(newNavLinks);
    saveNavLinksConfig(newNavLinks);
    setShowTemplateSelector(false);
    setSelectedTemplate(null);
  };

  // 复制路径到剪贴板
  const copyPathToClipboard = (path: string) => {
    navigator.clipboard.writeText(path).then(() => {
      // 可以添加一个临时提示
      console.log('路径已复制到剪贴板:', path);
    });
  };

  // 预览动态路径
  const previewDynamicPath = (pathTemplate: string, params: Record<string, string> = {}) => {
    return createDynamicPath(pathTemplate, params);
  };

  // 路径输入辅助功能
  const insertPathPlaceholder = (placeholder: string, isSubPath = false) => {
    if (isSubPath) {
      setNewSubItemPath(prev => prev + placeholder);
    } else {
      setNewItemPath(prev => prev + placeholder);
    }
  };

  // 常用路径模式
  const commonPathPatterns = [
    { name: '用户名', value: '{username}', description: '当前用户名', isHighlight: true },
    { name: '用户ID', value: '{userId}', description: '用户ID参数' },
    { name: '项目ID', value: '{projectId}', description: '项目ID参数' },
    { name: '页面ID', value: '{pageId}', description: '页面ID参数' },
    { name: '分类', value: '{category}', description: '分类参数' },
  ];

  // 智能路径替换功能
  const smartPathReplace = (path: string): string => {
    // 自动替换常见的用户名模式
    return path
      .replace(/\$\{currentUsername\}/g, '{username}')
      .replace(/\$\{username\}/g, '{username}')
      .replace(/\{user\}/g, '{username}')
      .replace(/\{user_name\}/g, '{username}')
      .replace(/\{userName\}/g, '{username}');
  };

  // 一键插入用户名占位符
  const insertUsername = (isSubPath = false) => {
    if (isSubPath) {
      setNewSubItemPath(prev => prev + '{username}');
    } else {
      setNewItemPath(prev => prev + '{username}');
    }
  };

  // 智能路径输入处理
  const handlePathInput = (value: string, isSubPath = false) => {
    const smartValue = smartPathReplace(value);
    if (isSubPath) {
      setNewSubItemPath(smartValue);
    } else {
      setNewItemPath(smartValue);
    }
  };

  // 快速路径模板
  const quickPathTemplates = [
    { name: '管理员页面', path: '/admin/{username}/' },
    { name: '用户中心', path: '/user/{username}/' },
    { name: '项目管理', path: '/projects/{projectId}/' },
    { name: '设置页面', path: '/settings/{category}/' },
  ];

  return (
    <StyledWrapper>
        <div className="header">
          <h3>导航链接管理</h3>
          <div className="actions">
            <button 
              className="btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              <Plus size={16} />
              添加主导航
            </button>
            <button 
              className="btn-template"
              onClick={() => setShowTemplateSelector(true)}
            >
              <Wand2 size={16} />
              使用模板
            </button>
            <div className={`save-status ${saveStatus}`}>
              {saveStatus === 'saving' && '保存中...'}
              {saveStatus === 'saved' && '✅ 已保存'}
              {saveStatus === 'error' && '❌ 保存失败'}
            </div>
          </div>
        </div>

        {/* 模板选择器 */}
        {showTemplateSelector && (
          <div className="template-selector">
            <h4>选择路由模板</h4>
            <div className="template-grid">
              {routeTemplates.map((template, index) => (
                <div key={index} className="template-card">
                  <div className="template-header">
                    <h5>{template.name}</h5>
                    <span className="template-path">{template.pathTemplate}</span>
                  </div>
                  <div className="template-preview">
                    <span className="preview-label">预览路径:</span>
                    <span className="preview-path">{previewDynamicPath(template.pathTemplate)}</span>
                    <button 
                      className="btn-copy"
                      onClick={() => copyPathToClipboard(previewDynamicPath(template.pathTemplate))}
                      title="复制路径"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  {template.subRoutes && (
                    <div className="template-subroutes">
                      <span className="subroutes-label">包含子路由:</span>
                      <div className="subroutes-list">
                        {Object.keys(template.subRoutes).map(subName => (
                          <span key={subName} className="subroute-tag">{subName}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <button 
                    className="btn-use-template"
                    onClick={() => createFromTemplate(template)}
                  >
                    使用此模板
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-cancel" onClick={() => setShowTemplateSelector(false)}>
              <X size={16} />
              关闭
            </button>
          </div>
        )}

        {/* 添加主导航表单 */}
        {showAddForm && (
          <div className="add-form">
            <h4>添加主导航项</h4>
            <div className="form-row">
              <input
                type="text"
                placeholder="导航名称"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
              />
              <div className="path-input-container">
                <input
                  type="text"
                  placeholder="路径 (支持动态参数如: /admin/{username})"
                  value={newItemPath}
                  onChange={(e) => handlePathInput(e.target.value, false)}
                />
                <button 
                  className="btn-username"
                  onClick={() => insertUsername(false)}
                  title="插入用户名占位符"
                >
                  👤
                </button>
                <button 
                  className="btn-path-helper"
                  onClick={() => setShowPathHelper(!showPathHelper)}
                  title="路径输入助手"
                >
                  <Wand2 size={14} />
                </button>
              </div>
              <button className="btn-success" onClick={addMainNavItem}>
                <Save size={16} />
              </button>
              <button className="btn-cancel" onClick={() => setShowAddForm(false)}>
                <X size={16} />
              </button>
            </div>
            
            {/* 路径输入助手 */}
            {showPathHelper && (
              <div className="path-helper">
                <div className="helper-section">
                  <h5>快速路径模板</h5>
                  <div className="template-buttons">
                    {quickPathTemplates.map((template, index) => (
                      <button
                        key={index}
                        className="btn-template-quick"
                        onClick={() => setNewItemPath(template.path)}
                        title={`使用模板: ${template.path}`}
                      >
                        {template.name}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="helper-section">
                  <h5>插入动态参数</h5>
                  <div className="param-buttons">
                    {commonPathPatterns.map((pattern, index) => (
                      <button
                        key={index}
                        className={`btn-param ${pattern.isHighlight ? 'btn-param-highlight' : ''}`}
                        onClick={() => insertPathPlaceholder(pattern.value)}
                        title={pattern.description}
                      >
                        {pattern.isHighlight ? '👤 ' : ''}{pattern.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {newItemPath && (
              <div className="path-preview">
                <span className="preview-label">预览路径:</span>
                <span className="preview-path">{previewDynamicPath(newItemPath)}</span>
              </div>
            )}
          </div>
        )}

        {/* 导航项列表 */}
        <div className="nav-list">
          {Object.entries(navLinks).map(([key, value]) => (
            <div key={key} className="nav-item">
              <div className="nav-header">
                <div className="nav-info">
                  {value.hasSubLinks && (
                    <button 
                      className="btn-icon"
                      onClick={() => toggleExpanded(key)}
                    >
                      {expandedItems.has(key) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                  )}
                  <span className="nav-name">{key}</span>
                  <div className="nav-path-container">
                    <span className="nav-path">{value.path}</span>
                    <button 
                      className="btn-copy-small"
                      onClick={() => copyPathToClipboard(value.path)}
                      title="复制路径"
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                  <label className="show-toggle">
                    <input
                      type="checkbox"
                      checked={value.show}
                      onChange={() => toggleShow(key)}
                    />
                    显示
                  </label>
                </div>
                <div className="nav-actions">
                  <button 
                    className="btn-icon"
                    onClick={() => setShowAddSubForm(key)}
                    title="添加子导航"
                  >
                    <Plus size={14} />
                  </button>
                  <button 
                    className="btn-icon btn-danger"
                    onClick={() => deleteMainNavItem(key)}
                    title="删除导航"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 子导航项 */}
              {value.hasSubLinks && expandedItems.has(key) && value.subLinks && (
                <div className="sub-nav-list">
                  {Object.entries(value.subLinks).map(([subKey, subValue]) => (
                    <div key={subKey} className="sub-nav-item">
                      <div className="sub-nav-info">
                        <span className="sub-nav-name">{subKey}</span>
                        <span className="sub-nav-path">{subValue.path}</span>
                      </div>
                      <button 
                        className="btn-icon btn-danger"
                        onClick={() => deleteSubNavItem(key, subKey)}
                        title="删除子导航"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  
                  {/* 添加子导航表单 */}
                  {showAddSubForm === key && (
                    <div className="add-sub-form">
                      <div className="form-row">
                        <input
                          type="text"
                          placeholder="子导航名称"
                          value={newSubItemName}
                          onChange={(e) => setNewSubItemName(e.target.value)}
                        />
                        <div className="path-input-container">
                          <input
                            type="text"
                            placeholder="子导航路径 (支持动态参数)"
                            value={newSubItemPath}
                            onChange={(e) => handlePathInput(e.target.value, true)}
                          />
                          <button 
                            className="btn-username"
                            onClick={() => insertUsername(true)}
                            title="插入用户名占位符"
                          >
                            👤
                          </button>
                          <button 
                            className="btn-path-helper"
                            onClick={() => setShowPathHelper(!showPathHelper)}
                            title="路径输入助手"
                          >
                            <Wand2 size={14} />
                          </button>
                        </div>
                        <button 
                          className="btn-success"
                          onClick={() => addSubNavItem(key)}
                        >
                          <Save size={16} />
                        </button>
                        <button 
                          className="btn-cancel"
                          onClick={() => setShowAddSubForm(null)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                      
                      {/* 子导航路径输入助手 */}
                      {showPathHelper && (
                        <div className="path-helper">
                          <div className="helper-section">
                            <h5>插入动态参数</h5>
                            <div className="param-buttons">
                              {commonPathPatterns.map((pattern, index) => (
                                <button
                                  key={index}
                                  className={`btn-param ${pattern.isHighlight ? 'btn-param-highlight' : ''}`}
                                  onClick={() => insertPathPlaceholder(pattern.value, true)}
                                  title={pattern.description}
                                >
                                  {pattern.isHighlight ? '👤 ' : ''}{pattern.name}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="helper-section">
                            <h5>继承父路径</h5>
                            <button
                              className="btn-inherit"
                              onClick={() => setNewSubItemPath(value.path + '/')}
                              title="使用父导航路径作为前缀"
                            >
                              继承: {value.path}/
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {newSubItemPath && (
                        <div className="path-preview">
                          <span className="preview-label">预览路径:</span>
                          <span className="preview-path">{previewDynamicPath(newSubItemPath)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 预览区域 */}
        <div className="preview-section">
          <h4>当前配置预览</h4>
          <pre className="config-preview">
            {JSON.stringify(navLinks, null, 2)}
          </pre>
        </div>
      </StyledWrapper>
  );
};



const StyledWrapper = styled.div`
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  max-height: 80vh;
  overflow-y: auto;

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e7eb;

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: #1f2937;
      margin: 0;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
  }

  .btn-primary {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #2563eb;
    }
  }

  .btn-template {
    background: #8b5cf6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #7c3aed;
    }
  }

  .save-status {
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 4px;

    &.saving {
      background: #fef3c7;
      color: #92400e;
    }

    &.saved {
      background: #d1fae5;
      color: #065f46;
    }

    &.error {
      background: #fee2e2;
      color: #991b1b;
    }
  }

  .add-form {
    background: #f9fafb;
    padding: 16px;
    border-radius: 6px;
    margin-bottom: 20px;

    h4 {
      font-size: 18px;
      font-weight: 500;
      color: #374151;
      margin-bottom: 12px;
    }

    .form-row {
      display: flex;
      gap: 12px;
      align-items: center;

      input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 14px;
        color: #1f2937;
        background: white;

        &:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        &::placeholder {
          color: #9ca3af;
        }
      }
    }
  }

  .btn-success {
    background: #10b981;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #059669;
    }
  }

  .btn-cancel {
    background: #6b7280;
    color: white;
    border: none;
    padding: 8px 12px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #4b5563;
    }
  }

  .nav-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .nav-item {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 16px;
  }

  .nav-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .nav-info {
    display: flex;
    align-items: center;
    gap: 16px;

    .nav-name {
      font-weight: 500;
      color: #1f2937;
    }

    .nav-path-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-path {
      font-size: 14px;
      color: #6b7280;
    }
  }

  .nav-actions {
    display: flex;
    gap: 8px;
  }

  .btn-icon {
    padding: 8px;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: background-color 0.2s;
    color: #3b82f6;

    &:hover {
      background: #eff6ff;
    }

    &.btn-danger {
      color: #dc2626;

      &:hover {
        background: #fef2f2;
      }
    }
  }

  .sub-nav-list {
    margin-top: 16px;
    padding-left: 24px;
    border-left: 2px solid #e5e7eb;
  }

  .sub-nav-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #f9fafb;
    border-radius: 4px;
    margin-bottom: 8px;
  }

  .sub-nav-info {
    display: flex;
    flex-direction: column;

    .sub-nav-name {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
    }

    .sub-nav-path {
      font-size: 12px;
      color: #6b7280;
    }
  }

  .add-sub-form {
    background: #eff6ff;
    padding: 12px;
    border-radius: 4px;
    margin-top: 8px;

    .form-row {
      display: flex;
      gap: 8px;
      align-items: center;

      input {
        flex: 1;
        padding: 6px 8px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 14px;
        color: #1f2937;
        background: white;

        &:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        &::placeholder {
          color: #9ca3af;
        }
      }
    }

    .path-input-container {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;

    input {
      flex: 1;
    }
  }

  .btn-path-helper {
    background: #f3f4f6;
    color: #6b7280;
    border: 1px solid #d1d5db;
    padding: 6px;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.2s;

    &:hover {
      background: #e5e7eb;
      color: #374151;
    }
  }

    .path-helper {
      margin-top: 12px;
      padding: 12px;
      background: #f0f9ff;
      border-radius: 6px;
      border: 1px solid #bae6fd;

      .helper-section {
        margin-bottom: 12px;

        &:last-child {
          margin-bottom: 0;
        }

        h5 {
          font-size: 14px;
          font-weight: 600;
          color: #0c4a6e;
          margin-bottom: 8px;
        }
      }

      .template-buttons, .param-buttons {
         display: flex;
         flex-wrap: wrap;
         gap: 6px;
       }

       .btn-template-quick {
         background: #fef3c7;
         color: #92400e;
         border: 1px solid #fcd34d;
         padding: 6px 12px;
         border-radius: 4px;
         font-size: 12px;
         cursor: pointer;
         transition: all 0.2s;

         &:hover {
           background: #fde68a;
           border-color: #f59e0b;
         }
       }

      .btn-param {
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #93c5fd;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
          background: #bfdbfe;
          border-color: #60a5fa;
        }
      }

      .btn-inherit {
        background: #ecfdf5;
        color: #059669;
        border: 1px solid #a7f3d0;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        font-family: 'Courier New', monospace;

        &:hover {
          background: #d1fae5;
          border-color: #6ee7b7;
        }
      }
    }
  }

  .show-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: #6b7280;
    cursor: pointer;

    input[type="checkbox"] {
      border-radius: 4px;
    }
  }

   .template-selector {
     background: #f0f9ff;
     padding: 20px;
     border-radius: 8px;
     margin-bottom: 20px;
     border: 2px solid #0ea5e9;

     h4 {
       font-size: 18px;
       font-weight: 600;
       color: #0c4a6e;
       margin-bottom: 16px;
     }
   }

   .template-grid {
     display: grid;
     grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
     gap: 16px;
     margin-bottom: 16px;
   }

   .template-card {
     background: white;
     border: 1px solid #e2e8f0;
     border-radius: 8px;
     padding: 16px;
     transition: all 0.2s;

     &:hover {
       border-color: #8b5cf6;
       box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
     }
   }

   .template-header {
     margin-bottom: 12px;

     h5 {
       font-size: 16px;
       font-weight: 600;
       color: #1f2937;
       margin-bottom: 4px;
     }

     .template-path {
       font-size: 14px;
       color: #6b7280;
       font-family: 'Courier New', monospace;
       background: #f3f4f6;
       padding: 2px 6px;
       border-radius: 4px;
     }
   }

   .template-preview {
     display: flex;
     align-items: center;
     gap: 8px;
     margin-bottom: 12px;
     padding: 8px;
     background: #f9fafb;
     border-radius: 4px;

     .preview-label {
       font-size: 12px;
       color: #6b7280;
       font-weight: 500;
     }

     .preview-path {
       font-size: 13px;
       color: #059669;
       font-family: 'Courier New', monospace;
       flex: 1;
     }
   }

   .template-subroutes {
     margin-bottom: 12px;

     .subroutes-label {
       font-size: 12px;
       color: #6b7280;
       font-weight: 500;
       display: block;
       margin-bottom: 6px;
     }

     .subroutes-list {
       display: flex;
       flex-wrap: wrap;
       gap: 4px;
     }

     .subroute-tag {
       font-size: 11px;
       background: #ddd6fe;
       color: #5b21b6;
       padding: 2px 6px;
       border-radius: 12px;
       font-weight: 500;
     }
   }

   .btn-use-template {
     background: #8b5cf6;
     color: white;
     border: none;
     padding: 8px 16px;
     border-radius: 6px;
     font-size: 14px;
     cursor: pointer;
     transition: background-color 0.2s;
     width: 100%;

     &:hover {
       background: #7c3aed;
     }
   }

   .btn-copy, .btn-copy-small {
     background: transparent;
     border: 1px solid #d1d5db;
     color: #6b7280;
     padding: 4px;
     border-radius: 4px;
     cursor: pointer;
     display: flex;
     align-items: center;
     transition: all 0.2s;

     &:hover {
       background: #f3f4f6;
       border-color: #9ca3af;
       color: #374151;
     }
   }

   .path-preview {
     margin-top: 12px;
     padding: 8px 12px;
     background: #f0fdf4;
     border-radius: 4px;
     border: 1px solid #bbf7d0;
     display: flex;
     align-items: center;
     gap: 8px;

     .preview-label {
       font-size: 12px;
       color: #166534;
       font-weight: 500;
     }

     .preview-path {
       font-size: 13px;
       color: #059669;
       font-family: 'Courier New', monospace;
     }
   }

   .preview-section {
     margin-top: 20px;
     padding: 16px;
     background: #f8fafc;
     border-radius: 6px;
     border: 1px solid #e2e8f0;

     h4 {
       font-size: 16px;
       font-weight: 500;
       color: #374151;
       margin-bottom: 12px;
     }

     .config-preview {
       background: #1f2937;
       color: #f9fafb;
       padding: 12px;
       border-radius: 4px;
       font-size: 12px;
       font-family: 'Courier New', monospace;
       overflow-x: auto;
       white-space: pre-wrap;
       max-height: 300px;
       overflow-y: auto;
     }
   }

   .path-input-container {
     display: flex;
     align-items: center;
     gap: 8px;
     flex: 1;
   }

   .btn-username {
     background: #10b981;
     color: white;
     border: none;
     padding: 6px 10px;
     border-radius: 4px;
     font-size: 14px;
     cursor: pointer;
     transition: all 0.2s;
     display: flex;
     align-items: center;
     white-space: nowrap;

     &:hover {
       background: #059669;
       transform: scale(1.05);
     }

     &:active {
       transform: scale(0.95);
     }
   }

   .btn-path-helper {
     background: #6b7280;
     color: white;
     border: none;
     padding: 6px 8px;
     border-radius: 4px;
     cursor: pointer;
     transition: background-color 0.2s;
     display: flex;
     align-items: center;

     &:hover {
       background: #4b5563;
     }
   }

   .path-helper {
     margin-top: 12px;
     padding: 16px;
     background: #f8fafc;
     border-radius: 6px;
     border: 1px solid #e2e8f0;
   }

   .helper-section {
     margin-bottom: 16px;

     &:last-child {
       margin-bottom: 0;
     }

     h5 {
       font-size: 14px;
       font-weight: 600;
       color: #374151;
       margin-bottom: 8px;
     }
   }

   .param-buttons, .template-buttons {
     display: flex;
     flex-wrap: wrap;
     gap: 6px;
   }

   .btn-param {
     background: #e5e7eb;
     color: #374151;
     border: none;
     padding: 6px 12px;
     border-radius: 4px;
     font-size: 12px;
     cursor: pointer;
     transition: all 0.2s;
     white-space: nowrap;

     &:hover {
       background: #d1d5db;
       transform: translateY(-1px);
     }
   }

   .btn-param-highlight {
     background: #dcfce7;
     color: #166534;
     border: 1px solid #bbf7d0;
     font-weight: 600;

     &:hover {
       background: #bbf7d0;
       border-color: #86efac;
     }
   }

   .btn-template-quick {
     background: #ddd6fe;
     color: #5b21b6;
     border: none;
     padding: 6px 12px;
     border-radius: 4px;
     font-size: 12px;
     cursor: pointer;
     transition: all 0.2s;
     white-space: nowrap;

     &:hover {
       background: #c4b5fd;
       transform: translateY(-1px);
     }
   }

   .btn-inherit {
     background: #fef3c7;
     color: #92400e;
     border: 1px solid #fcd34d;
     padding: 8px 12px;
     border-radius: 4px;
     font-size: 12px;
     cursor: pointer;
     transition: all 0.2s;
     font-family: 'Courier New', monospace;

     &:hover {
       background: #fcd34d;
       border-color: #f59e0b;
     }
   }
 `;

export default NavLinksManager;