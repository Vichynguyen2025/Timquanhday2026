import React, { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import api from "../services/api";
import { colors } from "../theme/colors";

const RADII = [100, 200, 500, 1000, 5000];

export default function FeedScreen() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(500);

  useFocusEffect(useCallback(() => { fetchPosts(); }, [radius]));

  async function fetchPosts() {
    try {
      const res = await api.get("/posts", { params: { radius } });
      setPosts(res.data);
    } catch (e) {}
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.title}>Khám phá</Text></View>
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <TouchableOpacity key={r} style={[styles.chip, radius === r && styles.chipActive]} onPress={() => { setRadius(r); setLoading(true); }}>
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r >= 1000 ? r / 1000 + "km" : r + "m"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchPosts} />}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="compass-outline" size={50} color={colors.textTertiary} /><Text style={styles.emptyText}>Chưa có bài viết</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{(item.user_name || "?")[0].toUpperCase()}</Text></View>
                <View><Text style={styles.cardName}>{item.user_name}</Text><Text style={styles.cardTime}>{item.created_at}</Text></View>
              </View>
              {item.content ? <Text style={styles.cardContent}>{item.content}</Text> : null}
              <View style={styles.cardFooter}>
                <Ionicons name={item.is_liked ? "heart" : "heart-outline"} size={18} color={item.is_liked ? colors.error : colors.textTertiary} />
                <Text style={styles.likeCount}>{item.like_count}</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 8, backgroundColor: colors.surface },
  title: { fontSize: 24, fontWeight: "700", color: colors.text },
  radiusRow: { flexDirection: "row", padding: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginRight: 8, backgroundColor: "#F3F4F6" },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.text },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", marginTop: 60 },
  emptyText: { fontSize: 15, color: colors.textSecondary, marginTop: 12 },
  card: { backgroundColor: colors.surface, margin: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginRight: 10 },
  avatarText: { fontSize: 16, fontWeight: "700", color: colors.primary },
  cardName: { fontSize: 14, fontWeight: "600", color: colors.text },
  cardTime: { fontSize: 11, color: colors.textTertiary },
  cardContent: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center" },
  likeCount: { fontSize: 13, color: colors.textSecondary, marginLeft: 4 },
});