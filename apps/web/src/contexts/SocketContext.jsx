import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  useEffect(() => {
    if (!user) {
      if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
      setConnected(false);
      return;
    }

    const token = localStorage.getItem('accessToken');
    const socket = io('/', {
      path: '/ws',
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('user:online', ({ userId }) => setOnlineUsers(prev => new Set(prev).add(userId)));
    socket.on('user:offline', ({ userId }) => setOnlineUsers(prev => { const next = new Set(prev); next.delete(userId); return next; }));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [user?.id]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
