import { useRideStore } from "@/store/rideStore";
import { useRequestStore } from "@/store/requestStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface SearchResult {
  id: string;
  type: "ride" | "request";
  driverName?: string;
  passengerName?: string;
  pickupLocation: string;
  dropoffLocation: string;
  departureTime: string;
  availableSeats?: number;
  passengers?: number;
  pricePerSeat?: number;
  matchType: "exact" | "partial" | "nearby";
  distance?: number; // km from search location
}

export default function SearchResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    direction: "to_airport" | "from_airport";
    airportId: string;
    airportCode: string;
    airportName: string;
    locationAddress: string;
    locationLat: string;
    locationLng: string;
    date: string;
    includeTime: string;
    seatsMin?: string;
    fromRequest?: string;
  }>();

  const { rides, searchRides, isLoading: ridesLoading } = useRideStore();
  const { availableRequests, getAvailableRequests, loading: requestsLoading } = useRequestStore();

  const [results, setResults] = useState<SearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "rides" | "requests">("all");

  const isToAirport = params.direction === "to_airport";
  const themeColor = isToAirport ? "#3B82F6" : "#8B5CF6";
  const themeGradient: [string, string] = isToAirport 
    ? ["#3B82F6", "#2563EB"] 
    : ["#8B5CF6", "#7C3AED"];

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  // Re-process results when rides or requests change
  useEffect(() => {
    if (rides || availableRequests) {
      processResults();
    }
  }, [rides, availableRequests, params.date]);

  const loadData = async () => {
    // Include date in search to get more accurate results
    const searchParams: any = { 
      airport_id: params.airportId, 
      direction: params.direction 
    };
    
    // Add date filter if provided
    if (params.date) {
      searchParams.date = params.date;
    }
    
    console.log("🔍 Loading results with params:", searchParams);
    
    await Promise.all([
      searchRides(searchParams),
      getAvailableRequests(searchParams),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const processResults = () => {
    const mockResults: SearchResult[] = [];
    const searchDate = params.date ? new Date(params.date) : null;
    const minSeats = params.seatsMin ? parseInt(params.seatsMin) : null;

    console.log("📊 Processing results - Rides:", rides?.length, "Requests:", availableRequests?.length);
    console.log("📅 Search date:", searchDate?.toDateString(), "Min seats:", minSeats);

    // Process rides - show all rides if no date filter, otherwise filter by date
    rides?.forEach((ride: any) => {
      const rideDate = new Date(ride.departure_datetime || ride.datetime_start);
      const availableSeats = ride.available_seats || ride.seats_left || ride.total_seats || 0;
      
      // Date filter: include all if no date specified, otherwise check date match
      const dateMatch = !searchDate || rideDate.toDateString() === searchDate.toDateString();
      
      // Seats filter: include all if no minimum specified, otherwise check seats
      const seatsMatch = !minSeats || availableSeats >= minSeats;
      
      if (dateMatch && seatsMatch) {
        mockResults.push({
          id: ride._id || ride.id,
          type: "ride",
          driverName: ride.driver?.first_name || "Driver",
          pickupLocation: ride.home_address || ride.home_city || "Unknown",
          dropoffLocation: ride.airport?.name || params.airportName || "Airport",
          departureTime: ride.departure_datetime || ride.datetime_start,
          availableSeats: availableSeats,
          pricePerSeat: ride.price_per_seat,
          matchType: "exact",
          distance: Math.floor(Math.random() * 15) + 1,
        });
      }
    });

    // Process requests - show all if no date, otherwise filter
    availableRequests?.forEach((request: any) => {
      const requestDate = new Date(request.preferred_datetime);
      const shouldInclude = !searchDate || requestDate.toDateString() === searchDate.toDateString();
      
      if (shouldInclude) {
        mockResults.push({
          id: request._id,
          type: "request",
          passengerName: request.passenger?.first_name || "Passenger",
          pickupLocation: request.location_address || request.location_city || "Unknown",
          dropoffLocation: request.airport?.name || params.airportName || "Airport",
          departureTime: request.preferred_datetime,
          passengers: request.seats_needed,
          matchType: "exact",
          distance: Math.floor(Math.random() * 15) + 1,
        });
      }
    });

    console.log("✅ Total results:", mockResults.length);
    setResults(mockResults);
  };

  const filteredResults = results.filter((result) => {
    if (activeTab === "all") return true;
    if (activeTab === "rides") return result.type === "ride";
    if (activeTab === "requests") return result.type === "request";
    return true;
  });

  const getMatchBadgeColor = (matchType: string) => {
    switch (matchType) {
      case "exact":
        return { bg: "#DCFCE7", text: "#16A34A" };
      case "partial":
        return { bg: "#FEF3C7", text: "#D97706" };
      case "nearby":
        return { bg: "#DBEAFE", text: "#2563EB" };
      default:
        return { bg: "#F1F5F9", text: "#64748B" };
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const renderResultItem = ({ item }: { item: SearchResult }) => {
    const matchColors = getMatchBadgeColor(item.matchType);
    const dateTime = formatDateTime(item.departureTime);
    const isRide = item.type === "ride";

    return (
      <TouchableOpacity
        style={styles.resultCard}
        onPress={() => {
          if (isRide) {
            router.push(`/(tabs)/rides/${item.id}`);
          } else {
            router.push(`/(tabs)/requests/${item.id}`);
          }
        }}
      >
        {/* Header */}
        <View style={styles.resultHeader}>
          <View style={[styles.typeBadge, { backgroundColor: isRide ? "#DBEAFE" : "#F3E8FF" }]}>
            <Ionicons 
              name={isRide ? "car" : "hand-right"} 
              size={14} 
              color={isRide ? "#3B82F6" : "#8B5CF6"} 
            />
            <Text style={[styles.typeBadgeText, { color: isRide ? "#3B82F6" : "#8B5CF6" }]}>
              {isRide ? "Ride Offer" : "Ride Request"}
            </Text>
          </View>
          <View style={[styles.matchBadge, { backgroundColor: matchColors.bg }]}>
            <Text style={[styles.matchBadgeText, { color: matchColors.text }]}>
              {item.matchType === "exact" ? "✓ Exact match" : `~${item.distance}km away`}
            </Text>
          </View>
        </View>

        {/* User info */}
        <View style={styles.userInfo}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={20} color="#64748B" />
          </View>
          <Text style={styles.userName}>
            {isRide ? item.driverName : item.passengerName}
          </Text>
          {isRide && (
            <View style={styles.priceTag}>
              <Text style={styles.priceText}>€{item.pricePerSeat}/seat</Text>
            </View>
          )}
        </View>

        {/* Route */}
        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#3B82F6" }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.pickupLocation}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.dropoffLocation}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.resultFooter}>
          <View style={styles.dateTimeContainer}>
            <Ionicons name="calendar-outline" size={16} color="#64748B" />
            <Text style={styles.dateTimeText}>{dateTime.date}</Text>
            <Ionicons name="time-outline" size={16} color="#64748B" style={{ marginLeft: 10 }} />
            <Text style={styles.dateTimeText}>{dateTime.time}</Text>
          </View>
          <View style={styles.seatsContainer}>
            <Ionicons name="people-outline" size={16} color="#64748B" />
            <Text style={styles.seatsText}>
              {isRide ? `${item.availableSeats} seats` : `${item.passengers} passengers`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const isLoading = ridesLoading || requestsLoading;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <LinearGradient
        colors={themeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.headerBackButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>
            {params.airportCode} • {new Date(params.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => {/* TODO: Open filter modal */}}
        >
          <Ionicons name="options-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search summary */}
      <View style={styles.searchSummary}>
        <View style={styles.summaryItem}>
          <Ionicons name="airplane" size={16} color={themeColor} />
          <Text style={styles.summaryText}>{params.airportName}</Text>
        </View>
        {params.locationAddress !== "Any location" && (
          <View style={styles.summaryItem}>
            <Ionicons name="location" size={16} color={themeColor} />
            <Text style={styles.summaryText} numberOfLines={1}>{params.locationAddress}</Text>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "all" && { backgroundColor: themeColor }]}
          onPress={() => setActiveTab("all")}
        >
          <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>
            All ({results.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "rides" && { backgroundColor: themeColor }]}
          onPress={() => setActiveTab("rides")}
        >
          <Text style={[styles.tabText, activeTab === "rides" && styles.tabTextActive]}>
            Rides ({results.filter(r => r.type === "ride").length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "requests" && { backgroundColor: themeColor }]}
          onPress={() => setActiveTab("requests")}
        >
          <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>
            Requests ({results.filter(r => r.type === "request").length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Searching for rides...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredResults}
          keyExtractor={(item) => `${item.type}-${item.id}`}
          renderItem={renderResultItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[themeColor]}
              tintColor={themeColor}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="search-outline" size={64} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No rides found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search criteria or create a request
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: themeColor }]}
                onPress={() => router.push("/(tabs)/requests/create")}
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.createButtonText}>Create a Request</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  searchSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    gap: 12,
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 13,
    color: "#1E293B",
    marginLeft: 6,
    maxWidth: 150,
  },
  tabsContainer: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#64748B",
    marginTop: 12,
  },
  listContent: {
    padding: 12,
    paddingBottom: 100,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  matchBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  matchBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    flex: 1,
  },
  priceTag: {
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#16A34A",
  },
  routeContainer: {
    marginBottom: 14,
    paddingLeft: 4,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: "#E2E8F0",
    marginLeft: 4,
    marginVertical: 2,
  },
  routeText: {
    fontSize: 14,
    color: "#475569",
    flex: 1,
  },
  resultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dateTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  dateTimeText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 4,
  },
  seatsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  seatsText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 4,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  createButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
});
