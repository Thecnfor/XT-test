import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { Fragment } from 'react';
import navLinks, { NavItem } from '@/lib/links';
import clsx from 'clsx';
import { CategoryLinks } from '@/types/navLinks';

// 将NavItem转换为兼容的格式
const typedNavLinks: Record<string, NavItem> = navLinks;

export function NavMore() {
    const pathname = usePathname();
    const isHomePage = pathname === '/';
    // Extract userId from pathname (e.g., /admin/123)
    const userIdMatch = pathname.match(/^\/admin\/(\d+)/);
    const userId = userIdMatch ? userIdMatch[1] : null;

    const navMoreStyle = {
        position: 'absolute',
        left: isHomePage ? '200px' : '0',
        opacity: isHomePage ? 0 : 1,
        zIndex: 0,
    };

    return (
        <div style={navMoreStyle as React.CSSProperties}>
            <Link href={'/'} className='nav-backHome' style={{ display: isHomePage ? 'none' : 'flex' }}>
                    <svg className="w-[15px] md:w-[11px]" width="10" viewBox="0 0 12 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.245636 8.59302C-0.0818787 8.2655 -0.0818787 7.7345 0.245636 7.40698L4.43892 3.2137C4.76643 2.88619 5.29744 2.88619 5.62495 3.2137C5.95247 3.54122 5.95247 4.07223 5.62495 4.39974L2.86335 7.16134H10.9025C11.3657 7.16134 11.7412 7.53682 11.7412 8C11.7412 8.46318 11.3657 8.83866 10.9025 8.83866H2.86335L5.62495 11.6003C5.95247 11.9278 5.95247 12.4588 5.62495 12.7863C5.29744 13.1138 4.76643 13.1138 4.43892 12.7863L0.245636 8.59302Z" fill="currentColor"></path></svg>
                <span>首页</span>
            </Link>
            {Object.entries(typedNavLinks).filter(([name, link]) => {
                // 管理员分类在访问/admin/**时应该显示
                if (name === '管理员' && pathname.startsWith('/admin/')) {
                    return true;
                } 
                // 其他分类仍然根据show属性决定
                return link.show !== false;
            }).map(([name, link]) => {
                const className = `nav-${link.path.substring(1)}`;
                // 检查当前路径是否与链接路径匹配，包括子路径和动态路由
                const isActive = pathname === link.path || 
                                  pathname.startsWith(`${link.path}/`) || 
                                  (link.path === '/admin' && pathname.startsWith('/admin/'));
                // 只显示与当前路径匹配的导航
                const displayStyle = isActive ? 'block' : 'none';
                
                return (
                    <ul key={name} className={className} style={{ display: displayStyle }}>
                        {link.subLinks && Object.entries(link.subLinks).map(([subName, subLink]) => (
                            <li key={subName} className={clsx({ 'active-link': pathname === subLink.path })}>
                                <Link href={userId ? subLink.path.replace('[userId]', userId) : subLink.path}>{subName}</Link>
                            </li>
                        ))}
                        {Object.keys(link).filter(key => !['path', 'hasSubLinks', 'subLinks', 'show'].includes(key)).map((category) => (
                            <div key={category} className="nav-tag">{category}</div>
                        ))}
                        {Object.keys(link).filter(key => !['path', 'hasSubLinks', 'subLinks'].includes(key)).map((category) => (
                            <Fragment key={category}>
                                {link[category] && Object.entries(link[category] as CategoryLinks).map(([subName, subLink]) => (
                                    <li key={subName} className={clsx({ 'active-link': pathname === subLink.path })}>
                                        <Link href={userId ? subLink.path.replace('[userId]', userId) : subLink.path}>{subName}</Link>
                                    </li>
                                ))}
                            </Fragment>
                        ))}
                    </ul>
                );
            })}
        </div>
    );
}