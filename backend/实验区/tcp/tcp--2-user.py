import socket


client = socket.socket(socket.AF_INET,socket.SOCK_STREAM)
client.connect(('localhost',8080))#连接对应服务器
if client:
    print('连接成功')
client.send('你好，我是客户端'.encode('utf-8'))#send是发送数据


print('等待服务器回复....')
data=client.recv(1024)
print(data.decode('utf-8'))#decode是解码


flag = input('是否退出:(exit)')
while flag!='exit':
    client.send(flag.encode('utf-8'))#send是发送数据--->退出
    data=client.recv(1024)#recv是接收数据
    print(data.decode('utf-8'))#decode是解码
    flag = input('是否退出:(exit)')


client.close()#关闭连接
print('连接关闭')
