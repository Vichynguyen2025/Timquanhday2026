import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

export default function ChangePasswordScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!current) { Alert.alert("Nhập mật khẩu hiện tại"); return; }
    if (!newPw || newPw.length < 6) { Alert.alert("Mật khẩu mới phải có ít nhất 6 ký tự"); return; }
    if (newPw !== confirm) { Alert.alert("Mật khẩu xác nhận không khớp"); return; }
    setSaving(true);
    try {
      await api.post("/users/change-password", { currentPassword: current, newPassword: newPw });
      Alert.alert("Đã đổi mật khẩu", "Vui lòng đăng nhập lại");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Lỗi", e?.response?.data?.error || "Không thể đổi mật khẩu");
    }
    setSaving(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Đổi mật khẩu</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveBtn}>Lưu</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Mật khẩu hiện tại</Text>
        <TextInput style={styles.input} value={current} onChangeText={setCurrent} placeholder="••••••••" secureTextEntry />
        <Text style={styles.label}>Mật khẩu mới</Text>
        <TextInput style={styles.input} value={newPw} onChangeText={setNewPw} placeholder="Ít nhất 6 ký tự" secureTextEntry />
        <Text style={styles.label}>Xác nhận mật khẩu mới</Text>
        <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} placeholder="Nhập lại mật khẩu mới" secureTextEntry />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  saveBtn: { fontSize: 16, fontWeight: "700", color: colors.primary },
  form: { padding: 20 },
  label: { fontSize: 13, fontWeight: "600", color: "#6B7280", marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, fontSize: 15, color: "#111827" },
});