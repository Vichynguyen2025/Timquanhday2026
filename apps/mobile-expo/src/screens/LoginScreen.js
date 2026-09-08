import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import { useAuth } from "../contexts/AuthContext";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REMEMBER_KEY = "@tqd_remember_creds";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Load saved credentials
  useEffect(() => {
    AsyncStorage.getItem(REMEMBER_KEY).then((saved) => {
      if (saved) {
        const { email: savedEmail, password: savedPw } = JSON.parse(saved);
        if (savedEmail) setEmail(savedEmail);
        if (savedPw) { setPassword(savedPw); setRememberMe(true); }
      }
    });
  }, []);

  async function handleLogin() {
    if (!email || !password) { setError("Vui lòng nhập đầy đủ thông tin"); return; }
    setLoading(true); setError("");
    try {
      await login(email, password);
      // Save/clear remember credentials
      if (rememberMe) {
        await AsyncStorage.setItem(REMEMBER_KEY, JSON.stringify({ email, password }));
      } else {
        await AsyncStorage.removeItem(REMEMBER_KEY);
      }
    } catch (e) {
      setError(e.response?.data?.error || "Sai email hoặc mật khẩu");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.inner}>
        <View style={styles.iconWrap}><Ionicons name="chatbubbles" size={36} color={colors.primary} /></View>
        <Text style={styles.title}>Đăng nhập</Text>
        <Text style={styles.subtitle}>Chào mừng bạn quay trở lại</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.inputWrap}>
          <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        </View>
        <View style={styles.inputWrap}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
          <TextInput style={styles.input} placeholder="Mật khẩu" value={password} onChangeText={setPassword} secureTextEntry={!showPw} />
          <TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} /></TouchableOpacity>
        </View>

        {/* Ghi nhớ + Quên mật khẩu */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.7}>
            <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
            <Text style={styles.rememberText}>Ghi nhớ mật khẩu</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
            <Text style={styles.forgotText}>Quên mật khẩu?</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Đăng nhập</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Chưa có tài khoản? <Text style={{ fontWeight: "700", color: colors.primary }}>Đăng ký</Text></Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" },
  title: { fontSize: 28, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: 24 },
  error: { color: colors.error, fontSize: 13, backgroundColor: colors.error + "15", padding: 10, borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 14, marginBottom: 12, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: colors.text },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  rememberText: { fontSize: 13, color: colors.textSecondary },
  forgotText: { fontSize: 13, color: colors.primary, fontWeight: "600" },
  btn: { backgroundColor: colors.primary, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center", marginTop: 12 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", marginTop: 16, fontSize: 14, color: colors.textSecondary },
});