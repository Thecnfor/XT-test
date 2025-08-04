import React from 'react';

export default function TechNotePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-4">技术笔记</h1>
      <p className="mb-6">记录各种技术学习和实践心得。</p>
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">React性能优化技巧</h2>
          <p className="text-gray-600">2023年10月10日</p>
          <p className="mt-2">学习了React中的memo、useMemo和useCallback等性能优化手段，有效减少了不必要的重渲染。</p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">Next.js路由系统</h2>
          <p className="text-gray-600">2023年10月5日</p>
          <p className="mt-2">详细了解了Next.js的文件系统路由和动态路由的实现方式，以及如何进行参数传递。</p>
        </div>
      </div>
    </div>
  );
}