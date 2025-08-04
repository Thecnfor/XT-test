import React from 'react';

export default function DataPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">数据</h1>
      <p className="mb-6">欢迎来到数据页面，这里提供数据分析、数据库和可视化相关内容。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">数据分析</h2>
          <p>数据处理和分析技术</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">数据库</h2>
          <p>数据库管理和查询技巧</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">可视化</h2>
          <p>数据可视化工具和技术</p>
        </div>
      </div>
    </div>
  );
}