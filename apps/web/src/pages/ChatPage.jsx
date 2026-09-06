import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import API from '../services/api';
import { FiSend, FiSearch, FiArrowLeft, FiPaperclip } from 'react-icons/fi';

export default function ChatPage() {
  const { id: activeConvId } = useParams();
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState({});
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    API.get('/conversations').then(({ data }) => setConversations(data)).catch(() => {});
  }, [activeConvId]);

  useEffect(() => {
    if (activeConvId) {
      API.get(`/messages/${activeConvId}`).then(({ data }) => setMessages(data)).catch(() => {});
      socket?.emit('conversation:read', { conversationId: activeConvId });
    }
  }, [activeConvId, socket]);

  useEffect(() => {
    if (!socket) return;
    socket.on('message:new', (msg) => {
      setMessages(prev => [...prev, msg]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    });
    socket.on('user:typing', ({ conversationId, userId: uId }) => {
      if (uId !== user?.id) setTyping(prev => ({ ...prev, [conversationId]: true }));
    });
    socket.on('user:stop-typing', ({ conversationId }) => {
      setTyping(prev => ({ ...prev, [conversationId]: false }));
    });
    return () => { socket.off('message:new'); socket.off('user:typing'); socket.off('user:stop-typing'); };
  }, [socket, user]);

  const sendMessage = () => {
    if (!text.trim() || !activeConvId) return;
    socket?.emit('message:send', { conversationId: activeConvId, content: text.trim(), type: 'text' });
    setText('');
  };

  const handleTyping = (val) => {
    setText(val);
    socket?.emit('user:typing', { conversationId: activeConvId, receiverId: '' });
    setTimeout(() => socket?.emit('user:stop-typing', { conversationId: activeConvId, receiverId: '' }), 2000);
  };

  const filteredConv = conversations.filter(c => c.last_message?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-full flex">
      {/* Conversation List */}
      <div className={`w-80 bg-white border-r border-gray-200 flex flex-col ${activeConvId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-800">Tin nhắn</h1>
          <div className="relative mt-3"><FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-xl text-sm focus:outline-none" placeholder="Tìm kiếm..." /></div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredConv.map(c => (
            <button key={c.id} onClick={() => window.location.href = `/chat/${c.id}`}
              className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors border-b border-gray-50 ${c.id === activeConvId ? 'bg-primary-50' : ''}`}>
              <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                <span className="text-primary-600 font-bold text-lg">{c.name?.[0] || '?'}</span>
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-800 text-sm">{c.name || 'Đoạn chat'}</span>
                  <span className="text-xs text-gray-400">{c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('vi-VN') : ''}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">{c.last_message || 'Chưa có tin nhắn'}</p>
              </div>
              {c.unread_count > 0 && <span className="bg-primary-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{c.unread_count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex flex-col ${!activeConvId ? 'hidden lg:flex lg:items-center lg:justify-center' : 'flex'}`}>
        {activeConvId ? (
          <>
            <div className="p-4 border-b border-gray-200 bg-white flex items-center gap-3">
              <button onClick={() => window.location.href = '/chat'} className="lg:hidden"><FiArrowLeft size={22} /></button>
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center"><span className="text-primary-600 font-bold">?</span></div>
              <div><span className="font-semibold text-gray-800">Người dùng</span></div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] p-3 rounded-2xl ${m.sender_id === user?.id ? 'bg-primary-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm'}`}>
                    <p className="text-sm leading-relaxed">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${m.sender_id === user?.id ? 'text-primary-100' : 'text-gray-400'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
              {typing[activeConvId] && <div className="text-sm text-gray-400 italic">Đang nhập...</div>}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center gap-3">
                <button className="text-gray-400 hover:text-gray-600"><FiPaperclip size={20} /></button>
                <input value={text} onChange={e => handleTyping(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} className="flex-1 px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none" placeholder="Nhập tin nhắn..." />
                <button onClick={sendMessage} disabled={!text.trim()} className="w-10 h-10 rounded-xl bg-primary-500 text-white flex items-center justify-center disabled:opacity-40"><FiSend size={18} /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-gray-400">
            <FiMessageCircle size={64} className="mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Chọn một cuộc trò chuyện</p>
            <p className="text-sm">hoặc bắt đầu cuộc trò chuyện mới</p>
          </div>
        )}
      </div>
    </div>
  );
}
