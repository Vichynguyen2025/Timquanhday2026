import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, Alert, Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😍", "🎉", "💯", "✨", "🚀", "🙌", "👏", "😢", "😡", "💪", "🤝"];

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, name } = route.params;
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docName, setDocName] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Realtime presence: check if other user is online
  const isOnline = otherUser?.id ? onlineUsers.has(otherUser.id) : (otherUser?.is_online === 1);

  useEffect(() => {
    fetchMessages();
    api.get("/conversations/" + conversationId).then((res) => {
      const members = res.data?.members || [];
      const other = members.find((m) => m.id !== user?.id);
      if (other) { setReceiverId(other.id); setOtherUser(other); }
    }).catch(() => {});

    // Keyboard listeners
    const showSub = Keyboard.addListener("keyboardWillShow", (e) => {
      setKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardVisible(false);
    });

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
      socket.on("message:new", onMsg); socket.on("message:deleted", onDel);
      socket.on("message:reaction", onReact); socket.on("user:typing", onType);
      socket.on("user:stop-typing", onStop);
      return () => {
        showSub.remove();
        hideSub.remove();
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
    setShowEmoji(false);
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

  function sendEmoji(emoji) {
    if (!user?.id) return;
    const tempId = "temp_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    const optimisticMsg = {
      id: tempId, conversation_id: conversationId, sender_id: user.id,
      content: emoji, type: "text", created_at: new Date().toISOString(),
      status: "sending", client_temp_id: tempId, sender_name: user.name,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setShowEmoji(false);
    const socket = getSocket();
    if (socket) {
      socket.emit("message:send", {
        conversationId, content: emoji, type: "text", receiverId, tempId,
      }, (response) => {
        if (response?.success && response?.message) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
            if (idx >= 0) { const next = [...prev]; next[idx] = { ...response.message, id: response.messageId, client_temp_id: tempId, status: "sent" }; return next; }
            return prev;
          });
        } else if (response?.success) {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, id: response.messageId, status: "sent" } : m));
        }
      });
    }
  }

  function handleLongPress(msg) {
    if (msg.is_deleted || msg.id?.startsWith("temp_")) return;
    const isMine = msg.sender_id === user?.id;
    const options = [
      { text: "Trả lời", onPress: () => setReplyTo({ id: msg.id, content: msg.content, sender_id: msg.sender_id }) },
      { text: "Thả cảm xúc", onPress: () => {
        Alert.alert("Chọn cảm xúc", "", EMOJIS.map((e) => ({
          text: e, onPress: () => {
            const socket = getSocket();
            if (socket) socket.emit("message:react", { messageId: msg.id, conversationId, emoji: e });
          },
        })).concat([{ text: "Huỷ", style: "cancel" }]));
      }},
    ];
    if (isMine) {
      options.push({ text: "Thu hồi", style: "destructive", onPress: () => {
        Alert.alert("Thu hồi tin nhắn", "Xác nhận thu hồi?", [
          { text: "Huỷ", style: "cancel" },
          { text: "Thu hồi", style: "destructive", onPress: () => {
            const socket = getSocket(); if (socket) socket.emit("message:delete", { messageId: msg.id, conversationId });
          }},
        ]);
      }});
    }
    Alert.alert("Tin nhắn", "", options);
  }

  // ── Image picker + preview ──
  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled) return;
    const file = result.assets[0];
    setSelectedImage(file);
    setPreviewUrl(file.uri);
    setSelectedDoc(null);
    setDocName(null);
  }

  function cancelAttachment() {
    setSelectedImage(null);
    if (previewUrl) { URL.revokeObjectURL?.(previewUrl); }
    setPreviewUrl(null);
    setSelectedDoc(null);
    setDocName(null);
    setUploadProgress(null);
  }

  // ── Send image ──
  async function sendImage() {
    if (!selectedImage || !user?.id) return;
    setUploading(true);
    setUploadProgress("Đang tải lên...");
    const tempId = "img_" + Date.now();
    const optimisticMsg = {
      id: tempId, conversation_id: conversationId, sender_id: user.id,
      content: "", type: "image", metadata: { attachmentUrl: previewUrl },
      created_at: new Date().toISOString(), status: "uploading", client_temp_id: tempId, sender_name: user.name,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    cancelAttachment();

    const formData = new FormData();
    formData.append("image", { uri: selectedImage.uri, type: "image/jpeg", name: "photo.jpg" });
    const token = await AsyncStorage.getItem("accessToken");
    try {
      setUploadProgress("Đang tải ảnh...");
      const res = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "sending", metadata: { ...m.metadata, attachmentUrl: data.url } } : m));
      setUploadProgress("Đang gửi...");
      const socket = getSocket();
      if (socket) {
        socket.emit("message:send", {
          conversationId, content: "", type: "image", receiverId, tempId,
          attachmentUrl: data.url, attachmentName: data.filename,
        }, (response) => {
          if (response?.success) {
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
              if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], id: response.messageId, status: "sent" }; return next; }
              return prev;
            });
          } else {
            setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
          }
        });
      }
    } catch (e) {
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
    }
    setUploading(false);
    setUploadProgress(null);
  }

  // ── Pick file + send ──
  async function pickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setSelectedDoc(file);
      setDocName(file.name);
      setSelectedImage(null);
      setPreviewUrl(null);
      // Auto-send file
      setUploading(true);
      setUploadProgress("Đang tải file...");
      const tempId = "file_" + Date.now();
      const optimisticMsg = {
        id: tempId, conversation_id: conversationId, sender_id: user.id,
        content: file.name, type: "file", created_at: new Date().toISOString(),
        status: "uploading", client_temp_id: tempId, sender_name: user.name,
        metadata: { attachmentName: file.name, attachmentSize: file.size },
      };
      setMessages((prev) => [...prev, optimisticMsg]);
      setSelectedDoc(null);
      setDocName(null);

      const formData = new FormData();
      formData.append("file", { uri: file.uri, type: file.mimeType || "application/octet-stream", name: file.name });
      const token = await AsyncStorage.getItem("accessToken");
      const res = await fetch("https://timquanhday.de/api/upload/image", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      setUploadProgress("Đang gửi...");
      const socket = getSocket();
      if (socket) {
        socket.emit("message:send", {
          conversationId, content: file.name, type: "file", receiverId, tempId,
          attachmentUrl: data.url, attachmentName: file.name,
        }, (response) => {
          if (response?.success) {
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
              if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], id: response.messageId, status: "sent" }; return next; }
              return prev;
            });
          } else {
            setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed" } : m));
          }
        });
      }
    } catch (e) {}
    setUploading(false);
    setUploadProgress(null);
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

  const initial = (otherUser?.name || name || "?")[0].toUpperCase();
  const statusText = typing ? "Đang nhập..." : isOnline ? "Đang hoạt động" : "Không hoạt động";

  const renderMessage = ({ item }) => {
    const isMine = item.sender_id === user?.id;
    const isImage = item.type === "image";
    const isFile = item.type === "file";
    const attUrl = item.metadata?.attachmentUrl || item.attachmentUrl;
    const reactions = item.reactions || [];
    const isFailed = item.status === "failed";
    const isSending = item.status === "sending" || item.id?.startsWith("temp_");
    const isUploading = item.status === "uploading";

    return (
      <View style={[styles.msgWrap, isMine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}>
        {item.reply_preview && !item.reply_preview.is_deleted && (
          <View style={[styles.replyPreview, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
            <View style={[styles.replyBar, isMine ? { backgroundColor: "#fff" } : { backgroundColor: colors.primary }]} />
            <View style={styles.replyContent}>
              <Text style={[styles.replyLabel, isMine ? { color: "#fff" } : { color: colors.primary }]}>Trả lời</Text>
              <Text style={[styles.replyText, isMine ? { color: "rgba(255,255,255,0.7)" } : { color: "#65676B" }]} numberOfLines={1}>{item.reply_preview.content}</Text>
            </View>
          </View>
        )}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
          {!isMine && !isImage && <View style={styles.msgAvatar}><Text style={styles.msgAvatarText}>{(otherUser?.name || "?")[0].toUpperCase()}</Text></View>}
          <View style={{ maxWidth: "82%" }}>
            {item.is_deleted ? (
              <Text style={[styles.deletedText, isMine && { textAlign: "right" }]}>{item.content}</Text>
            ) : (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
                style={[
                  styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther,
                  isImage ? { backgroundColor: "transparent", padding: 0, elevation: 0 } : {},
                  (isSending || isUploading) ? { opacity: 0.65 } : {},
                  isFailed ? { borderWidth: 1, borderColor: "#EF4444" } : {},
                ]}
              >
                {item.reply_preview && !item.reply_preview.is_deleted && (
                  <View style={[styles.inlineReply, isMine ? { borderLeftColor: "rgba(255,255,255,0.5)" } : { borderLeftColor: colors.primary }]}>
                    <Text style={[styles.inlineReplyText, isMine ? { color: "rgba(255,255,255,0.7)" } : { color: "#65676B" }]} numberOfLines={1}>{item.reply_preview.content}</Text>
                  </View>
                )}
                {isImage && attUrl ? (
                  <Image source={{ uri: attUrl }} style={styles.image} />
                ) : isFile ? (
                  <View style={styles.fileRow}>
                    <Ionicons name="document-outline" size={22} color={isMine ? "#fff" : colors.primary} />
                    <Text style={[styles.fileText, isMine && { color: "#fff" }]} numberOfLines={1}>{item.content || "File"}</Text>
                  </View>
                ) : (
                  <Text style={[styles.msgText, isMine && { color: "#fff" }]}>{item.content}</Text>
                )}
                <View style={[styles.timeRow, isMine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
                  <Text style={[styles.time, isMine && { color: "rgba(255,255,255,0.6)" }]}>{formatTime(item.created_at)}</Text>
                  {isMine && !item.is_deleted && (
                    <Text style={[styles.status, isMine && { color: "rgba(255,255,255,0.6)" }]}>
                      {isFailed ? "⚠" : isUploading ? "↑" : isSending ? "" : "✓✓"}
                    </Text>
                  )}
                </View>
                {reactions.length > 0 && (
                  <View style={[styles.reactions, isMine ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
                    {reactions.map((r, i) => <Text key={i} style={{ fontSize: 14 }}>{r.emoji}</Text>)}
                  </View>
                )}
                {isFailed && (
                  <TouchableOpacity onPress={() => { setMessages((prev) => prev.filter((m) => m.id !== item.id)); setText(item.content); }}>
                    <Text style={styles.retry}>Thử lại</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      {/* Header with realtime presence */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <Ionicons name="chevron-back" size={26} color={colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>{initial}</Text>
          {isOnline && <View style={styles.headerOnline} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{otherUser?.name || name || "Đoạn chat"}</Text>
          <Text style={[styles.headerStatus, isOnline && { color: colors.online }]}>{statusText}</Text>
        </View>
        <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerBtn}>
          <Ionicons name="information-circle-outline" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12, paddingBottom: 8 }}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          renderItem={renderMessage}
        />
      )}
      {typing && <Text style={styles.typing}>Đang nhập...</Text>}

      {/* Attachment Preview Bar */}
      {(previewUrl || selectedDoc) && (
        <View style={styles.previewBar}>
          {previewUrl ? (
            <>
              <Image source={{ uri: previewUrl }} style={styles.previewImage}
                onError={(e) => console.log("Preview error:", e.nativeEvent?.error)}
              />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName} numberOfLines={1}>{selectedImage?.fileName || selectedImage?.name || "Ảnh"}</Text>
                <Text style={styles.previewSize}>Sẵn sàng gửi</Text>
              </View>
            </>
          ) : selectedDoc ? (
            <>
              <View style={styles.previewFileIcon}>
                <Ionicons name="document-outline" size={24} color={colors.primary} />
              </View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewName} numberOfLines={1}>{docName}</Text>
                <Text style={styles.previewSize}>File đính kèm</Text>
              </View>
            </>
          ) : null}
          <View style={styles.previewActions}>
            <TouchableOpacity onPress={previewUrl ? sendImage : pickFile} style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
              <Text style={[styles.previewBtnText, { color: "#fff" }]}>Gửi</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={cancelAttachment} style={styles.previewBtn}>
              <Ionicons name="close" size={18} color="#65676B" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upload progress bar */}
      {uploadProgress && (
        <View style={styles.progressBar}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.progressText}>{uploadProgress}</Text>
        </View>
      )}

      {/* Reply bar */}
      {replyTo && (
        <View style={styles.replyBarContainer}>
          <View style={styles.replyBarInner}>
            <View style={styles.replyLeft}>
              <Ionicons name="arrow-undo" size={14} color={colors.primary} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={styles.replyBarLabel}>Trả lời</Text>
                <Text style={styles.replyBarContent} numberOfLines={1}>{replyTo.content}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close-circle" size={20} color="#65676B" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Input bar — safe area when closed, no gap when open */}
      <View style={[styles.inputBar, keyboardVisible ? {} : { paddingBottom: insets.bottom }]}>
        <TouchableOpacity onPress={() => setShowEmoji(!showEmoji)} style={styles.inputBtn}>
          <Ionicons name={showEmoji ? "keypad" : "happy-outline"} size={24} color={colors.primary} />
        </TouchableOpacity>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Tin nhắn..."
          placeholderTextColor="#8A8D91"
          value={text}
          onChangeText={handleTyping}
          onFocus={() => setShowEmoji(false)}
          multiline
        />
        <TouchableOpacity onPress={pickImage} style={styles.inputBtn}>
          <Ionicons name="image-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFile} style={styles.inputBtn}>
          <Ionicons name="attach-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={sendMessage} disabled={!text.trim()} style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}>
          <Ionicons name="send" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Emoji bar */}
      {showEmoji && (
        <View style={styles.emojiBar}>
          {EMOJIS.map((e) => (
            <TouchableOpacity key={e} onPress={() => sendEmoji(e)}>
              <Text style={{ fontSize: 28, paddingHorizontal: 5 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* User Info Modal with realtime presence */}
      <Modal visible={showInfo} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfo(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalAvatarBig}>
              <Text style={styles.modalAvatarText}>{initial}</Text>
            </View>
            <Text style={styles.modalName}>{otherUser?.name || "Người dùng"}</Text>
            <View style={styles.modalStatus}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? colors.online : "#ccc" }]} />
              <Text style={styles.modalStatusText}>{isOnline ? "Đang hoạt động" : "Không hoạt động"}</Text>
            </View>
            {otherUser?.bio ? <Text style={styles.modalBio}>{otherUser.bio}</Text> : null}
            <View style={styles.modalInfoRow}>
              <Ionicons name="person-outline" size={20} color="#65676B" />
              <Text style={styles.modalInfoText}>{otherUser?.name}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowInfo(false)} style={styles.modalDone}>
              <Text style={styles.modalDoneText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5" },
  headerBack: { padding: 6 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginLeft: 4 },
  headerAvatarText: { fontSize: 14, fontWeight: "700", color: colors.primary },
  headerOnline: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.online, borderWidth: 2, borderColor: "#fff", position: "absolute", bottom: -1, right: -1 },
  headerInfo: { flex: 1, marginLeft: 10 },
  headerName: { fontSize: 16, fontWeight: "600", color: "#000" },
  headerStatus: { fontSize: 12, color: "#65676B", marginTop: 1 },
  headerBtn: { padding: 6 },
  list: { flex: 1, backgroundColor: "#fff" },
  msgWrap: { marginBottom: 6 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  msgAvatarText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#F0F2F5", borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: "#000", lineHeight: 20 },
  deletedText: { fontSize: 13, fontStyle: "italic", color: "#65676B", paddingVertical: 4 },
  inlineReply: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 8, marginBottom: 4 },
  inlineReplyText: { fontSize: 12, color: "#65676B" },
  image: { width: 220, height: 220, borderRadius: 14, backgroundColor: "#F0F2F5" },
  fileRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fileText: { fontSize: 14, color: "#000", flex: 1 },
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 3, gap: 3 },
  time: { fontSize: 10, color: "#65676B" },
  status: { fontSize: 10 },
  reactions: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "#E5E5E5", marginTop: 4, elevation: 1 },
  retry: { fontSize: 12, color: "#EF4444", fontWeight: "600", marginTop: 4, textAlign: "right" },
  replyPreview: { flexDirection: "row", marginBottom: 2 },
  replyBar: { width: 3, borderRadius: 2 },
  replyContent: { marginLeft: 6, flex: 1 },
  replyLabel: { fontSize: 11, fontWeight: "600" },
  replyText: { fontSize: 11, marginTop: 1 },
  typing: { paddingHorizontal: 16, paddingVertical: 4, fontSize: 12, fontStyle: "italic", color: "#65676B" },
  // Preview bar
  previewBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 0.5, borderTopColor: "#E5E5E5" },
  previewImage: { width: 44, height: 44, borderRadius: 8, backgroundColor: "#F0F2F5" },
  previewFileIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  previewInfo: { flex: 1, marginLeft: 10 },
  previewName: { fontSize: 13, fontWeight: "500", color: "#000" },
  previewSize: { fontSize: 11, color: "#65676B", marginTop: 1 },
  previewActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  previewBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#F0F2F5", alignItems: "center", justifyContent: "center" },
  previewBtnText: { fontSize: 13, fontWeight: "600" },
  // Progress
  progressBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#fff", paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: "#E5E5E5" },
  progressText: { fontSize: 12, color: colors.primary, marginLeft: 8 },
  // Reply bar
  replyBarContainer: { backgroundColor: "#fff", borderTopWidth: 0.5, borderTopColor: "#E5E5E5", paddingHorizontal: 12, paddingVertical: 8 },
  replyBarInner: { flexDirection: "row", alignItems: "center" },
  replyLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  replyBarLabel: { fontSize: 12, fontWeight: "600", color: colors.primary },
  replyBarContent: { fontSize: 12, color: "#65676B", marginTop: 1 },
  // Input - NO paddingBottom, rely on KeyboardAvoidingView
  inputBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: "#E5E5E5" },
  inputBtn: { padding: 6 },
  input: { flex: 1, backgroundColor: "#F0F2F5", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, maxHeight: 80, marginHorizontal: 4, fontSize: 15, color: "#000" },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", marginLeft: 2 },
  emojiBar: { flexDirection: "row", backgroundColor: "#fff", padding: 8, borderTopWidth: 0.5, borderTopColor: "#E5E5E5", flexWrap: "wrap", justifyContent: "center" },
  // Modal
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, alignItems: "center" },
  modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#E5E5E5", marginBottom: 20 },
  modalAvatarBig: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalAvatarText: { fontSize: 28, fontWeight: "700", color: colors.primary },
  modalName: { fontSize: 20, fontWeight: "700", color: "#000" },
  modalStatus: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  modalStatusText: { fontSize: 14, color: "#65676B" },
  modalBio: { fontSize: 14, color: "#65676B", textAlign: "center", marginTop: 12, paddingHorizontal: 20, lineHeight: 20 },
  modalInfoRow: { flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: "#E5E5E5", marginTop: 4 },
  modalInfoText: { fontSize: 15, color: "#000", marginLeft: 12 },
  modalDone: { marginTop: 20, paddingVertical: 12, paddingHorizontal: 32, borderRadius: 10, backgroundColor: "#F0F2F5" },
  modalDoneText: { fontSize: 16, fontWeight: "600", color: colors.primary },
});