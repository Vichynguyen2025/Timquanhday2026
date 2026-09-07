import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useSocket } from "./SocketContext";
import api from "../services/api";

const BadgeContext = createContext(null);

// Track seen message IDs to prevent double-count
const seenIds = new Set();

export function BadgeProvider({ children }) {
  const { socket } = useSocket();
  const [messageUnread, setMessageUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const [sosUnread, setSosUnread] = useState(0);
  const listenersRegistered = useRef(false);
  // Track the conversation currently open on screen
  const activeConversationRef = useRef(null);
  const [activeConversation, setActiveConversationState] = useState(null);

  const setActiveConversation = useCallback((id) => {
    activeConversationRef.current = id;
    setActiveConversationState(id);
  }, []);

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

  // ─── Register socket listeners when socket is available ──
  useEffect(() => {
    if (!socket) {
      listenersRegistered.current = false;
      return;
    }

    // Avoid double registration
    if (listenersRegistered.current) return;
    listenersRegistered.current = true;

    // Initial reconcile
    reconcileAll();

    // Message: new message from others → +1 (unless viewing that conversation)
    socket.on("message:new", (msg) => {
      if (!msg || !msg.id) return;
      // If user is viewing this conversation, message is auto-read - no increment
      if (activeConversationRef.current === msg.conversation_id) {
        return;
      }
      // Dedup: prevent double-count from room + user events
      if (seenIds.has(msg.id)) return;
      seenIds.add(msg.id);
      // Limit seenIds size to prevent memory leak
      if (seenIds.size > 200) {
        const iter = seenIds.values();
        for (let i = 0; i < 50; i++) seenIds.delete(iter.next().value);
      }
      setMessageUnread(prev => prev + 1);
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
      listenersRegistered.current = false;
    };
  }, [socket, reconcileAll]);

  // ─── App foreground → reconcile ──────────────────
  useEffect(() => {
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
        activeConversation, setActiveConversation,
        reconcileAll,
      }}
    >
      {children}
    </BadgeContext.Provider>
  );
}

export const useBadge = () => useContext(BadgeContext);