import 'user.dart';

class Conversation {
  final String id;
  final String? type;
  final String? name;
  final String? lastMessage;
  final String? lastMessageAt;
  final int unreadCount;
  final String? displayName;
  final String? avatar;
  final bool isOnline;
  final List<ConversationMember>? participants;

  Conversation({
    required this.id,
    this.type,
    this.name,
    this.lastMessage,
    this.lastMessageAt,
    this.unreadCount = 0,
    this.displayName,
    this.avatar,
    this.isOnline = false,
    this.participants,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    List<ConversationMember>? participants;
    if (json['participants'] != null) {
      participants = (json['participants'] as List).map((e) => ConversationMember.fromJson(e)).toList();
    }
    return Conversation(
      id: json['id'] ?? '',
      type: json['type'],
      name: json['name'],
      lastMessage: json['last_message'],
      lastMessageAt: json['last_message_at'],
      unreadCount: json['unread_count'] ?? 0,
      displayName: json['display_name'],
      avatar: json['avatar'],
      isOnline: json['is_online'] ?? false,
      participants: participants,
    );
  }
}

class ConversationMember {
  final String id;
  final String name;
  final String? avatar;
  final String? bio;
  final int isOnline;
  final String? lastSeen;

  ConversationMember({
    required this.id,
    required this.name,
    this.avatar,
    this.bio,
    this.isOnline = 0,
    this.lastSeen,
  });

  factory ConversationMember.fromJson(Map<String, dynamic> json) {
    return ConversationMember(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      avatar: json['avatar'],
      bio: json['bio'],
      isOnline: json['is_online'] ?? 0,
      lastSeen: json['last_seen'],
    );
  }
}