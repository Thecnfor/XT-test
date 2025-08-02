'use client'

import { useSelector } from "react-redux";

export default function DateLog() {
  const activeClass = useSelector((state) => state?.nav?.activeClass || '');
  
  return (
    <article className={`${activeClass}`}>
      <h1>日志&笔记</h1>
    </article>
  );
}