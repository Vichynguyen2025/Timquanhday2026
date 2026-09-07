import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, loading, updateUser, refreshUser } = useAuth();
  const isLoggedIn = !!user;
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Auto-connect socket when user is logged in
  useEffect(() => {
    if (!user || loading) {
      disconnectSocket();
      setSocket(null);
      setOnlineUsers(new Set());
      return;
    }
    let s = null;
    AsyncStorage.getItem("accessToken").then((token) => {
      if (token) {
        s = connectSocket(token);
        setSocket(s);

        // Listen for presence events
        s.on("user:online", ({ userId }) => {
          setOnlineUsers((prev) => new Set(prev).add(userId));
        });
        s.on("user:offline", ({ userId }) => {
          setOnlineUsers((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
        });

        // ─── Listen for profile updates from other devices ──
        s.on("user:profile_updated", ({ userId, changes }) => {
          if (userId === user?.id && changes) {
            updateUser(changes);
          }
        });
      }
    });
    return () => {
      if (s) {
        s.off("user:online");
        s.off("user:offline");
        s.off("user:profile_updated");
        s.off("connect");
      }
      disconnectSocket();
      setSocket(null);
      setOnlineUsers(new Set());
    };
  }, [user, isLoggedIn, loading, updateUser]);

  // ─── On reconnect, reconcile user profile ──────
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      refreshUser();
    };
    socket.on("connect", onConnect);
    return () => socket.off("connect", onConnect);
  }, [socket, refreshUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);