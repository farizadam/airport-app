import * as SecureStore from "expo-secure-store"; // Import SecureStore
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { StripeProvider } from "@stripe/stripe-react-native";
import { useEffect } from "react";
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

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!navigationRef?.isReady()) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const isOnPublicPage =
      segments[0] === undefined || // index page
      segments[0] === "login" ||
      segments[0] === "register" ||
      segments[0] === "forgot-password";

    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login");
    } else if (
      isAuthenticated &&
      !inAuthGroup &&
      !isOnPublicPage &&
      segments[0] !== "rides" &&
      segments[0] !== "bookings" &&
      segments[0] !== "profile" &&
      segments[0] !== "requests" &&
      segments[0] !== "ride-details" &&
      segments[0] !== "request-details" &&
      segments[0] !== "user-profile" &&
      segments[0] !== "modal" &&
      segments[0] !== "notifications" &&
      segments[0] !== "chat"
    ) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || ""}
      >
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="register" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
            <Stack.Screen
              name="notifications"
              options={{ presentation: "modal" }}
            />
            <Stack.Screen
              name="ride-details/[id]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="request-details/[id]"
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="user-profile/[id]"
              options={{ 
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom"
              }}
            />
            <Stack.Screen
              name="chat"
              options={{ headerShown: false }}
            />
          </Stack>
          <StatusBar style="auto" />
          <AppToast />
        </ThemeProvider>
      </StripeProvider>
    </GestureHandlerRootView>
  );
}
