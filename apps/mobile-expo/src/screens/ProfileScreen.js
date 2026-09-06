import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Cá nhân</Text></View>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || "?")[0].toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="person-outline" size={20} color={colors.primary} /></View>
          <View><Text style={styles.rowLabel}>Tên</Text><Text style={styles.rowValue}>{user?.name}</Text></View>
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <View style={styles.rowIcon}><Ionicons name="mail-outline" size={20} color={colors.primary} /></View>
          <View><Text style={styles.rowLabel}>Email</Text><Text style={styles.rowValue}>{user?.email}</Text></View>
        </View>
      </View>
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color={colors.error} />
        <Text style={styles.logoutText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  profile: { alignItems: "center", padding: 24, backgroundColor: colors.surface },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarText: { fontSize: 32, fontWeight: "700", color: colors.primary },
  name: { fontSize: 20, fontWeight: "700", color: colors.text },
  email: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  card: { backgroundColor: colors.surface, margin: 16, borderRadius: 16, padding: 4, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", padding: 16 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowLabel: { fontSize: 12, color: colors.textTertiary },
  rowValue: { fontSize: 15, fontWeight: "600", color: colors.text, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", margin: 16, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.error },
  logoutText: { color: colors.error, fontSize: 16, fontWeight: "600", marginLeft: 8 },
});