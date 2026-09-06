import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

// ─── Seed posts ─────────────────────────────────
const SEED_POSTS = [
  {
    id: "seed-1", user_name: "Nguyễn Đức Chính", user_avatar: "N",
    content: "Buổi sáng bên hồ Hoàn Kiếm thật yên bình ☀️ Trời trong xanh, gió nhẹ.",
    image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    like_count: 24, comment_count: 5, is_liked: false,
  },
  {
    id: "seed-2", user_name: "Minh Anh", user_avatar: "M",
    content: "Cà phê sáng cùng view cực chill 🍂",
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    like_count: 18, comment_count: 3, is_liked: true,
  },
  {
    id: "seed-3", user_name: "Hoàng Nam", user_avatar: "H",
    content: "Khám phá một quán cà phê mới ở phố cổ. Không gian vintage, nhạc jazz 🎷",
    image_url: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    like_count: 31, comment_count: 8, is_liked: false,
  },
  {
    id: "seed-4", user_name: "Quỳnh Trang", user_avatar: "Q",
    content: "Chiều hoàng hôn trên sông Hương 🌅",
    image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
    like_count: 45, comment_count: 12, is_liked: false,
  },
  {
    id: "seed-5", user_name: "Đức Anh", user_avatar: "Đ",
    content: "Mới sưu tầm được một cuốn sách hay 📚",
    image_url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    like_count: 12, comment_count: 2, is_liked: true,
  },
  {
    id: "seed-6", user_name: "Linh Chi", user_avatar: "L",
    content: "Street food tour hôm nay! Bún chả Hà Nội là nhất 🍜",
    image_url: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
    like_count: 56, comment_count: 15, is_liked: false,
  },
];

const STORIES = [
  { id: "st-1", name: "Chính", color: "#2563EB" },
  { id: "st-2", name: "Anh", color: "#EC4899" },
  { id: "st-3", name: "Nam", color: "#F59E0B" },
  { id: "st-4", name: "Trang", color: "#10B981" },
  { id: "st-5", name: "Đức", color: "#8B5CF6" },
  { id: "st-6", name: "Chi", color: "#EF4444" },
  { id: "st-7", name: "Minh", color: "#06B6D4" },
  { id: "st-8", name: "Huy", color: "#F97316" },
];

const RADII = [100, 200, 500, 1000, 5000];

function formatTime(d) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(500);
  const [showRadii, setShowRadii] = useState(false);

  useFocusEffect(useCallback(() => { fetchPosts(); }, [radius]));

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await api.get("/posts", { params: { radius } });
      const apiPosts = (res.data || []).map((p) => ({
        ...p, user_name: p.user_name || p.user?.name || "Người dùng",
        image_url: p.image_url || null,
      }));
      setPosts([...SEED_POSTS, ...apiPosts]);
    } catch (e) { setPosts(SEED_POSTS); }
    setLoading(false);
  }

  function toggleLike(postId) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: !p.is_liked, like_count: p.is_liked ? p.like_count - 1 : p.like_count + 1 } : p));
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Khám phá</Text>
        <TouchableOpacity onPress={() => setShowRadii(!showRadii)}>
          <Ionicons name="options-outline" size={22} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Radius chips */}
      {showRadii && (
        <View style={styles.radiusRow}>
          {RADII.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setShowRadii(false); }}>
              <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? r / 1000 + "km" : r + "m"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPosts} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          ListHeaderComponent={
            <View style={styles.storiesRow}>
              <View style={styles.storyItem}>
                <View style={[styles.storyRing, { borderColor: colors.primary }]}>
                  <Ionicons name="add" size={24} color={colors.primary} />
                </View>
                <Text style={styles.storyName}>Tin của bạn</Text>
              </View>
              {STORIES.map((s) => (
                <View key={s.id} style={styles.storyItem}>
                  <View style={[styles.storyRing, { borderColor: s.color, borderWidth: 2.5 }]}>
                    <Text style={styles.storyAvatar}>{s.name[0]}</Text>
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>{s.name}</Text>
                </View>
              ))}
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.post}>
              {/* Header */}
              <View style={styles.postHeader}>
                <View style={styles.postAvatar}><Text style={styles.postAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
                <Text style={styles.postUserName} numberOfLines={1}>{item.user_name || "Người dùng"}</Text>
                <TouchableOpacity style={{ marginLeft: "auto" }}>
                  <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
                </TouchableOpacity>
              </View>
              {/* Image */}
              {item.image_url && (
                <Image source={{ uri: item.image_url }} style={styles.postImage} />
              )}
              {/* Content */}
              {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
              {/* Actions */}
              <View style={styles.postActions}>
                <View style={styles.postActionsLeft}>
                  <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.postAction}>
                    <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={22} color={item.is_liked ? "#EF4444" : "#000"} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction}>
                    <Ionicons name="chatbubble-outline" size={21} color="#000" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.postAction}>
                    <Ionicons name="paper-plane-outline" size={21} color="#000" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity>
                  <Ionicons name="bookmark-outline" size={21} color="#000" />
                </TouchableOpacity>
              </View>
              {/* Footer */}
              <View style={styles.postFooter}>
                <Text style={styles.likes}>{item.like_count} lượt thích</Text>
                {item.comment_count > 0 && (
                  <Text style={styles.comments}>Xem {item.comment_count} bình luận</Text>
                )}
                <Text style={styles.time}>{formatTime(item.created_at)}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  // Radius
  radiusRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: "#fff" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F0F2F5" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#65676B" },
  chipTextActive: { color: "#fff" },
  // Stories
  storiesRow: { flexDirection: "row", padding: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  storyItem: { alignItems: "center", marginRight: 14, width: 64 },
  storyRing: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", borderWidth: 2.5 },
  storyAvatar: { fontSize: 22, fontWeight: "700", color: "#000" },
  storyName: { fontSize: 11, color: "#65676B", marginTop: 4, textAlign: "center" },
  // Post
  post: { borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5", backgroundColor: "#fff" },
  postHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  postAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  postUserName: { fontSize: 14, fontWeight: "600", color: "#000", flex: 1 },
  postImage: { width: "100%", height: 380, resizeMode: "cover" },
  postContent: { fontSize: 14, color: "#000", lineHeight: 20, paddingHorizontal: 12, paddingVertical: 8 },
  postActions: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8, paddingVertical: 4 },
  postActionsLeft: { flexDirection: "row" },
  postAction: { padding: 6, marginRight: 4 },
  postFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  likes: { fontSize: 14, fontWeight: "700", color: "#000", marginBottom: 4 },
  comments: { fontSize: 14, color: "#65676B", marginBottom: 2 },
  time: { fontSize: 11, color: "#8A8D91", marginTop: 2 },
});