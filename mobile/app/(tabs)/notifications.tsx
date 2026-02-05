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
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import notificationStore from "../../src/store/notificationStore";
import { TripCard, TripItem } from "@/components/TripCard";
import api from "../../src/lib/api";
import { useAuthStore } from "../../src/store/authStore";
import { getLocationInfo, TripData } from "@/utils/tripDisplayUtils";

const NotificationsScreen = observer(() => {
  const router = useRouter();
  const [detailsMap, setDetailsMap] = useState<Record<string, TripItem>>({});
  const [chatRideInfoMap, setChatRideInfoMap] = useState<Record<string, { from: string; to: string }>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      notificationStore.fetchNotifications();
    }
  }, [isAuthenticated]);

  // Filter for trip-related notifications (use TripCard)
  const tripNotifications = notificationStore.notifications.filter((item) =>
    [
      "booking_request",
      "booking_accepted",
      "request_accepted",
      "offer_accepted",
    ].includes(item.type)
  );

  // Filter for chat message notifications
  const chatNotifications = notificationStore.notifications.filter((item) =>
    item.type === "chat_message"
  );

  // Combined notifications for display - sorted by time (newest/most recent first)
  const allNotifications = [...notificationStore.notifications]
    .filter((item) =>
      [
        "booking_request",
        "booking_accepted",
        "booking_rejected",
        "booking_cancelled",
        "ride_cancelled",
        "request_accepted",
        "offer_accepted",
        "chat_message",
        "rate_driver",
        "rate_passenger",
      ].includes(item.type)
    )
    .sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // Newest first (descending order)
    });

  const fetchDetails = async () => {
    if (tripNotifications.length === 0) return;

    setLoadingDetails(true);
    const newDetails: Record<string, TripItem> = {};

    // We process notifications in parallel, but handle errors gracefully
    await Promise.all(
      tripNotifications.map(async (n) => {
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
              // Use shared utility for consistent location display
              const locs = getLocationInfo(ride as TripData);

              newDetails[n._id] = {
                id: n.payload.booking_id,
                rideId: ride._id,
                type: "booking", // Use booking type to reuse logic
                role: "driver",
                status: "booking_request", // Special status
                pickupLocation: locs.pickup,
                dropoffLocation: locs.dropoff,
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
              // Use shared utility for consistent location display
              const locs = getLocationInfo(booking as TripData);
              
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
                pickupLocation: locs.pickup,
                dropoffLocation: locs.dropoff,
                direction: booking.direction,
              };
            }
          } else if (n.type === "request_accepted" && n.payload?.request_id) {
            // Passenger: Needs Request info
            const reqRes = await api.get(`/ride-requests/${n.payload.request_id}`);
            const request = reqRes.data.request;
            
            if (request) {
               // Use shared utility for consistent location display
               const locs = getLocationInfo(request as TripData);
               
               newDetails[n._id] = {
                 id: request._id,
                 type: "request",
                 role: "passenger",
                 status: "matched", // or accepted
                 departureTime: request.preferred_datetime,
                 seats: request.seats_needed,
                 pickupLocation: locs.pickup,
                 dropoffLocation: locs.dropoff,
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
               // Use shared utility for consistent location display
               const locs = getLocationInfo(request as TripData);
               
               newDetails[n._id] = {
                 id: request._id,
                 type: "request", // technically an offer, but we show request
                 role: "driver",
                 status: "matched",
                 departureTime: request.preferred_datetime,
                 seats: request.seats_needed,
                 pickupLocation: locs.pickup,
                 dropoffLocation: locs.dropoff,
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

  // Fetch ride info for chat notifications that don't have it in payload
  const fetchChatRideInfo = async () => {
    const chatNotifs = notificationStore.notifications.filter(
      (item) => item.type === "chat_message" && !item.payload?.ride_from && item.payload?.booking_id
    );
    
    if (chatNotifs.length === 0) return;

    const newChatRideInfo: Record<string, { from: string; to: string }> = {};

    await Promise.all(
      chatNotifs.map(async (n) => {
        if (chatRideInfoMap[n._id]) return; // Already fetched
        
        try {
          const res = await api.get(`/chat/${n.payload.booking_id}/info`);
          const ride = res.data.data?.ride;
          if (ride) {
            const isToAirport = ride.direction === "to_airport" || ride.direction === "home_to_airport";
            const from = isToAirport ? ride.home_city : ride.airport_name;
            const to = isToAirport ? ride.airport_name : ride.home_city;
            newChatRideInfo[n._id] = { from: from || "Location", to: to || "Airport" };
          }
        } catch (e) {
          console.warn(`Could not load ride info for chat notification ${n._id}`, e);
        }
      })
    );

    setChatRideInfoMap((prev) => ({ ...prev, ...newChatRideInfo }));
  };

  // Fetch details when notifications change
  useEffect(() => {
    if (tripNotifications.length > 0) {
      fetchDetails();
    }
  }, [notificationStore.notifications]);

  useEffect(() => {
    if (chatNotifications.length > 0) {
      fetchChatRideInfo();
    }
  }, [notificationStore.notifications]);

  // Handle chat message press
  const handleChatPress = (item: any) => {
    notificationStore.markAsRead(item._id);
    if (item.payload?.booking_id) {
      router.push({ 
        pathname: "/chat", 
        params: { bookingId: item.payload.booking_id } 
      });
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    // Handle chat message notifications differently
    if (item.type === "chat_message") {
      // Use payload ride info if available, otherwise use fetched info
      const payloadRideInfo = item.payload?.ride_from && item.payload?.ride_to;
      const fetchedRideInfo = chatRideInfoMap[item._id];
      const rideFrom = item.payload?.ride_from || fetchedRideInfo?.from;
      const rideTo = item.payload?.ride_to || fetchedRideInfo?.to;
      const hasRideInfo = rideFrom && rideTo;
      
      // Determine color based on sender role: passenger = purple, driver = blue
      const isFromDriver = item.payload?.sender_role === "driver";
      const chatColor = isFromDriver ? "#2563EB" : "#7C3AED"; // Brighter blue for driver, Brighter purple for passenger
      const chatBgColor = isFromDriver ? "#DBEAFE" : "#EDE9FE"; // Light blue for driver, Light purple for passenger
      
      return (
        <TouchableOpacity 
          style={[
            styles.chatCard, 
            { borderLeftColor: chatColor },
            item.is_read && { backgroundColor: "#F1F5F9" } // Gray background when read
          ]}
          onPress={() => handleChatPress(item)}
        >
          <View style={[styles.chatIconContainer, { backgroundColor: item.is_read ? "#E2E8F0" : chatBgColor }]}>
            <Ionicons name="chatbubble-ellipses" size={24} color={chatColor} />
          </View>
          <View style={styles.chatContent}>
            <Text style={styles.chatTitle}>
              New message from {item.payload?.sender_name || 'User'}
            </Text>
            {hasRideInfo && (
              <View style={styles.chatRideInfo}>
                <Ionicons name="car-outline" size={12} color="#94A3B8" />
                <Text style={styles.chatRideText} numberOfLines={1}>
                  {rideFrom} → {rideTo}
                </Text>
              </View>
            )}
            <Text style={styles.chatMessage} numberOfLines={2}>
              {item.payload?.message_type === "image" 
                ? "📷 Sent a photo" 
                : item.payload?.content || "New message"}
            </Text>
            <Text style={styles.chatTime}>
              {new Date(item.createdAt).toLocaleString("en-GB", { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })}
            </Text>
          </View>
          {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: chatColor }]} />}
        </TouchableOpacity>
      );
    }

    // Handle other notification types (rejected, cancelled, rate)
    if (["booking_rejected", "booking_cancelled", "ride_cancelled", "rate_driver", "rate_passenger"].includes(item.type)) {
      const getNotifConfig = () => {
        switch (item.type) {
          case "booking_rejected":
            return { 
              icon: "close-circle" as const, 
              color: "#EF4444", 
              bgColor: "#FEE2E2",
              title: "Booking Rejected",
              subtitle: "Your booking request was not accepted"
            };
          case "booking_cancelled":
            return { 
              icon: "alert-circle" as const, 
              color: "#F59E0B", 
              bgColor: "#FEF3C7",
              title: "Booking Cancelled",
              subtitle: item.payload?.passenger_name ? `${item.payload.passenger_name} cancelled their booking` : "A booking was cancelled"
            };
          case "ride_cancelled":
            return { 
              icon: "car-outline" as const, 
              color: "#EF4444", 
              bgColor: "#FEE2E2",
              title: "Ride Cancelled",
              subtitle: "The driver has cancelled this ride"
            };
          case "rate_driver":
            return { 
              icon: "star" as const, 
              color: "#F59E0B", 
              bgColor: "#FEF3C7",
              title: "Rate Your Driver",
              subtitle: `How was your trip with ${item.payload?.driver_name || "the driver"}?`
            };
          case "rate_passenger":
            return { 
              icon: "star" as const, 
              color: "#F59E0B", 
              bgColor: "#FEF3C7",
              title: "Rate Your Passenger",
              subtitle: `How was ${item.payload?.passenger_name || "the passenger"}?`
            };
          default:
            return { 
              icon: "notifications" as const, 
              color: "#64748B", 
              bgColor: "#F1F5F9",
              title: item.type.replace(/_/g, " "),
              subtitle: ""
            };
        }
      };
      
      const config = getNotifConfig();
      
      const handleOtherNotifPress = () => {
        notificationStore.markAsRead(item._id);
        if (item.type === "rate_driver" || item.type === "rate_passenger") {
          // Navigate to the ride details or open rating modal
          if (item.payload?.ride_id) {
            router.push({ pathname: "/ride-details/[id]", params: { id: item.payload.ride_id } });
          }
        } else if (item.type === "booking_rejected" || item.type === "booking_cancelled") {
          router.push("/(tabs)/bookings");
        } else if (item.type === "ride_cancelled") {
          router.push("/(tabs)/bookings");
        }
      };
      
      return (
        <TouchableOpacity 
          style={[
            styles.chatCard, 
            { borderLeftColor: config.color },
            item.is_read && { backgroundColor: "#F1F5F9" }
          ]}
          onPress={handleOtherNotifPress}
        >
          <View style={[styles.chatIconContainer, { backgroundColor: item.is_read ? "#E2E8F0" : config.bgColor }]}>
            <Ionicons name={config.icon} size={24} color={config.color} />
          </View>
          <View style={styles.chatContent}>
            <Text style={styles.chatTitle}>{config.title}</Text>
            <Text style={styles.chatMessage} numberOfLines={2}>{config.subtitle}</Text>
            <Text style={styles.chatTime}>
              {new Date(item.createdAt).toLocaleString("en-GB", { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
              })}
            </Text>
          </View>
          {!item.is_read && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
        </TouchableOpacity>
      );
    }

    // Handle trip-related notifications with TripCard
    const details = detailsMap[item._id];

    if (details) {
      return (
        <View style={styles.cardContainer}>
          <Text style={styles.cardLabel}>{item.type.replace(/_/g, ' ').toUpperCase()}</Text>
          <TripCard item={details} />
        </View>
      );
    }

    // Fallback - show loading spinner while fetching details
    return (
      <View style={styles.loadingItem}>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Alerts</Text>
      
      {allNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No alerts</Text>
        </View>
      ) : (
        <FlatList
          data={allNotifications}
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
  // Chat notification styles
  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#6366F1",
  },
  chatCardRead: {
    backgroundColor: "#F1F5F9",
  },
  chatIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  chatContent: {
    flex: 1,
  },
  chatTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 4,
  },
  chatRideInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    gap: 4,
  },
  chatRideText: {
    fontSize: 12,
    color: "#94A3B8",
    flex: 1,
  },
  chatMessage: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 4,
  },
  chatTime: {
    fontSize: 12,
    color: "#94A3B8",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#6366F1",
    marginLeft: 8,
  },
});

export default NotificationsScreen;