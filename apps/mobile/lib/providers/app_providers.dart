import 'dart:async';
import 'dart:collection';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/api_service.dart';
import '../models/message.dart';
import '../models/conversation.dart';
import '../models/notification_item.dart';
import '../services/socket_service.dart';

class AuthProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  User? _user;
  bool _loading = true;

  User? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null;

  Future<void> init() async {
    _loading = true;
    notifyListeners();
    try {
      final token = await _api.getToken();
      if (token != null) {
        final res = await _api.get('/auth/me');
        _user = User.fromJson(res['data']);
      }
    } catch (_) {
      await _api.clearToken();
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) async {
    final res = await _api.post('/auth/login', body: {'email': email, 'password': password});
    final data = res['data'];
    await _api.setToken(data['accessToken']);
    _user = User.fromJson(data['user']);
    notifyListeners();
  }

  Future<void> register(String name, String email, String password) async {
    final res = await _api.post('/auth/register', body: {'name': name, 'email': email, 'password': password});
    final data = res['data'];
    await _api.setToken(data['accessToken']);
    _user = User.fromJson(data['user']);
    notifyListeners();
  }

  Future<void> logout() async {
    await _api.clearToken();
    _user = null;
    notifyListeners();
  }
}

class ChatProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  final SocketService _socket = SocketService();

  List<Conversation> _conversations = [];
  Map<String, List<Message>> _messagesCache = {};
  Map<String, bool> _hasMoreCache = {};
  Map<String, ConversationMember?> _otherUserCache = {};
  bool _loadingConversations = false;

  List<Conversation> get conversations => _conversations;
  bool get loadingConversations => _loadingConversations;

  List<Message> getMessages(String convId) => _messagesCache[convId] ?? [];
  bool hasMore(String convId) => _hasMoreCache[convId] ?? true;
  ConversationMember? getOtherUser(String convId) => _otherUserCache[convId];

  Future<void> fetchConversations() async {
    _loadingConversations = true;
    notifyListeners();
    try {
      final res = await _api.get('/conversations');
      final list = (res['data'] as List).map((e) => Conversation.fromJson(e)).toList();
      _conversations = list;
      for (final c in list) {
        if (c.participants != null && c.participants!.isNotEmpty) {
          _otherUserCache[c.id] = c.participants!.first;
        }
      }
    } catch (_) {}
    _loadingConversations = false;
    notifyListeners();
  }

  Future<void> fetchMessages(String convId) async {
    try {
      final res = await _api.get('/messages/$convId', query: {'limit': '50'});
      final list = (res['data'] as List).map((e) => Message.fromJson(e)).toList();
      _messagesCache[convId] = list;
      _hasMoreCache[convId] = list.length >= 50;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> loadMoreMessages(String convId) async {
    final msgs = _messagesCache[convId] ?? [];
    if (msgs.isEmpty || !(_hasMoreCache[convId] ?? true)) return;
    try {
      final oldest = msgs.first.createdAt;
      final res = await _api.get('/messages/$convId', query: {'limit': '50', 'before': oldest});
      final list = (res['data'] as List).map((e) => Message.fromJson(e)).toList();
      _hasMoreCache[convId] = list.length >= 50;
      // Merge without duplicates
      final existingIds = msgs.map((m) => m.id).toSet();
      for (final msg in list) {
        if (!existingIds.contains(msg.id)) {
          msgs.insert(0, msg);
        }
      }
      _messagesCache[convId] = msgs;
      notifyListeners();
    } catch (_) {}
  }

  void addOptimisticMessage(String convId, Message msg) {
    final msgs = _messagesCache[convId] ?? [];
    msgs.add(msg);
    _messagesCache[convId] = msgs;
    notifyListeners();
  }

  void reconcileMessage(String convId, String tempId, String realId) {
    final msgs = _messagesCache[convId] ?? [];
    final idx = msgs.indexWhere((m) => m.id == tempId || m.clientTempId == tempId);
    if (idx >= 0) {
      final old = msgs[idx];
      msgs[idx] = Message(
        id: realId, conversationId: old.conversationId, senderId: old.senderId,
        content: old.content, type: old.type, metadata: old.metadata,
        replyToId: old.replyToId, isDeleted: old.isDeleted, createdAt: old.createdAt,
        senderName: old.senderName, senderAvatar: old.senderAvatar,
        reactions: old.reactions, status: 'sent', clientTempId: old.clientTempId,
      );
      notifyListeners();
    }
  }

  void addIncomingMessage(String convId, Message msg) {
    final msgs = _messagesCache[convId] ?? [];
    // Dedup
    if (msgs.any((m) => m.id == msg.id)) return;
    msgs.add(msg);
    _messagesCache[convId] = msgs;

    // Update conversation list
    final convIdx = _conversations.indexWhere((c) => c.id == convId);
    if (convIdx >= 0) {
      final old = _conversations[convIdx];
      _conversations[convIdx] = Conversation(
        id: old.id, type: old.type, name: old.name,
        lastMessage: msg.content.isEmpty ? '📷 Ảnh' : msg.content,
        lastMessageAt: msg.createdAt,
        unreadCount: old.unreadCount + 1,
        displayName: old.displayName, avatar: old.avatar, isOnline: old.isOnline,
        participants: old.participants,
      );
      // Sort
      _conversations.sort((a, b) => (b.lastMessageAt ?? '').compareTo(a.lastMessageAt ?? ''));
    }
    notifyListeners();
  }

  void markConversationRead(String convId) {
    _conversations = _conversations.map((c) =>
      c.id == convId ? Conversation(id: c.id, type: c.type, name: c.name,
        lastMessage: c.lastMessage, lastMessageAt: c.lastMessageAt,
        unreadCount: 0, displayName: c.displayName, avatar: c.avatar,
        isOnline: c.isOnline, participants: c.participants) : c
    ).toList();
    notifyListeners();
  }
}

class NotificationProvider extends ChangeNotifier {
  final ApiService _api = ApiService();
  List<NotificationItem> _notifications = [];
  int _unreadCount = 0;
  bool _loading = false;
  bool _error = false;
  StreamSubscription? _notifSub;

  List<NotificationItem> get notifications => _notifications;
  int get unreadCount => _unreadCount;
  bool get loading => _loading;
  bool get error => _error;

  NotificationProvider() {
    _notifSub = SocketService().onNotification.listen((data) {
      // Realtime: push new notification (dedupe by id)
      final item = NotificationItem.fromJson(data);
      // Skip any Messenger-message-type data leaking in
      if (item.type == 'message') return;
      if (_notifications.any((n) => n.id == item.id)) return;
      if (item.id.isEmpty) {
        // No id from socket payload → refetch authoritative list
        fetchNotifications();
        return;
      }
      _notifications.insert(0, item);
      _unreadCount++;
      notifyListeners();
    });
  }

  Future<void> fetchNotifications() async {
    _loading = true;
    _error = false;
    notifyListeners();
    try {
      final res = await _api.get('/notifications');
      final raw = (res['data']['notifications'] as List);
      // Defensive: exclude legacy Messenger rows (type=message) — Messenger belongs to Chat module
      final list = raw
          .map((e) => NotificationItem.fromJson(e))
          .where((n) => n.type != 'message')
          .toList();
      _notifications = list;
      _unreadCount = list.where((n) => !n.isRead).length;
    } catch (_) {
      _error = true;
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> markRead(String id) async {
    try {
      await _api.patch('/notifications/$id/read');
      _notifications = _notifications.map((n) => n.id == id ? NotificationItem(
        id: n.id, type: n.type, title: n.title, body: n.body,
        isRead: true, data: n.data, createdAt: n.createdAt,
      ) : n).toList();
      _unreadCount = _notifications.where((n) => !n.isRead).length;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> markAllRead() async {
    try {
      await _api.patch('/notifications/read-all');
      _notifications = _notifications.map((n) => NotificationItem(
        id: n.id, type: n.type, title: n.title, body: n.body,
        isRead: true, data: n.data, createdAt: n.createdAt,
      )).toList();
      _unreadCount = 0;
      notifyListeners();
    } catch (_) {}
  }

  @override
  void dispose() {
    _notifSub?.cancel();
    super.dispose();
  }
}