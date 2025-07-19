import asyncio
import websockets

# 处理客户端连接的异步函数
async def echo(websocket, path):
    try:
        # 持续接收客户端消息
        async for message in websocket:
            # 将接收到的消息原样返回给客户端
            await websocket.send(message)
    except websockets.exceptions.ConnectionClosedOK:
        pass

# 异步启动 WebSocket 服务器的函数
async def main():
    # 启动 WebSocket 服务器
    server = await websockets.serve(echo, "localhost", 8765)
    print("WebSocket server started on ws://localhost:8765")
    # 保持服务器运行
    await server.wait_closed()

if __name__ == "__main__":
    # 使用 asyncio.run 来运行异步函数
    asyncio.run(main())