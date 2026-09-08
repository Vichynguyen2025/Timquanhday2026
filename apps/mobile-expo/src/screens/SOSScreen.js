import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, Alert, TextInput, Platform, KeyboardAvoidingView, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Location from "expo-location";
import MapView, { Marker, Circle, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import { useLocation } from "../contexts/LocationContext";
import { useBadge } from "../contexts/BadgeContext";
import { useAuth } from "../contexts/AuthContext";
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
  { value: "URGENT", label: "Cần ngay", color: "#EF4444", icon: "alert-circle" },
  { value: "TODAY", label: "Trong hôm nay", color: "#F97316", icon: "time-outline" },
  { value: "SCHEDULED", label: "Có thể hẹn", color: "#22C55E", icon: "calendar-outline" },
];

const SCREEN_WIDTH = Dimensions.get("window").width;

function formatTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(d).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDistance(m) {
  if (!m) return null;
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ─── Fullscreen Image Viewer ──────────────────────
function ImageViewer({ visible, images, initialIndex, onClose }) {
  const flatRef = useRef(null);
  const [idx, setIdx] = useState(initialIndex || 0);
  useEffect(() => { setIdx(initialIndex || 0); }, [initialIndex, visible]);
  useEffect(() => {
    if (visible && flatRef.current && idx != null) {
      setTimeout(() => flatRef.current?.scrollToIndex({ index: idx, animated: false }), 100);
    }
  }, [visible, idx]);

  return (
    <Modal visible={visible} transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <TouchableOpacity onPress={onClose} style={{ position: "absolute", top: 50, right: 20, zIndex: 10, padding: 8 }}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        {images?.length > 0 && (
          <>
            <FlatList
              ref={flatRef}
              data={images}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => String(i)}
              onMomentumScrollEnd={(e) => { const i = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH); setIdx(i); }}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, height: "100%", justifyContent: "center", alignItems: "center" }}>
                  <Image source={{ uri: item.url }} style={{ width: SCREEN_WIDTH, height: undefined, aspectRatio: 1 }} resizeMode="contain" />
                </View>
              )}
            />
            <View style={{ position: "absolute", bottom: 60, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>{idx + 1} / {images.length}</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

// ─── SOS Card (compact) ───────────────────────────
function SOSCard({ item, onRespond, onPress, isOwner }) {
  const urgencyConfig = URGENCIES.find(u => u.value === item.urgency) || URGENCIES[1];
  const mediaItems = item.media || [];
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIdx, setViewerIdx] = useState(0);

  const statusLabels = { OPEN: "Đang mở", MATCHING: "Đang ghép", ACCEPTED: "Đã chấp nhận", IN_PROGRESS: "Đang xử lý", COMPLETED: "Hoàn thành", CANCELLED: "Đã huỷ" };

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onPress?.(item)}>
      <View style={styles.cardTop}>
        <View style={styles.cardAvatar}>
          {item.user_avatar ? (
            <Image source={{ uri: item.user_avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <Text style={styles.cardAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.cardCategoryLabel}>{item.category_name || "Yêu cầu hỗ trợ"}</Text>
            {item.distance != null && <Text style={styles.cardDist}>📍 {formatDistance(item.distance)}</Text>}
          </View>
          <Text style={styles.cardMeta}>{item.user_name || "Người dùng"} · {formatTime(item.created_at)}</Text>
        </View>
        {isOwner && <Text style={styles.cardStatus}>{statusLabels[item.status] || item.status}</Text>}
      </View>

      <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>

      <View style={styles.cardBottom}>
        <View style={[styles.urgencyDot, { backgroundColor: urgencyConfig.color }]} />
        <Text style={{ fontSize: 12, color: urgencyConfig.color, fontWeight: "600" }}>{urgencyConfig.label}</Text>
        <Text style={styles.cardSep}>·</Text>
        <Text style={styles.cardSub}>🎯 {item.radius >= 1000 ? `${item.radius / 1000}km` : `${item.radius}m`}</Text>
        {item.response_count > 0 && <><Text style={styles.cardSep}>·</Text><Text style={styles.cardSub}>{item.response_count} phản hồi</Text></>}

        {mediaItems.length > 0 && (
          <TouchableOpacity onPress={() => { setViewerIdx(0); setViewerVisible(true); }} style={styles.viewPhotoBtn}>
            <Ionicons name="images-outline" size={14} color="#fff" />
            <Text style={styles.viewPhotoText}>Xem ảnh{mediaItems.length > 1 ? ` (${mediaItems.length})` : ""}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ImageViewer visible={viewerVisible} images={mediaItems} initialIndex={viewerIdx} onClose={() => setViewerVisible(false)} />

      {!isOwner && !item.has_responded && (
        <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond?.(item)}>
          <Text style={styles.respondText}>TÔI CÓ THỂ HỖ TRỢ</Text>
        </TouchableOpacity>
      )}
      {item.has_responded && <Text style={styles.respondedText}>✅ Đã phản hồi</Text>}
    </TouchableOpacity>
  );
}

// ─── Create SOS Modal ─────────────────────────────
function CreateSOSModal({ visible, onClose, onSubmit }) {
  const insets = useSafeAreaInsets();
  const { currentLocation: sharedLocation } = useLocation();
  const [categoryId, setCategoryId] = useState(null);
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState(1000);
  const [urgency, setUrgency] = useState("URGENT");
  const [capturedImages, setCapturedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [locationName, setLocationName] = useState("Đang lấy vị trí...");
  const [currentLoc, setCurrentLoc] = useState(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      submittedRef.current = false;
      (async () => {
        // Use shared location from LocationContext if available
        if (sharedLocation) {
          setCurrentLoc({ latitude: sharedLocation.latitude, longitude: sharedLocation.longitude });
          try {
            const geocode = await Location.reverseGeocodeAsync({
              latitude: sharedLocation.latitude,
              longitude: sharedLocation.longitude,
            });
            if (geocode.length > 0) {
              const a = geocode[0];
              setLocationName([a.street, a.district, a.city, a.region].filter(Boolean).join(", ") || "Vị trí hiện tại");
            } else setLocationName("Vị trí hiện tại");
          } catch { setLocationName("Vị trí hiện tại"); }
        } else {
          // Fallback: request GPS directly
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") { setLocationName("Không có quyền truy cập vị trí"); return; }
          const loc = await Location.getCurrentPositionAsync({});
          setCurrentLoc(loc.coords);
          const geocode = await Location.reverseGeocodeAsync(loc.coords);
          if (geocode.length > 0) {
            const a = geocode[0];
            setLocationName([a.street, a.district, a.city, a.region].filter(Boolean).join(", ") || "Vị trí hiện tại");
          } else setLocationName("Vị trí hiện tại");
        }
      })();
    }
  }, [visible, sharedLocation]);

  async function captureImage() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Cần quyền camera"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const manip = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1920 } }], { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    setCapturedImages(prev => [...prev, { ...manip, capturedAt: new Date().toISOString() }]);
  }
  function removeImage(idx) { setCapturedImages(prev => prev.filter((_, i) => i !== idx)); }

  async function handleSubmit() {
    if (submitting || submittedRef.current) return;
    if (!categoryId) { Alert.alert("Chọn danh mục"); return; }
    if (!description.trim()) { Alert.alert("Nhập mô tả"); return; }
    if (capturedImages.length === 0) { Alert.alert("Chụp ít nhất 1 ảnh"); return; }
    setSubmitting(true); submittedRef.current = true;
    try {
      const token = await AsyncStorage.getItem("accessToken");
      const media = [];
      for (const img of capturedImages) {
        const formData = new FormData();
        formData.append("image", { uri: img.uri, type: "image/jpeg", name: "sos.jpg" });
        const uploadRes = await fetch("https://timquanhday.de/api/upload/image", { method: "POST", headers: { Authorization: "Bearer " + token }, body: formData });
        const uploadData = await uploadRes.json();
        media.push({ url: uploadData.url, lat: currentLoc?.latitude || null, lng: currentLoc?.longitude || null, locationName, capturedAt: img.capturedAt });
      }
      await api.post("/sos", { categoryId, description: description.trim(), lat: currentLoc?.latitude || 21.0285, lng: currentLoc?.longitude || 105.8542, locationName, radius, urgency, media });
      setCategoryId(null); setDescription(""); setCapturedImages([]);
      Alert.alert("Đã gửi yêu cầu", "Yêu cầu SOS của bạn đã được gửi đến những người trong khu vực.");
      onSubmit?.(); onClose();
    } catch (e) {
      submittedRef.current = false;
      console.log("[SOS] Submit error:", e?.response?.status, e?.response?.data, e?.message);
      Alert.alert("Lỗi", e?.response?.data?.error || e?.message || "Không thể gửi yêu cầu.");
    }
    setSubmitting(false);
  }

  function handleClose() {
    if (description || capturedImages.length > 0) {
      Alert.alert("Bỏ yêu cầu?", "Dữ liệu đã nhập sẽ bị mất.", [{ text: "Tiếp tục", style: "cancel" }, { text: "Bỏ", style: "destructive", onPress: resetForm }]);
    } else resetForm();
  }
  function resetForm() { submittedRef.current = false; setCategoryId(null); setDescription(""); setRadius(1000); setUrgency("URGENT"); setCapturedImages([]); setSubmitting(false); onClose(); }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.createOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
          <View style={[styles.createSheet, { paddingBottom: Platform.OS === "ios" ? insets.bottom : 0 }]}>
            <View style={styles.createHandle} />
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Tạo yêu cầu SOS</Text>
              <TouchableOpacity onPress={handleClose}><Ionicons name="close" size={24} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Danh mục hỗ trợ</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity key={c.id} style={[styles.catChip, categoryId === c.id && styles.catChipActive]} onPress={() => setCategoryId(c.id)}>
                    <Ionicons name={c.icon} size={18} color={categoryId === c.id ? "#fff" : colors.primary} />
                    <Text style={[styles.catChipText, categoryId === c.id && styles.catChipTextActive]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Ảnh hiện trường</Text>
              <View style={styles.cameraRow}>
                {capturedImages.map((img, i) => (
                  <View key={i} style={styles.cameraThumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.cameraThumb} />
                    <TouchableOpacity onPress={() => removeImage(i)} style={styles.cameraRemove}><Ionicons name="close-circle" size={22} color="#EF4444" /></TouchableOpacity>
                  </View>
                ))}
                {capturedImages.length < 3 && (
                  <TouchableOpacity onPress={captureImage} style={styles.cameraAddBtn}>
                    <Ionicons name="camera-outline" size={32} color={colors.primary} />
                    <Text style={styles.cameraAddText}>Chụp</Text>
                  </TouchableOpacity>
                )}
              </View>
              {capturedImages.length === 0 && <Text style={styles.hint}>Chụp ít nhất 1 ảnh (tối đa 3)</Text>}
              <Text style={styles.label}>Bạn cần hỗ trợ gì?</Text>
              <TextInput style={styles.descInput} placeholder="Ví dụ: Xe máy bị thủng lốp, đang ở gần ngã tư..." placeholderTextColor="#9CA3AF" value={description} onChangeText={setDescription} multiline textAlignVertical="top" />
              <Text style={styles.label}>Vị trí của bạn</Text>
              <View style={styles.locationRow}><Ionicons name="location-outline" size={20} color={colors.primary} /><Text style={styles.locationText} numberOfLines={2}>{locationName}</Text></View>
              <Text style={styles.label}>Phạm vi tìm người hỗ trợ</Text>
              <View style={styles.radiusRow}>
                {RADII.map(r => (
                  <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => setRadius(r)}>
                    <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Mức độ khẩn cấp</Text>
              <View style={styles.urgencyRow}>
                {URGENCIES.map(u => (
                  <TouchableOpacity key={u.value} style={[styles.urgencyCard, urgency === u.value && { backgroundColor: u.color + "15", borderColor: u.color }]} onPress={() => setUrgency(u.value)}>
                    <Ionicons name={u.icon} size={24} color={u.color} />
                    <Text style={[styles.urgencyCardLabel, urgency === u.value && { color: u.color }]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.submitWrap}>
              <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={[styles.submitBtn, submitting && { opacity: 0.5 }]}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>🆘 ĐĂNG YÊU CẦU</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main SOS Screen ──────────────────────────────
export default function SOSScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { currentLocation: sharedLocation } = useLocation();
  const { setSosUnread } = useBadge();
  const { user, updateUser } = useAuth();
  // Canonical helper profile: read from AuthContext.user.service_profile
  const canonicalSp = user?.service_profile || null;
  const [tab, setTab] = useState("radar");
  const [sosList, setSosList] = useState([]);
  const [mySos, setMySos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(1000);
  const [showCreate, setShowCreate] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const mapRef = useRef(null);
  const [helperProfile, setHelperProfile] = useState(null);
  const [showHelperModal, setShowHelperModal] = useState(false);
  const [helperCategories, setHelperCategories] = useState([]);
  const [helperRadius, setHelperRadius] = useState(1000);
  const [helperAvailable, setHelperAvailable] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Provider management
  const [selectedSOS, setSelectedSOS] = useState(null); // SOS with providers to show
  const [showProviders, setShowProviders] = useState(false);
  // Helping tab
  const [helpingSos, setHelpingSos] = useState([]);
  const [helpingFilter, setHelpingFilter] = useState("PENDING"); // PENDING, ACCEPTED, DECLINED

  useFocusEffect(useCallback(() => {
    fetchSOS(); fetchHelperProfile();
    // Use shared location from context if available
    if (sharedLocation) {
      setUserLocation({ latitude: sharedLocation.latitude, longitude: sharedLocation.longitude });
    }
    const socket = getSocket();
    if (!socket) return;
    const onNew = (sos) => { setSosList(prev => { if (prev.find(s => s.id === sos.id)) return prev; return [sos, ...prev]; }); };
    const onUpdated = (sos) => { setSosList(prev => prev.map(s => s.id === sos.id ? sos : s)); setMySos(prev => prev.map(s => s.id === sos.id ? sos : s)); setHelpingSos(prev => prev.map(s => s.id === sos.id ? sos : s)); };
    const onCancelled = ({ sosId }) => { setSosList(prev => prev.filter(s => s.id !== sosId)); setMySos(prev => prev.filter(s => s.id !== sosId)); setHelpingSos(prev => prev.filter(s => s.id !== sosId)); };
    socket.on("sos:new", onNew); socket.on("sos:updated", onUpdated); socket.on("sos:cancelled", onCancelled);
    return () => { socket.off("sos:new", onNew); socket.off("sos:updated", onUpdated); socket.off("sos:cancelled", onCancelled); };
  }, [radius]));

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    } catch {}
  }

  async function fetchSOS() {
    setLoading(true);
    try {
      const [radarRes, mineRes, helpingRes, unreadRes] = await Promise.all([
        api.get("/sos", { params: { radius } }),
        api.get("/sos/mine"),
        api.get("/sos/helping"),
        api.get("/sos/unread-count"),
      ]);
      setSosList(radarRes.data?.sos || []);
      setMySos(mineRes.data?.sos || []);
      setHelpingSos(helpingRes.data?.sos || []);
      setSosUnread(unreadRes.data?.count || 0);
    } catch (e) {}
    setLoading(false); setRefreshing(false);
  }

  async function fetchHelperProfile() {
    try {
      const res = await api.get("/sos/helper/profile"); const data = res.data;
      setHelperProfile(data); setHelperCategories(data.categories?.map(c => c.id) || []);
      setHelperRadius(data.service_radius || 1000); setHelperAvailable(data.is_available !== false);
      // Sync to AuthContext canonical user state
      if (data) updateUser({ service_profile: data });
    } catch (e) {}
  }

  async function saveHelperProfile() {
    try {
      setSubmitting(true);
      const res = await api.put("/sos/helper/profile", { is_provider: true, is_available: helperAvailable, service_radius: helperRadius, category_ids: helperCategories });
      setHelperProfile(res.data); setShowHelperModal(false);
      // Sync to AuthContext canonical user state
      if (res.data) updateUser({ service_profile: res.data });
      Alert.alert("Đã lưu", "Thông tin hỗ trợ SOS đã được cập nhật.");
    } catch (e) { Alert.alert("Lỗi", "Không thể lưu thông tin."); }
    setSubmitting(false);
  }

  function goToMyLocation() { if (userLocation && mapRef.current) { mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 500); } }

  async function respondToSOS(item) {
    Alert.alert("Hỗ trợ yêu cầu này?", item.description, [
      { text: "Huỷ", style: "cancel" },
      { text: "TÔI CÓ THỂ HỖ TRỢ", onPress: async () => {
        try { await api.post(`/sos/${item.id}/response`, { message: "Tôi có thể hỗ trợ!" }); Alert.alert("Đã phản hồi", "Người gửi sẽ được thông báo."); fetchSOS(); } catch (e) { Alert.alert("Lỗi", "Không thể phản hồi"); }
      }},
    ]);
  }

  function openSOSDetail(item) {
    const statusLabels = { OPEN: "Đang mở", MATCHING: "Đang ghép", ACCEPTED: "Đã chấp nhận", IN_PROGRESS: "Đang xử lý", COMPLETED: "Hoàn thành", CANCELLED: "Đã huỷ" };
    let msg = item.description;
    if (item.media?.length > 0) msg += "\n📷 " + item.media.length + " ảnh hiện trường";
    msg += `\n\nDanh mục: ${item.category_name || "Khác"}\nTrạng thái: ${statusLabels[item.status] || item.status}\n📍 ${item.distance != null ? formatDistance(item.distance) : item.location_name || ""}\n📏 Bán kính: ${item.radius >= 1000 ? `${item.radius / 1000}km` : `${item.radius}m`}`;
    Alert.alert("Chi tiết SOS", msg, [{ text: "Đóng", style: "cancel" }]);
  }

  const statusLabels = { OPEN: "Đang mở", MATCHING: "Đang ghép", ACCEPTED: "Đã chấp nhận", IN_PROGRESS: "Đang xử lý", COMPLETED: "Hoàn thành", CANCELLED: "Đã huỷ" };

  // ─── Provider accept/reject ──────────────────────
  async function acceptProvider(item, response) {
    try {
      const res = await api.post(`/sos/${item.id}/accept`, { responseId: response.id });
      const data = res.data;
      setShowProviders(false);
      setSelectedSOS(null);
      fetchSOS();
      if (data.conversation_id) {
        navigation?.navigate("ChatDetail", {
          conversationId: data.conversation_id,
          name: response.provider_name || "Người hỗ trợ",
        });
      }
    } catch (e) {
      Alert.alert("Lỗi", "Không thể chọn người hỗ trợ này");
    }
  }

  async function rejectProvider(item, response) {
    try {
      await api.post(`/sos/${item.id}/reject`, { responseId: response.id });
      fetchSOS();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể từ chối");
    }
  }

  function openProviders(sosItem) {
    setSelectedSOS(sosItem);
    setShowProviders(true);
  }

  // ─── Sync helper modal state from canonical AuthContext user ──
  useEffect(() => {
    if (showHelperModal && canonicalSp) {
      setHelperCategories(canonicalSp.categories?.map(c => c.id) || []);
      setHelperRadius(canonicalSp.service_radius || 1000);
      setHelperAvailable(canonicalSp.is_available !== false);
    }
  }, [showHelperModal, canonicalSp]);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header — phủ status bar */}
      <View style={[styles.headerBg, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>🆘 SOS</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.headerCreateBtn}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
        </View>
      </View>

      {/* Helper status — compact bar */}
      <TouchableOpacity style={styles.helperBar} onPress={() => setShowHelperModal(true)}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.helperBarIcon}>{canonicalSp?.is_provider ? (helperAvailable ? "🟢" : "⚪") : "🆘"}</Text>
                <Text style={styles.helperBarText}>
                  {canonicalSp?.is_provider
                    ? (helperAvailable ? "Đang nhận SOS" : "Tạm ngưng")
                    : "Đăng ký hỗ trợ SOS"}
                </Text>
                {canonicalSp?.is_provider && (
                  <Text style={styles.helperBarSub}>
                    {canonicalSp.categories?.slice(0, 2).map(c => c.name).join(", ")}{canonicalSp.categories?.length > 2 ? ` +${canonicalSp.categories.length - 2}` : ""} · {canonicalSp.service_radius >= 1000 ? `${canonicalSp.service_radius / 1000}km` : `${canonicalSp.service_radius}m`}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {["radar", "sos", "helping"].map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Ionicons name={t === "radar" ? "map-outline" : t === "sos" ? "flag-outline" : "hand-left-outline"} size={18} color={tab === t ? "#fff" : "#65676B"} />
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === "radar" ? "Bản đồ" : t === "sos" ? "Yêu cầu của tôi" : "Hỗ trợ đã gửi"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Radar tab: Map first, compact list below */}
      {tab === "radar" ? (
        <View style={{ flex: 1 }}>
          {userLocation ? (
            <View style={{ height: 300 }}>
              <MapView ref={mapRef} style={{ flex: 1 }} provider={PROVIDER_DEFAULT}
                initialRegion={{ latitude: userLocation.latitude, longitude: userLocation.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
                showsUserLocation showsMyLocationButton={false}>
                <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
                {sosList.filter(s => s.lat != null && s.lng != null).map(sos => (
                  <Marker key={sos.id} coordinate={{ latitude: parseFloat(sos.lat), longitude: parseFloat(sos.lng) }}
                    title={sos.category_name || "Yêu cầu hỗ trợ"} description={sos.description?.slice(0, 50)}
                    pinColor={sos.is_owner ? "#3B82F6" : "#EF4444"} />
                ))}
                <Circle center={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
                  radius={radius} fillColor="rgba(37, 99, 235, 0.08)" strokeColor="rgba(37, 99, 235, 0.3)" strokeWidth={2} />
              </MapView>
              <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation}><Ionicons name="locate-outline" size={22} color={colors.primary} /></TouchableOpacity>
            </View>
          ) : (
            <View style={{ height: 300, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>Đang tải bản đồ...</Text>
            </View>
          )}

          {/* Radius bar */}
          <View style={styles.radiusBar}>
            <Text style={styles.radiusLabel}>📍</Text>
            {RADII.map(r => (
              <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); }}>
                <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* SOS List */}
          {loading ? (
            <View style={{ padding: 20 }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList data={sosList} keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
              contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 24 }}>
                  <Ionicons name="map-outline" size={40} color="#D1D5DB" />
                  <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>Không có yêu cầu gần bạn</Text>
                  <TouchableOpacity onPress={() => fetchSOS()} style={styles.retryBtn}><Text style={styles.retryText}>Tìm lại</Text></TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => <SOSCard item={item} onRespond={respondToSOS} onPress={openSOSDetail} />}
            />
          )}
        </View>
      ) : tab === "sos" ? (
        /* My SOS tab */
        loading ? (
          <View style={{ paddingTop: 20 }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList data={mySos} keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
            contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="flag-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 }}>Bạn chưa có yêu cầu nào</Text>
                <TouchableOpacity onPress={() => setShowCreate(true)} style={[styles.retryBtn, { marginTop: 16 }]}><Text style={styles.retryText}>Tạo yêu cầu</Text></TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => {
              // Override with canonical AuthContext data for current user's SOS
              const sosItem = { ...item, user_name: user?.name || item.user_name, user_avatar: user?.avatar || item.user_avatar };
              const hasPending = (sosItem.response_count || 0) > 0 && sosItem.status === 'MATCHING';
              return (
                <View>
                  <SOSCard item={sosItem} onPress={openSOSDetail} isOwner />
                  {hasPending && (
                    <TouchableOpacity style={styles.providerBadge} onPress={() => openProviders(item)}>
                      <Ionicons name="people" size={16} color="#22C55E" />
                      <Text style={styles.providerBadgeText}>🟢 {item.response_count} người có thể hỗ trợ</Text>
                      <Text style={styles.providerBadgeAction}>Xem →</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'ACCEPTED' && (
                    <View style={[styles.providerBadge, { backgroundColor: "#F0FDF4", borderColor: "#22C55E" }]}>
                      <Ionicons name="checkmark-circle" size={16} color="#22C55E" />
                      <Text style={[styles.providerBadgeText, { color: "#22C55E" }]}>Đã chọn người hỗ trợ</Text>
                    </View>
                  )}
                </View>
              );
            }}
          />
        )
      ) : null}

      {/* Helping tab — SOS I've offered to help */}
      {tab === "helping" && (
        <View style={{ flex: 1 }}>
          {/* Filter chips */}
          <View style={styles.helpingFilterRow}>
            {[
              { key: "PENDING", label: "Đang chờ", color: "#F97316" },
              { key: "ACCEPTED", label: "Đã chấp nhận", color: "#22C55E" },
              { key: "DECLINED", label: "Đã hủy", color: "#9CA3AF" },
            ].map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.helpingFilterChip, helpingFilter === f.key && { backgroundColor: f.color }]}
                onPress={() => setHelpingFilter(f.key)}
              >
                <Text style={[styles.helpingFilterText, helpingFilter === f.key && { color: "#fff" }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <View style={{ paddingTop: 20 }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              data={helpingSos.filter(s => {
                const statusMap = { PENDING: "PENDING", ACCEPTED: "ACCEPTED", DECLINED: "DECLINED" };
                return s.response_status === statusMap[helpingFilter];
              })}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
              contentContainerStyle={{ padding: 12, paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 }}>
                  <Ionicons name="hand-left-outline" size={48} color="#D1D5DB" />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12, textAlign: "center" }}>
                    {helpingFilter === "PENDING" ? "Bạn chưa có đề nghị hỗ trợ nào đang chờ" :
                     helpingFilter === "ACCEPTED" ? "Chưa có đề nghị hỗ trợ nào được chấp nhận" :
                     "Chưa có đề nghị hỗ trợ nào bị hủy"}
                  </Text>
                </View>
              }
              renderItem={({ item }) => {
                const statusData = {
                  PENDING: { label: "Đang chờ", color: "#F97316", bg: "#FFF7ED" },
                  ACCEPTED: { label: "Đã chấp nhận", color: "#22C55E", bg: "#F0FDF4" },
                  DECLINED: { label: "Đã hủy", color: "#9CA3AF", bg: "#F9FAFB" },
                };
                const st = statusData[item.response_status] || statusData.PENDING;
                return (
                  <View style={styles.helpingCard}>
                    <View style={styles.helpingCardTop}>
                      <View style={styles.helpingAvatar}>
                        <Text style={styles.helpingAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.helpingUserName}>{item.user_name || "Người dùng"}</Text>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={styles.helpingCategory}>{item.category_name || "Yêu cầu hỗ trợ"}</Text>
                          {item.distance != null && <Text style={styles.helpingDist}>📍 {formatDistance(item.distance)}</Text>}
                        </View>
                      </View>
                      <View style={[styles.helpingStatusBadge, { backgroundColor: st.bg }]}>
                        <View style={[styles.helpingStatusDot, { backgroundColor: st.color }]} />
                        <Text style={[styles.helpingStatusText, { color: st.color }]}>{st.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.helpingDesc} numberOfLines={2}>{item.description}</Text>
                    <Text style={styles.helpingTime}>{formatTime(item.created_at)}</Text>

                    {item.response_status === "ACCEPTED" && item.response_id && (
                      <TouchableOpacity
                        style={styles.helpingChatBtn}
                        onPress={async () => {
                          try {
                            const res = await api.post("/sos/helping/conversation", { responseId: item.response_id });
                            const data = res.data;
                            if (data.conversation_id) {
                              navigation?.navigate("ChatDetail", {
                                conversationId: data.conversation_id,
                                name: item.user_name || "Người hỗ trợ",
                              });
                            }
                          } catch (e) {
                            const msg = e?.response?.data?.error || "Không thể mở tin nhắn";
                            Alert.alert("Lỗi", msg);
                          }
                        }}
                      >
                        <Ionicons name="chatbubble-ellipses" size={16} color="#fff" />
                        <Text style={styles.helpingChatText}>Mở tin nhắn</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}
        </View>
      )}

      <CreateSOSModal visible={showCreate} onClose={() => setShowCreate(false)} onSubmit={() => { fetchSOS(); }} />

      {/* Helper Management Modal */}
      <Modal visible={showHelperModal} transparent animationType="slide" onRequestClose={() => setShowHelperModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={[styles.helperSheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.createHandle} />
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Hỗ trợ SOS</Text>
              <TouchableOpacity onPress={() => setShowHelperModal(false)}><Ionicons name="close" size={24} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Bạn có thể hỗ trợ gì?</Text>
              <View style={styles.catRow}>
                {CATEGORIES.map(c => {
                  const selected = helperCategories.includes(c.id);
                  return (
                    <TouchableOpacity key={c.id} style={[styles.catChip, selected && styles.catChipActive]} onPress={() => {
                      if (selected) setHelperCategories(prev => prev.filter(id => id !== c.id));
                      else setHelperCategories(prev => [...prev, c.id]);
                    }}>
                      <Ionicons name={c.icon} size={18} color={selected ? "#fff" : colors.primary} />
                      <Text style={[styles.catChipText, selected && styles.catChipTextActive]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {helperCategories.length === 0 && <Text style={styles.hint}>Chọn ít nhất 1 dịch vụ</Text>}
              <Text style={styles.label}>Bán kính hỗ trợ</Text>
              <View style={styles.radiusRow}>
                {RADII.map(r => (
                  <TouchableOpacity key={r} style={[styles.chip, helperRadius === r && styles.chipActive]} onPress={() => setHelperRadius(r)}>
                    <Text style={[styles.chipText, helperRadius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Trạng thái</Text>
              <View style={styles.helperStatusRow}>
                <TouchableOpacity style={[styles.helperStatusChip, helperAvailable && styles.helperStatusActive]} onPress={() => setHelperAvailable(true)}>
                  <Ionicons name="checkmark-circle" size={20} color={helperAvailable ? "#22C55E" : "#9CA3AF"} />
                  <Text style={[styles.helperStatusChipText, helperAvailable && { color: "#22C55E" }]}>Nhận SOS</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.helperStatusChip, !helperAvailable && styles.helperStatusPaused]} onPress={() => setHelperAvailable(false)}>
                  <Ionicons name="pause-circle" size={20} color={!helperAvailable ? "#F97316" : "#9CA3AF"} />
                  <Text style={[styles.helperStatusChipText, !helperAvailable && { color: "#F97316" }]}>Tạm ngưng</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            <View style={styles.submitWrap}>
              <TouchableOpacity onPress={saveHelperProfile} disabled={submitting || helperCategories.length === 0} style={[styles.submitBtn, (submitting || helperCategories.length === 0) && { opacity: 0.5 }]}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>LƯU CÀI ĐẶT</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Provider List Modal */}
      <Modal visible={showProviders} transparent animationType="slide" onRequestClose={() => setShowProviders(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={[styles.helperSheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.createHandle} />
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Người hỗ trợ</Text>
              <TouchableOpacity onPress={() => setShowProviders(false)}><Ionicons name="close" size={24} color="#000" /></TouchableOpacity>
            </View>
            <FlatList
              data={selectedSOS?.responses?.filter(r => r.status === 'PENDING') || []}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ padding: 16 }}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: "#9CA3AF", padding: 20 }}>Không có người hỗ trợ</Text>}
              renderItem={({ item }) => (
                <View style={styles.providerCard}>
                  <View style={styles.providerAvatar}>
                    <Text style={styles.providerAvatarText}>{(item.provider_name || "?")[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.providerName}>{item.provider_name || "Người dùng"}</Text>
                    <Text style={styles.providerMsg}>{item.message || "Có thể hỗ trợ bạn"}</Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptProvider(selectedSOS, item)}>
                      <Text style={styles.acceptBtnText}>Đồng ý</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectProvider(selectedSOS, item)}>
                      <Text style={styles.rejectBtnText}>Hủy</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBg: { backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  headerCreateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  // Helper bar — compact
  helperBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F0F9FF", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  helperBarIcon: { fontSize: 16 },
  helperBarText: { fontSize: 14, fontWeight: "600", color: "#111827" },
  helperBarSub: { fontSize: 12, color: "#6B7280", flexShrink: 1 },
  // Tab
  tabBar: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 6, backgroundColor: "#fff", gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, backgroundColor: "#F3F4F6", gap: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  tabTextActive: { color: "#fff" },
  // Map
  myLocBtn: { position: "absolute", bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  // Radius bar
  radiusBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  radiusLabel: { fontSize: 14, marginRight: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, marginRight: 6, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  // Card (compact)
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  cardTop: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  cardAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  cardAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  cardCategoryLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  cardMeta: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  cardDist: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  cardStatus: { fontSize: 11, color: "#6B7280", backgroundColor: "#F3F4F6", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  cardDesc: { fontSize: 13, color: "#374151", lineHeight: 18, marginBottom: 8 },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 4 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  cardSep: { fontSize: 12, color: "#D1D5DB" },
  cardSub: { fontSize: 12, color: "#6B7280" },
  respondBtn: { backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 10, alignItems: "center", marginTop: 8 },
  respondText: { color: "#fff", fontWeight: "700", fontSize: 13, letterSpacing: 0.5 },
  respondedText: { fontSize: 12, color: "#22C55E", fontWeight: "600", textAlign: "center", paddingVertical: 6, marginTop: 6 },
  viewPhotoBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#6B7280", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 4, marginLeft: "auto" },
  viewPhotoText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  retryBtn: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  helperSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" },
  helperStatusRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  helperStatusChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", gap: 8 },
  helperStatusActive: { borderColor: "#22C55E", backgroundColor: "#F0FDF4" },
  helperStatusPaused: { borderColor: "#F97316", backgroundColor: "#FFF7ED" },
  helperStatusChipText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  createOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  createSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1 },
  createHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  createHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  createTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8, marginTop: 8 },
  hint: { fontSize: 12, color: "#9CA3AF", marginTop: 4, marginBottom: 4 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  catChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "#F3F4F6", gap: 6, borderWidth: 1, borderColor: "transparent" },
  catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  catChipText: { fontSize: 13, color: colors.primary, fontWeight: "500" },
  catChipTextActive: { color: "#fff" },
  cameraRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  cameraThumbWrap: { position: "relative" },
  cameraThumb: { width: 88, height: 88, borderRadius: 12, backgroundColor: "#F3F4F6" },
  cameraRemove: { position: "absolute", top: -6, right: -6 },
  cameraAddBtn: { width: 88, height: 88, borderRadius: 12, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#D1D5DB", borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  cameraAddText: { fontSize: 10, color: colors.primary, marginTop: 4, fontWeight: "500" },
  descInput: { backgroundColor: "#F9FAFB", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, fontSize: 14, color: "#111827", minHeight: 100, textAlignVertical: "top", lineHeight: 20 },
  locationRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#E5E7EB", gap: 8 },
  locationText: { fontSize: 14, color: "#6B7280", flex: 1 },
  radiusRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  urgencyRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  urgencyCard: { flex: 1, alignItems: "center", paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", gap: 6 },
  urgencyCardLabel: { fontSize: 12, fontWeight: "600", color: "#6B7280", textAlign: "center" },
  submitWrap: { paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: "#E5E7EB" },
  submitBtn: { backgroundColor: "#EF4444", paddingVertical: 16, borderRadius: 14, alignItems: "center", elevation: 2, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
  // Provider badge
  providerBadge: { flexDirection: "row", alignItems: "center", backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#86EFAC", borderRadius: 10, padding: 10, marginTop: -4, marginBottom: 8, marginHorizontal: 14, gap: 6 },
  providerBadgeText: { flex: 1, fontSize: 13, fontWeight: "600", color: "#16A34A" },
  providerBadgeAction: { fontSize: 13, fontWeight: "600", color: colors.primary },
  // Provider list
  providerCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E5E7EB", gap: 12 },
  providerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  providerAvatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  providerName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  providerMsg: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  acceptBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, alignItems: "center", minWidth: 70 },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  rejectBtn: { backgroundColor: "#F3F4F6", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#D1D5DB", minWidth: 70 },
  rejectBtnText: { color: "#6B7280", fontWeight: "600", fontSize: 13 },
  // Helping tab
  helpingFilterRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  helpingFilterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F3F4F6" },
  helpingFilterText: { fontSize: 13, fontWeight: "500", color: "#6B7280" },
  helpingCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
  helpingCardTop: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  helpingAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  helpingAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  helpingUserName: { fontSize: 14, fontWeight: "600", color: "#111827" },
  helpingCategory: { fontSize: 12, color: "#6B7280" },
  helpingDist: { fontSize: 12, color: colors.primary, fontWeight: "600" },
  helpingStatusBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
  helpingStatusDot: { width: 8, height: 8, borderRadius: 4 },
  helpingStatusText: { fontSize: 12, fontWeight: "600" },
  helpingDesc: { fontSize: 13, color: "#374151", lineHeight: 18, marginBottom: 4 },
  helpingTime: { fontSize: 11, color: "#9CA3AF", marginBottom: 8 },
  helpingChatBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, paddingVertical: 10, borderRadius: 10, gap: 6 },
  helpingChatText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});