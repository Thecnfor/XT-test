import socket
#客户端-----》相当于前端了

#创建连接，GET请求
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('localhost', 3000))
s.send(b'GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')

#接收数据
buffer = []
while True:
    d = s.recv(1024)#recv是接收数据
    if d:
        buffer.append(d)
    else:
        break
web_data = b''.join(buffer)
http_header,http_content = web_data.split(b'\r\n\r\n',1)

#写入数据
with open('./backend/实验区/tcp/web_localhost.html','wb') as f:
    f.write(http_content)
print(http_header.decode('utf-8'))