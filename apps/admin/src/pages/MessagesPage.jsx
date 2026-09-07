import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiSearch, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/messages', { params: { page, limit, search } }).then((r) => {
      setMessages(r.data.messages);
      setTotal(r.data.total);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Tin nhắn</h1>
      <div className="card p-4 mb-4">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            placeholder="Tìm kiếm nội dung tin nhắn..." />
        </div>
      </div>
      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Người gửi</th>
              <th className="table-header hidden sm:table-cell">Loại</th>
              <th className="table-header">Nội dung</th>
              <th className="table-header hidden lg:table-cell">Lúc</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400">Đang tải...</td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan="4" className="p-8 text-center text-gray-400">Không có tin nhắn</td></tr>
            ) : messages.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold">{m.sender_name?.[0] || '?'}</div>
                    <span className="text-sm font-medium">{m.sender_name}</span>
                  </div>
                </td>
                <td className="table-cell hidden sm:table-cell"><span className="badge bg-gray-100">{m.type}</span></td>
                <td className="table-cell max-w-md truncate text-gray-600">{m.content || (m.type === 'image' ? '📷 Ảnh' : '')}</td>
                <td className="table-cell hidden lg:table-cell text-gray-400 text-xs">{m.created_at?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
        <span>{total} tin nhắn</span>
        <div className="flex items-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-outline p-2"><FiChevronLeft /></button>
          <span>Trang {page} / {Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)} className="btn-outline p-2"><FiChevronRight /></button>
        </div>
      </div>
    </div>
  );
}