#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 检查是否安装了依赖
function checkDependencies() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const nodeModulesPath = path.join(__dirname, '../node_modules');
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('📦 检测到缺少依赖，正在安装...');
    return false;
  }
  
  try {
    require('chokidar');
    return true;
  } catch (error) {
    console.log('📦 检测到缺少chokidar依赖，正在安装...');
    return false;
  }
}

// 安装依赖
function installDependencies() {
  return new Promise((resolve, reject) => {
    const npm = spawn('npm', ['install'], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      shell: true
    });
    
    npm.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 依赖安装完成');
        resolve();
      } else {
        console.error('❌ 依赖安装失败');
        reject(new Error(`npm install failed with code ${code}`));
      }
    });
  });
}

// 启动内容管理器
function startContentManager() {
  console.log('🚀 启动动态内容管理系统...');
  console.log('📁 监控目录: control/');
  console.log('🎯 目标目录: src/app/(layout)/');
  console.log('🔗 链接文件: src/lib/links.ts');
  console.log('\n按 Ctrl+C 停止监控\n');
  
  const ContentManager = require('./content-manager');
  const manager = new ContentManager();
  
  // 优雅退出处理
  process.on('SIGINT', () => {
    console.log('\n🛑 正在停止内容管理器...');
    manager.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('\n🛑 正在停止内容管理器...');
    manager.stop();
    process.exit(0);
  });
}

// 主函数
async function main() {
  console.log('🎉 欢迎使用动态内容管理系统！');
  console.log('=' .repeat(50));
  
  try {
    if (!checkDependencies()) {
      await installDependencies();
    }
    
    startContentManager();
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 检查命令行参数
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
动态内容管理系统

用法:
  node start-content-manager.js [选项]

选项:
  --help, -h     显示帮助信息
  --sync-only    仅同步现有内容，不启动监控

功能:
  - 监控 control/ 目录中的 HTML 和 TSX 文件
  - 自动生成对应的 Next.js 页面
  - 自动更新导航链接配置
  - 支持嵌套目录结构（最多两层）

示例:
  # 启动文件监控
  npm run content:watch
  
  # 仅同步现有内容
  npm run content:sync
`);
  process.exit(0);
}

if (args.includes('--sync-only')) {
  console.log('🔄 仅同步现有内容...');
  const ContentManager = require('./content-manager');
  const manager = new ContentManager();
  manager.syncExistingContent();
  console.log('✅ 同步完成');
  process.exit(0);
}

// 启动主程序
main();