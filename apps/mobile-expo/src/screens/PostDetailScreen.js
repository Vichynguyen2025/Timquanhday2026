import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Image, TextInput, Alert, KeyboardAvoidingView, Platform, Dimensions, ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { colors } from "../theme/colors";
import { useAuth } from "../contexts/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

function resolveMediaUrl(post) {
  if (post.media) {
    try {
      const arr = typeof post.media === "string" ? JSON.parse(post.media) : post.media;
      if (Array.isArray(arr)) return arr.filter(i => i?.url);
    } catch (e) {}
  }
  if (post.image_url) return [{ url: post.image_url }];
  return [];
}

// ─── Media grid (single/multi) ────────────────────
function DetailMedia({ images }) {
  if (!images || images.length === 0) return null;
  const W = SCREEN_WIDTH;
  if (images.length === 1) {
    return (
      <Image
        source={{ uri: images[0].url }}
        style={{ width: W, height: 380, backgroundColor: "#F0F2F5" }}
        resizeMode="cover"
      />
    );
  }
  if (images.length === 2) {
    const half = (W - 3) / 2;
    return (
      <View style={{ flexDirection: "row", gap: 3 }}>
        {images.map((img, i) => (
          <Image key={i} source={{ uri: img.url }} style={{ width: half, height: 250, backgroundColor: "#F0F2F5" }} resizeMode="cover" />
        ))}
      </View>
    );
  }
  const half = (W - 3) / 2;
  const display = images.slice(0, 4);
  const hasMore = images.length > 4;
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
      {display.map((img, i) => (
        <View key={i} style={{ width: half, height: half }}>
          <Image source={{ uri: img.url }} style={{ width: "100%", height: "100%", backgroundColor: "#F0F2F5" }} resizeMode="cover" />
          {hasMore && i === 3 ? (
            <View style={{ ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 28, fontWeight: "700" }}>+{images.length - 4}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ─── Comment Row ─────────────────────────────────
function CommentRow({ comment, depth, flat, onReply, onDelete, onLike, formatTime }) {
  const indent = depth > 0 ? 16 : 0;
  const avatarSize = depth === 0 ? 36 : 30;
  const fontSize = depth === 0 ? 15 : 14;
  const bubblePad = depth === 0 ? 12 : 10;
  const isMine = comment.user_name === "Bạn" && !comment.is_temp;
  const liked = !!comment.is_liked;
  const likeCount = comment.like_count || 0;

  let parentName = null;
  if (comment.parent_id) {
    let cur = comment;
    let guard = 0;
    let found = null;
    while (cur?.parent_id && guard < 10) {
      const p = flat.find(c => c.id === cur.parent_id);
      if (!p) break;
      if (p.parent_id == null) { found = p; break; }
      cur = p;
      guard++;
    }
    parentName = found?.user_name || flat.find(c => c.id === comment.parent_id)?.user_name;
  }

  return (
    <View style={{ marginBottom: depth === 0 ? 14 : 6 }}>
      <View style={{ flexDirection: "row", gap: 10, marginLeft: indent }}>
        {depth > 0 ? (
          <View style={{ position: "absolute", left: -10, top: 0, bottom: 24, width: 2, backgroundColor: "#E4E6EB" }} />
        ) : null}
        <View style={[styles.commentAvatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, borderWidth: 1.5, borderColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 }]}>
          {comment.user_avatar ? (
            <Image source={{ uri: comment.user_avatar }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }} />
          ) : (
            <Text style={[styles.commentAvatarText, { fontSize: avatarSize * 0.4 }]}>{(comment.user_name || "?")[0].toUpperCase()}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.commentBubble, { padding: bubblePad }]}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 3, flexWrap: "wrap" }}>
              <Text style={[styles.commentName, { fontSize: fontSize - 1 }]}>{comment.user_name || "Người dùng"}</Text>
              {parentName ? <Text style={styles.commentReplyTo}> → {parentName}</Text> : null}
            </View>
            <Text style={[styles.commentContent, { fontSize }]}>{comment.content}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, paddingHorizontal: 4, gap: 14 }}>
            <TouchableOpacity onPress={() => onLike(comment)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={15} color={liked ? "#ED4956" : "#65676B"} />
              {likeCount > 0 ? <Text style={[styles.commentActionText, liked && { color: "#ED4956", fontWeight: "700" }]}>{likeCount}</Text> : null}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onReply(comment)}>
              <Text style={styles.commentActionText}>Trả lời</Text>
            </TouchableOpacity>
            {isMine ? (
              <TouchableOpacity onPress={() => onDelete(comment.id)}>
                <Text style={[styles.commentActionText, { color: "#EF4444" }]}>Xóa</Text>
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.commentTime, { marginLeft: "auto" }]}>{formatTime(comment.created_at)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function isDescendantOf(comment, rootId, flat) {
  let pid = comment?.parent_id;
  let guard = 0;
  while (pid && guard < 15) {
    if (pid === rootId) return true;
    const parent = flat.find(c => c.id === pid);
    if (!parent) return false;
    pid = parent.parent_id;
    guard++;
  }
  return false;
}

function CommentThread({ root, flat, onReply, onDelete, onLike, formatTime }) {
  const replies = flat
    .filter(c => c.parent_id != null && isDescendantOf(c, root.id, flat))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <View>
      <CommentRow comment={root} depth={0} flat={flat} onReply={onReply} onDelete={onDelete} onLike={onLike} formatTime={formatTime} />
      {replies.map(r => (
        <CommentRow key={r.id} comment={r} depth={1} flat={flat} onReply={onReply} onDelete={onDelete} onLike={onLike} formatTime={formatTime} />
      ))}
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────
export default function PostDetailScreen({ route, navigation }) {
  const { postId, focusComment } = route.params || {};
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentLoading, setCommentLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const commentInputRef = useRef(null);
  const listRef = useRef(null);

  const fetchPost = useCallback(async () => {
    try {
      const res = await api.get("/posts/" + postId);
      setPost(res.data);
    } catch (e) {}
    setLoading(false);
  }, [postId]);

  const fetchComments = useCallback(async () => {
    setCommentLoading(true);
    try {
      const res = await api.get("/posts/" + postId + "/comments");
      setComments(res.data || []);
    } catch (e) {}
    setCommentLoading(false);
  }, [postId]);

  useEffect(() => {
    fetchPost();
    fetchComments();
  }, [fetchPost, fetchComments]);

  // Socket: realtime comment updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onCommentNew = ({ post_id }) => {
      if (post_id === postId) {
        fetchComments();
        setPost(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev);
      }
    };
    const onCommentDeleted = ({ postId: pid }) => {
      if (pid === postId) {
        fetchComments();
        setPost(prev => prev ? { ...prev, comment_count: Math.max((prev.comment_count || 0) - 1, 0) } : prev);
      }
    };
    socket.on("comment:new", onCommentNew);
    socket.on("comment:deleted", onCommentDeleted);
    return () => {
      socket.off("comment:new", onCommentNew);
      socket.off("comment:deleted", onCommentDeleted);
    };
  }, [postId, fetchComments]);

  // Auto-focus comment input if navigated with focusComment
  useEffect(() => {
    if (focusComment) {
      setTimeout(() => commentInputRef.current?.focus(), 600);
    }
  }, [focusComment]);

  async function sendComment() {
    if (!commentText.trim() || !post) return;
    const text = commentText.trim();
    setCommentText("");
    const tempId = "temp_" + Date.now();
    const parentId = replyTo?.id || null;
    const payload = { content: text };
    if (parentId) payload.parent_id = parentId;

    setComments(prev => [
      ...prev,
      { id: tempId, content: text, user_name: "Bạn", is_temp: true, created_at: new Date().toISOString(), parent_id: parentId, is_liked: false, like_count: 0 },
    ]);
    setReplyTo(null);
    setSending(true);
    try {
      const res = await api.post("/posts/" + post.id + "/comments", payload);
      const saved = res.data;
      setComments(prev => prev.map(c =>
        c.id === tempId
          ? { ...c, ...saved, id: saved.id || c.id, parent_id: c.parent_id || saved.parent_id, is_temp: false, is_liked: false, like_count: 0 }
          : c
      ));
      setPost(prev => prev ? { ...prev, comment_count: (prev.comment_count || 0) + 1 } : prev);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setComments(prev => prev.filter(c => c.id !== tempId));
      setCommentText(text);
      Alert.alert("Lỗi", "Không thể gửi bình luận");
    }
    setSending(false);
  }

  function cancelReply() { setReplyTo(null); }

  function deleteComment(commentId) {
    Alert.alert("Xóa bình luận", "Xác nhận xóa?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => {
        setComments(prev => prev.filter(c => c.id !== commentId));
        api.delete("/posts/comments/" + commentId).catch(() => fetchComments());
      }},
    ]);
  }

  async function toggleCommentLike(comment) {
    try {
      const res = await api.post("/posts/comments/" + comment.id + "/like");
      const liked = res.data?.liked;
      const likeCount = res.data?.like_count || 0;
      setComments(prev => prev.map(c =>
        c.id === comment.id ? { ...c, is_liked: liked, like_count: likeCount } : c
      ));
    } catch (e) {}
  }

  async function togglePostLike() {
    if (!post || likeLoading) return;
    setLikeLoading(true);
    try {
      const res = await api.post("/posts/" + post.id + "/like");
      const liked = res.data?.liked;
      const updated = res.data?.post;
      setPost(prev => prev ? { ...prev, is_liked: liked, like_count: updated?.like_count ?? (prev.like_count || 0) + (liked ? 1 : -1) } : prev);
    } catch (e) {}
    setLikeLoading(false);
  }

  const media = post ? resolveMediaUrl(post) : [];
  const dist = post ? formatDistance(post.distance) : null;
  const isMyPost = post && user && post.user_id === user.id;
  const authorName = isMyPost ? (user.name || post.user_name) : (post?.user_name || "Người dùng");
  const authorAvatar = isMyPost ? (user.avatar || post?.user_avatar) : post?.user_avatar;

  // Render post header section
  const renderPostCard = () => {
    if (!post) return null;
    return (
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={styles.postAvatar}>
            {authorAvatar ? (
              <Image source={{ uri: authorAvatar }} style={styles.postAvatarImg} />
            ) : (
              <Text style={styles.postAvatarText}>{(authorName || "?")[0].toUpperCase()}</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.postUserName} numberOfLines={1}>{authorName}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 }}>
              {post.location_name ? <Text style={styles.postLocation} numberOfLines={1}>{post.location_name}</Text> : null}
              {dist ? <Text style={styles.postDistance}>📍 {dist}</Text> : null}
            </View>
          </View>
          <Text style={styles.postTime}>{formatTime(post.created_at)}</Text>
        </View>

        {/* Content */}
        {post.content ? <Text style={styles.postContent}>{post.content}</Text> : null}

        {/* Media */}
        <DetailMedia images={media} />

        {/* Action counts */}
        <View style={styles.countsRow}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="heart" size={14} color="#ED4956" />
            <Text style={styles.countsText}>{post.like_count || 0}</Text>
          </View>
          <Text style={styles.countsText}>{post.comment_count || 0} bình luận</Text>
        </View>

        {/* Actions */}
        <View style={styles.postActions}>
          <TouchableOpacity onPress={togglePostLike} style={styles.postAction}>
            <Ionicons name={post.is_liked ? "heart" : "heart-outline"} size={22} color={post.is_liked ? "#EF4444" : "#000"} />
            <Text style={[styles.postActionText, post.is_liked && { color: "#EF4444" }]}>Thích</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => commentInputRef.current?.focus()} style={styles.postAction}>
            <Ionicons name="chatbubble-outline" size={21} color="#000" />
            <Text style={styles.postActionText}>Bình luận</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.postAction}>
            <Ionicons name="paper-plane-outline" size={21} color="#000" />
            <Text style={styles.postActionText}>Chia sẻ</Text>
          </TouchableOpacity>
        </View>

        {/* Comments label */}
        <View style={styles.commentsHeader}>
          <Text style={styles.commentsTitle}>Bình luận ({post.comment_count || 0})</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="arrow-back" size={23} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bài viết</Text>
        <View style={{ width: 34 }} />
      </View>

      {loading && !post ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          ref={listRef}
          data={comments.filter(c => c.parent_id == null)}
          keyExtractor={(item, i) => item.id || item._id || `temp_${i}`}
          style={{ flex: 1 }}
          ListHeaderComponent={renderPostCard}
          contentContainerStyle={{ paddingBottom: 12 }}
          ListEmptyComponent={commentLoading ? (
            <View style={{ padding: 20, alignItems: "center" }}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <View style={{ alignItems: "center", marginTop: 20 }}>
              <Ionicons name="chatbubbles-outline" size={36} color="#ccc" />
              <Text style={{ color: "#65676B", marginTop: 8, fontSize: 14 }}>Chưa có bình luận — hãy là người đầu tiên</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <CommentThread
              root={item}
              flat={comments}
              formatTime={formatTime}
              onLike={toggleCommentLike}
              onReply={(c) => { setReplyTo({ id: c.id, name: c.user_name || "Người dùng" }); commentInputRef.current?.focus(); }}
              onDelete={deleteComment}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
        />
      )}

      {/* Reply indicator */}
      {replyTo ? (
        <View style={styles.replyIndicator}>
          <Text style={styles.replyIndicatorText}>Đang trả lời <Text style={{ fontWeight: "700" }}>{replyTo.name}</Text></Text>
          <TouchableOpacity onPress={cancelReply}><Ionicons name="close" size={18} color="#6B7280" /></TouchableOpacity>
        </View>
      ) : null}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
        <View style={styles.inputAvatar}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={{ width: 32, height: 32, borderRadius: 16 }} />
          ) : (
            <Ionicons name="person" size={18} color={colors.primary} />
          )}
        </View>
        <TextInput
          ref={commentInputRef}
          style={styles.input}
          placeholder={replyTo ? `Trả lời ${replyTo.name}...` : "Viết bình luận..."}
          placeholderTextColor="#8A8D91"
          value={commentText}
          onChangeText={setCommentText}
          multiline
        />
        <TouchableOpacity onPress={sendComment} disabled={!commentText.trim() || sending} style={[styles.sendBtn, (!commentText.trim() || sending) && { opacity: 0.4 }]}>
          {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingBottom: 10,
    backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5",
  },
  headerBack: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "700", color: "#000" },

  // Post card
  postCard: { backgroundColor: "#fff", paddingTop: 12 },
  postHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, marginBottom: 8 },
  postAvatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight,
    alignItems: "center", justifyContent: "center", marginRight: 10,
  },
  postAvatarImg: { width: 42, height: 42, borderRadius: 21 },
  postAvatarText: { fontSize: 17, fontWeight: "700", color: colors.primary },
  postUserName: { fontSize: 15, fontWeight: "700", color: "#000" },
  postLocation: { fontSize: 12, color: "#65676B" },
  postDistance: { fontSize: 12, color: "#65676B" },
  postTime: { fontSize: 12, color: "#8A8D91" },
  postContent: { fontSize: 15, lineHeight: 21, color: "#050505", paddingHorizontal: 12, marginBottom: 10 },

  // Counts + actions
  countsRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 8,
  },
  countsText: { fontSize: 13, color: "#65676B" },
  postActions: {
    flexDirection: "row", borderTopWidth: 0.5, borderBottomWidth: 0.5,
    borderColor: "#E5E5E5", paddingVertical: 4,
  },
  postAction: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8,
  },
  postActionText: { fontSize: 14, fontWeight: "600", color: "#65676B" },

  // Comments header
  commentsHeader: { paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  commentsTitle: { fontSize: 16, fontWeight: "700", color: "#050505" },

  // Comment components
  commentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontSize: 13, fontWeight: "700", color: colors.primary },
  commentBubble: { backgroundColor: "#F0F2F5", borderRadius: 18, padding: 12 },
  commentName: { fontSize: 13, fontWeight: "700", color: "#000" },
  commentReplyTo: { fontSize: 12, color: "#65676B", marginLeft: 4, fontWeight: "500" },
  commentTime: { fontSize: 11, color: "#8A8D91" },
  commentContent: { fontSize: 14, color: "#050505", lineHeight: 19 },
  commentActionText: { fontSize: 12, color: "#65676B", fontWeight: "600" },

  // Reply bar
  replyIndicator: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "#F0F9FF",
    borderTopWidth: 0.5, borderTopColor: "#E5E5E5",
  },
  replyIndicatorText: { fontSize: 13, color: "#6B7280" },

  // Input
  inputBar: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 0.5, borderTopColor: "#E5E5E5", backgroundColor: "#fff",
  },
  inputAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 8 },
  input: {
    flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 16,
    paddingVertical: 9, maxHeight: 90, fontSize: 14, color: "#000", marginRight: 8,
  },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
});