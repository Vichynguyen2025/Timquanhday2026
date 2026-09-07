import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";
import { useBadge } from "../contexts/BadgeContext";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { setNotificationUnread } = useBadge();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(useCallback(() => { fetchNotifs(); }, []));

  async function fetchNotifs() {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
      const count = res.data.unreadCount || 0;
      setUnreadCount(count);
      setNotificationUnread(count);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      const newCount = Math.max(0, unreadCount - 1);
      setUnreadCount(newCount);
      setNotificationUnread(newCount);
    } catch (e) {}
  }

  async function markAllRead() {
    try {
      await api.patch("/notifications/read-all");
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
      setNotificationUnread(0);
    } catch (e) {}
  }

  function getIcon(type) {
    switch (type) {
      case "like": return "heart";
      case "comment": return "chatbubble";
      case "sos": return "alert-circle";
      case "message": return "chatbubbles";
      case "friend_request": return "person-add";
      default: return "notifications";
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text style={styles.title}>Thông báo</Text>
          {unreadCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount}</Text></View>}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead}>
            <Text style={styles.markAllText}>Đã đọc tất cả</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifs(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={50} color={colors.textTertiary} />
              <Text style={styles.emptyText}>Không có thông báo</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.notifItem, !item.is_read && styles.notifUnread]}
              onPress={() => { if (!item.is_read) markRead(item.id); }}
              activeOpacity={0.7}
            >
              <View style={[styles.notifIcon, !item.is_read && styles.notifIconActive]}>
                <Ionicons name={getIcon(item.type)} size={20} color={item.is_read ? colors.textTertiary : colors.primary} />
              </View>
              <View style={styles.notifInfo}>
                <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]}>{item.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>
              </View>
              {!item.is_read ? <View style={styles.notifDot} /> : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  badge: { backgroundColor: "#EF4444", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  markAllText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#6B7280", marginTop: 12 },
  notifItem: { flexDirection: "row", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB", backgroundColor: "#fff" },
  notifUnread: { backgroundColor: "#F0F9FF" },
  notifIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  notifIconActive: { backgroundColor: "#DBEAFE" },
  notifInfo: { flex: 1, marginLeft: 12 },
  notifTitle: { fontSize: 14, fontWeight: "500", color: "#111827" },
  notifTitleUnread: { fontWeight: "700" },
  notifBody: { fontSize: 13, color: "#6B7280", marginTop: 2, lineHeight: 18 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6", marginLeft: 8, marginTop: 4 },
});