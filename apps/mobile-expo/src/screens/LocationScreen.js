import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import { colors } from "../theme/colors";

const RADII = [100, 200, 500, 1000, 5000];

export default function LocationScreen() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(500);

  useFocusEffect(useCallback(() => { fetchNearby(); }, [radius]));

  async function fetchNearby() {
    try {
      const res = await api.get("/location/nearby", { params: { radius } });
      setUsers(res.data);
    } catch (e) {}
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Vị trí</Text></View>
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setLoading(true); }}>
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? r / 1000 + "km" : r + "m"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={users}
          keyExtractor={(item, i) => item.id || String(i)}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="map-outline" size={50} color={colors.textTertiary} /><Text style={styles.emptyText}>Không tìm thấy người dùng gần đây</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.userItem}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text></View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userDist}>{item.distance ? Math.round(item.distance) + "m" : ""}</Text>
              </View>
              {item.is_online ? <View style={styles.onlineDot} /> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  radiusRow: { flexDirection: "row", padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
  userItem: { flexDirection: "row", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border + "50", backgroundColor: colors.surface },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "700", color: colors.primary },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 15, fontWeight: "600", color: colors.text },
  userDist: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  onlineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.online, borderWidth: 2, borderColor: "#fff" },
});