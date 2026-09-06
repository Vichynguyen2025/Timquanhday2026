import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😍", "🎉", "💯", "✨", "🚀", "🙌", "👏", "😢", "😡", "💪", "🤝"];

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, name } = route.params;
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [showEmoji, setShowEmoji] = useState(null);
  const flatListRef = useRef(null);

  // Find receiver from conversation member (not self)
  const [receiverId, setReceiverId] = useState(null);

  useEffect(() => {
    fetchMessages();
    // Get receiver info
    api.get("/conversations/" + conversationId).then((res) => {
      const members = res.data?.members || [];
      const other = members.find((m) => m.id !== user?.id);
      if (other) setReceiverId(other.id);
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
      const onDel = ({ messageId }) => setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, is_deleted: true, content: "Tin nhắn đã được thu hồi" } : m));
      const onReact = ({ messageId, reactions }) => setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
      const onType = ({ conversationId: cId }) => { if (cId === conversationId) setTyping(true); };
      const onStop = ({ conversationId: cId }) => { if (cId === conversationId) setTyping(false); };

      socket.on("message:new", onMsg);
      socket.on("message:deleted", onDel);
      socket.on("message:reaction", onReact);
      socket.on("user:typing", onType);
      socket.on("user:stop-typing", onStop);

      return () => {
        socket.off("message:new", onMsg);
        socket.off("message:deleted", onDel);
        socket.off("message:reaction", onReact);
        socket.off("user:typing", onType);
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
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    const socket = getSocket();
    if (socket) {
      socket.emit("message:send", {
        conversationId, content: text.trim(), type: "text", receiverId, tempId,
      }, (response) => {
        if (response?.success && response?.message) {
          // ACK: replace temp with real message
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...response.message, id: response.messageId, client_temp_id: tempId, status: "sent" };
              return next;
            }
            return prev;
          });
        } else if (response?.success) {
          // ACK without full message: update status only
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: response.messageId, status: "sent" } : m));
        } else {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
        }
      });
    }
  }

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const file = result.assets[0];
    const formData = new FormData();
    formData.append("image", { uri: file.uri, type: "image/jpeg", name: "photo.jpg" });
    const token = await AsyncStorage.getItem("accessToken");
    const res = await fetch("https://timquanhday.de/api/upload/image", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: formData,
    });
    const data = await res.json();
    const socket = getSocket();
    if (socket) {
      socket.emit("message:send", {
        conversationId, content: "", type: "image", receiverId,
        attachmentUrl: data.url, attachmentName: data.filename, tempId: "img_" + Date.now(),
      });
    }
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

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMine = item.sender_id === user?.id;
            const isImage = item.type === "image";
            const attUrl = item.metadata?.attachmentUrl || item.attachmentUrl;
            const reactions = item.reactions || [];
            const isFailed = item.status === "failed";
            const isSending = item.status === "sending" || item.id?.startsWith("temp_");

            return (
              <View style={[styles.msgRow, isMine ? styles.msgMine : styles.msgOther]}>
                <View style={[
                  styles.bubble,
                  isMine ? styles.bubbleMine : styles.bubbleOther,
                  isImage ? { backgroundColor: "transparent", padding: 0 } : {},
                  isSending ? { opacity: 0.7 } : {},
                  isFailed ? { borderWidth: 2, borderColor: colors.error } : {},
                ]}>
                  {item.is_deleted ? (
                    <Text style={[styles.msgText, isMine && styles.msgTextMine, { fontStyle: "italic" }]}>{item.content}</Text>
                  ) : isImage && attUrl ? (
                    <Image source={{ uri: attUrl }} style={styles.image} />
                  ) : (
                    <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
                  )}
                  <View style={[styles.timeRow, isMine ? styles.timeRowMine : styles.timeRowOther]}>
                    <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(item.created_at)}</Text>
                    {isMine && !item.is_deleted && (
                      <Text style={[styles.status, isMine && styles.statusMine]}>
                        {item.status === "failed" ? "⚠ Lỗi" : isSending ? "•" : "✓✓"}
                      </Text>
                    )}
                  </View>
                  {reactions.length > 0 && (
                    <View style={styles.reactions}>
                      {reactions.map((r, i) => <Text key={i} style={{ fontSize: 14 }}>{r.emoji}</Text>)}
                    </View>
                  )}
                  {isFailed && (
                    <TouchableOpacity onPress={() => {
                      setMessages((prev) => prev.filter((m) => m.id !== item.id));
                      setText(item.content);
                    }}>
                      <Text style={styles.retry}>Thử lại</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      {typing && <Text style={styles.typing}>Đang nhập...</Text>}
      <View style={styles.inputBar}>
        <TouchableOpacity onPress={pickImage} style={styles.inputBtn}><Ionicons name="image-outline" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={styles.inputBtn}><Ionicons name="happy-outline" size={24} color={colors.textSecondary} /></TouchableOpacity>
        <TextInput style={styles.input} placeholder="Nhập tin nhắn..." value={text} onChangeText={handleTyping} multiline />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
      </View>
      {showEmoji && (
        <View style={styles.emojiBar}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => { setShowEmoji(false); }}><Text style={styles.emoji}>{e}</Text></TouchableOpacity>
          ))}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.chatBg },
  list: { flex: 1, paddingHorizontal: 12 },
  msgRow: { marginBottom: 6, flexDirection: "row" },
  msgMine: { justifyContent: "flex-end" },
  msgOther: { justifyContent: "flex-start" },
  bubble: { maxWidth: "75%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleMine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.bubbleOther, borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: colors.text },
  msgTextMine: { color: "#fff" },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeRowMine: { justifyContent: "flex-end" },
  timeRowOther: { justifyContent: "flex-start" },
  time: { fontSize: 10, color: colors.textTertiary },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  status: { fontSize: 10, marginLeft: 4 },
  statusMine: { color: "rgba(255,255,255,0.7)" },
  image: { width: 200, height: 200, borderRadius: 12 },
  reactions: { flexDirection: "row", marginTop: 4 },
  retry: { fontSize: 11, color: colors.error, fontWeight: "600", marginTop: 4 },
  typing: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, fontStyle: "italic", color: colors.textTertiary },
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  inputBtn: { padding: 8 },
  input: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 80, marginHorizontal: 8, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  emojiBar: { flexDirection: "row", backgroundColor: colors.surface, padding: 8, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: "wrap" },
  emoji: { fontSize: 24, padding: 6 },
});