from .socketio import socketio
from flask_socketio import emit


@socketio.on('connect')
def handle_connect():
    print('Client connected')
    emit('server_response', {'data': 'Connected to Xrak server'})


@socketio.on('disconnect')
def handle_disconnect():
    print('Client disconnected')


@socketio.on('client_message')
def handle_message(data):
    print('Received message:', data)
    socketio.emit('server_broadcast', {'data': data}, broadcast=True)