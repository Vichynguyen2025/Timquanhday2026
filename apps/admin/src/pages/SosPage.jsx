import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiAlertCircle } from 'react-icons/fi';

const STATUS_COLORS = {
  OPEN: 'badge-warning', MATCHING: 'badge-info', ACCEPTED: 'badge-success',
  IN_PROGRESS: '#8b5cf6 bg-opacity-15', COMPLETED: '', CANCELLED: 'badge-danger',
};
const URGENCY_COLORS = { URGENT: '#ef4444', TODAY: '#f59e0b', SCHEDULED: '#06b6d4' };

export default function SosPage() {
  const [sos, setSos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/sos', { params: { page, limit, status: statusFilter || undefined } })
      .then(r => { setSos(r.data.sos); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-icon" style={{ background: 'rgba(239,68,68,0.15)' }}><FiAlertCircle size={18} style={{ color: '#ef4444' }} /></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>SOS</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} yêu cầu</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {['', 'ACTIVE', 'MATCHING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`chip ${statusFilter === s ? 'active' : ''}`}>{s || 'Tất cả'}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Người gửi</th>
              <th className="table-header hidden md:table-cell">Loại</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden sm:table-cell">Khẩn</th>
              <th className="table-header hidden lg:table-cell">Phản hồi</th>
              <th className="table-header hidden sm:table-cell">Ngày</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : sos.length === 0 ? (
              <tr><td colSpan="7" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không có SOS</td></tr>
            ) : sos.map(s => (
              <tr key={s.id}>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="avatar-circle w-7 h-7 text-xs">{(s.user_name || '?')[0]}</div>
                    <span style={{ color: 'var(--text-primary)' }}>{s.user_name}</span>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell" style={{ color: 'var(--text-tertiary)' }}>{s.category_name || '—'}</td>
                <td className="table-cell"><span className={`badge ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span></td>
                <td className="table-cell hidden sm:table-cell">
                  <span className="text-xs font-semibold" style={{ color: URGENCY_COLORS[s.urgency] }}>{s.urgency}</span>
                </td>
                <td className="table-cell hidden lg:table-cell" style={{ color: 'var(--text-quaternary)' }}>{s.response_count || 0}</td>
                <td className="table-cell hidden sm:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{s.created_at?.slice(0, 16)}</td>
                <td className="table-cell">
                  <Link to={`/sos/${s.id}`} className="text-xs px-2.5 py-1.5 rounded-md" style={{ color: 'var(--accent-light)', background: 'rgba(94,106,210,0.08)' }}>Chi tiết</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} SOS</span>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}