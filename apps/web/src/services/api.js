import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Token management
let accessToken = localStorage.getItem('accessToken');
let refreshToken = localStorage.getItem('refreshToken');

export function setTokens(access, refresh) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem('accessToken', access);
  localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

API.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && refreshToken) {
      try {
        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        if (data.accessToken) {
          setTokens(data.accessToken, data.refreshToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        }
      } catch { clearTokens(); }
    }
    return Promise.reject(error);
  }
);

export default API;
