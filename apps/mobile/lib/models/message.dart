class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final String type;
  final Map<String, dynamic>? metadata;
  final String? replyToId;
  final bool isDeleted;
  final String? editedAt;
  final String createdAt;
  final String? senderName;
  final String? senderAvatar;
  final MessageReplyPreview? replyPreview;
  final List<MessageReaction> reactions;
  String status;
  String? clientTempId;

  Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    this.type = 'text',
    this.metadata,
    this.replyToId,
    this.isDeleted = false,
    this.editedAt,
    required this.createdAt,
    this.senderName,
    this.senderAvatar,
    this.replyPreview,
    this.reactions = const [],
    this.status = 'sent',
    this.clientTempId,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    List<MessageReaction> reactions = [];
    if (json['reactions'] != null) {
      reactions = (json['reactions'] as List).map((e) => MessageReaction.fromJson(e)).toList();
    }
    MessageReplyPreview? replyPreview;
    if (json['reply_preview'] != null) {
      replyPreview = MessageReplyPreview.fromJson(json['reply_preview']);
    }
    return Message(
      id: json['id'] ?? '',
      conversationId: json['conversation_id'] ?? '',
      senderId: json['sender_id'] ?? '',
      content: json['content'] ?? '',
      type: json['type'] ?? 'text',
      metadata: json['metadata'],
      replyToId: json['reply_to_id'],
      isDeleted: json['is_deleted'] ?? false,
      editedAt: json['edited_at'],
      createdAt: json['created_at'] ?? '',
      senderName: json['sender_name'],
      senderAvatar: json['sender_avatar'],
      replyPreview: replyPreview,
      reactions: reactions,
      status: 'sent',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'conversation_id': conversationId,
    'sender_id': senderId,
    'content': content,
    'type': type,
    'metadata': metadata,
    'reply_to_id': replyToId,
    'is_deleted': isDeleted,
    'created_at': createdAt,
    'sender_name': senderName,
    'sender_avatar': senderAvatar,
  };
}

class MessageReaction {
  final String emoji;
  final String userId;
  final String? userName;

  MessageReaction({required this.emoji, required this.userId, this.userName});

  factory MessageReaction.fromJson(Map<String, dynamic> json) {
    return MessageReaction(
      emoji: json['emoji'] ?? '',
      userId: json['userId'] ?? json['user_id'] ?? '',
      userName: json['userName'] ?? json['user_name'],
    );
  }
}

class MessageReplyPreview {
  final String id;
  final String? content;
  final String? senderId;
  final bool isDeleted;

  MessageReplyPreview({required this.id, this.content, this.senderId, this.isDeleted = false});

  factory MessageReplyPreview.fromJson(Map<String, dynamic> json) {
    return MessageReplyPreview(
      id: json['id'] ?? '',
      content: json['content'],
      senderId: json['sender_id'],
      isDeleted: json['is_deleted'] ?? false,
    );
  }
}