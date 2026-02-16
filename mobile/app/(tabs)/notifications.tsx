import { Ionicons } from "@expo/vector-icons";
import { observer } from "mobx-react-lite";
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import notificationStore from "../../src/store/notificationStore";
import { useAuthStore } from "../../src/store/authStore";

type NotifConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  title: string;
  subtitle: string;
};

const getNotifConfig = (item: any): NotifConfig => {
  const p = item.payload || {};
  switch (item.type) {
    // --- Chat ---
    case "chat_message": {
      const isDriver = p.sender_role === "driver";
      return {
        icon: "chatbubble-ellipses",
        color: isDriver ? "#2563EB" : "#7C3AED",
        bgColor: isDriver ? "#DBEAFE" : "#EDE9FE",
        title: `Message from ${p.sender_name || "User"}`,
        subtitle:
          p.message_type === "image"
            ? "📷 Sent a photo"
            : p.content || "New message",
      };
    }
    // --- Booking ---
    case "booking_request":
      return {
        icon: "person-add",
        color: "#2563EB",
        bgColor: "#DBEAFE",
        title: "New Booking Request",
        subtitle: p.passenger_name
          ? `${p.passenger_name} wants to join your ride`
          : "A passenger requested to join your ride",
      };
    case "booking_accepted":
      return {
        icon: "checkmark-circle",
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Booking Accepted",
        subtitle: p.driver_name
          ? `${p.driver_name} accepted your booking`
          : "Your booking has been accepted",
      };
    case "booking_rejected":
      return {
        icon: "close-circle",
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Booking Rejected",
        subtitle: "Your booking request was not accepted",
      };
    case "booking_cancelled":
      return {
        icon: "alert-circle",
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Booking Cancelled",
        subtitle: p.passenger_name
          ? `${p.passenger_name} cancelled their booking`
          : "A booking was cancelled",
      };
    // --- Ride ---
    case "ride_cancelled":
      return {
        icon: "car-outline",
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Ride Cancelled",
        subtitle: "The driver has cancelled this ride",
      };
    // --- Request / Offer ---
    case "request_accepted":
      return {
        icon: "checkmark-done-circle",
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Request Accepted",
        subtitle: p.driver_name
          ? `${p.driver_name} accepted your ride request`
          : "Your ride request has been accepted",
      };
    case "offer_accepted":
      return {
        icon: "thumbs-up",
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Offer Accepted",
        subtitle: p.passenger_name
          ? `${p.passenger_name} accepted your offer`
          : "Your offer has been accepted",
      };
    case "offer_rejected":
      return {
        icon: "thumbs-down",
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Offer Not Accepted",
        subtitle: p.passenger_name
          ? `${p.passenger_name} chose another offer`
          : "Your offer was not accepted",
      };
    case "offer_received":
      return {
        icon: "hand-right",
        color: "#6366F1",
        bgColor: "#EEF2FF",
        title: "New Offer Received",
        subtitle: p.driver_name
          ? `${p.driver_name} sent you an offer${p.price_per_seat ? ` · €${p.price_per_seat}/seat` : ""}`
          : "A driver sent you an offer",
      };
    // --- Rating ---
    case "rate_driver":
      return {
        icon: "star",
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Rate Your Driver",
        subtitle: `How was your trip with ${p.driver_name || "the driver"}?`,
      };
    case "rate_passenger":
      return {
        icon: "star",
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Rate Your Passenger",
        subtitle: `How was ${p.passenger_name || "the passenger"}?`,
      };
    default:
      return {
        icon: "notifications",
        color: "#64748B",
        bgColor: "#F1F5F9",
        title: item.type.replace(/_/g, " "),
        subtitle: "",
      };
  }
};

const formatTime = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const SUPPORTED_TYPES = [
  "booking_request",
  "booking_cancelled",
  "ride_cancelled",
  "request_accepted",
  "offer_accepted",
  "offer_rejected",
  "offer_received",
  "chat_message",
  "rate_driver",
  "rate_passenger",
];

const NotificationsScreen = observer(() => {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      notificationStore.fetchNotifications();
    }
  }, [isAuthenticated]);

  // All notifications unified, sorted newest first
  const allNotifications = [...notificationStore.notifications]
    .filter((n) => SUPPORTED_TYPES.includes(n.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handlePress = (item: any) => {
    notificationStore.markAsRead(item._id);
    const p = item.payload || {};

    switch (item.type) {
      case "chat_message":
        if (p.booking_id) {
          router.push({ pathname: "/chat", params: { bookingId: p.booking_id } });
        }
        break;
      case "booking_request":
        if (p.ride_id) {
          router.push({ pathname: "/ride-details/[id]", params: { id: p.ride_id } });
        }
        break;
      case "booking_cancelled":
        if (p.ride_id) {
          router.push({ pathname: "/ride-details/[id]", params: { id: p.ride_id } });
        }
        break;
      case "ride_cancelled":
        if (p.ride_id) {
          router.push({ pathname: "/ride-details/[id]", params: { id: p.ride_id } });
        }
        break;
      case "request_accepted":
        if (p.request_id) {
          router.push({ pathname: "/request-details/[id]", params: { id: p.request_id } });
        }
        break;
      case "offer_accepted":
      case "offer_rejected":
        if (p.request_id) {
          router.push({ pathname: "/request-details/[id]", params: { id: p.request_id } });
        }
        break;
      case "offer_received":
        if (p.request_id) {
          router.push({ pathname: "/request-details/[id]", params: { id: p.request_id } });
        } else {
          router.push("/(tabs)/explore");
        }
        break;
      case "rate_driver":
      case "rate_passenger":
        if (p.ride_id) {
          router.push({ pathname: "/ride-details/[id]", params: { id: p.ride_id } });
        }
        break;
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const config = getNotifConfig(item);
    const isRead = item.is_read;

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[
          styles.card,
          { borderLeftColor: config.color },
          isRead && styles.cardRead,
        ]}
        onPress={() => handlePress(item)}
      >
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isRead ? "#E2E8F0" : config.bgColor },
          ]}
        >
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>

        <View style={styles.content}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isRead && styles.titleRead]} numberOfLines={1}>
              {config.title}
            </Text>
            <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={[styles.subtitle, isRead && styles.subtitleRead]} numberOfLines={2}>
            {config.subtitle}
          </Text>
        </View>

        {!isRead && <View style={[styles.unreadDot, { backgroundColor: config.color }]} />}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Notifications</Text>

      {allNotifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="notifications-off-outline" size={64} color="#CBD5E1" />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={allNotifications}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          refreshing={notificationStore.loading}
          onRefresh={() => notificationStore.fetchNotifications()}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1E293B",
    marginTop: 60,
    marginBottom: 20,
  },
  listContent: {
    paddingBottom: 30,
  },
  // Unified card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  cardRead: {
    backgroundColor: "#F1F5F9",
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
    marginRight: 8,
  },
  titleRead: {
    color: "#64748B",
  },
  time: {
    fontSize: 12,
    color: "#94A3B8",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
  },
  subtitleRead: {
    color: "#94A3B8",
  },
  unreadDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginLeft: 8,
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