import React, { createContext, useContext, useEffect, useState } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, loading } = useAuth();
  const isLoggedIn = !!user;
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // Auto-connect socket when user is logged in
  useEffect(() => {
    if (!user || loading) {
      disconnectSocket();
      setOnlineUsers(new Set());
      return;
    }
    AsyncStorage.getItem("accessToken").then((token) => {
      if (token) {
        const socket = connectSocket(token);
        // Listen for presence events
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
      }
    });
    return () => {
      disconnectSocket();
      setOnlineUsers(new Set());
    };
  }, [user, isLoggedIn]);

  return (
    <SocketContext.Provider value={{ socket: getSocket(), onlineUsers }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);