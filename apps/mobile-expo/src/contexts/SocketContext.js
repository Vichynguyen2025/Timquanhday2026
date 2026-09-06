import React, { createContext, useContext, useEffect } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, loading } = useAuth();

  // Auto-connect socket when user is logged in
  useEffect(() => {
    if (!user || loading) {
      disconnectSocket();
      return;
    }
    AsyncStorage.getItem("accessToken").then((token) => {
      if (token) connectSocket(token);
    });
    return () => disconnectSocket();
  }, [user, isLoggedIn]);

  return <SocketContext.Provider value={{ socket: getSocket() }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);