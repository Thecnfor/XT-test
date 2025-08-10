import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 检查是否在浏览器环境中
 */
const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined'

/**
 * 设置Cookie
 * @param name Cookie名称
 * @param value Cookie值
 * @param days 过期天数
 */
export function setCookie(name: string, value: string, days: number = 7) {
  if (!isBrowser) return

  const date = new Date()
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
  const expires = `expires=${date.toUTCString()}`
  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/`
}

/**
 * 获取Cookie
 * @param name Cookie名称
 * @returns Cookie值，如果不存在或在非浏览器环境则返回null
 */
export function getCookie(name: string): string | null {
  if (!isBrowser) return null

  const nameEQ = `${name}=`
  const ca = document.cookie.split(';')
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i]
    while (c.charAt(0) === ' ') c = c.substring(1, c.length)
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length))
  }
  return null
}

/**
 * 删除Cookie
 * @param name Cookie名称
 */
export function deleteCookie(name: string) {
  if (!isBrowser) return

  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}
