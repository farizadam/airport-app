import React, { useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  PanResponder,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  Easing,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useToastStore, ToastType } from "../../store/toastStore";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TOAST_WIDTH = SCREEN_WIDTH - 32;
const SWIPE_THRESHOLD = 60;

const TOAST_THEMES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    icon: string;
    iconName: keyof typeof Ionicons.glyphMap;
    accent: string;
    textColor: string;
    subtextColor: string;
  }
> = {
  success: {
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.3)",
    icon: "#10B981",
    iconName: "checkmark-circle",
    accent: "#10B981",
    textColor: "#064E3B",
    subtextColor: "#065F46",
  },
  error: {
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.3)",
    icon: "#EF4444",
    iconName: "close-circle",
    accent: "#EF4444",
    textColor: "#7F1D1D",
    subtextColor: "#991B1B",
  },
  warning: {
    bg: "rgba(245, 158, 11, 0.12)",
    border: "rgba(245, 158, 11, 0.3)",
    icon: "#F59E0B",
    iconName: "warning",
    accent: "#F59E0B",
    textColor: "#78350F",
    subtextColor: "#92400E",
  },
  info: {
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.3)",
    icon: "#3B82F6",
    iconName: "information-circle",
    accent: "#3B82F6",
    textColor: "#1E3A5F",
    subtextColor: "#1E40AF",
  },
};

export default function AppToast() {
  const insets = useSafeAreaInsets();
  const { visible, config, hideToast } = useToastStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Animation values
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const translateX = useSharedValue(0);
  const progressWidth = useSharedValue(100);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    translateY.value = withTiming(-150, { duration: 300, easing: Easing.bezierFn(0.4, 0, 1, 1) });
    opacity.value = withTiming(0, { duration: 250 });
    scale.value = withTiming(0.9, { duration: 300 });
    setTimeout(() => {
      runOnJS(hideToast)();
    }, 320);
  }, [hideToast]);

  // Pan gesture for swipe-to-dismiss
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dy) > 5 || Math.abs(gestureState.dx) > 10,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          translateY.value = gestureState.dy * 0.8;
        }
        if (Math.abs(gestureState.dx) > 0) {
          translateX.value = gestureState.dx * 0.6;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -SWIPE_THRESHOLD || Math.abs(gestureState.dx) > SWIPE_THRESHOLD * 1.5) {
          dismiss();
        } else {
          translateY.value = withSpring(0, { damping: 15, stiffness: 200 });
          translateX.value = withSpring(0, { damping: 15, stiffness: 200 });
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible && config) {
      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Reset and animate in
      translateX.value = 0;
      translateY.value = -150;
      opacity.value = 0;
      scale.value = 0.9;
      progressWidth.value = 100;

      // Slide in with spring
      translateY.value = withSpring(0, {
        damping: 18,
        stiffness: 220,
        mass: 0.8,
      });
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 14, stiffness: 200 });

      // No auto-dismiss — user closes manually via swipe or X button
    }
  }, [visible, config]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as any,
  }));

  if (!visible || !config) return null;

  const theme = TOAST_THEMES[config.type];

  return (
    <View
      style={[styles.wrapper, { top: insets.top + 8 }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[styles.container, animatedContainerStyle]}
        {...panResponder.panHandlers}
      >
        <View
          style={[
            styles.toastBody,
            {
              backgroundColor: "#FFFFFF",
              borderColor: theme.border,
              shadowColor: theme.accent,
            },
          ]}
        >
          {/* Accent bar on left */}
          <View style={[styles.accentBar, { backgroundColor: theme.accent }]} />

          {/* Content */}
          <View style={styles.content}>
            {/* Icon */}
            <View style={[styles.iconContainer, { backgroundColor: theme.bg }]}>
              <Ionicons
                name={config.icon as any || theme.iconName}
                size={24}
                color={theme.icon}
              />
            </View>

            {/* Text */}
            <View style={styles.textContainer}>
              <Text style={[styles.title, { color: theme.textColor }]} numberOfLines={2}>
                {config.title}
              </Text>
              {config.message ? (
                <Text
                  style={[styles.message, { color: theme.subtextColor }]}
                  numberOfLines={3}
                >
                  {config.message}
                </Text>
              ) : null}

              {/* Action buttons */}
              {config.actions && config.actions.length > 0 ? (
                <View style={styles.actionsRow}>
                  {config.actions.map((action, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.actionButton,
                        {
                          backgroundColor: i === 0 ? theme.accent : "transparent",
                          borderColor: theme.accent,
                          borderWidth: i === 0 ? 0 : 1.5,
                        },
                      ]}
                      onPress={() => {
                        dismiss();
                        setTimeout(() => action.onPress(), 350);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.actionText,
                          { color: i === 0 ? "#FFFFFF" : theme.accent },
                        ]}
                      >
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Dismiss button */}
            <TouchableOpacity
              style={styles.dismissButton}
              onPress={dismiss}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>


        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
    alignItems: "center",
    pointerEvents: "box-none",
  },
  container: {
    width: TOAST_WIDTH,
    maxWidth: 420,
  },
  toastBody: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  content: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingLeft: 16,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 20,
  },
  message: {
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
    marginTop: 3,
    opacity: 0.85,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 10,
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.1,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  progressBarTrack: {
    height: 3,
    backgroundColor: "rgba(0,0,0,0.04)",
    overflow: "hidden",
  },
  progressBar: {
    height: 3,
    borderRadius: 1.5,
  },
});
