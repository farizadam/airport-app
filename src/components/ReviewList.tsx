import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Rating, RatingStats } from "../store/ratingStore";
import ProfileAvatar from "./ProfileAvatar";

interface ReviewListProps {
  ratings: Rating[];
  showSeeAll?: boolean;
  onSeeAll?: () => void;
  maxItems?: number;
}

export function ReviewList({
  ratings,
  showSeeAll = false,
  onSeeAll,
  maxItems = 5,
}: ReviewListProps) {
  const displayRatings = maxItems ? ratings.slice(0, maxItems) : ratings;

  if (ratings.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="chatbubble-outline" size={40} color="#CBD5E1" />
        <Text style={styles.emptyText}>No reviews yet</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {displayRatings.map((rating) => (
        <ReviewItem key={rating.id || rating._id} rating={rating} />
      ))}
      
      {showSeeAll && ratings.length > maxItems && (
        <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAll}>
          <Text style={styles.seeAllText}>
            See all reviews ({ratings.length})
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
        </TouchableOpacity>
      )}
    </View>
  );
}

interface ReviewItemProps {
  rating: Rating;
}

export function ReviewItem({ rating }: ReviewItemProps) {
  const router = useRouter();
  const fromUser = rating.from_user;
  const date = new Date(rating.createdAt);
  const formattedDate = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <View style={styles.reviewItem}>
      <TouchableOpacity 
        style={styles.reviewHeader}
        onPress={() => {
          const userId = fromUser.id || fromUser._id;
          if (userId) router.push({ pathname: "/user-profile/[id]", params: { id: userId } });
        }}
        activeOpacity={0.7}
      >
        <ProfileAvatar
          userId={fromUser.id || fromUser._id}
          firstName={fromUser.first_name}
          lastName={fromUser.last_name}
          avatarUrl={fromUser.avatar_url}
          rating={fromUser.rating}
          size="small"
          disabled
        />
        <View style={[styles.reviewInfo, { marginLeft: 10 }]}>
          <Text style={[styles.reviewerName, { color: '#3B82F6' }]}>
            {fromUser.first_name} {fromUser.last_name}
          </Text>
          <View style={styles.ratingRow}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons
                  key={star}
                  name={star <= rating.stars ? "star" : "star-outline"}
                  size={14}
                  color={star <= rating.stars ? "#FFD700" : "#CBD5E1"}
                />
              ))}
            </View>
            <Text style={styles.reviewDate}>{formattedDate}</Text>
          </View>
        </View>
      </TouchableOpacity>
      
      {rating.comment && (
        <Text style={styles.reviewComment}>{rating.comment}</Text>
      )}
      
      <View style={styles.reviewBadge}>
        <Ionicons
          name={rating.type === "passenger_to_driver" ? "car" : "person"}
          size={12}
          color="#64748B"
        />
        <Text style={styles.reviewBadgeText}>
          {rating.type === "passenger_to_driver"
            ? "As Passenger"
            : "As Driver"}
        </Text>
      </View>
    </View>
  );
}

interface RatingDistributionProps {
  stats: RatingStats;
}

export function RatingDistribution({ stats }: RatingDistributionProps) {
  const total = stats.user.rating_count || 0;

  const getPercentage = (count: number) => {
    if (total === 0) return 0;
    return (count / total) * 100;
  };

  return (
    <View style={styles.distributionContainer}>
      <View style={styles.overallRating}>
        <Text style={styles.overallNumber}>
          {stats.user.rating?.toFixed(1) || "0.0"}
        </Text>
        <View style={styles.overallStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Ionicons
              key={star}
              name={star <= Math.round(stats.user.rating || 0) ? "star" : "star-outline"}
              size={20}
              color={star <= Math.round(stats.user.rating || 0) ? "#FFD700" : "#CBD5E1"}
            />
          ))}
        </View>
        <Text style={styles.totalReviews}>
          {total} reviews
        </Text>
      </View>

      <View style={styles.distributionBars}>
        {[5, 4, 3, 2, 1].map((star) => (
          <View key={star} style={styles.barRow}>
            <Text style={styles.barLabel}>{star}</Text>
            <Ionicons name="star" size={12} color="#FFD700" />
            <View style={styles.barBackground}>
              <View
                style={[
                  styles.barFill,
                  { width: `${getPercentage(stats.distribution[star as keyof typeof stats.distribution])}%` },
                ]}
              />
            </View>
            <Text style={styles.barCount}>
              {stats.distribution[star as keyof typeof stats.distribution]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: "#94A3B8",
  },
  reviewItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
  },
  reviewHeader: {
    flexDirection: "row",
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewInfo: {
    flex: 1,
    marginLeft: 12,
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  reviewComment: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 20,
    marginBottom: 12,
  },
  reviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reviewBadgeText: {
    fontSize: 12,
    color: "#64748B",
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  distributionContainer: {
    flexDirection: "row",
    gap: 20,
  },
  overallRating: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 20,
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
  },
  overallNumber: {
    fontSize: 48,
    fontWeight: "700",
    color: "#1E293B",
  },
  overallStars: {
    flexDirection: "row",
    marginVertical: 4,
  },
  totalReviews: {
    fontSize: 12,
    color: "#64748B",
  },
  distributionBars: {
    flex: 1,
    justifyContent: "center",
    gap: 6,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  barLabel: {
    fontSize: 12,
    color: "#64748B",
    width: 12,
    textAlign: "right",
  },
  barBackground: {
    flex: 1,
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    backgroundColor: "#FFD700",
    borderRadius: 4,
  },
  barCount: {
    fontSize: 12,
    color: "#64748B",
    width: 24,
    textAlign: "right",
  },
});
