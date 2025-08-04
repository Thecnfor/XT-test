import React from 'react';

export default function VisionPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">视觉思维</h1>
      <p className="mb-6">欢迎来到视觉思维页面，这里提供思维导图、流程图和设计工具相关内容。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">思维导图</h2>
          <p>使用思维导图组织和可视化想法</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">流程图</h2>
          <p>创建流程和工作流图表</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">设计工具</h2>
          <p>视觉设计和创意工具推荐</p>
        </div>
      </div>
    </div>
  );
}