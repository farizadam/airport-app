import { useAuthStore } from "@/store/authStore";
import { useRequestStore } from "@/store/requestStore";
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
  const { myOffers, getMyOffers, requests, getMyRequests } = useRequestStore();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDriver = user?.role === "driver" || user?.role === "both";
  const isPassenger = user?.role === "passenger" || user?.role === "both";

  const loadData = async () => {
    try {
      const promises: Promise<void>[] = [];
      if (isDriver) promises.push(getMyOffers("accepted"));
      if (isPassenger) promises.push(getMyRequests());
      await Promise.all(promises);
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

  // Filter accepted offers (upcoming rides for driver)
  const acceptedOffers = myOffers.filter(
    (offer: any) =>
      offer.status === "accepted" &&
      new Date(offer.preferred_datetime) > new Date()
  );

  // Filter passenger requests
  const acceptedRequests = requests.filter(
    (req: any) =>
      req.status === "accepted" && new Date(req.preferred_datetime) > new Date()
  );

  const pendingRequests = requests.filter(
    (req: any) => req.status === "pending"
  );

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
          <Text style={{ fontSize: 12, color: "#666" }}>
            Role: {user?.role || "none"} | Driver: {isDriver ? "Yes" : "No"} |
            Passenger: {isPassenger ? "Yes" : "No"}
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        {isPassenger && (
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{acceptedRequests.length}</Text>
            <Text style={styles.statLabel}>Confirmed Rides</Text>
          </View>
        )}

        {isDriver && (
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{acceptedOffers.length}</Text>
            <Text style={styles.statLabel}>Confirmed Rides</Text>
          </View>
        )}

        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {isPassenger
              ? pendingRequests.length
              : myOffers.filter((o: any) => o.my_offer?.status === "pending")
                  .length}
          </Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        {isPassenger && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#e8f5e9" }]}
            onPress={() => router.push("/requests/create")}
          >
            <Text style={styles.actionIcon}>📝</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Request a Ride</Text>
              <Text style={styles.actionDescription}>
                Post a request for drivers
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isPassenger && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push("/requests/my-requests")}
          >
            <Text style={styles.actionIcon}>📋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>My Requests</Text>
              <Text style={styles.actionDescription}>
                View your ride requests
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isDriver && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#fff3e0" }]}
            onPress={() => router.push("/requests/available")}
          >
            <Text style={styles.actionIcon}>🙋</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Passenger Requests</Text>
              <Text style={styles.actionDescription}>
                Find passengers looking for rides
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {isDriver && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#e8f5e9" }]}
            onPress={() => router.push("/requests/my-offers")}
          >
            <Text style={styles.actionIcon}>📨</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>My Offers</Text>
              <Text style={styles.actionDescription}>
                Track your sent offers & accepted rides
              </Text>
            </View>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push("/profile/")}
        >
          <Text style={styles.actionIcon}>👤</Text>
          <View style={styles.actionContent}>
            <Text style={styles.actionTitle}>Profile</Text>
            <Text style={styles.actionDescription}>Manage your account</Text>
          </View>
        </TouchableOpacity>
      </View>

      {isDriver && acceptedOffers.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Upcoming Pickups</Text>
          {acceptedOffers.slice(0, 3).map((offer: any) => (
            <TouchableOpacity
              key={offer.id || offer._id}
              style={styles.rideCard}
              onPress={() => router.push(`/requests/${offer.id || offer._id}`)}
            >
              <View style={styles.bookingHeader}>
                <Text style={styles.rideRoute}>
                  {offer.location_city}{" "}
                  {offer.direction === "to_airport" ? "→" : "←"}{" "}
                  {offer.airport?.code}
                </Text>
                <View style={[styles.statusBadge, styles.statusAccepted]}>
                  <Text style={styles.statusText}>Confirmed</Text>
                </View>
              </View>
              <Text style={styles.rideDate}>
                {format(
                  new Date(offer.preferred_datetime),
                  "MMM d, yyyy HH:mm"
                )}
              </Text>
              <Text style={styles.rideSeats}>
                {offer.passenger?.first_name} • {offer.seats_needed} seat(s) •{" "}
                {offer.my_offer?.price_per_seat || "--"} MAD
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isPassenger && acceptedRequests.length > 0 && (
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>Your Upcoming Rides</Text>
          {acceptedRequests.slice(0, 3).map((request: any) => (
            <TouchableOpacity
              key={request.id || request._id}
              style={styles.bookingCard}
              onPress={() =>
                router.push(`/requests/${request.id || request._id}`)
              }
            >
              <View style={styles.bookingHeader}>
                <Text style={styles.bookingRoute}>
                  {request.location_city}{" "}
                  {request.direction === "to_airport" ? "→" : "←"}{" "}
                  {request.airport?.code}
                </Text>
                <View style={[styles.statusBadge, styles.statusAccepted]}>
                  <Text style={styles.statusText}>Confirmed</Text>
                </View>
              </View>
              <Text style={styles.bookingDate}>
                {format(
                  new Date(request.preferred_datetime),
                  "MMM d, yyyy HH:mm"
                )}
              </Text>
              <Text style={styles.bookingSeats}>
                Driver: {request.matched_driver?.first_name || "Assigned"} •{" "}
                {request.seats_needed} seat(s)
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
