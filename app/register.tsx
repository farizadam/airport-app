import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useRef, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import { auth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential, getIdToken } from "@/firebase";
import api from "@/lib/api";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { toast } from "../src/store/toastStore";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen() {
  const router = useRouter();
  const register = useAuthStore((state) => state.register);

  const [step, setStep] = useState(0);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    phone: "",
    role: "both" as "driver" | "passenger" | "both",
    id_image_front: "",
    id_image_back: "",
  });

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [generatedEmailOtp, setGeneratedEmailOtp] = useState("");
  const [enteredPhoneOtp, setEnteredPhoneOtp] = useState("");
  const [enteredEmailOtp, setEnteredEmailOtp] = useState("");
  const [verificationId, setVerificationId] = useState<any>(null);
  const [resendSeconds, setResendSeconds] = useState(0);
  const emailOtpInputRef = useRef<any>(null);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const pickImage = async (side: "front" | "back") => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast.warning("Permission Required", "Permission to access photos is required.");
        return;
      }

      // Disable the OS cropping UI to avoid users getting stuck in the crop
      // flow where cancelling can appear to remove the previously-selected image.
      // We'll keep the previous image if the user cancels selection.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) {
        // user cancelled the picker/crop — keep previous image
        toast.info("Selection Cancelled", "Previous image kept.");
        return;
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const field = side === "front" ? "id_image_front" : "id_image_back";
        if (asset.base64) {
          setFormData((prev) => ({
            ...prev,
            [field]: `data:image/jpeg;base64,${asset.base64}`,
          }));
        } else if (asset.uri) {
          setFormData((prev) => ({ ...prev, [field]: asset.uri }));
        }
      }
    } catch (err) {
      console.error("Image pick error", err);
      toast.error("Error", "Could not pick image");
    }
  };

  const validateForm = () => {
    if (
      !formData.email ||
      !formData.password ||
      !formData.first_name ||
      !formData.last_name ||
      !formData.phone
    ) {
      toast.warning("Missing Fields", "Please fill in all required fields");
      return false;
    }

    if (formData.password.length < 8) {
      toast.warning("Weak Password", "Password must be at least 8 characters");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.warning("Password Mismatch", "Passwords do not match");
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.warning("Invalid Email", "Please enter a valid email address");
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const { confirmPassword, ...registerData } = formData;
      console.log("DEBUG: registration payload (client)", {
        email: registerData.email,
        phone: registerData.phone,
        firebase_token: registerData.firebase_token
          ? `${registerData.firebase_token.slice(0, 40)}...`
          : null,
      });
      await register(registerData as any);
      router.replace("/(tabs)");
    } catch (error: any) {
      toast.error("Registration Failed", error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const sendPhoneOtp = async () => {
    if (!formData.phone) {
      toast.warning("Missing Phone", "Enter phone number first");
      return;
    }
    try {
      setLoading(true);
      // Validate phone number is in E.164 format (required by Firebase)
      const isE164 = /^\+[1-9]\d{1,14}$/.test(formData.phone);
      if (!isE164) {
        toast.warning("Invalid Phone Number", "Phone number must be in E.164 format. Example: +12025550123");
        return;
      }

      // Use modular signInWithPhoneNumber API
      try {
        const confirmation = await signInWithPhoneNumber(auth, formData.phone);
        setVerificationId(confirmation);
        setPhoneOtpSent(true);
        toast.info("OTP Sent", "A verification code was sent to your phone.");
      } catch (phoneAuthErr: any) {
        console.error("Phone auth error", phoneAuthErr);
        toast.error("Error", phoneAuthErr.message || "Phone auth is not available in this build.");
      }
    } catch (err: any) {
      console.error("Phone OTP send error", err);
      toast.error("Error", err.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!verificationId) {
      toast.error("Error", "No verification ID. Request code first.");
      return;
    }
    try {
      setLoading(true);
      // Native confirmation object: call confirm(code)
      if (verificationId && typeof verificationId.confirm === "function") {
        await verificationId.confirm(enteredPhoneOtp);
        // fetch fresh firebase id token and attach to form data for registration
        try {
          const idToken = await getIdToken();
          console.log("DEBUG ID_TOKEN (full):", idToken);
          setFormData((prev) => ({ ...prev, firebase_token: idToken }));
        } catch (tokenErr) {
          console.warn("Failed to get firebase token", tokenErr);
        }
        toast.success("Phone Verified", "Phone verified successfully");
        setStep((s) => Math.min(4, s + 1));
        return;
      }

      // Some flows return a verificationId string. Create credential and sign in.
      if (typeof verificationId === "string") {
        try {
          const credential = PhoneAuthProvider.credential(
            verificationId,
            enteredPhoneOtp,
          );
          // Use modular signInWithCredential
          await signInWithCredential(auth, credential);
          // fetch fresh firebase id token and attach to form data for registration
          try {
            const idToken = await getIdToken();
            console.log("DEBUG ID_TOKEN (full):", idToken);
            setFormData((prev) => ({ ...prev, firebase_token: idToken }));
          } catch (tokenErr) {
            console.warn("Failed to get firebase token", tokenErr);
          }
          toast.success("Phone Verified", "Phone verified successfully");
          setStep((s) => Math.min(4, s + 1));
          return;
        } catch (innerErr) {
          console.error("Credential sign-in error", innerErr);
          throw innerErr;
        }
      }

      toast.error("Error", "No native confirmation available. Ensure you're running a development build with native Firebase installed.");
    } catch (err: any) {
      console.error("Phone OTP verify error", err);
      toast.error("Error", err.message || "Incorrect OTP");
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOtp = () => {
    if (!formData.email) {
      toast.warning("Missing Email", "Enter email first");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const resp = await api.post("/auth/send-email-otp", {
          email: formData.email,
        });
        if (resp.data && resp.data.success) {
          setEmailOtpSent(true);
          setResendSeconds(60);
          try {
            emailOtpInputRef.current?.focus();
          } catch (_) {}
          toast.info("OTP Sent", "A verification code was sent to your email.");
        } else {
          throw new Error(resp.data?.message || "Failed to send OTP");
        }
      } catch (err: any) {
        console.error("Send email OTP error", err);
        const status = err?.response?.status;
        const message =
          err?.response?.data?.message || err.message || "Failed to send OTP";
        if (status === 429) {
          toast.warning("Too Many Requests", message);
        } else {
          toast.error("Error", message);
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  const verifyEmailOtp = () => {
    (async () => {
      try {
        setLoading(true);
        const resp = await api.post("/auth/verify-email-otp", {
          email: formData.email,
          code: enteredEmailOtp,
        });
        if (resp.data && resp.data.success) {
          toast.success("Email Verified", "Email verified successfully");
          setStep((s) => Math.min(4, s + 1));
        } else {
          throw new Error(resp.data?.message || "Incorrect OTP");
        }
      } catch (err: any) {
        console.error("Verify email OTP error", err);
        const status = err?.response?.status;
        const message =
          err?.response?.data?.message || err.message || "Incorrect OTP";
        if (status === 429) {
          // Too many attempts — force user to request a new code
          toast.warning("Too Many Attempts", message);
          setEmailOtpSent(false);
          setEnteredEmailOtp("");
        } else {
          toast.error("Error", message);
        }
      } finally {
        setLoading(false);
      }
    })();
  };

  // Countdown for resend
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const t = setInterval(() => {
      setResendSeconds((s) => {
        if (s <= 1) {
          clearInterval(t);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [resendSeconds]);

  // Autofocus email OTP input when sent
  useEffect(() => {
    if (emailOtpSent && emailOtpInputRef.current) {
      try {
        emailOtpInputRef.current.focus();
      } catch (_) {}
    }
  }, [emailOtpSent]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <LinearGradient colors={["#3B82F6", "#2563EB"]} style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Ionicons name="airplane" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.headerSubtitle}>
            Join the CovoitAir community
          </Text>
          <Text style={styles.stepIndicator}>Step {step + 1} of 5</Text>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.progressSegment,
                    i <= step && styles.progressSegmentActive,
                  ]}
                />
              ))}
            </View>
          </View>
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
            {step === 0 && (
              <>
                <View style={styles.row}>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.label}>First Name</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="John"
                        placeholderTextColor="#9CA3AF"
                        value={formData.first_name}
                        onChangeText={(value) =>
                          updateField("first_name", value)
                        }
                        autoCapitalize="words"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.label}>Last Name</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Doe"
                        placeholderTextColor="#9CA3AF"
                        value={formData.last_name}
                        onChangeText={(value) =>
                          updateField("last_name", value)
                        }
                        autoCapitalize="words"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => router.back()}
                  >
                    <Text style={styles.buttonTextSecondary}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={() => setStep(1)}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>Next</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 1 && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color="#9CA3AF"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="+212 6XX XXX XXX"
                      placeholderTextColor="#9CA3AF"
                      value={formData.phone}
                      onChangeText={(value) => updateField("phone", value)}
                      keyboardType="phone-pad"
                      autoComplete="tel"
                    />
                  </View>
                </View>

                {!phoneOtpSent ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.buttonPrimary,
                      styles.fullWidth,
                    ]}
                    onPress={sendPhoneOtp}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>Send OTP</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Enter OTP</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          style={styles.input}
                          placeholder="123456"
                          placeholderTextColor="#9CA3AF"
                          value={enteredPhoneOtp}
                          onChangeText={setEnteredPhoneOtp}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={[styles.button, styles.buttonSecondary]}
                        onPress={() => setStep(0)}
                      >
                        <Text style={styles.buttonTextSecondary}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary]}
                        onPress={verifyPhoneOtp}
                      >
                        <LinearGradient
                          colors={["#3B82F6", "#2563EB"]}
                          style={styles.buttonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.buttonText}>Verify</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#9CA3AF"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="john.doe@example.com"
                      placeholderTextColor="#9CA3AF"
                      value={formData.email}
                      onChangeText={(value) => updateField("email", value)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {!emailOtpSent ? (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.buttonPrimary,
                      styles.fullWidth,
                    ]}
                    onPress={sendEmailOtp}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>Send OTP</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ) : (
                  <>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Enter OTP</Text>
                      <View style={styles.inputWrapper}>
                        <TextInput
                          ref={emailOtpInputRef}
                          style={styles.input}
                          placeholder="123456"
                          placeholderTextColor="#9CA3AF"
                          value={enteredEmailOtp}
                          onChangeText={setEnteredEmailOtp}
                          keyboardType="number-pad"
                        />
                      </View>

                      <View
                        style={{
                          flexDirection: "row",
                          marginTop: 10,
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <TouchableOpacity
                          disabled={resendSeconds > 0 || loading}
                          onPress={sendEmailOtp}
                          style={{
                            paddingVertical: 8,
                            paddingHorizontal: 12,
                            flexShrink: 0,
                          }}
                        >
                          <Text
                            style={[
                              styles.buttonTextSecondary,
                              {
                                color:
                                  resendSeconds > 0 ? "#9CA3AF" : "#3B82F6",
                              },
                            ]}
                          >
                            {resendSeconds > 0
                              ? `Resend in ${resendSeconds}s`
                              : "Resend"}
                          </Text>
                        </TouchableOpacity>

                        <Text
                          numberOfLines={1}
                          ellipsizeMode="tail"
                          style={{
                            color: "#6B7280",
                            fontSize: 9,
                            flex: 1,
                            marginLeft: 8,
                          }}
                        >
                          Didn't receive? Check your spam folder.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={[styles.button, styles.buttonSecondary]}
                        onPress={() => setStep(1)}
                      >
                        <Text style={styles.buttonTextSecondary}>Back</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.buttonPrimary]}
                        onPress={verifyEmailOtp}
                      >
                        <LinearGradient
                          colors={["#3B82F6", "#2563EB"]}
                          style={styles.buttonGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        >
                          <Text style={styles.buttonText}>Verify</Text>
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <Text style={styles.label}>Upload ID (Front & Back)</Text>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <View style={{ flex: 1, alignItems: "center" }}>
                    {formData.id_image_front ? (
                      <Image
                        source={{ uri: formData.id_image_front }}
                        style={[
                          styles.imagePreview,
                          { width: 140, height: 90 },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.imagePlaceholder,
                          { width: 140, height: 90 },
                        ]}
                      >
                        <Ionicons name="card" size={28} color="#9CA3AF" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ marginTop: 8, width: "100%" }}
                      onPress={() => pickImage("front")}
                    >
                      <LinearGradient
                        colors={["#3B82F6", "#2563EB"]}
                        style={[styles.buttonGradient, { height: 44 }]}
                      >
                        <Text style={styles.buttonText}>Upload Front</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flex: 1, alignItems: "center" }}>
                    {formData.id_image_back ? (
                      <Image
                        source={{ uri: formData.id_image_back }}
                        style={[
                          styles.imagePreview,
                          { width: 140, height: 90 },
                        ]}
                      />
                    ) : (
                      <View
                        style={[
                          styles.imagePlaceholder,
                          { width: 140, height: 90 },
                        ]}
                      >
                        <Ionicons name="card" size={28} color="#9CA3AF" />
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ marginTop: 8, width: "100%" }}
                      onPress={() => pickImage("back")}
                    >
                      <LinearGradient
                        colors={["#3B82F6", "#2563EB"]}
                        style={[styles.buttonGradient, { height: 44 }]}
                      >
                        <Text style={styles.buttonText}>Upload Back</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.button, styles.buttonSecondary]}
                    onPress={() => setStep(2)}
                  >
                    <Text style={styles.buttonTextSecondary}>Back</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.button, styles.buttonPrimary]}
                    onPress={() => setStep(4)}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>Next</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {step === 4 && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#9CA3AF"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Min. 8 characters"
                      placeholderTextColor="#9CA3AF"
                      value={formData.password}
                      onChangeText={(value) => updateField("password", value)}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeButton}
                    >
                      <Ionicons
                        name={showPassword ? "eye-outline" : "eye-off-outline"}
                        size={20}
                        color="#9CA3AF"
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
                      color="#9CA3AF"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Re-enter password"
                      placeholderTextColor="#9CA3AF"
                      value={formData.confirmPassword}
                      onChangeText={(value) =>
                        updateField("confirmPassword", value)
                      }
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
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.requirements}>
                  <View style={styles.requirementItem}>
                    <Ionicons
                      name={
                        formData.password.length >= 8
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={16}
                      color={
                        formData.password.length >= 8 ? "#22C55E" : "#9CA3AF"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        formData.password.length >= 8 && styles.requirementMet,
                      ]}
                    >
                      At least 8 characters
                    </Text>
                  </View>
                  <View style={styles.requirementItem}>
                    <Ionicons
                      name={
                        formData.password === formData.confirmPassword &&
                        formData.password.length > 0
                          ? "checkmark-circle"
                          : "ellipse-outline"
                      }
                      size={16}
                      color={
                        formData.password === formData.confirmPassword &&
                        formData.password.length > 0
                          ? "#22C55E"
                          : "#9CA3AF"
                      }
                    />
                    <Text
                      style={[
                        styles.requirementText,
                        formData.password === formData.confirmPassword &&
                          formData.password.length > 0 &&
                          styles.requirementMet,
                      ]}
                    >
                      Passwords match
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    styles.fullWidth,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleRegister}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      loading ? ["#9CA3AF", "#9CA3AF"] : ["#3B82F6", "#2563EB"]
                    }
                    style={styles.buttonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {loading ? (
                      <Text style={styles.buttonText}>Creating Account...</Text>
                    ) : (
                      <>
                        <Text style={styles.buttonText}>Create Account</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <Text style={styles.termsText}>
                  By signing up, you agree to our{" "}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>

                <TouchableOpacity
                  style={styles.signInButton}
                  onPress={() => router.push("/login")}
                >
                  <Text style={styles.signInText}>
                    Already have an account?{" "}
                    <Text style={styles.signInTextBold}>Sign In</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },

  /* ===== HEADER ===== */
  header: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  headerContent: {
    alignItems: "center",
  },
  logoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 20,
  },
  stepIndicator: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 12,
  },
  progressBarContainer: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  progressBar: {
    width: 220,
    height: 8,
    backgroundColor: "transparent",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressSegment: {
    width: 40,
    height: 6,
    backgroundColor: "rgba(255,255,255,0.28)",
    borderRadius: 3,
  },
  progressSegmentActive: {
    backgroundColor: "#fff",
  },

  /* ===== FORM ===== */
  formContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  form: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    marginTop: 8,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  stepLabel: {
    textAlign: "center",
    fontSize: 14,
    color: "#64748B",
    marginBottom: 24,
    fontWeight: "500",
  },

  row: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
  },
  halfWidth: {
    flex: 1,
  },

  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 8,
  },

  inputContainer: {
    marginBottom: 20,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    height: 56,
    paddingVertical: 8,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },

  eyeButton: {
    padding: 4,
  },

  /* ===== PASSWORD RULES ===== */
  requirements: {
    marginBottom: 20,
    gap: 8,
  },
  requirementItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    color: "#6B7280",
  },
  requirementMet: {
    color: "#10B981",
    fontWeight: "500",
  },

  /* ===== BUTTONS ===== */
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  buttonPrimary: {
    shadowColor: "#3B82F6",
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonSecondary: {
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    height: 56,
  },
  buttonGradient: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonTextSecondary: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "600",
  },
  fullWidth: {
    width: "100%",
    marginBottom: 16,
  },

  /* ===== IMAGE UPLOAD ===== */
  imagePreviewContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  imagePreview: {
    width: 200,
    height: 120,
    borderRadius: 12,
  },
  imagePlaceholder: {
    width: 200,
    height: 120,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
  },

  /* ===== SECONDARY TEXT ===== */
  termsText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginTop: 16,
  },
  termsLink: {
    color: "#3B82F6",
    fontWeight: "600",
  },

  signInButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  signInText: {
    fontSize: 14,
    color: "#6B7280",
  },
  signInTextBold: {
    color: "#1F2937",
    fontWeight: "700",
  },
});
