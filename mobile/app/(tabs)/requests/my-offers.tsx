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
import { useRideStore } from "../../../src/store/rideStore";

type FilterStatus = "all" | "active" | "cancelled";

export default function MyOffersScreen() {
  const router = useRouter();
  const { myRides, getMyRides, isLoading } = useRideStore();
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    console.log("🔄 Loading my rides (offers)...");
    loadOffers();
  }, []);

  useEffect(() => {
    console.log("📊 MyRides updated:", myRides?.length || 0, "rides");
  }, [myRides]);

  const loadOffers = async () => {
    console.log("🚗 Fetching my rides...");
    await getMyRides();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOffers();
    setRefreshing(false);
  };

  const filteredRides = (myRides || []).filter((ride: any) => {
    if (activeFilter === "all") return true;
    return ride.status === activeFilter;
  });

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return (
      date.toLocaleDateString() +
      " at " +
      date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
    );
  };

  const getRideStatusColor = (status: string) => {
    if (status === "active") return "#28a745";
    if (status === "cancelled") return "#dc3545";
    if (status === "completed") return "#6c757d";
    return "#ffc107";
  };

  const getRideStatusText = (status: string) => {
    if (status === "active") return "Active";
    if (status === "cancelled") return "Cancelled";
    if (status === "completed") return "Completed";
    return status;
  };

  const renderOffer = ({ item }: any) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push({ pathname: "/ride-details/[id]", params: { id: item.id || item._id } })}
    >
      {/* Status Badge */}
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getRideStatusColor(item.status) },
        ]}
      >
        <Text style={styles.statusText}>{getRideStatusText(item.status)}</Text>
      </View>

      {/* Header: Airport IATA code and direction */}
      <View style={styles.cardHeader}>
        <View style={styles.airportBadge}>
          <Text style={styles.airportCode}>{item.airport?.iata_code || item.airport_code}</Text>
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

      {/* Ride Info */}
      <View style={styles.passengerRow}>
        <View style={styles.passengerAvatar}>
          <Ionicons name="car" size={16} color="#fff" />
        </View>
        <View style={styles.passengerInfo}>
          <Text style={styles.passengerName}>
            {item.home_city} - {item.airport?.name || item.airport_name}
          </Text>
          {item.bookings_count > 0 && (
            <View style={styles.ratingRow}>
              <Ionicons name="people" size={12} color="#007AFF" />
              <Text style={styles.ratingText}>
                {item.bookings_count} booking(s)
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Concise Route */}
      <View style={styles.routeContainer}>
        <Ionicons
          name={item.direction === "to_airport" ? "car" : "airplane"}
          size={16}
          color="#28a745"
        />
        <Text style={styles.routeText} numberOfLines={1}>
          {item.direction === "to_airport"
            ? `${item.home_city || "Home"} → ${item.airport?.name || item.airport_name}`
            : `${item.airport?.name || item.airport_name} → ${item.home_city || "Home"}`}
        </Text>
      </View>

      {/* Details */}
      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            {formatDateTime(item.departure_datetime || item.datetime_start)}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Ionicons name="people-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            {item.available_seats || item.seats_left} seats
          </Text>
        </View>
        {(item.luggage_capacity > 0 || item.luggage_left > 0) && (
          <View style={styles.detailItem}>
            <Ionicons name="briefcase-outline" size={14} color="#666" />
            <Text style={styles.detailText}>
              {item.luggage_left ?? item.luggage_capacity} luggage
            </Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <Ionicons name="cash-outline" size={14} color="#666" />
          <Text style={styles.detailText}>
            {item.price_per_seat} EUR
          </Text>
        </View>
      </View>

      {/* Driver Comment */}
      {item.driver_comment && (
        <View style={styles.offerBox}>
          <Text style={styles.offerLabel}>Note</Text>
          <Text style={styles.offerMessage} numberOfLines={2}>
            "{item.driver_comment}"
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="car-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        No Rides Offered Yet
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === "all"
          ? "Create a ride offer to start earning"
          : activeFilter === "active"
          ? "You have no active rides"
          : "No cancelled rides"}
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={() => router.push("/(tabs)/rides/create")}
      >
        <Text style={styles.browseButtonText}>Offer a Ride</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Ride Offers</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {(["all", "active", "cancelled"] as FilterStatus[]).map((filter) => (
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
                ? `All (${myRides?.length || 0})`
                : filter === "active"
                ? `Active (${filteredRides.filter((r: any) => r.status === "active").length})`
                : `Cancelled (${filteredRides.filter((r: any) => r.status === "cancelled").length})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={filteredRides}
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
    color: "#666",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "500",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  directionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  directionText: {
    fontSize: 12,
    color: "#007AFF",
  },
  passengerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  passengerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#17a2b8",
    justifyContent: "center",
    alignItems: "center",
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    color: "#666",
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  routeText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
    flex: 1,
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
    fontSize: 12,
    color: "#666",
  },
  offerBox: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  offerLabel: {
    fontSize: 11,
    color: "#666",
    marginBottom: 4,
  },
  offerPrice: {
    fontSize: 16,
    fontWeight: "600",
    color: "#28a745",
  },
  offerMessage: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    marginTop: 4,
  },
  contactBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#e8f5e9",
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  contactText: {
    fontSize: 14,
    color: "#28a745",
    fontWeight: "500",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
  },
  browseButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  browseButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#fff",
  },
});
