import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiShield, FiSearch, FiChevronDown, FiChevronRight } from 'react-icons/fi';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const limit = 50;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/audit-logs', { params: { page, limit, search } })
      .then(r => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-icon" style={{ background: 'rgba(99,102,241,0.15)' }}><FiShield size={18} style={{ color: '#6366f1' }} /></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Nhật ký hoạt động</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} bản ghi</p>
        </div>
      </div>

      <div className="card p-3 mb-3">
        <div className="relative">
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm" placeholder="Tìm kiếm theo admin, hành động..." />
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Admin</th>
              <th className="table-header">Hành động</th>
              <th className="table-header hidden md:table-cell">Đối tượng</th>
              <th className="table-header hidden lg:table-cell">IP</th>
              <th className="table-header">Thời gian</th>
              <th className="table-header w-10"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không có nhật ký</td></tr>
            ) : logs.map(l => (
              <React.Fragment key={l.id}>
                <tr className="cursor-pointer hover:bg-white/[0.015]" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="avatar-circle w-6 h-6 text-[10px]" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-quaternary)' }}>
                        {(l.admin_name || '?')[0]}</div>
                      <span style={{ color: 'var(--text-primary)' }}>{l.admin_name}</span>
                    </div>
                  </td>
                  <td className="table-cell"><span className="badge badge-info">{l.action}</span></td>
                  <td className="table-cell hidden md:table-cell text-xs" style={{ color: 'var(--text-tertiary)' }}>{l.entity_type}{l.entity_id ? ` #${l.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="table-cell hidden lg:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{l.ip || '—'}</td>
                  <td className="table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{l.created_at?.slice(0, 16)}</td>
                  <td className="table-cell" style={{ color: 'var(--text-quaternary)' }}>
                    {expanded === l.id ? <FiChevronDown size={14} /> : <FiChevronRight size={14} />}
                  </td>
                </tr>
                {expanded === l.id && (l.before_state || l.after_state) && (
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td colSpan="6" className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {l.before_state && (
                          <div>
                            <p className="text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--text-quaternary)' }}>Trước</p>
                            <pre className="text-[11px] whitespace-pre-wrap rounded-md p-2 overflow-x-auto" style={{ background: 'rgba(239,68,68,0.05)', color: '#ef4444' }}>
                              {JSON.stringify(l.before_state, null, 2).slice(0, 400)}
                            </pre>
                          </div>
                        )}
                        {l.after_state && (
                          <div>
                            <p className="text-[10px] font-semibold mb-1 uppercase" style={{ color: 'var(--text-quaternary)' }}>Sau</p>
                            <pre className="text-[11px] whitespace-pre-wrap rounded-md p-2 overflow-x-auto" style={{ background: 'rgba(16,185,129,0.05)', color: '#10b981' }}>
                              {JSON.stringify(l.after_state, null, 2).slice(0, 400)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} nhật ký</span>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}