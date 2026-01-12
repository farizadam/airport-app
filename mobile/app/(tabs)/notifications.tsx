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
import notificationStore from "../../src/store/notificationStore";

const NotificationsScreen = observer(() => {
  useEffect(() => {
    notificationStore.fetchNotifications();
  }, []);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity
      style={[styles.item, item.is_read && styles.read]}
      onPress={() => notificationStore.markAsRead(item._id)}
    >
      <Ionicons
        name={
          item.type === "request_accepted"
            ? "checkmark-circle"
            : item.type === "offer_accepted"
            ? "car"
            : "close-circle"
        }
        size={24}
        color={
          item.type === "request_accepted"
            ? "green"
            : item.type === "offer_accepted"
            ? "blue"
            : "red"
        }
        style={{ marginRight: 12 }}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{item.payload?.message || item.type}</Text>
        <Text style={styles.time}>
          {new Date(item.createdAt).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

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
  header: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    backgroundColor: "#f9f9f9",
  },
  read: { opacity: 0.5 },
  title: { fontSize: 16, fontWeight: "500" },
  time: { fontSize: 12, color: "#888" },
  empty: { textAlign: "center", color: "#aaa", marginTop: 40 },
});

export default NotificationsScreen;
