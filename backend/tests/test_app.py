import asyncio
import aiohttp
import pytest
from src.app import create_app
from src.config import config

@pytest.fixture
async def client():"""创建测试客户端"""
    app = create_app()
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', config.HTTP_PORT)
    await site.start()

    async with aiohttp.ClientSession() as session:
        yield session

    await site.stop()
    await runner.cleanup()

async def test_http_endpoint(client):"""测试HTTP端点"""
    url = f'http://localhost:{config.HTTP_PORT}/dialogue'
    data = {'message': '测试消息'}

    async with client.post(url, json=data) as response:
        assert response.status == 200
        result = await response.json()
        assert 'reply' in result
        assert result['success'] is True

async def test_websocket_endpoint():"""测试WebSocket端点"""
    url = f'ws://localhost:{config.HTTP_PORT}/ws'

    async with aiohttp.ClientSession() as session:
        async with session.ws_connect(url) as ws:
            # 发送消息
            await ws.send_str('测试WebSocket消息')
            # 接收响应
            msg = await ws.receive_str()
            assert msg == '测试WebSocket消息'

if __name__ == '__main__':
    # 简单的测试运行器
    async def run_tests():
        app = create_app()
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, 'localhost', config.HTTP_PORT)
        await site.start()

        print('测试HTTP端点...')
        async with aiohttp.ClientSession() as session:
            url = f'http://localhost:{config.HTTP_PORT}/dialogue'
            data = {'message': '测试消息'}
            async with session.post(url, json=data) as response:
                result = await response.json()
                print(f'HTTP响应: {result}')

        print('测试WebSocket端点...')
        async with aiohttp.ClientSession() as session:
            url = f'ws://localhost:{config.HTTP_PORT}/ws'
            async with session.ws_connect(url) as ws:
                await ws.send_str('测试WebSocket消息')
                msg = await ws.receive_str()
                print(f'WebSocket响应: {msg}')

        await site.stop()
        await runner.cleanup()

    asyncio.run(run_tests())