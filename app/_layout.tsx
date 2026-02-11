import * as SecureStore from "expo-secure-store"; // Import SecureStore
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import {
  Stack,
  useRouter,
  useSegments,
  useNavigationContainerRef,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useEffect, useState } from "react";
import { View, ActivityIndicator } from "react-native";
import "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/store/authStore";
import AppToast from "@/components/ui/AppToast";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const navigationRef = useNavigationContainerRef();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    loadUser();
    setIsReady(true);
  }, []);

  useEffect(() => {
    // 1. Wait for everything to be ready
    if (!isReady || isLoading || !navigationRef?.isReady()) return;

    const inTabsGroup = segments[0] === "(tabs)";
    const isOnAllowedPage =
      segments[0] === undefined || // index page
      segments[0] === "login" ||
      segments[0] === "register" ||
      segments[0] === "forgot-password" ||
      segments[0] === "ride-details" ||
      segments[0] === "request-details" ||
      segments[0] === "user-profile" ||
      segments[0] === "modal" ||
      segments[0] === "notifications" ||
      segments[0] === "chat";

    // 2. Use a timeout to push navigation to the end of the execution loop
    // This prevents the "Attempted to navigate before mounting" error.
    const timeout = setTimeout(() => {
      // Only redirect if user is authenticated but not in allowed pages or tabs
      if (isAuthenticated && !inTabsGroup && !isOnAllowedPage) {
        // User is authenticated but not in tabs or allowed pages, redirect to tabs
        try {
          router.replace("/(tabs)");
        } catch (e) {
          // Navigation error, silently fail
        }
      } else if (!isAuthenticated && inTabsGroup) {
        // User is not authenticated but trying to access tabs
        try {
          router.replace("/login");
        } catch (e) {
          // Navigation error, silently fail
        }
      }
    }, 100); // Increased timeout slightly

    return () => clearTimeout(timeout);
  }, [isAuthenticated, segments, isReady, isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
      >
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          {/* ALWAYS render the Stack. This ensures hook order never changes. */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="forgot-password" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="notifications"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen name="ride-details/[id]" />
            <Stack.Screen name="request-details/[id]" />
            <Stack.Screen
              name="user-profile/[id]"
              options={{
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen name="chat" />
          </Stack>

          {/* 3. Render Loading as an OVERLAY instead of a conditional branch */}
          {isLoading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: colorScheme === "dark" ? "#000" : "#fff",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 1000, // Ensure it's on top
              }}
            >
              <ActivityIndicator size="large" />
            </View>
          )}

          <StatusBar style="auto" />
          <AppToast />
        </ThemeProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
