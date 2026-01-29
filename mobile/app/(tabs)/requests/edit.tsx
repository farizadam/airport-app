import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRequestStore } from "../../../src/store/requestStore";
import { useAirportStore } from "../../../src/store/airportStore";
import MapLocationPicker from "../../../src/components/MapLocationPicker";
import LeafletMap from "../../../src/components/LeafletMap"; // New import
import { RideRequest } from "../../../src/types";

export default function EditRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params?.id;
  
  // @ts-ignore
  const { updateRequest, loading, fetchRequestById } = useRequestStore();
  const { airports, fetchAirports } = useAirportStore();

  const [request, setRequest] = useState<RideRequest | null>(null);
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
  const [preferredDateTime, setPreferredDateTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeFlexibility, setTimeFlexibility] = useState("30");
  const [seatsNeeded, setSeatsNeeded] = useState("1");
  const [luggageCount, setLuggageCount] = useState("1");
  const [maxPrice, setMaxPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    fetchAirports();
  }, []);

  useEffect(() => {
    const loadRequest = async () => {
      if (id) {
        try {
          const data = await fetchRequestById(id);
          setRequest(data);
        } catch (error: any) {
          console.error("Failed to load request:", error);
          Alert.alert("Error", "Failed to load request details");
          router.back();
        }
      }
    };
    loadRequest();
  }, [id]);

  useEffect(() => {
    if (request && isInitializing && request._id === id) {
      // Pre-fill form
      const aId = (typeof request.airport === 'object' && request.airport !== null) 
          ? (request.airport as any)._id 
          : request.airport;
          
      setAirportId(aId || "");
      
      // Find airport name for search box
      const airportObj = typeof request.airport === 'object' ? request.airport : 
                        airports.find((a: any) => a._id === aId || a.id === aId);
      
      if (airportObj) {
          setAirportSearch((airportObj as any).name || "");
      }

      setDirection(request.direction);
      
      if (request.location_address) {
          setLocation({
              address: request.location_address,
              city: request.location_city || "",
              postcode: request.location_postcode || "",
              latitude: request.location_latitude || 0,
              longitude: request.location_longitude || 0,
          });
      }

      if (request.preferred_datetime) {
          setPreferredDateTime(new Date(request.preferred_datetime));
      }

      setTimeFlexibility(String(request.time_flexibility || "30"));
      setSeatsNeeded(String(request.seats_needed || "1"));
      setLuggageCount(String(request.luggage_count || "0"));
      setMaxPrice(request.max_price_per_seat ? String(request.max_price_per_seat) : "");
      setNotes(request.notes || "");
      
      setIsInitializing(false);
    }
  }, [request, id, airports]);

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
    if (!location) {
      Alert.alert("Error", "Please select your pickup/dropoff location");
      return;
    }

    try {
      await updateRequest(id, {
        airport_id: airportId,
        direction,
        location_address: location.address,
        location_city: location.city || location.address.split(",")[0] || "Home",
        location_postcode: location.postcode || "00000",
        location_latitude: location.latitude,
        location_longitude: location.longitude,
        preferred_datetime: preferredDateTime.toISOString(),
        time_flexibility: parseInt(timeFlexibility) || 30,
        seats_needed: parseInt(seatsNeeded) || 1,
        luggage_count: parseInt(luggageCount) || 1,
        max_price_per_seat: maxPrice ? parseFloat(maxPrice) : undefined,
        notes: notes || undefined,
      });

      Alert.alert("Success", "Request updated successfully", [
        { text: "OK", onPress: () => router.replace("/(tabs)/explore?tab=myrequests") }
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update request");
    }
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
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Edit Request</Text>
        </View>

        {/* Direction Selection */}
        <Text style={styles.label}>Direction</Text>
        <View style={styles.directionContainer}>
          <TouchableOpacity
            style={[
              styles.directionButton,
              direction === "to_airport" && styles.directionActive,
            ]}
            onPress={() => setDirection("to_airport")}
          >
            <Ionicons
              name="airplane"
              size={20}
              color={direction === "to_airport" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.directionText,
                direction === "to_airport" && styles.directionTextActive,
              ]}
            >
              To Airport
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.directionButton,
              direction === "from_airport" && styles.directionActive,
            ]}
            onPress={() => setDirection("from_airport")}
          >
            <Ionicons
              name="home"
              size={20}
              color={direction === "from_airport" ? "#fff" : "#666"}
            />
            <Text
              style={[
                styles.directionText,
                direction === "from_airport" && styles.directionTextActive,
              ]}
            >
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
            <Ionicons name="airplane" size={20} color="#007AFF" />
            <Text style={styles.airportSelectorText}>
              {airportId
                ? `${airports.find((a: any) => (a._id || a.id) === airportId)?.name} (${
                    airports.find((a: any) => (a._id || a.id) === airportId)?.iata_code
                  })`
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

        {/* Airport Search Modal */}
        <Modal
          visible={showAirportDropdown}
          animationType="slide"
          transparent={true}
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
                {airportSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setAirportSearch("")}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={airports.filter(
                  (airport: any) =>
                    airport.name
                      ?.toLowerCase()
                      .includes(airportSearch.toLowerCase()) ||
                    airport.iata_code
                      ?.toLowerCase()
                      .includes(airportSearch.toLowerCase()) ||
                    airport.city
                      ?.toLowerCase()
                      .includes(airportSearch.toLowerCase())
                )}
                keyExtractor={(item: any, index) =>
                  item._id || item.id || String(index)
                }
                renderItem={({ item: airport }: {item: any}) => (
                  <TouchableOpacity
                    style={[
                      styles.airportListItem,
                      airportId === (airport._id || airport.id) &&
                        styles.airportListItemActive,
                    ]}
                    onPress={() => {
                      const id = airport._id || airport.id;
                      if (id) setAirportId(id);
                      setShowAirportDropdown(false);
                      setAirportSearch("");
                    }}
                  >
                    <View style={styles.airportListItemLeft}>
                      <Text style={styles.airportListCode}>
                        {airport.iata_code}
                      </Text>
                    </View>
                    <View style={styles.airportListItemRight}>
                      <Text style={styles.airportListName}>{airport.name}</Text>
                      <Text style={styles.airportListCity}>
                        {airport.city}, {airport.country}
                      </Text>
                    </View>
                    {airportId === (airport._id || airport.id) && (
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#007AFF"
                      />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyAirportList}>
                    <Text style={styles.emptyAirportText}>
                      No airports found
                    </Text>
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
                (airports.find((a: any) => (a._id || a.id) === airportId))
                  ? { latitude: (airports.find((a: any) => (a._id || a.id) === airportId))?.latitude, longitude: (airports.find((a: any) => (a._id || a.id) === airportId))?.longitude, zoom: 10 }
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

        {/* Location Selection */}
        <Text style={styles.label}>
          {direction === "to_airport" ? "Pickup Location" : "Dropoff Location"}
        </Text>
        <TouchableOpacity
          style={styles.locationButton}
          onPress={() => setShowMap(true)}
        >
          <Ionicons name="location" size={20} color="#007AFF" />
          <Text style={styles.locationButtonText}>
            {location ? location.address : "Select on Map"}
          </Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        {/* Date & Time */}
        <Text style={styles.label}>Preferred Date & Time</Text>
        <View style={styles.dateTimeRow}>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Ionicons name="calendar" size={20} color="#007AFF" />
            <Text style={styles.dateTimeText}>
              {preferredDateTime.toLocaleDateString()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.dateTimeButton}
            onPress={() => setShowTimePicker(true)}
          >
            <Ionicons name="time" size={20} color="#007AFF" />
            <Text style={styles.dateTimeText}>
              {preferredDateTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={preferredDateTime}
            mode="date"
            minimumDate={new Date()}
            onChange={(event, date) => {
              setShowDatePicker(false);
              if (date) setPreferredDateTime(date);
            }}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={preferredDateTime}
            mode="time"
            onChange={(event, date) => {
              setShowTimePicker(false);
              if (date) setPreferredDateTime(date);
            }}
          />
        )}

        {/* Time Flexibility */}
        <Text style={styles.label}>Time Flexibility (minutes)</Text>
        <View style={styles.flexibilityRow}>
          {["15", "30", "60", "120"].map((min) => (
            <TouchableOpacity
              key={min}
              style={[
                styles.flexChip,
                timeFlexibility === min && styles.flexChipActive,
              ]}
              onPress={() => setTimeFlexibility(min)}
            >
              <Text
                style={[
                  styles.flexChipText,
                  timeFlexibility === min && styles.flexChipTextActive,
                ]}
              >
                ±{min}min
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Seats & Luggage */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Seats Needed</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setSeatsNeeded(
                    Math.max(1, parseInt(seatsNeeded) - 1).toString()
                  )
                }
              >
                <Ionicons name="remove" size={20} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{seatsNeeded}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setSeatsNeeded((parseInt(seatsNeeded) + 1).toString())
                }
              >
                <Ionicons name="add" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Luggage</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setLuggageCount(
                    Math.max(0, parseInt(luggageCount) - 1).toString()
                  )
                }
              >
                <Ionicons name="remove" size={20} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{luggageCount}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() =>
                  setLuggageCount((parseInt(luggageCount) + 1).toString())
                }
              >
                <Ionicons name="add" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Max Price */}
        <Text style={styles.label}>Max Price per Seat (optional)</Text>
        <View style={styles.inputContainer}>
          <Text style={styles.currency}>MAD</Text>
          <TextInput
            style={styles.priceInput}
            placeholder="e.g., 150"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
          />
        </View>

        {/* Notes */}
        <Text style={styles.label}>Additional Notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          placeholder="Any special requirements..."
          multiline
          numberOfLines={3}
          value={notes}
          onChangeText={setNotes}
        />

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save" size={20} color="#fff" />
              <Text style={styles.submitText}>Update Request</Text>
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
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 40,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
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
  flexibilityRow: {
    flexDirection: "row",
    gap: 8,
  },
  flexChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  flexChipActive: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  flexChipText: {
    fontSize: 13,
    color: "#666",
  },
  flexChipTextActive: {
    color: "#fff",
  },
  row: {
    flexDirection: "row",
    gap: 16,
  },
  halfInput: {
    flex: 1,
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
