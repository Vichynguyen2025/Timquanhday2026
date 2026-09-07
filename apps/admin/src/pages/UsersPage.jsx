import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/users', { params: { page, limit, search } }).then((r) => {
      setUsers(r.data.users);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, search]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Người dùng</h1>
      <div className="card p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Tìm kiếm theo tên, email, số điện thoại..." />
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Tên</th>
              <th className="table-header hidden md:table-cell">Email</th>
              <th className="table-header hidden lg:table-cell">Điện thoại</th>
              <th className="table-header">Online</th>
              <th className="table-header hidden lg:table-cell">SOS</th>
              <th className="table-header hidden sm:table-cell">Ngày tạo</th>
              <th className="table-header"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="7" className="p-8 text-center text-gray-400">Không tìm thấy người dùng</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600">
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{u.name}</span>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell text-gray-500">{u.email}</td>
                <td className="table-cell hidden lg:table-cell text-gray-500">{u.phone || '—'}</td>
                <td className="table-cell">{u.is_online ? <span className="badge bg-green-100 text-green-700">Online</span> : <span className="badge bg-gray-100 text-gray-500">Off</span>}</td>
                <td className="table-cell hidden lg:table-cell">{u.is_provider ? <span className="badge bg-red-100 text-red-700">Provider</span> : '—'}</td>
                <td className="table-cell hidden sm:table-cell text-gray-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                <td className="table-cell"><Link to={`/users/${u.id}`} className="text-primary-600 hover:underline text-sm">Chi tiết</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>{total} người dùng</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
            <span>Trang {page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
          </div>
        </div>
      )}
    </div>
  );
}