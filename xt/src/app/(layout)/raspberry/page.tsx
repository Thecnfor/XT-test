import React from 'react';

export default function RaspberryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">树莓派</h1>
      <p className="mb-6">欢迎来到树莓派页面，这里提供树莓派相关的教程、项目和硬件推荐。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">入门指南</h2>
          <p>树莓派新手入门必备知识</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">项目案例</h2>
          <p>树莓派创意项目展示</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">硬件推荐</h2>
          <p>树莓派相关硬件配件推荐</p>
        </div>
      </div>
    </div>
  );
}