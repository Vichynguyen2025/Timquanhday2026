import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet, ActivityIndicator, Image, Alert, Modal, ScrollView } from "react-native";
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

const API_BASE = "https://timquanhday.de";
const GROUP_RADII = [100, 200, 500];

export default function ChatListScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { onlineUsers } = useSocket();
  const { setMessageUnread } = useBadge();
  const { user } = useAuth();
  const currentUserId = user?.id;

  // ─── Tab state ───────────────────────────
  const [tab, setTab] = useState("chats");

  // ─── Chats tab (EXISTING — untouched) ────
  const [conversations, setConversations] = useState([]);
  const [blockedConversations, setBlockedConversations] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // ─── Group create ────────────────────────
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // ─── Suggested groups ────────────────────
  const [nearbyGroups, setNearbyGroups] = useState([]);
  const [groupRadius, setGroupRadius] = useState(500);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // ════════════════════════════════════════
  // EXISTING REALTIME CODE — UNTOUCHED
  // ════════════════════════════════════════
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

  // �════════════════════════════════════════
  // GROUP CHAT FUNCTIONS
  // �════════════════════════════════════════
  const [nearbyUsers, setNearbyUsers] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [groupUserSearch, setGroupUserSearch] = useState("");

  async function openCreateGroup() {
    setGroupName("");
    setGroupMembers([]);
    setGroupUserSearch("");
    setShowCreateGroup(true);
    // Fetch nearby users for suggestions
    setLoadingNearby(true);
    try {
      const [userRes, nearbyRes] = await Promise.allSettled([
        api.get("/users/search", { params: { q: "" } }),
        api.get("/location/nearby", { params: { radius: 500 } }),
      ]);
      if (userRes.status === "fulfilled") setAllUsers(userRes.value.data || []);
      if (nearbyRes.status === "fulfilled") setNearbyUsers(nearbyRes.value.data?.users || []);
    } catch {}
    setLoadingNearby(false);
  }

  function toggleMember(u) {
    setGroupMembers(prev =>
      prev.find(m => m.id === u.id) ? prev.filter(m => m.id !== u.id) : [...prev, u]
    );
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) { Alert.alert("Lỗi", "Vui lòng nhập tên nhóm"); return; }
    if (groupMembers.length < 2) { Alert.alert("Lỗi", "Cần ít nhất 3 thành viên (bao gồm bạn)"); return; }
    setCreating(true);
    try {
      const memberIds = groupMembers.map(m => m.id);
      const res = await api.post("/conversations/group", {
        name: groupName.trim(),
        memberIds,
      });
      if (res.data?.id) {
        setShowCreateGroup(false);
        navigation.navigate("ChatDetail", { conversationId: res.data.id, name: groupName.trim() });
        fetchConversations();
      }
    } catch (e) { Alert.alert("Lỗi", "Không thể tạo nhóm"); }
    setCreating(false);
  }

  // ╕═══════════════════════════════════════p // NEARBY GROUPS
  // ╕═══════════════════════════════════════
  async function fetchNearbyGroups() {    setLoadingGroups(true);    try {
      const res = await api.get(`/conversations/nearby-groups?radius=${groupRadius}`);
      setNearbyGroups(res.data?.groups || []);
    } catch (e) {}
    setLoadingGroups(false);
  }

  useFocusEffect(useCallback(() => {
    if (tab === "suggested") fetchNearbyGroups();
  }, [tab, groupRadius]));

  const filteredUsers = allUsers.filter(u =>
    u.id !== currentUserId && !groupMembers.find(m => m.id === u.id) &&
    (u.name || "").toLowerCase().includes(groupUserSearch.toLowerCase())
  );

  const suggestedNearby = nearbyUsers.filter(u =>
    u.id !== currentUserId && !groupMembers.find(m => m.id === u.id)
  );

  const filtered = conversations.filter((c) => (c.display_name || "").toLowerCase().includes(search.toLowerCase()));

  // ─── Render conversation item (EXISTING)─
  const renderConv = ({ item }) => (
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
          {item.type === "group" ? (
            <Ionicons name="people" size={24} color={colors.primary} />
          ) : item.avatar ? (
            <Image source={{ uri: item.avatar }} style={{ width: 52, height: 52, borderRadius: 26 }} />
          ) : (
            <Text style={styles.avatarText}>{(item.display_name || "?")[0].toUpperCase()}</Text>
          )}
        </View>
        {item.type !== "group" && (() => {
          const otherId = item.participants?.[0];
          const isOnline = (otherId && onlineUsers.has(otherId)) || item.is_online;
          return isOnline ? <View style={styles.onlineDot} /> : null;
        })()}
        {blockedConversations.has(item.id) && <View style={styles.blockedBadge}><Ionicons name="ban-outline" size={10} color="#EF4444" /></View>}
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convTop}>
          <Text style={styles.convName} numberOfLines={1}>{item.display_name}</Text>
          <Text style={styles.convTime}>{item.last_message_at ? formatTime(item.last_message_at) : ""}</Text>
        </View>
        <View style={styles.convBottom}>
          <Text style={styles.convLast} numberOfLines={1}>{item.last_message || "Bắt đầu trò chuyện"}</Text>
          {item.unread_count > 0 && (
            <View style={styles.unread}>
              <Text style={styles.unreadText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  // ─── Render suggested group ──────────────
  const renderGroup = ({ item }) => (
    <TouchableOpacity
      style={styles.onvItem}
      activeOpacity={0.7}
      onPress={() => navigation.navigate("ChatDetail", { conversationId: item.id, name: item.name || "Nhóm" })}
    >
      <View style={styles.avatarWrap}>
        <View style={[styles.avatar, { backgroundColor: "#F0FDF4" }]}>
          <Ionicons name="people" size={24} color="#22C55E" />
        </View>
      </View>
      <View style={styles.convInfo}>
        <View style={styles.convTop}>
          <Text style={styles.convName} numberOfLines={1}>{item.name || "Nhóm"}</Text>
          {item.distance != null && <Text style={{ fontSize: 11, color: "#22C55E" }}>{item.distance < 1000 ? `${item.distance}m` : `${(item.distance / 1000).toFixed(1)}km`}</Text>}
        </View>
        <View style={styles.convBottom}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2, flex: 1 }}>
            {item.members?.slice(0, 3).map(m => (
              <View key={m.id} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", marginRight: -4 }}>
                {m.avatar ? (
                  <Image source={{ uri: m.avatar }} style={{ width: 20, height: 20, borderRadius: 10 }} />
                ) : (
                  <Text style={{ fontSize: 9, fontWeight: "700", color: colors.primary }}>{(m.name || "?")[0]}</Text>
                )}
              </View>
            ))}
            {item.members?.length > 3 && <Text style={{ fontSize: 10, color: "#9CA3AF" }}>+{item.members.length - 3}</Text>}
            <Text style={[styles.convLast, { color: "#6B7280" }]} numberOfLines={1}>  {item.last_message?.substring(0, 25) || "Tham gia nhóm"}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  // ════════════════════════════════════════
  // CREATE GROUP MODAL — Vercel-inspired design
  // ════════════════════════════════════════
  const CreateGroupModal = () => (
    <Modal visible={showCreateGroup} transparent animationType="slide" onRequestClose={() => setShowCreateGroup(false)}>
      <View style={sModal.overlay}>
        <View style={sModal.container}>
          {/* Handle bar */}
          <View style={sModal.handleBar} />

          {/* Header */}
          <View style={sModal.header}>
            <TouchableOpacity onPress={() => setShowCreateGroup(false)} style={sModal.headerBtn}>
              <Ionicons name="close" size={22} color="#6B7280" />
            </TouchableOpacity>
            <Text style={sModal.title}>Tạo nhóm mới</Text>
            <TouchableOpacity onPress={handleCreateGroup} disabled={creating} style={[sModal.headerBtn, creating && { opacity: 0.5 }]}>
              {creating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[sModal.doneBtn, (!groupName.trim() || groupMembers.length < 2) && { opacity: 0.4 }]}>Tạo</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Group name input */}
          <View style={sModal.nameRow}>
            <View style={sModal.nameIcon}>
              <Ionicons name="people" size={18} color={colors.primary} />
            </View>
            <TextInput
              style={sModal.nameInput}
              placeholder="Tên nhóm"
              placeholderTextColor="#9CA3AF"
              value={groupName}
              onChangeText={setGroupName}
              maxLength={100}
              autoFocus
            />
          </View>

          {/* Selected members */}
          {groupMembers.length > 0 && (
            <View style={sModal.selectedRow}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {groupMembers.map(m => (
                  <TouchableOpacity key={m.id} style={sModal.selectedChip} onPress={() => toggleMember(m)}>
                    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                      {m.avatar ? (
                        <Image source={{ uri: m.avatar.startsWith("http") ? m.avatar : `https://timquanhday.de/uploads/${m.avatar}` }}
                          style={{ width: 28, height: 28, borderRadius: 14 }} />
                      ) : (
                        <Text style={{ fontSize: 11, fontWeight: "700", color: colors.primary }}>{(m.name || "?")[0]}</Text>
                      )}
                    </View>
                    <Text style={sModal.selectedName} numberOfLines={1}>{m.name}</Text>
                    <Ionicons name="close-circle" size={16} color="#EF4444" />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Search */}
          <View style={sModal.searchRow}>
            <Ionicons name="search" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={sModal.searchInput}
              placeholder="Tìm kiếm người dùng..."
              placeholderTextColor="#9CA3AF"
              value={groupUserSearch}
              onChangeText={setGroupUserSearch}
            />
            {groupUserSearch.length > 0 && (
              <TouchableOpacity onPress={() => setGroupUserSearch("")}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {/* Body */}
          <View style={sModal.body}>
            {/* Suggested nearby users */}
            {!groupUserSearch && suggestedNearby.length > 0 && (
              <>
                <Text style={sModal.sectionTitle}>
                  <Ionicons name="navigate" size={12} color={colors.primary} />  Đề xuất gần bạn
                </Text>
                {loadingNearby ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ paddingVertical: 12 }} />
                ) : (
                  <FlatList
                    data={suggestedNearby}
                    keyExtractor={(item) => `nearby-${item.id}`}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={sModal.suggestedCard} onPress={() => toggleMember(item)} activeOpacity={0.7}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                          {item.avatar ? (
                            <Image source={{ uri: item.avatar.startsWith("http") ? item.avatar : `https://timquanhday.de/uploads/${item.avatar}` }}
                              style={{ width: 48, height: 48, borderRadius: 24 }} />
                          ) : (
                            <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary }}>{(item.name || "?")[0]}</Text>
                          )}
                          {item.is_online ? <View style={sModal.suggestedOnline} /> : null}
                        </View>
                        <Text style={sModal.suggestedName} numberOfLines={1}>{item.name}</Text>
                        <Text style={sModal.suggestedDist}>{item.distance ? (item.distance < 1000 ? `${item.distance}m` : `${(item.distance / 1000).toFixed(1)}km`) : ""}</Text>
                        <View style={[sModal.addBtn, groupMembers.find(m => m.id === item.id) && sModal.addBtnActive]}>
                          <Ionicons name={groupMembers.find(m => m.id === item.id) ? "checkmark" : "add"} size={18} color="#fff" />
                        </View>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            )}

            {/* All users list */}
            <Text style={sModal.sectionTitle}>
              <Ionicons name="people" size={12} color="#6B7280" />  Tất cả người dùng
            </Text>
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item.id}
              style={sModal.userList}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 24 }}>
                  <Ionicons name="search-outline" size={32} color="#D1D5DB" />
                  <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 8 }}>Không tìm thấy người dùng</Text>
                </View>
              }
              renderItem={({ item }) => {
                const selected = !!groupMembers.find(m => m.id === item.id);
                const nearbySuggestion = suggestedNearby.find(s => s.id === item.id);
                return (
                  <TouchableOpacity style={sModal.userItem} onPress={() => toggleMember(item)} activeOpacity={0.6}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                      {item.avatar ? (
                        <Image source={{ uri: item.avatar.startsWith("http") ? item.avatar : `https://timquanhday.de/uploads/${item.avatar}` }}
                          style={{ width: 40, height: 40, borderRadius: 20 }} />
                      ) : (
                        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primary }}>{(item.name || "?")[0]}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#111827" }}>{item.name}</Text>
                      {nearbySuggestion?.distance != null && (
                        <Text style={{ fontSize: 11, color: "#22C55E" }}>
                          🧭 {nearbySuggestion.distance < 1000 ? `${nearbySuggestion.distance}m` : `${(nearbySuggestion.distance / 1000).toFixed(1)}km`}
                        </Text>
                      )}
                    </View>
                    <View style={[sModal.checkBtn, selected && sModal.checkBtnActive]}>
                      {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ──────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.title}>Chat</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openCreateGroup}>
          <Ionicons name="people-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ─── Tab bar ──────────────────────── */}
      <View style={styles.tabRow}>
        <TouchableOpacity style={[styles.tab, tab === "chats" && styles.tabActive]} onPress={() => setTab("chats")}>
          <Ionicons name="chatbubbles" size={16} color={tab === "chats" ? colors.primary : "#9CA3AF"} />
          <Text style={[styles.tabLabel, tab === "chats" && styles.tabLabelActive]}>Nhắn tin</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "suggested" && styles.tabActive]} onPress={() => { setTab("suggested"); fetchNearbyGroups(); }}>
          <Ionicons name="compass" size={16} color={tab === "suggested" ? colors.primary : "#9CA3AF"} />
          <Text style={[styles.tabLabel, tab === "suggested" && styles.tabLabelActive]}>Đề xuất</Text>
        </TouchableOpacity>
      </View>

      {/* ─── Tìm quanh đây CTA (only on chats tab) */}
      {tab === "chats" && (
        <TouchableOpacity style={styles.exploreCTA} onPress={() => navigation.navigate("Explore")} activeOpacity={0.7}>
          <View style={styles.exploreCTALeft}>
            <View style={styles.exploreCTAIcon}>
              <Ionicons name="location" size={22} color="#fff" />
            </View>
            <View style={styles.exploreCTAText}>
              <Text style={styles.exploreCTATitle}>📍 Tìm quanh đây</Text>
              <Text style={styles.exploreCTASub}>Khám phá những người đang ở gần bạn</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      )}

      {/* ─── Chats tab content ─────────────── */}
      {tab === "chats" && (
        <>
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
              renderItem={renderConv}
            />
          )}
        </>
      )}

      {/* ─── Suggested tab content ──────────── */}
      {tab === "suggested" && (
        <>
          {/* Radius chips */}
          <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6, gap: 6 }}>
            {GROUP_RADII.map(r => (
              <TouchableOpacity key={r} style={[styles.chip, groupRadius === r && styles.chipActive]} onPress={() => { setGroupRadius(r); }}>
                <Text style={[styles.chipText, groupRadius === r && styles.chipTextActive]}>{r}m</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loadingGroups ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
          ) : nearbyGroups.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color={colors.textTertiary + "60"} />
              <Text style={styles.emptyText}>Chưa có nhóm nào gần đây</Text>
              <Text style={styles.emptySub}>Thử mở rộng bán kính hoặc tạo nhóm mới</Text>
            </View>
          ) : (
            <FlatList
              data={nearbyGroups}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
              renderItem={renderGroup}
            />
          )}
        </>
      )}

      {/* ─── Create Group Modal ──────────── */}
      {showCreateGroup && <CreateGroupModal />}
    </View>
  );
}

// ════════════════════════════════════════
// MODAL STYLES — Vercel-inspired
// ════════════════════════════════════════
const sModal = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  container: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "88%", overflow: "hidden" },
  handleBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginTop: 8, marginBottom: 4 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  doneBtn: { fontSize: 15, fontWeight: "700", color: colors.primary },
  // Group name
  nameRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 12, marginBottom: 4, backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, height: 44 },
  nameIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  nameInput: { flex: 1, fontSize: 15, color: "#111827" },
  // Selected
  selectedRow: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  selectedChip: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F9FF", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "#DBEAFE", gap: 4 },
  selectedName: { fontSize: 13, color: "#111827", fontWeight: "500", maxWidth: 80 },
  // Search
  searchRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginTop: 10, marginBottom: 4, backgroundColor: "#F3F4F6", borderRadius: 10, paddingHorizontal: 12, height: 36 },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  // Body
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#6B7280", marginBottom: 8, letterSpacing: 0.3 },
  // Suggested cards
  suggestedCard: { width: 90, alignItems: "center", paddingVertical: 8, paddingHorizontal: 4, backgroundColor: "#F9FAFB", borderRadius: 14, borderWidth: 0.5, borderColor: "#E5E7EB" },
  suggestedOnline: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E", position: "absolute", bottom: 0, right: 0, borderWidth: 2, borderColor: "#fff" },
  suggestedName: { fontSize: 12, fontWeight: "500", color: "#111827", marginTop: 6, textAlign: "center" },
  suggestedDist: { fontSize: 10, color: "#22C55E", marginTop: 2 },
  addBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginTop: 6 },
  addBtnActive: { backgroundColor: colors.primary },
  // User list
  userList: { flex: 1 },
  userItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" },
  checkBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center", marginLeft: 8 },
  checkBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: "700", color: "#000" },
  headerBtn: { padding: 6, width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F9FF", alignItems: "center", justifyContent: "center" },

  // Tabs
  tabRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 6 },
  tab: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: colors.primaryLight },
  tabLabel: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  tabLabelActive: { color: colors.primary, fontWeight: "700" },

  // Explore CTA
  exploreCTA: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#F0F6FF", marginHorizontal: 12, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, marginBottom: 6 },
  exploreCTALeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  exploreCTAIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  exploreCTATitle: { fontSize: 14, fontWeight: "600", color: "#1E3A5F" },
  exploreCTASub: { fontSize: 11, color: "#6B7280", marginTop: 1 },

  // Search
  searchWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0F2F5", marginHorizontal: 12, borderRadius: 10, paddingHorizontal: 12, height: 36, marginBottom: 6 },
  search: { flex: 1, fontSize: 14, color: "#000" },

  // Chip
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  // Empty
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyText: { fontSize: 16, fontWeight: "600", color: "#65676B", marginTop: 10 },
  emptySub: { fontSize: 13, color: "#8A8D91", marginTop: 4, textAlign: "center" },

  // Conversation item
  convItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
  onlineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.online, borderWidth: 2.5, borderColor: "#fff", position: "absolute", bottom: 0, right: 0 },
  blockedBadge: { position: "absolute", top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#fff" },
  convInfo: { flex: 1 },
  convTop: { flexDirection: "row", justifyContent:"space-between", alignItems:"center" },
  convName: { fontSize:15,fontWeight:"600",color:"#000",flex:1 },
  convTime: { fontSize:12,color:"#65676B",marginLeft:8 },
  convBottom:{ flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginTop:3 },
  convLast:{ fontSize:14,color:"#65676B",flex:1 },
  unread:{
    backgroundColor: colors.primary, borderRadius:10, minWidth:20, height:20,
    alignItems:"center", justifyContent:"center", paddingHorizontal:6, marginLeft:8,
  },
  unreadText:{ color:"#fff", fontSize:11,fontWeight:"700" },
});