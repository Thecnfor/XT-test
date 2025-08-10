from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from typing import Dict, Set
import json
import asyncio
from services.session_service import SessionService
from config import SESSION_FILE, SESSION_EXPIRE_MINUTES
import logging

router = APIRouter()

# 存储活跃的WebSocket连接
active_connections: Dict[str, WebSocket] = {}
# 存储已验证的管理员连接
verified_admin_connections: Set[str] = set()

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.verified_admin_connections: Set[str] = set()
    
    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket连接已建立: {session_id}")
    
    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.verified_admin_connections:
            self.verified_admin_connections.remove(session_id)
        logger.info(f"WebSocket连接已断开: {session_id}")
    
    async def send_personal_message(self, message: str, session_id: str):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            try:
                await websocket.send_text(message)
            except Exception as e:
                logger.error(f"发送消息失败，移除连接 {session_id}: {e}")
                self.disconnect(session_id)
    
    def is_admin_connected(self, session_id: str) -> bool:
        return session_id in self.verified_admin_connections and session_id in self.active_connections
    
    def verify_admin(self, session_id: str):
        if session_id in self.active_connections:
            self.verified_admin_connections.add(session_id)
            logger.info(f"管理员权限已验证: {session_id}")
    
    def get_connection_count(self) -> int:
        return len(self.active_connections)
    
    def get_admin_connection_count(self) -> int:
        return len(self.verified_admin_connections)

manager = ConnectionManager()

@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    print(f"WebSocket连接请求: {session_id}")
    logger.info(f"WebSocket连接请求: {session_id}")
    
    # 检查是否已有相同session_id的连接，如果有则先断开
    if session_id in manager.active_connections:
        logger.info(f"检测到重复连接，断开旧连接: {session_id}")
        old_websocket = manager.active_connections[session_id]
        try:
            await old_websocket.close()
        except:
            pass
        manager.disconnect(session_id)
    
    await manager.connect(websocket, session_id)
    
    try:
        # 发送连接确认消息
        await manager.send_personal_message(
            json.dumps({
                "type": "connection_established",
                "session_id": session_id,
                "message": "WebSocket连接已建立"
            }),
            session_id
        )
        
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            print(f"收到WebSocket消息: {data}")
            logger.info(f"收到WebSocket消息: {data}")
            
            try:
                message_data = json.loads(data)
            except json.JSONDecodeError:
                logger.error(f"无法解析JSON消息: {data}")
                continue
            
            # 处理不同类型的消息
            if message_data.get("type") == "verify_admin":
                await handle_admin_verification(session_id, message_data)
            elif message_data.get("type") == "ping":
                await manager.send_personal_message(
                    json.dumps({"type": "pong", "timestamp": message_data.get("timestamp")}),
                    session_id
                )
            elif message_data.get("type") == "check_admin_status":
                await send_admin_status(session_id)
            else:
                # 回显其他消息
                await manager.send_personal_message(
                    json.dumps({"type": "echo", "data": message_data}),
                    session_id
                )
                
    except WebSocketDisconnect:
        print(f"WebSocket连接断开: {session_id}")
        logger.info(f"WebSocket连接断开: {session_id}")
    except Exception as e:
        print(f"WebSocket错误: {e}")
        logger.error(f"WebSocket错误: {e}")
    finally:
        # 确保在任何情况下都清理连接
        manager.disconnect(session_id)
        logger.info(f"WebSocket连接已清理: {session_id}")

async def handle_admin_verification(session_id: str, message_data: dict):
    """处理管理员权限验证"""
    try:
        token = message_data.get("token")
        if not token:
            await manager.send_personal_message(
                json.dumps({
                    "type": "admin_verification_result",
                    "success": False,
                    "message": "缺少token"
                }),
                session_id
            )
            return
        
        # 验证会话和管理员权限
        session_service = SessionService(SESSION_FILE, SESSION_EXPIRE_MINUTES)
        session_data = session_service.get_session(session_id)
        
        if not session_data:
            await manager.send_personal_message(
                json.dumps({
                    "type": "admin_verification_result",
                    "success": False,
                    "message": "会话无效"
                }),
                session_id
            )
            return
        
        # 检查是否为管理员 - 简化验证逻辑
        # 目前暂时允许所有有效会话的用户作为管理员
        # 在实际应用中，这里应该检查用户的管理员权限
        username = session_data.get("username")
        
        if username:
            manager.verify_admin(session_id)
            await manager.send_personal_message(
                json.dumps({
                    "type": "admin_verification_result",
                    "success": True,
                    "message": "管理员权限验证成功",
                    "username": username
                }),
                session_id
            )
        else:
            await manager.send_personal_message(
                json.dumps({
                    "type": "admin_verification_result",
                    "success": False,
                    "message": "无法获取用户信息"
                }),
                session_id
            )
            
    except Exception as e:
        logger.error(f"管理员验证错误: {e}")
        await manager.send_personal_message(
            json.dumps({
                "type": "admin_verification_result",
                "success": False,
                "message": "验证过程中发生错误"
            }),
            session_id
        )

async def send_admin_status(session_id: str):
    """发送管理员状态"""
    is_admin = manager.is_admin_connected(session_id)
    await manager.send_personal_message(
        json.dumps({
            "type": "admin_status",
            "is_admin_connected": is_admin
        }),
        session_id
    )

# API端点：检查管理员是否通过WebSocket连接
@router.get("/admin/websocket_status/{session_id}")
async def check_admin_websocket_status(session_id: str):
    """检查指定会话的管理员WebSocket连接状态"""
    is_connected = manager.is_admin_connected(session_id)
    return {
        "session_id": session_id,
        "is_admin_connected": is_connected,
        "total_connections": manager.get_connection_count(),
        "admin_connections": manager.get_admin_connection_count()
    }

# 获取连接管理器实例（供其他模块使用）
def get_connection_manager() -> ConnectionManager:
    return manager