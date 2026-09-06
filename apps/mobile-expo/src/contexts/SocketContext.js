import React, { createContext, useContext, useEffect, useRef } from "react";
import { connectSocket, disconnectSocket, getSocket } from "../services/socket";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) { disconnectSocket(); return; }
    AsyncStorage.getItem("accessToken").then((token) => {
      if (token) socketRef.current = connectSocket(token);
    });
    return () => disconnectSocket();
  }, [user]);

  return <SocketContext.Provider value={{ socket: getSocket() }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);