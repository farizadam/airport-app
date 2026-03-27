import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRequestStore } from "@/store/requestStore";
import { useAirportStore } from "@/store/airportStore";
import { useRideStore } from "@/store/rideStore";
import MapLocationPicker from "@/components/MapLocationPicker";
import LeafletMap from "@/components/LeafletMap";
import TimePickerModal from "../../../src/components/TimePickerModal";
import { toast } from "../../../src/store/toastStore";
import { Colors } from "@/constants/theme";

const palette = {
  bg: "#F3F7FF",
  surface: Colors.light.background,
  text: Colors.light.text,
  muted: "#64748B",
  border: "#DCE6F6",
  primary: "#007AFF",
  accent: "#1D4ED8",
};

export default function CreateRequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    prefillAirportId?: string;
    prefillDirection?: string;
    prefillDate?: string;
    prefillLocationAddress?: string;
    prefillLocationLat?: string;
    prefillLocationLng?: string;
  }>();

  const { createRequest, loading, error } = useRequestStore();
  const { airports, fetchAirports } = useAirportStore();
  const { searchRides, rides } = useRideStore();

  const [airportId, setAirportId] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [showAirportDropdown, setShowAirportDropdown] = useState(false);
  const [showAirportMap, setShowAirportMap] = useState(false);
  const [direction, setDirection] = useState<"to_airport" | "from_airport">(
    "to_airport"
  );
  const [location, setLocation] = useState<{
    address: string;
    city: string;
    postcode: string;
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [preferredDateTime, setPreferredDateTime] = useState(new Date());
  const [tempDate, setTempDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeFlexibility, setTimeFlexibility] = useState("30");
  const [seatsNeeded, setSeatsNeeded] = useState("1");
  const [luggageCount, setLuggageCount] = useState("1"); // legacy, kept for seats display
  const [luggage, setLuggage] = useState({
    '10kg': 0,
    '20kg': 0,
    'hors_norme': 0,
    'sac': 0,
  });
  const [maxPrice, setMaxPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const airportMapSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        limit: 80,
      });
    }, 1200);
  };

  useEffect(() => {
    fetchAirports();
  }, []);

  // Handle prefill parameters when airports are loaded
  useEffect(() => {
    if (hasPrefilled || airports.length === 0) return;

    if (params.prefillAirportId) {
      setAirportId(params.prefillAirportId);
      const airport = airports.find((a: any) => (a._id || a.id) === params.prefillAirportId);
      if (airport) {
        setAirportSearch(airport.name);
      }
    }

    if (params.prefillDirection) {
      setDirection(params.prefillDirection as "to_airport" | "from_airport");
    }

    if (params.prefillDate) {
      setPreferredDateTime(new Date(params.prefillDate));
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

  // Get selected airport details
  const selectedAirport = airports.find(
    (a: any) => (a._id || a.id) === airportId
  );

  const handleSubmit = async () => {
    if (!airportId) {
      toast.warning("Missing Airport", "Please select an airport");
      return;
    }
    if (!location) {
      toast.warning("Missing Location", "Please select your pickup/dropoff location");
      return;
    }

    try {
      await createRequest({
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
        luggage: Object.entries(luggage)
          .filter(([, qty]) => qty > 0)
          .map(([type, quantity]) => ({ type, quantity })),
        max_price_per_seat: maxPrice ? parseFloat(maxPrice) : undefined,
        notes: notes || undefined,
      });

      // Search for matching rides based on request criteria
      const searchDate = preferredDateTime.toISOString().split("T")[0];
      try {
        await searchRides({
          airport_id: airportId,
          direction: direction,
          date: searchDate,
          seats_min: parseInt(seatsNeeded) || 1,
        });
      } catch (searchErr) {
        console.log("Error searching for matching rides:", searchErr);
      }

      // Check if there are matching rides
      const { rides: matchingRides } = useRideStore.getState();

      if (matchingRides && matchingRides.length > 0) {
        // Found matching rides - show notification with option to view them
        // Pass all the search criteria so results page can use them
        toast.success(
          "🎉 Good News!",
          `Your request has been posted! We found ${matchingRides.length} ride${matchingRides.length > 1 ? 's' : ''} that match your criteria. Would you like to view them?`,
          [
            {
              label: "View Rides",
              onPress: () => router.replace({
                pathname: "/(tabs)/rides/results",
                params: {
                  direction: direction,
                  airportId: airportId,
                  airportCode: selectedAirport?.iata_code || "",
                  airportName: selectedAirport?.name || "",
                  locationAddress: location.address,
                  locationLat: String(location.latitude),
                  locationLng: String(location.longitude),
                  date: searchDate,
                  includeTime: "false",
                  seatsMin: seatsNeeded,
                  fromRequest: "true",
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
        // No matching rides found
        toast.success(
          "Request Posted!",
          "Your ride request has been posted. We'll notify you when drivers are available. Would you like to see available rides?",
          [
            {
              label: "View Available Rides",
              onPress: () => router.replace({
                pathname: "/(tabs)/rides/search",
                params: {
                  prefillAirportId: airportId,
                  prefillDirection: direction,
                  prefillDate: searchDate,
                  prefillLocationAddress: location.address,
                  prefillLocationLat: String(location.latitude),
                  prefillLocationLng: String(location.longitude),
                  autoSearch: "true",
                }
              })
            },
            {
              label: "OK",
              onPress: () => router.replace("/(tabs)")
            }
          ]
        );
      }
    } catch (err: any) {
      toast.error("Error", err.message);
    }
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

        {/* Airport Map Modal - outside ScrollView to avoid safe-area context issues */}
        <Modal
          visible={showAirportMap}
          animationType="slide"
          onRequestClose={() => setShowAirportMap(false)}
        >
          <View style={{ flex: 1 }}>
            <View style={[styles.mapHeader, styles.mapHeaderSafeArea, { paddingTop: insets.top || 44 }]}>
                <Text style={styles.mapHeaderTitle}>Explore Airports</Text>
                <TouchableOpacity
                  onPress={() => setShowAirportMap(false)}
                  style={styles.mapCloseButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={24} color="#000" />
                </TouchableOpacity>
            </View>
            <LeafletMap
              mode="view"
              initialRegion={{ latitude: 48.8566, longitude: 2.3522, zoom: 5 }}
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

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={{ paddingBottom: 60 + insets.bottom }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Request a Ride</Text>
          </View>

          <Text style={styles.subtitle}>
            Post your ride request and let drivers find you
          </Text>

          <View style={styles.heroCard}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles" size={14} color={palette.accent} />
              <Text style={styles.heroBadgeText}>Quick Request</Text>
            </View>
            <Text style={styles.heroTitle}>Tell drivers what you need</Text>
            <Text style={styles.heroSubtitle}>
              Add your route, date, seats, and budget. Nearby drivers can match and respond fast.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Trip Direction</Text>
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
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Airport</Text>
            <View style={styles.airportSelectionRow}>
              <TouchableOpacity
                style={styles.airportSelector}
                onPress={() => setShowAirportDropdown(true)}
              >
                <Ionicons name="airplane" size={20} color="#007AFF" />
                <Text style={styles.airportSelectorText}>
                  {airportId
                    ? `${airports.find((a) => a._id === airportId)?.name} (${airports.find((a) => a._id === airportId)?.iata_code
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
          </View>

          {/* Airport Search Modal */}
          <Modal
            visible={showAirportDropdown}
            animationType="slide"
            transparent={true}
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
                      autoFocus
                    />
                    {airportSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setAirportSearch("")}>
                        <Ionicons name="close-circle" size={20} color="#999" />
                      </TouchableOpacity>
                    )}
                  </View>

                  <FlatList
                    data={airports.filter(
                      (airport) =>
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
                    keyExtractor={(item, index) =>
                      item._id || item.id || String(index)
                    }
                    initialNumToRender={20}
                    maxToRenderPerBatch={30}
                    windowSize={10}
                    renderItem={({ item: airport }) => (
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
                        <View style={styles.airportIconCircle}>
                          <Ionicons name="airplane" size={18} color="#fff" />
                        </View>
                        {!!airport.iata_code && (
                          <View style={styles.airportCodeBadge}>
                            <Text style={styles.airportListCode}>
                              {airport.iata_code.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.airportListItemRight}>
                          <Text style={styles.airportListName}>{airport.name}</Text>
                          <Text style={styles.airportListCity}>
                            {airport.city}, {airport.country}
                          </Text>
                        </View>
                        {airportId === (airport._id || airport.id)
                          ? <Ionicons name="checkmark-circle" size={24} color="#007AFF" />
                          : <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                        }
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
            </KeyboardAvoidingView>
          </Modal>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
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

            <View style={styles.dateTimeCard}>
              <View style={styles.dateTimeHeader}>
                <Text style={[styles.label, styles.dateTimeLabel]}>Preferred Date & Time</Text>
                <Text style={styles.dateTimeHint}>Pick when you want to travel</Text>
              </View>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => {
                    setTempDate(preferredDateTime);
                    setShowDatePicker(true);
                  }}
                >
                  <View style={styles.dateTimeIconWrap}>
                    <Ionicons name="calendar" size={18} color="#007AFF" />
                  </View>
                  <View style={styles.dateTimeContent}>
                    <Text style={styles.dateTimeCaption}>Date</Text>
                    <Text style={styles.dateTimeText}>
                      {preferredDateTime.toLocaleDateString()}
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <View style={styles.dateTimeIconWrap}>
                    <Ionicons name="time" size={18} color="#007AFF" />
                  </View>
                  <View style={styles.dateTimeContent}>
                    <Text style={styles.dateTimeCaption}>Time</Text>
                    <Text style={styles.dateTimeText}>
                      {preferredDateTime.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={styles.datePickerOverlay}>
              <View style={styles.datePickerSheet}>
                <View style={styles.datePickerHeader}>
                  <Text style={styles.datePickerTitle}>Choose Date</Text>
                  <TouchableOpacity
                    style={styles.datePickerClose}
                    onPress={() => setShowDatePicker(false)}
                  >
                    <Ionicons name="close" size={20} color="#334155" />
                  </TouchableOpacity>
                </View>

                <DateTimePicker
                  value={tempDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "inline" : "calendar"}
                  themeVariant={Platform.OS === "ios" ? "light" : undefined}
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    if (Platform.OS === "android") {
                      setShowDatePicker(false);
                      if (event.type === "set" && date) {
                        setPreferredDateTime(date);
                      }
                      return;
                    }

                    if (date) setTempDate(date);
                  }}
                />

                {Platform.OS === "ios" && (
                  <View style={styles.datePickerActions}>
                    <TouchableOpacity
                      style={[styles.datePickerActionBtn, styles.datePickerCancelBtn]}
                      onPress={() => setShowDatePicker(false)}
                    >
                      <Text style={styles.datePickerCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.datePickerActionBtn, styles.datePickerDoneBtn]}
                      onPress={() => {
                        setPreferredDateTime(tempDate);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.datePickerDoneText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <TimePickerModal
            visible={showTimePicker}
            initialDate={preferredDateTime}
            onClose={() => setShowTimePicker(false)}
            onSelect={(date: Date) => {
              setPreferredDateTime(date);
              setShowTimePicker(false);
            }}
          />

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Time Flexibility (minutes)</Text>
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
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Seats Needed</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => setSeatsNeeded(Math.max(1, parseInt(seatsNeeded) - 1).toString())}
              >
                <Ionicons name="remove" size={20} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.counterValue}>{seatsNeeded}</Text>
              <TouchableOpacity
                style={styles.counterButton}
                onPress={() => setSeatsNeeded((parseInt(seatsNeeded) + 1).toString())}
              >
                <Ionicons name="add" size={20} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>My Luggage</Text>
            <View style={styles.luggageContainer}>
              {([
                { key: '10kg' as const, label: '🧳 Small Suitcase', sub: 'Up to 10kg' },
                { key: '20kg' as const, label: '💼 Large Suitcase', sub: 'Up to 20kg' },
                { key: 'hors_norme' as const, label: '📦 Oversized', sub: 'Bulky items' },
                { key: 'sac' as const, label: '🎒 Cabin Bag', sub: 'Handbag / Sac' },
              ]).map(({ key, label, sub }) => (
                <View key={key} style={styles.luggageRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.luggageLabel}>{label}</Text>
                    <Text style={styles.luggageSub}>{sub}</Text>
                  </View>
                  <View style={styles.itemCounter}>
                    <TouchableOpacity
                      onPress={() => setLuggage(prev => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }))}
                      style={styles.stepButton}
                    >
                      <Ionicons name="remove" size={20} color={luggage[key] > 0 ? "#007AFF" : "#ccc"} />
                    </TouchableOpacity>
                    <Text style={styles.counterValue}>{luggage[key]}</Text>
                    <TouchableOpacity
                      onPress={() => setLuggage(prev => ({ ...prev, [key]: Math.min(10, prev[key] + 1) }))}
                      style={styles.stepButton}
                    >
                      <Ionicons name="add" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Max Price per Seat (Optional)</Text>
            <View style={styles.inputContainer}>
              <Text style={styles.currency}>EUR</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="e.g., 150"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                autoCorrect={false}
                autoComplete="off"
                spellCheck={false}
                textContentType="none"
                value={maxPrice}
                onChangeText={setMaxPrice}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Additional Notes (Optional)</Text>
            <TextInput
              style={styles.notesInput}
              placeholder="Any special requirements..."
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={3}
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              textContentType="none"
              value={notes}
              onChangeText={setNotes}
            />
          </View>

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
                <Ionicons name="send" size={20} color="#fff" />
                <Text style={styles.submitText}>Post Request</Text>
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
    backgroundColor: palette.bg,
  },
  scrollView: {
    flex: 1,
    padding: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    marginTop: 28,
  },
  backButton: {
    marginRight: 14,
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: palette.border,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: palette.text,
  },
  subtitle: {
    fontSize: 14,
    color: palette.muted,
    marginBottom: 14,
    marginLeft: 52,
  },
  heroCard: {
    backgroundColor: "#EAF2FF",
    borderWidth: 1,
    borderColor: "#D2E2FF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  heroBadgeText: {
    color: palette.accent,
    fontWeight: "700",
    fontSize: 12,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 4,
  },
  heroSubtitle: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: palette.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: palette.text,
    marginBottom: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.text,
    marginBottom: 8,
    marginTop: 0,
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
    height: 50,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  mapHeaderSafeArea: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  mapHeader: {
    minHeight: 56,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  mapCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
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
  dateTimeCard: {
    marginTop: 4,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFF",
    borderWidth: 1,
    borderColor: "#DCE8FF",
  },
  dateTimeHeader: {
    marginBottom: 10,
  },
  dateTimeLabel: {
    marginTop: 0,
    marginBottom: 4,
  },
  dateTimeHint: {
    fontSize: 12,
    color: "#64748B",
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 12,
  },
  dateTimeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D7E3FC",
    shadowColor: "#1E3A8A",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 1,
  },
  dateTimeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  dateTimeContent: {
    flex: 1,
  },
  dateTimeCaption: {
    fontSize: 11,
    color: "#64748B",
    marginBottom: 2,
  },
  dateTimeText: {
    fontSize: 14,
    color: "#0F172A",
    fontWeight: "600",
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.35)",
  },
  datePickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 22,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  datePickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  datePickerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
  },
  datePickerClose: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  datePickerActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  datePickerCancelBtn: {
    backgroundColor: "#EEF2FF",
  },
  datePickerDoneBtn: {
    backgroundColor: "#007AFF",
  },
  datePickerCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
  },
  datePickerDoneText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
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
    color: "#0F172A",
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
    color: "#0F172A",
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
  halfRow: {
    // Seats stepper used standalone (full width) now
  },
  luggageContainer: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginTop: 0,
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
  airportIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  airportCodeBadge: {
    backgroundColor: "#007AFF20",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
