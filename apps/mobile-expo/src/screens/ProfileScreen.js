import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, ScrollView, Alert, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useLocation } from "../contexts/LocationContext";
import { colors } from "../theme/colors";
import { getSocket } from "../services/socket";

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { currentLocation, refreshLocation } = useLocation();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationToggleLoading, setLocationToggleLoading] = useState(false);
  const [sosToggleLoading, setSosToggleLoading] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchProfile();
  }, []));

  async function fetchProfile() {
    try {
      const res = await api.get("/auth/me");
      setProfile(res.data);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }

  async function toggleLocation(value) {
    setLocationToggleLoading(true);
    try {
      await api.patch("/users/location", { enabled: value });
      setProfile(prev => prev ? { ...prev, location_enabled: value } : prev);
      // Start or stop location service
      if (value) {
        refreshLocation();
      }
    } catch (e) {
      Alert.alert("Lỗi", "Không thể thay đổi cài đặt định vị");
    }
    setLocationToggleLoading(false);
  }

  async function toggleSosProvider(value) {
    setSosToggleLoading(true);
    try {
      const res = await api.put("/sos/helper/profile", {
        is_provider: true,
        is_available: value,
        service_radius: profile?.service_profile?.service_radius || 1000,
        category_ids: profile?.service_profile?.categories?.map(c => c.id) || [],
      });
      setProfile(prev => prev ? {
        ...prev,
        service_profile: {
          ...prev.service_profile,
          is_provider: true,
          is_available: value,
          ...res.data,
        },
      } : prev);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể thay đổi cài đặt hỗ trợ SOS");
    }
    setSosToggleLoading(false);
  }

  async function handleLogout() {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: logout },
    ]);
  }

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
      const token = await require("@react-native-async-storage/async-storage").default.getItem("accessToken");
      const formData = new FormData();
      formData.append("image", { uri, type: "image/jpeg", name: "avatar.jpg" });
      const uploadRes = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) { Alert.alert("Lỗi", "Không thể tải ảnh lên"); return; }
      const res = await api.patch("/users/me", { avatar: uploadData.url });
      setProfile(prev => prev ? { ...prev, avatar: uploadData.url } : prev);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể cập nhật ảnh đại diện");
    }
  }

  const p = profile;
  const sp = p?.service_profile;
  const stats = p?.stats;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfile(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          {/* Profile Header */}
          <View style={styles.headerSection}>
            <TouchableOpacity onPress={handleEditAvatar} style={styles.avatarContainer}>
              {p?.avatar ? (
                <Image source={{ uri: p.avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>{(p?.name || "?")[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <Ionicons name="camera" size={14} color="#fff" />
              </View>
            </TouchableOpacity>
            <Text style={styles.name}>{p?.name}</Text>
            <Text style={styles.email}>{p?.email}</Text>
            {p?.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}
            <TouchableOpacity style={styles.editBtn} onPress={() => navigation?.navigate("EditProfile", { profile: p })}>
              <Ionicons name="create-outline" size={16} color={colors.primary} />
              <Text style={styles.editBtnText}>Chỉnh sửa hồ sơ</Text>
            </TouchableOpacity>
          </View>

          {/* Stats row */}
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}><Text style={styles.statNumber}>{stats.posts}</Text><Text style={styles.statLabel}>Bài viết</Text></View>
              <View style={styles.statItem}><Text style={styles.statNumber}>{stats.likes}</Text><Text style={styles.statLabel}>Đã thích</Text></View>
              <View style={styles.statItem}><Text style={styles.statNumber}>{stats.saves}</Text><Text style={styles.statLabel}>Đã lưu</Text></View>
            </View>
          )}

          {/* Activity Section */}
          <Text style={styles.sectionTitle}>HOẠT ĐỘNG</Text>
          <View style={styles.section}>
            <MenuItem icon="document-text-outline" label="Bài viết của tôi" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="bookmark-outline" label="Bài viết đã lưu" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="heart-outline" label="Bài viết đã thích" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="location-outline" label="Khám phá quanh đây" onPress={() => navigation?.navigate("Explore")} />
            <MenuDivider />
            <MenuItem icon="alert-circle-outline" label="Yêu cầu SOS của tôi" onPress={() => navigation?.navigate("SOS")} badge={stats?.sos_requests} />
          </View>

          {/* SOS & Location Section */}
          <Text style={styles.sectionTitle}>SOS & ĐỊNH VỊ</Text>
          <View style={styles.section}>
            <ToggleItem
              icon="location-outline" label="Định vị" value={p?.location_enabled !== false}
              onToggle={toggleLocation} loading={locationToggleLoading}
            />
            <MenuDivider />
            <ToggleItem
              icon="hand-left-outline" label="Nhận hỗ trợ SOS" value={sp?.is_provider && sp?.is_available}
              onToggle={toggleSosProvider} loading={sosToggleLoading}
              disabled={!sp?.is_provider}
            />
            {sp?.is_provider && (
              <>
                <MenuDivider />
                <MenuItem
                  icon="settings-outline" label="Cấu hình hỗ trợ"
                  onPress={() => navigation?.navigate("SOSHelperSetup", { profile: p })}
                  sub={sp?.categories?.slice(0, 2).map(c => c.name).join(", ") + (sp?.categories?.length > 2 ? ` +${sp.categories.length - 2}` : "") + (sp?.service_radius ? ` · ${sp.service_radius >= 1000 ? sp.service_radius/1000 + "km" : sp.service_radius + "m"}` : "")}
                />
              </>
            )}
          </View>

          {/* Settings Section */}
          <Text style={styles.sectionTitle}>CÀI ĐẶT</Text>
          <View style={styles.section}>
            <MenuItem icon="notifications-outline" label="Thông báo" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="lock-closed-outline" label="Quyền riêng tư" onPress={() => {}} />
          </View>

          {/* Account Section */}
          <Text style={styles.sectionTitle}>TÀI KHOẢN</Text>
          <View style={styles.section}>
            <MenuItem icon="key-outline" label="Đổi mật khẩu" onPress={() => navigation?.navigate("ChangePassword")} />
            <MenuDivider />
            <MenuItem icon="ban-outline" label="Người dùng đã chặn" onPress={() => navigation?.navigate("BlockedUsers")} badge={stats?.blocked} />
          </View>

          {/* Help Section */}
          <Text style={styles.sectionTitle}>HỖ TRỢ</Text>
          <View style={styles.section}>
            <MenuItem icon="help-circle-outline" label="Trung tâm trợ giúp" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="warning-outline" label="Báo cáo vấn đề" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="document-text-outline" label="Điều khoản sử dụng" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="shield-checkmark-outline" label="Chính sách quyền riêng tư" onPress={() => {}} />
            <MenuDivider />
            <MenuItem icon="information-circle-outline" label="Phiên bản" sub="1.0.0" />
          </View>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#EF4444" />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

function MenuItem({ icon, label, onPress, sub, badge }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      <View style={styles.menuItemRight}>
        {badge != null && badge > 0 && (
          <View style={styles.menuBadge}><Text style={styles.menuBadgeText}>{badge}</Text></View>
        )}
        {sub ? <Text style={styles.menuSub}>{sub}</Text> : null}
        {onPress ? <Ionicons name="chevron-forward" size={16} color="#9CA3AF" /> : null}
      </View>
    </TouchableOpacity>
  );
}

function MenuDivider() {
  return <View style={styles.menuDivider} />;
}

function ToggleItem({ icon, label, value, onToggle, loading, disabled }) {
  return (
    <View style={styles.menuItem}>
      <View style={styles.menuItemLeft}>
        <View style={styles.menuIcon}>
          <Ionicons name={icon} size={20} color={colors.primary} />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
          thumbColor={value ? "#22C55E" : "#9CA3AF"}
        />
      )}
    </View>
  );
}

const Image = require("react-native").Image;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  // Header
  headerSection: { alignItems: "center", paddingVertical: 24, paddingHorizontal: 20 },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 34, fontWeight: "700", color: colors.primary },
  avatarEditBadge: { position: "absolute", bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  name: { fontSize: 22, fontWeight: "700", color: "#111827" },
  email: { fontSize: 14, color: "#6B7280", marginTop: 2 },
  bio: { fontSize: 14, color: "#374151", marginTop: 8, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },
  editBtn: { flexDirection: "row", alignItems: "center", marginTop: 14, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.primary, gap: 6 },
  editBtnText: { fontSize: 14, fontWeight: "600", color: colors.primary },
  // Stats
  statsRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 0.5, borderBottomWidth: 0.5, borderColor: "#E5E7EB", marginBottom: 8 },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "700", color: "#111827" },
  statLabel: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  // Sections
  sectionTitle: { fontSize: 12, fontWeight: "600", color: "#9CA3AF", letterSpacing: 1, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  section: { backgroundColor: "#fff", marginHorizontal: 16, borderRadius: 14, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 16 },
  menuItemLeft: { flexDirection: "row", alignItems: "center", flex: 1, gap: 12 },
  menuIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  menuLabel: { fontSize: 15, color: "#111827", fontWeight: "500" },
  menuItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuBadge: { backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: "center" },
  menuBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  menuSub: { fontSize: 12, color: "#9CA3AF", maxWidth: 120 },
  menuDivider: { height: 0.5, backgroundColor: "#E5E7EB", marginLeft: 60 },
  // Logout
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginHorizontal: 16, marginTop: 24, padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: "#FEE2E2", backgroundColor: "#FFF5F5", gap: 8 },
  logoutText: { fontSize: 16, fontWeight: "600", color: "#EF4444" },
});