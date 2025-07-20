import type { Metadata } from "next";
import { Inter } from 'next/font/google';
import "@/styles/globals.scss";

// 配置Google字体Inter，优化加载性能
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: "Xrak",
  description: "Xrak 是一个基于 Next.js 的综合项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={inter.variable}>
        {children}
      </body>
    </html>
  );
}
