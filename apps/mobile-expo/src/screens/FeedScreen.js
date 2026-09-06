import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";

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

  useFocusEffect(useCallback(() => {
    fetchPosts();
    // Listen for realtime feed events
    const socket = getSocket();
    if (!socket) return;

    const onPostNew = (post) => {
      setPosts((prev) => {
        if (prev.find((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    };
    const onPostLiked = ({ postId, liked, post }) => {
      if (post) {
        setPosts((prev) => prev.map((p) => p.id === postId ? post : p));
      } else {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: liked, like_count: liked ? p.like_count + 1 : Math.max(p.like_count - 1, 0) } : p));
      }
    };
    const onPostDeleted = ({ postId }) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    };
    const onCommentNew = ({ post_id, post }) => {
      if (post) {
        setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: post.comment_count || (p.comment_count || 0) + 1 } : p));
      } else {
        setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
      }
    };
    const onPostSaved = ({ postId, saved }) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: saved, save_count: saved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p));
    };
    const onPostShared = ({ postId }) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    };

    socket.on("post:new", onPostNew);
    socket.on("post:liked", onPostLiked);
    socket.on("post:deleted", onPostDeleted);
    socket.on("comment:new", onCommentNew);
    socket.on("post:saved", onPostSaved);
    socket.on("post:shared", onPostShared);

    return () => {
      socket.off("post:new", onPostNew);
      socket.off("post:liked", onPostLiked);
      socket.off("post:deleted", onPostDeleted);
      socket.off("comment:new", onCommentNew);
      socket.off("post:saved", onPostSaved);
      socket.off("post:shared", onPostShared);
    };
  }, [radius]));

  async function fetchPosts() {
    setLoading(true);
    try {
      const res = await api.get("/posts", { params: { radius } });
      setPosts(res.data?.posts || []);
    } catch (e) {
      setPosts([]);
    }
    setLoading(false);
  }

  function toggleLike(postId, isLiked) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max(p.like_count - 1, 0) : p.like_count + 1 } : p));
    api.post("/posts/" + postId + "/like").catch(() => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked, like_count: isLiked ? p.like_count + 1 : Math.max(p.like_count - 1, 0) } : p));
    });
  }

  function toggleSave(postId, isSaved) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: !isSaved, save_count: isSaved ? Math.max((p.save_count || 0) - 1, 0) : (p.save_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/save").catch(() => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved, save_count: isSaved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p));
    });
  }

  function handleShare(postId) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/share").catch(() => {});
  }

  function handleComment(postId) {
    // Navigate to post detail or open comment modal
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="compass-outline" size={56} color="#ccc" />
              <Text style={styles.emptyText}>Chưa có bài viết gần đây</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isImage = !!item.image_url;
            return (
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
                {isImage && (
                  <Image source={{ uri: item.image_url }} style={styles.postImage} />
                )}
                {/* Content */}
                {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}
                {/* Actions */}
                <View style={styles.postActions}>
                  <View style={styles.postActionsLeft}>
                    <TouchableOpacity onPress={() => toggleLike(item.id, item.is_liked)} style={styles.postAction}>
                      <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={22} color={item.is_liked ? "#EF4444" : "#000"} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleComment(item.id)} style={styles.postAction}>
                      <Ionicons name="chatbubble-outline" size={21} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleShare(item.id)} style={styles.postAction}>
                      <Ionicons name="paper-plane-outline" size={21} color="#000" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => toggleSave(item.id, item.is_saved)}>
                    <Ionicons name={item.is_saved ? "bookmark" : "bookmark-outline"} size={21} color={item.is_saved ? colors.primary : "#000"} />
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
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  radiusRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: "#fff" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F0F2F5" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#65676B" },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#65676B", marginTop: 12 },
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