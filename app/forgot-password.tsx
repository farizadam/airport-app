import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "@/store/toastStore";
import api from "@/lib/api";
import { auth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, getIdToken } from "@/firebase";

type Step = "identifier" | "verify" | "reset";
type IdentifierType = "email" | "phone";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("identifier");
  const [identifierType, setIdentifierType] = useState<IdentifierType>("email");
  const [identifier, setIdentifier] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [maskedDestination, setMaskedDestination] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Firebase phone auth state (same pattern as register)
  const [verificationId, setVerificationId] = useState<any>(null);

  const codeInputRef = useRef<TextInput>(null);

  // Step 1: Send reset code
  const handleSendCode = async () => {
    if (!identifier.trim()) {
      toast.warning(
        "Missing Field",
        identifierType === "email"
          ? "Please enter your email address"
          : "Please enter your phone number"
      );
      return;
    }

    try {
      setLoading(true);

      if (identifierType === "email") {
        // Email flow: use backend OTP
        const response = await api.post("/auth/forgot-password/send-code", {
          identifier: identifier.trim(),
          identifier_type: "email",
        });

        setMaskedDestination(response.data.data.masked_destination);
        setResetEmail(response.data.data.reset_email);
        setStep("verify");
        toast.success("Code Sent", "A verification code has been sent to your email");
        setTimeout(() => codeInputRef.current?.focus(), 300);
      } else {
        // Phone flow: first check user exists, then use Firebase phone auth
        const phone = identifier.trim();

        // Validate E.164 format
        const isE164 = /^\+[1-9]\d{1,14}$/.test(phone);
        if (!isE164) {
          toast.warning("Invalid Phone", "Phone must be in E.164 format (e.g. +12025550123)");
          return;
        }

        // Check user exists on backend first
        const checkRes = await api.post("/auth/forgot-password/send-code", {
          identifier: phone,
          identifier_type: "phone",
        });
        // We get reset_email back even for phone (backend resolves user)
        setResetEmail(checkRes.data.data.reset_email);
        setMaskedDestination(checkRes.data.data.masked_destination);

        // Now send Firebase phone OTP (same as register)
        try {
          const confirmation = await signInWithPhoneNumber(auth, phone);
          setVerificationId(confirmation);
          setStep("verify");
          toast.success("Code Sent", "A verification code was sent to your phone");
          setTimeout(() => codeInputRef.current?.focus(), 300);
        } catch (phoneErr: any) {
          console.error("Firebase phone auth error", phoneErr);
          toast.error("Error", phoneErr.message || "Phone auth failed. Ensure you're running a dev build.");
        }
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message || error.message || "Something went wrong";
      toast.error("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify code
  const handleVerifyCode = async () => {
    if (!code.trim() || code.trim().length < 6) {
      toast.warning("Invalid Code", "Please enter the 6-digit code");
      return;
    }

    try {
      setLoading(true);

      if (identifierType === "email") {
        // Email flow: verify via backend
        await api.post("/auth/forgot-password/verify-code", {
          email: resetEmail,
          code: code.trim(),
        });

        setStep("reset");
        toast.success("Verified", "You can now set a new password");
      } else {
        // Phone flow: verify via Firebase (same as register)
        if (!verificationId) {
          toast.error("Error", "No verification ID. Request code first.");
          return;
        }

        // Native confirmation object: call confirm(code)
        if (verificationId && typeof verificationId.confirm === "function") {
          await verificationId.confirm(code.trim());
        } else if (typeof verificationId === "string") {
          const credential = PhoneAuthProvider.credential(verificationId, code.trim());
          await signInWithCredential(auth, credential);
        } else {
          toast.error("Error", "No native confirmation available.");
          return;
        }

        // Get Firebase ID token and send to backend to mark reset as verified
        const idToken = await getIdToken();
        const verifyRes = await api.post("/auth/forgot-password/verify-phone", {
          phone: identifier.trim(),
          firebase_token: idToken,
        });

        // Backend returns the reset_email
        if (verifyRes.data.data?.reset_email) {
          setResetEmail(verifyRes.data.data.reset_email);
        }

        setStep("reset");
        toast.success("Verified", "You can now set a new password");
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message || error.message || "Something went wrong";
      toast.error("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      toast.warning(
        "Weak Password",
        "Password must be at least 8 characters"
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.warning("Mismatch", "Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/forgot-password/reset", {
        email: resetEmail,
        new_password: newPassword,
      });

      toast.success("Success", "Your password has been reset. Please log in.");
      router.replace("/login");
    } catch (error: any) {
      const msg =
        error.response?.data?.message || error.message || "Something went wrong";
      toast.error("Reset Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend code
  const handleResendCode = async () => {
    try {
      setLoading(true);

      if (identifierType === "email") {
        const response = await api.post("/auth/forgot-password/send-code", {
          identifier: identifier.trim(),
          identifier_type: identifierType,
        });
        setResetEmail(response.data.data.reset_email);
        setCode("");
        toast.success("Code Resent", "A new verification code has been sent");
      } else {
        // Re-send Firebase phone OTP
        try {
          const confirmation = await signInWithPhoneNumber(auth, identifier.trim());
          setVerificationId(confirmation);
          setCode("");
          toast.success("Code Resent", "A new verification code was sent to your phone");
        } catch (phoneErr: any) {
          console.error("Firebase phone resend error", phoneErr);
          toast.error("Error", phoneErr.message || "Failed to resend code");
        }
      }
    } catch (error: any) {
      const msg =
        error.response?.data?.message || error.message || "Something went wrong";
      toast.error("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    switch (step) {
      case "identifier":
        return "Forgot Password";
      case "verify":
        return "Verify Code";
      case "reset":
        return "New Password";
    }
  };

  const getStepSubtitle = () => {
    switch (step) {
      case "identifier":
        return "Enter your email or phone number to receive a reset code";
      case "verify":
        return `Enter the 6-digit code sent to ${maskedDestination}`;
      case "reset":
        return "Create a new secure password for your account";
    }
  };

  const getStepNumber = () => {
    switch (step) {
      case "identifier":
        return 1;
      case "verify":
        return 2;
      case "reset":
        return 3;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header */}
      <LinearGradient colors={["#3B82F6", "#1E40AF"]} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (step === "verify") {
              setStep("identifier");
              setCode("");
            } else if (step === "reset") {
              // Can't go back from reset (security)
              router.back();
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Ionicons name="key" size={28} color="#3B82F6" />
          </View>
          <Text style={styles.headerTitle}>{getStepTitle()}</Text>
          <Text style={styles.headerSubtitle}>{getStepSubtitle()}</Text>
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          {[1, 2, 3].map((s) => (
            <View key={s} style={styles.stepRow}>
              <View
                style={[
                  styles.stepDot,
                  s <= getStepNumber() && styles.stepDotActive,
                ]}
              >
                {s < getStepNumber() ? (
                  <Ionicons name="checkmark" size={12} color="#fff" />
                ) : (
                  <Text
                    style={[
                      styles.stepDotText,
                      s <= getStepNumber() && styles.stepDotTextActive,
                    ]}
                  >
                    {s}
                  </Text>
                )}
              </View>
              {s < 3 && (
                <View
                  style={[
                    styles.stepLine,
                    s < getStepNumber() && styles.stepLineActive,
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.form}>
            {/* ===== STEP 1: Choose identifier ===== */}
            {step === "identifier" && (
              <>
                {/* Toggle buttons */}
                <View style={styles.toggleContainer}>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      identifierType === "email" && styles.toggleButtonActive,
                    ]}
                    onPress={() => {
                      setIdentifierType("email");
                      setIdentifier("");
                    }}
                  >
                    <Ionicons
                      name="mail-outline"
                      size={18}
                      color={identifierType === "email" ? "#fff" : "#3B82F6"}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        identifierType === "email" && styles.toggleTextActive,
                      ]}
                    >
                      Email
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      identifierType === "phone" && styles.toggleButtonActive,
                    ]}
                    onPress={() => {
                      setIdentifierType("phone");
                      setIdentifier("");
                    }}
                  >
                    <Ionicons
                      name="call-outline"
                      size={18}
                      color={identifierType === "phone" ? "#fff" : "#3B82F6"}
                    />
                    <Text
                      style={[
                        styles.toggleText,
                        identifierType === "phone" && styles.toggleTextActive,
                      ]}
                    >
                      Phone
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Input */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>
                    {identifierType === "email"
                      ? "Email Address"
                      : "Phone Number"}
                  </Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name={
                        identifierType === "email"
                          ? "mail-outline"
                          : "call-outline"
                      }
                      size={20}
                      color="#94A3B8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder={
                        identifierType === "email"
                          ? "Enter your email"
                          : "Enter your phone number"
                      }
                      placeholderTextColor="#94A3B8"
                      value={identifier}
                      onChangeText={setIdentifier}
                      keyboardType={
                        identifierType === "email"
                          ? "email-address"
                          : "phone-pad"
                      }
                      autoCapitalize="none"
                      autoComplete={
                        identifierType === "email" ? "email" : "tel"
                      }
                    />
                  </View>
                </View>

                {/* Send Code Button */}
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleSendCode}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ["#94A3B8", "#94A3B8"]
                        : ["#3B82F6", "#1E40AF"]
                    }
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Send Reset Code</Text>
                        <Ionicons
                          name="arrow-forward"
                          size={20}
                          color="#fff"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* ===== STEP 2: Verify code ===== */}
            {step === "verify" && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Verification Code</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={20}
                      color="#94A3B8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      ref={codeInputRef}
                      style={styles.input}
                      placeholder="Enter 6-digit code"
                      placeholderTextColor="#94A3B8"
                      value={code}
                      onChangeText={(text) =>
                        setCode(text.replace(/[^0-9]/g, "").slice(0, 6))
                      }
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>

                {/* Verify Button */}
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleVerifyCode}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ["#94A3B8", "#94A3B8"]
                        : ["#3B82F6", "#1E40AF"]
                    }
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Verify Code</Text>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#fff"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Resend */}
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={handleResendCode}
                  disabled={loading}
                >
                  <Text style={styles.resendText}>
                    Didn't receive the code?{" "}
                    <Text style={styles.resendTextBold}>Resend</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}

            {/* ===== STEP 3: Reset password ===== */}
            {step === "reset" && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>New Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#94A3B8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password"
                      placeholderTextColor="#94A3B8"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={
                          showPassword ? "eye-outline" : "eye-off-outline"
                        }
                        size={20}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#94A3B8"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor="#94A3B8"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={
                          showConfirmPassword
                            ? "eye-outline"
                            : "eye-off-outline"
                        }
                        size={20}
                        color="#94A3B8"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Password requirements */}
                <View style={styles.requirementsContainer}>
                  <View style={styles.requirementRow}>
                    <Ionicons
                      name={
                        newPassword.length >= 8
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={16}
                      color={newPassword.length >= 8 ? "#10B981" : "#94A3B8"}
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        newPassword.length >= 8 && styles.requirementMet,
                      ]}
                    >
                      At least 8 characters
                    </Text>
                  </View>
                  <View style={styles.requirementRow}>
                    <Ionicons
                      name={
                        newPassword === confirmPassword &&
                        confirmPassword.length > 0
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={16}
                      color={
                        newPassword === confirmPassword &&
                        confirmPassword.length > 0
                          ? "#10B981"
                          : "#94A3B8"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        newPassword === confirmPassword &&
                          confirmPassword.length > 0 &&
                          styles.requirementMet,
                      ]}
                    >
                      Passwords match
                    </Text>
                  </View>
                </View>

                {/* Reset Button */}
                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading
                        ? ["#94A3B8", "#94A3B8"]
                        : ["#10B981", "#059669"]
                    }
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Reset Password</Text>
                        <Ionicons
                          name="checkmark-done"
                          size={20}
                          color="#fff"
                        />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            {/* Back to login */}
            <TouchableOpacity
              style={styles.backToLoginButton}
              onPress={() => router.replace("/login")}
            >
              <Text style={styles.backToLoginText}>
                Remember your password?{" "}
                <Text style={styles.backToLoginTextBold}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  headerContent: {
    alignItems: "center",
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: {
    backgroundColor: "#fff",
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.6)",
  },
  stepDotTextActive: {
    color: "#3B82F6",
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: "#fff",
  },
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  form: {
    flex: 1,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  toggleButtonActive: {
    backgroundColor: "#3B82F6",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },
  toggleTextActive: {
    color: "#fff",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: "#1E293B",
  },
  eyeButton: {
    padding: 4,
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 8,
  },
  buttonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  resendButton: {
    alignItems: "center",
    marginTop: 20,
  },
  resendText: {
    fontSize: 15,
    color: "#64748B",
  },
  resendTextBold: {
    color: "#3B82F6",
    fontWeight: "700",
  },
  requirementsContainer: {
    marginBottom: 8,
    gap: 8,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  requirementMet: {
    color: "#10B981",
  },
  backToLoginButton: {
    alignItems: "center",
    marginTop: 32,
  },
  backToLoginText: {
    fontSize: 15,
    color: "#64748B",
  },
  backToLoginTextBold: {
    color: "#3B82F6",
    fontWeight: "700",
  },
});
