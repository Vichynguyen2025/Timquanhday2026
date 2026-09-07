import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiSearch, FiMessageSquare } from 'react-icons/fi';

export default function MessagesPage() {
  const [messages, setMessages] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 20;

  useEffect(() => {
    setLoading(true);
    api.get('/admin/messages', { params: { page, limit, search } })
      .then(r => { setMessages(r.data.messages); setTotal(r.data.total); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="section-icon" style={{ background: 'rgba(139,92,246,0.15)' }}><FiMessageSquare size={18} style={{ color: '#8b5cf6' }} /></div>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Tin nhắn</h1>
          <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} tin nhắn</p>
        </div>
      </div>

      <div className="card p-3 mb-3">
        <div className="relative">
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-quaternary)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm" placeholder="Tìm kiếm nội dung tin nhắn..." />
        </div>
      </div>

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Người gửi</th>
              <th className="table-header hidden sm:table-cell">Loại</th>
              <th className="table-header">Nội dung</th>
              <th className="table-header hidden lg:table-cell">Lúc</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="p-12 text-center"><div className="w-5 h-5 border-2 rounded-full animate-spin inline-block" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></td></tr>
            ) : messages.length === 0 ? (
              <tr><td colSpan="4" className="p-12 text-center text-xs" style={{ color: 'var(--text-quaternary)' }}>Không có tin nhắn</td></tr>
            ) : messages.map(m => (
              <tr key={m.id}>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="avatar-circle w-7 h-7 text-xs">{(m.sender_name || '?')[0]}</div>
                    <span style={{ color: 'var(--text-primary)' }}>{m.sender_name}</span>
                  </div>
                </td>
                <td className="table-cell hidden sm:table-cell"><span className="badge">{m.type}</span></td>
                <td className="table-cell" style={{ color: 'var(--text-tertiary)', maxWidth: 400 }}>
                  <span className="truncate block">{m.content || (m.type === 'image' ? '📷 Ảnh' : '')}</span>
                </td>
                <td className="table-cell hidden lg:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{m.created_at?.slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4">
        <span className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{total} tin nhắn</span>
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>‹</button>
          <span className="px-3 py-1.5" style={{ color: 'var(--text-secondary)' }}>Trang {page}/{Math.ceil(total / limit) || 1}</span>
          <button disabled={page >= Math.ceil(total / limit)} onClick={() => setPage(p => p + 1)}>›</button>
        </div>
      </div>
    </div>
  );
}