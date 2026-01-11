import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { useRideStore } from "@/store/rideStore";
import { useRouter } from "expo-router";

export default function MyRidesScreen() {
  const router = useRouter();
  const { myRides, getMyRides, isLoading } = useRideStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadRides();
  }, []);

  const loadRides = async () => {
    try {
      await getMyRides();
    } catch (error) {
      console.error("Error loading rides:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRides();
    setIsRefreshing(false);
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Rides</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Text style={styles.refreshButton}>↻ Refresh</Text>
        </TouchableOpacity>
      </View>

      {myRides && myRides.length > 0 ? (
        myRides.map((ride) => {
          const rideId =
            typeof ride.id === "string" ? ride.id : String(ride.id || ride._id);
          return (
            <TouchableOpacity
              key={rideId}
              style={styles.rideCard}
              onPress={() => router.push(`/rides/${rideId}`)}
            >
              <Text style={styles.rideRoute}>
                {ride.home_city} {ride.direction === "to_airport" ? "→" : "←"}{" "}
                {ride.airport_code || ride.airport?.code}
              </Text>
              <Text style={styles.ridePrice}>${ride.price_per_seat}/seat</Text>
              <Text style={styles.rideDate}>
                {ride.departure_datetime
                  ? new Date(ride.departure_datetime).toLocaleString()
                  : ride.datetime_start
                  ? new Date(ride.datetime_start).toLocaleString()
                  : "N/A"}
              </Text>
              <Text style={styles.rideSeats}>
                {ride.seats_left || ride.available_seats}/
                {ride.seats_total || ride.total_seats} seats available
              </Text>
              {(ride.pending_count || ride.accepted_count) && (
                <Text style={styles.bookingSummary}>
                  Requests: {ride.pending_count || 0} pending /{" "}
                  {ride.accepted_count || 0} accepted
                </Text>
              )}
              {ride.bookings && ride.bookings.length > 0 && (
                <View style={styles.bookingList}>
                  {ride.bookings.slice(0, 2).map((b) => (
                    <Text key={b.id} style={styles.bookingItem}>
                      {b.passenger_first_name || "Passenger"}{" "}
                      {b.passenger_last_name || ""} · {b.seats} seat(s) ·{" "}
                      {b.status}
                    </Text>
                  ))}
                  {ride.bookings.length > 2 && (
                    <Text style={styles.bookingMore}>
                      +{ride.bookings.length - 2} more
                    </Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.noRides}>No rides yet</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  refreshButton: {
    fontSize: 16,
    color: "#007AFF",
  },
  rideCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
  },
  rideRoute: {
    fontSize: 16,
    fontWeight: "600",
  },
  ridePrice: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  rideDate: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  rideSeats: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4,
  },
  bookingSummary: {
    fontSize: 12,
    color: "#444",
    marginTop: 6,
  },
  bookingList: {
    marginTop: 6,
  },
  bookingItem: {
    fontSize: 12,
    color: "#555",
  },
  bookingMore: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  noRides: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
});
