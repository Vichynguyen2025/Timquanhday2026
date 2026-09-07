import React, { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../services/api";
import { colors } from "../theme/colors";

export default function MyPostsScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const filter = route.params?.filter || "posts"; // posts, saves, likes
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const titles = {
    posts: "Bài viết của tôi",
    saves: "Bài viết đã lưu",
    likes: "Bài viết đã thích",
  };

  useFocusEffect(useCallback(() => { fetchItems(); }, [filter]));

  async function fetchItems() {
    try {
      let res;
      if (filter === "posts") res = await api.get("/posts?mine=true");
      else if (filter === "saves") res = await api.get("/posts?filter=saved");
      else if (filter === "likes") res = await api.get("/posts?filter=liked");
      setItems(res.data?.posts || []);
    } catch (e) {}
    setLoading(false); setRefreshing(false);
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>{titles[filter] || "Bài viết"}</Text>
        <View style={{ width: 32 }} />
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchItems(); }} tintColor={colors.primary} />}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 20 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={filter === "posts" ? "document-text-outline" : filter === "saves" ? "bookmark-outline" : "heart-outline"} size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>
                {filter === "posts" ? "Bạn chưa có bài viết nào" : filter === "saves" ? "Bạn chưa lưu bài viết nào" : "Bạn chưa thích bài viết nào"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.postItem} activeOpacity={0.7}>
              {item.media?.[0]?.url && (
                <Image source={{ uri: item.media[0].url }} style={styles.postImage} />
              )}
              <Text style={styles.postContent} numberOfLines={2}>{item.content}</Text>
              <Text style={styles.postTime}>{item.created_at ? new Date(item.created_at).toLocaleDateString("vi-VN") : ""}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: "#000" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyText: { fontSize: 15, color: "#6B7280", marginTop: 12, textAlign: "center" },
  postItem: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: "#E5E7EB" },
  postImage: { width: "100%", height: 160, borderRadius: 8, marginBottom: 8, backgroundColor: "#F3F4F6" },
  postContent: { fontSize: 14, color: "#111827", lineHeight: 20 },
  postTime: { fontSize: 11, color: "#9CA3AF", marginTop: 6 },
});