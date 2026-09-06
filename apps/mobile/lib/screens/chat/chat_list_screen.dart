import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/app_providers.dart';
import '../../models/conversation.dart';
import '../../models/message.dart';
import '../../services/socket_service.dart';
import '../../theme/app_theme.dart';
import 'chat_detail_screen.dart';

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});
  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<ChatProvider>().fetchConversations();
    });
  }

  String _formatTime(String? dateStr) {
    if (dateStr == null) return '';
    final d = DateTime.tryParse(dateStr);
    if (d == null) return '';
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inMinutes < 1) return 'Vừa xong';
    if (diff.inHours < 1) return '${diff.inMinutes}p';
    if (d.day == now.day) return DateFormat('HH:mm').format(d);
    if (diff.inDays < 2) return 'Hôm qua';
    return DateFormat('dd/MM').format(d);
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<ChatProvider>(builder: (context, chat, _) {
      final convs = chat.conversations;
      return Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            color: AppTheme.surface,
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                const Text('Đoạn chat', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(color: AppTheme.primaryLight, borderRadius: BorderRadius.circular(20)),
                  child: Text('${convs.length}', style: const TextStyle(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.w600)),
                ),
              ]),
              const SizedBox(height: 12),
              Container(
                decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(12)),
                child: const TextField(
                  decoration: InputDecoration(
                    hintText: 'Tìm kiếm đoạn chat...',
                    prefixIcon: Icon(Icons.search, size: 20, color: AppTheme.textTertiary),
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  ),
                ),
              ),
            ]),
          ),
          if (chat.loadingConversations)
            const Expanded(child: Center(child: CircularProgressIndicator()))
          else if (convs.isEmpty)
            Expanded(child: Center(
              child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.chat_bubble_outline, size: 60, color: AppTheme.textTertiary.withOpacity(0.4)),
                const SizedBox(height: 16),
                const Text('Chưa có đoạn chat', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500, color: AppTheme.textSecondary)),
                const SizedBox(height: 4),
                const Text('Bắt đầu trò chuyện từ mục Khám phá', style: TextStyle(fontSize: 13, color: AppTheme.textTertiary)),
              ]),
            ))
          else
            Expanded(
              child: ListView.builder(
                itemCount: convs.length,
                itemBuilder: (context, i) {
                  final c = convs[i];
                  final initial = (c.displayName ?? '?')[0].toUpperCase();
                  return ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                    leading: Stack(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: AppTheme.primaryLight,
                          child: Text(initial, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 18)),
                        ),
                        if (c.isOnline)
                          Positioned(bottom: 0, right: 0, child: Container(width: 12, height: 12, decoration: const BoxDecoration(color: AppTheme.online, shape: BoxShape.circle, border: Border.fromBorderSide(BorderSide(color: Colors.white, width: 2)))))
                      ],
                    ),
                    title: Text(c.displayName ?? 'Đoạn chat', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14, color: AppTheme.textPrimary)),
                    subtitle: Text(c.lastMessage ?? 'Chưa có tin nhắn', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                    trailing: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(_formatTime(c.lastMessageAt), style: const TextStyle(fontSize: 11, color: AppTheme.textTertiary)),
                        if (c.unreadCount > 0) ...[
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10)),
                            child: Text(c.unreadCount > 99 ? '99+' : '${c.unreadCount}', style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ],
                    ),
                    onTap: () {
                      chat.markConversationRead(c.id);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => ChatDetailScreen(conversationId: c.id)));
                    },
                  );
                },
              ),
            ),
        ],
      );
    });
  }
}