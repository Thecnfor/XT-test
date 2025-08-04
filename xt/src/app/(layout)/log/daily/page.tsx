import React from 'react';

export default function DailyLogPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">日常记录</h1>
      <p className="mb-6">记录日常生活和工作中的点滴。</p>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">今日记录</h2>
          <p className="text-gray-600">2023年10月15日</p>
          <p className="mt-2">今天完成了项目的基础架构搭建，学习了新的技术知识点。</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">周总结</h2>
          <p className="text-gray-600">2023年10月9日-10月13日</p>
          <p className="mt-2">本周主要完成了需求分析和技术选型，下周计划开始核心功能开发。</p>
        </div>
      </div>
    </div>
  );
}