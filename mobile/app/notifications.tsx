import { Ionicons } from "@expo/vector-icons";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import notificationStore from "../src/store/notificationStore";
import RatingModal from "../src/components/RatingModal";

const NotificationScreen = observer(() => {
  const router = useRouter();
  
  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingData, setRatingData] = useState<{
    bookingId: string;
    rideId: string;
    toUserId: string;
    toUserName: string;
    type: "driver_to_passenger" | "passenger_to_driver";
  } | null>(null);

  useEffect(() => {
    notificationStore.fetchNotifications();
  }, []);

  const handlePress = (item: any) => {
    notificationStore.markAsRead(item._id);
    
    // Navigation logic based on type
    if (item.type === "booking_request") {
      // Driver received a request -> Go to Ride Details
      if (item.payload?.ride_id) {
        router.push({ 
          pathname: "/(tabs)/rides/[id]", 
          params: { id: item.payload.ride_id } 
        });
      }
    } else if (item.type === "booking_accepted" || item.type === "booking_rejected") {
      // Passenger's booking was accepted/rejected -> Go to My Bookings
      router.push("/(tabs)/bookings");
    } else if (item.type === "booking_cancelled") {
      // Could be driver (passenger cancelled) or passenger (driver cancelled? no that's ride_cancelled)
      // Usually "booking_cancelled" notification is sent to driver when passenger cancels
      if (item.payload?.ride_id) {
        router.push({ 
          pathname: "/(tabs)/rides/[id]", 
          params: { id: item.payload.ride_id } 
        });
      }
    } else if (item.type === "ride_cancelled") {
      // Passenger notified that ride is cancelled -> Go to Bookings/Trips
      router.push("/(tabs)/bookings");
    } else if (item.type === "chat_message") {
      // Open chat for this booking
      if (item.payload?.booking_id) {
        router.push({ 
          pathname: "/chat", 
          params: { bookingId: item.payload.booking_id } 
        });
      }
    } else if (item.type === "rate_driver") {
      // Passenger should rate driver -> Open rating modal
      setRatingData({
        bookingId: item.payload?.booking_id,
        rideId: item.payload?.ride_id,
        toUserId: item.payload?.driver_id,
        toUserName: item.payload?.driver_name || "Driver",
        type: "passenger_to_driver",
      });
      setRatingModalVisible(true);
    } else if (item.type === "rate_passenger") {
      // Driver should rate passenger -> Open rating modal
      setRatingData({
        bookingId: item.payload?.booking_id,
        rideId: item.payload?.ride_id,
        toUserId: item.payload?.passenger_id,
        toUserName: item.payload?.passenger_name || "Passenger",
        type: "driver_to_passenger",
      });
      setRatingModalVisible(true);
    }
  };

  const handleRatingSuccess = () => {
    setRatingModalVisible(false);
    setRatingData(null);
    // Refresh notifications
    notificationStore.fetchNotifications();
  };

  const renderItem = ({ item }: any) => {
    const isBookingRequest = item.type === "booking_request";
    const isChatMessage = item.type === "chat_message";
    const isRatingNotification = item.type === "rate_driver" || item.type === "rate_passenger";
    const pickup = item.payload?.pickup_location?.address;
    const dropoff = item.payload?.dropoff_location?.address;
    
    // Helper to shorten address
    const shortAddress = (addr: string) => addr ? addr.split(',')[0].trim() : '';

    // Get icon and color based on notification type
    const getIconConfig = () => {
      switch (item.type) {
        case "booking_accepted":
          return { name: "checkmark-circle" as const, color: "#3B82F6" };
        case "booking_request":
          return { name: "car-sport" as const, color: "#F59E0B" };
        case "chat_message":
          return { name: "chatbubble-ellipses" as const, color: "#6366F1" };
        case "booking_rejected":
          return { name: "close-circle" as const, color: "#EF4444" };
        case "booking_cancelled":
        case "ride_cancelled":
          return { name: "alert-circle" as const, color: "#EF4444" };
        case "rate_driver":
        case "rate_passenger":
          return { name: "star" as const, color: "#F59E0B" };
        default:
          return { name: "notifications" as const, color: "#64748B" };
      }
    };

    const iconConfig = getIconConfig();

    // Get title based on notification type
    const getTitle = () => {
      switch (item.type) {
        case "booking_request":
          return "New Booking Request";
        case "booking_accepted":
          return "Booking Confirmed";
        case "booking_rejected":
          return "Booking Rejected";
        case "booking_cancelled":
          return "Booking Cancelled";
        case "ride_cancelled":
          return "Ride Cancelled";
        case "chat_message":
          return `New message from ${item.payload?.sender_name || 'User'}`;
        case "rate_driver":
          return "Rate your driver";
        case "rate_passenger":
          return "Rate your passenger";
        default:
          return item.type.replace(/_/g, ' ').toUpperCase();
      }
    };

    // Get subtitle for rating notifications
    const getSubtitle = () => {
      if (item.type === "rate_driver") {
        return `How was your trip with ${item.payload?.driver_name || ''}?`;
      }
      if (item.type === "rate_passenger") {
        return `How was ${item.payload?.passenger_name || ''} as a passenger?`;
      }
      if (isBookingRequest && item.payload?.passenger_name) {
        return `${item.payload.passenger_name} requests ${item.payload.seats || 1} seat(s)`;
      }
      if (item.type === "booking_accepted" && item.payload?.driver_name) {
        return `Driven by ${item.payload.driver_name}`;
      }
      if (isChatMessage && item.payload?.content) {
        return item.payload.content;
      }
      return "";
    };

    return (
    <TouchableOpacity
      style={[styles.item, item.is_read && styles.read]}
      onPress={() => handlePress(item)}
    >
      <Ionicons
        name={iconConfig.name}
        size={24}
        color={iconConfig.color}
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{getTitle()}</Text>
        <Text style={styles.subtitle}>{getSubtitle()}</Text>
        
        {isBookingRequest && (pickup || dropoff) && (
          <View style={{ marginTop: 4 }}>
             {pickup && (
               <Text style={styles.routeDetail} numberOfLines={1}>
                 <Text style={{ fontWeight: '600' }}>From: </Text>{shortAddress(pickup)}
               </Text>
             )}
             {dropoff && (
               <Text style={styles.routeDetail} numberOfLines={1}>
                 <Text style={{ fontWeight: '600' }}>To: </Text>{shortAddress(dropoff)}
               </Text>
             )}
          </View>
        )}
        
        {isRatingNotification && (
          <Text style={styles.ratingPrompt}>
            Tap to leave a rating
          </Text>
        )}

        <Text style={styles.time}>
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
      {!item.is_read && <View style={styles.dot} />}
    </TouchableOpacity>
  )};

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notificationStore.notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshing={notificationStore.loading}
        onRefresh={() => notificationStore.fetchNotifications()}
        ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
      />
      
      {/* Rating Modal */}
      {ratingData && (
        <RatingModal
          visible={ratingModalVisible}
          onClose={() => {
            setRatingModalVisible(false);
            setRatingData(null);
          }}
          bookingId={ratingData.bookingId}
          rideId={ratingData.rideId}
          toUserId={ratingData.toUserId}
          toUserName={ratingData.toUserName}
          type={ratingData.type}
          onSuccess={handleRatingSuccess}
        />
      )}
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16, marginTop: 8 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    backgroundColor: "#fff",
  },
  read: { opacity: 0.6, backgroundColor: "#fafafa" },
  title: { fontSize: 15, fontWeight: "600", color: "#333" },
  subtitle: { fontSize: 13, color: "#666", marginTop: 2 },
  time: { fontSize: 11, color: "#999", marginTop: 4 },
  routeDetail: { fontSize: 12, color: "#475569", marginTop: 1 },
  empty: { textAlign: "center", color: "#aaa", marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", marginLeft: 8 },
  ratingPrompt: { fontSize: 12, color: "#F59E0B", marginTop: 4, fontStyle: "italic" },
});

export default NotificationScreen;
