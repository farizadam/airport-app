import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { useRideStore } from "../../../src/store/rideStore";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function MyRidesScreen() {
  const router = useRouter();
  const { myRides, getMyRides, isLoading } = useRideStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadRides();
    }, [])
  );

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

  if (isLoading && !isRefreshing && !myRides) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const renderRideCard = (ride: any) => {
    const rideId = typeof ride.id === "string" ? ride.id : String(ride.id || ride._id);
    const isToAirport = ride.direction === "to_airport";
    const airportName = ride.airport?.name || ride.airport_code || ride.airport?.iata_code || "Airport";
    const homeLocation = ride.home_city || "City Location";

    return (
      <TouchableOpacity
        key={rideId}
        style={styles.rideCard}
        onPress={() => router.push({ pathname: "/ride-details/[id]", params: { id: rideId } })}
      >
        <View style={styles.routeContainer}>
          {/* Origin / Start */}
          <View style={styles.routeRow}>
            <Ionicons 
              name={isToAirport ? "location" : "airplane"} 
              size={16} 
              color={isToAirport ? "#EF4444" : "#007AFF"} 
              style={{ width: 20 }}
            />
            <Text style={styles.routeText}>
              {isToAirport ? homeLocation : airportName}
            </Text>
          </View>

          {/* Connector */}
          <View style={styles.routeConnector}>
            <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
            <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
          </View>

          {/* Destination / End */}
          <View style={styles.routeRow}>
            <Ionicons 
              name={isToAirport ? "airplane" : "location"} 
              size={16} 
              color={isToAirport ? "#007AFF" : "#EF4444"} 
              style={{ width: 20 }}
            />
            <Text style={styles.routeText}>
              {isToAirport ? airportName : homeLocation}
            </Text>
          </View>
        </View>

        <View style={styles.detailsRow}>
          <Text style={styles.ridePrice}>{ride.price_per_seat} EUR/seat</Text>
          <View style={styles.dateTimeContainer}>
             <Text style={styles.rideDate}>
                {ride.departure_datetime
                  ? new Date(ride.departure_datetime).toLocaleString("en-GB", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
                  : ride.datetime_start
                  ? new Date(ride.datetime_start).toLocaleString("en-GB", { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
                  : "N/A"}
             </Text>
          </View>
        </View>
        
        <Text style={styles.rideSeats}>
          {ride.seats_left || ride.available_seats}/
          {ride.seats_total || ride.total_seats} seats available
        </Text>

        {(ride.luggage_capacity > 0) && (
          <Text style={[styles.rideSeats, { marginTop: 2 }]}>
            {ride.luggage_left ?? ride.luggage_capacity}/{ride.luggage_capacity} luggage space
          </Text>
        )}

        {(ride.pending_count || ride.accepted_count) ? (
            <Text style={styles.bookingSummary}>
              Requests: {ride.pending_count || 0} pending /{" "}
              {ride.accepted_count || 0} accepted
            </Text>
        ) : null}

        {ride.bookings && ride.bookings.length > 0 && (
          <View style={styles.bookingList}>
            {ride.bookings.slice(0, 2).map((b: any) => (
              <Text key={b.id} style={styles.bookingItem}>
                {b.passenger_first_name || "Passenger"}{" "}
                {b.passenger_last_name || ""} · {b.seats} seat(s){b.luggage_count > 0 ? ` · ${b.luggage_count} bag(s)` : ''} ·{" "}
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
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>My Rides</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {myRides && myRides.length > 0 ? (
          myRides.map(renderRideCard)
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.noRides}>No rides yet</Text>
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => router.push("/(tabs)/rides/create")}
            >
              <Text style={styles.createButtonText}>Create a Ride</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
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
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: "#007AFF",
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  rideCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#007AFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  routeContainer: {
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routeConnector: {
    marginLeft: 2, 
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    width: 20,
    marginVertical: 2,
  },
  dottedLine: {
    display: 'none',
  },
  routeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  detailsRow: {
    marginTop: 8,
    marginBottom: 8,
  },
  dateTimeContainer: {
    marginTop: 6,
  },
  ridePrice: {
    fontSize: 16,
    color: "#28a745",
    fontWeight: "700",
  },
  rideDate: {
    fontSize: 14,
    color: "#555",
  },
  rideSeats: {
    fontSize: 13,
    color: "#007AFF",
    marginTop: 8, 
    fontWeight: "500",
  },
  bookingSummary: {
    fontSize: 12,
    color: "#444",
    marginTop: 6,
  },
  bookingList: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  bookingItem: {
    fontSize: 12,
    color: "#555",
    marginBottom: 2,
  },
  bookingMore: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 40,
  },
  noRides: {
    textAlign: "center",
    color: "#999",
    fontSize: 16,
    marginBottom: 16,
  },
  createButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
