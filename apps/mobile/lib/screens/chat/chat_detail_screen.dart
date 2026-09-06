import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:image_picker/image_picker.dart';
import '../../models/message.dart';
import '../../models/conversation.dart';
import '../../services/api_service.dart';
import '../../services/socket_service.dart';
import '../../providers/app_providers.dart';
import '../../theme/app_theme.dart';

class ChatDetailScreen extends StatefulWidget {
  final String conversationId;
  const ChatDetailScreen({super.key, required this.conversationId});

  @override
  State<ChatDetailScreen> createState() => _ChatDetailScreenState();
}

class _ChatDetailScreenState extends State<ChatDetailScreen> {
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  final _api = ApiService();
  final _socket = SocketService();
  List<Message> _messages = [];
  bool _loading = true, _hasMore = true, _loadingMore = false;
  String? _typingConv;
  StreamSubscription? _msgSub, _delSub, _reactSub, _typeSub;

  ConversationMember? get _otherUser {
    final chat = context.read<ChatProvider>();
    final convs = chat.conversations.where((c) => c.id == widget.conversationId);
    return convs.isNotEmpty ? (convs.first.participants?.isNotEmpty == true ? convs.first.participants!.first : null) : null;
  }

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _socket.joinConversation(widget.conversationId);
    _socket.markRead(widget.conversationId);

    _msgSub = _socket.onMessage.listen((data) {
      if (data['conversation_id'] == widget.conversationId && data['sender_id'] != context.read<AuthProvider>().user?.id) {
        setState(() => _messages.add(Message.fromJson(data)));
        _scrollToBottom();
      }
    });

    _delSub = _socket.onDeleted.listen((data) {
      if (data['conversationId'] == widget.conversationId) {
        setState(() => _messages = _messages.map((m) => m.id == data['messageId'] ? Message(id: m.id, conversationId: m.conversationId, senderId: m.senderId, content: 'Tin nhắn đã được thu hồi', isDeleted: true, createdAt: m.createdAt, status: 'deleted', clientTempId: m.clientTempId) : m).toList());
      }
    });

    _reactSub = _socket.onReaction.listen((data) {
      if (data['conversationId'] == widget.conversationId) {
        setState(() {
          _messages = _messages.map((m) {
            if (m.id == data['messageId']) {
              final reactions = (data['reactions'] as List).map((e) => MessageReaction.fromJson(e)).toList();
              return Message(id: m.id, conversationId: m.conversationId, senderId: m.senderId, content: m.content, type: m.type, metadata: m.metadata, isDeleted: m.isDeleted, createdAt: m.createdAt, senderName: m.senderName, reactions: reactions, status: m.status, clientTempId: m.clientTempId);
            }
            return m;
          }).toList();
        });
      }
    });

    _typeSub = _socket.onTyping.listen((data) {
      if (data['conversationId'] == widget.conversationId) {
        if (data['stop'] == true) {
          setState(() => _typingConv = null);
        } else {
          setState(() => _typingConv = data['conversationId']);
          Timer(const Duration(seconds: 3), () { if (mounted) setState(() => _typingConv = null); });
        }
      }
    });
  }

  Future<void> _loadMessages() async {
    setState(() => _loading = true);
    try {
      final res = await _api.get('/messages/${widget.conversationId}', query: {'limit': '50'});
      final list = (res['data'] as List).map((e) => Message.fromJson(e)).toList();
      setState(() { _messages = list; _hasMore = list.length >= 50; });
    } catch (_) {}
    setState(() => _loading = false);
    _scrollToBottom();
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore || _messages.isEmpty) return;
    setState(() => _loadingMore = true);
    try {
      final oldest = _messages.first.createdAt;
      final res = await _api.get('/messages/${widget.conversationId}', query: {'limit': '50', 'before': oldest});
      final list = (res['data'] as List).map((e) => Message.fromJson(e)).toList();
      _hasMore = list.length >= 50;
      final existingIds = _messages.map((m) => m.id).toSet();
      for (final msg in list.reversed) {
        if (!existingIds.contains(msg.id)) _messages.insert(0, msg);
      }
    } catch (_) {}
    setState(() => _loadingMore = false);
  }

  void _sendMessage() {
    final text = _textCtrl.text.trim();
    if (text.isEmpty) return;
    _textCtrl.clear();
    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final user = context.read<AuthProvider>().user;
    final msg = Message(id: tempId, conversationId: widget.conversationId, senderId: user?.id ?? '', content: text, createdAt: DateTime.now().toIso8601String(), senderName: user?.name, status: 'sending', clientTempId: tempId);
    setState(() => _messages.add(msg));
    _scrollToBottom();

    _socket.sendMessage(
      conversationId: widget.conversationId,
      content: text,
      receiverId: _otherUser?.id,
      tempId: tempId,
    );
    _socket.stopTyping(widget.conversationId, _otherUser?.id ?? '');
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) _scrollCtrl.animateTo(_scrollCtrl.position.maxScrollExtent, duration: const Duration(milliseconds: 200), curve: Curves.easeOut);
    });
  }

  String _formatTime(String dateStr) {
    final d = DateTime.tryParse(dateStr);
    if (d == null) return '';
    if (DateTime.now().difference(d).inHours < 24) return DateFormat('HH:mm').format(d);
    return DateFormat('dd/MM HH:mm').format(d);
  }

  String _formatDate(String dateStr) {
    final d = DateTime.tryParse(dateStr);
    if (d == null) return '';
    final now = DateTime.now();
    if (d.day == now.day && d.month == now.month && d.year == now.year) return 'Hôm nay';
    if (now.difference(d).inDays < 2) return 'Hôm qua';
    return DateFormat('dd/MM/yyyy').format(d);
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;
    final otherName = _otherUser?.name ?? 'Đoạn chat';
    final otherOnline = _otherUser?.isOnline == 1;
    final initial = (otherName)[0].toUpperCase();
    final groupedMessages = <String, List<Message>>{};
    for (final msg in _messages) {
      final date = _formatDate(msg.createdAt);
      groupedMessages.putIfAbsent(date, () => []).add(msg);
    }

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(icon: const Icon(Icons.arrow_back), onPressed: () => Navigator.pop(context)),
        title: Row(children: [
          CircleAvatar(
            radius: 18, backgroundColor: AppTheme.primaryLight,
            child: Text(initial, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primary, fontSize: 14)),
          ),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(otherName, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
            Text(_typingConv != null ? 'Đang nhập...' : (otherOnline ? 'Đang hoạt động' : ''), style: TextStyle(fontSize: 11, color: _typingConv != null ? AppTheme.primary : AppTheme.textTertiary)),
          ]),
        ]),
        actions: [IconButton(icon: const Icon(Icons.info_outline), onPressed: () => _showUserInfo(context))],
      ),
      body: Column(
        children: [
          Expanded(
            child: _loading
              ? const Center(child: CircularProgressIndicator())
              : GestureDetector(
                  onTap: () => FocusScope.of(context).unfocus(),
                  child: ListView(
                    controller: _scrollCtrl,
                    padding: const EdgeInsets.all(12),
                    children: [
                      if (_loadingMore)
                        const Padding(padding: EdgeInsets.all(8), child: Center(child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)))),
                      ...groupedMessages.entries.map((entry) => Column(children: [
                        Center(child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          margin: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]),
                          child: Text(entry.key, style: const TextStyle(fontSize: 11, color: AppTheme.textTertiary)),
                        )),
                        ...entry.value.map((msg) => _buildMessageBubble(msg, user?.id)),
                      ])),
                      if (_typingConv != null)
                        const Padding(padding: EdgeInsets.all(8), child: Row(children: [Text('... ', style: TextStyle(fontSize: 16, color: AppTheme.textTertiary)), Text('Đang nhập', style: TextStyle(fontSize: 13, fontStyle: FontStyle.italic, color: AppTheme.textTertiary))])),
                      const SizedBox(height: 8),
                    ],
                  ),
                ),
          ),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(color: AppTheme.surface, border: Border(top: BorderSide(color: AppTheme.border))),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.image_outlined, color: AppTheme.textSecondary, size: 24),
                  onPressed: () => _pickImage(),
                ),
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    minLines: 1, maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Nhập tin nhắn...',
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                      filled: true, fillColor: const Color(0xFFF3F4F6),
                    ),
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                    onChanged: (v) {
                      if (v.isNotEmpty) _socket.sendTyping(widget.conversationId, _otherUser?.id ?? '');
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(12)),
                  child: IconButton(
                    icon: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                    onPressed: _sendMessage,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(Message msg, String? userId) {
    final isMine = msg.senderId == userId;
    final isImage = msg.type == 'image';
    final attUrl = msg.metadata?['attachmentUrl'];
    final emoji = ['❤️','😍','😂','😢','😡','👍','🙏','🔥','🎉','💯'];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Column(
        crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (msg.replyPreview != null && !msg.replyPreview!.isDeleted)
            Container(
              margin: const EdgeInsets.only(bottom: 2),
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isMine ? AppTheme.primary.withOpacity(0.15) : Colors.grey[200],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                const Text('Đang trả lời', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500, color: AppTheme.primary)),
                Text(msg.replyPreview!.content ?? '', maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
              ]),
            ),
          Container(
            constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
            padding: msg.isDeleted ? const EdgeInsets.symmetric(horizontal: 12, vertical: 8) : (isImage && attUrl != null ? EdgeInsets.zero : const EdgeInsets.symmetric(horizontal: 14, vertical: 10)),
            decoration: BoxDecoration(
              color: isMine ? AppTheme.bubbleMine : AppTheme.bubbleOther,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(18),
                topRight: const Radius.circular(18),
                bottomLeft: Radius.circular(isMine ? 18 : 4),
                bottomRight: Radius.circular(isMine ? 4 : 18),
              ),
              boxShadow: isMine ? [] : [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 4, offset: const Offset(0, 2))],
            ),
            child: Column(
              crossAxisAlignment: isMine ? CrossAxisAlignment.end : CrossAxisAlignment.start,
              children: [
                if (msg.isDeleted)
                  Text(msg.content, style: const TextStyle(fontStyle: FontStyle.italic, color: AppTheme.textTertiary, fontSize: 13))
                else if (isImage && attUrl != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(14),
                    child: Image.network(attUrl, width: 240, fit: BoxFit.cover, loadingBuilder: (_, child, progress) => progress == null ? child : Container(height: 200, color: AppTheme.chatBg, child: const Center(child: CircularProgressIndicator(strokeWidth: 2))), errorBuilder: (_, __, ___) => Container(height: 120, color: AppTheme.chatBg, child: const Center(child: Text('Không thể tải ảnh', style: TextStyle(fontSize: 12, color: AppTheme.textTertiary))))),
                  )
                else
                  Text(msg.content, style: TextStyle(fontSize: 15, color: isMine ? Colors.white : AppTheme.textPrimary)),
                const SizedBox(height: 4),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(_formatTime(msg.createdAt), style: TextStyle(fontSize: 10, color: isMine ? Colors.white70 : AppTheme.textTertiary)),
                    if (isMine && !msg.isDeleted) ...[
                      const SizedBox(width: 4),
                      Icon(
                        msg.status == 'sending' ? Icons.access_time : (msg.status == 'failed' ? Icons.error_outline : Icons.done_all),
                        size: 14, color: msg.status == 'failed' ? AppTheme.error : (isMine ? Colors.white70 : AppTheme.textTertiary),
                      ),
                    ],
                  ],
                ),
                if (msg.reactions.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.white, borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppTheme.border),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: msg.reactions.map((r) => Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 1),
                          child: Text(r.emoji, style: const TextStyle(fontSize: 14)),
                        )).toList(),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _pickImage() async {
    final picker = ImagePicker();
    final file = await picker.pickImage(source: ImageSource.gallery);
    if (file == null) return;
    try {
      final res = await _api.uploadImage(file.path);
      final url = res['data']['url'];
      final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
      final user = context.read<AuthProvider>().user;
      setState(() => _messages.add(Message(id: tempId, conversationId: widget.conversationId, senderId: user?.id ?? '', content: '', type: 'image', metadata: {'attachmentUrl': url}, createdAt: DateTime.now().toIso8601String(), senderName: user?.name, status: 'sending', clientTempId: tempId)));
      _scrollToBottom();
      _socket.sendMessage(conversationId: widget.conversationId, content: '', receiverId: _otherUser?.id, tempId: tempId, attachmentUrl: url);
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Không thể gửi ảnh')));
    }
  }

  void _showUserInfo(BuildContext context) {
    final u = _otherUser;
    if (u == null) return;
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (_) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          CircleAvatar(
            radius: 36, backgroundColor: AppTheme.primaryLight,
            child: Text((u.name)[0].toUpperCase(), style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.primary)),
          ),
          const SizedBox(height: 12),
          Text(u.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: u.isOnline == 1 ? AppTheme.online : AppTheme.offline, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(u.isOnline == 1 ? 'Đang hoạt động' : 'Không hoạt động', style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
          ]),
          if (u.bio != null) ...[const SizedBox(height: 12), Text(u.bio!, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary), textAlign: TextAlign.center)],
          const SizedBox(height: 24),
        ]),
      ),
    );
  }

  @override
  void dispose() {
    _socket.leaveConversation(widget.conversationId);
    _msgSub?.cancel();
    _delSub?.cancel();
    _reactSub?.cancel();
    _typeSub?.cancel();
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }
}