import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiBell, FiSearch } from 'react-icons/fi';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/notifications', { params: { page, limit, search, type: typeFilter || undefined } })
      .then(r => { setNotifs(r.data.notifications); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search, typeFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-icon" style={{ background: 'rgba(245,158,11,0.15)' }}><FiBell size={18} style={{ color: '#f59e0b' }} /></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Thông báo</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} thông báo</p>
        </div>
      </div>

      <div className="card p-3 mb-3 space-y-3">
        <div className="relative">
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm" placeholder="Tìm kiếm tiêu đề, nội dung..." />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['', 'message', 'like', 'comment', 'friend_request', 'system', 'sos', 'nearby'].map(t => (
            <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
              className={`chip ${typeFilter === t ? 'active' : ''}`}>{t || 'Tất cả'}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Người nhận</th>
              <th className="table-header">Loại</th>
              <th className="table-header">Tiêu đề</th>
              <th className="table-header hidden md:table-cell">Nội dung</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden lg:table-cell">Ngày</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : notifs.length === 0 ? (
              <tr><td colSpan="6" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không có thông báo</td></tr>
            ) : notifs.map(n => (
              <tr key={n.id}>
                <td className="table-cell font-medium" style={{ color: 'var(--text-primary)' }}>{n.user_name}</td>
                <td className="table-cell"><span className="badge badge-info">{n.type}</span></td>
                <td className="table-cell" style={{ color: 'var(--text-secondary)' }}>{n.title}</td>
                <td className="table-cell hidden md:table-cell" style={{ color: 'var(--text-tertiary)', maxWidth: 300 }}><span className="truncate block">{n.body}</span></td>
                <td className="table-cell">{n.is_read ? <span className="badge">Đã đọc</span> : <span className="badge badge-warning">Chưa</span>}</td>
                <td className="table-cell hidden lg:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{n.created_at?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} thông báo</span>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}