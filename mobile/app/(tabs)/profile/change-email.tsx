import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../../src/store/authStore";
import { api } from "../../../src/lib/api";
import { toast } from "../../../src/store/toastStore";

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  
  const [step, setStep] = useState<"email" | "otp">("email");
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const otpInputRef = useRef<TextInput>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (resendSeconds > 0) {
      const timer = setTimeout(() => setResendSeconds(resendSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendSeconds]);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const sendOtp = async () => {
    if (!newEmail.trim()) {
      toast.warning("Missing Email", "Please enter your new email address");
      return;
    }

    if (!validateEmail(newEmail.trim())) {
      toast.warning("Invalid Email", "Please enter a valid email address");
      return;
    }

    if (newEmail.toLowerCase().trim() === user?.email?.toLowerCase()) {
      toast.warning("Same Email", "New email must be different from your current email");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/send-email-otp", { email: newEmail.trim() });
      setStep("otp");
      setResendSeconds(60);
      toast.info("OTP Sent", "A verification code has been sent to your new email address.");
      setTimeout(() => otpInputRef.current?.focus(), 100);
    } catch (error: any) {
      toast.error("Error", error.response?.data?.message || "Failed to send verification code");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndChangeEmail = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast.warning("Missing Code", "Please enter the 6-digit verification code");
      return;
    }

    setLoading(true);
    try {
      // First verify the OTP
      await api.post("/auth/verify-email-otp", {
        email: newEmail.trim(),
        code: otp,
      });

      // Then change the email
      await api.post("/users/me/change-email", {
        new_email: newEmail.trim(),
      });

      await refreshUser();
      toast.success("Email Updated", "Your email has been updated successfully!");
      router.back();
    } catch (error: any) {
      toast.error("Error", error.response?.data?.message || "Failed to change email");
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) return;
    await sendOtp();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.keyboardView}
        keyboardVerticalOffset={100}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Email</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Current Email Display */}
          <View style={styles.currentEmailCard}>
            <Ionicons name="mail" size={20} color="#64748B" />
            <View style={styles.currentEmailInfo}>
              <Text style={styles.currentEmailLabel}>Current Email</Text>
              <Text style={styles.currentEmailValue}>{user?.email}</Text>
            </View>
          </View>

          {step === "email" ? (
            <>
              {/* New Email Input */}
              <Text style={styles.inputLabel}>New Email Address</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your new email"
                  placeholderTextColor="#94A3B8"
                  value={newEmail}
                  onChangeText={setNewEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              <Text style={styles.infoText}>
                A verification code will be sent to your new email address.
              </Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={sendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              {/* OTP Input */}
              <Text style={styles.inputLabel}>Verification Code</Text>
              <Text style={styles.otpSentText}>
                Enter the 6-digit code sent to {newEmail}
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#64748B" />
                <TextInput
                  ref={otpInputRef}
                  style={styles.input}
                  placeholder="Enter 6-digit code"
                  placeholderTextColor="#94A3B8"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />
              </View>

              {/* Resend OTP */}
              <TouchableOpacity
                onPress={resendOtp}
                disabled={resendSeconds > 0}
                style={styles.resendButton}
              >
                <Text
                  style={[
                    styles.resendText,
                    resendSeconds > 0 && styles.resendTextDisabled,
                  ]}
                >
                  {resendSeconds > 0
                    ? `Resend code in ${resendSeconds}s`
                    : "Resend verification code"}
                </Text>
              </TouchableOpacity>

              {/* Change Email Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={verifyAndChangeEmail}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Change Email</Text>
                )}
              </TouchableOpacity>

              {/* Back to Email Input */}
              <TouchableOpacity
                style={styles.backToEmailButton}
                onPress={() => {
                  setStep("email");
                  setOtp("");
                }}
              >
                <Text style={styles.backToEmailText}>Use a different email</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  currentEmailCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  currentEmailInfo: {
    flex: 1,
  },
  currentEmailLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },
  currentEmailValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#1F2937",
  },
  infoText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 8,
    marginBottom: 24,
  },
  otpSentText: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 12,
  },
  button: {
    backgroundColor: "#007AFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  resendButton: {
    marginTop: 16,
    alignItems: "center",
  },
  resendText: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "500",
  },
  resendTextDisabled: {
    color: "#94A3B8",
  },
  backToEmailButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backToEmailText: {
    fontSize: 14,
    color: "#64748B",
  },
});
