import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRequestStore } from "../../src/store/requestStore";

const STATUS_COLORS: Record<string, string> = {
  pending: "#ffc107",
  matched: "#17a2b8",
  accepted: "#28a745",
  cancelled: "#dc3545",
  expired: "#6c757d",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for offers",
  matched: "Has offers",
  accepted: "Accepted",
  cancelled: "Cancelled",
  expired: "Expired",
};

export default function MyRequestsScreen() {
  const router = useRouter();
  const { requests, getMyRequests, loading } = useRequestStore();
  const [filter, setFilter] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadRequests();
  }, [filter]);

  const loadRequests = async () => {
    await getMyRequests(filter || undefined);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " at " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const renderRequest = ({ item }: any) => {
    const hasOffers = item.offers && item.offers.length > 0;
    const status =
      hasOffers && item.status === "pending" ? "matched" : item.status;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/requests/${item._id}`)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.airportBadge}>
            <Text style={styles.airportCode}>{item.airport?.code}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: STATUS_COLORS[status] },
            ]}
          >
            <Text style={styles.statusText}>{STATUS_LABELS[status]}</Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <Ionicons
            name={item.direction === "to_airport" ? "airplane" : "home"}
            size={16}
            color="#666"
          />
          <Text style={styles.routeText}>
            {item.direction === "to_airport"
              ? `${item.location_city || item.location_address} → ${
                  item.airport?.code
                }`
              : `${item.airport?.code} → ${
                  item.location_city || item.location_address
                }`}
          </Text>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color="#666" />
            <Text style={styles.detailText}>
              {formatDateTime(item.preferred_datetime)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="people-outline" size={14} color="#666" />
            <Text style={styles.detailText}>{item.seats_needed} seat(s)</Text>
          </View>
        </View>

        {hasOffers && (
          <View style={styles.offersRow}>
            <Ionicons name="hand-left" size={16} color="#17a2b8" />
            <Text style={styles.offersText}>
              {item.offers.length} offer{item.offers.length > 1 ? "s" : ""} from
              drivers
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#17a2b8" />
          </View>
        )}

        {item.max_price_per_seat && (
          <Text style={styles.priceText}>
            Max: {item.max_price_per_seat} MAD/seat
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>My Ride Requests</Text>
        <TouchableOpacity
          onPress={() => router.push("/requests/create")}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {[
          { label: "All", value: "" },
          { label: "Pending", value: "pending" },
          { label: "Accepted", value: "accepted" },
          { label: "Cancelled", value: "cancelled" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[
              styles.filterTab,
              filter === tab.value && styles.filterTabActive,
            ]}
            onPress={() => setFilter(tab.value)}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.value && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && requests.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No requests yet</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push("/requests/create")}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.createButtonText}>Create a Request</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item._id}
          renderItem={renderRequest}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
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
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  addButton: {
    padding: 8,
  },
  filterRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  filterTabActive: {
    backgroundColor: "#007AFF",
  },
  filterTabText: {
    fontSize: 13,
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  airportBadge: {
    backgroundColor: "#e8f4ff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  airportCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#fff",
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  routeText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "500",
  },
  detailsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: "#666",
  },
  offersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#e8f7fa",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  offersText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#17a2b8",
  },
  priceText: {
    fontSize: 13,
    color: "#28a745",
    fontWeight: "500",
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 16,
    marginBottom: 24,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
