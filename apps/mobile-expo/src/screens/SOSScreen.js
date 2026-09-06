import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, Alert, TextInput, Platform, KeyboardAvoidingView, ScrollView } from "react-native";
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

// ─── SOS Card ─────────────────────────────────────
function SOSCard({ item, onRespond, onPress, isOwner }) {
  const urgencyConfig = URGENCIES.find(u => u.value === item.urgency) || URGENCIES[1];
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={() => onPress?.(item)}>
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

      <View style={styles.cardCategory}>
        <Ionicons name={item.category_icon || "help-outline"} size={16} color={colors.primary} />
        <Text style={styles.cardCategoryText}>{item.category_name || "Yêu cầu hỗ trợ"}</Text>
      </View>

      <Text style={styles.cardDesc} numberOfLines={3}>{item.description}</Text>

      <View style={styles.cardMeta}>
        <View style={[styles.urgencyBadge, { backgroundColor: urgencyConfig.color + "20" }]}>
          <Ionicons name={urgencyConfig.icon} size={14} color={urgencyConfig.color} />
          <Text style={[styles.urgencyText, { color: urgencyConfig.color }]}>{urgencyConfig.label}</Text>
        </View>
        {item.radius && (
          <Text style={styles.cardRadius}>🎯 Bán kính {item.radius >= 1000 ? `${item.radius / 1000}km` : `${item.radius}m`}</Text>
        )}
      </View>

      {item.media?.length > 0 && (
        <View style={styles.cardMediaRow}>
          {item.media.slice(0, 3).map((m, i) => (
            <Image key={i} source={{ uri: m.url }} style={styles.cardMediaThumb} />
          ))}
          {item.media.length > 3 && <Text style={styles.cardMediaMore}>+{item.media.length - 3}</Text>}
        </View>
      )}

      <Text style={styles.cardResponses}>{item.response_count || 0} người phản hồi</Text>

      {item.is_owner ? (
        <View style={styles.ownerBadge}><Text style={styles.ownerBadgeText}>Yêu cầu của bạn</Text></View>
      ) : item.has_responded ? (
        <Text style={styles.respondedText}>✅ Đã phản hồi</Text>
      ) : (
        <TouchableOpacity style={styles.respondBtn} onPress={() => onRespond?.(item)}>
          <Text style={styles.respondText}>TÔI CÓ THỂ HỖ TRỢ</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Create SOS Modal ─────────────────────────────
function CreateSOSModal({ visible, onClose, onSubmit }) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState("category");
  const [categoryId, setCategoryId] = useState(null);
  const [description, setDescription] = useState("");
  const [radius, setRadius] = useState(1000);
  const [urgency, setUrgency] = useState("URGENT");
  const [capturedImages, setCapturedImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [locationName, setLocationName] = useState("Đang lấy vị trí...");
  const [currentLoc, setCurrentLoc] = useState(null);

  useEffect(() => {
    if (visible) {
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") { setLocationName("Không có quyền truy cập vị trí"); return; }
        const loc = await Location.getCurrentPositionAsync({});
        setCurrentLoc(loc.coords);
        const geocode = await Location.reverseGeocodeAsync(loc.coords);
        if (geocode.length > 0) {
          const a = geocode[0];
          setLocationName([a.street, a.district, a.city, a.region].filter(Boolean).join(", ") || "Vị trí hiện tại");
        } else {
          setLocationName("Vị trí hiện tại");
        }
      })();
    }
  }, [visible]);

  async function captureImage() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Cần quyền camera"); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const manip = await ImageManipulator.manipulateAsync(asset.uri,
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    setCapturedImages(prev => [...prev, { ...manip, capturedAt: new Date().toISOString() }]);
  }

  function removeImage(idx) {
    setCapturedImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit() {
    if (!categoryId) { Alert.alert("Chọn danh mục"); return; }
    if (!description.trim()) { Alert.alert("Nhập mô tả"); return; }
    if (capturedImages.length === 0) { Alert.alert("Chụp ít nhất 1 ảnh"); return; }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("accessToken");
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
          lat: currentLoc?.latitude || null,
          lng: currentLoc?.longitude || null,
          locationName: locationName,
          capturedAt: img.capturedAt || new Date().toISOString(),
        });
      }
      const payload = {
        categoryId,
        description: description.trim(),
        lat: currentLoc?.latitude || 21.0285,
        lng: currentLoc?.longitude || 105.8542,
        locationName,
        radius,
        urgency,
        media,
      };
      await api.post("/sos", payload);
      Alert.alert("Đã gửi yêu cầu", "Yêu cầu SOS của bạn đã được gửi đến những người trong khu vực.");
      onSubmit?.();
      handleClose();
    } catch (e) {
      Alert.alert("Lỗi", "Không thể gửi yêu cầu. Vui lòng thử lại.");
    }
    setSubmitting(false);
  }

  function handleClose() {
    if (description || capturedImages.length > 0) {
      Alert.alert("Bỏ yêu cầu?", "Dữ liệu đã nhập sẽ bị mất.", [
        { text: "Tiếp tục", style: "cancel" },
        { text: "Bỏ", style: "destructive", onPress: resetForm },
      ]);
    } else {
      resetForm();
    }
  }

  function resetForm() {
    setStep("category");
    setCategoryId(null);
    setDescription("");
    setRadius(1000);
    setUrgency("URGENT");
    setCapturedImages([]);
    setSubmitting(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.createOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={handleClose} />
          <View style={[styles.createSheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.createHandle} />
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Tạo yêu cầu SOS</Text>
              <TouchableOpacity onPress={handleClose} style={styles.createCloseBtn}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
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
                    <TouchableOpacity onPress={() => removeImage(i)} style={styles.cameraRemove}>
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
                {capturedImages.length < 3 && (
                  <TouchableOpacity onPress={captureImage} style={styles.cameraAddBtn}>
                    <Ionicons name="camera-outline" size={32} color={colors.primary} />
                    <Text style={styles.cameraAddText}>Chụp ảnh</Text>
                  </TouchableOpacity>
                )}
              </View>
              {capturedImages.length === 0 && (
                <Text style={styles.hint}>Chụp ít nhất 1 ảnh hiện trường (tối đa 3 ảnh)</Text>
              )}

              <Text style={styles.label}>Bạn cần hỗ trợ gì?</Text>
              <TextInput
                style={styles.descInput}
                placeholder="Ví dụ: Xe máy bị thủng lốp, đang ở gần ngã tư..."
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Vị trí của bạn</Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
                <Text style={styles.locationText} numberOfLines={2}>{locationName}</Text>
              </View>

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
                  <TouchableOpacity
                    key={u.value}
                    style={[styles.urgencyCard, urgency === u.value && { backgroundColor: u.color + "15", borderColor: u.color }]}
                    onPress={() => setUrgency(u.value)}
                  >
                    <Ionicons name={u.icon} size={24} color={u.color} />
                    <Text style={[styles.urgencyCardLabel, urgency === u.value && { color: u.color }]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={styles.submitWrap}>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting}
                style={[styles.submitBtn, submitting && { opacity: 0.5 }]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>🆘 ĐĂNG YÊU CẦU</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main SOS Screen ──────────────────────────────
export default function SOSScreen() {
  const insets = useSafeAreaInsets();
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

  useFocusEffect(useCallback(() => {
    fetchSOS();
    fetchHelperProfile();
    getLocation();
    const socket = getSocket();
    if (!socket) return;
    const onNew = (sos) => { setSosList(prev => { if (prev.find(s => s.id === sos.id)) return prev; return [sos, ...prev]; }); };
    const onUpdated = (sos) => { setSosList(prev => prev.map(s => s.id === sos.id ? sos : s)); setMySos(prev => prev.map(s => s.id === sos.id ? sos : s)); };
    const onCancelled = ({ sosId }) => { setSosList(prev => prev.filter(s => s.id !== sosId)); };
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
      const [radarRes, mineRes] = await Promise.all([
        api.get("/sos", { params: { radius } }),
        api.get("/sos/mine"),
      ]);
      setSosList(radarRes.data?.sos || []);
      setMySos(mineRes.data?.sos || []);
    } catch (e) {}
    setLoading(false);
    setRefreshing(false);
  }

  async function fetchHelperProfile() {
    try {
      const res = await api.get("/sos/helper/profile");
      const data = res.data;
      setHelperProfile(data);
      setHelperCategories(data.categories?.map(c => c.id) || []);
      setHelperRadius(data.service_radius || 1000);
      setHelperAvailable(data.is_available !== false);
    } catch (e) {}
  }

  async function saveHelperProfile() {
    try {
      setSubmitting(true);
      const res = await api.put("/sos/helper/profile", {
        is_provider: true,
        is_available: helperAvailable,
        service_radius: helperRadius,
        category_ids: helperCategories,
      });
      setHelperProfile(res.data);
      setShowHelperModal(false);
      Alert.alert("Đã lưu", "Thông tin hỗ trợ SOS đã được cập nhật.");
    } catch (e) {
      Alert.alert("Lỗi", "Không thể lưu thông tin.");
    }
    setSubmitting(false);
  }

  function goToMyLocation() {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      }, 500);
    }
  }

  async function respondToSOS(item) {
    Alert.alert("Hỗ trợ yêu cầu này?", item.description, [
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
    const statusLabels = { OPEN: "Đang mở", MATCHING: "Đang ghép", ACCEPTED: "Đã chấp nhận", IN_PROGRESS: "Đang xử lý", COMPLETED: "Hoàn thành", CANCELLED: "Đã huỷ" };
    Alert.alert("Chi tiết SOS", `${item.description}\n\nDanh mục: ${item.category_name || "Khác"}\nTrạng thái: ${statusLabels[item.status] || item.status}\n📍 ${item.distance != null ? formatDistance(item.distance) : item.location_name || ""}\n📏 Bán kính: ${item.radius >= 1000 ? `${item.radius / 1000}km` : `${item.radius}m`}`, [
      { text: "Đóng", style: "cancel" },
    ]);
  }

  const data = tab === "radar" ? sosList : mySos;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      {/* Header background — extends below status bar */}
      <View style={[styles.headerBg, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>🆘 SOS</Text>
          <TouchableOpacity onPress={() => setShowCreate(true)} style={styles.headerCreateBtn}>
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Helper Registration Card */}
      <View style={styles.helperCard}>
        <View style={styles.helperCardLeft}>
          {helperProfile?.is_provider ? (
            <>
              <Text style={styles.helperStatus}>{helperAvailable ? "🟢 Đang nhận SOS" : "⚪ Tạm ngưng"}</Text>
              <Text style={styles.helperServices} numberOfLines={1}>
                {helperProfile.categories?.map(c => c.name).join(", ") || "Chưa chọn dịch vụ"}
              </Text>
              <Text style={styles.helperRadiusText}>📏 {helperRadius >= 1000 ? `${helperRadius / 1000}km` : `${helperRadius}m`}</Text>
            </>
          ) : (
            <>
              <Text style={styles.helperStatus}>🆘 Hỗ trợ SOS</Text>
              <Text style={styles.helperDesc}>Đăng ký để nhận các yêu cầu hỗ trợ phù hợp gần bạn.</Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[styles.helperBtn, helperProfile?.is_provider ? styles.helperBtnManage : styles.helperBtnRegister]}
          onPress={() => setShowHelperModal(true)}
        >
          <Text style={[styles.helperBtnText, helperProfile?.is_provider && { color: "#374151" }]}>{helperProfile?.is_provider ? "Quản lý" : "Đăng ký"}</Text>
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

      {/* Radar Tab */}
      {tab === "radar" ? (
        <View style={{ flex: 1 }}>
          {/* Map */}
          {userLocation ? (
            <View style={{ height: 240 }}>
              <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                provider={PROVIDER_DEFAULT}
                initialRegion={{
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                }}
                showsUserLocation
                showsMyLocationButton={false}
              >
                <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
                {sosList.filter(s => s.lat && s.lng).map(sos => (
                  <Marker key={sos.id} coordinate={{ latitude: parseFloat(sos.lat), longitude: parseFloat(sos.lng) }}
                    title={sos.category_name || "Yêu cầu hỗ trợ"} description={sos.description?.slice(0, 50)} pinColor="#EF4444" />
                ))}
                <Circle center={{ latitude: userLocation.latitude, longitude: userLocation.longitude }}
                  radius={radius} fillColor="rgba(37, 99, 235, 0.08)" strokeColor="rgba(37, 99, 235, 0.3)" strokeWidth={2} />
              </MapView>
              <TouchableOpacity style={styles.myLocBtn} onPress={goToMyLocation}>
                <Ionicons name="locate-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ height: 240, backgroundColor: "#F3F4F6", justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ fontSize: 14, color: "#6B7280", marginTop: 8 }}>Đang tải bản đồ...</Text>
            </View>
          )}

          {/* Radius selector */}
          <View style={styles.radiusBar}>
            <Text style={styles.radiusBarLabel}>Bán kính:</Text>
            <View style={styles.radiusBarChips}>
              {RADII.map(r => (
                <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); }}>
                  <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? `${r / 1000}km` : `${r}m`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* SOS List */}
          <View style={styles.sosListHeader}>
            <Text style={styles.sosListTitle}>Yêu cầu gần bạn</Text>
            <Text style={styles.sosListCount}>{sosList.length} yêu cầu</Text>
          </View>
          {loading ? (
            <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              data={sosList}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingVertical: 40, paddingHorizontal: 20 }}>
                  <Ionicons name="map-outline" size={48} color="#D1D5DB" />
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 }}>Không có yêu cầu hỗ trợ gần bạn</Text>
                  <Text style={{ fontSize: 13, color: "#9CA3AF", marginTop: 6, textAlign: "center" }}>
                    Khi có yêu cầu phù hợp trong bán kính của bạn, chúng sẽ xuất hiện tại đây.
                  </Text>
                  <TouchableOpacity onPress={() => { fetchSOS(); }} style={styles.retryBtn}>
                    <Text style={styles.retryText}>Tìm lại</Text>
                  </TouchableOpacity>
                </View>
              }
              renderItem={({ item }) => (
                <SOSCard item={item} onRespond={respondToSOS} onPress={openSOSDetail} />
              )}
            />
          )}
        </View>
      ) : (
        /* My SOS Tab */
        loading ? (
          <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.primary} /></View>
        ) : (
          <FlatList
            data={mySos}
            keyExtractor={(item) => item.id}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchSOS(); }} tintColor={colors.primary} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 16 }}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Ionicons name="flag-outline" size={48} color="#D1D5DB" />
                <Text style={{ fontSize: 16, fontWeight: "600", color: "#6B7280", marginTop: 12 }}>Bạn chưa có yêu cầu SOS nào</Text>
                <TouchableOpacity onPress={() => setShowCreate(true)} style={[styles.retryBtn, { marginTop: 16 }]}>
                  <Text style={styles.retryText}>Tạo yêu cầu</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => (
              <SOSCard item={item} onPress={openSOSDetail} isOwner />
            )}
          />
        )
      )}

      <CreateSOSModal visible={showCreate} onClose={() => setShowCreate(false)} onSubmit={() => { fetchSOS(); }} />

      {/* Helper Management Modal */}
      <Modal visible={showHelperModal} transparent animationType="slide" onRequestClose={() => setShowHelperModal(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" }}>
          <View style={[styles.helperSheet, { paddingBottom: insets.bottom }]}>
            <View style={styles.createHandle} />
            <View style={styles.createHeader}>
              <Text style={styles.createTitle}>Hỗ trợ SOS</Text>
              <TouchableOpacity onPress={() => setShowHelperModal(false)} style={styles.createCloseBtn}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
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
    </View>
  );
}

const styles = StyleSheet.create({
  // Header — background covers status bar area
  headerBg: { backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  headerCreateBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#EF4444", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  // Tab
  tabBar: { flexDirection: "row", paddingHorizontal: 20, paddingVertical: 8, backgroundColor: "#fff", gap: 8 },
  tab: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6", gap: 6 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "500", color: "#6B7280" },
  tabTextActive: { color: "#fff" },
  // Map
  myLocBtn: { position: "absolute", bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  // Radius bar
  radiusBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  radiusBarLabel: { fontSize: 13, fontWeight: "500", color: "#6B7280", marginRight: 8 },
  radiusBarChips: { flexDirection: "row", gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, color: "#6B7280", fontWeight: "500" },
  chipTextActive: { color: "#fff" },
  // SOS list header
  sosListHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, backgroundColor: "#F9FAFB" },
  sosListTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  sosListCount: { fontSize: 13, color: "#6B7280" },
  // Card
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, elevation: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 12 },
  cardAvatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  cardUserName: { fontSize: 15, fontWeight: "600", color: "#111827" },
  cardTime: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  cardDistance: { fontSize: 14, color: colors.primary, fontWeight: "600" },
  cardCategory: { flexDirection: "row", alignItems: "center", backgroundColor: colors.primaryLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: "flex-start", marginBottom: 8, gap: 6 },
  cardCategoryText: { fontSize: 13, fontWeight: "500", color: colors.primary },
  cardDesc: { fontSize: 14, color: "#374151", lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  urgencyBadge: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, gap: 4 },
  urgencyText: { fontSize: 12, fontWeight: "600" },
  cardRadius: { fontSize: 12, color: "#6B7280" },
  cardMediaRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  cardMediaThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: "#F3F4F6" },
  cardMediaMore: { fontSize: 12, color: "#6B7280", alignSelf: "center", marginLeft: 4 },
  cardResponses: { fontSize: 12, color: "#9CA3AF", marginBottom: 10 },
  respondBtn: { backgroundColor: colors.primary, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  respondText: { color: "#fff", fontWeight: "700", fontSize: 14, letterSpacing: 0.5 },
  respondedText: { fontSize: 13, color: "#22C55E", fontWeight: "600", textAlign: "center", paddingVertical: 8 },
  ownerBadge: { backgroundColor: "#F3F4F6", paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  ownerBadgeText: { fontSize: 13, color: "#6B7280", fontWeight: "500" },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  // Helper card
  helperCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginBottom: 4, padding: 14, backgroundColor: "#F0F9FF", borderRadius: 14, borderWidth: 1, borderColor: "#BFDBFE" },
  helperCardLeft: { flex: 1, marginRight: 12 },
  helperStatus: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 2 },
  helperDesc: { fontSize: 12, color: "#6B7280", lineHeight: 16, marginTop: 2 },
  helperServices: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  helperRadiusText: { fontSize: 12, color: "#6B7280", marginTop: 1 },
  helperBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  helperBtnRegister: { backgroundColor: colors.primary },
  helperBtnManage: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#D1D5DB" },
  helperBtnText: { fontSize: 13, fontWeight: "600", color: "#fff" },
  helperSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" },
  helperStatusRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  helperStatusChip: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", gap: 8 },
  helperStatusActive: { borderColor: "#22C55E", backgroundColor: "#F0FDF4" },
  helperStatusPaused: { borderColor: "#F97316", backgroundColor: "#FFF7ED" },
  helperStatusChipText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  // Create SOS
  createOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  createSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, flex: 1, maxHeight: "92%" },
  createHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginTop: 10, marginBottom: 4 },
  createHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E7EB" },
  createTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },
  createCloseBtn: { padding: 4 },
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
});