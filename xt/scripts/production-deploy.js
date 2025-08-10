#!/usr/bin/env node

/**
 * 生产环境部署脚本
 * 用于在生产环境中部署和管理动态内容系统
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const os = require('os');

class ProductionDeployManager {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.controlDir = path.join(path.dirname(this.projectRoot), 'control');
        this.scriptsDir = path.join(this.projectRoot, 'scripts');
        this.configFile = path.join(this.projectRoot, 'production.config.json');
        this.logDir = path.join(this.projectRoot, 'logs');
        
        this.ensureDirectories();
        this.loadConfig();
    }

    ensureDirectories() {
        [this.logDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    loadConfig() {
        const defaultConfig = {
            port: process.env.PORT || 3000,
            nodeEnv: 'production',
            autoRestart: true,
            maxRestarts: 5,
            restartDelay: 5000,
            healthCheckInterval: 30000,
            logLevel: 'info',
            enableContentWatch: true,
            buildBeforeDeploy: true,
            pm2: {
                name: 'xt-content-system',
                instances: 'max',
                execMode: 'cluster',
                maxMemoryRestart: '1G',
                errorFile: './logs/pm2-error.log',
                outFile: './logs/pm2-out.log',
                logFile: './logs/pm2-combined.log'
            }
        };

        if (fs.existsSync(this.configFile)) {
            try {
                const userConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                this.config = { ...defaultConfig, ...userConfig };
            } catch (error) {
                console.warn('⚠️  配置文件解析失败，使用默认配置:', error.message);
                this.config = defaultConfig;
            }
        } else {
            this.config = defaultConfig;
            this.saveConfig();
        }
    }

    saveConfig() {
        fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
    }

    log(level, message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
        console.log(logMessage);
        
        // 写入日志文件
        const logFile = path.join(this.logDir, `production-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, logMessage + '\n');
    }

    async checkDependencies() {
        this.log('info', '检查依赖项...');
        
        // 检查 Node.js 版本
        const nodeVersion = process.version;
        this.log('info', `Node.js 版本: ${nodeVersion}`);
        
        // 检查 npm
        try {
            await this.execCommand('npm --version');
            this.log('info', 'npm 可用');
        } catch (error) {
            throw new Error('npm 不可用');
        }
        
        // 检查 PM2 (可选)
        try {
            await this.execCommand('pm2 --version');
            this.log('info', 'PM2 可用');
            this.pm2Available = true;
        } catch (error) {
            this.log('warn', 'PM2 不可用，将使用基本进程管理');
            this.pm2Available = false;
        }
    }

    async installDependencies() {
        this.log('info', '安装生产依赖...');
        
        try {
            await this.execCommand('npm ci --production', { cwd: this.projectRoot });
            this.log('info', '依赖安装完成');
        } catch (error) {
            this.log('error', '依赖安装失败: ' + error.message);
            throw error;
        }
    }

    async buildProject() {
        if (!this.config.buildBeforeDeploy) {
            this.log('info', '跳过构建步骤');
            return;
        }

        this.log('info', '构建项目...');
        
        try {
            await this.execCommand('npm run build', { cwd: this.projectRoot });
            this.log('info', '项目构建完成');
        } catch (error) {
            this.log('error', '项目构建失败: ' + error.message);
            throw error;
        }
    }

    async startContentManager() {
        this.log('info', '启动内容管理器...');
        
        if (this.pm2Available) {
            await this.startWithPM2();
        } else {
            await this.startWithNode();
        }
    }

    async startWithPM2() {
        const pm2Config = {
            name: this.config.pm2.name,
            script: path.join(this.scriptsDir, 'content-manager.js'),
            cwd: this.projectRoot,
            instances: this.config.pm2.instances,
            exec_mode: this.config.pm2.execMode,
            max_memory_restart: this.config.pm2.maxMemoryRestart,
            error_file: this.config.pm2.errorFile,
            out_file: this.config.pm2.outFile,
            log_file: this.config.pm2.logFile,
            env: {
                NODE_ENV: this.config.nodeEnv,
                PORT: this.config.port
            }
        };

        const configPath = path.join(this.projectRoot, 'ecosystem.config.js');
        const configContent = `module.exports = {
  apps: [${JSON.stringify(pm2Config, null, 4)}]
};`;
        
        fs.writeFileSync(configPath, configContent);
        
        try {
            await this.execCommand(`pm2 start ${configPath}`);
            this.log('info', 'PM2 启动成功');
        } catch (error) {
            this.log('error', 'PM2 启动失败: ' + error.message);
            throw error;
        }
    }

    async startWithNode() {
        this.log('info', '使用 Node.js 直接启动...');
        
        const env = {
            ...process.env,
            NODE_ENV: this.config.nodeEnv,
            PORT: this.config.port
        };

        const child = spawn('node', [path.join(this.scriptsDir, 'content-manager.js')], {
            cwd: this.projectRoot,
            env,
            stdio: 'inherit',
            detached: true
        });

        // 保存进程 ID
        const pidFile = path.join(this.projectRoot, 'content-manager.pid');
        fs.writeFileSync(pidFile, child.pid.toString());
        
        child.unref();
        this.log('info', `内容管理器启动，PID: ${child.pid}`);
    }

    async startNextJS() {
        this.log('info', '启动 Next.js 应用...');
        
        if (this.pm2Available) {
            const pm2Config = {
                name: 'xt-nextjs',
                script: 'npm',
                args: 'start',
                cwd: this.projectRoot,
                instances: this.config.pm2.instances,
                exec_mode: this.config.pm2.execMode,
                max_memory_restart: this.config.pm2.maxMemoryRestart,
                env: {
                    NODE_ENV: this.config.nodeEnv,
                    PORT: this.config.port
                }
            };

            const configPath = path.join(this.projectRoot, 'nextjs.ecosystem.config.js');
            const configContent = `module.exports = {
  apps: [${JSON.stringify(pm2Config, null, 4)}]
};`;
            
            fs.writeFileSync(configPath, configContent);
            
            try {
                await this.execCommand(`pm2 start ${configPath}`);
                this.log('info', 'Next.js PM2 启动成功');
            } catch (error) {
                this.log('error', 'Next.js PM2 启动失败: ' + error.message);
                throw error;
            }
        } else {
            const env = {
                ...process.env,
                NODE_ENV: this.config.nodeEnv,
                PORT: this.config.port
            };

            const child = spawn('npm', ['start'], {
                cwd: this.projectRoot,
                env,
                stdio: 'inherit',
                detached: true
            });

            const pidFile = path.join(this.projectRoot, 'nextjs.pid');
            fs.writeFileSync(pidFile, child.pid.toString());
            
            child.unref();
            this.log('info', `Next.js 启动，PID: ${child.pid}`);
        }
    }

    async stop() {
        this.log('info', '停止服务...');
        
        if (this.pm2Available) {
            try {
                await this.execCommand('pm2 stop all');
                await this.execCommand('pm2 delete all');
                this.log('info', 'PM2 服务已停止');
            } catch (error) {
                this.log('warn', 'PM2 停止失败: ' + error.message);
            }
        } else {
            // 停止 Node.js 进程
            const pidFiles = ['content-manager.pid', 'nextjs.pid'];
            
            for (const pidFile of pidFiles) {
                const pidPath = path.join(this.projectRoot, pidFile);
                if (fs.existsSync(pidPath)) {
                    try {
                        const pid = fs.readFileSync(pidPath, 'utf8').trim();
                        process.kill(parseInt(pid), 'SIGTERM');
                        fs.unlinkSync(pidPath);
                        this.log('info', `进程 ${pid} 已停止`);
                    } catch (error) {
                        this.log('warn', `停止进程失败: ${error.message}`);
                    }
                }
            }
        }
    }

    async status() {
        this.log('info', '检查服务状态...');
        
        if (this.pm2Available) {
            try {
                await this.execCommand('pm2 status');
            } catch (error) {
                this.log('error', 'PM2 状态检查失败: ' + error.message);
            }
        } else {
            const pidFiles = ['content-manager.pid', 'nextjs.pid'];
            
            for (const pidFile of pidFiles) {
                const pidPath = path.join(this.projectRoot, pidFile);
                if (fs.existsSync(pidPath)) {
                    const pid = fs.readFileSync(pidPath, 'utf8').trim();
                    try {
                        process.kill(parseInt(pid), 0);
                        this.log('info', `${pidFile.replace('.pid', '')} 运行中 (PID: ${pid})`);
                    } catch (error) {
                        this.log('warn', `${pidFile.replace('.pid', '')} 未运行`);
                        fs.unlinkSync(pidPath);
                    }
                } else {
                    this.log('info', `${pidFile.replace('.pid', '')} 未运行`);
                }
            }
        }
    }

    async deploy() {
        try {
            this.log('info', '开始生产环境部署...');
            
            await this.checkDependencies();
            await this.installDependencies();
            await this.buildProject();
            await this.startContentManager();
            await this.startNextJS();
            
            this.log('info', '🎉 生产环境部署完成！');
            this.log('info', `应用运行在: http://localhost:${this.config.port}`);
            
        } catch (error) {
            this.log('error', '部署失败: ' + error.message);
            throw error;
        }
    }

    async execCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            exec(command, options, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    showHelp() {
        console.log(`
🚀 XT 生产环境部署管理器

用法: node production-deploy.js [命令]

命令:
  deploy    部署到生产环境
  start     启动服务
  stop      停止服务
  restart   重启服务
  status    查看状态
  config    显示配置
  help      显示帮助

示例:
  node production-deploy.js deploy
  node production-deploy.js status
`);
    }
}

// 主程序
async function main() {
    const manager = new ProductionDeployManager();
    const command = process.argv[2] || 'help';

    try {
        switch (command) {
            case 'deploy':
                await manager.deploy();
                break;
            case 'start':
                await manager.startContentManager();
                await manager.startNextJS();
                break;
            case 'stop':
                await manager.stop();
                break;
            case 'restart':
                await manager.stop();
                await new Promise(resolve => setTimeout(resolve, 2000));
                await manager.startContentManager();
                await manager.startNextJS();
                break;
            case 'status':
                await manager.status();
                break;
            case 'config':
                console.log('当前配置:');
                console.log(JSON.stringify(manager.config, null, 2));
                break;
            case 'help':
            default:
                manager.showHelp();
                break;
        }
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = ProductionDeployManager;