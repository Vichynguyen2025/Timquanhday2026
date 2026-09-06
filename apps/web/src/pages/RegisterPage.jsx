import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiUser, FiMail, FiPhone, FiLock, FiCompass } from 'react-icons/fi';

export default function RegisterPage() {
  const { register } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const update = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) { setError('Vui lòng điền đầy đủ thông tin'); return; }
    if (form.password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự'); return; }
    if (form.password !== form.confirm) { setError('Mật khẩu không khớp'); return; }
    setLoading(true);
    try { await register({ name: form.name, email: form.email, phone: form.phone, password: form.password }); } catch (err) {
      setError(err.response?.data?.error || 'Đăng ký thất bại');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-primary-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mb-4">
            <FiCompass className="text-white" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-white">Tìm Quanh Đây</h1>
          <p className="text-primary-100 mt-2">Tạo tài khoản mới</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Đăng ký</h2>
          {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="relative"><FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={form.name} onChange={update('name')} className="input-field pl-10" placeholder="Họ và tên" /></div>
              <div className="relative"><FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="email" value={form.email} onChange={update('email')} className="input-field pl-10" placeholder="Email" /></div>
              <div className="relative"><FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input value={form.phone} onChange={update('phone')} className="input-field pl-10" placeholder="Số điện thoại" /></div>
              <div className="relative"><FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="password" value={form.password} onChange={update('password')} className="input-field pl-10" placeholder="Mật khẩu" /></div>
              <div className="relative"><FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} /><input type="password" value={form.confirm} onChange={update('confirm')} className="input-field pl-10" placeholder="Xác nhận mật khẩu" /></div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-6">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Đang xử lý...</span> : 'Đăng ký'}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Đã có tài khoản? <Link to="/login" className="text-primary-500 font-semibold hover:underline">Đăng nhập</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
