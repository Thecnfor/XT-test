import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { NavConfigDatabase } from '@/lib/database';
import { NavCacheService } from '@/lib/cache';

// POST /api/admin/save-nav-links
export async function POST(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 这里应该验证token的有效性和管理员权限
    // 为了演示，我们暂时跳过详细验证
    
    const { content } = await request.json();
    
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: '无效的文件内容' }, { status: 400 });
    }

    // 保存到文件系统（开发和生产环境都支持）
    const filePath = join(process.cwd(), 'src', 'lib', 'links.ts');
    await writeFile(filePath, content, 'utf8');
    
    console.log(`导航链接配置已保存到: ${filePath}`);

    return NextResponse.json({ 
      success: true, 
      message: '导航链接配置已保存',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('保存导航链接配置失败:', error);
    return NextResponse.json(
      { error: '保存失败，请稍后重试' }, 
      { status: 500 }
    );
  }
}

// GET /api/admin/save-nav-links - 获取当前配置
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 读取当前的links.ts文件内容
    const { readFile } = await import('fs/promises');
    const filePath = join(process.cwd(), 'src', 'lib', 'links.ts');
    
    try {
      const content = await readFile(filePath, 'utf8');
      return NextResponse.json({ 
        success: true, 
        content,
        timestamp: new Date().toISOString()
      });
    } catch {
      return NextResponse.json(
        { error: '无法读取配置文件' }, 
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('读取导航链接配置失败:', error);
    return NextResponse.json(
      { error: '读取失败，请稍后重试' }, 
      { status: 500 }
    );
  }
}