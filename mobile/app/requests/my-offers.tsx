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
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useRequestStore } from "../../src/store/requestStore";

type FilterStatus = "all" | "pending" | "accepted";

export default function MyOffersScreen() {
  const router = useRouter();
  const { myOffers, getMyOffers, loading, error } = useRequestStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    loadOffers();
  }, [activeFilter]);

  const loadOffers = async () => {
    const status = activeFilter === "all" ? undefined : activeFilter;
    console.log("Loading offers with status:", status);
    await getMyOffers(status);
    console.log("Offers loaded:", myOffers?.length, "Error:", error);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOffers();
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

  const getOfferStatusColor = (item: any) => {
    if (item.is_matched) return "#28a745";
    if (item.my_offer?.status === "rejected") return "#dc3545";
    if (item.status === "cancelled" || item.status === "expired")
      return "#6c757d";
    return "#ffc107";
  };

  const getOfferStatusText = (item: any) => {
    if (item.is_matched) return "Accepted";
    if (item.my_offer?.status === "rejected") return "Rejected";
    if (item.status === "cancelled") return "Cancelled";
    if (item.status === "expired") return "Expired";
    return "Pending";
  };

  const renderOffer = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/requests/${item.id || item._id}`)}
    >
      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getOfferStatusColor(item) },
        ]}
      >
        <Text style={styles.statusText}>{getOfferStatusText(item)}</Text>
      </View>

      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.airportBadge}>
          <Text style={styles.airportCode}>{item.airport?.code}</Text>
        </View>
        <View style={styles.directionBadge}>
          <Ionicons
            name={item.direction === "to_airport" ? "airplane" : "car"}
            size={14}
            color="#007AFF"
          />
          <Text style={styles.directionText}>
            {item.direction === "to_airport" ? "To Airport" : "From Airport"}
          </Text>
        </View>
      </View>

      {/* Passenger Info */}
      <View style={styles.passengerRow}>
        <View style={styles.passengerAvatar}>
          <Ionicons name="person" size={16} color="#fff" />
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>
            {item.passenger?.first_name} {item.passenger?.last_name}
          </Text>
          {item.passenger?.rating && (
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={12} color="#ffc107" />
              <Text style={styles.ratingText}>
                {item.passenger.rating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routeRow}>
          <Ionicons name="location" size={16} color="#28a745" />
          <Text style={styles.routeText} numberOfLines={1}>
            {item.location_city}
          </Text>
        </View>
        <Ionicons
          name="arrow-forward"
          size={14}
          color="#999"
          style={styles.arrowIcon}
        />
        <View style={styles.routeRow}>
          <Ionicons name="airplane" size={16} color="#007AFF" />
          <Text style={styles.routeText}>{item.airport?.name}</Text>
        </View>
      </View>

      {/* Details */}
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

      {/* Your Offer */}
      {item.my_offer && (
        <View style={styles.offerBox}>
          <Text style={styles.offerLabel}>Your Offer</Text>
          <Text style={styles.offerPrice}>
            {item.my_offer.price_per_seat} MAD/seat
          </Text>
          {item.my_offer.message && (
            <Text style={styles.offerMessage} numberOfLines={2}>
              "{item.my_offer.message}"
            </Text>
          )}
        </View>
      )}

      {/* Contact Info (if accepted) */}
      {item.is_matched && item.passenger?.phone && (
        <View style={styles.contactBox}>
          <Ionicons name="call" size={16} color="#28a745" />
          <Text style={styles.contactText}>{item.passenger.phone}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {error ? "Error Loading" : "No Offers Yet"}
      </Text>
      <Text style={styles.emptySubtitle}>
        {error
          ? error
          : activeFilter === "all"
          ? "Browse passenger requests and make offers"
          : activeFilter === "pending"
          ? "You have no pending offers"
          : "No accepted offers yet"}
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push("/requests/available")}
      >
        <Text style={styles.browseButtonText}>Browse Requests</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Offers</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(["all", "pending", "accepted"] as FilterStatus[]).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterTab,
              activeFilter === filter && styles.filterTabActive,
            ]}
            onPress={() => setActiveFilter(filter)}
          >
            <Text
              style={[
                styles.filterTabText,
                activeFilter === filter && styles.filterTabTextActive,
              ]}
            >
              {filter === "all"
                ? "All"
                : filter === "pending"
                ? "Pending"
                : "Accepted"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={myOffers}
          renderItem={renderOffer}
          keyExtractor={(item) => item.id || item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={EmptyState}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  filterContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    marginHorizontal: 4,
  },
  filterTabActive: {
    backgroundColor: "#007AFF",
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: "relative",
  },
  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  airportBadge: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  airportCode: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  directionText: {
    fontSize: 12,
    color: "#007AFF",
    marginLeft: 4,
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerInfo: {
    marginLeft: 10,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  routeText: {
    fontSize: 13,
    color: "#333",
    marginLeft: 6,
    flex: 1,
  },
  arrowIcon: {
    marginHorizontal: 8,
  },
  detailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 6,
  },
  offerBox: {
    backgroundColor: "#fff3cd",
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  offerLabel: {
    fontSize: 11,
    color: "#856404",
    fontWeight: "600",
    marginBottom: 4,
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: "700",
    color: "#856404",
  },
  offerMessage: {
    fontSize: 12,
    color: "#856404",
    fontStyle: "italic",
    marginTop: 4,
  },
  contactBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d4edda",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  contactText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#155724",
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 40,
  },
  browseButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  browseButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
