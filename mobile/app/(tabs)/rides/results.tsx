import { useRideStore } from "@/store/rideStore";
import { useRequestStore } from "@/store/requestStore";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import RideMap from "@/components/RideMap";
import ProfileAvatar from "@/components/ProfileAvatar";

interface SearchResult {
  id: string;
  _id: string; // for RideMap compatibility
  type: "ride" | "request";
  driverName?: string;
  driverId?: string;
  passengerName?: string;
  passengerId?: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupCoords?: { latitude: number; longitude: number };
  dropoffCoords?: { latitude: number; longitude: number };
  departureTime: string;
  availableSeats?: number;
  passengers?: number;
  pricePerSeat?: number;
  matchType: "exact" | "partial" | "nearby";
  distance?: number; // km from search location
  isIntermediate?: boolean;
  searchLocation?: string;
  // For RideMap compatibility
  pickup_location: { latitude: number; longitude: number; address?: string; city?: string };
  dropoff_location: { latitude: number; longitude: number; address?: string; city?: string };
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
  const { availableRequests, getAvailableRequests, makeOffer, loading: requestsLoading } = useRequestStore();

  // Offer modal state
  const [offerModalVisible, setOfferModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<SearchResult | null>(null);
  const [offerPrice, setOfferPrice] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  const [results, setResults] = useState<SearchResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "rides" | "requests">("all");
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const isToAirport = params.direction === "to_airport";
  const themeColor = isToAirport ? "#3B82F6" : "#8B5CF6";
  const themeGradient: [string, string] = isToAirport 
    ? ["#3B82F6", "#2563EB"] 
    : ["#8B5CF6", "#7C3AED"];

  // Load data on mount
  useEffect(() => {
    loadData();
    return () => {
      setResults([]);
    };
  }, []);

  // Re-process results when rides or requests change
  useEffect(() => {
    if (rides || availableRequests) {
      processResults();
    }
  }, [rides, availableRequests, params.date]);

  const loadData = async () => {
    const searchParams: any = { 
      airport_id: params.airportId, 
      direction: params.direction 
    };
    
    if (params.date) {
      searchParams.date = params.date;
    }

    // Add location coordinates for geospatial search
    if (params.locationLat && params.locationLng) {
      searchParams.latitude = params.locationLat;
      searchParams.longitude = params.locationLng;
      searchParams.radius = 8000; // 8km radius
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

  // Offer modal handlers
  const openOfferModal = (request: SearchResult) => {
    setSelectedRequest(request);
    setOfferPrice("");
    setOfferModalVisible(true);
  };

  const handleSubmitOffer = async () => {
    if (!offerPrice || parseFloat(offerPrice) <= 0) {
      Alert.alert("Error", "Please enter a valid price per seat");
      return;
    }

    if (!selectedRequest) return;

    setSubmittingOffer(true);
    try {
      await makeOffer(selectedRequest.id, {
        price_per_seat: parseFloat(offerPrice),
      });
      Alert.alert("Success", "Your offer has been sent to the passenger!", [
        { text: "OK", onPress: () => {
          setOfferModalVisible(false);
          setSelectedRequest(null);
          router.replace("/(tabs)/explore?tab=myoffers");
        }}
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to send offer");
    } finally {
      setSubmittingOffer(false);
    }
  };

  const processResults = () => {
    const mockResults: SearchResult[] = [];
    const searchDate = params.date ? new Date(params.date) : null;
    const minSeats = params.seatsMin ? parseInt(params.seatsMin) : null;
    const searchLat = params.locationLat ? parseFloat(params.locationLat) : null;
    const searchLng = params.locationLng ? parseFloat(params.locationLng) : null;

    console.log("📊 Processing results - Rides:", rides?.length, "Requests:", availableRequests?.length);

    // Simple distance function (Haversine approx)
    const getDistanceFromLatLonInKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      var R = 6371; // Radius of the earth in km
      var dLat = deg2rad(lat2 - lat1);
      var dLon = deg2rad(lon2 - lon1);
      var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat1)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      var d = R * c; // Distance in km
      return d;
    }

    const deg2rad = (deg: number) => {
      return deg * (Math.PI / 180)
    }

    // Process rides
    rides?.forEach((ride: any) => {
      const rideDate = new Date(ride.departure_datetime || ride.datetime_start);
      const availableSeats = ride.available_seats || ride.seats_left || ride.total_seats || 0;
      
      const dateMatch = !searchDate || rideDate.toDateString() === searchDate.toDateString();
      const seatsMatch = !minSeats || availableSeats >= minSeats;
      
      if (dateMatch && seatsMatch) {
        // Extract coordinates
        // For rides: 
        // If to_airport: pickup = home (ride.home_lat/lng), dropoff = airport (ride.airport.lat/lng)
        // If from_airport: pickup = airport, dropoff = home
        
        let pickupLat = 0, pickupLng = 0, dropoffLat = 0, dropoffLng = 0;
        
        const homeLat = ride.home_latitude || ride.location?.latitude || 0;
        const homeLng = ride.home_longitude || ride.location?.longitude || 0;
        const airportLat = ride.airport?.latitude || 0;
        const airportLng = ride.airport?.longitude || 0;

        if (isToAirport) {
           pickupLat = homeLat;
           pickupLng = homeLng;
           dropoffLat = airportLat;
           dropoffLng = airportLng;
        } else {
           pickupLat = airportLat;
           pickupLng = airportLng;
           dropoffLat = homeLat;
           dropoffLng = homeLng;
        }

        // Determine if search location is intermediate
        let isIntermediate = false;
        let distanceFromPickup = 0;
        let distanceFromDropoff = 0;
        let distanceFromSearch = 0;

        if (searchLat && searchLng) {
            distanceFromPickup = getDistanceFromLatLonInKm(searchLat, searchLng, pickupLat, pickupLng);
            distanceFromDropoff = getDistanceFromLatLonInKm(searchLat, searchLng, dropoffLat, dropoffLng);
            
            // If search location is > 2km from BOTH pickup and dropoff, it's intermediate
            if (distanceFromPickup > 2 && distanceFromDropoff > 2) {
                isIntermediate = true;
                // Use the smaller distance to show "X km away" from the route point
                distanceFromSearch = Math.min(distanceFromPickup, distanceFromDropoff);
            }
        }

        mockResults.push({
          id: ride._id || ride.id,
          _id: ride._id || ride.id,
          type: "ride",
          driverName: ride.driver?.first_name || "Driver",
          driverId: ride.driver?.id || ride.driver?._id || (typeof ride.driver_id === 'object' ? ride.driver_id?._id : ride.driver_id),
          pickupLocation: isToAirport ? (ride.home_address || ride.home_city || "Unknown") : (ride.airport?.name || params.airportName || "Airport"),
          dropoffLocation: isToAirport ? (ride.airport?.name || params.airportName || "Airport") : (ride.home_address || ride.home_city || "Unknown"),
          departureTime: ride.departure_datetime || ride.datetime_start,
          availableSeats: availableSeats,
          pricePerSeat: ride.price_per_seat,
          matchType: isIntermediate ? "partial" : "exact",
          distance: isIntermediate ? Math.floor(distanceFromSearch) : (Math.floor(Math.random() * 5)), // Mock distance if not intermediate
          isIntermediate,
          searchLocation: params.locationAddress,
          pickupCoords: { latitude: pickupLat, longitude: pickupLng },
          dropoffCoords: { latitude: dropoffLat, longitude: dropoffLng },
          pickup_location: { latitude: pickupLat, longitude: pickupLng, city: isToAirport ? ride.home_city : ride.airport?.name },
          dropoff_location: { latitude: dropoffLat, longitude: dropoffLng, city: isToAirport ? ride.airport?.name : ride.home_city },
        });
      }
    });

    // Process requests
    availableRequests?.forEach((request: any) => {
      const requestDate = new Date(request.preferred_datetime);
      const shouldInclude = !searchDate || requestDate.toDateString() === searchDate.toDateString();
      
      if (shouldInclude) {
        const reqLocLat = request.location_latitude || request.location?.latitude || 0;
        const reqLocLng = request.location_longitude || request.location?.longitude || 0;
        const reqAirportLat = request.airport?.latitude || 0;
        const reqAirportLng = request.airport?.longitude || 0;

        let pickupLat = 0, pickupLng = 0, dropoffLat = 0, dropoffLng = 0;

        if (isToAirport) { // Request is asking to go TO airport
            pickupLat = reqLocLat;
            pickupLng = reqLocLng;
            dropoffLat = reqAirportLat;
            dropoffLng = reqAirportLng;
        } else { // Request is asking to go FROM airport
            pickupLat = reqAirportLat;
            pickupLng = reqAirportLng;
            dropoffLat = reqLocLat;
            dropoffLng = reqLocLng;
        }

        mockResults.push({
          id: request._id,
          _id: request._id,
          type: "request",
          passengerName: request.passenger?.first_name || "Passenger",
          passengerId: request.passenger?.id || request.passenger?._id || (typeof request.passenger_id === 'object' ? request.passenger_id?._id : request.passenger_id),
          pickupLocation: isToAirport ? (request.location_address || request.location_city || "Unknown") : (request.airport?.name || params.airportName || "Airport"),
          dropoffLocation: isToAirport ? (request.airport?.name || params.airportName || "Airport") : (request.location_address || request.location_city || "Unknown"),
          departureTime: request.preferred_datetime,
          passengers: request.seats_needed,
          matchType: "exact",
          distance: Math.floor(Math.random() * 15) + 1,
          pickupCoords: { latitude: pickupLat, longitude: pickupLng },
          dropoffCoords: { latitude: dropoffLat, longitude: dropoffLng },
          pickup_location: { latitude: pickupLat, longitude: pickupLng, city: isToAirport ? request.location_city : request.airport?.name },
          dropoff_location: { latitude: dropoffLat, longitude: dropoffLng, city: isToAirport ? request.airport?.name : request.location_city },
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
      case "exact": return { bg: "#DCFCE7", text: "#16A34A" };
      case "partial": return { bg: "#FEF3C7", text: "#D97706" };
      case "nearby": return { bg: "#DBEAFE", text: "#2563EB" };
      default: return { bg: "#F1F5F9", text: "#64748B" };
    }
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }),
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
            router.push({
              pathname: '/ride-details/[id]',
              params: { id: item.id }
            });
          } else {
            // Open offer modal for requests
            openOfferModal(item);
          }
        }}
      >
        <View style={styles.resultHeader}>
          <View style={[styles.typeBadge, { backgroundColor: isRide ? "#DBEAFE" : "#F3E8FF" }]}>
            <Ionicons name={isRide ? "car" : "hand-right"} size={14} color={isRide ? "#3B82F6" : "#8B5CF6"} />
            <Text style={[styles.typeBadgeText, { color: isRide ? "#3B82F6" : "#8B5CF6" }]}>
              {isRide ? "Ride Offer" : "Ride Request"}
            </Text>
          </View>
          <View style={[styles.matchBadge, { backgroundColor: matchColors.bg }]}>
            <Text style={[styles.matchBadgeText, { color: matchColors.text }]}>
              {item.matchType === "exact" ? "✓ Exact match" : (item.isIntermediate ? "✓ On Route" : `~${item.distance}km away`)}
            </Text>
          </View>
        </View>

        <View onStartShouldSetResponder={() => true}>
          <TouchableOpacity 
            style={styles.userInfo}
            onPress={() => {
              const userId = isRide ? item.driverId : item.passengerId;
              if (userId) router.push({ pathname: "/user-profile/[id]", params: { id: userId } });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Ionicons name="person" size={20} color="#64748B" />
            </View>
            <Text style={[styles.userName, { color: '#3B82F6' }]}>
              {isRide ? item.driverName : item.passengerName}
            </Text>
            {isRide && (
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>€{item.pricePerSeat}/seat</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.routeContainer}>
          {item.isIntermediate ? (
             // Intermediate/Partial Match View
             <>
                <View style={styles.routePoint}>
                    <Ionicons name="ellipse-outline" size={14} color="#94A3B8" style={{ marginRight: 8, width: 20, textAlign: 'center' }} />
                    <Text style={[styles.routeText, { color: '#94A3B8', fontSize: 13 }]} numberOfLines={1}>{item.pickupLocation}</Text>
                </View>
                
                <View style={{ width: 20, alignItems: 'center', height: 24, justifyContent: 'center' }}>
                    <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
                </View>

                {/* Highlighted Search Location */}
                <View style={styles.routePoint}>
                    <Ionicons name={isToAirport ? "location" : "location"} size={18} color={themeColor} style={{ marginRight: 8, width: 20, textAlign: 'center' }} />
                    <View>
                        <Text style={[styles.routeText, { color: themeColor, fontWeight: '700' }]} numberOfLines={1}>
                            {item.searchLocation || "Your Location"}
                        </Text>
                        <Text style={{ fontSize: 11, color: themeColor }}>
                            {isToAirport ? "Your Pickup" : "Your Dropoff"}
                        </Text>
                    </View>
                </View>

                <View style={{ width: 20, alignItems: 'center', height: 24, justifyContent: 'center' }}>
                    <View style={{ width: 2, height: 24, backgroundColor: '#CBD5E1' }} />
                </View>

                <View style={styles.routePoint}>
                    <Ionicons name="ellipse-outline" size={14} color="#94A3B8" style={{ marginRight: 8, width: 20, textAlign: 'center' }} />
                    <Text style={[styles.routeText, { color: '#94A3B8', fontSize: 13 }]} numberOfLines={1}>{item.dropoffLocation}</Text>
                </View>
             </>
          ) : (
             // Standard Exact Match View
             <>
                <View style={styles.routePoint}>
                    <Ionicons name={isToAirport ? "location" : "airplane"} size={16} color={isToAirport ? "#EF4444" : "#007AFF"} style={{ marginRight: 8, width: 20, textAlign: 'center' }} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.pickupLocation}</Text>
                </View>
                <View style={{ width: 20, alignItems: 'center', height: 30, justifyContent: 'center', marginVertical: 2 }}>
                    <View style={{ width: 2, height: 16, backgroundColor: '#CBD5E1' }} />
                    <Ionicons name="chevron-down" size={16} color="#CBD5E1" style={{ marginTop: -4 }} />
                </View>
                <View style={styles.routePoint}>
                    <Ionicons name={isToAirport ? "airplane" : "location"} size={16} color={isToAirport ? "#007AFF" : "#EF4444"} style={{ marginRight: 8, width: 20, textAlign: 'center' }} />
                    <Text style={styles.routeText} numberOfLines={1}>{item.dropoffLocation}</Text>
                </View>
             </>
          )}
        </View>

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
      <LinearGradient
        colors={themeGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>
            {params.airportCode} • {new Date(params.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View style={styles.headerButtons}>
             <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
            >
            <Ionicons name={viewMode === 'list' ? "map-outline" : "list-outline"} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => {/* Filter */}}>
            <Ionicons name="options-outline" size={24} color="#fff" />
            </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* View Mode Content */}
      {viewMode === 'map' ? (
          <View style={{ flex: 1 }}>
              <View style={styles.mapTabsOverlay}>
                <View style={styles.tabsContainer}>
                    <TouchableOpacity style={[styles.tab, activeTab === "all" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("all")}>
                    <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === "rides" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("rides")}>
                    <Text style={[styles.tabText, activeTab === "rides" && styles.tabTextActive]}>Rides</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.tab, activeTab === "requests" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("requests")}>
                    <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>Requests</Text>
                    </TouchableOpacity>
                </View>
              </View>
              <RideMap items={filteredResults} />
          </View>
      ) : (
          <>
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

            <View style={styles.tabsContainer}>
                <TouchableOpacity style={[styles.tab, activeTab === "all" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("all")}>
                <Text style={[styles.tabText, activeTab === "all" && styles.tabTextActive]}>All ({results.length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === "rides" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("rides")}>
                <Text style={[styles.tabText, activeTab === "rides" && styles.tabTextActive]}>Rides ({results.filter(r => r.type === "ride").length})</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === "requests" && { backgroundColor: themeColor }]} onPress={() => setActiveTab("requests")}>
                <Text style={[styles.tabText, activeTab === "requests" && styles.tabTextActive]}>Requests ({results.filter(r => r.type === "request").length})</Text>
                </TouchableOpacity>
            </View>

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
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[themeColor]} tintColor={themeColor} />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={64} color="#CBD5E1" />
                    <Text style={styles.emptyTitle}>No rides found</Text>
                    <Text style={styles.emptySubtitle}>Try adjusting your search criteria or create a request with your search info</Text>
                    <TouchableOpacity
                        style={[styles.createButton, { backgroundColor: themeColor }]}
                        onPress={() => router.push({
                        pathname: "/(tabs)/requests/create",
                        params: {
                            prefillAirportId: params.airportId,
                            prefillDirection: params.direction,
                            prefillDate: params.date,
                            prefillLocationAddress: params.locationAddress,
                            prefillLocationLat: params.locationLat,
                            prefillLocationLng: params.locationLng,
                        }
                        })}
                    >
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.createButtonText}>Create a Request</Text>
                    </TouchableOpacity>
                    </View>
                }
                />
            )}
          </>
      )}

      {/* Offer Modal - Simple popup to enter price */}
      <Modal
        visible={offerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setOfferModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Make an Offer</Text>

            {selectedRequest && (
              <View style={styles.modalInfo}>
                <Text style={styles.modalInfoText}>
                  Passenger: {selectedRequest.passengerName}
                </Text>
                <Text style={styles.modalInfoText}>
                  Seats needed: {selectedRequest.passengers}
                </Text>
                <Text style={styles.modalInfoText}>
                  Route: {selectedRequest.pickupLocation} → {selectedRequest.dropoffLocation}
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Your Price per Seat (EUR)</Text>
              <TextInput
                style={styles.modalInput}
                value={offerPrice}
                onChangeText={setOfferPrice}
                keyboardType="number-pad"
                placeholder="50"
                placeholderTextColor="#9CA3AF"
              />
            </View>

            {offerPrice && selectedRequest?.passengers && (
              <Text style={styles.totalPrice}>
                Total: {(parseFloat(offerPrice) || 0) * (selectedRequest.passengers || 1)} EUR
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setOfferModalVisible(false);
                  setSelectedRequest(null);
                }}
              >
                <Text style={styles.modalButtonCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, submittingOffer && { opacity: 0.7 }]}
                onPress={handleSubmitOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.modalButtonConfirmText}>Send Offer</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerButtons: {
      flexDirection: 'row',
      gap: 8,
  },
  iconButton: {
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
  mapTabsOverlay: {
      position: 'absolute',
      top: 10,
      left: 0,
      right: 0,
      zIndex: 10,
      backgroundColor: 'transparent',
      alignItems: 'center',
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    width: "85%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 20,
  },
  modalInfo: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalInfoText: {
    fontSize: 14,
    color: "#475569",
    marginBottom: 8,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  totalPrice: {
    fontSize: 18,
    fontWeight: "700",
    color: "#8B5CF6",
    textAlign: "center",
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonCancel: {
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalButtonCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748B",
  },
  modalButtonConfirm: {
    backgroundColor: "#8B5CF6",
  },
  modalButtonConfirmText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});