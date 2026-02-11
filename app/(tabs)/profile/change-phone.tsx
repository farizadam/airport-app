import React, { useState, useEffect } from "react";
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
import { auth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from "../../../src/firebase";

export default function ChangePhoneScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [newPhone, setNewPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState<any>(null);
  const [resendSeconds, setResendSeconds] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (resendSeconds > 0) {
      const timer = setTimeout(() => setResendSeconds(resendSeconds - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendSeconds]);

  const formatPhoneNumber = (phone: string) => {
    // Remove all non-digit characters except +
    let cleaned = phone.replace(/[^\d+]/g, "");
    // Ensure it starts with +
    if (!cleaned.startsWith("+")) {
      cleaned = "+" + cleaned;
    }
    return cleaned;
  };

  const validatePhone = (phone: string) => {
    // Basic international phone validation
    const phoneRegex = /^\+[1-9]\d{6,14}$/;
    return phoneRegex.test(phone);
  };

  const sendPhoneOtp = async () => {
    const formattedPhone = formatPhoneNumber(newPhone);

    if (!validatePhone(formattedPhone)) {
      toast.warning("Invalid Phone Number", "Please enter a valid phone number with country code (e.g., +33612345678)");
      return;
    }

    if (formattedPhone === user?.phone) {
      toast.warning("Same Number", "New phone number must be different from your current phone");
      return;
    }

    setLoading(true);
    try {
      // Use modular Firebase signInWithPhoneNumber
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone);
      setVerificationId(confirmation);
      setStep("otp");
      setResendSeconds(60);
      toast.info("OTP Sent", "A verification code has been sent to your phone.");
    } catch (error: any) {
      console.error("Phone OTP send error:", error);
      let errorMessage = "Failed to send verification code";
      
      if (error.code === "auth/invalid-phone-number") {
        errorMessage = "Invalid phone number format";
      } else if (error.code === "auth/too-many-requests") {
        errorMessage = "Too many requests. Please try again later.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast.warning("Missing Code", "Please enter the 6-digit verification code");
      return;
    }

    if (!verificationId) {
      toast.error("Error", "No verification in progress. Please request a new code.");
      return;
    }

    setLoading(true);
    try {
      let firebaseToken = null;

      // Native confirmation object: call confirm(code)
      if (verificationId && typeof verificationId.confirm === "function") {
        await verificationId.confirm(otp);
        // Get the Firebase ID token using modular API
        const currentUser = auth.currentUser;
        if (currentUser) {
          firebaseToken = await currentUser.getIdToken(true);
        }
      } else if (typeof verificationId === "string") {
        // Some flows return a verificationId string - use modular API
        const credential = PhoneAuthProvider.credential(verificationId, otp);
        await signInWithCredential(auth, credential);
        const currentUser = auth.currentUser;
        if (currentUser) {
          firebaseToken = await currentUser.getIdToken(true);
        }
      }

      if (!firebaseToken) {
        throw new Error("Failed to get Firebase token");
      }

      // Call backend to change phone
      await api.post("/users/me/change-phone", {
        firebase_token: firebaseToken,
      });

      await refreshUser();
      toast.success("Phone Updated", "Your phone number has been updated successfully!");
      router.back();
    } catch (error: any) {
      console.error("Phone change error:", error);
      let errorMessage = "Failed to change phone number";
      
      if (error.code === "auth/invalid-verification-code") {
        errorMessage = "Invalid verification code";
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (resendSeconds > 0) return;
    setOtp("");
    await sendPhoneOtp();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Change Phone Number</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.content}>
          {/* Current Phone Display */}
          <View style={styles.currentPhoneCard}>
            <Ionicons name="call" size={20} color="#64748B" />
            <View style={styles.currentPhoneInfo}>
              <Text style={styles.currentPhoneLabel}>Current Phone</Text>
              <Text style={styles.currentPhoneValue}>{user?.phone || "Not set"}</Text>
            </View>
          </View>

          {step === "phone" ? (
            <>
              {/* New Phone Input */}
              <Text style={styles.inputLabel}>New Phone Number</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="call-outline" size={20} color="#64748B" />
                <TextInput
                  style={styles.input}
                  placeholder="+33612345678"
                  placeholderTextColor="#94A3B8"
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              <Text style={styles.infoText}>
                Include your country code (e.g., +33 for France, +1 for USA).
                A verification code will be sent via SMS.
              </Text>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={sendPhoneOtp}
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
                Enter the 6-digit code sent to {formatPhoneNumber(newPhone)}
              </Text>
              <View style={styles.inputContainer}>
                <Ionicons name="key-outline" size={20} color="#64748B" />
                <TextInput
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

              {/* Change Phone Button */}
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={verifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Change Phone</Text>
                )}
              </TouchableOpacity>

              {/* Back to Phone Input */}
              <TouchableOpacity
                style={styles.backToPhoneButton}
                onPress={() => {
                  setStep("phone");
                  setOtp("");
                  setVerificationId(null);
                }}
              >
                <Text style={styles.backToPhoneText}>Use a different number</Text>
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
  currentPhoneCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  currentPhoneInfo: {
    flex: 1,
  },
  currentPhoneLabel: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 2,
  },
  currentPhoneValue: {
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
    lineHeight: 18,
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
  backToPhoneButton: {
    marginTop: 16,
    alignItems: "center",
  },
  backToPhoneText: {
    fontSize: 14,
    color: "#64748B",
  },
});
