import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiChevronLeft, FiChevronRight, FiAlertCircle } from 'react-icons/fi';

const STATUS_OPTIONS = ['OPEN', 'MATCHING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const STATUS_COLORS = { OPEN: 'bg-yellow-100 text-yellow-700', MATCHING: 'bg-blue-100 text-blue-700', ACCEPTED: 'bg-green-100 text-green-700', IN_PROGRESS: 'bg-purple-100 text-purple-700', COMPLETED: 'bg-gray-100 text-gray-500', CANCELLED: 'bg-red-100 text-red-500' };
const URGENCY_COLORS = { URGENT: 'text-red-600', TODAY: 'text-amber-600', SCHEDULED: 'text-blue-600' };

export default function SosPage() {
  const [sos, setSos] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/sos', { params: { page, limit, status: statusFilter || undefined } }).then((r) => {
      setSos(r.data.sos);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">SOS</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => { setStatusFilter(''); setPage(1); }} className={`btn-outline text-xs ${!statusFilter ? 'bg-primary-50 border-primary-500 text-primary-600' : ''}`}>Tất cả</button>
        {STATUS_OPTIONS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`btn-outline text-xs ${statusFilter === s ? 'bg-primary-50 border-primary-500 text-primary-600' : ''}`}>{s}</button>
        ))}
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Người gửi</th>
              <th className="table-header hidden md:table-cell">Loại</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden sm:table-cell">Mức</th>
              <th className="table-header hidden lg:table-cell">Phản hồi</th>
              <th className="table-header hidden sm:table-cell">Ngày</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : sos.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Không có SOS</td></tr>
            ) : sos.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <FiAlertCircle className="text-red-400" size={16} />
                    <span>{s.user_name}</span>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell text-gray-500">{s.category_name || '—'}</td>
                <td className="table-cell"><span className={`badge ${STATUS_COLORS[s.status] || 'bg-gray-100'}`}>{s.status}</span></td>
                <td className="table-cell hidden sm:table-cell"><span className={`text-xs font-semibold ${URGENCY_COLORS[s.urgency]}`}>{s.urgency}</span></td>
                <td className="table-cell hidden lg:table-cell text-gray-500">{s.response_count}</td>
                <td className="table-cell hidden sm:table-cell text-gray-500 text-xs">{s.created_at?.slice(0, 16)}</td>
                <td className="table-cell"><Link to={`/sos/${s.id}`} className="text-primary-600 hover:underline text-sm">Chi tiết</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total} SOS</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
          <span>Trang {page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
}