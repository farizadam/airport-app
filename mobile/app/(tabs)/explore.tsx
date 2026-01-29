import { TripCard, TripItem } from "@/components/TripCard";
import { useAuthStore } from "@/store/authStore";
import { useBookingStore } from "@/store/bookingStore";
import { useRequestStore } from "@/store/requestStore";
import { useRideStore } from "@/store/rideStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabType = "upcoming" | "myrides" | "myrequests" | "history";

export default function MyTripsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { user, isAuthenticated } = useAuthStore();
  
  // Use correct store methods
  const rides = useRideStore((s) => s.myRides);
  const getMyRides = useRideStore((s) => s.getMyRides);
  const cancelRide = useRideStore((s) => s.cancelRide);
  const ridesLoading = useRideStore((s) => s.isLoading);
  
  const requests = useRequestStore((s) => s.requests);
  const getMyRequests = useRequestStore((s) => s.getMyRequests);
  const cancelRequest = useRequestStore((s) => s.cancelRequest);
  const myOffers = useRequestStore((s) => s.myOffers);
  const getMyOffers = useRequestStore((s) => s.getMyOffers);
  const withdrawOffer = useRequestStore((s) => s.withdrawOffer);
  const requestsLoading = useRequestStore((s) => s.loading);
  
  const bookings = useBookingStore((s) => s.myBookings);
  const getMyBookings = useBookingStore((s) => s.getMyBookings);
  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const bookingsLoading = useBookingStore((s) => s.isLoading);

  const [activeTab, setActiveTab] = useState<TabType>("upcoming");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params?.tab) {
      const t = params.tab as TabType;
      if (["upcoming", "myrides", "myrequests", "history"].includes(t)) {
        setActiveTab(t);
      }
    }
  }, [params?.tab]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadData();
      }
    }, [isAuthenticated])
  );

  const loadData = async () => {
    await Promise.all([
      getMyRides(),
      getMyRequests(),
      getMyBookings(),
      getMyOffers(),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const now = new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  // Helper to format location to show just the city
  const formatLocation = (location: string | undefined | null) => {
    if (!location) return "";
    
    const cleanLoc = location.trim();
    if (!cleanLoc.includes(",")) return cleanLoc;
    
    // Split and trim parts
    let parts = cleanLoc.split(",").map(p => p.trim());
    
    // Remove common country names (case insensitive)
    const countries = ["morocco", "maroc", "kingdom of morocco", "france", "espagne", "spain", "usa", "united states", "uk", "united kingdom"];
    
    // Remove the last part if it is a country
    if (parts.length > 1 && countries.includes(parts[parts.length - 1].toLowerCase())) {
      parts.pop();
    }
    
    // If we have parts left, return the last one (usually the city)
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
    
    return cleanLoc;
  };

  // Helper to check if a date is in the future (or today)
  const isFuture = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() >= startOfToday.getTime();
  };

  // Helper to check if a date is in the past (yesterday or older)
  const isPast = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return !isNaN(d.getTime()) && d.getTime() < startOfToday.getTime();
  };

  // Filter user's own rides (as driver) - Active & Future Only
  const myRides = (rides || []).filter((ride: any) => 
    (ride.driver?._id === user?._id || ride.driver === user?._id || ride.driver_id === user?._id) &&
    ride.status !== "cancelled" &&
    ride.status !== "completed" &&
    isFuture(ride.departure_datetime || ride.datetime_start)
  );

  // Filter user's own requests (as passenger) - Active & Future Only
  const myRequests = (requests || []).filter((request: any) => 
    (request.passenger?._id === user?._id || request.passenger === user?._id) &&
    request.status !== "cancelled" &&
    request.status !== "completed" &&
    request.status !== "expired" &&
    isFuture(request.preferred_datetime)
  );

  // User's bookings (as passenger on someone else's ride) - Active & Future Only
  const myBookings = (bookings || []).filter((b: any) => 
    b.status !== "cancelled" &&
    b.status !== "completed" &&
    isFuture(b.ride?.departure_datetime || b.ride?.datetime_start)
  );

  // User's offers (as driver offering on someone else's request) - Active & Future Only
  const myActiveOffers = (myOffers || []).filter((request: any) => 
    request.status !== "cancelled" &&
    request.status !== "completed" &&
    request.status !== "expired" &&
    isFuture(request.preferred_datetime)
  );

  // Helper to safely get location names
  const getLocations = (item: any) => {
    const isToAirport = item.direction === "to_airport";
    
    let airportName = "Airport";
    if (item.airport && typeof item.airport === 'object' && item.airport.name) {
      airportName = `${item.airport.name}`; // Removed city to keep it short
    } else if (item.airport_id && typeof item.airport_id === 'object' && (item.airport_id as any).name) {
       const airport = item.airport_id as any;
       airportName = `${airport.name}`;
    } else if (item.airport_name) {
      airportName = item.airport_name;
    }
    
    let pickup = item.pickup_location?.city || item.pickup_location?.address;
    let dropoff = item.dropoff_location?.city || item.dropoff_location?.address;

    // Prefer city fields over address fields
    const specificLoc = item.location?.city || 
                        item.home_city || 
                        item.location_city || 
                        item.location?.address || 
                        item.home_address || 
                        item.location_address || 
                        "Unknown Location";

    if (!pickup || pickup === "Unknown") {
      pickup = !isToAirport ? airportName : specificLoc;
    }
    
    if (!dropoff || dropoff === "Unknown") {
      dropoff = isToAirport ? airportName : specificLoc;
    }

    return { 
      pickup: formatLocation(pickup), 
      dropoff: formatLocation(dropoff) 
    };
  };

  // Get upcoming trips (future rides + requests + bookings)
  const upcomingTrips: TripItem[] = [
    ...myRides
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "ride" as const,
          role: "driver" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.departure_datetime || r.datetime_start,
          seats: r.available_seats,
          price: r.price_per_seat,
          direction: r.direction,
        };
      }),
    ...myRequests
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "request" as const,
          role: "passenger" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          direction: r.direction,
        };
      }),
    ...myBookings
      .map((b: any) => {
        const locs = getLocations(b.ride);
        return {
          id: b.id || b._id,
          rideId: b.ride?.id || b.ride?._id || (typeof b.ride_id === 'string' ? b.ride_id : b.ride_id?._id),
          type: "booking" as const,
          role: "passenger" as const,
          status: b.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: b.ride?.departure_datetime || b.ride?.datetime_start,
          seats: b.seats_booked,
          direction: b.ride?.direction,
          driver: {
            first_name: b.driver_first_name || b.ride?.driver?.first_name,
            last_name: b.driver_last_name || b.ride?.driver?.last_name,
            phone: b.driver_phone || b.ride?.driver?.phone,
            rating: b.ride?.driver?.rating,
            car_model: b.ride?.car_model,
            car_color: b.ride?.car_color,
          },
        };
      }),
    ...myActiveOffers
      .map((r: any) => {
        const locs = getLocations(r);
        // Find user's offer in the offers array
        const userOffer = r.offers?.find((o: any) => 
          o.driver?._id === user?._id || o.driver === user?._id
        );
        return {
          id: userOffer?._id || r._id,
          requestId: r._id || r.id,
          type: "offer" as const,
          role: "driver" as const,
          status: userOffer?.status || "pending",
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          price: userOffer?.price_per_seat,
          direction: r.direction,
          passenger: {
            first_name: r.passenger?.first_name,
            last_name: r.passenger?.last_name,
          },
        };
      }),
  ].sort((a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime());

  // Get past trips (history)
  const pastTrips: TripItem[] = [
    ...(rides || [])
      .filter((r: any) => (r.driver?._id === user?._id || r.driver === user?._id || r.driver_id === user?._id) && 
        r.status !== "cancelled" && (isPast(r.departure_datetime || r.datetime_start) || r.status === "completed"))
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "ride" as const,
          role: "driver" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.departure_datetime || r.datetime_start,
          seats: r.available_seats,
          price: r.price_per_seat,
          direction: r.direction,
        };
      }),
    ...(requests || [])
      .filter((r: any) => (r.passenger?._id === user?._id || r.passenger === user?._id) && 
        r.status !== "cancelled" && (isPast(r.preferred_datetime) || r.status === "completed" || r.status === "expired"))
      .map((r: any) => {
        const locs = getLocations(r);
        return {
          id: r.id || r._id,
          type: "request" as const,
          role: "passenger" as const,
          status: r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          direction: r.direction,
        };
      }),
    ...(bookings || [])
      .filter((b: any) => b.status !== "cancelled" && (isPast(b.ride?.departure_datetime || b.ride?.datetime_start) || b.status === "completed"))
      .map((b: any) => {
        const locs = getLocations(b.ride);
        return {
          id: b.id || b._id,
          rideId: b.ride?.id || b.ride?._id || (typeof b.ride_id === 'string' ? b.ride_id : b.ride_id?._id),
          type: "booking" as const,
          role: "passenger" as const,
          status: b.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: b.ride?.departure_datetime || b.ride?.datetime_start,
          seats: b.seats_booked,
          direction: b.ride?.direction,
          driver: {
            first_name: b.driver_first_name || b.ride?.driver?.first_name,
            last_name: b.driver_last_name || b.ride?.driver?.last_name,
            phone: b.driver_phone || b.ride?.driver?.phone,
            rating: b.ride?.driver?.rating,
            car_model: b.ride?.car_model,
            car_color: b.ride?.car_color,
          },
        };
      }),
    ...(myOffers || [])
      .filter((r: any) => r.status !== "cancelled" && (isPast(r.preferred_datetime) || r.status === "completed" || r.status === "expired"))
      .map((r: any) => {
        const locs = getLocations(r);
        const userOffer = r.offers?.find((o: any) => 
          o.driver?._id === user?._id || o.driver === user?._id
        );
        return {
          id: userOffer?._id || r._id,
          requestId: r._id || r.id,
          type: "offer" as const,
          role: "driver" as const,
          status: userOffer?.status || r.status,
          pickupLocation: locs.pickup,
          dropoffLocation: locs.dropoff,
          departureTime: r.preferred_datetime,
          seats: r.seats_needed,
          price: userOffer?.price_per_seat,
          direction: r.direction,
          passenger: {
            first_name: r.passenger?.first_name,
            last_name: r.passenger?.last_name,
          },
        };
      }),
  ].sort((a, b) => new Date(b.departureTime).getTime() - new Date(a.departureTime).getTime());

  const isLoading = ridesLoading || requestsLoading || bookingsLoading;

  const handleCancel = (item: TripItem) => {
    const title = item.type === "offer" ? "Withdraw Offer" : "Cancel Trip";
    const message = item.type === "offer" 
      ? "Are you sure you want to withdraw your offer?" 
      : "Are you sure you want to cancel this?";
    const buttonText = item.type === "offer" ? "Yes, Withdraw" : "Yes, Cancel";

    Alert.alert(
      title,
      message,
      [
        { text: "No", style: "cancel" },
        {
          text: buttonText,
          style: "destructive",
          onPress: async () => {
            try {
              if (item.type === "ride") await cancelRide(item.id);
              else if (item.type === "request") await cancelRequest(item.id);
              else if (item.type === "booking") await cancelBooking(item.id);
              else if (item.type === "offer" && item.requestId) await withdrawOffer(item.requestId);
              
              loadData(); // Refresh data
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to cancel");
            }
          }
        }
      ]
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
        trips = myRides
          .map((r: any) => {
            const locs = getLocations(r);
            return {
              id: r._id,
              type: "ride" as const,
              role: "driver" as const,
              status: r.status,
              pickupLocation: locs.pickup,
              dropoffLocation: locs.dropoff,
                        departureTime: r.departure_datetime || r.datetime_start,
                        seats: r.available_seats,
                        price: r.price_per_seat,
                        direction: r.direction,
                      };
                    });        emptyMessage = "You haven't offered any rides yet";
        emptyIcon = "car-outline";
        break;
      case "myrequests":
        trips = myRequests
          .map((r: any) => {
            const locs = getLocations(r);
            return {
              id: r._id,
              type: "request" as const,
              role: "passenger" as const,
              status: r.status,
              pickupLocation: locs.pickup,
                        dropoffLocation: locs.dropoff,
                        departureTime: r.preferred_datetime,
                        seats: r.seats_needed,
                        direction: r.direction,
                      };
                    });        emptyMessage = "You haven't made any ride requests";
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

    return (
      <View style={styles.tripsList}>
        {trips.map((item) => (
          <TripCard
            key={`${item.type}-${item.id}`}
            item={item}
            onCancel={handleCancel}
            showCancelButton={activeTab !== 'history'}
          />
        ))}
      </View>
    );
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