import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect } from "react";
import * as ImagePicker from "expo-image-picker";
import {
  auth,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
  getIdToken,
} from "@/firebase";
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
  Modal,
  FlatList,
} from "react-native";
import { toast } from "../src/store/toastStore";
import { SafeAreaView } from "react-native-safe-area-context";

// Country codes list
const COUNTRY_CODES = [
  { code: "+212", flag: "🇲🇦", name: "Morocco" },
  { code: "+213", flag: "🇩🇿", name: "Algeria" },
  { code: "+216", flag: "🇹🇳", name: "Tunisia" },
  { code: "+33", flag: "🇫🇷", name: "France" },
  { code: "+34", flag: "🇪🇸", name: "Spain" },
  { code: "+1", flag: "🇺🇸", name: "United States" },
  { code: "+44", flag: "🇬🇧", name: "United Kingdom" },
  { code: "+49", flag: "🇩🇪", name: "Germany" },
  { code: "+39", flag: "🇮🇹", name: "Italy" },
  { code: "+351", flag: "🇵🇹", name: "Portugal" },
  { code: "+31", flag: "🇳🇱", name: "Netherlands" },
  { code: "+32", flag: "🇧🇪", name: "Belgium" },
  { code: "+41", flag: "🇨🇭", name: "Switzerland" },
  { code: "+90", flag: "🇹🇷", name: "Turkey" },
  { code: "+20", flag: "🇪🇬", name: "Egypt" },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "+971", flag: "🇦🇪", name: "UAE" },
  { code: "+974", flag: "🇶🇦", name: "Qatar" },
  { code: "+965", flag: "🇰🇼", name: "Kuwait" },
  { code: "+968", flag: "🇴🇲", name: "Oman" },
  { code: "+973", flag: "🇧🇭", name: "Bahrain" },
  { code: "+218", flag: "🇱🇾", name: "Libya" },
  { code: "+222", flag: "🇲🇷", name: "Mauritania" },
  { code: "+223", flag: "🇲🇱", name: "Mali" },
  { code: "+221", flag: "🇸🇳", name: "Senegal" },
  { code: "+225", flag: "🇨🇮", name: "Ivory Coast" },
  { code: "+91", flag: "🇮🇳", name: "India" },
  { code: "+86", flag: "🇨🇳", name: "China" },
  { code: "+81", flag: "🇯🇵", name: "Japan" },
  { code: "+82", flag: "🇰🇷", name: "South Korea" },
  { code: "+61", flag: "🇦🇺", name: "Australia" },
  { code: "+55", flag: "🇧🇷", name: "Brazil" },
  { code: "+7", flag: "🇷🇺", name: "Russia" },
  { code: "+48", flag: "🇵🇱", name: "Poland" },
  { code: "+46", flag: "🇸🇪", name: "Sweden" },
  { code: "+47", flag: "🇳🇴", name: "Norway" },
  { code: "+45", flag: "🇩🇰", name: "Denmark" },
  { code: "+358", flag: "🇫🇮", name: "Finland" },
  { code: "+43", flag: "🇦🇹", name: "Austria" },
  { code: "+30", flag: "🇬🇷", name: "Greece" },
  { code: "+353", flag: "🇮🇪", name: "Ireland" },
  { code: "+52", flag: "🇲🇽", name: "Mexico" },
  { code: "+54", flag: "🇦🇷", name: "Argentina" },
  { code: "+57", flag: "🇨🇴", name: "Colombia" },
  { code: "+234", flag: "🇳🇬", name: "Nigeria" },
  { code: "+27", flag: "🇿🇦", name: "South Africa" },
  { code: "+254", flag: "🇰🇪", name: "Kenya" },
];

export default function CompleteProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const completeProfile = useAuthStore((state) => state.completeProfile);

  const [step, setStep] = useState(0); // 0 = phone, 1 = ID images
  const [loading, setLoading] = useState(false);

  // Phone state
  const [phone, setPhone] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState(
    COUNTRY_CODES[0]
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [enteredPhoneOtp, setEnteredPhoneOtp] = useState("");
  const [verificationId, setVerificationId] = useState<any>(null);
  const [firebaseToken, setFirebaseToken] = useState("");

  // ID images state
  const [idImageFront, setIdImageFront] = useState("");
  const [idImageBack, setIdImageBack] = useState("");

  // Check if the user already has some data
  const needsPhone = !user?.phone;
  const needsId =
    !user?.id_image_front_url || !user?.id_image_back_url;

  useEffect(() => {
    // If phone is already provided, skip to ID step
    if (!needsPhone && needsId) {
      setStep(1);
    }
    // If everything is complete, redirect
    if (!needsPhone && !needsId) {
      router.replace("/(tabs)");
    }
  }, []);

  const pickImage = async (side: "front" | "back") => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        toast.warning(
          "Permission Required",
          "Permission to access photos is required."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (result.canceled) {
        toast.info("Selection Cancelled", "Previous image kept.");
        return;
      }

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const dataUri = `data:image/jpeg;base64,${asset.base64}`;
          if (side === "front") setIdImageFront(dataUri);
          else setIdImageBack(dataUri);
        } else if (asset.uri) {
          if (side === "front") setIdImageFront(asset.uri);
          else setIdImageBack(asset.uri);
        }
      }
    } catch (err) {
      console.error("Image pick error", err);
      toast.error("Error", "Could not pick image");
    }
  };

  const sendPhoneOtp = async () => {
    if (!phone) {
      toast.warning("Missing Phone", "Enter phone number first");
      return;
    }
    try {
      setLoading(true);
      const fullPhone =
        selectedCountryCode.code + phone.replace(/^0+/, "");
      const isE164 = /^\+[1-9]\d{1,14}$/.test(fullPhone);
      if (!isE164) {
        toast.warning(
          "Invalid Phone Number",
          "Please enter a valid phone number."
        );
        return;
      }

      try {
        const confirmation = await signInWithPhoneNumber(auth, fullPhone);
        setVerificationId(confirmation);
        setPhoneOtpSent(true);
        toast.info("OTP Sent", "A verification code was sent to your phone.");
      } catch (phoneAuthErr: any) {
        console.error("Phone auth error", phoneAuthErr);
        toast.error(
          "Error",
          phoneAuthErr.message || "Phone auth is not available in this build."
        );
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
      if (verificationId && typeof verificationId.confirm === "function") {
        await verificationId.confirm(enteredPhoneOtp);
        try {
          const idToken = await getIdToken();
          setFirebaseToken(idToken);
        } catch (tokenErr) {
          console.warn("Failed to get firebase token", tokenErr);
        }
        toast.success("Phone Verified", "Phone verified successfully");
        if (needsId) {
          setStep(1);
        } else {
          await handleSubmit();
        }
        return;
      }

      if (typeof verificationId === "string") {
        try {
          const credential = PhoneAuthProvider.credential(
            verificationId,
            enteredPhoneOtp
          );
          await signInWithCredential(auth, credential);
          try {
            const idToken = await getIdToken();
            setFirebaseToken(idToken);
          } catch (tokenErr) {
            console.warn("Failed to get firebase token", tokenErr);
          }
          toast.success("Phone Verified", "Phone verified successfully");
          if (needsId) {
            setStep(1);
          } else {
            await handleSubmit();
          }
          return;
        } catch (innerErr) {
          console.error("Credential sign-in error", innerErr);
          throw innerErr;
        }
      }

      toast.error(
        "Error",
        "No native confirmation available. Ensure you're running a development build."
      );
    } catch (err: any) {
      console.error("Phone OTP verify error", err);
      toast.error("Error", err.message || "Incorrect OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const fullPhone =
        selectedCountryCode.code + phone.replace(/^0+/, "");

      const data: any = {};
      if (needsPhone && phone) {
        data.phone = fullPhone;
        if (firebaseToken) data.firebase_token = firebaseToken;
      }
      if (needsId) {
        if (!idImageFront || !idImageBack) {
          toast.warning(
            "Missing ID Images",
            "Please upload both front and back of your ID."
          );
          return;
        }
        data.id_image_front = idImageFront;
        data.id_image_back = idImageBack;
      }

      await completeProfile(data);
      toast.success("Profile Complete", "Your profile has been updated!");
      router.replace("/(tabs)");
    } catch (error: any) {
      toast.error(
        "Update Failed",
        error.message || "Failed to complete profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = (needsPhone ? 1 : 0) + (needsId ? 1 : 0);
  const currentStepLabel = step === 0 && needsPhone ? "Phone Number" : "ID Verification";

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <LinearGradient colors={["#3B82F6", "#2563EB"]} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logoCircle}>
            <Ionicons name="person-circle" size={32} color="#3B82F6" />
          </View>
          <Text style={styles.headerTitle}>Complete Your Profile</Text>
          <Text style={styles.headerSubtitle}>
            {user?.first_name
              ? `Welcome, ${user.first_name}! Just a few more details.`
              : "Just a few more details to get started."}
          </Text>
          <Text style={styles.stepIndicator}>
            Step {step + 1} of {totalSteps}
          </Text>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              {Array.from({ length: totalSteps }).map((_, i) => (
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
        behavior="padding"
        keyboardVerticalOffset={100}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.form}>
            {/* STEP 0: Phone Number */}
            {step === 0 && needsPhone && (
              <>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Phone Number</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.countryCodeButton}
                      onPress={() => setShowCountryPicker(true)}
                    >
                      <Text style={styles.countryFlag}>
                        {selectedCountryCode.flag}
                      </Text>
                      <Text style={styles.countryCodeText}>
                        {selectedCountryCode.code}
                      </Text>
                      <Ionicons
                        name="chevron-down"
                        size={14}
                        color="#6B7280"
                      />
                    </TouchableOpacity>

                    <View style={[styles.inputWrapper, { flex: 1 }]}>
                      <TextInput
                        style={styles.input}
                        placeholder="6XX XXX XXX"
                        placeholderTextColor="#9CA3AF"
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                      />
                    </View>
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
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={
                        loading
                          ? ["#9CA3AF", "#9CA3AF"]
                          : ["#3B82F6", "#2563EB"]
                      }
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? "Sending..." : "Send OTP"}
                      </Text>
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

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        styles.fullWidth,
                      ]}
                      onPress={verifyPhoneOtp}
                      disabled={loading}
                    >
                      <LinearGradient
                        colors={
                          loading
                            ? ["#9CA3AF", "#9CA3AF"]
                            : ["#3B82F6", "#2563EB"]
                        }
                        style={styles.buttonGradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                      >
                        <Text style={styles.buttonText}>
                          {loading ? "Verifying..." : "Verify"}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* STEP 1: ID Images */}
            {step === 1 && needsId && (
              <>
                <Text style={styles.label}>Upload ID (Front & Back)</Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: "#6B7280",
                    marginBottom: 16,
                  }}
                >
                  We need your ID to verify your identity for safe carpooling.
                </Text>
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 12 }}
                >
                  <View style={{ flex: 1, alignItems: "center" }}>
                    {idImageFront ? (
                      <Image
                        source={{ uri: idImageFront }}
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
                    {idImageBack ? (
                      <Image
                        source={{ uri: idImageBack }}
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
                  {needsPhone && (
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      onPress={() => setStep(0)}
                    >
                      <Text style={styles.buttonTextSecondary}>Back</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.buttonPrimary,
                      !needsPhone && styles.fullWidth,
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleSubmit}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={
                        loading
                          ? ["#9CA3AF", "#9CA3AF"]
                          : ["#3B82F6", "#2563EB"]
                      }
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Text style={styles.buttonText}>
                        {loading ? "Saving..." : "Complete Profile"}
                      </Text>
                      {!loading && (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color="#fff"
                        />
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Country Code Picker Modal */}
      <Modal
        visible={showCountryPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Country</Text>
              <TouchableOpacity
                onPress={() => setShowCountryPicker(false)}
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View
              style={[
                styles.inputWrapper,
                { marginBottom: 12, marginHorizontal: 16 },
              ]}
            >
              <Ionicons
                name="search"
                size={18}
                color="#9CA3AF"
                style={{ marginRight: 8 }}
              />
              <TextInput
                style={styles.input}
                placeholder="Search country..."
                placeholderTextColor="#9CA3AF"
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={COUNTRY_CODES.filter(
                (c) =>
                  c.name
                    .toLowerCase()
                    .includes(countrySearch.toLowerCase()) ||
                  c.code.includes(countrySearch)
              )}
              keyExtractor={(item) => item.code + item.name}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.countryItem,
                    selectedCountryCode.code === item.code &&
                      styles.countryItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedCountryCode(item);
                    setShowCountryPicker(false);
                    setCountrySearch("");
                  }}
                >
                  <Text style={styles.countryItemFlag}>{item.flag}</Text>
                  <Text style={styles.countryItemName}>{item.name}</Text>
                  <Text style={styles.countryItemCode}>{item.code}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
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
    textAlign: "center",
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
    width: 120,
    height: 8,
    backgroundColor: "transparent",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
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
  input: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  // Country code picker
  countryCodeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 10,
    height: 56,
    gap: 4,
  },
  countryFlag: {
    fontSize: 20,
  },
  countryCodeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  // Buttons
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
  // Image upload
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F1F5F9",
  },
  countryItemSelected: {
    backgroundColor: "#EFF6FF",
  },
  countryItemFlag: {
    fontSize: 22,
    marginRight: 12,
  },
  countryItemName: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
  },
  countryItemCode: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
});
