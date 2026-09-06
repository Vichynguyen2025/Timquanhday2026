import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { FiMail, FiLock, FiEye, FiEyeOff, FiCompass } from 'react-icons/fi';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Vui lòng nhập email và mật khẩu'); return; }
    setLoading(true); setError('');
    try { await login(email, password); } catch (err) {
      setError(err.response?.data?.error || 'Đăng nhập thất bại');
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
          <p className="text-primary-100 mt-2">Kết nối với mọi người xung quanh bạn</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-bold text-gray-800 mb-6">Đăng nhập</h2>
          {error && <div className="bg-red-50 text-red-500 p-3 rounded-xl mb-4 text-sm">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">Email / Số điện thoại</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-field pl-10" placeholder="your@email.com" />
              </div>
            </div>
            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-600 mb-1">Mật khẩu</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} className="input-field pl-10 pr-10" placeholder="••••••••" />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPw ? <FiEyeOff size={18} /> : <FiEye size={18} />}
                </button>
              </div>
            </div>
            <div className="text-right mb-6">
              <Link to="/forgot-password" className="text-sm text-primary-500 hover:underline">Quên mật khẩu?</Link>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? <span className="flex items-center justify-center gap-2"><span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Đang xử lý...</span> : 'Đăng nhập'}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            Chưa có tài khoản? <Link to="/register" className="text-primary-500 font-semibold hover:underline">Đăng ký</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
