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
                child: Text('${notif.unreadCount}', style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ]),
        ),
        body: notif.notifications.isEmpty
          ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.notifications_none, size: 60, color: AppTheme.textTertiary.withOpacity(0.4)),
              const SizedBox(height: 16),
              const Text('Không có thông báo', style: TextStyle(fontSize: 15, color: AppTheme.textSecondary)),
            ]))
          : ListView.separated(
              itemCount: notif.notifications.length,
              separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
              itemBuilder: (context, i) {
                final n = notif.notifications[i];
                return ListTile(
                  leading: CircleAvatar(
                    backgroundColor: n.isRead ? AppTheme.chatBg : AppTheme.primaryLight,
                    child: Icon(
                      n.type == 'message' ? Icons.chat_bubble_outline : (n.type == 'like' ? Icons.favorite_border : Icons.notifications_outlined),
                      size: 20, color: n.isRead ? AppTheme.textTertiary : AppTheme.primary,
                    ),
                  ),
                  title: Text(n.title, style: TextStyle(fontWeight: n.isRead ? FontWeight.normal : FontWeight.w600, fontSize: 14)),
                  subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    const SizedBox(height: 2),
                    Text(n.createdAt, style: const TextStyle(fontSize: 11, color: AppTheme.textTertiary)),
                  ]),
                  trailing: n.isRead ? null : Container(width: 8, height: 8, decoration: const BoxDecoration(color: AppTheme.primary, shape: BoxShape.circle)),
                  onTap: () => notif.markRead(n.id),
                );
              },
            ),
      );
    });
  }
}