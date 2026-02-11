import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useRatingStore } from "../../../src/store/ratingStore";
import { useAuthStore } from "../../../src/store/authStore";
import { ReviewList, RatingDistribution } from "../../../src/components/ReviewList";
import RatingModal from "../../../src/components/RatingModal";

export default function RatingsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuthStore();
  const {
    myRatings,
    pendingRatings,
    ratingStats,
    isLoading,
    fetchMyRatings,
    fetchPendingRatings,
    fetchUserRatingStats,
  } = useRatingStore();

  const [activeTab, setActiveTab] = useState<"received" | "pending">("received");
  const [refreshing, setRefreshing] = useState(false);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [selectedPending, setSelectedPending] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    if (user?.id) {
      await Promise.all([
        fetchMyRatings(),
        fetchPendingRatings(),
        fetchUserRatingStats(user.id),
      ]);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleRatePending = (pending: any) => {
    setSelectedPending(pending);
    setRatingModalVisible(true);
  };

  const handleRatingSuccess = () => {
    loadData();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ratings & Reviews</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Rating Stats */}
        {ratingStats && (
          <View style={styles.statsCard}>
            <RatingDistribution stats={ratingStats} />
          </View>
        )}

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === "received" && styles.tabActive]}
            onPress={() => setActiveTab("received")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "received" && styles.tabTextActive,
              ]}
            >
              My Ratings ({myRatings.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === "pending" && styles.tabActive]}
            onPress={() => setActiveTab("pending")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "pending" && styles.tabTextActive,
              ]}
            >
              Pending ({pendingRatings.length})
            </Text>
            {pendingRatings.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{pendingRatings.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {isLoading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#3B82F6" />
            </View>
          ) : activeTab === "received" ? (
            <ReviewList ratings={myRatings} />
          ) : (
            <View style={styles.pendingList}>
              {pendingRatings.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
                  <Text style={styles.emptyTitle}>All caught up!</Text>
                  <Text style={styles.emptySubtitle}>
                    No pending ratings at the moment
                  </Text>
                </View>
              ) : (
                pendingRatings.map((pending) => (
                  <TouchableOpacity
                    key={pending.booking_id}
                    style={styles.pendingCard}
                    onPress={() => handleRatePending(pending)}
                  >
                    <View style={styles.pendingIcon}>
                      <Ionicons
                        name={pending.type === "passenger_to_driver" ? "car" : "person"}
                        size={24}
                        color="#3B82F6"
                      />
                    </View>
                    <View style={styles.pendingInfo}>
                      <Text style={styles.pendingName}>
                        {pending.target_user.first_name} {pending.target_user.last_name}
                      </Text>
                      <Text style={styles.pendingType}>
                        {pending.type === "passenger_to_driver"
                          ? "Rate your driver"
                          : "Rate your passenger"}
                      </Text>
                      <Text style={styles.pendingDate}>
                        {new Date(pending.ride.departure_datetime).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.rateButton}>
                      <Text style={styles.rateButtonText}>Rate</Text>
                      <Ionicons name="star" size={16} color="#FFD700" />
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Rating Modal */}
      {selectedPending && (
        <RatingModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            setSelectedPending(null);
          }}
          onSuccess={handleRatingSuccess}
          bookingId={selectedPending.booking_id}
          targetUser={selectedPending.target_user}
          ratingType={selectedPending.type}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  statsCard: {
    backgroundColor: "#FFFFFF",
    margin: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tabsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    gap: 6,
  },
  tabActive: {
    backgroundColor: "#3B82F6",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: "center",
  },
  pendingList: {
    gap: 12,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  pendingIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 2,
  },
  pendingType: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 2,
  },
  pendingDate: {
    fontSize: 12,
    color: "#94A3B8",
  },
  rateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rateButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },
});
