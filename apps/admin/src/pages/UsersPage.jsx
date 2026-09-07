import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiSearch, FiUsers, FiLock, FiUnlock } from 'react-icons/fi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get('/admin/users', { params: { page, limit, search, filter } })
      .then(r => { setUsers(r.data.users); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search, filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleLock = async (id, lock) => {
    if (!window.confirm(lock ? '🔒 Khóa người dùng này?' : '🔓 Mở khóa người dùng này?')) return;
    try { await api.post(`/admin/users/${id}/${lock ? 'lock' : 'unlock'}`); fetchUsers(); }
    catch { alert('Lỗi'); }
  };

  const totalPages = Math.ceil(total / limit);
  const filters = [
    { value: '', label: 'Tất cả' },
    { value: 'online', label: 'Online' },
    { value: 'offline', label: 'Offline' },
    { value: 'locked', label: 'Đã khóa' },
    { value: 'reported', label: 'Bị báo cáo' },
    { value: 'today', label: 'Hôm nay' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="section-icon" style={{ background: 'rgba(94,106,210,0.15)' }}><FiUsers size={18} style={{ color: 'var(--accent-light)' }} /></div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Người dùng</h1>
            <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} người dùng</p>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card p-3 mb-3 space-y-3">
        <div className="relative">
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm" placeholder="Tìm kiếm tên, email, số điện thoại..." />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filters.map(f => (
            <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
              className={`chip ${filter === f.value ? 'active' : ''}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Người dùng</th>
              <th className="table-header hidden md:table-cell">Email</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden lg:table-cell">Báo cáo</th>
              <th className="table-header hidden sm:table-cell">Ngày tạo</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="6" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không tìm thấy người dùng</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="avatar-circle w-8 h-8 text-sm">{(u.name || '?')[0]}</div>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{u.name}</span>
                      {u.is_provider && <span className="badge badge-info ml-2 text-[10px]">Provider</span>}
                    </div>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell" style={{ color: 'var(--text-quaternary)' }}>{u.email}</td>
                <td className="table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {u.is_locked ? <span className="badge badge-danger">Khóa</span>
                      : u.is_online ? <span className="badge badge-success">Online</span>
                      : <span className="badge">Off</span>}
                  </div>
                </td>
                <td className="table-cell hidden lg:table-cell" style={{ color: 'var(--text-quaternary)' }}>{u.report_count || 0}</td>
                <td className="table-cell hidden sm:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{u.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    <Link to={`/users/${u.id}`} className="btn-ghost text-xs px-2 py-1 rounded" style={{ color: 'var(--accent-light)' }}>Xem</Link>
                    <button onClick={() => handleLock(u.id, !u.is_locked)}
                      className="p-1.5 rounded-md hover:bg-white/5" title={u.is_locked ? 'Mở khóa' : 'Khóa'}>
                      {u.is_locked ? <FiUnlock size={14} style={{ color: '#10b981' }} /> : <FiLock size={14} style={{ color: 'var(--text-quaternary)' }} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} người dùng</span>
          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
            <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>›</button>
          </div>
        </div>
      )}
    </div>
  );
}