import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { FiBell, FiHeart, FiMessageCircle, FiUserPlus, FiCheck } from 'react-icons/fi';

const iconMap = {
  message: { icon: FiMessageCircle, color: 'text-primary-500', bg: 'bg-primary-50' },
  like: { icon: FiHeart, color: 'text-red-500', bg: 'bg-red-50' },
  friend_request: { icon: FiUserPlus, color: 'text-green-500', bg: 'bg-green-50' },
  system: { icon: FiBell, color: 'text-gray-500', bg: 'bg-gray-50' },
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    API.get('/notifications').then(({ data }) => {
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    }).catch(() => {});
  }, []);

  const markRead = async (id) => {
    await API.patch(`/notifications/${id}/read`);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await API.patch('/notifications/read-all');
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="p-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Thông báo</h1>
          {unreadCount > 0 && <button onClick={markAllRead} className="text-sm text-primary-500 font-medium hover:underline flex items-center gap-1"><FiCheck size={16} /> Đã đọc tất cả</button>}
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {notifications.length === 0 ? (
          <div className="text-center py-20 text-gray-400"><FiBell size={48} className="mx-auto mb-4 opacity-40" /><p className="font-medium">Chưa có thông báo</p></div>
        ) : notifications.map(n => {
          const meta = iconMap[n.type] || iconMap.system;
          const Icon = meta.icon;
          return (
            <div key={n.id} onClick={() => !n.is_read && markRead(n.id)} className={`flex items-start gap-3 p-4 cursor-pointer transition-colors ${!n.is_read ? 'bg-primary-50/50' : 'hover:bg-gray-50'}`}>
              <div className={`w-10 h-10 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0`}><Icon size={18} className={meta.color} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{n.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleDateString('vi-VN')}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
