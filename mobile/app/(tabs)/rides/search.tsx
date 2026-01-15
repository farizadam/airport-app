import { useAirportStore } from "@/store/airportStore";
import { useRideStore } from "@/store/rideStore";
import { useRequestStore } from "@/store/requestStore";
import { Airport } from "@/types";
import MapLocationPicker, { MapLocationData } from "@/components/MapLocationPicker";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState, useRef } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type SearchStep = "airport" | "location" | "datetime" | "results";

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
}

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    direction?: "to_airport" | "from_airport";
    prefillAirportId?: string;
    prefillDirection?: string;
    prefillDate?: string;
    prefillLocationAddress?: string;
    prefillLocationLat?: string;
    prefillLocationLng?: string;
    autoSearch?: string; // If "true", auto-trigger search and show results
  }>();
  
  const { airports, fetchAirports, isLoading: airportsLoading } = useAirportStore();
  const { rides, searchRides, isLoading: ridesLoading } = useRideStore();
  const { availableRequests, getAvailableRequests, loading: requestsLoading } = useRequestStore();
  
  // Search state
  const [step, setStep] = useState<SearchStep>("airport");
  const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
  const [airportSearch, setAirportSearch] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [includeTime, setIncludeTime] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapInitialLocation, setMapInitialLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [searchDirection, setSearchDirection] = useState<"to_airport" | "from_airport">(
    (params.direction || params.prefillDirection || "to_airport") as "to_airport" | "from_airport"
  );
  
  // Location autocomplete state
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [isLocationInputFocused, setIsLocationInputFocused] = useState(false);
  const searchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const locationScrollRef = useRef<ScrollView>(null);

  // Load airports on mount and handle prefill
  useEffect(() => {
    fetchAirports();
  }, []);

  // Handle prefill parameters when airports are loaded
  useEffect(() => {
    if (airports.length === 0) return;
    
    let shouldAutoSearch = params.autoSearch === "true";
    
    // Prefill airport
    if (params.prefillAirportId) {
      const prefillAirport = airports.find(
        (a: Airport) => (a._id || a.id) === params.prefillAirportId
      );
      if (prefillAirport) {
        setSelectedAirport(prefillAirport);
        setAirportSearch(prefillAirport.name);
      }
    }
    
    // Handle prefill date
    if (params.prefillDate) {
      setSelectedDate(new Date(params.prefillDate));
    }
    
    // Handle prefill direction
    if (params.prefillDirection) {
      setSearchDirection(params.prefillDirection as "to_airport" | "from_airport");
    }
    
    // Handle prefill location
    if (params.prefillLocationAddress) {
      setLocationAddress(params.prefillLocationAddress);
    }
    if (params.prefillLocationLat && params.prefillLocationLng) {
      setLocationCoords({
        lat: parseFloat(params.prefillLocationLat),
        lng: parseFloat(params.prefillLocationLng),
      });
    }
    
    // Auto-search if all required params are provided
    if (shouldAutoSearch && params.prefillAirportId) {
      // Trigger search directly - go to results step
      const runAutoSearch = async () => {
        const prefillAirport = airports.find(
          (a: Airport) => (a._id || a.id) === params.prefillAirportId
        );
        if (!prefillAirport) return;
        
        setSelectedAirport(prefillAirport);
        setIsSearching(true);
        setStep("results");
        
        try {
          const airportId = prefillAirport._id || prefillAirport.id;
          const direction = (params.prefillDirection || "to_airport") as "to_airport" | "from_airport";
          
          await Promise.all([
            searchRides({ airport_id: airportId, direction }),
            getAvailableRequests({ airport_id: airportId, direction }),
          ]);
          
          // Process results will be handled by the existing logic
        } catch (error) {
          console.error("Auto-search error:", error);
        }
        setIsSearching(false);
      };
      
      runAutoSearch();
    } else if (params.prefillAirportId && !shouldAutoSearch) {
      // Just prefill but don't auto-search - move to location step
      setStep("location");
    }
  }, [airports, params.prefillAirportId, params.prefillDate, params.prefillDirection, params.prefillLocationAddress, params.autoSearch]);

  // Get current location
  const handleGetMyLocation = async () => {
    setGettingLocation(true);
    try {
      // First try IP-based geolocation (works without Google Play Services)
      try {
        const response = await fetch("http://ip-api.com/json/?fields=status,city,regionName,country,lat,lon");
        const data = await response.json();
        if (data.status === "success") {
          const address = `${data.city}, ${data.regionName}, ${data.country}`;
          setLocationAddress(address);
          setLocationCoords({ lat: data.lat, lng: data.lon });
          setGettingLocation(false);
          return;
        }
      } catch (ipError) {
        console.log("IP geolocation failed, trying device location");
      }

      // Fallback to device location
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required to use this feature");
        setGettingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [reverseGeo] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeo) {
        const address = [reverseGeo.city, reverseGeo.region, reverseGeo.country]
          .filter(Boolean)
          .join(", ");
        setLocationAddress(address);
        setLocationCoords({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      }
    } catch (error) {
      console.error("Location error:", error);
      Alert.alert("Error", "Could not get your location. Please enter manually.");
    }
    setGettingLocation(false);
  };


  // Handle location selected from map
  const handleMapLocationSelect = (location: MapLocationData) => {
    setLocationAddress(location.address);
    setLocationCoords({
      lat: location.latitude,
      lng: location.longitude,
    });
    setShowLocationSuggestions(false);
  };

  // Search for location suggestions using Nominatim
  const searchLocationSuggestions = async (query: string) => {
    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowLocationSuggestions(false);
      return;
    }

    setIsSearchingLocation(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`,
        { headers: { "User-Agent": "CovoitAirApp/1.0" } }
      );
      const data = await response.json();
      setLocationSuggestions(data);
      setShowLocationSuggestions(data.length > 0);
      // Keep keyboard open so user can continue typing or see results
    } catch (error) {
      console.error("Location search error:", error);
      setLocationSuggestions([]);
    } finally {
      setIsSearchingLocation(false);
    }
  };

  // Handle location input change with debouncing
  const handleLocationInputChange = (text: string) => {
    setLocationAddress(text);
    setLocationCoords(null); // Clear coords until user selects a suggestion
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Debounce the search
    searchTimeoutRef.current = global.setTimeout(() => {
      searchLocationSuggestions(text);
    }, 500);
  };

  // Handle selecting a location suggestion
  const handleSelectLocationSuggestion = (suggestion: any, openMap: boolean = false) => {
    const displayName = suggestion.display_name;
    const shortName = displayName.split(",").slice(0, 3).join(",");
    
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);
    
    setLocationAddress(shortName);
    setLocationCoords({ lat, lng });
    setShowLocationSuggestions(false);
    setLocationSuggestions([]);
    Keyboard.dismiss();
    
    // Open map to show/confirm the location
    if (openMap) {
      // Set map location BEFORE opening to ensure it uses correct coords
      setMapInitialLocation({ latitude: lat, longitude: lng });
      // Small delay to let state update
      global.setTimeout(() => {
        setShowMapPicker(true);
      }, 150);
    }
  };

  // Filter airports based on search
  const filteredAirports = airports.filter((airport: Airport) => {
    const searchLower = airportSearch.toLowerCase();
    return (
      airport.name.toLowerCase().includes(searchLower) ||
      airport.iata_code.toLowerCase().includes(searchLower) ||
      airport.city.toLowerCase().includes(searchLower) ||
      airport.country.toLowerCase().includes(searchLower)
    );
  });

  const handleSelectAirport = (airport: Airport) => {
    setSelectedAirport(airport);
    Keyboard.dismiss();
    setStep("location");
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const handleTimeChange = (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      setSelectedDate(date);
      setIncludeTime(true);
    }
  };

  const handleSearch = async () => {
    if (!selectedAirport) return;
    
    setIsSearching(true);
    setStep("results");
    
    try {
      // Fetch rides and requests for this airport
      const airportId = selectedAirport._id || selectedAirport.id;
      await Promise.all([
        searchRides({ airport_id: airportId, direction: searchDirection }),
        getAvailableRequests({ airport_id: airportId, direction: searchDirection }),
      ]);
      
      // Process results
      const results: SearchResult[] = [];
      const searchDate = new Date(selectedDate);
      
      // Process rides
      rides?.forEach((ride: any) => {
        const rideDate = new Date(ride.departure_datetime || ride.datetime_start);
        const dayMatch = rideDate.toDateString() === searchDate.toDateString();
        
        if (dayMatch || !includeTime) {
          results.push({
            id: ride._id || ride.id,
            type: "ride",
            driverName: ride.driver?.first_name || "Driver",
            pickupLocation: ride.home_address || ride.home_city || "Pickup location",
            dropoffLocation: selectedAirport.name,
            departureTime: ride.departure_datetime || ride.datetime_start,
            availableSeats: ride.available_seats || ride.seats_left || ride.total_seats,
            pricePerSeat: ride.price_per_seat,
          });
        }
      });
      
      // Process requests
      availableRequests?.forEach((request: any) => {
        const requestDate = new Date(request.preferred_datetime);
        const dayMatch = requestDate.toDateString() === searchDate.toDateString();
        
        if (dayMatch || !includeTime) {
          results.push({
            id: request._id,
            type: "request",
            passengerName: request.passenger?.first_name || "Passenger",
            pickupLocation: request.location_address || request.location_city || "Pickup location",
            dropoffLocation: selectedAirport.name,
            departureTime: request.preferred_datetime,
            passengers: request.seats_needed,
          });
        }
      });
      
      setSearchResults(results);
    } catch (error) {
      console.error("Search error:", error);
      Alert.alert("Error", "Failed to search for rides. Please try again.");
    }
    
    setIsSearching(false);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return {
      date: date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
      time: date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const isToAirport = searchDirection === "to_airport";
  const themeColor = isToAirport ? "#3B82F6" : "#8B5CF6";
  const themeGradient: [string, string] = isToAirport 
    ? ["#3B82F6", "#2563EB"] 
    : ["#8B5CF6", "#7C3AED"];

  const renderStepIndicator = () => {
    if (step === "results") return null;
    return (
      <View style={styles.stepIndicator}>
        <View style={[styles.stepDot, step === "airport" && { backgroundColor: themeColor }]} />
        <View style={[styles.stepLine, (step === "location" || step === "datetime") && { backgroundColor: themeColor }]} />
        <View style={[styles.stepDot, (step === "location" || step === "datetime") && { backgroundColor: themeColor }]} />
        <View style={[styles.stepLine, step === "datetime" && { backgroundColor: themeColor }]} />
        <View style={[styles.stepDot, step === "datetime" && { backgroundColor: themeColor }]} />
      </View>
    );
  };

  const renderAirportStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {isToAirport ? "Which airport are you flying from?" : "Which airport did you land at?"}
      </Text>
      
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={20} color="#64748B" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search airports by name, city, or code..."
          value={airportSearch}
          onChangeText={setAirportSearch}
          placeholderTextColor="#94A3B8"
          autoFocus
        />
        {airportSearch.length > 0 && (
          <TouchableOpacity onPress={() => setAirportSearch("")}>
            <Ionicons name="close-circle" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {airportsLoading ? (
        <ActivityIndicator size="large" color={themeColor} style={styles.loader} />
      ) : (
        <FlatList
          data={filteredAirports.slice(0, 20)}
          keyExtractor={(item) => item._id || item.id || String(Math.random())}
          style={styles.airportList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.airportItem}
              onPress={() => handleSelectAirport(item)}
            >
              <View style={[styles.airportCodeBadge, { backgroundColor: themeColor + "20" }]}>
                <Text style={[styles.airportCode, { color: themeColor }]}>{item.iata_code}</Text>
              </View>
              <View style={styles.airportInfo}>
                <Text style={styles.airportName}>{item.name}</Text>
                <Text style={styles.airportCity}>{item.city}, {item.country}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyList}>
              <Ionicons name="airplane-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyText}>No airports found</Text>
            </View>
          }
        />
      )}
    </View>
  );

  const renderLocationStep = () => (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0}
    >
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>
          {isToAirport ? "Where should the driver pick you up?" : "Where do you need to go?"}
        </Text>

        <View style={[styles.selectedAirportBadge, { backgroundColor: themeColor + "15" }]}>
          <Ionicons name="airplane" size={16} color={themeColor} />
          <Text style={styles.selectedAirportText}>
            {selectedAirport?.iata_code} - {selectedAirport?.name}
          </Text>
        </View>

        {/* Search input at TOP - so results are visible above keyboard */}
        <Text style={styles.inputLabel}>🔍 Search for your location:</Text>
        <View style={styles.locationSearchContainer}>
          <View style={[styles.manualAddressContainer, showLocationSuggestions && styles.manualAddressContainerActive]}>
            <Ionicons name="search" size={20} color={themeColor} />
            <TextInput
              style={styles.manualAddressInput}
              placeholder="Type city, neighborhood, or address..."
              value={locationAddress}
              onChangeText={handleLocationInputChange}
              onFocus={() => {
                setIsLocationInputFocused(true);
                if (locationSuggestions.length > 0) {
                  setShowLocationSuggestions(true);
                }
              }}
              onBlur={() => setIsLocationInputFocused(false)}
              placeholderTextColor="#94A3B8"
              returnKeyType="search"
            />
            {isSearchingLocation && (
              <ActivityIndicator size="small" color={themeColor} />
            )}
            {!isSearchingLocation && locationAddress.length > 0 && (
              <TouchableOpacity onPress={() => {
                setLocationAddress("");
                setLocationCoords(null);
                setLocationSuggestions([]);
                setShowLocationSuggestions(false);
              }}>
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Location Suggestions Dropdown - positioned for visibility */}
          {showLocationSuggestions && locationSuggestions.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {locationSuggestions.map((suggestion, index) => {
                const mainText = suggestion.display_name.split(",")[0];
                const secondaryText = suggestion.display_name.split(",").slice(1, 3).join(",");
                
                return (
                  <View
                    key={suggestion.place_id || index}
                    style={[
                      styles.suggestionItem,
                      index === locationSuggestions.length - 1 && styles.suggestionItemLast
                    ]}
                  >
                    <TouchableOpacity 
                      style={styles.suggestionMainContent}
                      onPress={() => handleSelectLocationSuggestion(suggestion, false)}
                    >
                      <View style={styles.suggestionIcon}>
                        <Ionicons name="location" size={18} color={themeColor} />
                      </View>
                      <View style={styles.suggestionTextContainer}>
                        <Text style={styles.suggestionMainText} numberOfLines={1}>{mainText}</Text>
                        <Text style={styles.suggestionSecondaryText} numberOfLines={1}>{secondaryText}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.viewOnMapButton}
                      onPress={() => handleSelectLocationSuggestion(suggestion, true)}
                    >
                      <Ionicons name="map-outline" size={18} color={themeColor} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Show selected location with coordinates */}
        {locationCoords && locationCoords.lat !== 0 && (
          <View style={styles.selectedLocationBadge}>
            <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
            <Text style={styles.selectedLocationText}>Location confirmed</Text>
            <TouchableOpacity 
              style={styles.viewOnMapLink}
              onPress={() => {
                setMapInitialLocation({ latitude: locationCoords.lat, longitude: locationCoords.lng });
                global.setTimeout(() => setShowMapPicker(true), 100);
              }}
            >
              <Text style={[styles.viewOnMapLinkText, { color: themeColor }]}>View on map</Text>
              <Ionicons name="open-outline" size={14} color={themeColor} />
            </TouchableOpacity>
          </View>
        )}

        {/* Other options - shown below when not typing */}
        {!showLocationSuggestions && (
          <>
            <View style={[styles.orDivider, { marginTop: 20 }]}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.locationPickerContainer}>
              {/* Use My Location Button */}
              <TouchableOpacity
                style={[styles.useLocationButton, { borderColor: themeColor }]}
                onPress={handleGetMyLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <ActivityIndicator size="small" color={themeColor} />
                ) : (
                  <Ionicons name="navigate" size={20} color={themeColor} />
                )}
                <Text style={[styles.useLocationButtonText, { color: themeColor }]}>
                  {gettingLocation ? "Getting location..." : "Use My Current Location"}
                </Text>
              </TouchableOpacity>

              {/* Pick on Map Button */}
              <TouchableOpacity
                style={styles.mapPickerButton}
                onPress={() => setShowMapPicker(true)}
              >
                <Ionicons name="map" size={20} color="#64748B" />
                <Text style={styles.mapPickerButtonText}>Pick Location on Map</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.locationHint}>
              💡 Select a suggestion or use the buttons above
            </Text>
          </>
        )}

        <View style={[styles.stepNavigation, showLocationSuggestions && { marginTop: 16 }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setShowLocationSuggestions(false);
              Keyboard.dismiss();
              setStep("airport");
            }}
          >
            <Ionicons name="arrow-back" size={20} color="#64748B" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: themeColor }]}
            onPress={() => {
              setShowLocationSuggestions(false);
              Keyboard.dismiss();
              setStep("datetime");
            }}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );

  const renderDateTimeStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>When do you need the ride?</Text>

      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <Ionicons name="airplane" size={18} color={themeColor} />
          <Text style={styles.summaryText}>{selectedAirport?.name}</Text>
        </View>
        {locationAddress ? (
          <View style={styles.summaryRow}>
            <Ionicons name="location" size={18} color={themeColor} />
            <Text style={styles.summaryText} numberOfLines={1}>{locationAddress}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.dateTimeSection}>
        {/* Date Picker */}
        <TouchableOpacity
          style={styles.dateTimeButton}
          onPress={() => setShowDatePicker(true)}
        >
          <View style={[styles.dateTimeIconContainer, { backgroundColor: themeColor + "15" }]}>
            <Ionicons name="calendar" size={24} color={themeColor} />
          </View>
          <View style={styles.dateTimeTextContainer}>
            <Text style={styles.dateTimeLabel}>Date *</Text>
            <Text style={styles.dateTimeValue}>
              {selectedDate.toLocaleDateString("en-US", { 
                weekday: "short", 
                month: "short", 
                day: "numeric" 
              })}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#94A3B8" />
        </TouchableOpacity>

        {/* Time Picker (Optional) */}
        <TouchableOpacity
          style={styles.dateTimeButton}
          onPress={() => setShowTimePicker(true)}
        >
          <View style={[styles.dateTimeIconContainer, { backgroundColor: includeTime ? themeColor + "15" : "#F1F5F9" }]}>
            <Ionicons name="time" size={24} color={includeTime ? themeColor : "#94A3B8"} />
          </View>
          <View style={styles.dateTimeTextContainer}>
            <Text style={styles.dateTimeLabel}>Time (optional)</Text>
            <Text style={[styles.dateTimeValue, !includeTime && styles.dateTimeOptional]}>
              {includeTime 
                ? selectedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
                : "Any time (±4h flexibility)"}
            </Text>
          </View>
          {includeTime && (
            <TouchableOpacity onPress={() => setIncludeTime(false)}>
              <Ionicons name="close-circle" size={20} color="#94A3B8" />
            </TouchableOpacity>
          )}
          {!includeTime && <Ionicons name="chevron-forward" size={20} color="#94A3B8" />}
        </TouchableOpacity>

        <Text style={styles.timeNote}>
          💡 Leaving time optional will show rides within ±4 hours of the entire day
        </Text>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleDateChange}
          minimumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={handleTimeChange}
        />
      )}

      <View style={styles.stepNavigation}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setStep("location")}
        >
          <Ionicons name="arrow-back" size={20} color="#64748B" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.searchButton, { backgroundColor: themeColor }]}
          onPress={handleSearch}
        >
          <Ionicons name="search" size={20} color="#fff" />
          <Text style={styles.searchButtonText}>Search Rides</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderResultsStep = () => {
    if (isSearching) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColor} />
          <Text style={styles.loadingText}>Searching for rides...</Text>
        </View>
      );
    }

    return (
      <View style={styles.stepContent}>
        {/* Search Summary */}
        <View style={styles.resultsSummary}>
          <View style={styles.summaryRow}>
            <Ionicons name="airplane" size={16} color={themeColor} />
            <Text style={styles.summaryText}>{selectedAirport?.name}</Text>
          </View>
          {locationAddress ? (
            <View style={styles.summaryRow}>
              <Ionicons name="location" size={16} color={themeColor} />
              <Text style={styles.summaryText}>{locationAddress}</Text>
            </View>
          ) : null}
          <View style={styles.summaryRow}>
            <Ionicons name="calendar" size={16} color={themeColor} />
            <Text style={styles.summaryText}>
              {selectedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {includeTime && ` at ${selectedDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`}
            </Text>
          </View>
        </View>

        {/* Results Count */}
        <Text style={styles.resultsCount}>
          {searchResults.length} {searchResults.length === 1 ? "result" : "results"} found
        </Text>

        {/* Results List */}
        {searchResults.length === 0 ? (
          <View style={styles.noResults}>
            <Ionicons name="search-outline" size={64} color="#CBD5E1" />
            <Text style={styles.noResultsTitle}>No rides found</Text>
            <Text style={styles.noResultsSubtitle}>
              Try adjusting your search criteria or create a request
            </Text>
            <TouchableOpacity
              style={[styles.createRequestButton, { backgroundColor: themeColor }]}
              onPress={() => router.push("/(tabs)/requests/create")}
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.createRequestButtonText}>Create a Request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.resultsList}>
            {searchResults.map((result) => {
              const dateTime = formatDateTime(result.departureTime);
              const isRide = result.type === "ride";
              
              return (
                <TouchableOpacity
                  key={`${result.type}-${result.id}`}
                  style={styles.resultCard}
                  onPress={() => {
                    if (isRide) {
                      router.push(`/(tabs)/rides/${result.id}`);
                    } else {
                      router.push(`/(tabs)/requests/${result.id}`);
                    }
                  }}
                >
                  <View style={styles.resultCardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: isRide ? "#DBEAFE" : "#F3E8FF" }]}>
                      <Ionicons 
                        name={isRide ? "car" : "hand-right"} 
                        size={14} 
                        color={isRide ? "#3B82F6" : "#8B5CF6"} 
                      />
                      <Text style={[styles.typeBadgeText, { color: isRide ? "#3B82F6" : "#8B5CF6" }]}>
                        {isRide ? "Ride" : "Request"}
                      </Text>
                    </View>
                    {isRide && result.pricePerSeat && (
                      <View style={styles.priceTag}>
                        <Text style={styles.priceText}>€{result.pricePerSeat}/seat</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.resultUserInfo}>
                    <View style={styles.resultAvatar}>
                      <Ionicons name="person" size={18} color="#64748B" />
                    </View>
                    <Text style={styles.resultUserName}>
                      {isRide ? result.driverName : result.passengerName}
                    </Text>
                  </View>

                  <View style={styles.resultRoute}>
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: "#3B82F6" }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{result.pickupLocation}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routePoint}>
                      <View style={[styles.routeDot, { backgroundColor: "#EF4444" }]} />
                      <Text style={styles.routeText} numberOfLines={1}>{result.dropoffLocation}</Text>
                    </View>
                  </View>

                  <View style={styles.resultFooter}>
                    <View style={styles.resultDateTime}>
                      <Ionicons name="calendar-outline" size={14} color="#64748B" />
                      <Text style={styles.resultDateTimeText}>{dateTime.date}</Text>
                      <Ionicons name="time-outline" size={14} color="#64748B" style={{ marginLeft: 8 }} />
                      <Text style={styles.resultDateTimeText}>{dateTime.time}</Text>
                    </View>
                    <View style={styles.resultSeats}>
                      <Ionicons name="people-outline" size={14} color="#64748B" />
                      <Text style={styles.resultSeatsText}>
                        {isRide ? `${result.availableSeats} seats` : `${result.passengers} pax`}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* New Search Button */}
        <TouchableOpacity
          style={styles.newSearchButton}
          onPress={() => {
            setStep("airport");
            setSelectedAirport(null);
            setLocationAddress("");
            setSearchResults([]);
          }}
        >
          <Ionicons name="refresh" size={18} color={themeColor} />
          <Text style={[styles.newSearchButtonText, { color: themeColor }]}>New Search</Text>
        </TouchableOpacity>
      </View>
    );
  };

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
          onPress={() => {
            if (step === "results") {
              setStep("datetime");
            } else {
              router.back();
            }
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Ionicons 
            name={isToAirport ? "airplane" : "home"} 
            size={24} 
            color="#fff" 
          />
          <Text style={styles.headerTitle}>
            {step === "results" 
              ? `Results for ${selectedAirport?.iata_code}`
              : isToAirport ? "Find ride TO Airport" : "Find ride FROM Airport"}
          </Text>
        </View>
      </LinearGradient>

      {/* Step Indicator */}
      {step !== "results" && (
        <View style={styles.stepIndicatorContainer}>
          {renderStepIndicator()}
          <View style={styles.stepLabels}>
            <Text style={[styles.stepLabel, step === "airport" && { color: themeColor, fontWeight: "700" }]}>Airport</Text>
            <Text style={[styles.stepLabel, step === "location" && { color: themeColor, fontWeight: "700" }]}>Location</Text>
            <Text style={[styles.stepLabel, step === "datetime" && { color: themeColor, fontWeight: "700" }]}>When</Text>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView 
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {step === "airport" && renderAirportStep()}
        {step === "location" && renderLocationStep()}
        {step === "datetime" && renderDateTimeStep()}
        {step === "results" && renderResultsStep()}
      </ScrollView>

      {/* Map Location Picker Modal */}
      <MapLocationPicker
        visible={showMapPicker}
        onClose={() => {
          setShowMapPicker(false);
          setMapInitialLocation(undefined);
        }}
        onSelectLocation={handleMapLocationSelect}
        initialLocation={mapInitialLocation || (locationCoords ? { latitude: locationCoords.lat, longitude: locationCoords.lng } : undefined)}
      />
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
    marginRight: 12,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    marginLeft: 10,
  },
  stepIndicatorContainer: {
    paddingHorizontal: 40,
    paddingVertical: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#CBD5E1",
  },
  stepLine: {
    flex: 1,
    height: 3,
    backgroundColor: "#CBD5E1",
    marginHorizontal: 4,
  },
  stepLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  stepLabel: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#1E293B",
  },
  loader: {
    marginTop: 40,
  },
  airportList: {
    maxHeight: 400,
  },
  airportItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  airportCodeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 12,
  },
  airportCode: {
    fontSize: 14,
    fontWeight: "700",
  },
  airportInfo: {
    flex: 1,
  },
  airportName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  airportCity: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  emptyList: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#94A3B8",
    marginTop: 12,
  },
  selectedAirportBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  selectedAirportText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginLeft: 8,
  },
  locationPickerContainer: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    color: "#64748B",
    marginBottom: 10,
    fontWeight: "500",
  },
  manualAddressContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  manualAddressInput: {
    flex: 1,
    fontSize: 15,
    color: "#1E293B",
    marginLeft: 10,
  },
  manualAddressContainerActive: {
    borderColor: "#3B82F6",
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  locationSearchContainer: {
    position: "relative",
    zIndex: 100,
  },
  suggestionsContainer: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#3B82F6",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionMainContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EFF6FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionMainText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  suggestionSecondaryText: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
  },
  viewOnMapButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  selectedLocationBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  selectedLocationText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "500",
    marginLeft: 6,
    flex: 1,
  },
  viewOnMapLink: {
    flexDirection: "row",
    alignItems: "center",
  },
  viewOnMapLinkText: {
    fontSize: 13,
    fontWeight: "600",
    marginRight: 4,
  },
  locationHint: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 12,
  },
  mapPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  mapPickerButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 10,
  },
  stepNavigation: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 30,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: "#64748B",
    marginLeft: 6,
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginRight: 8,
  },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  summaryText: {
    fontSize: 14,
    color: "#1E293B",
    marginLeft: 10,
    flex: 1,
  },
  dateTimeSection: {
    marginBottom: 20,
  },
  dateTimeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  dateTimeIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  dateTimeTextContainer: {
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 13,
    color: "#64748B",
  },
  dateTimeValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 2,
  },
  dateTimeOptional: {
    color: "#94A3B8",
    fontWeight: "400",
  },
  timeNote: {
    fontSize: 13,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 8,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  // Use My Location Button Styles
  useLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    marginBottom: 16,
  },
  useLocationButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 10,
  },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E2E8F0",
  },
  orText: {
    fontSize: 14,
    color: "#94A3B8",
    fontWeight: "600",
    paddingHorizontal: 16,
  },
  // Results Step Styles
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748B",
  },
  resultsSummary: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 16,
  },
  noResults: {
    alignItems: "center",
    paddingVertical: 40,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 16,
  },
  noResultsSubtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  createRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  createRequestButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 8,
  },
  resultsList: {
    gap: 12,
  },
  resultCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultCardHeader: {
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
    marginLeft: 5,
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
    color: "#3B82F6",
  },
  resultUserInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  resultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  resultUserName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  resultRoute: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  routeText: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: "#CBD5E1",
    marginLeft: 4,
    marginVertical: 4,
  },
  resultFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultDateTime: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultDateTimeText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 4,
  },
  resultSeats: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultSeatsText: {
    fontSize: 13,
    color: "#64748B",
    marginLeft: 4,
  },
  newSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    marginTop: 20,
  },
  newSearchButtonText: {
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
});
