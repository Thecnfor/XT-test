import React from 'react';

export default function AIPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">AI项目</h1>
      <p className="mb-6">欢迎来到AI项目页面，这里展示各种AI相关的项目和资源。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">项目列表</h2>
          <p>探索我们的AI项目集合</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">教程</h2>
          <p>学习AI相关的技术和工具</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">资源</h2>
          <p>获取AI开发所需的资源和材料</p>
        </div>
      </div>
    </div>
  );
}