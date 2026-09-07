import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FiGrid, FiUsers, FiAlertCircle, FiMessageSquare, FiBell,
  FiLogOut, FiMenu, FiX, FiShield, FiFileText, FiUserCheck
} from 'react-icons/fi';

const linkGroups = [
  {
    label: 'TỔNG QUAN',
    links: [{ to: '/', icon: FiGrid, label: 'Dashboard', exact: true }],
  },
  {
    label: 'QUẢN LÝ',
    links: [
      { to: '/users', icon: FiUsers, label: 'Người dùng' },
      { to: '/sos', icon: FiAlertCircle, label: 'SOS' },
      { to: '/messages', icon: FiMessageSquare, label: 'Tin nhắn' },
      { to: '/notifications', icon: FiBell, label: 'Thông báo' },
      { to: '/reports', icon: FiFileText, label: 'Báo cáo' },
    ],
  },
  {
    label: 'HỆ THỐNG',
    links: [
      { to: '/admins', icon: FiUserCheck, label: 'Quản trị viên' },
      { to: '/audit-logs', icon: FiShield, label: 'Nhật ký' },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div>
            <h1 className="text-lg font-bold text-primary-600">Tìm Quanh Đây</h1>
            <p className="text-xs text-gray-500">CMS Admin</p>
          </div>
          <button className="lg:hidden p-1 rounded hover:bg-gray-100" onClick={() => setSidebarOpen(false)}><FiX size={20} /></button>
        </div>
        <nav className="p-4 overflow-y-auto" style={{ height: 'calc(100% - 140px)' }}>
          {linkGroups.map((group, gi) => (
            <div key={gi} className="mb-4">
              <p className="px-3 mb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">{group.label}</p>
              {group.links.map((l) => (
                <NavLink key={l.to} to={l.to} end={l.exact}
                  className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setSidebarOpen(false)}>
                  <l.icon size={18} />
                  <span>{l.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600 truncate">{user?.name || 'Admin'}</div>
            <button onClick={() => { logout(); navigate('/login'); }} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 lg:hidden">
          <button className="p-1 rounded hover:bg-gray-100" onClick={() => setSidebarOpen(true)}><FiMenu size={22} /></button>
          <h1 className="text-lg font-bold text-primary-600">CMS Admin</h1>
          <div className="w-8" />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}