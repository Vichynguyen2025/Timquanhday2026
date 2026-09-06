class User {
  final String id;
  final String name;
  final String? email;
  final String? phone;
  final String? avatar;
  final String? bio;
  final int isOnline;
  final String? lastSeen;
  final String? createdAt;

  User({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.avatar,
    this.bio,
    this.isOnline = 0,
    this.lastSeen,
    this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'],
      phone: json['phone'],
      avatar: json['avatar'],
      bio: json['bio'],
      isOnline: json['is_online'] ?? 0,
      lastSeen: json['last_seen'],
      createdAt: json['created_at'],
    );
  }
}