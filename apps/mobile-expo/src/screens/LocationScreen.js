import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import api from "../services/api";
import { colors } from "../theme/colors";

const RADII = [100, 200, 500, 1000, 5000];

function formatDistance(m) {
  if (!m) return null;
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function LocationScreen() {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState(500);
  const [gpsStatus, setGpsStatus] = useState("Đang xác định vị trí...");
  const [currentLoc, setCurrentLoc] = useState(null);
  const mountedRef = useRef(true);

  useFocusEffect(useCallback(() => {
    fetchNearby();
    updateUserLocation();
  }, [radius]));

  async function updateUserLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsStatus("Chưa có quyền truy cập vị trí");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!mountedRef.current) return;
      setCurrentLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      setGpsStatus(`📍 ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}`);

      // Send location to backend
      await api.post("/location/update", {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || null,
      });
    } catch (e) {
      if (mountedRef.current) setGpsStatus("Chưa lấy được vị trí");
    }
  }

  async function fetchNearby() {
    try {
      const res = await api.get("/location/nearby", { params: { radius } });
      if (mountedRef.current) setUsers(res.data?.users || []);
    } catch (e) {}
    if (mountedRef.current) { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() {
    setRefreshing(true);
    updateUserLocation().then(() => fetchNearby());
  }

  useEffect(() => { return () => { mountedRef.current = false; }; }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>📍 Khám phá</Text>
      </View>

      {/* GPS status bar */}
      <View style={styles.gpsBar}>
        <Ionicons name={gpsStatus.includes("📍") ? "location" : "locate-outline"} size={16} color={gpsStatus.includes("📍") ? colors.primary : "#9CA3AF"} />
        <Text style={[styles.gpsText, gpsStatus.includes("📍") && { color: colors.primary }]}>{gpsStatus}</Text>
      </View>

      {/* Radius chips */}
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setLoading(true); }}>
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? r / 1000 + "km" : r + "m"}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ fontSize: 14, color: "#9CA3AF", marginTop: 12 }}>Đang tìm người xung quanh...</Text>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item, i) => item.id || String(i)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={56} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Không tìm thấy người dùng gần đây</Text>
              <Text style={styles.emptySub}>Thử tăng bán kính hoặc kéo xuống để làm mới</Text>
              <TouchableOpacity onPress={onRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Tìm lại</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.userItem}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text>
              </View>
              <View style={styles.userInfo}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.userName}>{item.name}</Text>
                  {item.is_online ? <View style={styles.onlineDot} /> : <Text style={styles.offlineText}>offline</Text>}
                </View>
                <Text style={styles.userDist}>{item.distance ? formatDistance(item.distance) : "📍 đang xác định"}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  gpsBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 6, backgroundColor: "#F9FAFB", gap: 6 },
  gpsText: { fontSize: 12, color: "#9CA3AF" },
  radiusRow: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#65676B", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 16, textAlign: "center" },
  emptySub: { fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center", lineHeight: 18 },
  retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  userItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.primary },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: "600", color: "#000" },
  onlineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  offlineText: { fontSize: 11, color: "#9CA3AF" },
  userDist: { fontSize: 13, color: "#6B7280", marginTop: 3 },
});