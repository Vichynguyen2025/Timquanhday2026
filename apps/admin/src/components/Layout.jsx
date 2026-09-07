import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  FiGrid, FiUsers, FiAlertCircle, FiMessageSquare, FiBell,
  FiLogOut, FiMenu, FiX, FiShield, FiFileText, FiUserCheck, FiChevronDown
} from 'react-icons/fi';

const LINKS = [
  { section: 'TỔNG QUAN', items: [
    { to: '/', icon: FiGrid, label: 'Dashboard', exact: true },
  ]},
  { section: 'QUẢN LÝ', items: [
    { to: '/users', icon: FiUsers, label: 'Người dùng' },
    { to: '/sos', icon: FiAlertCircle, label: 'SOS' },
    { to: '/messages', icon: FiMessageSquare, label: 'Tin nhắn' },
    { to: '/notifications', icon: FiBell, label: 'Thông báo' },
    { to: '/reports', icon: FiFileText, label: 'Báo cáo' },
  ]},
  { section: 'HỆ THỐNG', items: [
    { to: '/admins', icon: FiUserCheck, label: 'Quản trị viên' },
    { to: '/audit-logs', icon: FiShield, label: 'Nhật ký' },
  ]},
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cms_sidebar_collapsed') || 'false'); }
    catch { return false; }
  });

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('cms_sidebar_collapsed', JSON.stringify(next));
  };

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg-canvas)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-30 flex flex-col transition-all duration-200 border-r`}
        style={{
          width: collapsed ? 64 : 256,
          background: 'var(--bg-panel)',
          borderColor: 'rgba(255,255,255,0.06)',
          transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
        }}>
        <div className="lg:hidden" />

        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--accent)' }}>
              <span className="text-white text-xs">TQ</span>
            </div>
            {!collapsed && (
              <div>
                <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tìm Quanh Đây</h1>
                <p className="text-[10px]" style={{ color: 'var(--text-quaternary)' }}>CMS Admin</p>
              </div>
            )}
          </div>
          <button className="hidden lg:flex p-1 rounded-md hover:bg-white/5 text-tertiary" onClick={toggleCollapsed}>
            <FiChevronDown size={16} className={`transition-transform ${collapsed ? 'rotate-90' : '-rotate-90'}`} />
          </button>
          <button className="lg:hidden p-1 rounded-md hover:bg-white/5" onClick={() => setSidebarOpen(false)}>
            <FiX size={18} style={{ color: 'var(--text-tertiary)' }} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-6">
          {LINKS.map((group, gi) => (
            <div key={gi}>
              {!collapsed && (
                <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-quaternary)' }}>
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((l) => {
                  const isActive = l.exact ? location.pathname === l.to : location.pathname.startsWith(l.to);
                  return (
                    <NavLink key={l.to} to={l.to} end={l.exact}
                      onClick={() => setSidebarOpen(false)}
                      className="sidebar-link"
                      style={({ isActive: navActive }) => ({
                        background: navActive ? 'rgba(94,106,210,0.12)' : 'transparent',
                        color: navActive ? 'var(--accent-light)' : 'var(--text-tertiary)',
                        justifyContent: collapsed ? 'center' : 'flex-start',
                        padding: collapsed ? '12px 0' : '8px 12px',
                        borderRadius: '6px',
                      })}
                      title={collapsed ? l.label : undefined}>
                      <l.icon size={18} style={{ flexShrink: 0 }} />
                      {!collapsed && <span style={{ fontSize: 13 }}>{l.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div className="shrink-0 p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-2 py-2 rounded-md" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
              style={{ background: 'rgba(94,106,210,0.2)', color: 'var(--accent-light)' }}>
              {(user?.name || 'A')[0].toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-secondary)' }}>
                    {user?.name || 'Admin'}
                  </p>
                </div>
                <button onClick={() => { logout(); navigate('/login'); }}
                  className="p-1.5 rounded-md hover:bg-white/5" title="Đăng xuất">
                  <FiLogOut size={15} style={{ color: 'var(--text-quaternary)' }} />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 shrink-0"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'var(--bg-panel)' }}>
          <button className="p-1.5 rounded-md hover:bg-white/5" onClick={() => setSidebarOpen(true)}>
            <FiMenu size={20} style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold"
              style={{ background: 'var(--accent)' }}><span className="text-white">TQ</span></div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CMS</span>
          </div>
          <div className="w-8" />
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto" style={{ padding: '32px 32px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}