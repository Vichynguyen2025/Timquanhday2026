import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image, Modal, TextInput, Alert, KeyboardAvoidingView, Platform, Dimensions, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const RADII = [100, 200, 500, 1000, 5000];
const PAGE_LIMIT = 10;
const IMG_GAP = 3;

// Deduplicate posts by id (ensures no duplicate keys in FlatList)
function dedupPosts(arr) {
  if (!arr || arr.length === 0) return arr || [];
  const seen = new Set();
  return arr.filter(p => { if (!p?.id || seen.has(p.id)) return false; seen.add(p.id); return true; });
}

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

function formatDistance(km) {
  if (km == null) return null;
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

// ─── Multi-image grid ─────────────────────────────
function MediaGrid({ images, onImagePress }) {
  if (!images || images.length === 0) return null;
  const count = images.length;
  const W = SCREEN_WIDTH - 24; // 12px padding each side

  if (count === 1) {
    return (
      <TouchableOpacity activeOpacity={0.95} onPress={() => onImagePress(0)}>
        <Image source={{ uri: images[0].url || images[0] }} style={{ width: W, height: 380, resizeMode: "cover" }} />
      </TouchableOpacity>
    );
  }
  if (count === 2) {
    const half = (W - IMG_GAP) / 2;
    return (
      <View style={{ flexDirection: "row", gap: IMG_GAP, paddingHorizontal: 12 }}>
        {images.map((img, i) => (
          <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => onImagePress(i)} style={{ flex: 1 }}>
            <Image source={{ uri: img.url || img }} style={{ width: "100%", height: 250, resizeMode: "cover" }} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }
  if (count === 3) {
    const bigW = W * 0.6;
    const smallW = W * 0.4 - IMG_GAP;
    return (
      <View style={{ flexDirection: "row", gap: IMG_GAP, paddingHorizontal: 12 }}>
        <TouchableOpacity activeOpacity={0.95} onPress={() => onImagePress(0)}>
          <Image source={{ uri: images[0].url || images[0] }} style={{ width: bigW, height: 250, resizeMode: "cover" }} />
        </TouchableOpacity>
        <View style={{ gap: IMG_GAP }}>
          {[1, 2].map((i) => (
            <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => onImagePress(i)}>
              <Image source={{ uri: images[i].url || images[i] }} style={{ width: smallW, height: (250 - IMG_GAP) / 2, resizeMode: "cover" }} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  // 4+ images: grid 2x2
  const half = (W - IMG_GAP) / 2;
  const displayImgs = images.slice(0, 4);
  const hasMore = images.length > 4;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: IMG_GAP, paddingHorizontal: 12 }}>
      {displayImgs.map((img, i) => (
        <TouchableOpacity key={i} activeOpacity={0.95} onPress={() => onImagePress(i)} style={{ width: half, height: half }}>
          <Image source={{ uri: img.url || img }} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          {hasMore && i === 3 && (
            <View style={{ ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>+{images.length - 4}</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Image Gallery (fullscreen swipe) ────────────
function ImageGallery({ images, initialIndex, visible, onClose }) {
  const [idx, setIdx] = useState(initialIndex || 0);
  const flatRef = useRef(null);

  useEffect(() => { setIdx(initialIndex || 0); }, [initialIndex]);

  const allImages = images?.map(i => i.url || i) || [];

  if (!visible || allImages.length === 0) return null;

  return (
    <Modal visible transparent onRequestClose={onClose}>
      <View style={styles.galleryOverlay}>
        <TouchableOpacity style={styles.galleryClose} onPress={onClose}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.galleryCounter}>{idx + 1}/{allImages.length}</Text>
        <FlatList
          ref={flatRef}
          data={allImages}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={idx}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => (
            <View style={{ width: SCREEN_WIDTH, height: "100%", justifyContent: "center", alignItems: "center" }}>
              <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: "80%" }} resizeMode="contain" />
            </View>
          )}
          keyExtractor={(item, i) => String(i)}
        />
      </View>
    </Modal>
  );
}

// ─── Main FeedScreen ─────────────────────────────
export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [radius, setRadius] = useState(500);
  const [showRadii, setShowRadii] = useState(false);
  // Gallery
  const [galleryImages, setGalleryImages] = useState([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryVisible, setGalleryVisible] = useState(false);
  // Comment
  const [commentPost, setCommentPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState(null);
  // Create post
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [postImages, setPostImages] = useState([]);
  const [posting, setPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const postsCacheRef = useRef([]);
  const cursorRef = useRef(null);
  const commentInputRef = useRef(null);

  // Deduplicated posts for FlatList rendering (safety net against duplicate keys)
  const dedupedPosts = useMemo(() => dedupPosts(posts), [posts]);

  // ─── Fetch posts ────────────────────────────────
  async function fetchPosts(loadMore = false) {
    if (loadMore) { if (loadingMore || !hasMore) return; setLoadingMore(true); }
    else { setLoading(true); }
    try {
      const params = { radius, limit: PAGE_LIMIT };
      if (loadMore && cursorRef.current) params.before = cursorRef.current;
      const res = await api.get("/posts", { params });
      const newPosts = res.data?.posts || [];
      if (loadMore) {
        setPosts(prev => { const merged = [...prev, ...newPosts.filter(n => !prev.find(p => p.id === n.id))]; postsCacheRef.current = merged; return merged; });
      } else { setPosts(newPosts); postsCacheRef.current = newPosts; }
      setHasMore(newPosts.length >= PAGE_LIMIT);
      if (newPosts.length > 0) cursorRef.current = newPosts[newPosts.length - 1].created_at;
    } catch (e) {
      if (!loadMore && postsCacheRef.current.length > 0) setPosts(postsCacheRef.current);
    }
    setLoading(false); setRefreshing(false); setLoadingMore(false);
  }

  const onRefresh = () => { setRefreshing(true); cursorRef.current = null; fetchPosts(); };

  // ─── Realtime socket events ─────────────────────
  useFocusEffect(useCallback(() => {
    if (!postsCacheRef.current.length) fetchPosts();
    else { setPosts(postsCacheRef.current); setLoading(false); }
    const socket = getSocket();
    if (!socket) return;
    const onPostNew = (post) => {
      if (!post?.id) return;
      setPosts((prev) => {
        if (prev.find((p) => p.id === post.id || p.client_temp_id === post.client_temp_id)) return prev;
        return [post, ...prev];
      });
    };
    const onPostUpdated = (post) => { setPosts((prev) => prev.map((p) => p.id === post.id ? post : p)); };
    const onPostDeleted = ({ postId }) => { setPosts((prev) => prev.filter((p) => p.id !== postId)); };
    const onPostLiked = ({ postId, liked, post }) => {
      if (post) setPosts((prev) => prev.map((p) => p.id === postId ? post : p));
      else setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: liked, like_count: liked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p));
    };
    const onCommentNew = ({ post_id, post }) => {
      if (post) setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: post.comment_count || (p.comment_count || 0) + 1 } : p));
      else setPosts((prev) => prev.map((p) => p.id === post_id ? { ...p, comment_count: (p.comment_count || 0) + 1 } : p));
    };
    const onCommentDeleted = ({ postId }) => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: Math.max((p.comment_count || 0) - 1, 0) } : p)); };
    const onPostSaved = ({ postId, saved }) => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: saved, save_count: saved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p)); };
    const onPostShared = ({ postId }) => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p)); };
    socket.on("post:new", onPostNew); socket.on("post:updated", onPostUpdated); socket.on("post:deleted", onPostDeleted);
    socket.on("post:liked", onPostLiked); socket.on("post:unliked", onPostLiked);
    socket.on("comment:new", onCommentNew); socket.on("comment:deleted", onCommentDeleted);
    socket.on("post:saved", onPostSaved); socket.on("post:unsaved", onPostSaved); socket.on("post:shared", onPostShared);
    return () => {
      socket.off("post:new", onPostNew); socket.off("post:updated", onPostUpdated); socket.off("post:deleted", onPostDeleted);
      socket.off("post:liked", onPostLiked); socket.off("post:unliked", onPostLiked);
      socket.off("comment:new", onCommentNew); socket.off("comment:deleted", onCommentDeleted);
      socket.off("post:saved", onPostSaved); socket.off("post:unsaved", onPostSaved); socket.off("post:shared", onPostShared);
    };
  }, [radius]));

  // ─── Like (optimistic) ──────────────────────────
  function toggleLike(postId, isLiked) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked: !isLiked, like_count: isLiked ? Math.max((p.like_count || 0) - 1, 0) : (p.like_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/like").catch(() => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_liked, like_count: isLiked ? (p.like_count || 0) + 1 : Math.max((p.like_count || 0) - 1, 0) } : p)); });
  }

  function toggleSave(postId, isSaved) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved: !isSaved, save_count: isSaved ? Math.max((p.save_count || 0) - 1, 0) : (p.save_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/save").catch(() => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, is_saved, save_count: isSaved ? (p.save_count || 0) + 1 : Math.max((p.save_count || 0) - 1, 0) } : p)); });
  }

  function handleShare(postId) {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: (p.share_count || 0) + 1 } : p));
    api.post("/posts/" + postId + "/share").catch(() => { setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, share_count: Math.max((p.share_count || 0) - 1, 0) } : p)); });
    Alert.alert("Đã chia sẻ", "Cảm ơn bạn!");
  }

  // ─── Comment ────────────────────────────────────
  function openComments(post) {
    setCommentPost(post); setCommentText(""); setCommentLoading(true); setCommentError(null);
    api.get("/posts/" + post.id + "/comments").then((res) => { setComments(res.data || []); })
      .catch(() => { setCommentError("Không thể tải bình luận"); setComments([]); })
      .finally(() => setCommentLoading(false));
  }

  function sendComment() {
    if (!commentText.trim() || !commentPost) return;
    const text = commentText.trim(); setCommentText("");
    const tempId = "temp_" + Date.now();
    setComments(prev => [...prev, { id: tempId, content: text, user_name: "Bạn", is_temp: true, created_at: new Date().toISOString() }]);
    api.post("/posts/" + commentPost.id + "/comments", { content: text })
      .then((res) => { setComments(prev => prev.map(c => c.id === tempId ? { ...res.data, is_temp: false } : c)); })
      .catch(() => { setComments(prev => prev.filter(c => c.id !== tempId)); setCommentText(text); Alert.alert("Lỗi", "Không thể gửi bình luận"); });
  }

  function deleteComment(commentId) {
    Alert.alert("Xóa bình luận", "Xác nhận xóa?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        api.delete("/posts/comments/" + commentId).catch(() => { openComments(commentPost); });
      }},
    ]);
  }

  // ─── Gallery ────────────────────────────────────
  function openGallery(images, index) {
    setGalleryImages(images); setGalleryIndex(index); setGalleryVisible(true);
  }

  function getMediaArray(post) {
    if (post.media) {
      try { return typeof post.media === "string" ? JSON.parse(post.media) : post.media; } catch {}
    }
    if (post.image_url) return [{ url: post.image_url }];
    return [];
  }

  // ─── Create Post ────────────────────────────────
  async function pickPostImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsMultipleSelection: true });
    if (!result.canceled) setPostImages(prev => [...prev, ...result.assets]);
  }

  function removePostImage(idx) {
    setPostImages(prev => prev.filter((_, i) => i !== idx));
  }

  async function submitPost() {
    if (!postContent.trim() && postImages.length === 0) return;
    setPosting(true); setUploadProgress("Đang tải ảnh...");
    try {
      let media = [];
      for (const img of postImages) {
        const formData = new FormData();
        formData.append("image", { uri: img.uri, type: "image/jpeg", name: "post.jpg" });
        const token = await AsyncStorage.getItem("accessToken");
        const uploadRes = await fetch("https://timquanhday.de/api/upload/image", {
          method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
        });
        const uploadData = await uploadRes.json();
        media.push({ url: uploadData.url });
      }
      setUploadProgress("Đang đăng...");
      const res = await api.post("/posts", { content: postContent.trim(), media: media.length > 0 ? media : undefined });
      setPosts(prev => [res.data, ...prev]);
      setShowCreatePost(false); setPostContent(""); setPostImages([]);
    } catch (e) { Alert.alert("Lỗi", "Không thể đăng bài viết"); }
    setPosting(false); setUploadProgress(null);
  }

  function deletePost(postId) {
    Alert.alert("Xóa bài viết", "Xác nhận xóa?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => { setPosts(prev => prev.filter(p => p.id !== postId)); api.delete("/posts/" + postId).catch(() => fetchPosts()); }},
    ]);
  }

  // ─── Render post ────────────────────────────────
  const renderPost = ({ item }) => {
    const media = getMediaArray(item);
    const dist = formatDistance(item.distance);
    return (
      <View style={styles.post}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}><Text style={styles.postAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postUserName} numberOfLines={1}>{item.user_name || "Người dùng"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
              {item.location_name && <Text style={styles.postLocation} numberOfLines={1}>{item.location_name}</Text>}
              {dist && <Text style={styles.postDistance}>📍 {dist}</Text>}
            </View>
          </View>
          <TouchableOpacity style={{ marginLeft: "auto" }} onPress={() => {
            Alert.alert("Tuỳ chọn", "", [
              { text: "Xóa bài viết", style: "destructive", onPress: () => deletePost(item.id) },
              { text: "Huỷ", style: "cancel" },
            ]);
          }}>
            <Ionicons name="ellipsis-horizontal" size={20} color="#65676B" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        {item.content ? <Text style={styles.postContent}>{item.content}</Text> : null}

        {/* Media Grid */}
        <MediaGrid images={media} onImagePress={(idx) => openGallery(media, idx)} />

        {/* Actions */}
        <View style={styles.postActions}>
          <View style={styles.postActionsLeft}>
            <TouchableOpacity onPress={() => toggleLike(item.id, item.is_liked)} style={styles.postAction}>
              <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={22} color={item.is_liked ? "#EF4444" : "#000"} />
            </TouchableOpacity>
            <Text style={styles.actionCount}>{item.like_count || 0}</Text>
            <TouchableOpacity onPress={() => openComments(item)} style={styles.postAction}>
              <Ionicons name="chatbubble-outline" size={21} color="#000" />
            </TouchableOpacity>
            <Text style={styles.actionCount}>{item.comment_count || 0}</Text>
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
            <TouchableOpacity onPress={() => openComments(item)}><Text style={styles.comments}>Xem {item.comment_count} bình luận</Text></TouchableOpacity>
          )}
          <Text style={styles.time}>{formatTime(item.created_at)}</Text>
        </View>
      </View>
    );
  };

  const renderFooter = () => loadingMore ? <View style={{ paddingVertical: 20 }}><ActivityIndicator color={colors.primary} /></View> : null;

  // ─── Create Post Composer (header of Feed) ─────
  const renderCreatePostComposer = () => (
    <TouchableOpacity style={styles.composerRow} activeOpacity={0.7} onPress={() => setShowCreatePost(true)}>
      <View style={styles.composerAvatar}><Ionicons name="person" size={18} color={colors.primary} /></View>
      <Text style={styles.composerText}>Bạn đang nghĩ gì?</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        <TouchableOpacity onPress={() => { setShowCreatePost(true); }} style={styles.composerIcon}>
          <Ionicons name="image-outline" size={20} color="#41B35D" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Khám phá</Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
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
          data={dedupedPosts}
          keyExtractor={(item, index) => item.id ? `${item.id}-${index}` : String(index)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
          onEndReached={() => fetchPosts(true)}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderCreatePostComposer}
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

      {/* ─── Image Gallery ────────────────────────── */}
      <ImageGallery images={galleryImages} initialIndex={galleryIndex} visible={galleryVisible} onClose={() => setGalleryVisible(false)} />

      {/* ─── Comment Modal ────────────────────────── */}
      <Modal visible={!!commentPost} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setCommentPost(null)} />
          <View style={styles.commentSheet}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeaderTitle}>Bình luận ({commentPost?.comment_count || 0})</Text>
              <TouchableOpacity onPress={() => setCommentPost(null)}><Ionicons name="close" size={22} color="#000" /></TouchableOpacity>
            </View>
            {commentLoading ? (
              <View style={{ padding: 20 }}><ActivityIndicator color={colors.primary} /></View>
            ) : commentError ? (
              <View style={{ padding: 20, alignItems: "center" }}>
                <Text style={{ color: "#EF4444", marginBottom: 12 }}>{commentError}</Text>
                <TouchableOpacity onPress={() => commentPost && openComments(commentPost)} style={styles.retryBtn}><Text style={styles.retryText}>Thử lại</Text></TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item, i) => item.id || String(i)}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                ListEmptyComponent={
                  <View style={{ alignItems: "center", marginTop: 30 }}>
                    <Ionicons name="chatbubbles-outline" size={40} color="#ccc" />
                    <Text style={{ color: "#65676B", marginTop: 8, fontSize: 14 }}>Chưa có bình luận</Text>
                  </View>
                }
                renderItem={({ item }) => {
                  const isReply = !!item.parent_id;
                  return (
                    <View style={[styles.commentItem, isReply && { marginLeft: 40 }]}>
                      <View style={styles.commentAvatar}><Text style={styles.commentAvatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
                      <View style={styles.commentBubble}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                          <Text style={styles.commentName}>{item.user_name || "Người dùng"}</Text>
                          <Text style={styles.commentTime}>{formatTime(item.created_at)}</Text>
                        </View>
                        <Text style={styles.commentContent}>{item.content}</Text>
                      </View>
                      {item.user_name === "Bạn" && !item.is_temp && (
                        <TouchableOpacity onPress={() => deleteComment(item.id)} style={{ padding: 4 }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                }}
              />
            )}
            <View style={styles.commentInputBar}>
              <TextInput
                ref={commentInputRef}
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
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Create Post Modal ──────────────────── */}
      <Modal visible={showCreatePost} transparent animationType="slide" onRequestClose={() => setShowCreatePost(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => { setShowCreatePost(false); setPostContent(""); setPostImages([]); }} />
          <View style={styles.commentSheet}>
            <View style={styles.commentHandle} />
            <View style={styles.commentHeader}>
              <Text style={styles.commentHeaderTitle}>Tạo bài viết</Text>
              <TouchableOpacity onPress={() => { setShowCreatePost(false); setPostContent(""); setPostImages([]); }}><Ionicons name="close" size={22} color="#000" /></TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
              <TextInput
                style={styles.createInput}
                placeholder="Bạn đang nghĩ gì?"
                placeholderTextColor="#8A8D91"
                value={postContent}
                onChangeText={setPostContent}
                multiline
              />
              {postImages.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
                  {postImages.map((img, i) => (
                    <View key={i} style={{ position: "relative" }}>
                      <Image source={{ uri: img.uri }} style={{ width: (SCREEN_WIDTH - 56) / 3, height: (SCREEN_WIDTH - 56) / 3, borderRadius: 8 }} />
                      <TouchableOpacity onPress={() => removePostImage(i)} style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, width: 24, height: 24, alignItems: "center", justifyContent: "center" }}>
                        <Ionicons name="close" size={14} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
              <TouchableOpacity onPress={pickPostImage} style={styles.createImageBtn}>
                <Ionicons name="image-outline" size={24} color="#41B35D" />
                <Text style={{ color: "#65676B", marginLeft: 8, fontWeight: "500", flex: 1 }}>Thêm ảnh</Text>
              </TouchableOpacity>
              {uploadProgress && (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12, gap: 8 }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ color: colors.primary, fontSize: 13 }}>{uploadProgress}</Text>
                </View>
              )}
            </ScrollView>
            <TouchableOpacity onPress={submitPost} disabled={(!postContent.trim() && postImages.length === 0) || posting} style={[styles.createSubmit, (!postContent.trim() && postImages.length === 0) && { opacity: 0.4 }]}>
              {posting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "600", fontSize: 16 }}>Đăng</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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
  // Create Post Composer
  composerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  composerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  composerText: { flex: 1, fontSize: 14, color: "#8A8D91", marginLeft: 10 },
  composerIcon: { padding: 6 },
  // Post
  post: { borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5", backgroundColor: "#fff" },
  postHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10 },
  postAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  postAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  postUserName: { fontSize: 14, fontWeight: "600", color: "#000" },
  postLocation: { fontSize: 11, color: "#65676B" },
  postDistance: { fontSize: 11, color: colors.primary },
  postContent: { fontSize: 14, color: "#000", lineHeight: 20, paddingHorizontal: 12, paddingVertical: 8 },
  postActions: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, marginTop: 4 },
  postActionsLeft: { flexDirection: "row", alignItems: "center" },
  postAction: { padding: 6, marginRight: 2 },
  actionCount: { fontSize: 13, color: "#65676B", marginRight: 8 },
  postFooter: { paddingHorizontal: 12, paddingBottom: 12 },
  likes: { fontSize: 14, fontWeight: "700", color: "#000", marginBottom: 4 },
  comments: { fontSize: 14, color: "#65676B", marginBottom: 2 },
  time: { fontSize: 11, color: "#8A8D91", marginTop: 2 },
  // Gallery
  galleryOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  galleryClose: { position: "absolute", top: 60, right: 20, zIndex: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 20, padding: 8 },
  galleryCounter: { position: "absolute", top: 64, left: 20, zIndex: 10, color: "#fff", fontSize: 16, fontWeight: "600" },
  // Comment
  commentSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", minHeight: "50%" },
  commentHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5E5", alignSelf: "center", marginTop: 10, marginBottom: 8 },
  commentHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  commentHeaderTitle: { fontSize: 17, fontWeight: "700", color: "#000" },
  commentItem: { flexDirection: "row", marginBottom: 12, gap: 8 },
  commentAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  commentBubble: { backgroundColor: "#F0F2F5", borderRadius: 16, padding: 10, flex: 1 },
  commentName: { fontSize: 13, fontWeight: "600", color: "#000" },
  commentTime: { fontSize: 10, color: "#8A8D91", marginLeft: 8 },
  commentContent: { fontSize: 14, color: "#333", lineHeight: 18 },
  commentInputBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: "#E5E5E5", backgroundColor: "#fff" },
  commentInput: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 80, fontSize: 14, color: "#000" },
  commentSend: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  // Create post
  createInput: { backgroundColor: "#F0F2F5", borderRadius: 12, padding: 16, fontSize: 15, color: "#000", minHeight: 120, textAlignVertical: "top" },
  createImageBtn: { flexDirection: "row", alignItems: "center", marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: "#F0F2F5" },
  createSubmit: { backgroundColor: colors.primary, padding: 16, alignItems: "center", marginHorizontal: 16, marginBottom: 20, borderRadius: 12 },
});