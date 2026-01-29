import { useBookingStore } from "../../../src/store/bookingStore";
import { useRideStore } from "../../../src/store/rideStore";
import { useRequestStore } from "../../../src/store/requestStore";
import { format } from "date-fns";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import React, { useState, useCallback, useEffect } from "react";
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
import { Ionicons } from "@expo/vector-icons";

export default function MyBookingsScreen() {
  const router = useRouter();
  
  // Local state to force re-renders
  const [localRides, setLocalRides] = useState<any[]>([]);
  const [localRequests, setLocalRequests] = useState<any[]>([]);
  const [localBookings, setLocalBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Get store functions
  const getMyBookings = useBookingStore((s) => s.getMyBookings);
  const cancelBooking = useBookingStore((s) => s.cancelBooking);
  const getMyRides = useRideStore((s) => s.getMyRides);
  const cancelRide = useRideStore((s) => s.cancelRide);
  const getMyRequests = useRequestStore((s) => s.getMyRequests);
  
  // Subscribe to store data
  const storeRides = useRideStore((s) => s.myRides);
  const storeRequests = useRequestStore((s) => s.requests);
  const storeBookings = useBookingStore((s) => s.myBookings);
  
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookings" | "rides" | "requests">("bookings");
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted"
  >("all");

  // Sync local state when store updates
  useEffect(() => {
    console.log("📊 Store rides updated:", storeRides?.length);
    if (storeRides) {
      setLocalRides([...storeRides]);
    }
  }, [storeRides]);
  
  useEffect(() => {
    console.log("📊 Store requests updated:", storeRequests?.length);
    if (storeRequests) {
      setLocalRequests([...storeRequests]);
    }
  }, [storeRequests]);
  
  useEffect(() => {
    console.log("📊 Store bookings updated:", storeBookings?.length);
    if (storeBookings) {
      setLocalBookings([...storeBookings]);
    }
  }, [storeBookings]);

  // Fetch all data function
  const fetchAllData = useCallback(async () => {
    console.log("📋 Fetching all data...");
    setLoading(true);
    try {
      await Promise.all([
        getMyBookings(),
        getMyRides(),
        getMyRequests()
      ]);
      console.log("✅ Data fetch complete");
    } catch (e) {
      console.error("Fetch error:", e);
    }
    setLoading(false);
  }, [getMyBookings, getMyRides, getMyRequests]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("📋 My Trips screen FOCUSED");
      fetchAllData();
    }, [fetchAllData])
  );

  const onRefresh = useCallback(async () => {
    console.log("🔄 Pull to refresh...");
    setRefreshing(true);
    await fetchAllData();
    setRefreshing(false);
  }, [fetchAllData]);

  const handleCancel = useCallback(async (bookingId: string) => {
    try {
      await cancelBooking(bookingId);
      getMyBookings();
    } catch (e) {
      console.error("Cancel error:", e);
    }
  }, [cancelBooking, getMyBookings]);

  const handleCancelRide = useCallback(async (rideId: string) => {
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride? This will notify all passengers.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelRide(rideId);
              getMyRides();
            } catch (e) {
              console.error("Cancel ride error:", e);
              Alert.alert("Error", "Failed to cancel ride");
            }
          }
        }
      ]
    );
  }, [cancelRide, getMyRides]);

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
    // E.g. "Street, City" -> "City"
    // E.g. "City" -> "City"
    // E.g. "District, City" -> "City"
    if (parts.length > 0) {
      return parts[parts.length - 1];
    }
    
    return cleanLoc;
  };

  const filteredBookings = (localBookings || []).filter((booking: any) => {
    if (booking.status === 'cancelled') return false;
    if (filter === "all") return true;
    return booking.status === filter;
  });

  const filteredRides = (localRides || []).filter((ride: any) => {
    if (ride.status === 'cancelled') return false;
    if (filter === "all") return true;
    if (filter === "accepted") return ride.status === "active";
    if (filter === "pending") return ride.status === "pending";
    return ride.status === filter;
  });

  const filteredRequests = (localRequests || []).filter((request: any) => {
    if (request.status === 'cancelled') return false;
    if (filter === "all") return true;
    if (filter === "accepted") return request.status === "active";
    if (filter === "pending") return request.status === "pending";
    return request.status === filter;
  });

  console.log("🔍 Filtered - rides:", filteredRides.length, "requests:", filteredRequests.length, "localRides:", localRides.length);

  if (loading && localBookings.length === 0 && localRides.length === 0 && localRequests.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>My Trips</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "bookings" && styles.tabActive]}
          onPress={() => setActiveTab("bookings")}
        >
          <Ionicons name="car" size={20} color={activeTab === "bookings" ? "#2563eb" : "#666"} />
          <Text style={[styles.tabText, activeTab === "bookings" && styles.tabTextActive]}>
            Bookings ({localBookings?.filter(b => b.status !== 'cancelled').length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "rides" && styles.tabActive]}
          onPress={() => setActiveTab("rides")}
        >
          <Ionicons name="key" size={20} color={activeTab === "rides" ? "#2563eb" : "#666"} />
          <Text style={[styles.tabText, activeTab === "rides" && styles.tabTextActive]}>
            My Rides ({localRides?.filter(r => r.status !== 'cancelled').length || 0})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "requests" && styles.tabActive]}
          onPress={() => setActiveTab("requests")}
        >
          <Ionicons name="hand-right" size={20} color={activeTab === "requests" ? "#2563eb" : "#666"} />
          <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>
            Requests ({localRequests?.filter(r => r.status !== 'cancelled').length || 0})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {(["all", "pending", "accepted"] as const).map(
          (status) => (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filter === status && styles.filterButtonActive,
              ]}
              onPress={() => setFilter(status)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filter === status && styles.filterButtonTextActive,
                ]}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </Text>
            </TouchableOpacity>
          )
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <>
            {filteredBookings.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📭</Text>
                <Text style={styles.emptyStateText}>No bookings</Text>
                <Text style={styles.emptyStateSubtext}>
                  Start by searching for available rides
                </Text>
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => router.push("/(tabs)/rides/search")}
                >
                  <Text style={styles.ctaButtonText}>Search Rides</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bookingsContainer}>
                {filteredBookings.map((booking: any) => (
                  <View key={booking.id} style={styles.bookingCard}>
                <View style={styles.bookingHeader}>
                  <View style={styles.routeInfo}>
                    {/* Origin */}
                    <View style={styles.routeRow}>
                      <Ionicons 
                        name={(booking.direction || booking.ride?.direction) === "to_airport" ? "location" : "airplane"} 
                        size={16} 
                        color={(booking.direction || booking.ride?.direction) === "to_airport" ? "#EF4444" : "#007AFF"} 
                        style={{ width: 20 }}
                      />
                      <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                        {(booking.direction || booking.ride?.direction) === "to_airport" 
                          ? formatLocation(booking.home_city || booking.ride?.home_city) 
                          : (booking.airport_name || booking.ride?.airport?.name || booking.airport_code || booking.ride?.airport?.iata_code)}
                      </Text>
                    </View>

                    {/* Connector */}
                    <View style={styles.routeConnector}>
                      <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
                      <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
                    </View>

                    {/* Destination */}
                    <View style={styles.routeRow}>
                      <Ionicons 
                        name={(booking.direction || booking.ride?.direction) === "to_airport" ? "airplane" : "location"} 
                        size={16} 
                        color={(booking.direction || booking.ride?.direction) === "to_airport" ? "#007AFF" : "#EF4444"} 
                        style={{ width: 20 }}
                      />
                      <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                        {(booking.direction || booking.ride?.direction) === "to_airport" 
                          ? (booking.airport_name || booking.ride?.airport?.name || booking.airport_code || booking.ride?.airport?.iata_code)
                          : formatLocation(booking.home_city || booking.ride?.home_city)}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      booking.status === "accepted"
                        ? styles.statusAccepted
                        : booking.status === "pending"
                        ? styles.statusPending
                        : styles.statusCancelled,
                    ]}
                  >
                    <Text style={styles.statusText}>{booking.status}</Text>
                  </View>
                </View>

                <View style={styles.bookingDetails}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date & Time:</Text>
                    <Text style={styles.detailValue}>
                      {(booking.datetime_start ||
                        booking.ride?.departure_datetime) &&
                        format(
                          new Date(
                            booking.datetime_start ||
                              booking.ride?.departure_datetime
                          ),
                          "MMM d, yyyy • HH:mm"
                        )}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Seats:</Text>
                    <Text style={styles.detailValue}>{booking.seats}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Total Price:</Text>
                    <Text style={[styles.detailValue, styles.price]}>
                      {booking.total_price ||
                        booking.seats * (booking.price_per_seat || 0)} MAD
                    </Text>
                  </View>

                  {booking.status === "accepted" && (
                    <View style={styles.driverSection}>
                      <Text style={styles.sectionHeader}>Driver Details</Text>
                      <View style={styles.driverRow}>
                        <View style={styles.driverInfo}>
                            <Ionicons name="person-circle" size={36} color="#64748B" />
                            <View>
                                <Text style={styles.driverName}>
                                {booking.driver_first_name ||
                                    booking.ride?.driver?.first_name || "Driver"}{" "}
                                {booking.driver_last_name ||
                                    booking.ride?.driver?.last_name || ""}
                                </Text>
                                <Text style={styles.driverSubtext}>
                                    {booking.ride?.driver?.rating ? `★ ${booking.ride.driver.rating}` : "No rating"}
                                </Text>
                            </View>
                        </View>
                        {booking.driver_phone && (
                            <TouchableOpacity style={styles.phoneButton}>
                                <Ionicons name="call" size={20} color="#fff" />
                            </TouchableOpacity>
                        )}
                      </View>
                      
                      {/* Car Details if available */}
                      {booking.ride?.car_model && (
                          <View style={styles.carInfo}>
                              <Ionicons name="car-sport-outline" size={16} color="#64748B" />
                              <Text style={styles.carText}>
                                  {booking.ride.car_model} • {booking.ride.car_color || 'Unknown color'}
                              </Text>
                          </View>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.viewButton, booking.status === "accepted" && styles.viewButtonAccepted]}
                    onPress={() => router.push({ pathname: "/ride-details/[id]", params: { id: booking.ride?.id || booking.ride?._id || (typeof booking.ride_id === 'object' ? (booking.ride_id as any)._id : booking.ride_id) } })}
                  >
                    <Ionicons name={booking.status === "accepted" ? "map" : "eye"} size={16} color="#fff" style={{marginRight: 6}} />
                    <Text style={styles.viewButtonText}>
                        {booking.status === "accepted" ? "View Map & Details" : "View Details"}
                    </Text>
                  </TouchableOpacity>

                  {(booking.status === "pending" ||
                    booking.status === "accepted") && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => handleCancel(booking.id)}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
            )}
          </>
        )}

        {/* My Rides Tab */}
        {activeTab === "rides" && (
          <>
            {filteredRides.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🚗</Text>
                <Text style={styles.emptyStateText}>No rides created</Text>
                <Text style={styles.emptyStateSubtext}>
                  Start by offering a ride to earn money
                </Text>
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => router.push("/(tabs)/rides/create")}
                >
                  <Text style={styles.ctaButtonText}>Offer a Ride</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bookingsContainer}>
                {filteredRides.map((ride: any) => (
                  <View key={ride.id || ride._id} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.routeInfo}>
                        {/* Origin */}
                        <View style={styles.routeRow}>
                          <Ionicons 
                            name={ride.direction === "to_airport" ? "location" : "airplane"} 
                            size={16} 
                            color={ride.direction === "to_airport" ? "#EF4444" : "#007AFF"} 
                            style={{ width: 20 }}
                          />
                          <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                            {ride.direction === "to_airport" ? formatLocation(ride.home_city) : (ride.airport?.name || ride.airport_name)}
                          </Text>
                        </View>

                        {/* Connector */}
                        <View style={styles.routeConnector}>
                          <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
                          <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
                        </View>

                        {/* Destination */}
                        <View style={styles.routeRow}>
                          <Ionicons 
                            name={ride.direction === "to_airport" ? "airplane" : "location"} 
                            size={16} 
                            color={ride.direction === "to_airport" ? "#007AFF" : "#EF4444"} 
                            style={{ width: 20 }}
                          />
                          <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                            {ride.direction === "to_airport" ? (ride.airport?.name || ride.airport_name) : formatLocation(ride.home_city)}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          ride.status === "active"
                            ? styles.statusAccepted
                            : styles.statusCancelled,
                        ]}
                      >
                        <Text style={styles.statusText}>{ride.status}</Text>
                      </View>
                    </View>

                    <View style={styles.bookingDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date & Time:</Text>
                        <Text style={styles.detailValue}>
                          {(ride.departure_datetime || ride.datetime_start) &&
                            format(
                              new Date(ride.departure_datetime || ride.datetime_start),
                              "MMM d, yyyy • HH:mm"
                            )}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Available Seats:</Text>
                        <Text style={styles.detailValue}>{ride.available_seats || ride.seats_left}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Price per Seat:</Text>
                        <Text style={[styles.detailValue, styles.price]}>
                          {ride.price_per_seat} MAD
                        </Text>
                      </View>

                      {(ride.bookings_count > 0 || ride.pending_count > 0) && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Bookings:</Text>
                          <Text style={styles.detailValue}>
                            {ride.bookings_count || ride.pending_count || 0} passenger(s)
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => {
                          console.log("👉 Navigating to Ride Details from Bookings (My Rides):", ride.id, ride._id);
                          router.push({ pathname: "/ride-details/[id]", params: { id: ride.id || ride._id } });
                        }}
                      >
                        <Text style={styles.viewButtonText}>View Details</Text>
                      </TouchableOpacity>

                      {ride.status !== "cancelled" && ride.status !== "completed" && (
                        <TouchableOpacity
                          style={styles.cancelButton}
                          onPress={() => handleCancelRide(ride.id || ride._id)}
                        >
                          <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* My Requests Tab */}
        {activeTab === "requests" && (
          <>
            {filteredRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>✋</Text>
                <Text style={styles.emptyStateText}>No requests created</Text>
                <Text style={styles.emptyStateSubtext}>
                  Create a request to find available rides
                </Text>
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => router.push("/(tabs)/requests/create")}
                >
                  <Text style={styles.ctaButtonText}>Create Request</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.bookingsContainer}>
                {filteredRequests.map((request: any) => (
                  <View key={request.id} style={styles.bookingCard}>
                    <View style={styles.bookingHeader}>
                      <View style={styles.routeInfo}>
                        {/* Origin */}
                        <View style={styles.routeRow}>
                          <Ionicons 
                            name={request.direction === "to_airport" ? "location" : "airplane"} 
                            size={16} 
                            color={request.direction === "to_airport" ? "#EF4444" : "#007AFF"} 
                            style={{ width: 20 }}
                          />
                          <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                            {request.direction === "to_airport" ? formatLocation(request.location_city) : (request.airport?.name || "Airport")}
                          </Text>
                        </View>

                        {/* Connector */}
                        <View style={styles.routeConnector}>
                          <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
                          <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
                        </View>

                        {/* Destination */}
                        <View style={styles.routeRow}>
                          <Ionicons 
                            name={request.direction === "to_airport" ? "airplane" : "location"} 
                            size={16} 
                            color={request.direction === "to_airport" ? "#007AFF" : "#EF4444"} 
                            style={{ width: 20 }}
                          />
                          <Text style={styles.routeText} numberOfLines={1} ellipsizeMode="tail">
                            {request.direction === "to_airport" ? (request.airport?.name || "Airport") : formatLocation(request.location_city)}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          request.status === "active"
                            ? styles.statusPending
                            : styles.statusCancelled,
                        ]}
                      >
                        <Text style={styles.statusText}>{request.status}</Text>
                      </View>
                    </View>

                    <View style={styles.bookingDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Date:</Text>
                        <Text style={styles.detailValue}>
                          {request.travel_date &&
                            format(
                              new Date(request.travel_date),
                              "MMM d, yyyy"
                            )}
                        </Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Seats Needed:</Text>
                        <Text style={styles.detailValue}>{request.seats_needed}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Location:</Text>
                        <Text style={styles.detailValue}>
                          {formatLocation(request.location_city)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={styles.viewButton}
                        onPress={() => router.push("/(tabs)/rides/search")}
                      >
                        <Text style={styles.viewButtonText}>Find Rides</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },
  scrollView: {
    flex: 1,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 12,
    color: "#666",
    fontWeight: "500",
  },
  tabTextActive: {
    color: "#2563eb",
    fontWeight: "600",
  },
  filterContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
  },
  filterButtonActive: {
    backgroundColor: "#2563eb",
  },
  filterButtonText: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  filterButtonTextActive: {
    color: "#fff",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 24,
  },
  ctaButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  ctaButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  bookingsContainer: {
    padding: 16,
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  routeConnector: {
    marginLeft: 2, 
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    marginVertical: 2,
  },
  airport: {
    display: 'none',
  },
  route: {
    display: 'none',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 4,
  },
  statusAccepted: {
    backgroundColor: "#d1fae5",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
  },
  statusCancelled: {
    backgroundColor: "#fee2e2",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
    textTransform: "capitalize",
  },
  bookingDetails: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6b7280",
  },
  detailValue: {
    fontSize: 13,
    color: "#1f2937",
    fontWeight: "500",
  },
  price: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  viewButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  viewButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#fee2e2",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#dc2626",
    fontWeight: "600",
    fontSize: 13,
  },
  driverSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  sectionHeader: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
    fontWeight: "600",
  },
  driverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  driverSubtext: {
    fontSize: 12,
    color: "#64748B",
  },
  phoneButton: {
    backgroundColor: "#22C55E",
    padding: 8,
    borderRadius: 20,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
    backgroundColor: "#F8FAFC",
    padding: 6,
    borderRadius: 6,
  },
  carText: {
    fontSize: 12,
    color: "#475569",
  },
  viewButtonAccepted: {
    backgroundColor: "#059669",
    flexDirection: "row",
    justifyContent: "center",
  },
});
