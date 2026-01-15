import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { useAuthStore } from "@/store/authStore";

export const unstable_settings = {
  initialRouteName: "index",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, loadUser } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      try {
        // Set a longer timeout for slow connections
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Auth load timeout")), 10000)
        );
        await Promise.race([loadUser(), timeout]);
      } catch (error) {
        console.error("Auth init error:", error);
        // Don't clear auth state on timeout - tokens are still saved
        // User will be redirected to login but can retry
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(tabs)";
    const isOnPublicPage =
      segments[0] === undefined || // index page
      segments[0] === "login" ||
      segments[0] === "register";

    if (!isAuthenticated && inAuthGroup) {
      router.replace("/login");
    } else if (
      isAuthenticated &&
      !inAuthGroup &&
      !isOnPublicPage &&
      segments[0] !== "rides" &&
      segments[0] !== "bookings" &&
      segments[0] !== "profile" &&
      segments[0] !== "requests"
    ) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, segments, isLoading]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="rides/search" options={{ title: "Search Rides" }} />
        <Stack.Screen name="rides/[id]" options={{ title: "Ride Details" }} />
        <Stack.Screen name="rides/create" options={{ title: "Create Ride" }} />
        <Stack.Screen name="rides/my-rides" options={{ title: "My Rides" }} />
        <Stack.Screen
          name="rides/[id]/bookings"
          options={{ title: "Ride Bookings" }}
        />
        <Stack.Screen name="bookings" options={{ title: "My Bookings" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="requests" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
