import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import API from '../services/api';
import {
  FiSend, FiSearch, FiArrowLeft, FiPaperclip, FiMessageCircle,
  FiTrash2, FiSmile, FiCornerUpLeft, FiX, FiUser, FiClock, FiPhone, FiMapPin
} from 'react-icons/fi';

const EMOJIS = ['❤️', '😍', '😂', '😢', '😡', '👍', '🙏', '🔥', '🎉', '💯'];

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Vừa xong';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 86400000 * 2) return 'Hôm qua';
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

export default function ChatPage() {
  const { id: activeConvId } = useParams();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState({});
  const [search, setSearch] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(null);
  const [convDetail, setConvDetail] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  // Fetch conversations
  useEffect(() => {
    API.get('/conversations').then(({ data }) => setConversations(data)).catch(() => {});
  }, [activeConvId]);

  // Fetch messages + conv detail
  useEffect(() => {
    if (activeConvId) {
      API.get(`/messages/${activeConvId}`).then(({ data }) => {
        setMessages(data);
        scrollToBottom();
      }).catch(() => {});
      API.get(`/conversations/${activeConvId}`).then(({ data }) => setConvDetail(data)).catch(() => {});
      // Mark as read
      socket?.emit('conversation:read', { conversationId: activeConvId });
      // Clear local unread count
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, unread_count: 0 } : c));
    }
  }, [activeConvId, socket, scrollToBottom]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('message:new', (msg) => {
      if (msg.conversation_id === activeConvId) {
        setMessages(prev => {
          // Deduplicate: check if already exists (optimistic)
          if (prev.find(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
      // Update conversation list
      setConversations(prev => prev.map(c => {
        if (c.id === msg.conversation_id) {
          return { ...c, last_message: msg.content, last_message_at: msg.created_at };
        }
        return c;
      }));
      // Sort conversations by last message
      setConversations(prev => [...prev].sort((a, b) => {
        const aTime = new Date(a.last_message_at || 0).getTime();
        const bTime = new Date(b.last_message_at || 0).getTime();
        return bTime - aTime;
      }));
    });

    socket.on('message:deleted', ({ messageId }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_deleted: true, content: 'Tin nhắn đã được thu hồi' } : m));
    });

    socket.on('message:reaction', ({ messageId, reactions }) => {
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
    });

    socket.on('user:typing', ({ conversationId, userId: uId }) => {
      if (uId !== user?.id) setTyping(prev => ({ ...prev, [conversationId]: true }));
    });
    socket.on('user:stop-typing', ({ conversationId }) => {
      setTyping(prev => ({ ...prev, [conversationId]: false }));
    });

    return () => {
      socket.off('message:new');
      socket.off('message:deleted');
      socket.off('message:reaction');
      socket.off('user:typing');
      socket.off('user:stop-typing');
    };
  }, [socket, user, activeConvId, scrollToBottom]);

  const sendMessage = (e) => {
    e?.preventDefault();
    if (!text.trim() || !activeConvId) return;

    const tempId = 'temp-' + Date.now();
    const optimisticMsg = {
      id: tempId,
      conversation_id: activeConvId,
      sender_id: user?.id,
      content: text.trim(),
      type: 'text',
      reply_to_id: replyTo?.id || null,
      is_deleted: false,
      reactions: [],
      reply_preview: replyTo ? { id: replyTo.id, content: replyTo.content, sender_id: replyTo.sender_id, is_deleted: false } : null,
      created_at: new Date().toISOString(),
      sender_name: user?.name || 'You',
      sender_avatar: null,
    };

    // Optimistic update
    setMessages(prev => [...prev, optimisticMsg]);
    scrollToBottom();

    socket?.emit('message:send', {
      conversationId: activeConvId,
      content: text.trim(),
      type: 'text',
      receiverId: convDetail?.members?.find(m => m.id !== user?.id)?.id,
      replyToId: replyTo?.id || null,
      tempId,
    });

    setText('');
    setReplyTo(null);
    socket?.emit('user:stop-typing', { conversationId: activeConvId });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTyping = (val) => {
    setText(val);
    socket?.emit('user:typing', {
      conversationId: activeConvId,
      receiverId: convDetail?.members?.find(m => m.id !== user?.id)?.id
    });
    clearTimeout(window.typingTimeout);
    window.typingTimeout = setTimeout(() => {
      socket?.emit('user:stop-typing', { conversationId: activeConvId });
    }, 2000);
  };

  const deleteMessage = (msgId) => {
    socket?.emit('message:delete', { messageId: msgId, conversationId: activeConvId });
  };

  const toggleReaction = (msgId, emoji) => {
    socket?.emit('message:react', { messageId: msgId, conversationId: activeConvId, emoji });
    setShowEmoji(null);
  };

  const selectConversation = (convId) => {
    window.location.href = `/chat/${convId}`;
  };

  const filteredConv = conversations.filter(c =>
    c.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  const otherUser = convDetail?.members?.find(m => m.id !== user?.id);

  // Group messages by date
  const groupedMessages = messages.reduce((acc, msg) => {
    const date = formatDate(msg.created_at);
    if (!acc[date]) acc[date] = [];
    acc[date].push(msg);
    return acc;
  }, {});

  return (
    <div className="h-full flex bg-white">
      {/* ====== LEFT PANEL: Conversation List (always visible on desktop) ====== */}
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
              <button key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`w-full flex items-center gap-3 p-3.5 hover:bg-gray-50 transition-colors border-b border-gray-50 text-left ${
                  isActive ? 'bg-primary-50 border-l-4 border-l-primary-500' : ''
                }`}>
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isActive ? 'bg-primary-100' : 'bg-gray-100'
                  }`}>
                    <span className={`font-bold text-lg ${isActive ? 'text-primary-600' : 'text-gray-500'}`}>
                      {(c.display_name || '?')[0]?.toUpperCase()}
                    </span>
                  </div>
                  {c.is_online && <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-gray-900 text-sm truncate">{c.display_name || 'Đoạn chat'}</span>
                    <span className="text-[11px] text-gray-400 flex-shrink-0 ml-2">
                      {c.last_message_at ? formatTime(c.last_message_at) : ''}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mt-0.5">
                    {c.last_message || 'Chưa có tin nhắn'}
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

      {/* ====== CENTER: Chat Detail ====== */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3 flex-shrink-0">
              <button onClick={() => window.location.href = '/chat'} className="lg:hidden p-1 -ml-1 hover:bg-gray-100 rounded-lg">
                <FiArrowLeft size={22} />
              </button>
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-primary-600 font-bold text-sm">
                    {(otherUser?.name || '?')[0]?.toUpperCase()}
                  </span>
                </div>
                {otherUser?.is_online === 1 && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 text-sm truncate">{otherUser?.name || 'Đoạn chat'}</div>
                <div className="text-xs text-gray-500">
                  {typing[activeConvId] ? 'Đang nhập...' : otherUser?.is_online === 1 ? 'Đang hoạt động' : otherUser?.last_seen ? `Hoạt động ${formatTime(otherUser.last_seen)} trước` : ''}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50" id="chat-messages">
              {Object.entries(groupedMessages).map(([date, msgs]) => (
                <div key={date}>
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] bg-white text-gray-400 px-3 py-1 rounded-full shadow-sm">{date}</span>
                  </div>
                  {msgs.map(msg => {
                    const isMine = msg.sender_id === user?.id;
                    const userReaction = msg.reactions?.find(r => r.userId === user?.id);
                    const reactionCounts = msg.reactions?.reduce((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {}) || {};
                    const isTemp = msg.id?.startsWith('temp-');

                    return (
                      <div key={msg.id} className={`group flex mb-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {/* Reply preview */}
                          {msg.reply_preview && !msg.reply_preview.is_deleted && (
                            <div className={`mb-1 px-3 py-1.5 rounded-lg text-xs ${
                              isMine ? 'bg-primary-400/20' : 'bg-gray-200'
                            }`}>
                              <div className="font-medium text-gray-600 text-[11px]">Đang trả lời</div>
                              <div className="text-gray-500 truncate max-w-[200px]">{msg.reply_preview.content}</div>
                            </div>
                          )}

                          {/* Message bubble */}
                          <div className={`relative px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                            isMine
                              ? 'bg-primary-500 text-white rounded-br-md'
                              : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                          } ${isTemp ? 'opacity-70' : ''}`}>
                            {msg.is_deleted ? (
                              <span className="italic opacity-60">{msg.content}</span>
                            ) : (
                              msg.content
                            )}
                            <div className={`text-[10px] mt-1 flex items-center gap-1 ${
                              isMine ? 'text-primary-200 justify-end' : 'text-gray-400 justify-start'
                            }`}>
                              {msg.created_at ? formatTime(msg.created_at) : ''}
                              {isMine && !msg.is_deleted && <span className="text-[10px]">{isTemp ? '○' : '✓✓'}</span>}
                            </div>

                            {/* Actions on hover (only for non-temp, non-deleted) */}
                            {!msg.is_deleted && !isTemp && (
                              <div className={`absolute -top-8 hidden group-hover:flex gap-0.5 bg-white rounded-lg shadow-lg border p-1 z-20 ${
                                isMine ? 'right-0' : 'left-0'
                              }`}>
                                <button onClick={() => setReplyTo(msg)}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Trả lời">
                                  <FiCornerUpLeft size={14} />
                                </button>
                                <button onClick={() => { setShowEmoji(showEmoji === msg.id ? null : msg.id); }}
                                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" title="Cảm xúc">
                                  <FiSmile size={14} />
                                </button>
                                {isMine && (
                                  <button onClick={() => deleteMessage(msg.id)}
                                    className="p-1.5 hover:bg-red-50 rounded-lg text-red-400" title="Thu hồi">
                                    <FiTrash2 size={14} />
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Emoji picker */}
                            {showEmoji === msg.id && (
                              <div className={`absolute -bottom-12 z-10 bg-white rounded-xl shadow-lg border p-2 flex gap-1 ${
                                isMine ? 'right-0' : 'left-0'
                              }`}>
                                {EMOJIS.map(e => (
                                  <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                    className={`w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded-lg text-lg transition-transform hover:scale-125 ${
                                      userReaction?.emoji === e ? 'bg-primary-50 ring-1 ring-primary-300' : ''
                                    }`}>
                                    {e}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Reactions display */}
                          {Object.keys(reactionCounts).length > 0 && (
                            <div className={`flex gap-1 -mt-1.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              <div className="bg-white rounded-full shadow-sm border px-1.5 py-0.5 flex gap-1 text-xs">
                                {Object.entries(reactionCounts).map(([emoji, count]) => (
                                  <span key={emoji} className="cursor-pointer hover:scale-110 transition-transform">
                                    {emoji}{count > 1 ? <span className="text-gray-400 text-[10px]">{count}</span> : ''}
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
                <div className="flex items-center gap-2 text-sm text-gray-400 italic mb-2">
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-[10px] text-gray-500">...</span>
                  </div>
                  Đang nhập...
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Reply preview */}
            {replyTo && (
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex items-center gap-2">
                <FiCornerUpLeft size={14} className="text-primary-500" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-primary-500">Đang trả lời</span>
                  <p className="text-xs text-gray-500 truncate">{replyTo.content}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-lg">
                  <FiX size={14} className="text-gray-400" />
                </button>
              </div>
            )}

            {/* Input */}
            <form onSubmit={sendMessage} className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end gap-3">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <FiPaperclip size={20} />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" />
                <div className="flex-1 relative">
                  <textarea
                    value={text}
                    onChange={e => handleTyping(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                    className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-200 resize-none max-h-32"
                    placeholder="Nhập tin nhắn..."
                    style={{ minHeight: '42px' }}
                  />
                </div>
                <button type="submit" disabled={!text.trim()}
                  className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-primary-600 transition-colors flex-shrink-0">
                  <FiSend size={18} />
                </button>
              </div>
            </form>
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

      {/* ====== RIGHT PANEL: User Info (ALWAYS PINNED on desktop) ====== */}
      <div className={`${activeConvId ? 'w-72 xl:w-80 border-l border-gray-200 flex flex-col flex-shrink-0' : 'hidden'}`}>
        {otherUser && (
          <>
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 text-sm">Thông tin</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-center mb-6">
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <span className="text-3xl font-bold text-primary-600">
                    {(otherUser.name || '?')[0]?.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900">{otherUser.name}</h2>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <div className={`w-2 h-2 rounded-full ${otherUser.is_online === 1 ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm text-gray-500">
                    {otherUser.is_online === 1 ? 'Đang hoạt động' : otherUser.last_seen ? `Hoạt động ${formatTime(otherUser.last_seen)} trước` : 'Không hoạt động'}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <FiUser size={18} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Tên</p>
                      <p className="font-medium text-gray-800">{otherUser.name}</p>
                    </div>
                  </div>
                </div>
                {otherUser.bio && (
                  <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                    <p className="text-xs text-gray-400 mb-1">Giới thiệu</p>
                    <p className="text-sm text-gray-700">{otherUser.bio}</p>
                  </div>
                )}
                <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <FiClock size={18} className="text-gray-400" />
                    <div>
                      <p className="text-xs text-gray-400">Tham gia</p>
                      <p className="font-medium text-gray-800">
                        {otherUser.created_at ? formatDate(otherUser.created_at) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button className="flex-1 border-2 border-primary-500 text-primary-500 hover:bg-primary-50 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                  <FiPhone size={16} /> Gọi
                </button>
                <button className="flex-1 border-2 border-primary-500 text-primary-500 hover:bg-primary-50 font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                  <FiMapPin size={16} /> Vị trí
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}