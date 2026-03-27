import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import TabHeader from "@/components/TabHeader";
import { useAuthStore } from "../../src/store/authStore";
import notificationStore from "../../src/store/notificationStore";

type NotificationItem = {
  _id: string;
  type: string;
  createdAt: string;
  is_read?: boolean;
  payload?: Record<string, any>;
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

const getNotifConfig = (item: NotificationItem) => {
  const p = item.payload || {};

  switch (item.type) {
    case "chat_message":
      return {
        icon: "chatbubble-ellipses-outline" as const,
        color: "#6366F1",
        bgColor: "#EEF2FF",
        title: p.sender_name ? `Message from ${p.sender_name}` : "New message",
        subtitle:
          p.file_type && typeof p.file_type === "string" && p.file_type.startsWith("image/")
            ? "📷 Sent a photo"
            : p.content || "New message",
      };
    case "booking_request":
      return {
        icon: "person-add-outline" as const,
        color: "#2563EB",
        bgColor: "#DBEAFE",
        title: "New Booking Request",
        subtitle: p.passenger_name
          ? `${p.passenger_name} wants to join your ride`
          : "A passenger requested to join your ride",
      };
    case "booking_accepted":
      return {
        icon: "checkmark-circle-outline" as const,
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Booking Accepted",
        subtitle: p.driver_name
          ? `${p.driver_name} accepted your booking`
          : "Your booking has been accepted",
      };
    case "booking_rejected":
      return {
        icon: "close-circle-outline" as const,
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Booking Rejected",
        subtitle: "Your booking request was not accepted",
      };
    case "booking_cancelled":
      return {
        icon: "alert-circle-outline" as const,
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Booking Cancelled",
        subtitle: p.passenger_name
          ? `${p.passenger_name} cancelled their booking`
          : "A booking was cancelled",
      };
    case "ride_cancelled":
      return {
        icon: "car-outline" as const,
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Ride Cancelled",
        subtitle: "The driver has cancelled this ride",
      };
    case "request_accepted":
      return {
        icon: "checkmark-done-circle-outline" as const,
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Request Accepted",
        subtitle: p.driver_name
          ? `${p.driver_name} accepted your ride request`
          : "Your ride request has been accepted",
      };
    case "offer_accepted":
      return {
        icon: "thumbs-up-outline" as const,
        color: "#10B981",
        bgColor: "#D1FAE5",
        title: "Offer Accepted",
        subtitle: p.passenger_name
          ? `${p.passenger_name} accepted your offer`
          : "Your offer has been accepted",
      };
    case "offer_rejected":
      return {
        icon: "thumbs-down-outline" as const,
        color: "#EF4444",
        bgColor: "#FEE2E2",
        title: "Offer Not Accepted",
        subtitle: p.passenger_name
          ? `${p.passenger_name} chose another offer`
          : "Your offer was not accepted",
      };
    case "offer_received":
      return {
        icon: "hand-right-outline" as const,
        color: "#6366F1",
        bgColor: "#EEF2FF",
        title: "New Offer Received",
        subtitle: p.driver_name
          ? `${p.driver_name} sent you an offer${p.price_per_seat ? ` · €${p.price_per_seat}/seat` : ""}`
          : "A driver sent you an offer",
      };
    case "rate_driver":
      return {
        icon: "star-outline" as const,
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Rate Your Driver",
        subtitle: `How was your trip with ${p.driver_name || "the driver"}?`,
      };
    case "rate_passenger":
      return {
        icon: "star-outline" as const,
        color: "#F59E0B",
        bgColor: "#FEF3C7",
        title: "Rate Your Passenger",
        subtitle: `How was ${p.passenger_name || "the passenger"}?`,
      };
    default:
      return {
        icon: "notifications-outline" as const,
        color: "#64748B",
        bgColor: "#F1F5F9",
        title: item.type.replace(/_/g, " "),
        subtitle: "",
      };
  }
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (isAuthenticated) {
      notificationStore.fetchNotifications();
    }
  }, [isAuthenticated]);

  const allNotifications = [...notificationStore.notifications]
    .filter((n) => SUPPORTED_TYPES.includes(n.type))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const handlePress = (item: NotificationItem) => {
    notificationStore.markAsRead(item._id);
    const p = item.payload || {};

    switch (item.type) {
      case "chat_message":
        if (p.booking_id) {
          router.push({ pathname: "/chat", params: { bookingId: p.booking_id } });
        } else if (p.request_id) {
          router.push({ pathname: "/chat", params: { requestId: p.request_id } });
        } else {
          router.push("/(tabs)/explore");
        }
        break;
      case "booking_request":
      case "booking_cancelled":
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

  const renderItem = ({ item }: { item: NotificationItem }) => {
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
      <TabHeader title="Notifications" />
      <FlatList
        data={allNotifications}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 + insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="notifications-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No notifications yet</Text>
            <Text style={styles.emptyStateSubtext}>We'll let you know when something happens</Text>
          </View>
        }
        style={{ paddingTop: 12 }}
        refreshing={notificationStore.loading}
        onRefresh={() => notificationStore.fetchNotifications()}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
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
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#475569",
  },
  emptyStateSubtext: {
    fontSize: 13,
    color: "#94A3B8",
  },
});

export default NotificationsScreen;
