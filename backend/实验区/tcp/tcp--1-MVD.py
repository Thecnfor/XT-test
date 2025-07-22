import socket
import threading
#服务端----->你要研究的


from websockets import client   #多线程


s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.bind(('localhost',8080))#绑定地址
s.listen(5)#最大连接数量

#接收数据
while True:
    client,addr=s.accept()#accept是接收连接
    t = threading.Thread(target=tcp_server,args=(client,addr))#
    t.start()
