import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiFileText, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const STATUS_COLORS = {
  PENDING: 'badge-warning', REVIEWING: 'badge-info',
  RESOLVED: 'badge-success', REJECTED: '',
};

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/reports', { params: { page, limit, status: statusFilter || undefined } })
      .then(r => { setReports(r.data.reports); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, statusFilter]);

  const handleStatus = async (id, status) => {
    try {
      await api.patch(`/admin/reports/${id}`, { status });
      setReports(prev => prev.map(r => r.id === id ? { ...r, status } : r));
    } catch { alert('Lỗi'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-icon" style={{ background: 'rgba(168,85,247,0.15)' }}><FiFileText size={18} style={{ color: '#a855f7' }} /></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Báo cáo</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} báo cáo</p>
        </div>
      </div>

      <div className="card p-3 mb-3">
        <div className="flex flex-wrap gap-1.5">
          {['', 'PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'].map(s => (
            <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`chip ${statusFilter === s ? 'active' : ''}`}>{s || 'Tất cả'}</button>
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Người báo cáo</th>
              <th className="table-header">Bị báo cáo</th>
              <th className="table-header hidden md:table-cell">Lý do</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden sm:table-cell">Ngày</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan="6" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không có báo cáo</td></tr>
            ) : reports.map(r => (
              <tr key={r.id}>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="avatar-circle w-7 h-7 text-xs" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>{(r.reporter_name || '?')[0]}</div>
                    <span style={{ color: 'var(--text-primary)' }}>{r.reporter_name}</span>
                  </div>
                </td>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="avatar-circle w-7 h-7 text-xs" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{(r.reported_name || '?')[0]}</div>
                    <span style={{ color: 'var(--text-primary)' }}>{r.reported_name}</span>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell" style={{ color: 'var(--text-tertiary)', maxWidth: 250 }}><span className="truncate block">{r.reason}</span></td>
                <td className="table-cell"><span className={`badge ${STATUS_COLORS[r.status] || ''}`}>{r.status}</span></td>
                <td className="table-cell hidden sm:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{r.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    {r.status === 'PENDING' || r.status === 'REVIEWING' ? (
                      <>
                        <button onClick={() => handleStatus(r.id, 'RESOLVED')} className="p-1.5 rounded-md hover:bg-white/5" title="Giải quyết">
                          <FiCheckCircle size={15} style={{ color: '#10b981' }} />
                        </button>
                        <button onClick={() => handleStatus(r.id, 'REJECTED')} className="p-1.5 rounded-md hover:bg-white/5" title="Từ chối">
                          <FiXCircle size={15} style={{ color: '#ef4444' }} />
                        </button>
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} báo cáo</span>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}