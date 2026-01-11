import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import axios from "axios";
import { useAuthStore } from "@/store/authStore";

export default function RideBookingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const token = useAuthStore((state) => state.token);
  const [bookings, setBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadBookings();
    }
  }, [id]);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(
        `http://192.168.19.105:3000/api/v1/rides/${id}/bookings`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setBookings(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load bookings");
      console.error("Error loading bookings:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Ride Bookings</Text>

      {bookings && bookings.length > 0 ? (
        bookings.map((booking) => (
          <View key={booking.id} style={styles.bookingCard}>
            <Text style={styles.passengerName}>
              {booking.passenger_first_name} {booking.passenger_last_name}
            </Text>
            <Text style={styles.passengerPhone}>{booking.passenger_phone}</Text>
            <Text style={styles.seats}>{booking.seats} seat(s)</Text>
            <Text style={styles.status}>{booking.status}</Text>
          </View>
        ))
      ) : (
        <Text style={styles.noBookings}>No bookings yet</Text>
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
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
  },
  bookingCard: {
    backgroundColor: "white",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
  },
  passengerPhone: {
    fontSize: 14,
    color: "#666",
    marginTop: 4,
  },
  seats: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
  },
  status: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 4,
    textTransform: "capitalize",
  },
  noBookings: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
  errorText: {
    color: "red",
    fontSize: 16,
  },
});
