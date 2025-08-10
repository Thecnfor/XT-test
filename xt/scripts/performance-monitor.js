#!/usr/bin/env node

/**
 * 性能监控脚本
 * 用于定期检查bundle大小和性能指标
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class PerformanceMonitor {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.buildDir = path.join(this.projectRoot, '.next');
    this.reportDir = path.join(this.projectRoot, 'performance-reports');
    
    // 确保报告目录存在
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',
      success: '\x1b[32m',
      warning: '\x1b[33m',
      error: '\x1b[31m',
      reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async generateReport() {
    this.log('🚀 开始性能监控...', 'info');
    
    const report = {
      timestamp: new Date().toISOString(),
      bundleAnalysis: await this.analyzeBundleSize(),
      performanceMetrics: await this.getPerformanceMetrics(),
      recommendations: this.getRecommendations()
    };
    
    // 保存报告
    const reportFile = path.join(
      this.reportDir, 
      `performance-${new Date().toISOString().split('T')[0]}.json`
    );
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    this.log(`📊 性能报告已保存: ${reportFile}`, 'success');
    
    // 生成摘要
    this.generateSummary(report);
    
    return report;
  }

  async analyzeBundleSize() {
    this.log('📦 分析Bundle大小...', 'info');
    
    const buildManifest = path.join(this.buildDir, 'build-manifest.json');
    if (!fs.existsSync(buildManifest)) {
      this.log('⚠️  构建清单不存在，请先运行构建', 'warning');
      return null;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'));
      const analysis = {
        totalPages: Object.keys(manifest.pages).length,
        pages: {},
        totalSize: 0
      };

      Object.entries(manifest.pages).forEach(([page, files]) => {
        let pageSize = 0;
        const pageFiles = [];
        
        files.forEach(file => {
          if (file.endsWith('.js')) {
            const filePath = path.join(this.projectRoot, '.next', file);
            if (fs.existsSync(filePath)) {
              const stats = fs.statSync(filePath);
              pageSize += stats.size;
              pageFiles.push({
                file: file,
                size: stats.size,
                sizeKB: Math.round(stats.size / 1024)
              });
            }
          }
        });
        
        analysis.pages[page] = {
          files: pageFiles,
          totalSize: pageSize,
          totalSizeKB: Math.round(pageSize / 1024)
        };
        
        analysis.totalSize += pageSize;
      });
      
      analysis.totalSizeKB = Math.round(analysis.totalSize / 1024);
      analysis.totalSizeMB = Math.round(analysis.totalSize / (1024 * 1024) * 100) / 100;
      
      return analysis;
    } catch (error) {
      this.log(`❌ 分析Bundle失败: ${error.message}`, 'error');
      return null;
    }
  }

  async getPerformanceMetrics() {
    this.log('⚡ 收集性能指标...', 'info');
    
    const packageJson = path.join(this.projectRoot, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
    
    return {
      dependencies: {
        total: Object.keys(pkg.dependencies || {}).length,
        dev: Object.keys(pkg.devDependencies || {}).length,
        largeDeps: this.findLargeDependencies(pkg)
      },
      buildTime: this.getLastBuildTime(),
      nodeModulesSize: await this.getNodeModulesSize()
    };
  }

  findLargeDependencies(pkg) {
    const knownLargeDeps = [
      'gsap', 'openai', 'socket.io-client', 'styled-components',
      'framer-motion', 'lodash', '@radix-ui/react-icons',
      '@tabler/icons-react', 'lucide-react'
    ];
    
    return knownLargeDeps.filter(dep => 
      pkg.dependencies[dep] || pkg.devDependencies[dep]
    );
  }

  getLastBuildTime() {
    const buildDir = path.join(this.projectRoot, '.next');
    if (fs.existsSync(buildDir)) {
      const stats = fs.statSync(buildDir);
      return stats.mtime.toISOString();
    }
    return null;
  }

  async getNodeModulesSize() {
    const nodeModulesDir = path.join(this.projectRoot, 'node_modules');
    if (!fs.existsSync(nodeModulesDir)) {
      return 0;
    }
    
    try {
      // 简单估算，实际可能需要递归计算
      const stats = fs.statSync(nodeModulesDir);
      return Math.round(stats.size / (1024 * 1024)); // MB
    } catch (error) {
      return 0;
    }
  }

  getRecommendations() {
    return [
      {
        category: 'Bundle优化',
        items: [
          '检查未使用的依赖包',
          '实施代码分割和懒加载',
          '优化第三方库导入方式'
        ]
      },
      {
        category: '性能优化',
        items: [
          '启用图片优化',
          '实施缓存策略',
          '考虑使用CDN'
        ]
      },
      {
        category: '监控建议',
        items: [
          '定期运行性能分析',
          '监控Core Web Vitals',
          '设置性能预算'
        ]
      }
    ];
  }

  generateSummary(report) {
    this.log('📋 生成性能摘要...', 'info');
    
    console.log('\n=== 性能监控摘要 ===');
    
    if (report.bundleAnalysis) {
      console.log(`📦 总Bundle大小: ${report.bundleAnalysis.totalSizeMB}MB`);
      console.log(`📄 页面数量: ${report.bundleAnalysis.totalPages}`);
      
      // 显示最大的页面
      const largestPage = Object.entries(report.bundleAnalysis.pages)
        .sort(([,a], [,b]) => b.totalSize - a.totalSize)[0];
      
      if (largestPage) {
        console.log(`🔍 最大页面: ${largestPage[0]} (${largestPage[1].totalSizeKB}KB)`);
      }
    }
    
    if (report.performanceMetrics) {
      console.log(`📚 依赖包数量: ${report.performanceMetrics.dependencies.total}`);
      
      if (report.performanceMetrics.dependencies.largeDeps.length > 0) {
        console.log(`⚠️  大型依赖: ${report.performanceMetrics.dependencies.largeDeps.join(', ')}`);
      }
    }
    
    console.log('\n💡 优化建议:');
    report.recommendations.forEach(rec => {
      console.log(`\n${rec.category}:`);
      rec.items.forEach(item => console.log(`  - ${item}`));
    });
    
    console.log('\n===================\n');
  }

  async compareWithPrevious() {
    const reports = fs.readdirSync(this.reportDir)
      .filter(file => file.startsWith('performance-') && file.endsWith('.json'))
      .sort()
      .slice(-2); // 获取最近两个报告
    
    if (reports.length < 2) {
      this.log('📊 没有足够的历史数据进行比较', 'info');
      return;
    }
    
    const [prev, current] = reports.map(file => 
      JSON.parse(fs.readFileSync(path.join(this.reportDir, file), 'utf8'))
    );
    
    this.log('📈 与上次报告比较:', 'info');
    
    if (prev.bundleAnalysis && current.bundleAnalysis) {
      const sizeDiff = current.bundleAnalysis.totalSize - prev.bundleAnalysis.totalSize;
      const diffKB = Math.round(sizeDiff / 1024);
      
      if (sizeDiff > 0) {
        this.log(`📈 Bundle大小增加了 ${diffKB}KB`, 'warning');
      } else if (sizeDiff < 0) {
        this.log(`📉 Bundle大小减少了 ${Math.abs(diffKB)}KB`, 'success');
      } else {
        this.log('📊 Bundle大小无变化', 'info');
      }
    }
  }
}

// 运行监控
if (require.main === module) {
  const monitor = new PerformanceMonitor();
  monitor.generateReport()
    .then(() => monitor.compareWithPrevious())
    .catch(console.error);
}

module.exports = PerformanceMonitor;