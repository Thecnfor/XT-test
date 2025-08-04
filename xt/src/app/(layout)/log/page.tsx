'use client'

import { useAppSelector } from "@/store";
import Link from 'next/link';

export default function DateLog() {
  const activeClass = useAppSelector((state) => state?.navSwitch?.activeClass || '');
  
  return (
    <article className={`${activeClass} container mx-auto px-4 py-8`}>
      <h1 className="text-3xl font-bold mb-6">日志&笔记</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Link href="/log/daily" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">日常记录</h2>
          <p className="text-gray-600">记录日常生活和工作中的点滴</p>
        </Link>
        <Link href="/log/tech" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">技术笔记</h2>
          <p className="text-gray-600">记录各种技术学习和实践心得</p>
        </Link>
        <Link href="/log/learning" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">学习心得</h2>
          <p className="text-gray-600">记录学习过程中的感悟和体会</p>
        </Link>
        <Link href="/log/cases" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">项目案例</h2>
          <p className="text-gray-600">展示各种学习项目和实践案例</p>
        </Link>
        <Link href="/log/resources" className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-300">
          <h2 className="text-xl font-semibold mb-2">学习资源</h2>
          <p className="text-gray-600">收集和整理的各种学习资料和工具</p>
        </Link>
      </div>
    </article>
  );
}