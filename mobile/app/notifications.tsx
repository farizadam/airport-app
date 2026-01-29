import { Ionicons } from "@expo/vector-icons";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import notificationStore from "../src/store/notificationStore";

const NotificationScreen = observer(() => {
  const router = useRouter();

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
    }
  };

  const renderItem = ({ item }: any) => {
    const isBookingRequest = item.type === "booking_request";
    const pickup = item.payload?.pickup_location?.address;
    const dropoff = item.payload?.dropoff_location?.address;
    
    // Helper to shorten address
    const shortAddress = (addr: string) => addr ? addr.split(',')[0].trim() : '';

    return (
    <TouchableOpacity
      style={[styles.item, item.is_read && styles.read]}
      onPress={() => handlePress(item)}
    >
      <Ionicons
        name={
          item.type === "booking_accepted"
            ? "checkmark-circle"
            : isBookingRequest
            ? "car-sport"
            : "alert-circle"
        }
        size={24}
        color={
          item.type === "booking_accepted"
            ? "#3B82F6"
            : isBookingRequest
            ? "#F59E0B"
            : "#EF4444"
        }
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.payload?.message || item.type.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.subtitle}>
          {isBookingRequest && item.payload?.passenger_name 
            ? `${item.payload.passenger_name} requests ${item.payload.seats || 1} seat(s)`
            : item.type === "booking_accepted" && item.payload?.driver_name
            ? `Driven by ${item.payload.driver_name}`
            : ""}
        </Text>
        
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

        <Text style={styles.time}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
      {!item.is_read && <View style={styles.dot} />}
    </TouchableOpacity>
  )};

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>
      <FlatList
        data={notificationStore.notifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshing={notificationStore.loading}
        onRefresh={() => notificationStore.fetchNotifications()}
        ListEmptyComponent={<Text style={styles.empty}>No notifications</Text>}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", padding: 16 },
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16, marginTop: 40 },
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
});

export default NotificationScreen;
