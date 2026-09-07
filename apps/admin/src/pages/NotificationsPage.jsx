import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function NotificationsPage() {
  const [notifs, setNotifs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/notifications', { params: { page, limit } }).then((r) => {
      setNotifs(r.data.notifications);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Thông báo</h1>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Người nhận</th>
              <th className="table-header">Loại</th>
              <th className="table-header">Tiêu đề</th>
              <th className="table-header hidden md:table-cell">Nội dung</th>
              <th className="table-header">Đã đọc</th>
              <th className="table-header hidden lg:table-cell">Ngày</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : notifs.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Không có thông báo</td></tr>
            ) : notifs.map((n) => (
              <tr key={n.id} className="hover:bg-gray-50">
                <td className="table-cell font-medium">{n.user_name}</td>
                <td className="table-cell"><span className="badge bg-primary-100 text-primary-600">{n.type}</span></td>
                <td className="table-cell">{n.title}</td>
                <td className="table-cell hidden md:table-cell text-gray-500 max-w-xs truncate">{n.body}</td>
                <td className="table-cell">{n.is_read ? <span className="badge bg-gray-100 text-gray-500">Đã đọc</span> : <span className="badge bg-amber-100 text-amber-700">Chưa</span>}</td>
                <td className="table-cell hidden lg:table-cell text-gray-400 text-xs">{n.created_at?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total} thông báo</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
          <span>Trang {page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
}