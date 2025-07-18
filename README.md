# Xrak

Xrak 是一个基于 Next.js 和 Flask 的实时通信网站，支持用户间的即时消息传递。

## 技术栈概览

- **前端**：Next.js 15, React 19, Socket.io-client
- **后端**：FastApi
- **样式**：Tailwind CSS, Styled-components
- **开发工具**：TypeScript, ESLint, Sass

## 开发依赖库

### 后端依赖
```bash
# backend/requirements.txt
fastapi==0.111.0
uvicorn==0.30.1
python-multipart==0.0.9
socketio==5.11.2
python-engineio==4.8.2
pydantic-settings==2.3.0
```

### 前端依赖
```bash
# frontend/package.json 主要依赖
next@15.4.1
react@19.1.0
react-dom@19.1.0
socket.io-client@4.8.1
styled-components@6.1.19
```

## 快速开始

### 前端设置
1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

4. 部署服务器
```bash
npm run build
```

### 后端设置
1. 进入后端目录
```bash
cd backend
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 启动后端服务器
```bash
python run.py
```

## 部署到服务器的注意事项

### 环境配置
1. **生产环境**：使用 Node.js 18+ 和 Python 3.8+ 版本
2. **环境变量**：设置必要的环境变量，如数据库连接字符串、密钥等
   - 前端：可使用 `.env.production` 文件
   - 后端：可使用环境变量或配置文件
3. **依赖管理**：确保生产环境安装的依赖版本与开发环境一致

## 开发注意事项

- 遇到冗余文件夹时，可在母目录的 `.gitignore` 文件中添加规则
- 忽略单个文件直接写文件名：`文件名`
- 忽略文件夹使用：`/文件夹名`
- 提交代码前确保通过 ESLint 检查：`npm run lint`

## 多人协作配置

为了提高团队协作效率和代码质量，项目包含以下协作配置文件：

### 1. 代码风格和规范
- **ESLint**：前端代码使用 ESLint 进行代码风格检查，配置文件位于 `<mcfile name="eslint.config.mjs" path="d:\Hub\Xrak\frontend\eslint.config.mjs"></mcfile>`
- **TypeScript**：前端使用 TypeScript，配置文件位于 `<mcfile name="tsconfig.json" path="d:\Hub\Xrak\frontend\tsconfig.json"></mcfile>`
- **Next.js 配置**：前端框架配置文件位于 `<mcfile name="next.config.ts" path="d:\Hub\Xrak\frontend\next.config.ts"></mcfile>`
- **Git 属性**：使用 `<mcfile name=".gitattributes" path="d:\Hub\Xrak\.gitattributes"></mcfile>` 确保团队成员使用一致的文件格式和行尾结束符

### 2. 代码所有权
- 使用 `<mcfile name="CODEOWNERS" path="d:\Hub\Xrak\CODEOWNERS"></mcfile>` 定义代码库不同部分的负责人，有助于明确责任和加速代码审查

### 3. 贡献指南
- 详细的贡献指南位于 `<mcfile name="CONTRIBUTING.md" path="d:\Hub\Xrak\CONTRIBUTING.md"></mcfile>`，包含以下内容：
  - 开发环境设置步骤
  - 代码风格和规范
  - 提交代码流程
  - 分支策略
  - 问题报告和功能请求
  - 代码审查流程

### 4. 版本控制
- 推荐使用语义化版本管理
- 提交信息格式：`<类型>: <描述>`，例如 `feat: 添加用户认证功能`
- 主要分支策略：`main`（稳定版本）、`develop`（开发版本）、`feature/*`（功能开发）、`bugfix/*`（问题修复）

请所有团队成员在参与项目开发前仔细阅读这些配置文件，确保遵循统一的开发规范和流程。
