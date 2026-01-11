import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  TextInput,
  FlatList,
  Keyboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";

export interface MapLocationData {
  address: string;
  city: string;
  postcode: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface MapLocationPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectLocation: (location: MapLocationData) => void;
  initialLocation?: { latitude: number; longitude: number };
  showAirports?: boolean;
}

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: any;
}

export default function MapLocationPicker({
  visible,
  onClose,
  onSelectLocation,
  initialLocation = { latitude: 33.5731, longitude: -7.5898 }, // Casablanca default
  showAirports = true,
}: MapLocationPickerProps) {
  const webViewRef = useRef<WebView>(null);
  const [selectedLocation, setSelectedLocation] =
    useState<MapLocationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [currentCoords, setCurrentCoords] = useState(initialLocation);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsLoading(true);
      setSelectedLocation(null);
      setSearchQuery("");
      setSearchResults([]);
      setShowResults(false);
    }
  }, [visible]);

  // Manual search function - only called when user presses search button
  const handleSearch = async () => {
    if (searchQuery.length < 2) {
      Alert.alert("Search", "Please enter at least 2 characters");
      return;
    }
    Keyboard.dismiss();
    searchPlaces(searchQuery);
  };

  const searchPlaces = async (query: string) => {
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          query
        )}&format=json&addressdetails=1&limit=5&countrycodes=ma`,
        { headers: { "User-Agent": "MyAirportApp/1.0" } }
      );
      const data = await response.json();
      setSearchResults(data);
      setShowResults(data.length > 0);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    setSearchQuery(result.display_name.split(",")[0]);
    setShowResults(false);
    setSearchResults([]);
    Keyboard.dismiss();

    // Move map to location
    setCurrentCoords({ latitude: lat, longitude: lng });
    webViewRef.current?.injectJavaScript(`
      map.setView([${lat}, ${lng}], 15);
      true;
    `);

    // Set location data
    const address = result.address || {};
    setSelectedLocation({
      address: result.display_name,
      city:
        address.city ||
        address.town ||
        address.village ||
        address.municipality ||
        "",
      postcode: address.postcode || "",
      country: address.country || "Morocco",
      latitude: lat,
      longitude: lng,
    });
  };

  const getMyLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Please enable location permissions.");
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;
      setCurrentCoords({ latitude, longitude });

      // Move map
      webViewRef.current?.injectJavaScript(`
        map.setView([${latitude}, ${longitude}], 15);
        true;
      `);

      // Reverse geocode
      await reverseGeocode(latitude, longitude);
    } catch (error) {
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setIsGettingLocation(false);
    }
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
        { headers: { "User-Agent": "MyAirportApp/1.0" } }
      );
      const data = await response.json();
      const address = data.address || {};

      setSelectedLocation({
        address: data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city:
          address.city ||
          address.town ||
          address.village ||
          address.municipality ||
          "",
        postcode: address.postcode || "",
        country: address.country || "",
        latitude: lat,
        longitude: lng,
      });
    } catch (error) {
      setSelectedLocation({
        address: `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
        city: "",
        postcode: "",
        country: "",
        latitude: lat,
        longitude: lng,
      });
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "mapMoved") {
        // Map was dragged, update location
        reverseGeocode(data.lat, data.lng);
      } else if (data.type === "ready") {
        setIsLoading(false);
      }
    } catch (e) {
      console.error("Message error:", e);
    }
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelectLocation(selectedLocation);
      onClose();
    }
  };

  const mapHTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #map { width: 100%; height: 100%; }
.center-pin {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -100%);
  z-index: 1000;
  pointer-events: none;
  font-size: 40px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  transition: transform 0.1s;
}
.center-pin.dragging {
  transform: translate(-50%, -110%);
}
.center-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  background: rgba(0,0,0,0.2);
  border-radius: 50%;
  z-index: 999;
}
</style>
</head>
<body>
<div id="map"></div>
<div class="center-pin" id="pin">📍</div>
<div class="center-dot"></div>
<script>
var map = L.map('map', {
  zoomControl: true,
  attributionControl: false
}).setView([${currentCoords.latitude}, ${currentCoords.longitude}], 14);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

var pin = document.getElementById('pin');
var hasSentInitial = false;

// Lift pin when dragging starts
map.on('movestart', function() {
  pin.classList.add('dragging');
});

// Drop pin and send location when dragging ends (after 800ms delay)
var sendTimer;
map.on('moveend', function() {
  pin.classList.remove('dragging');
  clearTimeout(sendTimer);
  sendTimer = setTimeout(function() {
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapMoved',
      lat: center.lat,
      lng: center.lng
    }));
  }, 800);
  
  // Send initial location once map loads
  if (!hasSentInitial) {
    hasSentInitial = true;
    var center = map.getCenter();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'mapMoved',
      lat: center.lat,
      lng: center.lng
    }));
  }
});

setTimeout(function() {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
}, 500);
</script>
</body>
</html>
`;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Location</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search city, address..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery("");
                  setShowResults(false);
                  setSearchResults([]);
                }}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.searchButton}
              onPress={handleSearch}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.searchButtonText}>Search</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <View style={styles.searchResults}>
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item.place_id.toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.searchResultItem}
                    onPress={() => selectSearchResult(item)}
                  >
                    <Ionicons
                      name="location-outline"
                      size={18}
                      color="#007AFF"
                    />
                    <Text style={styles.searchResultText} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>

        {/* GPS Button */}
        <TouchableOpacity
          style={styles.gpsButton}
          onPress={getMyLocation}
          disabled={isGettingLocation}
        >
          {isGettingLocation ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="navigate" size={18} color="#fff" />
          )}
          <Text style={styles.gpsButtonText}>
            {isGettingLocation ? "Getting location..." : "Use My Location"}
          </Text>
        </TouchableOpacity>

        {/* Map */}
        <View style={styles.mapContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Loading map...</Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ html: mapHTML }}
            style={styles.map}
            onMessage={handleMessage}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onLoadEnd={() => setIsLoading(false)}
          />

          {/* Instructions overlay */}
          <View style={styles.instructionBanner}>
            <Text style={styles.instructionText}>
              Drag the map to move the pin
            </Text>
          </View>
        </View>

        {/* Bottom Panel with Location Info & Confirm */}
        <View style={styles.bottomPanel}>
          {isReverseGeocoding ? (
            <View style={styles.locationLoading}>
              <ActivityIndicator size="small" color="#007AFF" />
              <Text style={styles.locationLoadingText}>Getting address...</Text>
            </View>
          ) : selectedLocation ? (
            <View style={styles.locationInfo}>
              <Ionicons name="location" size={24} color="#28a745" />
              <View style={styles.locationTextContainer}>
                <Text style={styles.locationCity} numberOfLines={1}>
                  {selectedLocation.city || "Selected Location"}
                  {selectedLocation.postcode
                    ? ` • ${selectedLocation.postcode}`
                    : ""}
                </Text>
                <Text style={styles.locationAddress} numberOfLines={2}>
                  {selectedLocation.address}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.locationPlaceholder}>
              <Text style={styles.locationPlaceholderText}>
                Move the map to select a location
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.confirmButton,
              (!selectedLocation || isReverseGeocoding) &&
                styles.confirmButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={!selectedLocation || isReverseGeocoding}
          >
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.confirmButtonText}>Confirm This Location</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
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
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
  },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
    zIndex: 100,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 4,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 4,
  },
  searchButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  searchResults: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 10,
    maxHeight: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 1000,
  },
  searchResultItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 10,
  },
  searchResultText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  gpsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#28a745",
    marginHorizontal: 16,
    marginVertical: 10,
    paddingVertical: 12,
    borderRadius: 10,
  },
  gpsButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#666",
  },
  instructionBanner: {
    position: "absolute",
    top: 10,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  instructionText: {
    color: "#fff",
    fontSize: 13,
    textAlign: "center",
  },
  bottomPanel: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  locationLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  locationLoadingText: {
    fontSize: 14,
    color: "#666",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 13,
    color: "#666",
    lineHeight: 18,
  },
  locationPlaceholder: {
    paddingVertical: 16,
    marginBottom: 16,
  },
  locationPlaceholderText: {
    fontSize: 14,
    color: "#999",
    textAlign: "center",
  },
  confirmButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
  },
  confirmButtonDisabled: {
    backgroundColor: "#ccc",
  },
  confirmButtonText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
});
