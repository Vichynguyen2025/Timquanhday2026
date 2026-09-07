import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight, FiShield } from 'react-icons/fi';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const limit = 50;

  const fetchLogs = useCallback(() => {
    setLoading(true);
    api.get('/admin/audit-logs', { params: { page, limit, search, action: actionFilter || undefined } })
      .then((r) => { setLogs(r.data.logs); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search, actionFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2"><FiShield /> Nhật ký hoạt động</h1>
      <div className="card p-4 mb-4 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Tìm kiếm theo admin, hành động..." />
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Admin</th>
              <th className="table-header">Hành động</th>
              <th className="table-header hidden md:table-cell">Đối tượng</th>
              <th className="table-header hidden lg:table-cell">IP</th>
              <th className="table-header">Thời gian</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Không có nhật ký</td></tr>
            ) : logs.map((l) => (
              <React.Fragment key={l.id}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpanded(expanded === l.id ? null : l.id)}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{(l.admin_name || '?')[0]}</div>
                      <span className="text-sm">{l.admin_name}</span>
                    </div>
                  </td>
                  <td className="table-cell"><span className="badge bg-primary-100 text-primary-600 text-xs">{l.action}</span></td>
                  <td className="table-cell hidden md:table-cell text-gray-500 text-sm">{l.entity_type}{l.entity_id ? ` #${l.entity_id.slice(0, 8)}` : ''}</td>
                  <td className="table-cell hidden lg:table-cell text-gray-400 text-xs">{l.ip || '—'}</td>
                  <td className="table-cell text-gray-400 text-xs">{l.created_at?.slice(0, 16)}</td>
                  <td className="table-cell text-gray-400 text-xs">{expanded === l.id ? '▲' : '▼'}</td>
                </tr>
                {expanded === l.id && l.before_state && (
                  <tr className="bg-gray-50">
                    <td colSpan="6" className="p-3 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="font-semibold text-gray-500 mb-1">Trước:</p>
                          <pre className="text-gray-600 whitespace-pre-wrap">{JSON.stringify(l.before_state, null, 2).slice(0, 300)}</pre>
                        </div>
                        <div>
                          <p className="font-semibold text-gray-500 mb-1">Sau:</p>
                          <pre className="text-gray-600 whitespace-pre-wrap">{JSON.stringify(l.after_state, null, 2).slice(0, 300)}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total} nhật ký</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
          <span>Trang {page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
}