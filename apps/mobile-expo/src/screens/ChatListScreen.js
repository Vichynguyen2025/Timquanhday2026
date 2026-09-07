import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Image } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useSocket } from "../contexts/SocketContext";
import { useBadge } from "../contexts/BadgeContext";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { onlineUsers } = useSocket();
  const { setMessageUnread } = useBadge();
  const { user } = useAuth();
  const currentUserId = user?.id;
  const [conversations, setConversations] = useState([]);
  const [blockedConversations, setBlockedConversations] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useFocusEffect(useCallback(() => {
    fetchConversations();
    fetchUnreadCount();
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === msg.conversation_id
            ? { ...c, last_message: msg.content || (msg.type === "image" ? "📷 Hình ảnh" : c.last_message), last_message_at: msg.created_at, unread_count: (c.unread_count || 0) + (msg.sender_id && msg.sender_id !== currentUserId ? 1 : 0) }
            : c
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
    };
    socket.on("message:new", handler);
    return () => socket.off("message:new", handler);
  }, [currentUserId]));

  async function fetchUnreadCount() {
    try {
      const res = await api.get("/messages/unread-count");
      setMessageUnread(res.data.count || 0);
    } catch (e) {}
  }

  async function fetchConversations() {
    try {
      const res = await api.get("/conversations");
      const convs = res.data || [];
      setConversations(convs);
      // Check block status for each conversation
      const blocked = new Set();
      for (const c of convs) {
        const otherId = c.participants?.[0];
        if (otherId) {
          try {
            const statusRes = await api.get("/users/" + otherId + "/block-status");
            if (statusRes.data?.isBlocked) blocked.add(c.id);
          } catch {}
        }
      }
      setBlockedConversations(blocked);
    } catch (e) {}
    setLoading(false);
  }

  function formatTime(d) {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Vừa xong";
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });
  }

  const filtered = conversations.filter((c) => (c.display_name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <TouchableOpacity style={styles.headerBtn}>
          <Ionicons name="create-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textTertiary} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.search}
          placeholder="Tìm kiếm trên Messenger"
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Stories / Active now */}
      <View style={styles.activeRow}>
        <View style={styles.activeStory}>
          <View style={[styles.activeRing, { borderColor: colors.primary }]}>
            <Ionicons name="camera" size={20} color={colors.primary} />
          </View>
          <Text style={styles.activeLabel}>Tin của bạn</Text>
        </View>
        {conversations.filter(c => {
          const otherId = c.participants?.[0];
          return otherId && onlineUsers.has(otherId);
        }).slice(0, 5).map(c => (
          <View key={c.id} style={styles.activeStory}>
            <View style={[styles.activeRing, { borderColor: colors.online }]}>
              <Text style={styles.activeAvatar}>{(c.display_name || "?")[0].toUpperCase()}</Text>
            </View>
            <Text style={styles.activeLabel} numberOfLines={1}>{c.display_name}</Text>
          </View>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={56} color={colors.textTertiary + "60"} />
          <Text style={styles.emptyText}>Chưa có tin nhắn</Text>
          <Text style={styles.emptySub}>Hãy kết nối với mọi người xung quanh</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.convItem}
              activeOpacity={0.7}
              onPress={() => navigation.navigate("ChatDetail", { conversationId: item.id, name: item.display_name })}
              onLongPress={() => {
                Alert.alert("Tuỳ chọn", "", [
                  { text: "Xóa cuộc trò chuyện", style: "destructive", onPress: () => {
                    Alert.alert("Xóa", "Xóa cuộc trò chuyện này?", [
                      { text: "Huỷ", style: "cancel" },
                      { text: "Xóa", style: "destructive", onPress: async () => {
                        try { await api.delete("/conversations/" + item.id);
                          setConversations((prev) => prev.filter((c) => c.id !== item.id));
                        } catch (e) {}
                      }},
                    ]);
                  }},
                  { text: "Huỷ", style: "cancel" },
                ]);
              }}
            >
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  {item.avatar ? (
                    <Image source={{ uri: item.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                  ) : (
                    <Text style={styles.avatarText}>{(item.display_name || "?")[0].toUpperCase()}</Text>
                  )}
                </View>
                {(() => {
                  const otherId = item.participants?.[0];
                  const isOnline = (otherId && onlineUsers.has(otherId)) || item.is_online;
                  return isOnline && <View style={styles.onlineDot} />;
                })()}
                {blockedConversations.has(item.id) && <View style={styles.blockedBadge}><Ionicons name="ban-outline" size={10} color="#EF4444" /></View>}
              </View>
              <View style={styles.convInfo}>
                <View style={styles.convTop}>
                  <Text style={styles.convName} numberOfLines={1}>{item.display_name}</Text>
                  <Text style={styles.convTime}>{item.last_message_at ? formatTime(item.last_message_at) : ""}</Text>
                </View>
                <View style={styles.convBottom}>
                  <Text style={styles.convLast} numberOfLines={1}>
                    {item.last_message || "Bắt đầu trò chuyện"}
                  </Text>
                  {item.unread_count > 0 && (
                    <View style={styles.unread}>
                      <Text style={styles.unreadText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 8, backgroundColor: "#fff",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#000" },
  headerBtn: { padding: 6 },
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F0F2F5", marginHorizontal: 12, borderRadius: 10,
    paddingHorizontal: 12, height: 38, marginBottom: 8,
  },
  search: { flex: 1, fontSize: 15, color: "#000" },
  // Active now
  activeRow: {
    flexDirection: "row", paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5", marginBottom: 4,
  },
  activeStory: { alignItems: "center", marginRight: 14, width: 58 },
  activeRing: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", borderWidth: 2.5 },
  activeAvatar: { fontSize: 20, fontWeight: "600", color: "#000" },
  activeLabel: { fontSize: 11, color: "#65676B", marginTop: 4, textAlign: "center" },
  // Empty
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { fontSize: 17, fontWeight: "600", color: "#65676B", marginTop: 12 },
  emptySub: { fontSize: 14, color: "#8A8D91", marginTop: 4, textAlign: "center" },
  // Conversation item
  convItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5",
  },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
  onlineDot: {
    width: 14, height: 14, borderRadius: 7, backgroundColor: colors.online,
    borderWidth: 2.5, borderColor: "#fff", position: "absolute", bottom: 0, right: 0,
  },
  blockedBadge: {
    position: "absolute", top: -2, right: -2,
    width: 18, height: 18, borderRadius: 9, backgroundColor: "#FEF2F2",
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#fff",
  },
  convInfo: { flex: 1 },
  convTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  convName: { fontSize: 15, fontWeight: "600", color: "#000", flex: 1 },
  convTime: { fontSize: 12, color: "#65676B", marginLeft: 8 },
  convBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3 },
  convLast: { fontSize: 14, color: "#65676B", flex: 1 },
  unread: {
    backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20,
    alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 8,
  },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});