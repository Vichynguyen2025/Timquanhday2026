import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";

export default function EditProfileScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initial = route.params?.profile || {};
  const [name, setName] = useState(initial.name || "");
  const [bio, setBio] = useState(initial.bio || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) { Alert.alert("Vui lòng nhập tên"); return; }
    setSaving(true);
    try {
      await api.patch("/users/me", { name: name.trim(), bio: bio.trim() });
      Alert.alert("Đã lưu", "Hồ sơ đã được cập nhật");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể lưu thông tin");
    }
    setSaving(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Chỉnh sửa hồ sơ</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveBtn}>Lưu</Text>}
        </TouchableOpacity>
      </View>
      <View style={styles.form}>
        <Text style={styles.label}>Tên hiển thị</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Tên của bạn" placeholderTextColor="#9CA3AF" maxLength={100} />
        <Text style={styles.label}>Giới thiệu</Text>
        <TextInput style={[styles.input, styles.bioInput]} value={bio} onChangeText={setBio} placeholder="Vài dòng giới thiệu về bạn..." placeholderTextColor="#9CA3AF" multiline maxLength={500} />
        <Text style={styles.hint}>{bio.length}/500</Text>
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
  bioInput: { minHeight: 120, textAlignVertical: "top", lineHeight: 20 },
  hint: { fontSize: 11, color: "#9CA3AF", textAlign: "right", marginTop: 4 },
});