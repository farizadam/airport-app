import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StarRatingProps {
  rating: number;
  size?: number;
  showNumber?: boolean;
  count?: number;
  color?: string;
}

export default function StarRating({
  rating,
  size = 16,
  showNumber = true,
  count,
  color = "#FFD700",
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  if (rating === 0 || rating === undefined) {
    return (
      <View style={styles.container}>
        <Ionicons name="star-outline" size={size} color="#CBD5E1" />
        <Text style={[styles.noRating, { fontSize: size * 0.875 }]}>New</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.starsRow}>
        {/* Full stars */}
        {[...Array(fullStars)].map((_, i) => (
          <Ionicons key={`full-${i}`} name="star" size={size} color={color} />
        ))}
        
        {/* Half star */}
        {hasHalfStar && (
          <Ionicons name="star-half" size={size} color={color} />
        )}
        
        {/* Empty stars */}
        {[...Array(emptyStars)].map((_, i) => (
          <Ionicons
            key={`empty-${i}`}
            name="star-outline"
            size={size}
            color="#CBD5E1"
          />
        ))}
      </View>
      
      {showNumber && (
        <Text style={[styles.ratingText, { fontSize: size * 0.875 }]}>
          {rating.toFixed(1)}
          {count !== undefined && (
            <Text style={styles.countText}> ({count})</Text>
          )}
        </Text>
      )}
    </View>
  );
}

interface CompactRatingProps {
  rating: number;
  count?: number;
  size?: "small" | "medium" | "large";
}

export function CompactRating({ rating, count, size = "medium" }: CompactRatingProps) {
  const sizeConfig = {
    small: { icon: 12, text: 12 },
    medium: { icon: 14, text: 14 },
    large: { icon: 18, text: 16 },
  };

  const config = sizeConfig[size];

  if (rating === 0 || rating === undefined) {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="star-outline" size={config.icon} color="#94A3B8" />
        <Text style={[styles.compactText, { fontSize: config.text, color: "#94A3B8" }]}>
          New
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.compactContainer}>
      <Ionicons name="star" size={config.icon} color="#FFD700" />
      <Text style={[styles.compactText, { fontSize: config.text }]}>
        {rating.toFixed(1)}
        {count !== undefined && (
          <Text style={styles.compactCount}> ({count})</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  ratingText: {
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 4,
  },
  countText: {
    fontWeight: "400",
    color: "#64748B",
  },
  noRating: {
    color: "#94A3B8",
    marginLeft: 4,
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  compactText: {
    fontWeight: "600",
    color: "#1E293B",
  },
  compactCount: {
    fontWeight: "400",
    color: "#64748B",
  },
});
