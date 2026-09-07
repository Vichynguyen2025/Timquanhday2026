import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight, FiLock, FiUnlock, FiUserCheck } from 'react-icons/fi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null);
  const limit = 20;

  const fetchUsers = useCallback(() => {
    setLoading(true);
    api.get('/admin/users', { params: { page, limit, search, filter } }).then((r) => {
      setUsers(r.data.users);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, search, filter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleLock = async (id, lock) => {
    if (!window.confirm(lock ? 'Khóa người dùng này?' : 'Mở khóa người dùng này?')) return;
    setActioning(id);
    try {
      await api.post(`/admin/users/${id}/${lock ? 'lock' : 'unlock'}`);
      fetchUsers();
    } catch (e) { alert('Lỗi'); }
    setActioning(null);
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Người dùng</h1>
      <div className="card p-4 mb-4 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Tìm kiếm theo tên, email, số điện thoại..." />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button key={f.value} onClick={() => { setFilter(f.value); setPage(1); }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === f.value ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Người dùng</th>
              <th className="table-header hidden md:table-cell">Email</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden lg:table-cell">Báo cáo</th>
              <th className="table-header hidden sm:table-cell">Ngày tạo</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="6" className="p-8 text-center text-gray-400">Không tìm thấy người dùng</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-sm font-bold text-primary-600 flex-shrink-0">
                      {(u.name || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="font-medium truncate block">{u.name}</span>
                      {u.is_provider ? <span className="badge bg-red-100 text-red-700 text-[10px]">Provider</span> : null}
                    </div>
                  </div>
                </td>
                <td className="table-cell hidden md:table-cell text-gray-500 truncate max-w-[200px]">{u.email}</td>
                <td className="table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {u.is_locked ? <span className="badge bg-red-100 text-red-600">Khóa</span>
                      : u.is_online ? <span className="badge bg-green-100 text-green-700">Online</span>
                      : <span className="badge bg-gray-100 text-gray-500">Off</span>}
                  </div>
                </td>
                <td className="table-cell hidden lg:table-cell text-gray-500">{u.report_count || 0}</td>
                <td className="table-cell hidden sm:table-cell text-gray-500 text-xs">{u.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  <div className="flex items-center gap-1">
                    <Link to={`/users/${u.id}`} className="text-primary-600 hover:underline text-sm mr-2">Xem</Link>
                    {u.is_locked ? (
                      <button onClick={() => handleLock(u.id, false)} disabled={actioning === u.id} className="text-green-600 hover:bg-green-50 p-1 rounded" title="Mở khóa"><FiUnlock size={14} /></button>
                    ) : (
                      <button onClick={() => handleLock(u.id, true)} disabled={actioning === u.id} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Khóa"><FiLock size={14} /></button>
                    )}
                  </div>
                </td>
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