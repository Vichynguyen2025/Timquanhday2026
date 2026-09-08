import React, { useEffect, useRef } from "react";
import { View, Text, Animated, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: "center" }}>
        {/* App icon */}
        <View style={{
          width: 88, height: 88, borderRadius: 24,
          backgroundColor: colors.primary,
          alignItems: "center", justifyContent: "center",
          shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
        }}>
          <Ionicons name="compass" size={44} color="#fff" />
        </View>
        <Text style={{
          fontSize: 28, fontWeight: "700", color: "#171717",
          letterSpacing: -0.56, marginTop: 20,
        }}>Tìm Quanh Đây</Text>
        <Text style={{
          fontSize: 14, fontWeight: "400", color: "#6B7280",
          letterSpacing: -0.14, marginTop: 6,
        }}>Kết nối gần nhau hơn</Text>
        <ActivityIndicator
          size="small" color={colors.primary}
          style={{ opacity: 0.6, marginTop: 48 }}
        />
      </Animated.View>
    </View>
  );
}