import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRideStore } from "../../../src/store/rideStore";
import { useAirportStore } from "../../../src/store/airportStore";
import MapLocationPicker from "../../../src/components/MapLocationPicker";
import LeafletMap from "@/components/LeafletMap";
import { Airport, Ride } from "../../../src/types";

export default function EditRideScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  
  const { updateRide, fetchRideById, isLoading } = useRideStore();
  const { airports, fetchAirports } = useAirportStore();

  const [ride, setRide] = useState<Ride | null>(null);
  const [airportId, setAirportId] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [showAirportDropdown, setShowAirportDropdown] = useState(false);
  const [showAirportMap, setShowAirportMap] = useState(false); // New state

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
  const [pricePerSeat, setPricePerSeat] = useState("");
  const [driverComment, setDriverComment] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    fetchAirports();
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!id) return;
      
      try {
        // Fetch fresh data
        const data = await fetchRideById(id);
        setRide(data);
      } catch (error) {
        console.error("Failed to fetch ride:", error);
        Alert.alert("Error", "Failed to load ride details");
        router.back();
      }
    };
    init();
  }, [id]);

  useEffect(() => {
    if (ride && isInitializing && ride.id === id) {
        // Pre-fill form
        const aId = (typeof ride.airport_id === 'object' && ride.airport_id !== null) 
            ? (ride.airport_id as any)._id 
            : ride.airport_id;
            
        setAirportId(aId || "");
        
        const airportName = ride.airport?.name || ride.airport_name;
        if (airportName) setAirportSearch(airportName);

        // Handle direction mapping if needed, but usually it matches
        // Frontend uses "to_airport" / "from_airport"
        // Backend stores "home_to_airport" / "airport_to_home" but transforms it in getById
        // currentRide from store should have frontend format
        setDirection(ride.direction as "to_airport" | "from_airport");
        
        if (ride.home_address) {
            setLocation({
                address: ride.home_address,
                city: ride.home_city || "",
                postcode: ride.home_postcode || "",
                latitude: 0, // Placeholder as we don't store coords
                longitude: 0, 
            });
        }

        if (ride.departure_datetime) {
            setDepartureDateTime(new Date(ride.departure_datetime));
        }

        setTotalSeats(ride.seats_total || ride.total_seats || 3);
        setPricePerSeat(String(ride.price_per_seat || ""));
        setDriverComment(ride.driver_comment || ride.comment || "");
        
        setIsInitializing(false);
    }
  }, [ride, id]);


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
      Alert.alert("Error", "Please select an airport");
      return;
    }
    if (!location?.address) {
      Alert.alert("Error", "Please select your pickup/dropoff location");
      return;
    }
    if (!pricePerSeat) {
      Alert.alert("Error", "Please enter a price per seat");
      return;
    }

    const postcode = location.postcode || "00000";

    try {
      await updateRide(id!, {
        airport_id: airportId,
        direction,
        home_address: location.address,
        home_city: location.city || "Unknown",
        home_postcode: postcode,
        departure_datetime: departureDateTime.toISOString(),
        total_seats: totalSeats,
        price_per_seat: parseFloat(pricePerSeat),
        driver_comment: driverComment.trim() || undefined,
      });

      Alert.alert("Success", "Ride updated successfully", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=myrides") }
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to update ride");
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
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (isInitializing) {
      return (
          <View style={[styles.container, styles.loadingContainer]}>
              <ActivityIndicator size="large" color="#007AFF" />
          </View>
      );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <MapLocationPicker
        visible={showMap}
        onClose={() => setShowMap(false)}
        onSelectLocation={handleLocationSelect}
        initialLocation={
          location && location.latitude !== 0
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
          <Text style={styles.title}>Edit Ride</Text>
        </View>

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
              markers={airports.map(a => ({
                id: a._id || a.id,
                latitude: a.latitude,
                longitude: a.longitude,
                title: `${a.iata_code} - ${a.name}`,
                type: 'airport'
              }))}
              selectedId={airportId} // Pass selected airport ID
              onMarkerClick={(id) => {
                setAirportId(id);
                setShowAirportMap(false);
              }}
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

        {showTimePicker && (
          <DateTimePicker
            value={departureDateTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, selectedTime) => {
              setShowTimePicker(Platform.OS === "ios");
              if (selectedTime) {
                const newDate = new Date(departureDateTime);
                newDate.setHours(selectedTime.getHours());
                newDate.setMinutes(selectedTime.getMinutes());
                setDepartureDateTime(newDate);
              }
            }}
          />
        )}

        {/* Available Seats */}
        <Text style={styles.label}>Total Seats</Text>
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

        {/* Price */}
        <Text style={styles.label}>Price per Seat</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currency}>MAD</Text>
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
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.submitText}>Update Ride</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  loadingContainer: {
      justifyContent: "center",
      alignItems: "center"
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
  airportSelectionRow: { // New style
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
  airportMapButton: { // New style
    width: 50,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapHeader: { // New style
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
  mapHeaderTitle: { // New style
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
    backgroundColor: "#007AFF",
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
});
