
```bash
# 1. 构建项目
npm run build

# 2. 压缩部署包
tar -czvf deploy.tar.gz .next public package*.json next.config.ts

# 3. 上传到服务器后解压
tar -xzvf deploy.tar.gz

# 4. 安装生产依赖
npm install --production

# 5. 启动服务
npm run start
```