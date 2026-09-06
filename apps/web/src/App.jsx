import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import FeedPage from './pages/FeedPage';
import LocationPage from './pages/LocationPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import MainLayout from './components/common/MainLayout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" /></div>;
  if (!user) return <Navigate to="/login" />;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-500 border-t-transparent" /></div>;
  if (user) return <Navigate to="/chat" />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/chat" />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="chat/:id" element={<ChatPage />} />
            <Route path="feed" element={<FeedPage />} />
            <Route path="location" element={<LocationPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </SocketProvider>
    </AuthProvider>
  );
}
