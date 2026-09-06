import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/api_config.dart';

class SocketService {
  static final SocketService _instance = SocketService._();
  factory SocketService() => _instance;
  SocketService._();

  io.Socket? _socket;
  bool _connected = false;

  bool get isConnected => _connected;

  // Event streams
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _deletedController = StreamController<Map<String, dynamic>>.broadcast();
  final _reactionController = StreamController<Map<String, dynamic>>.broadcast();
  final _typingController = StreamController<Map<String, dynamic>>.broadcast();
  final _onlineController = StreamController<Map<String, dynamic>>.broadcast();
  final _notificationController = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get onMessage => _messageController.stream;
  Stream<Map<String, dynamic>> get onDeleted => _deletedController.stream;
  Stream<Map<String, dynamic>> get onReaction => _reactionController.stream;
  Stream<Map<String, dynamic>> get onTyping => _typingController.stream;
  Stream<Map<String, dynamic>> get onOnline => _onlineController.stream;
  Stream<Map<String, dynamic>> get onNotification => _notificationController.stream;

  void connect(String token) {
    if (_socket != null && _connected) return;

    _socket = io.io(ApiConfig.socketUrl, io.OptionBuilder()
      .setTransports(['websocket'])
      .setPath(ApiConfig.socketPath)
      .setAuth({'token': token})
      .disableAutoConnect()
      .build());

    _socket!.onConnect((_) {
      _connected = true;
      print('[Socket] Connected');
    });

    _socket!.onDisconnect((_) {
      _connected = false;
      print('[Socket] Disconnected');
    });

    _socket!.on('message:new', (data) {
      _messageController.add(data as Map<String, dynamic>);
    });

    _socket!.on('message:deleted', (data) {
      _deletedController.add(data as Map<String, dynamic>);
    });

    _socket!.on('message:reaction', (data) {
      _reactionController.add(data as Map<String, dynamic>);
    });

    _socket!.on('user:typing', (data) {
      _typingController.add(data as Map<String, dynamic>);
    });

    _socket!.on('user:stop-typing', (data) {
      _typingController.add({'stop': true, ...(data as Map<String, dynamic>)});
    });

    _socket!.on('user:online', (data) {
      _onlineController.add({'online': true, ...(data as Map<String, dynamic>)});
    });

    _socket!.on('user:offline', (data) {
      _onlineController.add({'online': false, ...(data as Map<String, dynamic>)});
    });

    _socket!.on('notification:new', (data) {
      _notificationController.add(data as Map<String, dynamic>);
    });

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
    _connected = false;
  }

  void emit(String event, Map<String, dynamic> data) {
    _socket?.emit(event, data);
  }

  void emitWithAck(String event, Map<String, dynamic> data, Function(dynamic) callback) {
    _socket?.emitWithAck(event, data);
  }

  void joinConversation(String convId) {
    emit('conversation:join', {'conversationId': convId});
  }

  void leaveConversation(String convId) {
    emit('conversation:leave', {'conversationId': convId});
  }

  void sendMessage({
    required String conversationId,
    required String content,
    String? receiverId,
    String? replyToId,
    String? tempId,
    String? attachmentUrl,
  }) {
    emit('message:send', {
      'conversationId': conversationId,
      'content': content,
      'receiverId': receiverId,
      'replyToId': replyToId,
      'tempId': tempId,
      'attachmentUrl': attachmentUrl,
    });
  }

  void sendTyping(String conversationId, String receiverId) {
    emit('typing:start', {'conversationId': conversationId, 'receiverId': receiverId});
  }

  void stopTyping(String conversationId, String receiverId) {
    emit('typing:stop', {'conversationId': conversationId, 'receiverId': receiverId});
  }

  void deleteMessage(String messageId, String conversationId) {
    emit('message:delete', {'messageId': messageId, 'conversationId': conversationId});
  }

  void reactMessage(String messageId, String conversationId, String emoji) {
    emit('message:react', {'messageId': messageId, 'conversationId': conversationId, 'emoji': emoji});
  }

  void markRead(String conversationId) {
    emit('conversation:read', {'conversationId': conversationId});
  }

  void dispose() {
    _messageController.close();
    _deletedController.close();
    _reactionController.close();
    _typingController.close();
    _onlineController.close();
    _notificationController.close();
    disconnect();
  }
}