// 统一管理导航链接
const navLinks = {
  '日志&笔记': {
    path: '/log',
    hasSubLinks: true,
    subLinks: {
      '日常记录': { path: '/log/daily', hasSubLinks: false },
      '技术笔记': { path: '/log/tech', hasSubLinks: false },
      '学习心得': { path: '/log/learning', hasSubLinks: false },
    },
    学习资源: {
      '项目案例': { path: '/log/cases', hasSubLinks: false },
      '资源': { path: '/log/resources', hasSubLinks: false },
    }
  },
  'AI项目': {
    path: '/ai',
    hasSubLinks: true,
    subLinks: {
      '项目列表': { path: '/ai/projects', hasSubLinks: false },
      '教程': { path: '/ai/tutorials', hasSubLinks: false },
      '资源': { path: '/ai/resources', hasSubLinks: false },
    },
    目标: {
      '项目案例': { path: '/ai/cases', hasSubLinks: false },
      '资源': { path: '/ai/resources', hasSubLinks: false },
    }
  },
  '树莓派': {
    path: '/raspberry',
    hasSubLinks: true,
    subLinks: {
      '入门指南': { path: '/raspberry/guide', hasSubLinks: false },
      '项目案例': { path: '/raspberry/projects', hasSubLinks: false },
      '硬件推荐': { path: '/raspberry/hardware', hasSubLinks: false },
    },
    研发: {
      '项目案例': { path: '/raspberry/cases', hasSubLinks: false },
      '硬件推荐': { path: '/raspberry/hardware', hasSubLinks: false },
    }
  },
  '云控制': {
    path: '/cloud',
    hasSubLinks: true,
    subLinks: {
      '云服务': { path: '/cloud/services', hasSubLinks: false },
      '自动化脚本': { path: '/cloud/scripts', hasSubLinks: false },
      '远程控制': { path: '/cloud/remote', hasSubLinks: false },
    },
    安全: {
      '云平台': { path: '/cloud/platforms', hasSubLinks: false },
      '云安全': { path: '/cloud/security', hasSubLinks: false },
      '云成本': { path: '/cloud/cost', hasSubLinks: false },
    }
  },
  '视觉思维': {
    path: '/vision',
    hasSubLinks: true,
    subLinks: {
      '思维导图': { path: '/vision/mindmap', hasSubLinks: false },
      '流程图': { path: '/vision/flowchart', hasSubLinks: false },
      '设计工具': { path: '/vision/tools', hasSubLinks: false },
    },
    设计: {
      '设计规范': { path: '/vision/design', hasSubLinks: false },
      '设计案例': { path: '/vision/cases', hasSubLinks: false },
      '设计资源': { path: '/vision/resources', hasSubLinks: false },
    }
  },
  '数据': {
    path: '/data',
    hasSubLinks: true,
    subLinks: {
      '数据分析': { path: '/data/analysis', hasSubLinks: false },
      '数据库': { path: '/data/database', hasSubLinks: false },
      '可视化': { path: '/data/visualization', hasSubLinks: false },
    },
    数据: {
      '数据挖掘': { path: '/data/mining', hasSubLinks: false },
      '数据安全': { path: '/data/security', hasSubLinks: false },
      '数据隐私': { path: '/data/privacy', hasSubLinks: false },
    }
  },
  '物联网': {
    path: '/iot',
    hasSubLinks: true,
    subLinks: {
      '设备列表': { path: '/iot/devices', hasSubLinks: false },
      '传感器': { path: '/iot/sensors', hasSubLinks: false },
      '自动化': { path: '/iot/automation', hasSubLinks: false },
    },
    物联网: {
      '协议': { path: '/iot/protocols', hasSubLinks: false },
      '应用案例': { path: '/iot/cases', hasSubLinks: false },
      '资源': { path: '/iot/resources', hasSubLinks: false },
    }
  },
  '机器学习': {
    path: '/ml',
    hasSubLinks: true,
    subLinks: {
      '算法': { path: '/ml/algorithms', hasSubLinks: false },
      '框架': { path: '/ml/frameworks', hasSubLinks: false },
      '应用案例': { path: '/ml/cases', hasSubLinks: false },
    },
    机器学习: {
      '数据集': { path: '/ml/datasets', hasSubLinks: false },
      '模型评估': { path: '/ml/evaluation', hasSubLinks: false },
      '部署方案': { path: '/ml/deployment', hasSubLinks: false },
    }
  },
};



export default navLinks;