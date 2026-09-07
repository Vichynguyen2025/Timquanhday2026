import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, loading, updateUser, refreshUser } = useAuth();
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  // Store userId in a ref so socket listeners always have the latest value
  const userIdRef = useRef(null);
  const handlersRegistered = useRef(false);

  // Keep userIdRef in sync
  useEffect(() => {
    userIdRef.current = user?.id || null;
  }, [user?.id]);

  // ─── Connect/disconnect based on login state ONLY ──
  // NOT on user profile changes (avatar, name, etc.)
  useEffect(() => {
    // Only proceed when auth is ready and user is logged in
    if (loading) return;
    if (!user) {
      disconnectSocket();
      setSocket(null);
      setOnlineUsers(new Set());
      handlersRegistered.current = false;
      return;
    }

    let s = null;
    AsyncStorage.getItem("accessToken").then((token) => {
      if (!token) return;
      s = connectSocket(token);
      setSocket(s);
      handlersRegistered.current = false; // Will re-register
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
      handlersRegistered.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user, loading]); // Only depends on login/logout, NOT on user data

  // ─── Register/re-register listeners when socket changes ──
  useEffect(() => {
    if (!socket || handlersRegistered.current) return;
    handlersRegistered.current = true;

    // Presence
    socket.on("user:online", ({ userId }) => {
      setOnlineUsers((prev) => new Set(prev).add(userId));
    });
    socket.on("user:offline", ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    // ─── Profile updates (uses ref for userId — never stale) ──
    socket.on("user:profile_updated", ({ userId, changes }) => {
      if (userId === userIdRef.current && changes) {
        updateUser(changes);
      }
    });

    // ─── Reconnect reconciliation ──
    socket.on("connect", () => {
      refreshUser();
    });

    return () => {
      if (socket) {
        socket.off("user:online");
        socket.off("user:offline");
        socket.off("user:profile_updated");
        socket.off("connect");
      }
      handlersRegistered.current = false;
    };
  }, [socket, updateUser, refreshUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);