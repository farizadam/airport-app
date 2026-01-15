import { useBookingStore } from "../../../src/store/bookingStore";
import { format } from "date-fns";
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
import { Ionicons } from "@expo/vector-icons";

export default function MyBookingsScreen() {
  const router = useRouter();
  const { myBookings, getMyBookings, cancelBooking, isLoading } =
    useBookingStore();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted" | "cancelled"
  >("all");

  useEffect(() => {
    getMyBookings();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await getMyBookings();
    setRefreshing(false);
  };

  const filteredBookings = myBookings.filter((booking) => {
    if (filter === "all") return true;
    return booking.status === filter;
  });

  const handleCancel = (bookingId: string) => {
    cancelBooking(bookingId).catch((error: any) => {
      alert(error.message);
    });
  };

  if (isLoading && myBookings.length === 0) {
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
        <Text style={styles.title}>My Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterContainer}>
        {(["all", "pending", "accepted", "cancelled"] as const).map(
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
                    <Text style={styles.route}>
                      {booking.home_city || booking.ride?.home_city}{" "}
                      {(booking.direction || booking.ride?.direction) ===
                      "to_airport"
                        ? "→"
                        : "←"}{" "}
                      {booking.airport_name ||
                        booking.ride?.airport?.name ||
                        booking.airport_code ||
                        booking.ride?.airport?.iata_code}
                    </Text>
                    <Text style={styles.airport}>
                      {booking.airport_name || booking.ride?.airport?.name}
                    </Text>
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
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Driver:</Text>
                      <Text style={styles.detailValue}>
                        {booking.driver_first_name ||
                          booking.ride?.driver?.first_name}{" "}
                        {booking.driver_last_name ||
                          booking.ride?.driver?.last_name}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => router.push({ pathname: "/(tabs)/rides/[id]", params: { id: booking.ride_id } })}
                  >
                    <Text style={styles.viewButtonText}>View Ride</Text>
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
  route: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  airport: {
    fontSize: 13,
    color: "#6b7280",
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
});
