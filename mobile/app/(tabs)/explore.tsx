import { useAuthStore } from "@/store/authStore";
import { useBookingStore } from "@/store/bookingStore";
import { useRequestStore } from "@/store/requestStore";
import { useRideStore } from "@/store/rideStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "upcoming" | "myrides" | "myrequests" | "history";

interface TripItem {
  id: string;
  type: "ride" | "request" | "booking";
  role: "driver" | "passenger";
  status: string;
  pickupLocation: string;
  dropoffLocation: string;
  departureTime: string;
  seats?: number;
  price?: number;
}

export default function MyTripsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();
  const { rides, fetchRides, isLoading: ridesLoading } = useRideStore();
  const { requests, fetchRequests, isLoading: requestsLoading } = useRequestStore();
  const { bookings, fetchMyBookings, isLoading: bookingsLoading } = useBookingStore();

  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const loadData = async () => {
    await Promise.all([
      fetchRides(),
      fetchRequests(),
      fetchMyBookings(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Filter user's own rides (as driver)
  const myRides = (rides || []).filter((ride: any) => 
    ride.driver?._id === user?._id || ride.driver === user?._id
  );

  // Filter user's own requests (as passenger)
  const myRequests = (requests || []).filter((request: any) => 
    request.passenger?._id === user?._id || request.passenger === user?._id
  );

  // User's bookings (as passenger on someone else's ride)
  const myBookings = bookings || [];

  // Get upcoming trips (future rides + requests + bookings)
  const now = new Date();
  const upcomingTrips: TripItem[] = [
    ...myRides
      .filter((r: any) => new Date(r.departure_time) > now && r.status !== "cancelled")
      .map((r: any) => ({
        id: r._id,
        type: "ride" as const,
        role: "driver" as const,
        status: r.status,
        pickupLocation: r.pickup_location?.address || "Unknown",
        dropoffLocation: r.dropoff_location?.address || "Unknown",
        departureTime: r.departure_time,
        seats: r.available_seats,
        price: r.price_per_seat,
      })),
    ...myRequests
      .filter((r: any) => new Date(r.preferred_time) > now && r.status !== "cancelled")
      .map((r: any) => ({
        id: r._id,
        type: "request" as const,
        role: "passenger" as const,
        status: r.status,
        pickupLocation: r.pickup_location?.address || "Unknown",
        dropoffLocation: r.dropoff_location?.address || "Unknown",
        departureTime: r.preferred_time,
        seats: r.passengers,
      })),
    ...myBookings
      .filter((b: any) => new Date(b.ride?.departure_time) > now && b.status !== "cancelled")
      .map((b: any) => ({
        id: b._id,
        type: "booking" as const,
        role: "passenger" as const,
        status: b.status,
        pickupLocation: b.ride?.pickup_location?.address || "Unknown",
        dropoffLocation: b.ride?.dropoff_location?.address || "Unknown",
        departureTime: b.ride?.departure_time,
        seats: b.seats_booked,
      })),
  ].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // Get past trips (history)
  const pastTrips: TripItem[] = [
    ...myRides
      .filter((r: any) => new Date(r.departure_time) <= now || r.status === "completed")
      .map((r: any) => ({
        id: r._id,
        type: "ride" as const,
        role: "driver" as const,
        status: r.status,
        pickupLocation: r.pickup_location?.address || "Unknown",
        dropoffLocation: r.dropoff_location?.address || "Unknown",
        departureTime: r.departure_time,
        seats: r.available_seats,
        price: r.price_per_seat,
      })),
    ...myRequests
      .filter((r: any) => new Date(r.preferred_time) <= now || r.status === "completed" || r.status === "matched")
      .map((r: any) => ({
        id: r._id,
        type: "request" as const,
        role: "passenger" as const,
        status: r.status,
        pickupLocation: r.pickup_location?.address || "Unknown",
        dropoffLocation: r.dropoff_location?.address || "Unknown",
        departureTime: r.preferred_time,
        seats: r.passengers,
      })),
  ].sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());

  const isLoading = ridesLoading || requestsLoading || bookingsLoading;

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed":
      case "completed":
      case "matched":
        return { bg: "#DCFCE7", text: "#16A34A" };
      case "pending":
      case "open":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "cancelled":
        return { bg: "#FEE2E2", text: "#DC2626" };
      default:
        return { bg: "#F1F5F9", text: "#64748B" };
    }
  };

  const renderTripCard = (item: TripItem) => {
    const dateTime = formatDateTime(item.departureTime);
    const statusColors = getStatusColor(item.status);
    const isDriver = item.role === "driver";

    return (
      <TouchableOpacity
        key={`${item.type}-${item.id}`}
        style={styles.tripCard}
        onPress={() => {
          if (item.type === "ride") {
            router.push(`/(tabs)/rides/${item.id}`);
          } else if (item.type === "request") {
            router.push(`/(tabs)/requests/${item.id}`);
          } else {
            router.push(`/(tabs)/bookings/${item.id}`);
          }
        }}
      >
        <View style={styles.tripHeader}>
          <View style={[styles.roleBadge, { backgroundColor: isDriver ? "#DBEAFE" : "#F3E8FF" }]}>
            <Ionicons 
              name={isDriver ? "car" : "person"} 
              size={14} 
              color={isDriver ? "#3B82F6" : "#8B5CF6"} 
            />
            <Text style={[styles.roleBadgeText, { color: isDriver ? "#3B82F6" : "#8B5CF6" }]}>
              {isDriver ? "As Driver" : "As Passenger"}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.tripRoute}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#3B82F6" }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.pickupLocation}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.dropoffLocation}</Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.tripDateTime}>
            <Ionicons name="calendar-outline" size={14} color="#64748B" />
            <Text style={styles.tripDateTimeText}>{dateTime.date}</Text>
            <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
            <Text style={styles.tripDateTimeText}>{dateTime.time}</Text>
          </View>
          {item.seats && (
            <View style={styles.tripSeats}>
              <Ionicons name="people-outline" size={14} color="#64748B" />
              <Text style={styles.tripSeatsText}>{item.seats} seats</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <View style={styles.loginPrompt}>
          <Ionicons name="lock-closed-outline" size={64} color="#CBD5E1" />
          <Text style={styles.loginPromptTitle}>Login Required</Text>
          <Text style={styles.loginPromptSubtitle}>
            Sign in to view and manage your trips
          </Text>
          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.loginButtonText}>Login</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (isLoading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading your trips...</Text>
        </View>
      );
    }

    let trips: TripItem[] = [];
    let emptyMessage = "";
    let emptyIcon: keyof typeof Ionicons.glyphMap = "car-outline";

    switch (activeTab) {
      case "upcoming":
        trips = upcomingTrips;
        emptyMessage = "No upcoming trips";
        emptyIcon = "calendar-outline";
        break;
      case "myrides":
        trips = myRides.map((r: any) => ({
          id: r._id,
          type: "ride" as const,
          role: "driver" as const,
          status: r.status,
          pickupLocation: r.pickup_location?.address || "Unknown",
          dropoffLocation: r.dropoff_location?.address || "Unknown",
          departureTime: r.departure_time,
          seats: r.available_seats,
          price: r.price_per_seat,
        }));
        emptyMessage = "You haven't offered any rides yet";
        emptyIcon = "car-outline";
        break;
      case "myrequests":
        trips = myRequests.map((r: any) => ({
          id: r._id,
          type: "request" as const,
          role: "passenger" as const,
          status: r.status,
          pickupLocation: r.pickup_location?.address || "Unknown",
          dropoffLocation: r.dropoff_location?.address || "Unknown",
          departureTime: r.preferred_time,
          seats: r.passengers,
        }));
        emptyMessage = "You haven't made any ride requests";
        emptyIcon = "hand-right-outline";
        break;
      case "history":
        trips = pastTrips;
        emptyMessage = "No trip history yet";
        emptyIcon = "time-outline";
        break;
    }

    if (trips.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name={emptyIcon} size={64} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>{emptyMessage}</Text>
          <Text style={styles.emptyStateSubtitle}>
            Start by searching for a ride or creating one
          </Text>
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.push("/(tabs)")}
          >
            <Ionicons name="search" size={18} color="#fff" />
            <Text style={styles.emptyStateButtonText}>Find a Ride</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return <View style={styles.tripsList}>{trips.map(renderTripCard)}</View>;
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={["#1E3A8A", "#3B82F6"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>My Trips</Text>
        <Text style={styles.headerSubtitle}>
          {isAuthenticated ? `Manage your rides and requests` : "Login to see your trips"}
        </Text>
      </LinearGradient>

      {/* Tabs */}
      {isAuthenticated && (
        <View style={styles.tabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
              onPress={() => setActiveTab("upcoming")}
            >
              <Ionicons 
                name={activeTab === "upcoming" ? "calendar" : "calendar-outline"} 
                size={18} 
                color={activeTab === "upcoming" ? "#3B82F6" : "#64748B"} 
              />
              <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>
                Upcoming ({upcomingTrips.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === "myrides" && styles.tabActive]}
              onPress={() => setActiveTab("myrides")}
            >
              <Ionicons 
                name={activeTab === "myrides" ? "car" : "car-outline"} 
                size={18} 
                color={activeTab === "myrides" ? "#3B82F6" : "#64748B"} 
              />
              <Text style={[styles.tabText, activeTab === "myrides" && styles.tabTextActive]}>
                My Rides ({myRides.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === "myrequests" && styles.tabActive]}
              onPress={() => setActiveTab("myrequests")}
            >
              <Ionicons 
                name={activeTab === "myrequests" ? "hand-right" : "hand-right-outline"} 
                size={18} 
                color={activeTab === "myrequests" ? "#3B82F6" : "#64748B"} 
              />
              <Text style={[styles.tabText, activeTab === "myrequests" && styles.tabTextActive]}>
                My Requests ({myRequests.length})
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.tab, activeTab === "history" && styles.tabActive]}
              onPress={() => setActiveTab("history")}
            >
              <Ionicons 
                name={activeTab === "history" ? "time" : "time-outline"} 
                size={18} 
                color={activeTab === "history" ? "#3B82F6" : "#64748B"} 
              />
              <Text style={[styles.tabText, activeTab === "history" && styles.tabTextActive]}>
                History ({pastTrips.length})
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          isAuthenticated ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#3B82F6"]}
              tintColor="#3B82F6"
            />
          ) : undefined
        }
      >
        {renderContent()}
      </ScrollView>

      {/* FAB for quick create */}
      {isAuthenticated && (
        <View style={[styles.fabContainer, { bottom: insets.bottom + 90 }]}>
          <TouchableOpacity
            style={[styles.fab, styles.fabSecondary]}
            onPress={() => router.push("/(tabs)/requests/create")}
          >
            <Ionicons name="hand-right" size={20} color="#8B5CF6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.fab, styles.fabPrimary]}
            onPress={() => router.push("/(tabs)/rides/create")}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  tabsContainer: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tabsScrollContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: "#EFF6FF",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 6,
  },
  tabTextActive: {
    color: "#3B82F6",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 120,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 80,
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
  },
  loginPrompt: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  loginPromptTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 20,
  },
  loginPromptSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  loginButton: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  emptyStateButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3B82F6",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  tripsList: {
    gap: 12,
  },
  tripCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tripRoute: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 18,
    backgroundColor: "#E2E8F0",
    marginLeft: 4,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 14,
    color: "#475569",
    flex: 1,
  },
  tripFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  tripDateTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripDateTimeText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },
  tripSeats: {
    flexDirection: "row",
    alignItems: "center",
  },
  tripSeatsText: {
    fontSize: 12,
    color: "#64748B",
    marginLeft: 4,
  },
  fabContainer: {
    position: "absolute",
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  fabPrimary: {
    backgroundColor: "#3B82F6",
  },
  fabSecondary: {
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#8B5CF6",
  },
});
