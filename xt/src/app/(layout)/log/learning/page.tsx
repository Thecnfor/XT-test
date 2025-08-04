import React from 'react';

export default function LearningPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">学习心得</h1>
      <p className="mb-6">记录学习过程中的感悟和体会。</p>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">前端架构学习心得</h2>
          <p className="text-gray-600">2023年10月12日</p>
          <p className="mt-2">通过学习大型前端项目架构，深刻体会到模块化和组件化的重要性，以及如何设计可扩展的系统。</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">算法学习方法</h2>
          <p className="text-gray-600">2023年10月8日</p>
          <p className="mt-2">掌握了分阶段学习算法的方法，从理解概念到实际应用，再到优化改进，循序渐进效果显著。</p>
        </div>
      </div>
    </div>
  );
}