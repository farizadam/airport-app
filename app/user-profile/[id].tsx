import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/authStore";
import { useRatingStore, RatingStats, Rating } from "../../src/store/ratingStore";
import { ReviewList, RatingDistribution } from "../../src/components/ReviewList";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  runOnJS 
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface UserProfile {
  id: string;
  _id?: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
  date_of_birth?: string;
  bio?: string;
  languages?: string[];
  car_model?: string;
  car_color?: string;
  rating: number;
  rating_count: number;
  trips_completed?: number;
  created_at?: string;
  createdAt?: string;
}

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuthStore();
  const { fetchUserRatingStats, fetchUserRatings, userRatings, ratingStats } = useRatingStore();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwnProfile = currentUser?.id === id || currentUser?._id === id;

  // Swipe to dismiss
  const translateY = useSharedValue(0);
  const DISMISS_THRESHOLD = 150;

  const closeModal = () => {
    router.back();
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      // Only allow dragging down
      if (event.translationY > 0) {
        translateY.value = event.translationY;
      }
    })
    .onEnd((event) => {
      if (event.translationY > DISMISS_THRESHOLD) {
        // Dismiss modal
        runOnJS(closeModal)();
      } else {
        // Spring back
        translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const loadProfile = async () => {
    if (!id) return;
    
    try {
      setError(null);
      const response = await api.get(`/users/${id}/profile`);
      if (response.data.success) {
        setProfile(response.data.data);
      }
    } catch (err: any) {
      console.error("Failed to load user profile:", err);
      setError(err.response?.data?.message || "Failed to load profile");
    }
  };

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadProfile(),
      fetchUserRatingStats(id as string),
      fetchUserRatings(id as string),
    ]);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  const formatMemberSince = (dateString?: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
    });
  };

  const getInitials = (firstName?: string, lastName?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    return "?";
  };

  if (loading) {
    return (
      <View style={styles.modalContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.floatingCard, animatedStyle]}>
            <View style={styles.dragIndicator} />
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading profile...</Text>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={styles.modalContainer}>
        <Stack.Screen options={{ headerShown: false }} />
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[styles.floatingCard, animatedStyle]}>
            <View style={styles.dragIndicator} />
            <View style={styles.modalHeader}>
              <View style={{ width: 40 }} />
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={styles.errorContainer}>
              <Ionicons name="person-circle-outline" size={64} color="#CBD5E1" />
              <Text style={styles.errorText}>{error || "Profile not found"}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadData}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
    );
  }

  const age = calculateAge(profile.date_of_birth);
  const memberSince = formatMemberSince(profile.created_at || profile.createdAt);

  return (
    <View style={styles.modalContainer}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Backdrop - tap to dismiss */}
      <TouchableOpacity 
        style={styles.backdrop} 
        activeOpacity={1} 
        onPress={closeModal}
      />
      
      <Animated.View style={[styles.floatingCard, animatedStyle]}>
        {/* Draggable Header Area */}
        <GestureDetector gesture={panGesture}>
          <Animated.View>
            {/* Drag Indicator */}
            <View style={styles.dragIndicator} />
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ width: 40 }} />
              <Text style={styles.headerTitle}>Profile</Text>
              <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>
          </Animated.View>
        </GestureDetector>

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          style={styles.scrollContent}
        >
        {/* Profile Card */}
        <LinearGradient
          colors={["#007AFF", "#0055CC"]}
          style={styles.profileCard}
        >
          {/* Avatar */}
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(profile.first_name, profile.last_name)}
                </Text>
              </View>
            )}
          </View>

          {/* Name */}
          <Text style={styles.userName}>
            {profile.first_name} {profile.last_name}
          </Text>

          {/* Quick Stats Row */}
          <View style={styles.statsRow}>
            {age !== null && (
              <>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{age}</Text>
                  <Text style={styles.statLabel}>years old</Text>
                </View>
                <View style={styles.statDivider} />
              </>
            )}
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="star" size={18} color="#FFD700" />
                <Text style={styles.statValue}>
                  {profile.rating && profile.rating > 0 ? profile.rating.toFixed(1) : "New"}
                </Text>
              </View>
              <Text style={styles.statLabel}>
                {profile.rating_count ? `${profile.rating_count} reviews` : "No reviews"}
              </Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{profile.trips_completed || 0}</Text>
              <Text style={styles.statLabel}>trips</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Bio Section */}
        {profile.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <View style={styles.card}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          </View>
        )}

        {/* Languages Section */}
        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Languages</Text>
            <View style={styles.card}>
              <View style={styles.languagesRow}>
                {profile.languages.map((lang, index) => (
                  <View key={index} style={styles.languageBadge}>
                    <Ionicons name="language-outline" size={14} color="#3B82F6" />
                    <Text style={styles.languageText}>{lang}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* Vehicle Information */}
        {(profile.car_model || profile.car_color) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vehicle</Text>
            <View style={styles.card}>
              <View style={styles.vehicleRow}>
                <View style={styles.vehicleIcon}>
                  <Ionicons name="car-sport" size={24} color="#3B82F6" />
                </View>
                <View style={styles.vehicleInfo}>
                  {profile.car_model && (
                    <Text style={styles.vehicleModel}>{profile.car_model}</Text>
                  )}
                  {profile.car_color && (
                    <View style={styles.colorRow}>
                      <View style={[styles.colorDot, { backgroundColor: getColorFromName(profile.car_color) }]} />
                      <Text style={styles.vehicleColor}>{profile.car_color}</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}



        {/* Ratings Section */}
        {ratingStats && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ratings</Text>
            <View style={styles.card}>
              <RatingDistribution stats={ratingStats} />
            </View>
          </View>
        )}

        {/* Reviews Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Reviews</Text>
          <View style={styles.card}>
            <ReviewList 
              ratings={userRatings} 
              maxItems={5}
              showSeeAll={userRatings.length > 5}
              onSeeAll={() => {
                // Could navigate to a full reviews page
              }}
            />
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
      </Animated.View>
    </View>
  );
}

// Helper function to convert color names to actual colors
function getColorFromName(colorName: string): string {
  const colors: { [key: string]: string } = {
    black: "#1F2937",
    white: "#F9FAFB",
    silver: "#9CA3AF",
    gray: "#6B7280",
    grey: "#6B7280",
    red: "#EF4444",
    blue: "#3B82F6",
    green: "#22C55E",
    yellow: "#EAB308",
    orange: "#F97316",
    brown: "#A16207",
    beige: "#D4C4A8",
    gold: "#CA8A04",
    purple: "#9333EA",
    pink: "#EC4899",
  };
  return colors[colorName.toLowerCase()] || "#6B7280";
}

const styles = StyleSheet.create({
  // Modal container styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  floatingCard: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 60,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  dragIndicator: {
    width: 40,
    height: 5,
    backgroundColor: "#CBD5E1",
    borderRadius: 3,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F8FAFC",
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 20,
  },
  scrollContent: {
    flex: 1,
  },
  
  // Legacy container (for compatibility)
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748B",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 12,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },

  // Header (legacy)
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },

  // Profile Card
  profileCard: {
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: "center",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -1,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  avatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "white",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  avatarText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#007AFF",
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: "white",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  memberBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    gap: 6,
  },
  memberText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },

  // Sections
  section: {
    marginHorizontal: 16,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 10,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bioText: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 22,
  },

  // Languages
  languagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  languageBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  languageText: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "500",
  },

  // Vehicle
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  vehicleIcon: {
    width: 50,
    height: 50,
    borderRadius: 12,
    backgroundColor: "#EFF6FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleModel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  vehicleColor: {
    fontSize: 14,
    color: "#64748B",
  },

  // Contact
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  contactText: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
    fontWeight: "500",
  },

  // Locked card
  lockedCard: {
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  lockedText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
  },
});
