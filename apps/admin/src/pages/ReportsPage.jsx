import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { FiChevronLeft, FiChevronRight, FiCheckCircle, FiXCircle } from 'react-icons/fi';

const STATUS_COLORS = {
  PENDING: 'bg-yellow-100 text-yellow-700', REVIEWING: 'bg-blue-100 text-blue-700',
  RESOLVED: 'bg-green-100 text-green-600', REJECTED: 'bg-gray-100 text-gray-500'
};

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [resolutionNote, setResolutionNote] = useState('');
  const [actioning, setActioning] = useState(null);
  const limit = 20;

  const fetchReports = useCallback(() => {
    setLoading(true);
    api.get('/admin/reports', { params: { page, limit, status: statusFilter || undefined } })
      .then((r) => { setReports(r.data.reports); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleStatus = async (id, status) => {
    const note = resolutionNote || '';
    if (status === 'RESOLVED' && !note && !window.confirm('Không có ghi chú?')) return;
    setActioning(id);
    try {
      await api.patch(`/admin/reports/${id}`, { status, resolutionNote: note });
      setResolutionNote('');
      fetchReports();
    } catch (e) { alert('Lỗi'); }
    setActioning(null);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Báo cáo</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        {['', 'PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${statusFilter === s ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {s || 'Tất cả'}
          </button>
        ))}
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Người báo cáo</th>
              <th className="table-header">Bị báo cáo</th>
              <th className="table-header hidden md:table-cell">Lý do</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden lg:table-cell">Xử lý bởi</th>
              <th className="table-header hidden sm:table-cell">Ngày</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Không có báo cáo</td></tr>
            ) : reports.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="table-cell"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-bold text-orange-600">{(r.reporter_name || '?')[0]}</div><span>{r.reporter_name}</span></div></td>
                <td className="table-cell"><div className="flex items-center gap-2"><div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold text-red-600">{(r.reported_name || '?')[0]}</div><span>{r.reported_name}</span></div></td>
                <td className="table-cell hidden md:table-cell max-w-xs truncate text-gray-500">{r.reason}</td>
                <td className="table-cell"><span className={`badge ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>{r.status}</span></td>
                <td className="table-cell hidden lg:table-cell text-gray-500">{r.moderator_name || '—'}</td>
                <td className="table-cell hidden sm:table-cell text-gray-400 text-xs">{r.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  {r.status === 'PENDING' || r.status === 'REVIEWING' ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleStatus(r.id, 'RESOLVED')} disabled={actioning === r.id} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Giải quyết"><FiCheckCircle size={16} /></button>
                      <button onClick={() => handleStatus(r.id, 'REJECTED')} disabled={actioning === r.id} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Từ chối"><FiXCircle size={16} /></button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total} báo cáo</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
          <span>Trang {page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
}