import React, { useState, useEffect } from 'react';
import api from '../services/api';
import {
  FiUsers, FiMessageSquare, FiBell, FiAlertCircle, FiActivity,
  FiCheckCircle, FiUserPlus, FiFileText, FiLock, FiClock,
  FiMessageCircle, FiGlobe
} from 'react-icons/fi';

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="card flex items-center gap-4 hover:bg-white/[0.03] transition-colors">
    <div className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
      <Icon size={20} style={{ color }} />
    </div>
    <div className="min-w-0">
      <div className="stat">{value ?? '—'}</div>
      <div className="stat-label truncate">{label}</div>
    </div>
  </div>
);

const COLORS = [
  '#5e6ad2', '#10b981', '#06b6d4', '#f59e0b',
  '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f97316', '#6366f1', '#84cc16', '#e11d48',
  '#38bdf8', '#a855f7', '#d946ef', '#22d3ee',
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/dashboard').then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex justify-center pt-32">
      <div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
    </div>
  );

  const cards = [
    { icon: FiUsers, label: 'Tổng người dùng', value: stats?.totalUsers, color: COLORS[0] },
    { icon: FiActivity, label: 'Đang online', value: stats?.onlineUsers, color: COLORS[1] },
    { icon: FiUserPlus, label: 'Hôm nay', value: stats?.newToday, color: COLORS[2] },
    { icon: FiLock, label: 'Đã khóa', value: stats?.lockedUsers, color: COLORS[3] },
    { icon: FiMessageSquare, label: 'Tin nhắn', value: stats?.totalMessages, color: COLORS[4] },
    { icon: FiClock, label: 'Tin nhắn hôm nay', value: stats?.todayMessages, color: COLORS[5] },
    { icon: FiMessageCircle, label: 'Hội thoại', value: stats?.activeConversations, color: COLORS[6] },
    { icon: FiBell, label: 'Thông báo', value: stats?.totalNotifications, color: COLORS[7] },
    { icon: FiAlertCircle, label: 'SOS hoạt động', value: stats?.activeSos, color: COLORS[8] },
    { icon: FiCheckCircle, label: 'SOS đã xử lý', value: stats?.resolvedSos, color: COLORS[9] },
    { icon: FiUsers, label: 'Đang hỗ trợ', value: stats?.beingHelped, color: COLORS[10] },
    { icon: FiAlertCircle, label: 'SOS hôm nay', value: stats?.todaySos, color: COLORS[11] },
    { icon: FiGlobe, label: 'Bài viết', value: stats?.totalPosts, color: COLORS[12] },
    { icon: FiFileText, label: 'Báo cáo', value: stats?.totalReports, color: COLORS[13] },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(94,106,210,0.15)' }}>
          <FiGrid size={18} style={{ color: 'var(--accent-light)' }} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Dashboard</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>Tổng quan hệ thống</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {cards.map((c, i) => <StatCard key={i} {...c} />)}
      </div>
      <div className="card mt-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <FiGlobe size={16} style={{ color: 'var(--text-quaternary)' }} />
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Hệ thống</p>
            <p className="text-[11px]" style={{ color: 'var(--text-quaternary)' }}>
              MySQL · 25 tables · API tqd-api · Socket.IO /ws
            </p>
          </div>
        </div>
        <span className="chip active" style={{ cursor: 'default' }}>cms.timquanhday.de</span>
      </div>
    </div>
  );
}