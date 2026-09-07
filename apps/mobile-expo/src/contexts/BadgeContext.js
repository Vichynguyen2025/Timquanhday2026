import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { getSocket } from "../services/socket";
import api from "../services/api";

const BadgeContext = createContext(null);

export function BadgeProvider({ children }) {
  const [messageUnread, setMessageUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [sosUnread, setSosUnread] = useState(0);

  // ─── Fetch all unread counts from server ────────
  const reconcileAll = useCallback(async () => {
    try {
      const [msgRes, notifRes, sosRes] = await Promise.allSettled([
        api.get("/messages/unread-count"),
        api.get("/notifications/unread-count"),
        api.get("/sos/unread-count"),
      ]);
      if (msgRes.status === "fulfilled") setMessageUnread(msgRes.value.data.count || 0);
      if (notifRes.status === "fulfilled") setNotificationUnread(notifRes.value.data.count || 0);
      if (sosRes.status === "fulfilled") setSosUnread(sosRes.value.data.count || 0);
    } catch (e) {}
  }, []);

  // ─── Global socket listeners (always active) ─────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Initial reconcile
    reconcileAll();

    // Message: new message from others → +1
    socket.on("message:new", (msg) => {
      // Only increment if message is NOT from a notification/event
      if (msg && msg.sender_id) {
        // We rely on reconcile for accuracy after app wakes
        setMessageUnread(prev => prev + 1);
      }
    });

    // Message: conversation read → recalculate
    socket.on("message:read", () => {
      reconcileAll();
    });

    // Notification events
    socket.on("notification:new", () => {
      setNotificationUnread(prev => prev + 1);
    });

    // SOS events (only count if SOS is NOT owned by current user)
    socket.on("sos:new", (sos) => {
      if (sos && !sos.is_owner) {
        setSosUnread(prev => prev + 1);
      }
    });
    socket.on("sos:response", () => {
      setSosUnread(prev => prev + 1);
    });

    // On reconnect, reconcile all counts
    socket.on("connect", () => {
      reconcileAll();
    });

    return () => {
      socket.off("message:new");
      socket.off("message:read");
      socket.off("notification:new");
      socket.off("sos:new");
      socket.off("sos:response");
      socket.off("connect");
    };
  }, [reconcileAll]);

  // ─── App foreground → reconcile ──────────────────
  useEffect(() => {
    const handleAppState = () => reconcileAll();
    // Listen for app state changes if available
    const { AppState } = require("react-native");
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") reconcileAll();
    });
    return () => sub.remove();
  }, [reconcileAll]);

  return (
    <BadgeContext.Provider
      value={{
        messageUnread, setMessageUnread,
        notificationUnread, setNotificationUnread,
        sosUnread, setSosUnread,
        reconcileAll,
      }}
    >
      {children}
    </BadgeContext.Provider>
  );
}

export const useBadge = () => useContext(BadgeContext);