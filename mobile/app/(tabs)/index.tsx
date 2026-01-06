import { useAuthStore } from "@/store/authStore";
import { useBookingStore } from "@/store/bookingStore";
import { useRideStore } from "@/store/rideStore";
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

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { myRides, getMyRides } = useRideStore();
  const { myBookings, getMyBookings } = useBookingStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      await Promise.all([getMyRides(), getMyBookings()]);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const upcomingRides = myRides.filter(
    (ride) =>
      ride.status === "active" && new Date(ride.departure_datetime) > new Date()
  );

  const activeBookings = myBookings.filter(
    (booking) => booking.status === "accepted" || booking.status === "pending"
  );

  const pendingBookings = myBookings.filter(
    (booking) => booking.status === "pending"
  );

  const isDriver = user?.role === "driver" || user?.role === "both";
  const isPassenger = user?.role === "passenger" || user?.role === "both";

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back!</Text>
          <Text style={styles.userName}>
            {user?.first_name} {user?.last_name}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        {isPassenger && (
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{activeBookings.length}</Text>
            <Text style={styles.statLabel}>Active Bookings</Text>
          </View>
        )}

        {isDriver && (
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{upcomingRides.length}</Text>
            <Text style={styles.statLabel}>Upcoming Rides</Text>
          </View>
        )}

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{pendingBookings.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {isPassenger && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/rides/search")}
          >
            <Text style={styles.actionIcon}>🔍</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Search Rides</Text>
              <Text style={styles.actionDescription}>
                Find rides to/from airports
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isDriver && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/rides/create")}
          >
            <Text style={styles.actionIcon}>➕</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Create Ride</Text>
              <Text style={styles.actionDescription}>
                Offer a ride to passengers
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isDriver && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/rides/my-rides")}
          >
            <Text style={styles.actionIcon}>🚗</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>My Rides</Text>
              <Text style={styles.actionDescription}>Manage your rides</Text>
            </View>
          </TouchableOpacity>
        )}

        {isPassenger && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("../bookings/index")}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>My Bookings</Text>
              <Text style={styles.actionDescription}>View your bookings</Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("../profile/indexes")}
        >
          <Text style={styles.actionIcon}>👤</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Profile</Text>
            <Text style={styles.actionDescription}>Manage your account</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isDriver && upcomingRides.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Upcoming Rides</Text>
          {upcomingRides.slice(0, 3).map((ride) => (
            <TouchableOpacity
              key={ride.id}
              style={styles.rideCard}
              onPress={() => router.push(`/rides/${ride.id}`)}
            >
              <Text style={styles.rideRoute}>
                {ride.home_city} {ride.direction === "to_airport" ? "→" : "←"}{" "}
                {ride.airport?.code}
              </Text>
              <Text style={styles.rideDate}>
                {format(new Date(ride.departure_datetime), "MMM d, yyyy HH:mm")}
              </Text>
              <Text style={styles.rideSeats}>
                {ride.available_seats}/{ride.total_seats} seats available
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isPassenger && activeBookings.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Your Bookings</Text>
          {activeBookings.slice(0, 3).map((booking) => (
            <TouchableOpacity
              key={booking.id}
              style={styles.bookingCard}
              onPress={() => router.push(`/rides/${booking.ride_id}`)}
            >
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingRoute}>
                  {booking.ride?.home_city}{" "}
                  {booking.ride?.direction === "to_airport" ? "→" : "←"}{" "}
                  {booking.ride?.airport?.code}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    booking.status === "accepted"
                      ? styles.statusAccepted
                      : styles.statusPending,
                  ]}
                >
                  <Text style={styles.statusText}>{booking.status}</Text>
                </View>
              </View>
              <Text style={styles.bookingDate}>
                {booking.ride &&
                  format(
                    new Date(booking.ride.departure_datetime),
                    "MMM d, yyyy HH:mm"
                  )}
              </Text>
              <Text style={styles.bookingSeats}>
                {booking.seats} seat{booking.seats > 1 ? "s" : ""} • $
                {booking.total_price}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
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
    backgroundColor: "#f9fafb",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  greeting: {
    fontSize: 14,
    color: "#6b7280",
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1f2937",
    marginTop: 4,
  },
  logoutButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  logoutText: {
    color: "#dc2626",
    fontWeight: "600",
  },
  statsContainer: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#2563eb",
  },
  statLabel: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    textAlign: "center",
  },
  actionsContainer: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 14,
    color: "#6b7280",
  },
  recentSection: {
    padding: 16,
    paddingTop: 0,
  },
  rideCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  rideDate: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  rideSeats: {
    fontSize: 14,
    color: "#2563eb",
  },
  bookingCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  bookingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  bookingRoute: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusAccepted: {
    backgroundColor: "#d1fae5",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1f2937",
    textTransform: "capitalize",
  },
  bookingDate: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  bookingSeats: {
    fontSize: 14,
    color: "#2563eb",
  },
});
