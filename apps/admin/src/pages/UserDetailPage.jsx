import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiArrowLeft, FiLock, FiUnlock, FiAlertCircle, FiMessageSquare, FiShield } from 'react-icons/fi';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/users/${id}`).then((r) => setUser(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleLock = async (lock) => {
    if (!window.confirm(lock ? 'Khóa người dùng này?' : 'Mở khóa người dùng này?')) return;
    try {
      await api.post(`/admin/users/${id}/${lock ? 'lock' : 'unlock'}`);
      setUser(prev => ({ ...prev, is_locked: lock ? 1 : 0 }));
    } catch (e) { alert('Lỗi'); }
  };

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  if (!user) return <div className="text-center pt-20 text-gray-500">Không tìm thấy người dùng</div>;

  return (
    <div>
      <button onClick={() => navigate('/users')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <FiArrowLeft /> Quay lại danh sách
      </button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card text-center">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto text-3xl font-bold text-primary-600">
            {(user.name || '?')[0].toUpperCase()}
          </div>
          <h2 className="text-xl font-bold mt-4">{user.name}</h2>
          <p className="text-gray-500 text-sm">{user.email}</p>
          {user.phone && <p className="text-gray-400 text-xs mt-1">{user.phone}</p>}
          {user.bio && <p className="text-gray-600 text-sm mt-3">{user.bio}</p>}
          <div className="mt-4 flex justify-center gap-2 flex-wrap">
            <span className={`badge ${user.is_online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {user.is_online ? 'Online' : 'Offline'}
            </span>
            {user.is_locked ? (
              <span className="badge bg-red-100 text-red-600">🔒 Đã khóa</span>
            ) : null}
            <span className={`badge ${user.location_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
              {user.location_enabled ? '📍 ON' : '📍 OFF'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-3">Tạo: {user.created_at?.slice(0, 10)}</p>
          <div className="mt-4 flex justify-center gap-2">
            {user.is_locked ? (
              <button onClick={() => handleLock(false)} className="btn-outline text-sm flex items-center gap-1"><FiUnlock size={14} /> Mở khóa</button>
            ) : (
              <button onClick={() => handleLock(true)} className="btn-outline text-sm text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1"><FiLock size={14} /> Khóa</button>
            )}
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiAlertCircle /> Thống kê</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><div className="text-2xl font-bold">{user.stats?.messages || 0}</div><div className="text-xs text-gray-500">Tin nhắn</div></div>
              <div><div className="text-2xl font-bold">{user.stats?.sos || 0}</div><div className="text-xs text-gray-500">SOS tạo</div></div>
              <div><div className="text-2xl font-bold">{user.stats?.helping || 0}</div><div className="text-xs text-gray-500">SOS hỗ trợ</div></div>
              <div><div className="text-2xl font-bold">{user.stats?.posts || 0}</div><div className="text-xs text-gray-500">Bài viết</div></div>
            </div>
          </div>
          {user.blocked?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiShield /> Đã chặn ({user.blocked.length})</h3>
              <div className="space-y-2">
                {user.blocked.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded-lg">
                    <span>{b.blocked_name}</span>
                    <span className="text-xs text-gray-400">{b.created_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {user.reports?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiMessageSquare /> Bị báo cáo</h3>
              <div className="space-y-2">
                {user.reports.map((r) => (
                  <div key={r.id} className="text-sm p-2 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{r.reason}</p>
                    <p className="text-xs text-gray-400">{r.status} · {r.created_at?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {user.reportsMade?.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2"><FiAlertCircle /> Đã báo cáo</h3>
              <div className="space-y-2">
                {user.reportsMade.map((r) => (
                  <div key={r.id} className="text-sm p-2 bg-gray-50 rounded-lg">
                    <p className="text-gray-700">{r.reason}</p>
                    <p className="text-xs text-gray-400">{r.status} · {r.created_at?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}