import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser(); }, []);

  async function loadUser() {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      if (token) {
        const res = await api.get("/auth/me");
        setUser(res.data);
      }
    } catch (e) { await AsyncStorage.multiRemove(["accessToken", "refreshToken"]); }
    setLoading(false);
  }

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    await AsyncStorage.setItem("accessToken", res.data.accessToken);
    if (res.data.refreshToken) await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
    setUser(res.data.user);
  }

  async function register(name, email, password) {
    const res = await api.post("/auth/register", { name, email, password });
    await AsyncStorage.setItem("accessToken", res.data.accessToken);
    if (res.data.refreshToken) await AsyncStorage.setItem("refreshToken", res.data.refreshToken);
    setUser(res.data.user);
  }

  async function logout() {
    await AsyncStorage.multiRemove(["accessToken", "refreshToken"]);
    setUser(null);
  }

  return <AuthContext.Provider value={{ user, loading, login, register, logout, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);