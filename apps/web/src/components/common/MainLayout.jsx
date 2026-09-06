import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { FiMessageCircle, FiGrid, FiMapPin, FiBell, FiUser } from 'react-icons/fi';

const tabs = [
  { to: '/chat', icon: FiMessageCircle, label: 'Tin nhắn' },
  { to: '/feed', icon: FiGrid, label: 'Khám phá' },
  { to: '/location', icon: FiMapPin, label: 'Vị trí' },
  { to: '/notifications', icon: FiBell, label: 'Thông báo' },
  { to: '/profile', icon: FiUser, label: 'Cá nhân' },
];

export default function MainLayout() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
      <nav className="bg-white border-t border-gray-200 px-2 pb-safe">
        <div className="flex justify-around items-center h-16">
          {tabs.map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors ${isActive ? 'text-primary-500' : 'text-gray-400 hover:text-gray-600'}`
            }>
              <Icon size={22} />
              <span className="text-[10px] font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
