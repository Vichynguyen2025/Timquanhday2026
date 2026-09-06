import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API, { setTokens, clearTokens } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) { setLoading(false); return; }
      const { data } = await API.get('/auth/me');
      setUser(data);
    } catch { clearTokens(); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email, password) => {
    const { data } = await API.post('/auth/login', { email, password });
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const register = async (form) => {
    const { data } = await API.post('/auth/register', form);
    setTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await API.post('/auth/logout'); } catch {}
    clearTokens();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
