import socket
import threading

def tcp_server(client:socket.socket,addr:tuple):
    print(f'连接地址{addr}')
    print(f'来自{addr[0]}:{addr[1]}')#0是ip地址,1是端口号

    client.send('欢迎来到tcp服务器'.encode('utf-8'))#send是发送数据
    while True:
        data=client.recv(1024)#recv是接收数据
        if data.decode('utf-8')=='exit':
            break
        elif data:
            client.send(f'你好,你发送的是{data.decode("utf-8")}'.encode('utf-8'))
        else:
            client.send('输入不合法'.encode('utf-8'))
    print(f'{addr[0]}:{addr[1]}断开连接')#0是ip地址,1是端口号
    client.close()#关闭连接

s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.bind(('localhost',8080))#绑定地址
s.listen(5)#最大连接数量
print('服务器启动成功')
print(f'服务器地址:{s.getsockname()}')#获取服务器地址
print('等待连接....')#<---你可以写一个判断逻辑来动态反馈连接状态

while True:
    client,addr=s.accept()#accept是接收连接
    #新线程处理多个连接
    t = threading.Thread(target=tcp_server,args=(client,addr))#
    t.start()
    print(f'当前连接数量:{threading.active_count()-1}')#-1是减去主线程
