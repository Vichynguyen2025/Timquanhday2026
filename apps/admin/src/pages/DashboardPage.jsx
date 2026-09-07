import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FiUsers, FiMessageSquare, FiBell, FiAlertCircle, FiActivity,
  FiCheckCircle, FiUserPlus, FiFileText, FiLock, FiFlag,
  FiClock, FiMessageCircle
} from 'react-icons/fi';

const CARD_COLORS = [
  { bg: 'bg-blue-500' }, { bg: 'bg-green-500' }, { bg: 'bg-cyan-500' },
  { bg: 'bg-red-500' }, { bg: 'bg-amber-500' }, { bg: 'bg-purple-500' },
  { bg: 'bg-emerald-500' }, { bg: 'bg-indigo-500' }, { bg: 'bg-pink-500' },
  { bg: 'bg-teal-500' }, { bg: 'bg-orange-500' }, { bg: 'bg-violet-500' },
  { bg: 'bg-rose-500' }, { bg: 'bg-sky-500' }, { bg: 'bg-lime-500' },
  { bg: 'bg-gray-600' },
];

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
    { icon: FiUsers, label: 'Tổng người dùng', value: stats?.totalUsers, color: CARD_COLORS[0].bg },
    { icon: FiActivity, label: 'Đang online', value: stats?.onlineUsers, color: CARD_COLORS[1].bg },
    { icon: FiUserPlus, label: 'Hôm nay', value: stats?.newToday, color: CARD_COLORS[2].bg },
    { icon: FiLock, label: 'Đã khóa', value: stats?.lockedUsers, color: CARD_COLORS[3].bg },
    { icon: FiMessageSquare, label: 'Tin nhắn', value: stats?.totalMessages, color: CARD_COLORS[4].bg },
    { icon: FiClock, label: 'Tin nhắn hôm nay', value: stats?.todayMessages, color: CARD_COLORS[5].bg },
    { icon: FiMessageCircle, label: 'Hội thoại', value: stats?.activeConversations, color: CARD_COLORS[6].bg },
    { icon: FiBell, label: 'Thông báo', value: stats?.totalNotifications, color: CARD_COLORS[7].bg },
    { icon: FiAlertCircle, label: 'SOS đang hoạt động', value: stats?.activeSos, color: CARD_COLORS[8].bg },
    { icon: FiCheckCircle, label: 'SOS đã xử lý', value: stats?.resolvedSos, color: CARD_COLORS[9].bg },
    { icon: FiUsers, label: 'Đang hỗ trợ', value: stats?.beingHelped, color: CARD_COLORS[10].bg },
    { icon: FiFlag, label: 'SOS hôm nay', value: stats?.todaySos, color: CARD_COLORS[11].bg },
    { icon: FiFileText, label: 'Bài viết', value: stats?.totalPosts, color: CARD_COLORS[12].bg },
    { icon: FiFileText, label: 'Báo cáo', value: stats?.totalReports, color: CARD_COLORS[13].bg },
    { icon: FiFlag, label: 'Báo cáo chờ', value: stats?.pendingReports, color: CARD_COLORS[14].bg },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => <StatCard key={i} {...c} />)}
      </div>
      <div className="mt-6 card">
        <h2 className="font-semibold text-gray-700 mb-2">Hệ thống</h2>
        <p className="text-sm text-gray-500">
          MySQL: timquanhday · 25 tables · API: tqd-api (port 3001) · Socket.IO (/ws) · CMS: cms.timquanhday.de
        </p>
      </div>
    </div>
  );
}