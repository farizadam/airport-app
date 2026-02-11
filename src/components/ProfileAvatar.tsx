import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

interface ProfileAvatarProps {
  userId?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  rating?: number;
  size?: "small" | "medium" | "large";
  showRating?: boolean;
  showName?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function ProfileAvatar({
  userId,
  firstName,
  lastName,
  avatarUrl,
  rating,
  size = "medium",
  showRating = false,
  showName = false,
  onPress,
  disabled = false,
  style,
}: ProfileAvatarProps) {
  const router = useRouter();

  const getInitials = () => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) {
      return firstName[0].toUpperCase();
    }
    return "?";
  };

  const sizeConfig = {
    small: { avatar: 36, text: 14, icon: 14, ratingSize: 10 },
    medium: { avatar: 48, text: 18, icon: 18, ratingSize: 12 },
    large: { avatar: 64, text: 24, icon: 24, ratingSize: 14 },
  };

  const config = sizeConfig[size];

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (userId) {
      router.push({ pathname: "/user-profile/[id]", params: { id: userId } });
    }
  };

  const avatarContent = (
    <View style={[styles.container, style]}>
      <View style={[styles.avatarWrapper, { width: config.avatar, height: config.avatar }]}>
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={[
              styles.avatarImage,
              { width: config.avatar, height: config.avatar, borderRadius: config.avatar / 2 },
            ]}
          />
        ) : (
          <View
            style={[
              styles.avatarPlaceholder,
              { width: config.avatar, height: config.avatar, borderRadius: config.avatar / 2 },
            ]}
          >
            <Text style={[styles.initialsText, { fontSize: config.text }]}>
              {getInitials()}
            </Text>
          </View>
        )}
        
        {/* Rating badge */}
        {showRating && rating !== undefined && rating > 0 && (
          <View style={styles.ratingBadge}>
            <Ionicons name="star" size={config.ratingSize} color="#FFD700" />
            <Text style={[styles.ratingText, { fontSize: config.ratingSize }]}>
              {rating.toFixed(1)}
            </Text>
          </View>
        )}
      </View>

      {/* Name below avatar */}
      {showName && (firstName || lastName) && (
        <Text style={styles.nameText} numberOfLines={1}>
          {firstName} {lastName ? lastName[0] + '.' : ''}
        </Text>
      )}
    </View>
  );

  if (disabled || !userId) {
    return avatarContent;
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7}>
      {avatarContent}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarImage: {
    backgroundColor: "#E2E8F0",
  },
  avatarPlaceholder: {
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontWeight: "bold",
    color: "#64748B",
  },
  ratingBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
    gap: 2,
  },
  ratingText: {
    fontWeight: "600",
    color: "#1E293B",
  },
  nameText: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "500",
    color: "#374151",
    maxWidth: 80,
    textAlign: "center",
  },
});
