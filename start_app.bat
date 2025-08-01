@echo off

:: 启动后端服务
start cmd /k "cd server && python app.py"

:: 等待后端服务启动
timeout /t 3 /nobreak

:: 启动前端服务
start cmd /k "cd xt && npm run dev"

:: 打开浏览器
start http://localhost:3000

:: 提示用户
 echo 应用已启动，请在浏览器中访问 http://localhost:3000
 echo 如需停止服务，请关闭所有命令窗口
pause