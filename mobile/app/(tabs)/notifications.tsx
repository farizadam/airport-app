import { Ionicons } from "@expo/vector-icons";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import notificationStore from "../../src/store/notificationStore";
import { TripCard, TripItem } from "@/components/TripCard";
import api from "../../src/lib/api";
import { useAuthStore } from "../../src/store/authStore";

const NotificationsScreen = observer(() => {
  const [detailsMap, setDetailsMap] = useState<Record<string, TripItem>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      notificationStore.fetchNotifications();
    }
  }, [isAuthenticated]);

  const filteredNotifications = notificationStore.notifications.filter((item) =>
    [
      "booking_request",
      "booking_accepted",
      "request_accepted",
      "offer_accepted",
    ].includes(item.type)
  );

  const fetchDetails = async () => {
    if (filteredNotifications.length === 0) return;

    setLoadingDetails(true);
    const newDetails: Record<string, TripItem> = {};

    // We process notifications in parallel, but handle errors gracefully
    await Promise.all(
      filteredNotifications.map(async (n) => {
        // If we already have details for this notification, skip
        if (detailsMap[n._id]) return;

        try {
          if (n.type === "booking_request" && n.payload?.ride_id) {
            // Driver receiving request: Needs Ride + Booking (Passenger) info
            // 1. Fetch Ride
            const rideRes = await api.get(`/rides/${n.payload.ride_id}`);
            const ride = rideRes.data.data;
            
            // 2. Fetch Bookings to find the specific one
            const bookingsRes = await api.get(`/rides/${n.payload.ride_id}/bookings`);
            const booking = bookingsRes.data.data.find((b: any) => 
              b._id === n.payload.booking_id || b.id === n.payload.booking_id
            );

            if (ride && booking) {
              
              // Determine display locations based on booking specifics or ride defaults
              let pickupLoc = ride.direction === 'to_airport' 
                  ? (ride.home_city || "Pick-up")
                  : (ride.airport?.name || "Airport");
              
              let dropoffLoc = ride.direction === 'to_airport'
                  ? (ride.airport?.name || "Airport")
                  : (ride.home_city || "Drop-off");

              // Override with specific booking locations if they exist
              if (booking.pickup_location?.address) {
                pickupLoc = booking.pickup_location.address;
              }
              if (booking.dropoff_location?.address) {
                dropoffLoc = booking.dropoff_location.address;
              }

              newDetails[n._id] = {
                id: n.payload.booking_id,
                rideId: ride._id,
                type: "booking", // Use booking type to reuse logic
                role: "driver",
                status: "booking_request", // Special status
                pickupLocation: pickupLoc,
                dropoffLocation: dropoffLoc,
                direction: ride.direction,
                departureTime: ride.datetime_start || ride.departure_datetime,
                totalSeats: ride.seats_total || ride.total_seats,
                seats_left: ride.seats_left || ride.available_seats,
              };
            }
          } else if (n.type === "booking_accepted") {
            // Passenger: Needs Booking info
            // Fetch my bookings and find the one
            const bookingsRes = await api.get("/me/bookings");
            const booking = bookingsRes.data.data.find((b: any) => 
              b._id === n.payload.booking_id || b.id === n.payload.booking_id
            );

            if (booking) {
              newDetails[n._id] = {
                id: booking._id,
                rideId: booking.ride?._id || booking.ride_id,
                type: "booking",
                role: "passenger",
                status: "accepted",
                departureTime: booking.datetime_start,
                seats: booking.seats,
                driver: {
                  first_name: booking.driver_first_name,
                  last_name: booking.driver_last_name,
                  phone: booking.driver_phone,
                  rating: 0, // Not available in list usually
                },
                pickupLocation: booking.direction === 'to_airport' ? booking.home_city : booking.airport_name,
                dropoffLocation: booking.direction === 'to_airport' ? booking.airport_name : booking.home_city,
                direction: booking.direction,
              };
            }
          } else if (n.type === "request_accepted" && n.payload?.request_id) {
            // Passenger: Needs Request info
            const reqRes = await api.get(`/ride-requests/${n.payload.request_id}`);
            const request = reqRes.data.request;
            
            if (request) {
               newDetails[n._id] = {
                 id: request._id,
                 type: "request",
                 role: "passenger",
                 status: "matched", // or accepted
                 departureTime: request.preferred_datetime,
                 seats: request.seats_needed,
                 pickupLocation: request.direction === 'to_airport' 
                   ? (request.location_city || "Pickup Location") 
                   : (request.airport?.name || "Airport"),
                 dropoffLocation: request.direction === 'to_airport'
                   ? (request.airport?.name || "Airport")
                   : (request.location_city || "Dropoff Location"),
                 direction: request.direction,
                 driver: request.matched_driver ? {
                   first_name: request.matched_driver.first_name,
                   last_name: request.matched_driver.last_name,
                   phone: request.matched_driver.phone,
                 } : undefined
               };
            }
          } else if (n.type === "offer_accepted" && n.payload?.request_id) {
            // Driver: Needs Request info (that I offered on)
            const reqRes = await api.get(`/ride-requests/${n.payload.request_id}`);
            const request = reqRes.data.request;
            
            if (request) {
               newDetails[n._id] = {
                 id: request._id,
                 type: "request", // technically an offer, but we show request
                 role: "driver",
                 status: "matched",
                 departureTime: request.preferred_datetime,
                 seats: request.seats_needed,
                 pickupLocation: request.direction === 'to_airport' 
                   ? (request.location_city || "Pickup Location") 
                   : (request.airport?.name || "Airport"),
                 dropoffLocation: request.direction === 'to_airport'
                   ? (request.airport?.name || "Airport")
                   : (request.location_city || "Dropoff Location"),
                 direction: request.direction,
                 passenger: request.passenger ? {
                   first_name: request.passenger.first_name,
                   last_name: request.passenger.last_name,
                   phone: request.passenger.phone,
                 } : undefined
               };
            }
          }
        } catch (e) {
          console.warn(`Could not load details for notification ${n.type}:${n._id}`, e);
        }
      })
    );
    
    setDetailsMap((prev) => ({ ...prev, ...newDetails }));
    setLoadingDetails(false);
  };

  useEffect(() => {
    fetchDetails();
  }, [filteredNotifications.length]);

  const renderItem = ({ item }: { item: any }) => {
    const details = detailsMap[item._id];

    if (details) {
      return (
        <View style={styles.cardContainer}>
          <Text style={styles.cardLabel}>{item.type.replace('_', ' ').toUpperCase()}</Text>
          <TripCard item={details} />
        </View>
      );
    }

    // Fallback or loading state for this item?
    // If we are loading, show spinner.
    // If failed, maybe don't show anything or show error?
    // Let's show a skeleton or nothing.
    return (
      <View style={styles.loadingItem}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Alerts</Text>
      
      {filteredNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No booking alerts</Text>
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshing={notificationStore.loading || loadingDetails}
          onRefresh={() => {
            notificationStore.fetchNotifications();
            // fetchDetails will trigger via useEffect
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC", paddingHorizontal: 16 },
  header: { 
    fontSize: 28, 
    fontWeight: "800", 
    color: "#1E293B", 
    marginTop: 60, 
    marginBottom: 20 
  },
  listContent: {
    paddingBottom: 20,
  },
  cardContainer: {
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 6,
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  loadingItem: {
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: "#94A3B8",
    marginTop: 16,
    fontWeight: "500",
  },
});

export default NotificationsScreen;