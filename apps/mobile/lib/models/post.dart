class Post {
  final String id;
  final String userId;
  final String? userName;
  final String? content;
  final String? imageUrl;
  final double? lat;
  final double? lng;
  final int likeCount;
  final bool isLiked;
  final String createdAt;

  Post({
    required this.id,
    required this.userId,
    this.userName,
    this.content,
    this.imageUrl,
    this.lat,
    this.lng,
    this.likeCount = 0,
    this.isLiked = false,
    required this.createdAt,
  });

  factory Post.fromJson(Map<String, dynamic> json) {
    return Post(
      id: json['id'] ?? '',
      userId: json['user_id'] ?? '',
      userName: json['user_name'],
      content: json['content'],
      imageUrl: json['image_url'],
      lat: (json['lat'] as num?)?.toDouble(),
      lng: (json['lng'] as num?)?.toDouble(),
      likeCount: json['like_count'] ?? 0,
      isLiked: json['is_liked'] ?? false,
      createdAt: json['created_at'] ?? '',
    );
  }
}