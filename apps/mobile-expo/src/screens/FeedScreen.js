import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

// ─── Seed data (Instagram-style) ─────────────────
const SEED_POSTS = [
  {
    id: "seed-1",
    user_name: "Nguyễn Đức Chính",
    user_avatar: "N",
    content: "Buổi sáng bên hồ Hoàn Kiếm thật yên bình ☀️ Trời trong xanh, gió nhẹ. Hãy tận hưởng những khoảnh khắc đẹp của cuộc sống!",
    image_url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    like_count: 24,
    comment_count: 5,
    is_liked: false,
  },
  {
    id: "seed-2",
    user_name: "Minh Anh",
    user_avatar: "M",
    content: "Cà phê sáng cùng view cực chill 🍂",
    image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    like_count: 18,
    comment_count: 3,
    is_liked: true,
  },
  {
    id: "seed-3",
    user_name: "Hoàng Nam",
    user_avatar: "H",
    content: "Khám phá một quán cà phê mới ở phố cổ. Không gian vintage, nhạc jazz nhẹ nhàng 🎷",
    image_url: "https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
    like_count: 31,
    comment_count: 8,
    is_liked: false,
  },
  {
    id: "seed-4",
    user_name: "Quỳnh Trang",
    user_avatar: "Q",
    content: "Chiều hoàng hôn trên sông Hương 🌅 Một màu cam rực rỡ phủ khắp mặt nước. Thật đẹp và bình yên.",
    image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 400).toISOString(),
    like_count: 45,
    comment_count: 12,
    is_liked: false,
  },
  {
    id: "seed-5",
    user_name: "Đức Anh",
    user_avatar: "Đ",
    content: "Mới sưu tầm được một cuốn sách hay. Có ai muốn đọc cùng không? 📚",
    image_url: "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 600).toISOString(),
    like_count: 12,
    comment_count: 2,
    is_liked: true,
  },
  {
    id: "seed-6",
    user_name: "Linh Chi",
    user_avatar: "L",
    content: "Street food tour hôm nay! Bún chả Hà Nội là nhất 🍜",
    image_url: "https://images.unsplash.com/photo-1555126634-323283e090fa?w=800",
    created_at: new Date(Date.now() - 1000 * 60 * 900).toISOString(),
    like_count: 56,
    comment_count: 15,
    is_liked: false,
  },
];

// ─── Stories data ───────────────────────────────
const STORIES = [
  { id: "st-1", name: "Chính", avatar: "C", color: "#FF6B6B" },
  { id: "st-2", name: "Anh", avatar: "A", color: "#4ECDC4" },
  { id: "st-3", name: "Nam", avatar: "N", color: "#45B7D1" },
  { id: "st-4", name: "Trang", avatar: "T", color: "#F7DC6F" },
  { id: "st-5", name: "Đức", avatar: "Đ", color: "#BB8FCE" },
  { id: "st-6", name: "Chi", avatar: "C", color: "#F1948A" },
  { id: "st-7", name: "Minh", avatar: "M", color: "#82E0AA" },
  { id: "st-8", name: "Huy", avatar: "H", color: "#85C1E9" },
];

// ─── Radius options ──────────────────────────────
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
      // Merge API posts with seed data
      const apiPosts = (res.data || []).map((p) => ({
        ...p,
        user_name: p.user_name || p.user?.name || "Người dùng",
        user_avatar: (p.user_name || p.user?.name || "?")[0].toUpperCase(),
        image_url: p.image_url || null,
      }));
      // Show seed posts first, then API posts
      const merged = [...SEED_POSTS, ...apiPosts];
      setPosts(merged);
    } catch (e) {
      // If API fails, show only seed data
      setPosts(SEED_POSTS);
    }
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
        <TouchableOpacity onPress={() => setShowRadii(!showRadii)} style={styles.radiusToggle}>
          <Ionicons name="options-outline" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Radius chips (collapsible) */}
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
                <View style={[styles.storyCircle, { borderColor: colors.primary, borderWidth: 2.5 }]}>
                  <Ionicons name="add" size={28} color={colors.primary} />
                </View>
                <Text style={styles.storyName}>Tin của bạn</Text>
              </View>
              {STORIES.map((s) => (
                <TouchableOpacity key={s.id} style={styles.storyItem}>
                  <View style={[styles.storyCircle, { borderColor: s.color, borderWidth: 2.5 }]}>
                    <Text style={styles.storyAvatar}>{s.avatar}</Text>
                  </View>
                  <Text style={styles.storyName} numberOfLines={1}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          }
          renderItem={({ item }) => {
            const timeAgo = formatTime(item.created_at);
            const isImage = !!item.image_url;

            return (
              <View style={styles.postCard}>
                {/* Post header */}
                <View style={styles.postHeader}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>{item.user_avatar || (item.user_name || "?")[0].toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.postUserName}>{item.user_name || "Người dùng"}</Text>
                    <Text style={styles.postTime}>{timeAgo}</Text>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>

                {/* Post image */}
                {isImage && (
                  <Image source={{ uri: item.image_url }} style={styles.postImage} />
                )}

                {/* Post content */}
                {item.content ? (
                  <Text style={styles.postContent}>{item.content}</Text>
                ) : null}

                {/* Post actions */}
                <View style={styles.postActions}>
                  <View style={styles.postActionsLeft}>
                    <TouchableOpacity onPress={() => toggleLike(item.id)} style={styles.postAction}>
                      <Ionicons
                        name={item.is_liked ? "heart" : "heart-outline"}
                        size={24}
                        color={item.is_liked ? colors.error : colors.text}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.postAction}>
                      <Ionicons name="paper-plane-outline" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity>
                    <Ionicons name="bookmark-outline" size={22} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* Likes + comments */}
                <View style={styles.postFooter}>
                  <Text style={styles.likesText}>{item.like_count} lượt thích</Text>
                  {item.comment_count > 0 && (
                    <Text style={styles.commentsText}>Xem tất cả {item.comment_count} bình luận</Text>
                  )}
                  <Text style={styles.timeText}>{timeAgo}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  // Header
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#000" },
  title: { fontSize: 24, fontWeight: "700", color: "#fff" },
  radiusToggle: { padding: 6 },
  // Radius
  radiusRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: "#111" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#222" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#aaa" },
  chipTextActive: { color: "#fff" },
  // Stories
  storiesRow: { flexDirection: "row", padding: 12, backgroundColor: "#000", borderBottomWidth: 0.5, borderBottomColor: "#222" },
  storyItem: { alignItems: "center", marginRight: 16, width: 64 },
  storyCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#1a1a1a" },
  storyAvatar: { fontSize: 24, fontWeight: "700", color: "#fff" },
  storyName: { fontSize: 11, color: "#aaa", marginTop: 4, textAlign: "center" },
  // Post card
  postCard: { marginBottom: 0, backgroundColor: "#000", borderBottomWidth: 0.5, borderBottomColor: "#222" },
  postHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  postAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  postUserName: { fontSize: 14, fontWeight: "600", color: "#fff" },
  postTime: { fontSize: 11, color: "#888", marginTop: 1 },
  // Image
  postImage: { width: "100%", height: 400, resizeMode: "cover" },
  // Content
  postContent: { fontSize: 14, color: "#fff", lineHeight: 20, paddingHorizontal: 12, paddingVertical: 8 },
  // Actions
  postActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4 },
  postActionsLeft: { flexDirection: "row", alignItems: "center" },
  postAction: { padding: 6, marginRight: 4 },
  // Footer
  postFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  likesText: { fontSize: 14, fontWeight: "700", color: "#fff", marginBottom: 4 },
  commentsText: { fontSize: 14, color: "#888", marginBottom: 4 },
  timeText: { fontSize: 11, color: "#555", marginTop: 2 },
});