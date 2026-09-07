import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

const RADII = [100, 200, 500, 1000, 5000];
const CATEGORIES = [
  { id: "cat-sua-xe", name: "Sửa xe", icon: "construct-outline" },
  { id: "cat-cuu-ho", name: "Cứu hộ", icon: "fitness-outline" },
  { id: "cat-dien", name: "Điện", icon: "flash-outline" },
  { id: "cat-y-te", name: "Y tế", icon: "medkit-outline" },
  { id: "cat-an-ninh", name: "An ninh", icon: "shield-outline" },
  { id: "cat-van-chuyen", name: "Vận chuyển", icon: "car-outline" },
  { id: "cat-khac", name: "Khác", icon: "ellipsis-horizontal-outline" },
];

export default function SOSHelperSetupScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const initial = route.params?.profile || {};
  const sp = initial.service_profile || {};
  const [selectedCategories, setSelectedCategories] = useState(sp.categories?.map(c => c.id) || []);
  const [radius, setRadius] = useState(sp.service_radius || 1000);
  const [available, setAvailable] = useState(sp.is_available !== false);
  const [saving, setSaving] = useState(false);

  function toggleCategory(id) {
    setSelectedCategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  async function handleSave() {
    if (selectedCategories.length === 0) { Alert.alert("Chọn ít nhất 1 dịch vụ"); return; }
    setSaving(true);
    try {
      await api.put("/sos/helper/profile", {
        is_provider: true,
        is_available: available,
        service_radius: radius,
        category_ids: selectedCategories,
      });
      Alert.alert("Đã lưu", "Cấu hình hỗ trợ SOS đã được cập nhật");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể lưu cấu hình");
    }
    setSaving(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Cấu hình hỗ trợ</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveBtn}>Lưu</Text>}
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.form}>
        <Text style={styles.sectionLabel}>DỊCH VỤ HỖ TRỢ</Text>
        <Text style={styles.hint}>Chọn một hoặc nhiều dịch vụ bạn có thể hỗ trợ</Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(c => {
            const active = selectedCategories.includes(c.id);
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => toggleCategory(c.id)}
              >
                <Ionicons name={c.icon} size={20} color={active ? "#fff" : colors.primary} />
                <Text style={[styles.catText, active && styles.catTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>BÁN KÍNH HỖ TRỢ</Text>
        <View style={styles.radiusRow}>
          {RADII.map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.chip, radius === r && styles.chipActive]}
              onPress={() => setRadius(r)}
            >
              <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>
                {r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>TRẠNG THÁI</Text>
        <TouchableOpacity style={styles.availRow} onPress={() => setAvailable(!available)}>
          <Text style={styles.availIcon}>{available ? "🟢" : "⚪"}</Text>
          <Text style={styles.availText}>{available ? "Đang nhận SOS" : "Tạm ngưng"}</Text>
        </TouchableOpacity>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.saveBigBtn} onPress={handleSave} disabled={saving || selectedCategories.length === 0}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBigText}>LƯU CÀI ĐẶT</Text>}
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
  saveBtn: { fontSize: 16, fontWeight: "700", color: colors.primary },
  form: { padding: 20, paddingBottom: 100 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#9CA3AF", letterSpacing: 1, marginBottom: 6, marginTop: 20 },
  hint: { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: "#F3F4F6", gap: 6, borderWidth: 1, borderColor: "transparent" },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catText: { fontSize: 14, color: colors.primary, fontWeight: "500" },
  catTextActive: { color: "#fff" },
  radiusRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 14, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  availRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  availIcon: { fontSize: 20 },
  availText: { fontSize: 15, fontWeight: "600", color: "#111827" },
  footer: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  saveBigBtn: { backgroundColor: colors.primary, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  saveBigText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});