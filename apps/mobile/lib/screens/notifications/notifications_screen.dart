import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/app_providers.dart';
import '../../theme/app_theme.dart';
import 'package:intl/intl.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<NotificationProvider>().fetchNotifications();
    });
  }

  // Relative timestamp
  String _timeAgo(String raw) {
    try {
      final dt = DateTime.parse(raw);
      final diff = DateTime.now().difference(dt);
      if (diff.inSeconds < 60) return 'vừa xong';
      if (diff.inMinutes < 60) return '${diff.inMinutes} phút';
      if (diff.inHours < 24) return '${diff.inHours} giờ';
      if (diff.inDays == 1) return 'hôm qua';
      if (diff.inDays < 7) return '${diff.inDays} ngày';
      return DateFormat('dd/MM').format(dt);
    } catch (_) {
      return raw.isNotEmpty ? raw.substring(0, 10) : '';
    }
  }

  // Icon + color by notification type
  (IconData, Color, String) _notifMeta(String type) {
    switch (type) {
      case 'like':
        return (Icons.favorite, Colors.red, 'Thích bài viết');
      case 'comment':
        return (Icons.chat_bubble_outline, AppTheme.primary, 'Bình luận');
      case 'sos':
        return (Icons.warning_amber_rounded, Colors.orange, 'SOS');
      case 'system':
        return (Icons.info_outline, AppTheme.secondary, 'Hệ thống');
      default:
        return (Icons.notifications_outlined, AppTheme.textTertiary, '');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<NotificationProvider>(builder: (context, notif, _) {
      return Scaffold(
        appBar: AppBar(
          title: Row(children: [
            const Text('Thông báo'),
            if (notif.unreadCount > 0) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10)),
                child: Text('${notif.unreadCount}',
                    style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ]),
          actions: [
            if (notif.unreadCount > 0)
              TextButton(
                onPressed: () => notif.markAllRead(),
                child: const Text('Đã đọc tất cả', style: TextStyle(fontSize: 13)),
              ),
          ],
        ),
        body: _buildBody(notif),
      );
    });
  }

  Widget _buildBody(NotificationProvider notif) {
    if (notif.loading && notif.notifications.isEmpty) {
      return const Center(child: CircularProgressIndicator(strokeWidth: 2.5));
    }

    if (notif.error && notif.notifications.isEmpty) {
      return Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.cloud_off, size: 48, color: AppTheme.textTertiary.withOpacity(0.4)),
          const SizedBox(height: 12),
          const Text('Không thể tải thông báo', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary)),
          const SizedBox(height: 12),
          TextButton(
            onPressed: () => notif.fetchNotifications(),
            child: const Text('Thử lại'),
          ),
        ]),
      );
    }

    if (notif.notifications.isEmpty) {
      return Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Icons.notifications_none, size: 64, color: AppTheme.textTertiary.withOpacity(0.3)),
          const SizedBox(height: 16),
          const Text('Chưa có thông báo', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          const SizedBox(height: 6),
          const Text('Khi có hoạt động mới, thông báo sẽ xuất hiện tại đây.',
              style: TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
        ]),
      );
    }

    return RefreshIndicator(
      onRefresh: () => notif.fetchNotifications(),
      child: ListView.separated(
        padding: const EdgeInsets.only(top: 4),
        itemCount: notif.notifications.length,
        separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
        itemBuilder: (context, i) {
          final n = notif.notifications[i];
          final (icon, color, typeLabel) = _notifMeta(n.type);

          return Material(
            color: n.isRead ? Colors.transparent : AppTheme.primaryLight.withOpacity(0.3),
            child: InkWell(
              onTap: () => notif.markRead(n.id),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Avatar/Icon
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Icon(icon, size: 22, color: color),
                    ),
                    const SizedBox(width: 12),
                    // Content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (typeLabel.isNotEmpty)
                            Text(typeLabel, style: TextStyle(
                              fontSize: 11, fontWeight: FontWeight.w600,
                              color: color, letterSpacing: 0.3,
                            )),
                          const SizedBox(height: 2),
                          Text(
                            n.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600,
                              fontSize: 14,
                              color: AppTheme.textPrimary,
                            ),
                          ),
                          if (n.body.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              n.body,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary),
                            ),
                          ],
                          const SizedBox(height: 4),
                          Text(
                            _timeAgo(n.createdAt),
                            style: const TextStyle(fontSize: 11, color: AppTheme.textTertiary),
                          ),
                        ],
                      ),
                    ),
                    // Unread dot
                    if (!n.isRead)
                      Container(
                        width: 8, height: 8,
                        margin: const EdgeInsets.only(left: 8, top: 4),
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}