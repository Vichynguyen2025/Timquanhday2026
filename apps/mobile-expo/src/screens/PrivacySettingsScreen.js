import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

export default function PrivacySettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Quyền riêng tư</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.list}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate("BlockedUsers")}>
          <View style={styles.iconWrap}><Ionicons name="ban-outline" size={20} color={colors.primary} /></View>
          <Text style={styles.label}>Người dùng đã chặn</Text>
          <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => {}}>
          <View style={styles.iconWrap}><Ionicons name="eye-off-outline" size={20} color={colors.primary} /></View>
          <Text style={styles.label}>Hiển thị trạng thái hoạt động</Text>
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.row} onPress={() => {}}>
          <View style={styles.iconWrap}><Ionicons name="location-outline" size={20} color={colors.primary} /></View>
          <Text style={styles.label}>Chia sẻ vị trí</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  list: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: 14, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "600", color: "#111827", flex: 1 },
  divider: { height: 0.5, backgroundColor: "#E5E7EB", marginLeft: 64 },
});