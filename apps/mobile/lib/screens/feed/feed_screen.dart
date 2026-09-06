import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../services/api_service.dart';
import '../../models/post.dart';
import '../../theme/app_theme.dart';

class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});
  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _api = ApiService();
  List<Post> _posts = [];
  bool _loading = true;
  int _radius = 500;

  @override
  void initState() {
    super.initState();
    _fetchPosts();
  }

  Future<void> _fetchPosts() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/posts', query: {'radius': '$_radius'});
      _posts = (res['data'] as List).map((e) => Post.fromJson(e)).toList();
    } catch (_) {}
    setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Khám phá')),
      body: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(color: AppTheme.surface, border: Border(bottom: BorderSide(color: AppTheme.border))),
            child: Row(children: [
              const Text('Bán kính: ', style: TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [100, 200, 500, 1000, 5000].map((r) => Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(r >= 1000 ? '${r ~/ 1000}km' : '${r}m', style: TextStyle(fontSize: 12, color: _radius == r ? Colors.white : AppTheme.textPrimary)),
                        selected: _radius == r,
                        selectedColor: AppTheme.primary,
                        onSelected: (_) { setState(() => _radius = r); _fetchPosts(); },
                      ),
                    )).toList(),
                  ),
                ),
              ),
            ]),
          ),
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _fetchPosts,
                  child: _posts.isEmpty
                    ? ListView(children: [const Center(child: Padding(padding: EdgeInsets.all(40), child: Column(children: [Icon(Icons.explore_outlined, size: 60, color: AppTheme.textTertiary), SizedBox(height: 16), Text('Chưa có bài viết nào gần đây', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary))])))])
                    : ListView.builder(
                        itemCount: _posts.length,
                        padding: const EdgeInsets.all(16),
                        itemBuilder: (context, i) {
                          final p = _posts[i];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 12),
                            child: Padding(
                              padding: const EdgeInsets.all(16),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  CircleAvatar(
                                    radius: 20, backgroundColor: AppTheme.primaryLight,
                                    child: Text((p.userName ?? '?')[0].toUpperCase(), style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary)),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Text(p.userName ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                                    const SizedBox(height: 2),
                                    Text(p.createdAt, style: const TextStyle(fontSize: 11, color: AppTheme.textTertiary)),
                                  ])),
                                ]),
                                if (p.content != null && p.content!.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Text(p.content!, style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary, height: 1.4)),
                                ],
                                if (p.imageUrl != null) ...[
                                  const SizedBox(height: 10),
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Image.network(p.imageUrl!, fit: BoxFit.cover, width: double.infinity, errorBuilder: (_, __, ___) => Container(height: 150, color: AppTheme.chatBg)),
                                  ),
                                ],
                                const SizedBox(height: 10),
                                Row(children: [
                                  Icon(Icons.favorite_border, size: 18, color: p.isLiked ? AppTheme.error : AppTheme.textTertiary),
                                  const SizedBox(width: 4),
                                  Text('${p.likeCount}', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                                ]),
                              ]),
                            ),
                          );
                        },
                      ),
                ),
          ),
        ],
      ),
    );
  }
}