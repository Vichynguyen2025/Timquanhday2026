import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, TextInput, Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const RADII = [100, 200, 500, 1000, 5000];
const PAGE_LIMIT = 10;

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
  return new Date(d).toLocaleDateString("vi-VN");
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [radius, setRadius] = useState(500);
  const [showRadii, setShowRadii] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImage, setPostImage] = useState(null);
  const [posting, setPosting] = useState(false);
  const postsCacheRef = useRef([]);
  const cursorRef = useRef(null);

  // ─── Fetch posts ────────────────────────────────
  async function fetchPosts(loadMore = false) {
    if (loadMore) {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const params = { radius, limit: PAGE_LIMIT };
      if (loadMore && cursorRef.current) params.before = cursorRef.current;
      const res = await api.get("/posts", { params });
      const newPosts = res.data?.posts || [];
      if (loadMore) {
        setPosts(prev => {
          const merged = [...prev, ...newPosts.filter(n => !prev.find(p => p.id === n.id))];
          postsCacheRef.current = merged;
          return merged;
        });
      } else {
        setPosts(newPosts);
        postsCacheRef.current = newPosts;
      }
      setHasMore(newPosts.length >= PAGE_LIMIT);
      if (newPosts.length > 0) {
        cursorRef.current = newPosts[newPosts.length - 1].created_at;
      }
    } catch (e) {
      // Restore cache on error
      if (!loadMore && postsCacheRef.current.length > 0) {
        setPosts(postsCacheRef.current);
      }
    }
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }

  const onRefresh = () => {
    setRefreshing(true);
    cursorRef.current = null;
    fetchPosts();
  };

  // ─── Realtime socket events ─────────────────────
  useFocusEffect(useCallback(() => {
    if (!postsCacheRef.current.length) fetchPosts();
    else { setPosts(postsCacheRef.current); setLoading(false); }

    const socket = getSocket();
    if (!socket) return;

    const onPostNew = (post) => {
      setPosts((prev) => {
        if (prev.find((p) => p.id === post.id)) return prev;
        return [post, ...prev];
      });
    };
    const onPostUpdated = (post) => {
      setPosts((prev) => prev.map((p) => p.id === post.id ? post : p));
    };
    const onPostDeleted = ({ postId }) => {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    };
    const onPostLiked = ({ postId, liked, post }) => {
      if (post) {
        setPosts((prev) => prev.map((p) => p.id === postId ? post : p));
      } else {
        setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: liked, like_count: liked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p));
      }
    };
    const onCommentNew = ({ post_id, post }) => {
      if (post) {
        setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: post.comment_count || (p.comment_count || 0) + 1 } : p));
      } else {
        setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
      }
    };
    const onCommentDeleted = ({ postId }) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max((p.comment_count || 0) - 1, 0) } : p));
    };
    const onPostSaved = ({ postId, saved }) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: saved, save_count: saved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p));
    };
    const onPostShared = ({ postId }) => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    };

    socket.on("post:new", onPostNew);
    socket.on("post:updated", onPostUpdated);
    socket.on("post:deleted", onPostDeleted);
    socket.on("post:liked", onPostLiked);
    socket.on("post:unliked", onPostLiked);
    socket.on("comment:new", onCommentNew);
    socket.on("comment:deleted", onCommentDeleted);
    socket.on("post:saved", onPostSaved);
    socket.on("post:unsaved", onPostSaved);
    socket.on("post:shared", onPostShared);

    return () => {
      socket.off("post:new", onPostNew);
      socket.off("post:updated", onPostUpdated);
      socket.off("post:deleted", onPostDeleted);
      socket.off("post:liked", onPostLiked);
      socket.off("post:unliked", onPostLiked);
      socket.off("comment:new", onCommentNew);
      socket.off("comment:deleted", onCommentDeleted);
      socket.off("post:saved", onPostSaved);
      socket.off("post:unsaved", onPostSaved);
      socket.off("post:shared", onPostShared);
    };
  }, [radius]));

  // ─── Like (optimistic) ──────────────────────────
  function toggleLike(postId, isLiked) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max((p.like_count || 0) - 1, 0) : (p.like_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/like").catch(() => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked, like_count: isLiked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p));
    });
  }

  // ─── Save (optimistic) ──────────────────────────
  function toggleSave(postId, isSaved) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: !isSaved, save_count: isSaved ? Math.max((p.save_count || 0) - 1, 0) : (p.save_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/save").catch(() => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved, save_count: isSaved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p));
    });
  }

  // ─── Share (optimistic) ─────────────────────────
  function handleShare(postId) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/share").catch(() => {
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: Math.max((p.share_count || 0) - 1, 0) } : p));
    });
    Alert.alert("Đã chia sẻ", "Cảm ơn bạn đã chia sẻ bài viết!");
  }

  // ─── Comment modal ──────────────────────────────
  function openComments(post) {
    setCommentPost(post);
    setCommentText("");
    setCommentLoading(true);
    api.get("/posts/" + post.id + "/comments").then((res) => {
      setComments(res.data || []);
    }).catch(() => setComments([])).finally(() => setCommentLoading(false));
  }

  function sendComment() {
    if (!commentText.trim() || !commentPost) return;
    const text = commentText.trim();
    setCommentText("");
    setComments(prev => [...prev, { id: "temp_" + Date.now(), content: text, user_name: "Bạn", is_temp: true, created_at: new Date().toISOString() }]);
    api.post("/posts/" + commentPost.id + "/comments", { content: text }).then((res) => {
      setComments(prev => prev.map(c => c.id?.startsWith("temp_") && c.content === text ? { ...res.data, is_temp: false } : c));
    }).catch(() => {
      setComments(prev => prev.filter(c => !c.id?.startsWith("temp_")));
      setCommentText(text);
      Alert.alert("Lỗi", "Không thể gửi bình luận");
    });
  }

  function deleteComment(commentId) {
    Alert.alert("Xóa bình luận", "Xác nhận xóa?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        api.delete("/posts/comments/" + commentId).catch(() => {
          openComments(commentPost);
        });
      }},
    ]);
  }

  // ─── Create post ────────────────────────────────
  async function pickPostImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled) setPostImage(result.assets[0]);
  }

  async function submitPost() {
    if (!postContent.trim() && !postImage) return;
    setPosting(true);
    try {
      let imageUrl = null;
      if (postImage) {
        const formData = new FormData();
        formData.append("image", { uri: postImage.uri, type: "image/jpeg", name: "post.jpg" });
        const token = await AsyncStorage.getItem("accessToken");
        const uploadRes = await fetch("https://timquanhday.de/api/upload/image", {
          method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
        });
        const uploadData = await uploadRes.json();
        imageUrl = uploadData.url;
      }
      const res = await api.post("/posts", { content: postContent.trim(), imageUrl });
      const newPost = res.data;
      setPosts(prev => [newPost, ...prev]);
      setShowCreatePost(false);
      setPostContent("");
      setPostImage(null);
    } catch (e) {
      Alert.alert("Lỗi", "Không thể đăng bài viết");
    }
    setPosting(false);
  }

  // ─── Delete post ────────────────────────────────
  function deletePost(postId) {
    Alert.alert("Xóa bài viết", "Xác nhận xóa bài viết?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => {
        setPosts(prev => prev.filter(p => p.id !== postId));
        api.delete("/posts/" + postId).catch(() => fetchPosts());
      }},
    ]);
  }

  // ─── Render post ────────────────────────────────
  const renderPost = ({ item }) => {
    const isImage = !!item.image_url;
    const isOwner = item.is_owner;
    return (
      <View style={styles.post}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}><Text style={styles.postAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
          <Text style={styles.postUserName} numberOfLines={1}>{item.user_name || "Người dùng"}</Text>
          <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => {
            if (isOwner) {
              Alert.alert("Tuỳ chọn", "", [
                { text: "Xóa bài viết", style: "destructive", onPress: () => deletePost(item.id) },
                { text: "Huỷ", style: "cancel" },
              ]);
            }
          }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
          </TouchableOpacity>
        </View>

        {/* Image with lightbox */}
        {isImage && (
          <TouchableOpacity activeOpacity={0.95} onPress={() => setLightboxUrl(item.image_url)}>
            <Image source={{ uri: item.image_url }} style={styles.postImage} />
          </TouchableOpacity>
        )}

        {/* Content */}
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

        {/* Actions */}
        <View style={styles.postActions}>
          <View style={styles.postActionsLeft}>
            <TouchableOpacity onPress={() => toggleLike(item.id, item.is_liked)} style={styles.postAction}>
              <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={22} color={item.is_liked ? "#EF4444" : "#000"} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openComments(item)} style={styles.postAction}>
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
          <Text style={styles.likes}>{item.like_count || 0} lượt thích</Text>
          {item.comment_count > 0 && (
            <TouchableOpacity onPress={() => openComments(item)}>
              <Text style={styles.comments}>Xem {item.comment_count} bình luận</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  // ─── Render loader ──────────────────────────────
  const renderFooter = () => {
    if (!loadingMore) return null;
    return <View style={{ paddingVertical: 20 }}><ActivityIndicator color={colors.primary} /></View>;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Khám phá</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          <TouchableOpacity onPress={() => setShowCreatePost(true)} style={styles.headerBtn}>
            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowRadii(!showRadii)} style={styles.headerBtn}>
            <Ionicons name="options-outline" size={22} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Radius chips */}
      {showRadii && (
        <View style={styles.radiusRow}>
          {RADII.map((r) => (
            <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setShowRadii(false); cursorRef.current = null; }}>
              <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? r / 1000 + "km" : r + "m"}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Feed */}
      {loading && posts.length === 0 ? (
        <View style={{ paddingTop: 40 }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          onEndReached={() => fetchPosts(true)}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="compass-outline" size={56} color="#ccc" />
              <Text style={styles.emptyText}>Chưa có bài viết gần đây</Text>
              <TouchableOpacity onPress={() => { cursorRef.current = null; fetchPosts(); }} style={styles.retryBtn}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={renderPost}
        />
      )}

      {/* ─── Image Lightbox ──────────────────────── */}
      <Modal visible={!!lightboxUrl} transparent onRequestClose={() => setLightboxUrl(null)}>
        <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl && <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" />}
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxUrl(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ─── Comment Modal ───────────────────────── */}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <View style={styles.commentOverlay}>
          <View style={styles.commentSheet}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeaderTitle}>Bình luận</Text>
              <TouchableOpacity onPress={() => setCommentPost(null)}><Ionicons name="close" size={22} color="#000" /></TouchableOpacity>
            </View>
            {commentLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item, i) => item.id || String(i)}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 12 }}
                ListEmptyComponent={<Text style={{ textAlign: "center", color: "#65676B", marginTop: 20 }}>Chưa có bình luận</Text>}
                renderItem={({ item }) => (
                  <View style={styles.commentItem}>
                    <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Text style={styles.commentName}>{item.user_name || "Người dùng"}</Text>
                        <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
                      </View>
                      <Text style={styles.commentContent}>{item.content}</Text>
                    </View>
                    {item.user_name === "Bạn" && !item.is_temp && (
                      <TouchableOpacity onPress={() => deleteComment(item.id)}><Ionicons name="trash-outline" size={18} color="#EF4444" /></TouchableOpacity>
                    )}
                  </View>
                )}
              />
            )}
            <View style={styles.commentInputBar}>
              <TextInput
                style={styles.commentInput}
                placeholder="Viết bình luận..."
                placeholderTextColor="#8A8D91"
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity onPress={sendComment} disabled={!commentText.trim()} style={[styles.commentSend, !commentText.trim() && { opacity: 0.4 }]}>
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Create Post Modal ──────────────────── */}
      <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
        <View style={styles.commentOverlay}>
          <View style={styles.commentSheet}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeaderTitle}>Tạo bài viết</Text>
              <TouchableOpacity onPress={() => { setShowCreatePost(false); setPostContent(""); setPostImage(null); }}><Ionicons name="close" size={22} color="#000" /></TouchableOpacity>
            </View>
            <View style={{ padding: 16, flex: 1 }}>
              <TextInput
                style={styles.createInput}
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#8A8D91"
                value={postContent}
                onChangeText={setPostContent}
                multiline
              />
              {postImage && (
                <View style={{ marginTop: 12 }}>
                  <Image source={{ uri: postImage.uri }} style={{ width: "100%", height: 200, borderRadius: 12 }} />
                  <TouchableOpacity onPress={() => setPostImage(null)} style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, padding: 4 }}>
                    <Ionicons name="close" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={pickPostImage} style={styles.createImageBtn}>
                <Ionicons name="image-outline" size={24} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 8, fontWeight: "500" }}>Thêm ảnh</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={submitPost} disabled={(!postContent.trim() && !postImage) || posting} style={[styles.createSubmit, (!postContent.trim() && !postImage) && { opacity: 0.4 }]}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Đăng</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "700", color: "#000" },
  headerBtn: { padding: 6 },
  radiusRow: { flexDirection: "row", paddingHorizontal: 12, paddingBottom: 10, backgroundColor: "#fff" },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F0F2F5" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: "#65676B" },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: "#65676B", marginTop: 12 },
  retryBtn: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.primary },
  retryText: { color: "#fff", fontWeight: "600" },
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
  // Lightbox
  lightboxOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  lightboxImage: { width: "100%", height: "100%" },
  lightboxClose: { position: "absolute", top: 60, right: 20, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
  // Comment
  commentOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  commentSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, height: "75%", paddingBottom: 20 },
  commentHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5E5", alignSelf: "center", marginTop: 10, marginBottom: 8 },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  commentHeaderTitle: { fontSize: 17, fontWeight: "700", color: "#000" },
  commentItem: { flexDirection: "row", marginBottom: 14, gap: 10 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  commentName: { fontSize: 13, fontWeight: "600", color: "#000" },
  commentTime: { fontSize: 11, color: "#8A8D91", marginLeft: 8 },
  commentContent: { fontSize: 14, color: "#333", marginTop: 2, lineHeight: 18 },
  commentInputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: "#E5E5E5" },
  commentInput: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 80, fontSize: 14, color: "#000" },
  commentSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  // Create post
  createInput: { backgroundColor: "#F0F2F5", borderRadius: 12, padding: 16, fontSize: 15, color: "#000", minHeight: 120, textAlignVertical: "top" },
  createImageBtn: { flexDirection: "row", alignItems: "center", marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: "#F0F2F5" },
  createSubmit: { backgroundColor: colors.primary, padding: 16, alignItems: "center", marginHorizontal: 16, marginBottom: 20, borderRadius: 12 },
});