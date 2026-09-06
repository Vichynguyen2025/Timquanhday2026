import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, Alert, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

const URGENCIES = [
  { value: "URGENT", label: "🔴 Cần ngay", color: "#EF4444" },
  { value: "TODAY", label: "🟠 Trong hôm nay", color: "#F97316" },
  { value: "SCHEDULED", label: "🟢 Có thể hẹn", color: "#22C55E" },
];

function formatTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  return new Date(d).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDistance(m) {
  if (!m) return null;
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ─── SOS Card ─────────────────────────────────────
function SOSCard({ item, onRespond, onPress }) {
  const urgencyConfig = URGENCIES.find(u => u.value === item.urgency) || URGENCIES[1];
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onPress?.(item)}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.cardAvatar}>
          <Text style={styles.cardAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardUserName}>{item.user_name || "Người dùng"}</Text>
          <Text style={styles.cardTime}>{formatTime(item.created_at)}</Text>
        </View>
        {item.distance != null && (
          <Text style={styles.cardDistance}>📍 {formatDistance(item.distance)}</Text>
        )}
      </View>

      {/* Category badge */}
      <View style={styles.cardCategory}>
        <Ionicons name={item.category_icon || "help-outline"} size={16} color={colors.primary} />
        <Text style={styles.cardCategoryText}>{item.category_name || "Yêu cầu"}</Text>
      </View>

      {/* Description */}
      <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>

      {/* Urgency + Radius */}
      <View style={styles.cardMeta}>
        <Text style={[styles.cardUrgency, { color: urgencyConfig.color }]}>{urgencyConfig.label}</Text>
        <Text style={styles.cardRadius}>🎯 {(item.radius || 1000) >= 1000 ? `${(item.radius || 1000) / 1000}km` : `${item.radius || 1000}m`}</Text>
      </View>

      {/* Media */}
      {item.media?.length > 0 && (
        <View style={styles.cardMediaRow}>
          {item.media.slice(0, 3).map((m, i) => (
            <Image key={i} source={{ uri: m.url }} style={styles.cardMediaThumb} />
          ))}
          {item.media.length > 3 && <Text style={styles.cardMediaMore}>+{item.media.length - 3}</Text>}
        </View>
      )}

      {/* Response count */}
      <Text style={styles.cardResponses}>{item.response_count || 0} người đã phản hồi</Text>

      {/* Action button */}
      {!item.is_owner && item.status === "OPEN" && !item.has_responded && (
        <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond?.(item)}>
          <Text style={styles.respondText}>TÔI CÓ THỂ HỖ TRỢ</Text>
        </TouchableOpacity>
      )}
      {item.has_responded && (
        <Text style={styles.respondedText}>✅ Đã phản hồi</Text>
      )}
      {item.is_owner && (
        <View style={styles.ownerBadge}>
          <Text style={styles.ownerBadgeText}>Yêu cầu của bạn</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Create SOS Modal ─────────────────────────────
function CreateSOSModal({ visible, onClose, onSubmit }) {
  const [categoryId, setCategoryId] = useState(null);
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState(1000);
  const [urgency, setUrgency] = useState("URGENT");
  const [capturedImages, setCapturedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  async function captureImage() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Cần quyền camera"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    // Convert HEIC → JPEG
    const manip = await ImageManipulator.manipulateAsync(asset.uri,
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setCapturedImages(prev => [...prev, manip]);
  }

  function removeImage(idx) {
    setCapturedImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!description.trim()) { Alert.alert("Nhập mô tả"); return; }
    if (capturedImages.length === 0) { Alert.alert("Chụp ít nhất 1 ảnh"); return; }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("accessToken");
      const loc = await Location.getCurrentPositionAsync({});
      const media = [];
      for (const img of capturedImages) {
        const formData = new FormData();
        formData.append("image", { uri: img.uri, type: "image/jpeg", name: "sos.jpg" });
        const uploadRes = await fetch("https://timquanhday.de/api/upload/image", {
          method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
        });
        const uploadData = await uploadRes.json();
        media.push({
          url: uploadData.url,
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          locationName: "Vị trí hiện tại",
          capturedAt: new Date().toISOString(),
        });
      }
      await api.post("/sos", {
        categoryId, description: description.trim(),
        lat: loc.coords.latitude, lng: loc.coords.longitude,
        locationName: "Vị trí hiện tại",
        radius, urgency, media,
      });
      Alert.alert("Đã gửi", "Yêu cầu SOS của bạn đã được gửi!");
      onSubmit?.();
      onClose();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể gửi yêu cầu");
    }
    setSubmitting(false);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
        <View style={styles.createSheet}>
          <View style={styles.createHandle} />
          <Text style={styles.createTitle}>Tạo yêu cầu SOS</Text>
          <View style={{ padding: 16, flex: 1 }}>
            {/* Category */}
            <Text style={styles.label}>Danh mục</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map(c => (
                <TouchableOpacity key={c.id} style={[styles.catChip, categoryId === c.id && styles.catChipActive]} onPress={() => setCategoryId(c.id)}>
                  <Ionicons name={c.icon} size={16} color={categoryId === c.id ? "#fff" : colors.primary} />
                  <Text style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Camera */}
            <Text style={styles.label}>Ảnh hiện trường (tối đa 3 ảnh)</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {capturedImages.map((img, i) => (
                <View key={i} style={{ position: "relative" }}>
                  <Image source={{ uri: img.uri }} style={{ width: 80, height: 80, borderRadius: 8 }} />
                  <TouchableOpacity onPress={() => removeImage(i)} style={{ position: "absolute", top: -4, right: -4, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {capturedImages.length < 3 && (
                <TouchableOpacity onPress={captureImage} style={styles.cameraBtn}>
                  <Ionicons name="camera-outline" size={28} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Description */}
            <TextInput
              style={styles.descInput}
              placeholder="Mô tả chi tiết..."
              placeholderTextColor="#8A8D91"
              value={description}
              onChangeText={setDescription}
              multiline
            />

            {/* Radius */}
            <Text style={styles.label}>Bán kính</Text>
            <View style={styles.radiusRow}>
              {RADII.map(r => (
                <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => setRadius(r)}>
                  <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Urgency */}
            <Text style={styles.label}>Mức độ</Text>
            <View style={styles.urgencyRow}>
              {URGENCIES.map(u => (
                <TouchableOpacity key={u.value} style={[styles.urgencyChip, urgency === u.value && { backgroundColor: u.color, borderColor: u.color }]} onPress={() => setUrgency(u.value)}>
                  <Text style={[styles.urgencyText, urgency === u.value && { color: "#fff" }]}>{u.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.5 }]}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Gửi yêu cầu SOS</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main SOS Screen ──────────────────────────────
export default function SOSScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("radar"); // radar | sos
  const [sosList, setSosList] = useState([]);
  const [mySos, setMySos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(1000);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchSOS();
    const socket = getSocket();
    if (!socket) return;
    const onNew = (sos) => { setSosList(prev => { if (prev.find(s => s.id === sos.id)) return prev; return [sos, ...prev]; }); };
    const onUpdated = (sos) => { setSosList(prev => prev.map(s => s.id === sos.id ? sos : s)); setMySos(prev => prev.map(s => s.id === sos.id ? sos : s)); };
    const onCancelled = ({ sosId }) => { setSosList(prev => prev.filter(s => s.id !== sosId)); };
    socket.on("sos:new", onNew); socket.on("sos:updated", onUpdated); socket.on("sos:cancelled", onCancelled);
    return () => { socket.off("sos:new", onNew); socket.off("sos:updated", onUpdated); socket.off("sos:cancelled", onCancelled); };
  }, [radius]));

  async function fetchSOS() {
    setLoading(true);
    try {
      const [radarRes, mineRes] = await Promise.all([
        api.get("/sos", { params: { radius } }),
        api.get("/sos/mine"),
      ]);
      setSosList(radarRes.data?.sos || []);
      setMySos(mineRes.data?.sos || []);
    } catch (e) {}
    setLoading(false); setRefreshing(false);
  }

  async function respondToSOS(item) {
    Alert.alert("Hỗ trợ?", "Bạn có thể hỗ trợ yêu cầu này?", [
      { text: "Huỷ", style: "cancel" },
      { text: "TÔI CÓ THỂ HỖ TRỢ", onPress: async () => {
        try {
          await api.post(`/sos/${item.id}/response`, { message: "Tôi có thể hỗ trợ!" });
          Alert.alert("Đã phản hồi", "Người gửi sẽ được thông báo.");
          fetchSOS();
        } catch (e) { Alert.alert("Lỗi", "Không thể phản hồi"); }
      }},
    ]);
  }

  function openSOSDetail(item) {
    Alert.alert("Chi tiết SOS", `${item.description}\n\n📍 ${item.location_name || ""}\n📏 ${formatDistance(item.distance)}`, [
      { text: "Đóng", style: "cancel" },
    ]);
  }

  const data = tab === "radar" ? sosList : mySos;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🆘 SOS</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.headerCreateBtn}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={[styles.tab, tab === "radar" && styles.tabActive]} onPress={() => setTab("radar")}>
          <Ionicons name="map-outline" size={18} color={tab === "radar" ? "#fff" : "#65676B"} />
          <Text style={[styles.tabText, tab === "radar" && styles.tabTextActive]}>Bản đồ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "sos" && styles.tabActive]} onPress={() => setTab("sos")}>
          <Ionicons name="flag-outline" size={18} color={tab === "sos" ? "#fff" : "#65676B"} />
          <Text style={[styles.tabText, tab === "sos" && styles.tabTextActive]}>Yêu cầu của tôi</Text>
        </TouchableOpacity>
      </View>

      {/* Radius filter (radar only) */}
      {tab === "radar" && (
        <View style={styles.radiusRow}>
          <Text style={styles.radiusLabel}>Bán kính:</Text>
          {RADII.map(r => (
            <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); }}>
              <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* List */}
      {loading ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60, paddingHorizontal: 20 }}>
              <Ionicons name={tab === "radar" ? "map-outline" : "flag-outline"} size={56} color="#ccc" />
              <Text style={{ fontSize: 15, color: "#65676B", marginTop: 12, textAlign: "center" }}>
                {tab === "radar" ? "Không có yêu cầu SOS nào trong khu vực" : "Bạn chưa có yêu cầu SOS nào"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <SOSCard item={item} onRespond={respondToSOS} onPress={openSOSDetail} />
          )}
        />
      )}

      <CreateSOSModal visible={showCreate} onClose={() => { setShowCreate(false); }} onSubmit={() => fetchSOS()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  headerCreateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  // Tab
  tabBar: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F0F2F5", gap: 4 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "500", color: "#65676B" },
  tabTextActive: { color: "#fff" },
  // Radius
  radiusRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 8, gap: 6 },
  radiusLabel: { fontSize: 13, color: "#65676B", fontWeight: "500", marginRight: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: "#F0F2F5" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#65676B" },
  chipTextActive: { color: "#fff" },
  // Card
  card: { backgroundColor: "#fff", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  cardAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  cardUserName: { fontSize: 14, fontWeight: "600", color: "#000" },
  cardTime: { fontSize: 11, color: "#8A8D91", marginTop: 1 },
  cardDistance: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  cardCategory: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: "flex-start", marginBottom: 8, gap: 4 },
  cardCategoryText: { fontSize: 13, fontWeight: "500", color: colors.primary },
  cardDesc: { fontSize: 14, color: "#000", lineHeight: 20, marginBottom: 8 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 },
  cardUrgency: { fontSize: 13, fontWeight: "600" },
  cardRadius: { fontSize: 13, color: "#65676B" },
  cardMediaRow: { flexDirection: "row", gap: 4, marginBottom: 8 },
  cardMediaThumb: { width: 60, height: 60, borderRadius: 6, backgroundColor: "#F0F2F5" },
  cardMediaMore: { fontSize: 12, color: "#65676B", alignSelf: "center" },
  cardResponses: { fontSize: 12, color: "#65676B", marginBottom: 8 },
  respondBtn: { backgroundColor: colors.primary, padding: 12, borderRadius: 10, alignItems: "center" },
  respondText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  respondedText: { fontSize: 13, color: "#22C55E", fontWeight: "600", textAlign: "center" },
  ownerBadge: { backgroundColor: "#F0F2F5", padding: 8, borderRadius: 8, alignItems: "center" },
  ownerBadgeText: { fontSize: 12, color: "#65676B" },
  // Create SOS sheet
  createSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" },
  createHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5E5", alignSelf: "center", marginTop: 10, marginBottom: 8 },
  createTitle: { fontSize: 18, fontWeight: "700", color: "#000", textAlign: "center", marginBottom: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#000", marginBottom: 8, marginTop: 4 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F0F2F5", gap: 4 },
  catChipActive: { backgroundColor: colors.primary },
  catChipText: { fontSize: 12, color: colors.primary, fontWeight: "500" },
  catChipTextActive: { color: "#fff" },
  cameraBtn: { width: 80, height: 80, borderRadius: 8, backgroundColor: "#F0F2F5", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E5E5", borderStyle: "dashed" },
  descInput: { backgroundColor: "#F0F2F5", borderRadius: 12, padding: 12, fontSize: 14, color: "#000", minHeight: 80, textAlignVertical: "top", marginBottom: 12 },
  urgencyRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  urgencyChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, borderColor: "#E5E5E5" },
  urgencyText: { fontSize: 13, fontWeight: "500" },
  submitBtn: { backgroundColor: "#EF4444", padding: 14, borderRadius: 12, margin: 16, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});