import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { FiLogOut, FiUser, FiMapPin, FiBell, FiLock, FiSettings, FiHelpCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (window.confirm('Bạn có chắc muốn đăng xuất?')) {
      await logout();
      navigate('/login');
    }
  };

  const menu = [
    { icon: FiUser, label: 'Chỉnh sửa hồ sơ' },
    { icon: FiMapPin, label: 'Quyền vị trí' },
    { icon: FiBell, label: 'Thông báo' },
    { icon: FiLock, label: 'Quyền riêng tư' },
    { icon: FiSettings, label: 'Cài đặt' },
    { icon: FiHelpCircle, label: 'Trợ giúp' },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Cá nhân</h1>
        <div className="card p-6 text-center mb-6">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-primary-600">{(user?.name || '?')[0]}</span>
          </div>
          <h2 className="text-xl font-bold text-gray-800">{user?.name || 'Người dùng'}</h2>
          <p className="text-sm text-gray-500 mt-1">{user?.email || ''}</p>
        </div>
        <div className="card divide-y divide-gray-50">
          {menu.map(({ icon: Icon, label }) => (
            <button key={label} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors">
              <Icon size={18} className="text-gray-500" />
              <span className="text-sm text-gray-700">{label}</span>
            </button>
          ))}
        </div>
        <button onClick={handleLogout} className="w-full mt-6 flex items-center justify-center gap-2 p-4 border border-red-200 rounded-xl text-red-500 hover:bg-red-50 transition-colors">
          <FiLogOut size={18} /> <span className="font-medium">Đăng xuất</span>
        </button>
      </div>
    </div>
  );
}
