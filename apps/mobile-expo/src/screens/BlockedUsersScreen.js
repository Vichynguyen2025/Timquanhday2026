import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

export default function BlockedUsersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { fetchBlocked(); }, []));

  async function fetchBlocked() {
    try {
      const res = await api.get("/users/blocked");
      setUsers(res.data || []);
    } catch (e) {}
    setLoading(false); setRefreshing(false);
  }

  async function unblock(userId, userName) {
    Alert.alert("Bỏ chặn", `Bỏ chặn ${userName}?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Bỏ chặn", onPress: async () => {
        try { await api.post(`/users/${userId}/unblock`); fetchBlocked(); }
        catch (e) { Alert.alert("Lỗi", "Không thể bỏ chặn"); }
      }},
    ]);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Người đã chặn</Text>
        <View style={{ width: 32 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBlocked(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingTop: 40 }}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#D1D5DB" />
              <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 }}>Bạn chưa chặn ai</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.userItem}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || "?")[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1 }}><Text style={styles.userName}>{item.name}</Text></View>
              <TouchableOpacity style={styles.unblockBtn} onPress={() => unblock(item.id, item.name)}>
                <Text style={styles.unblockText}>Bỏ chặn</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  userItem: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: "#fff", borderRadius: 12, marginBottom: 8, borderWidth: 0.5, borderColor: "#E5E7EB", gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  userName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: "#D1D5DB" },
  unblockText: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
});