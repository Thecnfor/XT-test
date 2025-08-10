#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// 配置
const CONFIG = {
  serviceName: 'xt-content-manager',
  displayName: 'XT Dynamic Content Manager',
  description: 'Automatically manages dynamic content for XT Next.js application',
  logDir: path.join(__dirname, '../logs'),
  pidFile: path.join(__dirname, '../.content-manager.pid'),
  maxRestarts: 5,
  restartDelay: 5000, // 5秒
  healthCheckInterval: 30000, // 30秒
  logRotationSize: 10 * 1024 * 1024, // 10MB
  maxLogFiles: 5
};

// 日志管理类
class Logger {
  constructor() {
    this.ensureLogDir();
    this.logFile = path.join(CONFIG.logDir, `content-manager-${new Date().toISOString().split('T')[0]}.log`);
    this.errorFile = path.join(CONFIG.logDir, `content-manager-error-${new Date().toISOString().split('T')[0]}.log`);
  }

  ensureLogDir() {
    if (!fs.existsSync(CONFIG.logDir)) {
      fs.mkdirSync(CONFIG.logDir, { recursive: true });
    }
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      pid: process.pid
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    // 控制台输出
    const emoji = {
      'INFO': '📝',
      'WARN': '⚠️',
      'ERROR': '❌',
      'SUCCESS': '✅',
      'DEBUG': '🔍'
    };
    
    console.log(`${emoji[level] || '📝'} [${timestamp}] ${message}`);
    if (data) console.log('   ', data);
    
    // 文件输出
    const targetFile = level === 'ERROR' ? this.errorFile : this.logFile;
    fs.appendFileSync(targetFile, logLine);
    
    // 日志轮转
    this.rotateLogIfNeeded(targetFile);
  }

  rotateLogIfNeeded(filePath) {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size > CONFIG.logRotationSize) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const rotatedFile = filePath.replace('.log', `-${timestamp}.log`);
        fs.renameSync(filePath, rotatedFile);
        
        // 清理旧日志文件
        this.cleanOldLogs();
      }
    } catch (error) {
      // 忽略轮转错误
    }
  }

  cleanOldLogs() {
    try {
      const files = fs.readdirSync(CONFIG.logDir)
        .filter(file => file.includes('content-manager'))
        .map(file => ({
          name: file,
          path: path.join(CONFIG.logDir, file),
          mtime: fs.statSync(path.join(CONFIG.logDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (files.length > CONFIG.maxLogFiles) {
        files.slice(CONFIG.maxLogFiles).forEach(file => {
          fs.unlinkSync(file.path);
        });
      }
    } catch (error) {
      // 忽略清理错误
    }
  }

  info(message, data) { this.log('INFO', message, data); }
  warn(message, data) { this.log('WARN', message, data); }
  error(message, data) { this.log('ERROR', message, data); }
  success(message, data) { this.log('SUCCESS', message, data); }
  debug(message, data) { this.log('DEBUG', message, data); }
}

// 进程管理类
class ProcessManager {
  constructor(logger) {
    this.logger = logger;
    this.process = null;
    this.restartCount = 0;
    this.isShuttingDown = false;
    this.healthCheckTimer = null;
  }

  // 启动内容管理器进程
  start() {
    if (this.process) {
      this.logger.warn('进程已在运行中');
      return;
    }

    this.logger.info('启动内容管理器进程...');
    
    const scriptPath = path.join(__dirname, 'content-manager.js');
    this.process = spawn('node', [scriptPath], {
      cwd: path.join(__dirname, '..'),
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false
    });

    // 保存PID
    fs.writeFileSync(CONFIG.pidFile, this.process.pid.toString());
    this.logger.info(`进程已启动，PID: ${this.process.pid}`);

    // 处理进程输出
    this.process.stdout.on('data', (data) => {
      this.logger.info('STDOUT', data.toString().trim());
    });

    this.process.stderr.on('data', (data) => {
      this.logger.error('STDERR', data.toString().trim());
    });

    // 处理进程退出
    this.process.on('exit', (code, signal) => {
      this.logger.warn(`进程退出，代码: ${code}, 信号: ${signal}`);
      this.process = null;
      
      // 清理PID文件
      if (fs.existsSync(CONFIG.pidFile)) {
        fs.unlinkSync(CONFIG.pidFile);
      }

      // 自动重启逻辑
      if (!this.isShuttingDown && this.restartCount < CONFIG.maxRestarts) {
        this.restartCount++;
        this.logger.info(`准备重启进程 (${this.restartCount}/${CONFIG.maxRestarts})...`);
        
        setTimeout(() => {
          this.start();
        }, CONFIG.restartDelay);
      } else if (this.restartCount >= CONFIG.maxRestarts) {
        this.logger.error('达到最大重启次数，停止自动重启');
      }
    });

    this.process.on('error', (error) => {
      this.logger.error('进程错误', error);
    });

    // 启动健康检查
    this.startHealthCheck();
  }

  // 停止进程
  stop() {
    this.isShuttingDown = true;
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.process) {
      this.logger.info('正在停止内容管理器进程...');
      
      // 优雅关闭
      this.process.kill('SIGTERM');
      
      // 强制关闭超时
      setTimeout(() => {
        if (this.process) {
          this.logger.warn('强制终止进程');
          this.process.kill('SIGKILL');
        }
      }, 10000);
    }

    // 清理PID文件
    if (fs.existsSync(CONFIG.pidFile)) {
      fs.unlinkSync(CONFIG.pidFile);
    }
  }

  // 重启进程
  restart() {
    this.logger.info('重启内容管理器进程...');
    this.restartCount = 0; // 重置重启计数
    
    if (this.process) {
      this.process.once('exit', () => {
        setTimeout(() => {
          this.start();
        }, 1000);
      });
      this.stop();
    } else {
      this.start();
    }
  }

  // 健康检查
  startHealthCheck() {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, CONFIG.healthCheckInterval);
  }

  performHealthCheck() {
    if (!this.process) {
      this.logger.warn('健康检查：进程未运行');
      return;
    }

    // 检查进程是否还活着
    try {
      process.kill(this.process.pid, 0);
      this.logger.debug(`健康检查：进程 ${this.process.pid} 正常运行`);
      
      // 重置重启计数（如果进程稳定运行）
      if (this.restartCount > 0) {
        this.restartCount = Math.max(0, this.restartCount - 1);
      }
    } catch (error) {
      this.logger.error('健康检查：进程已死亡', error);
      this.process = null;
    }
  }

  // 获取状态
  getStatus() {
    return {
      running: !!this.process,
      pid: this.process ? this.process.pid : null,
      restartCount: this.restartCount,
      uptime: this.process ? Date.now() - this.process.spawnargs.startTime : 0
    };
  }
}

// Windows服务管理
class WindowsServiceManager {
  constructor(logger) {
    this.logger = logger;
  }

  // 安装Windows服务
  async installService() {
    if (os.platform() !== 'win32') {
      this.logger.warn('Windows服务仅在Windows系统上可用');
      return false;
    }

    try {
      const servicePath = path.join(__dirname, 'windows-service.js');
      await this.createServiceScript(servicePath);
      
      const command = `sc create "${CONFIG.serviceName}" binPath= "node \"${servicePath}\"" DisplayName= "${CONFIG.displayName}" start= auto`;
      
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          if (error) {
            this.logger.error('服务安装失败', error);
            reject(error);
          } else {
            this.logger.success('Windows服务安装成功');
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.error('服务安装过程出错', error);
      return false;
    }
  }

  // 创建Windows服务脚本
  async createServiceScript(servicePath) {
    const serviceScript = `
// Windows服务包装器
const { Service } = require('node-windows');
const path = require('path');

// 创建服务对象
const svc = new Service({
  name: '${CONFIG.serviceName}',
  description: '${CONFIG.description}',
  script: path.join(__dirname, 'auto-start-manager.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ]
});

// 监听安装事件
svc.on('install', () => {
  console.log('服务安装完成');
  svc.start();
});

// 监听启动事件
svc.on('start', () => {
  console.log('服务已启动');
});

// 安装服务
svc.install();
`;
    
    fs.writeFileSync(servicePath, serviceScript);
  }

  // 卸载Windows服务
  async uninstallService() {
    if (os.platform() !== 'win32') {
      return false;
    }

    const command = `sc delete "${CONFIG.serviceName}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('服务卸载失败', error);
          reject(error);
        } else {
          this.logger.success('Windows服务卸载成功');
          resolve(true);
        }
      });
    });
  }

  // 启动服务
  async startService() {
    const command = `sc start "${CONFIG.serviceName}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('服务启动失败', error);
          reject(error);
        } else {
          this.logger.success('Windows服务启动成功');
          resolve(true);
        }
      });
    });
  }

  // 停止服务
  async stopService() {
    const command = `sc stop "${CONFIG.serviceName}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          this.logger.error('服务停止失败', error);
          reject(error);
        } else {
          this.logger.success('Windows服务停止成功');
          resolve(true);
        }
      });
    });
  }
}

// 主应用类
class AutoStartManager {
  constructor() {
    this.logger = new Logger();
    this.processManager = new ProcessManager(this.logger);
    this.serviceManager = new WindowsServiceManager(this.logger);
    this.setupSignalHandlers();
  }

  // 设置信号处理
  setupSignalHandlers() {
    process.on('SIGINT', () => {
      this.logger.info('收到SIGINT信号，正在关闭...');
      this.shutdown();
    });

    process.on('SIGTERM', () => {
      this.logger.info('收到SIGTERM信号，正在关闭...');
      this.shutdown();
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('未捕获的异常', error);
      this.shutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('未处理的Promise拒绝', { reason, promise });
    });
  }

  // 启动管理器
  async start() {
    this.logger.info('🚀 启动自动内容管理器...');
    this.logger.info('配置信息', {
      serviceName: CONFIG.serviceName,
      logDir: CONFIG.logDir,
      maxRestarts: CONFIG.maxRestarts,
      platform: os.platform()
    });

    // 检查依赖
    await this.checkDependencies();
    
    // 启动进程管理器
    this.processManager.start();
    
    this.logger.success('自动内容管理器启动完成');
  }

  // 检查依赖
  async checkDependencies() {
    const packageJsonPath = path.join(__dirname, '../package.json');
    const nodeModulesPath = path.join(__dirname, '../node_modules');
    
    if (!fs.existsSync(nodeModulesPath)) {
      this.logger.info('安装依赖包...');
      await this.installDependencies();
    }
    
    try {
      require('chokidar');
      this.logger.debug('依赖检查通过');
    } catch (error) {
      this.logger.info('安装缺失的依赖...');
      await this.installDependencies();
    }
  }

  // 安装依赖
  installDependencies() {
    return new Promise((resolve, reject) => {
      const npm = spawn('npm', ['install'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        shell: true
      });
      
      npm.on('close', (code) => {
        if (code === 0) {
          this.logger.success('依赖安装完成');
          resolve();
        } else {
          this.logger.error('依赖安装失败');
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  // 关闭管理器
  shutdown() {
    this.logger.info('正在关闭自动内容管理器...');
    this.processManager.stop();
    
    setTimeout(() => {
      this.logger.info('自动内容管理器已关闭');
      process.exit(0);
    }, 2000);
  }

  // 重启
  restart() {
    this.logger.info('重启自动内容管理器...');
    this.processManager.restart();
  }

  // 获取状态
  getStatus() {
    return {
      manager: {
        running: true,
        pid: process.pid,
        uptime: process.uptime()
      },
      contentManager: this.processManager.getStatus(),
      config: CONFIG
    };
  }

  // 安装为系统服务
  async installAsService() {
    this.logger.info('安装为系统服务...');
    return await this.serviceManager.installService();
  }

  // 卸载系统服务
  async uninstallService() {
    this.logger.info('卸载系统服务...');
    return await this.serviceManager.uninstallService();
  }
}

// 命令行接口
function showHelp() {
  console.log(`
🚀 XT 自动内容管理器

用法:
  node auto-start-manager.js [命令] [选项]

命令:
  start              启动管理器 (默认)
  stop               停止管理器
  restart            重启管理器
  status             显示状态
  install-service    安装为Windows系统服务
  uninstall-service  卸载Windows系统服务
  start-service      启动Windows服务
  stop-service       停止Windows服务

选项:
  --help, -h         显示帮助信息
  --daemon, -d       以守护进程模式运行
  --verbose, -v      详细输出

示例:
  node auto-start-manager.js start
  node auto-start-manager.js install-service
  node auto-start-manager.js --daemon
`);
}

// 主函数
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';
  
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const manager = new AutoStartManager();

  try {
    switch (command) {
      case 'start':
        await manager.start();
        break;
        
      case 'stop':
        manager.shutdown();
        break;
        
      case 'restart':
        manager.restart();
        break;
        
      case 'status':
        console.log('状态信息:', JSON.stringify(manager.getStatus(), null, 2));
        process.exit(0);
        break;
        
      case 'install-service':
        await manager.installAsService();
        process.exit(0);
        break;
        
      case 'uninstall-service':
        await manager.uninstallService();
        process.exit(0);
        break;
        
      case 'start-service':
        await manager.serviceManager.startService();
        process.exit(0);
        break;
        
      case 'stop-service':
        await manager.serviceManager.stopService();
        process.exit(0);
        break;
        
      default:
        console.error(`未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ 执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

module.exports = AutoStartManager;