import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.error || err.message || 'Đăng nhập thất bại');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{
      background: 'radial-gradient(ellipse at 50% 0%, rgba(94,106,210,0.08), transparent 70%), var(--bg-canvas)'
    }}>
      <div className="w-full max-w-sm mx-auto px-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: 'var(--accent)' }}>
            <span className="text-white font-bold text-lg">TQ</span>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>Tìm Quanh Đây</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>CMS Admin — Đăng nhập</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
          {error && (
            <div className="text-sm px-3 py-2.5 rounded-md mb-4" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full text-sm" placeholder="admin@timquanhday.de" autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-tertiary)' }}>Mật khẩu</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full text-sm" placeholder="••••••••" />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full mt-6 py-2.5 rounded-md text-sm font-medium transition-all"
            style={{ background: 'var(--accent)', color: 'white' }}
            onMouseEnter={e => e.target.style.background = 'var(--accent-hover)'}
            onMouseLeave={e => e.target.style.background = 'var(--accent)'}>
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-quaternary)' }}>
          CMS &copy; {new Date().getFullYear()} &middot; TimQuanhDay
        </p>
      </div>
    </div>
  );
}