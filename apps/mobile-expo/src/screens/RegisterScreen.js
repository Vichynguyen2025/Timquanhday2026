import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#EFF6FF";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);

  async function handleRegister() {
    if (!name || !email || !password) { setError("Vui lòng nhập đầy đủ thông tin"); return; }
    if (password.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return; }
    setLoading(true); setError("");
    try { await register(name, email, password); }
    catch (e) { setError(e.response?.data?.error || "Đăng ký thất bại"); }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="always">
        {/* Decorative */}
        <View style={styles.decorTop}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>

        {/* Back + Logo */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color="#171717" />
        </TouchableOpacity>

        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Ionicons name="person-add" size={26} color={BLUE} />
          </View>
        </View>

        <Text style={styles.title}>Tạo tài khoản</Text>
        <Text style={styles.subtitle}>Gia nhập cộng đồng Tìm Quanh Đây</Text>

        {/* Benefits chips */}
        <View style={styles.chipsRow}>
          <View style={styles.chip}><Ionicons name="compass" size={12} color={BLUE} /><Text style={styles.chipText}>Khám phá</Text></View>
          <View style={styles.chip}><Ionicons name="chatbubbles" size={12} color={BLUE} /><Text style={styles.chipText}>Nhắn tin</Text></View>
          <View style={styles.chip}><Ionicons name="alert-circle" size={12} color={BLUE} /><Text style={styles.chipText}>SOS</Text></View>
        </View>

        {/* Error */}
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Form */}
        <View style={styles.formCard}>
          <View style={[styles.inputWrap, name ? styles.inputWrapFocused : null]}>
            <Ionicons name="person-outline" size={18} color={name ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Họ tên" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
          </View>

          <View style={[styles.inputWrap, email ? styles.inputWrapFocused : null]}>
            <Ionicons name="mail-outline" size={18} color={email ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          </View>

          <View style={[styles.inputWrap, password ? styles.inputWrapFocused : null]}>
            <Ionicons name="lock-closed-outline" size={18} color={password ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
            <TextInput style={styles.input} placeholder="Mật khẩu" placeholderTextColor="#9CA3AF" value={password} onChangeText={setPassword} secureTextEntry={!showPw} />
            <TouchableOpacity onPress={() => setShowPw(!showPw)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>Tối thiểu 6 ký tự</Text>

          <TouchableOpacity style={styles.btnPrimary} onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.btnInner}>
                <Text style={styles.btnText}>Tạo tài khoản</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>hoặc</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Social */}
        <View style={styles.socialRow}>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}><Ionicons name="logo-google" size={20} color="#EA4335" /></TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}><Ionicons name="logo-facebook" size={20} color="#1877F2" /></TouchableOpacity>
          <TouchableOpacity style={styles.socialBtn} activeOpacity={0.7}><Ionicons name="logo-apple" size={20} color="#000" /></TouchableOpacity>
        </View>

        {/* Switch */}
        <TouchableOpacity onPress={() => navigation.navigate("Login")} style={styles.switchRow}>
          <Text style={styles.switchText}>
            Đã có tài khoản?{" "}
            <Text style={styles.switchLink}>Đăng nhập</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  // Decorative
  decorTop: { position: "absolute", top: 0, left: 0, right: 0, height: 200, overflow: "hidden" },
  decorCircle1: { position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: BLUE_LIGHT, opacity: 0.6 },
  decorCircle2: { position: "absolute", top: -20, left: -60, width: 140, height: 140, borderRadius: 70, backgroundColor: "#DBEAFE", opacity: 0.4 },

  // Back
  backBtn: { position: "absolute", top: 60, left: 20, zIndex: 10, width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

  // Logo
  logoWrap: { alignItems: "center", marginTop: 60, marginBottom: 20 },
  logoIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: BLUE_LIGHT, alignItems: "center", justifyContent: "center", shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },

  // Text
  title: { fontSize: 26, fontWeight: "700", color: "#171717", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, marginBottom: 20, lineHeight: 20 },

  // Chips
  chipsRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 20 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: BLUE_LIGHT, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { fontSize: 12, fontWeight: "600", color: BLUE },

  // Error
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },

  // Form card
  formCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3, borderWidth: 1, borderColor: "#F3F4F6" },

  // Input
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  inputWrapFocused: { borderColor: BLUE, backgroundColor: "#fff", shadowColor: BLUE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#171717" },
  hint: { fontSize: 12, color: "#9CA3AF", marginTop: -6, marginBottom: 16, textAlign: "right" },

  // Button
  btnPrimary: { backgroundColor: BLUE, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: { fontSize: 13, color: "#9CA3AF", marginHorizontal: 16 },

  // Social
  socialRow: { flexDirection: "row", justifyContent: "center", gap: 14 },
  socialBtn: { width: 50, height: 50, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },

  // Switch
  switchRow: { alignItems: "center", marginTop: 24 },
  switchText: { fontSize: 14, color: "#6B7280" },
  switchLink: { fontWeight: "700", color: BLUE },
});