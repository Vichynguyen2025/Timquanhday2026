import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";

export default function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useFocusEffect(useCallback(() => {
    fetchConversations();
    const socket = getSocket();
    if (!socket) return;
    const handler = (msg) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === msg.conversation_id
            ? { ...c, last_message: msg.content || (msg.type === "image" ? "📷 Ảnh" : c.last_message), last_message_at: msg.created_at, unread_count: (c.unread_count || 0) + 1 }
            : c
        );
        return updated.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      });
    };
    socket.on("message:new", handler);
    return () => socket.off("message:new", handler);
  }, []));

  async function fetchConversations() {
    try {
      const res = await api.get("/conversations");
      setConversations(res.data);
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
      <View style={styles.header}>
        <Text style={styles.title}>Đoạn chat</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{conversations.length}</Text></View>
      </View>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput style={styles.search} placeholder="Tìm kiếm..." value={search} onChangeText={setSearch} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={50} color={colors.textTertiary} /><Text style={styles.emptyText}>Chưa có đoạn chat</Text></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.convItem} onPress={() => navigation.navigate("ChatDetail", { conversationId: item.id, name: item.display_name })}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.display_name || "?")[0].toUpperCase()}</Text>
                {item.is_online ? <View style={styles.onlineDot} /> : null}
              </View>
              <View style={styles.convInfo}>
                <View style={styles.convTop}><Text style={styles.convName} numberOfLines={1}>{item.display_name}</Text><Text style={styles.convTime}>{formatTime(item.last_message_at)}</Text></View>
                <Text style={styles.convLast} numberOfLines={1}>{item.last_message || "Chưa có tin nhắn"}</Text>
              </View>
              {item.unread_count > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text></View> : null}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 28, fontWeight: "700", color: colors.text },
  badge: { backgroundColor: colors.primaryLight, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, height: 40, marginBottom: 8 },
  search: { flex: 1, marginLeft: 8, fontSize: 14, color: colors.text },
  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
  convItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border + "50" },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
  onlineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.online, borderWidth: 2.5, borderColor: "#fff", position: "absolute", bottom: 0, right: 0 },
  convInfo: { flex: 1, marginLeft: 12 },
  convTop: { flexDirection: "row", justifyContent: "space-between" },
  convName: { fontSize: 15, fontWeight: "600", color: colors.text, flex: 1 },
  convTime: { fontSize: 12, color: colors.textTertiary },
  convLast: { fontSize: 14, color: colors.textSecondary, marginTop: 3 },
  unread: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", marginLeft: 8, paddingHorizontal: 6 },
  unreadText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});