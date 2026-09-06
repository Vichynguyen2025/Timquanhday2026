import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import api from "../services/api";
import { getSocket, connectSocket } from "../services/socket";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import AsyncStorage from "@react-native-async-storage/async-storage";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😍", "🎉", "💯", "✨", "🚀", "🙌", "👏", "😢", "😡", "💪", "🤝"];

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, name } = route.params;
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmoji, setShowEmoji] = useState(null);
  const flatListRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    const socket = getSocket();
    if (!socket) return;
    socket.emit("conversation:join", { conversationId });
    socket.emit("conversation:read", { conversationId });

    const onMsg = (msg) => {
      if (msg.conversation_id === conversationId && msg.sender_id !== user?.id) {
        setMessages((prev) => (prev.find((m) => m.id === msg.id) ? prev : [...prev, msg]));
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
  }, [conversationId]);

  async function fetchMessages() {
    try {
      const res = await api.get("/messages/" + conversationId + "?limit=50");
      setMessages(res.data);
    } catch (e) {}
    setLoading(false);
  }

  async function sendMessage() {
    if (!text.trim()) return;
    const tempId = "temp_" + Date.now();
    const msg = { id: tempId, conversation_id: conversationId, sender_id: "me", content: text.trim(), type: "text", created_at: new Date().toISOString(), status: "sending" };
    setMessages((prev) => [...prev, msg]);
    setText("");
    const socket = getSocket();
    if (socket) socket.emit("message:send", { conversationId, content: text.trim(), type: "text", tempId });
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
    if (socket) socket.emit("message:send", { conversationId, content: "", type: "image", attachmentUrl: data.url });
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
            const isMine = item.sender_id === "me" || item.sender_id === "u-demo-1";
            const isImage = item.type === "image";
            const attUrl = item.metadata?.attachmentUrl;
            const reactions = item.reactions || [];
            return (
              <View style={[styles.msgRow, isMine ? styles.msgMine : styles.msgOther]}>
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {item.is_deleted ? (
                    <Text style={[styles.msgText, isMine && styles.msgTextMine, { fontStyle: "italic" }]}>{item.content}</Text>
                  ) : isImage && attUrl ? (
                    <Image source={{ uri: attUrl }} style={styles.image} />
                  ) : (
                    <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{item.content}</Text>
                  )}
                  <Text style={[styles.time, isMine && styles.timeMine]}>{formatTime(item.created_at)}</Text>
                  {reactions.length > 0 && (
                    <View style={styles.reactions}>
                      {reactions.map((r, i) => <Text key={i}>{r.emoji}</Text>)}
                    </View>
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
        <TextInput style={styles.input} placeholder="Nhập tin nhắn..." value={text} onChangeText={setText} multiline />
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
  time: { fontSize: 10, color: colors.textTertiary, marginTop: 4, textAlign: "right" },
  timeMine: { color: "rgba(255,255,255,0.7)" },
  image: { width: 200, height: 200, borderRadius: 12 },
  reactions: { flexDirection: "row", marginTop: 4 },
  typing: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, fontStyle: "italic", color: colors.textTertiary },
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  inputBtn: { padding: 8 },
  input: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 80, marginHorizontal: 8, fontSize: 15 },
  sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  emojiBar: { flexDirection: "row", backgroundColor: colors.surface, padding: 8, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: "wrap" },
  emoji: { fontSize: 24, padding: 6 },
});