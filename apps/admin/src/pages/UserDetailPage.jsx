import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FiArrowLeft, FiLock, FiUnlock, FiMail, FiPhone, FiMapPin } from 'react-icons/fi';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/admin/users/${id}`).then(r => setUser(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  const handleLock = async (lock) => {
    if (!window.confirm(lock ? '🔒 Khóa người dùng này?' : '🔓 Mở khóa?')) return;
    try { await api.post(`/admin/users/${id}/${lock ? 'lock' : 'unlock'}`); setUser(p => ({ ...p, is_locked: lock ? 1 : 0 })); }
    catch { alert('Lỗi'); }
  };

  if (loading) return <div className="flex justify-center pt-32"><div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></div>;
  if (!user) return <div className="text-center pt-32 text-sm" style={{ color: 'var(--text-quaternary)' }}>Không tìm thấy người dùng</div>;

  return (
    <div>
      <button onClick={() => navigate('/users')} className="btn-ghost text-xs gap-1.5 mb-5 flex items-center" style={{ color: 'var(--text-tertiary)' }}>
        <FiArrowLeft size={14} /> Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Profile card */}
        <div className="card text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-xl font-semibold"
            style={{ background: 'rgba(94,106,210,0.15)', color: 'var(--accent-light)' }}>
            {(user.name || '?')[0].toUpperCase()}
          </div>
          <h2 className="text-lg font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>{user.name}</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{user.email}</p>
          {user.phone && <p className="text-xs mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--text-quaternary)' }}><FiPhone size={11} />{user.phone}</p>}
          {user.bio && <p className="text-xs mt-3 px-3 py-2 rounded-md" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-tertiary)' }}>{user.bio}</p>}

          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            <span className={`badge ${user.is_online ? 'badge-success' : ''}`}>
              {user.is_online ? 'Online' : 'Offline'}
            </span>
            {user.is_locked && <span className="badge badge-danger">🔒 Đã khóa</span>}
            <span className={`badge ${user.location_enabled ? 'badge-info' : ''}`}>
              {user.location_enabled ? '📍 Bật' : '📍 Tắt'}
            </span>
          </div>
          <p className="text-[11px] mt-3" style={{ color: 'var(--text-quaternary)' }}>Tạo: {user.created_at?.slice(0, 10)}</p>

          <div className="mt-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <button onClick={() => handleLock(!user.is_locked)}
              className={`btn mt-4 w-full text-sm ${user.is_locked ? 'btn-secondary' : 'btn-danger'}`}>
              {user.is_locked ? <><FiUnlock size={14} className="mr-1.5" /> Mở khóa</> : <><FiLock size={14} className="mr-1.5" /> Khóa người dùng</>}
            </button>
          </div>
        </div>

        {/* Stats and data */}
        <div className="lg:col-span-2 space-y-4">
          {/* Stats */}
          <div className="card">
            <p className="card-header"><FiMail size={14} className="inline mr-1.5" />Thống kê</p>
            <div className="grid grid-cols-4 gap-4 text-center">
              {[
                { label: 'Tin nhắn', value: user.stats?.messages },
                { label: 'SOS tạo', value: user.stats?.sos },
                { label: 'SOS hỗ trợ', value: user.stats?.helping },
                { label: 'Bài viết', value: user.stats?.posts },
              ].map(s => (
                <div key={s.label}>
                  <div className="text-2xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>{s.value || 0}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Blocked users */}
          {user.blocked?.length > 0 && (
            <div className="card">
              <p className="card-header">Đã chặn ({user.blocked.length})</p>
              <div className="space-y-1">
                {user.blocked.map(b => (
                  <div key={b.id} className="flex items-center justify-between px-3 py-2 rounded-md text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{b.blocked_name}</span>
                    <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{b.created_at?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reports about user */}
          {user.reports?.length > 0 && (
            <div className="card">
              <p className="card-header">Bị báo cáo ({user.reports.length})</p>
              <div className="space-y-1">
                {user.reports.map(r => (
                  <div key={r.id} className="px-3 py-2 rounded-md text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>{r.reason}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{r.status} · {r.created_at?.slice(0, 10)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User made reports */}
          {user.reportsMade?.length > 0 && (
            <div className="card">
              <p className="card-header">Đã báo cáo ({user.reportsMade.length})</p>
              <div className="space-y-1">
                {user.reportsMade.map(r => (
                  <div key={r.id} className="px-3 py-2 rounded-md text-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <p style={{ color: 'var(--text-secondary)' }}>{r.reason}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-quaternary)' }}>{r.status} · {r.created_at?.slice(0, 10)}</p>
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