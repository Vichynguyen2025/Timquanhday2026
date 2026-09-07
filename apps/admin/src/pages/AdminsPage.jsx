import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { FiChevronLeft, FiChevronRight, FiUserPlus, FiToggleLeft, FiToggleRight } from 'react-icons/fi';

export default function AdminsPage() {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newRoleId, setNewRoleId] = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/admin/admins'),
      api.get('/admin/roles'),
      api.get('/admin/users?limit=200'),
    ]).then(([a, r, u]) => {
      setAdmins(a.data);
      setRoles(r.data);
      setUsers(u.data.users || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAdd = async () => {
    if (!newUserId || !newRoleId) return;
    try {
      await api.post('/admin/admins', { userId: newUserId, roleId: newRoleId });
      setShowAdd(false); setNewUserId(''); setNewRoleId('');
      fetchData();
    } catch (e) { alert(e?.response?.data?.error || 'Lỗi'); }
  };

  const handleToggle = async (admin, active) => {
    try {
      await api.patch(`/admin/admins/${admin.id}`, { isActive: active });
      fetchData();
    } catch (e) { alert('Lỗi'); }
  };

  const handleDelete = async (admin) => {
    if (!window.confirm(`Xóa ${admin.user_name} khỏi danh sách admin?`)) return;
    try {
      await api.delete(`/admin/admins/${admin.id}`);
      fetchData();
    } catch (e) { alert('Lỗi'); }
  };

  const currentUserIsSuper = admins.some(a => a.role_name === 'SUPER_ADMIN');

  if (loading) return <div className="flex justify-center pt-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quản trị viên</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2 text-sm"><FiUserPlus size={16} /> Thêm admin</button>
      </div>

      {showAdd && (
        <div className="card mb-4 p-4 space-y-3">
          <h3 className="font-semibold">Thêm quản trị viên</h3>
          <select value={newUserId} onChange={(e) => setNewUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Chọn người dùng...</option>
            {users.filter(u => !admins.some(a => a.user_id === u.id)).map(u => (
              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
            ))}
          </select>
          <select value={newRoleId} onChange={(e) => setNewRoleId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">Chọn vai trò...</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={!newUserId || !newRoleId} className="btn-primary text-sm">Thêm</button>
            <button onClick={() => setShowAdd(false)} className="btn-outline text-sm">Hủy</button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Admin</th>
              <th className="table-header">Vai trò</th>
              <th className="table-header">Trạng thái</th>
              <th className="table-header hidden sm:table-cell">Ngày tạo</th>
              <th className="table-header">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {admins.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600">
                      {(a.user_name || '?')[0].toUpperCase()}
                    </div>
                    <div><span className="font-medium">{a.user_name}</span><p className="text-xs text-gray-400">{a.email}</p></div>
                  </div>
                </td>
                <td className="table-cell">
                  <span className={`badge ${a.role_name === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{a.role_name}</span>
                </td>
                <td className="table-cell">
                  {a.is_active ? <span className="badge bg-green-100 text-green-700">Hoạt động</span> : <span className="badge bg-red-100 text-red-500">Vô hiệu</span>}
                </td>
                <td className="table-cell hidden sm:table-cell text-gray-400 text-xs">{a.created_at?.slice(0, 10)}</td>
                <td className="table-cell">
                  <div className="flex gap-1">
                    <button onClick={() => handleToggle(a, !a.is_active)} className="text-gray-500 hover:bg-gray-100 p-1 rounded" title={a.is_active ? 'Vô hiệu hóa' : 'Kích hoạt'}>
                      {a.is_active ? <FiToggleRight size={16} /> : <FiToggleLeft size={16} />}
                    </button>
                    <button onClick={() => handleDelete(a)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Xóa">✕</button>
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