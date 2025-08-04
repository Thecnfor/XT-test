import React from 'react';

export default function ProjectCasesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">项目案例</h1>
      <p className="mb-6">展示各种学习项目和实践案例。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">个人博客系统</h2>
          <p className="text-gray-600">使用Next.js和MongoDB构建</p>
          <p className="mt-2">一个功能完整的个人博客系统，支持文章发布、评论、分类等功能。</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">待办事项应用</h2>
          <p className="text-gray-600">使用React和Firebase构建</p>
          <p className="mt-2">一个跨平台的待办事项应用，支持实时同步和提醒功能。</p>
        </div>
      </div>
    </div>
  );
}