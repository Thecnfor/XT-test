// 定义导航链接的类型
export interface SubLink {
  path: string;
  hasSubLinks: boolean;
}

export interface CategoryLinks {
  [key: string]: SubLink;
}

export interface NavLink {
  path: string;
  hasSubLinks: boolean;
  subLinks?: CategoryLinks;
  /**
   * 控制导航项是否显示
   * @default true
   */
  show?: boolean;
  [key: string]: CategoryLinks | string | boolean | undefined;
}

export interface NavLinks {
  [key: string]: NavLink;
}

// 导出默认接口以便兼容之前的导入方式
export default NavLinks;