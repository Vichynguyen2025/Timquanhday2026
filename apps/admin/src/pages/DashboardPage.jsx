import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiUsers, FiMessageSquare, FiBell, FiAlertCircle, FiActivity, FiCheckCircle, FiUserPlus, FiFileText } from 'react-icons/fi';

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}><Icon size={24} className="text-white" /></div>
      <div>
        <div className="stat">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then((r) => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  const cards = [
    { icon: FiUsers, label: 'Tổng người dùng', value: stats?.totalUsers, color: 'bg-blue-500' },
    { icon: FiActivity, label: 'Đang online', value: stats?.onlineUsers, color: 'bg-green-500' },
    { icon: FiUserPlus, label: 'Hôm nay', value: stats?.newToday, color: 'bg-cyan-500' },
    { icon: FiMessageSquare, label: 'Tin nhắn', value: stats?.totalMessages, color: 'bg-violet-500' },
    { icon: FiBell, label: 'Thông báo', value: stats?.totalNotifications, color: 'bg-amber-500' },
    { icon: FiAlertCircle, label: 'SOS đang hoạt động', value: stats?.activeSos, color: 'bg-red-500' },
    { icon: FiCheckCircle, label: 'SOS đã xử lý', value: stats?.completedSos, color: 'bg-emerald-500' },
    { icon: FiFileText, label: 'Bài viết', value: stats?.totalPosts, color: 'bg-indigo-500' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => <StatCard key={i} {...c} />)}
      </div>
      <div className="mt-6 card">
        <h2 className="font-semibold text-gray-700 mb-2">Hệ thống</h2>
        <p className="text-sm text-gray-500">MySQL: timquanhday · 24 tables · API: tqd-api (port 3001) · Socket.IO (/ws) · Redis available</p>
      </div>
    </div>
  );
}