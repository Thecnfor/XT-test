'use client'

import { useAppSelector } from "@/store";

export default function DateLog() {
  const activeClass = useAppSelector((state) => state?.navSwitch?.activeClass || '');
  
  return (
    <article className={`${activeClass}`}>
      <h1>日志&笔记</h1>
    </article>
  );
}