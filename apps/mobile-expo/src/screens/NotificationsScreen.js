import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";
import { useBadge } from "../contexts/BadgeContext";

const API_BASE = "https://timquanhday.de";

function truncate(text, max = 90) {
  if (!text) return "";
  const s = String(text).trim();
  if (s.length <= max) return s;
  return s.substring(0, max).replace(/\s+\S*$/, "") + "...";
}

function ago(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 172800) return "Hôm qua";
  return `${Math.floor(diff / 86400)} ngày trước`;
}

function getPostMedia(item) {
  try {
    const data = typeof item.data === "string" ? JSON.parse(item.data) : (item.data || {});
    return data?.postMedia || null;
  } catch { return null; }
}

function getCommentContent(item) {
  try {
    const data = typeof item.data === "string" ? JSON.parse(item.data) : (item.data || {});
    return data?.commentContent || null;
  } catch { return null; }
}

function getPostId(item) {
  try {
    const data = typeof item.data === "string" ? JSON.parse(item.data) : (item.data || {});
    return data?.postId || item.target_id || null;
  } catch { return item.target_id || null; }
}

function getIcon(type) {
  switch (type) {
    case "like": return "heart";
    case "comment": return "chatbubble";
    case "sos": return "alert-circle";
    default: return "notifications";
  }
}

function getIconColor(type) {
  switch (type) {
    case "like": return "#EF4444";
    case "comment": return "#3B82F6";
    case "sos": return "#F97316";
    default: return "#6B7280";
  }
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
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

  function navigateToTarget(item) {
    const postId = getPostId(item);
    const missing = item.type !== "sos" && !item.post_content && !getPostMedia(item);

    if (!item.is_read) markRead(item.id);

    if (missing && postId) {
      Alert.alert("Nội dung không tồn tại", "Bài viết này đã bị xóa.");
      return;
    }

    if (item.type === "sos") {
      navigation.navigate("SOS");
    } else {
      navigation.navigate("Feed", postId ? { postId } : undefined);
    }
  }

  function renderThumbnail(item) {
    const postMedia = getPostMedia(item);
    if (!postMedia) return null;
    let thumb = null;
    try {
      const m = typeof postMedia === "string" ? JSON.parse(postMedia) : postMedia;
      if (Array.isArray(m) && m[0]) thumb = m[0].url || m[0];
      else if (typeof m === "string") thumb = m;
      else if (typeof m === "object" && m.url) thumb = m.url;
    } catch {}
    if (!thumb) return null;
    const src = thumb.startsWith("http") ? thumb : `${API_BASE}/uploads/${thumb}`;
    return <Image source={{ uri: src }} style={styles.notifThumb} resizeMode="cover" />;
  }

  function renderItem({ item }) {
    const actorName = item.actor_name || "Ai đó";
    const postContent = item.post_content;
    const commentContent = getCommentContent(item);
    const typeLabel = item.type === "like" ? "đã thích" : item.type === "comment" ? "đã bình luận" : item.type === "sos" ? "SOS" : "";
    const hasPostData = postContent || getPostMedia(item);

    return (
      <TouchableOpacity
        style={[styles.notifItem, !item.is_read && styles.notifUnread]}
        onPress={() => navigateToTarget(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.notifIcon, !item.is_read && styles.notifIconActive]}>
          <Ionicons name={getIcon(item.type)} size={20} color={getIconColor(item.type)} />
        </View>
        <View style={styles.notifInfo}>
          <Text style={[styles.notifTitle, !item.is_read && styles.notifTitleUnread]} numberOfLines={2}>
            <Text style={styles.actorName}>{actorName} </Text>
            {typeLabel}
          </Text>

          {commentContent && (
            <Text style={styles.commentText} numberOfLines={2}>"{truncate(commentContent, 100)}"</Text>
          )}

          {postContent ? (
            <View style={styles.postSummary}>
              <Text style={styles.postPreview} numberOfLines={2}>{truncate(postContent, 100)}</Text>
            </View>
          ) : !hasPostData ? (
            <Text style={styles.postDeleted}>Bài viết này không còn tồn tại</Text>
          ) : null}

          {renderThumbnail(item)}

          <Text style={styles.notifTime}>{ago(item.created_at)}</Text>
        </View>
        {!item.is_read && <View style={styles.notifDot} />}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]>
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
          renderItem={renderItem}
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
  actorName: { fontWeight: "700", color: "#000" },
  commentText: { fontSize: 13, color: "#374151", marginTop: 4, paddingLeft: 8, borderLeftWidth: 2, borderLeftColor: "#DBEAFE", fontStyle: "italic" },
  postSummary: { backgroundColor: "#F9FAFB", borderRadius: 8, padding: 8, marginTop: 6 },
  postPreview: { fontSize: 13, color: "#6B7280", lineHeight: 18 },
  postDeleted: { fontSize: 12, color: "#9CA3AF", marginTop: 4 },
  notifThumb: { width: 48, height: 48, borderRadius: 8, marginTop: 6 },
  notifTime: { fontSize: 11, color: "#9CA3AF", marginTop: 6 },
  notifDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3B82F6", marginLeft: 8, marginTop: 4 },
});