import React from 'react';

export default function LearningResourcesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">学习资源</h1>
      <p className="mb-6">收集和整理的各种学习资料和工具。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">前端学习资料</h2>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li><a href="#" className="text-blue-600 hover:underline">React官方文档</a></li>
            <li><a href="#" className="text-blue-600 hover:underline">Next.js教程</a></li>
            <li><a href="#" className="text-blue-600 hover:underline">TypeScript入门指南</a></li>
          </ul>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">开发工具推荐</h2>
          <ul className="list-disc list-inside space-y-2 mt-2">
            <li><a href="#" className="text-blue-600 hover:underline">VS Code插件合集</a></li>
            <li><a href="#" className="text-blue-600 hover:underline">代码格式化工具</a></li>
            <li><a href="#" className="text-blue-600 hover:underline">性能分析工具</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
}