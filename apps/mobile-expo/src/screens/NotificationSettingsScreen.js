import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Switch } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

export default function NotificationSettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [settings, setSettings] = React.useState({
    messages: true,
    sos: true,
    likes: true,
    comments: true,
    friend_requests: true,
  });

  function toggle(key) {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const items = [
    { key: "messages", label: "Tin nhắn", desc: "Thông báo khi có tin nhắn mới", icon: "chatbubbles" },
    { key: "sos", label: "SOS", desc: "Thông báo yêu cầu hỗ trợ gần bạn", icon: "alert-circle" },
    { key: "likes", label: "Lượt thích", desc: "Thông báo khi có người thích bài viết", icon: "heart" },
    { key: "comments", label: "Bình luận", desc: "Thông báo khi có bình luận mới", icon: "chatbox" },
    { key: "friend_requests", label: "Lời mời kết bạn", desc: "Thông báo khi có lời mời kết bạn", icon: "person-add" },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Thông báo</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View key={item.key}>
            <View style={styles.row}>
              <View style={styles.iconWrap}>
                <Ionicons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{item.label}</Text>
                <Text style={styles.desc}>{item.desc}</Text>
              </View>
              <Switch
                value={settings[item.key]}
                onValueChange={() => toggle(item.key)}
                trackColor={{ false: "#D1D5DB", true: "#86EFAC" }}
                thumbColor={settings[item.key] ? "#22C55E" : "#9CA3AF"}
              />
            </View>
            {i < items.length - 1 && <View style={styles.divider} />}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  list: { marginHorizontal: 16, marginTop: 8, backgroundColor: "#fff", borderRadius: 14, borderWidth: 0.5, borderColor: "#E5E7EB", overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 12 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  label: { fontSize: 15, fontWeight: "600", color: "#111827" },
  desc: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  divider: { height: 0.5, backgroundColor: "#E5E7EB", marginLeft: 64 },
});