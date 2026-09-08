import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Circle, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useLocation } from "../contexts/LocationContext";
import { colors } from "../theme/colors";

const API_BASE = "https://timquanhday.de";
const RADII = [100, 200, 500, 1000, 5000];

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

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { currentLocation, permissionStatus, gpsStatus, refreshLocation, isLocationEnabled } = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState(500);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creatingConv, setCreatingConv] = useState(false);
  const mountedRef = useRef(true);
  const mapRef = useRef(null);

  useFocusEffect(useCallback(() => {
    if (currentLocation) fetchNearby();
    else setLoading(false);
  }, [radius, currentLocation]));

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

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  async function fetchNearby() {
    try {
      const res = await api.get("/location/nearby", { params: { radius } });
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

  const locationDisabled = permissionStatus !== "granted" || !isLocationEnabled || !currentLocation;

  const renderUserItem = ({ item }) => (
    <View style={styles.userItem}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatar}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar.startsWith("http") ? item.avatar : `${API_BASE}/uploads/${item.avatar}` }}
              style={{ width: 48, height: 48, borderRadius: 24 }} />
          ) : (
            <Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text>
          )}
        </View>
        {item.is_online ? <View style={styles.onlineDotSm} /> : null}
      </View>
      <View style={styles.userInfo}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={styles.userName}>{item.name}</Text>
          {item.is_online && <Text style={styles.onlineLabel}>🟢 Đang hoạt động</Text>}
        </View>
        <Text style={styles.userDist}>{item.distance ? formatDistance(item.distance) : "📍 đang xác định"}</Text>
      </View>
      <TouchableOpacity style={styles.chatBtn} onPress={() => handleChat(item)} disabled={creatingConv}>
        <Text style={styles.chatBtnText}>Nhắn tin</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Location disabled state ──
  if (locationDisabled) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </TouchableOpacity>
          <Text style={styles.title}>Khám phá</Text>
        </View>
        <View style={styles.locationOff}>
          <Ionicons name="location-off-outline" size={64} color="#D1D5DB" />
          <Text style={styles.locationOffTitle}>Bạn chưa bật định vị</Text>
          <Text style={styles.locationOffSub}>Bật định vị để khám phá người quanh đây</Text>
          <TouchableOpacity style={styles.enableLocBtn} onPress={refreshLocation}>
            <Text style={styles.enableLocBtnText}>Bật định vị</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Khám phá</Text>
      </View>

      {/* Map */}
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

            {/* Radius circle */}
            <Circle
              center={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}
              radius={radius}
              fillColor="rgba(37, 99, 235, 0.06)"
              strokeColor="rgba(37, 99, 235, 0.25)"
              strokeWidth={2}
            />

            {/* User avatar markers */}
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
                        style={{ width: 36, height: 36, borderRadius: 18 }} />
                    ) : (
                      <Text style={styles.markerAvatarText}>{(u.name || "?")[0].toUpperCase()}</Text>
                    )}
                  </View>
                  {u.is_online && <View style={styles.markerOnline} />}
                </View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={{ height: 240, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>Đang tải bản đồ...</Text>
          </View>
        )}

        {/* My location button */}
        {currentLocation && (
          <TouchableOpacity style={styles.myLocBtn} onPress={() => {
            mapRef.current?.animateToRegion({
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }, 300);
          }}>
            <Ionicons name="locate-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Mini card for selected marker */}
      {selectedUser && (
        <View style={[styles.miniCard, { top: insets.top + 56 }]}>
          <View style={styles.miniCardLeft}>
            <View style={styles.miniAvatar}>
              {selectedUser.avatar ? (
                <Image source={{ uri: selectedUser.avatar.startsWith("http") ? selectedUser.avatar : `${API_BASE}/uploads/${selectedUser.avatar}` }}
                  style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <Text style={styles.miniAvatarText}>{(selectedUser.name || "?")[0].toUpperCase()}</Text>
              )}
            </View>
            <View style={{ marginLeft: 12 }}>
              <Text style={styles.miniName}>{selectedUser.name}</Text>
              <Text style={styles.miniDist}>{selectedUser.distance ? formatDistance(selectedUser.distance) : ""}</Text>
              {selectedUser.is_online ? (
                <Text style={styles.miniOnline}>🟢 Đang hoạt động</Text>
              ) : selectedUser.last_seen ? (
                <Text style={styles.miniOffline}>Hoạt động {ago(selectedUser.last_seen)}</Text>
              ) : null}
            </View>
          </View>
          <TouchableOpacity style={styles.chatBtnSm} onPress={() => handleChat(selectedUser)} disabled={creatingConv}>
            <Text style={styles.chatBtnSmText}>{creatingConv ? "..." : "Nhắn tin"}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Radius chips */}
      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>📍</Text>
        {RADII.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setLoading(true); }}>
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* GPS status */}
      <View style={styles.gpsBar}>
        <Ionicons name={gpsStatus?.includes("📍") ? "location" : "locate-outline"} size={14} color={gpsStatus?.includes("📍") ? colors.primary : "#9CA3AF"} />
        <Text style={[styles.gpsText, gpsStatus?.includes("📍") && { color: colors.primary }]} numberOfLines={1}>{gpsStatus || "Đang xác định..."}</Text>
      </View>

      {/* User list */}
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Người quanh đây</Text>
        <Text style={styles.listCount}>{users.length} người</Text>
      </View>

      {loading ? (
        <View style={{ paddingTop: 20, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Chưa tìm thấy người nào trong bán kính này</Text>
              <TouchableOpacity onPress={() => { setRadius(1000); setLoading(true); }}>
                <Text style={styles.expandChip}>Thử mở rộng bán kính 1 km</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Tìm lại</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderUserItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  backBtn: { padding: 4, marginRight: 8 },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  // Location off
  locationOff: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  locationOffTitle: { fontSize: 18, fontWeight: "600", color: "#6B7280", marginTop: 16 },
  locationOffSub: { fontSize: 14, color: "#9CA3AF", marginTop: 6, textAlign: "center" },
  enableLocBtn: { marginTop: 24, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary },
  enableLocBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  // Map
  mapWrap: { height: 260, position: "relative" },
  map: { flex: 1 },
  myLocBtn: { position: "absolute", bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  // Marker
  markerWrap: { alignItems: "center", justifyContent: "center" },
  markerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", borderWidth: 2.5, borderColor: "#fff" },
  markerAvatarSelected: { borderColor: colors.primary, borderWidth: 3 },
  markerAvatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  markerOnline: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E", position: "absolute", bottom: -2, right: -2, borderWidth: 2, borderColor: "#fff" },
  // Mini card
  miniCard: { position: "absolute", left: 12, right: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 10, elevation: 6, zIndex: 10 },
  miniCardLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  miniAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  miniAvatarText: { fontSize: 18, fontWeight: "700", color: colors.primary },
  miniName: { fontSize: 15, fontWeight: "600", color: "#000" },
  miniDist: { fontSize: 13, color: "#6B7280", marginTop: 1 },
  miniOnline: { fontSize: 11, color: "#22C55E", marginTop: 1 },
  miniOffline: { fontSize: 11, color: "#9CA3AF", marginTop: 1 },
  chatBtnSm: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, marginLeft: 12 },
  chatBtnSmText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  // Radius
  radiusRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  radiusLabel: { marginRight: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginRight: 6, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#65676B", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  // GPS
  gpsBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 5, backgroundColor: "#F9FAFB", gap: 5 },
  gpsText: { fontSize: 11, color: "#9CA3AF" },
  // List
  listHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff" },
  listTitle: { fontSize: 16, fontWeight: "600", color: "#000" },
  listCount: { fontSize: 13, color: "#9CA3AF" },
  // Empty
  empty: { alignItems: "center", paddingTop: 40, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 15, fontWeight: "500", color: "#6B7280", marginTop: 16, textAlign: "center", lineHeight: 22 },
  expandChip: { marginTop: 12, color: colors.primary, fontWeight: "600", fontSize: 14 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  // User item
  userItem: { flexDirection: "row", alignItems: "center", padding: 14, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  avatarWrap: { position: "relative", marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.primary },
  onlineDotSm: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#22C55E", position: "absolute", bottom: 0, right: 0, borderWidth: 2, borderColor: "#fff" },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: "600", color: "#000" },
  onlineLabel: { fontSize: 11, color: "#22C55E" },
  userDist: { fontSize: 13, color: "#6B7280", marginTop: 3 },
  chatBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary, marginLeft: 10 },
  chatBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});