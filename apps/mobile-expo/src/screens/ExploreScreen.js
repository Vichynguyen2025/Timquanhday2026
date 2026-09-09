import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  RefreshControl, Image, Alert, TextInput, Modal, ScrollView, Switch, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Circle, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useLocation } from "../contexts/LocationContext";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

const API_BASE = "https://timquanhday.de";
const RADII = [100, 200, 500, 1000, 5000];

// ─── Filter data ────────────────────────────
const GENDER_OPTIONS = [
  { value: "", label: "Tất cả", icon: "people" },
  { value: "Nam", label: "Nam", icon: "man" },
  { value: "Nữ", label: "Nữ", icon: "woman" },
  { value: "LGBT", label: "LGBT", icon: "male-female" },
];

const OCCUPATION_OPTIONS = [
  "", "Học sinh", "Sinh viên", "Nhân viên văn phòng", "Kỹ sư",
  "Giáo viên", "Bác sĩ", "Lập trình viên", "Thiết kế", "Kinh doanh",
  "Nghệ sĩ", "Đầu bếp", "Tài xế", "Công nhân", "Hưu trí", "Khác",
];

const SCHOOL_OPTIONS = [
  "", "Đại học Bách khoa Hà Nội", "Đại học Bách khoa TP.HCM",
  "Đại học Công nghệ - ĐHQG HN", "Đại học Kinh tế Quốc dân",
  "Đại học Ngoại thương", "Đại học FPT", "Đại học RMIT",
  "Đại học Sư phạm HN", "Đại học Y Hà Nội", "Đại học Luật HN",
  "Học viện Ngân hàng", "Đại học Thương mại",
  "Đại học Kiến trúc HN", "Đại học Xây dựng",
  "Đại học Giao thông Vận tải", "Học viện Nông nghiệp",
  "Cao đẳng", "Trung cấp chuyên nghiệp", "Không",
];

function formatDistance(m) {
  if (!m) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function ago(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 172800) return "Hôm qua";
  return `${Math.floor(diff / 86400)} ngày trước`;
}

// ─── Filter Modal ────────────────────────────
function FilterModal({ visible, filters, onApply, onClose }) {
  const [gender, setGender] = useState(filters.gender);
  const [occupation, setOccupation] = useState(filters.occupation);
  const [school, setSchool] = useState(filters.school);

  useEffect(() => {
    setGender(filters.gender);
    setOccupation(filters.occupation);
    setSchool(filters.school);
  }, [filters]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={sFilter.overlay}>
        <View style={sFilter.container}>
          <View style={sFilter.header}>
            <TouchableOpacity onPress={() => { setGender(""); setOccupation(""); setSchool(""); }}>
              <Text style={sFilter.resetBtn}>Đặt lại</Text>
            </TouchableOpacity>
            <Text style={sFilter.title}>Bộ lọc</Text>
            <TouchableOpacity onPress={() => onApply({ gender, occupation, school })}>
              <Text style={sFilter.applyBtn}>Áp dụng</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={sFilter.body} showsVerticalScrollIndicator={false}>
            {/* Gender */}
            <Text style={sFilter.sectionTitle}>Giới tính</Text>
            <View style={sFilter.chipRow}>
              {GENDER_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[sFilter.chip, gender === o.value && sFilter.chipActive]}
                  onPress={() => setGender(gender === o.value ? "" : o.value)}
                >
                  <Ionicons name={o.icon} size={14} color={gender === o.value ? "#fff" : "#6B7280"} />
                  <Text style={[sFilter.chipText, gender === o.value && sFilter.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Occupation */}
            <Text style={sFilter.sectionTitle}>Nghề nghiệp</Text>
            <View style={sFilter.chipRow}>
              {OCCUPATION_OPTIONS.slice(0, 8).map(o => (
                <TouchableOpacity
                  key={o}
                  style={[sFilter.chip, occupation === o && sFilter.chipActive]}
                  onPress={() => setOccupation(occupation === o ? "" : o)}
                >
                  <Text style={[sFilter.chipText, occupation === o && sFilter.chipTextActive]}>
                    {o || "Tất cả"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {occupation && !OCCUPATION_OPTIONS.slice(0, 8).includes(occupation) ? null : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
              {OCCUPATION_OPTIONS.slice(8).map(o => (
                <TouchableOpacity
                  key={o}
                  style={[sFilter.chip, occupation === o && sFilter.chipActive, { marginRight: 6 }]}
                  onPress={() => setOccupation(occupation === o ? "" : o)}
                >
                  <Text style={[sFilter.chipText, occupation === o && sFilter.chipTextActive]}>
                    {o || "Tất cả"}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* School */}
            <Text style={sFilter.sectionTitle}>Trường học</Text>
            <View style={sFilter.chipRow}>
              {SCHOOL_OPTIONS.slice(0, 6).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[sFilter.chip, school === s && sFilter.chipActive]}
                  onPress={() => setSchool(school === s ? "" : s)}
                >
                  <Text style={[sFilter.chipText, school === s && sFilter.chipTextActive]}>
                    {s ? (s.length > 20 ? s.substring(0, 18) + "…" : s) : "Tất cả"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {SCHOOL_OPTIONS.slice(6).length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
                {SCHOOL_OPTIONS.slice(6).map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[sFilter.chip, school === s && sFilter.chipActive, { marginRight: 6 }]}
                    onPress={() => setSchool(school === s ? "" : s)}
                  >
                    <Text style={[sFilter.chipText, school === s && sFilter.chipTextActive]}>
                      {s ? (s.length > 22 ? s.substring(0, 20) + "…" : s) : "Tất cả"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── ExploreScreen ──────────────────────────
export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { currentLocation, permissionStatus, refreshLocation, isLocationEnabled } = useLocation();
  const { user, setUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState(500);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creatingConv, setCreatingConv] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filters, setFilters] = useState({ gender: "", occupation: "", school: "" });
  const [visibleOnMap, setVisibleOnMap] = useState(user?.visible_on_map !== false);
  const mountedRef = useRef(true);
  const mapRef = useRef(null);

  useFocusEffect(useCallback(() => {
    if (currentLocation) fetchNearby();
    else setLoading(false);
  }, [radius, currentLocation, filters, searchQuery]));

  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  }, [currentLocation]);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  async function fetchNearby() {
    try {
      const params = { radius };
      if (filters.gender) params.gender = filters.gender;
      if (filters.occupation) params.occupation = filters.occupation;
      if (filters.school) params.school = filters.school;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const res = await api.get("/location/nearby", { params });
      if (mountedRef.current) setUsers(res.data?.users || []);
    } catch (e) {}
    if (mountedRef.current) { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() {
    setRefreshing(true);
    fetchNearby();
  }

  async function handleChat(targetUser) {
    setCreatingConv(true);
    try {
      const res = await api.post("/conversations", { userId: targetUser.id });
      const convId = res.data?.id;
      if (convId) {
        navigation.navigate("ChatDetail", { conversationId: convId, name: targetUser.name });
      }
    } catch (e) {
      Alert.alert("Lỗi", "Không thể tạo cuộc trò chuyện");
    }
    setCreatingConv(false);
    setSelectedUser(null);
  }

  async function toggleVisible(value) {
    setVisibleOnMap(value);
    try {
      await api.patch("/users/me", { visible_on_map: value });
      if (setUser) setUser(prev => prev ? { ...prev, visible_on_map: value } : prev);
    } catch (e) {
      setVisibleOnMap(!value);
    }
  }

  function handleApplyFilter(newFilters) {
    setFilters(newFilters);
    setFilterVisible(false);
    setLoading(true);
  }

  const locationDisabled = permissionStatus !== "granted" || !isLocationEnabled || !currentLocation;
  const activeFilterCount = [filters.gender, filters.occupation, filters.school].filter(Boolean).length;

  // ─── Render User Item ─────────────────────
  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      style={styles.userCard}
      activeOpacity={0.7}
      onPress={() => setSelectedUser(selectedUser?.id === item.id ? null : item)}
    >
      <View style={styles.userCardLeft}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar.startsWith("http") ? item.avatar : `${API_BASE}/uploads/${item.avatar}` }}
                style={{ width: 52, height: 52, borderRadius: 26 }} />
            ) : (
              <Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text>
            )}
          </View>
          {item.is_online ? <View style={styles.onlineDot} /> : null}
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{item.name}</Text>
            {item.is_online ? <View style={styles.onlineBadge}><Text style={styles.onlineBadgeText}>● Online</Text></View> : null}
          </View>
          <View style={styles.userMetaRow}>
            <Ionicons name="navigate" size={12} color="#9CA3AF" />
            <Text style={styles.userDist}>{item.distance ? formatDistance(item.distance) : "?"}</Text>
            {item.gender && (
              <>
                <View style={styles.metaDot} />
                <Ionicons name="person" size={12} color="#9CA3AF" />
                <Text style={styles.userMeta}>{item.gender}</Text>
              </>
            )}
            {item.occupation && (
              <>
                <View style={styles.metaDot} />
                <Ionicons name="briefcase" size={12} color="#9CA3AF" />
                <Text style={styles.userMeta}>{item.occupation.length > 12 ? item.occupation.substring(0, 10) + "…" : item.occupation}</Text>
              </>
            )}
          </View>
          {item.bio ? <Text style={styles.userBio} numberOfLines={1}>{item.bio}</Text> : null}
        </View>
      </View>
      <TouchableOpacity style={styles.chatBtn} onPress={() => handleChat(item)} disabled={creatingConv}>
        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // ─── Location disabled state ──
  if (locationDisabled) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.title}>Khám phá</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.centerState}>
          <View style={styles.centerIconWrap}>
            <Ionicons name="location-off" size={40} color="#6B7280" />
          </View>
          <Text style={styles.centerTitle}>Bạn chưa bật định vị</Text>
          <Text style={styles.centerSub}>Bật định vị để khám phá người quanh đây</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={refreshLocation}>
            <Ionicons name="location" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>Bật định vị</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ─── Header ──────────────────────── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { if (navigation.canGoBack()) navigation.goBack(); else navigation.navigate("Home"); }} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Khám phá</Text>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setFilterVisible(true)}>
          <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? colors.primary : "#6B7280"} />
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeFilterCount}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      {/* ─── Search Bar ──────────────────── */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm theo tên, nghề nghiệp, trường học..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          onSubmitEditing={fetchNearby}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchQuery(""); }}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* ─── Map ─────────────────────────── */}
      <View style={styles.mapWrap}>
        {currentLocation ? (
          <MapView ref={mapRef} style={styles.map} provider={PROVIDER_DEFAULT}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            showsUserLocation showsMyLocationButton={false}
          >
            <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />

            <Circle
              center={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}
              radius={radius}
              fillColor="rgba(37, 99, 235, 0.05)"
              strokeColor="rgba(37, 99, 235, 0.2)"
              strokeWidth={1.5}
            />

            {users.filter(u => u.lat != null && u.lng != null).map(u => (
              <Marker
                key={u.id}
                coordinate={{ latitude: parseFloat(u.lat), longitude: parseFloat(u.lng) }}
                onPress={() => setSelectedUser(selectedUser?.id === u.id ? null : u)}
              >
                <View style={styles.markerWrap}>
                  <View style={[styles.markerAvatar, selectedUser?.id === u.id && styles.markerAvatarSelected]}>
                    {u.avatar ? (
                      <Image source={{ uri: u.avatar.startsWith("http") ? u.avatar : `${API_BASE}/uploads/${u.avatar}` }}
                        style={{ width: 32, height: 32, borderRadius: 16 }} />
                    ) : (
                      <Text style={styles.markerText}>{(u.name || "?")[0].toUpperCase()}</Text>
                    )}
                  </View>
                  {u.is_online ? <View style={styles.markerOnline} /> : null}
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={[styles.map, { backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}

        <TouchableOpacity style={styles.myLocBtn} onPress={() => {
          if (currentLocation) mapRef.current?.animateToRegion({
            latitude: currentLocation.latitude, longitude: currentLocation.longitude,
            latitudeDelta: 0.02, longitudeDelta: 0.02,
          }, 300);
        }}>
          <Ionicons name="locate" size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* ─── Radius + Visibility Row ──────── */}
      <View style={styles.controlRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
          {RADII.map(r => (
            <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]}
              onPress={() => { setRadius(r); setLoading(true); }}>
              <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {selectedUser ? (
          <TouchableOpacity style={styles.miniCardClose} onPress={() => setSelectedUser(null)}>
            <Ionicons name="close" size={18} color="#6B7280" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* ─── Mini Card ───────────────────── */}
      {selectedUser && (
        <View style={styles.miniCard}>
          <View style={styles.miniCardLeft}>
            <View style={styles.miniAvatar}>
              {selectedUser.avatar ? (
                <Image source={{ uri: selectedUser.avatar.startsWith("http") ? selectedUser.avatar : `${API_BASE}/uploads/${selectedUser.avatar}` }}
                  style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <Text style={styles.miniAvatarText}>{(selectedUser.name || "?")[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={{ marginLeft: 12, flex: 1 }}>
              <Text style={styles.miniName}>{selectedUser.name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="navigate" size={12} color="#9CA3AF" />
                <Text style={styles.miniDist}>{selectedUser.distance ? formatDistance(selectedUser.distance) : ""}</Text>
                {selectedUser.is_online ? (
                  <Text style={styles.miniOnline}>  ● Online</Text>
                ) : null}
              </View>
              {selectedUser.occupation ? (
                <Text style={styles.miniMeta}>{selectedUser.gender ? `${selectedUser.gender} · ` : ""}{selectedUser.occupation}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity style={styles.chatBtnSm} onPress={() => handleChat(selectedUser)} disabled={creatingConv}>
            <Ionicons name="chatbubble-ellipses" size={15} color="#fff" />
            <Text style={styles.chatBtnSmText}>  Nhắn tin</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ─── User List ────────────────────── */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Người quanh đây</Text>
        <Text style={styles.listCount}>{users.length} người</Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 24, alignItems: "center" }}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="search-outline" size={32} color="#6B7280" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery || activeFilterCount > 0
                  ? "Không tìm thấy kết quả phù hợp"
                  : "Chưa có người nào trong khu vực"}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery || activeFilterCount > 0
                  ? "Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
                  : "Thử mở rộng bán kính tìm kiếm"}
              </Text>
              <TouchableOpacity style={styles.emptyCta} onPress={() => { setRadius(1000); setLoading(true); }}>
                <Text style={styles.emptyCtaText}>Mở rộng lên 1 km</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderUserItem}
        />
      )}

      {/* ─── Visibility Toggle ────────────── */}
      <View style={[styles.visibilityBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.visibilityLeft}>
          <Ionicons name={visibleOnMap ? "eye" : "eye-off"} size={18} color={visibleOnMap ? "#22C55E" : "#9CA3AF"} />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.visibilityLabel}>Hiển thị trên bản đồ</Text>
            <Text style={styles.visibilitySub}>
              {visibleOnMap ? "Mọi người có thể thấy bạn quanh đây" : "Bạn đang ẩn khỏi bản đồ"}
            </Text>
          </View>
        </View>
        <Switch
          value={visibleOnMap}
          onValueChange={toggleVisible}
          trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
          thumbColor={visibleOnMap ? "#22C55E" : "#9CA3AF"}
        />
      </View>

      {/* ─── Filter Modal ────────────────── */}
      <FilterModal
        visible={filterVisible}
        filters={filters}
        onApply={handleApplyFilter}
        onClose={() => setFilterVisible(false)}
      />
    </View>
  );
}

// ─── Styles ──────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  filterBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", position: "relative" },
  filterBadge: { position: "absolute", top: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  filterBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },

  // Search
  searchWrap: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 12, marginBottom: 8,
    backgroundColor: "#F3F4F6", borderRadius: 10,
    paddingHorizontal: 12, height: 38,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },

  // Map
  mapWrap: { height: 220, position: "relative" },
  map: { flex: 1 },
  myLocBtn: { position: "absolute", bottom: 12, right: 12, width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },

  // Control row
  controlRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6",
  },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14, marginRight: 6, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },

  // Marker
  markerWrap: { alignItems: "center", justifyContent: "center" },
  markerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  markerAvatarSelected: { borderColor: colors.primary, borderWidth: 2.5 },
  markerText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  markerOnline: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E", position: "absolute", bottom: -1, right: -1, borderWidth: 2, borderColor: "#fff" },
  miniCardClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  // Mini card
  miniCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginHorizontal: 12, marginTop: 4, marginBottom: 2,
    backgroundColor: "#fff", borderRadius: 12, padding: 12,
    borderWidth: 0.5, borderColor: "#E5E7EB",
  },
  miniCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  miniAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontSize: 18, fontWeight: "700", color: colors.primary },
  miniName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  miniDist: { fontSize: 12, color: "#6B7280" },
  miniOnline: { fontSize: 11, color: "#22C55E" },
  miniMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  chatBtnSm: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.primary, marginLeft: 10 },
  chatBtnSmText: { color: "#fff", fontWeight: "600", fontSize: 12 },

  // List
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10 },
  listTitle: { fontSize: 15, fontWeight: "600", color: "#111827" },
  listCount: { fontSize: 12, color: "#9CA3AF" },

  // User card
  userCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6",
  },
  userCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "700", color: colors.primary },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E", position: "absolute", bottom: 0, right: 0, borderWidth: 2, borderColor: "#fff" },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  userName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  onlineBadge: { backgroundColor: "#F0FDF4", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  onlineBadgeText: { fontSize: 10, color: "#22C55E", fontWeight: "600" },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4, flexWrap: "wrap" },
  userDist: { fontSize: 12, color: "#6B7280" },
  userMeta: { fontSize: 12, color: "#6B7280" },
  metaDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: "#D1D5DB", marginHorizontal: 2 },
  userBio: { fontSize: 12, color: "#9CA3AF", marginTop: 3 },
  chatBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 8 },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "600", color: "#6B7280", marginTop: 16, textAlign: "center" },
  emptySub: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center", lineHeight: 18 },
  emptyCta: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary },
  emptyCtaText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  // Location off state
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  centerIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  centerTitle: { fontSize: 17, fontWeight: "600", color: "#6B7280", marginTop: 16 },
  centerSub: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center", lineHeight: 18 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 24, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.primary },
  primaryBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  // Visibility bar
  visibilityBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: 0.5, borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  visibilityLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  visibilityLabel: { fontSize: 14, fontWeight: "500", color: "#111827" },
  visibilitySub: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
});

// ─── Filter Modal Styles ─────────────────────
const sFilter = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  container: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75%" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  resetBtn: { fontSize: 14, fontWeight: "500", color: "#9CA3AF" },
  title: { fontSize: 17, fontWeight: "700", color: "#111827" },
  applyBtn: { fontSize: 15, fontWeight: "700", color: colors.primary },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 10, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6", marginBottom: 6 },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
});