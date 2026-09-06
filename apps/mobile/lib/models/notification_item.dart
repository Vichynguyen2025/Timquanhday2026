class NotificationItem {
  final String id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final String? data;
  final String createdAt;

  NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    this.isRead = false,
    this.data,
    required this.createdAt,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] ?? '',
      type: json['type'] ?? '',
      title: json['title'] ?? '',
      body: json['body'] ?? '',
      isRead: json['is_read'] ?? false,
      data: json['data']?.toString(),
      createdAt: json['created_at'] ?? '',
    );
  }
}