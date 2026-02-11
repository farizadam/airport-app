import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import axios from "axios";
import { Ionicons } from "@expo/vector-icons";

export default function RideBookingsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
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
      const token = await SecureStore.getItemAsync("accessToken");
      const response = await axios.get(
        `http://10.20.15.213:3000/api/v1/rides/${id}/bookings`,
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
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ride Bookings</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
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
        <Text style={styles.headerTitle}>Ride Bookings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {bookings && bookings.length > 0 ? (
          bookings.map((booking) => (
            <View key={booking.id} style={styles.bookingCard}>
              <View style={styles.bookingHeader}>
                <Text style={styles.passengerName}>
                  {booking.passenger_first_name} {booking.passenger_last_name}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    booking.status === "accepted"
                      ? styles.statusAccepted
                      : booking.status === "pending"
                      ? styles.statusPending
                      : styles.statusOther,
                  ]}
                >
                  <Text style={styles.statusText}>{booking.status}</Text>
                </View>
              </View>
              {booking.passenger_phone && (
                <TouchableOpacity 
                  style={styles.infoRow}
                  onPress={() => Linking.openURL(`tel:${booking.passenger_phone}`)}
                >
                  <Ionicons name="call-outline" size={16} color="#007AFF" />
                  <Text style={[styles.passengerPhone, { color: '#007AFF' }]}>{booking.passenger_phone}</Text>
                </TouchableOpacity>
              )}
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.seats}>{booking.seats} seat(s)</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.noBookings}>No bookings yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
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
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
    alignItems: "center",
    marginBottom: 12,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusAccepted: {
    backgroundColor: "#d4edda",
  },
  statusPending: {
    backgroundColor: "#fff3cd",
  },
  statusOther: {
    backgroundColor: "#e9ecef",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textTransform: "capitalize",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  passengerPhone: {
    fontSize: 14,
    color: "#666",
  },
  seats: {
    fontSize: 14,
    color: "#666",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  noBookings: {
    textAlign: "center",
    color: "#999",
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: "#dc3545",
    fontSize: 16,
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
