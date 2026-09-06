import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import { colors } from "../theme/colors";

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchNotifs(); }, []));

  async function fetchNotifs() {
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data.notifications || []);
    } catch (e) {}
    setLoading(false);
  }

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread}</Text></View> : null}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="notifications-off-outline" size={50} color={colors.textTertiary} /><Text style={styles.emptyText}>Không có thông báo</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity style={[styles.notifItem, !item.is_read && styles.notifUnread]}>
              <View style={[styles.notifIcon, !item.is_read && styles.notifIconActive]}>
                <Ionicons name={item.type === "message" ? "chatbubble-outline" : "heart-outline"} size={20} color={item.is_read ? colors.textTertiary : colors.primary} />
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
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 24, fontWeight: "700", color: colors.text, marginRight: 8 },
  badge: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
  notifItem: { flexDirection: "row", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border + "50", backgroundColor: colors.surface },
  notifUnread: { backgroundColor: colors.primaryLight + "40" },
  notifIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chatBg, alignItems: "center", justifyContent: "center" },
  notifIconActive: { backgroundColor: colors.primaryLight },
  notifInfo: { flex: 1, marginLeft: 12 },
  notifTitle: { fontSize: 14, fontWeight: "500", color: colors.text },
  notifTitleUnread: { fontWeight: "700" },
  notifBody: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginLeft: 8 },
});