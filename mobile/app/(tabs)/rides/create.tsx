import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRideStore } from "../../../src/store/rideStore";
import { useAirportStore } from "../../../src/store/airportStore";
import { useRequestStore } from "../../../src/store/requestStore";
import MapLocationPicker from "../../../src/components/MapLocationPicker";
import RideMap from "@/components/RideMap";
import LeafletMap from "@/components/LeafletMap";
import TimePickerModal from "../../../src/components/TimePickerModal";
import { Airport } from "../../../src/types";
import { toast } from "../../../src/store/toastStore";

export default function CreateRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillAirportId?: string;
    prefillDirection?: string;
    prefillDate?: string;
    prefillLocationAddress?: string;
    prefillLocationLat?: string;
    prefillLocationLng?: string;
  }>();
  
  const { createRide, isLoading, fetchRoutePreview } = useRideStore();
  const { airports, fetchAirports } = useAirportStore();
  const { getAvailableRequests, availableRequests } = useRequestStore();

  const [airportId, setAirportId] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [showAirportDropdown, setShowAirportDropdown] = useState(false);
  const [showAirportMap, setShowAirportMap] = useState(false);
  const [direction, setDirection] = useState<"to_airport" | "from_airport">("to_airport");
  const [location, setLocation] = useState<{
    address: string;
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [departureDateTime, setDepartureDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [totalSeats, setTotalSeats] = useState(3);
  const [luggageCapacity, setLuggageCapacity] = useState({
    max_10kg: 0,
    max_20kg: 0,
    max_hors_norme: 0,
    max_sac: 0,
  });
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [hasPrefilled, setHasPrefilled] = useState(false);
  
  const [routeCoordinates, setRouteCoordinates] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [showRoutePreviewFull, setShowRoutePreviewFull] = useState(false);
  const airportMapSearchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Airport Map Region Change - refetch airports for current view
  const handleAirportMapRegionChange = (region: { latitude: number; longitude: number }) => {
    if (airportMapSearchTimeoutRef.current) {
      clearTimeout(airportMapSearchTimeoutRef.current);
    }
    airportMapSearchTimeoutRef.current = setTimeout(() => {
      fetchAirports({
        latitude: region.latitude,
        longitude: region.longitude,
        radius: 200000, // 200km radius
      });
    }, 500);
  };

  useEffect(() => {
    fetchAirports();
  }, []);

  // Fetch Route Preview when location/airport changes
  useEffect(() => {
    const updateRoute = async () => {
      if (!airportId || !location) return;
      
      const airport = airports.find(a => (a._id || a.id) === airportId);
      if (!airport) return;

      setIsCalculatingRoute(true);
      try {
        const origin = direction === "home_to_airport" || direction === "to_airport"
          ? { latitude: location.latitude, longitude: location.longitude }
          : { latitude: airport.latitude, longitude: airport.longitude };
          
        const destination = direction === "home_to_airport" || direction === "to_airport"
          ? { latitude: airport.latitude, longitude: airport.longitude }
          : { latitude: location.latitude, longitude: location.longitude };

        const coords = await fetchRoutePreview(origin, destination);
        if (coords && coords.length > 0) {
          setRouteCoordinates(coords);
        }
      } catch (err) {
        console.error("Error calculating route preview:", err);
      } finally {
        setIsCalculatingRoute(false);
      }
    };

    updateRoute();
  }, [airportId, location, direction, airports]);

  // Handle prefill parameters when airports are loaded
  useEffect(() => {
    if (hasPrefilled || airports.length === 0) return;
    
    if (params.prefillAirportId) {
      setAirportId(params.prefillAirportId);
      const airport = airports.find((a: Airport) => (a._id || a.id) === params.prefillAirportId);
      if (airport) {
        setAirportSearch(airport.name);
      }
    }
    
    if (params.prefillDirection) {
      setDirection(params.prefillDirection as "to_airport" | "from_airport");
    }
    
    if (params.prefillDate) {
      setDepartureDateTime(new Date(params.prefillDate));
    }
    
    if (params.prefillLocationAddress && params.prefillLocationLat && params.prefillLocationLng) {
      setLocation({
        address: params.prefillLocationAddress,
        city: "",
        postcode: "",
        latitude: parseFloat(params.prefillLocationLat),
        longitude: parseFloat(params.prefillLocationLng),
      });
    }
    
    setHasPrefilled(true);
  }, [airports, params.prefillAirportId, params.prefillDirection, params.prefillDate, params.prefillLocationAddress]);

  const handleLocationSelect = (loc: any) => {
    setLocation({
      address: loc.address,
      city: loc.city || "",
      postcode: loc.postcode || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    setShowMap(false);
  };

  const handleSubmit = async () => {
    if (!airportId) {
      toast.warning("Missing Airport", "Please select an airport");
      return;
    }
    if (!location) {
      toast.warning("Missing Location", "Please select your pickup/dropoff location");
      return;
    }
    if (!pricePerSeat) {
      toast.warning("Missing Price", "Please enter a price per seat");
      return;
    }

    // Ensure postcode has a value (required by backend)
    const postcode = location.postcode || "00000";

    try {
      const createdRide = await createRide({
        airport_id: airportId,
        direction,
        home_address: location.address,
        home_city: location.city || "Unknown",
        home_postcode: postcode,
        home_latitude: location.latitude,
        home_longitude: location.longitude,
        departure_datetime: departureDateTime.toISOString(),
        total_seats: totalSeats,
        price_per_seat: parseFloat(pricePerSeat),
        luggage_capacity: luggageCapacity,
        driver_comment: driverComment.trim() || undefined,
      });

      console.log("✅ Ride created successfully, ID:", createdRide?.id);
      
      // Force refresh of myRides to ensure it's in the list
      const { getMyRides } = useRideStore.getState();
      await getMyRides();
      console.log("🔄 Refreshed myRides list");

      // Search for matching ride requests based on ride criteria
      const searchDate = departureDateTime.toISOString().split("T")[0];
      try {
        await getAvailableRequests({
          airport_id: airportId,
          direction: direction,
          date: searchDate,
        });
      } catch (searchErr) {
        console.log("Error searching for matching requests:", searchErr);
      }

      // Check if there are matching requests
      const { availableRequests: matchingRequests } = useRequestStore.getState();
      
      // Get selected airport details for passing to available requests page
      const selectedAirportInfo = airports.find((a: Airport) => (a._id || a.id) === airportId);
      
      if (matchingRequests && matchingRequests.length > 0) {
        // Found matching requests - show notification with option to view them
        toast.success(
          "🎉 Ride Created!",
          `Your ride has been posted! We found ${matchingRequests.length} passenger${matchingRequests.length > 1 ? 's' : ''} looking for rides that match your route.`,
          [
            {
              label: "View Requests",
              onPress: () => router.replace({
                pathname: "/(tabs)/requests/available",
                params: {
                  prefillAirportId: airportId,
                  prefillAirportCode: selectedAirportInfo?.iata_code || "",
                  prefillAirportName: selectedAirportInfo?.name || "",
                  prefillDirection: direction,
                  prefillDate: searchDate,
                  prefillLocationAddress: location.address,
                  prefillLocationLat: String(location.latitude),
                  prefillLocationLng: String(location.longitude),
                  prefillSeats: String(totalSeats),
                  autoFilter: "true",
                }
              })
            },
            {
              label: "Later",
              onPress: () => router.replace("/(tabs)")
            }
          ]
        );
      } else {
        // No matching requests found
        toast.success(
          "Ride Created!",
          "Your ride has been posted successfully. Would you like to see available passenger requests?",
          [
            {
              label: "View Requests",
              onPress: () => router.replace({
                pathname: "/(tabs)/requests/available",
                params: {
                  prefillAirportId: airportId,
                  prefillAirportCode: selectedAirportInfo?.iata_code || "",
                  prefillAirportName: selectedAirportInfo?.name || "",
                  prefillDirection: direction,
                  prefillDate: searchDate,
                  prefillLocationAddress: location.address,
                  prefillLocationLat: String(location.latitude),
                  prefillLocationLng: String(location.longitude),
                  prefillSeats: String(totalSeats),
                  autoFilter: "true",
                }
              })
            },
            {
              label: "Home",
              onPress: () => router.replace("/(tabs)")
            }
          ]
        );
      }
    } catch (error: any) {
      toast.error("Error", error.message || "Failed to create ride");
    }
  };

  const selectedAirport = airports.find(
    (a: Airport) => (a._id || a.id) === airportId
  );

  const filteredAirports = airports.filter(
    (a: Airport) =>
      a.name.toLowerCase().includes(airportSearch.toLowerCase()) ||
      a.iata_code.toLowerCase().includes(airportSearch.toLowerCase()) ||
      a.city.toLowerCase().includes(airportSearch.toLowerCase())
  );

  const formatDate = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (t: Date) => {
    return t.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={100}
      >
      <MapLocationPicker
        visible={showMap}
        onClose={() => setShowMap(false)}
        onSelectLocation={handleLocationSelect}
        initialLocation={
          location
            ? { latitude: location.latitude, longitude: location.longitude }
            : undefined
        }
        showAirports={false}
      />
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Offer a Ride</Text>
        </View>
        <Text style={styles.subtitle}>Share your trip and earn money</Text>

        {/* Direction */}
        <Text style={styles.label}>Trip Direction</Text>
        <View style={styles.directionContainer}>
          <TouchableOpacity
            style={[styles.directionButton, direction === "to_airport" && styles.directionActive]}
            onPress={() => setDirection("to_airport")}
          >
            <Ionicons
              name="airplane"
              size={20}
              color={direction === "to_airport" ? "#fff" : "#666"}
            />
            <Text style={[styles.directionText, direction === "to_airport" && styles.directionTextActive]}>
              To Airport
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.directionButton, direction === "from_airport" && styles.directionActive]}
            onPress={() => setDirection("from_airport")}
          >
            <Ionicons
              name="home"
              size={20}
              color={direction === "from_airport" ? "#fff" : "#666"}
            />
            <Text style={[styles.directionText, direction === "from_airport" && styles.directionTextActive]}>
              From Airport
            </Text>
          </TouchableOpacity>
        </View>

        {/* Airport Selection */}
        <Text style={styles.label}>Airport</Text>
        <View style={styles.airportSelectionRow}>
          <TouchableOpacity
            style={styles.airportSelector}
            onPress={() => setShowAirportDropdown(true)}
          >
            <Ionicons name="airplane-outline" size={20} color="#007AFF" />
            <Text style={styles.airportSelectorText}>
              {selectedAirport
                ? `${selectedAirport.iata_code} - ${selectedAirport.name}`
                : "Select an airport"}
            </Text>
            <Ionicons name="chevron-down" size={20} color="#999" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.airportMapButton}
            onPress={() => setShowAirportMap(true)}
          >
            <Ionicons name="map-outline" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Airport Modal */}
        <Modal
          visible={showAirportDropdown}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAirportDropdown(false)}
        >
          <KeyboardAvoidingView
            behavior="padding"
            style={{ flex: 1 }}
            keyboardVerticalOffset={20}
          >
          <View style={styles.modalOverlay}>
            <View style={styles.airportModalContent}>
              <View style={styles.airportModalHeader}>
                <Text style={styles.airportModalTitle}>Select Airport</Text>
                <TouchableOpacity onPress={() => setShowAirportDropdown(false)}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
              </View>
              
              <View style={styles.airportSearchContainer}>
                <Ionicons name="search" size={20} color="#999" />
                <TextInput
                  style={styles.airportSearchInput}
                  placeholder="Search airports..."
                  value={airportSearch}
                  onChangeText={setAirportSearch}
                />
              </View>

              <FlatList
                data={filteredAirports}
                keyExtractor={(item) => item._id || item.id}
                initialNumToRender={20}
                maxToRenderPerBatch={30}
                windowSize={10}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.airportListItem,
                      (item._id || item.id) === airportId && styles.airportListItemActive,
                    ]}
                    onPress={() => {
                      setAirportId(item._id || item.id);
                      setShowAirportDropdown(false);
                      setAirportSearch("");
                    }}
                  >
                    <View style={styles.airportListItemLeft}>
                      <Text style={styles.airportListCode}>{item.iata_code}</Text>
                    </View>
                    <View style={styles.airportListItemRight}>
                      <Text style={styles.airportListName}>{item.name}</Text>
                      <Text style={styles.airportListCity}>{item.city}, {item.country}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyAirportList}>
                    <Text style={styles.emptyAirportText}>No airports found</Text>
                  </View>
                }
              />
            </View>
          </View>
          </KeyboardAvoidingView>
        </Modal>

        {/* Airport Map Modal */}
        <Modal
          visible={showAirportMap}
          animationType="slide"
          onRequestClose={() => setShowAirportMap(false)}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapHeaderTitle}>Explore Airports</Text>
              <TouchableOpacity onPress={() => setShowAirportMap(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <LeafletMap
              mode="view"
              initialRegion={
                selectedAirport 
                  ? { latitude: selectedAirport.latitude, longitude: selectedAirport.longitude, zoom: 10 }
                  : { latitude: 48.8566, longitude: 2.3522, zoom: 5 }
              }
              markers={airports.filter(a => a.latitude != null && a.longitude != null).map(a => ({
                id: a._id || a.id,
                latitude: a.latitude!,
                longitude: a.longitude!,
                title: `${a.iata_code} - ${a.name}`,
                type: 'airport' as const
              }))}
              selectedId={airportId}
              onMarkerClick={(id) => {
                setAirportId(id);
                setShowAirportMap(false);
              }}
            />
          </View>
        </Modal>

        {/* Route Preview Full Screen Modal */}
        <Modal
          visible={showRoutePreviewFull}
          animationType="slide"
          onRequestClose={() => setShowRoutePreviewFull(false)}
        >
          <View style={{ flex: 1 }}>
            <View style={styles.mapHeader}>
              <Text style={styles.mapHeaderTitle}>Route Details</Text>
              <TouchableOpacity onPress={() => setShowRoutePreviewFull(false)}>
                <Ionicons name="close" size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <RideMap
              items={[]} 
              routeCoordinates={routeCoordinates}
              style={{ flex: 1 }}
              initialRegion={location ? {
                latitude: location.latitude,
                longitude: location.longitude,
                zoom: 10
              } : undefined}
            />
          </View>
        </Modal>

        {/* Location */}
        <Text style={styles.label}>
          {direction === "to_airport" ? "Pickup Location" : "Dropoff Location"}
        </Text>
        <TouchableOpacity style={styles.locationButton} onPress={() => setShowMap(true)}>
          <Ionicons name="location" size={20} color="#007AFF" />
          <Text style={[styles.locationButtonText, !location && { color: "#999" }]}>
            {location ? location.address : "Select location on map"}
          </Text>
          <Ionicons name="map-outline" size={20} color="#999" />
        </TouchableOpacity>

        {/* Route Preview Map */}
        {location && airportId && (
          <View style={styles.mapPreviewContainer}>
            {isCalculatingRoute ? (
              <View style={styles.mapLoading}>
                <ActivityIndicator color="#007AFF" />
                <Text style={styles.mapLoadingText}>Calculating route...</Text>
              </View>
            ) : (
              <View>
                <RideMap
                  items={[]} // No markers, just route
                  routeCoordinates={routeCoordinates}
                  style={styles.mapPreview}
                  initialRegion={{
                    latitude: location.latitude,
                    longitude: location.longitude,
                    zoom: 10
                  }}
                />
                <TouchableOpacity 
                  style={styles.expandMapButton}
                  onPress={() => setShowRoutePreviewFull(true)}
                >
                  <Ionicons name="expand" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
            <Text style={styles.mapPreviewLabel}>
              Route Preview: {direction === "to_airport" ? "Pickup ➔ Airport" : "Airport ➔ Dropoff"}
            </Text>
          </View>
        )}

        {/* Date & Time */}
        <Text style={styles.label}>Departure Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar-outline" size={20} color="#007AFF" />
            <Text style={styles.dateTimeText}>{formatDate(departureDateTime)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time-outline" size={20} color="#007AFF" />
            <Text style={styles.dateTimeText}>{formatTime(departureDateTime)}</Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={departureDateTime}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(Platform.OS === "ios");
              if (selectedDate) {
                const newDate = new Date(departureDateTime);
                newDate.setFullYear(selectedDate.getFullYear());
                newDate.setMonth(selectedDate.getMonth());
                newDate.setDate(selectedDate.getDate());
                setDepartureDateTime(newDate);
              }
            }}
            minimumDate={new Date()}
          />
        )}

        <TimePickerModal
          visible={showTimePicker}
          initialDate={departureDateTime}
          onClose={() => setShowTimePicker(false)}
          onSelect={(date) => {
            setDepartureDateTime(date);
            setShowTimePicker(false);
          }}
        />

        {/* Available Seats */}
        <Text style={styles.label}>Available Seats</Text>
        <View style={styles.counterRow}>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setTotalSeats(Math.max(1, totalSeats - 1))}
          >
            <Ionicons name="remove-circle-outline" size={28} color={totalSeats > 1 ? "#007AFF" : "#ccc"} />
          </TouchableOpacity>
          <Text style={styles.counterValue}>{totalSeats}</Text>
          <TouchableOpacity
            style={styles.counterButton}
            onPress={() => setTotalSeats(Math.min(7, totalSeats + 1))}
          >
            <Ionicons name="add-circle-outline" size={28} color={totalSeats < 7 ? "#007AFF" : "#ccc"} />
          </TouchableOpacity>
        </View>

        {/* Luggage Capacity Section */}
        <Text style={styles.label}>Trunk Capacity (Luggages)</Text>
        <View style={styles.luggageContainer}>
          {([
            { key: 'max_10kg',       label: '🧳 Small Suitcase', sub: 'Up to 10kg' },
            { key: 'max_20kg',       label: '💼 Large Suitcase', sub: 'Up to 20kg' },
            { key: 'max_hors_norme', label: '📦 Oversized',      sub: 'Bulky items' },
            { key: 'max_sac',        label: '🎒 Cabin Bag',      sub: 'Handbag / Sac' },
          ] as const).map(({ key, label, sub }) => (
            <View key={key} style={styles.luggageRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.luggageLabel}>{label}</Text>
                <Text style={styles.luggageSub}>{sub}</Text>
              </View>
              <View style={styles.itemCounter}>
                <TouchableOpacity
                  onPress={() => setLuggageCapacity(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                  style={styles.stepButton}
                >
                  <Ionicons name="remove" size={20} color={luggageCapacity[key] > 0 ? "#007AFF" : "#ccc"} />
                </TouchableOpacity>

                <Text style={styles.counterValue}>{luggageCapacity[key]}</Text>

                <TouchableOpacity
                  onPress={() => setLuggageCapacity(prev => ({ ...prev, [key]: Math.min(10, prev[key] + 1) }))}
                  style={styles.stepButton}
                >
                  <Ionicons name="add" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* Price */}
        <Text style={styles.label}>Price per Seat</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currency}>EUR</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="0"
            keyboardType="numeric"
            value={pricePerSeat}
            onChangeText={setPricePerSeat}
          />
        </View>

        {/* Notes */}
        <Text style={styles.label}>Additional Notes (Optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="E.g., pickup details, vehicle info, luggage space..."
          value={driverComment}
          onChangeText={setDriverComment}
          multiline
          numberOfLines={3}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, isLoading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="car" size={20} color="#fff" />
              <Text style={styles.submitText}>Publish Ride</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 24,
    marginLeft: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
    marginTop: 16,
  },
  directionContainer: {
    flexDirection: "row",
    gap: 12,
  },
  directionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  directionActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  directionText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  directionTextActive: {
    color: "#fff",
  },
  airportSelectionRow: {
    flexDirection: "row",
    gap: 12,
  },
  airportSelector: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 10,
  },
  airportMapButton: {
    width: 50,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapHeader: {
    height: 60, 
    backgroundColor: '#fff', 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingTop: Platform.OS === 'ios' ? 10 : 0
  },
  mapHeaderTitle: {
    fontSize: 18, 
    fontWeight: '700'
  },
  airportSelectorText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  airportModalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 30,
  },
  airportModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  airportModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  airportSearchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  airportSearchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  airportListItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 12,
  },
  airportListItemActive: {
    backgroundColor: "#f0f7ff",
  },
  airportListItemLeft: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  airportListCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  airportListItemRight: {
    flex: 1,
  },
  airportListName: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  airportListCity: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  emptyAirportList: {
    padding: 30,
    alignItems: "center",
  },
  emptyAirportText: {
    fontSize: 14,
    color: "#999",
  },
  locationButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    gap: 10,
  },
  locationButtonText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  dateTimeText: {
    fontSize: 14,
    color: "#333",
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingVertical: 8,
  },
  counterButton: {
    flex: 1,
    alignItems: "center",
    padding: 8,
  },
  counterValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    minWidth: 40,
    textAlign: "center",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    paddingHorizontal: 14,
  },
  currency: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
  },
  notesInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    padding: 14,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#28a745",
    padding: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  submitButtonDisabled: {
    backgroundColor: "#aaa",
  },
  submitText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  mapPreviewContainer: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  mapPreview: {
    width: '100%',
    height: 200,
  },
  mapLoading: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  mapLoadingText: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
  },
  mapPreviewLabel: {
    padding: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  expandMapButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  luggageContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    overflow: "hidden",
    marginTop: 8,
  },
  luggageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  luggageLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  luggageSub: {
    fontSize: 12,
    color: '#888',
  },
  itemCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  stepButton: {
    padding: 8,
    paddingHorizontal: 12,
  },
});
