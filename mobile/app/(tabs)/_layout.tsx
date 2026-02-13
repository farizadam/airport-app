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
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  iconNameFocused: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) => (
  <View style={styles.iconContainer}>
    {/* Glow effect behind active icon */}
    {focused && (
      <View style={styles.glowContainer}>
        <LinearGradient
          colors={[
            "rgba(59, 130, 246, 0.6)",
            "rgba(6, 182, 212, 0.3)",
            "transparent",
          ]}
          style={styles.iconGlow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    )}
    {/* Icon with pill background when active */}
    <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
      <Ionicons
        name={focused ? iconNameFocused : iconName}
        size={focused ? 24 : 22}
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
      notificationStore.startPolling(5000);
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
        tabBarActiveTintColor: "#3B82F6",
        tabBarInactiveTintColor: isDark ? "#71717A" : "#A1A1AA",
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            {/* Main gradient background */}
            <LinearGradient
              colors={
                isDark
                  ? ["#18181B", "#27272A", "#18181B"]
                  : ["#FAFAFA", "#F4F4F5", "#FAFAFA"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Animated gradient top border */}
            <LinearGradient
              colors={["#3B82F6", "#06B6D4", "#0EA5E9", "#3B82F6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ height: 2, width: "100%" }}
            />
          </View>
        ),
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          height: 70 + insets.bottom,
          paddingTop: 12,
          paddingBottom: insets.bottom + 8,
          backgroundColor: "transparent",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.5,
          marginTop: 6,
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
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#EF4444", fontSize: 10 },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              iconName="notifications-outline"
              iconNameFocused="notifications"
              color={color}
              focused={focused}
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
                {focused && (
                  <View style={styles.glowContainer}>
                    <LinearGradient
                      colors={[
                        "rgba(59, 130, 246, 0.6)",
                        "rgba(6, 182, 212, 0.3)",
                        "transparent",
                      ]}
                      style={styles.iconGlow}
                      start={{ x: 0.5, y: 0 }}
                      end={{ x: 0.5, y: 1 }}
                    />
                  </View>
                )}
                <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
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
    width: 60,
    height: 36,
  },
  glowContainer: {
    position: "absolute",
    top: -8,
    alignItems: "center",
  },
  iconGlow: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  iconWrapper: {
    width: 48,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperActive: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  profileTabAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#A1A1AA",
  },
  profileTabAvatarActive: {
    borderColor: "#3B82F6",
    borderWidth: 2,
  },
});
