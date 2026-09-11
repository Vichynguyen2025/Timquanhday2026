import React, { useState, useCallback, useEffect, useRef } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, FlatList, Animated, Dimensions, Alert, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "../contexts/LocationContext";
import { useBadge } from "../contexts/BadgeContext";
import { colors } from "../theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TAB_OPTIONS = ["posts", "saves", "likes"];
const TAB_LABELS = { posts: "Bài viết", saves: "Đã lưu", likes: "Đã thích" };
const TAB_ICONS = { posts: "grid-outline", saves: "bookmark-outline", likes: "heart-outline" };

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout, updateUser } = useAuth();
  const { currentLocation, refreshLocation } = useLocation();
  const { reconcileAll } = useBadge();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("posts");
  const [tabItems, setTabItems] = useState({ posts: [], saves: [], likes: [] });
  const [tabLoading, setTabLoading] = useState({ posts: false, saves: false, likes: false });
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [locationToggleLoading, setLocationToggleLoading] = useState(false);
  const [sosToggleLoading, setSosToggleLoading] = useState(false);

  // ─── Fetch profile on focus ─────────────
  useFocusEffect(useCallback(() => {
    fetchProfile();
  }, []));

  // ─── Fetch tab data when tab changes ─────
  useEffect(() => {
    fetchTabItems(activeTab);
  }, [activeTab]);

  async function fetchProfile() {
    try {
      const res = await api.get("/auth/me");
      updateUser(res.data);
      setStats(res.data.stats);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }

  async function fetchTabItems(tab) {
    setTabLoading(prev => ({ ...prev, [tab]: true }));
    try {
      let res;
      if (tab === "posts") res = await api.get(`/posts?userId=${user.id}`);
      else if (tab === "saves") res = await api.get("/posts?filter=saved");
      else if (tab === "likes") res = await api.get("/posts?filter=liked");
      setTabItems(prev => ({ ...prev, [tab]: res.data?.posts || [] }));
    } catch (e) {}
    setTabLoading(prev => ({ ...prev, [tab]: false }));
  }

  // ─── Sidebar animation ──────────────────
  function openSidebar() {
    setSidebarVisible(true);
    Animated.spring(sidebarAnim, {
      toValue: 0, useNativeDriver: true, tension: 60, friction: 10,
    }).start();
  }

  function closeSidebar() {
    Animated.timing(sidebarAnim, {
      toValue: SCREEN_WIDTH, duration: 200, useNativeDriver: true,
    }).start(() => setSidebarVisible(false));
  }

  // ─── Avatar upload ──────────────────────
  function handleEditAvatar() {
    Alert.alert("Đổi ảnh đại diện", "", [
      { text: "Hủy", style: "cancel" },
      { text: "Chụp ảnh", onPress: async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { Alert.alert("Cần quyền camera"); return; }
        const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
        if (result.canceled) return;
        uploadAvatar(result.assets[0].uri);
      }},
      { text: "Chọn từ thư viện", onPress: async () => {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) { Alert.alert("Cần quyền thư viện"); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [1, 1] });
        if (result.canceled) return;
        uploadAvatar(result.assets[0].uri);
      }},
    ]);
  }

  async function uploadAvatar(uri) {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      const formData = new FormData();
      formData.append("image", { uri, type: "image/jpeg", name: "avatar.jpg" });
      const uploadRes = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) { Alert.alert("Lỗi", "Không thể tải ảnh lên"); return; }
      const res = await api.patch("/users/me", { avatar: uploadData.url });
      updateUser(res.data);
    } catch (e) { Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện"); }
  }

  // ─── Location toggle ────────────────────
  async function toggleLocation(value) {
    setLocationToggleLoading(true);
    try {
      await api.patch("/users/location", { enabled: value });
      updateUser({ location_enabled: value });
      if (value) refreshLocation();
    } catch (e) { Alert.alert("Lỗi", "Không thể thay đổi cài đặt định vị"); }
    setLocationToggleLoading(false);
  }

  // ─── SOS toggle ─────────────────────────
  async function toggleSosProvider(value) {
    setSosToggleLoading(true);
    try {
      let categoryIds = user?.service_profile?.categories?.map(c => c.id) || [];
      let serviceRadius = user?.service_profile?.service_radius || 1000;
      if (value && categoryIds.length === 0) categoryIds = ["cat-sua-xe", "cat-khac"];
      const res = await api.put("/sos/helper/profile", {
        is_provider: true, is_available: value, service_radius: serviceRadius, category_ids: categoryIds,
      });
      updateUser({ service_profile: res.data });
    } catch (e) { Alert.alert("Lỗi", "Không thể thay đổi cài đặt hỗ trợ SOS"); }
    setSosToggleLoading(false);
  }

  // ─── Logout ─────────────────────────────
  function handleLogout() {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: async () => {
        try { await api.post("/auth/logout"); } catch (e) {}
        logout();
      }},
    ]);
  }

  const p = user;
  const sp = user?.service_profile;
  if (loading) return (
    <View style={[styles.container, { paddingTop: insets.top, justifyContent: "center", alignItems: "center" }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ──────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cá nhân</Text>
        <TouchableOpacity onPress={openSidebar} style={styles.headerBtn}>
          <Ionicons name="settings-outline" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Avatar + Info ──────────────── */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleEditAvatar} style={styles.avatarWrap}>
            {p?.avatar ? (
              <Image key={p.avatar} source={{ uri: p.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarText}>{(p?.name || "?")[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
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
            {p?.school ? (
              <View style={styles.detailChip}>
                <Ionicons name="school-outline" size={14} color="#6B7280" />
                <Text style={styles.detailText}>{p.school}</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate("EditProfile")}>
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={styles.editBtnText}>Chỉnh sửa trang cá nhân</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Stats ──────────────────────── */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.posts || 0}</Text>
              <Text style={styles.statLabel}>Bài viết</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.saves || 0}</Text>
              <Text style={styles.statLabel}>Đã lưu</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.likes || 0}</Text>
              <Text style={styles.statLabel}>Đã thích</Text>
            </View>
          </View>
        )}

        {/* ─── Content Tabs ────────────────── */}
        <View style={styles.tabsContainer}>
          {TAB_OPTIONS.map(tab => {
            const count = tabItems[tab]?.length || 0;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => setActiveTab(tab)}
              >
                <Ionicons
                  name={TAB_ICONS[tab]}
                  size={18}
                  color={activeTab === tab ? colors.primary : "#9CA3AF"}
                />
                <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
                  {TAB_LABELS[tab]}
                </Text>
                {count > 0 && (
                  <Text style={[styles.tabCount, activeTab === tab && styles.tabCountActive]}>{count}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ─── Tab Content Grid ────────────── */}
        {tabLoading[activeTab] ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
        ) : tabItems[activeTab].length === 0 ? (
          <View style={styles.emptyTab}>
            <Ionicons
              name={activeTab === "posts" ? "document-text-outline" : activeTab === "saves" ? "bookmark-outline" : "heart-outline"}
              size={40} color="#D1D5DB"
            />
            <Text style={styles.emptyText}>
              {activeTab === "posts" ? "Chưa có bài viết" : activeTab === "saves" ? "Chưa lưu bài viết" : "Chưa thích bài viết"}
            </Text>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {tabItems[activeTab].map(item => (
              <TouchableOpacity
                key={item.id}
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
                <View style={styles.gridOverlay}>
                  {(item.like_count || 0) > 0 && (
                    <View style={styles.gridStat}>
                      <Ionicons name="heart" size={12} color="#fff" />
                      <Text style={styles.gridStatText}>{item.like_count}</Text>
                    </View>
                  )}
                  {(item.comment_count || 0) > 0 && (
                    <View style={styles.gridStat}>
                      <Ionicons name="chatbubble" size={12} color="#fff" />
                      <Text style={styles.gridStatText}>{item.comment_count}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ─── Profile Sidebar ──────────────── */}
      {sidebarVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Overlay */}
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSidebar} />
          {/* Sidebar panel */}
          <Animated.View
            style={[
              styles.sidebar,
              { transform: [{ translateX: sidebarAnim }], paddingTop: insets.top + 60 },
            ]}
          >
            <Text style={styles.sidebarTitle}>Cài đặt & Quản lý</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <SidebarItem icon="create-outline" label="Chỉnh sửa trang cá nhân" color={colors.primary}
                onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("EditProfile"), 300); }} />

              <SidebarGroupTitle label="CÀI ĐẶT" />
              <SidebarToggle icon="location-outline" label="Định vị" value={p?.location_enabled !== false}
                onToggle={toggleLocation} loading={locationToggleLoading} />
              <SidebarToggle icon="hand-left-outline" label="Nhận hỗ trợ SOS"
                value={sp?.is_provider && sp?.is_available}
                onToggle={toggleSosProvider} loading={sosToggleLoading} />
              {sp?.is_provider && (
                <SidebarItem icon="settings-outline" label="Cấu hình hỗ trợ"
                  sub={sp?.categories?.slice(0, 2).map(c => c.name).join(", ") + (sp?.categories?.length > 2 ? ` +${sp.categories.length - 2}` : "")}
                  onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("SOSHelperSetup", { profile: user }), 300); }} />
              )}
              <SidebarItem icon="notifications-outline" label="Thông báo"
                onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("NotificationSettings"), 300); }} />
              <SidebarItem icon="lock-closed-outline" label="Quyền riêng tư"
                onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("PrivacySettings"), 300); }} />
              <SidebarItem icon="ban-outline" label="Người dùng đã chặn"
                badge={stats?.blocked}
                onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("BlockedUsers"), 300); }} />
              <SidebarItem icon="key-outline" label="Đổi mật khẩu"
                onPress={() => { closeSidebar(); setTimeout(() => navigation.navigate("ChangePassword"), 300); }} />

              <SidebarGroupTitle label="HỖ TRỢ" />
              <SidebarItem icon="help-circle-outline" label="Trung tâm trợ giúp" />
              <SidebarItem icon="warning-outline" label="Báo cáo vấn đề" />
              <SidebarItem icon="document-text-outline" label="Điều khoản sử dụng" />
              <SidebarItem icon="shield-checkmark-outline" label="Chính sách quyền riêng tư" />
              <SidebarItem icon="information-circle-outline" label="Phiên bản" sub="1.0.0" />

              {/* Logout */}
              <TouchableOpacity style={styles.sidebarLogout} onPress={() => { closeSidebar(); setTimeout(handleLogout, 300); }}>
                <Ionicons name="log-out-outline" size={20} color="#EF4444" />
                <Text style={styles.sidebarLogoutText}>Đăng xuất</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

// ─── Reusable components ────────────────
function SidebarItem({ icon, label, onPress, sub, badge, color }) {
  return (
    <TouchableOpacity style={sSidebar.menuItem} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={sSidebar.menuLeft}>
        <View style={[sSidebar.menuIcon, color ? { backgroundColor: color + "20" } : null]}>
          <Ionicons name={icon} size={18} color={color || colors.primary} />
        </View>
        <Text style={sSidebar.menuLabel}>{label}</Text>
      </View>
      <View style={sSidebar.menuRight}>
        {badge != null && badge > 0 && (
          <View style={sSidebar.menuBadge}><Text style={sSidebar.menuBadgeText}>{badge}</Text></View>
        )}
        {sub ? <Text style={sSidebar.menuSub}>{sub}</Text> : null}
        <Ionicons name="chevron-forward" size={14} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );
}

function SidebarToggle({ icon, label, value, onToggle, loading }) {
  return (
    <View style={sSidebar.menuItem}>
      <View style={sSidebar.menuLeft}>
        <View style={sSidebar.menuIcon}><Ionicons name={icon} size={18} color={colors.primary} /></View>
        <Text style={sSidebar.menuLabel}>{label}</Text>
      </View>
      <View style={sSidebar.menuRight}>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <View style={sSidebar.toggleTrack(value)}>
            <View style={sSidebar.toggleThumb(value)} />
          </View>
        )}
      </View>
    </View>
  );
}

function SidebarGroupTitle({ label }) {
  return <Text style={sSidebar.groupTitle}>{label}</Text>;
}

const sSidebar = {
  menuItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 13, paddingHorizontal: 20,
  },
  menuLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  menuIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 14, color: "#111827", fontWeight: "500" },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  menuBadge: { backgroundColor: colors.primary, borderRadius: 8, minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: "center" },
  menuBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  menuSub: { fontSize: 11, color: "#9CA3AF", maxWidth: 100 },
  groupTitle: { fontSize: 11, fontWeight: "600", color: "#9CA3AF", letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 },
  toggleTrack: (v) => ({ width: 42, height: 24, borderRadius: 12, backgroundColor: v ? "#86EFAC" : "#D1D5DB", padding: 2 }),
  toggleThumb: (v) => ({ width: 20, height: 20, borderRadius: 10, backgroundColor: v ? "#22C55E" : "#9CA3AF", alignSelf: v ? "flex-end" : "flex-start" }),
};

// ─── Styles ──────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111827" },
  headerBtn: { padding: 6, borderRadius: 8 },

  // Profile section
  profileSection: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatar: { width: 90, height: 90, borderRadius: 45 },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "700", color: colors.primary },
  avatarEditBadge: { position: "absolute", bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 4 },
  bio: { fontSize: 14, color: "#374151", marginTop: 6, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  editBtn: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary, gap: 6 },
  editBtnText: { fontSize: 13, fontWeight: "600", color: colors.primary },

  // Profile details
  detailsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10, paddingHorizontal: 16 },
  detailChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  detailText: { fontSize: 12, color: "#6B7280" },

  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#E5E7EB" },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  // Tabs
  tabsContainer: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F9FAFB" },
  tabActive: { backgroundColor: colors.primaryLight },
  tabLabel: { fontSize: 12, fontWeight: "500", color: "#9CA3AF" },
  tabLabelActive: { color: colors.primary, fontWeight: "600" },
  tabCount: { fontSize: 11, color: "#D1D5DB", fontWeight: "600" },
  tabCountActive: { color: colors.primary },

  // Grid
  gridContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12 },
  gridItem: { width: (SCREEN_WIDTH - 32) / 3, aspectRatio: 1, padding: 4 },
  gridImage: { flex: 1, borderRadius: 8, backgroundColor: "#F3F4F6" },
  gridPlaceholder: { alignItems: "center", justifyContent: "center" },
  gridOverlay: { position: "absolute", bottom: 6, left: 6, flexDirection: "row", gap: 8 },
  gridStat: { flexDirection: "row", alignItems: "center", gap: 2 },
  gridStatText: { fontSize: 11, fontWeight: "600", color: "#fff", textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  emptyTab: { alignItems: "center", paddingTop: 50, paddingBottom: 30 },
  emptyText: { fontSize: 14, color: "#9CA3AF", marginTop: 10 },

  // Sidebar
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  sidebar: { position: "absolute", right: 0, top: 0, bottom: 0, width: SCREEN_WIDTH * 0.78, backgroundColor: "#fff", borderTopLeftRadius: 20, borderBottomLeftRadius: 20, paddingHorizontal: 0 },
  sidebarTitle: { fontSize: 18, fontWeight: "700", color: "#111827", paddingHorizontal: 20, paddingBottom: 16 },
  sidebarLogout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: 20, marginTop: 20, marginBottom: 30, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: "#FEE2E2", backgroundColor: "#FFF5F5" },
  sidebarLogoutText: { fontSize: 15, fontWeight: "600", color: "#EF4444" },
});