import React, { createContext, useContext, useState, useCallback } from "react";

const BadgeContext = createContext(null);

export function BadgeProvider({ children }) {
  const [messageUnread, setMessageUnread] = useState(0);
  const [notificationUnread, setNotificationUnread] = useState(0);

  return (
    <BadgeContext.Provider value={{ messageUnread, setMessageUnread, notificationUnread, setNotificationUnread }}>
      {children}
    </BadgeContext.Provider>
  );
}

export const useBadge = () => useContext(BadgeContext);