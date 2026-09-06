import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😍", "🎉", "💯", "✨", "🚀", "🙌", "👏", "😢", "😡", "💪", "🤝"];

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, name } = route.params;
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [reactionMsgId, setReactionMsgId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    api.get("/conversations/" + conversationId).then((res) => {
      const members = res.data?.members || [];
      const other = members.find((m) => m.id !== user?.id);
      if (other) { setReceiverId(other.id); setOtherUser(other); }
    }).catch(() => {});

    const socket = getSocket();
    if (socket) {
      socket.emit("conversation:join", { conversationId });
      socket.emit("conversation:read", { conversationId });

      const onMsg = (msg) => {
        if (msg.conversation_id === conversationId) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id || m.client_temp_id === msg.client_temp_id)) return prev;
            return [...prev, msg];
          });
        }
      };
      const onDel = ({ messageId, conversationId: cId }) => {
        if (cId === conversationId) setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_deleted: true, content: "Tin nhắn đã được thu hồi" } : m));
      };
      const onReact = ({ messageId, conversationId: cId, reactions }) => {
        if (cId === conversationId) setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
      };
      const onType = ({ conversationId: cId }) => { if (cId === conversationId) setTyping(true); };
      const onStop = ({ conversationId: cId }) => { if (cId === conversationId) setTyping(false); };

      socket.on("message:new", onMsg);
      socket.on("message:deleted", onDel);
      socket.on("message:reaction", onReact);
      socket.on("user:typing", onType);
      socket.on("user:stop-typing", onStop);
      return () => {
        socket.off("message:new", onMsg); socket.off("message:deleted", onDel);
        socket.off("message:reaction", onReact); socket.off("user:typing", onType);
        socket.off("user:stop-typing", onStop);
        socket.emit("conversation:leave", { conversationId });
      };
    }
  }, [conversationId, user?.id]);

  async function fetchMessages() {
    try {
      const res = await api.get("/messages/" + conversationId + "?limit=50");
      setMessages(res.data);
    } catch (e) {}
    setLoading(false);
  }

  function sendMessage() {
    if (!text.trim() || !user?.id) return;
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const optimisticMsg = {
      id: tempId, conversation_id: conversationId, sender_id: user.id,
      content: text.trim(), type: "text", created_at: new Date().toISOString(),
      status: "sending", client_temp_id: tempId, sender_name: user.name,
      reply_to_id: replyTo?.id || null,
      reply_preview: replyTo ? { id: replyTo.id, content: replyTo.content, sender_id: replyTo.sender_id, is_deleted: false } : null,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    setReplyTo(null);
    const socket = getSocket();
    if (socket) {
      socket.emit("message:send", {
        conversationId, content: text.trim(), type: "text", receiverId, tempId,
        replyToId: replyTo?.id || null,
      }, (response) => {
        if (response?.success && response?.message) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
            if (idx >= 0) { const next = [...prev]; next[idx] = { ...response.message, id: response.messageId, client_temp_id: tempId, status: "sent" }; return next; }
            return prev;
          });
        } else if (response?.success) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: response.messageId, status: "sent" } : m));
        } else {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
        }
      });
    }
  }

  function deleteMessage(msgId) {
    Alert.alert("Thu hồi tin nhắn", "Bạn có chắc muốn thu hồi tin nhắn này?", [
      { text: "Huỷ", style: "cancel" },
      { text: "Thu hồi", style: "destructive", onPress: () => {
        const socket = getSocket();
        if (socket) socket.emit("message:delete", { messageId: msgId, conversationId });
      }},
    ]);
  }

  function toggleReaction(msgId, emoji) {
    const socket = getSocket();
    if (socket) socket.emit("message:react", { messageId: msgId, conversationId, emoji });
    setReactionMsgId(null);
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    setUploading(true);
    const file = result.assets[0];
    const formData = new FormData();
    formData.append("image", { uri: file.uri, type: "image/jpeg", name: "photo.jpg" });
    const token = await AsyncStorage.getItem("accessToken");
    try {
      const res = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      const socket = getSocket();
      if (socket) {
        socket.emit("message:send", {
          conversationId, content: "", type: "image", receiverId,
          attachmentUrl: data.url, attachmentName: data.filename, tempId: "img_" + Date.now(),
        });
      }
    } catch (e) {}
    setUploading(false);
  }

  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      setUploading(true);
      const file = result.assets[0];
      const formData = new FormData();
      formData.append("file", { uri: file.uri, type: file.mimeType || "application/octet-stream", name: file.name });
      const token = await AsyncStorage.getItem("accessToken");
      const res = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      const socket = getSocket();
      if (socket) {
        socket.emit("message:send", {
          conversationId, content: file.name, type: "file", receiverId,
          attachmentUrl: data.url, attachmentName: file.name, tempId: "file_" + Date.now(),
        });
      }
    } catch (e) {}
    setUploading(false);
  }

  function handleTyping(val) {
    setText(val);
    if (!receiverId) return;
    const socket = getSocket();
    if (socket) socket.emit("typing:start", { conversationId, receiverId });
  }

  function formatTime(d) {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Vừa xong";
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });
  }

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === user?.id;
    const isImage = item.type === "image";
    const isFile = item.type === "file";
    const attUrl = item.metadata?.attachmentUrl || item.attachmentUrl;
    const reactions = item.reactions || [];
    const isFailed = item.status === "failed";
    const isSending = item.status === "sending" || item.id?.startsWith("temp_");
    const noBubble = isImage || isFile;

    return (
      <View style={[styles.msgWrap, isMine ? styles.msgMine : styles.msgOther]}>
        {/* Reply preview */}
        {item.reply_preview && !item.reply_preview.is_deleted && (
          <View style={[styles.replyPreview, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
            <View style={[styles.replyBar, isMine ? { backgroundColor: "#fff" } : { backgroundColor: colors.primary }]} />
            <View style={styles.replyContent}>
              <Text style={[styles.replyLabel, isMine ? { color: colors.primary } : { color: "#fff" }]}>Đang trả lời</Text>
              <Text style={[styles.replyText, isMine ? { color: colors.textSecondary } : { color: "rgba(255,255,255,0.7)" }]} numberOfLines={1}>{item.reply_preview.content}</Text>
            </View>
          </View>
        )}
        {/* Message bubble */}
        <View style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleOther,
          noBubble ? { backgroundColor: "transparent", padding: 0, elevation: 0 } : {},
          isSending ? { opacity: 0.7 } : {},
          isFailed ? { borderWidth: 1.5, borderColor: colors.error } : {},
        ]}>
          {item.is_deleted ? (
            <Text style={[styles.msgText, isMine && styles.msgTextMine, { fontStyle: "italic", opacity: 0.5 }]}>{item.content}</Text>
          ) : isImage && attUrl ? (
            <Image source={{ uri: attUrl }} style={styles.image} />
          ) : isFile && attUrl ? (
            <View style={styles.fileCard}>
              <View style={styles.fileIcon}><Ionicons name="document-outline" size={24} color={colors.primary} /></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.fileName, isMine && { color: "#fff" }]} numberOfLines={1}>{item.content || "File"}</Text>
                <Text style={[styles.fileSize, isMine && { color: "rgba(255,255,255,0.6)" }]}>File đính kèm</Text>
              </View>
            </View>
          ) : (
            <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
          )}
          {/* Time + status */}
          <View style={[styles.timeRow, isMine && styles.timeRowMine]}>
            <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(item.created_at)}</Text>
            {isMine && !item.is_deleted && (
              <Text style={[styles.status, isMine && styles.statusMine]}>
                {item.status === "failed" ? "⚠" : isSending ? "○" : "✓✓"}
              </Text>
            )}
          </View>
          {/* Reactions */}
          {reactions.length > 0 && (
            <View style={[styles.reactions, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
              {reactions.map((r, i) => <Text key={i} style={{ fontSize: 15 }}>{r.emoji}</Text>)}
            </View>
          )}
          {/* Retry */}
          {isFailed && (
            <TouchableOpacity onPress={() => { setMessages((prev) => prev.filter((m) => m.id !== item.id)); setText(item.content); }}>
              <Text style={styles.retry}>Thử lại</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Actions (hover equivalent): reply, react, delete */}
        {!item.is_deleted && !isSending && (
          <View style={[styles.msgActions, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
            <TouchableOpacity onPress={() => setReplyTo({ id: item.id, content: item.content, sender_id: item.sender_id })} style={styles.actionBtn}>
              <Ionicons name="arrow-undo" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setReactionMsgId(reactionMsgId === item.id ? null : item.id)} style={styles.actionBtn}>
              <Ionicons name="happy-outline" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
            {isMine && (
              <TouchableOpacity onPress={() => deleteMessage(item.id)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
              </TouchableOpacity>
            )}
          </View>
        )}
        {/* Inline emoji picker */}
        {reactionMsgId === item.id && (
          <View style={[styles.emojiPicker, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => toggleReaction(item.id, e)}>
                <Text style={styles.emojiItem}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const initial = (otherUser?.name || "?")[0].toUpperCase();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}>
      {/* Header */}
      <View style={[styles.chatHeader, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initial}</Text>
          {otherUser?.is_online === 1 && <View style={styles.headerOnline} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{otherUser?.name || name || "Đoạn chat"}</Text>
          <Text style={styles.headerStatus}>{typing ? "Đang nhập..." : otherUser?.is_online === 1 ? "Đang hoạt động" : ""}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={26} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingVertical: 12, paddingBottom: 12 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderMessage}
        />
      )}
      {typing && <Text style={styles.typing}>Đang nhập...</Text>}

      {/* Reply bar */}
      {replyTo && (
        <View style={styles.replyBarContainer}>
          <View style={styles.replyBarInner}>
            <Ionicons name="arrow-undo" size={16} color={colors.primary} />
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.replyBarLabel}>Đang trả lời</Text>
              <Text style={styles.replyBarContent} numberOfLines={1}>{replyTo.content}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={20} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity onPress={pickFile} style={styles.inputBtn}><Ionicons name="paperclip" size={22} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={pickImage} style={styles.inputBtn}><Ionicons name="image-outline" size={22} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={styles.inputBtn}><Ionicons name="happy-outline" size={22} color={colors.textSecondary} /></TouchableOpacity>
        <TextInput style={styles.input} placeholder="Nhập tin nhắn..." value={text} onChangeText={handleTyping} multiline />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
      </View>

      {/* Emoji bar */}
      {showEmoji && (
        <View style={[styles.emojiBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => { setText((prev) => prev + e); setShowEmoji(false); }}>
              <Text style={styles.emojiItem}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Uploading indicator */}
      {uploading && (
        <View style={styles.uploadingOverlay}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.uploadingText}>Đang tải file...</Text>
        </View>
      )}

      {/* User Info Modal */}
      <Modal visible={showInfo} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalAvatar}>
              <Text style={styles.modalAvatarText}>{initial}</Text>
            </View>
            <Text style={styles.modalName}>{otherUser?.name || "Người dùng"}</Text>
            <View style={styles.modalOnline}>
              <View style={[styles.dot, { backgroundColor: otherUser?.is_online === 1 ? colors.online : colors.textTertiary }]} />
              <Text style={styles.modalOnlineText}>{otherUser?.is_online === 1 ? "Đang hoạt động" : "Không hoạt động"}</Text>
            </View>
            {otherUser?.bio ? <Text style={styles.modalBio}>{otherUser.bio}</Text> : null}
            <View style={styles.modalInfoRow}>
              <Ionicons name="person-outline" size={20} color={colors.textTertiary} />
              <Text style={styles.modalInfoText}>{otherUser?.name}</Text>
            </View>
            {otherUser?.email ? (
              <View style={styles.modalInfoRow}>
                <Ionicons name="mail-outline" size={20} color={colors.textTertiary} />
                <Text style={styles.modalInfoText}>{otherUser.email}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.chatBg },
  // Header
  chatHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 10, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBack: { padding: 6 },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  headerAvatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  headerOnline: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.online, borderWidth: 2, borderColor: "#fff", position: "absolute", bottom: -1, right: -1 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 16, fontWeight: "600", color: colors.text },
  headerStatus: { fontSize: 12, color: colors.textTertiary, marginTop: 1 },
  headerBtn: { padding: 6 },
  // Messages
  list: { flex: 1, paddingHorizontal: 12 },
  msgWrap: { marginBottom: 8 },
  msgMine: { alignItems: "flex-end" },
  msgOther: { alignItems: "flex-start" },
  bubble: { maxWidth: "78%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4, elevation: 1, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  msgText: { fontSize: 15, color: colors.text, lineHeight: 20 },
  msgTextMine: { color: "#fff" },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeRowMine: { justifyContent: "flex-end" },
  time: { fontSize: 10, color: colors.textTertiary },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  status: { fontSize: 10, marginLeft: 4 },
  statusMine: { color: "rgba(255,255,255,0.7)" },
  // Image
  image: { width: 220, height: 220, borderRadius: 16, backgroundColor: colors.chatBg },
  // File
  fileCard: { flexDirection: "row", alignItems: "center", minWidth: 180 },
  fileIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "rgba(37,99,235,0.1)", alignItems: "center", justifyContent: "center" },
  fileName: { fontSize: 14, fontWeight: "500", color: colors.text },
  fileSize: { fontSize: 12, color: colors.textTertiary, marginTop: 2 },
  // Reactions
  reactions: { flexDirection: "row", marginTop: 4, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: colors.border, elevation: 1 },
  // Retry
  retry: { fontSize: 12, color: colors.error, fontWeight: "600", marginTop: 4 },
  // Actions
  msgActions: { flexDirection: "row", marginTop: 2, gap: 2 },
  actionBtn: { padding: 6, backgroundColor: "#fff", borderRadius: 8, elevation: 1, marginHorizontal: 2 },
  // Emoji picker
  emojiPicker: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, padding: 6, borderWidth: 1, borderColor: colors.border, marginTop: 4, elevation: 3 },
  emojiItem: { fontSize: 26, paddingHorizontal: 4 },
  // Reply preview inline
  replyPreview: { flexDirection: "row", marginBottom: 2, maxWidth: "78%" },
  replyBar: { width: 3, borderRadius: 2 },
  replyContent: { marginLeft: 6, flex: 1 },
  replyLabel: { fontSize: 11, fontWeight: "600" },
  replyText: { fontSize: 11, marginTop: 1 },
  // Typing
  typing: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, fontStyle: "italic", color: colors.textTertiary },
  // Reply bar container
  replyBarContainer: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 },
  replyBarInner: { flexDirection: "row", alignItems: "center" },
  replyBarLabel: { fontSize: 12, fontWeight: "600", color: colors.primary },
  replyBarContent: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
  // Input
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  inputBtn: { padding: 8 },
  input: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, maxHeight: 80, marginHorizontal: 6, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  emojiBar: { flexDirection: "row", backgroundColor: colors.surface, padding: 8, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: "wrap", justifyContent: "center" },
  // Uploading
  uploadingOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.3)", alignItems: "center", justifyContent: "center" },
  uploadingText: { marginTop: 8, fontSize: 14, color: "#fff", fontWeight: "600" },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: "center" },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 20 },
  modalAvatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalAvatarText: { fontSize: 28, fontWeight: "700", color: colors.primary },
  modalName: { fontSize: 20, fontWeight: "700", color: colors.text },
  modalOnline: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  modalOnlineText: { fontSize: 14, color: colors.textSecondary },
  modalBio: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: 12, paddingHorizontal: 20, lineHeight: 20 },
  modalInfoRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border + "80", marginTop: 4 },
  modalInfoText: { fontSize: 15, color: colors.text, marginLeft: 12 },
  modalClose: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 12, backgroundColor: colors.primaryLight },
  modalCloseText: { fontSize: 16, fontWeight: "600", color: colors.primary },
});