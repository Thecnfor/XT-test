import asyncio
from aiohttp import web
import aiohttp



# 处理客户端连接的异步函数
async def echo(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)

    async for msg in ws:
        if msg.type == web.WSMsgType.TEXT:
            await ws.send_str(msg.data)
            # 发送 HTTP 请求到 server# .py
            await send_http_request(msg.data)
        elif msg.type == web.WSMsgType.ERROR:
            print('ws connection closed with exception %s' % ws.exception())

    print('websocket connection closed')
    return ws
# 异步启动 WebSocket 服务器的函数
async def start_server():
    app = web.Application()
    app.router.add_route('GET', '/ws', echo)
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8000)
    await site.start()
    print("WebSocket server started on ws://localhost:8765")
    test_data = {"username": "test", "password": "123" }
    await send_http_request(test_data)


# 发送 HTTP 请求到 server.py
async def send_http_request(data):
    url = "http://localhost:8000/"
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=data) as response:
            print(f"HTTP Response: {await response.text()}")



if __name__ == "__main__":
    # 使用 asyncio.run 来运行异步函数
    asyncio.run(start_server())
