import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      api.get('/auth/me').then((res) => {
        setUser(res.data);
      }).catch(() => {
        localStorage.removeItem('admin_token');
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const data = res.data;
    // Store token FIRST before making auth-requiring calls
    localStorage.setItem('admin_token', data.accessToken);
    localStorage.setItem('admin_user', JSON.stringify(data.user));
    setUser(data.user);
    // Verify admin role
    const me = await api.get('/auth/me');
    const adminCheck = await api.get('/admin/admins').catch(() => null);
    const admins = adminCheck?.data || [];
    if (!admins.some(a => a.user_id === me.data.id)) {
      // Not an admin - rollback
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      setUser(null);
      throw new Error('Not an admin');
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);