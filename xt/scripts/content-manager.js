const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');

// 配置路径
const CONTROL_DIR = path.join(__dirname, '../../control');
const APP_LAYOUT_DIR = path.join(__dirname, '../src/app/(layout)');
const LINKS_FILE = path.join(__dirname, '../src/lib/links.ts');

// 监控control目录的变化
class ContentManager {
  constructor() {
    this.watcher = null;
    this.init();
  }

  init() {
    console.log('启动内容管理器...');
    this.syncExistingContent();
    this.startWatching();
  }

  // 同步现有内容
  syncExistingContent() {
    console.log('同步现有内容...');
    this.scanControlDirectory();
    this.updateLinksFile();
  }

  // 开始监控文件变化
  startWatching() {
    this.watcher = chokidar.watch(CONTROL_DIR, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      persistent: true
    });

    this.watcher
      .on('add', (filePath) => this.handleFileAdd(filePath))
      .on('unlink', (filePath) => this.handleFileRemove(filePath))
      .on('addDir', (dirPath) => this.handleDirAdd(dirPath))
      .on('unlinkDir', (dirPath) => this.handleDirRemove(dirPath));

    console.log('文件监控已启动');
  }

  // 处理文件添加
  handleFileAdd(filePath) {
    if (path.extname(filePath) === '.html' || path.extname(filePath) === '.tsx') {
      console.log(`检测到新文件: ${filePath}`);
      this.createNextJSPage(filePath);
      this.updateLinksFile();
    }
  }

  // 处理文件删除
  handleFileRemove(filePath) {
    if (path.extname(filePath) === '.html' || path.extname(filePath) === '.tsx') {
      console.log(`检测到文件删除: ${filePath}`);
      this.removeNextJSPage(filePath);
      this.updateLinksFile();
    }
  }

  // 处理目录添加
  handleDirAdd(dirPath) {
    console.log(`检测到新目录: ${dirPath}`);
    this.updateLinksFile();
  }

  // 处理目录删除
  handleDirRemove(dirPath) {
    console.log(`检测到目录删除: ${dirPath}`);
    this.removeNextJSDirectory(dirPath);
    this.updateLinksFile();
  }

  // 扫描control目录
  scanControlDirectory() {
    const categories = fs.readdirSync(CONTROL_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    categories.forEach(category => {
      const categoryPath = path.join(CONTROL_DIR, category);
      this.processCategory(category, categoryPath);
    });
  }

  // 处理分类目录
  processCategory(category, categoryPath) {
    const items = fs.readdirSync(categoryPath, { withFileTypes: true });
    
    items.forEach(item => {
      if (item.isDirectory()) {
        const subCategoryPath = path.join(categoryPath, item.name);
        this.processSubCategory(category, item.name, subCategoryPath);
      } else if (item.isFile() && (item.name.endsWith('.html') || item.name.endsWith('.tsx'))) {
        this.createNextJSPage(path.join(categoryPath, item.name));
      }
    });
  }

  // 处理子分类目录
  processSubCategory(category, subCategory, subCategoryPath) {
    const files = fs.readdirSync(subCategoryPath, { withFileTypes: true })
      .filter(dirent => dirent.isFile() && (dirent.name.endsWith('.html') || dirent.name.endsWith('.tsx')));

    files.forEach(file => {
      this.createNextJSPage(path.join(subCategoryPath, file.name));
    });
  }

  // 创建Next.js页面
  createNextJSPage(controlFilePath) {
    const relativePath = path.relative(CONTROL_DIR, controlFilePath);
    const pathParts = relativePath.split(path.sep);
    const fileName = path.basename(controlFilePath, path.extname(controlFilePath));
    
    // 构建目标路径
    let targetDir = APP_LAYOUT_DIR;
    for (let i = 0; i < pathParts.length - 1; i++) {
      targetDir = path.join(targetDir, pathParts[i]);
    }

    // 确保目录存在
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 读取原文件内容
    const originalContent = fs.readFileSync(controlFilePath, 'utf8');
    
    // 生成Next.js页面内容
    const pageContent = this.generatePageContent(originalContent, fileName, pathParts);
    
    // 写入页面文件
    const targetFile = path.join(targetDir, 'page.tsx');
    fs.writeFileSync(targetFile, pageContent);
    
    console.log(`已创建页面: ${targetFile}`);
  }

  // 生成页面内容
  generatePageContent(originalContent, fileName, pathParts) {
    const isHTML = originalContent.includes('<html>') || originalContent.includes('<!DOCTYPE');
    
    if (isHTML) {
      // 处理HTML文件
      return this.generateFromHTML(originalContent, fileName, pathParts);
    } else {
      // 处理TSX文件
      return this.generateFromTSX(originalContent, fileName, pathParts);
    }
  }

  // 从HTML生成React组件
  generateFromHTML(htmlContent, fileName, pathParts) {
    // 提取head中的style内容
    const styleMatches = htmlContent.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
    const styles = styleMatches.map(style => {
      const content = style.replace(/<\/?style[^>]*>/gi, '');
      return content.trim();
    }).filter(content => content.length > 0);
    
    // 提取body内容
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    let bodyContent = bodyMatch ? bodyMatch[1] : htmlContent;
    
    // 移除body中的script标签，因为我们会单独处理
    bodyContent = bodyContent.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
    
    // 提取script内容
    const scriptMatches = htmlContent.match(/<script[^>]*>([\s\S]*?)<\/script>/gi) || [];
    const scripts = scriptMatches.map(script => {
      const content = script.replace(/<\/?script[^>]*>/gi, '');
      return content.trim();
    }).filter(content => content.length > 0);

    // 处理特殊字符
    const escapedBodyContent = bodyContent
      .replace(/`/g, '\\`')
      .replace(/\${/g, '\\${')
      .replace(/\\n/g, '\\\\n');
    
    const escapedStyles = styles.map(style => 
      style.replace(/`/g, '\\`').replace(/\${/g, '\\${')
    );

    return `'use client';

import React, { useEffect } from 'react';

export default function ${this.toPascalCase(fileName)}Page() {
  useEffect(() => {
    // 动态加载CSS样式
    const styleElement = document.createElement('style');
    styleElement.textContent = \`${escapedStyles.join('\\n')}\`;
    document.head.appendChild(styleElement);
    
    // 动态加载的JavaScript逻辑
    ${scripts.map(script => `
    try {
      ${script}
    } catch (error) {
      console.error('Script execution error:', error);
    }`).join('\n')}
    
    // 清理函数
    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, []);

  return (
    <div className="dynamic-content">
      <div dangerouslySetInnerHTML={{
        __html: \`${escapedBodyContent}\`
      }} />
    </div>
  );
}
`;
  }

  // 从TSX生成React组件
  generateFromTSX(tsxContent, fileName, pathParts) {
    // 如果已经是有效的React组件，直接使用
    if (tsxContent.includes('export default')) {
      return tsxContent;
    }
    
    // 否则包装成组件
    return `'use client';

import React from 'react';

export default function ${this.toPascalCase(fileName)}Page() {
  return (
    <div className="dynamic-content">
      ${tsxContent}
    </div>
  );
}
`;
  }

  // 删除Next.js页面
  removeNextJSPage(controlFilePath) {
    const relativePath = path.relative(CONTROL_DIR, controlFilePath);
    const pathParts = relativePath.split(path.sep);
    
    let targetDir = APP_LAYOUT_DIR;
    for (let i = 0; i < pathParts.length - 1; i++) {
      targetDir = path.join(targetDir, pathParts[i]);
    }
    
    const targetFile = path.join(targetDir, 'page.tsx');
    if (fs.existsSync(targetFile)) {
      fs.unlinkSync(targetFile);
      console.log(`已删除页面: ${targetFile}`);
      
      // 如果目录为空，删除目录
      if (fs.readdirSync(targetDir).length === 0) {
        fs.rmdirSync(targetDir);
      }
    }
  }

  // 删除Next.js目录
  removeNextJSDirectory(controlDirPath) {
    const relativePath = path.relative(CONTROL_DIR, controlDirPath);
    const targetDir = path.join(APP_LAYOUT_DIR, relativePath);
    
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log(`已删除目录: ${targetDir}`);
    }
  }

  // 更新links.ts文件
  updateLinksFile() {
    console.log('更新导航链接...');
    
    const linksContent = this.generateLinksContent();
    fs.writeFileSync(LINKS_FILE, linksContent);
    
    console.log('导航链接已更新');
  }

  // 生成links.ts内容
  generateLinksContent() {
    const structure = this.buildNavigationStructure();
    
    let content = '// 统一管理导航链接\nconst navLinks = {\n';
    
    Object.entries(structure).forEach(([category, data]) => {
      content += `  '${category}': {\n`;
      content += `    path: '/${data.path}',\n`;
      content += `    hasSubLinks: ${Object.keys(data.subLinks).length > 0},\n`;
      content += `    show: true,\n`;
      
      if (Object.keys(data.subLinks).length > 0) {
        content += `    subLinks: {\n`;
        Object.entries(data.subLinks).forEach(([subName, subPath]) => {
          content += `      '${subName}': { path: '${subPath}', hasSubLinks: false },\n`;
        });
        content += `    },\n`;
      }
      
      content += `  },\n\n`;
    });
    
    content += '};\n\nexport default navLinks;\n';
    
    return content;
  }

  // 构建导航结构
  buildNavigationStructure() {
    const structure = {};
    
    // 扫描control目录
    const categories = fs.readdirSync(CONTROL_DIR, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    categories.forEach(category => {
      const categoryPath = path.join(CONTROL_DIR, category);
      const categoryData = {
        path: category,
        subLinks: {}
      };

      // 扫描子目录
      const items = fs.readdirSync(categoryPath, { withFileTypes: true });
      items.forEach(item => {
        if (item.isDirectory()) {
          const subPath = `/${category}/${item.name}`;
          categoryData.subLinks[item.name] = subPath;
        }
      });

      // 转换为中文名称（可以根据需要调整）
      const chineseName = this.getCategoryChineseName(category);
      structure[chineseName] = categoryData;
    });

    return structure;
  }

  // 获取分类的中文名称
  getCategoryChineseName(category) {
    const nameMap = {
      'ai': 'AI项目',
      'log': '日志&笔记',
      'raspberry': '树莓派',
      'cloud': '云控制',
      'vision': '视觉思维',
      'data': '数据',
      'iot': '物联网',
      'ml': '机器学习'
    };
    
    return nameMap[category] || category;
  }

  // 转换为PascalCase
  toPascalCase(str) {
    return str.replace(/(?:^|[\s-_])+(.)/g, (match, char) => char.toUpperCase());
  }

  // 停止监控
  stop() {
    if (this.watcher) {
      this.watcher.close();
      console.log('文件监控已停止');
    }
  }
}

// 启动内容管理器
if (require.main === module) {
  const manager = new ContentManager();
  
  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n正在停止内容管理器...');
    manager.stop();
    process.exit(0);
  });
}

module.exports = ContentManager;