import { useAuthStore } from "@/store/authStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useState, useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Keyboard,
  Animated,
} from "react-native";
import { toast } from "../src/store/toastStore";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Lazy-load native SDKs (they crash if the dev-client wasn't rebuilt)
let GoogleSignin: any = null;
let LoginManager: any = null;
let AccessToken: any = null;
try {
  GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
  GoogleSignin.configure({
    webClientId: "879099107110-lejrhsdurdl1ib4nitnj30k98hir2q5n.apps.googleusercontent.com",
  });
} catch (e) {
  console.warn("Google Sign-In not available (rebuild dev-client)");
}
try {
  const fbsdk = require("react-native-fbsdk-next");
  LoginManager = fbsdk.LoginManager;
  AccessToken = fbsdk.AccessToken;
} catch (e) {
  console.warn("Facebook SDK not available (rebuild dev-client)");
}

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginWithGoogle, loginWithFacebook } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const headerHeight = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
      Animated.timing(headerHeight, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
      Animated.timing(headerHeight, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleGoogleLogin = async () => {
    if (!GoogleSignin) {
      toast.error("Not Available", "Google Sign-In requires a new dev-client build. Run: eas build --profile development --platform android");
      return;
    }
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken;
      if (!idToken) {
        throw new Error("Failed to get Google ID token");
      }
      const result = await loginWithGoogle(idToken);
      if (!result.profile_complete) {
        router.replace("/complete-profile");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      if (error.code !== "SIGN_IN_CANCELLED") {
        toast.error("Google Login Failed", error.message || String(error));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFacebookLogin = async () => {
    if (!LoginManager || !AccessToken) {
      toast.error("Not Available", "Facebook Login requires a new dev-client build. Run: eas build --profile development --platform android");
      return;
    }
    try {
      setLoading(true);
      const loginResult = await LoginManager.logInWithPermissions(["public_profile", "email"]);
      if (loginResult.isCancelled) {
        return;
      }
      const tokenData = await AccessToken.getCurrentAccessToken();
      if (!tokenData?.accessToken) {
        throw new Error("Failed to get Facebook access token");
      }
      const result = await loginWithFacebook(tokenData.accessToken);
      if (!result.profile_complete) {
        router.replace("/complete-profile");
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      toast.error("Facebook Login Failed", error.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      toast.warning("Missing Fields", "Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      router.replace("/(tabs)");
    } catch (error: any) {
      toast.error("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  const animatedPaddingTop = headerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [20, 35],
  });
  const animatedPaddingBottom = headerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 25],
  });
  const animatedLogoScale = headerHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header with gradient */}
      <Animated.View style={{ paddingTop: animatedPaddingTop, paddingBottom: animatedPaddingBottom }}>
        <LinearGradient colors={["#3B82F6", "#1E40AF"]} style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <Animated.View style={[styles.headerContent, { opacity: animatedLogoScale, transform: [{ scale: animatedLogoScale }] }]}>
            <View style={styles.logoCircle}>
              <Ionicons name="airplane" size={28} color="#3B82F6" />
            </View>
          </Animated.View>
          <Text style={styles.headerTitle}>Welcome Back!</Text>
          {!keyboardVisible && (
            <Text style={styles.headerSubtitle}>
              Sign in to continue your journey
            </Text>
          )}
        </LinearGradient>
      </Animated.View>

      <KeyboardAvoidingView
        style={styles.formContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.form}>
            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color="#94A3B8"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  value={password}
                  onChangeText={setPassword}
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
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotButton}
              onPress={() => router.push("/forgot-password")}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={
                  loading ? ["#94A3B8", "#94A3B8"] : ["#3B82F6", "#1E40AF"]
                }
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {loading ? (
                  <Text style={styles.buttonText}>Loading...</Text>
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign In</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Login Button */}
            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.buttonDisabled,
                { marginBottom: 12 },
              ]}
              onPress={handleGoogleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={loading ? ["#94A3B8", "#94A3B8"] : ["#fff", "#fff"]}
                style={[
                  styles.buttonGradient,
                  { borderWidth: 1, borderColor: "#E2E8F0" },
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="logo-google" size={20} color="#EA4335" />
                <Text style={[styles.buttonText, { color: "#1E293B" }]}>
                  Continue with Google
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Facebook Login Button */}
            <TouchableOpacity
              style={[
                styles.button,
                loading && styles.buttonDisabled,
                { marginBottom: 16 },
              ]}
              onPress={handleFacebookLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={loading ? ["#94A3B8", "#94A3B8"] : ["#1877F2", "#1565D8"]}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="logo-facebook" size={20} color="#fff" />
                <Text style={styles.buttonText}>
                  Continue with Facebook
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <TouchableOpacity
              style={styles.signUpButton}
              onPress={() => router.push("/register")}
            >
              <Text style={styles.signUpText}>
                Don't have an account?{" "}
                <Text style={styles.signUpTextBold}>Create Account</Text>
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
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    alignItems: "center",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  headerContent: {
    alignItems: "center",
  },
  logoCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
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
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "600",
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "#94A3B8",
  },
  signUpButton: {
    alignItems: "center",
  },
  signUpText: {
    fontSize: 16,
    color: "#64748B",
  },
  signUpTextBold: {
    color: "#3B82F6",
    fontWeight: "700",
  },
});
