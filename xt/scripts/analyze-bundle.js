#!/usr/bin/env node

/**
 * Bundle分析和优化检查脚本
 * 使用方法: node scripts/analyze-bundle.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUNDLE_SIZE_LIMITS = {
  main: 250 * 1024, // 250KB gzipped
  chunk: 100 * 1024, // 100KB gzipped
  vendor: 500 * 1024, // 500KB gzipped
};

class BundleAnalyzer {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, '.next');
    this.statsFile = path.join(this.projectRoot, 'stats.json');
  }

  log(message, type = 'info') {
    const colors = {
      info: '\x1b[36m', // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m', // red
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}${message}${colors.reset}`);
  }

  async runAnalysis() {
    this.log('🚀 开始Bundle分析...', 'info');
    
    try {
      // 构建项目
      this.log('📦 构建项目...', 'info');
      execSync('npm run build', { 
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      // 生成分析报告
      this.log('📊 生成分析报告...', 'info');
      execSync('ANALYZE=true npm run build', { 
        cwd: this.projectRoot,
        stdio: 'inherit'
      });

      // 检查bundle大小
      this.checkBundleSize();
      
      // 分析依赖
      this.analyzeDependencies();
      
      // 生成优化建议
      this.generateOptimizationSuggestions();
      
      this.log('✅ Bundle分析完成！', 'success');
      this.log('📈 分析报告已在浏览器中打开', 'info');
      
    } catch (error) {
      this.log(`❌ 分析失败: ${error.message}`, 'error');
      process.exit(1);
    }
  }

  checkBundleSize() {
    this.log('🔍 检查Bundle大小...', 'info');
    
    const buildManifest = path.join(this.buildDir, 'build-manifest.json');
    if (!fs.existsSync(buildManifest)) {
      this.log('⚠️  构建清单文件不存在', 'warning');
      return;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'));
      const staticDir = path.join(this.buildDir, 'static');
      
      // 检查主要chunks
      Object.entries(manifest.pages).forEach(([page, files]) => {
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const filePath = path.join(this.projectRoot, '.next', file);
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              const sizeKB = Math.round(stats.size / 1024);
              
              if (stats.size > BUNDLE_SIZE_LIMITS.chunk) {
                this.log(`⚠️  ${page}: ${file} (${sizeKB}KB) 超过建议大小`, 'warning');
              } else {
                this.log(`✅ ${page}: ${file} (${sizeKB}KB)`, 'success');
              }
            }
          }
        });
      });
    } catch (error) {
      this.log(`❌ 读取构建清单失败: ${error.message}`, 'error');
    }
  }

  analyzeDependencies() {
    this.log('📦 分析依赖包...', 'info');
    
    const packageJson = path.join(this.projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    
    const largeDependencies = [
      'gsap',
      'openai', 
      'socket.io-client',
      'styled-components',
      'framer-motion',
      'lodash'
    ];
    
    const foundLargeDeps = largeDependencies.filter(dep => 
      pkg.dependencies[dep] || pkg.devDependencies[dep]
    );
    
    if (foundLargeDeps.length > 0) {
      this.log('🔍 发现大型依赖包:', 'warning');
      foundLargeDeps.forEach(dep => {
        this.log(`  - ${dep}`, 'warning');
      });
      this.log('💡 建议考虑按需导入或懒加载', 'info');
    }
  }

  generateOptimizationSuggestions() {
    this.log('💡 生成优化建议...', 'info');
    
    const suggestions = [
      '1. 检查是否有未使用的依赖包',
      '2. 考虑将大型组件改为懒加载',
      '3. 优化图片资源，使用WebP/AVIF格式',
      '4. 检查CSS是否有未使用的样式',
      '5. 考虑使用CDN加载第三方库',
      '6. 启用Gzip/Brotli压缩',
      '7. 实施服务端渲染(SSR)或静态生成(SSG)'
    ];
    
    this.log('📋 优化建议:', 'info');
    suggestions.forEach(suggestion => {
      this.log(`  ${suggestion}`, 'info');
    });
  }

  async generateReport() {
    const report = {
      timestamp: new Date().toISOString(),
      bundleSize: this.getBundleSize(),
      dependencies: this.getDependencyInfo(),
      suggestions: this.getOptimizationSuggestions()
    };
    
    const reportPath = path.join(this.projectRoot, 'bundle-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📄 详细报告已保存到: ${reportPath}`, 'success');
  }
}

// 运行分析
if (require.main === module) {
  const analyzer = new BundleAnalyzer();
  analyzer.runAnalysis().catch(console.error);
}

module.exports = BundleAnalyzer;