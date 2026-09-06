import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import * as Location from "expo-location";
import { AppState } from "react-native";
import { useAuth } from "./AuthContext";
import { getSocket } from "../services/socket";
import api from "../services/api";

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const { user } = useAuth();
  const [currentLocation, setCurrentLocation] = useState(null);
  const [permissionStatus, setPermissionStatus] = useState("unknown");
  const [gpsStatus, setGpsStatus] = useState("Đang xác định vị trí...");
  const lastSentRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  // ─── Request permission & get initial GPS ──────
  const refreshLocation = useCallback(async () => {
    if (!user) return;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== "granted") {
        setGpsStatus("Chưa có quyền truy cập vị trí");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy || null,
        timestamp: loc.timestamp,
      };
      setCurrentLocation(coords);
      setGpsStatus(`📍 ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);

      // Send to backend (throttled)
      const key = `${coords.latitude.toFixed(4)}_${coords.longitude.toFixed(4)}`;
      if (lastSentRef.current !== key) {
        lastSentRef.current = key;
        await api.post("/location/update", {
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
        }).catch(() => {});
      }
    } catch (e) {
      setGpsStatus("Chưa lấy được vị trí");
    }
  }, [user]);

  // ─── On mount: get GPS when user is authenticated ──
  useEffect(() => {
    if (user) {
      refreshLocation();
    } else {
      setCurrentLocation(null);
      setPermissionStatus("unknown");
      setGpsStatus("Đang xác định vị trí...");
      lastSentRef.current = null;
    }
  }, [user, refreshLocation]);

  // ─── App foreground → refresh ──────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === "active") {
        if (user) refreshLocation();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [user, refreshLocation]);

  // ─── Socket reconnect → sync location ──────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReconnect = () => {
      if (user && currentLocation) {
        api.post("/location/update", {
          lat: currentLocation.latitude,
          lng: currentLocation.longitude,
          accuracy: currentLocation.accuracy,
        }).catch(() => {});
      }
    };
    socket.on("connect", onReconnect);
    return () => { socket.off("connect", onReconnect); };
  }, [user, currentLocation]);

  return (
    <LocationContext.Provider value={{ currentLocation, permissionStatus, gpsStatus, refreshLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export const useLocation = () => useContext(LocationContext);