import React, { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image, ActivityIndicator, Modal, Alert, Keyboard, ScrollView, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import api from "../services/api";
import { getSocket } from "../services/socket";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import { useBadge } from "../contexts/BadgeContext";
import { colors } from "../theme/colors";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const EMOJIS = ["👍", "❤️", "🔥", "😂", "😍", "🎉", "💯", "✨", "🚀", "🙌", "👏", "😢", "😡", "💪", "🤝"];
const SCREEN_WIDTH = Dimensions.get("window").width;

export default function ChatDetailScreen({ route, navigation }) {
  const { conversationId, name, type } = route.params;
  const isGroup = type === "group" || route.params?.type === "group";
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const { setActiveConversation } = useBadge();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [receiverId, setReceiverId] = useState(null);
  const [otherUser, setOtherUser] = useState(null);
  const [blockStatus, setBlockStatus] = useState(null); // null, 'blocked_by_me', 'blocked_by_them'
  const [blockLoading, setBlockLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docName, setDocName] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [multiImages, setMultiImages] = useState([]); // [{uri, name}]
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [convInfo, setConvInfo] = useState(null);
  const [showNickname, setShowNickname] = useState(false);
  const [nickname, setNickname] = useState("");
  const [editNickname, setEditNickname] = useState("");
  const [groupNameEdit, setGroupNameEdit] = useState("");
  const [showGroupRename, setShowGroupRename] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState([]);
  const [viewerIndex, setViewerIndex] = useState(0);

  // ─── Voice call state ──────────────────────────────
  const [callState, setCallState] = useState(null); // null | 'calling' | 'incoming' | 'active'
  const [callerId, setCallerId] = useState(null);
  const [callerName, setCallerName] = useState('');
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
  const [convMembers, setConvMembers] = useState([]);
  const [deletedMessages, setDeletedMessages] = useState(new Set());
  const flatListRef = useRef(null);
  const inputRef = useRef(null);

  // Realtime presence: check if other user is online
  const isOnline = otherUser?.id ? onlineUsers.has(otherUser.id) : (otherUser?.is_online === 1);
  const isBlocked = blockStatus === 'blocked_by_me' || blockStatus === 'blocked_by_them';

  // ─── Voice call ────────────────────────────────────
  const socket = getSocket();
  function cleanupCall() {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = null;
    setCallDuration(0);
    setCallState(null);
    setCallerId(null);
    setCallerName('');
  }

  function startVoiceCall() {
    if (!otherUser?.id || isGroup) return;
    setCallState('calling');
    setCallerName(otherUser.name || name || 'Người dùng');
    const s = getSocket();
    if (s && s.connected) {
      s.emit('call:offer', { targetUserId: otherUser.id, conversationId, callerName: user?.name || 'Người dùng' });
    }
  }

  function acceptCall() {
    const s = getSocket();
    if (s && s.connected) {
      s.emit('call:accept', { callerId });
    }
    setCallState('active');
    callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
  }

  function rejectCall() {
    const s = getSocket();
    if (s && s.connected && callerId) {
      s.emit('call:reject', { callerId });
    }
    cleanupCall();
  }

  function endCall() {
    const s = getSocket();
    if (s && s.connected && otherUser?.id) {
      s.emit('call:end', { targetUserId: otherUser.id });
    }
    cleanupCall();
  }

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatLastSeen(d) {
    if (!d) return "";
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return "Vừa xong";
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    const days = Math.floor(diff / 86400000);
    if (days === 1) return "Hôm qua";
    if (days < 7) return `${days} ngày trước`;
    return formatDistanceToNow(new Date(d), { addSuffix: true, locale: vi });
  }

  // Resolve image URL: handle relative paths from old messages
  function resolveUrl(url) {
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/uploads/")) return "https://timquanhday.de" + url;
    return url;
  }

  useEffect(() => {
    // Mark this conversation as active for badge tracking
    setActiveConversation(conversationId);
    fetchMessages();
    api.get("/conversations/" + conversationId).then((res) => {
      const convData = res.data;
      const members = convData?.members || [];
      const isGroupConv = convData?.type === "group" || isGroup;
      if (!isGroupConv) {
        const other = members.find((m) => m.id !== user?.id);
        if (other) {
          setReceiverId(other.id);
          setOtherUser(other);
          api.get("/users/" + other.id + "/block-status").then((res2) => {
            const data = res2.data;
            if (data.isBlocked) {
              setBlockStatus(data.blockedBy === 'me' ? 'blocked_by_me' : 'blocked_by_them');
            } else {
              setBlockStatus(null);
            }
          }).catch(() => {});
        }
      } else {
        // Group: set otherUser to null, member count shown instead
        setOtherUser(null);
        setReceiverId(null);
        setBlockStatus(null);
      }
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
          setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
      socket.on("conversation:updated", ({ conversationId: cId, name, avatar }) => {
        if (cId === conversationId) {
          setConvInfo(prev => prev ? { ...prev, name: name || prev.name, avatar: avatar || prev.avatar } : prev);
          if (name) navigation.setParams({ name });
        }
      });
      // ─── Voice call signaling ─────────────
      socket.on('call:incoming', ({ callerId: cId, callerName, conversationId: cId2 }) => {
        if (cId2 === conversationId && !isGroup) {
          setCallerId(cId);
          setCallerName(callerName);
          setCallState('incoming');
        }
      });
      socket.on('call:connected', () => {
        setCallState('active');
        callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
      });
      socket.on('call:rejected', () => { cleanupCall(); });
      socket.on('call:ended', () => { cleanupCall(); });
      socket.on('call:busy', () => { cleanupCall(); });
      return () => {
        // Clear active conversation for badge tracking
        setActiveConversation(null);
        showSub.remove();
        hideSub.remove();
        socket.off("message:new", onMsg); socket.off("message:deleted", onDel);
        socket.off("message:reaction", onReact); socket.off("user:typing", onType);
        socket.off("user:stop-typing", onStop);
        socket.off("conversation:updated");
        socket.off('call:incoming'); socket.off('call:connected');
        socket.off('call:rejected'); socket.off('call:ended');
        socket.off('call:busy');
        socket.emit("conversation:leave", { conversationId });
        if (callTimerRef.current) clearInterval(callTimerRef.current);
      };
    }
  }, [conversationId, user?.id]);

  async function fetchMessages() {
    try {
      const res = await api.get("/messages/" + conversationId + "?limit=50");
      setMessages(res.data);
    } catch (e) {}
    setLoading(false);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
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
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
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
        } else if (response?.code === "USER_BLOCKED") {
          setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, status: "failed", error: response.message } : m));
          Alert.alert("Bị chặn", response.message);
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
    const isImage = msg.type === "image";
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
    if (isImage) {
      options.push({ text: "Xem ảnh", onPress: () => {
        const msgs = messages.filter(m => m.type === "image" && m.metadata?.attachmentUrl);
        const idx = msgs.findIndex(m => m.id === msg.id);
        setViewerImages(msgs.map(m => resolveUrl(m.metadata?.attachmentUrl)).filter(Boolean));
        setViewerIndex(Math.max(0, idx));
        setShowImageViewer(true);
      }});
    }
    if (isMine) {
      options.push({ text: "Xóa cả 2 bên", style: "destructive", onPress: () => {
        Alert.alert("Xóa tin nhắn", "Tin nhắn sẽ bị xóa khỏi cả 2 phía?", [
          { text: "Huỷ", style: "cancel" },
          { text: "Xóa", style: "destructive", onPress: async () => {
            try {
              await api.delete(`/messages/${msg.id}?side=both`);
              setMessages((prev) => prev.filter(m => m.id !== msg.id));
              const socket = getSocket(); if (socket) socket.emit("message:delete", { messageId: msg.id, conversationId });
            } catch (e) {}
          }},
        ]);
      }});
    }
    if (!isMine) {
      options.push({ text: "Xóa phía tôi", style: "destructive", onPress: () => {
        Alert.alert("Xóa tin nhắn", "Chỉ xóa khỏi phía bạn?", [
          { text: "Huỷ", style: "cancel" },
          { text: "Xóa", style: "destructive", onPress: async () => {
            try {
              await api.delete(`/messages/${msg.id}?side=my`);
              setMessages((prev) => prev.filter(m => m.id !== msg.id));
            } catch (e) {}
          }},
        ]);
      }});
    }
    options.push({ text: "Huỷ", style: "cancel" });
    Alert.alert("Tin nhắn", "", options);
  }

  // ── Multi-image picker ──
  async function pickImages() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !result.assets?.length) return;
    setMultiImages(result.assets.map(f => ({ uri: f.uri, name: f.fileName || 'photo.jpg' })));
  }

  function cancelAttachment() {
    setMultiImages([]);
    setSelectedImage(null);
    if (previewUrl) { URL.revokeObjectURL?.(previewUrl); }
    setPreviewUrl(null);
    setSelectedDoc(null);
    setDocName(null);
    setUploadProgress(null);
  }

  // ── Send multi-images ──
  async function sendMultiImages() {
    if (!multiImages.length || !user?.id) return;
    setUploading(true);
    setUploadProgress(`Đang tải ${multiImages.length} ảnh...`);
    const token = await AsyncStorage.getItem("accessToken");
    const formData = new FormData();
    for (const img of multiImages) {
      formData.append("images", { uri: img.uri, type: "image/jpeg", name: img.name });
    }
    try {
      const res = await fetch("https://timquanhday.de/api/upload/images", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      if (!data?.images?.length) { setUploading(false); return; }
      setUploadProgress(`Đang gửi ${data.images.length} ảnh...`);
      const socket = getSocket();
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const tempId = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        const optimisticMsg = {
          id: tempId, conversation_id: conversationId, sender_id: user.id,
          content: "", type: "image", metadata: { attachmentUrl: img.url },
          created_at: new Date().toISOString(), status: "sending", client_temp_id: tempId, sender_name: user.name,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        if (socket) {
          socket.emit("message:send", {
            conversationId, content: "", type: "image", receiverId, tempId,
            attachmentUrl: img.url, attachmentName: img.filename,
          }, (response) => {
            if (response?.success) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === tempId || m.client_temp_id === tempId);
                if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], id: response.messageId, status: "sent" }; return next; }
                return prev;
              });
            }
          });
        }
        await new Promise(r => setTimeout(r, 50)); // stagger sends
      }
    } catch (e) { Alert.alert("Lỗi", "Không thể gửi ảnh"); }
    setMultiImages([]);
    setUploading(false);
    setUploadProgress(null);
  }

  // ── Single image (legacy) ──
  async function sendImage() {
    if (!selectedImage || !user?.id) return;
    const imgs = [{ uri: selectedImage.uri, name: selectedImage.fileName || 'photo.jpg' }];
    setMultiImages(imgs);
    setSelectedImage(null);
    setPreviewUrl(null);
    // Send directly with local variable — avoids stale closure
    if (!imgs.length) return;
    setUploading(true);
    setUploadProgress(`Đang tải 1 ảnh...`);
    const token = await AsyncStorage.getItem("accessToken");
    const formData = new FormData();
    for (const img of imgs) {
      formData.append("images", { uri: img.uri, type: "image/jpeg", name: img.name });
    }
    try {
      const res = await fetch("https://timquanhday.de/api/upload/images", {
        method: "POST", headers: { Authorization: "Bearer " + token }, body: formData,
      });
      const data = await res.json();
      if (!data?.images?.length) { setUploading(false); return; }
      setUploadProgress(`Đang gửi 1 ảnh...`);
      const socket = getSocket();
      for (let i = 0; i < data.images.length; i++) {
        const img = data.images[i];
        const tId = "img_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        const optimisticMsg = {
          id: tId, conversation_id: conversationId, sender_id: user.id,
          content: "", type: "image", metadata: { attachmentUrl: img.url },
          created_at: new Date().toISOString(), status: "sending", client_temp_id: tId, sender_name: user.name,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        if (socket) {
          socket.emit("message:send", {
            conversationId, content: "", type: "image", receiverId, tempId: tId,
            attachmentUrl: img.url, attachmentName: img.filename,
          }, (response) => {
            if (response?.success) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === tId || m.client_temp_id === tId);
                if (idx >= 0) { const next = [...prev]; next[idx] = { ...prev[idx], id: response.messageId, status: "sent" }; return next; }
                return prev;
              });
            }
          });
        }
      }
    } catch (e) { Alert.alert("Lỗi", "Không thể gửi ảnh"); }
    setMultiImages([]);
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

  const initial = isGroup ? "#" : (otherUser?.name || name || "?")[0].toUpperCase();
  const statusText = isGroup ? "" : (typing ? "Đang nhập..." : isBlocked ? "Đã chặn" : isOnline ? "Đang hoạt động" : otherUser?.last_seen ? `Hoạt động ${formatLastSeen(otherUser.last_seen)}` : "Không hoạt động");

  const renderMessage = ({ item }) => {
      const isMine = item.sender_id === user?.id;
      const isImage = item.type === "image";
      const isFile = item.type === "file";
      const attUrl = resolveUrl(item.metadata?.attachmentUrl || item.attachmentUrl);
      const reactions = item.reactions || [];
      const isFailed = item.status === "failed";
      const isSending = item.status === "sending" || item.id?.startsWith("temp_");
      const isUploading = item.status === "uploading";
      const showGroupSender = isGroup && !isMine;

      function openImageViewer() {
        // Collect ALL image messages in this conversation for swiping
        const msgs = messages.filter(m => m.type === "image" && m.metadata?.attachmentUrl);
        const idx = msgs.findIndex(m => m.id === item.id);
        setViewerImages(msgs.map(m => resolveUrl(m.metadata?.attachmentUrl)).filter(Boolean));
        setViewerIndex(Math.max(0, idx));
        setShowImageViewer(true);
      }

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
            {!isMine && (isGroup || !isImage) ? <View style={{ alignItems: "center" }}>
                <View style={styles.msgAvatar}>
                  {isGroup && item.sender_avatar ? (
                    <Image source={{ uri: item.sender_avatar.startsWith("http") ? item.sender_avatar : "https://timquanhday.de/uploads/" + item.sender_avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                  ) : !isGroup && otherUser?.avatar ? (
                    <Image source={{ uri: otherUser.avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                  ) : (
                    <Text style={styles.msgAvatarText}>{(isGroup ? (item.sender_name || "?") : (otherUser?.name || "?"))[0].toUpperCase()}</Text>
                  )}
                </View>
                {isGroup ? (function(){ return <Text style={styles.msgSenderLabel} numberOfLines={1}>{item.sender_name || "?"}</Text>; })() : null}
              </View> : null}
            <View style={{ maxWidth: isImage ? "80%" : "82%" }}>
              {item.is_deleted ? (
                <Text style={[styles.deletedText, isMine && { textAlign: "right" }]}>{item.content}</Text>
              ) : (
                <TouchableOpacity
                  activeOpacity={isImage ? 0.9 : 0.8}
                  onPress={isImage ? openImageViewer : undefined}
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
                    <View style={styles.albumWrap}>
                      <Image source={{ uri: attUrl }} style={styles.albumImage}
                        onError={(e) => console.log("Image error:", attUrl, e.nativeEvent?.error)}
                      />
                      {/* Photo count badge if this is the first of multiple images */}
                      {(() => {
                        const allImgs = messages.filter(m => m.type === "image" && m.metadata?.attachmentUrl);
                        const pos = allImgs.findIndex(m => m.id === item.id);
                        const total = allImgs.length;
                        if (total > 1 && pos === 0) {
                          return (
                            <View style={styles.albumCountBadge}>
                              <Ionicons name="images" size={14} color="#fff" />
                              <Text style={styles.albumCountText}>{total} ảnh</Text>
                            </View>
                          );
                        }
                        return null;
                      })()}
                    </View>
                  ) : isImage && !attUrl ? (
                    <View style={[styles.image, { backgroundColor: "#F0F2F5", justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="image-outline" size={32} color="#ccc" />
                    </View>
                  ) : isFile ? (
                    <View style={styles.fileRow}>
                      <Ionicons name="document-outline" size={22} color={isMine ? "#fff" : colors.primary} />
                      <Text style={[styles.fileText, isMine && { color: "#fff" }]} numberOfLines={1}>{item.content || "File"}</Text>
                    </View>
                  ) : (
                    <View>
                      {showGroupSender ? (function(){
                        return <Text style={styles.msgGroupSender}>{item.sender_name || "?"}</Text>;
                      })() : null}
                      <Text style={[styles.msgText, isMine && { color: "#fff" }, showGroupSender && { marginTop: 2 }]}>{item.content}</Text>
                    </View>
                  )}
                  {/* Timestamp + status (only for single images; not shown inside album) */}
                  <View style={[styles.timeRow, isMine ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
                    <Text style={[styles.time, isMine ? { color: "rgba(255,255,255,0.6)" } : { color: "#65676B" }]}>{formatTime(item.created_at)}</Text>
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
          {isGroup ? (
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
          ) : otherUser?.avatar ? (
            <Image source={{ uri: otherUser.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
          ) : (
            <Text style={styles.headerAvatarText}>{initial}</Text>
          )}
          {isOnline && <View style={styles.headerOnline} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.headerName} numberOfLines={1}>{isGroup ? (name || "Nhóm") : (otherUser?.name || name || "Đoạn chat")}</Text>
          {isGroup ? (
            <Text style={[styles.headerStatus, { color: "#6B7280" }]}>Nhóm chat</Text>
          ) : (<Text style={[styles.headerStatus, isOnline && { color: colors.online }]}>{statusText}</Text>)}
        </View>
        {!isGroup && otherUser?.id && (
          <TouchableOpacity onPress={startVoiceCall} style={[styles.headerBtn, { marginRight: 4 }]}>
            <Ionicons name="call" size={22} color="#22C55E" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={async () => {
          if (isGroup) {
            // Load group info
            try {
              const [convRes, memRes] = await Promise.all([
                api.get("/conversations/" + conversationId),
                api.get("/conversations/" + conversationId + "/members"),
              ]);
              setConvInfo(convRes.data);
              setConvMembers(memRes.data?.members || []);
              setGroupNameEdit(convRes.data?.name || "");
              setShowInfoModal(true);
            } catch (e) {}
          } else {
            // Load nickname + info
            try {
              const [convRes, nickRes] = await Promise.all([
                api.get("/conversations/" + conversationId),
                api.get("/conversations/" + conversationId + "/nickname"),
              ]);
              setConvInfo(convRes.data);
              setNickname(nickRes.data?.nickname || "");
              setEditNickname(nickRes.data?.nickname || "");
              setShowInfoModal(true);
            } catch (e) {}
          }
        }} style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.primary} />
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
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          renderItem={renderMessage}
        />
      )}
      {typing && <Text style={styles.typing}>Đang nhập...</Text>}

      {/* Multi-image preview bar */}
      {(previewUrl || selectedDoc || multiImages.length > 0) && (
        <View style={styles.previewBar}>
          {multiImages.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {multiImages.map((img, i) => (
                <Image key={i} source={{ uri: img.uri }} style={{ width: 50, height: 50, borderRadius: 8 }} />
              ))}
              <TouchableOpacity onPress={cancelAttachment} style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
              <TouchableOpacity onPress={sendMultiImages} style={{ width: 50, height: 50, borderRadius: 8, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </ScrollView>
          ) : previewUrl ? (
            <>
              <Image source={{ uri: previewUrl }} style={styles.previewImage} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewName} numberOfLines={1}>{selectedImage?.fileName || selectedImage?.name || "Ảnh"}</Text>
                <Text style={styles.previewSize}>Sẵn sàng gửi</Text>
              </View>
            </>
          ) : selectedDoc ? (
            <>
              <View style={styles.previewFileIcon}><Ionicons name="document-outline" size={24} color={colors.primary} /></View>
              <View style={styles.previewInfo}>
                <Text style={styles.previewName} numberOfLines={1}>{docName}</Text>
                <Text style={styles.previewSize}>File đính kèm</Text>
              </View>
            </>
          ) : null}
          {!(multiImages.length > 0) && (
            <View style={styles.previewActions}>
              <TouchableOpacity onPress={previewUrl ? sendImage : (selectedDoc ? (async () => { /* auto-send */ })() : null)} style={[styles.previewBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.previewBtnText, { color: "#fff" }]}>Gửi</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={cancelAttachment} style={styles.previewBtn}>
                <Ionicons name="close" size={18} color="#65676B" />
              </TouchableOpacity>
            </View>
          )}
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

      {/* Block banner — replaces input bar when blocked */}
      {isBlocked ? (
        <View style={[styles.blockBanner, keyboardVisible ? {} : { paddingBottom: insets.bottom }]}>
          <View style={styles.blockIcon}>
            <Ionicons name="ban-outline" size={24} color="#EF4444" />
          </View>
          <Text style={styles.blockTitle}>
            {blockStatus === 'blocked_by_me' ? 'Bạn đã chặn người này' : 'Bạn không thể nhắn tin cho tài khoản này'}
          </Text>
          <Text style={styles.blockDesc}>
            {blockStatus === 'blocked_by_me'
              ? 'Bạn không thể gửi tin nhắn.'
              : 'Người dùng này đã chặn bạn.'}
          </Text>
          {blockStatus === 'blocked_by_me' && (
            <TouchableOpacity
              style={styles.unblockBtn}
              disabled={blockLoading}
              onPress={async () => {
                setBlockLoading(true);
                try {
                  await api.post("/users/" + receiverId + "/unblock");
                  setBlockStatus(null);
                } catch (e) {}
                setBlockLoading(false);
              }}
            >
              {blockLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.unblockText}>Bỏ chặn</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
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
            <TouchableOpacity onPress={pickImages} style={styles.inputBtn}>
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
        </>
      )}

      {/* ─── Info / Nickname / Group Modal ──── */}
      <Modal visible={showInfoModal} transparent animationType="slide" onRequestClose={() => setShowInfoModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowInfoModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {isGroup ? (
              /* ─── GROUP INFO ─── */
              <>
                {/* Group avatar */}
                <View style={[styles.modalAvatarBig, { backgroundColor: "#F0FDF4" }]}>
                  {convInfo?.avatar ? (
                    <Image source={{ uri: convInfo.avatar.startsWith("http") ? convInfo.avatar : `https://timquanhday.de/uploads/${convInfo.avatar}` }}
                      style={{ width: 72, height: 72, borderRadius: 36 }} />
                  ) : (
                    <Ionicons name="people" size={32} color="#22C55E" />
                  )}
                </View>
                <Text style={styles.modalName}>{convInfo?.name || "Nhóm"}</Text>
                <Text style={[styles.modalStatusText, { marginTop: 4 }]}>{convMembers.length} thành viên</Text>

                {/* Rename */}
                <TouchableOpacity style={styles.modalInfoRow} onPress={() => { setShowGroupRename(true); setShowInfoModal(false); }}>
                  <Ionicons name="pencil" size={20} color="#65676B" />
                  <Text style={styles.modalInfoText}>Đổi tên nhóm</Text>
                </TouchableOpacity>

                {/* Change avatar */}
                <TouchableOpacity style={styles.modalInfoRow} onPress={async () => {
                  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.6 });
                  if (result.canceled || !result.assets?.length) return;
                  setUploading(true);
                  const token = await AsyncStorage.getItem("accessToken");
                  const fd = new FormData();
                  fd.append("image", { uri: result.assets[0].uri, type: "image/jpeg", name: "avatar.jpg" });
                  try {
                    const res = await fetch("https://timquanhday.de/api/upload/image", { method: "POST", headers: { Authorization: "Bearer " + token }, body: fd });
                    const data = await res.json();
                    if (data.url) {
                      await api.patch("/conversations/" + conversationId, { avatar: data.url });
                      setConvInfo(prev => prev ? { ...prev, avatar: data.url } : prev);
                    }
                  } catch (e) {}
                  setUploading(false);
                }}>
                  <Ionicons name="camera" size={20} color="#65676B" />
                  <Text style={styles.modalInfoText}>Đổi ảnh đại diện nhóm</Text>
                </TouchableOpacity>

                {/* Member list */}
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#000", alignSelf: "flex-start", marginTop: 12, marginBottom: 8 }}>Thành viên</Text>
                {convMembers.map(m => (
                  <View key={m.id} style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: "#F3F4F6" }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#DBEAFE", alignItems: "center", justifyContent: "center" }}>
                      {m.avatar ? <Image source={{ uri: m.avatar }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                        : <Text style={{ fontSize: 14, fontWeight: "700", color: "#2563EB" }}>{(m.name || "?")[0].toUpperCase()}</Text>}
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={{ fontSize: 14, fontWeight: "500", color: "#000" }}>{m.name}</Text>
                      <Text style={{ fontSize: 11, color: "#9CA3AF" }}>{m.is_online ? "Đang hoạt động" : m.last_seen ? `Hoạt động ${formatLastSeen(m.last_seen)}` : ""}</Text>
                    </View>
                    {m.is_online ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} /> : null}
                  </View>
                ))}

                {/* Delete conversation */}
                <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", alignSelf: "stretch", paddingVertical: 14, marginTop: 8 }}
                  onPress={() => { setShowInfoModal(false);
                    Alert.alert("Rời nhóm", "Bạn sẽ rời khỏi nhóm này?", [
                      { text: "Huỷ", style: "cancel" },
                      { text: "Rời", style: "destructive", onPress: async () => {
                        try { await api.delete("/conversations/" + conversationId); navigation.goBack(); } catch (e) {}
                      }},
                    ]);
                  }}>
                  <Ionicons name="exit-outline" size={20} color="#EF4444" />
                  <Text style={{ fontSize: 15, color: "#EF4444", marginLeft: 12, fontWeight: "500" }}>Rời nhóm</Text>
                </TouchableOpacity>
              </>
            ) : (
              /* ─── PRIVATE CHAT INFO ─── */
              <>
                <View style={styles.modalAvatarBig}>
                  {otherUser?.avatar ? <Image source={{ uri: otherUser.avatar }} style={{ width: 72, height: 72, borderRadius: 36 }} />
                    : <Text style={styles.modalAvatarText}>{initial}</Text>}
                  {isOnline && <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: colors.online, borderWidth: 2.5, borderColor: "#fff", position: "absolute", bottom: 2, right: 2 }} />}
                </View>
                <Text style={styles.modalName}>{otherUser?.name || "Người dùng"}</Text>
                <Text style={[styles.modalStatusText, { marginTop: 4 }]}>{isOnline ? "Đang hoạt động" : otherUser?.last_seen ? `Hoạt động ${formatLastSeen(otherUser.last_seen)}` : "Không hoạt động"}</Text>
                {otherUser?.bio ? <Text style={styles.modalBio}>{otherUser.bio}</Text> : null}

                {/* Nickname */}
                <TouchableOpacity style={styles.modalInfoRow} onPress={() => { setShowNickname(true); setShowInfoModal(false); }}>
                  <Ionicons name="pencil" size={20} color="#65676B" />
                  <Text style={styles.modalInfoText}>{nickname ? `Biệt danh: ${nickname}` : "Đặt biệt danh"}</Text>
                </TouchableOpacity>

                {/* Block / Unblock */}
                <TouchableOpacity style={styles.modalInfoRow} onPress={async () => {
                  if (blockStatus === 'blocked_by_me') {
                    await api.post("/users/" + receiverId + "/unblock");
                    setBlockStatus(null);
                  } else {
                    await api.post("/users/" + receiverId + "/block");
                    setBlockStatus('blocked_by_me');
                  }
                }}>
                  <Ionicons name={blockStatus === 'blocked_by_me' ? "unlock" : "lock-closed"} size={20} color="#EF4444" />
                  <Text style={{ fontSize: 15, color: "#EF4444", marginLeft: 12 }}>
                    {blockStatus === 'blocked_by_me' ? "Bỏ chặn" : "Chặn người dùng"}
                  </Text>
                </TouchableOpacity>

                {/* Delete conversation */}
                <TouchableOpacity style={styles.modalInfoRow} onPress={() => {
                  Alert.alert("Xóa cuộc trò chuyện", "Toàn bộ lịch sử sẽ bị xóa khỏi danh sách của bạn.", [
                    { text: "Huỷ", style: "cancel" },
                    { text: "Xóa", style: "destructive", onPress: async () => {
                      try { await api.delete("/conversations/" + conversationId); navigation.goBack(); } catch (e) {}
                    }},
                  ]);
                }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                  <Text style={{ fontSize: 15, color: "#EF4444", marginLeft: 12 }}>Xóa cuộc trò chuyện</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={() => setShowInfoModal(false)} style={styles.modalDone}>
              <Text style={styles.modalDoneText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─── Nickname Edit Modal ──── */}
      <Modal visible={showNickname} transparent animationType="slide" onRequestClose={() => { setShowNickname(false); setShowInfoModal(true); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowNickname(false); setShowInfoModal(true); }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalName, { marginBottom: 16 }]}>Đặt biệt danh</Text>
            <TextInput
              style={{ width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14, paddingHorizontal: 16, height: 50, fontSize: 15, color: "#000", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholder="Nhập biệt danh..."
              placeholderTextColor="#9CA3AF"
              value={editNickname}
              onChangeText={setEditNickname}
              maxLength={50}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16, width: "100%" }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" }}
                onPress={async () => {
                  if (editNickname.trim()) {
                    await api.put("/conversations/" + conversationId + "/nickname", { nickname: editNickname.trim() });
                    setNickname(editNickname.trim());
                  } else {
                    await api.put("/conversations/" + conversationId + "/nickname", { nickname: "" });
                    setNickname(null);
                  }
                  setShowNickname(false); setShowInfoModal(true);
                }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#000" }}>Lưu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#FEF2F2", alignItems: "center" }}
                onPress={async () => {
                  await api.put("/conversations/" + conversationId + "/nickname", { nickname: "" });
                  setNickname(""); setEditNickname("");
                  setShowNickname(false); setShowInfoModal(true);
                }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#EF4444" }}>Xóa biệt danh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        {callState && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  <TouchableOpacity style={styles.callOverlay} activeOpacity={1} onPress={() => {}}>
                    <View style={styles.callSheet}>
                      <Ionicons name={callState === 'active' ? "call" : "call-outline"} size={48} color={callState === 'active' ? "#22C55E" : "#fff"} />
                      <Text style={styles.callName}>{callState === 'calling' ? (otherUser?.name || name || 'Người dùng') : callerName}</Text>
                      <Text style={styles.callStatus}>
                        {callState === 'calling' ? "Đang gọi..." : callState === 'incoming' ? "Cuộc gọi đến" : callState === 'active' ? formatDuration(callDuration) : ""}
                      </Text>
                      <View style={styles.callActions}>
                        {callState === 'incoming' && (
                          <>
                            <TouchableOpacity onPress={acceptCall} style={[styles.callBtn, { backgroundColor: "#22C55E" }]}>
                              <Ionicons name="call" size={28} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={rejectCall} style={[styles.callBtn, { backgroundColor: "#EF4444" }]}>
                              <Ionicons name="call-outline" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                            </TouchableOpacity>
                          </>
                        )}
                        {callState === 'active' && (
                          <TouchableOpacity onPress={endCall} style={[styles.callBtn, { backgroundColor: "#EF4444" }]}>
                            <Ionicons name="call-outline" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
                          </TouchableOpacity>
                        )}
                        {callState === 'calling' && (
                          <TouchableOpacity onPress={endCall} style={[styles.callBtn, { backgroundColor: "#EF4444" }]}>
                            <Ionicons name="close" size={28} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
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
  // ─── Voice Call Styles ──────────────────
  callOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center",
  },
  callSheet: { alignItems: "center", gap: 16, paddingHorizontal: 40 },
  callName: { fontSize: 22, fontWeight: "700", color: "#fff", marginTop: 12 },
  callStatus: { fontSize: 15, color: "#ccc" },
  callActions: { flexDirection: "row", gap: 40, marginTop: 24 },
  callBtn: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  list: { flex: 1, backgroundColor: "#fff" },
  msgWrap: { marginBottom: 6 },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  msgAvatarText: { fontSize: 11, fontWeight: "700", color: colors.primary },
  bubble: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: "#F0F2F5", borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, color: "#000", lineHeight: 20 },
  msgSenderLabel: { fontSize: 9, color: "#6B7280", marginTop: 2, textAlign: "center", maxWidth: 28 },
  msgGroupSender: { fontSize: 12, fontWeight: "600", color: colors.primary, marginBottom: 2 },
  deletedText: { fontSize: 13, fontStyle: "italic", color: "#65676B", paddingVertical: 4 },
  inlineReply: { borderLeftWidth: 2, borderLeftColor: colors.primary, paddingLeft: 8, marginBottom: 4 },
  inlineReplyText: { fontSize: 12, color: "#65676B" },
  image: { width: 220, height: 220, borderRadius: 14, backgroundColor: "#F0F2F5" },
  // Album styles
  albumWrap: { position: "relative" },
  albumImage: { width: 240, height: 220, borderRadius: 14, backgroundColor: "#F0F2F5" },
  albumCountBadge: {
    position: "absolute", bottom: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20,
  },
  albumCountText: { fontSize: 12, fontWeight: "600", color: "#fff" },
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
  // Block banner
  blockBanner: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 20, backgroundColor: "#fff", borderTopWidth: 0.5, borderTopColor: "#E5E5E5" },
  blockIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  blockTitle: { fontSize: 16, fontWeight: "600", color: "#111827", textAlign: "center", marginBottom: 4 },
  blockDesc: { fontSize: 13, color: "#6B7280", textAlign: "center", marginBottom: 12 },
  unblockBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: "#EF4444", minWidth: 120, alignItems: "center" },
  unblockText: { color: "#fff", fontSize: 14, fontWeight: "600" },
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
})
</KeyboardAvoidingView>
      </Modal>

      {/* ─── Group Rename Modal ──── */}
      <Modal visible={showGroupRename} transparent animationType="slide" onRequestClose={() => { setShowGroupRename(false); setShowInfoModal(true); }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setShowGroupRename(false); setShowInfoModal(true); }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalName, { marginBottom: 16 }]}>Đổi tên nhóm</Text>
            <TextInput
              style={{ width: "100%", backgroundColor: "#F9FAFB", borderRadius: 14, paddingHorizontal: 16, height: 50, fontSize: 15, color: "#000", borderWidth: 1, borderColor: "#E5E7EB" }}
              placeholder="Tên nhóm mới"
              placeholderTextColor="#9CA3AF"
              value={groupNameEdit}
              onChangeText={setGroupNameEdit}
              maxLength={100}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16, width: "100%" }}>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.primary, alignItems: "center" }}
                onPress={async () => {
                  if (!groupNameEdit.trim()) return;
                  await api.patch("/conversations/" + conversationId, { name: groupNameEdit.trim() });
                  setConvInfo(prev => prev ? { ...prev, name: groupNameEdit.trim() } : prev);
                  setShowGroupRename(false); setShowInfoModal(true);
                  navigation.setParams({ name: groupNameEdit.trim() });
                }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#fff" }}>Lưu</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center" }}
                onPress={() => { setShowGroupRename(false); setShowInfoModal(true); }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: "#6B7280" }}>Huỷ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Image Viewer ──── */}
      <Modal visible={showImageViewer} transparent animationType="fade" onRequestClose={() => setShowImageViewer(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <TouchableOpacity onPress={() => setShowImageViewer(false)} style={{ position: "absolute", top: 50, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          {viewerImages.length > 1 && (
            <View style={{ position: "absolute", top: 54, right: 16, zIndex: 10 }}>
              <Text style={{ color: "#fff", fontSize: 14 }}>{viewerIndex + 1} / {viewerImages.length}</Text>
            </View>
          )}
          {viewerImages.length > 0 && (
            <FlatList
              data={viewerImages}
              horizontal pagingEnabled showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerIndex}
              getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
              keyExtractor={(_, i) => String(i)}
              renderItem={({ item }) => (
                <View style={{ width: SCREEN_WIDTH, height: "100%", justifyContent: "center", alignItems: "center" }}>
                  <Image source={{ uri: item }} style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH }} resizeMode="contain" />
                </View>
              )}
            />
          )}
        </View>
                </Modal>
            </KeyboardAvoidingView>
    
              ;