import asyncio
import websockets

# 客户端主函数
async def hello():
    # 连接到 WebSocket 服务器
    uri = "ws://localhost:8765"
    try:
        async with websockets.connect(uri, timeout=10000) as websocket:
            # 发送消息给服务器
            await websocket.send("Hello, WebSocket Server!")
            # 接收服务器返回的消息，设置超时时间
            response = await asyncio.wait_for(websocket.recv(), timeout=10000)
            print(f"Received from server: {response}")
    except asyncio.TimeoutError:
        print("Connection timed out.")
    except websockets.exceptions.ConnectionClosed as e:
        print(f"Connection closed: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Use asyncio.run to run the asynchronous function
    asyncio.run(hello())