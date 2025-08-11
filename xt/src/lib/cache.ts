import { NavItem } from './links';

// 缓存接口
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // 生存时间（毫秒）
}

// 内存缓存类
class MemoryCache {
  private cache = new Map<string, CacheItem<any>>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    // 每5分钟清理一次过期缓存
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  // 设置缓存
  set<T>(key: string, data: T, ttl: number = 10 * 60 * 1000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  // 获取缓存
  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    // 检查是否过期
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data as T;
  }
  
  // 删除缓存
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  
  // 清空缓存
  clear(): void {
    this.cache.clear();
  }
  
  // 清理过期缓存
  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
  
  // 获取缓存统计信息
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
  
  // 销毁缓存
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
  }
}

// Redis 缓存类（可选，用于生产环境）
class RedisCache {
  private client: any = null;
  private isConnected = false;
  
  constructor() {
    if (typeof window === 'undefined') {
      this.initRedis();
    }
  }
  
  private async initRedis() {
    try {
      if (process.env.REDIS_URL && typeof window === 'undefined') {
        const { createClient } = await import('redis');
        this.client = createClient({
          url: process.env.REDIS_URL
        });
        
        this.client.on('error', (err: any) => {
          console.error('Redis Client Error:', err);
          this.isConnected = false;
        });
        
        this.client.on('connect', () => {
          console.log('Redis Client Connected');
          this.isConnected = true;
        });
        
        await this.client.connect();
      }
    } catch (error) {
      console.error('Redis initialization failed:', error);
    }
  }
  
  // 设置缓存
  async set<T>(key: string, data: T, ttl: number = 10 * 60): Promise<void> {
    if (!this.isConnected || !this.client) return;
    
    try {
      await this.client.setEx(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  // 获取缓存
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) return null;
    
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  // 删除缓存
  async delete(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      console.error('Redis delete error:', error);
      return false;
    }
  }
  
  // 清空缓存
  async clear(): Promise<void> {
    if (!this.isConnected || !this.client) return;
    
    try {
      await this.client.flushAll();
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
}

// 缓存管理器
class CacheManager {
  private memoryCache: MemoryCache;
  private redisCache: RedisCache | null = null;
  
  constructor() {
    this.memoryCache = new MemoryCache();
    
    // 如果有Redis配置，则使用Redis
    if (process.env.REDIS_URL) {
      this.redisCache = new RedisCache();
    }
  }
  
  // 设置缓存
  async set<T>(key: string, data: T, ttl: number = 10 * 60 * 1000): Promise<void> {
    // 内存缓存（毫秒）
    this.memoryCache.set(key, data, ttl);
    
    // Redis缓存（秒）
    if (this.redisCache) {
      await this.redisCache.set(key, data, Math.floor(ttl / 1000));
    }
  }
  
  // 获取缓存
  async get<T>(key: string): Promise<T | null> {
    // 先从内存缓存获取
    let data = this.memoryCache.get<T>(key);
    if (data) return data;
    
    // 再从Redis获取
    if (this.redisCache) {
      data = await this.redisCache.get<T>(key);
      if (data) {
        // 回写到内存缓存
        this.memoryCache.set(key, data);
        return data;
      }
    }
    
    return null;
  }
  
  // 删除缓存
  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
    if (this.redisCache) {
      await this.redisCache.delete(key);
    }
  }
  
  // 清空缓存
  async clear(): Promise<void> {
    this.memoryCache.clear();
    if (this.redisCache) {
      await this.redisCache.clear();
    }
  }
  
  // 获取缓存统计
  getStats() {
    return this.memoryCache.getStats();
  }
}

// 导航缓存服务
export class NavCacheService {
  private static instance: NavCacheService;
  private cacheManager: CacheManager;
  
  private constructor() {
    this.cacheManager = new CacheManager();
  }
  
  static getInstance(): NavCacheService {
    if (!NavCacheService.instance) {
      NavCacheService.instance = new NavCacheService();
    }
    return NavCacheService.instance;
  }
  
  // 缓存用户导航配置
  async cacheUserNavConfig(userId: string, configName: string, navLinks: Record<string, NavItem>): Promise<void> {
    const key = `nav:${userId}:${configName}`;
    await this.cacheManager.set(key, navLinks, 15 * 60 * 1000); // 15分钟
  }
  
  // 获取用户导航配置缓存
  async getUserNavConfig(userId: string, configName: string): Promise<Record<string, NavItem> | null> {
    const key = `nav:${userId}:${configName}`;
    return await this.cacheManager.get<Record<string, NavItem>>(key);
  }
  
  // 缓存全局导航配置
  async cacheGlobalNavConfig(navLinks: Record<string, NavItem>): Promise<void> {
    const key = 'nav:global:default';
    await this.cacheManager.set(key, navLinks, 30 * 60 * 1000); // 30分钟
  }
  
  // 获取全局导航配置缓存
  async getGlobalNavConfig(): Promise<Record<string, NavItem> | null> {
    const key = 'nav:global:default';
    return await this.cacheManager.get<Record<string, NavItem>>(key);
  }
  
  // 清除用户相关缓存
  async clearUserCache(userId: string): Promise<void> {
    const stats = this.cacheManager.getStats();
    const userKeys = stats.keys.filter(key => key.startsWith(`nav:${userId}:`));
    
    for (const key of userKeys) {
      await this.cacheManager.delete(key);
    }
  }
  
  // 清除所有导航缓存
  async clearAllNavCache(): Promise<void> {
    const stats = this.cacheManager.getStats();
    const navKeys = stats.keys.filter(key => key.startsWith('nav:'));
    
    for (const key of navKeys) {
      await this.cacheManager.delete(key);
    }
  }
  
  // 预热缓存
  async warmupCache(userId: string, navLinks: Record<string, NavItem>): Promise<void> {
    await this.cacheUserNavConfig(userId, 'default', navLinks);
    await this.cacheGlobalNavConfig(navLinks);
  }
  
  // 获取缓存统计
  getCacheStats() {
    return this.cacheManager.getStats();
  }
}

// 导出单例实例
export const navCacheService = NavCacheService.getInstance();

// 缓存装饰器
export function cached(ttl: number = 10 * 60 * 1000) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const cacheManager = new CacheManager();
    
    descriptor.value = async function (...args: any[]) {
      const key = `method:${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`;
      
      // 尝试从缓存获取
      let result = await cacheManager.get(key);
      if (result !== null) {
        return result;
      }
      
      // 执行原方法
      result = await method.apply(this, args);
      
      // 缓存结果
      await cacheManager.set(key, result, ttl);
      
      return result;
    };
  };
}