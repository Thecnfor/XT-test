from fastapi import FastAPI

# 创建FastAPI实例
app = FastAPI()

# 定义一个简单的路由
@app.get("/")
def read_root():
    return {"message": "Hello, World!"}

# 定义一个带参数的路由
@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)