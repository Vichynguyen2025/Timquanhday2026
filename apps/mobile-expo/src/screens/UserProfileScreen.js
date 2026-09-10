import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator,
  FlatList, Dimensions, Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TAB_OPTIONS = ["posts", "saves", "likes"];
const TAB_LABELS = { posts: "Bài viết", saves: "Đã lưu", likes: "Đã thích" };
const TAB_ICONS = { posts: "grid-outline", saves: "bookmark-outline", likes: "heart-outline" };

export default function UserProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { userId } = route.params || {};
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("posts");
  const [tabItems, setTabItems] = useState({ posts: [], saves: [], likes: [] });
  const [tabLoading, setTabLoading] = useState({ posts: false, saves: false, likes: false });

  useEffect(() => { fetchProfile(); }, [userId]);
  useEffect(() => { fetchTabItems(activeTab); }, [activeTab, userId]);

  async function fetchProfile() {
    setLoading(true);
    try {
      const res = await api.get(`/users/${userId}`);
      setProfile(res.data);
    } catch (e) { Alert.alert("Lỗi", "Không thể tải thông tin người dùng"); navigation.goBack(); }
    setLoading(false);
  }

  async function fetchTabItems(tab) {
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    try {
      const endpoint = tab === "posts" ? `/posts?userId=${userId}`
        : tab === "saves" ? `/posts?filter=saved&userId=${userId}`
        : `/posts?filter=liked&userId=${userId}`;
      const res = await api.get(endpoint);
      setTabItems(prev => ({ ...prev, [tab]: res.data?.posts || [] }));
    } catch (e) {}
    setTabLoading(prev => ({ ...prev, [tab]: false }));
  }

  const p = profile;

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trang cá nhân</Text>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={tabItems[activeTab]}
        keyExtractor={(item) => item.id}
        numColumns={3}
        refreshControl={null}
        ListHeaderComponent={
          <View>
            {/* Avatar + Info */}
            <View style={styles.profileSection}>
              <View style={styles.avatarWrap}>
                {p?.avatar ? (
                  <Image source={{ uri: p.avatar.startsWith("http") ? p.avatar : `https://timquanhday.de${p.avatar}` }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Text style={styles.avatarText}>{(p?.name || "?")[0].toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.name}>{p?.name}</Text>
              {p?.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}

              {/* Profile details */}
              <View style={styles.detailsRow}>
                {p?.gender ? (
                  <View style={styles.detailChip}>
                    <Ionicons name="male-female" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{p.gender}</Text>
                  </View>
                ) : null}
                {p?.birth_year ? (
                  <View style={styles.detailChip}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{p.birth_year}</Text>
                  </View>
                ) : null}
                {p?.hometown ? (
                  <View style={styles.detailChip}>
                    <Ionicons name="home-outline" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{p.hometown}</Text>
                  </View>
                ) : null}
                {p?.occupation ? (
                  <View style={styles.detailChip}>
                    <Ionicons name="briefcase-outline" size={14} color="#6B7280" />
                    <Text style={styles.detailText}>{p.occupation}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
              {TAB_OPTIONS.map(tab => {
                const count = tabItems[tab]?.length || 0;
                return (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => setActiveTab(tab)}
                  >
                    <Ionicons name={TAB_ICONS[tab]} size={18} color={activeTab === tab ? colors.primary : "#9CA3AF"} />
                    <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>{TAB_LABELS[tab]}</Text>
                    {count > 0 && <Text style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>{count}</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          tabLoading[activeTab] ? (
            <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
          ) : (
            <View style={styles.emptyTab}>
              <Ionicons name={activeTab === "posts" ? "document-text-outline" : activeTab === "saves" ? "bookmark-outline" : "heart-outline"} size={40} color="#D1D5DB" />
              <Text style={styles.emptyText}>{activeTab === "posts" ? "Chưa có bài viết" : activeTab === "saves" ? "Chưa lưu bài viết" : "Chưa thích bài viết"}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.gridItem}
            activeOpacity={0.8}
            onPress={() => navigation.navigate("PostDetail", { postId: item.id, post: item })}
          >
            {item.media?.[0]?.url ? (
              <Image source={{ uri: item.media[0].url }} style={styles.gridImage} />
            ) : item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.gridImage} />
            ) : (
              <View style={[styles.gridImage, styles.gridPlaceholder]}>
                <Ionicons name="document-text" size={24} color="#9CA3AF" />
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  profileSection: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "700", color: colors.primary },
  name: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 4 },
  bio: { fontSize: 14, color: "#374151", marginTop: 6, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  detailsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  detailText: { fontSize: 12, color: "#6B7280" },
  tabsContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 6, borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F9FAFB" },
  tabActive: { backgroundColor: colors.primaryLight },
  tabLabel: { fontSize: 12, fontWeight: "500", color: "#9CA3AF" },
  tabLabelActive: { color: colors.primary, fontWeight: "600" },
  tabCount: { fontSize: 11, color: "#D1D5DB", fontWeight: "600" },
  tabCountActive: { color: colors.primary },
  gridItem: { width: (SCREEN_WIDTH - 32) / 3, aspectRatio: 1, padding: 4 },
  gridImage: { flex: 1, borderRadius: 8, backgroundColor: "#F3F4F6" },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },
  emptyTab: { alignItems: "center", paddingTop: 50, paddingBottom: 30 },
  emptyText: { fontSize: 14, color: "#9CA3AF", marginTop: 10 },
});