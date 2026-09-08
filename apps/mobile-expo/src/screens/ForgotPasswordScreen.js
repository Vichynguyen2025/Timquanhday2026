import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";

const BLUE = "#2563EB";
const BLUE_LIGHT = "#EFF6FF";
const STEPS = { EMAIL: "email", OTP: "otp", RESET: "reset", DONE: "done" };

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(STEPS.EMAIL);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => { if (c <= 1) { clearInterval(timerRef.current); return 0; } return c - 1; });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown > 0]);

  function formatCountdown(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  async function handleSendOTP() {
    if (!email) { setError("Vui lòng nhập email"); return; }
    setLoading(true); setError("");
    try {
      await api.post("/auth/forgot-password", { email });
      setStep(STEPS.OTP);
      setCountdown(60);
    } catch (e) { setError(e.response?.data?.error || "Không thể gửi mã xác nhận"); }
    setLoading(false);
  }

  async function handleVerifyOTP() {
    if (!code || code.length < 4) { setError("Vui lòng nhập mã xác nhận"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", { email, code });
      if (res.data?.valid) setStep(STEPS.RESET);
    } catch (e) { setError(e.response?.data?.error || "Mã xác nhận không hợp lệ"); }
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!newPw || !confirmPw) { setError("Vui lòng nhập mật khẩu mới"); return; }
    if (newPw !== confirmPw) { setError("Mật khẩu không khớp"); return; }
    if (newPw.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/reset-password", { email, code, password: newPw });
      if (res.data?.ok) setStep(STEPS.DONE);
    } catch (e) { setError(e.response?.data?.error || "Không thể đặt lại mật khẩu"); }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.decorTop}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>

        {step !== STEPS.DONE && (
          <TouchableOpacity onPress={() => { step === STEPS.EMAIL ? navigation.goBack() : setStep(STEPS.EMAIL); setError(""); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color="#171717" />
          </TouchableOpacity>
        )}

        {step === STEPS.EMAIL && (
          <>
            <View style={styles.logoWrap}>
              <View style={styles.logoIcon}><Ionicons name="lock-open" size={26} color={BLUE} /></View>
            </View>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>Nhập email để nhận mã xác nhận</Text>
            {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={16} color="#DC2626" /><Text style={styles.errorText}>{error}</Text></View> : null}
            <View style={styles.formCard}>
              <View style={[styles.inputWrap, email ? styles.inputWrapFocused : null]}>
                <Ionicons name="mail-outline" size={18} color={email ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Email của bạn" placeholderTextColor="#9CA3AF" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
              </View>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSendOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <View style={styles.btnInner}><Text style={styles.btnText}>Gửi mã xác nhận</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></View>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === STEPS.OTP && (
          <>
            <View style={styles.logoWrap}>
              <View style={styles.logoIcon}><Ionicons name="keypad" size={26} color={BLUE} /></View>
            </View>
            <Text style={styles.title}>Nhập mã xác nhận</Text>
            <Text style={[styles.subtitle, { marginBottom: 12 }]}>Mã đã gửi đến <Text style={{ fontWeight: "600", color: "#171717" }}>{email}</Text></Text>
            {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={16} color="#DC2626" /><Text style={styles.errorText}>{error}</Text></View> : null}
            <View style={styles.formCard}>
              <View style={styles.codeRow}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <View key={i} style={[styles.codeBox, code[i] ? styles.codeBoxActive : null]}>
                    <Text style={styles.codeDigit}>{code[i] || ""}</Text>
                  </View>
                ))}
              </View>
              <TextInput style={styles.codeInput} value={code} onChangeText={setCode} maxLength={6} keyboardType="number-pad" autoFocus />
              <TouchableOpacity style={styles.btnPrimary} onPress={handleVerifyOTP} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Xác nhận</Text>}
              </TouchableOpacity>
              {countdown > 0 ? (
                <Text style={styles.resendText}>Gửi lại sau {formatCountdown(countdown)}</Text>
              ) : (
                <TouchableOpacity onPress={handleSendOTP} disabled={loading} style={{ marginTop: 14, alignItems: "center" }}>
                  <Text style={styles.resendLink}>Gửi lại mã</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {step === STEPS.RESET && (
          <>
            <View style={styles.logoWrap}>
              <View style={styles.logoIcon}><Ionicons name="lock-closed" size={26} color={BLUE} /></View>
            </View>
            <Text style={styles.title}>Mật khẩu mới</Text>
            <Text style={styles.subtitle}>Nhập mật khẩu mới cho tài khoản</Text>
            {error ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={16} color="#DC2626" /><Text style={styles.errorText}>{error}</Text></View> : null}
            <View style={styles.formCard}>
              <View style={[styles.inputWrap, newPw ? styles.inputWrapFocused : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={newPw ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Mật khẩu mới" placeholderTextColor="#9CA3AF" value={newPw} onChangeText={setNewPw} secureTextEntry={!showPw} />
                <TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#9CA3AF" /></TouchableOpacity>
              </View>
              <View style={[styles.inputWrap, confirmPw ? styles.inputWrapFocused : null]}>
                <Ionicons name="lock-closed-outline" size={18} color={confirmPw ? BLUE : "#9CA3AF"} style={styles.inputIcon} />
                <TextInput style={styles.input} placeholder="Nhập lại mật khẩu" placeholderTextColor="#9CA3AF" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!showPw} />
              </View>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleResetPassword} disabled={loading} activeOpacity={0.85}>
                {loading ? <ActivityIndicator color="#fff" /> : <View style={styles.btnInner}><Text style={styles.btnText}>Đặt lại mật khẩu</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></View>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {step === STEPS.DONE && (
          <>
            <View style={[styles.logoWrap, { marginTop: 120 }]}>
              <View style={[styles.logoIcon, { backgroundColor: "#DCFCE7" }]}><Ionicons name="checkmark-circle" size={32} color="#22C55E" /></View>
            </View>
            <Text style={styles.title}>Hoàn tất!</Text>
            <Text style={styles.subtitle}>Mật khẩu của bạn đã được đặt lại thành công</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => navigation.navigate("Login")} activeOpacity={0.85}>
              <View style={styles.btnInner}><Text style={styles.btnText}>Quay lại đăng nhập</Text><Ionicons name="log-in" size={18} color="#fff" /></View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FAFBFC" },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },

  decorTop: { position: "absolute", top: 0, left: 0, right: 0, height: 200, overflow: "hidden" },
  decorCircle1: { position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: BLUE_LIGHT, opacity: 0.6 },
  decorCircle2: { position: "absolute", top: -20, left: -60, width: 140, height: 140, borderRadius: 70, backgroundColor: "#DBEAFE", opacity: 0.4 },

  backBtn: { position: "absolute", top: 60, left: 20, zIndex: 10, width: 40, height: 40, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },

  logoWrap: { alignItems: "center", marginTop: 80, marginBottom: 20 },
  logoIcon: { width: 64, height: 64, borderRadius: 18, backgroundColor: BLUE_LIGHT, alignItems: "center", justifyContent: "center", shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 6 },

  title: { fontSize: 26, fontWeight: "700", color: "#171717", textAlign: "center", letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 6, marginBottom: 24, lineHeight: 20 },

  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", padding: 12, borderRadius: 12, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },

  formCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3, borderWidth: 1, borderColor: "#F3F4F6" },

  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F9FAFB", borderRadius: 14, paddingHorizontal: 14, height: 50, marginBottom: 12, borderWidth: 1, borderColor: "#F3F4F6" },
  inputWrapFocused: { borderColor: BLUE, backgroundColor: "#fff", shadowColor: BLUE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#171717" },

  // OTP code boxes
  codeRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 20 },
  codeBox: { width: 46, height: 56, borderRadius: 14, backgroundColor: "#F9FAFB", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#F3F4F6" },
  codeBoxActive: { borderColor: BLUE, backgroundColor: "#fff", shadowColor: BLUE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  codeDigit: { fontSize: 22, fontWeight: "700", color: "#171717" },
  codeInput: { position: "absolute", width: 1, height: 1, opacity: 0 },

  // Button
  btnPrimary: { backgroundColor: BLUE, borderRadius: 14, height: 50, alignItems: "center", justifyContent: "center", shadowColor: BLUE, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 6 },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  resendText: { textAlign: "center", marginTop: 14, fontSize: 13, color: "#9CA3AF" },
  resendLink: { fontSize: 13, color: BLUE, fontWeight: "600" },
});