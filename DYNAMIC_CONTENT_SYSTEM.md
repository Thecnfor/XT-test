# 🚀 动态内容管理系统

这是一个为Next.js项目设计的动态内容管理系统，允许您通过简单地在`control/`目录中添加HTML或TSX文件来自动生成网站页面，无需重新部署。

## ✨ 功能特性

- 📁 **文件监控**: 自动监控`control/`目录中的文件变化
- 🔄 **动态生成**: 自动创建对应的Next.js页面组件
- 🔗 **链接更新**: 自动更新导航链接配置
- 💻 **多格式支持**: 支持HTML和TSX文件
- 🎨 **样式支持**: 完整的CSS和JavaScript支持
- 📱 **响应式**: 生成的页面自动适配移动设备
- 🗂️ **嵌套结构**: 支持最多两层目录嵌套

## 📋 系统要求

- Node.js 16+
- Next.js 13+
- npm 或 yarn

## 🛠️ 安装和设置

### 1. 安装依赖

```bash
cd xt
npm install
```

### 2. 启动内容管理器

```bash
# 启动文件监控（推荐）
npm run content:watch

# 或者仅同步现有内容
npm run content:sync
```

### 3. 启动Next.js开发服务器

```bash
# 在另一个终端窗口中
npm run dev
```

## 📁 目录结构

```
XT-test/
├── control/                 # 内容源目录
│   ├── ai/                 # AI项目分类
│   │   ├── projects/       # 子分类
│   │   │   └── page.tsx   # 页面文件
│   │   ├── tutorials/
│   │   │   └── page.html
│   │   └── example/
│   │       └── page.html
│   ├── data/              # 数据分析分类
│   └── ...
├── xt/
│   ├── src/
│   │   ├── app/(layout)/  # 自动生成的页面
│   │   │   ├── ai/
│   │   │   │   ├── projects/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── tutorials/
│   │   │   │       └── page.tsx
│   │   │   └── ...
│   │   └── lib/
│   │       └── links.ts   # 自动更新的导航配置
│   └── scripts/
│       ├── content-manager.js
│       └── start-content-manager.js
```

## 📝 使用方法

### 创建HTML页面

在`control/`目录中创建HTML文件：

```html
<!-- control/ai/my-project/page.html -->
<!DOCTYPE html>
<html>
<head>
    <title>我的AI项目</title>
    <style>
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .highlight { background: #f0f8ff; padding: 10px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 我的AI项目</h1>
        <div class="highlight">
            <p>这是一个动态生成的页面！</p>
        </div>
        <button onclick="showAlert()">点击我</button>
    </div>
    
    <script>
        function showAlert() {
            alert('Hello from dynamic content!');
        }
        
        console.log('页面已加载');
    </script>
</body>
</html>
```

### 创建React组件页面

在`control/`目录中创建TSX文件：

```tsx
// control/ai/react-demo/page.tsx
'use client';

import React, { useState } from 'react';

export default function ReactDemoPage() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">⚛️ React演示页面</h1>
      <div className="bg-blue-50 p-4 rounded-lg">
        <p className="mb-4">计数器: {count}</p>
        <button 
          className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
          onClick={() => setCount(count + 1)}
        >
          增加
        </button>
        <button 
          className="bg-gray-500 text-white px-4 py-2 rounded"
          onClick={() => setCount(0)}
        >
          重置
        </button>
      </div>
    </div>
  );
}
```

### 自动生成的结果

系统会自动：

1. **生成Next.js页面**: 在`src/app/(layout)/ai/my-project/page.tsx`创建页面组件
2. **更新导航链接**: 在`src/lib/links.ts`中添加相应的导航项
3. **实时同步**: 文件变化时自动更新

## 🔧 配置选项

### 自定义分类名称

编辑`scripts/content-manager.js`中的`getCategoryChineseName`函数：

```javascript
getCategoryChineseName(category) {
  const nameMap = {
    'ai': 'AI项目',
    'data': '数据分析',
    'blog': '博客文章',
    'portfolio': '作品集',
    // 添加您的自定义映射
  };
  
  return nameMap[category] || category;
}
```

### 修改监控目录

在`scripts/content-manager.js`中修改路径配置：

```javascript
const CONTROL_DIR = path.join(__dirname, '../../your-content-dir');
const APP_LAYOUT_DIR = path.join(__dirname, '../src/app/(layout)');
const LINKS_FILE = path.join(__dirname, '../src/lib/links.ts');
```

## 🎯 最佳实践

### 1. 文件命名

- 使用`page.html`或`page.tsx`作为页面文件名
- 目录名使用小写字母和连字符
- 避免使用特殊字符和空格

### 2. 目录结构

```
control/
├── category1/           # 主分类
│   ├── subcategory1/   # 子分类
│   │   └── page.html
│   └── subcategory2/
│       └── page.tsx
└── category2/
    └── page.html       # 直接在分类下的页面
```

### 3. HTML文件建议

- 使用完整的HTML结构
- 将CSS放在`<style>`标签中
- 将JavaScript放在`<script>`标签中
- 避免使用外部依赖（除非确保可用）

### 4. TSX文件建议

- 使用`'use client'`指令（如果需要客户端功能）
- 导出默认组件
- 使用TypeScript类型注解
- 遵循React最佳实践

## 🚨 注意事项

1. **文件监控**: 确保内容管理器在后台运行
2. **端口冲突**: 确保Next.js开发服务器端口可用
3. **文件权限**: 确保对目录有读写权限
4. **大文件**: 避免创建过大的文件（建议<1MB）
5. **嵌套限制**: 最多支持两层目录嵌套

## 🐛 故障排除

### 页面没有生成

1. 检查内容管理器是否运行
2. 查看控制台错误信息
3. 确认文件格式正确（.html或.tsx）
4. 检查目录权限

### 导航链接没有更新

1. 重启内容管理器
2. 手动运行同步命令：`npm run content:sync`
3. 检查`src/lib/links.ts`文件权限

### JavaScript不工作

1. 检查浏览器控制台错误
2. 确认使用`'use client'`指令（React组件）
3. 验证JavaScript语法正确性

## 📚 示例项目

查看`control/ai/`目录中的示例文件：

- `example/page.html` - HTML页面示例
- `components/page.tsx` - React组件示例

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个系统！

## 📄 许可证

MIT License

---

**享受动态内容创建的乐趣！** 🎉