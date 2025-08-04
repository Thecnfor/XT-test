import React from 'react';

export default function CloudPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">云控制</h1>
      <p className="mb-6">欢迎来到云控制页面，这里提供云服务、自动化脚本和远程控制相关内容。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">云服务</h2>
          <p>各种云服务平台介绍和使用指南</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">自动化脚本</h2>
          <p>云环境自动化管理脚本</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">远程控制</h2>
          <p>远程服务器和设备控制方法</p>
        </div>
      </div>
    </div>
  );
}