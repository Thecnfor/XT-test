'use client'
import '@/styles/globals.scss'
import '@/styles/components/lib/globals-components.scss'
import clsx from 'clsx';

import Link from 'next/link'
import { usePathname } from 'next/navigation';
import React from 'react';

//动画组件
import { TextAnimate } from "@/components/magicui/text-animate";

interface TextMainProps {
  text: string;
  timer: number;
}

function TextMain({ text, timer }: TextMainProps) {

  return (
    <div className={clsx('text-underline')}
    >
      <TextAnimate 
        animation="blurIn" 
        by="text" 
        delay={timer} 
      >
            {text}
      </TextAnimate>
    </div>

  );
}

interface TextProps {
  text: string;
  index: number;
  href: string;
  // 可在此处添加更多属性
}

export default function Text(props: TextProps){

  const pathname = usePathname();
  // 确保路径匹配格式一致
  const normalizedPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
  const normalizedHref = props.href.startsWith('/') ? props.href : `/${props.href}`;
  const isActive = normalizedPathname === normalizedHref;
  return(
    <li>
      <Link href={`/${props.href}`} className={clsx({ 'is-active': isActive })}>
        <TextMain text={props.text} timer={(props.index + 1) * 0.1} />
      </Link>
    </li>
  )
}