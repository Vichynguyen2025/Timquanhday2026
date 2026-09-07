import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { FiUserCheck, FiUserPlus, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export default function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/admins'), api.get('/admin/roles'), api.get('/admin/users?limit=200'),
    ]).then(([a, r, u]) => { setAdmins(a.data); setRoles(r.data); setUsers(u.data.users || []); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async () => {
    if (!newUserId || !newRoleId) return;
    try { await api.post('/admin/admins', { userId: newUserId, roleId: newRoleId }); setShowAdd(false); setNewUserId(''); setNewRoleId(''); fetchData(); }
    catch (e) { alert(e?.response?.data?.error || 'Lỗi'); }
  };

  const handleToggle = async (admin, active) => {
    try { await api.patch(`/admin/admins/${admin.id}`, { isActive: active }); fetchData(); }
    catch { alert('Lỗi'); }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Xóa ${admin.user_name} khỏi danh sách admin?`)) return;
    try { await api.delete(`/admin/admins/${admin.id}`); fetchData(); }
    catch { alert('Lỗi'); }
  };

  if (loading) return <div className="flex justify-center pt-32"><div className="w-7 h-7 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} /></div>;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="section-icon" style={{ background: 'rgba(6,182,212,0.15)' }}><FiUserCheck size={18} style={{ color: '#06b6d4' }} /></div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 0 }}>Quản trị viên</h1>
            <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{admins.length} admin</p>
          </div>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-xs gap-1.5"><FiUserPlus size={14} /> Thêm</button>
      </div>

      {showAdd && (
        <div className="card mb-4 p-4 space-y-3">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Thêm quản trị viên</p>
          <select value={newUserId} onChange={e => setNewUserId(e.target.value)} className="w-full text-sm">
            <option value="">Chọn người dùng...</option>
            {users.filter(u => !admins.some(a => a.user_id === u.id)).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <select value={newRoleId} onChange={e => setNewRoleId(e.target.value)} className="w-full text-sm">
            <option value="">Chọn vai trò...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newUserId || !newRoleId} className="btn-primary text-xs">Thêm</button>
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-xs">Hủy</button>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Admin</th>
              <th className="table-header">Vai trò</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden sm:table-cell">Ngày tạo</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(a => (
              <tr key={a.id}>
                <td className="table-cell">
                  <div className="flex items-center gap-2.5">
                    <div className="avatar-circle w-8 h-8 text-xs">{(a.user_name || '?')[0]}</div>
                    <div>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{a.user_name}</span>
                      <p className="text-xs" style={{ color: 'var(--text-quaternary)' }}>{a.email}</p>
                    </div>
                  </div>
                </td>
                <td className="table-cell">
                  <span className={`badge ${a.role_name === 'SUPER_ADMIN' ? 'badge-danger' : 'badge-info'}`}>{a.role_name}</span>
                </td>
                <td className="table-cell">
                  {a.is_active ? <span className="badge badge-success">Hoạt động</span> : <span className="badge badge-danger">Vô hiệu</span>}
                </td>
                <td className="table-cell hidden sm:table-cell text-xs" style={{ color: 'var(--text-quaternary)' }}>{a.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    <button onClick={() => handleToggle(a, !a.is_active)} className="p-1.5 rounded-md hover:bg-white/5" title={a.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}>
                      {a.is_active ? <FiToggleRight size={16} style={{ color: '#10b981' }} /> : <FiToggleLeft size={16} style={{ color: 'var(--text-quaternary)' }} />}
                    </button>
                    <button onClick={() => handleDelete(a)} className="p-1.5 rounded-md hover:bg-white/5 text-xs" style={{ color: 'var(--text-quaternary)' }} title="Xóa">✕</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}