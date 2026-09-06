import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import API from '../services/api';
import {
  FiSend, FiSearch, FiArrowLeft, FiPaperclip, FiMessageCircle,
  FiTrash2, FiSmile, FiCornerUpLeft, FiX, FiUser, FiClock, FiPhone, FiMapPin,
  FiAlertCircle, FiImage, FiFile, FiCheck, FiCheckCircle, FiMoreVertical
} from 'react-icons/fi';

// ─── Modern tech-style emoji set ────────────────
const EMOJIS = [
  '👍', '❤️', '🔥', '😂', '😍',
  '🎉', '💯', '✨', '🚀', '🙌',
  '👏', '😢', '😡', '💪', '🤝',
];

const MESSAGES_PER_PAGE = 50;
const TYPING_DEBOUNCE = 800;

// ─── Time formatter: full Vietnamese ─────────────
function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 10) return 'Vừa xong';
  if (seconds < 60) return `${seconds} giây trước`;
  if (minutes === 1) return '1 phút trước';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours === 1) return '1 giờ trước';
  if (hours < 6) return `${hours} giờ trước`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 86400000 * 2) return 'Hôm qua';
  if (diff < 86400000 * 7) return `${Math.floor(diff / 86400000)} ngày trước`;
  return d.toLocaleDateString('vi-VN');
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hôm nay';
  if (now - d < 86400000 * 2) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── mergeIncomingMessage ──────────────────────────────
function mergeIncomingMessage(messages, incoming) {
  const byId = messages.find(m => m.id === incoming.id);
  if (byId) {
    return messages.map(m => m.id === incoming.id ? { ...m, ...incoming, status: incoming.status || m.status } : m);
  }
  if (incoming.client_temp_id) {
    const byTempId = messages.find(m => m.client_temp_id === incoming.client_temp_id);
    if (byTempId) {
      return messages.map(m => m.client_temp_id === incoming.client_temp_id
        ? { ...byTempId, ...incoming, id: incoming.id || byTempId.id, status: 'sent' }
        : m);
    }
  }
  return [...messages, incoming];
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

// ─── Status icon with read/delivered text ──────
function StatusIcon({ status, isMine }) {
  if (!isMine) return null;
  switch (status) {
    case 'sending':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-primary-200">
          <span className="w-1.5 h-1.5 rounded-full bg-primary-200 animate-pulse" />
          Đang gửi
        </span>
      );
    case 'sent':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-blue-200">
          <FiCheck size={10} className="stroke-[2.5]" />
          <FiCheck size={10} className="stroke-[2.5] -ml-2" />
          Đã gửi
        </span>
      );
    case 'delivered':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-blue-200">
          <FiCheck size={10} className="stroke-[2.5]" />
          <FiCheck size={10} className="stroke-[2.5] -ml-2" />
          Đã nhận
        </span>
      );
    case 'read':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-blue-300">
          <FiCheckCircle size={10} className="fill-blue-300 stroke-white" strokeWidth={2} />
          Đã xem
        </span>
      );
    case 'failed':
      return <FiAlertCircle size={12} className="text-red-300" title="Gửi thất bại" />;
    default:
      return null;
  }
}

export default function ChatPage() {
  const params = useParams();
  const navigate = useNavigate();
  const activeConvId = params.id || null;
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();

  // ─── State ────────────────────────────────────
  const [conversations, setConversations] = useState([]);
  const [typing, setTyping] = useState({});
  const [search, setSearch] = useState('');
  const [messages, setMessages] = useState([]);
  const [convDetail, setConvDetail] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [convLoading, setConvLoading] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(null);
  const [newMsgIndicator, setNewMsgIndicator] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docName, setDocName] = useState(null);
  const [blockStatus, setBlockStatus] = useState(null); // null, 'blocked_by_me', 'blocked_by_them'

  // ─── Refs ─────────────────────────────────────
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const messagesCacheRef = useRef(new Map());
  const detailCacheRef = useRef(new Map());
  const hasMoreCacheRef = useRef(new Map());
  const prevConvRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
      setNewMsgIndicator(false);
      isNearBottomRef.current = true;
    }, 50);
  }, []);

  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const threshold = 150;
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    if (isNearBottomRef.current) setNewMsgIndicator(false);

    if (el.scrollTop < 50 && hasMore && !loadingMore && messages.length > 0 && activeConvId) {
      setLoadingMore(true);
      const oldestMsg = messages[0];
      API.get(`/messages/${activeConvId}?limit=${MESSAGES_PER_PAGE}&before=${oldestMsg.created_at}`)
        .then(({ data }) => {
          const done = data.length < MESSAGES_PER_PAGE;
          if (done) { hasMoreCacheRef.current.set(activeConvId, false); setHasMore(false); }
          setMessages(prev => {
            const merged = [...data];
            for (const m of prev) { if (!merged.find(x => x.id === m.id)) merged.push(m); }
            messagesCacheRef.current.set(activeConvId, merged);
            return merged;
          });
          const prevHeight = el.scrollHeight;
          requestAnimationFrame(() => { el.scrollTop = el.scrollHeight - prevHeight; });
        })
        .catch(() => {})
        .finally(() => setLoadingMore(false));
    }
  }, [activeConvId, hasMore, loadingMore, messages]);

  useEffect(() => {
    API.get('/conversations').then(({ data }) => setConversations(data)).catch(() => {});
  }, []);

  const switchConversation = useCallback((convId) => {
    if (convId === activeConvId) return;
    navigate(`/chat/${convId}`, { replace: false });
  }, [activeConvId, navigate]);

  useEffect(() => {
    if (prevConvRef.current && prevConvRef.current !== activeConvId) {
      socket?.emit('conversation:leave', { conversationId: prevConvRef.current });
    }
    prevConvRef.current = activeConvId;
    if (!activeConvId) return;
    setReplyTo(null); setShowEmoji(null); setNewMsgIndicator(false);
    setSelectedFile(null); setPreviewUrl(null); setSelectedDoc(null); setDocName(null); setText('');

    if (messagesCacheRef.current.has(activeConvId)) {
      setMessages(messagesCacheRef.current.get(activeConvId));
      setHasMore(hasMoreCacheRef.current.get(activeConvId) !== false);
      scrollToBottom(false);
    } else {
      setMessages([]); setHasMore(true); setConvLoading(true);
    }

    if (detailCacheRef.current.has(activeConvId)) {
      setConvDetail(detailCacheRef.current.get(activeConvId));
    } else { setConvDetail(null); }

    socket?.emit('conversation:join', { conversationId: activeConvId });
    setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));

    API.get(`/messages/${activeConvId}?limit=${MESSAGES_PER_PAGE}`)
      .then(({ data }) => {
        const done = data.length < MESSAGES_PER_PAGE;
        hasMoreCacheRef.current.set(activeConvId, !done);
        messagesCacheRef.current.set(activeConvId, data);
        setMessages(data); setHasMore(!done); setConvLoading(false);
        scrollToBottom(false);
      }).catch(() => setConvLoading(false));

    API.get(`/conversations/${activeConvId}`).then(({ data }) => {
      detailCacheRef.current.set(activeConvId, data);
      setConvDetail(data);
    }).catch(() => {});

    return () => {};
  }, [activeConvId, socket, scrollToBottom]);

  // ─── Socket events ─────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (msg) => {
      if (msg.sender_id === user?.id) return;
      if (msg.conversation_id === activeConvId) {
        setMessages(prev => {
          const updated = mergeIncomingMessage(prev, msg);
          messagesCacheRef.current.set(msg.conversation_id, updated);
          return updated;
        });
        if (isNearBottomRef.current) { scrollToBottom(true); } else { setNewMsgIndicator(true); }
      } else if (messagesCacheRef.current.has(msg.conversation_id)) {
        const cached = messagesCacheRef.current.get(msg.conversation_id);
        messagesCacheRef.current.set(msg.conversation_id, mergeIncomingMessage(cached, msg));
      }
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === msg.conversation_id) {
            const isActive = c.id === activeConvId;
            return {
              ...c,
              last_message: msg.content || (msg.type === 'image' ? '📷 Ảnh' : (msg.type === 'file' ? '📎 File' : msg.content)),
              last_message_at: msg.created_at,
              unread_count: isActive ? 0 : (c.unread_count || 0) + 1,
            };
          }
          return c;
        });
        return updated.sort((a, b) => {
          const aTime = new Date(a.last_message_at || 0).getTime();
          const bTime = new Date(b.last_message_at || 0).getTime();
          return bTime - aTime;
        });
      });
    });

    socket.on('message:deleted', ({ messageId, conversationId }) => {
      const updater = (msgs) => msgs.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'Tin nhắn đã được thu hồi' } : m);
      setMessages(prev => {
        const updated = updater(prev);
        if (conversationId) messagesCacheRef.current.set(conversationId, updated);
        return updated;
      });
    });

    socket.on('message:reaction', ({ messageId, conversationId, reactions }) => {
      const updater = (msgs) => msgs.map(m => m.id === messageId ? { ...m, reactions } : m);
      setMessages(prev => {
        const updated = updater(prev);
        if (conversationId) messagesCacheRef.current.set(conversationId, updated);
        return updated;
      });
    });

    socket.on('user:typing', ({ conversationId, userId: uId }) => {
      if (uId !== user?.id) setTyping(prev => ({ ...prev, [conversationId]: true }));
    });
    socket.on('user:stop-typing', ({ conversationId }) => {
      setTyping(prev => ({ ...prev, [conversationId]: false }));
    });

    return () => {
      socket.off('message:new'); socket.off('message:deleted'); socket.off('message:reaction');
      socket.off('user:typing'); socket.off('user:stop-typing');
    };
  }, [socket, user, activeConvId, scrollToBottom]);

  // ─── Send text ────────────────────────────────
  const sendMessage = (e) => {
    e?.preventDefault();
    if (!text.trim() || !activeConvId) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const receiverId = convDetail?.members?.find(m => m.id !== user?.id)?.id;

    const optimisticMsg = {
      id: tempId, conversation_id: activeConvId, sender_id: user?.id, content: text.trim(),
      type: 'text', reply_to_id: replyTo?.id || null, is_deleted: false, reactions: [],
      reply_preview: replyTo ? { id: replyTo.id, content: replyTo.content, sender_id: replyTo.sender_id, is_deleted: false } : null,
      created_at: new Date().toISOString(), sender_name: user?.name || 'You', sender_avatar: null,
      status: 'sending', client_temp_id: tempId,
    };

    setMessages(prev => {
      const updated = [...prev, optimisticMsg];
      messagesCacheRef.current.set(activeConvId, updated);
      return updated;
    });
    scrollToBottom(true);

    socket?.emit('message:send', {
      conversationId: activeConvId, content: text.trim(), type: 'text', receiverId,
      replyToId: replyTo?.id || null, tempId,
    }, (response) => {
      if (response?.success && response?.message) {
        setMessages(prev => {
          const updated = mergeIncomingMessage(prev, { ...response.message, id: response.messageId, client_temp_id: tempId, status: 'sent' });
          messagesCacheRef.current.set(activeConvId, updated);
          return updated;
        });
        setConversations(prev => prev.map(c =>
          c.id === activeConvId ? { ...c, last_message: response.message.content || (response.message.type === 'image' ? '📷 Ảnh' : (response.message.type === 'file' ? '📎 File' : '')), last_message_at: response.message.created_at } : c
        ));
      } else if (response?.success) {
        setMessages(prev => {
          const updated = mergeIncomingMessage(prev, { id: response.messageId, client_temp_id: tempId, status: 'sent' });
          messagesCacheRef.current.set(activeConvId, updated);
          return updated;
        });
      } else if (response?.duplicate) {
        setMessages(prev => {
          const updated = prev.filter(m => m.id !== tempId);
          messagesCacheRef.current.set(activeConvId, updated);
          return updated;
        });
      } else if (response?.code === 'USER_BLOCKED') {
        setMessages(prev => {
          const updated = prev.map(m => m.id === tempId ? { ...m, status: 'failed', error: response.message } : m);
          messagesCacheRef.current.set(activeConvId, updated);
          return updated;
        });
        alert(response.message);
      } else {
        setMessages(prev => {
          const updated = prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m);
          messagesCacheRef.current.set(activeConvId, updated);
          return updated;
        });
      }
    });

    setText('');
    setReplyTo(null);
    socket?.emit('typing:stop', { conversationId: activeConvId, receiverId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  };

  // ─── Send image ───────────────────────────────
  const sendImageMessage = async () => {
    if (!selectedFile || !activeConvId || uploading) return;
    setUploading(true);
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const receiverId = convDetail?.members?.find(m => m.id !== user?.id)?.id;

    const optimisticMsg = {
      id: tempId, conversation_id: activeConvId, sender_id: user?.id, content: '',
      type: 'image', metadata: { attachmentUrl: previewUrl, attachmentName: selectedFile.name, attachmentSize: selectedFile.size },
      reply_to_id: null, is_deleted: false, reactions: [], reply_preview: null,
      created_at: new Date().toISOString(), sender_name: user?.name || 'You', sender_avatar: null,
      status: 'uploading', client_temp_id: tempId,
    };

    setMessages(prev => {
      const updated = [...prev, optimisticMsg];
      messagesCacheRef.current.set(activeConvId, updated);
      return updated;
    });
    scrollToBottom(true);

    try {
      const result = await uploadImage(selectedFile);
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? { ...m, status: 'sending', metadata: { ...m.metadata, attachmentUrl: result.url } } : m);
        messagesCacheRef.current.set(activeConvId, updated);
        return updated;
      });

      socket?.emit('message:send', {
        conversationId: activeConvId, content: '', type: 'image', receiverId, tempId,
        attachmentUrl: result.url, attachmentName: result.filename, attachmentSize: result.size,
      }, (response) => {
        if (response?.success) {
          setMessages(prev => {
            const updated = mergeIncomingMessage(prev, { id: response.messageId, client_temp_id: tempId, status: 'sent' });
            messagesCacheRef.current.set(activeConvId, updated);
            return updated;
          });
        } else if (response?.duplicate) {
          setMessages(prev => {
            const updated = prev.filter(m => m.id !== tempId);
            messagesCacheRef.current.set(activeConvId, updated);
            return updated;
          });
        } else {
          setMessages(prev => {
            const updated = prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m);
            messagesCacheRef.current.set(activeConvId, updated);
            return updated;
          });
        }
      });
    } catch (err) {
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m);
        messagesCacheRef.current.set(activeConvId, updated);
        return updated;
      });
    }
    setUploading(false);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleTyping = (val) => {
    setText(val);
    if (!activeConvId) return;
    const receiverId = convDetail?.members?.find(m => m.id !== user?.id)?.id;
    if (!receiverId) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (!window._lastTypingEmit || Date.now() - window._lastTypingEmit > TYPING_DEBOUNCE) {
      socket?.emit('typing:start', { conversationId: activeConvId, receiverId });
      window._lastTypingEmit = Date.now();
    }
    typingTimerRef.current = setTimeout(() => {
      socket?.emit('typing:stop', { conversationId: activeConvId, receiverId });
    }, 2000);
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedDoc(file);
    setDocName(file.name);
    e.target.value = '';
  };

  const cancelFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const cancelDoc = () => {
    setSelectedDoc(null);
    setDocName(null);
  };

  const deleteMessage = (msgId) => {
    socket?.emit('message:delete', { messageId: msgId, conversationId: activeConvId });
  };

  const toggleReaction = (msgId, emoji) => {
    socket?.emit('message:react', { messageId: msgId, conversationId: activeConvId, emoji });
    setShowEmoji(null);
  };

  const retryMessage = (msg) => {
    if (msg.type === 'image' && msg.status === 'failed') {
      setMessages(prev => {
        const updated = prev.filter(m => m.id !== msg.id);
        messagesCacheRef.current.set(activeConvId, updated);
        return updated;
      });
    } else if (msg.id?.startsWith('temp_')) {
      setMessages(prev => {
        const updated = prev.filter(m => m.id !== msg.id);
        messagesCacheRef.current.set(activeConvId, updated);
        return updated;
      });
      setText(msg.content);
      if (msg.reply_to_id) setReplyTo({ id: msg.reply_to_id, content: msg.reply_preview?.content || '', sender_id: msg.reply_preview?.sender_id || '' });
    }
  };

  const filteredConv = conversations.filter(c =>
    c.display_name?.toLowerCase().includes(search.toLowerCase())
  );
  const otherUser = convDetail?.members?.find(m => m.id !== user?.id);

  // ─── Block/Unblock ──────────────────────────────
  const checkBlockStatus = useCallback(async () => {
    if (!otherUser?.id) return;
    try {
      const { data } = await API.get(`/users/${otherUser.id}/block-status`);
      setBlockStatus(data.isBlocked ? (data.blockedBy === 'me' ? 'blocked_by_me' : 'blocked_by_them') : null);
    } catch {}
  }, [otherUser?.id]);

  useEffect(() => { checkBlockStatus(); }, [checkBlockStatus]);

  const toggleBlock = async () => {
    if (!otherUser?.id) return;
    try {
      if (blockStatus === 'blocked_by_me') {
        await API.post(`/users/${otherUser.id}/unblock`);
        setBlockStatus(null);
      } else {
        await API.post(`/users/${otherUser.id}/block`);
        setBlockStatus('blocked_by_me');
      }
    } catch {}
  };

  const deleteConversation = async () => {
    if (!activeConvId) return;
    if (!window.confirm('Xóa cuộc trò chuyện? Toàn bộ lịch sử sẽ bị xóa khỏi danh sách của bạn.')) return;
    try {
      await API.delete(`/conversations/${activeConvId}`);
      setConversations(prev => prev.filter(c => c.id !== activeConvId));
      navigate('/chat');
    } catch {}
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="h-full flex bg-white">
      {/* LEFT */}
      <div className="w-72 xl:w-80 border-r border-gray-200 flex flex-col bg-white flex-shrink-0">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold text-gray-900">Đoạn chat</h1>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded-full">{conversations.length}</span>
          </div>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-200"
              placeholder="Tìm kiếm đoạn chat..." />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConv.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <FiMessageCircle size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Chưa có đoạn chat</p>
              <p className="text-xs mt-1">Bắt đầu trò chuyện từ mục Khám phá</p>
            </div>
          ) : filteredConv.map(c => {
            const isActive = c.id === activeConvId;
            return (
              <button key={c.id} onClick={() => switchConversation(c.id)}
                className={`w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${
                  isActive ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                }`}>
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isActive ? 'bg-primary-100' : 'bg-gray-100'}`}>
                    <span className={`font-bold text-lg ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                      {(c.display_name || '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                  {c.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900 text-sm truncate">{c.display_name || 'Đoạn chat'}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{c.last_message_at ? formatTime(c.last_message_at) : ''}</span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {c.last_message?.startsWith('📷') || c.last_message?.startsWith('📎') ? c.last_message : (c.last_message || 'Chưa có tin nhắn')}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="bg-primary-500 text-white text-[11px] font-bold min-w-[20px] h-5 rounded-full flex items-center justify-center px-1.5">
                    {c.unread_count > 99 ? '99+' : c.unread_count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* CENTER */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
              <button onClick={() => navigate('/chat')} className="lg:hidden p-1 -ml-1 hover:bg-gray-100 rounded-lg"><FiArrowLeft size={22} /></button>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-sm">{(otherUser?.name || '?')[0]?.toUpperCase()}</span>
                </div>
                {otherUser?.is_online === 1 && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{otherUser?.name || 'Đoạn chat'}</div>
                <div className="text-xs text-gray-500">
                  {typing[activeConvId] ? 'Đang nhập...' : otherUser?.is_online === 1 ? 'Đang hoạt động' : otherUser?.last_seen ? `Hoạt động ${formatTime(otherUser.last_seen)} trước` : ''}
                </div>
              </div>
              <div className="relative group">
                <button className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500"><FiMoreVertical size={18} /></button>
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-200 py-1 min-w-[180px] hidden group-hover:block z-30">
                  <button onClick={deleteConversation} className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                    <FiTrash2 size={15} className="text-gray-400" /> Xóa cuộc trò chuyện
                  </button>
                  <button onClick={toggleBlock} className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                    <FiX size={15} /> {blockStatus === 'blocked_by_me' ? 'Bỏ chặn' : 'Chặn người dùng'}
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50" ref={messagesContainerRef} onScroll={handleScroll}>
              {convLoading && messages.length === 0 && (
                <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
              )}
              {loadingMore && <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>}
              {!hasMore && messages.length > 0 && (
                <div className="flex justify-center mb-3"><span className="text-[11px] text-gray-400">— Đã xem tất cả tin nhắn —</span></div>
              )}
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex justify-center my-3"><span className="text-[11px] bg-white text-gray-400 px-3 py-1 rounded-full shadow-sm">{date}</span></div>
                  {msgs.map(msg => {
                    const isMine = msg.sender_id === user?.id;
                    const userReaction = msg.reactions?.find(r => r.userId === user?.id);
                    const reactionCounts = msg.reactions?.reduce((acc, r) => { acc[r.emoji] = (acc[r.emoji] || 0) + 1; return acc; }, {}) || {};
                    const isTemp = msg.id?.startsWith('temp_');
                    const isFailed = msg.status === 'failed';
                    const isImage = msg.type === 'image';
                    const isFile = msg.type === 'file';
                    const attachmentUrl = msg.metadata?.attachmentUrl || (isImage && msg.content?.startsWith('/uploads/') ? msg.content : null);
                    // Image/file messages: no bubble background
                    const noBubble = isImage || isFile;

                    return (
                      <div key={msg.id} className={`group flex mb-3 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {msg.reply_preview && !msg.reply_preview.is_deleted && (
                            <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs ${isMine ? 'bg-primary-400/20' : 'bg-gray-200'}`}>
                              <div className="font-medium text-gray-600 text-[11px]">Đang trả lời</div>
                              <div className="text-gray-500 truncate max-w-[200px]">{msg.reply_preview.content}</div>
                            </div>
                          )}
                          <div className={`relative ${noBubble ? '' : 'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed '}${
                            !noBubble ? (isMine ? 'bg-primary-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm') : ''
                          } ${isTemp ? 'opacity-70' : ''} ${isFailed ? 'ring-2 ring-red-300' : ''}`}>
                            {msg.is_deleted ? (
                              <span className="italic opacity-60 px-3.5 py-2.5 inline-block">{msg.content}</span>
                            ) : isImage && attachmentUrl ? (
                              // ── Image message: no bubble ──
                              <div className="max-w-[300px]">
                                <img src={attachmentUrl} alt="Ảnh"
                                  className="w-full max-h-[400px] object-cover cursor-pointer rounded-2xl hover:opacity-95 transition-opacity"
                                  loading="lazy"
                                  onClick={() => setLightboxUrl(attachmentUrl)}
                                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                                <div className="hidden items-center justify-center bg-gray-100 rounded-2xl h-32 text-gray-400 text-xs">Không thể tải ảnh</div>
                              </div>
                            ) : isFile ? (
                              // ── File attachment: clean card, no bubble ──
                              <div className="max-w-[280px] bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                                    <FiFile size={20} className="text-primary-500" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{msg.content || 'File đính kèm'}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">
                                      {msg.metadata?.attachmentName || 'File'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              msg.content
                            )}
                            {/* Time + status */}
                            {!noBubble ? (
                              <div className={`text-[10px] mt-1.5 flex items-center gap-1.5 ${isMine ? 'text-primary-200 justify-end' : 'text-gray-400 justify-start'}`}>
                                <span>{msg.created_at ? formatTime(msg.created_at) : ''}</span>
                                <StatusIcon status={msg.status} isMine={isMine} />
                              </div>
                            ) : (
                              <div className={`flex items-center gap-1.5 mt-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] text-gray-400">{msg.created_at ? formatTime(msg.created_at) : ''}</span>
                                <StatusIcon status={msg.status} isMine={isMine} />
                              </div>
                            )}
                            {isFailed && (
                              <button onClick={() => retryMessage(msg)}
                                className="block mt-1 text-[10px] text-red-400 hover:text-red-500 font-medium">Thử lại</button>
                            )}
                            {/* Actions on hover (text only) */}
                            {!msg.is_deleted && !isTemp && !isImage && !isFile && (
                              <div className={`absolute -top-8 hidden group-hover:flex gap-0.5 bg-white rounded-lg shadow-lg border p-1 z-20 ${isMine ? 'right-0' : 'left-0'}`}>
                                <button onClick={() => setReplyTo(msg)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Trả lời"><FiCornerUpLeft size={14} /></button>
                                <button onClick={() => { setShowEmoji(showEmoji === msg.id ? null : msg.id); }} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Cảm xúc"><FiSmile size={14} /></button>
                                {isMine && <button onClick={() => deleteMessage(msg.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Thu hồi"><FiTrash2 size={14} /></button>}
                              </div>
                            )}
                            {/* Emoji picker */}
                            {showEmoji === msg.id && (
                              <div className={`absolute -bottom-14 z-10 bg-white rounded-xl shadow-lg border p-2 flex gap-1 ${isMine ? 'right-0' : 'left-0'}`}>
                                {EMOJIS.map(e => (
                                  <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                    className={`w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-lg transition-transform hover:scale-125 ${userReaction?.emoji === e ? 'bg-primary-50 ring-1 ring-primary-300' : ''}`}>{e}</button>
                                ))}
                              </div>
                            )}
                          </div>
                          {/* Reactions display */}
                          {Object.keys(reactionCounts).length > 0 && (
                            <div className={`flex gap-1 -mt-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className="bg-white rounded-full shadow-sm border px-1.5 py-0.5 flex gap-1 text-xs">
                                {Object.entries(reactionCounts).map(([emoji, count]) => (
                                  <span key={emoji} className="cursor-pointer hover:scale-110 transition-transform">
                                    {emoji}{count > 1 ? <span className="text-gray-400 text-[10px] ml-0.5">{count}</span> : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              {typing[activeConvId] && (
                <div className="flex items-center gap-2 text-sm text-gray-400 italic mb-2"><span className="animate-pulse">...</span> Đang nhập</div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {newMsgIndicator && (
              <button onClick={() => scrollToBottom(true)}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-primary-500 text-white text-xs px-4 py-1.5 rounded-full shadow-lg hover:bg-primary-600 transition-all animate-bounce z-10">
                Tin nhắn mới ↓
              </button>
            )}

            {/* Image preview */}
            {previewUrl && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="relative inline-block max-w-[300px]">
                  <img src={previewUrl} alt="Preview" className="rounded-xl max-w-full max-h-[250px] object-contain bg-white shadow-sm" />
                  <button onClick={cancelFile} className="absolute -top-2 -right-2 bg-gray-800/70 text-white rounded-full p-1 hover:bg-gray-800 transition"><FiX size={16} /></button>
                  <div className="mt-2 flex gap-2">
                    <button onClick={cancelFile} className="text-xs text-gray-500 px-3 py-1 rounded-lg border hover:bg-white transition">Huỷ</button>
                    <button onClick={sendImageMessage} disabled={uploading}
                      className="text-xs bg-primary-500 text-white px-4 py-1 rounded-lg hover:bg-primary-600 transition disabled:opacity-50 flex items-center gap-1">
                      {uploading ? <><span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Đang tải...</> : <><FiSend size={12} /> Gửi ảnh</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* File preview */}
            {selectedDoc && (
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                <div className="inline-flex items-center gap-3 bg-white rounded-2xl border border-gray-200 p-3 shadow-sm max-w-[350px]">
                  <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <FiFile size={20} className="text-primary-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{docName}</p>
                    <p className="text-xs text-gray-400">Sẵn sàng gửi</p>
                  </div>
                  <button onClick={cancelDoc} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0"><FiX size={16} className="text-gray-400" /></button>
                </div>
              </div>
            )}

            {replyTo && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
                <FiCornerUpLeft size={14} className="text-primary-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-primary-500">Đang trả lời</span>
                  <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-lg"><FiX size={14} className="text-gray-400" /></button>
              </div>
            )}

            {/* ── Message Composer: evenly spaced tools ── */}
            <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-200">
              <div className="flex items-center gap-2">
                {/* File attachment button */}
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-primary-500 p-2.5 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0" title="Đính kèm file">
                  <FiPaperclip size={20} />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

                {/* Image button */}
                <button type="button" onClick={() => imageInputRef.current?.click()}
                  className="text-gray-400 hover:text-primary-500 p-2.5 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0" title="Đính kèm ảnh">
                  <FiImage size={20} />
                </button>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />

                {/* Emoji button */}
                <button type="button" onClick={() => setShowEmoji(showEmoji ? null : 'new')}
                  className="text-gray-400 hover:text-primary-500 p-2.5 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0" title="Cảm xúc">
                  <FiSmile size={20} />
                </button>

                {/* Text input */}
                <div className="flex-1">
                  <textarea value={text} onChange={e => handleTyping(e.target.value)} onKeyDown={handleKeyDown} rows={1}
                    className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none max-h-32"
                    placeholder="Nhập tin nhắn..." style={{ minHeight: '42px' }} />
                </div>

                {/* Send button */}
                <button type="submit" disabled={!text.trim()}
                  className="w-[42px] h-[42px] rounded-xl bg-primary-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary-600 transition-colors flex-shrink-0">
                  <FiSend size={18} />
                </button>
              </div>
            </form>

            {/* Blocked state message */}
            {blockStatus && (
              <div className="px-4 py-3 bg-red-50 border-t border-red-100 text-center">
                <p className="text-sm text-red-600 font-medium">
                  {blockStatus === 'blocked_by_me' ? 'Bạn đã chặn người dùng này.' : 'Bạn không thể nhắn tin cho người dùng này.'}
                </p>
                {blockStatus === 'blocked_by_me' && (
                  <button onClick={toggleBlock} className="text-xs text-primary-600 mt-1 hover:underline">Bỏ chặn</button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-center text-gray-400 px-4">
            <div>
              <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <FiMessageCircle size={36} className="text-primary-300" />
              </div>
              <p className="text-lg font-medium text-gray-500">Chọn một đoạn chat</p>
              <p className="text-sm mt-1">hoặc bắt đầu cuộc trò chuyện mới từ mục Khám phá</p>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT: User Info */}
      <div className={`${activeConvId ? 'w-72 xl:w-80 border-l border-gray-200 flex flex-col flex-shrink-0' : 'hidden'}`}>
        {otherUser && (
          <>
            <div className="p-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900 text-sm">Thông tin</h3></div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-bold text-primary-600">{(otherUser.name || '?')[0]?.toUpperCase()}</span>
                </div>
                <h2 className="text-lg font-bold text-gray-900">{otherUser.name}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className={`w-2 h-2 rounded-full ${otherUser.is_online === 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-500">{otherUser.is_online === 1 ? 'Đang hoạt động' : otherUser.last_seen ? `Hoạt động ${formatTime(otherUser.last_seen)} trước` : 'Không hoạt động'}</span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <FiUser size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Tên</p><p className="font-medium text-gray-800">{otherUser.name}</p></div>
                  </div>
                </div>
                {otherUser.bio && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Giới thiệu</p><p className="text-sm text-gray-700">{otherUser.bio}</p>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <FiClock size={18} className="text-gray-400" /><div><p className="text-xs text-gray-400">Tham gia</p><p className="font-medium text-gray-800">{otherUser.created_at ? formatDate(otherUser.created_at) : 'N/A'}</p></div>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button className="flex-1 border-2 border-primary-500 text-primary-500 hover:bg-primary-50 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"><FiPhone size={16} /> Gọi</button>
                <button className="flex-1 border-2 border-primary-500 text-primary-500 hover:bg-primary-50 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm"><FiMapPin size={16} /> Vị trí</button>
              </div>
            </div>
          </>
        )}
      </div>

      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 transition-colors"><FiX size={28} /></button>
          <img src={lightboxUrl} alt="Full size"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}