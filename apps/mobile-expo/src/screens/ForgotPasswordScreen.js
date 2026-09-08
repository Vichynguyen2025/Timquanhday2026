import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { colors } from "../theme/colors";
import { Ionicons } from "@expo/vector-icons";
import api from "../services/api";

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
  const codeInputs = useRef([]);

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
      const res = await api.post("/auth/forgot-password", { email });
      setStep("otp");
      setCountdown(60); // Allow resend after 60s
    } catch (e) {
      setError(e.response?.data?.error || "Không thể gửi mã xác nhận");
    }
    setLoading(false);
  }

  async function handleVerifyOTP() {
    if (!code || code.length < 4) { setError("Vui lòng nhập mã xác nhận"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/verify-otp", { email, code });
      if (res.data?.valid) setStep("reset");
    } catch (e) {
      setError(e.response?.data?.error || "Mã xác nhận không hợp lệ");
    }
    setLoading(false);
  }

  async function handleResetPassword() {
    if (!newPw || !confirmPw) { setError("Vui lòng nhập mật khẩu mới"); return; }
    if (newPw !== confirmPw) { setError("Mật khẩu không khớp"); return; }
    if (newPw.length < 6) { setError("Mật khẩu tối thiểu 6 ký tự"); return; }
    setLoading(true); setError("");
    try {
      const res = await api.post("/auth/reset-password", { email, code, password: newPw });
      if (res.data?.ok) setStep("done");
    } catch (e) {
      setError(e.response?.data?.error || "Không thể đặt lại mật khẩu");
    }
    setLoading(false);
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={styles.inner}>
        {/* Back */}
        {step !== STEPS.DONE && (
          <TouchableOpacity onPress={() => { if (step === STEPS.EMAIL) navigation.goBack(); else setStep("email"); setError(""); }} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}

        {step === STEPS.EMAIL && (
          <>
            <View style={styles.iconWrap}><Ionicons name="lock-open" size={32} color={colors.primary} /></View>
            <Text style={styles.title}>Quên mật khẩu</Text>
            <Text style={styles.subtitle}>Nhập email của bạn để nhận mã xác nhận</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Email của bạn" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>
            <TouchableOpacity style={styles.btn} onPress={handleSendOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Gửi mã xác nhận</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === STEPS.OTP && (
          <>
            <View style={styles.iconWrap}><Ionicons name="keypad" size={32} color={colors.primary} /></View>
            <Text style={styles.title}>Nhập mã xác nhận</Text>
            <Text style={styles.subtitle}>Mã đã được gửi đến <Text style={{ fontWeight: "600" }}>{email}</Text></Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.inputWrap}>
              <TextInput
                style={[styles.input, { textAlign: "center", fontSize: 24, letterSpacing: 8 }]}
                placeholder="000000"
                value={code}
                onChangeText={setCode}
                maxLength={6}
                keyboardType="number-pad"
              />
            </View>
            <TouchableOpacity style={styles.btn} onPress={handleVerifyOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Xác nhận</Text>}
            </TouchableOpacity>
            {countdown > 0 ? (
              <Text style={styles.resendText}>Gửi lại sau {formatCountdown(countdown)}</Text>
            ) : (
              <TouchableOpacity onPress={handleSendOTP} disabled={loading}>
                <Text style={styles.resendLink}>Gửi lại mã</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {step === STEPS.RESET && (
          <>
            <View style={styles.iconWrap}><Ionicons name="lock-closed" size={32} color={colors.primary} /></View>
            <Text style={styles.title}>Mật khẩu mới</Text>
            <Text style={styles.subtitle}>Nhập mật khẩu mới cho tài khoản của bạn</Text>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Mật khẩu mới" value={newPw} onChangeText={setNewPw} secureTextEntry={!showPw} />
              <TouchableOpacity onPress={() => setShowPw(!showPw)}><Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.textTertiary} style={styles.inputIcon} />
              <TextInput style={styles.input} placeholder="Nhập lại mật khẩu" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!showPw} />
            </View>
            <TouchableOpacity style={styles.btn} onPress={handleResetPassword} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Đặt lại mật khẩu</Text>}
            </TouchableOpacity>
          </>
        )}

        {step === STEPS.DONE && (
          <>
            <View style={[styles.iconWrap, { backgroundColor: "#DCFCE7" }]}><Ionicons name="checkmark-circle" size={40} color="#22C55E" /></View>
            <Text style={styles.title}>Thành công!</Text>
            <Text style={styles.subtitle}>Mật khẩu của bạn đã được đặt lại thành công</Text>
            <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate("Login")}>
              <Text style={styles.btnText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </>
        )}

        {step !== STEPS.DONE && step !== STEPS.EMAIL && (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.link}>Quay lại đăng nhập</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  inner: { flex: 1, justifyContent: "center", padding: 24 },
  backBtn: { position: "absolute", top: 60, left: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  iconWrap: { width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center" },
  title: { fontSize: 26, fontWeight: "700", color: colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },
  error: { color: colors.error, fontSize: 13, backgroundColor: colors.error + "15", padding: 10, borderRadius: 10, marginBottom: 12, overflow: "hidden" },
  inputWrap: { flexDirection: "row", alignItems: "center", backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 14, marginBottom: 12, height: 50 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: colors.text },
  btn: { backgroundColor: colors.primary, borderRadius: 12, height: 50, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link: { textAlign: "center", marginTop: 16, fontSize: 14, color: colors.primary, fontWeight: "500" },
  resendText: { textAlign: "center", marginTop: 14, fontSize: 13, color: "#9CA3AF" },
  resendLink: { textAlign: "center", marginTop: 14, fontSize: 13, color: colors.primary, fontWeight: "600" },
});