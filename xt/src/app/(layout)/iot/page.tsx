import React from 'react';

export default function IoTPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">物联网</h1>
      <p className="mb-6">欢迎来到物联网页面，这里提供设备列表、传感器和自动化相关内容。</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">设备列表</h2>
          <p>各种物联网设备介绍和使用</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">传感器</h2>
          <p>物联网传感器技术和应用</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">自动化</h2>
          <p>物联网自动化系统和方案</p>
        </div>
      </div>
    </div>
  );
}