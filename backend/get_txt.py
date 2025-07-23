import requests  # 导入 “取外卖” 工具

# 👇 这里填你想获取的 txt 文件网址（示例用了一个公开的测试文件）
url = "http://localhost:8000/user.txt"

try:
    # 👇 发送 “取外卖” 请求（GET）
    response = requests.get(url)
    # 👇 确保 “外卖没送丢”（请求成功）
    response.raise_for_status()
    # 👇 把 “外卖内容” 打印到终端（就像打开 txt 文件看内容）
    print(response.text)
except requests.RequestException as e:
    # 👇 如果取外卖失败（比如网络问题），告诉我们哪里错了
    print(f"哎呀，取文件失败了：{e}")