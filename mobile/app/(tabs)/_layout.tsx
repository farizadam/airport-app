import { Tabs } from "expo-router";
import React, { useEffect } from "react";
import { View, StyleSheet, Animated, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { observer } from "mobx-react-lite";

import { HapticTab } from "@/components/haptic-tab";
import { useColorScheme } from "@/hooks/use-color-scheme";
import notificationStore from "../../src/store/notificationStore";
import { useAuthStore } from "../../src/store/authStore";

// Creative Tab Icon Component
const TabIcon = ({
  iconName,
  iconNameFocused,
  color,
  focused,
  isDark,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameFocused: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
  isDark: boolean;
}) => (
  <View style={styles.iconContainer}>
    <View
      style={[
        styles.iconWrapper,
        focused && (isDark ? styles.iconWrapperActiveDark : styles.iconWrapperActiveLight),
      ]}
    >
      <Ionicons
        name={focused ? iconNameFocused : iconName}
        size={focused ? 23 : 21}
        color={color}
      />
    </View>
  </View>
);

const TabLayout = observer(() => {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      notificationStore.startPolling(30000);
    } else {
      notificationStore.stopPolling();
    }
    return () => notificationStore.stopPolling();
  }, [isAuthenticated]);

  const unreadCount = notificationStore.notifications.filter(
    (n) => !n.is_read,
  ).length;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: isDark ? "#BFDBFE" : "#FFFFFF",
        tabBarInactiveTintColor: isDark ? "#93C5FD" : "rgba(255,255,255,0.7)",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "transparent" }]}>
            <LinearGradient
              colors={
                isDark
                  ? ["rgba(59,130,246,0.98)", "rgba(42, 73, 146, 0.98)"]
                  : ["rgba(59,130,246,0.98)", "rgba(59,130,246,0.98)"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                StyleSheet.absoluteFill,
                { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
              ]}
            />
            <LinearGradient
              colors={isDark ? ["#60A5FA", "#3B82F6"] : ["#60A5FA", "#93C5FD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 2.5, width: "100%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            />
          </View>
        ),
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 16,
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          height: 60 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
          paddingHorizontal: 10,
          backgroundColor: "transparent",
          shadowColor: isDark ? "#000000" : "#1E3A8A",
          shadowOpacity: 0.25,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: -4 },
          overflow: "hidden",
        },
        tabBarItemStyle: {
          borderRadius: 16,
          marginHorizontal: 1,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.3,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              iconName="home-outline"
              iconNameFocused="home"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: "My Trips",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              iconName="briefcase-outline"
              iconNameFocused="briefcase"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#EF4444", fontSize: 10, fontWeight: "700" },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              iconName="notifications-outline"
              iconNameFocused="notifications"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              iconName="wallet-outline"
              iconNameFocused="wallet"
              color={color}
              focused={focused}
              isDark={isDark}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            user?.avatar_url ? (
              <View style={styles.iconContainer}>
                <View style={[styles.iconWrapper, focused && styles.iconWrapperActiveLight]}>
                  <Image
                    source={{ uri: user.avatar_url }}
                    style={[
                      styles.profileTabAvatar,
                      focused && styles.profileTabAvatarActive,
                    ]}
                  />
                </View>
              </View>
            ) : (
              <TabIcon
                iconName="person-outline"
                iconNameFocused="person"
                color={color}
                focused={focused}
                isDark={isDark}
              />
            )
          ),
        }}
      />
      {/* Hidden tabs - still accessible but not shown in tab bar */}

      <Tabs.Screen
        name="rides"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
});

export default TabLayout;

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 38,
  },
  iconWrapper: {
    width: 44,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(96, 165, 250, 0.2)",
  },
  iconWrapperActiveLight: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.35)",
  },
  iconWrapperActiveDark: {
    backgroundColor: "rgba(96, 165, 250, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(147, 197, 253, 0.30)",
  },
  profileTabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
  },
  profileTabAvatarActive: {
    borderColor: "#60A5FA",
    borderWidth: 2,
  },
});
