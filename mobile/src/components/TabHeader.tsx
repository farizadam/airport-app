import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type TabHeaderProps = {
  title: string;
  subtitle?: string;
  onBackPress?: () => void;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightPress?: () => void;
};

// Shared top bar for tab screens
export default function TabHeader({
  title,
  subtitle,
  onBackPress,
  rightIcon,
  onRightPress,
}: TabHeaderProps) {
  const insets = useSafeAreaInsets();
  const showLeft = Boolean(onBackPress);
  const showRight = Boolean(rightIcon && onRightPress);

  return (
    <LinearGradient
      colors={["#1E3A8A", "#1D4ED8"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.header, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.row}>
        {showLeft ? (
          <TouchableOpacity
            accessibilityLabel="Go back"
            onPress={onBackPress}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color="#E0E7FF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}

        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {showRight ? (
          <TouchableOpacity
            accessibilityLabel="Header action"
            onPress={onRightPress}
            style={styles.iconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon as any} size={20} color="#E0E7FF" />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#0F172A",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  titleBlock: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    marginTop: 4,
    color: "#E0E7FF",
    fontSize: 13,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  spacer: {
    width: 36,
    height: 36,
  },
});
