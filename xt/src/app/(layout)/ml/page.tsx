import React from 'react';

export default function MLPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">机器学习</h1>
      <p className="mb-6">欢迎来到机器学习页面，这里提供算法、框架和应用案例相关内容。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">算法</h2>
          <p>各种机器学习算法详解</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">框架</h2>
          <p>机器学习框架使用指南</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">应用案例</h2>
          <p>机器学习实际应用案例</p>
        </div>
      </div>
    </div>
  );
}